import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Trophy, Clock, Zap, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/player-avatar";
import type { GameState } from "@/lib/game-types";
import { submitLetterBlitzGuessFn, advanceLetterBlitzRoundFn } from "@/lib/game.functions";
import { useServerFn } from "@tanstack/react-start";

interface LetterBlitzGameProps {
  s: GameState;
  token: string;
  refresh: () => void;
  runAction: (fn: () => Promise<unknown>, after?: () => void) => Promise<void>;
}

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

export function LetterBlitzGame({ s, token, refresh, runAction }: LetterBlitzGameProps) {
  const lb = s.letterBlitz;
  const submitGuess = useServerFn(submitLetterBlitzGuessFn);
  const advanceRound = useServerFn(advanceLetterBlitzRoundFn);

  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const timeLeft = useCountdown(lb?.currentRound?.endsAt ?? null);
  const countdownLeft = useCountdown(lb?.countdownEndsAt ?? null);

  // Auto-advance when countdown finishes
  useEffect(() => {
    if (lb?.phase === "countdown" && countdownLeft === 0) {
      const t = setTimeout(refresh, 500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [lb?.phase, countdownLeft, refresh]);

  // Auto-advance when round timer hits 0
  useEffect(() => {
    if (lb?.phase === "round_active" && timeLeft === 0) {
      const t = setTimeout(refresh, 800);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [lb?.phase, timeLeft, refresh]);

  // Host auto-advances round_end → next round
  useEffect(() => {
    if (lb?.phase === "round_end" && s.me.isHost) {
      const t = setTimeout(() => {
        runAction(() =>
          advanceRound({ data: { sessionToken: token, code: s.code } })
        , refresh);
      }, 2500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [lb?.phase, s.me.isHost, token, s.code, advanceRound, runAction, refresh]);

  function showFeedback(ok: boolean, msg: string) {
    setFeedback({ ok, msg });
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 2000);
  }

  const handleSubmit = useCallback(async () => {
    const word = input.trim();
    if (!word || lb?.phase !== "round_active") return;
    setInput("");

    const res = await submitGuess({ data: { sessionToken: token, code: s.code, word } });
    if (res && "error" in res) {
      showFeedback(false, res.error as string);
    } else if (res && "rank" in res) {
      const rank = (res as { rank: number | null }).rank;
      const pts = rank === 1 ? 3 : rank === 2 ? 2 : 1;
      showFeedback(true, rank === 1 ? `🥇 First! +${pts}pts` : rank === 2 ? `🥈 Second! +${pts}pt` : `✅ Accepted! +${pts}pt`);
      refresh();
    }
  }, [input, lb?.phase, submitGuess, token, s.code, refresh]);

  if (!lb) {
    return (
      <div className="play-panel p-8 text-center">
        <p className="font-bold text-muted-foreground">Loading Letter Blitz…</p>
      </div>
    );
  }

  // ── Game Over ─────────────────────────────────────────────────────────────
  if (lb.phase === "game_over") {
    const sorted = Object.entries(lb.scores).sort((a, b) => b[1] - a[1]);
    const winner = s.players.find((p) => p.profileId === sorted[0]?.[0]);
    return (
      <div className="space-y-5">
        <div className="play-panel p-6 text-center space-y-4">
          <div className="text-6xl">🏆</div>
          <h2 className="font-display text-3xl font-bold">Game Over!</h2>
          {winner && (
            <p className="font-semibold text-lg">
              <span className="text-primary">{winner.displayName}</span> wins!
            </p>
          )}
        </div>
        <div className="play-panel p-4 space-y-3">
          <h3 className="font-display font-bold text-sm text-muted-foreground uppercase tracking-wider">Final Scores</h3>
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

  // ── Round End ─────────────────────────────────────────────────────────────
  if (lb.phase === "round_end") {
    const round = lb.currentRound;
    return (
      <div className="space-y-5 animate-rise">
        <div className="play-panel p-5 text-center space-y-2">
          <p className="font-display font-bold text-2xl">Round {round?.roundNumber} Done!</p>
          <p className="text-muted-foreground text-sm">Letters were: <span className="font-bold text-primary text-lg">{round?.letters.join(" · ")}</span></p>
          {s.me.isHost && <p className="text-xs text-muted-foreground">Next round starting…</p>}
        </div>
        {round && round.guesses.length > 0 && (
          <div className="play-panel p-4 space-y-2">
            <p className="font-display font-bold text-sm">This Round</p>
            {round.guesses.filter((g) => g.accepted).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)).map((g) => (
              <div key={g.profileId + g.word} className="flex items-center gap-2 text-sm">
                <span className="font-bold w-6 text-center">{g.rank === 1 ? "🥇" : g.rank === 2 ? "🥈" : "🥉"}</span>
                <span className="font-semibold">{g.displayName}</span>
                <span className="text-muted-foreground">·</span>
                <span className="font-mono font-bold text-primary">{g.word}</span>
              </div>
            ))}
          </div>
        )}
        <div className="play-panel p-4 space-y-2">
          <p className="font-display font-bold text-sm">Leaderboard</p>
          {Object.entries(lb.scores).sort((a, b) => b[1] - a[1]).map(([pid, score], i) => {
            const p = s.players.find((pl) => pl.profileId === pid);
            if (!p) return null;
            return (
              <div key={pid} className="flex items-center gap-2 text-sm">
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

  // ── Countdown ─────────────────────────────────────────────────────────────
  if (lb.phase === "countdown") {
    return (
      <div className="play-panel p-10 text-center space-y-4">
        <p className="font-display text-2xl font-bold">Get Ready!</p>
        <p className="font-display text-8xl font-bold text-primary">{countdownLeft}</p>
        <p className="text-muted-foreground font-semibold">Round {lb.roundNumber} of {lb.totalRounds} starting…</p>
      </div>
    );
  }

  // ── Round Active ──────────────────────────────────────────────────────────
  const round = lb.currentRound;
  const [l1, l2] = round?.letters ?? ["?", "?"];
  const myGuess = round?.guesses.find((g) => g.profileId === s.me.profileId && g.accepted);
  const acceptedGuesses = (round?.guesses ?? []).filter((g) => g.accepted).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  const timeIsLow = timeLeft <= 10;

  return (
    <div className="space-y-4">
      {/* Round header */}
      <div className="play-panel p-4 flex items-center justify-between shadow-panel">
        <div>
          <p className="font-display font-bold text-lg">
            Round {lb.roundNumber}/{lb.totalRounds}
          </p>
          <p className="text-xs text-muted-foreground font-semibold">Start with one letter &amp; end with the other</p>
        </div>
        <div className={`flex items-center gap-1.5 rounded-xl px-3 py-2 font-display font-bold text-xl ${timeIsLow ? "bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 animate-pulse" : "bg-secondary text-foreground"}`}>
          <Clock className="size-4" />
          {timeLeft}s
        </div>
      </div>

      {/* Letter display */}
      <div className="play-panel p-6 text-center space-y-3 shadow-panel">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Start &amp; End Letters</p>
        <div className="flex items-center justify-center gap-4">
          {[l1, l2].map((letter, i) => (
            <div
              key={i}
              className="grid size-20 place-items-center rounded-3xl border-4 border-primary/40 bg-primary/10 shadow-panel"
            >
              <span className="font-display text-5xl font-black text-primary">{letter}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Must start with <strong>{l1}</strong> and end with <strong>{l2}</strong> (or vice-versa)
        </p>
      </div>

      {/* Input */}
      {!myGuess ? (
        <div className="play-panel p-4 space-y-3">
          {feedback && (
            <div className={`flex items-center gap-2 rounded-xl p-3 text-sm font-bold ${feedback.ok ? "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400" : "bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400"}`}>
              {feedback.ok ? <CheckCircle className="size-4" /> : <XCircle className="size-4" />}
              {feedback.msg}
            </div>
          )}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value.replace(/[^a-zA-Z]/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder={`${l1}…${l2} or ${l2}…${l1}`}
              className="flex-1 rounded-xl border-2 border-border bg-background px-3 py-3 text-base font-semibold uppercase focus:border-primary focus:outline-none"
              autoComplete="off"
              autoFocus
            />
            <Button onClick={handleSubmit} className="rounded-xl px-5 min-h-[48px]" disabled={!input.trim()}>
              <Send className="size-5" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="play-panel p-4 flex items-center gap-3 bg-green-50 dark:bg-green-950/30 border-2 border-green-400">
          <Zap className="size-5 text-green-600" />
          <div>
            <p className="font-bold text-green-700 dark:text-green-400">Submitted: <span className="font-mono text-lg">{myGuess.word}</span></p>
            <p className="text-xs text-muted-foreground">
              {myGuess.rank === 1 ? "🥇 1st! +3pts" : myGuess.rank === 2 ? "🥈 2nd! +2pts" : "✅ Accepted +1pt"}
            </p>
          </div>
        </div>
      )}

      {/* Live accepted guesses */}
      {acceptedGuesses.length > 0 && (
        <div className="play-panel p-4 space-y-2">
          <p className="font-display font-bold text-sm text-muted-foreground uppercase tracking-wider">Accepted So Far</p>
          {acceptedGuesses.map((g) => (
            <div key={g.profileId + g.word} className="flex items-center gap-2 text-sm">
              <span className="font-bold w-6 text-center text-base">
                {g.rank === 1 ? "🥇" : g.rank === 2 ? "🥈" : g.rank === 3 ? "🥉" : `${g.rank}.`}
              </span>
              <span className="font-semibold">{g.displayName}</span>
              <span className="text-muted-foreground">·</span>
              <span className="font-mono font-bold text-primary uppercase">{g.word}</span>
            </div>
          ))}
        </div>
      )}

      {/* Scores */}
      <div className="play-panel p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Trophy className="size-4 text-amber-500" />
          <p className="font-display font-bold text-sm">Scores</p>
        </div>
        {Object.entries(lb.scores).sort((a, b) => b[1] - a[1]).map(([pid, score]) => {
          const p = s.players.find((pl) => pl.profileId === pid);
          if (!p) return null;
          return (
            <div key={pid} className="flex items-center gap-2 text-sm">
              <PlayerAvatar id={p.avatarId} size={26} />
              <span className={`flex-1 font-semibold ${pid === s.me.profileId ? "text-primary" : ""}`}>{p.displayName}</span>
              <span className="font-display font-bold">{score}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
