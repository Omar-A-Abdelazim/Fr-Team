"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Envelope } from "@/components/auth/shapes";

const TOTAL_MS = 6000;
const REDUCED_MS = 2000;
const COLORS = ["#f5b83d", "#4cc3f2", "#3dd6a3", "#ffffff"];
const EASE = [0.16, 1, 0.3, 1] as const;

/** Stage is drawn on a fixed 400x200 canvas and scaled to fit the viewport. */
const STAGE_W = 400;
const STAGE_H = 200;
const SEAL = { x: 200, y: 112 };
const PLANE_PATH =
  "M-30 172 C 40 178 90 150 110 115 C 125 85 95 62 78 86 C 60 110 105 138 170 106 C 240 72 300 62 440 0";

const ARC = [-64, -32, 0, 32, 64].map((deg) => {
  const r = (deg * Math.PI) / 180;
  return {
    deg,
    x: Math.round((200 + 128 * Math.sin(r)) * 100) / 100,
    y: Math.round((176 - 122 * Math.cos(r)) * 100) / 100,
  };
});

const SEAL_POINTS = Array.from({ length: 48 }, (_, i) => {
  const a = (i / 48) * Math.PI * 2;
  const rad = i % 2 === 0 ? 46 : 41;
  return `${(48 + Math.cos(a) * rad).toFixed(2)},${(48 + Math.sin(a) * rad).toFixed(2)}`;
}).join(" ");

function PaperPlane() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden className="drop-shadow-[0_6px_14px_rgba(76,195,242,0.55)]">
      <path d="M2 20 38 3 29 37 20 25z" fill="#ffffff" />
      <path d="M2 20 20 25 38 3z" fill="#bfe8fb" />
      <path d="M20 25 24 35 29 37 38 3z" fill="#4cc3f2" />
    </svg>
  );
}

