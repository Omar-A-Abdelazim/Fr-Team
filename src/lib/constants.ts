import type { PartnerType, RefusalCategory, SponsorStatus } from "@/types";

export const POINTS: Record<PartnerType, number> = {
  Fund: 5,
  Catering: 3,
  Host: 2,
  Courses: 1,
  Technical: 1,
  Logistics: 2,
};

export const PARTNER_TYPES = Object.keys(POINTS) as PartnerType[];

export const STATUS_META: Record<SponsorStatus, { label: string; color: string; ink: string }> = {
  not_contacted: { label: "Not contacted", color: "var(--line)", ink: "var(--fg)" },
  contacted: { label: "Contacted", color: "var(--sky)", ink: "#071a33" },
  no_reply: { label: "No reply", color: "var(--fg-muted)", ink: "var(--bg)" },
  replied: { label: "Replied", color: "var(--blue)", ink: "#ffffff" },
  follow_up: { label: "Follow-up", color: "var(--amber)", ink: "#071a33" },
  refused: { label: "Refused", color: "var(--coral)", ink: "#071a33" },
  accepted: { label: "Accepted", color: "var(--mint)", ink: "#071a33" },
  closed: { label: "Closed", color: "var(--gold)", ink: "#071a33" },
};

export const STATUSES = Object.keys(STATUS_META) as SponsorStatus[];

export const REFUSAL_LABELS: Record<RefusalCategory, string> = {
  no_budget: "No budget",
  bad_timing: "Bad timing",
  not_our_field: "Not their field",
  need_more_reach_data: "Wanted audience numbers",
  already_sponsoring_others: "Already sponsoring others",
  weak_proposal: "Weak proposal",
  no_decision_maker: "Couldn't reach a decision maker",
  other: "Other",
};

export const TYPE_COLOR: Record<PartnerType, string> = {
  Fund: "var(--gold)",
  Catering: "var(--mint)",
  Host: "var(--sky)",
  Courses: "var(--blue)",
  Technical: "#a78bfa",
  Logistics: "var(--amber)",
};
