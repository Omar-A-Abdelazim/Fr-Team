"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const ease = [0.16, 1, 0.3, 1] as const;
const line = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.3, delay: 0.1 + i * 0.08, ease } }),
};

const HEADLINE = ["Every sponsor.", "Every reply.", "One place."];

export function HeroCopy() {
  return (
    <div>
      <h1 className="font-display text-[clamp(2.75rem,7vw,5.25rem)] font-extrabold leading-[0.95] tracking-[-0.035em]">
        {HEADLINE.map((t, i) => (
          <motion.span
            key={t}
            custom={i}
            variants={line}
            initial="hidden"
            animate="show"
            className={i === 2 ? "block bg-gradient-to-r from-sky via-blue to-gold bg-clip-text pb-2 text-transparent" : "block"}
          >
            {t}
          </motion.span>
        ))}
      </h1>
      <motion.p
        custom={3}
        variants={line}
        initial="hidden"
        animate="show"
        className="mt-6 max-w-md text-lg text-muted"
      >
        The IEEE MET fundraising team&apos;s workspace for logging sponsors, tracking every deal and learning why some say
        no.
      </motion.p>
      <motion.div custom={4} variants={line} initial="hidden" animate="show" className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/login"
          className="rounded-full bg-gold px-6 py-3 font-semibold text-[#071a33] transition-transform duration-150 hover:-translate-y-0.5"
        >
          Sign in to FR Hub
        </Link>
        <a
          href="#how"
          className="rounded-full border border-line px-6 py-3 font-semibold transition-colors duration-150 hover:bg-fg/5"
        >
          See how it works
        </a>
      </motion.div>
    </div>
  );
}
