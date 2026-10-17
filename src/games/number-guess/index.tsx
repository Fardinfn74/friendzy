import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronUp, ChevronDown, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { avatarEmoji } from "@/lib/game-types";
import type { GameState, PublicPlayer } from "@/lib/game-types";
import {
  lockNumberGuessFn,
  submitNumberGuessFn,
  advanceNumberGuessRoundFn,
  rematchNumberGuessFn,
} from "@/lib/game.functions";
import type { NumberGuessClientState } from "./types";

interface NumberGuessGameProps {
  s: GameState;
  token: string;
  refresh: () => void;
  runAction: (fn: () => Promise<unknown>, after?: () => void) => Promise<void>;
}

function rangeMax(range: string): number {
  if (range === "1-50") return 50;
  if (range === "1-500") return 500;
  return 100;
}

/** Big number stepper used in the pick phase */
function NumberStepper({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  // Keyboard input
  const [raw, setRaw] = useState(String(value));

  useEffect(() => {
    setRaw(String(value));
  }, [value]);

  function handleRawChange(v: string) {
    setRaw(v);
    const n = parseInt(v, 10);
    if (!isNaN(n)) onChange(clamp(n));
  }

  function commitRaw() {
    const n = parseInt(raw, 10);
    const clamped = isNaN(n) ? min : clamp(n);
    onChange(clamped);
    setRaw(String(clamped));
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Up arrow */}
      <button
        type="button"
        aria-label="Increase"
        onClick={() => {
          const next = clamp(value + 1);
          onChange(next);
          setRaw(String(next));
        }}
        className="flex size-14 items-center justify-center rounded-2xl border-2 border-border bg-secondary text-foreground shadow active:scale-95 transition-transform text-2xl font-black"
      >
        <ChevronUp className="size-8 stroke-[3]" />
      </button>

      {/* Number display / input */}
      <input
        type="number"
        inputMode="numeric"
        pattern="[0-9]*"
        min={min}
        max={max}
        value={raw}
        onChange={(e) => handleRawChange(e.target.value)}
        onBlur={commitRaw}
        className="w-44 rounded-2xl border-3 border-primary bg-card px-4 py-3 text-center font-display text-6xl font-black text-primary shadow-lg outline-none focus:ring-2 focus:ring-primary/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        aria-label="Your secret number"
      />

      {/* Down arrow */}
      <button
        type="button"
        aria-label="Decrease"
        onClick={() => {
          const next = clamp(value - 1);
          onChange(next);
          setRaw(String(next));
        }}
        className="flex size-14 items-center justify-center rounded-2xl border-2 border-border bg-secondary text-foreground shadow active:scale-95 transition-transform text-2xl font-black"
      >
        <ChevronDown className="size-8 stroke-[3]" />
      </button>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-2 pt-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => {
              const next = clamp(parseInt(`${value === 0 ? "" : value}${d}`, 10) || d);
              onChange(next);
              setRaw(String(next));
            }}
            className={`flex h-12 items-center justify-center rounded-xl border-2 border-border bg-card font-display text-xl font-bold text-foreground shadow-sm active:scale-95 transition-transform ${d === 0 ? "col-start-2" : ""}`}
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            const next = Math.floor(value / 10);
            onChange(next);
            setRaw(String(next));
          }}
          className="flex h-12 items-center justify-center rounded-xl border-2 border-border bg-secondary font-display text-xl font-bold text-muted-foreground shadow-sm active:scale-95 transition-transform"
        >
          ⌫
        </button>
      </div>
    </div>
  );
}

