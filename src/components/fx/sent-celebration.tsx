"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Coin, Envelope, Spark } from "@/components/auth/shapes";

const TOTAL_MS = 4500;
const COLORS = ["#f5b83d", "#4cc3f2", "#3dd6a3", "#ffffff", "#f47c6b"];
const EASE = [0.16, 1, 0.3, 1] as const;

/** Deterministic 0..1 pseudo-random so SSR and client agree. */
const rnd = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

function BigEnvelope() {
  return (
    <div className="relative h-[168px] w-[240px] [perspective:900px] sm:h-[210px] sm:w-[300px]">
      {/* letter sliding out */}
      <motion.div
        className="absolute inset-x-6 bottom-6 top-3 rounded-lg bg-white shadow-lg"
        initial={{ y: 0 }}
        animate={{ y: -64 }}
        transition={{ delay: 0.95, duration: 0.6, ease: EASE }}
      >
        <div className="mx-4 mt-4 space-y-2">
          <div className="h-2 w-2/3 rounded bg-[#4cc3f2]/60" />
          <div className="h-2 rounded bg-[#071a33]/15" />
          <div className="h-2 w-5/6 rounded bg-[#071a33]/15" />
        </div>
      </motion.div>
      {/* body */}
      <svg viewBox="0 0 300 210" className="absolute inset-0 size-full drop-shadow-[0_20px_40px_rgba(76,195,242,0.35)]" aria-hidden>
        <rect x="2" y="2" width="296" height="206" rx="18" fill="#0c2546" stroke="#4cc3f2" strokeWidth="4" />
        <path d="M4 206L130 104M296 206L170 104" stroke="#4cc3f2" strokeOpacity=".5" strokeWidth="3" fill="none" />
      </svg>
      {/* flap */}
      <motion.div
        className="absolute inset-x-0 top-0 h-1/2 [transform-style:preserve-3d]"
        style={{ transformOrigin: "50% 0%" }}
        initial={{ rotateX: 0 }}
        animate={{ rotateX: 180 }}
        transition={{ delay: 0.7, duration: 0.55, ease: EASE }}
      >
        <svg viewBox="0 0 300 105" className="size-full [backface-visibility:hidden]" aria-hidden>
          <path d="M2 20Q2 2 20 2H280Q298 2 298 20L150 104Z" fill="#12315b" stroke="#4cc3f2" strokeWidth="4" strokeLinejoin="round" />
          <circle cx="150" cy="70" r="14" fill="#f5b83d" />
        </svg>
      </motion.div>
    </div>
  );
}

const BURST = Array.from({ length: 26 }, (_, i) => {
  const a = (i / 26) * Math.PI * 2 + rnd(i, 1) * 0.4;
  const d = 240 + rnd(i, 2) * 380;
  return {
    kind: i % 3,
    size: 26 + Math.round(rnd(i, 3) * 28),
    x: Math.cos(a) * d,
    y: Math.sin(a) * d * 0.8,
    fall: 120 + rnd(i, 4) * 220,
    rot: (rnd(i, 5) - 0.5) * 720,
    delay: 0.95 + rnd(i, 6) * 0.25,
    color: COLORS[i % COLORS.length],
  };
});

const PLANES = Array.from({ length: 5 }, (_, i) => ({
  top: 10 + i * 17 + rnd(i, 7) * 6,
  delay: 1.2 + i * 0.5,
  dur: 1.6 + rnd(i, 8) * 0.8,
  rev: i % 2 === 1,
  size: 40 + (i % 3) * 14,
  tilt: -12 + rnd(i, 9) * 24,
}));

function fireConfetti(stop: { current: boolean }) {
  import("canvas-confetti").then(({ default: confetti }) => {
    if (stop.current) return;
    const base = { colors: COLORS, zIndex: 120, disableForReducedMotion: true };
    const t = (ms: number, fn: () => void) => setTimeout(() => !stop.current && fn(), ms);
    t(500, () => {
      confetti({ ...base, particleCount: 90, angle: 60, spread: 70, startVelocity: 62, origin: { x: 0, y: 1 } });
      confetti({ ...base, particleCount: 90, angle: 120, spread: 70, startVelocity: 62, origin: { x: 1, y: 1 } });
    });
    t(1000, () => confetti({ ...base, particleCount: 160, spread: 360, startVelocity: 38, origin: { x: 0.5, y: 0.45 }, scalar: 1.2 }));
    t(1700, () => {
      confetti({ ...base, particleCount: 70, angle: 60, spread: 80, startVelocity: 55, origin: { x: 0, y: 1 } });
      confetti({ ...base, particleCount: 70, angle: 120, spread: 80, startVelocity: 55, origin: { x: 1, y: 1 } });
    });
    // slow rain for ~2.5s
    t(1800, () => {
      const end = performance.now() + 2500;
      const tick = () => {
        if (stop.current) return;
        confetti({ ...base, particleCount: 3, angle: 90, spread: 160, startVelocity: 14, gravity: 0.5, ticks: 260, origin: { x: Math.random(), y: -0.05 } });
        if (performance.now() < end) requestAnimationFrame(tick);
      };
      tick();
    });
  });
}

