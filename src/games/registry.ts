export type GameCategory = "Party" | "Brain" | "Board";

export type GameStatus = "live" | "soon";

export type GameEntry = {
  id: string;
  name: string;
  icon: string;
  tagline: string;
  category: GameCategory;
  minPlayers: number;
  maxPlayers: number;
  status: GameStatus;
  route: string;
  playerCountLabel: string;
};

export const GAMES: GameEntry[] = [
  {
    id: "imposter",
    name: "Imposter",
    icon: "🕵️",
    tagline: "Spot the bluff & unmask the secret imposter",
    category: "Party",
    minPlayers: 3,
    maxPlayers: 12,
    status: "live",
    route: "/games/imposter",
    playerCountLabel: "3–12 players",
  },
  {
    id: "word-duel",
    name: "Word Duel",
    icon: "⚔️",
    tagline: "Fast-paced 1v1 vocabulary battle",
    category: "Brain",
    minPlayers: 2,
    maxPlayers: 2,
    status: "live",
    route: "/games/word-duel",
    playerCountLabel: "2 players",
  },
  {
    id: "number-guess",
    name: "Number Guess",
    icon: "🔢",
    tagline: "Higher or lower bluff & deduction challenge",
    category: "Brain",
    minPlayers: 2,
    maxPlayers: 6,
    status: "live",
    route: "/games/number-guess",
    playerCountLabel: "2–6 players",
  },
  {
    id: "bottle-spin",
    name: "Bottle Spin",
    icon: "🍾",
    tagline: "Classic party wheel spin for friends",
    category: "Party",
    minPlayers: 3,
    maxPlayers: 12,
    status: "live",
    route: "/games/bottle-spin",
    playerCountLabel: "3–12 players",
  },
  {
    id: "truth-or-dare",
    name: "Truth or Dare",
    icon: "🎭",
    tagline: "Hilarious secrets & cheeky physical dares",
    category: "Party",
    minPlayers: 3,
    maxPlayers: 12,
    status: "live",
    route: "/games/truth-or-dare",
    playerCountLabel: "3–12 players",
  },
  {
    id: "chess",
    name: "Chess",
    icon: "♟️",
    tagline: "Timeless 1v1 tactical strategy",
    category: "Board",
    minPlayers: 2,
    maxPlayers: 2,
    status: "live",
    route: "/games/chess",
    playerCountLabel: "2 players",
  },
  {
    id: "ludo",
    name: "Ludo",
    icon: "🎲",
    tagline: "Roll the dice, race tokens, send friends back",
    category: "Board",
    minPlayers: 2,
    maxPlayers: 4,
    status: "live",
    route: "/games/ludo",
    playerCountLabel: "2–4 players",
  },
  {
    id: "carrom",
    name: "Carrom",
    icon: "🎯",
    tagline: "Flick the striker, claim coins & pocket the queen",
    category: "Board",
    minPlayers: 2,
    maxPlayers: 4,
    status: "live",
    route: "/games/carrom",
    playerCountLabel: "2–4 players",
  },
];

export const CATEGORY_FILTERS = ["All", "Party", "Brain", "Board", "2-Player"] as const;
export type CategoryFilter = (typeof CATEGORY_FILTERS)[number];

export function getGameById(id: string): GameEntry | undefined {
  return GAMES.find((g) => g.id === id);
}

export function filterGames(category: CategoryFilter): GameEntry[] {
  if (category === "All") return GAMES;
  if (category === "2-Player") {
    return GAMES.filter((g) => g.minPlayers <= 2 && g.maxPlayers === 2);
  }
  return GAMES.filter((g) => g.category === category);
}
