"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

export type RefusalSummary = {
  summary: string;
  topReasons: { reason: string; share: number; examples: string[] }[];
  rootCauses: string[];
  coaching: { member: string; note: string }[];
  actions: string[];
};

function Card({ title, i, className, children }: { title: string; i: number; className?: string; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      initial={{ opacity: 0, y: reduce ? 0 : 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE, delay: i * 0.07 }}
      className={cn("rounded-3xl border border-line bg-raised p-5 sm:p-6", className)}
    >
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <div className="mt-3">{children}</div>
    </motion.section>
  );
}

export function SummaryLoading() {
  return (
    <div role="status" aria-label="Writing the summary" className="grid gap-4 md:grid-cols-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={cn("relative overflow-hidden rounded-3xl border border-line bg-raised p-6", i === 0 && "md:col-span-2")}>
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-sky/15 to-transparent"
            initial={{ x: "-100%" }}
            animate={{ x: "300%" }}
            transition={{ duration: 1.4, ease: "linear", repeat: Infinity }}
          />
          <div className="h-4 w-1/3 rounded bg-line" />
          <div className="mt-4 space-y-2">
            <div className="h-3 w-full rounded bg-line" />
            <div className="h-3 w-5/6 rounded bg-line" />
            <div className="h-3 w-2/3 rounded bg-line" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SummaryCards({ data }: { data: RefusalSummary }) {
  const [done, setDone] = useState<Record<number, boolean>>({});
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="In short" i={0} className="md:col-span-2">
        <p className="leading-relaxed" dir="auto">
          {data.summary}
        </p>
      </Card>

      <Card title="Top reasons" i={1}>
        <ul className="space-y-4">
          {data.topReasons.map((r, i) => (
            <li key={r.reason}>
              <div className="mb-1 flex justify-between gap-3 text-sm">
                <span dir="auto">{r.reason}</span>
                <span className="tabular-nums text-muted">{Math.round(r.share)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-line">
                <motion.div
                  className="h-full rounded-full bg-coral"
                  style={{ originX: 0 }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: Math.max(0, Math.min(100, r.share)) / 100 }}
                  transition={{ duration: 0.6, delay: 0.2 + i * 0.06, ease: EASE }}
                />
              </div>
              {r.examples.length > 0 && (
                <p className="mt-1 text-xs text-muted" dir="auto">
                  e.g. {r.examples.join(", ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Where the pitch breaks" i={2}>
        <ul className="space-y-2.5 text-sm">
          {data.rootCauses.map((c) => (
            <li key={c} className="flex gap-2.5" dir="auto">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-gold" />
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Notes per member" i={3}>
        <ul className="space-y-3 text-sm">
          {data.coaching.map((c) => (
            <li key={c.member} className="rounded-xl bg-gold/10 p-3" dir="auto">
              <span className="font-semibold">{c.member}: </span>
              {c.note}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="What to change next" i={4}>
        <ul className="space-y-1">
          {data.actions.map((a, i) => (
            <li key={a}>
              <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!done[i]}
                  onChange={(e) => setDone((p) => ({ ...p, [i]: e.target.checked }))}
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition-colors duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-sky",
                    done[i] ? "border-mint bg-mint text-[#071a33]" : "border-line",
                  )}
                >
                  <AnimatePresence initial={false}>
                    {done[i] && (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ duration: 0.15, ease: EASE }}>
                        <Check className="size-3.5" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
                <span dir="auto" className={cn("transition-colors duration-150", done[i] && "text-muted line-through")}>
                  {a}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
