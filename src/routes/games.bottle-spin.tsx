"use client";
import { useState, useRef, useCallback } from "react";
import { Plus, X, RotateCcw, ChevronRight, Sparkles, Flame } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { GameLayout } from "@/components/game-layout";
import { Button } from "@/components/ui/button";
import { pageHead } from "@/lib/page-head";
import {
  pickRandomPrompt,
  type PromptItem,
  type PromptLevel,
} from "@/games/prompts/prompt-bank";
import { useAccount } from "@/hooks/use-account";

export const Route = createFileRoute("/games/bottle-spin")({
  head: () =>
    pageHead(
      "Bottle Spin",
      "Classic party bottle spin — add your friends, spin and get truth or dare prompts instantly. No sign-in, no room needed.",
    ),
  component: BottleSpinOfflinePage,
});

// ─── types ───────────────────────────────────────────────────────────────────
type Phase = "setup" | "idle" | "spinning" | "choosing" | "prompt";

interface LocalPlayer {
  id: string;
  name: string;
  emoji: string;
}

const EMOJI_LIST = ["🦊", "🦉", "🐱", "🐸", "🐼", "🐙", "🐧", "🐝", "🦈", "🐲", "🦝", "🦄", "🌟", "🎯", "🎸", "🍕"];

function randomEmoji(exclude: string[] = []) {
  const pool = EMOJI_LIST.filter((e) => !exclude.includes(e));
  return pool[Math.floor(Math.random() * pool.length)] ?? "😀";
}

