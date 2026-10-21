import { useEffect, useRef, useState } from "react";
import { RotateCw, CheckCircle, SkipForward, Flame, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { avatarEmoji, type GameState } from "@/lib/game-types";
import { PlayerAvatar } from "@/components/player-avatar";
import { play } from "@/lib/sounds";
import {
  spinBottleFn,
  chooseBottlePromptFn,
  completeBottlePromptFn,
  skipBottlePromptFn,
} from "@/lib/game.functions";

interface BottleSpinGameProps {
  s: GameState;
  token: string;
  refresh: () => void;
  runAction: (fn: () => Promise<unknown>, after?: () => void) => Promise<void>;
}

export function BottleSpinGame({ s, token, refresh, runAction }: BottleSpinGameProps) {
  const bs = s.bottleSpin;
  const isMyProfile = (id: string | null | undefined) => id === s.me.profileId;
  const [isAnimatingSpin, setIsAnimatingSpin] = useState(false);
  const prevPhase = useRef<string | null>(null);

  const isSpinner = bs ? isMyProfile(bs.currentSpinnerId) || s.me.isHost : false;
  const isTarget = bs ? isMyProfile(bs.targetPlayerId) : false;
  const targetPlayer = s.players.find((p) => p.profileId === bs?.targetPlayerId);
  const spinnerPlayer = s.players.find((p) => p.profileId === bs?.currentSpinnerId);

  // Phone vibration and audio cue when spin finishes or lands on player
  useEffect(() => {
    if (!bs) return;
    if (prevPhase.current === "spinning" && bs.phase === "choosing_prompt") {
      play("reveal");
      if (isTarget && typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate([200, 100, 200]);
        } catch {
          /* unsupported */
        }
      }
    }
    prevPhase.current = bs.phase;
  }, [bs, isTarget]);

  // Track client-side 3s spin timer
  useEffect(() => {
    if (bs?.phase === "spinning") {
      setIsAnimatingSpin(true);
      const timer = setTimeout(() => {
        setIsAnimatingSpin(false);
        refresh();
      }, 3100);
      return () => clearTimeout(timer);
    }
    setIsAnimatingSpin(false);
    return undefined;
  }, [bs?.phase, bs?.totalRotation, refresh]);

  if (!bs) {
    return (
      <div className="play-panel p-8 text-center space-y-3">
        <p className="font-bold text-muted-foreground">Initializing Bottle Spin…</p>
      </div>
    );
  }

  const players = s.players;
  const totalPlayers = Math.max(players.length, 1);
  const angleStep = 360 / totalPlayers;

  return (
    <div className="space-y-6">
      {/* Game Banner Header */}
      <div className="play-panel p-4 flex items-center justify-between shadow-panel">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl" role="img" aria-label="bottle">
            🍾
          </span>
          <div>
            <h1 className="font-display font-bold text-lg leading-tight">Bottle Spin</h1>
            <p className="text-xs font-semibold text-muted-foreground">
              Vibe: <span className="text-primary font-bold">{bs.settings.promptLevel}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-secondary border border-border">
            1 Skip Max
          </span>
        </div>
      </div>

      {/* Main Retro Toybox Circular Game Board */}
      <div className="play-panel p-6 shadow-panel relative overflow-hidden flex flex-col items-center">
        <div className="w-full text-center mb-4">
          {bs.phase === "ready_to_spin" ? (
            <p className="font-display font-bold text-base text-foreground">
              {isSpinner
                ? "Your turn to spin the bottle! 🎯"
                : `Waiting for ${spinnerPlayer?.displayName ?? "player"} to spin…`}
            </p>
          ) : bs.phase === "spinning" || isAnimatingSpin ? (
            <p className="font-display font-bold text-base text-amber-500 animate-pulse">
              Spinning the bottle… 🌀
            </p>
          ) : bs.phase === "choosing_prompt" ? (
            <p className="font-display font-bold text-base text-teal-600">
              {isTarget
                ? "The bottle chose YOU! Pick Truth or Dare! 🫵"
                : `Landed on ${targetPlayer?.displayName ?? "someone"}! Waiting for their pick…`}
            </p>
          ) : (
            <p className="font-display font-bold text-base text-foreground">
              {targetPlayer?.displayName ?? "Player"}&apos;s Challenge
            </p>
          )}
        </div>

        {/* Circular Avatar Arena */}
        <div className="relative size-72 sm:size-84 my-2 select-none flex items-center justify-center">
          {/* Subtle circular track */}
          <div className="absolute inset-4 rounded-full border-4 border-dashed border-border/40 pointer-events-none" />

          {/* Players in circle */}
          {players.map((p, idx) => {
            // angle from top (12 o'clock)
            const angleDeg = idx * angleStep - 90;
            const angleRad = (angleDeg * Math.PI) / 180;
            // Radius 40% from center
            const radius = 41;
            const x = 50 + radius * Math.cos(angleRad);
            const y = 50 + radius * Math.sin(angleRad);
            const isChosen = bs.targetPlayerId === p.profileId;
            const isCurSpinner = bs.currentSpinnerId === p.profileId;

            return (
              <div
                key={p.profileId}
                style={{
                  position: "absolute",
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: "translate(-50%, -50%)",
                }}
                className={`flex flex-col items-center transition-transform duration-300 ${
                  isChosen ? "scale-115 z-20" : "z-10"
                }`}
              >
                <div
                  className={`relative grid size-12 place-items-center rounded-2xl border-3 text-2xl shadow-panel transition-all ${
                    isChosen
                      ? "bg-amber-300 border-amber-500 ring-4 ring-amber-400/50 animate-bounce"
                      : isCurSpinner
                        ? "bg-teal-400 border-teal-600 ring-2 ring-teal-400/40"
                        : "bg-card border-border"
                  }`}
                >
                  <PlayerAvatar id={p.avatarId} size={30} />
                  {isChosen && <span className="absolute -top-2 -right-1 text-xs">⭐</span>}
                </div>
                <span className="mt-1 max-w-[64px] truncate text-[11px] font-bold text-foreground text-center">
                  {p.displayName}
                </span>
              </div>
            );
          })}

          {/* Center Spinning Bottle */}
          <div
            className="absolute z-10 size-28 pointer-events-none grid place-items-center"
            style={{
              transform: `rotate(${bs.totalRotation}deg)`,
              transition: isAnimatingSpin
                ? "transform 3000ms cubic-bezier(0.15, 0.85, 0.35, 1)"
                : "transform 150ms ease-out",
            }}
          >
            {/* Retro Toybox Bottle SVG Graphic */}
            <svg
              viewBox="0 0 100 100"
              className="size-28 drop-shadow-xl filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.35)]"
            >
              {/* Pointing Arrow at top / cork */}
              <polygon points="50,2 43,18 57,18" fill="#F59E0B" stroke="#78350F" strokeWidth="2" />
              {/* Bottle Cork */}
              <rect
                x="45"
                y="16"
                width="10"
                height="8"
                rx="2"
                fill="#D97706"
                stroke="#78350F"
                strokeWidth="2"
              />
              {/* Bottle Neck */}
              <rect
                x="44"
                y="24"
                width="12"
                height="16"
                rx="3"
                fill="#14B8A6"
                stroke="#042F2E"
                strokeWidth="2.5"
              />
              {/* Bottle Shoulder & Body */}
              <path
                d="M44,40 C32,45 32,54 32,60 L32,84 C32,90 38,94 50,94 C62,94 68,90 68,84 L68,60 C68,54 68,45 56,40 Z"
                fill="#2DD4BF"
                stroke="#042F2E"
                strokeWidth="3"
              />
              {/* Playful Label on Bottle */}
              <rect
                x="36"
                y="58"
                width="28"
                height="22"
                rx="4"
                fill="#FEF08A"
                stroke="#78350F"
                strokeWidth="2"
              />
              {/* Sparkle or Star on Label */}
              <circle cx="50" cy="69" r="6" fill="#F43F5E" />
              <circle cx="50" cy="69" r="3" fill="#FFFFFF" />
            </svg>
          </div>
        </div>

        {/* Action button if ready to spin */}
        {bs.phase === "ready_to_spin" && (
          <div className="w-full max-w-xs mt-3">
            <Button
              className="w-full min-h-[54px] font-display text-lg tracking-wide bg-primary text-primary-foreground shadow-button"
              disabled={!isSpinner}
              onClick={() =>
                runAction(async () => {
                  play("click");
                  return await spinBottleFn({
                    data: {
                      sessionToken: token,
                      code: s.code,
                    },
                  });
                }, refresh)
              }
            >
              <RotateCw className="size-5 mr-2 animate-spin-slow" />
              {isSpinner ? "Spin the Bottle!" : "Waiting for Spinner…"}
            </Button>
          </div>
        )}
      </div>

      {/* Choice Phase: Pick Truth or Dare */}
      {bs.phase === "choosing_prompt" && (
        <div className="play-panel p-6 shadow-panel text-center space-y-4 animate-rise">
          <div className="space-y-1">
            <h2 className="font-display font-bold text-2xl text-foreground">
              {isTarget
                ? "Choose Your Fate!"
                : `${targetPlayer?.displayName ?? "Player"} is choosing…`}
            </h2>
            <p className="text-xs font-semibold text-muted-foreground">
              Pick Truth for a secret question, or Dare for a bold challenge.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
            <Button
              className="min-h-[58px] font-display text-lg bg-teal-500 hover:bg-teal-600 text-white shadow-button"
              disabled={!isTarget}
              onClick={() =>
                runAction(async () => {
                  play("reveal");
                  return await chooseBottlePromptFn({
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
              className="min-h-[58px] font-display text-lg bg-amber-500 hover:bg-amber-600 text-white shadow-button"
              disabled={!isTarget}
              onClick={() =>
                runAction(async () => {
                  play("reveal");
                  return await chooseBottlePromptFn({
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
      {bs.phase === "prompt_active" && bs.currentPrompt && (
        <div className="play-panel p-6 shadow-panel space-y-5 animate-rise border-2 border-primary/40">
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <div className="flex items-center gap-2">
              <span
                className={`font-display font-black text-sm uppercase px-3 py-1 rounded-full ${
                  bs.promptType === "truth"
                    ? "bg-teal-500 text-white shadow-sm"
                    : "bg-amber-500 text-white shadow-sm"
                }`}
              >
                {bs.promptType === "truth" ? "Truth Card" : "Dare Card"}
              </span>
              <span className="text-xs font-bold text-muted-foreground">
                Level: {bs.currentPrompt.level}
              </span>
            </div>

            <span className="text-xs font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground">
              For: {targetPlayer?.displayName ?? "Player"}
            </span>
          </div>

          {/* Collectible Card Physical Box */}
          <div className="rounded-2xl bg-gradient-to-br from-card to-secondary/70 p-6 border-3 border-border shadow-panel text-center space-y-3">
            <p className="font-display font-extrabold text-xl sm:text-2xl text-foreground leading-snug">
              &ldquo;{bs.currentPrompt.text}&rdquo;
            </p>
          </div>

          {/* Action buttons: Done or Skip */}
          <div className="flex gap-3 max-w-sm mx-auto">
            <Button
              className="flex-1 min-h-[52px] font-display text-base bg-teal-600 hover:bg-teal-700 text-white shadow-button"
              onClick={() =>
                runAction(async () => {
                  play("vote");
                  return await completeBottlePromptFn({
                    data: { sessionToken: token, code: s.code },
                  });
                }, refresh)
              }
            >
              <CheckCircle className="size-4 mr-2" />
              Done 🎉
            </Button>

            {isTarget && (
              <Button
                variant="secondary"
                className="flex-1 min-h-[52px] font-display text-base border-2"
                disabled={bs.mySkipsRemaining < 1}
                onClick={() =>
                  runAction(async () => {
                    play("click");
                    return await skipBottlePromptFn({
                      data: { sessionToken: token, code: s.code },
                    });
                  }, refresh)
                }
              >
                <SkipForward className="size-4 mr-2" />
                Skip ({bs.mySkipsRemaining} left)
              </Button>
            )}
          </div>
        </div>
      )}

      {/* History Log */}
      {bs.history.length > 0 && (
        <div className="play-panel p-4 shadow-panel space-y-3">
          <h3 className="font-display font-bold text-sm text-muted-foreground border-b border-border/40 pb-2">
            Recent Spins ({bs.history.length})
          </h3>
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {bs.history.slice(0, 8).map((h, i) => {
              const target = s.players.find((p) => p.profileId === h.targetId);
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
                      {target?.displayName ?? "Player"}:
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
