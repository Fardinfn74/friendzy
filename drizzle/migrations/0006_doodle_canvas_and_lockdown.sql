-- 0006: Doodle Rush canvas snapshots + database lock-down.
-- Run this once in the Supabase SQL editor (it is safe to run again).

-- 1) One row per room holding the latest drawing. Kept out of `games` so every poll stays small.
CREATE TABLE IF NOT EXISTS public.draw_canvas (
  game_id      uuid PRIMARY KEY REFERENCES public.games(id) ON DELETE CASCADE,
  round_number integer     NOT NULL DEFAULT 0,
  seq          integer     NOT NULL DEFAULT 0,
  strokes      jsonb       NOT NULL DEFAULT '[]'::jsonb,
  updated_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.draw_canvas ENABLE ROW LEVEL SECURITY;  -- no policies: only the server (service role) can touch it

-- 2) Nothing in the game tables should be reachable with the public (browser) key.
--    The server uses the service-role key, which bypasses these grants.
REVOKE ALL ON public.profiles, public.games, public.game_players, public.hints, public.votes,
              public.word_bank, public.draw_canvas FROM anon, authenticated;
REVOKE ALL ON public.player_accounts, public.owned_items FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.player_accounts, public.owned_items FROM authenticated;

-- 3) The profile helper functions are only ever called by the server. Anyone holding the public key
--    could otherwise call them directly (spamming profiles). Lock them to the service role.
REVOKE ALL ON FUNCTION public.rpc_upsert_profile(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rpc_get_profile(TEXT)               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rpc_touch_profile(UUID)             FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_upsert_profile(TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_get_profile(TEXT)               TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_touch_profile(UUID)             TO service_role;