/** Countdown overlay 3-2-1 */
function CountdownOverlay({ endsAt, onDone }: { endsAt: number; onDone: () => void }) {
  const [n, setN] = useState(() => Math.ceil((endsAt - Date.now()) / 1000));
  const called = useRef(false);

  useEffect(() => {
    const tick = () => {
      const remaining = Math.ceil((endsAt - Date.now()) / 1000);
      setN(Math.max(0, remaining));
      if (remaining <= 0 && !called.current) {
        called.current = true;
        onDone();
      }
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [endsAt, onDone]);

  return (
    <div className="play-panel flex flex-col items-center gap-4 p-8 text-center animate-rise">
      <p className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
        Get ready to guess!
      </p>
      <div
        key={n}
        className="font-display text-8xl font-black text-primary animate-bounce"
        style={{ lineHeight: 1 }}
      >
        {n <= 0 ? "GO!" : n}
      </div>
    </div>
  );
}

/** Scoreboard pill */
function ScoreRow({ p, score, isSelf }: { p: PublicPlayer; score: number; isSelf: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl px-3 py-2 border-2 transition-all ${
        isSelf ? "border-primary bg-primary/10 font-bold" : "border-border bg-card/60"
      }`}
    >
      <span className="text-2xl">{avatarEmoji(p.avatarId)}</span>
      <span className="flex-1 truncate text-sm font-bold">
        {p.displayName}
        {isSelf && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
      </span>
      <span className="font-display text-lg font-black text-primary">{score}</span>
    </div>
  );
}

export function NumberGuessGame({ s, token, refresh }: NumberGuessGameProps) {
  const ng: NumberGuessClientState | null | undefined = s.numberGuess;
  const lockIn = useServerFn(lockNumberGuessFn);
  const submitGuess = useServerFn(submitNumberGuessFn);
  const advanceRound = useServerFn(advanceNumberGuessRoundFn);
  const rematch = useServerFn(rematchNumberGuessFn);

  const activePlayers = s.players.filter((p) => !p.leftGame);
  const myProfileId = s.me.profileId;
  const myPlayer = activePlayers.find((p) => p.profileId === myProfileId);

  // Pick phase local state
  const max = rangeMax(ng?.settings.range ?? "1-100");
  const [pickValue, setPickValue] = useState(Math.ceil(max / 2));
  const [pickBusy, setPickBusy] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);

  // Guess phase state: selected target + guess input
  const [targetId, setTargetId] = useState<string | null>(null);
  const [guessValue, setGuessValue] = useState(1);
  const [guessRaw, setGuessRaw] = useState("1");
  const [guessBusy, setGuessBusy] = useState(false);
  const [guessError, setGuessError] = useState<string | null>(null);
  const [guessResult, setGuessResult] = useState<{
    correct: boolean;
    hint: "higher" | "lower" | null;
  } | null>(null);

  // Cooldown
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [onCooldown, setOnCooldown] = useState(false);

  const opponents = activePlayers.filter((p) => p.profileId !== myProfileId);

  // Auto-select first opponent as target if none selected
  useEffect(() => {
    if (!targetId && opponents.length > 0) {
      setTargetId(opponents[0]!.profileId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when opponent list size changes; targetId intentionally excluded to avoid re-selecting on every render
  }, [opponents.length]);

  // Vibrate on win
  useEffect(() => {
    if (ng?.roundWinnerId === myProfileId) {
      try {
        navigator.vibrate?.([100, 50, 100]);
      } catch {
        /* ignore */
      }
    }
  }, [ng?.roundWinnerId, myProfileId]);

  // Sync guess input when switching targets
  useEffect(() => {
    const mid = Math.ceil(max / 2);
    setGuessValue(mid);
    setGuessRaw(String(mid));
    setGuessResult(null);
    setGuessError(null);
  }, [targetId, max]);

  const handleLockIn = useCallback(async () => {
    setPickBusy(true);
    setPickError(null);
    try {
      const res = await lockIn({
        data: { sessionToken: token, code: s.code, number: pickValue },
      });
      if (res && typeof res === "object" && "error" in res) {
        setPickError(String((res as { error: string }).error));
      } else {
        refresh();
      }
    } catch (e) {
      setPickError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setPickBusy(false);
    }
  }, [token, s.code, pickValue, lockIn, refresh]);

  const handleGuess = useCallback(async () => {
    if (!targetId || onCooldown || guessBusy) return;
    setGuessBusy(true);
    setGuessError(null);
    setGuessResult(null);
    try {
      const res = await submitGuess({
        data: {
          sessionToken: token,
          code: s.code,
          targetId,
          guess: guessValue,
        },
      });
      if (res && typeof res === "object") {
        const r = res as {
          ok?: boolean;
          correct?: boolean;
          hint?: "higher" | "lower" | null;
          error?: string;
        };
        if (r.error) {
          setGuessError(r.error);
        } else {
          setGuessResult({ correct: r.correct ?? false, hint: r.hint ?? null });
          if (r.correct) {
            try {
              navigator.vibrate?.([200, 100, 200]);
            } catch {
              /* ignore */
            }
          }
          // 1.5s cooldown
          setOnCooldown(true);
          cooldownRef.current = setTimeout(() => {
            setOnCooldown(false);
            setGuessResult(null);
          }, 1500);
          refresh();
        }
      }
    } catch (e) {
      setGuessError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setGuessBusy(false);
    }
  }, [token, s.code, targetId, guessValue, onCooldown, guessBusy, submitGuess, refresh]);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearTimeout(cooldownRef.current);
    };
  }, []);

  if (!ng) {
    return (
      <div className="play-panel p-8 text-center">
        <p className="text-muted-foreground">Loading game…</p>
      </div>
    );
  }

  const phase = ng.phase;
  const myLocked = ng.locked[myProfileId] ?? false;
  const allLocked = activePlayers.every((p) => ng.locked[p.profileId]);

  /* ─── Pick Phase ─── */
  if (phase === "pick") {
    return (
      <div className="space-y-5 animate-rise">
        {/* Header */}
        <div className="play-panel flex items-center justify-between gap-2 p-4">
          <div>
            <p className="font-display font-bold text-lg">
              Round {ng.currentRound} / {ng.maxRounds}
            </p>
            <p className="text-xs text-muted-foreground">Range: {ng.settings.range}</p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            {activePlayers.map((p) => (
              <div key={p.profileId} className="flex flex-col items-center gap-0.5">
                <span className="text-2xl">{avatarEmoji(p.avatarId)}</span>
                <span
                  className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                    ng.locked[p.profileId]
                      ? "bg-teal-500/20 text-teal-600"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {ng.locked[p.profileId] ? "Locked ✓" : "Waiting…"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Stepper */}
        <div className="play-panel p-6">
          <p className="mb-4 text-center font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
            {myLocked ? "Waiting for others…" : "Pick your secret number (1 – " + max + ")"}
          </p>
          {!myLocked ? (
            <>
              <div className="flex justify-center">
                <NumberStepper value={pickValue} onChange={setPickValue} min={1} max={max} />
              </div>
              {pickError && (
                <p className="mt-3 text-center text-sm font-bold text-destructive">{pickError}</p>
              )}
              <Button
                className="mt-6 w-full min-h-[56px] font-display text-lg bg-primary text-primary-foreground shadow-button"
                disabled={pickBusy}
                onClick={handleLockIn}
              >
                {pickBusy ? "Locking…" : "🔒 Lock In"}
              </Button>
            </>
          ) : (
            <div className="mt-4 flex flex-col items-center gap-3">
              <div className="text-6xl font-black font-display text-muted-foreground/40 select-none">
                ?
              </div>
              <p className="text-sm text-muted-foreground font-semibold">
                Your number is locked. Waiting for{" "}
                {activePlayers.filter((p) => !ng.locked[p.profileId]).length} player(s)…
              </p>
              {allLocked && (
                <p className="text-xs text-primary font-bold animate-pulse">
                  Everyone locked in! Starting soon…
                </p>
              )}
            </div>
          )}
        </div>

        {/* Scores */}
        <div className="play-panel p-4 space-y-2">
          <p className="text-stencil text-xs">Scores</p>
          {activePlayers.map((p) => (
            <ScoreRow
              key={p.profileId}
              p={p}
              score={ng.scores[p.profileId] ?? 0}
              isSelf={p.profileId === myProfileId}
            />
          ))}
        </div>
      </div>
    );
  }

  /* ─── Countdown Phase ─── */
  if (phase === "countdown") {
    return (
      <div className="space-y-5 animate-rise">
        {ng.countdownEndsAt && <CountdownOverlay endsAt={ng.countdownEndsAt} onDone={refresh} />}
      </div>
    );
  }

  /* ─── Guess Phase ─── */
  if (phase === "guess") {
    const target = targetId ? activePlayers.find((p) => p.profileId === targetId) : null;
    const myGuessesAgainstTarget = targetId ? (ng.myGuesses[targetId] ?? []) : [];

    return (
      <div className="space-y-5 animate-rise">
        {/* Target selector */}
        <div className="play-panel p-4 space-y-2">
          <p className="text-stencil text-xs">Choose your target</p>
          <div className="flex gap-2 flex-wrap">
            {opponents.map((p) => {
              const selected = targetId === p.profileId;
              const myGuessesHere = ng.myGuesses[p.profileId] ?? [];
              const hint = ng.myHints[p.profileId];
              return (
                <button
                  key={p.profileId}
                  type="button"
                  onClick={() => setTargetId(p.profileId)}
                  className={`flex flex-col items-center gap-1 rounded-2xl border-2 px-4 py-3 transition-all active:scale-95 ${
                    selected ? "border-primary bg-primary/10 shadow-md" : "border-border bg-card/70"
                  }`}
                >
                  <span className="text-3xl">{avatarEmoji(p.avatarId)}</span>
                  <span className="text-xs font-bold truncate max-w-[72px]">{p.displayName}</span>
                  {myGuessesHere.length > 0 && (
                    <span className="text-[10px] font-black text-muted-foreground">
                      {myGuessesHere.length} guess
                      {myGuessesHere.length !== 1 ? "es" : ""}
                    </span>
                  )}
                  {selected && hint && ng.settings.hints && (
                    <span
                      className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                        hint === "higher"
                          ? "bg-teal-500/20 text-teal-600"
                          : "bg-amber-500/20 text-amber-600"
                      }`}
                    >
                      {hint === "higher" ? "Higher ↑" : "Lower ↓"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Guess input */}
        {target && (
          <div className="play-panel p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-3xl">{avatarEmoji(target.avatarId)}</span>
              <div>
                <p className="font-display font-bold">
                  Guessing {target.displayName}&apos;s number
                </p>
                <p className="text-xs text-muted-foreground">
                  Range: {ng.settings.range}
                  {myGuessesAgainstTarget.length > 0 &&
                    ` · Last: ${myGuessesAgainstTarget[myGuessesAgainstTarget.length - 1]}`}
                </p>
              </div>
            </div>

            {/* Hint feedback */}
            {guessResult && !guessResult.correct && guessResult.hint && (
              <div
                className={`rounded-xl border-2 px-4 py-3 text-center font-display font-bold text-lg ${
                  guessResult.hint === "higher"
                    ? "border-teal-500/40 bg-teal-500/10 text-teal-600"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-600"
                }`}
              >
                {guessResult.hint === "higher" ? "Higher ↑" : "Lower ↓"}
              </div>
            )}
            {guessResult?.correct && (
              <div className="rounded-xl border-2 border-teal-500/40 bg-teal-500/10 px-4 py-3 text-center font-display font-bold text-lg text-teal-600">
                🎉 Correct!
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                min={1}
                max={max}
                value={guessRaw}
                onChange={(e) => {
                  setGuessRaw(e.target.value);
                  const n = parseInt(e.target.value, 10);
                  if (!isNaN(n)) setGuessValue(Math.min(max, Math.max(1, n)));
                }}
                onBlur={() => {
                  const n = parseInt(guessRaw, 10);
                  const clamped = isNaN(n) ? 1 : Math.min(max, Math.max(1, n));
                  setGuessValue(clamped);
                  setGuessRaw(String(clamped));
                }}
                className="flex-1 rounded-xl border-2 border-border bg-card px-4 py-3 font-display text-3xl font-black text-center text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                aria-label="Your guess"
              />
              <Button
                className="min-h-[52px] px-6 font-display text-base font-bold bg-primary text-primary-foreground shadow-button"
                disabled={guessBusy || onCooldown}
                onClick={handleGuess}
              >
                {onCooldown ? "…" : guessBusy ? "…" : "Guess!"}
              </Button>
            </div>
            {guessError && (
              <p className="text-center text-sm font-bold text-destructive">{guessError}</p>
            )}
          </div>
        )}

        {/* Scores */}
        <div className="play-panel p-4 space-y-2">
          <p className="text-stencil text-xs">Scores</p>
          {activePlayers.map((p) => (
            <ScoreRow
              key={p.profileId}
              p={p}
              score={ng.scores[p.profileId] ?? 0}
              isSelf={p.profileId === myProfileId}
            />
          ))}
        </div>
      </div>
    );
  }

  /* ─── Round Ended ─── */
  if (phase === "round_ended") {
    const winner = activePlayers.find((p) => p.profileId === ng.roundWinnerId);
    const iWon = ng.roundWinnerId === myProfileId;

    return (
      <div className="space-y-5 animate-rise">
        <div className="play-panel p-6 text-center space-y-4">
          <div className="text-5xl">{iWon ? "🏆" : "😬"}</div>
          <h2 className="font-display text-2xl font-black">
            {iWon
              ? "You got it!"
              : winner
                ? `${winner.displayName} wins the round!`
                : "Round over!"}
          </h2>
          <p className="text-sm text-muted-foreground">Round {ng.currentRound} complete</p>
        </div>

        {/* Reveal all secrets */}
        {ng.revealedSecrets &&
          (() => {
            const secrets = ng.revealedSecrets;
            return (
              <div className="play-panel p-5 space-y-3">
                <p className="text-stencil text-xs">Revealed Numbers</p>
                {activePlayers.map((p) => (
                  <div
                    key={p.profileId}
                    className="flex items-center gap-3 rounded-xl border-2 border-border bg-card/60 px-3 py-2"
                  >
                    <span className="text-2xl">{avatarEmoji(p.avatarId)}</span>
                    <span className="flex-1 font-bold text-sm">
                      {p.displayName}
                      {p.profileId === myProfileId && (
                        <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                      )}
                    </span>
                    <span className="font-display text-2xl font-black text-primary">
                      {secrets[p.profileId] ?? "?"}
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}

        {/* Scores */}
        <div className="play-panel p-4 space-y-2">
          <p className="text-stencil text-xs">Scores</p>
          {activePlayers.map((p) => (
            <ScoreRow
              key={p.profileId}
              p={p}
              score={ng.scores[p.profileId] ?? 0}
              isSelf={p.profileId === myProfileId}
            />
          ))}
        </div>

        {s.me.isHost && (
          <Button
            className="w-full min-h-[56px] font-display text-lg bg-primary text-primary-foreground shadow-button"
            onClick={async () => {
              try {
                await advanceRound({
                  data: { sessionToken: token, code: s.code },
                });
                refresh();
              } catch {
                /* ignore */
              }
            }}
          >
            ▶ Next Round
          </Button>
        )}
        {!s.me.isHost && (
          <p className="text-center text-sm text-muted-foreground font-semibold">
            Waiting for host to start next round…
          </p>
        )}
      </div>
    );
  }

  /* ─── Match Ended ─── */
  if (phase === "match_ended") {
    const winner = activePlayers.find((p) => p.profileId === ng.matchWinnerId);
    const iWon = ng.matchWinnerId === myProfileId;

    return (
      <div className="space-y-5 animate-rise">
        <div className="play-panel p-8 text-center space-y-4">
          <div className="text-6xl">{iWon ? "🏆" : "🎊"}</div>
          <h2 className="font-display text-3xl font-black">
            {iWon ? "You win the match!" : winner ? `${winner.displayName} wins!` : "Match over!"}
          </h2>

          {/* Reveal all secrets */}
          {ng.revealedSecrets &&
            (() => {
              const secrets = ng.revealedSecrets;
              return (
                <div className="mt-2 space-y-2 text-left">
                  <p className="text-stencil text-xs">Final Secrets</p>
                  {activePlayers.map((p) => (
                    <div
                      key={p.profileId}
                      className="flex items-center gap-3 rounded-xl border-2 border-border bg-card/60 px-3 py-2"
                    >
                      <span className="text-2xl">{avatarEmoji(p.avatarId)}</span>
                      <span className="flex-1 font-bold text-sm">{p.displayName}</span>
                      <span className="font-display text-2xl font-black text-primary">
                        {secrets[p.profileId] ?? "?"}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}
        </div>

        {/* Final scoreboard */}
        <div className="play-panel p-4 space-y-2">
          <p className="text-stencil text-xs">Final Scores</p>
          {[...activePlayers]
            .sort((a, b) => (ng.scores[b.profileId] ?? 0) - (ng.scores[a.profileId] ?? 0))
            .map((p, i) => (
              <div key={p.profileId} className="flex items-center gap-2">
                <span className="font-display font-black text-sm w-5 text-muted-foreground">
                  #{i + 1}
                </span>
                <ScoreRow
                  p={p}
                  score={ng.scores[p.profileId] ?? 0}
                  isSelf={p.profileId === myProfileId}
                />
              </div>
            ))}
        </div>

        <div className="flex gap-3 pt-2">
          {s.me.isHost && (
            <Button
              className="flex-1 min-h-[56px] font-display text-base bg-primary text-primary-foreground shadow-button"
              onClick={async () => {
                try {
                  await rematch({
                    data: { sessionToken: token, code: s.code },
                  });
                  refresh();
                } catch {
                  /* ignore */
                }
              }}
            >
              <RotateCcw className="size-4 mr-2" />
              Rematch
            </Button>
          )}
          <Link
            to="/"
            className="flex-1 clay-button inline-flex min-h-[56px] items-center justify-center rounded-xl bg-secondary px-6 font-display text-base text-secondary-foreground shadow-button"
          >
            🏠 Back to Hub
          </Link>
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="play-panel p-8 text-center">
      <p className="text-muted-foreground">
        {myPlayer?.displayName} — Game phase: {phase}
      </p>
    </div>
  );
}
