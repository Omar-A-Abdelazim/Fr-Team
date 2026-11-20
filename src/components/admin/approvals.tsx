"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, PartyPopper, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/app/shell";
import { STATUS_META, TYPE_COLOR } from "@/lib/constants";
import type { Sponsor } from "@/types";
import { approveSponsor, rejectSponsor } from "@/lib/firebase/data";

export function ApprovalQueue({ sponsors, limit = 5 }: { sponsors: Sponsor[]; limit?: number }) {
  const [handled, setHandled] = useState<string[]>([]);
  // Everything new lands here once: auto-approved entries (points already given) and possible duplicates (no points yet).
  const pending = sponsors
    .filter((s) => !s.reviewed && !handled.includes(s.id))
    .sort((a, b) => Number(a.approved) - Number(b.approved));
  const visible = pending.slice(0, limit);

  const approve = async (s: Sponsor) => {
    setHandled((h) => [...h, s.id]);
    try {
      const pts = await approveSponsor(s.id);
      toast.success(pts ? `+${pts} points to ${s.ownerName}` : `${s.name} marked as checked`);
    } catch {
      setHandled((h) => h.filter((id) => id !== s.id));
      toast.error(`Couldn't approve ${s.name}. Try again.`);
    }
  };
  const reject = async (s: Sponsor) => {
    setHandled((h) => [...h, s.id]);
    try {
      await rejectSponsor(s.id);
      toast(`${s.name} no longer counts for points`);
    } catch {
      setHandled((h) => h.filter((id) => id !== s.id));
      toast.error(`Couldn't update ${s.name}. Try again.`);
    }
  };

  return (
    <section className="rounded-3xl border border-line bg-raised p-6 sm:p-8">
      <h2 className="font-display text-xl font-bold">New entries</h2>
      <p className="mt-1 text-sm text-muted">
        New sponsors get points automatically. Possible duplicates wait for you. Checking these is optional.
      </p>

      <ul className="mt-6 flex flex-col">
        <AnimatePresence initial={false} mode="popLayout">
          {visible.map((s, i) => (
            <motion.li
              key={s.id}
              layout
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.1 + i * 0.06 } }}
              exit={{ opacity: 0, x: 60, transition: { duration: 0.3 } }}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line py-3.5 first:border-t-0"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">{s.name}</span>
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ color: TYPE_COLOR[s.partnerType], background: `color-mix(in srgb, ${TYPE_COLOR[s.partnerType]} 15%, transparent)` }}
                  >
                    {s.partnerType}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                  <span>{s.ownerName}</span>
                  <StatusBadge {...STATUS_META[s.status]} />
                  {s.approved ? (
                    <span className="font-semibold text-mint">Auto-approved +{s.points}</span>
                  ) : (
                    <span className="font-semibold text-amber">Possible duplicate, no points yet</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => approve(s)}
                  aria-label={s.approved ? `Mark ${s.name} as checked` : `Approve ${s.name}`}
                  title={s.approved ? "Looks good" : "Approve and give points"}
                  className="flex size-9 items-center justify-center rounded-full bg-mint/20 text-mint transition-colors hover:bg-mint hover:text-[#071a33]"
                >
                  <Check className="size-4" />
                </motion.button>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => reject(s)}
                  aria-label={`Don't count ${s.name}`}
                  title="Don't count for points"
                  className="flex size-9 items-center justify-center rounded-full bg-coral/20 text-coral transition-colors hover:bg-coral hover:text-[#071a33]"
                >
                  <X className="size-4" />
                </motion.button>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {pending.length === 0 && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-8 flex items-center gap-3 text-sm text-muted">
          <PartyPopper className="size-5 text-gold" /> Nothing new to check.
        </motion.div>
      )}
    </section>
  );
}
