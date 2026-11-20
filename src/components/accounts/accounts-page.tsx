"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/admin/avatar";
import { useAuth } from "@/lib/firebase/auth-context";
import { approveUser, rejectUser, setUserRole, useMembers, useSponsors } from "@/lib/firebase/data";
import type { Member } from "@/types";
import { Coin, Spark } from "@/components/auth/shapes";
import { BranchFacts } from "@/components/accounts/branch-facts";
import { ResetData } from "@/components/accounts/reset-data";

const EASE = [0.16, 1, 0.3, 1] as const;

function createdMs(m: Member): number {
  const c = (m as unknown as { createdAt?: unknown }).createdAt as
    | { toMillis?: () => number; seconds?: number }
    | number
    | string
    | undefined;
  if (!c) return 0;
  if (typeof c === "number") return c;
  if (typeof c === "string") return Date.parse(c) || 0;
  if (typeof c.toMillis === "function") return c.toMillis();
  if (typeof c.seconds === "number") return c.seconds * 1000;
  return 0;
}

function ago(ms: number) {
  if (!ms) return "Requested recently";
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return "Requested just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `Requested ${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Requested ${h} h ago`;
  const d = Math.floor(h / 24);
  return `Requested ${d} day${d === 1 ? "" : "s"} ago`;
}

async function pop() {
  const { default: confetti } = await import("canvas-confetti");
  confetti({ particleCount: 40, spread: 60, startVelocity: 28, origin: { y: 0.7 }, scalar: 0.8, colors: ["#f5b83d", "#4cc3f2", "#3dd6a3"] });
}

const btn = "inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium transition-colors duration-150 disabled:opacity-50";

/** Small confirm popover anchored under its trigger. Esc / outside click closes. */
function ConfirmButton({
  label,
  question,
  confirmLabel,
  onConfirm,
  className,
}: {
  label: string;
  question: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  className: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const reduce = !!useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" className={className} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {label}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label={question}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: EASE }}
            className="absolute right-0 top-full z-30 mt-2 w-64 rounded-2xl border border-line bg-raised p-4 text-left shadow-xl"
          >
            <p className="text-sm">{question}</p>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" autoFocus className={`${btn} h-9 border border-line hover:bg-fg/5`} onClick={() => setOpen(false)}>
                Keep
              </button>
              <button
                type="button"
                className={`${btn} h-9 bg-coral text-[#071a33] hover:brightness-110`}
                onClick={() => {
                  setOpen(false);
                  void onConfirm();
                }}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Count({ n, tone = "gold" }: { n: number; tone?: "gold" | "muted" }) {
  return (
    <span
      className={`ml-2 inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 align-middle font-sans text-xs font-semibold ${
        tone === "gold" ? "bg-gold text-[#071a33]" : "border border-line text-muted"
      }`}
    >
      {n}
    </span>
  );
}

function EmptyWaiting() {
  const reduce = !!useReducedMotion();
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <div className="relative h-20 w-32" aria-hidden>
        {[
          { el: <Coin size={40} />, left: "8%", top: "30%", d: 0 },
          { el: <Spark size={26} color="var(--mint)" />, left: "62%", top: "6%", d: 0.5 },
          { el: <Spark size={18} />, left: "78%", top: "58%", d: 1 },
        ].map((f, i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{ left: f.left, top: f.top }}
            animate={reduce ? undefined : { y: [0, -8, 0] }}
            transition={{ duration: 3.5, delay: f.d, repeat: Infinity, ease: "easeInOut" }}
          >
            {f.el}
          </motion.div>
        ))}
      </div>
      <p className="font-display text-lg font-semibold">No one is waiting.</p>
      <p className="text-sm text-muted">New sign-ups show up here the moment they ask to join.</p>
    </div>
  );
}

