import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Clock, PlusCircle, Trophy, Swords, ShieldCheck, Users } from "lucide-react";
import { GameLayout } from "@/components/game-layout";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/hooks/use-account";
import { usePlayer } from "@/hooks/use-player";
import { createGameFn, saveProfile } from "@/lib/game.functions";
import { pageHead } from "@/lib/page-head";

export const Route = createFileRoute("/games/chess")({
  head: () =>
    pageHead(
      "Chess",
      "Play Chess on FRIENDZY — Timeless 1v1 tactical strategy with retro toybox boards and sticker pieces.",
    ),
  component: ChessGameHubPage,
});

function ChessGameHubPage() {
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
        data: { sessionToken: player.sessionToken, gameType: "chess" },
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
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-slate-400 border-2 border-border shadow-md mx-auto p-2">
            <img
              src="/stickers/game-chess.svg"
              alt="Chess"
              width={54}
              height={54}
              className="size-13 select-none drop-shadow"
            />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
              Board Strategy • 2 Players
            </span>
            <h1 className="font-display font-bold text-3xl tracking-tight text-foreground mt-2">
              Toybox Chess
            </h1>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
              Outsmart your opponent in a tactical battle of wits with collectible sticker pieces
              and retro wooden boards.
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
              {busy ? "Opening Board…" : "Create Chess Room"}
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
                <Swords className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm">1. Classic Rules</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Standard tournament chess rulebook — castling, en passant, promotion, and checkmate.
              </p>
            </div>

            <div className="play-panel p-4 space-y-2 border border-border/60">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                <Clock className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm">2. Retro Toybox Clocks</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Play Bullet (1m), Blitz (3m), Rapid (5m), or Classical (10m) with move increments.
              </p>
            </div>

            <div className="play-panel p-4 space-y-2 border border-border/60">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-sm">
                <Trophy className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm">3. Tactile Feedback</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Sticker pieces, legal destination rings, check alerts, and instant turn rematching.
              </p>
            </div>
          </div>
        </section>

        {/* Match Info */}
        <section className="play-panel p-4 flex items-center justify-between text-xs text-muted-foreground border border-border/60">
          <span className="flex items-center gap-1.5 font-semibold">
            <Users className="w-4 h-4 text-primary" /> Exactly 2 Players
          </span>
          <span className="flex items-center gap-1.5 font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-500" /> Rule Validation Powered by chess.js
          </span>
        </section>
      </div>
    </GameLayout>
  );
}
