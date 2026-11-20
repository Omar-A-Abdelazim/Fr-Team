"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Envelope, Spark } from "@/components/auth/shapes";
import { CountUp } from "@/components/motion/count-up";
import { EmailPanel } from "@/components/sent/email-panel";
import { REPLY_META } from "@/components/sent/meta";
import { EmailsTable } from "@/components/tables/emails-table";
import { REPLY_LABEL, useEmailActions } from "@/components/tables/use-email-actions";
import { useAuth } from "@/lib/firebase/auth-context";
import { useMyEmails, useSponsors, type EmailReply } from "@/lib/firebase/data";

const TILES: EmailReply[] = ["waiting", "replied", "accepted", "refused"];

export function MyEmails() {
  const { profile } = useAuth();
  const uid = profile?.id;
  const { emails, loading } = useMyEmails(uid);
  const { sponsors } = useSponsors();
  const [openId, setOpenId] = useState<string | null>(null);
  const { busy, change, refuse } = useEmailActions(uid, sponsors);

  const counts = useMemo(() => {
    const c: Record<EmailReply, number> = { waiting: 0, replied: 0, accepted: 0, refused: 0 };
    for (const e of emails) c[e.reply] += 1;
    return c;
  }, [emails]);

  const open = emails.find((e) => e.id === openId) ?? null;

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
              <dt className="mt-1.5 truncate text-xs font-medium text-muted sm:text-sm">{REPLY_LABEL[k]}</dt>
            </div>
          ))}
        </dl>
      </header>

      {loading || !uid ? (
        <div className="h-72 animate-pulse rounded-2xl border border-line bg-raised" aria-busy="true" aria-label="Loading emails" />
      ) : emails.length === 0 ? (
        <EmptyState />
      ) : (
        <EmailsTable emails={emails} sponsors={sponsors} ownerId={uid} onOpen={(e) => setOpenId(e.id)} />
      )}

      <EmailPanel
        email={open}
        sponsor={open ? (sponsors.find((s) => s.id === open.sponsorId) ?? null) : null}
        busy={busy}
        suspended={false}
        onClose={() => setOpenId(null)}
        onChange={change}
        onRefuse={(e, c) => void refuse(e, c)}
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
