import { FIRESTORE, getCaller, isFail, json } from "@/lib/server/auth";
import { ask, parseJson, readWebsite } from "@/lib/server/ai";
import { domainOf } from "@/lib/duplicates";

export const maxDuration = 120;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FREE_MAIL = /^(gmail|yahoo|hotmail|outlook|icloud|live)\./;

type Brief = {
  overview?: string;
  offerings?: string;
  market?: string;
  momentum?: string;
  needs?: string;
  csr?: string;
  angle?: string;
  confidence?: string;
};

async function loadBranchFacts(token: string) {
  const res = await fetch(`${FIRESTORE}/settings/branch`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return "";
  return ((await res.json()) as { fields?: { facts?: { stringValue?: string } } }).fields?.facts?.stringValue ?? "";
}

async function loadSponsor(id: string, token: string) {
  if (!id) return null;
  const res = await fetch(`${FIRESTORE}/sponsors/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const f = ((await res.json()) as { fields?: Record<string, { stringValue?: string }> }).fields ?? {};
  const g = (k: string) => f[k]?.stringValue ?? "";
  return {
    ownerId: g("ownerId"),
    name: g("name"),
    partnerType: g("partnerType"),
    website: g("website"),
    email: g("email"),
    facebook: g("facebook"),
    linkedin: g("linkedin"),
    description: g("description"),
  };
}

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

  const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
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
  const sponsorId = typeof t.sponsorId === "string" ? t.sponsorId.slice(0, 64) : "";
  const hasAttachment = b.hasAttachment !== false;
  if (company.length < 1 || company.length > 120) return json({ error: "Company must be 1 to 120 characters." }, 400);
  if (!EMAIL_RE.test(email) || email.length > 254) return json({ error: "Recipient email doesn't look valid." }, 400);

  // Everything the team already knows about this sponsor, plus their own website.
  const sp = await loadSponsor(sponsorId, me.token);
  const emailDomain = domainOf(email);
  const site = sp?.website || (emailDomain && !FREE_MAIL.test(emailDomain) ? emailDomain : "");
  const siteText = await readWebsite(site);
  const known = {
    partnerType: sp?.partnerType || "",
    website: site,
    facebook: sp?.facebook || "",
    linkedin: sp?.linkedin || "",
    teamNotes: [sp?.description, context].filter(Boolean).join(" | "),
  };

  const branchFacts = await loadBranchFacts(me.token);
  const signature = [
    me.name || "FR team",
    me.position ? `${me.position}, IEEE MET Student Branch` : "Fundraising team, IEEE MET Student Branch",
    [me.email, me.phone].filter(Boolean).join(" · "),
  ].join("\n");

  // Step 1: research brief.
  const researchPrompt = (search: boolean) =>
    [
      `Build a short business brief about "${company}" (Egypt) for a student team that wants them as an event sponsor.`,
      `What we already know: ${JSON.stringify(known)}`,
      siteText ? `Text from their website:\n${siteText}` : "We couldn't read their website.",
      search
        ? "Use Google Search for: what they sell and to whom, their market position and competitors in Egypt, recent news (launches, expansion, campaigns, hiring, results), signs of how sales are going, their marketing focus and who they want to reach, and any CSR, education or youth programs and past event sponsorships."
        : "Use the website text and what you reliably know. Don't guess.",
      'Be factual. If something isn\'t known, write "unknown" rather than guessing.',
      'Return ONLY JSON: {"overview": string, "offerings": string, "market": string, "momentum": string (recent news / how business seems to be going), "needs": string (what they likely care about now, e.g. brand awareness with young people, hiring engineers, launching a product), "csr": string, "angle": string (the single most convincing reason THIS company would sponsor a 300-student engineering event), "confidence": "high"|"medium"|"low"}',
    ].join("\n\n");

  const research = await ask(researchPrompt(true), { search: true, noSearchPrompt: researchPrompt(false) });
  if (!research.ok && research.status === 503) return json({ error: research.error }, 503);
  const brief: Brief = (research.ok && parseJson<Brief>(research.text)) || {};

  // Step 2: the email.
  const writePrompt = [
    "You write sponsorship outreach emails for the Fundraising (FR) team of the IEEE MET Student Branch (Mansoura, Egypt).",
    `Sender: ${me.name || "a member of the FR team"}${me.position ? `, ${me.position}` : ""}.`,
    `Company: ${company}. Contact: ${contactName || "(no name given)"}. Partner type our team logged: ${known.partnerType || "(not set)"}.`,
    `Business brief (from research): ${JSON.stringify(brief)}`,
    `Team notes: ${known.teamNotes || "(none)"}`,
    `Facts about our branch you may use (only these, never invent numbers): ${branchFacts || "(none given: don't mention past numbers)"}`,
    `Purpose of this email: ${purpose}`,
    "Reference emails that worked before (match their tone, not their exact words):",
    ...(refs as string[]).map((r, i) => `--- Reference ${i + 1} ---\n${r.trim()}`),
    "--- End of references ---",
    "",
    "Write ONE highly personalised, professional email:",
    "- Open with ONE sentence about them (a specific, true detail from the brief tied to what they care about now), not about us. Never open with filler like \"I hope this email finds you well\", \"I am writing to\" or \"My name is\".",
    `- Build the email around ONE strong, concrete benefit for ${company} that matches their business and needs (e.g. reaching ~300 engineering students for a fintech product, hiring engineers, brand love with Gen Z). No list of perks: no booth/logo/speaking-slot laundry lists; at most one short clause about what we offer.`,
    `- Ask for the kind of partnership that fits ${company}: use the partner type logged by our team when it fits; otherwise infer it from their business (e.g. a telecom/bank/tech company → main or fund sponsor or a tech challenge; a food or beverage company → catering; a venue → hosting; an edtech → courses). Never ask a company for something unrelated to what it does (e.g. catering from a telecom).`,
    "- Use one proof point from our branch facts if available (a real number), naturally in a sentence.",
    hasAttachment ? "- Mention that our sponsorship proposal is attached." : "- Offer to send our sponsorship proposal.",
    contactName ? `- Greet ${contactName} by first name (\"Hi ${contactName.split(" ")[0]},\").` : "- No contact name: greet naturally (\"Hi there,\" or \"Hello [company] team,\"), never \"Dear Hiring Manager\" or \"To whom it may concern\".",
    `- Subject: specific to ${company} and personal (sender first name + IEEE MET + the benefit), 4 to 9 words; no ALL CAPS, emojis or exclamation marks; never generic like "Partnership opportunity".`,
    "- Plain text, short paragraphs, no links, no hype words (exclusive, don't miss, limited, free, offer, tech-savvy, synergy).",
    "- 110 to 170 words. End with one easy next step (a 15-minute call this or next week).",
    `- End with exactly this signature:\n${signature}`,
    "",
    'Return ONLY JSON: {"subject": string, "body": string}',
  ].join("\n");

  const r = await ask(writePrompt);
  if (!r.ok) return json({ error: r.error }, r.status);
  const parsed = parseJson<{ subject?: unknown; body?: unknown }>(r.text);
  if (!parsed || typeof parsed.subject !== "string" || typeof parsed.body !== "string") {
    return json({ error: "The AI didn't return a usable draft. Try again." }, 502);
  }

  const lines = [
    brief.overview && `What they do: ${brief.overview}`,
    brief.market && `Market: ${brief.market}`,
    brief.momentum && `Lately: ${brief.momentum}`,
    brief.needs && `What they likely need: ${brief.needs}`,
    brief.csr && `CSR / youth: ${brief.csr}`,
    brief.angle && `Our angle: ${brief.angle}`,
  ].filter((x): x is string => !!x && !/:\s*unknown\.?$/i.test(x));
  const searched = research.ok && research.usedSearch;
  const summary = [
    !research.ok
      ? "Couldn't research this company right now, so the email is based on your notes only. Check it before sending."
      : !searched
        ? "Researched without a live web search, so double-check any facts."
        : brief.confidence === "low"
          ? "Little reliable information was found online. Check the facts before sending."
          : "",
    siteText ? `Read their website (${site}).` : "",
    ...lines,
  ]
    .filter(Boolean)
    .join("\n");

  return json({
    subject: parsed.subject.trim(),
    body: parsed.body.trim(),
    research: { summary, sources: research.ok ? research.sources : [] },
  });
}
