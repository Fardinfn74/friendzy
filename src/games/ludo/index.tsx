import { useEffect, useState } from "react";
import { Dices, Trophy, Sparkles, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { avatarEmoji, type GameState } from "@/lib/game-types";
import { PlayerAvatar } from "@/components/player-avatar";
import { play } from "@/lib/sounds";
import { rollLudoDiceFn, moveLudoTokenFn, rematchLudoFn } from "@/lib/game.functions";
import type { LudoColor } from "./types";

interface LudoGameProps {
  s: GameState;
  token: string;
  refresh: () => void;
  runAction: (fn: () => Promise<unknown>, after?: () => void) => Promise<void>;
}

// 52 common track squares coordinates: [row, col] on a 15x15 grid
const TRACK_COORDS: [number, number][] = [
  /* 0 - 4: Red arm out */
  [6, 1],
  [6, 2],
  [6, 3],
  [6, 4],
  [6, 5],
  /* 5 - 10: Up to top */
  [5, 6],
  [4, 6],
  [3, 6],
  [2, 6],
  [1, 6],
  [0, 6],
  /* 11 - 12: Across top */
  [0, 7],
  [0, 8],
  /* 13 - 17: Down green arm */
  [1, 8],
  [2, 8],
  [3, 8],
  [4, 8],
  [5, 8],
  /* 18 - 23: Right into yellow arm */
  [6, 9],
  [6, 10],
  [6, 11],
  [6, 12],
  [6, 13],
  [6, 14],
  /* 24 - 25: Across right edge */
  [7, 14],
  [8, 14],
  /* 26 - 30: Left along yellow arm */
  [8, 13],
  [8, 12],
  [8, 11],
  [8, 10],
  [8, 9],
  /* 31 - 36: Down along bottom arm */
  [9, 8],
  [10, 8],
  [11, 8],
  [12, 8],
  [13, 8],
  [14, 8],
  /* 37 - 38: Across bottom edge */
  [14, 7],
  [14, 6],
  /* 39 - 43: Up along blue arm */
  [13, 6],
  [12, 6],
  [11, 6],
  [10, 6],
  [9, 6],
  /* 44 - 49: Left into red arm */
  [8, 5],
  [8, 4],
  [8, 3],
  [8, 2],
  [8, 1],
  [8, 0],
  /* 50 - 51: Turn into red entrance */
  [7, 0],
  [6, 0],
];

// Home stretch columns (steps 52-56)
const HOME_STRETCH_COORDS: Record<LudoColor, [number, number][]> = {
  red: [
    [7, 1],
    [7, 2],
    [7, 3],
    [7, 4],
    [7, 5],
  ],
  green: [
    [1, 7],
    [2, 7],
    [3, 7],
    [4, 7],
    [5, 7],
  ],
  yellow: [
    [7, 13],
    [7, 12],
    [7, 11],
    [7, 10],
    [7, 9],
  ],
  blue: [
    [13, 7],
    [12, 7],
    [11, 7],
    [10, 7],
    [9, 7],
  ],
};

// Yard positions for tokens (step = -1)
const YARD_COORDS: Record<LudoColor, [number, number][]> = {
  red: [
    [2, 2],
    [2, 3],
    [3, 2],
    [3, 3],
  ],
  green: [
    [2, 11],
    [2, 12],
    [3, 11],
    [3, 12],
  ],
  yellow: [
    [11, 11],
    [11, 12],
    [12, 11],
    [12, 12],
  ],
  blue: [
    [11, 2],
    [11, 3],
    [12, 2],
    [12, 3],
  ],
};

const COLOR_THEMES: Record<
  LudoColor,
  { bg: string; border: string; tokenBg: string; text: string; glow: string; name: string }
> = {
  red: {
    bg: "bg-red-500",
    border: "border-red-600",
    tokenBg: "bg-gradient-to-br from-red-400 to-red-600 shadow-red-500/50",
    text: "text-red-500",
    glow: "ring-red-400",
    name: "Red",
  },
  green: {
    bg: "bg-emerald-500",
    border: "border-emerald-600",
    tokenBg: "bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/50",
    text: "text-emerald-500",
    glow: "ring-emerald-400",
    name: "Green",
  },
  yellow: {
    bg: "bg-amber-400",
    border: "border-amber-500",
    tokenBg: "bg-gradient-to-br from-amber-300 to-amber-500 shadow-amber-500/50",
    text: "text-amber-500",
    glow: "ring-amber-400",
    name: "Yellow",
  },
  blue: {
    bg: "bg-blue-500",
    border: "border-blue-600",
    tokenBg: "bg-gradient-to-br from-blue-400 to-blue-600 shadow-blue-500/50",
    text: "text-blue-500",
    glow: "ring-blue-400",
    name: "Blue",
  },
};

const COLOR_START_OFFSETS: Record<LudoColor, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

const SAFE_SQUARES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

export function LudoGame({ s, token, refresh, runAction }: LudoGameProps) {
  const ludoState = s.ludo;
  const [isRollingAnimation, setIsRollingAnimation] = useState(false);

  const isMyTurn = ludoState?.isMyTurn ?? false;

  useEffect(() => {
    if (isMyTurn) play("turn");
  }, [isMyTurn]);

  if (!ludoState) {
    return (
      <div className="play-panel p-8 text-center space-y-3">
        <p className="font-bold text-muted-foreground">Setting up Toybox Ludo…</p>
      </div>
    );
  }

  const handleRollDice = () => {
    if (!isMyTurn || ludoState.phase !== "rolling" || isRollingAnimation) return;

    setIsRollingAnimation(true);
    play("pick");

    setTimeout(() => {
      void runAction(
        async () => {
          await rollLudoDiceFn({
            data: { sessionToken: token, code: s.code },
          });
        },
        () => {
          setIsRollingAnimation(false);
          refresh();
        },
      );
    }, 450);
  };

  const handleSelectToken = (tokenId: number) => {
    if (!isMyTurn || ludoState.phase !== "moving") return;
    if (!ludoState.validTokenMoves.includes(tokenId)) return;

    play("clue");
    void runAction(
      async () => {
        await moveLudoTokenFn({
          data: {
            sessionToken: token,
            code: s.code,
            tokenId,
          },
        });
      },
      () => refresh(),
    );
  };

  // Find token coordinates on the grid
  const getTokenCoords = (color: LudoColor, step: number, id: number): [number, number] => {
    if (step === -1) {
      return YARD_COORDS[color][id] ?? [7, 7];
    }
    if (step >= 57) {
      return [7, 7]; // Home center
    }
    if (step >= 52) {
      return HOME_STRETCH_COORDS[color][step - 52] ?? [7, 7];
    }
    const offset = COLOR_START_OFFSETS[color];
    const trackIdx = (offset + step) % 52;
    return TRACK_COORDS[trackIdx] ?? [7, 7];
  };

  // Build map of grid [r, c] -> tokens currently on that square
  const cellTokensMap = new Map<
    string,
    Array<{ tokenId: number; color: LudoColor; playerProfileId: string; canMove: boolean }>
  >();

  ludoState.players.forEach((player) => {
    player.tokens.forEach((t) => {
      if (t.hasFinished) return;
      const [r, c] = getTokenCoords(player.color, t.step, t.id);
      const key = `${r},${c}`;
      const canMove =
        isMyTurn &&
        ludoState.phase === "moving" &&
        player.color === ludoState.myColor &&
        ludoState.validTokenMoves.includes(t.id);

      const list = cellTokensMap.get(key) ?? [];
      list.push({
        tokenId: t.id,
        color: player.color,
        playerProfileId: player.profileId,
        canMove,
      });
      cellTokensMap.set(key, list);
    });
  });

  return (
    <div className="max-w-xl mx-auto space-y-4">
      {/* Toybox Game Board Frame */}
      <div className="bg-amber-950/20 dark:bg-amber-950/40 p-4 sm:p-5 rounded-3xl border-4 border-amber-800/40 shadow-2xl backdrop-blur-sm">
        {/* Header HUD: Active Turn & Status */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎲</span>
            <div>
              <h3 className="font-display font-bold text-base leading-tight">Toybox Ludo</h3>
              <p className="text-xs text-muted-foreground">{ludoState.lastActionText}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold capitalize border flex items-center gap-1.5 ${
                COLOR_THEMES[ludoState.currentTurnColor].bg
              } text-white ${COLOR_THEMES[ludoState.currentTurnColor].border}`}
            >
              <Sparkles className="w-3 h-3" />
              {ludoState.currentTurnColor}&apos;s Turn
            </span>
          </div>
        </div>

        {/* The 15x15 Ludo Board Grid */}
        <div className="relative aspect-square max-w-[440px] mx-auto rounded-2xl overflow-hidden border-4 border-amber-950 shadow-inner bg-card select-none">
          <div className="grid grid-cols-15 grid-rows-15 w-full h-full">
            {Array.from({ length: 15 }).map((_, r) =>
              Array.from({ length: 15 }).map((_, c) => {
                const key = `${r},${c}`;
                const tokensHere = cellTokensMap.get(key) ?? [];

                // Check cell types
                const isRedYard = r < 6 && c < 6;
                const isGreenYard = r < 6 && c >= 9;
                const isBlueYard = r >= 9 && c < 6;
                const isYellowYard = r >= 9 && c >= 9;
                const isCenter = r >= 6 && r <= 8 && c >= 6 && c <= 8;

                // Check home stretch paths
                const isRedHomeStretch = r === 7 && c >= 1 && c <= 5;
                const isGreenHomeStretch = c === 7 && r >= 1 && r <= 5;
                const isYellowHomeStretch = r === 7 && c >= 9 && c <= 13;
                const isBlueHomeStretch = c === 7 && r >= 9 && r <= 13;

                // Check start squares
                const isRedStart = r === 6 && c === 1;
                const isGreenStart = r === 1 && c === 8;
                const isYellowStart = r === 8 && c === 13;
                const isBlueStart = r === 13 && c === 6;

                // Star safe squares
                const isSafeStar =
                  (r === 2 && c === 6) ||
                  (r === 6 && c === 12) ||
                  (r === 12 && c === 8) ||
                  (r === 8 && c === 2) ||
                  isRedStart ||
                  isGreenStart ||
                  isYellowStart ||
                  isBlueStart;

                let cellClass = "bg-background/80 border border-border/30";

                if (isRedYard) cellClass = "bg-red-500/20";
                else if (isGreenYard) cellClass = "bg-emerald-500/20";
                else if (isYellowYard) cellClass = "bg-amber-400/20";
                else if (isBlueYard) cellClass = "bg-blue-500/20";
                else if (isCenter) cellClass = "bg-purple-950/40";
                else if (isRedHomeStretch || isRedStart) cellClass = "bg-red-500/80";
                else if (isGreenHomeStretch || isGreenStart) cellClass = "bg-emerald-500/80";
                else if (isYellowHomeStretch || isYellowStart) cellClass = "bg-amber-400/80";
                else if (isBlueHomeStretch || isBlueStart) cellClass = "bg-blue-500/80";

                return (
                  <div
                    key={key}
                    className={`relative flex items-center justify-center p-0.5 ${cellClass}`}
                  >
                    {/* Star Safe Badge */}
                    {isSafeStar && !isCenter && (
                      <span className="text-[10px] text-amber-500 pointer-events-none drop-shadow-xs">
                        ⭐
                      </span>
                    )}

                    {/* Yard Center Big Badges */}
                    {r === 2 && c === 2 && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-2xl font-bold text-red-500/40">
                        🔴
                      </div>
                    )}
                    {r === 2 && c === 12 && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-2xl font-bold text-emerald-500/40">
                        🟢
                      </div>
                    )}
                    {r === 12 && c === 12 && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-2xl font-bold text-amber-500/40">
                        🟡
                      </div>
                    )}
                    {r === 12 && c === 2 && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-2xl font-bold text-blue-500/40">
                        🔵
                      </div>
                    )}

                    {/* Center Home Trophy */}
                    {r === 7 && c === 7 && (
                      <span className="text-xl pointer-events-none animate-bounce">🏆</span>
                    )}

                    {/* Tokens Rendering */}
                    {tokensHere.length > 0 && (
                      <div className="flex items-center justify-center -space-x-1.5 z-10">
                        {tokensHere.map((tok) => (
                          <button
                            key={tok.tokenId + tok.color}
                            type="button"
                            disabled={!tok.canMove}
                            onClick={() => handleSelectToken(tok.tokenId)}
                            className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-white shadow-md flex items-center justify-center transition-all ${
                              COLOR_THEMES[tok.color].tokenBg
                            } ${
                              tok.canMove
                                ? "ring-4 ring-white animate-bounce scale-125 cursor-pointer z-20"
                                : "cursor-default"
                            }`}
                          >
                            <span className="text-[10px] text-white font-black leading-none drop-shadow-sm">
                              {tok.tokenId + 1}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }),
            )}
          </div>
        </div>

        {/* Dice & Interaction Tray */}
        <div className="mt-4 p-4 rounded-2xl bg-card border border-border/80 shadow-panel flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* The 3D Dice Display */}
            <div
              className={`w-14 h-14 rounded-2xl border-4 border-amber-600 bg-linear-to-b from-white to-amber-100 dark:from-zinc-100 dark:to-zinc-300 shadow-xl flex items-center justify-center text-3xl font-black text-amber-950 transition-all ${
                isRollingAnimation ? "animate-spin scale-110" : ""
              }`}
            >
              {isRollingAnimation ? "🎲" : (ludoState.diceValue ?? "?")}
            </div>

            <div>
              <span className="text-xs font-semibold text-muted-foreground block">
                {isMyTurn ? "Your turn!" : "Waiting for active player…"}
              </span>
              <span className="text-sm font-bold text-foreground">
                {ludoState.phase === "rolling"
                  ? "Roll the Dice"
                  : ludoState.phase === "moving"
                    ? "Pick a Bouncing Token"
                    : "Match Finished"}
              </span>
            </div>
          </div>

          {/* Roll Button */}
          {ludoState.phase === "rolling" && isMyTurn && (
            <Button
              size="lg"
              onClick={handleRollDice}
              disabled={isRollingAnimation}
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-6 shadow-md cursor-pointer animate-pulse"
            >
              <Dices className="w-5 h-5 mr-1.5" />
              Roll Dice!
            </Button>
          )}

          {ludoState.phase === "ended" && (
            <Button
              size="default"
              onClick={() => {
                void runAction(
                  async () => {
                    await rematchLudoFn({
                      data: { sessionToken: token, code: s.code },
                    });
                  },
                  () => refresh(),
                );
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 mr-1.5" />
              Play Again
            </Button>
          )}
        </div>

        {/* Players Score / Yard Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
          {ludoState.players.map((p) => {
            const playerProfile = s.players.find((pl) => pl.profileId === p.profileId);
            const isTurn = p.color === ludoState.currentTurnColor && ludoState.phase !== "ended";
            const finishedTokens = p.tokens.filter((t) => t.hasFinished).length;

            return (
              <div
                key={p.color}
                className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                  isTurn
                    ? `border-primary bg-primary/10 shadow-sm ring-2 ${COLOR_THEMES[p.color].glow}`
                    : "border-border/60 bg-card/60"
                }`}
              >
                <div className="relative">
                  <PlayerAvatar id={playerProfile?.avatarId} size={24} />
                  <span className="absolute -bottom-1 -right-1 text-xs">
                    {p.color === "red"
                      ? "🔴"
                      : p.color === "green"
                        ? "🟢"
                        : p.color === "yellow"
                          ? "🟡"
                          : "🔵"}
                  </span>
                </div>
                <div className="overflow-hidden">
                  <span className="text-xs font-bold block truncate">
                    {playerProfile?.displayName ?? p.color}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-semibold">
                    Home: {finishedTokens}/{p.tokens.length}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Match Result Banner */}
      {ludoState.phase === "ended" && (
        <div className="play-panel p-6 text-center space-y-3 border-4 border-amber-500/50 shadow-xl bg-amber-500/5">
          <div className="text-4xl animate-bounce">🏆</div>
          <h2 className="text-xl font-display font-bold">Ludo Race Completed!</h2>
          <p className="text-sm text-muted-foreground">
            {ludoState.winnerId === s.me.profileId
              ? "Congratulations, you won the race to home!"
              : "What an intense race! Check out the final ranks."}
          </p>
        </div>
      )}
    </div>
  );
}
