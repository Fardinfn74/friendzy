type AiWord = { word: string; category: string };

export class AiWordError extends Error {}

/** Curated dictionary of >50% semantic match counterparts for Double Agent mode. */
export const DOUBLE_AGENT_PAIRS: Record<string, string[]> = {
  // Animals
  Elephant: ["Mammoth", "Rhinoceros", "Hippopotamus"],
  Penguin: ["Puffin", "Ostrich", "Seagull"],
  Dolphin: ["Porpoise", "Whale", "Seal"],
  Rabbit: ["Hare", "Hamster", "Guinea Pig"],
  Platypus: ["Beaver", "Otter", "Duck"],
  Hedgehog: ["Porcupine", "Armadillo", "Echidna"],
  Chameleon: ["Gecko", "Iguana", "Lizard"],
  Meerkat: ["Prairie Dog", "Mongoose", "Weasel"],
  Axolotl: ["Salamander", "Newt", "Tadpole"],
  Pangolin: ["Armadillo", "Anteater", "Aardvark"],
  Narwhal: ["Beluga Whale", "Swordfish", "Dolphin"],
  Tapir: ["Wild Boar", "Anteater", "Capybara"],

  // Food
  Pizza: ["Burger", "Calzone", "Flatbread"],
  "Ice Cream": ["Frozen Yogurt", "Gelato", "Popsicle"],
  Pancake: ["Waffle", "Crepe", "French Toast"],
  Popcorn: ["Potato Chips", "Pretzel", "Nachos"],
  Biryani: ["Fried Rice", "Pilaf", "Risotto"],
  Lasagna: ["Spaghetti", "Pasta Bake", "Ravioli"],
  Dumpling: ["Wonton", "Gyoza", "Empanada"],
  Guacamole: ["Salsa", "Hummus", "Queso Dip"],
  Ceviche: ["Sashimi", "Poke", "Tartare"],
  Baklava: ["Cannoli", "Kadaif", "Apple Strudel"],
  Kimchi: ["Sauerkraut", "Pickles", "Coleslaw"],
  Tiramisu: ["Cheesecake", "Panna Cotta", "Mousse"],

  // Places
  Beach: ["Lakeside", "Island", "Coast"],
  Airport: ["Train Station", "Bus Terminal", "Subway Station"],
  Library: ["Bookstore", "Study Hall", "Archive"],
  Hospital: ["Clinic", "Ambulance Station", "Pharmacy"],
  Sundarbans: ["Everglades", "Amazon Rainforest", "Mangrove Swamp"],
  Museum: ["Art Gallery", "Exhibition Hall", "Planetarium"],
  Lighthouse: ["Watchtower", "Windmill", "Lookout Tower"],
  Vineyard: ["Winery", "Orchard", "Brewery"],
  Chernobyl: ["Fukushima", "Nuclear Power Plant", "Ghost Town"],
  "Machu Picchu": ["Chichen Itza", "Petra", "Ancient Ruins"],
  Catacombs: ["Mausoleum", "Crypt", "Underground Dungeon"],
  Observatory: ["Planetarium", "Telescope Dome", "Space Station"],

  // Professions
  Doctor: ["Surgeon", "Nurse", "Physician"],
  Teacher: ["Professor", "Tutor", "Instructor"],
  Chef: ["Baker", "Cook", "Pastry Chef"],
  Firefighter: ["Paramedic", "Rescue Worker", "Police Officer"],
  Locksmith: ["Blacksmith", "Carpenter", "Electrician"],
  Beekeeper: ["Farmer", "Gardener", "Botanist"],
  "Tattoo Artist": ["Painter", "Graphic Designer", "Illustrator"],
  "Air Traffic Controller": ["Flight Pilot", "Radar Operator", "Flight Dispatcher"],
  Cartographer: ["Navigator", "Surveyor", "Geographer"],
  Sommelier: ["Bartender", "Winemaker", "Barista"],
  Taxidermist: ["Sculptor", "Biologist", "Museum Curator"],
  Actuary: ["Accountant", "Statistician", "Financial Analyst"],

  // Objects
  Umbrella: ["Raincoat", "Parasol", "Poncho"],
  Toothbrush: ["Hairbrush", "Dental Floss", "Comb"],
  Mirror: ["Window", "Glass Pane", "Camera"],
  Backpack: ["Duffel Bag", "Suitcase", "Satchel"],
  Compass: ["GPS Device", "Sundial", "Clock"],
  Metronome: ["Tuner", "Stopwatch", "Pendulum"],
  Kaleidoscope: ["Prism", "Telescope", "Periscope"],
  Stapler: ["Hole Punch", "Paperclip", "Tape Dispenser"],
  Sextant: ["Astrolabe", "Compass", "Telescope"],
  Abacus: ["Calculator", "Counting Beads", "Slide Rule"],
  Gramophone: ["Vinyl Turntable", "Record Player", "Radio"],
  Theremin: ["Synthesizer", "Electric Keyboard", "Harmonica"],

  // Activities
  Swimming: ["Diving", "Water Polo", "Surfing"],
  Dancing: ["Gymnastics", "Ballet", "Figure Skating"],
  Camping: ["Hiking", "Backpacking", "Picnicking"],
  Karaoke: ["Singing", "Open Mic", "Choir"],
  Bowling: ["Billiards", "Darts", "Skittles"],
  Gardening: ["Farming", "Landscaping", "Composting"],
  Snorkeling: ["Scuba Diving", "Free Diving", "Swimming"],
  Pottery: ["Sculpting", "Ceramics", "Woodcarving"],
  Fencing: ["Sword Fighting", "Archery", "Martial Arts"],
  Curling: ["Ice Hockey", "Shuffleboard", "Bowling"],
  Spelunking: ["Caving", "Rock Climbing", "Mountaineering"],
  Falconry: ["Archery", "Bird Watching", "Hunting"],
};

