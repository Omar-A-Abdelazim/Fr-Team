import { Suspense } from "react";
import { EmailComposer } from "@/components/emails/composer";

export default function EmailsPage() {
  return (
    <Suspense fallback={<div className="mx-auto h-72 w-full max-w-4xl animate-pulse rounded-2xl border border-line bg-raised" aria-busy="true" />}>
      <EmailComposer />
    </Suspense>
  );
}
