"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Envelope, Spark } from "@/components/auth/shapes";
import { CountUp } from "@/components/motion/count-up";
import { RefusalDialog } from "@/components/member/refusal-dialog";
import { EmailPanel } from "@/components/sent/email-panel";
import { REPLY_META, formatSent } from "@/components/sent/meta";
import { useAuth } from "@/lib/firebase/auth-context";
import { setEmailReply, setStatus, useMyEmails, useSponsors, type EmailLog, type EmailReply } from "@/lib/firebase/data";
import type { Refusal } from "@/types";
import { cn } from "@/lib/utils";

type Filter = "all" | EmailReply;
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "waiting", label: "Waiting" },
  { key: "replied", label: "Replied" },
  { key: "accepted", label: "Accepted" },
  { key: "refused", label: "Refused" },
];
const TILES: EmailReply[] = ["waiting", "replied", "accepted", "refused"];

export function ReplyBadge({ reply }: { reply: EmailReply }) {
  const m = REPLY_META[reply];
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: m.color, color: "#071a33" }}>
      {m.label}
    </span>
  );
}

export function MyEmails() {
  const { profile } = useAuth();
  const uid = profile?.id;
  const { emails, loading } = useMyEmails(uid);
  const { sponsors } = useSponsors();
  const reduce = useReducedMotion();
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [refusing, setRefusing] = useState<EmailLog | null>(null);
  const [busy, setBusy] = useState(false);

  const counts = useMemo(() => {
    const c: Record<EmailReply, number> = { waiting: 0, replied: 0, accepted: 0, refused: 0 };
    for (const e of emails) c[e.reply] += 1;
    return c;
  }, [emails]);

  const rows = filter === "all" ? emails : emails.filter((e) => e.reply === filter);
  const open = emails.find((e) => e.id === openId) ?? null;
  const sponsorOf = (e: EmailLog) => sponsors.find((s) => s.id === e.sponsorId) ?? null;

  async function change(email: EmailLog, reply: EmailReply) {
    if (!uid || reply === email.reply || busy) return;
    const sponsor = sponsorOf(email);
    if (reply === "refused" && sponsor && sponsor.ownerId === uid) return setRefusing(email);
    setBusy(true);
    try {
      await setEmailReply(email, reply, sponsor, uid);
      if (reply === "accepted") {
        const { default: confetti } = await import("canvas-confetti");
        confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 }, colors: ["#f5b83d", "#4cc3f2", "#3dd6a3", "#ffffff"] });
        toast.success("Deal won!", { description: `${email.company} agreed. Nice work!` });
      } else {
        toast.success(`Marked as ${REPLY_META[reply].label.toLowerCase()}`);
      }
    } catch {
      toast.error(`Couldn't update the email to ${email.company}. Check your connection and try again.`);
    } finally {
      setBusy(false);
    }
  }

  async function saveRefusal(email: EmailLog, refusal: Refusal) {
    const sponsor = sponsorOf(email);
    if (!uid || !sponsor) return;
    setRefusing(null);
    setBusy(true);
    try {
      await setStatus(sponsor.id, "refused", uid, refusal);
      await setEmailReply(email, "refused");
      toast.success("Saved. Thanks for noting why.", { description: `${email.company} marked as refused.` });
    } catch {
      toast.error(`Couldn't save the refusal for ${email.company}. Check your connection and try again.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">My emails</h1>
          <p className="mt-1.5 max-w-md text-muted">Everything you sent from FR Hub. Update each one when they reply.</p>
        </div>
        <dl className="grid grid-cols-4 gap-2 sm:gap-3 lg:w-[26rem]">
          {TILES.map((k) => (
            <div key={k} className="rounded-2xl border border-line bg-raised px-2.5 py-3 sm:px-4">
              <dd className="font-display text-2xl font-extrabold leading-none sm:text-3xl" style={{ color: REPLY_META[k].color }}>
                {loading ? <span className="inline-block h-6 w-6 animate-pulse rounded bg-fg/10" /> : <CountUp to={counts[k]} duration={0.9} />}
              </dd>
              <dt className="mt-1.5 truncate text-xs font-medium text-muted sm:text-sm">{REPLY_META[k].label}</dt>
            </div>
          ))}
        </dl>
      </header>

      <div role="group" aria-label="Filter emails by reply" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "relative inline-flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-medium transition-colors duration-150",
              filter === f.key ? "text-[#071a33]" : "text-muted hover:text-fg",
            )}
          >
            {filter === f.key && (
              <motion.span layoutId="sent-filter" className="absolute inset-0 -z-10 rounded-full bg-sky" transition={{ duration: reduce ? 0 : 0.2 }} />
            )}
            {f.label}
            {f.key !== "all" && <span className="ml-1.5 text-xs opacity-70">{counts[f.key]}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading emails">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="h-44 animate-pulse rounded-3xl border border-line bg-raised" />
          ))}
        </ul>
      ) : emails.length === 0 ? (
        <EmptyState />
      ) : rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line p-10 text-center">
          <p className="font-display text-lg font-bold">Nothing here</p>
          <p className="mt-1 text-sm text-muted">No emails are marked {filter === "all" ? "" : REPLY_META[filter].label.toLowerCase()} right now.</p>
          <button type="button" onClick={() => setFilter("all")} className="mt-4 h-11 rounded-full border border-line px-5 text-sm font-semibold hover:bg-fg/5">
            Show all emails
          </button>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((e, i) => (
            <motion.li
              key={e.id}
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(i, 8) * 0.04, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.button
                type="button"
                onClick={() => setOpenId(e.id)}
                whileHover={reduce ? undefined : { y: -4 }}
                whileTap={{ scale: 0.99 }}
                className="group relative flex h-full min-h-44 w-full flex-col rounded-3xl border border-line bg-raised p-5 text-left transition-shadow duration-200 hover:shadow-[0_18px_40px_-20px_var(--glow)]"
              >
                <motion.span
                  aria-hidden
                  className="absolute right-4 top-4 opacity-80"
                  animate={reduce ? undefined : { y: [0, -3, 0], rotate: [0, -4, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: (i % 5) * 0.4 }}
                >
                  <Envelope size={34} />
                </motion.span>
                <span className="pr-12 font-display text-xl font-bold leading-tight break-words">{e.company}</span>
                <span className="mt-1 truncate text-sm text-muted">{e.to}</span>
                <span className="mt-3 line-clamp-1 text-sm" dir="auto">
                  {e.subject}
                </span>
                <span className="mt-auto flex items-center justify-between gap-2 pt-4">
                  <ReplyBadge reply={e.reply} />
                  <time dateTime={e.sentAt} className="text-xs text-muted">
                    {formatSent(e.sentAt)}
                  </time>
                </span>
              </motion.button>
            </motion.li>
          ))}
        </ul>
      )}

      <EmailPanel
        email={open}
        sponsor={open ? sponsorOf(open) : null}
        busy={busy}
        onClose={() => setOpenId(null)}
        onChange={change}
        suspended={!!refusing}
      />

      <RefusalDialog
        company={refusing?.company ?? null}
        onCancel={() => setRefusing(null)}
        onSave={(r) => refusing && saveRefusal(refusing, r)}
      />
    </div>
  );
}

function EmptyState() {
  const reduce = useReducedMotion();
  return (
    <div className="grid place-items-center rounded-3xl border border-dashed border-line px-6 py-16 text-center">
      <div className="relative mb-6 h-24 w-36">
        <motion.div
          className="absolute left-1/2 top-2 -translate-x-1/2"
          animate={reduce ? undefined : { y: [0, -8, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <Envelope size={92} />
        </motion.div>
        <motion.div className="absolute right-0 top-0" animate={reduce ? undefined : { scale: [1, 1.25, 1], rotate: [0, 20, 0] }} transition={{ duration: 2.4, repeat: Infinity }}>
          <Spark size={26} color="var(--gold)" />
        </motion.div>
        <motion.div className="absolute bottom-1 left-1" animate={reduce ? undefined : { scale: [1, 1.3, 1] }} transition={{ duration: 2.8, repeat: Infinity, delay: 0.6 }}>
          <Spark size={16} />
        </motion.div>
      </div>
      <h2 className="font-display text-2xl font-bold">You haven&apos;t sent anything yet</h2>
      <p className="mt-1.5 max-w-sm text-muted">Emails you send from FR Hub show up here, so you can track who replied.</p>
      <Link href="/app/emails" className="mt-6 inline-flex h-11 items-center rounded-full bg-gold px-6 font-semibold text-[#071a33]">
        Write your first email
      </Link>
    </div>
  );
}
