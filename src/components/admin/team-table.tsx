"use client";

import { motion } from "framer-motion";
import { STATUS_META, STATUSES } from "@/lib/constants";
import type { SponsorStatus } from "@/types";
import { Avatar } from "./avatar";
import type { TeamRow } from "./stats";

function StatusBar({ row, delay }: { row: TeamRow; delay: number }) {
  const parts = STATUSES.filter((s) => (row.byStatus[s] ?? 0) > 0);
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-bg/60">
      {parts.map((s: SponsorStatus) => (
        <motion.div
          key={s}
          title={`${STATUS_META[s].label}: ${row.byStatus[s]}`}
          style={{ background: STATUS_META[s].color, transformOrigin: "left" }}
          className="h-full"
          initial={{ flexGrow: 0, opacity: 0 }}
          animate={{ flexGrow: row.byStatus[s], opacity: 1 }}
          transition={{ delay, duration: 0.8, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

const cols = [
  { key: "entries", label: "Entries" },
  { key: "contacted", label: "Contacted" },
  { key: "noReply", label: "No reply" },
  { key: "refused", label: "Refused" },
  { key: "won", label: "Won" },
  { key: "points", label: "Points" },
] as const;

export function TeamTable({ team }: { team: TeamRow[] }) {
  return (
    <section className="rounded-3xl border border-line bg-raised p-6 sm:p-8">
      <h2 className="font-display text-xl font-bold">Team</h2>
      <p className="mt-1 text-sm text-muted">Ranked by points</p>

      <div className="mt-6 hidden sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th className="pb-3 font-medium">Member</th>
              {cols.map((c) => (
                <th key={c.key} className="pb-3 text-right font-medium">{c.label}</th>
              ))}
              <th className="w-44 pb-3 pl-6 font-medium">Status mix</th>
            </tr>
          </thead>
          <tbody>
            {team.map((row, i) => (
              <motion.tr
                key={row.member.id}
                layout
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.06, duration: 0.45 }}
                className="border-t border-line transition-colors hover:bg-bg/50"
              >
                <td className="py-3.5">
                  <div className="flex items-center gap-3">
                    <Avatar member={row.member} />
                    <span className="font-medium">{row.member.name}</span>
                  </div>
                </td>
                {cols.map((c) => (
                  <td key={c.key} className={`py-3.5 text-right tabular-nums ${c.key === "points" ? "font-display text-base font-bold text-gold" : c.key === "won" ? "text-mint" : ""}`}>
                    {row[c.key]}
                  </td>
                ))}
                <td className="py-3.5 pl-6">
                  <StatusBar row={row} delay={0.3 + i * 0.06} />
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:hidden">
        {team.map((row, i) => (
          <motion.div
            key={row.member.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="rounded-2xl bg-bg/50 p-4"
          >
            <div className="flex items-center gap-3">
              <Avatar member={row.member} />
              <span className="flex-1 font-medium">{row.member.name}</span>
              <span className="font-display text-xl font-bold text-gold">{row.points}</span>
            </div>
            <div className="mt-3"><StatusBar row={row} delay={0.2 + i * 0.06} /></div>
            <dl className="mt-3 grid grid-cols-5 gap-2 text-center text-xs">
              {cols.filter((c) => c.key !== "points").map((c) => (
                <div key={c.key}>
                  <dd className="font-display text-base font-bold">{row[c.key]}</dd>
                  <dt className="text-muted">{c.label}</dt>
                </div>
              ))}
            </dl>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
