"use client";

import { animate, AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Avatar } from "@/components/admin/avatar";
import { SummaryPanel, type RefusalInput } from "@/components/pages/refusal-summary";
import { REFUSAL_LABELS, TYPE_COLOR } from "@/lib/constants";
import type { Member, Sponsor } from "@/types";

const EASE = [0.16, 1, 0.3, 1] as const;

export type MemberRow = { member: Member; waiting: number; agreed: number; refused: number; refusals: Sponsor[] };

export function toInput(s: Sponsor): RefusalInput {
  return {
    company: s.name,
    partnerType: s.partnerType,
    ownerName: s.ownerName,
    category: s.refusal!.category,
    details: s.refusal!.details,
    selfAssessment: s.refusal!.memberSelfAssessment,
  };
}

function CountUp({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const c = animate(0, value, { duration: 0.6, ease: EASE, onUpdate: (v) => setN(Math.round(v)) });
    return () => c.stop();
  }, [value, reduce]);
  return <span className="tabular-nums">{reduce ? value : n}</span>;
}

function Counter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="min-w-[4.5rem]">
      <p className="font-display text-2xl font-bold leading-none" style={{ color }}>
        <CountUp value={value} />
      </p>
      <p className="mt-1 text-xs font-medium text-muted">{label}</p>
    </div>
  );
}

export function MemberStrip({ row, index, open, onToggle }: { row: MemberRow; index: number; open: boolean; onToggle: () => void }) {
  const { member, waiting, agreed, refused, refusals } = row;
  const total = waiting + agreed + refused;
  const panelId = useId();
  const seg = (n: number) => (total ? (n / total) * 100 : 0);
  const first = member.name.split(" ")[0] || member.name;

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE, delay: Math.min(index * 0.05, 0.4) }}
      className="overflow-hidden rounded-3xl border border-line bg-raised"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="block w-full p-4 text-left transition-colors duration-150 hover:bg-line/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sky sm:p-5"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex min-w-0 items-center gap-3 sm:w-56 sm:shrink-0">
            <Avatar member={member} size={40} />
            <span className="min-w-0 flex-1 truncate font-semibold" dir="auto">
              {member.name}
            </span>
            <motion.span aria-hidden animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2, ease: EASE }} className="sm:hidden">
              <ChevronDown className="size-4 text-muted" />
            </motion.span>
          </div>
          <div className="flex flex-1 flex-wrap gap-x-8 gap-y-3">
            <Counter label="Waiting" value={waiting} color="var(--amber)" />
            <Counter label="Agreed" value={agreed} color="var(--mint)" />
            <Counter label="Said no" value={refused} color="var(--coral)" />
          </div>
          <motion.span aria-hidden animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2, ease: EASE }} className="hidden sm:block">
            <ChevronDown className="size-5 text-muted" />
          </motion.span>
        </div>
        <div
          role="img"
          aria-label={`${waiting} waiting, ${agreed} agreed, ${refused} said no`}
          className="mt-4 flex h-1.5 overflow-hidden rounded-full bg-line"
        >
          {[
            [waiting, "var(--amber)"],
            [agreed, "var(--mint)"],
            [refused, "var(--coral)"],
          ].map(([n, c]) => (
            <motion.div
              key={c as string}
              className="h-full"
              style={{ background: c as string }}
              initial={{ width: 0 }}
              animate={{ width: `${seg(n as number)}%` }}
              transition={{ duration: 0.6, ease: EASE, delay: 0.1 + index * 0.05 }}
            />
          ))}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            role="region"
            aria-label={`${member.name}'s refusals`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="space-y-5 border-t border-line p-4 sm:p-5">
              {refusals.length === 0 ? (
                <p className="text-sm text-muted">No refusals from {first} yet.</p>
              ) : (
                <ul className="grid gap-3 md:grid-cols-2">
                  {refusals.map((s) => (
                    <li key={s.id} className="rounded-2xl border border-line p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-semibold" dir="auto">
                          {s.name}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          <span
                            className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-[#071a33]"
                            style={{ background: TYPE_COLOR[s.partnerType] }}
                          >
                            {s.partnerType}
                          </span>
                          <span className="rounded-full bg-coral/15 px-2.5 py-0.5 text-xs font-semibold text-coral">
                            {REFUSAL_LABELS[s.refusal!.category]}
                          </span>
                        </div>
                      </div>
                      <p className="mt-3 text-sm" dir="auto">
                        <span className="text-muted">They said: </span>
                        {s.refusal!.details}
                      </p>
                      <p className="mt-2 rounded-xl bg-gold/10 p-3 text-sm" dir="auto">
                        <span className="font-semibold">{first}&apos;s take: </span>
                        {s.refusal!.memberSelfAssessment}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <SummaryPanel refusals={refusals.map(toInput)} subject={first} buttonLabel={`Generate summary for ${first}`} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
