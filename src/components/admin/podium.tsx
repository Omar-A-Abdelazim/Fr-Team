"use client";

import { motion } from "framer-motion";
import { Crown, Trophy } from "lucide-react";
import { Avatar } from "./avatar";
import type { TeamRow } from "./stats";

const SLOTS = [
  { rank: 2, h: 110, delay: 0.25, tone: "bg-sky/25" },
  { rank: 1, h: 160, delay: 0.1, tone: "bg-gold/30" },
  { rank: 3, h: 80, delay: 0.4, tone: "bg-amber/25" },
];

export function Podium({ team }: { team: TeamRow[] }) {
  const top = team.slice(0, 3);
  return (
    <section className="flex flex-col rounded-3xl border border-line bg-raised p-6 sm:p-8">
      <h2 className="flex items-center gap-2 font-display text-xl font-bold">
        <Trophy className="size-5 text-gold" /> Leaderboard
      </h2>
      <div className="mx-auto mt-6 grid w-full max-w-md flex-1 grid-cols-3 items-end gap-2 pt-10 sm:gap-3">
        {SLOTS.map((slot) => {
          const row = top[slot.rank - 1];
          if (!row) return <div key={slot.rank} className="min-w-0" aria-hidden />;
          const first = slot.rank === 1;
          return (
            <div key={slot.rank} className="flex min-w-0 flex-col items-center">
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: slot.delay + 0.7, type: "spring", stiffness: 260, damping: 16 }}
                className="mb-2 flex w-full min-w-0 flex-col items-center gap-1"
              >
                {first && (
                  <motion.span animate={{ rotate: [-6, 6, -6], y: [0, -3, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
                    <Crown className="size-6 text-gold" />
                  </motion.span>
                )}
                <Avatar member={row.member} size={first ? 52 : 42} />
                <span className="block w-full truncate px-1 text-center text-xs font-medium sm:text-sm" title={row.member.name}>
                  {row.member.name.split(" ")[0]}
                </span>
              </motion.div>
              <motion.div
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: slot.delay, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className={`flex w-full origin-bottom items-start justify-center rounded-t-2xl pt-3 ${slot.tone}`}
                style={{
                  height: `clamp(${Math.round(slot.h * 0.65)}px, ${(slot.h / 10).toFixed(1)}vw, ${slot.h}px)`,
                  ...(first ? { boxShadow: "0 0 40px 2px color-mix(in srgb, var(--gold) 45%, transparent)" } : {}),
                }}
              >
                <div className="text-center">
                  <div className={`font-display font-bold ${first ? "text-2xl text-gold sm:text-3xl" : "text-xl sm:text-2xl"}`}>{row.points}</div>
                  <div className="text-xs text-muted">points</div>
                </div>
              </motion.div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