/** Generates a themed secret word via Gemini or OpenAI API. */
export async function generateThemedWord(theme: string, difficulty: string): Promise<AiWord> {
  const geminiApiKey = process.env["GEMINI_API_KEY"];
  const openAiApiKey =
    process.env["AI_GATEWAY_API_KEY"] ?? process.env["AI_API_KEY"] ?? process.env["OPENAI_API_KEY"];

  if (geminiApiKey) {
    return generateThemedWordGemini(theme, difficulty, geminiApiKey);
  }

  if (openAiApiKey) {
    return generateThemedWordOpenAi(theme, difficulty, openAiApiKey);
  }

  throw new AiWordError("AI word generation isn't configured yet.");
}

async function generateThemedWordGemini(
  theme: string,
  difficulty: string,
  apiKey: string,
): Promise<AiWord> {
  const model = process.env["GEMINI_MODEL"] ?? "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const prompt =
    "You pick secret words for the party game Imposta where crew players know a word and imposters see nothing (or a decoy in Double Agent); everyone gives one-word clues. " +
    "Pick ONE well-known, concrete noun (1-2 words, family friendly) that fits the theme. It must be balanced: guessable from clues, but with many plausible neighbours so imposters can bluff. " +
    `Difficulty easy = very common; medium = familiar; hard = more specific. The category is a short 1-3 word label shown to crew. Never just repeat the theme as the word.\n\n` +
    `Theme: ${theme}\n` +
    `Difficulty: ${difficulty}\n` +
    `Randomness seed: ${Math.floor(Math.random() * 1e6)}\n\n` +
    `Return strictly valid JSON format:\n{"word": "string", "category": "string"}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });

    if (!res.ok) {
      if (res.status === 429)
        throw new AiWordError("The word generator is busy — try again in a moment.");
      if (res.status === 402 || res.status === 403)
        throw new AiWordError("AI word generation key error. Check your Gemini API key.");
      throw new AiWordError("Couldn't generate a word with Gemini. Try another theme.");
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = JSON.parse(content) as AiWord;
    const word = String(parsed.word ?? "")
      .trim()
      .slice(0, 40);
    const category =
      String(parsed.category ?? "")
        .trim()
        .slice(0, 40) || theme.slice(0, 40);
    if (!word) throw new Error("Empty word returned");
    return { word, category };
  } catch (err) {
    if (err instanceof AiWordError) throw err;
    throw new AiWordError("The AI gave an unexpected answer. Try another theme.");
  }
}

async function generateThemedWordOpenAi(
  theme: string,
  difficulty: string,
  apiKey: string,
): Promise<AiWord> {
  const model = process.env["AI_MODEL"] ?? "gpt-4o-mini";
  const gatewayUrl = process.env["AI_GATEWAY_URL"] ?? "https://api.openai.com/v1/chat/completions";

  const res = await fetch(gatewayUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You pick secret words for the party game Imposta where crew players know a word and imposters only see nothing; everyone gives one-word clues. " +
            "Pick ONE well-known, concrete noun (1-2 words, family friendly) that fits the theme. It must be balanced: guessable from clues, but with many plausible neighbours so imposters can bluff. " +
            'Difficulty easy = very common; medium = familiar; hard = more specific. The category is a short 1-3 word label shown to crew. Never just repeat the theme as the word. Return JSON: {"word": "...", "category": "..."}',
        },
        {
          role: "user",
          content: `Theme: ${theme}\nDifficulty: ${difficulty}\nAdd randomness: seed ${Math.floor(Math.random() * 1e6)}`,
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    if (res.status === 429)
      throw new AiWordError("The word generator is busy — try again in a moment.");
    if (res.status === 402) throw new AiWordError("AI credits have run out.");
    if (res.status === 403) throw new AiWordError("AI word generation is not authorized.");
    throw new AiWordError("Couldn't generate a word. Try another theme.");
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content ?? "";
  try {
    const parsed = JSON.parse(content) as AiWord;
    const word = String(parsed.word ?? "")
      .trim()
      .slice(0, 40);
    const category =
      String(parsed.category ?? "")
        .trim()
        .slice(0, 40) || theme.slice(0, 40);
    if (!word) throw new Error();
    return { word, category };
  } catch {
    throw new AiWordError("The AI gave an unexpected answer. Try again.");
  }
}

/**
 * Generates a decoy word for Double Agent mode.
 * Requirement: Imposter & crew words must match above 50% in similarity.
 */
export async function generateDoubleAgentDecoy(
  secretWord: string,
  category: string,
): Promise<string> {
  const geminiApiKey = process.env["GEMINI_API_KEY"];

  // 1. If Gemini API key is available, generate dynamically with >50% match requirement
  if (geminiApiKey) {
    try {
      const model = process.env["GEMINI_MODEL"] ?? "gemini-2.5-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;

      const prompt =
        `You are a game designer for the multiplayer party game Imposta (Double Agent mode).\n` +
        `In Double Agent mode, crew members receive a secret word, and the Double Agent imposter receives a closely-related decoy word.\n` +
        `CRITICAL REQUIREMENT: The secret word and decoy word MUST match above 50% in semantic, conceptual, and contextual similarity (e.g. Coffee & Tea, Pizza & Burger, Lion & Tiger, Airplane & Helicopter, Violin & Cello, Elephant & Mammoth, Doctor & Surgeon, Beach & Lake).\n` +
        `They must share at least 50% common traits/clues so both sides give plausible clues to each other without knowing who has what, but they must NOT be the exact same word.\n\n` +
        `Secret word: "${secretWord}"\n` +
        `Category: "${category}"\n\n` +
        `Generate a decoy word that matches "${secretWord}" with above 50% similarity.\n` +
        `Return valid JSON format:\n` +
        `{\n  "decoy": "string",\n  "similarityPercent": 75,\n  "matchReason": "string"\n}`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text) as {
            decoy?: string;
            similarityPercent?: number;
          };
          const decoy = String(parsed.decoy ?? "")
            .trim()
            .slice(0, 40);
          const similarity = Number(parsed.similarityPercent ?? 0);
          if (
            decoy &&
            decoy.toLowerCase() !== secretWord.toLowerCase() &&
            (!similarity || similarity >= 50)
          ) {
            return decoy;
          }
        }
      }
    } catch {
      // Fall through to curated table
    }
  }

  // 2. Curated counterpart check (>50% match)
  const normalized = secretWord.trim();
  const matchedKey = Object.keys(DOUBLE_AGENT_PAIRS).find(
    (k) => k.toLowerCase() === normalized.toLowerCase(),
  );

  if (matchedKey && DOUBLE_AGENT_PAIRS[matchedKey]?.length) {
    const list = DOUBLE_AGENT_PAIRS[matchedKey]!;
    return list[Math.floor(Math.random() * list.length)]!;
  }

  // 3. Reverse match check
  for (const [key, variants] of Object.entries(DOUBLE_AGENT_PAIRS)) {
    if (variants.some((v) => v.toLowerCase() === normalized.toLowerCase())) {
      return key;
    }
  }

  // 4. Default fallback
  return `Similar ${category}`;
}
