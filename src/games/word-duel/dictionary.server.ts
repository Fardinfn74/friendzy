import wordsList from "./words.json";

// In-memory set for O(1) instantaneous lookup
const WORD_SET: Set<string> = new Set((wordsList as string[]).map((w) => w.trim().toLowerCase()));

/**
 * Pre-indexes letter pairs that have at least MIN_WORDS_PER_PAIR valid dictionary words.
 * This guarantees a 100% chance for players to form multiple valid English words.
 */
const MIN_WORDS_PER_PAIR = 15;
const PAIR_WORD_COUNTS: Map<string, number> = new Map();

function computeSolvableLetterPairs(): Array<[string, string]> {
  for (const w of wordsList as string[]) {
    const clean = w.trim().toLowerCase();
    if (clean.length >= 3 && /^[a-z]+$/.test(clean)) {
      const a = clean[0]!.toUpperCase();
      const b = clean[clean.length - 1]!.toUpperCase();
      if (a !== b) {
        const key = a < b ? `${a}${b}` : `${b}${a}`;
        PAIR_WORD_COUNTS.set(key, (PAIR_WORD_COUNTS.get(key) || 0) + 1);
      }
    }
  }
  const result: Array<[string, string]> = [];
  for (const [key, count] of PAIR_WORD_COUNTS.entries()) {
    if (count >= MIN_WORDS_PER_PAIR) {
      result.push([key[0]!, key[1]!]);
    }
  }
  return result;
}

export const SOLVABLE_LETTER_PAIRS: Array<[string, string]> = computeSolvableLetterPairs();

export function countWordsForLetterPair(letterA: string, letterB: string): number {
  const l1 = letterA.trim().toUpperCase();
  const l2 = letterB.trim().toUpperCase();
  const key = l1 < l2 ? `${l1}${l2}` : `${l2}${l1}`;
  return PAIR_WORD_COUNTS.get(key) ?? 0;
}

/**
 * Checks if a word exists in the bundled English dictionary
 */
export function isEnglishWord(word: string): boolean {
  if (!word) return false;
  return WORD_SET.has(word.trim().toLowerCase());
}

/**
 * Validates a Word Duel attempt according to all game rules:
 * 1. At least 3 letters
 * 2. Only alphabetical characters
 * 3. Starts with one letter and ends with the other (or starts and ends with same letter if pair matches)
 * 4. Must exist in the bundled English dictionary
 */
export function validateWordDuelAttempt(
  rawWord: string,
  letterA: string,
  letterB: string,
): { valid: boolean; reason?: string; normalizedWord?: string } {
  const word = rawWord.trim().toLowerCase();
  const l1 = letterA.trim().toLowerCase();
  const l2 = letterB.trim().toLowerCase();

  if (!word || word.length < 3) {
    return { valid: false, reason: "Too short (minimum 3 letters)" };
  }

  if (!/^[a-z]+$/.test(word)) {
    return { valid: false, reason: "Letters only (no spaces or numbers)" };
  }

  const first = word[0];
  const last = word[word.length - 1];

  if (l1 === l2) {
    if (first !== l1 || last !== l1) {
      return {
        valid: false,
        reason: `Must start AND end with ${l1.toUpperCase()}`,
      };
    }
  } else {
    const validEndpoints = (first === l1 && last === l2) || (first === l2 && last === l1);
    if (!validEndpoints) {
      return {
        valid: false,
        reason: `Must start with ${l1.toUpperCase()} and end with ${l2.toUpperCase()} (or vice-versa)`,
      };
    }
  }

  if (!isEnglishWord(word)) {
    return { valid: false, reason: `"${word.toUpperCase()}" is not in the dictionary` };
  }

  return { valid: true, normalizedWord: word.toUpperCase() };
}
