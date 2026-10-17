CREATE TABLE public.player_accounts (
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
CREATE POLICY "Read own account" ON public.player_accounts FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.owned_items (
  user_id uuid NOT NULL,
  item_id text NOT NULL,
  bought_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);
GRANT SELECT ON public.owned_items TO authenticated;
GRANT ALL ON public.owned_items TO service_role;
ALTER TABLE public.owned_items ENABLE ROW LEVEL SECURITY;
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