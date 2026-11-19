import { cn } from "@/lib/utils";

/** FR Hub mark: two overlapping rings (branch + partner) with a gold link point. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <circle cx="12" cy="16" r="8.5" fill="none" stroke="var(--blue)" strokeWidth="3" />
        <circle cx="20" cy="16" r="8.5" fill="none" stroke="var(--sky)" strokeWidth="3" />
        <circle cx="16" cy="16" r="3" fill="var(--gold)" />
      </svg>
      <span className="font-display text-lg font-bold tracking-tight">
        FR Hub
        <span className="ml-2 rounded-full border border-line px-2 py-0.5 align-middle font-sans text-[11px] font-medium text-muted">
          IEEE MET
        </span>
      </span>
    </span>
  );
}
