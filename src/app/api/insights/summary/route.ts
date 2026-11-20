import { getCaller, isFail, json } from "@/lib/server/auth";
import { gemini, parseJson } from "@/lib/server/gemini";

export const maxDuration = 60;

type Refusal = {
  company: string;
  partnerType: string;
  ownerName: string;
  category: string;
  details: string;
  selfAssessment: string;
};

type Summary = {
  summary: string;
  topReasons: { reason: string; share: number; examples: string[] }[];
  rootCauses: string[];
  coaching: { member: string; note: string }[];
  actions: string[];
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request) {
  try {
    const me = await getCaller(req, { admin: true });
    if (isFail(me)) return json({ error: me.error }, me.status);

    const body = (await req.json().catch(() => null)) as { refusals?: unknown } | null;
    const list = Array.isArray(body?.refusals) ? body!.refusals : [];
    const refusals: Refusal[] = list.slice(0, 300).map((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      return {
        company: str(o.company, 120),
        partnerType: str(o.partnerType, 30),
        ownerName: str(o.ownerName, 60),
        category: str(o.category, 40),
        details: str(o.details, 500),
        selfAssessment: str(o.selfAssessment, 500),
      };
    });
    if (refusals.length < 3) return json({ error: "Needs at least 3 refusals to find patterns." }, 400);

    const prompt = [
      "You coach the Fundraising (FR) team of an IEEE student branch in Egypt. Below are sponsor refusals the team logged:",
      "each has the company, partner type, the member who handled it, the refusal category, what the sponsor said,",
      "and the member's own view of why they couldn't convince them.",
      "",
      JSON.stringify(refusals),
      "",
      "Find the real patterns. Be specific and practical, base everything on the data, and don't invent facts.",
      "Coaching notes must be kind and constructive, one per member who appears in the data (max 8).",
      "Return ONLY JSON, no markdown, in this shape:",
      '{"summary": string (2-3 sentences), "topReasons": [{"reason": string, "share": number 0-100, "examples": [string, up to 2 short quotes or paraphrases]}] (max 5, shares roughly add to 100), "rootCauses": [string] (max 4: where the pitch breaks), "coaching": [{"member": string, "note": string}], "actions": [string] (max 5 concrete changes for the next outreach round)}',
    ].join("\n");

    const r = await gemini(prompt);
    if (!r.ok) return json({ error: r.error }, r.status);
    const s = parseJson<Summary>(r.text);
    if (!s || typeof s.summary !== "string") return json({ error: "The AI didn't return a usable summary. Try again." }, 502);

    return json({
      summary: s.summary,
      topReasons: (Array.isArray(s.topReasons) ? s.topReasons : []).slice(0, 5).map((t) => ({
        reason: String(t.reason ?? ""),
        share: Math.max(0, Math.min(100, Number(t.share) || 0)),
        examples: (Array.isArray(t.examples) ? t.examples : []).slice(0, 2).map(String),
      })),
      rootCauses: (Array.isArray(s.rootCauses) ? s.rootCauses : []).slice(0, 4).map(String),
      coaching: (Array.isArray(s.coaching) ? s.coaching : []).slice(0, 8).map((c) => ({
        member: String(c.member ?? ""),
        note: String(c.note ?? ""),
      })),
      actions: (Array.isArray(s.actions) ? s.actions : []).slice(0, 5).map(String),
    });
  } catch (e) {
    return json({ error: `Server error: ${(e as Error).message}`.slice(0, 240) }, 500);
  }
}
