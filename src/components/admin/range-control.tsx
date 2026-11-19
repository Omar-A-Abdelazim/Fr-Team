"use client";

import { motion } from "framer-motion";
import { RANGES, type Range } from "./stats";

export function RangeControl({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div role="radiogroup" aria-label="Date range" className="inline-flex rounded-full border border-line bg-raised p-1">
      {RANGES.map((r) => {
        const active = r.id === value;
        return (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(r.id)}
            className={`relative rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${active ? "text-white" : "text-muted hover:text-fg"}`}
          >
            {active && (
              <motion.span
                layoutId="range-pill"
                className="absolute inset-0 rounded-full bg-blue"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative">{r.label}</span>
          </button>
        );
      })}
    </div>
  );
}
