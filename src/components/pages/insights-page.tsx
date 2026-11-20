"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { RefusalPanel } from "@/components/admin/refusals";
import { computeRefusals } from "@/components/admin/stats";
import { REFUSAL_LABELS, TYPE_COLOR } from "@/lib/constants";
import { auth } from "@/lib/firebase/client";
import { useSponsors } from "@/lib/firebase/data";
import { SummaryCards, SummaryLoading, type RefusalSummary } from "./refusal-summary";
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
  const [help, setHelp] = useState(false);
  const [summary, setSummary] = useState<RefusalSummary | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState("");
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

  async function summarize() {
    if (summarizing) return;
    setSummarizing(true);
    setSummaryError("");
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Sign in again to generate the summary.");
      const res = await fetch("/api/insights/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          refusals: refused.map((s) => ({
            company: s.name,
            partnerType: s.partnerType,
            ownerName: s.ownerName,
            category: s.refusal!.category,
            details: s.refusal!.details,
            selfAssessment: s.refusal!.memberSelfAssessment,
          })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<RefusalSummary> & { error?: string };
      if (!res.ok) throw new Error(data.error || `The summary didn't come back (error ${res.status}).`);
      setSummary({
        summary: data.summary ?? "",
        topReasons: data.topReasons ?? [],
        rootCauses: data.rootCauses ?? [],
        coaching: data.coaching ?? [],
        actions: data.actions ?? [],
      });
    } catch (e) {
      setSummaryError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSummarizing(false);
    }
  }

  if (loading) return <div className="mx-auto h-96 max-w-6xl animate-pulse rounded-3xl bg-raised" />;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold">Refusal insights</h1>
        <p className="mt-1 text-muted">Why sponsors said no, and what the team thinks went wrong.</p>
      </header>

      <div className="rounded-2xl border border-line bg-raised">
        <button
          type="button"
          onClick={() => setHelp((o) => !o)}
          aria-expanded={help}
          className="flex min-h-11 w-full items-center justify-between px-4 text-sm font-semibold"
        >
          How to use this page
          <motion.span animate={{ rotate: help ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="size-4" />
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {help && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <ul className="list-disc space-y-2 border-t border-line py-3 pl-9 pr-4 text-sm text-muted">
                <li>Members log why a sponsor said no when they mark it Refused.</li>
                <li>This page groups those reasons by type and member so you can see where the pitch breaks.</li>
                <li>Use the AI summary before each FR meeting to decide what to change in the proposal and who needs coaching.</li>
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {summarizing ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <SummaryLoading />
          </motion.div>
        ) : summaryError ? (
          <motion.div
            key="error"
            role="alert"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="flex gap-3 rounded-2xl border border-coral/40 bg-coral/10 p-4 text-sm"
          >
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-coral" />
            <p>
              {summaryError} <span className="text-muted">Try Generate AI summary again.</span>
            </p>
          </motion.div>
        ) : summary ? (
          <motion.div key="summary" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <SummaryCards data={summary} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="grid gap-6 lg:grid-cols-2">
        <RefusalPanel
          data={data}
          onSummarize={summarize}
          summarizing={summarizing}
          summaryHint={refused.length < 3 ? "Needs at least 3 refusals to find patterns" : undefined}
        />
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
