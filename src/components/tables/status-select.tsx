"use client";

import { ChevronDown } from "lucide-react";
import { REPLY_META } from "@/components/sent/meta";
import { REPLY_LABEL } from "@/components/tables/use-email-actions";
import { TYPE_COLOR } from "@/lib/constants";
import type { EmailReply } from "@/lib/firebase/data";
import type { PartnerType } from "@/types";
import { cn } from "@/lib/utils";

const ORDER: EmailReply[] = ["waiting", "replied", "accepted", "refused"];

function tint(color: string) {
  return `color-mix(in srgb, ${color} 16%, transparent)`;
}

/** Initial on the partner type colour. Legacy emails with no sponsor get a neutral avatar. */
export function TypeAvatar({ name, type, size = "md" }: { name: string; type?: PartnerType | null; size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-xl font-display font-bold",
        size === "lg" ? "size-12 text-xl" : "size-9 text-base",
        type ? "text-[#071a33]" : "bg-fg/10 text-muted",
      )}
      style={type ? { background: TYPE_COLOR[type] } : undefined}
    >
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

const BADGE = "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-semibold";

/** Read-only status badge. */
export function StatusPill({ reply }: { reply: EmailReply }) {
  const color = REPLY_META[reply].color;
  return (
    <span className={BADGE} style={{ background: tint(color), borderColor: tint(color) }}>
      <span aria-hidden className="size-2 rounded-full" style={{ background: color }} />
      {REPLY_LABEL[reply]}
    </span>
  );
}

/** A badge that is really a native select laid invisibly over it, so keyboard and screen readers get a real control. */
export function StatusSelect({ value, disabled, label, onChange }: { value: EmailReply; disabled?: boolean; label: string; onChange: (r: EmailReply) => void }) {
  const color = REPLY_META[value].color;
  return (
    <span
      className={cn(
        BADGE,
        "relative pr-2 transition-[background-color,opacity] duration-150 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-sky",
        disabled && "opacity-60",
      )}
      style={{ background: tint(color), borderColor: tint(color) }}
    >
      <span aria-hidden className="size-2 rounded-full" style={{ background: color }} />
      {REPLY_LABEL[value]}
      <ChevronDown aria-hidden className="size-3.5 text-muted" />
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as EmailReply)}
        className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0 disabled:cursor-wait"
      >
        {ORDER.map((r) => (
          <option key={r} value={r} className="bg-bg text-fg">
            {REPLY_LABEL[r]}
          </option>
        ))}
      </select>
    </span>
  );
}
