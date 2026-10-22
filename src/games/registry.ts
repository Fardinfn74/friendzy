export type GameCategory = "Party" | "Brain" | "Board";

export type GameStatus = "live" | "soon";

export type GameEntry = {
  id: string;
  name: string;
  icon: string;
  stickerUrl: string;
  /** Background accent colour for the sticker tile (Tailwind class fragment). */
  accentBg: string;
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
    name: "Imposta",
    icon: "🕵️",
    stickerUrl: "/stickers/game-imposter.svg",
    accentBg: "bg-amber-400",
    tagline: "Spot the bluff & unmask the secret imposter",
    category: "Party",
    minPlayers: 3,
    maxPlayers: 12,
    status: "live",
    route: "/games/imposta",
    playerCountLabel: "3–12 players",
  },
  {
    id: "word-duel",
    name: "Word Duel",
    icon: "⚔️",
    stickerUrl: "/stickers/game-word-duel.svg",
    accentBg: "bg-teal-400",
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
    stickerUrl: "/stickers/game-number-guess.svg",
    accentBg: "bg-violet-400",
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
    stickerUrl: "/stickers/game-bottle-spin.svg",
    accentBg: "bg-pink-400",
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
    stickerUrl: "/stickers/game-truth-or-dare.svg",
    accentBg: "bg-rose-400",
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
    stickerUrl: "/stickers/game-chess.svg",
    accentBg: "bg-slate-400",
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
    stickerUrl: "/stickers/game-ludo.svg",
    accentBg: "bg-blue-400",
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
    stickerUrl: "/stickers/game-carrom.svg",
    accentBg: "bg-orange-400",
    tagline: "Flick the striker, claim coins & pocket the queen",
    category: "Board",
    minPlayers: 2,
    maxPlayers: 4,
    status: "live",
    route: "/games/carrom",
    playerCountLabel: "2–4 players",
  },
  {
    id: "letter-blitz",
    name: "Letter Blitz",
    icon: "🔡",
    stickerUrl: "/stickers/game-letter-blitz.svg",
    accentBg: "bg-teal-400",
    tagline: "Race to guess words using 2 mystery letters",
    category: "Brain",
    minPlayers: 2,
    maxPlayers: 10,
    status: "live",
    route: "/games/letter-blitz",
    playerCountLabel: "2–10 players",
  },
  {
    id: "doodle-rush",
    name: "Doodle Rush",
    icon: "🎨",
    stickerUrl: "/stickers/game-doodle-rush.svg",
    accentBg: "bg-violet-400",
    tagline: "Draw the word, friends guess it in real time",
    category: "Party",
    minPlayers: 2,
    maxPlayers: 8,
    status: "live",
    route: "/games/doodle-rush",
    playerCountLabel: "2–8 players",
  },
];

export const CATEGORY_FILTERS = ["All", "Party", "Brain", "Board", "2-Player"] as const;
export type CategoryFilter = (typeof CATEGORY_FILTERS)[number];

export function getGameById(id: string): GameEntry | undefined {
  return GAMES.find(
    (g) =>
      g.id === id ||
      (id === "imposta" && g.id === "imposter") ||
      (id === "imposter" && g.id === "imposta"),
  );
}

export function filterGames(category: CategoryFilter): GameEntry[] {
  if (category === "All") return GAMES;
  if (category === "2-Player") {
    return GAMES.filter((g) => g.minPlayers <= 2 && g.maxPlayers === 2);
  }
  return GAMES.filter((g) => g.category === category);
}
