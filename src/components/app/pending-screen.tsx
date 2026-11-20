"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { AuthScene } from "@/components/auth/scene";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/lib/firebase/auth-context";

const EASE = [0.16, 1, 0.3, 1] as const;

function Hourglass({ reduce }: { reduce: boolean }) {
  return (
    <motion.svg
      viewBox="0 0 96 96"
      className="size-24"
      aria-hidden
      animate={reduce ? undefined : { rotate: [0, 0, 180, 180, 360], scale: [1, 1.04, 1, 1.04, 1] }}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", times: [0, 0.4, 0.5, 0.9, 1] }}
    >
      <circle cx="48" cy="48" r="44" fill="var(--gold)" fillOpacity=".14" />
      <path d="M28 20h40M28 76h40" stroke="var(--blue)" strokeWidth="5" strokeLinecap="round" />
      <path
        d="M32 20c0 16 10 22 16 28-6 6-16 12-16 28M64 20c0 16-10 22-16 28 6 6 16 12 16 28"
        fill="none"
        stroke="var(--sky)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M38 28h20c-2 6-6 9-10 12-4-3-8-6-10-12z" fill="var(--gold)" />
      <path d="M48 52v18M40 70h16" stroke="var(--gold)" strokeWidth="4" strokeLinecap="round" />
    </motion.svg>
  );
}

function Dots({ reduce }: { reduce: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-2 rounded-full bg-sky"
          animate={reduce ? { opacity: 0.7 } : { opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}

function Blocked() {
  return (
    <svg viewBox="0 0 96 96" className="size-24" aria-hidden>
      <circle cx="48" cy="48" r="44" fill="var(--coral)" fillOpacity=".14" />
      <circle cx="48" cy="48" r="26" fill="none" stroke="var(--coral)" strokeWidth="5" />
      <path d="M30 66l36-36" stroke="var(--coral)" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

/** Shown instead of the app while an account waits for (or was refused) FR admin approval. */
export function PendingScreen({ rejected, name }: { rejected: boolean; name: string }) {
  const reduce = !!useReducedMotion();
  const router = useRouter();
  const { signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const first = name.trim().split(/\s+/)[0] || "there";

  async function out() {
    setBusy(true);
    try {
      await signOut();
      router.replace("/");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative grid min-h-dvh place-items-center px-4 py-10">
      <AuthScene />
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>
      <motion.section
        data-no-burst
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
        className="relative z-10 w-full max-w-md rounded-3xl border border-line bg-raised p-6 text-center shadow-xl sm:p-8"
        role="status"
        aria-live="polite"
      >
        <div className="flex justify-center">
          <Logo />
        </div>
        <div className="mt-6 flex justify-center">{rejected ? <Blocked /> : <Hourglass reduce={reduce} />}</div>
        <h1 className="mt-4 font-display text-2xl font-bold">{rejected ? "Access not approved" : "Waiting for approval"}</h1>
        <p className="mt-2 text-muted">
          {rejected
            ? "An FR admin didn't approve this account. If you think that's a mistake, contact the FR Head."
            : `Hi ${first}, your request to join FR Hub is with the FR admins. This page opens by itself once someone approves you.`}
        </p>
        {!rejected && (
          <div className="mt-4 flex justify-center">
            <Dots reduce={reduce} />
          </div>
        )}
        <button
          type="button"
          onClick={out}
          disabled={busy}
          className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-full border border-line px-5 text-sm font-medium transition-colors duration-150 hover:bg-fg/5 disabled:opacity-60"
        >
          <LogOut className="size-4" aria-hidden />
          Sign out
        </button>
      </motion.section>
    </main>
  );
}
