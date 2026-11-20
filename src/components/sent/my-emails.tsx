"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { Building2, CheckCircle2, Clock, Send, XCircle, type LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Envelope, Spark } from "@/components/auth/shapes";
import { CountUp } from "@/components/motion/count-up";
import { EmailPanel } from "@/components/sent/email-panel";
import { REPLY_META } from "@/components/sent/meta";
import { EmailsTable, buildRows, type SheetView } from "@/components/tables/emails-table";
import { useRowActions } from "@/components/tables/use-email-actions";
import { useAuth } from "@/lib/firebase/auth-context";
import { useMyEmails, useSponsors, linkEmails } from "@/lib/firebase/data";
import { cn } from "@/lib/utils";

type Tile = { key: string; label: string; color: string; value: number; icon: LucideIcon; view: SheetView; hint: string };

export function MyEmails() {
  const { profile } = useAuth();
  const uid = profile?.id;
  const { emails: rawEmails, loading } = useMyEmails(uid);
  const { sponsors } = useSponsors();
  const emails = useMemo(() => linkEmails(rawEmails, sponsors), [rawEmails, sponsors]);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [view, setView] = useState<SheetView>({ scope: "all", filter: "all" });
  const actions = useRowActions(uid, sponsors);

  const rows = useMemo(() => (uid ? buildRows(emails, sponsors, uid) : []), [emails, sponsors, uid]);
  const tiles = useMemo<Tile[]>(() => {
    const emailed = rows.filter((r) => r.email).length;
    return [
      { key: "sponsors", label: "Sponsors", color: "var(--fg)", icon: Building2, value: rows.length, view: { scope: "all", filter: "all" }, hint: "Show all sponsors" },
      { key: "emailed", label: "Emailed", color: REPLY_META.replied.color, icon: Send, value: emailed, view: { scope: "emailed", filter: "all" }, hint: "Show emailed sponsors" },
      { key: "not", label: "Not emailed yet", color: REPLY_META.waiting.color, icon: Clock, value: rows.length - emailed, view: { scope: "not_emailed", filter: "all" }, hint: "Show sponsors not emailed yet" },
      { key: "agreed", label: "Agreed", color: REPLY_META.accepted.color, icon: CheckCircle2, value: rows.filter((r) => r.reply === "accepted").length, view: { scope: "all", filter: "accepted" }, hint: "Show sponsors who agreed" },
      { key: "no", label: "Said no", color: REPLY_META.refused.color, icon: XCircle, value: rows.filter((r) => r.reply === "refused").length, view: { scope: "all", filter: "refused" }, hint: "Show sponsors who said no" },
    ];
  }, [rows]);
  const open = rows.find((r) => r.key === openKey) ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-5">
        <div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">My emails</h1>
          <p className="mt-1.5 max-w-xl text-muted">Every sponsor you logged, sent or not. Update each one when they reply.</p>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
          {tiles.map((t) => {
            const active = view.scope === t.view.scope && view.filter === t.view.filter;
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                aria-pressed={active}
                aria-label={`${t.label}: ${t.value}. ${t.hint}`}
                onClick={() => setView(t.view)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border bg-raised p-3.5 text-left transition-[border-color,box-shadow,background-color] duration-150 hover:bg-fg/[0.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky",
                  active ? "border-sky ring-2 ring-sky/40" : "border-line",
                )}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${t.color} 14%, transparent)`, color: t.color }}>
                  <Icon aria-hidden className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-2xl font-extrabold leading-none tabular-nums">
                    {loading ? <span className="inline-block h-6 w-8 animate-pulse rounded bg-fg/10" /> : <CountUp to={t.value} duration={0.9} />}
                  </span>
                  <span className="mt-1 block truncate text-xs font-medium text-muted">{t.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {loading || !uid ? (
        <div className="h-72 animate-pulse rounded-2xl border border-line bg-raised" aria-busy="true" aria-label="Loading emails" />
      ) : emails.length === 0 && !sponsors.some((s) => s.ownerId === uid) ? (
        <EmptyState />
      ) : (
        <EmailsTable emails={emails} sponsors={sponsors} ownerId={uid} actions={actions} view={view} onViewChange={setView} onOpen={(r) => setOpenKey(r.key)} />
      )}

      <EmailPanel
        row={open}
        busy={actions.busy}
        suspended={false}
        onClose={() => setOpenKey(null)}
        onReply={actions.setReply}
        onRefuse={(r, x) => void actions.saveRefusal(r, x)}
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
      <h2 className="font-display text-2xl font-bold">No sponsors yet</h2>
      <p className="mt-1.5 max-w-sm text-muted">Log a sponsor in My sponsors, then email them from here and track who replied.</p>
      <Link href="/app" className="mt-6 inline-flex h-11 items-center rounded-full bg-gold px-6 font-semibold text-[#071a33]">
        Go to My sponsors
      </Link>
    </div>
  );
}
