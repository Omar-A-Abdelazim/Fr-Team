"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/firebase/auth-context";

function Loader() {
  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-label="Loading">
      <div className="relative size-16">
        {[0, 1].map((i) => (
          <motion.span
            key={i}
            className="absolute inset-0 rounded-full border-4"
            style={{ borderColor: i ? "var(--sky)" : "var(--blue)" }}
            animate={{ x: i ? [8, -8, 8] : [-8, 8, -8] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
        <motion.span
          className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold"
          animate={{ scale: [1, 1.6, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
      </div>
    </div>
  );
}

/** Client-side route guard. Real data protection lives in firestore.rules. */
export function AuthGate({ children, admin = false }: { children: React.ReactNode; admin?: boolean }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const blocked = !loading && (!user || (admin && profile?.role !== "admin"));

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/");
    else if (admin && profile && profile.role !== "admin") {
      toast.error("Admins only", { description: "Ask the FR Head for admin access." });
      router.replace("/app");
    }
  }, [loading, user, profile, admin, router]);

  if (!loading && user && !profile)
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div className="max-w-sm">
          <p className="font-display text-xl font-bold">Your profile couldn&apos;t be created</p>
          <p className="mt-2 text-muted">The database rules may not be published yet. Ask the FR Head to check Firestore rules, then reload.</p>
        </div>
      </div>
    );
  if (loading || blocked || !profile) return <Loader />;
  return <>{children}</>;
}
