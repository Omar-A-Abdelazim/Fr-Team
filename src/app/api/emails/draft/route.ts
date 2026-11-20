
export const maxDuration = 60;

const json = (body: unknown, status = 200) => Response.json(body, { status });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Source = { title: string; url: string };

function parseModelJson(text: string): { subject: string; body: string; researchSummary: string } | null {
  let t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first === -1 || last === -1) return null;
  t = t.slice(first, last + 1);
  try {
    const o = JSON.parse(t) as Record<string, unknown>;
    if (typeof o.subject !== "string" || typeof o.body !== "string") return null;
    return {
      subject: o.subject.trim(),
      body: o.body.trim(),
      researchSummary: typeof o.researchSummary === "string" ? o.researchSummary.trim() : "",
    };
  } catch {
    return null;
  }
}

const FB_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyBuSIg7u4MSItU4H7c3EksLPeTdt_kN66w";
const FB_PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "ieee-met-fr-hub";

/**
 * Verifies the Firebase ID token with Google's Identity Toolkit, then reads the caller's role
 * from Firestore using their own token (the rules stop anyone from changing their role).
 */
async function verifyAdmin(token: string): Promise<{ uid: string } | { error: string; status: number }> {
  const look = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FB_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: token }),
  });
  if (!look.ok) return { error: "Your session expired. Sign in again.", status: 401 };
  const uid = ((await look.json()) as { users?: { localId?: string }[] }).users?.[0]?.localId;
  if (!uid) return { error: "Your session expired. Sign in again.", status: 401 };

  const doc = await fetch(
    `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/users/${uid}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!doc.ok) return { error: `Couldn't check your permissions (${doc.status}).`, status: 500 };
  const role = ((await doc.json()) as { fields?: { role?: { stringValue?: string } } }).fields?.role?.stringValue;
  if (role !== "admin") return { error: "Admins only.", status: 403 };
  return { uid };
}

export async function POST(req: Request) {
  try {
    return await handle(req);
  } catch (e) {
    return json({ error: `Server error: ${(e as Error).message}`.slice(0, 240) }, 500);
  }
}

