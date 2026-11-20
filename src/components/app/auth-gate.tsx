"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/firebase/auth-context";
import { PendingScreen } from "@/components/app/pending-screen";

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
  const blocked = !loading && (!user || !profile || (admin && profile?.role !== "admin"));

  useEffect(() => {
    if (loading) return;
    if (!user || !profile) router.replace("/");
    else if (admin && profile && profile.role !== "admin") {
      toast.error("Admins only", { description: "Ask the FR Head for admin access." });
      router.replace("/app");
    }
  }, [loading, user, profile, admin, router]);

  if (loading || blocked || !profile) return <Loader />;
  if (profile.rejected || profile.approved === false) return <PendingScreen rejected={!!profile.rejected} name={profile.name} />;
  return <>{children}</>;
}
