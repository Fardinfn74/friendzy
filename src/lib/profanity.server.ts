const BANNED = [
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "asshole",
  "bastard",
  "dick",
  "whore",
  "slut",
  "nigger",
  "faggot",
  "retard",
  "rape",
];

const LINKISH = /(https?:\/\/|www\.|\S+@\S+\.\S+|\+?\d[\d\s-]{7,}\d)/i;

export function checkHintText(
  raw: string,
): { ok: true; text: string } | { ok: false; reason: string } {
  const text = raw.trim().replace(/\s+/g, " ");
  if (!text) return { ok: false, reason: "Write something first." };
  if (text.length > 80) return { ok: false, reason: "Keep your clue under 80 characters." };
  if (LINKISH.test(text))
    return { ok: false, reason: "Links, emails and phone numbers aren't allowed." };
  const flat = text.toLowerCase().replace(/[^a-z]/g, "");
  if (BANNED.some((word) => flat.includes(word))) {
    return { ok: false, reason: "Let's keep it clean — try another clue." };
  }
  return { ok: true, text };
}

const flatten = (text: string) => text.toLowerCase().replace(/[^a-z]/g, "");

/** True when the text contains a word we never want on a stranger's screen. */
export function containsBannedWord(text: string): boolean {
  const flat = flatten(text);
  return BANNED.some((word) => flat.includes(word));
}

/** Names shown to other players: plain characters only, no links, nothing offensive. */
export function checkDisplayName(
  raw: string,
  max = 16,
): { ok: true; name: string } | { ok: false; reason: string } {
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length < 2) return { ok: false, reason: "Your name needs at least 2 characters." };
  if (name.length > max)
    return { ok: false, reason: `Keep your name under ${max + 1} characters.` };
  // eslint-disable-next-line no-control-regex -- control characters are exactly what we want to reject
  if (/[\u0000-\u001f<>]/.test(name))
    return { ok: false, reason: "That name has characters we can't use." };
  if (LINKISH.test(name))
    return { ok: false, reason: "Links, emails and phone numbers aren't allowed in names." };
  if (containsBannedWord(name))
    return { ok: false, reason: "Let's keep names friendly — pick another." };
  return { ok: true, name };
}

/** Hides offensive text in a chat-style feed instead of rejecting the whole message. */
export function maskBanned(text: string): string {
  return containsBannedWord(text) ? "🙈 (hidden)" : text;
}
