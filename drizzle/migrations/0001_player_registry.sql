-- REGISTRE GLOBAL DES JOUEURS
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  last_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  birth_date DATE,
  license_number TEXT,
  first_row BOOLEAN NOT NULL DEFAULT false,
  team public.team_code,
  nickname TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.players TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.players TO authenticated;
GRANT ALL ON public.players TO service_role;

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "players readable by authenticated" ON public.players
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "players write by editors" ON public.players
  FOR INSERT TO authenticated
  WITH CHECK (public.can_edit(auth.uid()));

CREATE POLICY "players update by editors" ON public.players
  FOR UPDATE TO authenticated
  USING (public.can_edit(auth.uid()));

CREATE POLICY "players delete by editors" ON public.players
  FOR DELETE TO authenticated
  USING (public.can_edit(auth.uid()));

CREATE INDEX idx_players_team ON public.players(team);
CREATE INDEX idx_players_name ON public.players(last_name, first_name);

-- LIEN OPTIONNEL match_players → players
ALTER TABLE public.match_players
  ADD COLUMN player_id UUID REFERENCES public.players(id) ON DELETE SET NULL;

CREATE INDEX idx_match_players_player ON public.match_players(player_id);
