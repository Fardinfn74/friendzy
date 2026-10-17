import { createFileRoute } from "@tanstack/react-router";
import { Coins } from "lucide-react";
import { GameLayout, PageTitle } from "@/components/game-layout";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/hooks/use-account";
import { COIN_BUNDLES } from "@/lib/shop-items";
import { pageHead } from "@/lib/page-head";
export const Route = createFileRoute("/coins")({
  head: () =>
    pageHead(
      "Get Coins",
      "View upcoming FRIENDZY coin bundles. Real-money payments are not open yet.",
    ),
  component: CoinStore,
});
function CoinStore() {
  const { account } = useAccount();
  return (
    <GameLayout back coins={account?.coins}>
      <PageTitle>Get Coins</PageTitle>
      <div className="mb-6 rounded-xl border-2 border-border bg-accent p-4 text-accent-foreground">
        Payments opening soon
      </div>
      <div className="space-y-5">
        {COIN_BUNDLES.map((b, i) => (
          <div
            key={b.coins}
            className="play-panel grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-5"
          >
            <div>
              <p className="text-sm text-muted-foreground">{["Starter", "Popular", "Mega"][i]}</p>
              <p className="mt-2 flex items-center gap-2 font-display text-2xl">
                <Coins className="text-accent" />
                {b.coins.toLocaleString()}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{b.price} · tentative</p>
            </div>
            <Button variant="secondary" size="sm" disabled>
              Coming soon
            </Button>
          </div>
        ))}
      </div>
    </GameLayout>
  );
}
