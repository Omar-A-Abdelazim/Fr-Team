"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { useMemo, useState } from "react";
import { PARTNER_TYPES, TYPE_COLOR } from "@/lib/constants";
import { findDuplicate } from "@/lib/duplicates";
import type { PartnerType, Sponsor } from "@/types";
import { cn } from "@/lib/utils";

type Draft = Pick<Sponsor, "name" | "partnerType" | "website" | "email" | "phone" | "facebook" | "linkedin" | "description">;

const EMPTY: Draft = {
  name: "",
  partnerType: "Fund",
  website: "",
  email: "",
  phone: "",
  facebook: "",
  linkedin: "",
  description: "",
};

const STEPS = ["Company", "Contacts", "Context"] as const;

function Input({
  label,
  value,
  onChange,
  type = "text",
  hint,
  dir,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  hint?: string;
  dir?: "auto";
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <input
        type={type}
        dir={dir}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-line bg-bg px-3.5 outline-none transition-colors duration-150 focus:border-sky"
      />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function AddSponsor({
  open,
  onClose,
  onSave,
  pool,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (d: Draft) => void;
  pool: Sponsor[];
}) {
  const [d, setD] = useState<Draft>(EMPTY);
  const [step, setStep] = useState(0);
  const [ignored, setIgnored] = useState<string | null>(null);
  const set = <K extends keyof Draft>(k: K) => (v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  const dup = useMemo(() => findDuplicate(d, pool), [d, pool]);
  const showDup = dup && ignored !== dup.sponsor.id;
  const exactDup = dup && (dup.reason === "same website" || dup.reason === "same LinkedIn page");

  function close() {
    onClose();
    setTimeout(() => {
      setD(EMPTY);
      setStep(0);
      setIgnored(null);
    }, 200);
  }

  const canNext = step === 0 ? d.name.trim().length > 1 && !exactDup : true;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-[#071a33]/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={close}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-title"
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-line bg-raised"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <header className="flex items-center justify-between border-b border-line px-6 py-5">
              <h2 id="add-title" className="font-display text-xl font-bold">
                Log a sponsor
              </h2>
              <button onClick={close} aria-label="Close" className="grid size-9 place-items-center rounded-full hover:bg-fg/5">
                <X className="size-4" />
              </button>
            </header>

            {/* stepper */}
            <ol className="flex gap-2 px-6 pt-5">
              {STEPS.map((s, i) => (
                <li key={s} className="flex-1">
                  <div className="h-1.5 overflow-hidden rounded-full bg-line">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-sky to-gold"
                      animate={{ scaleX: i <= step ? 1 : 0 }}
                      style={{ originX: 0 }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <span className={cn("mt-1.5 block text-xs", i === step ? "font-semibold" : "text-muted")}>{s}</span>
                </li>
              ))}
            </ol>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  {step === 0 && (
                    <>
                      <Input label="Company name" value={d.name} onChange={set("name")} dir="auto" />
                      <Input label="Website" value={d.website} onChange={set("website")} hint="We use it to spot duplicates." />
                      <fieldset>
                        <legend className="mb-2 text-sm font-medium">Type of partner</legend>
                        <div className="flex flex-wrap gap-2">
                          {PARTNER_TYPES.map((t: PartnerType) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => set("partnerType")(t)}
                              className={cn(
                                "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors duration-150",
                                d.partnerType === t ? "border-transparent text-[#071a33]" : "border-line text-muted hover:text-fg",
                              )}
                              style={d.partnerType === t ? { background: TYPE_COLOR[t] } : undefined}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </fieldset>
                    </>
                  )}
                  {step === 1 && (
                    <>
                      <Input label="Email" type="email" value={d.email} onChange={set("email")} />
                      <Input label="Phone" type="tel" value={d.phone} onChange={set("phone")} />
                      <Input label="LinkedIn" value={d.linkedin} onChange={set("linkedin")} />
                      <Input label="Facebook" value={d.facebook} onChange={set("facebook")} />
                    </>
                  )}
                  {step === 2 && (
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium">What have they sponsored before?</span>
                      <textarea
                        dir="auto"
                        rows={5}
                        value={d.description}
                        onChange={(e) => set("description")(e.target.value)}
                        className="w-full rounded-xl border border-line bg-bg p-3.5 outline-none focus:border-sky"
                      />
                      <span className="mt-1 block text-xs text-muted">Events, student activities, links you found.</span>
                    </label>
                  )}
                </motion.div>
              </AnimatePresence>

              <AnimatePresence>
                {showDup && dup && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.2 }}
                    className="mt-6 rounded-2xl border border-amber/40 bg-amber/10 p-4"
                    role="alert"
                  >
                    <div className="flex gap-3">
                      <motion.span
                        animate={{ rotate: [0, -10, 10, -6, 0] }}
                        transition={{ duration: 0.5 }}
                        className="mt-0.5 text-amber"
                      >
                        <AlertTriangle className="size-5" />
                      </motion.span>
                      <div className="text-sm">
                        <p className="font-semibold">
                          {dup.sponsor.ownerName} already logged {dup.sponsor.name}
                        </p>
                        <p className="mt-0.5 text-muted">
                          Matched by {dup.reason}. Talk to {dup.sponsor.ownerName} before reaching out.
                        </p>
                        {!exactDup && (
                          <button
                            type="button"
                            onClick={() => setIgnored(dup.sponsor.id)}
                            className="mt-2 font-semibold text-amber underline-offset-4 hover:underline"
                          >
                            It&apos;s a different company
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <footer className="flex gap-3 border-t border-line px-6 py-4">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  className="h-11 rounded-xl border border-line px-5 font-semibold hover:bg-fg/5"
                >
                  Back
                </button>
              )}
              <button
                type="button"
                disabled={!canNext}
                onClick={() => {
                  if (step < STEPS.length - 1) setStep((s) => s + 1);
                  else {
                    onSave(d);
                    close();
                  }
                }}
                className="h-11 flex-1 rounded-xl bg-gold font-semibold text-[#071a33] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              >
                {step < STEPS.length - 1 ? "Next" : "Save sponsor"}
              </button>
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
