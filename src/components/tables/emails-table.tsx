"use client";

import { motion, useReducedMotion } from "framer-motion";
import { BookOpen, ChevronDown, Search, Send } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { REPLY_META, formatSent } from "@/components/sent/meta";
import { REPLY_LABEL, useEmailActions } from "@/components/tables/use-email-actions";
import { REFUSAL_LABELS, TYPE_COLOR } from "@/lib/constants";
import type { EmailLog, EmailReply } from "@/lib/firebase/data";
import { RefusalDialog } from "@/components/member/refusal-dialog";
import type { Refusal, RefusalCategory, Sponsor, SponsorStatus } from "@/types";
import { cn } from "@/lib/utils";

type Filter = "all" | EmailReply;
type Scope = "all" | "emailed" | "not_emailed";
const SCOPES: { key: Scope; label: string }[] = [
  { key: "all", label: "All" },
  { key: "emailed", label: "Emailed" },
  { key: "not_emailed", label: "Not emailed yet" },
];

const STATUS_REPLY: Record<SponsorStatus, EmailReply> = {
  not_contacted: "waiting",
  contacted: "waiting",
  no_reply: "waiting",
  replied: "replied",
  follow_up: "replied",
  accepted: "accepted",
  closed: "accepted",
  refused: "refused",
};

/** One sheet row: a sponsor with its latest email, or a legacy email with no sponsor of the member's. */
export type SheetRow = {
  key: string;
  sponsor: Sponsor | null;
  email: EmailLog | null;
  count: number;
  company: string;
  to: string;
  sentAt: string | null;
  subject: string;
  reply: EmailReply;
  refusalCategory: RefusalCategory | "";
};

export function buildRows(emails: EmailLog[], sponsors: Sponsor[], ownerId: string): SheetRow[] {
  const mine = sponsors.filter((s) => s.ownerId === ownerId);
  const mineIds = new Set(mine.map((s) => s.id));
  const bySponsor = new Map<string, EmailLog[]>();
  const rows: SheetRow[] = [];
  for (const e of emails) {
    if (e.sponsorId && mineIds.has(e.sponsorId)) bySponsor.set(e.sponsorId, [...(bySponsor.get(e.sponsorId) ?? []), e]);
    else
      rows.push({ key: e.id, sponsor: null, email: e, count: 1, company: e.company, to: e.to, sentAt: e.sentAt, subject: e.subject, reply: e.reply, refusalCategory: e.refusalCategory ?? "" });
  }
  for (const s of mine) {
    const list = (bySponsor.get(s.id) ?? []).sort((a, b) => b.sentAt.localeCompare(a.sentAt));
    const e = list[0] ?? null;
    rows.push({
      key: s.id,
      sponsor: s,
      email: e,
      count: list.length,
      company: s.name,
      to: s.email || e?.to || "",
      sentAt: e?.sentAt ?? null,
      subject: e?.subject ?? "",
      reply: e ? e.reply : STATUS_REPLY[s.status],
      refusalCategory: s.status === "refused" ? (s.refusal?.category ?? "") : e?.reply === "refused" ? (e.refusalCategory ?? "") : "",
    });
  }
  return rows.sort((a, b) => (a.sentAt && b.sentAt ? b.sentAt.localeCompare(a.sentAt) : a.sentAt ? -1 : b.sentAt ? 1 : 0));
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "waiting", label: "Waiting" },
  { key: "replied", label: "Replied" },
  { key: "accepted", label: "Agreed" },
  { key: "refused", label: "Said no" },
];
const ORDER: EmailReply[] = ["waiting", "replied", "accepted", "refused"];
const EASE = [0.16, 1, 0.3, 1] as const;

const TH = "border-b border-r border-line px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted last:border-r-0";
const TD = "h-11 border-r border-line px-3 align-middle last:border-r-0";

function Pill({ reply }: { reply: EmailReply }) {
  return (
    <span className="inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold text-[#071a33]" style={{ background: REPLY_META[reply].color }}>
      {REPLY_LABEL[reply]}
    </span>
  );
}

