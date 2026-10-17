import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Clock, Send, Sparkles, Trophy, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { avatarEmoji, type GameState, type PublicPlayer } from "@/lib/game-types";
import {
  advanceWordDuelRoundFn,
  rematchWordDuelFn,
  sendWordDuelLetterFn,
  submitWordDuelWordFn,
} from "@/lib/game.functions";
import { play } from "@/lib/sounds";

interface WordDuelGameProps {
  s: GameState;
  token: string;
  refresh: () => void;
  runAction: (fn: () => Promise<unknown>, after?: () => void) => Promise<void>;
}

export function WordDuelGame({ s, token, refresh, runAction }: WordDuelGameProps) {
  const wd = s.wordDuel;
  const nav = useNavigate();

  const sendLetter = useServerFn(sendWordDuelLetterFn);
  const submitWord = useServerFn(submitWordDuelWordFn);
  const advanceRound = useServerFn(advanceWordDuelRoundFn);
  const rematch = useServerFn(rematchWordDuelFn);

  // Audio & vibration tracking
  const prevPhase = useRef<string | null>(null);

  useEffect(() => {
    if (!wd) return;

    if (prevPhase.current !== wd.phase) {
      if (wd.phase === "countdown") {
        try {
          play("clue");
        } catch {
          /* ignore */
        }
      } else if (wd.phase === "word") {
        try {
          play("reveal");
          navigator.vibrate?.([150, 50, 150]);
        } catch {
          /* ignore */
        }
      } else if (wd.phase === "round_ended") {
        try {
          if (wd.roundWinnerId && wd.roundWinnerId !== "draw") {
            play("win");
          } else {
            play("turn");
          }
        } catch {
          /* ignore */
        }
      } else if (wd.phase === "match_ended") {
        try {
          play("win");
          navigator.vibrate?.([200, 100, 200, 100, 300]);
        } catch {
          /* ignore */
        }
      }
      prevPhase.current = wd.phase;
    }
  }, [wd?.phase, wd?.roundWinnerId]);

  if (!wd) {
    return (
      <div className="play-panel p-8 text-center space-y-3">
        <p className="text-3xl animate-bounce">⚔️</p>
        <h2 className="font-display text-2xl">Loading Word Duel…</h2>
      </div>
    );
  }

  // Active players
  const myPlayer = s.players.find((p) => p.profileId === s.me.profileId);
  const opponentPlayer = s.players.find((p) => p.profileId !== s.me.profileId);

  return (
    <div className="space-y-5 animate-rise pb-16">
      {/* Match Header Bar */}
      <header className="play-panel p-3 sm:p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚔️</span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Round {wd.currentRound} of {wd.maxRounds}
            </p>
            <p className="font-display text-sm sm:text-base font-bold text-foreground">
              First to {wd.targetWins} wins
            </p>
          </div>
        </div>

        {/* Score Pill */}
        <div className="flex items-center gap-2 bg-card border-2 border-border rounded-2xl px-3 py-1.5 shadow-xs font-display">
          <div className="flex items-center gap-1">
            <span className="text-lg">{avatarEmoji(myPlayer?.avatarId)}</span>
            <span className="font-black text-lg">{wd.scores[s.me.profileId] ?? 0}</span>
          </div>
          <span className="text-muted-foreground font-black text-sm">:</span>
          <div className="flex items-center gap-1">
            <span className="font-black text-lg">
              {opponentPlayer ? (wd.scores[opponentPlayer.profileId] ?? 0) : 0}
            </span>
            <span className="text-lg">{avatarEmoji(opponentPlayer?.avatarId)}</span>
          </div>
        </div>
      </header>

      {/* Game Phase Screens */}
      {wd.phase === "pick" && (
        <PickPhaseScreen
          myPick={wd.myPick}
          hasPicked={wd.hasPicked}
          opponentLocked={wd.opponentLocked}
          myPlayer={myPlayer}
          opponentPlayer={opponentPlayer}
          onSendLetter={(letter) =>
            runAction(
              () =>
                sendLetter({
                  data: { sessionToken: token, code: s.code, letter },
                }),
              refresh,
            )
          }
        />
      )}

      {wd.phase === "countdown" && (
        <CountdownScreen
          countdownEndsAt={wd.countdownEndsAt}
          revealedLetters={wd.revealedLetters}
          myPlayer={myPlayer}
          opponentPlayer={opponentPlayer}
        />
      )}

      {wd.phase === "word" && (
        <WordPhaseScreen
          revealedLetters={wd.revealedLetters}
          roundDeadline={wd.roundDeadline}
          roundTime={wd.roundTime}
          myPlayer={myPlayer}
          opponentPlayer={opponentPlayer}
          onSubmitWord={(word) =>
            submitWord({
              data: { sessionToken: token, code: s.code, word },
            })
          }
          refresh={refresh}
        />
      )}

      {wd.phase === "round_ended" && (
        <RoundEndedScreen
          currentRound={wd.currentRound}
          roundWinnerId={wd.roundWinnerId}
          winningWord={wd.winningWord}
          revealedLetters={wd.revealedLetters}
          myPlayer={myPlayer}
          opponentPlayer={opponentPlayer}
          onNextRound={() =>
            runAction(() => advanceRound({ data: { sessionToken: token, code: s.code } }), refresh)
          }
        />
      )}

      {wd.phase === "match_ended" && (
        <MatchEndedScreen
          matchWinnerId={wd.matchWinnerId}
          scores={wd.scores}
          history={wd.history}
          myPlayer={myPlayer}
          opponentPlayer={opponentPlayer}
          onRematch={() =>
            runAction(() => rematch({ data: { sessionToken: token, code: s.code } }), refresh)
          }
          onBackHome={() => nav({ to: "/" })}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------- 1. Pick Phase --- */

function PickPhaseScreen({
  myPick,
  hasPicked,
  opponentLocked,
  myPlayer,
  opponentPlayer,
  onSendLetter,
}: {
  myPick: string | null;
  hasPicked: boolean;
  opponentLocked: boolean;
  myPlayer?: PublicPlayer | undefined;
  opponentPlayer?: PublicPlayer | undefined;
  onSendLetter: (letter: string) => Promise<void>;
}) {
  const [selectedLetter, setSelectedLetter] = useState("");
  const [busy, setBusy] = useState(false);

  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  async function handleSend() {
    if (!selectedLetter || hasPicked || busy) return;
    setBusy(true);
    try {
      await onSendLetter(selectedLetter);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 animate-rise">
      {/* Pick Status Header */}
      <div className="grid grid-cols-2 gap-3">
        {/* Your Status Card */}
        <div className="play-panel p-3.5 text-center space-y-1">
          <div className="avatar-puck text-3xl mx-auto shadow-xs">
            {avatarEmoji(myPlayer?.avatarId)}
          </div>
          <p className="font-display text-sm font-bold truncate">
            {myPlayer?.displayName ?? "You"}
          </p>
          {hasPicked ? (
            <span className="tag-sticker text-teal-600 bg-teal-500/15 border-teal-500/40 text-xs py-0.5 px-2">
              Locked ✓
            </span>
          ) : (
            <span className="tag-sticker text-muted-foreground text-xs py-0.5 px-2">Choosing…</span>
          )}
        </div>

        {/* Opponent Status Card */}
        <div className="play-panel p-3.5 text-center space-y-1">
          <div className="avatar-puck text-3xl mx-auto shadow-xs">
            {avatarEmoji(opponentPlayer?.avatarId)}
          </div>
          <p className="font-display text-sm font-bold truncate">
            {opponentPlayer?.displayName ?? "Opponent"}
          </p>
          {opponentLocked ? (
            <span className="tag-sticker text-teal-600 bg-teal-500/15 border-teal-500/40 text-xs py-0.5 px-2">
              Locked ✓
            </span>
          ) : (
            <span className="tag-sticker text-muted-foreground text-xs py-0.5 px-2">Waiting…</span>
          )}
        </div>
      </div>

      {/* Main Pick Box */}
      <div className="play-panel p-6 text-center space-y-5 shadow-panel">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl font-black">
            {hasPicked ? "Letter Locked!" : "Secretly Pick ONE Letter"}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {hasPicked
              ? "Waiting for opponent to lock in their letter…"
              : "Your opponent won't see your letter until both are revealed."}
          </p>
        </div>

        {/* Big Letter Sticker Preview */}
        <div className="flex justify-center py-2">
          <div
            className={`size-28 sm:size-32 rounded-3xl border-4 border-border flex items-center justify-center font-display text-6xl font-black shadow-panel transition-all duration-200 transform ${
              hasPicked
                ? "bg-teal-400 text-ink rotate-[-3deg] scale-105"
                : selectedLetter
                  ? "bg-amber-400 text-ink rotate-[2deg] scale-105"
                  : "bg-card text-muted-foreground border-dashed"
            }`}
          >
            {hasPicked ? myPick : selectedLetter || "?"}
          </div>
        </div>

        {/* Letter Selector (Quick Keyboard Grid) */}
        {!hasPicked ? (
          <div className="space-y-4">
            <div className="grid grid-cols-7 sm:grid-cols-9 gap-1.5 sm:gap-2 max-w-sm mx-auto">
              {ALPHABET.map((letter) => {
                const isSelected = selectedLetter === letter;
                return (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => setSelectedLetter(letter)}
                    className={`size-9 sm:size-10 rounded-xl font-display text-base font-bold transition-all transform active:scale-90 ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-2 border-border shadow-xs scale-110 rotate-[-2deg]"
                        : "bg-surface hover:bg-secondary text-foreground border-2 border-border shadow-2xs"
                    }`}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>

            <Button
              size="lg"
              disabled={!selectedLetter || busy}
              onClick={handleSend}
              className="w-full min-h-[56px] text-xl font-display font-black bg-primary text-primary-foreground shadow-button rounded-2xl"
            >
              <Send className="size-5 mr-2" />
              Lock In Letter
            </Button>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-secondary/50 border-2 border-border text-center space-y-1">
            <p className="font-display text-lg font-bold">
              You picked: <span className="text-teal-600 font-black">{myPick}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {opponentLocked
                ? "Both players ready! Starting countdown…"
                : "Waiting for your opponent to pick a letter…"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------- 2. Countdown Phase --- */

function CountdownScreen({
  countdownEndsAt,
  revealedLetters,
  myPlayer,
  opponentPlayer,
}: {
  countdownEndsAt: number | null;
  revealedLetters: [string, string] | null;
  myPlayer?: PublicPlayer | undefined;
  opponentPlayer?: PublicPlayer | undefined;
}) {
  const [secondsLeft, setSecondsLeft] = useState(3);

  useEffect(() => {
    const update = () => {
      if (!countdownEndsAt) return;
      const rem = Math.max(1, Math.ceil((countdownEndsAt - Date.now()) / 1000));
      setSecondsLeft(rem);
    };
    update();
    const interval = setInterval(update, 200);
    return () => clearInterval(interval);
  }, [countdownEndsAt]);

  return (
    <div className="play-panel p-8 text-center space-y-6 shadow-panel animate-rise">
      <div className="space-y-1">
        <span className="tag-sticker text-primary text-xs uppercase tracking-wider">
          Letters Locked!
        </span>
        <h2 className="font-display text-3xl font-black">Get Ready!</h2>
        <p className="text-sm text-muted-foreground">Both letters reveal in…</p>
      </div>

      {/* Big Animated Countdown Sticker */}
      <div className="py-4">
        <div className="mx-auto size-32 rounded-3xl bg-amber-400 border-4 border-border flex items-center justify-center font-display text-7xl font-black text-ink shadow-panel animate-bounce transform rotate-[-4deg]">
          {secondsLeft}
        </div>
      </div>

      <div className="flex justify-center items-center gap-4 text-sm font-display font-bold text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="text-xl">{avatarEmoji(myPlayer?.avatarId)}</span>
          <span>{myPlayer?.displayName}</span>
        </div>
        <span className="text-primary font-black">VS</span>
        <div className="flex items-center gap-1.5">
          <span className="text-xl">{avatarEmoji(opponentPlayer?.avatarId)}</span>
          <span>{opponentPlayer?.displayName}</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- 3. Word Phase --- */

function WordPhaseScreen({
  revealedLetters,
  roundDeadline,
  roundTime,
  myPlayer,
  opponentPlayer,
  onSubmitWord,
  refresh,
}: {
  revealedLetters: [string, string] | null;
  roundDeadline: number | null;
  roundTime: number;
  myPlayer?: PublicPlayer | undefined;
  opponentPlayer?: PublicPlayer | undefined;
  onSubmitWord: (word: string) => Promise<{ ok: boolean; reason?: string; winningWord?: string }>;
  refresh: () => void;
}) {
  const [word, setWord] = useState("");
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [timeLeft, setTimeLeft] = useState(roundTime);

  const inputRef = useRef<HTMLInputElement>(null);

  const l1 = (revealedLetters?.[0] ?? "A").toUpperCase();
  const l2 = (revealedLetters?.[1] ?? "T").toUpperCase();
  const sameLetter = l1 === l2;

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Timer countdown
  useEffect(() => {
    const update = () => {
      if (!roundDeadline) return;
      const rem = Math.max(0, Math.ceil((roundDeadline - Date.now()) / 1000));
      setTimeLeft(rem);
      if (rem === 0) {
        refresh();
      }
    };
    update();
    const interval = setInterval(update, 250);
    return () => clearInterval(interval);
  }, [roundDeadline, refresh]);

  // Live validation helpers
  const cleanWord = word.trim().toUpperCase();
  const startsWithOk = sameLetter
    ? cleanWord.startsWith(l1)
    : cleanWord.startsWith(l1) || cleanWord.startsWith(l2);
  const endsWithOk = sameLetter
    ? cleanWord.endsWith(l1)
    : cleanWord.length > 1 &&
      ((cleanWord.startsWith(l1) && cleanWord.endsWith(l2)) ||
        (cleanWord.startsWith(l2) && cleanWord.endsWith(l1)));
  const lengthOk = cleanWord.length >= 3;

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!cleanWord || cooldown || busy) return;

    setErrorReason(null);
    setBusy(true);

    try {
      const res = await onSubmitWord(cleanWord);
      if (!res.ok) {
        setErrorReason(res.reason ?? "Invalid word");
        setCooldown(true);
        try {
          navigator.vibrate?.([100]);
        } catch {
          /* ignore */
        }
        // 1-second cooldown to prevent spam
        setTimeout(() => {
          setCooldown(false);
          inputRef.current?.focus();
        }, 1000);
      } else {
        refresh();
      }
    } catch (err) {
      setErrorReason(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setBusy(false);
    }
  }

  // Progress percentage for timer
  const timerPercent = Math.min(100, Math.max(0, (timeLeft / roundTime) * 100));

  return (
    <div className="space-y-4 animate-rise">
      {/* Timer Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="size-3.5" />
            Time Remaining
          </span>
          <span
            className={`font-display text-base font-black ${
              timeLeft <= 5 ? "text-destructive animate-pulse" : "text-foreground"
            }`}
          >
            {timeLeft}s
          </span>
        </div>
        <div className="h-3 w-full bg-secondary rounded-full overflow-hidden border-2 border-border p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              timeLeft > roundTime * 0.5
                ? "bg-teal-500"
                : timeLeft > roundTime * 0.2
                  ? "bg-amber-400"
                  : "bg-destructive animate-pulse"
            }`}
            style={{ width: `${timerPercent}%` }}
          />
        </div>
      </div>

      {/* Two Big Revealed Letter Tiles */}
      <div className="play-panel p-5 text-center shadow-panel space-y-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Revealed Letters
        </p>

        <div className="flex items-center justify-center gap-4 sm:gap-6">
          {/* Letter 1 */}
          <div className="text-center space-y-1.5">
            <div className="size-20 sm:size-24 rounded-3xl bg-amber-400 border-4 border-border flex items-center justify-center font-display text-4xl sm:text-5xl font-black text-ink shadow-panel transform rotate-[-4deg]">
              {l1}
            </div>
            <p className="text-xs font-bold text-muted-foreground flex items-center justify-center gap-1">
              <span>{avatarEmoji(myPlayer?.avatarId)}</span>
              <span className="truncate max-w-[80px]">{myPlayer?.displayName ?? "P1"}</span>
            </p>
          </div>

          <span className="font-display text-2xl font-black text-primary">&</span>

          {/* Letter 2 */}
          <div className="text-center space-y-1.5">
            <div className="size-20 sm:size-24 rounded-3xl bg-teal-400 border-4 border-border flex items-center justify-center font-display text-4xl sm:text-5xl font-black text-ink shadow-panel transform rotate-[4deg]">
              {l2}
            </div>
            <p className="text-xs font-bold text-muted-foreground flex items-center justify-center gap-1">
              <span>{avatarEmoji(opponentPlayer?.avatarId)}</span>
              <span className="truncate max-w-[80px]">{opponentPlayer?.displayName ?? "P2"}</span>
            </p>
          </div>
        </div>

        {/* Live Helper Rule Chips */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <span
            className={`tag-sticker text-xs py-1 px-2.5 transition-colors ${
              startsWithOk
                ? "bg-teal-500/20 text-teal-700 dark:text-teal-400 border-teal-500/40"
                : "text-muted-foreground"
            }`}
          >
            {sameLetter ? `Starts with ${l1}` : `Starts with ${l1} or ${l2}`} {startsWithOk && "✓"}
          </span>
          <span
            className={`tag-sticker text-xs py-1 px-2.5 transition-colors ${
              endsWithOk
                ? "bg-teal-500/20 text-teal-700 dark:text-teal-400 border-teal-500/40"
                : "text-muted-foreground"
            }`}
          >
            {sameLetter ? `Ends with ${l1}` : "Ends with the other"} {endsWithOk && "✓"}
          </span>
          <span
            className={`tag-sticker text-xs py-1 px-2.5 transition-colors ${
              lengthOk
                ? "bg-teal-500/20 text-teal-700 dark:text-teal-400 border-teal-500/40"
                : "text-muted-foreground"
            }`}
          >
            3+ letters {lengthOk && "✓"}
          </span>
        </div>
      </div>

      {/* Word Input & Submit */}
      <form onSubmit={handleSubmit} className="play-panel p-5 space-y-3 shadow-panel">
        <label
          htmlFor="duel-word-input"
          className="text-xs font-bold uppercase tracking-wider text-muted-foreground block"
        >
          Type your word (fastest valid word wins!)
        </label>
        <div className="relative">
          <Input
            id="duel-word-input"
            ref={inputRef}
            type="text"
            value={word}
            maxLength={30}
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
            autoCapitalize="characters"
            onChange={(e) => {
              setWord(e.target.value.replace(/[^a-zA-Z]/g, ""));
              if (errorReason) setErrorReason(null);
            }}
            placeholder={sameLetter ? `e.g. ${l1}...${l1}` : `e.g. ${l1}...${l2}`}
            disabled={cooldown || busy}
            className="min-h-[58px] text-2xl font-display font-black tracking-wider text-center uppercase bg-surface border-3 border-border rounded-2xl shadow-inner-sm"
          />
        </div>

        {/* Inline Error with 1s Cooldown Notice */}
        {errorReason && (
          <div className="p-2.5 bg-destructive/15 border-2 border-destructive/40 rounded-xl text-center text-xs sm:text-sm font-bold text-destructive animate-head-shake">
            ⚠️ {errorReason}
            {cooldown && (
              <span className="block text-[11px] font-semibold text-muted-foreground mt-0.5">
                (1s cooldown…)
              </span>
            )}
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={!cleanWord || cleanWord.length < 3 || cooldown || busy}
          className="w-full min-h-[56px] text-xl font-display font-black bg-primary text-primary-foreground shadow-button rounded-2xl active:scale-98 transition-transform"
        >
          <Sparkles className="size-5 mr-2" />
          Submit Word!
        </Button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------ 4. Round Ended Screen --- */

function RoundEndedScreen({
  currentRound,
  roundWinnerId,
  winningWord,
  revealedLetters,
  myPlayer,
  opponentPlayer,
  onNextRound,
}: {
  currentRound: number;
  roundWinnerId: string | null;
  winningWord: string | null;
  revealedLetters: [string, string] | null;
  myPlayer?: PublicPlayer | undefined;
  opponentPlayer?: PublicPlayer | undefined;
  onNextRound: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const isDraw = roundWinnerId === "draw" || !roundWinnerId;
  const isMeWinner = myPlayer && roundWinnerId === myPlayer.profileId;
  const winner = isMeWinner ? myPlayer : opponentPlayer;

  // 3-second auto-transition to next round
  useEffect(() => {
    const timer = setTimeout(() => {
      void onNextRound();
    }, 3800);
    return () => clearTimeout(timer);
  }, [onNextRound]);

  return (
    <div className="play-panel p-6 sm:p-8 text-center space-y-6 shadow-panel animate-rise">
      <div className="space-y-1">
        <span className="tag-sticker text-xs uppercase tracking-wider text-muted-foreground">
          Round {currentRound} Complete
        </span>
        <h2 className="font-display text-3xl sm:text-4xl font-black">
          {isDraw ? "Round Draw! ⏰" : `${winner?.displayName} Wins The Round!`}
        </h2>
      </div>

      {/* Winning Word Display */}
      {winningWord ? (
        <div className="space-y-2 py-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Winning Word
          </p>
          <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
            {winningWord.split("").map((char, index) => (
              <span
                key={index}
                className="size-11 sm:size-12 rounded-xl bg-amber-400 border-3 border-border flex items-center justify-center font-display text-2xl font-black text-ink shadow-xs"
              >
                {char}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-secondary/60 border-2 border-border text-center">
          <p className="text-sm font-bold text-muted-foreground">
            Neither player found a valid word before time expired.
          </p>
        </div>
      )}

      {/* Letters Used */}
      {revealedLetters && (
        <p className="text-xs font-bold text-muted-foreground">
          Letters:{" "}
          <span className="font-display text-sm font-black text-foreground">
            {revealedLetters[0]}
          </span>{" "}
          &{" "}
          <span className="font-display text-sm font-black text-foreground">
            {revealedLetters[1]}
          </span>
        </p>
      )}

      <div className="pt-2">
        <Button
          size="lg"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onNextRound();
            } finally {
              setBusy(false);
            }
          }}
          className="w-full min-h-[56px] text-xl font-display font-black bg-primary text-primary-foreground shadow-button rounded-2xl"
        >
          Next Round →
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------ 5. Match Ended Screen --- */

function MatchEndedScreen({
  matchWinnerId,
  scores,
  history,
  myPlayer,
  opponentPlayer,
  onRematch,
  onBackHome,
}: {
  matchWinnerId: string | null;
  scores: Record<string, number>;
  history: Array<{
    round: number;
    letters: [string, string];
    winnerId: string | null;
    winningWord: string | null;
  }>;
  myPlayer?: PublicPlayer | undefined;
  opponentPlayer?: PublicPlayer | undefined;
  onRematch: () => Promise<void>;
  onBackHome: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const isMeWinner = myPlayer && matchWinnerId === myPlayer.profileId;
  const winner = isMeWinner ? myPlayer : opponentPlayer;

  return (
    <div className="play-panel p-6 sm:p-8 text-center space-y-6 shadow-panel animate-rise">
      {/* Trophy & Confetti Header */}
      <div className="space-y-2">
        <div className="mx-auto size-24 rounded-3xl bg-amber-400 border-4 border-border flex items-center justify-center text-ink shadow-panel transform rotate-[-6deg]">
          <Trophy className="size-12" />
        </div>
        <h2 className="font-display text-3xl sm:text-4xl font-black text-foreground pt-2">
          {winner?.displayName} Wins! 🎉
        </h2>
        <p className="text-sm font-bold text-muted-foreground">
          {isMeWinner
            ? "Victory is yours! Outstanding vocabulary."
            : "Great match! Time for revenge?"}
        </p>
      </div>

      {/* Final Score Banner */}
      <div className="p-4 bg-card rounded-2xl border-3 border-border shadow-xs flex items-center justify-around font-display">
        <div className="text-center">
          <span className="text-3xl">{avatarEmoji(myPlayer?.avatarId)}</span>
          <p className="text-xs font-bold text-muted-foreground mt-1 truncate max-w-[90px]">
            {myPlayer?.displayName}
          </p>
          <p className="text-3xl font-black text-foreground">
            {myPlayer ? (scores[myPlayer.profileId] ?? 0) : 0}
          </p>
        </div>

        <span className="text-2xl font-black text-muted-foreground">-</span>

        <div className="text-center">
          <span className="text-3xl">{avatarEmoji(opponentPlayer?.avatarId)}</span>
          <p className="text-xs font-bold text-muted-foreground mt-1 truncate max-w-[90px]">
            {opponentPlayer?.displayName}
          </p>
          <p className="text-3xl font-black text-foreground">
            {opponentPlayer ? (scores[opponentPlayer.profileId] ?? 0) : 0}
          </p>
        </div>
      </div>

      {/* Match Words History Table */}
      {history.length > 0 && (
        <div className="space-y-2 text-left">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Words Used in Match
          </p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {history.map((h) => {
              const roundWinner =
                h.winnerId === myPlayer?.profileId
                  ? myPlayer
                  : h.winnerId === opponentPlayer?.profileId
                    ? opponentPlayer
                    : null;
              return (
                <div
                  key={h.round}
                  className="p-2.5 rounded-xl bg-secondary/50 border-2 border-border flex items-center justify-between text-xs sm:text-sm font-semibold"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-muted-foreground">R{h.round}:</span>
                    <span className="tag-sticker text-[11px] py-0 px-1.5">
                      {h.letters[0]}&{h.letters[1]}
                    </span>
                    <span className="font-display font-black text-foreground">
                      {h.winningWord ?? "Draw (No Word)"}
                    </span>
                  </div>
                  {roundWinner && (
                    <span className="text-xs font-bold flex items-center gap-1 text-muted-foreground">
                      <span>{avatarEmoji(roundWinner.avatarId)}</span>
                      <span className="truncate max-w-[70px]">{roundWinner.displayName}</span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="pt-2 space-y-2.5">
        <Button
          size="lg"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onRematch();
            } finally {
              setBusy(false);
            }
          }}
          className="w-full min-h-[56px] text-xl font-display font-black bg-primary text-primary-foreground shadow-button rounded-2xl active:scale-98 transition-transform"
        >
          <RotateCcw className="size-5 mr-2" />
          Rematch!
        </Button>

        <Button
          variant="secondary"
          size="lg"
          onClick={onBackHome}
          className="w-full min-h-[56px] text-base font-display font-bold border-2 border-border rounded-2xl"
        >
          <ArrowLeft className="size-5 mr-2" />
          Back to Home
        </Button>
      </div>
    </div>
  );
}
