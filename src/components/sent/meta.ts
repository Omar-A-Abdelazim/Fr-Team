import type { EmailReply } from "@/lib/firebase/data";

export const REPLY_META: Record<EmailReply, { label: string; choice: string; color: string }> = {
  waiting: { label: "Waiting", choice: "Waiting for reply", color: "var(--amber)" },
  replied: { label: "Replied", choice: "They replied", color: "var(--sky)" },
  accepted: { label: "Accepted", choice: "They agreed", color: "var(--mint)" },
  refused: { label: "Refused", choice: "They said no", color: "var(--coral)" },
};

export function formatSent(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
}
