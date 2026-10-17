import wordsList from "./words.json";

// In-memory set for O(1) instantaneous lookup
const WORD_SET: Set<string> = new Set((wordsList as string[]).map((w) => w.trim().toLowerCase()));

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
