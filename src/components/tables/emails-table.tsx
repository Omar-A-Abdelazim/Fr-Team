"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Eye, Search, Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Envelope } from "@/components/auth/shapes";
import { formatExact, formatRelative } from "@/components/sent/meta";
import { StatusPill, StatusSelect, TypeAvatar } from "@/components/tables/status-select";
import { REFUSAL_LABELS } from "@/lib/constants";
import type { EmailLog, EmailReply } from "@/lib/firebase/data";
import { RefusalDialog } from "@/components/member/refusal-dialog";
import type { Refusal, RefusalCategory, Sponsor, SponsorStatus } from "@/types";
import { cn } from "@/lib/utils";

export type Filter = "all" | EmailReply;
export type Scope = "all" | "emailed" | "not_emailed";
export type SheetView = { scope: Scope; filter: Filter };
export type RowActions = {
  busy: boolean;
  /** Any reply except "refused" (that one goes through the refusal dialog). */
  setReply: (row: SheetRow, reply: EmailReply) => void;
  saveRefusal: (row: SheetRow, r: Refusal) => Promise<boolean>;
};

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

export const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All replies" },
  { key: "waiting", label: "Waiting" },
  { key: "replied", label: "Replied" },
  { key: "accepted", label: "Agreed" },
  { key: "refused", label: "Said no" },
];
const EASE = [0.16, 1, 0.3, 1] as const;
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky";

const TH = "border-b border-line px-4 py-3 text-left text-xs font-semibold text-muted whitespace-nowrap";
const TD = "h-14 border-b border-line px-4 align-middle";

function IconAction({ label, children, className, ...rest }: { label: string; children: React.ReactNode; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" aria-label={label} {...rest} className={cn("group/tip relative grid size-9 place-items-center rounded-full transition-colors duration-150", FOCUS, className)}>
      {children}
      <span
        role="presentation"
        className="pointer-events-none absolute right-full top-1/2 z-20 mr-2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-fg px-2 py-1 text-xs font-medium text-bg opacity-0 transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-visible/tip:opacity-100"
      >
        {label}
      </span>
    </button>
  );
}

function SendAction({ row, tip }: { row: SheetRow; tip: boolean }) {
  const s = row.sponsor;
  if (!s) return null;
  const cls = "bg-sky/15 text-sky hover:bg-sky/25";
  if (!s.email)
    return (
      <IconAction
        label="Add an email in My sponsors to send"
        aria-disabled="true"
        onClick={(e) => e.preventDefault()}
        className={cn(cls, "cursor-not-allowed opacity-40", !tip && "hidden")}
      >
        <Send aria-hidden className="size-4" />
      </IconAction>
    );
  return (
    <Link
      href={`/app/emails?to=${encodeURIComponent(s.id)}`}
      aria-label={`Send email to ${row.company}`}
      className={cn("group/tip relative grid size-9 place-items-center rounded-full transition-colors duration-150", cls, FOCUS)}
    >
      <Send aria-hidden className="size-4" />
      <span role="presentation" className="pointer-events-none absolute right-full top-1/2 z-20 mr-2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-fg px-2 py-1 text-xs font-medium text-bg opacity-0 transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-visible/tip:opacity-100">
        Send email
      </span>
    </Link>
  );
}

function RefusalChip({ row, readOnly, busy, onEdit }: { row: SheetRow; readOnly: boolean; busy: boolean; onEdit: () => void }) {
  if (row.reply !== "refused") return <span className="text-muted" aria-label="Not applicable">—</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-block h-7 max-w-[118px] truncate whitespace-nowrap rounded-full leading-7 bg-coral/15 px-2.5 text-xs font-semibold text-coral" title={row.refusalCategory ? REFUSAL_LABELS[row.refusalCategory] : undefined}>
        {row.refusalCategory ? REFUSAL_LABELS[row.refusalCategory] : "No reason saved"}
      </span>
      {!readOnly && (
        <button type="button" disabled={busy} onClick={onEdit} aria-label={`Edit refusal for ${row.company}`} className={cn("text-xs font-semibold text-sky hover:underline disabled:opacity-60", FOCUS)}>
          Edit
        </button>
      )}
    </span>
  );
}

function LastSent({ row }: { row: SheetRow }) {
  if (!row.sentAt) return <span className="text-muted" aria-label="Never sent">Not sent</span>;
  return (
    <>
      <time dateTime={row.sentAt} title={formatExact(row.sentAt)}>{formatRelative(row.sentAt)}</time>
      {row.count > 1 && <span className="ml-1.5 text-xs" title={`${row.count} emails sent`}>×{row.count}</span>}
    </>
  );
}

