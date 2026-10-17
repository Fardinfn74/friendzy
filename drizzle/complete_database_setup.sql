-- ================================================================
-- FRIENDZY: Complete Database Setup Script
-- Run this entire script in Supabase Dashboard -> SQL Editor -> New Query
-- ================================================================

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token text UNIQUE NOT NULL,
  display_name text NOT NULL,
  avatar_id text NOT NULL DEFAULT 'fox',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Games Table
CREATE TABLE IF NOT EXISTS public.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  host_id uuid NOT NULL REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'lobby',
  game_type text NOT NULL DEFAULT 'imposter',
  game_mode text NOT NULL DEFAULT 'classic',
  game_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  difficulty text NOT NULL DEFAULT 'medium',
  imposter_count int NOT NULL DEFAULT 1,
  max_players int NOT NULL DEFAULT 12,
  category text,
  secret_word text,
  decoy_word text,
  ai_theme text,
  ai_word text,
  ai_category text,
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
CREATE INDEX IF NOT EXISTS games_code_idx ON public.games (code);

-- 3. Game Players Table
CREATE TABLE IF NOT EXISTS public.game_players (
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

-- 4. Hints Table
CREATE TABLE IF NOT EXISTS public.hints (
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

-- 5. Votes Table
CREATE TABLE IF NOT EXISTS public.votes (
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
CREATE INDEX IF NOT EXISTS votes_game_round_idx ON public.votes (game_id, round_number);

-- 6. Word Bank Table
CREATE TABLE IF NOT EXISTS public.word_bank (
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
('Activities','Fencing','hard'),('Activities','Curling','hard'),('Activities','Spelunking','hard'),('Activities','Falconry','hard')
ON CONFLICT DO NOTHING;

-- 7. Player Accounts & Shop Items
CREATE TABLE IF NOT EXISTS public.player_accounts (
  user_id uuid PRIMARY KEY,
  username text NOT NULL UNIQUE,
  display_name text NOT NULL,
  coins integer NOT NULL DEFAULT 200 CHECK (coins >= 0),
  equipped_skin text NOT NULL DEFAULT 'classic',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.player_accounts TO authenticated;
GRANT ALL ON public.player_accounts TO service_role;
ALTER TABLE public.player_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read own account" ON public.player_accounts;
CREATE POLICY "Read own account" ON public.player_accounts FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.owned_items (
  user_id uuid NOT NULL,
  item_id text NOT NULL,
  bought_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);
GRANT SELECT ON public.owned_items TO authenticated;
GRANT ALL ON public.owned_items TO service_role;
ALTER TABLE public.owned_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read own items" ON public.owned_items;
CREATE POLICY "Read own items" ON public.owned_items FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.buy_item(_user uuid, _item text, _price integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE left_coins integer;
BEGIN
  IF EXISTS (SELECT 1 FROM owned_items WHERE user_id = _user AND item_id = _item) THEN
    RAISE EXCEPTION 'You already own this.';
  END IF;
  UPDATE player_accounts SET coins = coins - _price WHERE user_id = _user AND coins >= _price RETURNING coins INTO left_coins;
  IF left_coins IS NULL THEN RAISE EXCEPTION 'Not enough coins.'; END IF;
  INSERT INTO owned_items (user_id, item_id) VALUES (_user, _item);
  RETURN left_coins;
END $$;
REVOKE ALL ON FUNCTION public.buy_item(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buy_item(uuid, text, integer) TO service_role;

-- 8. SECURITY DEFINER RPC Functions (bypasses RLS safely for profile creation)
CREATE OR REPLACE FUNCTION public.rpc_upsert_profile(
  p_session_token TEXT,
  p_display_name  TEXT,
  p_avatar_id     TEXT
)
RETURNS TABLE (id UUID, display_name TEXT, avatar_id TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.profiles (session_token, display_name, avatar_id, last_seen_at)
  VALUES (p_session_token, p_display_name, p_avatar_id, NOW())
  ON CONFLICT (session_token)
  DO UPDATE SET
    display_name = EXCLUDED.display_name,
    avatar_id    = EXCLUDED.avatar_id,
    last_seen_at = NOW()
  RETURNING profiles.id, profiles.display_name, profiles.avatar_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_upsert_profile(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_get_profile(
  p_session_token TEXT
)
RETURNS TABLE (id UUID, display_name TEXT, avatar_id TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT profiles.id, profiles.display_name, profiles.avatar_id
  FROM public.profiles
  WHERE profiles.session_token = p_session_token
  LIMIT 1;
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_get_profile(TEXT) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_touch_profile(
  p_profile_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET last_seen_at = NOW()
  WHERE id = p_profile_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_touch_profile(UUID) TO anon, authenticated, service_role;

-- Enable Realtime for live multiplayer updates on games & players
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_players;
