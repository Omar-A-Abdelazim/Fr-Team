// One entry point for AI calls. Tries Gemini first (with Google Search when asked), then Groq
// (its "compound" model can search the web too), so a quota limit or an overloaded model on one
// provider doesn't stop the team.

import { gemini, parseJson } from "./gemini";

export { parseJson };

export type AiResult =
  | { ok: true; text: string; usedSearch: boolean; sources: { title: string; url: string }[]; provider: string }
  | { ok: false; error: string; status: number };

type GroqMessage = { role: "system" | "user"; content: string };

async function groq(prompt: string, search: boolean, timeoutMs = 50_000): Promise<AiResult> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return { ok: false, error: "Groq isn't set up.", status: 503 };
  const models = search
    ? ["groq/compound", "groq/compound-mini", "openai/gpt-oss-120b"]
    : ["openai/gpt-oss-120b", "qwen/qwen3.6-27b", "openai/gpt-oss-20b"];
  let lastStatus = 502;
  for (const model of models) {
    let res: Response;
    try {
      res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }] satisfies GroqMessage[],
          temperature: 0.5,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      continue;
    }
    lastStatus = res.status;
    if (!res.ok) continue;
    const data = (await res.json().catch(() => null)) as {
      choices?: { message?: { content?: string; executed_tools?: { search_results?: { results?: { title?: string; url?: string }[] } }[] } }[];
    } | null;
    const msg = data?.choices?.[0]?.message;
    const text = msg?.content ?? "";
    if (!text) continue;
    const sources: { title: string; url: string }[] = [];
    for (const t of msg?.executed_tools ?? []) {
      for (const r of t.search_results?.results ?? []) {
        if (r.url && !sources.some((s) => s.url === r.url)) sources.push({ title: r.title || r.url, url: r.url });
        if (sources.length >= 5) break;
      }
    }
    const searched = model.startsWith("groq/compound");
    return { ok: true, text, usedSearch: searched, sources, provider: `groq:${model}` };
  }
  return {
    ok: false,
    error: lastStatus === 429 ? "The AI's free quota is used up for now. Wait a minute and try again." : "The AI is busy right now. Try again in a minute.",
    status: lastStatus === 429 ? 429 : 502,
  };
}

/**
 * Asks the AI. With `search`, the model may look things up on the web.
 * `noSearchPrompt` is used when a provider can't search (so the prompt doesn't ask for it).
 */
export async function ask(
  prompt: string,
  opts: { search?: boolean; noSearchPrompt?: string; timeoutMs?: number } = {},
): Promise<AiResult> {
  const g = await gemini(prompt, opts);
  if (g.ok) {
    // Prefer a searched answer; if Gemini could only answer without search, try Groq's search model first.
    if (!opts.search || g.usedSearch || !process.env.GROQ_API_KEY) return { ...g, provider: "gemini" };
    const q = await groq(prompt, true, opts.timeoutMs);
    if (q.ok && q.usedSearch) return q;
    return { ...g, provider: "gemini" };
  }
  const q = await groq(opts.search ? prompt : (opts.noSearchPrompt ?? prompt), !!opts.search, opts.timeoutMs);
  if (q.ok) return q;
  if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) {
    return { ok: false, error: "AI isn't set up yet (add GEMINI_API_KEY or GROQ_API_KEY).", status: 503 };
  }
  return g.status === 503 ? q : g;
}

/** Fetches a company website and returns readable text (title, description, main copy), or "" if unreachable. */
export async function readWebsite(raw: string, maxChars = 6000): Promise<string> {
  const v = raw.trim();
  if (!v) return "";
  let url: URL;
  try {
    url = new URL(v.startsWith("http") ? v : `https://${v}`);
  } catch {
    return "";
  }
  // only public web pages
  if (!/^https?:$/.test(url.protocol) || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(url.hostname)) return "";
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FRHubBot/1.0; +https://fr-team.vercel.app)" },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("text/html")) return "";
    const html = (await res.text()).slice(0, 400_000);
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
    const desc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)?.[1] ?? "";
    const body = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
    return `Title: ${title.trim()}\nDescription: ${desc.trim()}\nPage text: ${body}`.slice(0, maxChars);
  } catch {
    return "";
  }
}
