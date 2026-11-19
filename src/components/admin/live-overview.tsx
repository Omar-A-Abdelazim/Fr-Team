"use client";

import { AdminOverview } from "./overview";
import { useAuth } from "@/lib/firebase/auth-context";
import { useMembers, useSponsors } from "@/lib/firebase/data";

export function LiveAdminOverview() {
  const { profile } = useAuth();
  const { sponsors, loading } = useSponsors();
  const members = useMembers();
  if (loading)
    return (
      <div className="mx-auto grid max-w-6xl gap-6" aria-label="Loading dashboard">
        <div className="h-24 animate-pulse rounded-3xl bg-raised" />
        <div className="h-72 animate-pulse rounded-3xl bg-raised" />
        <div className="h-72 animate-pulse rounded-3xl bg-raised" />
      </div>
    );
  return <AdminOverview greeting="Welcome back" name={profile?.name.split(" ")[0] ?? ""} sponsors={sponsors} members={members} />;
}
