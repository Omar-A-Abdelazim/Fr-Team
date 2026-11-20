"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  File as FileIcon,
  FileImage,
  FileText,
  Mail,
  Paperclip,
  UploadCloud,
  X,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { toast } from "sonner";
import { auth } from "@/lib/firebase/client";
import { setStatus, useSponsors } from "@/lib/firebase/data";
import { useAuth } from "@/lib/firebase/auth-context";
import { SentCelebration } from "@/components/fx/sent-celebration";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;
const STEPS = ["Setup", "Drafts", "Send"] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FIELD =
  "w-full rounded-xl border border-line bg-bg px-3.5 outline-none transition-colors duration-150 focus:border-sky";

type Target = { id: string; company: string; email: string; contactName: string; context: string; sponsorId: string };
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

const ACCEPT = ".pdf,.ppt,.pptx,.doc,.docx,.png,.jpg,.jpeg";
const ACCEPT_RE = /\.(pdf|pptx?|docx?|png|jpe?g)$/i;
const MB = 1024 * 1024;
const INLINE_MAX = 3 * MB;
const BLOB_MAX_DEFAULT = 20 * MB;

type Attachment = {
  id: string;
  filename: string;
  size: number;
  progress: number;
  status: "uploading" | "done" | "failed";
  error?: string;
  url?: string;
  base64?: string;
  contentType?: string;
};