async function handle(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return json({ error: "Sign in again to continue." }, 401);

  const who = await verifyAdmin(token);
  if ("error" in who) return json({ error: who.error }, who.status);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json({ error: "Gemini not configured" }, 503);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: "Request body must be JSON." }, 400);
  }
  const b = (raw ?? {}) as Record<string, unknown>;
  const purpose = typeof b.purpose === "string" ? b.purpose.trim() : "";
  if (purpose.length < 15 || purpose.length > 2000) {
    return json({ error: "Purpose must be 15 to 2000 characters." }, 400);
  }
  const refs = b.references;
  if (
    !Array.isArray(refs) ||
    refs.length < 1 ||
    refs.length > 3 ||
    !refs.every((r) => typeof r === "string" && r.trim().length > 0 && r.length <= 4000)
  ) {
    return json({ error: "Send 1 to 3 reference emails, each up to 4000 characters." }, 400);
  }
  const t = (b.target ?? {}) as Record<string, unknown>;
  const company = typeof t.company === "string" ? t.company.trim() : "";
  const email = typeof t.email === "string" ? t.email.trim() : "";
  const contactName = typeof t.contactName === "string" ? t.contactName.trim().slice(0, 120) : "";
  const context = typeof t.context === "string" ? t.context.trim().slice(0, 2000) : "";
  if (company.length < 1 || company.length > 120) return json({ error: "Company must be 1 to 120 characters." }, 400);
  if (!EMAIL_RE.test(email) || email.length > 254) return json({ error: "Target email doesn't look valid." }, 400);

  const prompt = [
    "You write outreach emails for the Fundraising team of the IEEE MET Student Branch (Egypt).",
    "",
    `Company: ${company}`,
    `Contact name: ${contactName || "(not given)"}`,
    `Notes from our team about this company: ${context || "(none)"}`,
    "",
    `Purpose of this email: ${purpose}`,
    "",
    "Reference emails that worked before (match their tone and structure):",
    ...(refs as string[]).map((r, i) => `--- Reference ${i + 1} ---\n${r.trim()}`),
    "--- End of references ---",
    "",
    "Steps:",
    "1. Use Google Search to research the company: what it does, its CSR, student and education programs, and past event sponsorships in Egypt.",
    "2. Write ONE outreach email from the IEEE MET Student Branch Fundraising team. Follow the tone and structure of the reference emails.",
    contactName ? `3. Address the contact by name (${contactName}).` : "3. No contact name is given, so use a polite generic greeting.",
    `4. Mention ${company} by name. Use at most one specific fact from your research, and never invent facts. If research finds nothing reliable, use none.`,
    "",
    'Return ONLY a JSON object, no markdown, in this shape: {"subject": string, "body": string, "researchSummary": string}',
    "researchSummary is 2 to 4 sentences on what you found, and says so plainly if you found little.",
  ].join("\n");

  // Google retires model names and the free tier often has no quota for Search grounding.
  // Try: configured model with search → same model without search → lighter model without search.
  const main = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const attempts: { model: string; search: boolean }[] = [
    { model: main, search: true },
    { model: "gemini-flash-latest", search: true },
    { model: main, search: false },
    { model: "gemini-flash-lite-latest", search: false },
  ];
  let res: Response | null = null;
  let usedSearch = true;
  for (const a of attempts) {
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${a.model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: a.search ? prompt : prompt.replace("Use Google Search to research", "From what you already know, describe") }] }],
          ...(a.search ? { tools: [{ google_search: {} }] } : {}),
        }),
        signal: AbortSignal.timeout(55_000),
      });
    } catch {
      return json({ error: "Couldn't reach Gemini. Try again." }, 502);
    }
    usedSearch = a.search;
    // 404 retired model, 429 quota, 500/503 overloaded: move on to the next option
    if (![404, 429, 500, 503].includes(res.status)) break;
    if (res.status >= 500) await new Promise((r) => setTimeout(r, 1500));
  }
  if (res && res.status >= 500) {
    return json({ error: "Gemini is busy right now. Wait a minute and try again." }, 502);
  }
  if (res && res.status === 429) {
    return json(
      { error: "Gemini's free quota is used up for now. Wait a minute and try again, or turn on billing in Google AI Studio." },
      429,
    );
  }
  if (!res) return json({ error: "Couldn't reach Gemini. Try again." }, 502);
  if (!res.ok) {
    const detail = await res
      .json()
      .then((j: { error?: { message?: string } }) => j.error?.message ?? "")
      .catch(() => "");
    return json({ error: `Gemini returned an error (${res.status}). ${detail}`.trim().slice(0, 300) }, 502);
  }

  type GeminiResponse = {
    candidates?: {
      content?: { parts?: { text?: string }[] };
      groundingMetadata?: { groundingChunks?: { web?: { title?: string; uri?: string } }[] };
    }[];
  };
  let data: GeminiResponse;
  try {
    data = (await res.json()) as GeminiResponse;
  } catch {
    return json({ error: "Gemini sent an unreadable response." }, 502);
  }

  const cand = data.candidates?.[0];
  const text = (cand?.content?.parts ?? []).map((p) => p.text ?? "").join("");
  const parsed = parseModelJson(text);
  if (!parsed) return json({ error: "Gemini didn't return a usable draft. Try again." }, 502);

  const seen = new Set<string>();
  const sources: Source[] = [];
  for (const c of cand?.groundingMetadata?.groundingChunks ?? []) {
    const url = c.web?.uri;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    sources.push({ title: c.web?.title || url, url });
    if (sources.length >= 5) break;
  }

  return json({
    subject: parsed.subject,
    body: parsed.body,
    research: {
      summary: usedSearch
        ? parsed.researchSummary
        : `Written without a live web search (free quota limit), so double-check any facts. ${parsed.researchSummary}`.trim(),
      sources,
    },
  });
}
