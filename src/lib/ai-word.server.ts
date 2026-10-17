const MODEL = process.env["AI_MODEL"] ?? "gpt-4o-mini";

type AiWord = { word: string; category: string };

export class AiWordError extends Error {}

/** Generates a themed secret word via AI Gateway or OpenAI API. */
export async function generateThemedWord(theme: string, difficulty: string): Promise<AiWord> {
  const apiKey =
    process.env["AI_GATEWAY_API_KEY"] ?? process.env["AI_API_KEY"] ?? process.env["OPENAI_API_KEY"];
  if (!apiKey) throw new AiWordError("AI word generation isn't configured yet.");

  const gatewayUrl = process.env["AI_GATEWAY_URL"] ?? "https://api.openai.com/v1/chat/completions";
  const isChatCompletions = gatewayUrl.includes("/chat/completions");

  const body = isChatCompletions
    ? {
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You pick secret words for a party game where crew players know a word and imposters only see nothing; everyone gives one-word clues. " +
              "Pick ONE well-known, concrete noun (1-2 words, family friendly) that fits the theme. It must be balanced: guessable from clues, but with many plausible neighbours so imposters can bluff. " +
              'Difficulty easy = very common; medium = familiar; hard = more specific. The category is a short 1-3 word label shown to crew. Never just repeat the theme as the word. Return JSON in format: {"word": "...", "category": "..."}',
          },
          {
            role: "user",
            content: `Theme: ${theme}\nDifficulty: ${difficulty}\nAdd randomness: seed ${Math.floor(Math.random() * 1e6)}`,
          },
        ],
        response_format: { type: "json_object" },
      }
    : {
        model: MODEL,
        stream: true,
        store: false,
        reasoning: { effort: "low", summary: "auto" },
        include: ["reasoning.encrypted_content"],
        instructions:
          "You pick secret words for a party game where crew players know a word and imposters only see nothing; everyone gives one-word clues. " +
          "Pick ONE well-known, concrete noun (1-2 words, family friendly) that fits the theme. It must be balanced: guessable from clues, but with many plausible neighbours so imposters can bluff. " +
          "Difficulty easy = very common; medium = familiar; hard = more specific. The category is a short 1-3 word label shown to crew. Never just repeat the theme as the word.",
        input: `Theme: ${theme}\nDifficulty: ${difficulty}\nAdd randomness: seed ${Math.floor(Math.random() * 1e6)}`,
        text: {
          format: {
            type: "json_schema",
            name: "secret_word",
            strict: true,
            schema: {
              type: "object",
              properties: { word: { type: "string" }, category: { type: "string" } },
              required: ["word", "category"],
              additionalProperties: false,
            },
          },
        },
      };

  const res = await fetch(gatewayUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    if (res.status === 429)
      throw new AiWordError("The word generator is busy — try again in a moment.");
    if (res.status === 402) throw new AiWordError("AI credits have run out.");
    if (res.status === 403) throw new AiWordError("AI word generation is not authorized.");
    throw new AiWordError("Couldn't generate a word. Try another theme.");
  }

  if (isChatCompletions) {
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

  if (!res.body) {
    throw new AiWordError("Couldn't generate a word. Try another theme.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const ev = JSON.parse(payload) as { type?: string; delta?: string };
        if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
      } catch {
        /* ignore partial */
      }
    }
  }

  try {
    const parsed = JSON.parse(text) as AiWord;
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
    throw new AiWordError("The AI gave an odd answer. Try again.");
  }
}