const fmtSize = (n: number) => (n >= MB ? `${(n / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function mimeOf(name: string, fallback: string) {
  if (fallback) return fallback;
  const e = name.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    pdf: "application/pdf",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
  };
  return map[e ?? ""] ?? "application/octet-stream";
}

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("Couldn't read the file."));
    r.readAsDataURL(file);
  });
}

function attachmentPayload(list: Attachment[]) {
  return list
    .filter((a) => a.status === "done")
    .map((a) => (a.url ? { filename: a.filename, url: a.url } : { filename: a.filename, base64: a.base64, contentType: a.contentType }));
}

function FileGlyph({ name, className }: { name: string; className?: string }) {
  if (/\.(png|jpe?g)$/i.test(name)) return <FileImage className={className} aria-hidden />;
  if (/\.(pdf|docx?|pptx?)$/i.test(name)) return <FileText className={className} aria-hidden />;
  return <FileIcon className={className} aria-hidden />;
}

function AttachmentChip({ a, onRemove }: { a: Attachment; onRemove?: () => void }) {
  return (
    <li className="rounded-xl border border-line bg-bg px-3 py-2">
      <div className="flex items-center gap-3">
        <FileGlyph name={a.filename} className="size-5 shrink-0 text-sky" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{a.filename}</p>
          <p className={cn("text-xs", a.status === "failed" ? "text-coral" : "text-muted")}>
            {a.status === "failed" ? a.error || "Upload failed." : a.status === "uploading" ? `Uploading ${Math.round(a.progress)}%` : fmtSize(a.size)}
          </p>
        </div>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="grid size-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-fg/5 hover:text-coral focus-visible:outline-2 focus-visible:outline-sky"
          >
            <X className="size-4" aria-hidden />
            <span className="sr-only">Remove {a.filename}</span>
          </button>
        )}
      </div>
      {a.status === "uploading" && (
        <div
          role="progressbar"
          aria-label={`Uploading ${a.filename}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(a.progress)}
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-line"
        >
          <div className="h-full rounded-full bg-gradient-to-r from-sky to-gold transition-[width] duration-200" style={{ width: `${a.progress}%` }} />
        </div>
      )}
    </li>
  );
}

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
  const { profile } = useAuth();
  const params = useSearchParams();
  const toParam = params.get("to");
  const quickApplied = useRef(false);
  const [quickNote, setQuickNote] = useState(0);

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
  const validTargets = targets.filter((t) => t.sponsorId && t.company.trim() && EMAIL_RE.test(t.email.trim()));
  const errors = {
    purpose: purpose.trim().length < 15 ? "Write at least 15 characters so the drafts have something to work from." : "",
    refs: filledRefs.length < 1 ? "Paste at least one email that worked before." : "",
    targets: validTargets.length < 1 ? "Add at least one company with a valid email." : "",
  };
  const setupOk = !errors.purpose && !errors.refs && !errors.targets;

  const [session, setSession] = useState(0);

  // ---- attachments ------------------------------------------------------
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [blob, setBlob] = useState<{ enabled: boolean; maxBytes: number } | null>(null);
  const [attachError, setAttachError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/blob/upload")
      .then((r) => r.json())
      .then((d: { enabled?: boolean; maxBytes?: number }) => {
        if (!cancelled) setBlob({ enabled: !!d.enabled, maxBytes: d.maxBytes || BLOB_MAX_DEFAULT });
      })
      .catch(() => {
        if (!cancelled) setBlob({ enabled: false, maxBytes: BLOB_MAX_DEFAULT });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const patchAtt = (id: string, p: Partial<Attachment>) => setAttachments((prev) => prev.map((a) => (a.id === id ? { ...a, ...p } : a)));

  async function addFiles(list: FileList | File[]) {
    const files = Array.from(list);
    if (files.length === 0 || !blob) return;
    const limit = blob.enabled ? Math.min(blob.maxBytes, 20 * MB) : INLINE_MAX;
    let total = attachments.reduce((n, a) => n + a.size, 0);
    const accepted: File[] = [];
    let err = "";
    for (const f of files) {
      if (!ACCEPT_RE.test(f.name)) {
        err = `${f.name} isn't a supported type. Use PDF, PowerPoint, Word or an image.`;
        continue;
      }
      if (total + f.size > limit) {
        err = `${f.name} is too big. Attachments can total ${blob.enabled ? "20 MB" : "3 MB"}; you have ${fmtSize(Math.max(0, limit - total))} left.`;
        continue;
      }
      total += f.size;
      accepted.push(f);
    }
    setAttachError(err);
    for (const f of accepted) {
      const id = uid();
      const base: Attachment = { id, filename: f.name, size: f.size, progress: 0, status: "uploading" };
      setAttachments((prev) => [...prev, base]);
      try {
        if (blob.enabled) {
          const token = await auth.currentUser?.getIdToken();
          if (!token) throw new Error("Sign in again to upload.");
          const res = await upload(f.name, f, {
            access: "public",
            handleUploadUrl: "/api/blob/upload",
            clientPayload: token,
            onUploadProgress: (e) => patchAtt(id, { progress: e.percentage }),
          });
          patchAtt(id, { url: res.url, progress: 100, status: "done" });
        } else {
          const base64 = await readBase64(f);
          patchAtt(id, { base64, contentType: mimeOf(f.name, f.type), progress: 100, status: "done" });
        }
      } catch (e) {
        patchAtt(id, { status: "failed", error: e instanceof Error ? e.message : "Upload failed." });
      }
    }
  }

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    setAttachError("");
  };
  const readyAtt = attachments.filter((a) => a.status === "done");
  const uploading = attachments.some((a) => a.status === "uploading");

  // Quick send: /app/emails?to=id1,id2 preselects the member's own sponsors that have an email.
  useEffect(() => {
    if (quickApplied.current || !toParam || !profile || sponsors.length === 0) return;
    quickApplied.current = true;
    const ids = new Set(toParam.split(",").map((x) => x.trim()).filter(Boolean));
    const rows = sponsors
      .filter((s) => ids.has(s.id) && s.ownerId === profile.id && !!s.email)
      .map<Target>((s) => ({ id: uid(), company: s.name, email: s.email, contactName: "", context: s.description, sponsorId: s.id }));
    if (rows.length === 0) return;
    // Sponsors load asynchronously, so this one-time preselect has to run after they arrive.
    /* eslint-disable react-hooks/set-state-in-effect */
    setTargets((prev) => [...prev, ...rows.filter((r) => !prev.some((p) => p.sponsorId === r.sponsorId))]);
    setQuickNote(rows.length);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [toParam, profile, sponsors]);

  /** Wipe every piece of composer state so the next visit starts on a fresh Setup step. */
  const resetAll = useCallback(() => {
    setStep(0);
    setDir(1);
    setPurpose("");
    setRefs([""]);
    setTargets([]);
    setAttempted(false);
    setDrafts({});
    setAiOff(false);
    setRunning(false);
    setStarted(false);
    setQuickNote(0);
    setAttachments([]);
    setAttachError("");
    setSession((n) => n + 1);
  }, []);

  function go(to: number) {
    setDir(to > step ? 1 : -1);
    setStep(to);
  }

  function continueToDrafts() {
    setAttempted(true);
    if (!setupOk || uploading) return;
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
          target: { company: t.company, email: t.email, contactName: t.contactName, context: t.context, sponsorId: t.sponsorId },
          hasAttachment: readyAtt.length > 0,
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

      {quickNote > 0 && step === 0 && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-line bg-raised px-4 py-2.5 text-sm">
          <span>
            {quickNote} {quickNote === 1 ? "sponsor" : "sponsors"} added from My emails
          </span>
          <button
            type="button"
            onClick={() => setQuickNote(0)}
            className="inline-flex h-10 items-center rounded-lg px-3 font-semibold text-sky focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky"
          >
            Dismiss
          </button>
        </div>
      )}

      <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.div
          key={`${session}-${step}`}
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
              attachments={attachments}
              blob={blob}
              attachError={attachError}
              onAddFiles={addFiles}
              onRemoveAttachment={removeAttachment}
              uploading={uploading}
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
          {step === 2 && <SendStep attachments={readyAtt} targets={approved} drafts={drafts} sponsors={sponsors} onBack={() => go(1)} onFinish={resetAll} />}
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
  attachments,
  blob,
  attachError,
  onAddFiles,
  onRemoveAttachment,
  uploading,
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
  attachments: Attachment[];
  blob: { enabled: boolean; maxBytes: number } | null;
  attachError: string;
  onAddFiles: (f: FileList | File[]) => void;
  onRemoveAttachment: (id: string) => void;
  uploading: boolean;
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

      <AttachmentsSection
        attachments={attachments}
        blob={blob}
        error={attachError}
        onAddFiles={onAddFiles}
        onRemove={onRemoveAttachment}
      />

      <RecipientsSection targets={targets} setTargets={setTargets} sponsors={sponsors} attempted={attempted} error={errors.targets} />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onContinue}
          disabled={uploading}
          className="h-11 w-full rounded-xl bg-gold px-6 font-semibold text-[#071a33] transition-opacity disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
        >
          {uploading ? "Uploading files…" : "Continue to drafts"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

function AttachmentsSection({
  attachments,
  blob,
  error,
  onAddFiles,
  onRemove,
}: {
  attachments: Attachment[];
  blob: { enabled: boolean; maxBytes: number } | null;
  error: string;
  onAddFiles: (f: FileList | File[]) => void;
  onRemove: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const ready = blob !== null;

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-raised p-5 sm:p-6">
      <div>
        <h2 className="font-display text-lg font-bold">Attachments</h2>
        <p className="text-sm text-muted">
          {`Add your proposal or flyer (up to ${blob?.enabled ? "20" : "3"} MB). The same file goes with every email.`}
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (ready) onAddFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center gap-3 rounded-xl border border-dashed p-6 text-center transition-colors duration-150",
          over ? "border-sky bg-sky/10" : "border-line",
        )}
      >
        <UploadCloud className="size-7 text-sky" aria-hidden />
        <p className="hidden text-sm text-muted sm:block">Drop files here</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose files to attach"
          onChange={(e) => {
            if (e.target.files) onAddFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={!ready}
          onClick={() => inputRef.current?.click()}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-line px-4 text-sm font-semibold hover:bg-fg/5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Paperclip className="size-4" aria-hidden /> Add file
        </button>
        <p className="text-xs text-muted">PDF, PowerPoint, Word, PNG or JPG</p>
      </div>

      {error && (
        <p role="alert" className="text-xs text-coral">
          {error}
        </p>
      )}

      {attachments.length > 0 && (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {attachments.map((a) => (
              <motion.div
                key={a.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: EASE }}
              >
                <AttachmentChip a={a} onRemove={() => onRemove(a.id)} />
              </motion.div>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Recipients
// ---------------------------------------------------------------------------

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
  const { profile } = useAuth();
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const added = useMemo(() => new Set(targets.map((t) => t.sponsorId)), [targets]);

  const mine = useMemo(
    () => (profile ? sponsors.filter((s) => s.ownerId === profile.id) : []),
    [sponsors, profile],
  );
  const hasAnyEmail = mine.some((s) => !!s.email);

  const matches = useMemo(() => {
    const n = q.trim().toLowerCase();
    return mine
      .filter((s) => !added.has(s.id))
      .filter((s) => !n || s.name.toLowerCase().includes(n) || (s.email ?? "").toLowerCase().includes(n))
      .slice(0, 60);
  }, [mine, q, added]);

  function addPicked() {
    const rows = mine
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

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-raised p-5 sm:p-6">
      <div>
        <h2 className="font-display text-lg font-bold">Recipients</h2>
        <p className="text-sm text-muted">You can email the sponsors you logged yourself.</p>
      </div>

      {!hasAnyEmail && targets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line p-6 text-center">
          <p className="font-semibold">Log a sponsor with an email first</p>
          <p className="mt-1 text-sm text-muted">Sponsors you add in My sponsors show up here.</p>
          <Link
            href="/app"
            className="mt-4 inline-flex h-10 items-center rounded-xl bg-sky px-4 text-sm font-semibold text-[#071a33]"
          >
            Go to My sponsors
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-bg p-4">
          <Field label="Search your sponsors">
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
            {matches.length === 0 && <li className="px-4 py-3 text-sm text-muted">No sponsors match.</li>}
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
                      <span className="block truncate text-xs text-muted">
                        {noEmail ? "No email saved — add it in My sponsors" : s.email}
                      </span>
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
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold">Chosen recipients ({targets.length})</h3>
        {targets.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">Nobody yet. Pick a sponsor from the list.</p>
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
                    <p className="truncate text-xs text-muted">{t.email}</p>
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

const PROGRESS_STEPS = ["Reading their website…", "Searching recent news…", "Writing the email…"];

function ProgressText({ company }: { company: string }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => Math.min(n + 1, PROGRESS_STEPS.length - 1)), 9000);
    return () => clearInterval(t);
  }, []);
  return (
    <div role="status" className="text-sm">
      <p className="font-semibold">Researching {company}…</p>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={i}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE }}
          className="mt-0.5 text-muted"
        >
          {PROGRESS_STEPS[i]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

function ResearchRows({ summary }: { summary: string }) {
  const lines = summary.split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    <dl className="space-y-2">
      {lines.map((line, i) => {
        const m = line.match(/^([^:]{2,40}):\s*(.+)$/);
        return m ? (
          <div key={i}>
            <dt className="inline font-semibold text-fg">{m[1]}: </dt>
            <dd className="inline text-muted">{m[2]}</dd>
          </div>
        ) : (
          <p key={i} className="text-muted">
            {line}
          </p>
        );
      })}
    </dl>
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
        <div className="relative mt-4">
          <ProgressText company={target.company} />
          <div className="mt-3 space-y-2" aria-hidden>
            <div className="h-3 w-3/4 rounded bg-line" />
            <div className="h-3 w-full rounded bg-line" />
            <div className="h-3 w-5/6 rounded bg-line" />
          </div>
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
                      {draft.summary && <ResearchRows summary={draft.summary} />}
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

function SendStep({
  attachments,
  targets,
  drafts,
  sponsors,
  onBack,
  onFinish,
}: {
  attachments: Attachment[];
  targets: Target[];
  drafts: Record<string, Draft>;
  sponsors: ReturnType<typeof useSponsors>["sponsors"];
  onBack: () => void;
  onFinish: () => void;
}) {
  const { profile } = useAuth();
  const [states, setStates] = useState<Record<string, SendState>>({});
  const [busy, setBusy] = useState(false);
  const [offMsg, setOffMsg] = useState("");
  const alive = useRef(true);

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

  async function sendOne(t: Target): Promise<"ok" | "fail" | "off"> {
    const d = drafts[t.id];
    setState(t.id, { status: "sending" });
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Sign in again to send.");
      const res = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to: t.email, subject: d.subject, body: d.body, company: t.company, sponsorId: t.sponsorId, attachments: attachmentPayload(attachments) }),
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
      if (t.sponsorId && profile) {
        const sp = sponsors.find((x) => x.id === t.sponsorId);
        if (sp && sp.ownerId === profile.id && sp.status === "not_contacted") {
          setStatus(sp.id, "contacted", profile.id).catch(() => {});
        }
      }
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

      <AnimatePresence>{allSent && <SentCelebration key="celebrate" count={sentCount} onFinish={onFinish} />}</AnimatePresence>

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
          {attachments.length > 0 && (
            <div className="rounded-2xl border border-line bg-raised p-4">
              <p className="mb-2 text-sm font-semibold">Attached to every email</p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {attachments.map((a) => (
                  <AttachmentChip key={a.id} a={a} />
                ))}
              </ul>
            </div>
          )}

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
