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
