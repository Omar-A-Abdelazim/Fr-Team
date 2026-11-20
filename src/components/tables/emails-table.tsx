"use client";

import { motion, useReducedMotion } from "framer-motion";
import { BookOpen, ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { REPLY_META, formatSent } from "@/components/sent/meta";
import { REPLY_LABEL, useEmailActions } from "@/components/tables/use-email-actions";
import { REFUSAL_LABELS } from "@/lib/constants";
import type { EmailLog, EmailReply } from "@/lib/firebase/data";
import type { RefusalCategory, Sponsor } from "@/types";
import { cn } from "@/lib/utils";

type Filter = "all" | EmailReply;
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
  const { busy, change, refuse } = useEmailActions(ownerId, sponsors);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  // rows where "Said no" was picked but no reason is saved yet
  const [pending, setPending] = useState<Set<string>>(new Set());

  const counts = useMemo(() => {
    const c: Record<EmailReply, number> = { waiting: 0, replied: 0, accepted: 0, refused: 0 };
    for (const e of emails) c[e.reply] += 1;
    return c;
  }, [emails]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return emails.filter(
      (e) =>
        (filter === "all" || e.reply === filter) &&
        (!needle || [e.company, e.to, e.subject].some((v) => v.toLowerCase().includes(needle))),
    );
  }, [emails, filter, q]);

  function setPend(id: string, on: boolean) {
    setPending((p) => {
      const n = new Set(p);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  }

  function onReply(e: EmailLog, r: EmailReply) {
    if (r === "refused") {
      if (e.reply !== "refused") setPend(e.id, true);
      return;
    }
    setPend(e.id, false);
    void change(e, r);
  }

  async function onReason(e: EmailLog, c: RefusalCategory) {
    if (await refuse(e, c)) setPend(e.id, false);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div role="group" aria-label="Filter emails by reply" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0 md:pb-0">
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
          <span className="sr-only">Search emails by company, address or subject</span>
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
        <table className="w-full min-w-[960px] border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-10 bg-raised">
            <tr>
              <th scope="col" className={TH}>Company</th>
              <th scope="col" className={TH}>To</th>
              <th scope="col" className={TH}>Sent</th>
              <th scope="col" className={TH}>Subject</th>
              <th scope="col" className={TH}>Reply</th>
              <th scope="col" className={TH}>Refusal reason</th>
              <th scope="col" className={cn(TH, "w-28")}>
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e, i) => {
              const isPending = pending.has(e.id);
              const shown: EmailReply = isPending ? "refused" : e.reply;
              const showReason = shown === "refused";
              const zebra = i % 2 === 1 ? "bg-fg/[0.03]" : "";
              return (
                <tr key={e.id} className={cn("group transition-colors duration-300 hover:bg-sky/10", zebra, isPending && "bg-coral/15 hover:bg-coral/15")}>
                  <th scope="row" className={cn(TD, "max-w-48 border-b border-line text-left font-semibold")}>
                    <span className="block truncate" dir="auto" title={e.company}>
                      {e.company}
                    </span>
                  </th>
                  <td className={cn(TD, "max-w-52 border-b border-line text-muted")}>
                    <span className="block truncate" title={e.to}>{e.to}</span>
                  </td>
                  <td className={cn(TD, "whitespace-nowrap border-b border-line text-muted")}>
                    <time dateTime={e.sentAt}>{formatSent(e.sentAt)}</time>
                  </td>
                  <td className={cn(TD, "max-w-64 border-b border-line")}>
                    <span className="block truncate" dir="auto" title={e.subject}>{e.subject}</span>
                  </td>
                  <td className={cn(TD, "border-b border-line")}>
                    {readOnly ? (
                      <Pill reply={e.reply} />
                    ) : (
                      <ReplySelect value={shown} disabled={busy} label={`Reply status for ${e.company}`} onChange={(r) => onReply(e, r)} />
                    )}
                  </td>
                  <td className={cn(TD, "border-b border-line")}>
                    {!showReason ? (
                      <span className="text-muted" aria-label="Not applicable">—</span>
                    ) : readOnly ? (
                      <span className="text-coral">{e.refusalCategory ? REFUSAL_LABELS[e.refusalCategory] : "No reason saved"}</span>
                    ) : (
                      <motion.span initial={reduce ? false : { opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2, ease: EASE }} className="relative inline-flex">
                        <select
                          aria-label={`Refusal reason for ${e.company}`}
                          value={isPending ? "" : (e.refusalCategory ?? "")}
                          disabled={busy}
                          onChange={(ev) => ev.target.value && void onReason(e, ev.target.value as RefusalCategory)}
                          className={cn(
                            "h-8 max-w-56 cursor-pointer appearance-none truncate rounded-lg border bg-bg py-0 pl-2.5 pr-7 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky disabled:cursor-wait disabled:opacity-60",
                            isPending ? "border-coral" : "border-line",
                          )}
                        >
                          <option value="" disabled>
                            Pick a reason...
                          </option>
                          {(Object.keys(REFUSAL_LABELS) as RefusalCategory[]).map((c) => (
                            <option key={c} value={c}>
                              {REFUSAL_LABELS[c]}
                            </option>
                          ))}
                        </select>
                        <ChevronDown aria-hidden className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
                      </motion.span>
                    )}
                  </td>
                  <td className={cn(TD, "border-b border-line")}>
                    <button
                      type="button"
                      onClick={() => onOpen(e)}
                      aria-label={`Read email to ${e.company}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-semibold transition-colors duration-150 hover:bg-fg/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky"
                    >
                      <BookOpen aria-hidden className="size-3.5" />
                      Read
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted">
                  No emails match. {filter !== "all" || q ? (
                    <button type="button" onClick={() => { setFilter("all"); setQ(""); }} className="font-semibold text-sky underline underline-offset-2">
                      Clear filters
                    </button>
                  ) : null}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
