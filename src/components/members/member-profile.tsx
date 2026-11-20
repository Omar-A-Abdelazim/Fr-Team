"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/admin/avatar";
import { StatusBadge } from "@/components/app/shell";
import { toInput } from "@/components/insights/member-strip";
import { CountUp } from "@/components/motion/count-up";
import { SummaryPanel } from "@/components/pages/refusal-summary";
import { EmailPanel } from "@/components/sent/email-panel";
import { formatSent } from "@/components/sent/meta";
import { EmailsTable } from "@/components/tables/emails-table";
import { REFUSAL_LABELS, STATUS_META, TYPE_COLOR } from "@/lib/constants";
import { useMembers, useMyEmails, useSponsors, type EmailLog } from "@/lib/firebase/data";
import type { Sponsor, SponsorStatus } from "@/types";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;
const WAITING: SponsorStatus[] = ["not_contacted", "contacted", "no_reply", "replied", "follow_up"];
const AGREED: SponsorStatus[] = ["accepted", "closed"];

type Tab = "sponsors" | "emails" | "refusals";
const TABS: { key: Tab; label: string }[] = [
  { key: "sponsors", label: "Sponsors" },
  { key: "emails", label: "Emails" },
  { key: "refusals", label: "Refusals" },
];

type Group = "all" | "waiting" | "agreed" | "refused";
const GROUPS: { key: Group; label: string }[] = [
  { key: "all", label: "All" },
  { key: "waiting", label: "Waiting" },
  { key: "agreed", label: "Agreed" },
  { key: "refused", label: "Said no" },
];
const inGroup = (s: Sponsor, g: Group) =>
  g === "all" || (g === "waiting" && WAITING.includes(s.status)) || (g === "agreed" && AGREED.includes(s.status)) || (g === "refused" && s.status === "refused");

const TH = "border-b border-r border-line px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted last:border-r-0";
const TD = "h-11 border-b border-r border-line px-3 align-middle last:border-r-0";

function Tile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-2xl border border-line bg-raised px-3 py-3 sm:px-4">
      <dd className="font-display text-2xl font-extrabold leading-none sm:text-3xl" style={{ color }}>
        <CountUp to={value} duration={0.9} />
      </dd>
      <dt className="mt-1.5 truncate text-xs font-medium text-muted sm:text-sm">{label}</dt>
    </div>
  );
}

