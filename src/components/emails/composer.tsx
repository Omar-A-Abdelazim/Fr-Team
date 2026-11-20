"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Mail,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { auth } from "@/lib/firebase/client";
import { useSponsors } from "@/lib/firebase/data";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;
const STEPS = ["Setup", "Drafts", "Send"] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FIELD =
  "w-full rounded-xl border border-line bg-bg px-3.5 outline-none transition-colors duration-150 focus:border-sky";

type Target = { id: string; company: string; email: string; contactName: string; context: string; sponsorId?: string };
type Source = { title: string; url: string };
type Status = "waiting" | "researching" | "ready" | "failed";
type Draft = {
  status: Status;
  subject: string;
  body: string;
  summary: string;
  sources: Source[];
  approved: boolean;
  error: string;
};

const uid = () => Math.random().toString(36).slice(2, 10);
const blankDraft = (status: Status = "waiting"): Draft => ({
  status,
  subject: "",
  body: "",
  summary: "",
  sources: [],
  approved: false,
  error: "",
});

async function runPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const item = items[i++];
      await fn(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {error ? (
        <span role="alert" className="mt-1 block text-xs text-coral">
          {error}
        </span>
      ) : (
        hint && <span className="mt-1 block text-xs text-muted">{hint}</span>
      )}
    </label>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex gap-2 sm:gap-4" aria-label="Progress">
      {STEPS.map((s, i) => (
        <li key={s} className="flex-1" aria-current={i === step ? "step" : undefined}>
          <div className="h-1.5 overflow-hidden rounded-full bg-line">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-sky to-gold"
              style={{ originX: 0 }}
              initial={false}
              animate={{ scaleX: i <= step ? 1 : 0 }}
              transition={{ duration: 0.3, ease: EASE }}
            />
          </div>
          <span className="mt-2 flex items-center gap-2 text-sm">
            <motion.span
              initial={false}
              animate={{ scale: i === step ? 1.08 : 1 }}
              className={cn(
                "grid size-6 place-items-center rounded-full text-xs font-bold",
                i < step ? "bg-mint text-[#071a33]" : i === step ? "bg-gold text-[#071a33]" : "border border-line text-muted",
              )}
            >
              {i < step ? <Check className="size-3.5" /> : i + 1}
            </motion.span>
            <span className={i === step ? "font-semibold" : "text-muted"}>{s}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function EmailComposer() {
  const reduce = useReducedMotion();
  const { sponsors } = useSponsors();

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [purpose, setPurpose] = useState("");
  const [refs, setRefs] = useState<string[]>([""]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [attempted, setAttempted] = useState(false);

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [aiOff, setAiOff] = useState(false);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);

  // ---- validation -------------------------------------------------------
  const filledRefs = refs.map((r) => r.trim()).filter(Boolean);
  const validTargets = targets.filter((t) => t.company.trim() && EMAIL_RE.test(t.email.trim()));
  const errors = {
    purpose: purpose.trim().length < 15 ? "Write at least 15 characters so the drafts have something to work from." : "",
    refs: filledRefs.length < 1 ? "Paste at least one email that worked before." : "",
    targets: validTargets.length < 1 ? "Add at least one company with a valid email." : "",
  };
  const setupOk = !errors.purpose && !errors.refs && !errors.targets;

  function go(to: number) {
    setDir(to > step ? 1 : -1);
    setStep(to);
  }

  function continueToDrafts() {
    setAttempted(true);
    if (!setupOk) return;
    const clean = validTargets.map((t) => ({ ...t, company: t.company.trim(), email: t.email.trim() }));
    setTargets(clean);
    setDrafts((prev) => Object.fromEntries(clean.map((t) => [t.id, prev[t.id] ?? blankDraft()])));
    go(1);
  }

  // ---- drafting ---------------------------------------------------------
  const patch = (id: string, p: Partial<Draft>) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] ?? blankDraft()), ...p } }));

  async function draftOne(t: Target, aborted: { current: boolean }) {
    if (aborted.current) {
      patch(t.id, { status: "ready" });
      return;
    }
    patch(t.id, { status: "researching", error: "" });
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Sign in again to write drafts.");
      const res = await fetch("/api/emails/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          purpose: purpose.trim(),
          references: filledRefs,
          target: { company: t.company, email: t.email, contactName: t.contactName, context: t.context },
        }),
      });
      if (res.status === 503) {
        aborted.current = true;
        setAiOff(true);
        patch(t.id, { status: "ready" });
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        subject?: string;
        body?: string;
        research?: { summary?: string; sources?: Source[] };
        error?: string;
      };
      if (!res.ok)
        throw new Error(
          data.error ||
            (res.status === 504
              ? "The server took too long (504)."
              : `The draft didn't come back (error ${res.status}).`),
        );
      patch(t.id, {
        status: "ready",
        subject: data.subject ?? "",
        body: data.body ?? "",
        summary: data.research?.summary ?? "",
        sources: data.research?.sources ?? [],
      });
    } catch (e) {
      patch(t.id, { status: "failed", error: e instanceof Error ? e.message : "Something went wrong." });
    }
  }

  async function writeAll() {
    if (running) return;
    setRunning(true);
    setStarted(true);
    setAiOff(false);
    const aborted = { current: false };
    const todo = targets.filter((t) => drafts[t.id]?.status !== "ready" || !drafts[t.id]?.body);
    await runPool(todo, 3, (t) => draftOne(t, aborted));
    setRunning(false);
  }

  async function rewrite(t: Target) {
    await draftOne(t, { current: false });
  }

  const approved = targets.filter((t) => drafts[t.id]?.approved);
  const readyCount = targets.filter((t) => drafts[t.id]?.status === "ready").length;

  const variants = reduce
    ? { enter: { opacity: 0 }, center: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        enter: (d: number) => ({ opacity: 0, x: 32 * d }),
        center: { opacity: 1, x: 0 },
        exit: (d: number) => ({ opacity: 0, x: -32 * d }),
      };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Email composer</h1>
        <p className="mt-1 text-muted">Research each company, draft a personal email, then send it.</p>
      </header>

      <Stepper step={step} />

      <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.div
          key={step}
          custom={dir}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.25, ease: EASE }}
        >
          {step === 0 && (
            <SetupStep
              purpose={purpose}
              setPurpose={setPurpose}
              refs={refs}
              setRefs={setRefs}
              targets={targets}
              setTargets={setTargets}
              sponsors={sponsors}
              attempted={attempted}
              errors={errors}
              onContinue={continueToDrafts}
            />
          )}
          {step === 1 && (
            <DraftsStep
              targets={targets}
              drafts={drafts}
              patch={patch}
              aiOff={aiOff}
              running={running}
              started={started}
              readyCount={readyCount}
              approvedCount={approved.length}
              onWrite={writeAll}
              onRewrite={rewrite}
              onBack={() => go(0)}
              onNext={() => go(2)}
            />
          )}
          {step === 2 && <SendStep targets={approved} drafts={drafts} onBack={() => go(1)} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1
// ---------------------------------------------------------------------------

function SetupStep({
  purpose,
  setPurpose,
  refs,
  setRefs,
  targets,
  setTargets,
  sponsors,
  attempted,
  errors,
  onContinue,
}: {
  purpose: string;
  setPurpose: (v: string) => void;
  refs: string[];
  setRefs: React.Dispatch<React.SetStateAction<string[]>>;
  targets: Target[];
  setTargets: React.Dispatch<React.SetStateAction<Target[]>>;
  sponsors: ReturnType<typeof useSponsors>["sponsors"];
  attempted: boolean;
  errors: { purpose: string; refs: string; targets: string };
  onContinue: () => void;
}) {
  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-2xl border border-line bg-raised p-5 sm:p-6">
        <Field label="What's this email for?" error={attempted ? errors.purpose : ""} hint="Example: invite them to sponsor our robotics workshop in March.">
          <textarea
            rows={3}
            dir="auto"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className={cn(FIELD, "py-3")}
          />
        </Field>
      </section>

      <section className="space-y-4 rounded-2xl border border-line bg-raised p-5 sm:p-6">
        <div>
          <h2 className="font-display text-lg font-bold">Emails that worked before</h2>
          <p className="text-sm text-muted">The drafts copy their tone and structure. Add up to 3.</p>
        </div>
        <AnimatePresence initial={false}>
          {refs.map((r, i) => (
            <motion.div
              key={i}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="overflow-hidden"
            >
              <div className="flex items-start gap-2 p-0.5">
                <div className="flex-1">
                  <Field label={`Reference email ${i + 1}`}>
                    <textarea
                      rows={5}
                      dir="auto"
                      value={r}
                      onChange={(e) => setRefs((p) => p.map((x, j) => (j === i ? e.target.value : x)))}
                      className={cn(FIELD, "py-3")}
                    />
                  </Field>
                </div>
                {refs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setRefs((p) => p.filter((_, j) => j !== i))}
                    className="mt-7 inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm text-muted hover:bg-fg/5 hover:text-coral"
                  >
                    <Trash2 className="size-4" />
                    <span className="sr-only sm:not-sr-only">Remove</span>
                    <span className="sr-only">reference {i + 1}</span>
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {attempted && errors.refs && (
          <p role="alert" className="text-xs text-coral">
            {errors.refs}
          </p>
        )}
        {refs.length < 3 && (
          <button
            type="button"
            onClick={() => setRefs((p) => [...p, ""])}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-4 text-sm font-semibold hover:bg-fg/5"
          >
            <Plus className="size-4" /> Add reference email
          </button>
        )}
      </section>

      <RecipientsSection targets={targets} setTargets={setTargets} sponsors={sponsors} attempted={attempted} error={errors.targets} />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onContinue}
          className="h-11 w-full rounded-xl bg-gold px-6 font-semibold text-[#071a33] sm:w-auto"
        >
          Continue to drafts
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recipients
// ---------------------------------------------------------------------------

const MODES = ["From our sponsors", "Add by hand"] as const;

function RecipientsSection({
  targets,
  setTargets,
  sponsors,
  attempted,
  error,
}: {
  targets: Target[];
  setTargets: React.Dispatch<React.SetStateAction<Target[]>>;
  sponsors: ReturnType<typeof useSponsors>["sponsors"];
  attempted: boolean;
  error: string;
}) {
  const [mode, setMode] = useState<0 | 1>(0);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [form, setForm] = useState({ company: "", email: "", contactName: "" });
  const [formTried, setFormTried] = useState(false);
  const added = useMemo(() => new Set(targets.map((t) => t.sponsorId).filter(Boolean)), [targets]);

  const matches = useMemo(() => {
    const n = q.trim().toLowerCase();
    return sponsors
      .filter((s) => !added.has(s.id))
      .filter((s) => !n || s.name.toLowerCase().includes(n) || (s.email ?? "").toLowerCase().includes(n))
      .slice(0, 40);
  }, [sponsors, q, added]);

  function addPicked() {
    const rows = sponsors
      .filter((s) => picked.includes(s.id) && s.email)
      .map<Target>((s) => ({
        id: uid(),
        company: s.name,
        email: s.email,
        contactName: "",
        context: s.description,
        sponsorId: s.id,
      }));
    setTargets((prev) => [...prev, ...rows]);
    setPicked([]);
    toast.success(`${rows.length} ${rows.length === 1 ? "recipient" : "recipients"} added`);
  }

  const formErrors = {
    company: form.company.trim() ? "" : "Enter the company name.",
    email: EMAIL_RE.test(form.email.trim()) ? "" : "Enter a valid email, like name@company.com.",
  };

  function addManual(e: React.FormEvent) {
    e.preventDefault();
    setFormTried(true);
    if (formErrors.company || formErrors.email) return;
    setTargets((prev) => [
      ...prev,
      { id: uid(), company: form.company.trim(), email: form.email.trim(), contactName: form.contactName.trim(), context: "" },
    ]);
    setForm({ company: "", email: "", contactName: "" });
    setFormTried(false);
  }

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-raised p-5 sm:p-6">
      <div>
        <h2 className="font-display text-lg font-bold">Recipients</h2>
        <p className="text-sm text-muted">Pick sponsors the team already logged, or add a company by hand.</p>
      </div>

      <div role="tablist" aria-label="How to add recipients" className="relative grid grid-cols-2 rounded-xl border border-line bg-bg p-1">
        {MODES.map((m, i) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === i}
            onClick={() => setMode(i as 0 | 1)}
            className={cn(
              "relative z-10 h-10 rounded-lg text-sm font-semibold transition-colors duration-150",
              mode === i ? "text-[#071a33]" : "text-muted hover:text-fg",
            )}
          >
            {mode === i && (
              <motion.span
                layoutId="recipient-pill"
                className="absolute inset-0 -z-10 rounded-lg bg-sky"
                transition={{ duration: 0.25, ease: EASE }}
              />
            )}
            {m}
          </button>
        ))}
      </div>

      {mode === 0 ? (
        <div className="rounded-xl border border-line bg-bg p-4">
          <Field label="Search sponsors">
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className={cn(FIELD, "h-11 bg-raised pl-10")}
                placeholder="Company or email"
              />
            </span>
          </Field>
          <ul className="mt-3 max-h-56 divide-y divide-line overflow-y-auto rounded-xl border border-line bg-raised">
            {matches.length === 0 && <li className="px-4 py-3 text-sm text-muted">No logged sponsors match.</li>}
            {matches.map((s) => {
              const noEmail = !s.email;
              return (
                <li key={s.id}>
                  <label
                    className={cn(
                      "flex min-h-11 items-center gap-3 px-4 py-2",
                      noEmail ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-fg/5",
                    )}
                  >
                    <input
                      type="checkbox"
                      disabled={noEmail}
                      checked={picked.includes(s.id)}
                      onChange={(e) => setPicked((p) => (e.target.checked ? [...p, s.id] : p.filter((x) => x !== s.id)))}
                      className="size-4 accent-[var(--sky)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{s.name}</span>
                      <span className="block truncate text-xs text-muted">{noEmail ? "No email saved" : s.email}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            disabled={picked.length === 0}
            onClick={addPicked}
            className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-sky px-4 text-sm font-semibold text-[#071a33] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="size-4" /> Add {picked.length || ""} selected {picked.length === 1 ? "sponsor" : "sponsors"}
          </button>
        </div>
      ) : (
        <form onSubmit={addManual} noValidate className="rounded-xl border border-line bg-bg p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Company" error={formTried ? formErrors.company : ""}>
              <input dir="auto" value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} className={cn(FIELD, "h-11 bg-raised")} />
            </Field>
            <Field label="Email" error={formTried ? formErrors.email : ""}>
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={cn(FIELD, "h-11 bg-raised")} />
            </Field>
            <Field label="Contact name (optional)">
              <input dir="auto" value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} className={cn(FIELD, "h-11 bg-raised")} />
            </Field>
          </div>
          <button type="submit" className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-sky px-4 text-sm font-semibold text-[#071a33]">
            <Plus className="size-4" /> Add
          </button>
        </form>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold">Chosen recipients ({targets.length})</h3>
        {targets.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">Nobody yet. Pick a sponsor or add one by hand.</p>
        ) : (
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {targets.map((t) => (
                <motion.li
                  key={t.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: EASE }}
                  className="flex items-center gap-3 rounded-xl border border-line bg-bg px-4 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{t.company}</p>
                    <p className="truncate text-xs text-muted">
                      {t.email}
                      {t.contactName ? ` · ${t.contactName}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTargets((p) => p.filter((x) => x.id !== t.id))}
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm text-muted hover:text-coral"
                  >
                    <Trash2 className="size-4" />
                    <span className="sr-only">Remove {t.company}</span>
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
        {attempted && error && (
          <p role="alert" className="mt-2 text-xs text-coral">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Step 2
// ---------------------------------------------------------------------------

function DraftsStep({
  targets,
  drafts,
  patch,
  aiOff,
  running,
  started,
  readyCount,
  approvedCount,
  onWrite,
  onRewrite,
  onBack,
  onNext,
}: {
  targets: Target[];
  drafts: Record<string, Draft>;
  patch: (id: string, p: Partial<Draft>) => void;
  aiOff: boolean;
  running: boolean;
  started: boolean;
  readyCount: number;
  approvedCount: number;
  onWrite: () => void;
  onRewrite: (t: Target) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const pending = targets.some((t) => (drafts[t.id]?.status ?? "waiting") !== "ready" || !drafts[t.id]?.body);
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          {started || readyCount ? `${readyCount} of ${targets.length} ready` : `${targets.length} ${targets.length === 1 ? "company" : "companies"} to write for`}
        </p>
        <button
          type="button"
          onClick={onWrite}
          disabled={running || !pending}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gold px-5 font-semibold text-[#071a33] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Sparkles className="size-4" /> {running ? "Writing drafts…" : "Write drafts"}
        </button>
      </div>

      <AnimatePresence>
        {aiOff && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="flex gap-3 rounded-2xl border border-amber/40 bg-amber/10 p-4 text-sm"
          >
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber" />
            <p>
              AI drafting turns on once a Gemini API key is added to the project.
              <span className="text-muted"> You can still write each email by hand below.</span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <ul className="space-y-4">
        {targets.map((t, i) => (
          <motion.li
            key={t.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE, delay: Math.min(i, 8) * 0.06 }}
          >
            <DraftCard
              target={t}
              draft={drafts[t.id] ?? blankDraft()}
              onChange={(p) => patch(t.id, p)}
              onRewrite={() => onRewrite(t)}
            />
          </motion.li>
        ))}
      </ul>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button type="button" onClick={onBack} className="h-11 rounded-xl border border-line px-5 font-semibold hover:bg-fg/5">
          Back to setup
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={approvedCount === 0}
          className="h-11 rounded-xl bg-gold px-6 font-semibold text-[#071a33] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue with {approvedCount} approved
        </button>
      </div>
    </div>
  );
}

const STATUS_LABEL: Record<Status, string> = {
  waiting: "Waiting",
  researching: "Researching",
  ready: "Ready",
  failed: "Failed",
};

function DraftCard({
  target,
  draft,
  onChange,
  onRewrite,
}: {
  target: Target;
  draft: Draft;
  onChange: (p: Partial<Draft>) => void;
  onRewrite: () => void;
}) {
  const [open, setOpen] = useState(false);
  const busy = draft.status === "researching";
  const hasResearch = draft.summary || draft.sources.length > 0;
  const canApprove = draft.status === "ready" && draft.subject.trim() && draft.body.trim();

  return (
    <article className="relative overflow-hidden rounded-2xl border border-line bg-raised p-5 sm:p-6">
      {busy && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-sky/15 to-transparent"
          initial={{ x: "-100%" }}
          animate={{ x: "300%" }}
          transition={{ duration: 1.4, ease: "linear", repeat: Infinity }}
        />
      )}
      <header className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg font-bold">{target.company}</h3>
          <p className="truncate text-sm text-muted">
            {target.contactName ? `${target.contactName} · ` : ""}
            {target.email}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
            draft.status === "ready" && "border-mint/40 text-mint",
            draft.status === "failed" && "border-coral/40 text-coral",
            draft.status === "researching" && "border-sky/40 text-sky",
            draft.status === "waiting" && "border-line text-muted",
          )}
        >
          {busy && <span className="size-1.5 animate-pulse rounded-full bg-sky" />}
          {STATUS_LABEL[draft.status]}
        </span>
      </header>

      {draft.status === "failed" && (
        <div className="relative mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-coral/40 bg-coral/10 p-3 text-sm" role="alert">
          <p className="flex-1">{draft.error || "This draft didn't come back."} Try again, or write it by hand.</p>
          <button type="button" onClick={onRewrite} className="inline-flex h-10 items-center gap-2 rounded-lg border border-line px-3 font-semibold hover:bg-fg/5">
            <RefreshCw className="size-4" /> Retry draft
          </button>
          <button type="button" onClick={() => onChange({ status: "ready", error: "" })} className="h-10 rounded-lg px-3 font-semibold text-muted hover:text-fg">
            Write by hand
          </button>
        </div>
      )}

      {(draft.status === "ready" || draft.status === "researching") && (
        <div className="relative mt-4 space-y-4">
          <Field label="Subject">
            <input dir="auto" disabled={busy} value={draft.subject} onChange={(e) => onChange({ subject: e.target.value })} className={cn(FIELD, "h-11 disabled:opacity-50")} />
          </Field>
          <Field label="Email body">
            <textarea dir="auto" disabled={busy} rows={10} value={draft.body} onChange={(e) => onChange({ body: e.target.value })} className={cn(FIELD, "py-3 disabled:opacity-50")} />
          </Field>
        </div>
      )}

      {draft.status === "researching" && !draft.body && (
        <div className="relative mt-4 space-y-2" aria-hidden>
          <div className="h-3 w-3/4 rounded bg-line" />
          <div className="h-3 w-full rounded bg-line" />
          <div className="h-3 w-5/6 rounded bg-line" />
        </div>
      )}

      {draft.status === "waiting" && <p className="relative mt-3 text-sm text-muted">Waiting for Write drafts.</p>}

      {draft.status === "ready" && (
        <div className="relative mt-4 space-y-4">
          {hasResearch && (
            <div className="rounded-xl border border-line bg-bg">
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                className="flex min-h-11 w-full items-center justify-between px-4 text-sm font-semibold"
              >
                What we found
                <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown className="size-4" />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3 border-t border-line px-4 py-3 text-sm">
                      {draft.summary && <p className="text-muted">{draft.summary}</p>}
                      {draft.sources.length > 0 && (
                        <ul className="space-y-1.5">
                          {draft.sources.map((s) => (
                            <li key={s.url}>
                              <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sky underline-offset-4 hover:underline">
                                <ExternalLink className="size-3.5 shrink-0" />
                                <span className="break-all">{s.title}</span>
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={onRewrite} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-4 text-sm font-semibold hover:bg-fg/5">
              <RefreshCw className="size-4" /> Rewrite
            </button>
            <label className={cn("inline-flex items-center gap-3 text-sm font-semibold", canApprove ? "cursor-pointer" : "cursor-not-allowed opacity-50")}>
              Approved
              <button
                type="button"
                role="switch"
                aria-checked={draft.approved}
                aria-label={`Approve draft for ${target.company}`}
                disabled={!canApprove}
                onClick={() => onChange({ approved: !draft.approved })}
                className="relative h-7 w-12 rounded-full"
              >
                <motion.span
                  className="absolute inset-0 rounded-full"
                  initial={false}
                  animate={{ backgroundColor: draft.approved ? "var(--mint)" : "var(--line)" }}
                  transition={{ duration: 0.2 }}
                />
                <motion.span
                  className="absolute left-0.5 top-0.5 size-6 rounded-full bg-white shadow"
                  initial={false}
                  animate={{ x: draft.approved ? 20 : 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 28 }}
                />
              </button>
            </label>
          </div>
        </div>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Step 3
// ---------------------------------------------------------------------------

function gmailUrl(email: string, subject: string, body: string) {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

type SendState = { status: "ready" | "sending" | "sent" | "failed"; error?: string };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function SendStep({ targets, drafts, onBack }: { targets: Target[]; drafts: Record<string, Draft>; onBack: () => void }) {
  const reduce = useReducedMotion();
  const [states, setStates] = useState<Record<string, SendState>>({});
  const [busy, setBusy] = useState(false);
  const [offMsg, setOffMsg] = useState("");
  const alive = useRef(true);
  const celebrated = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const stateOf = (id: string): SendState => states[id] ?? { status: "ready" };
  const setState = (id: string, s: SendState) => setStates((p) => ({ ...p, [id]: s }));
  const sentCount = targets.filter((t) => stateOf(t.id).status === "sent").length;
  const unsent = targets.filter((t) => stateOf(t.id).status !== "sent");
  const allSent = targets.length > 0 && sentCount === targets.length;

  useEffect(() => {
    if (!allSent || celebrated.current) return;
    celebrated.current = true;
    if (reduce) return;
    import("canvas-confetti").then(({ default: confetti }) => {
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.3 }, colors: ["#f5c542", "#4cc9f0", "#5eead4"] });
    });
  }, [allSent, reduce]);

  async function sendOne(t: Target): Promise<"ok" | "fail" | "off"> {
    const d = drafts[t.id];
    setState(t.id, { status: "sending" });
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Sign in again to send.");
      const res = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to: t.email, subject: d.subject, body: d.body, company: t.company, sponsorId: t.sponsorId }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.status === 503) {
        if (alive.current) {
          setOffMsg(data.error || "Sending isn't set up yet.");
          setState(t.id, { status: "ready" });
        }
        return "off";
      }
      if (!res.ok || data.ok === false) throw new Error(data.error || `The email didn't send (error ${res.status}).`);
      if (alive.current) setState(t.id, { status: "sent" });
      return "ok";
    } catch (e) {
      if (alive.current) setState(t.id, { status: "failed", error: e instanceof Error ? e.message : "Something went wrong." });
      return "fail";
    }
  }

  async function run(list: Target[]) {
    if (busy) return;
    setBusy(true);
    setOffMsg("");
    for (let i = 0; i < list.length; i++) {
      if (!alive.current) break;
      const r = await sendOne(list[i]);
      if (r === "off") break;
      // a human-like, uneven gap between sends looks less like a bulk campaign to Gmail
      if (i < list.length - 1) await sleep(6000 + Math.random() * 6000);
    }
    if (alive.current) setBusy(false);
  }

  async function copy(t: Target) {
    const d = drafts[t.id];
    try {
      await navigator.clipboard.writeText(`Subject: ${d.subject}\n\n${d.body}`);
      toast.success(`Email for ${t.company} copied`);
    } catch {
      toast.error("Couldn't copy. Select the text and copy it by hand.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-3 rounded-2xl border border-sky/30 bg-sky/10 p-4 text-sm">
        <Mail className="mt-0.5 size-5 shrink-0 text-sky" />
        <p>Emails go out from the FR team&apos;s Gmail with your name and email in the signature; replies come back to you.</p>
      </div>

      <AnimatePresence>
        {offMsg && (
          <motion.div
            role="alert"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="flex gap-3 rounded-2xl border border-amber/40 bg-amber/10 p-4 text-sm"
          >
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber" />
            <p>
              {offMsg}
              <span className="text-muted"> Use Copy or Open in Gmail on each email for now.</span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {allSent && (
          <motion.div
            role="status"
            initial={{ opacity: 0, scale: reduce ? 1 : 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="flex items-center gap-3 rounded-2xl border border-mint/40 bg-mint/10 p-4"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-mint text-[#071a33]">
              <Check className="size-5" />
            </span>
            <p className="font-semibold">
              Sent {sentCount} {sentCount === 1 ? "email" : "emails"}. <span className="font-normal text-muted">Replies go to your inbox.</span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {targets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-8 text-center">
          <p className="font-semibold">No approved drafts yet</p>
          <p className="mt-1 text-sm text-muted">Approve a draft to see it here.</p>
          <button type="button" onClick={onBack} className="mt-4 h-11 rounded-xl bg-gold px-5 font-semibold text-[#071a33]">
            Review drafts
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">
              {sentCount} of {targets.length} sent
            </p>
            <button
              type="button"
              onClick={() => run(unsent)}
              disabled={busy || unsent.length === 0}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gold px-5 font-semibold text-[#071a33] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {busy ? "Sending…" : `Send all approved (${unsent.length})`}
            </button>
          </div>

          <ul className="space-y-4">
            {targets.map((t, i) => {
              const d = drafts[t.id];
              const st = stateOf(t.id);
              return (
                <motion.li
                  key={t.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: EASE, delay: Math.min(i, 8) * 0.06 }}
                  className={cn(
                    "rounded-2xl border bg-raised p-5 transition-colors duration-200 sm:p-6",
                    st.status === "sent" ? "border-mint/40" : st.status === "failed" ? "border-coral/40" : "border-line",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-lg font-bold">{t.company}</h3>
                      <p className="truncate text-sm text-muted">{t.email}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {st.status === "sending" && (
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky">
                          <Loader2 className="size-4 animate-spin" /> Sending
                        </span>
                      )}
                      {st.status === "sent" && (
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-mint">
                          <Check className="size-4" /> Sent
                        </span>
                      )}
                      {(st.status === "ready" || st.status === "failed") && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => run([t])}
                          className="inline-flex h-10 items-center gap-2 rounded-xl bg-gold px-4 text-sm font-semibold text-[#071a33] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {st.status === "failed" ? <RefreshCw className="size-4" /> : <Send className="size-4" />}
                          {st.status === "failed" ? "Retry" : "Send"}
                        </button>
                      )}
                      <button type="button" onClick={() => copy(t)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-3 text-sm font-semibold hover:bg-fg/5">
                        <Copy className="size-4" /> Copy
                      </button>
                      <a
                        href={gmailUrl(t.email, d.subject, d.body)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-3 text-sm font-semibold hover:bg-fg/5"
                      >
                        <ExternalLink className="size-4" /> Open in Gmail
                      </a>
                    </div>
                  </div>
                  {st.status === "failed" && (
                    <p role="alert" className="mt-3 text-sm text-coral">
                      {st.error}
                    </p>
                  )}
                  <p className="mt-4 text-sm font-semibold" dir="auto">
                    {d.subject}
                  </p>
                  <p className="mt-2 line-clamp-4 whitespace-pre-line text-sm text-muted" dir="auto">
                    {d.body}
                  </p>
                </motion.li>
              );
            })}
          </ul>
        </>
      )}

      {targets.length > 0 && (
        <button type="button" onClick={onBack} className="h-11 rounded-xl border border-line px-5 font-semibold hover:bg-fg/5">
          Back to drafts
        </button>
      )}
    </div>
  );
}