export function SentCelebration({ count }: { count: number }) {
  const router = useRouter();
  const reduce = !!useReducedMotion();
  const went = useRef(false);
  const stop = useRef(false);
  const n = useMotionValue(0);
  const shown = useTransform(n, (v) => Math.round(v).toString());

  const leave = useCallback(() => {
    if (went.current) return;
    went.current = true;
    router.push("/app");
  }, [router]);

  useEffect(() => {
    const total = reduce ? 2000 : TOTAL_MS;
    const timer = setTimeout(leave, total);
    const counter = animate(n, count, { duration: reduce ? 0.6 : 1.6, delay: reduce ? 0 : 1.1, ease: "easeOut" });
    if (!reduce) fireConfetti(stop);
    return () => {
      clearTimeout(timer);
      counter.stop();
      stop.current = true;
      import("canvas-confetti").then(({ default: c }) => c.reset());
    };
  }, [count, leave, reduce, n]);

  const label = useMemo(() => (count === 1 ? "email sent!" : "emails sent!"), [count]);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="All emails sent"
      className="dark fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-[#050f21] text-fg"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0.2 : 0.45 }}
    >
      {!reduce && (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(42,143,208,0.28),transparent_65%)]" />

          {/* paper planes */}
          {PLANES.map((p, i) => (
            <motion.div
              key={i}
              aria-hidden
              className="pointer-events-none absolute left-0"
              style={{ top: `${p.top}%` }}
              initial={{ x: p.rev ? "110vw" : "-20vw", rotate: p.tilt, opacity: 0 }}
              animate={{ x: p.rev ? "-20vw" : "110vw", y: [0, -40, 20, -20], opacity: [0, 1, 1, 0] }}
              transition={{ delay: p.delay, duration: p.dur, ease: "easeIn" }}
            >
              <div style={{ transform: p.rev ? "scaleX(-1)" : undefined }}>
                <Envelope size={p.size} />
              </div>
            </motion.div>
          ))}

          {/* burst from the envelope */}
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-[38%]">
            {BURST.map((b, i) => (
              <motion.div
                key={i}
                className="absolute -ml-4 -mt-4"
                initial={{ x: 0, y: 0, scale: 0, opacity: 0, rotate: 0 }}
                animate={{
                  x: [0, b.x, b.x * 1.08],
                  y: [0, b.y, b.y + b.fall],
                  scale: [0, 1.1, 0.9],
                  opacity: [0, 1, 0.85],
                  rotate: b.rot,
                }}
                transition={{ delay: b.delay, duration: 2.6, times: [0, 0.35, 1], ease: "easeOut" }}
              >
                {b.kind === 0 ? <Envelope size={b.size + 10} /> : b.kind === 1 ? <Coin size={b.size} /> : <Spark size={b.size * 0.8} color={b.color} />}
              </motion.div>
            ))}
          </div>
        </>
      )}

      <div className="relative z-10 flex flex-col items-center px-6 text-center">
        {!reduce && (
          <motion.div
            initial={{ scale: 0, rotate: -8 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 160, damping: 13, delay: 0.25 }}
            className="mb-8"
          >
            <BigEnvelope />
          </motion.div>
        )}

        <div className="relative">
          {/* shimmering gold ring pulse */}
          {!reduce && (
            <>
              {[0, 1].map((i) => (
                <motion.span
                  key={i}
                  aria-hidden
                  className="pointer-events-none absolute left-1/2 top-1/2 -ml-[210px] -mt-[110px] h-[220px] w-[420px] rounded-[999px] border-2 border-[#f5b83d] shadow-[0_0_40px_rgba(245,184,61,0.55)]"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: [0.7, 1.6], opacity: [0.8, 0] }}
                  transition={{ delay: 1.2 + i * 0.7, duration: 1.8, repeat: Infinity, ease: "easeOut" }}
                />
              ))}
              <motion.span
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-1/2 -ml-[200px] -mt-[90px] h-[180px] w-[400px] rounded-full bg-[#f5b83d]/20 blur-3xl"
                animate={{ opacity: [0.5, 1, 0.5], scale: [0.95, 1.08, 0.95] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              />
            </>
          )}
          <motion.h2
            className="relative font-display text-5xl font-extrabold leading-tight text-white sm:text-7xl"
            initial={{ opacity: 0, y: reduce ? 0 : 24, scale: reduce ? 1 : 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: reduce ? 0 : 1, duration: 0.5, ease: EASE }}
          >
            <motion.span className="text-[#f5b83d] tabular-nums">{shown}</motion.span> {label}
          </motion.h2>
        </div>

        <motion.p
          className="relative mt-4 max-w-md text-base text-[#9db3cf] sm:text-lg"
          initial={{ opacity: 0, y: reduce ? 0 : 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduce ? 0.1 : 1.5, duration: 0.4, ease: EASE }}
        >
          Replies go to your inbox. Track them in My emails.
        </motion.p>

        <motion.button
          type="button"
          onClick={leave}
          autoFocus
          className="relative mt-8 h-11 rounded-xl bg-[#f5b83d] px-6 font-semibold text-[#071a33]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduce ? 0.2 : 1.8, duration: 0.3 }}
        >
          Back to home
        </motion.button>
      </div>

      <div aria-hidden className="absolute inset-x-0 bottom-0 h-1.5 bg-white/10">
        <motion.div
          className="h-full bg-gradient-to-r from-[#4cc3f2] via-[#3dd6a3] to-[#f5b83d]"
          style={{ originX: 0 }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: (reduce ? 2000 : TOTAL_MS) / 1000, ease: "linear" }}
        />
      </div>
    </motion.div>
  );
}
