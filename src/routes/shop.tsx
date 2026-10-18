import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { GameLayout } from "@/components/game-layout";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/hooks/use-account";
import { play } from "@/lib/sounds";
import { Emoji } from "@/components/player-avatar";
import { COIN_BUNDLES, SHOP_ITEMS, type ShopItem } from "@/lib/shop-items";
import { buyItemFn, equipSkinFn } from "@/lib/shop.functions";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "Cosmetics Shop — FRIENDZY" },
      {
        name: "description",
        content: "Spend coins on sticker packs and role card skins in FRIENDZY.",
      },
      { property: "og:title", content: "Cosmetics Shop — FRIENDZY" },
      {
        property: "og:description",
        content: "Unlock new player stickers and collectible role card skins.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ShopPage,
});

function ShopPage() {
  const { signedIn, account, loading, refresh } = useAccount();
  const buy = useServerFn(buyItemFn);
  const equip = useServerFn(equipSkinFn);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(id: string, fn: () => Promise<{ ok: boolean; error?: string }>, done: string) {
    setBusy(id);
    setMsg(null);
    try {
      const r = await fn();
      if (!r.ok) setMsg(r.error ?? "Something went wrong.");
      else {
        setMsg(done);
        try {
          play("reveal");
        } catch {
          /* sound optional */
        }
      }
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  const owned = new Set(account?.owned ?? []);
  const section = (kind: ShopItem["kind"], title: string) => (
    <section className="mt-6">
      <h2 className="text-stencil pb-2">{title}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {SHOP_ITEMS.filter((i) => i.kind === kind).map((i) => {
          const has = owned.has(i.id);
          const equipped = account?.equippedSkin === i.id;
          return (
            <div key={i.id} className="play-panel flex flex-col items-center gap-2 p-3 text-center">
              <div
                className={
                  kind === "skin"
                    ? `role-card-mini ${i.id} text-2xl flex items-center justify-center`
                    : "flex items-center justify-center gap-1.5 py-1 min-h-[44px]"
                }
                aria-hidden="true"
              >
                {i.avatars ? (
                  i.avatars.map((av) => (
                    <Emoji
                      key={av.id}
                      value={av.emoji}
                      size={32}
                      className="size-8 drop-shadow-xs"
                    />
                  ))
                ) : (
                  <Emoji value={i.preview} size={32} className="size-8" />
                )}
              </div>
              <p className="font-display text-xl leading-none">{i.name}</p>
              <p className="text-xs text-muted-foreground">{i.description}</p>
              {!signedIn ? null : has ? (
                kind === "skin" ? (
                  <Button
                    size="sm"
                    variant={equipped ? "default" : "secondary"}
                    disabled={equipped || busy === i.id}
                    onClick={() =>
                      run(i.id, () => equip({ data: { skin: i.id } }), `${i.name} equipped!`)
                    }
                  >
                    {equipped ? "Equipped" : "Equip"}
                  </Button>
                ) : (
                  <span className="text-xs font-bold text-crew">Owned ✓</span>
                )
              ) : (
                <Button
                  size="sm"
                  disabled={busy === i.id || (account?.coins ?? 0) < i.price}
                  onClick={() =>
                    run(i.id, () => buy({ data: { itemId: i.id } }), `You unlocked ${i.name}!`)
                  }
                >
                  🪙 {i.price}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );

  return (
    <GameLayout tab="shop" coins={account?.coins}>
      <div className="mx-auto max-w-2xl animate-rise pb-20">
        <h1 className="text-center font-display text-4xl sm:text-5xl">Cosmetics Shop</h1>
        {loading ? (
          <p className="mt-4 text-center text-muted-foreground">Loading…</p>
        ) : !signedIn ? (
          <div className="play-panel mt-4 p-4 text-center">
            <p>Create an account to buy and keep your stickers and skins.</p>
            <Link to="/account">
              <Button className="mt-3">Create account / Sign in</Button>
            </Link>
          </div>
        ) : null}
        {msg && (
          <p role="status" className="mt-4 text-center font-bold">
            {msg}
          </p>
        )}
        {section("pack", "Sticker packs")}
        {section("skin", "Role card skins")}
        {signedIn && account?.equippedSkin !== "classic" && (
          <Button
            variant="secondary"
            className="mt-3 w-full"
            onClick={() =>
              run("classic", () => equip({ data: { skin: "classic" } }), "Classic card equipped.")
            }
          >
            Use classic card
          </Button>
        )}
        <section className="mt-6">
          <h2 className="text-stencil pb-2">Get more coins</h2>
          <div className="grid grid-cols-3 gap-3">
            {COIN_BUNDLES.map((b) => (
              <div key={b.coins} className="play-panel p-3 text-center">
                <p className="font-display text-2xl">🪙 {b.coins}</p>
                <Button size="sm" disabled className="mt-2">
                  {b.price}
                </Button>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Buying coins with real money is coming soon.
          </p>
        </section>
      </div>
    </GameLayout>
  );
}
