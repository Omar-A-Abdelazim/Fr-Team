"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { setEmailRefusal, setEmailReply, setStatus, type EmailLog, type EmailReply } from "@/lib/firebase/data";
import { REFUSAL_LABELS } from "@/lib/constants";
import type { Refusal, Sponsor } from "@/types";
import type { RowActions, SheetRow } from "@/components/tables/emails-table";

export const REPLY_LABEL: Record<EmailReply, string> = {
  waiting: "Waiting",
  replied: "Replied",
  accepted: "Agreed",
  refused: "Said no",
};

/** Shared save logic for the emails table and the email slide-over. */
export function useEmailActions(ownerId: string | undefined, sponsors: Sponsor[]) {
  const [busy, setBusy] = useState(false);
  const sponsorOf = useCallback((e: EmailLog) => sponsors.find((s) => s.id === e.sponsorId) ?? null, [sponsors]);

  /** Any reply except "refused", which goes through the refusal dialog (see refuse). */
  const change = useCallback(
    async (email: EmailLog, reply: EmailReply) => {
      if (!ownerId || reply === "refused" || reply === email.reply || busy) return;
      setBusy(true);
      try {
        await setEmailReply(email, reply, sponsorOf(email), ownerId);
        if (reply === "accepted") {
          const { default: confetti } = await import("canvas-confetti");
          confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 }, colors: ["#f5b83d", "#4cc3f2", "#3dd6a3", "#ffffff"] });
          toast.success("Deal won!", { description: `${email.company} agreed. Nice work!` });
        } else {
          toast.success(`Marked as ${REPLY_LABEL[reply].toLowerCase()}`);
        }
      } catch (e) {
        toast.error(`Couldn't update the email to ${email.company}. Check your connection and try again.`, { description: why(e) });
      } finally {
        setBusy(false);
      }
    },
    [ownerId, busy, sponsorOf],
  );

  const refuse = useCallback(
    async (email: EmailLog, r: Refusal) => {
      if (!ownerId || busy) return false;
      setBusy(true);
      try {
        await setEmailRefusal(email, r.category, sponsorOf(email), ownerId, r.details, r.memberSelfAssessment);
        toast.success(`Refusal saved for ${email.company}`, { description: `Reason: ${REFUSAL_LABELS[r.category]}` });
        return true;
      } catch (e) {
        toast.error(`Couldn't save the refusal for ${email.company}.`, { description: why(e) });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [ownerId, busy, sponsorOf],
  );

  /** Reply change for a sponsor that has no email yet: maps straight onto the sponsor status. */
  const changeSponsor = useCallback(
    async (sponsor: Sponsor, reply: EmailReply, emailed: boolean) => {
      if (!ownerId || reply === "refused" || busy) return;
      const next = reply === "waiting" ? (emailed ? "contacted" : "not_contacted") : reply === "replied" ? "replied" : "accepted";
      if (sponsor.status === next) return;
      setBusy(true);
      try {
        await setStatus(sponsor.id, next, ownerId);
        if (reply === "accepted") {
          const { default: confetti } = await import("canvas-confetti");
          confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 }, colors: ["#f5b83d", "#4cc3f2", "#3dd6a3", "#ffffff"] });
          toast.success("Deal won!", { description: `${sponsor.name} agreed. Nice work!` });
        } else {
          toast.success(`Marked as ${REPLY_LABEL[reply].toLowerCase()}`);
        }
      } catch (e) {
        toast.error(`Couldn't update ${sponsor.name}. Check your connection and try again.`, { description: why(e) });
      } finally {
        setBusy(false);
      }
    },
    [ownerId, busy],
  );

  const refuseSponsor = useCallback(
    async (sponsor: Sponsor, r: Refusal) => {
      if (!ownerId || busy) return false;
      setBusy(true);
      try {
        await setStatus(sponsor.id, "refused", ownerId, r);
        toast.success(`Refusal saved for ${sponsor.name}`, { description: `Reason: ${REFUSAL_LABELS[r.category]}` });
        return true;
      } catch (e) {
        toast.error(`Couldn't save the refusal for ${sponsor.name}.`, { description: why(e) });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [ownerId, busy],
  );

  return { busy, change, refuse, changeSponsor, refuseSponsor };
}

function why(e: unknown) {
  const code = (e as { code?: string })?.code ?? "";
  if (code === "permission-denied") return "The database rules are out of date. The FR Head needs to publish the latest Firestore rules.";
  if (code === "unavailable") return "Can't reach the server. Check your connection and try again.";
  return (e as Error)?.message?.slice(0, 160) || "Try again.";
}

/** Row-level actions for the sheet and the Open panel: routes to the email or, for unsent sponsors, the sponsor. */
export function useRowActions(ownerId: string | undefined, sponsors: Sponsor[]): RowActions {
  const { busy, change, refuse, changeSponsor, refuseSponsor } = useEmailActions(ownerId, sponsors);
  const setReply = useCallback(
    (row: SheetRow, reply: EmailReply) => {
      if (row.email) void change(row.email, reply);
      else if (row.sponsor) void changeSponsor(row.sponsor, reply, false);
    },
    [change, changeSponsor],
  );
  const saveRefusal = useCallback(
    async (row: SheetRow, r: Refusal) => (row.email ? refuse(row.email, r) : row.sponsor ? refuseSponsor(row.sponsor, r) : false),
    [refuse, refuseSponsor],
  );
  return { busy, setReply, saveRefusal };
}
