"use client";

import {
  where,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "./client";
import { POINTS } from "@/lib/constants";
import { domainOf } from "@/lib/duplicates";
import type { Member, Refusal, RefusalCategory, Sponsor, SponsorStatus } from "@/types";

function iso(v: unknown) {
  return v instanceof Timestamp ? v.toDate().toISOString() : typeof v === "string" ? v : new Date().toISOString();
}

export function useSponsors(enabled = true) {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(
      query(collection(db, "sponsors"), orderBy("updatedAt", "desc")),
      (snap) => {
        setSponsors(
          snap.docs.map((d) => {
            const x = d.data();
            return { ...(x as Sponsor), id: d.id, updatedAt: iso(x.updatedAt), createdAt: iso(x.createdAt) };
          }),
        );
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      },
    );
  }, [enabled]);

  return { sponsors, loading, error };
}

export function useMembers(enabled = true) {
  const [members, setMembers] = useState<Member[]>([]);
  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(collection(db, "users"), (snap) =>
      setMembers(snap.docs.map((d) => ({ ...(d.data() as Member), id: d.id }))),
    );
  }, [enabled]);
  return members;
}

/** Keys that must be unique across the team. Stored as doc ids so Firestore rejects a second claim. */
function uniqueKeys(s: { website: string; email: string; linkedin: string }) {
  const keys: string[] = [];
  const d = domainOf(s.website) || domainOf(s.email);
  // free mail domains are shared by many companies, so they can't identify one
  if (d && !/^(gmail|yahoo|hotmail|outlook|icloud)\./.test(d)) keys.push(`domain:${d}`);
  const li = s.linkedin.toLowerCase().match(/linkedin\.com\/(company|school)\/([^/?#]+)/);
  if (li) keys.push(`linkedin:${li[2]}`);
  return keys.map((k) => k.replace(/\//g, "_"));
}

export type NewSponsor = Pick<
  Sponsor,
  "name" | "partnerType" | "website" | "email" | "phone" | "facebook" | "linkedin" | "description"
>;

/** New sponsors are approved with points right away, unless the member overrode a possible-duplicate warning. */
export async function createSponsor(
  input: NewSponsor,
  owner: { id: string; name: string },
  possibleDuplicate = false,
) {
  const approved = !possibleDuplicate;
  const ref = doc(collection(db, "sponsors"));
  const batch = writeBatch(db);
  batch.set(ref, {
    ...input,
    name: input.name.trim(),
    ownerId: owner.id,
    ownerName: owner.name,
    status: "not_contacted",
    refusal: null,
    approved,
    reviewed: false,
    points: approved ? POINTS[input.partnerType] : 0,
    statusHistory: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  for (const k of uniqueKeys(input)) batch.set(doc(db, "sponsorKeys", k), { sponsorId: ref.id, ownerId: owner.id });
  try {
    await batch.commit();
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "permission-denied") {
      throw new Error("Someone on the team already logged a company with this website or LinkedIn page.");
    }
    throw e;
  }
  return ref.id;
}

export async function setStatus(id: string, status: SponsorStatus, by: string, refusal: Refusal | null = null) {
  await updateDoc(doc(db, "sponsors", id), {
    status,
    refusal: status === "refused" ? refusal : null,
    statusHistory: arrayUnion({ status, by, at: Timestamp.now() }),
    updatedAt: serverTimestamp(),
  });
}

/** Admin only. Idempotent: approving twice never adds points twice. */
export async function approveSponsor(id: string) {
  return runTransaction(db, async (tx) => {
    const ref = doc(db, "sponsors", id);
    const snap = await tx.get(ref);
    const s = snap.data() as Sponsor | undefined;
    if (!s) throw new Error("This sponsor no longer exists.");
    if (s.approved) {
      tx.update(ref, { reviewed: true });
      return 0;
    }
    const pts = POINTS[s.partnerType] ?? 0;
    tx.update(ref, { approved: true, reviewed: true, points: pts, approvedAt: serverTimestamp() });
    return pts;
  });
}

export async function rejectSponsor(id: string) {
  await updateDoc(doc(db, "sponsors", id), { reviewed: true, approved: false, points: 0 });
}

export type EmailReply = "waiting" | "replied" | "accepted" | "refused";

export type EmailLog = {
  id: string;
  senderId: string;
  senderName: string;
  to: string;
  company: string;
  sponsorId: string;
  subject: string;
  body: string;
  reply: EmailReply;
  refusalCategory?: RefusalCategory | "";
  sentAt: string;
};

/** Emails a member sent from the site, newest first. Members can read their own; admins can read anyone's. */
export function useMyEmails(uid: string | undefined) {
  const [emails, setEmails] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      query(collection(db, "emailLogs"), where("senderId", "==", uid)),
      (snap) => {
        const list = snap.docs.map((d) => {
          const x = d.data();
          return { ...(x as EmailLog), id: d.id, reply: (x.reply as EmailReply) ?? "waiting", body: x.body ?? "", sentAt: iso(x.sentAt) };
        });
        list.sort((a, b) => b.sentAt.localeCompare(a.sentAt));
        setEmails(list);
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [uid]);
  return { emails, loading };
}

const REPLY_TO_STATUS: Record<EmailReply, SponsorStatus | null> = {
  waiting: "contacted",
  replied: "replied",
  accepted: "accepted",
  refused: null, // refusals go through the refusal form so the reason is captured
};

/** Updates an email's reply status, and the linked sponsor's status when the member owns it. */
export async function setEmailReply(email: EmailLog, reply: EmailReply, sponsor?: Sponsor | null, by?: string) {
  await updateDoc(doc(db, "emailLogs", email.id), { reply, replyAt: serverTimestamp() });
  const next = REPLY_TO_STATUS[reply];
  if (next && sponsor && by && sponsor.ownerId === by && sponsor.status !== next) await setStatus(sponsor.id, next, by);
}

/**
 * Marks an email as refused with a reason. Also marks the linked sponsor as refused
 * (when the member owns it) so the reason shows up in Refusal insights.
 */
export async function setEmailRefusal(
  email: EmailLog,
  category: RefusalCategory,
  sponsor: Sponsor | null | undefined,
  by: string,
  details = "",
  selfAssessment = "",
) {
  await updateDoc(doc(db, "emailLogs", email.id), { reply: "refused", refusalCategory: category, replyAt: serverTimestamp() });
  if (sponsor && sponsor.ownerId === by) {
    await setStatus(sponsor.id, "refused", by, {
      category,
      details: details || sponsor.refusal?.details || "",
      memberSelfAssessment: selfAssessment || sponsor.refusal?.memberSelfAssessment || "",
    });
  }
}

/** Admin only: let a pending account into FR Hub. */
export async function approveUser(uid: string, by: string) {
  await updateDoc(doc(db, "users", uid), { approved: true, rejected: false, approvedBy: by, approvedAt: serverTimestamp() });
}

/** Admin only: refuse (or remove) someone's access. Their sponsors stay. */
export async function rejectUser(uid: string, by: string) {
  await updateDoc(doc(db, "users", uid), { approved: false, rejected: true, rejectedBy: by, rejectedAt: serverTimestamp() });
}

/** Admin only: promote or demote. */
export async function setUserRole(uid: string, role: "member" | "admin") {
  await updateDoc(doc(db, "users", uid), { role });
}

/**
 * One-time cleanup before the real team starts: deletes every sponsor, duplicate key and email log,
 * and every non-admin profile. Admin profiles stay. Firestore rules only allow this for admins.
 */
export async function resetAllData(onProgress?: (done: number, total: number) => void) {
  const { getDocs, collection: col } = await import("firebase/firestore");
  const targets = [];
  for (const name of ["sponsors", "sponsorKeys", "emailLogs"]) {
    const snap = await getDocs(col(db, name));
    targets.push(...snap.docs.map((d) => d.ref));
  }
  const users = await getDocs(col(db, "users"));
  targets.push(...users.docs.filter((d) => d.data().role !== "admin").map((d) => d.ref));

  let done = 0;
  for (let i = 0; i < targets.length; i += 400) {
    const batch = writeBatch(db);
    targets.slice(i, i + 400).forEach((r) => batch.delete(r));
    await batch.commit();
    done += Math.min(400, targets.length - i);
    onProgress?.(done, targets.length);
  }
  return targets.length;
}

const STATUS_TO_REPLY: Partial<Record<SponsorStatus, EmailReply>> = {
  not_contacted: "waiting",
  contacted: "waiting",
  no_reply: "waiting",
  replied: "replied",
  follow_up: "replied",
  accepted: "accepted",
  closed: "accepted",
  refused: "refused",
};

/**
 * One source of truth: when an email is linked to a sponsor, its reply and refusal reason come
 * from the sponsor (the same data My sponsors and Refusal insights use). Unlinked emails keep their own.
 */
export function linkEmails(emails: EmailLog[], sponsors: Sponsor[]): EmailLog[] {
  const byId = new Map(sponsors.map((s) => [s.id, s]));
  return emails.map((e) => {
    const s = e.sponsorId ? byId.get(e.sponsorId) : undefined;
    if (!s) return e;
    return {
      ...e,
      reply: STATUS_TO_REPLY[s.status] ?? e.reply,
      refusalCategory: s.status === "refused" ? (s.refusal?.category ?? "") : "",
    };
  });
}
