import wordsList from "./words.json";
import { containsBannedWord } from "@/lib/profanity.server";

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

  if (containsBannedWord(word)) {
    return { valid: false, reason: "Let's keep it clean — try another word" };
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

/* ------------------------------------------------------------------ playable letter pairs */
let pairPool: Array<[string, string]> | null = null;
const startEnd = new Map<string, string[]>();

function buildPairIndex() {
  if (pairPool) return;
  for (const raw of wordsList as string[]) {
    const w = raw.trim().toLowerCase();
    if (w.length < 4 || !/^[a-z]+$/.test(w)) continue;
    const a = w[0]!;
    const b = w[w.length - 1]!;
    if (a === b) continue;
    const key = a < b ? a + b : b + a;
    const list = startEnd.get(key);
    if (list) list.push(w);
    else startEnd.set(key, [w]);
  }
  pairPool = [];
  for (const [key, list] of startEnd)
    if (list.length >= 40) pairPool.push([key[0]!.toUpperCase(), key[1]!.toUpperCase()]);
}

/** Letter pairs that have at least 40 valid words, so a round can never be impossible. */
export function playableLetterPairs(): Array<[string, string]> {
  buildPairIndex();
  return pairPool!;
}

/** A few real answers for a pair, shown when a round ends. */
export function exampleWordsFor(a: string, b: string, count = 3): string[] {
  buildPairIndex();
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  const list = startEnd.get(x < y ? x + y : y + x) ?? [];
  const picks: string[] = [];
  const pool = list.filter((w) => w.length <= 8);
  for (let i = 0; i < count && pool.length; i++)
    picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]!.toUpperCase());
  return picks;
}
