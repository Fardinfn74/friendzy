export type DoodleRushPhase =
  | "lobby"
  | "countdown"
  | "drawing"
  | "round_end"
  | "game_over";

export interface DoodleRushSettings {
  rounds: number;      // how many drawing rounds
  drawTime: number;    // seconds per drawing turn
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
  word: string | null;   // null for all but drawer until round ends
  revealedWord: string | null;  // revealed after round
  wordLength: number;
  revealedIndices: number[]; // indices of letters revealed randomly
  wordMask: string; // e.g. "E _ _ P _ _ _ T"
  latestCorrectGuesser: { displayName: string; submittedAt: string } | null;
  strokes: DrawStroke[];
  guesses: DoodleRushGuess[];
  winnerIds: string[];   // players who guessed correctly
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
  isDrawer: boolean;   // computed for this client
}

export interface DoodleRushServerData {
  settings: DoodleRushSettings;
  phase: DoodleRushPhase;
  currentRound: DoodleRushRound | null;
  scores: Record<string, number>; // Artist scores: number of correct guesses on their drawings
  guesserScores: Record<string, number>;
  drawerNames: Record<string, string>;
  roundNumber: number;
  drawerOrder: string[];  // profile_ids in order
  drawerIndex: number;
  usedWords: string[];
  countdownEndsAt: string | null;
}

export const DEFAULT_DOODLE_RUSH_SETTINGS: DoodleRushSettings = {
  rounds: 3,
  drawTime: 80,
};

// ── Word bank for drawing ─────────────────────────────────────────────────────
export const DRAW_WORDS: string[] = [
  // Animals
  "elephant", "giraffe", "penguin", "dolphin", "kangaroo", "butterfly", "octopus", "crocodile",
  // Food
  "pizza", "sushi", "hamburger", "watermelon", "ice cream", "hotdog", "pretzel", "tacos",
  // Objects
  "umbrella", "telescope", "guitar", "bicycle", "camera", "backpack", "lantern", "compass",
  // Places
  "lighthouse", "volcano", "castle", "pyramid", "igloo", "windmill", "skyscraper", "treehouse",
  // Actions
  "dancing", "swimming", "skateboarding", "sleeping", "cooking", "painting", "reading", "flying",
  // Nature
  "rainbow", "tornado", "snowflake", "cactus", "mushroom", "waterfall", "sunset", "aurora",
  // Fun
  "robot", "alien", "dragon", "mermaid", "unicorn", "zombie", "pirate", "astronaut",
  // Everyday
  "toothbrush", "bathtub", "bookshelf", "blender", "hairdryer", "calculator", "mailbox", "escalator",
];
