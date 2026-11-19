"use client";

import { motion } from "framer-motion";
import { CountUp } from "@/components/motion/count-up";

const RANKS = [
  { name: "Rookie", at: 0 },
  { name: "Closer", at: 10 },
  { name: "Deal maker", at: 25 },
  { name: "FR legend", at: 50 },
];

export function MyHeader({
  name,
  points,
  stats,
}: {
  name: string;
  points: number;
  stats: { label: string; value: number; color: string }[];
}) {
  const idx = RANKS.findLastIndex((r) => points >= r.at);
  const rank = RANKS[idx];
  const next = RANKS[idx + 1];
  const progress = next ? (points - rank.at) / (next.at - rank.at) : 1;
  const R = 46;
  const C = 2 * Math.PI * R;

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-line bg-raised p-6 sm:p-8">
      {/* living background shapes */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute -right-16 -top-20 size-64 rounded-full bg-gold/20 blur-3xl"
          animate={{ scale: [1, 1.15, 1], x: [0, -20, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-24 left-1/3 size-72 rounded-full bg-sky/15 blur-3xl"
          animate={{ scale: [1.1, 0.95, 1.1], x: [0, 30, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-muted">Welcome back</p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{name}, let&apos;s close one today</h1>
          <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 + i * 0.06 }}
              >
                <dt className="text-sm text-muted">{s.label}</dt>
                <dd className="font-display text-3xl font-bold" style={{ color: s.color }}>
                  <CountUp to={s.value} />
                </dd>
              </motion.div>
            ))}
          </dl>
        </div>

        <div className="flex items-center gap-5">
          <div className="relative size-32">
            <svg viewBox="0 0 110 110" className="size-full -rotate-90">
              <circle cx="55" cy="55" r={R} fill="none" stroke="var(--line)" strokeWidth="10" />
              <motion.circle
                cx="55"
                cy="55"
                r={R}
                fill="none"
                stroke="url(#rank)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={C}
                initial={{ strokeDashoffset: C }}
                animate={{ strokeDashoffset: C * (1 - progress) }}
                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
              />
              <defs>
                <linearGradient id="rank" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="var(--sky)" />
                  <stop offset="100%" stopColor="var(--gold)" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                <CountUp to={points} className="block font-display text-3xl font-extrabold text-gold" />
                <span className="text-xs text-muted">points</span>
              </div>
            </div>
          </div>
          <div>
            <p className="font-display text-xl font-bold">{rank.name}</p>
            <p className="text-sm text-muted">
              {next ? `${next.at - points} points to ${next.name}` : "Top rank reached"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