function FilteredEmpty({ readOnly, filtered, onClear }: { readOnly: boolean; filtered: boolean; onClear: () => void }) {
  return (
    <div className="grid place-items-center px-6 py-14 text-center">
      <div className="mb-4 opacity-90"><Envelope size={64} /></div>
      <h3 className="font-display text-lg font-bold">{filtered ? "No sponsors match" : "Nothing here yet"}</h3>
      <p className="mt-1 max-w-xs text-sm text-muted">
        {filtered ? "Try a different filter or search term." : readOnly ? "This member has not logged any sponsors." : "Log a sponsor to see it here."}
      </p>
      {filtered && (
        <button type="button" onClick={onClear} className={cn("mt-4 inline-flex h-10 items-center rounded-full bg-sky px-5 text-sm font-semibold text-[#071a33] transition-opacity hover:opacity-90", FOCUS)}>
          Clear filters
        </button>
      )}
    </div>
  );
}

export function EmailsTable({
  emails,
  sponsors,
  readOnly = false,
  ownerId,
  onOpen,
  actions,
  view: viewProp,
  onViewChange,
}: {
  emails: EmailLog[];
  sponsors: Sponsor[];
  readOnly?: boolean;
  ownerId: string;
  onOpen: (row: SheetRow) => void;
  actions?: RowActions;
  /** Controlled filters (so stat tiles can drive them). Omit for internal state. */
  view?: SheetView;
  onViewChange?: (v: SheetView) => void;
}) {
  const reduce = useReducedMotion();
  const [inner, setInner] = useState<SheetView>({ scope: "all", filter: "all" });
  const view = viewProp ?? inner;
  const setView = onViewChange ?? setInner;
  const { scope, filter } = view;
  const [q, setQ] = useState("");
  const [refusing, setRefusing] = useState<SheetRow | null>(null);
  const busy = actions?.busy ?? false;

  // stagger rows in only on first load
  const [intro, setIntro] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setIntro(false), 900);
    return () => clearTimeout(t);
  }, []);

  const all = useMemo(() => buildRows(emails, sponsors, ownerId), [emails, sponsors, ownerId]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter(
      (r) =>
        (scope === "all" || (scope === "emailed") === !!r.email) &&
        (filter === "all" || r.reply === filter) &&
        (!needle || [r.company, r.to, r.subject].some((v) => v.toLowerCase().includes(needle))),
    );
  }, [all, scope, filter, q]);
  const filtered = scope !== "all" || filter !== "all" || !!q;
  const clear = () => { setView({ scope: "all", filter: "all" }); setQ(""); };

  function onReply(r: SheetRow, next: EmailReply) {
    if (next === "refused") {
      if (r.reply !== "refused") setRefusing(r);
      return;
    }
    actions?.setReply(r, next);
  }
  async function onSaveRefusal(r: Refusal) {
    if (!refusing || !actions) return;
    if (await actions.saveRefusal(refusing, r)) setRefusing(null);
  }

  const rowAnim = (i: number) => ({
    initial: intro && !reduce ? { opacity: 0, y: 6 } : false,
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.25, ease: EASE, delay: intro ? Math.min(i, 12) * 0.03 : 0 },
  } as const);

  const status = (r: SheetRow) =>
    readOnly || !actions ? <StatusPill reply={r.reply} /> : <StatusSelect value={r.reply} disabled={busy} label={`Status for ${r.company}`} onChange={(n) => onReply(r, n)} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Show sponsors by email status" className="inline-flex max-w-full overflow-x-auto rounded-full border border-line bg-raised p-1">
          {SCOPES.map((o) => (
            <button
              key={o.key}
              type="button"
              aria-pressed={scope === o.key}
              onClick={() => setView({ ...view, scope: o.key })}
              className={cn("relative isolate inline-flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-medium transition-colors duration-150", FOCUS, scope === o.key ? "text-[#071a33]" : "text-muted hover:text-fg")}
            >
              {scope === o.key && <motion.span layoutId={`emails-scope-${ownerId}`} className="absolute inset-0 -z-10 rounded-full bg-gold" transition={{ duration: reduce ? 0 : 0.2, ease: EASE }} />}
              {o.label}
            </button>
          ))}
        </div>
        <label className="relative">
          <span className="sr-only">Filter by reply</span>
          <select
            value={filter}
            onChange={(e) => setView({ ...view, filter: e.target.value as Filter })}
            className={cn("h-11 cursor-pointer appearance-none rounded-full border border-line bg-raised pl-4 pr-9 text-sm font-medium", FOCUS)}
          >
            {FILTERS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          <svg aria-hidden viewBox="0 0 20 20" className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted"><path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </label>
        <label className="relative min-w-48 flex-1 sm:max-w-xs">
          <span className="sr-only">Search by company, address or subject</span>
          <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search company or subject"
            className={cn("h-11 w-full rounded-full border border-line bg-raised pl-10 pr-4 text-sm placeholder:text-muted", FOCUS)}
          />
        </label>
        <p className="ml-auto text-sm text-muted" aria-live="polite">
          {rows.length === all.length ? `${all.length} ${all.length === 1 ? "sponsor" : "sponsors"}` : `${rows.length} of ${all.length}`}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-line bg-raised">
          <FilteredEmpty readOnly={readOnly} filtered={filtered} onClear={clear} />
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden max-h-[70vh] overflow-auto rounded-2xl border border-line bg-raised md:block">
            <table className="w-full min-w-[900px] table-fixed border-separate border-spacing-0 text-sm">
              <colgroup>
                <col className="w-[22%]" />
                <col className="w-[17%]" />
                <col className="w-[10%]" />
                <col />
                <col className="w-[120px]" />
                <col className="w-[170px]" />
                <col className="w-[104px]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-raised/95 backdrop-blur">
                <tr>
                  <th scope="col" className={TH}>Company</th>
                  <th scope="col" className={TH}>Email</th>
                  <th scope="col" className={TH}>Last sent</th>
                  <th scope="col" className={TH}>Subject</th>
                  <th scope="col" className={TH}>Status</th>
                  <th scope="col" className={TH}>Refusal reason</th>
                  <th scope="col" className={cn(TH, "w-32 pr-6 text-right")}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <motion.tr key={r.key} {...rowAnim(i)} className="group transition-colors duration-150 hover:bg-fg/[0.03]">
                    <th scope="row" className={cn(TD, "text-left font-normal")}>
                      <span className="flex items-center gap-3">
                        <TypeAvatar name={r.company} type={r.sponsor?.partnerType} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold" dir="auto" title={r.company}>{r.company}</span>
                          <span className="block truncate text-xs text-muted">{r.sponsor?.partnerType ?? "Email only"}</span>
                        </span>
                      </span>
                    </th>
                    <td className={cn(TD, "max-w-52 text-muted")}><span className="block truncate" title={r.to}>{r.to || "—"}</span></td>
                    <td className={cn(TD, "whitespace-nowrap text-muted")}><LastSent row={r} /></td>
                    <td className={cn(TD, "max-w-60")}>
                      {r.subject ? <span className="block truncate" dir="auto" title={r.subject}>{r.subject}</span> : <span className="text-muted" aria-label="No subject">—</span>}
                    </td>
                    <td className={TD}>{status(r)}</td>
                    <td className={TD}><RefusalChip row={r} readOnly={readOnly} busy={busy} onEdit={() => setRefusing(r)} /></td>
                    <td className={cn(TD, "pr-6 text-right")}>
                      <span className="inline-flex items-center gap-1.5">
                        <IconAction label="Open" aria-label={`Open ${r.company}`} onClick={() => onOpen(r)} className="text-muted hover:bg-fg/5 hover:text-fg">
                          <Eye aria-hidden className="size-4" />
                        </IconAction>
                        {!readOnly && <SendAction row={r} tip />}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {rows.map((r, i) => (
              <motion.li key={r.key} {...rowAnim(i)} className="rounded-2xl border border-line bg-raised p-4">
                <div className="flex items-start gap-3">
                  <TypeAvatar name={r.company} type={r.sponsor?.partnerType} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold" dir="auto">{r.company}</p>
                    <p className="truncate text-xs text-muted">{r.sponsor?.partnerType ?? "Email only"}{r.to ? ` · ${r.to}` : ""}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                  {status(r)}
                  <RefusalChip row={r} readOnly={readOnly} busy={busy} onEdit={() => setRefusing(r)} />
                </div>
                {r.subject && <p className="mt-3 truncate text-sm" dir="auto">{r.subject}</p>}
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-muted"><LastSent row={r} /></p>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => onOpen(r)} className={cn("inline-flex h-11 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-semibold hover:bg-fg/5", FOCUS)}>
                      <Eye aria-hidden className="size-4" /> Open
                    </button>
                    {!readOnly && r.sponsor?.email && (
                      <Link href={`/app/emails?to=${encodeURIComponent(r.sponsor.id)}`} className={cn("inline-flex h-11 items-center gap-1.5 rounded-full bg-sky px-4 text-sm font-semibold text-[#071a33]", FOCUS)}>
                        <Send aria-hidden className="size-4" /> Send email
                      </Link>
                    )}
                  </div>
                </div>
              </motion.li>
            ))}
          </ul>
        </>
      )}

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
