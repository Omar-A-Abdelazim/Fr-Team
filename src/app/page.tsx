import Link from "next/link";
import { CopyX, MailPlus, MessageSquareWarning, Trophy } from "lucide-react";
import { Nav } from "@/components/landing/nav";
import { DealNetwork } from "@/components/landing/deal-network";
import { PipelineDemo } from "@/components/landing/pipeline-demo";
import { HeroCopy } from "@/components/landing/hero-copy";
import { Backdrop } from "@/components/motion/backdrop";
import { Reveal } from "@/components/motion/reveal";
import { CountUp } from "@/components/motion/count-up";
import { Logo } from "@/components/brand/logo";

const POINTS = [
  { type: "Fund", pts: 5, color: "text-gold" },
  { type: "Catering", pts: 3, color: "text-mint" },
  { type: "Host", pts: 2, color: "text-sky" },
  { type: "Courses", pts: 1, color: "text-blue" },
];

const STEPS = [
  {
    title: "Log the sponsor",
    body: "Name, type, links and contacts, the same columns as the team sheet. If someone already logged them, you'll know before you save.",
  },
  {
    title: "Track the conversation",
    body: "Move it from contacted to replied, follow-up, accepted or refused. Every change is stamped with who and when.",
  },
  {
    title: "Say why it didn't work",
    body: "When a sponsor says no, write what they said and why you think it didn't land. That's how the team gets better.",
  },
  {
    title: "Get points when it's approved",
    body: "The FR Head approves real entries and points go on the leaderboard: Fund 5, Catering 3, Host 2, Courses 1.",
  },
];

const FEATURES = [
  {
    icon: CopyX,
    title: "No more double outreach",
    body: "Names, websites, emails and LinkedIn pages are checked as you type, including Arabic and English spellings of the same company.",
  },
  {
    icon: MessageSquareWarning,
    title: "Know why sponsors refuse",
    body: "Refusals are grouped and summarised for the FR Head: the top reasons, where the pitch breaks, and what to change next.",
  },
  {
    icon: MailPlus,
    title: "Outreach emails written per company",
    body: "Give a purpose and a few emails that worked. Each company gets its own researched draft that you review before it's sent.",
  },
  {
    icon: Trophy,
    title: "A leaderboard that's fair",
    body: "Points come from approved entries, not from typing fast. Everyone can see where they stand.",
  },
];

const REASONS = [
  { label: "No budget this quarter", pct: 38 },
  { label: "Needed audience numbers", pct: 27 },
  { label: "Bad timing", pct: 19 },
  { label: "Not their field", pct: 16 },
];

export default function Home() {
  return (
    <>
      <Nav />
      <main className="overflow-x-clip">
        {/* Hero */}
        <section className="relative">
          <Backdrop />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 pb-20 pt-32 lg:grid-cols-[1.05fr_1fr] lg:pt-40">
            <HeroCopy />
            <DealNetwork />
          </div>
        </section>

        {/* Points */}
        <section aria-labelledby="points-title" className="border-y border-line bg-raised/60">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 md:grid-cols-[1fr_2fr] md:items-center">
            <Reveal>
              <h2 id="points-title" className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                What a deal is worth
              </h2>
              <p className="mt-2 max-w-sm text-muted">
                Points per approved partner. The FR Head can change these at any time.
              </p>
            </Reveal>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
              {POINTS.map((p) => (
                <div key={p.type} className="bg-bg px-5 py-6">
                  <dt className="text-sm text-muted">{p.type}</dt>
                  <dd className={`font-display text-5xl font-extrabold ${p.color}`}>
                    <CountUp to={p.pts} prefix="+" />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* How it works */}
        <section id="how" aria-labelledby="how-title" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-24">
          <Reveal>
            <h2 id="how-title" className="max-w-xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
              From first email to signed deal
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-12 lg:grid-cols-2 lg:items-start">
            <ol className="relative space-y-8 border-l border-line pl-8">
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative">
                  <Reveal delay={i * 0.06}>
                    <span className="absolute -left-[45px] grid size-7 place-items-center rounded-full border border-line bg-bg font-display text-sm font-bold text-sky">
                      {i + 1}
                    </span>
                    <h3 className="font-display text-lg font-semibold">{s.title}</h3>
                    <p className="mt-1 max-w-md text-muted">{s.body}</p>
                  </Reveal>
                </li>
              ))}
            </ol>
            <div className="lg:sticky lg:top-28">
              <PipelineDemo />
            </div>
          </div>
        </section>

        {/* Features */}
        <section aria-labelledby="features-title" className="relative border-t border-line">
          <div className="mx-auto grid max-w-6xl gap-14 px-5 py-24 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <Reveal>
                <h2 id="features-title" className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                  Built for how the FR team actually works
                </h2>
              </Reveal>
              <ul className="mt-10 space-y-7">
                {FEATURES.map((f, i) => (
                  <li key={f.title}>
                    <Reveal delay={i * 0.05} className="flex gap-4">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue/15 text-sky">
                        <f.icon className="size-5" aria-hidden />
                      </span>
                      <div>
                        <h3 className="font-semibold">{f.title}</h3>
                        <p className="mt-1 max-w-md text-muted">{f.body}</p>
                      </div>
                    </Reveal>
                  </li>
                ))}
              </ul>
            </div>

            <Reveal className="space-y-5 lg:pt-16">
              <div className="rounded-3xl border border-line bg-raised p-6">
                <p className="text-sm text-muted">Example insight</p>
                <h3 className="mt-1 font-display text-xl font-semibold">Why sponsors said no this month</h3>
                <ul className="mt-5 space-y-4">
                  {REASONS.map((r) => (
                    <li key={r.label}>
                      <div className="mb-1.5 flex justify-between text-sm">
                        <span>{r.label}</span>
                        <span className="text-muted">{r.pct}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-line">
                        <div className="h-full rounded-full bg-coral" style={{ width: `${r.pct}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-5 rounded-xl bg-gold/10 p-3 text-sm">
                  Most refusals ask for numbers. Add last event&apos;s attendance and reach to the proposal.
                </p>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-amber/40 bg-amber/10 p-4 text-sm">
                <CopyX className="mt-0.5 size-4 shrink-0 text-amber" aria-hidden />
                <p>
                  <span className="font-semibold">Basmala already logged Delta Foods</span> on 12 Nov. Status:
                  follow-up.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden border-t border-line">
          <Backdrop />
          <div className="relative mx-auto max-w-3xl px-5 py-24 text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">Ready to close the next one?</h2>
            <p className="mx-auto mt-4 max-w-md text-muted">Sign in with your Google account to start logging sponsors.</p>
            <Link
              href="/login"
              className="mt-8 inline-flex rounded-full bg-gold px-7 py-3.5 font-semibold text-[#071a33] transition-transform duration-150 hover:-translate-y-0.5"
            >
              Sign in to FR Hub
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-5 py-8 text-sm text-muted sm:flex-row sm:items-center">
          <Logo />
          <p>IEEE MET Student Branch, Fundraising Committee</p>
        </div>
      </footer>
    </>
  );
}
