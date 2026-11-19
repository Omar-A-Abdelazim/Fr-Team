"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { REFUSAL_LABELS } from "@/lib/constants";
import type { Refusal, RefusalCategory } from "@/types";
import { cn } from "@/lib/utils";

export function RefusalDialog({
  company,
  onCancel,
  onSave,
}: {
  company: string | null;
  onCancel: () => void;
  onSave: (r: Refusal) => void;
}) {
  const [category, setCategory] = useState<RefusalCategory | null>(null);
  const [details, setDetails] = useState("");
  const [self, setSelf] = useState("");
  const valid = category && details.trim().length > 4 && self.trim().length >= 20;

  function reset() {
    setCategory(null);
    setDetails("");
    setSelf("");
  }

  return (
    <AnimatePresence>
      {company && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-[#071a33]/60 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="refusal-title"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl border border-line bg-raised p-6"
          >
            <h2 id="refusal-title" className="font-display text-xl font-bold">
              Why did {company} say no?
            </h2>
            <p className="mt-1 text-sm text-muted">This stays inside the team. It&apos;s how we fix the pitch.</p>

            <fieldset className="mt-5">
              <legend className="mb-2 text-sm font-medium">Main reason</legend>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(REFUSAL_LABELS) as RefusalCategory[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition-colors duration-150",
                      category === c ? "border-coral bg-coral text-[#071a33]" : "border-line text-muted hover:text-fg",
                    )}
                  >
                    {REFUSAL_LABELS[c]}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="mt-5 block">
              <span className="mb-1.5 block text-sm font-medium">What exactly did they say?</span>
              <textarea
                dir="auto"
                rows={2}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="w-full rounded-xl border border-line bg-bg p-3 outline-none focus:border-sky"
              />
            </label>

            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm font-medium">Why do you think you couldn&apos;t convince them?</span>
              <textarea
                dir="auto"
                rows={3}
                value={self}
                onChange={(e) => setSelf(e.target.value)}
                className="w-full rounded-xl border border-line bg-bg p-3 outline-none focus:border-sky"
              />
              <span className="mt-1 block text-xs text-muted">{Math.max(0, 20 - self.trim().length)} more characters needed</span>
            </label>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  reset();
                  onCancel();
                }}
                className="h-11 rounded-xl border border-line px-5 font-semibold hover:bg-fg/5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!valid}
                onClick={() => {
                  if (!category) return;
                  onSave({ category, details, memberSelfAssessment: self });
                  reset();
                }}
                className="h-11 rounded-xl bg-coral px-5 font-semibold text-[#071a33] disabled:opacity-40"
              >
                Save refusal
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
