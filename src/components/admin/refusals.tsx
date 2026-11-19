"use client";

import { motion } from "framer-motion";
import { Quote, Sparkles } from "lucide-react";
import { REFUSAL_LABELS } from "@/lib/constants";
import type { computeRefusals } from "./stats";

type Refusals = ReturnType<typeof computeRefusals>;

export function RefusalPanel({ data }: { data: Refusals }) {
  return (
    <section className="rounded-3xl border border-line bg-raised p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Why sponsors said no</h2>
          <p className="mt-1 text-sm text-muted">{data.total} refusal{data.total === 1 ? "" : "s"} in this period</p>
        </div>
        <button
          type="button"
          disabled
          title="Available after Gemini is connected"
          className="inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-line px-3.5 py-1.5 text-sm font-medium text-muted opacity-60"
        >
          <Sparkles className="size-4" /> Generate AI summary
        </button>
      </div>

      {data.rows.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No refusals logged in this range.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {data.rows.map((r, i) => (
            <li key={r.category}>
              <div className="mb-1.5 flex justify-between text-sm">
                <span>{REFUSAL_LABELS[r.category]}</span>
                <span className="tabular-nums text-muted">{r.pct}% · {r.count}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-bg/60">
                <motion.div
                  key={`${r.category}-${r.pct}`}
                  className="h-full rounded-full bg-coral"
                  initial={{ width: 0 }}
                  animate={{ width: `${r.pct}%` }}
                  transition={{ delay: 0.15 + i * 0.08, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {data.quotes.length > 0 && (
        <div className="mt-8 flex flex-col gap-5 border-t border-line pt-6">
          {data.quotes.map((q, i) => (
            <motion.figure
              key={q.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.1 }}
              className="flex gap-3"
            >
              <Quote className="mt-0.5 size-4 shrink-0 text-coral" />
              <div>
                <blockquote className="text-sm leading-relaxed">{q.text}</blockquote>
                <figcaption className="mt-1.5 text-xs text-muted">{q.owner} on {q.company}</figcaption>
              </div>
            </motion.figure>
          ))}
        </div>
      )}
    </section>
  );
}
