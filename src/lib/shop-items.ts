export type ShopItem = {
  id: string;
  kind: "pack" | "skin";
  name: string;
  description: string;
  price: number;
  preview: string;
  /** Sticker packs unlock these avatar ids. */
  avatars?: { id: string; emoji: string; label: string }[];
};

export const STARTING_COINS = 200;

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: "pack-spooky",
    kind: "pack",
    name: "Spooky Pack",
    price: 120,
    preview: "👻🎃💀",
    description: "Three haunted stickers for your player token.",
    avatars: [
      { id: "ghost", emoji: "👻", label: "Ghost" },
      { id: "pumpkin", emoji: "🎃", label: "Pumpkin" },
      { id: "skull", emoji: "💀", label: "Skull" },
    ],
  },
  {
    id: "pack-space",
    kind: "pack",
    name: "Space Pack",
    price: 150,
    preview: "👽🤖🚀",
    description: "Out-of-this-world stickers.",
    avatars: [
      { id: "alien", emoji: "👽", label: "Alien" },
      { id: "robot", emoji: "🤖", label: "Robot" },
      { id: "rocket", emoji: "🚀", label: "Rocket" },
    ],
  },
  {
    id: "pack-royal",
    kind: "pack",
    name: "Royal Pack",
    price: 250,
    preview: "👑🦁🐉",
    description: "Legendary stickers for true rulers.",
    avatars: [
      { id: "crown", emoji: "👑", label: "Crown" },
      { id: "lion", emoji: "🦁", label: "Lion" },
      { id: "wizard", emoji: "🧙", label: "Wizard" },
    ],
  },
  {
    id: "skin-neon",
    kind: "skin",
    name: "Neon Card",
    price: 180,
    preview: "⚡",
    description: "A glowing arcade-style role card.",
  },
  {
    id: "skin-gold",
    kind: "skin",
    name: "Gold Card",
    price: 300,
    preview: "🏆",
    description: "A shiny gold foil role card.",
  },
  {
    id: "skin-comic",
    kind: "skin",
    name: "Comic Card",
    price: 140,
    preview: "💥",
    description: "A pop-art comic book role card.",
  },
];

export const PACK_AVATARS = SHOP_ITEMS.flatMap((i) =>
  (i.avatars ?? []).map((a) => ({ ...a, packId: i.id })),
);

export function itemById(id: string) {
  return SHOP_ITEMS.find((i) => i.id === id);
}

export const COIN_BUNDLES = [
  { coins: 500, price: "$0.99" },
  { coins: 1200, price: "$1.99" },
  { coins: 3000, price: "$4.99" },
];
