"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Copy, ExternalLink, Globe, Mail, Paperclip, Phone, Send, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Envelope } from "@/components/auth/shapes";
import { RefusalDialog } from "@/components/member/refusal-dialog";
import { formatExact } from "@/components/sent/meta";
import type { SheetRow } from "@/components/tables/emails-table";
import { StatusPill, StatusSelect, TypeAvatar } from "@/components/tables/status-select";
import { REFUSAL_LABELS, TYPE_COLOR } from "@/lib/constants";
import type { EmailReply } from "@/lib/firebase/data";
import type { Refusal } from "@/types";
import { cn } from "@/lib/utils";

type IconType = React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
const Facebook: IconType = (p) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21h3z" /></svg>
);
const Linkedin: IconType = (p) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M5.2 8.9h3V19h-3V8.9zM6.7 4a1.7 1.7 0 110 3.500A1.7 1.700 0 016.700 4zM10.200 8.900h2.900v1.400c.4-.8 1.400-1.600 2.900-1.600 3.100 0 3.700 2 3.700 4.700V19h-3v-5.100c0-1.200 0-2.700-1.700-2.700s-1.900 1.300-1.900 2.600V19h-3V8.900z" /></svg>
);
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea,[tabindex]:not([tabindex="-1"])';
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky";
const EASE = [0.16, 1, 0.3, 1] as const;

function href(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}
const bare = (url: string) => url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");

function CopyButton({ value, what }: { value: string; what: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      toast.error(`Couldn't copy the ${what}. Select it and copy by hand.`);
    }
  }
  return (
    <button type="button" onClick={() => void copy()} aria-label={done ? `Copied ${what}` : `Copy ${what}`} title={`Copy ${what}`} className={cn("grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-fg/5 hover:text-fg", FOCUS)}>
      {done ? <Check aria-hidden className="size-4 text-mint" /> : <Copy aria-hidden className="size-4" />}
    </button>
  );
}

