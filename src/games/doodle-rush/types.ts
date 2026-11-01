export type DoodleRushPhase = "lobby" | "countdown" | "drawing" | "round_end" | "game_over";

export interface DoodleRushSettings {
  rounds: number; // how many drawing rounds
  drawTime: number; // seconds per drawing turn, 0 = no time limit
}

export interface DrawStroke {
  x: number[];
  y: number[];
  color: string;
  size: number;
  tool: "pen" | "eraser";
}

export interface DoodleRushGuess {
  profileId: string;
  displayName: string;
  guess: string;
  correct: boolean;
  submittedAt: string;
}

export interface DoodleRushRound {
  roundNumber: number;
  drawerId: string;
  drawerName: string;
  word: string | null; // null for all but drawer until round ends
  revealedWord: string | null; // revealed after round
  wordLength: number;
  revealedIndices: number[]; // indices of letters revealed randomly
  wordMask: string; // e.g. "E _ _ P _ _ _ T"
  latestCorrectGuesser: { displayName: string; submittedAt: string } | null;
  /** bumps every time the drawer's canvas snapshot is saved; guessers fetch the picture when it changes */
  canvasSeq: number;
  guesses: DoodleRushGuess[];
  winnerIds: string[]; // players who guessed correctly
  endsAt: string | null;
  ended: boolean;
}

export interface DoodleRushClientState {
  phase: DoodleRushPhase;
  settings: DoodleRushSettings;
  currentRound: (Omit<DoodleRushRound, "word"> & { word: string | null }) | null;
  scores: Record<string, number>; // Artist scores (how many people correctly guessed their drawings)
  guesserScores?: Record<string, number>; // How many drawings this player guessed correctly
  drawerNames?: Record<string, string>;
  roundNumber: number;
  totalRounds: number;
  countdownEndsAt: string | null;
  /** when the next drawing starts by itself (shown between rounds) */
  nextAt: string | null;
  isDrawer: boolean; // computed for this client
}

export interface DoodleRushServerData {
  settings: DoodleRushSettings;
  phase: DoodleRushPhase;
  currentRound: DoodleRushRound | null;
  scores: Record<string, number>; // Artist scores: number of correct guesses on their drawings
  guesserScores: Record<string, number>;
  drawerNames: Record<string, string>;
  roundNumber: number;
  drawerOrder: string[]; // profile_ids in order
  drawerIndex: number;
  usedWords: string[];
  countdownEndsAt: string | null;
  nextAt: string | null;
}

export const DEFAULT_DOODLE_RUSH_SETTINGS: DoodleRushSettings = {
  rounds: 3,
  drawTime: 0, // no time limit by default
};
