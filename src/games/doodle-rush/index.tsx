import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Eraser, Pencil, Trash2, Send, Trophy, Eye, Clock } from "lucide-react";
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
  }, [dr?.phase, countdownLeft, refresh]);

  // Auto-advance time limit hit
  useEffect(() => {
    if (dr?.phase === "drawing" && timeLeft === 0) {
      const t = setTimeout(refresh, 800);
      return () => clearTimeout(t);
    }
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
  }, [dr?.phase, s.me.isHost, token, s.code, advanceRound, runAction, refresh]);

  // Clear local strokes when a new round starts
  useEffect(() => {
    localStrokes.current = [];
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
        showGuessFeedback(true, "🎉 Correct! +points");
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
    const sorted = Object.entries(dr.scores).sort((a, b) => b[1] - a[1]);
    const winner = s.players.find((p) => p.profileId === sorted[0]?.[0]);
    return (
      <div className="space-y-5">
        <div className="play-panel p-6 text-center space-y-4">
          <div className="text-6xl">🎨</div>
          <h2 className="font-display text-3xl font-bold">Game Over!</h2>
          {winner && (
            <p className="font-semibold text-lg">
              🏆 <span className="text-primary">{winner.displayName}</span> wins!
            </p>
          )}
        </div>
        <div className="play-panel p-4 space-y-3">
          <h3 className="font-display font-bold text-sm">Final Scores</h3>
          {sorted.map(([pid, score], i) => {
            const p = s.players.find((pl) => pl.profileId === pid);
            if (!p) return null;
            return (
              <div key={pid} className={`flex items-center gap-3 rounded-xl p-3 ${i === 0 ? "bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300" : "bg-secondary/50"}`}>
                <span className="font-display font-bold text-lg w-7 text-center">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}
                </span>
                <PlayerAvatar id={p.avatarId} size={36} />
                <span className="flex-1 font-bold">{p.displayName}</span>
                <span className="font-display font-bold text-lg text-primary">{score}pt</span>
              </div>
            );
          })}
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
    return (
      <div className="space-y-5">
        <div className="play-panel p-5 text-center space-y-2">
          <div className="text-4xl">🖼️</div>
          <p className="font-display font-bold text-2xl">Round {round?.roundNumber} Over!</p>
          {round?.revealedWord && (
            <p className="text-muted-foreground text-base">
              The word was: <span className="font-display font-bold text-2xl text-primary">{round.revealedWord}</span>
            </p>
          )}
          {s.me.isHost && <p className="text-xs text-muted-foreground mt-1">Next round starting…</p>}
        </div>

        {/* Show the last canvas */}
        <div className="play-panel p-3">
          <canvas ref={canvasRef} width={600} height={400} className="w-full rounded-xl border border-border" style={{ background: "#fff" }} />
        </div>

        <div className="play-panel p-4 space-y-2">
          <p className="font-display font-bold text-sm">Scores</p>
          {Object.entries(dr.scores).sort((a, b) => b[1] - a[1]).map(([pid, score], i) => {
            const p = s.players.find((pl) => pl.profileId === pid);
            if (!p) return null;
            return (
              <div key={pid} className="flex items-center gap-2">
                <span className="w-5 text-center font-bold">{i + 1}.</span>
                <PlayerAvatar id={p.avatarId} size={28} />
                <span className="flex-1 font-semibold">{p.displayName}</span>
                <span className="font-display font-bold text-primary">{score}pt</span>
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

      {/* Word reveal for drawer */}
      {isDrawer && round?.word && (
        <div className="play-panel p-3 text-center bg-primary/5 border-2 border-primary/20">
          <p className="text-xs text-muted-foreground">Draw this word:</p>
          <p className="font-display font-bold text-2xl text-primary uppercase tracking-widest">{round.word}</p>
        </div>
      )}

      {/* Hint: word length for guessers */}
      {!isDrawer && round?.word === null && round?.revealedWord === null && (
        <div className="play-panel p-3 text-center">
          <Eye className="size-4 inline-block mr-1 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Word:{" "}
            <span className="font-mono font-bold text-foreground tracking-widest">
              {/* Show blanks for word length - we don't know length but encode it as _ */}
              {"_ _ _ _ _"}
            </span>
          </span>
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
          <div className="flex items-center gap-2">
            <Trophy className="size-4 text-amber-500" />
            <p className="font-display font-bold text-sm">Correct Guessers</p>
          </div>
          {round.winnerIds.map((pid, i) => {
            const p = s.players.find((pl) => pl.profileId === pid);
            if (!p) return null;
            return (
              <div key={pid} className="flex items-center gap-2 text-sm">
                <span>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "✅"}</span>
                <PlayerAvatar id={p.avatarId} size={26} />
                <span className="font-semibold">{p.displayName}</span>
                <span className="text-muted-foreground text-xs">+{i === 0 ? 4 : 2}pt</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
