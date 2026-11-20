"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/firebase/auth-context";
import { resetAllData } from "@/lib/firebase/data";

// Temporary: shown only to the FR Head for a one-time cleanup of test data.
const OWNER = "omarahmedabdelazim2005@gmail.com";

export function ResetData() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>("");

  if (profile?.email?.toLowerCase() !== OWNER) return null;

  async function run() {
    setBusy(true);
    try {
      const n = await resetAllData((d, t) => setProgress(`${d} of ${t} deleted`));
      toast.success("Test data deleted", { description: `${n} records removed. Admin accounts were kept.` });
      setOpen(false);
      setTyped("");
    } catch (e) {
      toast.error("Couldn't finish deleting", {
        description: `${(e as Error).message}. Make sure the latest Firestore rules are published, then try again.`,
      });
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <section className="rounded-3xl border border-coral/40 bg-coral/5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-coral">
            <AlertTriangle className="size-5" aria-hidden /> Reset test data
          </h2>
          <p className="mt-1 text-sm text-muted">
            Deletes every sponsor, every sent-email record and every non-admin account, so the real team starts fresh.
            Admin accounts stay. This can&apos;t be undone. Only you can see this.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-coral/50 px-4 text-sm font-semibold text-coral hover:bg-coral/10"
        >
          <Trash2 className="size-4" aria-hidden /> Reset data
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="mt-5 flex flex-wrap items-end gap-3"
          >
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Type DELETE to confirm</span>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="h-10 w-48 rounded-xl border border-line bg-bg px-3 outline-none focus:border-coral"
                autoComplete="off"
              />
            </label>
            <button
              type="button"
              disabled={typed !== "DELETE" || busy}
              onClick={run}
              className="h-10 rounded-xl bg-coral px-5 font-semibold text-[#071a33] disabled:opacity-40"
            >
              {busy ? progress || "Deleting…" : "Delete everything"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
