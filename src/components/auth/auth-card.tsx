"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
    </svg>
  );
}

function Field({ label, type = "text", autoComplete }: { label: string; type?: string; autoComplete?: string }) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        required
        className="h-11 w-full rounded-xl border border-line bg-bg px-3.5 outline-none transition-colors duration-150 focus:border-sky"
      />
    </div>
  );
}

export function AuthCard() {
  const [mode, setMode] = useState<Mode>("signin");
  const router = useRouter();

  function enter(dest: "/app" | "/admin") {
    toast.success("Preview mode", { description: "Real sign-in turns on once Firebase is connected." });
    router.push(dest);
  }

  return (
    <motion.div
      data-no-burst
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      className="relative w-full max-w-[400px] rounded-[28px] border border-line bg-raised/85 p-7 shadow-[0_30px_80px_-30px_var(--glow)] backdrop-blur-xl sm:p-8"
    >
      <div className="flex items-center justify-between">
        <Logo />
        <ThemeToggle />
      </div>

      <div className="relative mt-7 grid grid-cols-2 rounded-full border border-line p-1" role="tablist">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              "relative z-10 rounded-full py-2 text-sm font-semibold transition-colors duration-150",
              mode === m ? "text-[#071a33]" : "text-muted hover:text-fg",
            )}
          >
            {mode === m && (
              <motion.span
                layoutId="auth-tab"
                className="absolute inset-0 -z-10 rounded-full bg-gold"
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              />
            )}
            {m === "signin" ? "Sign in" : "Join the team"}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => enter("/app")}
        className="mt-6 flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-line bg-bg font-semibold transition-colors duration-150 hover:bg-fg/5"
      >
        <GoogleMark />
        Continue with Google
      </button>

      <div className="my-5 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" />
        or with email
        <span className="h-px flex-1 bg-line" />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enter("/app");
        }}
        className="space-y-4"
      >
        <AnimatePresence initial={false}>
          {mode === "signup" && (
            <motion.div
              key="name"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              <Field label="Full name" autoComplete="name" />
            </motion.div>
          )}
        </AnimatePresence>
        <Field label="Email" type="email" autoComplete="email" />
        <Field label="Password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} />
        <button
          type="submit"
          className="group relative h-11 w-full overflow-hidden rounded-xl bg-blue font-semibold text-white"
        >
          <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-300 group-hover:translate-x-full" />
          {mode === "signin" ? "Sign in" : "Create my account"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => enter("/admin")}
        className="mt-5 w-full text-center text-sm text-muted underline-offset-4 hover:text-fg hover:underline"
      >
        Preview the admin dashboard
      </button>
    </motion.div>
  );
}
