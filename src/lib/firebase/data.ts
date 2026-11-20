"use client";

import {
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
import type { Member, Refusal, Sponsor, SponsorStatus } from "@/types";

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
