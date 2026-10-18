import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Lock, Timer, Zap, PlusCircle, Users } from "lucide-react";
import { GameLayout } from "@/components/game-layout";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/hooks/use-account";
import { usePlayer } from "@/hooks/use-player";
import { createGameFn, saveProfile } from "@/lib/game.functions";
import { pageHead } from "@/lib/page-head";

export const Route = createFileRoute("/games/word-duel")({
  head: () =>
    pageHead(
      "Word Duel",
      "Play Word Duel on FRIENDZY — A fast-paced 1v1 battle of vocabulary, reflexes and wits.",
    ),
  component: WordDuelGameHubPage,
});

function WordDuelGameHubPage() {
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
        data: { sessionToken: player.sessionToken, gameType: "word-duel" },
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
        {/* Big Game Header */}
        <div className="text-center py-4">
          <div className="mx-auto mb-4 grid size-24 place-items-center rounded-3xl border-3 border-border bg-teal-400 text-ink shadow-panel transform -rotate-3 p-3">
            <img src="/stickers/game-word-duel.svg" alt="Word Duel" width={60} height={60} className="size-15 select-none drop-shadow" />
          </div>
          <h1 className="font-display text-4xl tracking-tight text-foreground">Word Duel</h1>
          <p className="mt-1 font-semibold text-sm text-muted-foreground">
            2 Players · Fast-Paced Brain Battle
          </p>
        </div>

        {/* 3-Line How to play */}
        <div className="play-panel space-y-4 p-5">
          <h2 className="font-display text-lg font-bold border-b border-border/40 pb-2">
            How to Play
          </h2>

          <div className="space-y-3.5 text-sm">
            <div className="flex items-start gap-3">
              <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/30">
                <Lock className="size-4" />
              </div>
              <div>
                <p className="font-bold text-foreground">1. Secret Letter</p>
                <p className="text-muted-foreground leading-relaxed">
                  Both players secretly type and lock in ONE letter. The opponent only sees "Locked
                  ✓", never the letter.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-amber-400/20 text-amber-500 border border-amber-400/30">
                <Timer className="size-4" />
              </div>
              <div>
                <p className="font-bold text-foreground">2. Synced Reveal</p>
                <p className="text-muted-foreground leading-relaxed">
                  A 3-2-1 countdown plays on both screens, then both letters are revealed as big
                  sticker tiles!
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-teal-500/20 text-teal-600 border border-teal-500/30">
                <Zap className="size-4" />
              </div>
              <div>
                <p className="font-bold text-foreground">3. Fastest Word Wins</p>
                <p className="text-muted-foreground leading-relaxed">
                  Type a real English word starting with one letter and ending with the other. The
                  fastest valid word wins the round!
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
              Join Room with Code
            </Link>
          </Button>
        </div>
      </div>
    </GameLayout>
  );
}
