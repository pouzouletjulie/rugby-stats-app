-- 0005 — Champ notes sur les matchs
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS notes TEXT;
