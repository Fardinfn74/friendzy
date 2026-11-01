import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Eraser,
  Pencil,
  Trash2,
  Undo2,
  SkipForward,
  Send,
  Trophy,
  Eye,
  Clock,
  Palette,
  Sparkles,
  Check,
  MessageSquare,
  Flame,
  Infinity as InfinityIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/player-avatar";
import { supabase } from "@/integrations/supabase/client";
import type { GameState } from "@/lib/game-types";
import type { DrawStroke } from "./types";
import {
  submitDoodleGuessFn,
  pushDoodleCanvasFn,
  getDoodleCanvasFn,
  endDoodleRoundFn,
  advanceDoodleRoundFn,
} from "@/lib/game.functions";
import { useServerFn } from "@tanstack/react-start";

interface DoodleRushGameProps {
  s: GameState;
  token: string;
  refresh: () => void;
  runAction: (fn: () => Promise<unknown>, after?: () => void) => Promise<void>;
}

const COLORS = [
  "#1a1a1a",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
  "#ffffff",
];
const SIZES = [4, 8, 14, 22];
const MAX_STROKES = 390; // the server accepts 400
const MAX_POINTS = 1400; // per stroke; the server accepts 1500

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
function paintStroke(ctx: CanvasRenderingContext2D, stroke: DrawStroke, w: number, h: number) {
  if (stroke.x.length < 1) return;
  ctx.beginPath();
  ctx.strokeStyle = stroke.tool === "eraser" ? "#ffffff" : stroke.color;
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = stroke.size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (stroke.x.length === 1) {
    // a single tap leaves a dot
    ctx.arc(stroke.x[0]! * w, stroke.y[0]! * h, stroke.size / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.moveTo(stroke.x[0]! * w, stroke.y[0]! * h);
  for (let i = 1; i < stroke.x.length; i++) ctx.lineTo(stroke.x[i]! * w, stroke.y[i]! * h);
  ctx.stroke();
}

function renderStrokes(ctx: CanvasRenderingContext2D, strokes: DrawStroke[], w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  for (const stroke of strokes) paintStroke(ctx, stroke, w, h);
}

/** Messages sent to the other players while the artist draws (live, no database involved). */
type LiveMessage =
  | { k: "seg"; r: number; i: number; c: string; s: number; t: "pen" | "eraser"; p: number[] }
  | { k: "end"; r: number; i: number; stroke: DrawStroke }
  | { k: "clear"; r: number }
  | { k: "undo"; r: number };

const round3 = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 1000) / 1000;

export function DoodleRushGame({ s, token, refresh, runAction }: DoodleRushGameProps) {
  const dr = s.doodleRush;
  const submitGuess = useServerFn(submitDoodleGuessFn);
  const pushCanvas = useServerFn(pushDoodleCanvasFn);
  const getCanvas = useServerFn(getDoodleCanvasFn);
  const endRound = useServerFn(endDoodleRoundFn);
  const advanceRound = useServerFn(advanceDoodleRoundFn);

  const roundNumber = dr?.currentRound?.roundNumber ?? 0;
  const canvasSeq = dr?.currentRound?.canvasSeq ?? 0;
  const isDrawerNow = Boolean(dr?.isDrawer);
  const phase = dr?.phase;

  // Drawing tools
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState(COLORS[0]!);
  const [size, setSize] = useState(SIZES[1]!);

  // The picture lives here, not in the game state: finished strokes + the one being drawn right now.
  const strokesRef = useRef<DrawStroke[]>([]);
  const liveRef = useRef<DrawStroke | null>(null);
  const isDrawingRef = useRef(false);
  const appliedSeqRef = useRef(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pendingPoints = useRef<number[]>([]);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef(false);
  const saveAgain = useRef(false);
  const warnedSave = useRef(false);

  // Guess state
  const [guessInput, setGuessInput] = useState("");
  const [guessFeedback, setGuessFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [nextLeft, setNextLeft] = useState(0);

  const countdownLeft = useCountdown(dr?.countdownEndsAt ?? null);
  const timeLeft = useCountdown(dr?.currentRound?.endsAt ?? null);
  const hasTimeLimit = Boolean(dr?.currentRound?.endsAt);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const all = liveRef.current ? [...strokesRef.current, liveRef.current] : strokesRef.current;
    renderStrokes(ctx, all, canvas.width, canvas.height);
  }, []);

  // Whenever the visible canvas changes (new phase / round), paint what we have.
  useEffect(() => {
    redraw();
  }, [phase, roundNumber, redraw]);

  // New drawing: start from a blank board.
  useEffect(() => {
    strokesRef.current = [];
    liveRef.current = null;
    appliedSeqRef.current = 0;
    pendingPoints.current = [];
    redraw();
  }, [roundNumber, redraw]);

  // ── live channel (drawing appears on every screen as it happens) ────────────
  useEffect(() => {
    if (!s.code) return;
    const channel = supabase.channel(`doodle:${s.code.trim().toUpperCase()}`, {
      config: { broadcast: { self: false } },
    });
    channel
      .on("broadcast", { event: "d" }, ({ payload }) => {
        const m = payload as LiveMessage;
        if (isDrawerNow || !m || m.r !== roundNumber) return;
        if (m.k === "seg") {
          let live = liveRef.current;
          if (!live || strokesRef.current.length !== m.i) {
            live = { x: [], y: [], color: m.c, size: m.s, tool: m.t };
            liveRef.current = live;
          }
          for (let i = 0; i + 1 < m.p.length; i += 2) {
            live.x.push(m.p[i]!);
            live.y.push(m.p[i + 1]!);
          }
        } else if (m.k === "end") {
          strokesRef.current = [...strokesRef.current.slice(0, m.i), m.stroke];
          liveRef.current = null;
        } else if (m.k === "clear") {
          strokesRef.current = [];
          liveRef.current = null;
        } else if (m.k === "undo") {
          strokesRef.current = strokesRef.current.slice(0, -1);
        }
        redraw();
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [s.code, roundNumber, isDrawerNow, redraw]);

  const broadcast = useCallback((m: LiveMessage) => {
    void channelRef.current?.send({ type: "broadcast", event: "d", payload: m });
  }, []);

  // ── saving the picture (so late joiners, refreshes and bad connections still see it) ──
  const saveCanvas = useCallback(async () => {
    if (saving.current) {
      saveAgain.current = true;
      return;
    }
    saving.current = true;
    try {
      const res = await pushCanvas({
        data: { sessionToken: token, code: s.code, strokes: strokesRef.current },
      });
      if (res && "error" in res && !warnedSave.current) {
        warnedSave.current = true;
        toast.error(res.error);
      }
    } catch {
      /* the next change will retry */
    } finally {
      saving.current = false;
      if (saveAgain.current) {
        saveAgain.current = false;
        void saveCanvas();
      }
    }
  }, [pushCanvas, token, s.code]);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void saveCanvas(), 700);
  }, [saveCanvas]);

  // Guessers (and an artist who reloaded the page) fetch the saved picture when it is newer than theirs.
  useEffect(() => {
    if (!dr || (phase !== "drawing" && phase !== "round_end")) return;
    if (canvasSeq <= appliedSeqRef.current) return;
    if (isDrawerNow && strokesRef.current.length > 0) return; // the artist's own screen is the source of truth
    let cancelled = false;
    void (async () => {
      const res = await getCanvas({ data: { sessionToken: token, code: s.code } });
      if (cancelled || !res || !("strokes" in res) || res.roundNumber !== roundNumber) return;
      if (isDrawingRef.current || liveRef.current) return; // never interrupt a stroke being drawn
      strokesRef.current = res.strokes;
      appliedSeqRef.current = res.seq;
      redraw();
    })();
    return () => {
      cancelled = true;
    };
  }, [dr, phase, canvasSeq, isDrawerNow, roundNumber, getCanvas, token, s.code, redraw]);

  // Seconds until the next drawing starts by itself.
  const nextAt = dr?.nextAt ?? null;
  useEffect(() => {
    if (!nextAt) return;
    const tick = () =>
      setNextLeft(Math.max(0, Math.ceil((Date.parse(nextAt) - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [nextAt]);

  const lastAnnouncedGuesserRef = useRef<string | null>(null);

  // Announce correct guess on every player's screen to encourage fast guessing
  useEffect(() => {
    const latest = dr?.currentRound?.latestCorrectGuesser;
    if (!latest || !latest.submittedAt) return;
    if (latest.submittedAt !== lastAnnouncedGuesserRef.current) {
      lastAnnouncedGuesserRef.current = latest.submittedAt;
      toast.success(
        `🎉 ${latest.displayName} guessed correctly! A hint letter was revealed! Fast guessing earns higher ranks!`,
        {
          duration: 4500,
        },
      );
    }
  }, [dr?.currentRound?.latestCorrectGuesser]);

  useEffect(() => {
    lastAnnouncedGuesserRef.current = null;
  }, [roundNumber]);

  useEffect(
    () => () => {
      if (flushTimer.current) clearTimeout(flushTimer.current);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    },
    [],
  );

  // ── Drawing handlers (artist) ───────────────────────────────────────────────
  const getPos = useCallback((e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: round3((e.clientX - rect.left) / rect.width),
      y: round3((e.clientY - rect.top) / rect.height),
    };
  }, []);

  const flushPoints = useCallback(() => {
    flushTimer.current = null;
    const live = liveRef.current;
    if (!live || pendingPoints.current.length === 0) return;
    broadcast({
      k: "seg",
      r: roundNumber,
      i: strokesRef.current.length,
      c: live.color,
      s: live.size,
      t: live.tool,
      p: pendingPoints.current,
    });
    pendingPoints.current = [];
  }, [broadcast, roundNumber]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!isDrawerNow || dr?.phase !== "drawing") return;
      if (strokesRef.current.length >= MAX_STROKES) {
        toast.error("The board is full. Clear it to keep drawing!");
        return;
      }
      e.currentTarget.setPointerCapture(e.pointerId);
      isDrawingRef.current = true;
      const { x, y } = getPos(e);
      liveRef.current = { x: [x], y: [y], color, size: tool === "eraser" ? size * 2 : size, tool };
      pendingPoints.current = [x, y];
      redraw();
      if (!flushTimer.current) flushTimer.current = setTimeout(flushPoints, 60);
    },
    [isDrawerNow, dr?.phase, getPos, color, size, tool, redraw, flushPoints],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      const live = liveRef.current;
      if (!isDrawingRef.current || !isDrawerNow || !live || live.x.length >= MAX_POINTS) return;
      const { x, y } = getPos(e);
      live.x.push(x);
      live.y.push(y);
      pendingPoints.current.push(x, y);
      // draw just the new piece of line (fast); everything else is already on the canvas
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx && live.x.length >= 2) {
        const n = live.x.length;
        ctx.beginPath();
        ctx.strokeStyle = live.tool === "eraser" ? "#ffffff" : live.color;
        ctx.lineWidth = live.size;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.moveTo(live.x[n - 2]! * canvas.width, live.y[n - 2]! * canvas.height);
        ctx.lineTo(x * canvas.width, y * canvas.height);
        ctx.stroke();
      }
      if (!flushTimer.current) flushTimer.current = setTimeout(flushPoints, 60);
    },
    [isDrawerNow, getPos, flushPoints],
  );

  const onPointerUp = useCallback(() => {
    if (!isDrawingRef.current || !isDrawerNow) return;
    isDrawingRef.current = false;
    const live = liveRef.current;
    liveRef.current = null;
    if (flushTimer.current) {
      clearTimeout(flushTimer.current);
      flushTimer.current = null;
    }
    if (!live) return;
    const index = strokesRef.current.length;
    strokesRef.current = [...strokesRef.current, live];
    pendingPoints.current = [];
    broadcast({ k: "end", r: roundNumber, i: index, stroke: live });
    scheduleSave();
    redraw();
  }, [isDrawerNow, broadcast, roundNumber, scheduleSave, redraw]);

  const handleUndo = useCallback(() => {
    if (strokesRef.current.length === 0) return;
    strokesRef.current = strokesRef.current.slice(0, -1);
    redraw();
    broadcast({ k: "undo", r: roundNumber });
    scheduleSave();
  }, [broadcast, roundNumber, scheduleSave, redraw]);

  const handleClear = useCallback(() => {
    strokesRef.current = [];
    liveRef.current = null;
    redraw();
    broadcast({ k: "clear", r: roundNumber });
    scheduleSave();
  }, [broadcast, roundNumber, scheduleSave, redraw]);

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
    const res = (await submitGuess({ data: { sessionToken: token, code: s.code, guess: g } })) as
      { ok: boolean; correct?: boolean; close?: boolean; error?: string } | undefined;
    if (!res) return;
    if (res.error) showGuessFeedback(false, res.error);
    else if (res.correct) {
      showGuessFeedback(
        true,
        `🎉 Correct! You gave ${dr?.currentRound?.drawerName ?? "the artist"} +1 guess point!`,
      );
      refresh();
    } else if (res.close) showGuessFeedback(false, "🔥 So close! Check your spelling…");
    else showGuessFeedback(false, "Not quite — keep guessing!");
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
          <h2 className="font-display text-3xl font-extrabold text-foreground">
            The Great Artist Awards!
          </h2>
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
                🎨 <strong className="text-xl font-display text-primary">{winnerScore}</strong>{" "}
                {winnerScore === 1 ? "player" : "players"} correctly guessed their drawings!
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
                    <p className="text-xs text-muted-foreground font-semibold">{serialTitle}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-display font-black text-xl text-primary">{score}</span>
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
        <p className="font-display text-2xl font-bold">{round?.drawerName} is drawing!</p>
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
              The secret word was:{" "}
              <span className="font-display font-bold text-xl text-primary uppercase">
                {round.revealedWord}
              </span>
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
              +{correctCount} {correctCount === 1 ? "guess point" : "guess points"} towards Great
              Artist!
            </p>
          </div>

          <p className="text-xs font-semibold text-muted-foreground mt-1">
            {nextLeft > 0 ? `Next drawing in ${nextLeft}s…` : "Next drawing starting…"}
          </p>
          {s.me.isHost && (
            <Button
              size="sm"
              variant="outline"
              className="mt-1 rounded-xl"
              onClick={() =>
                runAction(
                  () => advanceRound({ data: { sessionToken: token, code: s.code } }),
                  refresh,
                )
              }
            >
              <SkipForward className="size-4 mr-1" /> Skip the wait
            </Button>
          )}
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
                      {i === 0
                        ? "1st to Guess"
                        : i === 1
                          ? "2nd to Guess"
                          : i === 2
                            ? "3rd to Guess"
                            : `${i + 1}th to Guess`}
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
          <canvas
            ref={canvasRef}
            width={600}
            height={400}
            className="w-full rounded-xl border border-border"
            style={{ background: "#fff" }}
          />
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
                <span className="w-6 text-center font-bold text-sm">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}
                </span>
                <PlayerAvatar id={p.avatarId} size={28} />
                <span className="flex-1 font-semibold text-sm">{p.displayName}</span>
                <span className="font-display font-bold text-primary text-sm">
                  {score} {score === 1 ? "guess" : "guesses"}
                </span>
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
        <div
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 font-display font-bold text-lg ${timeIsLow ? "bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 animate-pulse" : "bg-secondary text-foreground"}`}
        >
          {hasTimeLimit ? <Clock className="size-4" /> : <InfinityIcon className="size-4" />}
          {hasTimeLimit ? `${timeLeft}s` : "No limit"}
        </div>
      </div>

      {/* Announcement banner when someone guesses correctly */}
      {round?.latestCorrectGuesser && (
        <div className="rounded-2xl p-3.5 bg-gradient-to-r from-amber-500/15 via-primary/15 to-emerald-500/15 border-2 border-primary/40 flex items-center gap-3 animate-pulse shadow-sm">
          <span className="text-2xl shrink-0">⚡</span>
          <div className="flex-1 min-w-0">
            <p className="font-display font-black text-sm text-foreground truncate">
              <span className="text-primary">{round.latestCorrectGuesser.displayName}</span> just
              guessed correctly!
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
          <p className="font-display font-black text-3xl text-primary uppercase tracking-widest">
            {round.word}
          </p>
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
            <span>
              Guess The Word (
              {round.wordLength ?? (round.wordMask ? round.wordMask.split(" ").length : 5)} Letters)
            </span>
            {round.revealedIndices && round.revealedIndices.length > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-extrabold border border-amber-400/40 animate-pulse">
                ✨ {round.revealedIndices.length}{" "}
                {round.revealedIndices.length === 1 ? "letter" : "letters"} revealed!
              </span>
            )}
          </div>
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap py-1">
            {round.wordMask ? (
              round.wordMask.split(" ").map((char, idx) => {
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
            ) : (
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
                  onClick={() => {
                    setColor(c);
                    setTool("pen");
                  }}
                  style={{ backgroundColor: c }}
                  className={`size-8 rounded-xl border-2 transition-all ${color === c && tool === "pen" ? "border-foreground scale-110 shadow-md" : "border-border"}`}
                  aria-label={c}
                />
              ))}
            </div>
            {/* Sizes + Eraser + Undo + Clear (wraps on narrow phones) */}
            <div className="flex flex-wrap gap-2 items-center">
              {SIZES.map((sz) => (
                <button
                  key={sz}
                  onClick={() => {
                    setSize(sz);
                    setTool("pen");
                  }}
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
                onClick={handleUndo}
                aria-label="Undo last stroke"
                className="flex items-center gap-1 rounded-xl border-2 border-border bg-card px-3 py-2 text-sm font-bold transition-all hover:bg-secondary"
              >
                <Undo2 className="size-4" /> Undo
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
            <button
              onClick={() =>
                runAction(() => endRound({ data: { sessionToken: token, code: s.code } }), refresh)
              }
              className="w-full flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border px-3 py-2 text-xs font-bold text-muted-foreground transition-all hover:bg-secondary"
            >
              <SkipForward className="size-3.5" /> Nobody can get it? Give up and reveal the word
            </button>
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
            {round.guesses
              .slice(-10)
              .reverse()
              .map((g, idx) => (
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
                      {g.correct ? "guessed the word!" : g.guess}
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
            <div
              className={`rounded-xl p-2.5 text-sm font-bold ${guessFeedback.ok ? "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300" : "bg-rose-100 dark:bg-rose-950/40 text-rose-600"}`}
            >
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
            <Button
              onClick={handleGuess}
              className="rounded-xl px-5 min-h-[48px]"
              disabled={!guessInput.trim()}
            >
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
            <p className="text-xs text-muted-foreground">Wait for the others to guess…</p>
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
              +{round.winnerIds.length} {round.winnerIds.length === 1 ? "point" : "points"} to{" "}
              {round.drawerName}
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
