"use client";

import { ApprovalQueue } from "@/components/admin/approvals";
import { useSponsors } from "@/lib/firebase/data";

export function ApprovalsPage() {
  const { sponsors, loading } = useSponsors();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Approvals</h1>
        <p className="mt-1 text-muted">Approve real entries to give points. Mark entries that shouldn&apos;t count as not counted.</p>
      </header>
      {loading ? <div className="h-96 animate-pulse rounded-3xl bg-raised" /> : <ApprovalQueue sponsors={sponsors} limit={100} />}
    </div>
  );
}
