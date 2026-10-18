import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Search, MessageSquare, Vote, PlusCircle, Users } from "lucide-react";
import { GameLayout } from "@/components/game-layout";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/hooks/use-account";
import { usePlayer } from "@/hooks/use-player";
import { createGameFn, saveProfile } from "@/lib/game.functions";
import { pageHead } from "@/lib/page-head";

export const Route = createFileRoute("/games/imposter")({
  head: () =>
    pageHead(
      "Imposter",
      "Play Imposter on FRIENDZY — Spot the bluff, vote out suspects, and unmask the secret imposter with 3–12 friends.",
    ),
  component: ImposterGameHubPage,
});

function ImposterGameHubPage() {
  const { player, ready, save, hasProfile } = usePlayer();
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
        data: { sessionToken: player.sessionToken, gameType: "imposter" },
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
          <div className="mx-auto mb-4 grid size-24 place-items-center rounded-3xl border-3 border-border bg-amber-400 text-ink shadow-panel transform -rotate-3 p-3">
            <img
              src="/stickers/game-imposter.svg"
              alt="Imposter"
              width={60}
              height={60}
              className="size-15 select-none drop-shadow"
            />
          </div>
          <h1 className="font-display text-4xl tracking-tight text-foreground">Imposter</h1>
          <p className="mt-1 font-semibold text-sm text-muted-foreground">
            3–12 Players · Party Deduction
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
                <Search className="size-4" />
              </div>
              <div>
                <p className="font-bold text-foreground">1. Secret Word</p>
                <p className="text-muted-foreground leading-relaxed">
                  Crew see the secret word. Imposters bluff and see nothing (or a decoy in Double
                  Agent mode).
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-amber-400/20 text-amber-500 border border-amber-400/30">
                <MessageSquare className="size-4" />
              </div>
              <div>
                <p className="font-bold text-foreground">2. One Clue</p>
                <p className="text-muted-foreground leading-relaxed">
                  Take turns giving one-word clues to prove you're crew without giving the word
                  away.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-teal-500/20 text-teal-600 border border-teal-500/30">
                <Vote className="size-4" />
              </div>
              <div>
                <p className="font-bold text-foreground">3. Spot the Bluff</p>
                <p className="text-muted-foreground leading-relaxed">
                  Discuss the clues, vote out the imposter, or bluff your way to an imposter
                  victory!
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
