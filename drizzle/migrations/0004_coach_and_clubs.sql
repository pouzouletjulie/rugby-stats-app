-- ============================================================
-- 0004 — Rôles coach & admin_club, table clubs, catégories coach
-- ============================================================

-- Nouveaux rôles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'coach';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_club';

-- ── Clubs ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  home_pitch_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.clubs TO anon;
GRANT SELECT ON public.clubs TO authenticated;
GRANT ALL ON public.clubs TO service_role;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clubs readable by all" ON public.clubs FOR SELECT USING (true);
CREATE POLICY "clubs managed by super admins" ON public.clubs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Données initiales
INSERT INTO public.clubs (name, home_pitch_type) VALUES ('AS Meudon Rugby', 'Synthétique')
ON CONFLICT (name) DO NOTHING;

-- ── Profils : club_id ────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL;

-- ── Mise à jour du trigger new user ─────────────────────────
-- Enregistre le club choisi à l'inscription, n'assigne PAS de rôle automatiquement
-- (flux d'approbation admin)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, club_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    NEW.raw_user_meta_data->>'full_name',
    NULLIF(NEW.raw_user_meta_data->>'club_id', '')::UUID
  )
  ON CONFLICT (id) DO UPDATE
    SET club_id = NULLIF(EXCLUDED.club_id::TEXT, '')::UUID;
  RETURN NEW;
END;
$$;

-- ── Catégories coach ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coach_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_code TEXT NOT NULL,
  UNIQUE (user_id, team_code)
);
GRANT SELECT, INSERT, DELETE ON public.coach_categories TO authenticated;
GRANT ALL ON public.coach_categories TO service_role;
ALTER TABLE public.coach_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coach_categories readable" ON public.coach_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "coach_categories managed by admins" ON public.coach_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'admin_club'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'admin_club'));

-- ── can_edit inclut coach et admin_club ──────────────────────
-- Cast ::text pour éviter l'erreur "unsafe use of new enum value" dans la même transaction
CREATE OR REPLACE FUNCTION public.can_edit(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('editeur', 'admin', 'admin_club', 'coach')
  )
$$;
