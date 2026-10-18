import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Dices, PlusCircle, Trophy, Sparkles, Users } from "lucide-react";
import { GameLayout } from "@/components/game-layout";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/hooks/use-account";
import { usePlayer } from "@/hooks/use-player";
import { createGameFn, saveProfile } from "@/lib/game.functions";
import { pageHead } from "@/lib/page-head";

export const Route = createFileRoute("/games/ludo")({
  head: () =>
    pageHead(
      "Ludo",
      "Play Ludo on FRIENDZY — Roll the dice, race your tokens, send friends back, and conquer the center home!",
    ),
  component: LudoGameHubPage,
});

function LudoGameHubPage() {
  const { player, ready, save } = usePlayer();
  const { account, avatarId } = useAccount();
  const nav = useNavigate();
  const create = useServerFn(createGameFn);
  const persist = useServerFn(saveProfile);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleCreateRoom() {
    if (!player) return;
    setBusy(true);
    setError("");
    try {
      const p = await persist({
        data: {
          sessionToken: player.sessionToken,
          displayName: account?.displayName ?? player.displayName ?? "Player",
          avatarId: account ? avatarId : (player.avatarId ?? "fox"),
        },
      });
      if ("error" in p) throw new Error(p.error);
      save(p.displayName, p.avatarId);

      const r = await create({
        data: { sessionToken: player.sessionToken, gameType: "ludo" },
      });
      if ("error" in r) throw new Error(r.error);
      nav({ to: "/game/$code", params: { code: r.code } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the room.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <GameLayout back coins={account?.coins}>
      <div className="space-y-6 animate-rise pb-24">
        {/* Game Header */}
        <section className="play-panel space-y-4 p-6 shadow-panel border-4 border-amber-900/30 text-center relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-blue-400 border-2 border-border shadow-md mx-auto p-2">
            <img src="/stickers/game-ludo.svg" alt="Ludo" width={54} height={54} className="size-13 select-none drop-shadow" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
              Board Race • 2–4 Players
            </span>
            <h1 className="font-display font-bold text-3xl tracking-tight text-foreground mt-2">
              Toybox Ludo
            </h1>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
              Roll 6 to launch, capture rivals on the track, and be the first to navigate all tokens
              home.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3 max-w-sm mx-auto">
            <Button
              size="lg"
              className="flex-1 font-display text-base tracking-wide shadow-button bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
              disabled={busy || !ready}
              onClick={handleCreateRoom}
            >
              <PlusCircle className="w-5 h-5 mr-1.5" />
              {busy ? "Setting Board…" : "Create Ludo Room"}
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="font-display text-base tracking-wide"
            >
              <Link to="/join">Join Room</Link>
            </Button>
          </div>
          {error && <p className="text-xs text-destructive font-semibold">{error}</p>}
        </section>

        {/* How It Works */}
        <section className="space-y-3">
          <h2 className="font-display font-semibold text-lg text-foreground px-1">How It Works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="play-panel p-4 space-y-2 border border-border/60">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-sm">
                <Dices className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm">1. Roll to Launch</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Roll a 6 to bring tokens out of the yard. Rolling a 6 also grants an extra bonus
                roll!
              </p>
            </div>

            <div className="play-panel p-4 space-y-2 border border-border/60">
              <div className="w-8 h-8 rounded-xl bg-red-500/10 text-red-600 flex items-center justify-center font-bold text-sm">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm">2. Hunt & Safe Zones</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Land on opponents to send them packing! Rest safely on star ⭐ squares across the
                track.
              </p>
            </div>

            <div className="play-panel p-4 space-y-2 border border-border/60">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-sm">
                <Trophy className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm">3. Home Triumph</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Navigate the colored home stretch with exact rolls to claim victory.
              </p>
            </div>
          </div>
        </section>

        {/* Match Info */}
        <section className="play-panel p-4 flex items-center justify-between text-xs text-muted-foreground border border-border/60">
          <span className="flex items-center gap-1.5 font-semibold">
            <Users className="w-4 h-4 text-primary" /> 2 to 4 Players
          </span>
          <span className="font-semibold text-foreground/80">
            Host Option: Fast (2 Tokens) or Classic (4 Tokens)
          </span>
        </section>
      </div>
    </GameLayout>
  );
}