export function AccountsPage() {
  const { profile } = useAuth();
  const members = useMembers();
  const { sponsors } = useSponsors();
  const reduce = !!useReducedMotion();
  const [notApprovedOpen, setNotApprovedOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const { waiting, team, rejected } = useMemo(() => {
    const w = members.filter((m) => m.approved === false && !m.rejected).sort((a, b) => createdMs(b) - createdMs(a));
    const t = members
      .filter((m) => m.approved !== false && !m.rejected)
      .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "admin" ? -1 : 1));
    const r = members.filter((m) => m.rejected).sort((a, b) => a.name.localeCompare(b.name));
    return { waiting: w, team: t, rejected: r };
  }, [members]);

  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const s of sponsors) c.set(s.ownerId, (c.get(s.ownerId) ?? 0) + 1);
    return c;
  }, [sponsors]);

  if (!profile) return null;
  const me = profile.id;

  async function approve(m: Member, celebrate: boolean) {
    setBusy(m.id);
    try {
      await approveUser(m.id, me);
      toast.success(`${m.name} can now use FR Hub`);
      if (celebrate && !reduce) void pop();
    } catch {
      toast.error("Couldn't approve this account", { description: "Check your connection and try again." });
    } finally {
      setBusy(null);
    }
  }

  async function reject(m: Member, removing = false) {
    setBusy(m.id);
    try {
      await rejectUser(m.id, me);
      toast.success(removing ? `${m.name} no longer has access` : `${m.name} was not approved`);
    } catch {
      toast.error("Couldn't change this account", { description: "Check your connection and try again." });
    } finally {
      setBusy(null);
    }
  }

  async function role(m: Member, r: "member" | "admin") {
    try {
      await setUserRole(m.id, r);
      toast.success(`${m.name} is now ${r === "admin" ? "an admin" : "a member"}`);
    } catch {
      toast.error("Couldn't change the role", { description: "Try again in a moment." });
    }
  }

  const section = "rounded-3xl border border-line bg-raised";

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold">Accounts</h1>
        <p className="mt-1 text-muted">Approve new people before they can use FR Hub.</p>
      </header>

      <section aria-labelledby="waiting-h" className={section}>
        <h2 id="waiting-h" className="border-b border-line px-5 py-4 font-display text-lg font-semibold">
          Waiting for approval
          <Count n={waiting.length} />
        </h2>
        {waiting.length === 0 ? (
          <EmptyWaiting />
        ) : (
          <ul>
            <AnimatePresence initial={false}>
              {waiting.map((m) => (
                <motion.li
                  key={m.id}
                  layout={!reduce}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, x: 40, height: 0 }}
                  transition={{ duration: 0.25, ease: EASE }}
                  className="flex flex-col gap-3 border-b border-line px-5 py-4 last:border-b-0 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar member={m} size={40} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{m.name}</p>
                      <p className="truncate text-sm text-muted">{m.email}</p>
                      <p className="text-xs text-muted">{ago(createdMs(m))}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busy === m.id}
                      onClick={() => approve(m, true)}
                      className={`${btn} bg-mint text-[#071a33] hover:brightness-110`}
                    >
                      Approve
                    </button>
                    <ConfirmButton
                      label="Reject"
                      question={`Reject ${m.name}? They won't be able to sign in.`}
                      confirmLabel="Reject"
                      onConfirm={() => reject(m)}
                      className={`${btn} border border-coral text-coral hover:bg-coral/10`}
                    />
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>

      <section aria-labelledby="team-h" className={section}>
        <h2 id="team-h" className="border-b border-line px-5 py-4 font-display text-lg font-semibold">
          Team
          <Count n={team.length} tone="muted" />
        </h2>
        {team.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted">No approved accounts yet.</p>
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,2fr)_9rem_6rem_9rem] items-center gap-4 border-b border-line px-5 py-2 text-xs font-medium uppercase tracking-wide text-muted md:grid">
              <span>Person</span>
              <span>Role</span>
              <span>Sponsors</span>
              <span className="text-right">Access</span>
            </div>
            <ul>
              {team.map((m) => {
                const self = m.id === me;
                return (
                  <li
                    key={m.id}
                    className="grid grid-cols-2 items-center gap-x-4 gap-y-3 border-b border-line px-5 py-4 last:border-b-0 md:grid-cols-[minmax(0,2fr)_9rem_6rem_9rem]"
                  >
                    <div className="col-span-2 flex min-w-0 items-center gap-3 md:col-span-1">
                      <Avatar member={m} size={36} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{m.name}</p>
                        <p className="truncate text-sm text-muted">{m.email}</p>
                      </div>
                    </div>
                    <label className="flex flex-col gap-1 text-xs text-muted md:block">
                      <span className="md:sr-only">Role</span>
                      <select
                        value={m.role}
                        disabled={self}
                        title={self ? "You can't change your own role" : undefined}
                        aria-label={`Role for ${m.name}`}
                        onChange={(e) => role(m, e.target.value as "member" | "admin")}
                        className="h-10 w-full rounded-xl border border-line bg-raised px-3 text-sm text-fg transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                      {self && <span className="md:sr-only">You can&apos;t change your own role</span>}
                    </label>
                    <p className="text-sm text-muted">
                      <span className="md:hidden">Sponsors logged: </span>
                      <span className="font-medium text-fg">{counts.get(m.id) ?? 0}</span>
                    </p>
                    <div className="col-span-2 flex md:col-span-1 md:justify-end">
                      {self ? (
                        <span className="text-xs text-muted">That&apos;s you</span>
                      ) : (
                        <ConfirmButton
                          label="Remove access"
                          question={`Remove ${m.name}'s access? They won't be able to sign in. Their sponsors stay.`}
                          confirmLabel="Remove"
                          onConfirm={() => reject(m, true)}
                          className="h-10 rounded-full px-3 text-sm font-medium text-coral underline-offset-4 hover:underline"
                        />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="rej-h" className={section}>
        <h2 id="rej-h" className="font-display text-lg font-semibold">
          <button
            type="button"
            aria-expanded={notApprovedOpen}
            aria-controls="rej-list"
            onClick={() => setNotApprovedOpen((o) => !o)}
            className="flex w-full items-center justify-between rounded-3xl px-5 py-4 text-left"
          >
            <span>
              Not approved
              <Count n={rejected.length} tone="muted" />
            </span>
            <ChevronDown className={`size-4 text-muted transition-transform duration-200 ${notApprovedOpen ? "rotate-180" : ""}`} aria-hidden />
          </button>
        </h2>
        <AnimatePresence initial={false}>
          {notApprovedOpen && (
            <motion.div
              id="rej-list"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.25, ease: EASE }}
              className="overflow-hidden"
            >
              {rejected.length === 0 ? (
                <p className="border-t border-line px-5 py-6 text-center text-sm text-muted">Nobody has been turned away.</p>
              ) : (
                <ul className="border-t border-line">
                  {rejected.map((m) => (
                    <li key={m.id} className="flex flex-col gap-3 border-b border-line px-5 py-4 last:border-b-0 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <Avatar member={m} size={36} />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{m.name}</p>
                          <p className="truncate text-sm text-muted">{m.email}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={busy === m.id}
                        onClick={() => approve(m, false)}
                        className={`${btn} border border-mint text-mint hover:bg-mint/10`}
                      >
                        Approve anyway
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <BranchFacts />

      <ResetData />
    </div>
  );
}
