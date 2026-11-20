"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/firebase/auth-context";
import { updateMyProfile } from "@/lib/firebase/data";

const PHONE_RE = /^[\d\s+-]{8,20}$/;
const field = "h-11 w-full rounded-xl border bg-bg px-3 outline-none focus:border-sky";

function Form({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth();
  const [name, setName] = useState(profile?.name ?? "");
  const [position, setPosition] = useState(profile?.position ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [touched, setTouched] = useState({ name: false, phone: false });
  const [busy, setBusy] = useState(false);

  const nameErr = name.trim().length < 2 ? "Enter your full name (at least 2 characters)." : "";
  const phoneErr = phone.trim() && !PHONE_RE.test(phone.trim()) ? "Use 8 to 20 digits, spaces, + or -." : "";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ name: true, phone: true });
    if (nameErr || phoneErr || !profile) return;
    setBusy(true);
    try {
      await updateMyProfile(profile.id, { name, position, phone });
      toast.success("Profile saved");
      onClose();
    } catch {
      toast.error("Couldn't save your profile", { description: "Check your connection and try again." });
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} noValidate>
      <h2 id="profile-title" className="font-display text-xl font-bold">
        Your profile
      </h2>
      <p className="mt-1 text-sm text-muted">These appear in the signature of emails you send from FR Hub.</p>

      <label className="mt-5 block">
        <span className="mb-1.5 block text-sm font-medium">Full name</span>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, name: true }))}
          autoComplete="name"
          aria-invalid={touched.name && !!nameErr}
          aria-describedby={touched.name && nameErr ? "pf-name-err" : undefined}
          className={`${field} ${touched.name && nameErr ? "border-coral" : "border-line"}`}
        />
        {touched.name && nameErr && (
          <span id="pf-name-err" className="mt-1 block text-xs text-coral">
            {nameErr}
          </span>
        )}
      </label>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-medium">Position</span>
        <input
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          placeholder="e.g. Head of Fundraising, FR Member"
          autoComplete="organization-title"
          className={`${field} border-line`}
        />
      </label>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-medium">Phone</span>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
          placeholder="+20 1xx xxx xxxx"
          autoComplete="tel"
          aria-invalid={touched.phone && !!phoneErr}
          aria-describedby={touched.phone && phoneErr ? "pf-phone-err" : undefined}
          className={`${field} ${touched.phone && phoneErr ? "border-coral" : "border-line"}`}
        />
        {touched.phone && phoneErr && (
          <span id="pf-phone-err" className="mt-1 block text-xs text-coral">
            {phoneErr}
          </span>
        )}
      </label>

      <div className="mt-4">
        <span className="mb-1.5 block text-sm font-medium">Email</span>
        <p className="flex h-11 items-center truncate rounded-xl border border-line px-3 text-muted" aria-label="Email, read only">
          {profile?.email}
        </p>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onClose} className="h-11 rounded-xl border border-line px-5 font-semibold hover:bg-fg/5">
          Cancel
        </button>
        <button type="submit" disabled={busy} className="h-11 rounded-xl bg-sky px-5 font-semibold text-[#071a33] disabled:opacity-40">
          {busy ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}

export function ProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reduce = !!useReducedMotion();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const items = panel.current.querySelectorAll<HTMLElement>("input:not([disabled]), button:not([disabled]), [href], textarea, select");
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-[#071a33]/60 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onPointerDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-title"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: reduce ? 0 : 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-line bg-raised p-6"
          >
            <Form onClose={onClose} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
