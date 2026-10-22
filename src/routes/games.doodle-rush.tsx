import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Pencil, Eye, Trophy, PlusCircle, Users } from "lucide-react";
import { GameLayout } from "@/components/game-layout";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/hooks/use-account";
import { usePlayer } from "@/hooks/use-player";
import { createGameFn, saveProfile } from "@/lib/game.functions";
import { pageHead } from "@/lib/page-head";

export const Route = createFileRoute("/games/doodle-rush")({
  head: () =>
    pageHead(
      "Doodle Rush",
      "Play Doodle Rush on FRIENDZY — One player draws in real time, everyone else races to guess the word!",
    ),
  component: DoodleRushGameHubPage,
});

function DoodleRushGameHubPage() {
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
        data: { sessionToken: player.sessionToken, gameType: "doodle-rush" },
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
        <div className="text-center py-4">
          <div className="mx-auto mb-4 grid size-24 place-items-center rounded-3xl border-3 border-border bg-violet-400 text-ink shadow-panel transform -rotate-3 p-3">
            <span className="text-5xl select-none">🎨</span>
          </div>
          <h1 className="font-display text-4xl tracking-tight text-foreground">Doodle Rush</h1>
          <p className="mt-1 font-semibold text-sm text-muted-foreground">
            2–8 Players · Real-Time Drawing & Guessing
          </p>
        </div>

        {/* How to play */}
        <div className="play-panel space-y-4 p-5">
          <h2 className="font-display text-lg font-bold border-b border-border/40 pb-2">
            How to Play
          </h2>

          <div className="space-y-3.5 text-sm">
            <div className="flex items-start gap-3">
              <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-violet-500/20 text-violet-600 border border-violet-500/30">
                <Pencil className="size-4" />
              </div>
              <div>
                <p className="font-bold text-foreground">1. One Player Draws</p>
                <p className="text-muted-foreground leading-relaxed">
                  A random player receives a secret word and sketches it on the canvas with customizable colors and pen sizes.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-amber-400/20 text-amber-500 border border-amber-400/30">
                <Eye className="size-4" />
              </div>
              <div>
                <p className="font-bold text-foreground">2. Real-Time Guessing</p>
                <p className="text-muted-foreground leading-relaxed">
                  Strokes appear live on everyone's screens. Guess as many times as you like in real time!
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-teal-500/20 text-teal-600 border border-teal-500/30">
                <Trophy className="size-4" />
              </div>
              <div>
                <p className="font-bold text-foreground">3. First to Guess Wins Most</p>
                <p className="text-muted-foreground leading-relaxed">
                  The first player to guess correctly gets 4 points! Other correct guessers get 2 points, and the drawer gets bonus points for each correct guess.
                </p>
              </div>
            </div>
          </div>
        </div>

        {error && <p className="text-center text-sm font-bold text-destructive">{error}</p>}

        {/* Primary Bottom Actions */}
        <div className="primary-dock space-y-3">
          <Button
            className="w-full min-h-[56px] font-display text-xl tracking-wide bg-primary text-primary-foreground shadow-button"
            disabled={!ready || busy}
            onClick={handleCreateRoom}
          >
            <PlusCircle className="size-5 mr-2" />
            {busy ? "Creating Room…" : "Create Room"}
          </Button>

          <Button asChild variant="secondary" className="w-full min-h-[52px] font-display text-lg">
            <Link to="/join">
              <Users className="size-5 mr-2" />
              Join with Code
            </Link>
          </Button>
        </div>
      </div>
    </GameLayout>
  );
}
