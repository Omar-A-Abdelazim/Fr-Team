"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const STAGES = [
  { key: "contacted", label: "Contacted", color: "var(--sky)", ink: "#071a33" },
  { key: "replied", label: "Replied", color: "var(--blue)", ink: "#ffffff" },
  { key: "follow_up", label: "Follow-up", color: "var(--amber)", ink: "#071a33" },
  { key: "accepted", label: "Accepted", color: "var(--mint)", ink: "#071a33" },
] as const;

/** A sample deal walking the pipeline, so visitors see what "tracking" means. */
export function PipelineDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-120px" });
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!inView || reduce) return;
    const id = setInterval(() => setStep((s) => (s + 1) % (STAGES.length + 1)), 1400);
    return () => clearInterval(id);
  }, [inView, reduce]);

  const current = Math.min(reduce ? STAGES.length - 1 : step, STAGES.length - 1);
  const won = !reduce && step === STAGES.length - 1;

  return (
    <div ref={ref} className="rounded-3xl border border-line bg-raised p-5 sm:p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="font-display text-lg font-semibold">Delta Foods</p>
          <p className="text-sm text-muted">Catering · logged by Omar</p>
        </div>
        <AnimatePresence mode="wait">
          <motion.span
            key={STAGES[current].key}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="rounded-full px-3 py-1 text-sm font-semibold"
            style={{ background: STAGES[current].color, color: STAGES[current].ink }}
          >
            {STAGES[current].label}
          </motion.span>
        </AnimatePresence>
      </div>

      <ol className="relative grid grid-cols-4 gap-2">
        <div className="absolute inset-x-[12.5%] top-3 h-0.5 rounded bg-line" aria-hidden />
        <motion.div
          aria-hidden
          className="absolute left-[12.5%] top-3 h-0.5 origin-left rounded bg-gradient-to-r from-sky to-mint"
          style={{ width: "75%" }}
          animate={{ scaleX: current / (STAGES.length - 1) }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        />
        {STAGES.map((s, i) => (
          <li key={s.key} className="relative flex flex-col items-center gap-2 text-center">
            <motion.span
              className="relative z-10 grid size-6 place-items-center rounded-full border-2"
              animate={{
                backgroundColor: i <= current ? s.color : "var(--bg-raised)",
                borderColor: i <= current ? s.color : "var(--line)",
              }}
              transition={{ duration: 0.2 }}
            />
            <span className={i <= current ? "text-xs font-medium sm:text-sm" : "text-xs text-muted sm:text-sm"}>
              {s.label}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-6 flex h-10 items-center justify-end">
        <AnimatePresence>
          {won && (
            <motion.span
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-full bg-gold px-4 py-2 font-display text-sm font-bold text-[#071a33]"
            >
              +3 points for Omar
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
