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

const RTF = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "3 days ago", "yesterday". Pair with formatExact in a title attribute. */
export function formatRelative(iso: string, now = Date.now()) {
  const s = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(s);
  if (abs < 60) return "Just now";
  if (abs < 3600) return RTF.format(Math.round(s / 60), "minute");
  if (abs < 86400) return RTF.format(Math.round(s / 3600), "hour");
  if (abs < 86400 * 30) return RTF.format(Math.round(s / 86400), "day");
  if (abs < 86400 * 365) return RTF.format(Math.round(s / (86400 * 30)), "month");
  return RTF.format(Math.round(s / (86400 * 365)), "year");
}

export function formatExact(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}
