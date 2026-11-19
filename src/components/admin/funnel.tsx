"use client";

import { motion } from "framer-motion";
import { STATUS_META } from "@/lib/constants";
import { CountUp } from "@/components/motion/count-up";
import type { computeFunnel } from "./stats";

type Funnel = ReturnType<typeof computeFunnel>;

export function PipelineFunnel({ funnel }: { funnel: Funnel }) {
  const max = Math.max(1, ...funnel.stages.map((s) => s.count));
  const first = funnel.stages[0].count;
  return (
    <section className="rounded-3xl border border-line bg-raised p-6 sm:p-8">
      <h2 className="font-display text-xl font-bold">Pipeline</h2>
      <p className="mt-1 text-sm text-muted">How far outreach is getting</p>

      <div className="mt-8 flex flex-col gap-5">
        {funnel.stages.map((stage, i) => {
          const meta = STATUS_META[stage.key];
          const pct = (stage.count / max) * 100;
          const conv = first ? Math.round((stage.count / first) * 100) : 0;
          return (
            <div key={stage.key} className="grid grid-cols-[5.5rem_1fr] items-center gap-4 sm:grid-cols-[7rem_1fr]">
              <div className="text-sm font-medium">{meta.label}</div>
              <div className="relative h-11 rounded-xl bg-bg/60">
                <motion.div
                  key={`${stage.key}-${stage.count}`}
                  className="absolute inset-y-0 left-0 flex min-w-11 items-center justify-end rounded-xl pr-3 font-display text-lg font-bold"
                  style={{ background: meta.color, color: meta.ink }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(pct, 4)}%` }}
                  transition={{ delay: 0.15 + i * 0.12, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                  whileHover={{ scaleY: 1.08 }}
                >
                  {stage.count}
                </motion.div>
                {i > 0 && (
                  <motion.span
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 + i * 0.1 }}
                  >
                    {conv}% of contacted
                  </motion.span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex flex-wrap gap-x-10 gap-y-4 border-t border-line pt-6">
        {[
          { label: "No reply", value: funnel.noReply, key: "no_reply" as const },
          { label: "Refused", value: funnel.refused, key: "refused" as const },
        ].map((d) => (
          <motion.div key={d.key} className="flex items-center gap-3" whileHover={{ x: 3 }}>
            <span className="size-3 rounded-full" style={{ background: STATUS_META[d.key].color }} />
            <span className="font-display text-2xl font-bold">
              <CountUp key={d.value} to={d.value} />
            </span>
            <span className="text-sm text-muted">{d.label}</span>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
