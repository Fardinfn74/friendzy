import { PACK_AVATARS } from "./shop-items";
export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 12;
export const HINT_SECONDS = 35;
export const VOTE_SECONDS = 90;
export const RESOLVE_SECONDS = 7;
export const MAX_REPLAY_STREAK = 2;

export type Difficulty = "easy" | "medium" | "hard";
export type GameStatus = "lobby" | "reveal" | "hint" | "voting" | "resolved" | "ended";
export type Winner = "crew" | "imposters" | null;

export const AVATARS = [
  { id: "fox", emoji: "🦊", label: "Fox" },
  { id: "owl", emoji: "🦉", label: "Owl" },
  { id: "cat", emoji: "🐱", label: "Cat" },
  { id: "frog", emoji: "🐸", label: "Frog" },
  { id: "panda", emoji: "🐼", label: "Panda" },
  { id: "octopus", emoji: "🐙", label: "Octopus" },
  { id: "penguin", emoji: "🐧", label: "Penguin" },
  { id: "bee", emoji: "🐝", label: "Bee" },
  { id: "shark", emoji: "🦈", label: "Shark" },
  { id: "dragon", emoji: "🐲", label: "Dragon" },
  { id: "raccoon", emoji: "🦝", label: "Raccoon" },
  { id: "unicorn", emoji: "🦄", label: "Unicorn" },
] as const;

export function avatarEmoji(id: string | null | undefined) {
  return (
    AVATARS.find((a) => a.id === id)?.emoji ?? PACK_AVATARS.find((a) => a.id === id)?.emoji ?? "🎭"
  );
}

export function maxImposters(playerCount: number) {
  return Math.min(3, Math.max(1, Math.floor(playerCount / 4)));
}

export type PublicPlayer = {
  profileId: string;
  displayName: string;
  avatarId: string;
  isHost: boolean;
  isReady: boolean;
  isEliminated: boolean;
  leftGame: boolean;
  cardSeen: boolean;
  turnOrder: number | null;
  hasHinted: boolean;
  hasVoted: boolean;
  /** Only populated once the game has ended. */
  isImposter?: boolean;
};

export type HintEntry = {
  profileId: string;
  roundNumber: number;
  message: string;
  skipped: boolean;
};

import type { WordDuelClientState } from "@/games/word-duel/types";
import type { NumberGuessClientState } from "@/games/number-guess/types";
import type { BottleSpinClientState } from "@/games/bottle-spin/types";
import type { TruthOrDareClientState } from "@/games/truth-or-dare/types";
import type { ChessClientState } from "@/games/chess/types";
import type { LudoClientState } from "@/games/ludo/types";
import type { CarromClientState } from "@/games/carrom/types";
import type { LetterBlitzClientState } from "@/games/letter-blitz/types";
import type { DoodleRushClientState } from "@/games/doodle-rush/types";

export type GameState = {
  code: string;
  gameType?: string;
  gameSettings?: Record<string, string | number | boolean | null> | null;
  wordDuel?: WordDuelClientState | null;
  numberGuess?: NumberGuessClientState | null;
  bottleSpin?: BottleSpinClientState | null;
  truthOrDare?: TruthOrDareClientState | null;
  chess?: ChessClientState | null;
  ludo?: LudoClientState | null;
  carrom?: CarromClientState | null;
  letterBlitz?: LetterBlitzClientState | null;
  doodleRush?: DoodleRushClientState | null;
  status: GameStatus;
  difficulty: Difficulty;
  imposterCount: number;
  mode: "classic" | "double";
  revealedDecoy: string | null;
  maxPlayers: number;
  /** Host-chosen AI theme queued for the next round (word stays secret). */
  aiTheme: string | null;
  roundNumber: number;
  currentTurnProfileId: string | null;
  turnDeadline: string | null;
  voteDeadline: string | null;
  resolveUntil: string | null;
  replayStreak: number;
  replayAvailable: boolean;
  winner: Winner;
  lastEliminated: {
    profileId: string | null;
    wasImposter: boolean | null;
    note: string | null;
  };
  /** Revealed to everyone only when the game has ended. */
  revealedWord: string | null;
  revealedCategory: string | null;
  players: PublicPlayer[];
  hints: HintEntry[];
  me: {
    profileId: string;
    isHost: boolean;
    isEliminated: boolean;
    isReady: boolean;
    cardSeen: boolean;
    hasHinted: boolean;
    hasVoted: boolean;
    isMyTurn: boolean;
  };
  /** The caller's own card, never anyone else's. */
  myCard: { role: "crew" | "imposter"; word: string | null; category: string | null } | null;
  votesNeeded: number;
  votesCast: number;
  suspectsAllowed: number;
};
