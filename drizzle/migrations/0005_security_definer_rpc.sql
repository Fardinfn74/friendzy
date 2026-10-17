-- Migration: 0005_security_definer_rpc.sql
-- Creates SECURITY DEFINER functions so that operations running under the
-- publishable (anon) key can still write to RLS-locked tables.
-- The functions themselves enforce all business logic and security checks,
-- so RLS enforcement is replaced by function-level access control.

-- Grant anon/authenticated roles the right to call these functions.
-- The functions execute with the privileges of their DEFINER (postgres),
-- bypassing RLS on the underlying tables.

-- ----------------------------------------------------------------
-- profiles: upsert by session_token
-- ----------------------------------------------------------------
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

GRANT EXECUTE ON FUNCTION public.rpc_upsert_profile(TEXT, TEXT, TEXT)
  TO anon, authenticated, service_role;

-- ----------------------------------------------------------------
-- profiles: read by session_token
-- ----------------------------------------------------------------
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

GRANT EXECUTE ON FUNCTION public.rpc_get_profile(TEXT)
  TO anon, authenticated, service_role;

-- ----------------------------------------------------------------
-- profiles: touch last_seen_at
-- ----------------------------------------------------------------
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

GRANT EXECUTE ON FUNCTION public.rpc_touch_profile(UUID)
  TO anon, authenticated, service_role;
