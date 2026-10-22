import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Eraser, Pencil, Trash2, Send, Trophy, Eye, Clock, Palette, Sparkles, Check, MessageSquare, Flame } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/player-avatar";
import type { GameState } from "@/lib/game-types";
import type { DrawStroke } from "./types";
import {
  submitDoodleStrokeFn,
  submitDoodleGuessFn,
  clearDoodleCanvasFn,
  advanceDoodleRoundFn,
} from "@/lib/game.functions";
import { useServerFn } from "@tanstack/react-start";

interface DoodleRushGameProps {
  s: GameState;
  token: string;
  refresh: () => void;
  runAction: (fn: () => Promise<unknown>, after?: () => void) => Promise<void>;
}

const COLORS = ["#1a1a1a", "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#ffffff"];
const SIZES = [4, 8, 14, 22];

function useCountdown(endsAt: string | null) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!endsAt) return;
    function update() {
      setRemaining(Math.max(0, Math.round((new Date(endsAt!).getTime() - Date.now()) / 1000)));
    }
    update();
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, [endsAt]);
  return remaining;
}

// ── Canvas renderer ───────────────────────────────────────────────────────────
function renderStrokes(ctx: CanvasRenderingContext2D, strokes: DrawStroke[], w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  for (const stroke of strokes) {
    if (stroke.x.length < 2) continue;
    ctx.beginPath();
    ctx.strokeStyle = stroke.tool === "eraser" ? "#ffffff" : stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.moveTo(stroke.x[0]! * w, stroke.y[0]! * h);
    for (let i = 1; i < stroke.x.length; i++) {
      ctx.lineTo(stroke.x[i]! * w, stroke.y[i]! * h);
    }
    ctx.stroke();
  }
}

