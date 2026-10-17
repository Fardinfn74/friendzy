import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { itemById } from "./shop-items";

const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, "Username: 3–20 letters, numbers or _.");

export const checkUsernameFn = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ username }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("player_accounts")
      .select("user_id")
      .eq("username", data.username)
      .maybeSingle();
    return { available: !row };
  });

export const createAccountFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ username, displayName: z.string().trim().min(2).max(20) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("player_accounts").insert({
      user_id: context.userId,
      username: data.username,
      display_name: data.displayName,
    });
    if (error && !error.message.includes("player_accounts_pkey")) {
      return {
        ok: false as const,
        error: error.message.includes("username") ? "That username is taken." : error.message,
      };
    }
    return { ok: true as const };
  });

export const getAccountFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: acc }, { data: items }] = await Promise.all([
      context.supabase
        .from("player_accounts")
        .select("username, display_name, coins, equipped_skin")
        .eq("user_id", context.userId)
        .maybeSingle(),
      context.supabase.from("owned_items").select("item_id").eq("user_id", context.userId),
    ]);
    if (!acc) return null;
    return {
      username: acc.username,
      displayName: acc.display_name,
      coins: acc.coins,
      equippedSkin: acc.equipped_skin,
      owned: (items ?? []).map((i) => i.item_id),
    };
  });

export const buyItemFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ itemId: z.string().max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const item = itemById(data.itemId);
    if (!item) return { ok: false as const, error: "That item doesn't exist." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("buy_item", {
      _user: context.userId,
      _item: item.id,
      _price: item.price,
    });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const equipSkinFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ skin: z.string().max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.skin !== "classic") {
      const { data: own } = await supabaseAdmin
        .from("owned_items")
        .select("item_id")
        .eq("user_id", context.userId)
        .eq("item_id", data.skin)
        .maybeSingle();
      if (!own) return { ok: false as const, error: "You don't own that skin." };
    }
    await supabaseAdmin
      .from("player_accounts")
      .update({ equipped_skin: data.skin })
      .eq("user_id", context.userId);
    return { ok: true as const };
  });

export const updateAccountFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ displayName: z.string().trim().min(2).max(16) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Only this verified caller's cosmetic display name can change; balances and usernames cannot.
    const { error } = await supabaseAdmin
      .from("player_accounts")
      .update({ display_name: data.displayName })
      .eq("user_id", context.userId);
    return error
      ? { ok: false as const, error: "Your profile couldn't be saved. Try again." }
      : { ok: true as const };
  });
