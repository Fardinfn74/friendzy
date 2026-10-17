export type NumberGuessRange = "1-50" | "1-100" | "1-500";
export type NumberGuessRoundsOption = 3 | 5;

export type NumberGuessSettings = {
  range: NumberGuessRange;
  hints: boolean;
  rounds: NumberGuessRoundsOption;
};

export type NumberGuessPhase = "pick" | "countdown" | "guess" | "round_ended" | "match_ended";

export type GuessEntry = {
  guesserId: string;
  targetId: string;
  guess: number;
  /** Only set when the guess was correct */
  correct: boolean;
  /** Hint direction, only visible to the guesser */
  hint: "higher" | "lower" | null;
  ts: number; // server timestamp ms
};

export type NumberGuessRoundHistory = {
  round: number;
  range: NumberGuessRange;
  /** profileId -> their secret number (revealed after the round) */
  secrets: Record<string, number>;
  /** profileId of first correct guesser, or null if no one got it */
  winnerId: string | null;
  scores: Record<string, number>;
};

/**
 * Server-only: stores the actual secret numbers.
 * NEVER sent to the client directly.
 */
export type NumberGuessServerData = {
  settings: NumberGuessSettings;
  phase: NumberGuessPhase;
  currentRound: number;
  /** profileId -> secret number (kept server-side only) */
  secrets: Record<string, number>;
  /** profileId -> true when they've locked in */
  locked: Record<string, boolean>;
  countdownEndsAt: number | null;
  /** profileId -> profileId -> list of guesses (numbers tried) */
  guessHistory: Record<string, Record<string, number[]>>;
  /** When the round was won (ms), to resolve ties */
  roundWonAt: number | null;
  /** profileId of round winner */
  roundWinnerId: string | null;
  /** profileId -> score */
  scores: Record<string, number>;
  history: NumberGuessRoundHistory[];
  matchWinnerId: string | null;
};

/**
 * Client-safe version: secrets stripped out, replaced with per-player
 * info about whether they've locked.
 */
export type NumberGuessClientState = {
  settings: NumberGuessSettings;
  phase: NumberGuessPhase;
  currentRound: number;
  maxRounds: number;
  targetWins: number;
  /** profileId -> locked boolean (no actual numbers) */
  locked: Record<string, boolean>;
  countdownEndsAt: number | null;
  /** My own guesses against each target: profileId -> guesses[] */
  myGuesses: Record<string, number[]>;
  /**
   * Hint for my last guess per target: profileId -> "higher" | "lower" | null
   * Only filled for the requesting player's own guesses.
   */
  myHints: Record<string, "higher" | "lower" | null>;
  /** profileId -> score */
  scores: Record<string, number>;
  roundWinnerId: string | null;
  /**
   * Revealed after round ends: profileId -> secret number.
   * Null during guess phase to prevent cheating.
   */
  revealedSecrets: Record<string, number> | null;
  history: NumberGuessRoundHistory[];
  matchWinnerId: string | null;
};
