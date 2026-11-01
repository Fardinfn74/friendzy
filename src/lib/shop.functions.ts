import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { itemById } from "./shop-items";

const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, "Username: 3–20 letters, numbers or _.");

const avatarId = z
  .string()
  .regex(/^[a-z0-9_-]{1,24}$/)
  .default("fox");
const SAFE_ERROR = "Something went wrong on our side. Please try again.";

export const checkUsernameFn = createServerFn({ method: "POST" })
  .validator((d) => z.object({ username }).parse(d))
  .handler(async ({ data }) => {
    const { rateLimit } = await import("./rate-limit.server");
    rateLimit("check-username", 60, 60_000);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("player_accounts")
      .select("user_id")
      .eq("username", data.username)
      .maybeSingle();
    return { available: !row };
  });

export const registerAccountFn = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        username,
        displayName: z.string().trim().min(2).max(16),
        // 8+ characters; 72 is the most the password hash can use, and a cap stops oversized-input abuse
        password: z.string().min(8, "Password needs at least 8 characters.").max(72),
        avatarId,
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { rateLimit } = await import("./rate-limit.server");
    rateLimit("register", 8, 60 * 60_000);
    const { checkDisplayName } = await import("./profanity.server");
    const name = checkDisplayName(data.displayName);
    if (!name.ok) return { ok: false as const, error: name.reason };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Is the username already taken?
    const { data: existing } = await supabaseAdmin
      .from("player_accounts")
      .select("user_id")
      .eq("username", data.username)
      .maybeSingle();
    if (existing) return { ok: false as const, error: "That username is taken." };

    // 2. Create the login. Never reuse or reset an existing login: that would let anyone take it over.
    const email = `${data.username}@players.imposta.app`;
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: name.name, avatar_id: data.avatarId },
    });
    if (authError || !authData?.user) {
      if (/already (been )?registered|already exists/i.test(authError?.message ?? "")) {
        return { ok: false as const, error: "That username is taken." };
      }
      console.error("[register] createUser failed:", authError?.message);
      return { ok: false as const, error: "We couldn't create your account. Please try again." };
    }
    const userId = authData.user.id;

    // 3. Create the player record. If this fails, remove the login again so nothing is left half-made.
    const { error: dbError } = await supabaseAdmin.from("player_accounts").insert({
      user_id: userId,
      username: data.username,
      display_name: name.name,
    });
    if (dbError) {
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
      const taken = dbError.code === "23505" || /username/i.test(dbError.message);
      if (!taken) console.error("[register] player_accounts insert failed:", dbError.message);
      return { ok: false as const, error: taken ? "That username is taken." : SAFE_ERROR };
    }

    return { ok: true as const, userId };
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
  .validator((d) => z.object({ itemId: z.string().max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const item = itemById(data.itemId);
    if (!item) return { ok: false as const, error: "That item doesn't exist." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("buy_item", {
      _user: context.userId,
      _item: item.id,
      _price: item.price,
    });
    if (error) {
      // These two messages are raised on purpose by the database and are meant for players.
      const friendly = /Not enough coins|already own this/i.exec(error.message);
      if (!friendly) console.error("[buy_item]", error.message);
      return { ok: false as const, error: friendly ? error.message : SAFE_ERROR };
    }
    return { ok: true as const };
  });

export const equipSkinFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ skin: z.string().max(40) }).parse(d))
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
  .validator((d) => z.object({ displayName: z.string().trim().min(2).max(16) }).parse(d))
  .handler(async ({ data, context }) => {
    const { checkDisplayName } = await import("./profanity.server");
    const name = checkDisplayName(data.displayName);
    if (!name.ok) return { ok: false as const, error: name.reason };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Only this verified caller's cosmetic display name can change; balances and usernames cannot.
    const { error } = await supabaseAdmin
      .from("player_accounts")
      .update({ display_name: name.name })
      .eq("user_id", context.userId);
    return error
      ? { ok: false as const, error: "Your profile couldn't be saved. Try again." }
      : { ok: true as const };
  });
