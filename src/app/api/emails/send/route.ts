import nodemailer from "nodemailer";
import { FIRESTORE, getCaller, isFail, json } from "@/lib/server/auth";

export const maxDuration = 30;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAILY_LIMIT = Number(process.env.MAIL_DAILY_LIMIT) || 50;

function today() {
  // Cairo calendar day, so the daily limit resets at local midnight
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
}

async function sentToday(uid: string, token: string, day: string) {
  const res = await fetch(`${FIRESTORE}:runAggregationQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      structuredAggregationQuery: {
        structuredQuery: {
          from: [{ collectionId: "emailLogs" }],
          where: {
            compositeFilter: {
              op: "AND",
              filters: [
                { fieldFilter: { field: { fieldPath: "senderId" }, op: "EQUAL", value: { stringValue: uid } } },
                { fieldFilter: { field: { fieldPath: "day" }, op: "EQUAL", value: { stringValue: day } } },
              ],
            },
          },
        },
        aggregations: [{ alias: "n", count: {} }],
      },
    }),
  });
  if (!res.ok) return 0; // don't block sending if the counter can't be read
  const rows = (await res.json()) as { result?: { aggregateFields?: { n?: { integerValue?: string } } } }[];
  return Number(rows[0]?.result?.aggregateFields?.n?.integerValue ?? 0);
}

export async function POST(req: Request) {
  try {
    const me = await getCaller(req);
    if (isFail(me)) return json({ error: me.error }, me.status);

    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
    if (!user || !pass) {
      return json({ error: "Sending from the site isn't set up yet. Use Copy or Open in Gmail for now." }, 503);
    }

    const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const to = typeof b.to === "string" ? b.to.trim() : "";
    const subject = typeof b.subject === "string" ? b.subject.trim() : "";
    const text = typeof b.body === "string" ? b.body.trim() : "";
    const company = typeof b.company === "string" ? b.company.trim().slice(0, 120) : "";
    const sponsorId = typeof b.sponsorId === "string" ? b.sponsorId.slice(0, 64) : "";
    if (!EMAIL_RE.test(to) || to.length > 254) return json({ error: "The recipient's email doesn't look valid." }, 400);
    if (!subject || subject.length > 200) return json({ error: "Add a subject (up to 200 characters)." }, 400);
    if (!text || text.length > 20000) return json({ error: "The email body is empty or too long." }, 400);

    const day = today();
    if ((await sentToday(me.uid, me.token, day)) >= DAILY_LIMIT) {
      return json({ error: `You've sent ${DAILY_LIMIT} emails today, the daily limit. Try again tomorrow.` }, 429);
    }

    const transport = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass },
    });
    const fromName = `${me.name || "IEEE MET"} | IEEE MET FR`;
    let messageId = "";
    try {
      const info = await transport.sendMail({
        from: { name: fromName, address: user },
        to,
        replyTo: me.email ? { name: me.name, address: me.email } : undefined,
        bcc: me.email || undefined, // sender keeps a copy in their own inbox
        subject,
        text,
      });
      messageId = info.messageId ?? "";
    } catch (e) {
      const msg = (e as Error).message;
      if (/Invalid login|Username and Password not accepted|535/i.test(msg)) {
        return json({ error: "Gmail rejected the app password. Ask the FR Head to check GMAIL_USER and GMAIL_APP_PASSWORD." }, 502);
      }
      return json({ error: `Gmail couldn't send it: ${msg}`.slice(0, 240) }, 502);
    }

    // Log it with the sender's own token (rules only allow logging your own sends).
    await fetch(`${FIRESTORE}/emailLogs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${me.token}` },
      body: JSON.stringify({
        fields: {
          senderId: { stringValue: me.uid },
          senderName: { stringValue: me.name },
          to: { stringValue: to },
          company: { stringValue: company },
          sponsorId: { stringValue: sponsorId },
          subject: { stringValue: subject },
          body: { stringValue: text },
          reply: { stringValue: "waiting" },
          day: { stringValue: day },
          sentAt: { timestampValue: new Date().toISOString() },
        },
      }),
    }).catch(() => undefined);

    return json({ ok: true, messageId });
  } catch (e) {
    return json({ error: `Server error: ${(e as Error).message}`.slice(0, 240) }, 500);
  }
}
