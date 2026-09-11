-- SAISONS
CREATE TABLE public.seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name)
);

GRANT SELECT ON public.seasons TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.seasons TO authenticated;
GRANT ALL ON public.seasons TO service_role;

ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seasons readable by authenticated" ON public.seasons
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "seasons write by editors" ON public.seasons
  FOR INSERT TO authenticated WITH CHECK (public.can_edit(auth.uid()));

CREATE POLICY "seasons update by editors" ON public.seasons
  FOR UPDATE TO authenticated USING (public.can_edit(auth.uid()));

CREATE POLICY "seasons delete by admins" ON public.seasons
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- LIEN MATCHES → SAISONS
ALTER TABLE public.matches
  ADD COLUMN season_id UUID REFERENCES public.seasons(id) ON DELETE SET NULL;

CREATE INDEX idx_matches_season ON public.matches(season_id);

-- STATS JOUEURS PAR MATCH (peuplées à la finalisation)
CREATE TABLE public.player_match_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  player_number SMALLINT NOT NULL,
  points SMALLINT NOT NULL DEFAULT 0,
  essais SMALLINT NOT NULL DEFAULT 0,
  passes SMALLINT NOT NULL DEFAULT 0,
  offloads SMALLINT NOT NULL DEFAULT 0,
  ballons_touches SMALLINT NOT NULL DEFAULT 0,
  plaquages SMALLINT NOT NULL DEFAULT 0,
  plaquages_offensifs SMALLINT NOT NULL DEFAULT 0,
  plaquages_defensifs SMALLINT NOT NULL DEFAULT 0,
  plaquages_neutres SMALLINT NOT NULL DEFAULT 0,
  jeu_au_pied SMALLINT NOT NULL DEFAULT 0,
  jeu_au_pied_gain SMALLINT NOT NULL DEFAULT 0,
  jap_drop SMALLINT NOT NULL DEFAULT 0,
  jap_penaltouche SMALLINT NOT NULL DEFAULT 0,
  jap_touche SMALLINT NOT NULL DEFAULT 0,
  jap_chandelle SMALLINT NOT NULL DEFAULT 0,
  jap_rasant SMALLINT NOT NULL DEFAULT 0,
  turnovers SMALLINT NOT NULL DEFAULT 0,
  penalites SMALLINT NOT NULL DEFAULT 0,
  cartons SMALLINT NOT NULL DEFAULT 0,
  cinquante_22 SMALLINT NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id, player_number)
);

GRANT SELECT ON public.player_match_stats TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.player_match_stats TO authenticated;
GRANT ALL ON public.player_match_stats TO service_role;

ALTER TABLE public.player_match_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "player_match_stats readable" ON public.player_match_stats
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "player_match_stats write by editors" ON public.player_match_stats
  FOR ALL TO authenticated
  USING (public.can_edit(auth.uid())) WITH CHECK (public.can_edit(auth.uid()));

CREATE INDEX idx_player_match_stats_match ON public.player_match_stats(match_id);
CREATE INDEX idx_player_match_stats_player ON public.player_match_stats(player_id);

-- VUE : STATS JOUEURS PAR SAISON
CREATE VIEW public.player_season_stats AS
SELECT
  pms.player_id,
  p.last_name,
  p.first_name,
  p.nickname,
  m.season_id,
  s.name AS season_name,
  m.team,
  COUNT(DISTINCT pms.match_id)::INTEGER AS matches_joues,
  SUM(pms.points)::INTEGER AS points,
  SUM(pms.essais)::INTEGER AS essais,
  SUM(pms.passes)::INTEGER AS passes,
  SUM(pms.offloads)::INTEGER AS offloads,
  SUM(pms.ballons_touches)::INTEGER AS ballons_touches,
  SUM(pms.plaquages)::INTEGER AS plaquages,
  SUM(pms.jeu_au_pied)::INTEGER AS jeu_au_pied,
  SUM(pms.jeu_au_pied_gain)::INTEGER AS jeu_au_pied_gain,
  SUM(pms.jap_drop)::INTEGER AS jap_drop,
  SUM(pms.jap_penaltouche)::INTEGER AS jap_penaltouche,
  SUM(pms.jap_touche)::INTEGER AS jap_touche,
  SUM(pms.jap_chandelle)::INTEGER AS jap_chandelle,
  SUM(pms.jap_rasant)::INTEGER AS jap_rasant,
  SUM(pms.turnovers)::INTEGER AS turnovers,
  SUM(pms.penalites)::INTEGER AS penalites,
  SUM(pms.cartons)::INTEGER AS cartons,
  SUM(pms.cinquante_22)::INTEGER AS cinquante_22
FROM public.player_match_stats pms
JOIN public.matches m ON m.id = pms.match_id
LEFT JOIN public.players p ON p.id = pms.player_id
LEFT JOIN public.seasons s ON s.id = m.season_id
WHERE pms.player_id IS NOT NULL
  AND m.status = 'finalise'
GROUP BY
  pms.player_id, p.last_name, p.first_name, p.nickname,
  m.season_id, s.name, m.team;

GRANT SELECT ON public.player_season_stats TO authenticated;

-- DONNÉES INITIALES : saison courante
INSERT INTO public.seasons (name, start_date, end_date)
VALUES ('2025-2026', '2025-09-01', '2026-06-30');
