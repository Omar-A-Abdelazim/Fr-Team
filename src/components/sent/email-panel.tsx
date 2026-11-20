"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { StatusBadge } from "@/components/app/shell";
import { REPLY_META, formatSent } from "@/components/sent/meta";
import { STATUS_META } from "@/lib/constants";
import type { EmailLog, EmailReply } from "@/lib/firebase/data";
import type { Sponsor } from "@/types";
import { cn } from "@/lib/utils";

const ORDER: EmailReply[] = ["waiting", "replied", "accepted", "refused"];
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),textarea,[tabindex]:not([tabindex="-1"])';

export function EmailPanel({
  email,
  sponsor,
  busy,
  suspended,
  onClose,
  onChange,
}: {
  email: EmailLog | null;
  sponsor: Sponsor | null;
  busy: boolean;
  suspended: boolean;
  onClose: () => void;
  onChange: (e: EmailLog, r: EmailReply) => void;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const isOpen = !!email;

  // focus in, lock scroll, restore focus on close
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || suspended) return;
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") return onClose();
      if (ev.key !== "Tab" || !ref.current) return;
      const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!ref.current.contains(active)) {
        ev.preventDefault();
        first.focus();
      } else if (ev.shiftKey && active === first) {
        ev.preventDefault();
        last.focus();
      } else if (!ev.shiftKey && active === last) {
        ev.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, suspended, onClose]);

  const meta = sponsor ? STATUS_META[sponsor.status] : null;

  return (
    <AnimatePresence>
      {email && (
        <motion.div className="fixed inset-0 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <div className="absolute inset-0 bg-[#071a33]/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby="email-panel-title"
            initial={reduce ? { opacity: 0 } : { x: "100%" }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: "100%" }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-line bg-bg sm:max-w-xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-line p-5">
              <div className="min-w-0">
                <h2 id="email-panel-title" className="font-display text-2xl font-bold leading-tight break-words">
                  {email.company}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-[#071a33]"
                    style={{ background: REPLY_META[email.reply].color }}
                  >
                    {REPLY_META[email.reply].label}
                  </span>
                  {meta && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                      Sponsor status <StatusBadge label={meta.label} color={meta.color} ink={meta.ink} />
                    </span>
                  )}
                </div>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Close email details"
                className="grid size-11 shrink-0 place-items-center rounded-full border border-line hover:bg-fg/5"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto p-5">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="min-w-0">
                  <dt className="text-xs font-medium text-muted">To</dt>
                  <dd className="mt-0.5 break-all">{email.to}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted">Sent at</dt>
                  <dd className="mt-0.5">{formatSent(email.sentAt)}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-muted">Subject</dt>
                  <dd className="mt-0.5 font-medium" dir="auto">
                    {email.subject}
                  </dd>
                </div>
              </dl>

              <div>
                <h3 className="text-xs font-medium text-muted">Message</h3>
                <div dir="auto" className="mt-1.5 whitespace-pre-wrap break-words rounded-2xl border border-line bg-raised p-4 text-sm leading-relaxed">
                  {email.body || "No message body was saved."}
                </div>
              </div>

              <fieldset disabled={busy}>
                <legend className="mb-2 text-sm font-semibold">What happened?</legend>
                <div className="grid grid-cols-2 gap-2">
                  {ORDER.map((r) => {
                    const active = email.reply === r;
                    return (
                      <label
                        key={r}
                        className={cn(
                          "relative flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-3 py-2 text-center text-sm font-semibold transition-colors duration-150 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-sky",
                          active ? "border-transparent text-[#071a33]" : "border-line text-muted hover:text-fg",
                          busy && "cursor-wait opacity-60",
                        )}
                        style={active ? { background: REPLY_META[r].color } : undefined}
                      >
                        <input
                          type="radio"
                          name="reply"
                          value={r}
                          checked={active}
                          onChange={() => onChange(email, r)}
                          className="sr-only"
                        />
                        {REPLY_META[r].choice}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
