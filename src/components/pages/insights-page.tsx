"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { RefusalPanel } from "@/components/admin/refusals";
import { computeRefusals } from "@/components/admin/stats";
import { REFUSAL_LABELS, TYPE_COLOR } from "@/lib/constants";
import { useSponsors } from "@/lib/firebase/data";
import type { PartnerType } from "@/types";

function Bars({ title, rows }: { title: string; rows: { label: string; count: number; color: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <section className="rounded-3xl border border-line bg-raised p-6">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <ul className="mt-5 space-y-3">
        {rows.map((r, i) => (
          <li key={r.label}>
            <div className="mb-1 flex justify-between text-sm">
              <span>{r.label}</span>
              <span className="text-muted">{r.count}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-line">
              <motion.div
                className="h-full rounded-full"
                style={{ background: r.color, originX: 0 }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: r.count / max }}
                transition={{ duration: 0.6, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </li>
        ))}
        {rows.length === 0 && <li className="text-sm text-muted">No refusals yet.</li>}
      </ul>
    </section>
  );
}

export function InsightsPage() {
  const { sponsors, loading } = useSponsors();
  const [who, setWho] = useState("all");
  const refused = useMemo(() => sponsors.filter((s) => s.status === "refused" && s.refusal), [sponsors]);
  const data = useMemo(() => computeRefusals(sponsors), [sponsors]);

  const byType = useMemo(() => {
    const m = new Map<PartnerType, number>();
    refused.forEach((s) => m.set(s.partnerType, (m.get(s.partnerType) ?? 0) + 1));
    return [...m].sort((a, b) => b[1] - a[1]).map(([t, c]) => ({ label: t, count: c, color: TYPE_COLOR[t] }));
  }, [refused]);
  const byMember = useMemo(() => {
    const m = new Map<string, number>();
    refused.forEach((s) => m.set(s.ownerName, (m.get(s.ownerName) ?? 0) + 1));
    return [...m].sort((a, b) => b[1] - a[1]).map(([n, c]) => ({ label: n, count: c, color: "var(--coral)" }));
  }, [refused]);
  const owners = [...new Set(refused.map((s) => s.ownerName))];
  const list = refused.filter((s) => who === "all" || s.ownerName === who);

  if (loading) return <div className="mx-auto h-96 max-w-6xl animate-pulse rounded-3xl bg-raised" />;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold">Refusal insights</h1>
        <p className="mt-1 text-muted">Why sponsors said no, and what the team thinks went wrong.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <RefusalPanel data={data} />
        <div className="grid gap-6">
          <Bars title="Refusals by partner type" rows={byType} />
          <Bars title="Refusals by member" rows={byMember} />
        </div>
      </div>

      <section aria-labelledby="all-refusals">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="all-refusals" className="font-display text-xl font-bold">
            Every refusal ({list.length})
          </h2>
          <label className="text-sm">
            <span className="sr-only">Filter by member</span>
            <select
              value={who}
              onChange={(e) => setWho(e.target.value)}
              className="h-10 rounded-full border border-line bg-raised px-4 outline-none focus:border-sky"
            >
              <option value="all">Everyone</option>
              {owners.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
        </div>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {list.map((s, i) => (
            <motion.li
              key={s.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3) }}
              className="rounded-2xl border border-line bg-raised p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-sm text-muted">
                    {s.partnerType} · {s.ownerName}
                  </p>
                </div>
                <span className="rounded-full bg-coral/15 px-2.5 py-0.5 text-xs font-semibold text-coral">
                  {REFUSAL_LABELS[s.refusal!.category]}
                </span>
              </div>
              <p className="mt-3 text-sm" dir="auto">
                <span className="text-muted">They said: </span>
                {s.refusal!.details}
              </p>
              <p className="mt-2 rounded-xl bg-gold/10 p-3 text-sm" dir="auto">
                <span className="font-semibold">{s.ownerName}&apos;s take: </span>
                {s.refusal!.memberSelfAssessment}
              </p>
            </motion.li>
          ))}
        </ul>
        {list.length === 0 && <p className="mt-6 text-muted">No refusals logged yet. They show up here as soon as someone marks a sponsor as refused.</p>}
      </section>
    </div>
  );
}
