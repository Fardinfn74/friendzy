export type LetterBlitzPhase =
  | "lobby"
  | "countdown"
  | "round_active"
  | "round_end"
  | "game_over";

export interface LetterBlitzSettings {
  rounds: number;       // 3 | 5 | 7
  roundTime: number;    // 30 | 45 | 60 seconds
}

export interface LetterBlitzGuess {
  profileId: string;
  displayName: string;
  word: string;
  accepted: boolean;
  rank: number | null;  // 1 = first accepted, etc.
  submittedAt: string;
}

export interface LetterBlitzRound {
  roundNumber: number;
  letters: [string, string];  // the 2 chosen letters
  guesses: LetterBlitzGuess[];
  endsAt: string | null;
  winnerId: string | null;
}

export interface LetterBlitzClientState {
  phase: LetterBlitzPhase;
  settings: LetterBlitzSettings;
  currentRound: LetterBlitzRound | null;
  scores: Record<string, number>;  // profileId -> total points
  roundNumber: number;
  totalRounds: number;
  countdownEndsAt: string | null;
}

export interface LetterBlitzServerData {
  settings: LetterBlitzSettings;
  phase: LetterBlitzPhase;
  currentRound: LetterBlitzRound | null;
  scores: Record<string, number>;
  roundNumber: number;
  usedLetterPairs: Array<[string, string]>;
  roundEndsAt: string | null;
  countdownEndsAt: string | null;
}

export const DEFAULT_LETTER_BLITZ_SETTINGS: LetterBlitzSettings = {
  rounds: 5,
  roundTime: 45,
};

export const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
