ALTER TABLE public.games ADD COLUMN IF NOT EXISTS game_type text NOT NULL DEFAULT 'imposter';
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS game_settings jsonb NOT NULL DEFAULT '{}'::jsonb;
