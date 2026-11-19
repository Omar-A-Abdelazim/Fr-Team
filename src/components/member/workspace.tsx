"use client";

import confetti from "canvas-confetti";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, Globe, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/app/shell";
import { MyHeader } from "@/components/member/my-header";
import { AddSponsor } from "@/components/member/add-sponsor";
import { RefusalDialog } from "@/components/member/refusal-dialog";
import { STATUS_META, STATUSES, TYPE_COLOR } from "@/lib/constants";
import { useAuth } from "@/lib/firebase/auth-context";
import { createSponsor, setStatus, useSponsors } from "@/lib/firebase/data";
import type { Sponsor, SponsorStatus } from "@/types";
import { cn } from "@/lib/utils";

const FILTERS: { key: "all" | SponsorStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "contacted", label: "Contacted" },
  { key: "follow_up", label: "Follow-up" },
  { key: "no_reply", label: "No reply" },
  { key: "refused", label: "Refused" },
  { key: "accepted", label: "Accepted" },
];

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden fill="currentColor">
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.1c.5-1 1.8-2 3.7-2 4 0 4.7 2.6 4.7 6V21h-4v-5.6c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9V21H9z" />
    </svg>
  );
}

export function Workspace() {
  const { profile } = useAuth();
  const me = profile!;
  const CURRENT_USER_ID = me.id;
  const { sponsors, loading, error } = useSponsors();
  const [scope, setScope] = useState<"mine" | "team">("mine");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [refusing, setRefusing] = useState<Sponsor | null>(null);

  const mine = sponsors.filter((s) => s.ownerId === CURRENT_USER_ID);
  const points = mine.reduce((a, s) => a + s.points, 0);

  const rows = useMemo(() => {
    const base = scope === "mine" ? sponsors.filter((s) => s.ownerId === CURRENT_USER_ID) : sponsors;
    return base
      .filter((s) => filter === "all" || s.status === filter)
      .filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [sponsors, scope, filter, q, CURRENT_USER_ID]);

  async function changeStatus(s: Sponsor, status: SponsorStatus) {
    if (status === "refused") return setRefusing(s);
    try {
      await setStatus(s.id, status, me.id);
    } catch {
      toast.error(`Couldn't update ${s.name}. Check your connection and try again.`);
      return;
    }
    if (status === "accepted" || status === "closed") {
      confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 }, colors: ["#f5b83d", "#4cc3f2", "#3dd6a3", "#ffffff"] });
      toast.success(`${s.name} accepted`, { description: "Waiting for the FR Head to approve your points." });
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <MyHeader
        name={me.name.split(" ")[0]}
        points={points}
        stats={[
          { label: "Logged", value: mine.length, color: "var(--fg)" },
          { label: "Approved", value: mine.filter((s) => s.approved).length, color: "var(--sky)" },
          { label: "Won", value: mine.filter((s) => s.status === "accepted" || s.status === "closed").length, color: "var(--mint)" },
          { label: "Refused", value: mine.filter((s) => s.status === "refused").length, color: "var(--coral)" },
        ]}
      />

      <section aria-labelledby="list-title">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h2 id="list-title" className="font-display text-2xl font-bold">
              Sponsors
            </h2>
            <div className="relative flex rounded-full border border-line p-1 text-sm">
              {(["mine", "team"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setScope(k)}
                  className={cn("relative z-10 rounded-full px-3 py-1 font-medium", scope === k ? "text-fg" : "text-muted")}
                >
                  {scope === k && (
                    <motion.span layoutId="scope" className="absolute inset-0 -z-10 rounded-full bg-blue/20" transition={{ duration: 0.2 }} />
                  )}
                  {k === "mine" ? "Mine" : "Whole team"}
                </button>
              ))}
            </div>
          </div>
          <motion.button
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setAdding(true)}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-gold px-5 font-semibold text-[#071a33] shadow-[0_10px_30px_-10px_var(--gold)]"
          >
            <Plus className="size-4" /> Log a sponsor
          </motion.button>
        </div>

        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center">
          <label className="relative md:w-72">
            <span className="sr-only">Search sponsors</span>
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search companies"
              className="h-10 w-full rounded-full border border-line bg-raised pl-10 pr-4 text-sm outline-none focus:border-sky"
            />
          </label>
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "relative shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                  filter === f.key ? "text-[#071a33]" : "text-muted hover:text-fg",
                )}
              >
                {filter === f.key && (
                  <motion.span layoutId="filter" className="absolute inset-0 -z-10 rounded-full bg-sky" transition={{ duration: 0.2 }} />
                )}
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <motion.ul layout className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {rows.map((s, i) => {
              const editable = s.ownerId === CURRENT_USER_ID;
              const meta = STATUS_META[s.status];
              return (
                <motion.li
                  layout
                  key={s.id}
                  initial={{ opacity: 0, y: 14, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3), ease: [0.16, 1, 0.3, 1] }}
                  whileHover={{ y: -4 }}
                  className="group relative overflow-hidden rounded-2xl border border-line bg-raised p-5"
                >
                  <span
                    aria-hidden
                    className="absolute -right-10 -top-10 size-28 rounded-full opacity-20 blur-2xl transition-opacity duration-300 group-hover:opacity-50"
                    style={{ background: TYPE_COLOR[s.partnerType] }}
                  />
                  <div className="relative flex items-start gap-3">
                    <span
                      className="grid size-11 shrink-0 place-items-center rounded-xl font-display text-lg font-bold text-[#071a33]"
                      style={{ background: TYPE_COLOR[s.partnerType] }}
                    >
                      {s.name[0].toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate font-semibold">
                        {s.name}
                        {s.approved && <BadgeCheck className="size-4 shrink-0 text-sky" aria-label="Approved" />}
                      </p>
                      <p className="text-sm text-muted">
                        {s.partnerType}
                        {scope === "team" && ` · ${s.ownerName}`}
                      </p>
                    </div>
                    {s.points > 0 && (
                      <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-bold text-gold">+{s.points}</span>
                    )}
                  </div>

                  {s.description && <p className="relative mt-3 line-clamp-1 text-sm text-muted">{s.description}</p>}

                  <div className="relative mt-4 flex items-center justify-between gap-2">
                    {editable ? (
                      <label className="relative">
                        <span className="sr-only">Status of {s.name}</span>
                        <select
                          value={s.status}
                          onChange={(e) => changeStatus(s, e.target.value as SponsorStatus)}
                          className="cursor-pointer appearance-none rounded-full py-1 pl-3 pr-7 text-xs font-semibold outline-none"
                          style={{ background: meta.color, color: meta.ink }}
                        >
                          {STATUSES.map((st) => (
                            <option key={st} value={st} className="bg-raised text-fg">
                              {STATUS_META[st].label}
                            </option>
                          ))}
                        </select>
                        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px]" style={{ color: meta.ink }}>
                          ▼
                        </span>
                      </label>
                    ) : (
                      <StatusBadge {...meta} />
                    )}
                    <div className="flex gap-1 text-muted">
                      {s.linkedin && (
                        <a href={s.linkedin} target="_blank" rel="noreferrer" aria-label={`${s.name} on LinkedIn`} className="grid size-8 place-items-center rounded-full hover:bg-fg/5 hover:text-fg">
                          <LinkedInIcon />
                        </a>
                      )}
                      {s.website && (
                        <a href={s.website.startsWith("http") ? s.website : `https://${s.website}`} target="_blank" rel="noreferrer" aria-label={`${s.name} website`} className="grid size-8 place-items-center rounded-full hover:bg-fg/5 hover:text-fg">
                          <Globe className="size-4" />
                        </a>
                      )}
                    </div>
                  </div>

                  {s.refusal && (
                    <p className="relative mt-3 rounded-xl bg-coral/10 px-3 py-2 text-xs text-coral">“{s.refusal.details}”</p>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </motion.ul>

        {loading && (
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading sponsors">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="h-40 animate-pulse rounded-2xl border border-line bg-raised" />
            ))}
          </ul>
        )}
        {error && (
          <p className="mt-6 rounded-2xl border border-coral/40 bg-coral/10 p-4 text-sm">
            Couldn&apos;t load sponsors: {error}
          </p>
        )}
        {!loading && !error && rows.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-line p-10 text-center">
            <p className="font-semibold">Nothing here yet</p>
            <p className="mt-1 text-sm text-muted">Log your first sponsor or change the filter.</p>
          </div>
        )}
      </section>

      <AddSponsor
        open={adding}
        onClose={() => setAdding(false)}
        pool={sponsors}
        onSave={async (d) => {
          try {
            await createSponsor(d, { id: me.id, name: me.name });
            setScope("mine");
            setFilter("all");
            toast.success(`${d.name} logged`, { description: "It shows up for the whole team now." });
            return true;
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Couldn't save. Try again.");
            return false;
          }
        }}
      />

      <RefusalDialog
        company={refusing?.name ?? null}
        onCancel={() => setRefusing(null)}
        onSave={async (r) => {
          if (!refusing) return;
          try {
            await setStatus(refusing.id, "refused", me.id, r);
            toast(`Refusal saved for ${refusing.name}`);
            setRefusing(null);
          } catch {
            toast.error("Couldn't save the refusal. Try again.");
          }
        }}
      />
    </div>
  );
}
