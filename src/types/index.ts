export type PartnerType = "Fund" | "Catering" | "Host" | "Courses" | "Technical" | "Logistics";

export type SponsorStatus =
  | "not_contacted"
  | "contacted"
  | "no_reply"
  | "replied"
  | "follow_up"
  | "refused"
  | "accepted"
  | "closed";

export type RefusalCategory =
  | "no_budget"
  | "bad_timing"
  | "not_our_field"
  | "need_more_reach_data"
  | "already_sponsoring_others"
  | "weak_proposal"
  | "no_decision_maker"
  | "other";

export type Refusal = {
  category: RefusalCategory;
  details: string;
  memberSelfAssessment: string;
};

export type Sponsor = {
  id: string;
  ownerId: string;
  ownerName: string;
  name: string;
  partnerType: PartnerType;
  facebook: string;
  linkedin: string;
  phone: string;
  email: string;
  website: string;
  description: string;
  status: SponsorStatus;
  refusal: Refusal | null;
  approved: boolean;
  points: number;
  reviewed?: boolean;
  createdAt?: string;
  updatedAt: string;
};

export type Member = {
  id: string;
  name: string;
  email: string;
  role: "member" | "admin";
  color: string;
  photoURL?: string | null;
};