export function DoodleRushGame({ s, token, refresh, runAction }: DoodleRushGameProps) {
  const dr = s.doodleRush;
  const submitStroke = useServerFn(submitDoodleStrokeFn);
  const submitGuess = useServerFn(submitDoodleGuessFn);
  const clearCanvas = useServerFn(clearDoodleCanvasFn);
  const advanceRound = useServerFn(advanceDoodleRoundFn);

  // Drawing state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState(COLORS[0]!);
  const [size, setSize] = useState(SIZES[1]!);
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<{ x: number[]; y: number[] }>({ x: [], y: [] });

  // Guess state
  const [guessInput, setGuessInput] = useState("");
  const [guessFeedback, setGuessFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Remote strokes - track which we've already rendered
  const lastStrokeCount = useRef(0);
  const localStrokes = useRef<DrawStroke[]>([]);

  const countdownLeft = useCountdown(dr?.countdownEndsAt ?? null);
  const timeLeft = useCountdown(dr?.currentRound?.endsAt ?? null);

  // Re-render canvas whenever strokes update
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;

    const remoteStrokes = dr?.currentRound?.strokes ?? [];
    const allStrokes = [...remoteStrokes, ...localStrokes.current];
    renderStrokes(ctx, allStrokes, w, h);
    lastStrokeCount.current = remoteStrokes.length;
  }, [dr?.currentRound?.strokes]);

  // Auto-advance countdown → drawing
  useEffect(() => {
    if (dr?.phase === "countdown" && countdownLeft === 0) {
      const t = setTimeout(refresh, 500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [dr?.phase, countdownLeft, refresh]);

  // Auto-advance time limit hit
  useEffect(() => {
    if (dr?.phase === "drawing" && timeLeft === 0) {
      const t = setTimeout(refresh, 800);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [dr?.phase, timeLeft, refresh]);

  // Host auto-advances round_end
  useEffect(() => {
    if (dr?.phase === "round_end" && s.me.isHost) {
      const t = setTimeout(() => {
        runAction(
          () => advanceRound({ data: { sessionToken: token, code: s.code } }),
          refresh,
        );
      }, 3000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [dr?.phase, s.me.isHost, token, s.code, advanceRound, runAction, refresh]);

  const lastAnnouncedGuesserRef = useRef<string | null>(null);

  // Announce correct guess on every player's screen to encourage fast guessing
  useEffect(() => {
    const latest = dr?.currentRound?.latestCorrectGuesser;
    if (!latest || !latest.submittedAt) return;
    if (latest.submittedAt !== lastAnnouncedGuesserRef.current) {
      lastAnnouncedGuesserRef.current = latest.submittedAt;
      toast.success(`🎉 ${latest.displayName} guessed correctly! A hint letter was revealed! Fast guessing earns higher ranks!`, {
        duration: 4500,
      });
    }
  }, [dr?.currentRound?.latestCorrectGuesser]);

  // Clear local strokes and reset announcement ref when a new round starts
  useEffect(() => {
    localStrokes.current = [];
    lastAnnouncedGuesserRef.current = null;
  }, [dr?.currentRound?.roundNumber]);

  // ── Drawing handlers ────────────────────────────────────────────────────────
  const getPos = useCallback((e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  }, []);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!dr?.isDrawer) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      isDrawingRef.current = true;
      const { x, y } = getPos(e);
      currentStrokeRef.current = { x: [x], y: [y] };

      // Draw locally immediately
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (ctx) {
        ctx.beginPath();
        ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
        ctx.lineWidth = tool === "eraser" ? size * 2 : size;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.moveTo(x * canvas!.width, y * canvas!.height);
      }
    },
    [dr?.isDrawer, getPos, tool, color, size],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current || !dr?.isDrawer) return;
      const { x, y } = getPos(e);
      currentStrokeRef.current.x.push(x);
      currentStrokeRef.current.y.push(y);

      // Live draw
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (ctx) {
        ctx.lineTo(x * canvas!.width, y * canvas!.height);
        ctx.stroke();
      }
    },
    [dr?.isDrawer, getPos],
  );

  const onPointerUp = useCallback(async () => {
    if (!isDrawingRef.current || !dr?.isDrawer) return;
    isDrawingRef.current = false;
    const { x, y } = currentStrokeRef.current;
    if (x.length < 2) return;

    const stroke: DrawStroke = { x, y, color, size, tool };
    localStrokes.current.push(stroke);

    // Save to server (background, no await needed for UX)
    void submitStroke({ data: { sessionToken: token, code: s.code, stroke } });
  }, [dr?.isDrawer, color, size, tool, submitStroke, token, s.code]);

  const handleClear = useCallback(() => {
    localStrokes.current = [];
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas!.width, canvas!.height);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas!.width, canvas!.height);
    }
    void clearCanvas({ data: { sessionToken: token, code: s.code } });
  }, [clearCanvas, token, s.code]);

  // ── Guess ─────────────────────────────────────────────────────────────────
  function showGuessFeedback(ok: boolean, msg: string) {
    setGuessFeedback({ ok, msg });
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setGuessFeedback(null), 2500);
  }

  async function handleGuess() {
    const g = guessInput.trim();
    if (!g || dr?.phase !== "drawing") return;
    setGuessInput("");
    const res = await submitGuess({ data: { sessionToken: token, code: s.code, guess: g } });
    if (res && "correct" in res) {
      if ((res as { correct: boolean }).correct) {
        showGuessFeedback(true, `🎉 Correct! You gave ${dr?.currentRound?.drawerName ?? "the artist"} +1 guess point!`);
        refresh();
      } else if (res && "error" in res) {
        showGuessFeedback(false, (res as { error: string }).error);
      } else {
        showGuessFeedback(false, "Not quite — keep guessing!");
      }
    }
  }

  if (!dr) {
    return (
      <div className="play-panel p-8 text-center">
        <p className="font-bold text-muted-foreground">Loading Doodle Rush…</p>
      </div>
    );
  }

  // ── Game Over ────────────────────────────────────────────────────────────
  if (dr.phase === "game_over") {
    // Winners are ranked by who received the majority of correct guesses on their drawings
    const sorted = Object.entries(dr.scores).sort((a, b) => b[1] - a[1]);
    const winnerId = sorted[0]?.[0];
    const winnerScore = sorted[0]?.[1] ?? 0;
    const winner = s.players.find((p) => p.profileId === winnerId);

    return (
      <div className="space-y-5 animate-rise">
        {/* Crown & Winner Announcement */}
        <div className="play-panel p-6 text-center space-y-3 border-3 border-amber-400 bg-amber-500/10 shadow-panel">
          <div className="text-6xl animate-bounce">👑</div>
          <h2 className="font-display text-3xl font-extrabold text-foreground">The Great Artist Awards!</h2>
          <p className="text-sm font-semibold text-muted-foreground">
            Ranked serially by whose drawings had the majority of correct guesses
          </p>

          {winner && (
            <div className="mt-3 p-4 rounded-2xl bg-card border-2 border-amber-400 shadow-md">
              <span className="text-xs uppercase font-extrabold tracking-widest text-amber-600 dark:text-amber-400">
                ⭐ 1st Great Artist ⭐
              </span>
              <p className="font-display text-3xl font-black text-primary mt-1">
                {winner.displayName}
              </p>
              <p className="font-semibold text-base text-foreground mt-1">
                🎨 <strong className="text-xl font-display text-primary">{winnerScore}</strong> {winnerScore === 1 ? "player" : "players"} correctly guessed their drawings!
              </p>
            </div>
          )}
        </div>

        {/* Full Leaderboard / Standings */}
        <div className="play-panel p-5 space-y-3 shadow-panel">
          <div className="flex items-center justify-between border-b border-border/40 pb-2">
            <h3 className="font-display font-bold text-base flex items-center gap-1.5">
              <Trophy className="size-4 text-amber-500" />
              The Great Artists
            </h3>
            <span className="text-xs text-muted-foreground font-semibold">
              Serially: 1st, 2nd, 3rd…
            </span>
          </div>

          <div className="space-y-2">
            {sorted.map(([pid, score], i) => {
              const p = s.players.find((pl) => pl.profileId === pid);
              if (!p) return null;
              const isWinner = i === 0;
              const serialTitle =
                i === 0
                  ? "1st Great Artist (Winner)"
                  : i === 1
                  ? "2nd Great Artist"
                  : i === 2
                  ? "3rd Great Artist"
                  : `${i + 1}th Great Artist`;

              return (
                <div
                  key={pid}
                  className={`flex items-center gap-3 rounded-2xl p-3.5 transition-all ${
                    isWinner
                      ? "bg-amber-100/70 dark:bg-amber-950/50 border-2 border-amber-400 shadow-sm"
                      : i === 1
                      ? "bg-slate-100/70 dark:bg-slate-800/50 border-2 border-slate-300 dark:border-slate-700"
                      : i === 2
                      ? "bg-orange-50/70 dark:bg-orange-950/40 border-2 border-amber-600/30"
                      : "bg-secondary/40 border border-border/40"
                  }`}
                >
                  <span className="font-display font-black text-xl w-8 text-center">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}
                  </span>
                  <PlayerAvatar id={p.avatarId} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-base truncate">{p.displayName}</p>
                    <p className="text-xs text-muted-foreground font-semibold">
                      {serialTitle}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-display font-black text-xl text-primary">
                      {score}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground ml-1">
                      {score === 1 ? "guess" : "guesses"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Countdown ────────────────────────────────────────────────────────────
  if (dr.phase === "countdown") {
    const round = dr.currentRound;
    return (
      <div className="play-panel p-10 text-center space-y-4">
        <div className="text-5xl">🎨</div>
        <p className="font-display text-2xl font-bold">
          {round?.drawerName} is drawing!
        </p>
        <p className="font-display text-8xl font-bold text-primary">{countdownLeft}</p>
        <p className="text-muted-foreground">Get ready to guess…</p>
      </div>
    );
  }

  // ── Round End ────────────────────────────────────────────────────────────
  if (dr.phase === "round_end") {
    const round = dr.currentRound;
    const sorted = Object.entries(dr.scores).sort((a, b) => b[1] - a[1]);
    const correctCount = round?.winnerIds.length ?? 0;

    return (
      <div className="space-y-5">
        <div className="play-panel p-5 text-center space-y-3">
          <div className="text-4xl">🖼️</div>
          <p className="font-display font-bold text-2xl">Round {round?.roundNumber} Complete!</p>
          {round?.revealedWord && (
            <p className="text-muted-foreground text-sm">
              The secret word was: <span className="font-display font-bold text-xl text-primary uppercase">{round.revealedWord}</span>
            </p>
          )}

          <div className="mt-2 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 p-3">
            <p className="font-display font-bold text-base text-foreground">
              🎨 Artist: <span className="text-primary">{round?.drawerName}</span>
            </p>
            <p className="font-semibold text-sm text-muted-foreground mt-0.5">
              {correctCount} {correctCount === 1 ? "player guessed" : "players guessed"} correctly!
            </p>
            <p className="font-display font-bold text-xs text-amber-600 dark:text-amber-400 mt-1">
              +{correctCount} {correctCount === 1 ? "guess point" : "guess points"} towards Great Artist!
            </p>
          </div>

          {s.me.isHost && <p className="text-xs text-muted-foreground mt-1">Next round starting…</p>}
        </div>

        {/* Round Guessing Winners (Serial 1st, 2nd, 3rd...) */}
        <div className="play-panel p-4 space-y-3 shadow-panel">
          <div className="flex items-center justify-between border-b border-border/40 pb-2">
            <h3 className="font-display font-bold text-base flex items-center gap-1.5">
              <Trophy className="size-4 text-amber-500" />
              Round Result: Guessing Winners
            </h3>
            <span className="text-xs text-muted-foreground font-semibold">
              Serially: 1st, 2nd, 3rd…
            </span>
          </div>

          {round && round.winnerIds.length > 0 ? (
            <div className="space-y-2">
              {round.winnerIds.map((pid, i) => {
                const p = s.players.find((pl) => pl.profileId === pid);
                if (!p) return null;
                return (
                  <div
                    key={pid}
                    className={`flex items-center gap-3 rounded-xl p-2.5 transition-all ${
                      i === 0
                        ? "bg-amber-100/80 dark:bg-amber-950/50 border border-amber-300"
                        : i === 1
                        ? "bg-slate-100/80 dark:bg-slate-800/50 border border-slate-300"
                        : i === 2
                        ? "bg-orange-50/80 dark:bg-orange-950/40 border border-amber-600/30"
                        : "bg-secondary/40"
                    }`}
                  >
                    <span className="font-display font-black text-lg w-7 text-center">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}
                    </span>
                    <PlayerAvatar id={p.avatarId} size={32} />
                    <span className="font-bold flex-1 text-sm">{p.displayName}</span>
                    <span className="text-xs font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-full border border-teal-500/30">
                      {i === 0 ? "1st to Guess" : i === 1 ? "2nd to Guess" : i === 2 ? "3rd to Guess" : `${i + 1}th to Guess`}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-sm font-semibold text-muted-foreground py-2">
              Nobody guessed this drawing in time!
            </p>
          )}
        </div>

        {/* Show the last canvas */}
        <div className="play-panel p-3">
          <canvas ref={canvasRef} width={600} height={400} className="w-full rounded-xl border border-border" style={{ background: "#fff" }} />
        </div>

        <div className="play-panel p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-border/40 pb-2">
            <p className="font-display font-bold text-sm">Overall Great Artist Standings</p>
            <span className="text-xs text-muted-foreground font-semibold">Ranked serially</span>
          </div>
          {sorted.map(([pid, score], i) => {
            const p = s.players.find((pl) => pl.profileId === pid);
            if (!p) return null;
            return (
              <div key={pid} className="flex items-center gap-2">
                <span className="w-6 text-center font-bold text-sm">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}</span>
                <PlayerAvatar id={p.avatarId} size={28} />
                <span className="flex-1 font-semibold text-sm">{p.displayName}</span>
                <span className="font-display font-bold text-primary text-sm">{score} {score === 1 ? "guess" : "guesses"}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Drawing Phase ────────────────────────────────────────────────────────
  const round = dr.currentRound;
  const isDrawer = dr.isDrawer;
  const timeIsLow = timeLeft <= 15;
  const myCorrectGuess = round?.guesses.find((g) => g.profileId === s.me.profileId && g.correct);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="play-panel p-3 flex items-center justify-between shadow-panel">
        <div>
          <p className="font-display font-bold text-base">
            {isDrawer ? "🎨 You're Drawing!" : `🖌️ ${round?.drawerName} is Drawing`}
          </p>
          <p className="text-xs text-muted-foreground">
            Round {dr.roundNumber}/{dr.totalRounds}
          </p>
        </div>
        <div className={`flex items-center gap-1.5 rounded-xl px-3 py-2 font-display font-bold text-lg ${timeIsLow ? "bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 animate-pulse" : "bg-secondary text-foreground"}`}>
          <Clock className="size-4" />
          {timeLeft}s
        </div>
      </div>

      {/* Announcement banner when someone guesses correctly */}
      {round?.latestCorrectGuesser && (
        <div className="rounded-2xl p-3.5 bg-gradient-to-r from-amber-500/15 via-primary/15 to-emerald-500/15 border-2 border-primary/40 flex items-center gap-3 animate-pulse shadow-sm">
          <span className="text-2xl shrink-0">⚡</span>
          <div className="flex-1 min-w-0">
            <p className="font-display font-black text-sm text-foreground truncate">
              <span className="text-primary">{round.latestCorrectGuesser.displayName}</span> just guessed correctly!
            </p>
            <p className="text-xs font-semibold text-muted-foreground">
              A random letter has been revealed below! Guess fast to win!
            </p>
          </div>
          <span className="shrink-0 text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-xl bg-primary text-primary-foreground shadow-sm">
            Hurry!
          </span>
        </div>
      )}

      {/* Word reveal for drawer */}
      {isDrawer && round?.word && (
        <div className="play-panel p-3.5 text-center bg-primary/5 border-2 border-primary/30 space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
            <Palette className="size-3.5 text-primary" />
            <span>You Are The Artist • Draw This Word:</span>
          </div>
          <p className="font-display font-black text-3xl text-primary uppercase tracking-widest">{round.word}</p>
          <p className="text-[11px] font-semibold text-muted-foreground">
            Watch the live guess feed below to see what everyone is guessing!
          </p>
        </div>
      )}

      {/* Word mask with revealed letters for guessers */}
      {!isDrawer && round?.word === null && round?.revealedWord === null && (
        <div className="play-panel p-3.5 text-center space-y-2 border-2 border-primary/20 bg-primary/5 shadow-sm">
          <div className="flex items-center justify-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider flex-wrap">
            <Eye className="size-4 text-primary" />
            <span>Guess The Word ({round.wordLength ?? (round.wordMask ? round.wordMask.split(" ").length : 5)} Letters)</span>
            {round.revealedIndices && round.revealedIndices.length > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-extrabold border border-amber-400/40 animate-pulse">
                ✨ {round.revealedIndices.length} {round.revealedIndices.length === 1 ? "letter" : "letters"} revealed!
              </span>
            )}
          </div>
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap py-1">
            {round.wordMask
              ? round.wordMask.split(" ").map((char, idx) => {
                  if (char === "") return <span key={idx} className="w-2" />;
                  const isRevealed = char !== "_";
                  return (
                    <div
                      key={idx}
                      className={`size-9 sm:size-10 rounded-xl flex items-center justify-center font-display font-black text-lg transition-all ${
                        isRevealed
                          ? "bg-amber-400 text-stone-900 border-2 border-amber-500 shadow-md scale-105"
                          : "bg-background border-2 border-border/80 text-muted-foreground"
                      }`}
                    >
                      {isRevealed ? char : "•"}
                    </div>
                  );
                })
              : (
                <span className="font-mono font-bold text-foreground tracking-widest text-lg">
                  _ _ _ _ _
                </span>
              )}
          </div>
          <p className="text-[11px] font-semibold text-muted-foreground">
            Correct guesses unlock random letters for everyone!
          </p>
        </div>
      )}

      {/* Canvas */}
      <div className="play-panel p-2 shadow-panel">
        <canvas
          ref={canvasRef}
          width={600}
          height={400}
          className={`w-full rounded-xl border-2 ${isDrawer ? "border-primary/30 cursor-crosshair touch-none" : "border-border"}`}
          style={{ background: "#fff", aspectRatio: "3/2" }}
          onPointerDown={isDrawer ? onPointerDown : undefined}
          onPointerMove={isDrawer ? onPointerMove : undefined}
          onPointerUp={isDrawer ? onPointerUp : undefined}
          onPointerLeave={isDrawer ? onPointerUp : undefined}
        />

        {/* Drawing tools */}
        {isDrawer && (
          <div className="mt-3 space-y-2">
            {/* Colors */}
            <div className="flex gap-1.5 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => { setColor(c); setTool("pen"); }}
                  style={{ backgroundColor: c }}
                  className={`size-8 rounded-xl border-2 transition-all ${color === c && tool === "pen" ? "border-foreground scale-110 shadow-md" : "border-border"}`}
                  aria-label={c}
                />
              ))}
            </div>
            {/* Sizes + Eraser + Clear */}
            <div className="flex gap-2 items-center">
              {SIZES.map((sz) => (
                <button
                  key={sz}
                  onClick={() => { setSize(sz); setTool("pen"); }}
                  className={`grid place-items-center size-9 rounded-xl border-2 transition-all ${size === sz && tool === "pen" ? "border-primary bg-primary/10" : "border-border bg-card"}`}
                >
                  <span
                    className="rounded-full bg-foreground"
                    style={{ width: Math.max(4, sz / 1.5), height: Math.max(4, sz / 1.5) }}
                  />
                </button>
              ))}
              <button
                onClick={() => setTool("eraser")}
                className={`flex items-center gap-1 rounded-xl border-2 px-3 py-2 text-sm font-bold transition-all ${tool === "eraser" ? "border-primary bg-primary/10" : "border-border bg-card"}`}
              >
                <Eraser className="size-4" /> Eraser
              </button>
              <button
                onClick={handleClear}
                className="flex items-center gap-1 rounded-xl border-2 border-rose-400 bg-rose-50 dark:bg-rose-950/30 px-3 py-2 text-sm font-bold text-rose-600 dark:text-rose-400"
              >
                <Trash2 className="size-4" /> Clear
              </button>
              <div className="flex items-center gap-1 rounded-xl border-2 border-border bg-card px-3 py-2">
                <Pencil className="size-4 text-muted-foreground" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Live Guesses Stream (Visible to Artist & all players) */}
      <div className="play-panel p-3.5 space-y-2.5 shadow-panel">
        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="size-4 text-primary" />
            <p className="font-display font-bold text-sm">
              {isDrawer ? "👀 Live Guess Stream (Watch Guesses Roll In)" : "💬 Live Guesses Feed"}
            </p>
          </div>
          <span className="text-xs font-semibold text-muted-foreground">
            {round?.guesses?.length ?? 0} {round?.guesses?.length === 1 ? "guess" : "guesses"}
          </span>
        </div>

        {round?.guesses && round.guesses.length > 0 ? (
          <div className="flex flex-col-reverse gap-1.5 max-h-48 overflow-y-auto pr-1">
            {round.guesses.slice(-10).reverse().map((g, idx) => (
              <div
                key={`${g.profileId}-${g.submittedAt}-${idx}`}
                className={`flex items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-sm transition-all ${
                  g.correct
                    ? "bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-400 text-emerald-800 dark:text-emerald-200 shadow-sm"
                    : "bg-secondary/40 border border-border/50 text-foreground"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold text-xs truncate max-w-[120px] text-muted-foreground">
                    {g.displayName}:
                  </span>
                  <span className="font-semibold text-sm truncate">
                    {g.guess}
                  </span>
                </div>
                {g.correct ? (
                  <span className="shrink-0 text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    🎉 Correct!
                  </span>
                ) : (
                  <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
                    💭 Guessed
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-xs font-semibold text-muted-foreground py-2.5">
            {isDrawer
              ? "No guesses yet — watch here as players type guesses in real time!"
              : "No guesses yet — be the first to type a guess!"}
          </p>
        )}
      </div>

      {/* Guess input (non-drawers) */}
      {!isDrawer && !myCorrectGuess && (
        <div className="play-panel p-4 space-y-2">
          {guessFeedback && (
            <div className={`rounded-xl p-2.5 text-sm font-bold ${guessFeedback.ok ? "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300" : "bg-rose-100 dark:bg-rose-950/40 text-rose-600"}`}>
              {guessFeedback.msg}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={guessInput}
              onChange={(e) => setGuessInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGuess()}
              placeholder="Type your guess…"
              className="flex-1 rounded-xl border-2 border-border bg-background px-3 py-3 text-sm font-semibold focus:border-primary focus:outline-none"
              autoComplete="off"
            />
            <Button onClick={handleGuess} className="rounded-xl px-5 min-h-[48px]" disabled={!guessInput.trim()}>
              <Send className="size-5" />
            </Button>
          </div>
        </div>
      )}

      {/* Already guessed correctly */}
      {!isDrawer && myCorrectGuess && (
        <div className="play-panel p-4 flex items-center gap-3 bg-green-50 dark:bg-green-950/30 border-2 border-green-400">
          <span className="text-2xl">🎉</span>
          <div>
            <p className="font-bold text-green-700 dark:text-green-400">You guessed correctly!</p>
            <p className="text-xs text-muted-foreground">Wait for others to guess or time to run out…</p>
          </div>
        </div>
      )}

      {/* Correct guessers list */}
      {round && round.winnerIds.length > 0 && (
        <div className="play-panel p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="size-4 text-amber-500" />
              <p className="font-display font-bold text-sm">Correct Guessers This Round</p>
            </div>
            <span className="text-xs font-bold text-primary">
              +{round.winnerIds.length} {round.winnerIds.length === 1 ? "point" : "points"} to {round.drawerName}
            </span>
          </div>
          {round.winnerIds.map((pid, i) => {
            const p = s.players.find((pl) => pl.profileId === pid);
            if (!p) return null;
            return (
              <div key={pid} className="flex items-center gap-2 text-sm">
                <span>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "✅"}</span>
                <PlayerAvatar id={p.avatarId} size={26} />
                <span className="font-semibold flex-1">{p.displayName}</span>
                <span className="text-teal-600 dark:text-teal-400 font-bold text-xs flex items-center gap-1">
                  <Check className="size-3" /> Guessed
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
