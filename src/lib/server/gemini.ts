// Gemini calls with fallbacks: Google retires model names, the free tier often has no quota for
// Search grounding, and models get overloaded. We walk a list of options until one answers.

type Part = { text?: string };
type GeminiResponse = {
  candidates?: {
    content?: { parts?: Part[] };
    groundingMetadata?: { groundingChunks?: { web?: { title?: string; uri?: string } }[] };
  }[];
};

export type GeminiResult =
  | { ok: true; text: string; usedSearch: boolean; sources: { title: string; url: string }[] }
  | { ok: false; error: string; status: number };

export async function gemini(
  prompt: string,
  opts: { search?: boolean; noSearchPrompt?: string; timeoutMs?: number } = {},
): Promise<GeminiResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, error: "AI isn't set up yet (GEMINI_API_KEY is missing).", status: 503 };

  const main = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const attempts = [
    ...(opts.search ? [{ model: main, search: true }, { model: "gemini-flash-latest", search: true }] : []),
    { model: main, search: false },
    { model: "gemini-flash-latest", search: false },
    { model: "gemini-flash-lite-latest", search: false },
  ];

  let last: Response | null = null;
  for (const a of attempts) {
    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${a.model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: a.search ? prompt : (opts.noSearchPrompt ?? prompt) }] }],
          ...(a.search ? { tools: [{ google_search: {} }] } : {}),
        }),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 50_000),
      });
    } catch {
      continue;
    }
    last = res;
    if ([404, 429, 500, 503].includes(res.status)) {
      if (res.status >= 500) await new Promise((r) => setTimeout(r, 1200));
      continue;
    }
    if (!res.ok) {
      const detail = await res
        .json()
        .then((j: { error?: { message?: string } }) => j.error?.message ?? "")
        .catch(() => "");
      return { ok: false, error: `Gemini returned an error (${res.status}). ${detail}`.trim().slice(0, 300), status: 502 };
    }
    const data = (await res.json().catch(() => null)) as GeminiResponse | null;
    const cand = data?.candidates?.[0];
    const text = (cand?.content?.parts ?? []).map((p) => p.text ?? "").join("");
    if (!text) continue;
    const seen = new Set<string>();
    const sources: { title: string; url: string }[] = [];
    for (const c of cand?.groundingMetadata?.groundingChunks ?? []) {
      const url = c.web?.uri;
      if (!url || seen.has(url)) continue;
      seen.add(url);
      sources.push({ title: c.web?.title || url, url });
      if (sources.length >= 5) break;
    }
    return { ok: true, text, usedSearch: a.search, sources };
  }

  if (last?.status === 429) {
    return { ok: false, error: "The AI's free quota is used up for now. Wait a minute and try again.", status: 429 };
  }
  return { ok: false, error: "The AI is busy right now. Wait a minute and try again.", status: 502 };
}

/** Pulls the first JSON object out of a model reply (tolerates ```json fences and extra prose). */
export function parseJson<T>(text: string): T | null {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a === -1 || b === -1) return null;
  try {
    return JSON.parse(t.slice(a, b + 1)) as T;
  } catch {
    return null;
  }
}