function ReplySelect({ value, disabled, label, onChange }: { value: EmailReply; disabled: boolean; label: string; onChange: (r: EmailReply) => void }) {
  return (
    <span className="relative inline-flex">
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as EmailReply)}
        className="h-8 cursor-pointer appearance-none rounded-full border-0 py-0 pl-3 pr-7 text-xs font-semibold text-[#071a33] transition-opacity duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky disabled:cursor-wait disabled:opacity-60"
        style={{ background: REPLY_META[value].color }}
      >
        {ORDER.map((r) => (
          <option key={r} value={r} className="bg-bg text-fg">
            {REPLY_LABEL[r]}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-[#071a33]" />
    </span>
  );
}

export function EmailsTable({
  emails,
  sponsors,
  readOnly = false,
  ownerId,
  onOpen,
}: {
  emails: EmailLog[];
  sponsors: Sponsor[];
  readOnly?: boolean;
  ownerId: string;
  onOpen: (e: EmailLog) => void;
}) {
  const reduce = useReducedMotion();
  const { busy, change, refuse, changeSponsor, refuseSponsor } = useEmailActions(ownerId, sponsors);
  const [scope, setScope] = useState<Scope>("all");
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  // row whose refusal dialog is open
  const [refusing, setRefusing] = useState<SheetRow | null>(null);

  const all = useMemo(() => buildRows(emails, sponsors, ownerId), [emails, sponsors, ownerId]);
  const scoped = useMemo(() => all.filter((r) => scope === "all" || (scope === "emailed") === !!r.email), [all, scope]);

  const counts = useMemo(() => {
    const c: Record<EmailReply, number> = { waiting: 0, replied: 0, accepted: 0, refused: 0 };
    for (const r of scoped) c[r.reply] += 1;
    return c;
  }, [scoped]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return scoped.filter(
      (r) => (filter === "all" || r.reply === filter) && (!needle || [r.company, r.to, r.subject].some((v) => v.toLowerCase().includes(needle))),
    );
  }, [scoped, filter, q]);

  function onReply(r: SheetRow, next: EmailReply) {
    if (next === "refused") {
      if (r.reply !== "refused") setRefusing(r);
      return;
    }
    if (r.email) void change(r.email, next);
    else if (r.sponsor) void changeSponsor(r.sponsor, next, false);
  }

  async function onSaveRefusal(r: Refusal) {
    if (!refusing) return;
    const row = refusing;
    const ok = row.email ? await refuse(row.email, r) : row.sponsor ? await refuseSponsor(row.sponsor, r) : false;
    if (ok) setRefusing(null);
  }

  return (
    <div className="space-y-3">
      <div role="group" aria-label="Show sponsors by email status" className="inline-flex max-w-full overflow-x-auto rounded-full border border-line bg-raised p-1">
        {SCOPES.map((o) => (
          <button
            key={o.key}
            type="button"
            aria-pressed={scope === o.key}
            onClick={() => setScope(o.key)}
            className={cn(
              "relative inline-flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky",
              scope === o.key ? "text-[#071a33]" : "text-muted hover:text-fg",
            )}
          >
            {scope === o.key && (
              <motion.span layoutId={`emails-scope-${ownerId}`} className="absolute inset-0 -z-10 rounded-full bg-gold" transition={{ duration: reduce ? 0 : 0.2, ease: EASE }} />
            )}
            {o.label}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div role="group" aria-label="Filter by reply" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0 md:pb-0">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "relative inline-flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky",
                filter === f.key ? "text-[#071a33]" : "text-muted hover:text-fg",
              )}
            >
              {filter === f.key && (
                <motion.span layoutId={`emails-filter-${ownerId}`} className="absolute inset-0 -z-10 rounded-full bg-sky" transition={{ duration: reduce ? 0 : 0.2, ease: EASE }} />
              )}
              {f.label}
              {f.key !== "all" && <span className="ml-1.5 text-xs opacity-70">{counts[f.key]}</span>}
            </button>
          ))}
        </div>
        <label className="relative block md:w-72">
          <span className="sr-only">Search by company, address or subject</span>
          <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search company or subject"
            className="h-11 w-full rounded-full border border-line bg-raised pl-10 pr-4 text-sm placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky"
          />
        </label>
      </div>

      <div className="max-h-[70vh] overflow-auto rounded-2xl border border-line bg-raised">
        <table className="w-full min-w-[1040px] border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-10 bg-raised">
            <tr>
              <th scope="col" className={TH}>Company</th>
              <th scope="col" className={TH}>Email</th>
              <th scope="col" className={TH}>Last sent</th>
              <th scope="col" className={TH}>Subject</th>
              <th scope="col" className={TH}>{readOnly ? "Reply" : "Reply / Status"}</th>
              <th scope="col" className={TH}>Refusal reason</th>
              <th scope="col" className={cn(TH, readOnly ? "w-28" : "w-64")}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const zebra = i % 2 === 1 ? "bg-fg/[0.03]" : "";
              const canSend = !!r.sponsor?.email;
              return (
                <tr key={r.key} className={cn("group transition-colors duration-300 hover:bg-sky/10", zebra)}>
                  <th scope="row" className={cn(TD, "max-w-56 border-b border-line text-left font-semibold")}>
                    <span className="flex items-center gap-2">
                      {r.sponsor && <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: TYPE_COLOR[r.sponsor.partnerType] }} />}
                      <span className="truncate" dir="auto" title={r.company}>{r.company}</span>
                      {r.sponsor && <span className="sr-only">{r.sponsor.partnerType}</span>}
                    </span>
                  </th>
                  <td className={cn(TD, "max-w-52 border-b border-line text-muted")}>
                    <span className="block truncate" title={r.to}>{r.to || "—"}</span>
                  </td>
                  <td className={cn(TD, "whitespace-nowrap border-b border-line text-muted")}>
                    {r.sentAt ? (
                      <>
                        <time dateTime={r.sentAt}>{formatSent(r.sentAt)}</time>
                        {r.count > 1 && <span className="ml-1.5 text-xs" title={`${r.count} emails sent`}>×{r.count}</span>}
                      </>
                    ) : (
                      <span aria-label="Never sent">—</span>
                    )}
                  </td>
                  <td className={cn(TD, "max-w-64 border-b border-line")}>
                    {r.subject ? <span className="block truncate" dir="auto" title={r.subject}>{r.subject}</span> : <span className="text-muted" aria-label="No subject">—</span>}
                  </td>
                  <td className={cn(TD, "border-b border-line")}>
                    {readOnly ? (
                      <Pill reply={r.reply} />
                    ) : (
                      <ReplySelect value={r.reply} disabled={busy} label={`Reply status for ${r.company}`} onChange={(next) => onReply(r, next)} />
                    )}
                  </td>
                  <td className={cn(TD, "border-b border-line")}>
                    {r.reply !== "refused" ? (
                      <span className="text-muted" aria-label="Not applicable">—</span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <span className="text-coral">{r.refusalCategory ? REFUSAL_LABELS[r.refusalCategory] : "No reason saved"}</span>
                        {!readOnly && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setRefusing(r)}
                            aria-label={`Edit refusal for ${r.company}`}
                            className="text-xs font-semibold text-sky underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky disabled:opacity-60"
                          >
                            Edit
                          </button>
                        )}
                      </span>
                    )}
                  </td>
                  <td className={cn(TD, "border-b border-line")}>
                    <span className="flex items-center gap-2">
                      {r.email && (
                        <button
                          type="button"
                          onClick={() => onOpen(r.email!)}
                          aria-label={`Read email to ${r.company}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-semibold transition-colors duration-150 hover:bg-fg/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky"
                        >
                          <BookOpen aria-hidden className="size-3.5" />
                          Read
                        </button>
                      )}
                      {!readOnly && r.sponsor && (canSend ? (
                        <Link
                          href={`/app/emails?to=${encodeURIComponent(r.sponsor.id)}`}
                          aria-label={`Send email to ${r.company}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-sky px-3 text-xs font-semibold text-[#071a33] transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky"
                        >
                          <Send aria-hidden className="size-3.5" />
                          Send email
                        </Link>
                      ) : (
                        <button
                          type="button"
                          aria-disabled="true"
                          title="Add an email for this sponsor in My sponsors"
                          aria-label={`Send email to ${r.company} (unavailable: add an email for this sponsor in My sponsors)`}
                          onClick={(e) => e.preventDefault()}
                          className="inline-flex h-8 cursor-not-allowed items-center gap-1.5 rounded-full bg-sky px-3 text-xs font-semibold text-[#071a33] opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky"
                        >
                          <Send aria-hidden className="size-3.5" />
                          Send email
                        </button>
                      ))}
                    </span>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted">
                  Nothing matches. {filter !== "all" || scope !== "all" || q ? (
                    <button type="button" onClick={() => { setFilter("all"); setScope("all"); setQ(""); }} className="font-semibold text-sky underline underline-offset-2">
                      Clear filters
                    </button>
                  ) : null}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <RefusalDialog
        key={refusing?.key ?? "none"}
        company={refusing?.company ?? null}
        initial={refusing ? (refusing.sponsor?.refusal ?? null) : null}
        onCancel={() => setRefusing(null)}
        onSave={(r) => void onSaveRefusal(r)}
      />
    </div>
  );
}