function ContactRow({ icon: Icon, label, value, link, external, copy }: { icon: IconType; label: string; value?: string; link?: string; external?: boolean; copy?: boolean }) {
  return (
    <div className="flex min-h-12 items-center gap-3 px-4 py-1.5">
      <Icon aria-hidden className="size-4 shrink-0 text-muted" />
      <dt className="w-20 shrink-0 text-xs font-medium text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 text-sm">
        {value && link ? (
          <a href={link} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className={cn("inline-flex max-w-full items-center gap-1.5 font-medium text-sky hover:underline", FOCUS)}>
            <span className="truncate" dir="auto">{value}</span>
            {external && <ExternalLink aria-hidden className="size-3 shrink-0" />}
          </a>
        ) : (
          <span className="text-muted">Not added</span>
        )}
      </dd>
      {copy && value && <CopyButton value={value} what={label.toLowerCase()} />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </section>
  );
}

export function EmailPanel({
  row,
  busy,
  suspended,
  onClose,
  onReply,
  onRefuse,
  readOnly = false,
}: {
  row: SheetRow | null;
  busy: boolean;
  suspended: boolean;
  onClose: () => void;
  /** Any reply except "refused", which goes through the refusal dialog. */
  onReply: (row: SheetRow, reply: EmailReply) => void;
  onRefuse: (row: SheetRow, r: Refusal) => void;
  readOnly?: boolean;
}) {
  const [dialogFor, setDialogFor] = useState<string | null>(null);
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const isOpen = !!row;

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
    if (!isOpen || suspended || dialogFor) return;
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
  }, [isOpen, suspended, dialogFor, onClose]);

  const sponsor = row?.sponsor ?? null;
  const email = row?.email ?? null;
  const dialogOpen = !!row && dialogFor === row.key;
  const refusal = row?.reply === "refused" ? (sponsor?.refusal ?? null) : null;
  const take = readOnly ? `${sponsor?.ownerName || "Member"}'s take` : "Your take";
  const type = sponsor?.partnerType;

  return (
    <>
      <AnimatePresence>
        {row && (
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
              transition={{ duration: 0.28, ease: EASE }}
              className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-line bg-bg shadow-2xl sm:max-w-xl"
            >
              <div className="flex items-start gap-4 border-b border-line bg-raised p-5">
                <TypeAvatar name={row.company} type={type} size="lg" />
                <div className="min-w-0 flex-1">
                  <h2 id="email-panel-title" dir="auto" className="font-display text-2xl font-bold leading-tight break-words">
                    {row.company}
                  </h2>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <span className="inline-flex h-8 items-center gap-2 rounded-full border border-line px-3 text-xs font-semibold">
                      <span aria-hidden className="size-2 rounded-full" style={{ background: type ? TYPE_COLOR[type] : "var(--fg-muted)" }} />
                      {type ?? "Email only"}
                    </span>
                    {readOnly ? (
                      <StatusPill reply={row.reply} />
                    ) : (
                      <StatusSelect
                        value={row.reply}
                        disabled={busy}
                        label={`Status for ${row.company}`}
                        onChange={(n) => (n === "refused" ? (row.reply !== "refused" ? setDialogFor(row.key) : undefined) : onReply(row, n))}
                      />
                    )}
                    {!!sponsor?.points && sponsor.points > 0 && (
                      <span className="inline-flex h-8 items-center rounded-full bg-gold/20 px-3 text-xs font-bold">+{sponsor.points} pts</span>
                    )}
                  </div>
                </div>
                <button ref={closeRef} type="button" onClick={onClose} aria-label="Close details" className={cn("grid size-11 shrink-0 place-items-center rounded-full border border-line hover:bg-fg/5", FOCUS)}>
                  <X aria-hidden className="size-5" />
                </button>
              </div>

              <div className="flex-1 space-y-7 overflow-y-auto p-5">
                <Section title="Contact details">
                  <dl className="divide-y divide-line rounded-2xl border border-line bg-raised">
                    <ContactRow icon={Mail} label="Email" value={row.to} link={row.to ? `mailto:${row.to}` : undefined} copy />
                    <ContactRow icon={Phone} label="Phone" value={sponsor?.phone} link={sponsor?.phone ? `tel:${sponsor.phone.replace(/\s+/g, "")}` : undefined} copy />
                    <ContactRow icon={Globe} label="Website" value={sponsor?.website ? bare(sponsor.website) : undefined} link={sponsor?.website ? href(sponsor.website) : undefined} external />
                    <ContactRow icon={Facebook} label="Facebook" value={sponsor?.facebook ? bare(sponsor.facebook) : undefined} link={sponsor?.facebook ? href(sponsor.facebook) : undefined} external />
                    <ContactRow icon={Linkedin} label="LinkedIn" value={sponsor?.linkedin ? bare(sponsor.linkedin) : undefined} link={sponsor?.linkedin ? href(sponsor.linkedin) : undefined} external />
                  </dl>
                </Section>

                {(sponsor?.description || row.reply === "refused") && (
                  <Section title="Notes">
                    {sponsor?.description ? (
                      <p dir="auto" className="whitespace-pre-wrap break-words rounded-2xl border border-line bg-raised p-4 text-sm leading-relaxed">
                        {sponsor.description}
                      </p>
                    ) : (
                      <p className="text-sm text-muted">No notes added.</p>
                    )}
                    {row.reply === "refused" && (
                      <div className="space-y-2.5 rounded-2xl border border-coral/30 bg-coral/[0.06] p-4 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex h-7 items-center rounded-full bg-coral/15 px-2.5 text-xs font-semibold text-coral">
                            {row.refusalCategory ? REFUSAL_LABELS[row.refusalCategory] : "No reason saved"}
                          </span>
                          {!readOnly && (
                            <button type="button" disabled={busy} onClick={() => setDialogFor(row.key)} className={cn("text-xs font-semibold text-sky hover:underline disabled:opacity-60", FOCUS)}>
                              Edit reason
                            </button>
                          )}
                        </div>
                        {refusal?.details && (
                          <p dir="auto">
                            <span className="text-muted">They said: </span>
                            {refusal.details}
                          </p>
                        )}
                        {refusal?.memberSelfAssessment && (
                          <p dir="auto" className="rounded-xl bg-gold/10 p-3">
                            <span className="font-semibold">{take}: </span>
                            {refusal.memberSelfAssessment}
                          </p>
                        )}
                      </div>
                    )}
                  </Section>
                )}

                <Section title="Email">
                  {email ? (
                    <div className="space-y-3">
                      <dl className="grid gap-3 text-sm sm:grid-cols-2">
                        <div className="min-w-0 sm:col-span-2">
                          <dt className="text-xs font-medium text-muted">Subject</dt>
                          <dd dir="auto" className="mt-0.5 font-semibold break-words">{email.subject || "No subject"}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-muted">Sent</dt>
                          <dd className="mt-0.5"><time dateTime={email.sentAt}>{formatExact(email.sentAt)}</time></dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-xs font-medium text-muted">To</dt>
                          <dd className="mt-0.5 break-all">{email.to}</dd>
                        </div>
                      </dl>
                      {!!email.attachments?.length && (
                        <ul aria-label="Attachments" className="flex flex-wrap gap-2">
                          {email.attachments.map((a, i) => (
                            <li key={`${a}-${i}`} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-raised px-3 py-1.5 text-xs font-medium">
                              <Paperclip aria-hidden className="size-3.5 shrink-0 text-muted" />
                              <span className="truncate" title={a}>{a.split("/").pop() || a}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div dir="auto" className="whitespace-pre-wrap break-words rounded-2xl border border-line bg-raised p-4 text-sm leading-relaxed">
                        {email.body || "No message body was saved."}
                      </div>
                      {row.count > 1 && <p className="text-xs text-muted">×{row.count} emails sent to this sponsor. Showing the latest.</p>}
                    </div>
                  ) : (
                    <div className="grid place-items-center rounded-2xl border border-dashed border-line px-6 py-10 text-center">
                      <div className="mb-3"><Envelope size={56} /></div>
                      <p className="font-display text-lg font-bold">No email sent yet</p>
                      <p className="mt-1 max-w-xs text-sm text-muted">
                        {readOnly ? "This member has not emailed this sponsor." : sponsor?.email ? "Write to this sponsor and track the reply here." : "Add an email for this sponsor in My sponsors to write to them."}
                      </p>
                      {!readOnly && sponsor?.email && (
                        <Link href={`/app/emails?to=${encodeURIComponent(sponsor.id)}`} className={cn("mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-sky px-5 text-sm font-semibold text-[#071a33] transition-opacity hover:opacity-90", FOCUS)}>
                          <Send aria-hidden className="size-4" /> Send email
                        </Link>
                      )}
                    </div>
                  )}
                </Section>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <RefusalDialog
        key={row && dialogOpen ? row.key : "none"}
        initial={sponsor?.refusal ?? null}
        company={row && dialogOpen ? row.company : null}
        onCancel={() => setDialogFor(null)}
        onSave={(r) => {
          if (!row) return;
          onRefuse(row, r);
          setDialogFor(null);
        }}
      />
    </>
  );
}
