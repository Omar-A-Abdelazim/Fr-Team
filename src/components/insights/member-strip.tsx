"use client";

import { animate, motion, useReducedMotion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/admin/avatar";
import type { RefusalInput } from "@/components/pages/refusal-summary";
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

export function MemberStrip({ row, index }: { row: MemberRow; index: number; open?: boolean; onToggle?: () => void }) {
  const { member, waiting, agreed, refused } = row;
  const total = waiting + agreed + refused;
  const seg = (n: number) => (total ? (n / total) * 100 : 0);

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE, delay: Math.min(index * 0.05, 0.4) }}
      className="overflow-hidden rounded-3xl border border-line bg-raised"
    >
      <Link
        href={`/admin/members/${member.id}`}
        aria-label={`Open ${member.name}'s profile`}
        className="group block w-full p-4 text-left transition-colors duration-150 hover:bg-line/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sky sm:p-5"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex min-w-0 items-center gap-3 sm:w-56 sm:shrink-0">
            <Avatar member={member} size={40} />
            <span className="min-w-0 flex-1 truncate font-semibold" dir="auto">
              {member.name}
            </span>
            <ChevronRight aria-hidden className="size-4 text-muted transition-transform duration-200 group-hover:translate-x-0.5 sm:hidden" />
          </div>
          <div className="flex flex-1 flex-wrap gap-x-8 gap-y-3">
            <Counter label="Waiting" value={waiting} color="var(--amber)" />
            <Counter label="Agreed" value={agreed} color="var(--mint)" />
            <Counter label="Said no" value={refused} color="var(--coral)" />
          </div>
          <span className="hidden items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm font-semibold transition-colors duration-150 group-hover:bg-sky group-hover:text-[#071a33] sm:inline-flex">
            Open profile
            <ChevronRight aria-hidden className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
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
      </Link>
    </motion.li>
  );
}
