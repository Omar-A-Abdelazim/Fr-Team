import type { Member, RefusalCategory, Sponsor, SponsorStatus } from "@/types";

export type Range = "week" | "month" | "all";

export const RANGES: { id: Range; label: string }[] = [
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "all", label: "All time" },
];

const DAY = 86_400_000;

/** Filters by updatedAt, relative to the most recent activity in the data set. */
export function filterByRange(sponsors: Sponsor[], range: Range): Sponsor[] {
  if (range === "all" || sponsors.length === 0) return sponsors;
  const anchor = Math.max(...sponsors.map((s) => new Date(s.updatedAt).getTime()));
  const span = range === "week" ? 7 * DAY : 30 * DAY;
  return sponsors.filter((s) => anchor - new Date(s.updatedAt).getTime() <= span);
}

const RESPONDED: SponsorStatus[] = ["replied", "follow_up", "refused", "accepted", "closed"];

export function countBy(sponsors: Sponsor[], statuses: SponsorStatus[]) {
  return sponsors.filter((s) => statuses.includes(s.status)).length;
}

export function computeKpis(sponsors: Sponsor[]) {
  const contacted = sponsors.filter((s) => s.status !== "not_contacted");
  const responded = contacted.filter((s) => RESPONDED.includes(s.status));
  return {
    logged: sponsors.length,
    contacted: contacted.length,
    responseRate: contacted.length ? Math.round((responded.length / contacted.length) * 100) : 0,
    won: countBy(sponsors, ["accepted", "closed"]),
    points: sponsors.reduce((sum, s) => sum + s.points, 0),
  };
}

export function computeFunnel(sponsors: Sponsor[]) {
  const contacted = sponsors.filter((s) => s.status !== "not_contacted").length;
  const replied = sponsors.filter((s) => RESPONDED.includes(s.status) && s.status !== "refused").length;
  const accepted = countBy(sponsors, ["accepted", "closed"]);
  const closed = countBy(sponsors, ["closed"]);
  return {
    stages: [
      { key: "contacted" as const, count: contacted },
      { key: "replied" as const, count: replied },
      { key: "accepted" as const, count: accepted },
      { key: "closed" as const, count: closed },
    ],
    noReply: countBy(sponsors, ["no_reply"]),
    refused: countBy(sponsors, ["refused"]),
  };
}

export type TeamRow = {
  member: Member;
  entries: number;
  contacted: number;
  noReply: number;
  refused: number;
  won: number;
  points: number;
  byStatus: Partial<Record<SponsorStatus, number>>;
};

export function computeTeam(members: Member[], sponsors: Sponsor[]): TeamRow[] {
  return members
    .map((member) => {
      const mine = sponsors.filter((s) => s.ownerId === member.id);
      const byStatus: Partial<Record<SponsorStatus, number>> = {};
      for (const s of mine) byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
      return {
        member,
        entries: mine.length,
        contacted: mine.filter((s) => s.status !== "not_contacted").length,
        noReply: countBy(mine, ["no_reply"]),
        refused: countBy(mine, ["refused"]),
        won: countBy(mine, ["accepted", "closed"]),
        points: mine.reduce((sum, s) => sum + s.points, 0),
        byStatus,
      };
    })
    .sort((a, b) => b.points - a.points || b.won - a.won);
}

export function computeRefusals(sponsors: Sponsor[]) {
  const refused = sponsors.filter((s) => s.status === "refused" && s.refusal);
  const counts = new Map<RefusalCategory, number>();
  for (const s of refused) counts.set(s.refusal!.category, (counts.get(s.refusal!.category) ?? 0) + 1);
  const rows = [...counts.entries()]
    .map(([category, count]) => ({ category, count, pct: Math.round((count / refused.length) * 100) }))
    .sort((a, b) => b.count - a.count);
  const quotes = refused
    .filter((s) => s.refusal!.memberSelfAssessment.trim())
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 3)
    .map((s) => ({ id: s.id, text: s.refusal!.memberSelfAssessment, owner: s.ownerName, company: s.name }));
  return { total: refused.length, rows, quotes };
}