function updated(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function MemberProfile() {
  const { uid: raw } = useParams<{ uid: string }>();
  const uid = Array.isArray(raw) ? raw[0] : raw;
  const reduce = useReducedMotion();
  const members = useMembers();
  const { sponsors, loading } = useSponsors();
  const { emails } = useMyEmails(uid);
  const [tab, setTab] = useState<Tab>("sponsors");
  const [group, setGroup] = useState<Group>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const member = members.find((m) => m.id === uid);
  const mine = useMemo(() => sponsors.filter((s) => s.ownerId === uid), [sponsors, uid]);
  const refusals = useMemo(() => mine.filter((s) => s.status === "refused" && s.refusal), [mine]);
  const stats = useMemo(
    () => ({
      logged: mine.length,
      waiting: mine.filter((s) => WAITING.includes(s.status)).length,
      agreed: mine.filter((s) => AGREED.includes(s.status)).length,
      refused: mine.filter((s) => s.status === "refused").length,
      points: mine.filter((s) => s.approved).reduce((n, s) => n + (s.points || 0), 0),
    }),
    [mine],
  );
  const rows = mine.filter((s) => inGroup(s, group));
  const open: EmailLog | null = emails.find((e) => e.id === openId) ?? null;
  const first = member?.name.split(" ")[0] || "This member";

  const back = (
    <Link
      href="/admin/insights"
      className="inline-flex min-h-11 items-center gap-1.5 rounded-full text-sm font-medium text-muted transition-colors duration-150 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky"
    >
      <ArrowLeft aria-hidden className="size-4" />
      Refusal insights
    </Link>
  );

  if (!member) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        {back}
        {loading || members.length === 0 ? (
          <div className="h-48 animate-pulse rounded-3xl bg-raised" aria-busy="true" />
        ) : (
          <div className="rounded-3xl border border-dashed border-line p-10 text-center">
            <p className="font-display text-lg font-bold">Member not found</p>
            <p className="mt-1 text-sm text-muted">This profile doesn&apos;t exist or was removed.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {back}
      <motion.header initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }} className="space-y-5">
        <div className="flex items-center gap-4">
          <Avatar member={member} size={56} />
          <div className="min-w-0">
            <h1 className="truncate font-display text-3xl font-bold" dir="auto">
              {member.name}
            </h1>
            <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
              <span className="truncate">{member.email}</span>
              <span className="rounded-full border border-line px-2 py-0.5 text-xs font-semibold capitalize">{member.role}</span>
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
          <Tile label="Logged" value={stats.logged} color="var(--fg)" />
          <Tile label="Waiting" value={stats.waiting} color="var(--amber)" />
          <Tile label="Agreed" value={stats.agreed} color="var(--mint)" />
          <Tile label="Said no" value={stats.refused} color="var(--coral)" />
          <Tile label="Points" value={stats.points} color="var(--gold)" />
          <Tile label="Emails sent" value={emails.length} color="var(--sky)" />
        </dl>
      </motion.header>

      <div role="tablist" aria-label="Member details" className="inline-flex gap-1 rounded-full border border-line bg-raised p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            id={`tab-${t.key}`}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            aria-controls={`panel-${t.key}`}
            tabIndex={tab === t.key ? 0 : -1}
            onClick={() => setTab(t.key)}
            onKeyDown={(e) => {
              const i = TABS.findIndex((x) => x.key === tab);
              const n = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : null;
              if (n === null) return;
              e.preventDefault();
              const next = TABS[(n + TABS.length) % TABS.length].key;
              setTab(next);
              document.getElementById(`tab-${next}`)?.focus();
            }}
            className={cn(
              "relative inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky",
              tab === t.key ? "text-[#071a33]" : "text-muted hover:text-fg",
            )}
          >
            {tab === t.key && <motion.span layoutId="member-tab" className="absolute inset-0 -z-10 rounded-full bg-sky" transition={{ duration: reduce ? 0 : 0.25, ease: EASE }} />}
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          id={`panel-${tab}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab}`}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: EASE }}
        >
          {tab === "sponsors" && (
            <div className="space-y-3">
              <div role="group" aria-label="Filter sponsors by status" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
                {GROUPS.map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    aria-pressed={group === g.key}
                    onClick={() => setGroup(g.key)}
                    className={cn(
                      "relative inline-flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky",
                      group === g.key ? "text-[#071a33]" : "text-muted hover:text-fg",
                    )}
                  >
                    {group === g.key && <motion.span layoutId="member-group" className="absolute inset-0 -z-10 rounded-full bg-sky" transition={{ duration: reduce ? 0 : 0.2, ease: EASE }} />}
                    {g.label}
                    <span className="ml-1.5 text-xs opacity-70">{mine.filter((s) => inGroup(s, g.key)).length}</span>
                  </button>
                ))}
              </div>
              <div className="max-h-[70vh] overflow-auto rounded-2xl border border-line bg-raised">
                <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-sm">
                  <thead className="sticky top-0 z-10 bg-raised">
                    <tr>
                      {["Company", "Type", "Status", "Refusal reason", "What they said", "Their take", "Points", "Updated"].map((h) => (
                        <th key={h} scope="col" className={TH}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((s, i) => {
                      const m = STATUS_META[s.status];
                      return (
                        <tr key={s.id} className={cn("transition-colors duration-150 hover:bg-sky/10", i % 2 === 1 && "bg-fg/[0.03]")}>
                          <th scope="row" className={cn(TD, "max-w-48 text-left font-semibold")}>
                            <span className="block truncate" dir="auto" title={s.name}>{s.name}</span>
                          </th>
                          <td className={TD}>
                            <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-[#071a33]" style={{ background: TYPE_COLOR[s.partnerType] }}>
                              {s.partnerType}
                            </span>
                          </td>
                          <td className={TD}>
                            <StatusBadge label={m.label} color={m.color} ink={m.ink} />
                          </td>
                          <td className={cn(TD, "whitespace-nowrap")}>{s.refusal ? <span className="text-coral">{REFUSAL_LABELS[s.refusal.category]}</span> : <span className="text-muted">—</span>}</td>
                          <td className={cn(TD, "max-w-56 text-muted")}>
                            <span className="block truncate" dir="auto" title={s.refusal?.details}>{s.refusal?.details || "—"}</span>
                          </td>
                          <td className={cn(TD, "max-w-56 text-muted")}>
                            <span className="block truncate" dir="auto" title={s.refusal?.memberSelfAssessment}>{s.refusal?.memberSelfAssessment || "—"}</span>
                          </td>
                          <td className={cn(TD, "tabular-nums")}>{s.approved ? s.points : <span className="text-muted">0</span>}</td>
                          <td className={cn(TD, "whitespace-nowrap text-muted")}>
                            <time dateTime={s.updatedAt}>{updated(s.updatedAt)}</time>
                          </td>
                        </tr>
                      );
                    })}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-muted">
                          {mine.length === 0 ? `${first} hasn't logged any sponsors yet.` : "No sponsors in this group."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "emails" &&
            (emails.length === 0 ? (
              <p className="rounded-3xl border border-dashed border-line p-10 text-center text-muted">{first} hasn&apos;t sent any emails from FR Hub yet.</p>
            ) : (
              <EmailsTable readOnly ownerId={uid} emails={emails} sponsors={sponsors} onOpen={(e) => setOpenId(e.id)} />
            ))}

          {tab === "refusals" && (
            <div className="space-y-6">
              {refusals.length === 0 ? (
                <p className="rounded-3xl border border-dashed border-line p-10 text-center text-muted">No refusals from {first} yet.</p>
              ) : (
                <ul className="grid gap-3 md:grid-cols-2">
                  {refusals.map((s) => (
                    <li key={s.id} className="rounded-2xl border border-line bg-raised p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-semibold" dir="auto">{s.name}</p>
                        <span className="rounded-full bg-coral/15 px-2.5 py-0.5 text-xs font-semibold text-coral">{REFUSAL_LABELS[s.refusal!.category]}</span>
                      </div>
                      <p className="mt-3 text-sm" dir="auto">
                        <span className="text-muted">They said: </span>
                        {s.refusal!.details || "Nothing noted."}
                      </p>
                      <p className="mt-2 rounded-xl bg-gold/10 p-3 text-sm" dir="auto">
                        <span className="font-semibold">{first}&apos;s take: </span>
                        {s.refusal!.memberSelfAssessment || "Nothing noted."}
                      </p>
                      <p className="mt-2 text-xs text-muted">Updated {formatSent(s.updatedAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
              <SummaryPanel refusals={refusals.map(toInput)} subject={first} buttonLabel={`Generate summary for ${first}`} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <EmailPanel
        readOnly
        email={open}
        sponsor={open ? (sponsors.find((s) => s.id === open.sponsorId) ?? null) : null}
        busy={false}
        suspended={false}
        onClose={() => setOpenId(null)}
        onChange={() => {}}
        onRefuse={() => {}}
      />
    </div>
  );
}
