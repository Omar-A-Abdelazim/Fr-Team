"use client";

import { motion } from "framer-motion";
import { Podium } from "@/components/admin/podium";
import { Avatar } from "@/components/admin/avatar";
import { computeTeam } from "@/components/admin/stats";
import { useAuth } from "@/lib/firebase/auth-context";
import { useMembers, useSponsors } from "@/lib/firebase/data";
import { cn } from "@/lib/utils";

export function Leaderboard() {
  const { profile } = useAuth();
  const { sponsors, loading } = useSponsors();
  const members = useMembers();
  const team = computeTeam(members, sponsors);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold">Leaderboard</h1>
        <p className="mt-1 text-muted">Points from approved sponsors. Fund 5, Catering 3, Host 2, Courses 1.</p>
      </header>

      {loading ? (
        <div className="h-80 animate-pulse rounded-3xl bg-raised" />
      ) : (
        <>
          <Podium team={team} />
          <ol className="space-y-2">
            {team.map((row, i) => (
              <motion.li
                layout
                key={row.member.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.4), ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  "flex items-center gap-4 rounded-2xl border border-line bg-raised px-4 py-3",
                  row.member.id === profile?.id && "border-sky/60 bg-sky/10",
                )}
              >
                <span className="w-6 text-center font-display font-bold text-muted">{i + 1}</span>
                <Avatar member={row.member} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {row.member.name}
                    {row.member.id === profile?.id && <span className="ml-2 text-xs text-sky">You</span>}
                  </p>
                  <p className="text-sm text-muted">
                    {row.entries} logged · {row.won} won
                  </p>
                </div>
                <span className="font-display text-2xl font-extrabold text-gold">{row.points}</span>
              </motion.li>
            ))}
          </ol>
          {team.length === 0 && <p className="text-center text-muted">No one is on the board yet.</p>}
        </>
      )}
    </div>
  );
}
