"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { setEmailRefusal, setEmailReply, type EmailLog, type EmailReply } from "@/lib/firebase/data";
import { REFUSAL_LABELS } from "@/lib/constants";
import type { RefusalCategory, Sponsor } from "@/types";

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

  /** Any reply except "refused", which needs a reason first (see refuse). */
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
      } catch {
        toast.error(`Couldn't update the email to ${email.company}. Check your connection and try again.`);
      } finally {
        setBusy(false);
      }
    },
    [ownerId, busy, sponsorOf],
  );

  const refuse = useCallback(
    async (email: EmailLog, category: RefusalCategory) => {
      if (!ownerId || busy) return false;
      setBusy(true);
      try {
        await setEmailRefusal(email, category, sponsorOf(email), ownerId);
        toast.success(`Saved: ${REFUSAL_LABELS[category].toLowerCase()}`, { description: `${email.company} said no.` });
        return true;
      } catch {
        toast.error(`Couldn't save the reason for ${email.company}. Check your connection and try again.`);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [ownerId, busy, sponsorOf],
  );

  return { busy, change, refuse };
}
