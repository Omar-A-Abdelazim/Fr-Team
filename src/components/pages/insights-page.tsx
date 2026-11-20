"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { MemberStrip, toInput, type MemberRow } from "@/components/insights/member-strip";
import { TYPE_COLOR } from "@/lib/constants";
import { useMembers, useSponsors } from "@/lib/firebase/data";
import { SummaryPanel } from "./refusal-summary";
import type { PartnerType, SponsorStatus } from "@/types";

const WAITING: SponsorStatus[] = ["not_contacted", "contacted", "no_reply", "replied", "follow_up"];
const AGREED: SponsorStatus[] = ["accepted", "closed"];

function Bars({ title, rows }: { title: string; rows: { label: string; count: number; color: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <section className="rounded-3xl border border-line bg-raised p-6">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <ul className="mt-5 space-y-3">
        {rows.map((r, i) => (
          <li key={r.label}>
            <div className="mb-1 flex justify-between text-sm">
              <span>{r.label}</span>
              <span className="text-muted">{r.count}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-line">
              <motion.div
                className="h-full rounded-full"
                style={{ background: r.color, originX: 0 }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: r.count / max }}
                transition={{ duration: 0.6, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </li>
        ))}
        {rows.length === 0 && <li className="text-sm text-muted">No refusals yet.</li>}
      </ul>
    </section>
  );
}

export function InsightsPage() {
  const { sponsors, loading } = useSponsors();
  const members = useMembers();
  const [help, setHelp] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const refused = useMemo(() => sponsors.filter((s) => s.status === "refused" && s.refusal), [sponsors]);

  const byType = useMemo(() => {
    const m = new Map<PartnerType, number>();
    refused.forEach((s) => m.set(s.partnerType, (m.get(s.partnerType) ?? 0) + 1));
    return [...m].sort((a, b) => b[1] - a[1]).map(([t, c]) => ({ label: t, count: c, color: TYPE_COLOR[t] }));
  }, [refused]);

  const rows = useMemo<MemberRow[]>(() => {
    const owners = new Set(sponsors.map((s) => s.ownerId));
    return members
      .filter((m) => owners.has(m.id))
      .map((member) => {
        const mine = sponsors.filter((s) => s.ownerId === member.id);
        return {
          member,
          waiting: mine.filter((s) => WAITING.includes(s.status)).length,
          agreed: mine.filter((s) => AGREED.includes(s.status)).length,
          refused: mine.filter((s) => s.status === "refused").length,
          refusals: mine.filter((s) => s.status === "refused" && s.refusal),
        };
      })
      .sort((a, b) => b.refused - a.refused || a.member.name.localeCompare(b.member.name));
  }, [members, sponsors]);

  if (loading) return <div className="mx-auto h-96 max-w-6xl animate-pulse rounded-3xl bg-raised" />;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold">Refusal insights</h1>
        <p className="mt-1 text-muted">Why sponsors said no, and what the team thinks went wrong.</p>
      </header>

      <div className="rounded-2xl border border-line bg-raised">
        <button
          type="button"
          onClick={() => setHelp((o) => !o)}
          aria-expanded={help}
          className="flex min-h-11 w-full items-center justify-between px-4 text-sm font-semibold"
        >
          How to use this page
          <motion.span animate={{ rotate: help ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="size-4" />
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {help && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <ul className="list-disc space-y-2 border-t border-line py-3 pl-9 pr-4 text-sm text-muted">
                <li>Click a member to see why sponsors said no to them, in their own words and with their own take.</li>
                <li>Generate a summary for one member or for the whole team before FR meetings.</li>
                <li>Use it to decide what to change in the proposal and who needs coaching.</li>
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <section aria-labelledby="team-heading">
        <h2 id="team-heading" className="font-display text-xl font-bold">
          Team
        </h2>
        <p className="mt-1 text-sm text-muted">
          Waiting means not sent yet, no reply, or still talking. Agreed means accepted or closed. Select a member to see their refusals.
        </p>
        <ul className="mt-4 space-y-3">
          {rows.map((r, i) => (
            <MemberStrip key={r.member.id} row={r} index={i} open={openId === r.member.id} onToggle={() => setOpenId(openId === r.member.id ? null : r.member.id)} />
          ))}
        </ul>
        {rows.length === 0 && <p className="mt-6 text-muted">No members own sponsors yet.</p>}
      </section>

      <section aria-labelledby="team-summary" className="space-y-4">
        <h2 id="team-summary" className="font-display text-xl font-bold">
          Whole team
        </h2>
        <SummaryPanel refusals={refused.map(toInput)} />
      </section>

      <Bars title="Refusals by partner type" rows={byType} />
    </div>
  );
}
