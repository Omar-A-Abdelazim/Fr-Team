"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import type { Member, Sponsor } from "@/types";
import { ApprovalQueue } from "./approvals";
import { PipelineFunnel } from "./funnel";
import { KpiRow } from "./kpi-row";
import { Podium } from "./podium";
import { RangeControl } from "./range-control";
import { RefusalPanel } from "./refusals";
import { computeFunnel, computeKpis, computeRefusals, computeTeam, filterByRange, type Range } from "./stats";
import { TeamTable } from "./team-table";

export function AdminOverview({
  greeting,
  name,
  sponsors,
  members,
}: {
  greeting: string;
  name: string;
  sponsors: Sponsor[];
  members: Member[];
}) {
  const [range, setRange] = useState<Range>("all");
  const scoped = useMemo(() => filterByRange(sponsors, range), [sponsors, range]);
  const kpis = useMemo(() => computeKpis(scoped), [scoped]);
  const funnel = useMemo(() => computeFunnel(scoped), [scoped]);
  const team = useMemo(() => computeTeam(members, scoped), [members, scoped]);
  const refusals = useMemo(() => computeRefusals(scoped), [scoped]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="font-display text-3xl font-bold">
            {greeting}, {name}
          </h1>
          <p className="mt-1 text-muted">Here is where fundraising stands.</p>
        </div>
        <RangeControl value={range} onChange={setRange} />
      </motion.header>

      <KpiRow kpis={kpis} rangeKey={range} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PipelineFunnel funnel={funnel} />
        </div>
        <Podium key={range} team={team} />
      </div>

      <TeamTable team={team} />

      <div className="grid gap-6 lg:grid-cols-2">
        <RefusalPanel key={range} data={refusals} />
        <ApprovalQueue sponsors={sponsors} />
      </div>
    </div>
  );
}