function GoldSeal() {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden className="drop-shadow-[0_10px_30px_rgba(245,184,61,0.5)]">
      <defs>
        <linearGradient id="seal-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe29a" />
          <stop offset="0.55" stopColor="#f5b83d" />
          <stop offset="1" stopColor="#c8841a" />
        </linearGradient>
      </defs>
      <polygon points={SEAL_POINTS} fill="url(#seal-g)" />
      <circle cx="48" cy="48" r="33" fill="none" stroke="#071a33" strokeOpacity=".35" strokeWidth="2" />
      <circle cx="48" cy="48" r="29" fill="#071a33" fillOpacity=".12" />
      <path d="M34 49l9 9 19-21" fill="none" stroke="#071a33" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function fireConfetti(stop: { current: boolean }) {
  import("canvas-confetti").then(({ default: confetti }) => {
    if (stop.current) return;
    const base = { colors: COLORS, zIndex: 120, disableForReducedMotion: true };
    const t = (ms: number, fn: () => void) => setTimeout(() => !stop.current && fn(), ms);
    t(900, () => {
      confetti({ ...base, particleCount: 70, angle: 60, spread: 65, startVelocity: 58, origin: { x: 0, y: 0.95 } });
      confetti({ ...base, particleCount: 70, angle: 120, spread: 65, startVelocity: 58, origin: { x: 1, y: 0.95 } });
    });
    t(1600, () => confetti({ ...base, particleCount: 110, spread: 360, startVelocity: 34, scalar: 1.1, origin: { x: 0.5, y: 0.36 } }));
  });
}

type Props = { count: number; onFinish?: () => void };

export function SentCelebration({ count, onFinish }: Props) {
  const router = useRouter();
  const reduce = !!useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [scale, setScale] = useState(1);
  const went = useRef(false);
  const stop = useRef(false);
  const planeRef = useRef<HTMLDivElement>(null);
  const finishRef = useRef(onFinish);
  const n = useMotionValue(0);
  const shown = useTransform(n, (v) => Math.round(v).toString());

  useEffect(() => {
    finishRef.current = onFinish;
  }, [onFinish]);

  /** One-shot exit: reset the composer first, then go home. */
  const leave = useCallback(() => {
    if (went.current) return;
    went.current = true;
    stop.current = true;
    finishRef.current?.();
    router.push("/app");
  }, [router]);

  // lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // fit the stage to short / narrow screens
  useEffect(() => {
    const fit = () => setScale(Math.max(0.5, Math.min(1, (window.innerWidth - 32) / STAGE_W, (window.innerHeight * 0.3) / STAGE_H)));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && leave();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [leave]);

  useEffect(() => {
    stop.current = false;
    const timer = setTimeout(leave, reduce ? REDUCED_MS : TOTAL_MS);
    const counter = animate(n, count, { duration: reduce ? 0.6 : 1.2, delay: reduce ? 0 : 1.6, ease: "easeOut" });
    if (!reduce) fireConfetti(stop);
    return () => {
      clearTimeout(timer);
      counter.stop();
      stop.current = true;
      import("canvas-confetti").then(({ default: c }) => c.reset());
    };
  }, [count, leave, reduce, n]);

  // plane rides the trail path
  useEffect(() => {
    const el = planeRef.current;
    if (!mounted || reduce || !el || typeof el.animate !== "function") return;
    const anim = el.animate([{ offsetDistance: "0%" }, { offsetDistance: "100%" }], {
      delay: 250,
      duration: 1500,
      easing: "cubic-bezier(0.45, 0, 0.35, 1)",
      fill: "both",
    });
    return () => anim.cancel();
  }, [mounted, reduce]);

  if (!mounted) return null;

  const label = count === 1 ? "email sent" : "emails sent";
  const maskId = `trail-${uid}`;

  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="All emails sent"
      className="dark fixed inset-0 z-[100] flex flex-col overflow-hidden bg-[#050f21] text-fg"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0.2 : 0.45 }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_42%,#12447a_0%,#0a2447_45%,#050f21_100%)]"
      />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-5 py-6 text-center">
        {/* stage */}
        {reduce ? (
          <div className="mb-5 grid size-16 place-items-center rounded-full bg-[#f5b83d] text-[#071a33]">
            <Check className="size-8" strokeWidth={3} />
          </div>
        ) : (
          <div className="shrink-0" style={{ width: STAGE_W * scale, height: STAGE_H * scale }}>
            <div className="relative origin-top-left" style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})` }}>
              {/* envelopes fanned in an arc, flipping like cards */}
              {ARC.map((e, i) => (
                <div
                  key={e.deg}
                  aria-hidden
                  className="absolute"
                  style={{ left: e.x, top: e.y, transform: `translate(-50%,-50%) rotate(${e.deg}deg)` }}
                >
                  <motion.div
                    initial={{ rotateY: 90, opacity: 0, y: 14 }}
                    animate={{ rotateY: 0, opacity: 1, y: 0 }}
                    transition={{ delay: 1.05 + i * 0.1, duration: 0.55, ease: EASE }}
                    style={{ transformPerspective: 600 }}
                  >
                    <Envelope size={66} />
                  </motion.div>
                </div>
              ))}

              {/* dashed trail that draws itself */}
              <svg aria-hidden className="pointer-events-none absolute inset-0 overflow-visible" width={STAGE_W} height={STAGE_H} viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}>
                <defs>
                  <mask id={maskId} maskUnits="userSpaceOnUse" x="-40" y="-20" width="500" height="240">
                    <motion.path
                      d={PLANE_PATH}
                      fill="none"
                      stroke="#fff"
                      strokeWidth="10"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ delay: 0.25, duration: 1.5, ease: [0.45, 0, 0.35, 1] }}
                    />
                  </mask>
                </defs>
                <motion.g
                  mask={`url(#${maskId})`}
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
                  transition={{ delay: 2.1, duration: 0.6 }}
                >
                  <path d={PLANE_PATH} fill="none" stroke="#4cc3f2" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="2 9" />
                </motion.g>
              </svg>

              {/* paper plane */}
              <div
                ref={planeRef}
                aria-hidden
                className="pointer-events-none absolute left-0 top-0"
                style={{ offsetPath: `path("${PLANE_PATH}")`, offsetRotate: "auto", offsetDistance: "0%", opacity: 1 }}
              >
                <PaperPlane />
              </div>

              {/* seal slam + ripple */}
              <div aria-hidden className="absolute" style={{ left: SEAL.x, top: SEAL.y }}>
                <motion.span
                  className="absolute -ml-24 -mt-24 size-48 rounded-full bg-[#f5b83d]/25 blur-3xl"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0.6] }}
                  transition={{ delay: 1.5, duration: 1.2 }}
                />
                {[0, 1].map((i) => (
                  <motion.span
                    key={i}
                    className="absolute -ml-12 -mt-12 size-24 rounded-full border-2 border-[#f5b83d]"
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: [0.8, 3.2], opacity: [0.8, 0] }}
                    transition={{ delay: 1.58 + i * 0.22, duration: 1.1, ease: "easeOut" }}
                  />
                ))}
                <motion.div
                  className="absolute -ml-12 -mt-12"
                  initial={{ scale: 2.6, opacity: 0, rotate: -18 }}
                  animate={{ scale: [2.6, 0.88, 1], opacity: [0, 1, 1], rotate: [-18, 4, 0] }}
                  transition={{ delay: 1.5, duration: 0.55, times: [0, 0.65, 1], ease: "easeOut" }}
                >
                  <GoldSeal />
                </motion.div>
              </div>
            </div>
          </div>
        )}

        {/* headline */}
        <motion.h2
          className="mt-3 flex flex-col items-center font-display font-extrabold leading-none"
          initial={{ opacity: 0, y: reduce ? 0 : 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduce ? 0 : 1.55, duration: 0.5, ease: EASE }}
        >
          <motion.span
            className="bg-gradient-to-r from-[#4cc3f2] via-[#9fe0f8] to-[#f5b83d] bg-clip-text pb-1 text-[clamp(56px,13vh,112px)] tabular-nums text-transparent"
          >
            {shown}
          </motion.span>
          <span className="mt-1 text-[clamp(22px,4vh,34px)] text-white">{label}</span>
        </motion.h2>

        <motion.p
          className="mt-3 max-w-sm text-[15px] text-[#9db3cf] sm:text-base"
          initial={{ opacity: 0, y: reduce ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduce ? 0.1 : 2.2, duration: 0.45, ease: EASE }}
        >
          Replies go to your inbox. Track them in My emails.
        </motion.p>

        <motion.button
          type="button"
          onClick={leave}
          autoFocus
          className="mt-6 h-11 shrink-0 rounded-xl bg-[#f5b83d] px-6 font-semibold text-[#071a33] transition-transform hover:-translate-y-0.5"
          initial={{ opacity: 0, y: reduce ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduce ? 0.2 : 2.6, duration: 0.4, ease: EASE }}
        >
          Back to home
        </motion.button>
      </div>

      <div aria-hidden className="relative z-10 h-1 shrink-0 bg-white/10">
        <motion.div
          className="h-full bg-gradient-to-r from-[#4cc3f2] to-[#f5b83d]"
          style={{ originX: 0 }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: (reduce ? REDUCED_MS : TOTAL_MS) / 1000, ease: "linear" }}
        />
      </div>
    </motion.div>,
    document.body,
  );
}
