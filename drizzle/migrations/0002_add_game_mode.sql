ALTER TABLE public.games ADD COLUMN game_mode text NOT NULL DEFAULT 'classic';
ALTER TABLE public.games ADD COLUMN decoy_word text;