"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/firebase/auth-context";
import { saveBranchFacts, useBranchFacts } from "@/lib/firebase/data";

const PLACEHOLDER = `Last hackathon (March 2026): 280 attendees, 46 teams
Facebook: 12k followers, LinkedIn: 3k
Past partners: Orange, ITIDA, Banque Misr
Branch members: 120 active students`;

function Editor({ initial, updatedBy }: { initial: string; updatedBy?: string }) {
  const { profile } = useAuth();
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!profile) return;
    setBusy(true);
    try {
      await saveBranchFacts(text, profile.name);
      toast.success("Facts saved", { description: "The AI will use them in the next email it writes." });
    } catch {
      toast.error("Couldn't save the facts", { description: "Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-medium">Branch facts</span>
        <textarea
          dir="auto"
          rows={8}
          maxLength={3000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDER}
          aria-describedby="facts-help"
          className="w-full rounded-xl border border-line bg-bg p-3 outline-none focus:border-sky"
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">{updatedBy ? `Last saved by ${updatedBy}` : "Not saved yet"}</p>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="inline-flex h-10 items-center justify-center rounded-full bg-sky px-4 text-sm font-semibold text-[#071a33] transition-colors duration-150 hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save facts"}
        </button>
      </div>
    </>
  );
}

export function BranchFacts() {
  const facts = useBranchFacts();
  return (
    <section aria-labelledby="facts-h" className="rounded-3xl border border-line bg-raised p-5">
      <h2 id="facts-h" className="font-display text-lg font-semibold">
        Facts the AI can use in emails
      </h2>
      <p id="facts-help" className="mt-1 text-sm text-muted">
        Real numbers only. The AI uses them as proof in every email, e.g. last event attendance, social reach, partners you&apos;ve worked with.
      </p>
      {facts === null ? (
        <div className="mt-4 h-44 animate-pulse rounded-xl bg-fg/5" aria-hidden />
      ) : (
        <Editor key={facts.updatedBy ?? "init"} initial={facts.facts} updatedBy={facts.updatedBy} />
      )}
    </section>
  );
}
