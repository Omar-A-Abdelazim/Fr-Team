import { FIRESTORE, getCaller, isFail, json } from "@/lib/server/auth";
import { ask, parseJson } from "@/lib/server/ai";
import { domainOf, normalizeName } from "@/lib/duplicates";

export const maxDuration = 60;

type Row = { id: string; name: string; owner: string; email: string; phone: string; website: string; facebook: string; linkedin: string };

const str = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const digits = (p: string) => p.replace(/\D/g, "").slice(-9);
const slug = (u: string) =>
  u
    .toLowerCase()
    .replace(/^https?:\/\/(www\.|m\.)?/, "")
    .replace(/[?#].*$/, "")
    .replace(/\/$/, "");

async function loadSponsors(token: string): Promise<Row[]> {
  const res = await fetch(`${FIRESTORE}:runQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "sponsors" }],
        select: {
          fields: ["name", "ownerName", "email", "phone", "website", "facebook", "linkedin"].map((f) => ({ fieldPath: f })),
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`Couldn't read sponsors (${res.status})`);
  const rows = (await res.json()) as { document?: { name: string; fields?: Record<string, { stringValue?: string }> } }[];
  return rows
    .filter((r) => r.document)
    .map(({ document: d }) => {
      const f = d!.fields ?? {};
      const g = (k: string) => f[k]?.stringValue ?? "";
      return {
        id: d!.name.split("/").pop()!,
        name: g("name"),
        owner: g("ownerName"),
        email: g("email"),
        phone: g("phone"),
        website: g("website"),
        facebook: g("facebook"),
        linkedin: g("linkedin"),
      };
    });
}

function bigrams(s: string) {
  return new Set(Array.from({ length: Math.max(s.length - 1, 1) }, (_, i) => s.slice(i, i + 2)));
}
function sim(a: string, b: string) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = bigrams(a);
  const B = bigrams(b);
  let hit = 0;
  A.forEach((g) => B.has(g) && hit++);
  return (2 * hit) / (A.size + B.size);
}

export async function POST(req: Request) {
  try {
    const me = await getCaller(req);
    if (isFail(me)) return json({ error: me.error }, me.status);

    const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const input = {
      name: str(b.name, 120),
      partnerType: str(b.partnerType, 30),
      email: str(b.email, 254),
      phone: str(b.phone, 40),
      website: str(b.website),
      facebook: str(b.facebook),
      linkedin: str(b.linkedin),
      description: str(b.description, 500),
    };
    if (input.name.length < 2) return json({ error: "Add the company name first." }, 400);

    const all = await loadSponsors(me.token);
    if (all.length === 0) return json({ duplicate: false, confidence: 0, reason: "No sponsors logged yet." });

    // 1) Hard matches anyone can see: same phone, email, website domain, Facebook or LinkedIn page.
    const d = domainOf(input.website) || domainOf(input.email);
    const free = /^(gmail|yahoo|hotmail|outlook|icloud)\./;
    for (const s of all) {
      const sd = domainOf(s.website) || domainOf(s.email);
      const why =
        (input.phone && s.phone && digits(input.phone).length >= 8 && digits(input.phone) === digits(s.phone) && "the same phone number") ||
        (input.email && s.email && input.email.toLowerCase() === s.email.toLowerCase() && "the same email") ||
        (d && sd && d === sd && !free.test(d) && "the same website") ||
        (input.facebook && s.facebook && slug(input.facebook) === slug(s.facebook) && "the same Facebook page") ||
        (input.linkedin && s.linkedin && slug(input.linkedin) === slug(s.linkedin) && "the same LinkedIn page");
      if (why) {
        return json({ duplicate: true, confidence: 1, matchId: s.id, matchName: s.name, matchOwner: s.owner, reason: `It has ${why} as ${s.name}, logged by ${s.owner}.` });
      }
    }

    // 2) Let the AI judge names and partial data (Arabic/English, abbreviations, brand vs legal name).
    const n = normalizeName(input.name);
    const ranked = all
      .map((s) => ({ s, score: sim(n, normalizeName(s.name)) }))
      .sort((a, b2) => b2.score - a.score)
      .slice(0, 60)
      .map(({ s }) => s);

    const prompt = [
      "You check whether a sponsor that a student fundraising team is about to log is ALREADY in their list.",
      "Two entries are the same if they are the same organization or brand in Egypt, even when written differently:",
      "Arabic vs English names, abbreviations, typos, brand vs legal name, or with/without words like Egypt, Group, Co.",
      "Different branches/subsidiaries with their own separate sponsorship decisions (e.g. a bank and its foundation) are NOT the same unless the contact details match.",
      "If you're unsure whether two names refer to the same company, use Google Search to check.",
      "",
      `New entry: ${JSON.stringify(input)}`,
      "",
      `Existing entries (id, name, owner, email, phone, website, facebook, linkedin): ${JSON.stringify(
        ranked.map((s) => [s.id, s.name, s.owner, s.email, s.phone, s.website, s.facebook, s.linkedin]),
      )}`,
      "",
      'Reply with ONLY JSON: {"duplicate": boolean, "confidence": number 0-1, "matchId": string or null, "reason": string (one short sentence for the team, naming the match)}',
    ].join("\n");

    // Fast check without web search: models know common Egyptian brands in Arabic and English.
    const r = await ask(
      prompt.replace("If you're unsure whether two names refer to the same company, use Google Search to check.", "Use what you know about companies in Egypt."),
      { timeoutMs: 12_000 },
    );
    if (!r.ok) return json({ error: r.error, checked: false }, r.status);
    const out = parseJson<{ duplicate?: boolean; confidence?: number; matchId?: string | null; reason?: string }>(r.text);
    if (!out) return json({ error: "The AI didn't return a usable answer.", checked: false }, 502);

    const match = all.find((s) => s.id === out.matchId);
    const confidence = Math.max(0, Math.min(1, Number(out.confidence) || 0));
    const duplicate = !!out.duplicate && confidence >= 0.7 && !!match;
    return json({
      duplicate,
      confidence,
      matchId: duplicate ? match!.id : null,
      matchName: duplicate ? match!.name : null,
      matchOwner: duplicate ? match!.owner : null,
      reason: String(out.reason ?? "").slice(0, 300),
    });
  } catch (e) {
    return json({ error: `Server error: ${(e as Error).message}`.slice(0, 240) }, 500);
  }
}
