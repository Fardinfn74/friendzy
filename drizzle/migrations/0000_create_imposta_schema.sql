-- Imposta: word-imposter party game.
-- All client access goes through server functions using the service role.
-- Tables are RLS-enabled with no policies and no anon/authenticated grants,
-- so secret_word and is_imposter can never leak to a client query.

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token text UNIQUE NOT NULL,
  display_name text NOT NULL,
  avatar_id text NOT NULL DEFAULT 'fox',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  host_id uuid NOT NULL REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'lobby',
  difficulty text NOT NULL DEFAULT 'medium',
  imposter_count int NOT NULL DEFAULT 1,
  max_players int NOT NULL DEFAULT 12,
  category text,
  secret_word text,
  round_number int NOT NULL DEFAULT 0,
  current_turn_profile_id uuid REFERENCES public.profiles(id),
  turn_deadline timestamptz,
  vote_deadline timestamptz,
  replay_streak int NOT NULL DEFAULT 0,
  last_eliminated_id uuid REFERENCES public.profiles(id),
  last_eliminated_was_imposter boolean,
  last_resolution_note text,
  resolve_until timestamptz,
  pending_status text,
  winner text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.games TO service_role;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
CREATE INDEX games_code_idx ON public.games (code);

CREATE TABLE public.game_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  is_host boolean NOT NULL DEFAULT false,
  is_imposter boolean NOT NULL DEFAULT false,
  is_ready boolean NOT NULL DEFAULT false,
  is_eliminated boolean NOT NULL DEFAULT false,
  left_game boolean NOT NULL DEFAULT false,
  card_seen boolean NOT NULL DEFAULT false,
  turn_order int,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, profile_id)
);
GRANT ALL ON public.game_players TO service_role;
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.hints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  round_number int NOT NULL,
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  message text NOT NULL,
  skipped boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, round_number, profile_id)
);
GRANT ALL ON public.hints TO service_role;
ALTER TABLE public.hints ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  round_number int NOT NULL,
  voter_id uuid NOT NULL REFERENCES public.profiles(id),
  target_id uuid REFERENCES public.profiles(id),
  is_replay_vote boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.votes TO service_role;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
CREATE INDEX votes_game_round_idx ON public.votes (game_id, round_number);

CREATE TABLE public.word_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  word text NOT NULL,
  difficulty text NOT NULL
);
GRANT ALL ON public.word_bank TO service_role;
ALTER TABLE public.word_bank ENABLE ROW LEVEL SECURITY;

INSERT INTO public.word_bank (category, word, difficulty) VALUES
('Animals','Elephant','easy'),('Animals','Penguin','easy'),('Animals','Dolphin','easy'),('Animals','Rabbit','easy'),
('Animals','Platypus','medium'),('Animals','Hedgehog','medium'),('Animals','Chameleon','medium'),('Animals','Meerkat','medium'),
('Animals','Axolotl','hard'),('Animals','Pangolin','hard'),('Animals','Narwhal','hard'),('Animals','Tapir','hard'),
('Food','Pizza','easy'),('Food','Ice Cream','easy'),('Food','Pancake','easy'),('Food','Popcorn','easy'),
('Food','Biryani','medium'),('Food','Lasagna','medium'),('Food','Dumpling','medium'),('Food','Guacamole','medium'),
('Food','Ceviche','hard'),('Food','Baklava','hard'),('Food','Kimchi','hard'),('Food','Tiramisu','hard'),
('Places','Beach','easy'),('Places','Airport','easy'),('Places','Library','easy'),('Places','Hospital','easy'),
('Places','Sundarbans','medium'),('Places','Museum','medium'),('Places','Lighthouse','medium'),('Places','Vineyard','medium'),
('Places','Chernobyl','hard'),('Places','Machu Picchu','hard'),('Places','Catacombs','hard'),('Places','Observatory','hard'),
('Professions','Doctor','easy'),('Professions','Teacher','easy'),('Professions','Chef','easy'),('Professions','Firefighter','easy'),
('Professions','Locksmith','medium'),('Professions','Beekeeper','medium'),('Professions','Tattoo Artist','medium'),('Professions','Air Traffic Controller','medium'),
('Professions','Cartographer','hard'),('Professions','Sommelier','hard'),('Professions','Taxidermist','hard'),('Professions','Actuary','hard'),
('Objects','Umbrella','easy'),('Objects','Toothbrush','easy'),('Objects','Mirror','easy'),('Objects','Backpack','easy'),
('Objects','Compass','medium'),('Objects','Metronome','medium'),('Objects','Kaleidoscope','medium'),('Objects','Stapler','medium'),
('Objects','Sextant','hard'),('Objects','Abacus','hard'),('Objects','Gramophone','hard'),('Objects','Theremin','hard'),
('Activities','Swimming','easy'),('Activities','Dancing','easy'),('Activities','Camping','easy'),('Activities','Karaoke','easy'),
('Activities','Bowling','medium'),('Activities','Gardening','medium'),('Activities','Snorkeling','medium'),('Activities','Pottery','medium'),
('Activities','Fencing','hard'),('Activities','Curling','hard'),('Activities','Spelunking','hard'),('Activities','Falconry','hard');
