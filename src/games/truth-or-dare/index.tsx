import { useEffect, useRef } from "react";
import { Sparkles, Flame, CheckCircle, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { avatarEmoji, type GameState } from "@/lib/game-types";
import { PlayerAvatar } from "@/components/player-avatar";
import { play } from "@/lib/sounds";
import {
  chooseTruthOrDarePromptFn,
  completeTruthOrDarePromptFn,
  skipTruthOrDarePromptFn,
} from "@/lib/game.functions";

interface TruthOrDareGameProps {
  s: GameState;
  token: string;
  refresh: () => void;
  runAction: (fn: () => Promise<unknown>, after?: () => void) => Promise<void>;
}

export function TruthOrDareGame({ s, token, refresh, runAction }: TruthOrDareGameProps) {
  const tod = s.truthOrDare;
  const isMyProfile = (id: string | null | undefined) => id === s.me.profileId;
  const prevPlayerId = useRef<string | null>(null);

  const isCurrentPlayer = tod ? isMyProfile(tod.currentPlayerId) : false;
  const activePlayer = s.players.find((p) => p.profileId === tod?.currentPlayerId);

  // Phone buzz and sound when it's your turn
  useEffect(() => {
    if (!tod) return;
    if (prevPlayerId.current !== tod.currentPlayerId) {
      if (isCurrentPlayer) {
        play("reveal");
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate([200, 100, 200]);
          } catch {
            /* unsupported */
          }
        }
      }
    }
    prevPlayerId.current = tod.currentPlayerId;
  }, [tod, isCurrentPlayer]);

  if (!tod) {
    return (
      <div className="play-panel p-8 text-center space-y-3">
        <p className="font-bold text-muted-foreground">Initializing Truth or Dare…</p>
      </div>
    );
  }

  // Turn order avatars lookup
  const turnOrderPlayers = tod.turnOrder
    .map((id) => s.players.find((p) => p.profileId === id))
    .filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="play-panel p-4 flex items-center justify-between shadow-panel">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl" role="img" aria-label="masks">
            🎭
          </span>
          <div>
            <h1 className="font-display font-bold text-lg leading-tight">Truth or Dare</h1>
            <p className="text-xs font-semibold text-muted-foreground">
              Vibe: <span className="text-primary font-bold">{tod.settings.promptLevel}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-secondary border border-border">
            1 Skip Max
          </span>
        </div>
      </div>

      {/* Turn Order Strip */}
      <div className="play-panel p-4 shadow-panel space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Turn Queue
          </span>
          <span className="text-xs font-bold text-primary">
            Turn {tod.turnIndex + 1} of {tod.turnOrder.length}
          </span>
        </div>

        <div className="flex items-center gap-2.5 overflow-x-auto py-2 px-1 scrollbar-none">
          {turnOrderPlayers.map((p, idx) => {
            if (!p) return null;
            const isTurn = p.profileId === tod.currentPlayerId;
            return (
              <div
                key={p.profileId}
                className={`flex flex-col items-center shrink-0 transition-transform ${
                  isTurn ? "scale-110 z-10" : "opacity-80"
                }`}
              >
                <div
                  className={`relative grid size-12 place-items-center rounded-2xl border-3 text-2xl shadow-panel transition-all ${
                    isTurn
                      ? "bg-amber-300 border-amber-500 ring-4 ring-amber-400/50 animate-bounce"
                      : "bg-card border-border"
                  }`}
                >
                  <PlayerAvatar id={p.avatarId} size={30} />
                  {isTurn && <span className="absolute -top-2 -right-1 text-xs">👑</span>}
                </div>
                <span className="mt-1 text-[11px] font-bold max-w-[60px] truncate text-center">
                  {p.displayName}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Play Area */}
      {tod.phase === "choosing_type" && (
        <div className="play-panel p-6 shadow-panel text-center space-y-5 animate-rise">
          <div className="space-y-1">
            <h2 className="font-display font-extrabold text-2xl text-foreground">
              {isCurrentPlayer
                ? "It's YOUR turn!"
                : `${activePlayer?.displayName ?? "Player"}'s Turn`}
            </h2>
            <p className="text-xs font-semibold text-muted-foreground">
              {isCurrentPlayer
                ? "Will you face a probing Truth or a hilarious Dare?"
                : `Waiting for ${activePlayer?.displayName ?? "player"} to pick Truth or Dare…`}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
            <Button
              className="min-h-[60px] font-display text-lg bg-teal-500 hover:bg-teal-600 text-white shadow-button"
              disabled={!isCurrentPlayer}
              onClick={() =>
                runAction(async () => {
                  play("reveal");
                  return await chooseTruthOrDarePromptFn({
                    data: {
                      sessionToken: token,
                      code: s.code,
                      type: "truth",
                    },
                  });
                }, refresh)
              }
            >
              <Sparkles className="size-5 mr-2" />
              Truth 📜
            </Button>

            <Button
              className="min-h-[60px] font-display text-lg bg-amber-500 hover:bg-amber-600 text-white shadow-button"
              disabled={!isCurrentPlayer}
              onClick={() =>
                runAction(async () => {
                  play("reveal");
                  return await chooseTruthOrDarePromptFn({
                    data: {
                      sessionToken: token,
                      code: s.code,
                      type: "dare",
                    },
                  });
                }, refresh)
              }
            >
              <Flame className="size-5 mr-2" />
              Dare ⚡
            </Button>
          </div>
        </div>
      )}

      {/* Active Prompt Card */}
      {tod.phase === "prompt_active" && tod.currentPrompt && (
        <div className="play-panel p-6 shadow-panel space-y-5 animate-rise border-2 border-primary/40">
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <div className="flex items-center gap-2">
              <span
                className={`font-display font-black text-sm uppercase px-3 py-1 rounded-full ${
                  tod.promptType === "truth"
                    ? "bg-teal-500 text-white shadow-sm"
                    : "bg-amber-500 text-white shadow-sm"
                }`}
              >
                {tod.promptType === "truth" ? "Truth Card" : "Dare Card"}
              </span>
              <span className="text-xs font-bold text-muted-foreground">
                Level: {tod.currentPrompt.level}
              </span>
            </div>

            <span className="text-xs font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground">
              Player: {activePlayer?.displayName ?? "Player"}
            </span>
          </div>

          {/* Collectible Retro Toybox Card */}
          <div className="rounded-2xl bg-gradient-to-br from-card to-secondary/70 p-6 border-3 border-border shadow-panel text-center space-y-3">
            <p className="font-display font-extrabold text-xl sm:text-2xl text-foreground leading-snug">
              &ldquo;{tod.currentPrompt.text}&rdquo;
            </p>
          </div>

          {/* Bottom Action buttons: Done or Skip */}
          <div className="flex gap-3 max-w-sm mx-auto">
            <Button
              className="flex-1 min-h-[52px] font-display text-base bg-teal-600 hover:bg-teal-700 text-white shadow-button"
              onClick={() =>
                runAction(async () => {
                  play("vote");
                  return await completeTruthOrDarePromptFn({
                    data: { sessionToken: token, code: s.code },
                  });
                }, refresh)
              }
            >
              <CheckCircle className="size-4 mr-2" />
              Done 🎉
            </Button>

            {isCurrentPlayer && (
              <Button
                variant="secondary"
                className="flex-1 min-h-[52px] font-display text-base border-2"
                disabled={tod.mySkipsRemaining < 1}
                onClick={() =>
                  runAction(async () => {
                    play("click");
                    return await skipTruthOrDarePromptFn({
                      data: { sessionToken: token, code: s.code },
                    });
                  }, refresh)
                }
              >
                <SkipForward className="size-4 mr-2" />
                Skip ({tod.mySkipsRemaining} left)
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Recent Turns History */}
      {tod.history.length > 0 && (
        <div className="play-panel p-4 shadow-panel space-y-3">
          <h3 className="font-display font-bold text-sm text-muted-foreground border-b border-border/40 pb-2">
            History ({tod.history.length})
          </h3>
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {tod.history.slice(0, 8).map((h, i) => {
              const player = s.players.find((p) => p.profileId === h.playerId);
              return (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 text-xs rounded-xl bg-card/60 p-2 border border-border/40"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className={`font-black uppercase text-[10px] px-1.5 py-0.5 rounded ${
                        h.type === "truth"
                          ? "bg-teal-500/20 text-teal-600"
                          : "bg-amber-500/20 text-amber-600"
                      }`}
                    >
                      {h.type}
                    </span>
                    <span className="font-bold text-foreground">
                      {player?.displayName ?? "Player"}:
                    </span>
                    <span className="truncate text-muted-foreground">
                      &ldquo;{h.promptText}&rdquo;
                    </span>
                  </div>
                  {h.skipped && (
                    <span className="text-[10px] font-bold text-amber-500 shrink-0">Skipped</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
