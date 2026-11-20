import { getCaller, isFail, json } from "@/lib/server/auth";
import { gemini, parseJson } from "@/lib/server/gemini";

export const maxDuration = 60;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    return await handle(req);
  } catch (e) {
    return json({ error: `Server error: ${(e as Error).message}`.slice(0, 240) }, 500);
  }
}

async function handle(req: Request) {
  const me = await getCaller(req);
  if (isFail(me)) return json({ error: me.error }, me.status);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: "Request body must be JSON." }, 400);
  }
  const b = (raw ?? {}) as Record<string, unknown>;
  const purpose = typeof b.purpose === "string" ? b.purpose.trim() : "";
  if (purpose.length < 15 || purpose.length > 2000) return json({ error: "Purpose must be 15 to 2000 characters." }, 400);
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
  if (!EMAIL_RE.test(email) || email.length > 254) return json({ error: "Recipient email doesn't look valid." }, 400);

  const lines = (research: string) =>
    [
      "You write outreach emails for the Fundraising (FR) team of the IEEE MET Student Branch (Mansoura, Egypt).",
      "",
      `Company: ${company}`,
      `Contact name: ${contactName || "(not given)"}`,
      `Notes from our team about this company: ${context || "(none)"}`,
      `Sender: ${me.name || "a member of the FR team"} (${me.email}), FR team, IEEE MET Student Branch`,
      "",
      `Purpose of this email: ${purpose}`,
      "",
      "Reference emails that worked before (match their tone and structure):",
      ...(refs as string[]).map((r, i) => `--- Reference ${i + 1} ---\n${r.trim()}`),
      "--- End of references ---",
      "",
      "Steps:",
      `1. ${research}`,
      "2. Write ONE outreach email from the sender above. Follow the tone and structure of the reference emails, and sign it with the sender's name, role and email.",
      contactName ? `3. Address the contact by name (${contactName}).` : "3. No contact name is given, so use a polite generic greeting.",
      `4. Mention ${company} by name. Use at most one specific fact about the company, and never invent facts. If you aren't sure of a fact, leave it out.`,
      "",
      'Return ONLY a JSON object, no markdown, in this shape: {"subject": string, "body": string, "researchSummary": string}',
      "researchSummary is 2 to 4 sentences on what you know about the company, and says so plainly if it's little.",
    ].join("\n");

  const r = await gemini(
    lines("Use Google Search to research the company: what it does, its CSR, student and education programs, and past event sponsorships in Egypt."),
    {
      search: true,
      noSearchPrompt: lines("From what you already know, describe the company: what it does and any student or education programs."),
    },
  );
  if (!r.ok) return json({ error: r.error }, r.status === 503 ? 503 : r.status);

  const parsed = parseJson<{ subject?: unknown; body?: unknown; researchSummary?: unknown }>(r.text);
  if (!parsed || typeof parsed.subject !== "string" || typeof parsed.body !== "string") {
    return json({ error: "The AI didn't return a usable draft. Try again." }, 502);
  }
  const summary = typeof parsed.researchSummary === "string" ? parsed.researchSummary.trim() : "";

  return json({
    subject: parsed.subject.trim(),
    body: parsed.body.trim(),
    research: {
      summary: r.usedSearch ? summary : `Written without a live web search, so double-check any facts. ${summary}`.trim(),
      sources: r.sources,
    },
  });
}