// ─── component ───────────────────────────────────────────────────────────────
function BottleSpinOfflinePage() {
  const { account } = useAccount();

  // Setup state
  const [phase, setPhase] = useState<Phase>("setup");
  const [players, setPlayers] = useState<LocalPlayer[]>([]);
  const [nameInput, setNameInput] = useState("");
  const [promptLevel, setPromptLevel] = useState<PromptLevel>("Chill");

  // Game state
  const [currentSpinnerIdx, setCurrentSpinnerIdx] = useState(0);
  const [targetIdx, setTargetIdx] = useState<number | null>(null);
  const [bottleAngle, setBottleAngle] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [promptType, setPromptType] = useState<"truth" | "dare" | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState<PromptItem | null>(null);
  const [usedIds, setUsedIds] = useState<string[]>([]);
  const spinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── player management ──────────────────────────────────────────────────────
  function addPlayer() {
    const name = nameInput.trim();
    if (!name || players.length >= 12) return;
    const emoji = randomEmoji(players.map((p) => p.emoji));
    setPlayers((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: name.slice(0, 16), emoji },
    ]);
    setNameInput("");
  }

  function removePlayer(id: string) {
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  }

  function startGame() {
    if (players.length < 2) return;
    setCurrentSpinnerIdx(0);
    setTargetIdx(null);
    setBottleAngle(0);
    setUsedIds([]);
    setCurrentPrompt(null);
    setPhase("idle");
  }

  function resetToSetup() {
    if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
    setPhase("setup");
    setTargetIdx(null);
    setIsSpinning(false);
    setCurrentPrompt(null);
    setPromptType(null);
  }

  // ── spin logic ─────────────────────────────────────────────────────────────
  const spinBottle = useCallback(() => {
    if (isSpinning || players.length < 2) return;

    // Pick a random target that is not the current spinner
    const eligibleIdxs = players
      .map((_, i) => i)
      .filter((i) => i !== currentSpinnerIdx);
    const pickedIdx = eligibleIdxs[Math.floor(Math.random() * eligibleIdxs.length)]!;

    // Calculate bottle target angle
    const angleStep = 360 / players.length;
    const targetAngle = pickedIdx * angleStep;
    // Extra spins for drama: 5-8 full turns + target angle
    const extraSpins = (5 + Math.floor(Math.random() * 3)) * 360;
    const newAngle = bottleAngle + extraSpins + (targetAngle - (bottleAngle % 360) + 360) % 360;

    setIsSpinning(true);
    setPhase("spinning");
    setBottleAngle(newAngle);

    spinTimeoutRef.current = setTimeout(() => {
      setTargetIdx(pickedIdx);
      setIsSpinning(false);
      setPhase("choosing");
    }, 3200);
  }, [isSpinning, players, currentSpinnerIdx, bottleAngle]);

  // ── prompt pick ────────────────────────────────────────────────────────────
  function pickPrompt(type: "truth" | "dare") {
    const prompt = pickRandomPrompt(type, promptLevel, usedIds);
    setUsedIds((prev) => [...prev, prompt.id]);
    setCurrentPrompt(prompt);
    setPromptType(type);
    setPhase("prompt");
  }

  // ── advance turn ───────────────────────────────────────────────────────────
  function nextTurn() {
    setCurrentSpinnerIdx((prev) => (prev + 1) % players.length);
    setTargetIdx(null);
    setCurrentPrompt(null);
    setPromptType(null);
    setPhase("idle");
  }

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  const totalPlayers = Math.max(players.length, 1);
  const angleStep = 360 / totalPlayers;
  const currentSpinner = players[currentSpinnerIdx];
  const targetPlayer = targetIdx !== null ? players[targetIdx] : null;

  return (
    <GameLayout back coins={account?.coins}>
      <div className="space-y-5 animate-rise pb-24">

        {/* ── Setup Phase ── */}
        {phase === "setup" && (
          <>
            {/* Header */}
            <div className="text-center py-4">
              <div className="mx-auto mb-4 grid size-24 place-items-center rounded-3xl border-3 border-border bg-pink-400 text-ink shadow-panel transform rotate-3 p-3">
                <img src="/stickers/game-bottle-spin.svg" alt="Bottle Spin" width={60} height={60} className="size-15 select-none drop-shadow" />
              </div>
              <h1 className="font-display text-4xl tracking-tight text-foreground">Bottle Spin</h1>
              <p className="mt-1 font-semibold text-sm text-muted-foreground">No room needed · Play anywhere in real life</p>
            </div>

            {/* Vibe selector */}
            <div className="play-panel p-4 space-y-3">
              <p className="font-display font-bold text-sm">Party Vibe</p>
              <div className="flex gap-2">
                {(["Chill", "Funny", "Wild"] as const).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setPromptLevel(lvl)}
                    className={`flex-1 rounded-xl border-2 py-2.5 font-display font-bold text-sm transition-all ${
                      promptLevel === lvl
                        ? "bg-primary text-primary-foreground border-primary shadow-button"
                        : "bg-card border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {lvl === "Chill" ? "😌 Chill" : lvl === "Funny" ? "😂 Funny" : "🔥 Wild"}
                  </button>
                ))}
              </div>
            </div>

            {/* Add players */}
            <div className="play-panel p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-display font-bold text-sm">Players ({players.length}/12)</p>
                {players.length >= 2 && (
                  <span className="text-xs text-green-600 dark:text-green-400 font-bold">✓ Ready to spin!</span>
                )}
              </div>

              {/* Player chips */}
              {players.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {players.map((p) => (
                    <div key={p.id} className="flex items-center gap-1.5 rounded-full bg-secondary border border-border px-3 py-1.5 text-sm font-semibold">
                      <span>{p.emoji}</span>
                      <span>{p.name}</span>
                      <button
                        onClick={() => removePlayer(p.id)}
                        className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                        aria-label={`Remove ${p.name}`}
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addPlayer()}
                  placeholder="Player name…"
                  maxLength={16}
                  className="flex-1 rounded-xl border-2 border-border bg-background px-3 py-2.5 text-sm font-semibold focus:border-primary focus:outline-none"
                />
                <Button
                  onClick={addPlayer}
                  disabled={!nameInput.trim() || players.length >= 12}
                  size="sm"
                  className="rounded-xl px-4"
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>

            {players.length < 2 && (
              <p className="text-center text-sm text-muted-foreground font-medium">Add at least 2 players to start</p>
            )}

            <div className="primary-dock">
              <Button
                onClick={startGame}
                disabled={players.length < 2}
                className="w-full min-h-[56px] font-display text-xl tracking-wide bg-pink-500 hover:bg-pink-600 text-white shadow-button"
              >
                🍾 Start Spinning!
              </Button>
            </div>
          </>
        )}

        {/* ── Game Board ── */}
        {phase !== "setup" && (
          <>
            {/* Header bar */}
            <div className="play-panel p-3 flex items-center justify-between shadow-panel">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🍾</span>
                <div>
                  <p className="font-display font-bold text-base leading-tight">Bottle Spin</p>
                  <p className="text-xs font-semibold text-muted-foreground">
                    Vibe: <span className="text-pink-500 font-bold">{promptLevel}</span>
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={resetToSetup} className="text-xs gap-1">
                <RotateCcw className="size-3.5" />
                Reset
              </Button>
            </div>

            {/* Status bar */}
            <div className="play-panel p-3 text-center">
              {phase === "idle" && (
                <p className="font-display font-bold text-base">
                  {currentSpinner?.emoji} <span className="text-pink-500">{currentSpinner?.name}</span>'s turn to spin!
                </p>
              )}
              {(phase === "spinning") && (
                <p className="font-display font-bold text-base text-amber-500 animate-pulse">
                  🌀 Spinning…
                </p>
              )}
              {phase === "choosing" && (
                <p className="font-display font-bold text-base text-teal-600 dark:text-teal-400">
                  🫵 Landed on <span className="text-foreground">{targetPlayer?.emoji} {targetPlayer?.name}</span>! Pick your fate!
                </p>
              )}
              {phase === "prompt" && (
                <p className="font-display font-bold text-base">
                  {promptType === "truth" ? "💬 Truth" : "⚡ Dare"} for {targetPlayer?.emoji} {targetPlayer?.name}
                </p>
              )}
            </div>

            {/* Circular game board */}
            <div className="play-panel p-6 shadow-panel relative flex flex-col items-center">
              <div className="relative size-72 sm:size-80 select-none flex items-center justify-center">
                {/* Track ring */}
                <div className="absolute inset-3 rounded-full border-4 border-dashed border-border/40 pointer-events-none" />

                {/* Players in circle */}
                {players.map((p, idx) => {
                  const angleDeg = idx * angleStep - 90;
                  const angleRad = (angleDeg * Math.PI) / 180;
                  const radius = 41;
                  const x = 50 + radius * Math.cos(angleRad);
                  const y = 50 + radius * Math.sin(angleRad);
                  const isTarget = targetIdx === idx;
                  const isSpinnerPlayer = currentSpinnerIdx === idx;

                  return (
                    <div
                      key={p.id}
                      style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)" }}
                      className={`flex flex-col items-center transition-transform duration-300 ${isTarget ? "scale-125 z-20" : "z-10"}`}
                    >
                      <div
                        className={`relative grid size-12 place-items-center rounded-2xl border-3 text-2xl shadow-panel transition-all ${
                          isTarget
                            ? "bg-amber-300 border-amber-500 ring-4 ring-amber-400/60 animate-bounce"
                            : isSpinnerPlayer
                            ? "bg-teal-400 border-teal-600 ring-2 ring-teal-400/40"
                            : "bg-card border-border"
                        }`}
                      >
                        {p.emoji}
                        {isTarget && <span className="absolute -top-2 -right-1 text-xs">⭐</span>}
                      </div>
                      <span className="mt-1 max-w-[60px] truncate text-[10px] font-bold text-foreground text-center">{p.name}</span>
                    </div>
                  );
                })}

                {/* Spinning Bottle */}
                <div
                  className="absolute z-10 size-24 pointer-events-none grid place-items-center"
                  style={{
                    transform: `rotate(${bottleAngle}deg)`,
                    transition: isSpinning
                      ? "transform 3100ms cubic-bezier(0.15, 0.85, 0.35, 1)"
                      : "transform 200ms ease-out",
                  }}
                >
                  <svg viewBox="0 0 100 100" className="size-24 drop-shadow-xl">
                    <polygon points="50,2 43,18 57,18" fill="#F59E0B" stroke="#78350F" strokeWidth="2" />
                    <rect x="45" y="16" width="10" height="8" rx="2" fill="#D97706" stroke="#78350F" strokeWidth="2" />
                    <rect x="42" y="22" width="16" height="8" rx="3" fill="#FBBF24" stroke="#78350F" strokeWidth="2" />
                    <rect x="36" y="28" width="28" height="52" rx="8" fill="#FCD34D" stroke="#78350F" strokeWidth="2.5" />
                    <ellipse cx="50" cy="75" rx="13" ry="5" fill="#F59E0B" opacity="0.5" />
                    <rect x="42" y="36" width="4" height="16" rx="2" fill="#FEF3C7" opacity="0.6" />
                  </svg>
                </div>
              </div>

              {/* Spin button */}
              {phase === "idle" && (
                <Button
                  onClick={spinBottle}
                  className="mt-5 w-full min-h-[52px] font-display text-lg bg-pink-500 hover:bg-pink-600 text-white shadow-button"
                >
                  🍾 Spin the Bottle!
                </Button>
              )}
              {phase === "spinning" && (
                <div className="mt-5 w-full rounded-xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 p-4 text-center">
                  <p className="font-display font-bold text-amber-700 dark:text-amber-300 animate-pulse">Spinning… 🌀</p>
                </div>
              )}
            </div>

            {/* Truth or Dare chooser */}
            {phase === "choosing" && (
              <div className="play-panel p-5 space-y-3">
                <p className="text-center font-bold text-muted-foreground text-sm">
                  {targetPlayer?.name}, pick your fate:
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => pickPrompt("truth")}
                    className="min-h-[60px] font-display text-lg rounded-xl bg-sky-500 hover:bg-sky-600 text-white shadow-button"
                  >
                    💬 Truth
                  </Button>
                  <Button
                    onClick={() => pickPrompt("dare")}
                    className="min-h-[60px] font-display text-lg rounded-xl bg-rose-500 hover:bg-rose-600 text-white shadow-button"
                  >
                    ⚡ Dare
                  </Button>
                </div>
              </div>
            )}

            {/* Prompt display */}
            {phase === "prompt" && currentPrompt && (
              <div className={`play-panel p-5 space-y-4 ${promptType === "truth" ? "ring-2 ring-sky-400" : "ring-2 ring-rose-400"}`}>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{promptType === "truth" ? "💬" : "⚡"}</span>
                  <span className={`font-display font-bold text-sm uppercase tracking-wider ${promptType === "truth" ? "text-sky-600 dark:text-sky-400" : "text-rose-600 dark:text-rose-400"}`}>
                    {promptType === "truth" ? "Truth" : "Dare"}
                  </span>
                  {currentPrompt.level === "Wild" && <Flame className="size-4 text-rose-500" />}
                  {currentPrompt.level === "Funny" && <Sparkles className="size-4 text-amber-500" />}
                </div>
                <p className="font-semibold text-lg leading-snug text-foreground">{currentPrompt.text}</p>
                <Button
                  onClick={nextTurn}
                  className="w-full min-h-[52px] font-display text-lg gap-2 bg-primary text-primary-foreground shadow-button"
                >
                  Next Turn <ChevronRight className="size-5" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </GameLayout>
  );
}
