"use client";

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { useCallback, useState } from "react";
import { Arrow, Bars, Coin, Envelope, PointPill, Rings, Spark } from "./shapes";

type Floater = {
  el: React.ReactNode;
  left: string;
  top: string;
  depth: number; // parallax strength
  bob: number; // vertical travel px
  spin: number; // degrees
  dur: number;
  delay: number;
  hideSm?: boolean;
};

const FLOATERS: Floater[] = [
  { el: <Coin size={58} />, left: "8%", top: "16%", depth: 40, bob: 22, spin: 360, dur: 7, delay: 0 },
  { el: <Envelope size={70} />, left: "78%", top: "12%", depth: 30, bob: 18, spin: -10, dur: 6, delay: 0.6 },
  { el: <Rings size={86} />, left: "84%", top: "62%", depth: 50, bob: 26, spin: 14, dur: 8, delay: 0.2 },
  { el: <Bars size={62} />, left: "12%", top: "70%", depth: 36, bob: 20, spin: -8, dur: 7.5, delay: 1 },
  { el: <Arrow size={48} />, left: "26%", top: "40%", depth: 22, bob: 30, spin: 0, dur: 5, delay: 0.4, hideSm: true },
  { el: <Coin size={34} />, left: "68%", top: "84%", depth: 60, bob: 16, spin: -360, dur: 6, delay: 1.4 },
  { el: <Coin size={28} />, left: "92%", top: "36%", depth: 70, bob: 14, spin: 360, dur: 5.5, delay: 0.9 },
  { el: <Spark size={28} color="var(--gold)" />, left: "20%", top: "10%", depth: 18, bob: 10, spin: 180, dur: 4, delay: 0.3 },
  { el: <Spark size={20} />, left: "72%", top: "30%", depth: 26, bob: 12, spin: -180, dur: 4.5, delay: 1.1, hideSm: true },
  { el: <Spark size={22} color="var(--mint)" />, left: "36%", top: "88%", depth: 30, bob: 10, spin: 180, dur: 5, delay: 0.7 },
  { el: <PointPill text="+5 Fund" color="var(--gold)" />, left: "64%", top: "6%", depth: 44, bob: 18, spin: 6, dur: 6.5, delay: 0.5, hideSm: true },
  { el: <PointPill text="+3 Catering" color="var(--mint)" />, left: "4%", top: "44%", depth: 34, bob: 20, spin: -6, dur: 7, delay: 1.2 },
  { el: <PointPill text="+2 Host" color="var(--sky)" />, left: "74%", top: "46%", depth: 28, bob: 16, spin: 4, dur: 6, delay: 0.2, hideSm: true },
  { el: <Envelope size={44} />, left: "40%", top: "6%", depth: 52, bob: 14, spin: 8, dur: 5.5, delay: 1.6, hideSm: true },
  { el: <Arrow size={36} />, left: "56%", top: "90%", depth: 40, bob: 18, spin: 0, dur: 4.8, delay: 0.8, hideSm: true },
];

const BLOBS = [
  "M421,301Q391,352,351,394Q311,436,250,441Q189,446,139,410Q89,374,72,312Q55,250,79,193Q103,136,153,96Q203,56,262,67Q321,78,371,114Q421,150,436,200Q451,250,421,301Z",
  "M445,312Q404,374,349,410Q294,446,232,432Q170,418,121,377Q72,336,66,268Q60,200,104,150Q148,100,212,72Q276,44,330,86Q384,128,435,189Q486,250,445,312Z",
  "M402,296Q383,342,345,383Q307,424,247,429Q187,434,148,389Q109,344,83,297Q57,250,77,196Q97,142,148,111Q199,80,258,71Q317,62,360,107Q403,152,412,201Q421,250,402,296Z",
];

function FloaterItem({ f, mx, my, reduce }: { f: Floater; mx: MotionValue<number>; my: MotionValue<number>; reduce: boolean }) {
  const x = useTransform(mx, (v) => v * f.depth);
  const y = useTransform(my, (v) => v * f.depth);
  return (
    <motion.div
      className={`absolute ${f.hideSm ? "hidden md:block" : ""}`}
      style={{ left: f.left, top: f.top, x, y }}
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: 0.2 + f.delay * 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        animate={reduce ? undefined : { y: [0, -f.bob, 0], rotate: [0, f.spin / 2, f.spin] }}
        transition={{ duration: f.dur, delay: f.delay, repeat: Infinity, ease: "easeInOut", repeatType: "mirror" }}
      >
        {f.el}
      </motion.div>
    </motion.div>
  );
}

type Burst = { id: number; x: number; y: number };

/** Full-screen living background: morphing blob, orbiting partners, floating deal objects, flying mail, click-to-burst coins. */
export function AuthScene() {
  const reduce = !!useReducedMotion();
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const mx = useSpring(rawX, { stiffness: 50, damping: 18 });
  const my = useSpring(rawY, { stiffness: 50, damping: 18 });
  const glowX = useSpring(useMotionValue(-400), { stiffness: 120, damping: 25 });
  const glowY = useSpring(useMotionValue(-400), { stiffness: 120, damping: 25 });
  const [bursts, setBursts] = useState<Burst[]>([]);

  const onMove = useCallback(
    (e: React.PointerEvent) => {
      if (reduce) return;
      rawX.set(e.clientX / window.innerWidth - 0.5);
      rawY.set(e.clientY / window.innerHeight - 0.5);
      glowX.set(e.clientX - 200);
      glowY.set(e.clientY - 200);
    },
    [reduce, rawX, rawY, glowX, glowY],
  );

  const onDown = useCallback(
    (e: React.PointerEvent) => {
      if (reduce) return;
      const target = e.target as HTMLElement;
      if (target.closest("[data-no-burst]")) return;
      const b = { id: Date.now(), x: e.clientX, y: e.clientY };
      setBursts((s) => [...s, b]);
      setTimeout(() => setBursts((s) => s.filter((i) => i.id !== b.id)), 900);
    },
    [reduce],
  );

  return (
    <div
      onPointerMove={onMove}
      onPointerDown={onDown}
      className="fixed inset-0 overflow-hidden"
      aria-hidden
    >
      <div className="dot-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />

      {/* cursor glow */}
      <motion.div
        className="pointer-events-none absolute size-[400px] rounded-full bg-sky/20 blur-[90px]"
        style={{ x: glowX, y: glowY }}
      />

      {/* morphing blob behind the card */}
      <div className="absolute left-1/2 top-1/2 size-[min(110vw,760px)] -translate-x-1/2 -translate-y-1/2">
        <svg viewBox="0 0 500 500" className="size-full">
          <defs>
            <linearGradient id="blob" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--blue)" />
              <stop offset="55%" stopColor="var(--sky)" />
              <stop offset="100%" stopColor="var(--gold)" />
            </linearGradient>
          </defs>
          <motion.path
            fill="url(#blob)"
            opacity={0.32}
            d={BLOBS[0]}
            animate={reduce ? undefined : { d: [BLOBS[0], BLOBS[1], BLOBS[2], BLOBS[0]], rotate: [0, 40, -20, 0] }}
            transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformOrigin: "250px 250px", filter: "blur(30px)" }}
          />
        </svg>
      </div>

      {/* orbits with partner planets */}
      {[
        { r: 300, dur: 40, dots: ["var(--gold)", "var(--mint)"], dir: 1 },
        { r: 390, dur: 60, dots: ["var(--sky)", "var(--coral)", "var(--gold)"], dir: -1 },
        { r: 480, dur: 80, dots: ["#a78bfa", "var(--mint)"], dir: 1 },
      ].map((o) => (
        <motion.div
          key={o.r}
          className="absolute left-1/2 top-1/2 rounded-full border border-dashed border-line"
          style={{ width: o.r * 2, height: o.r * 2, marginLeft: -o.r, marginTop: -o.r }}
          animate={reduce ? undefined : { rotate: 360 * o.dir }}
          transition={{ duration: o.dur, repeat: Infinity, ease: "linear" }}
        >
          {o.dots.map((c, i) => {
            const a = (i / o.dots.length) * Math.PI * 2;
            return (
              <span
                key={i}
                className="absolute size-3.5 rounded-full shadow-[0_0_20px_currentColor]"
                style={{
                  background: c,
                  color: c,
                  left: o.r + Math.cos(a) * o.r - 7,
                  top: o.r + Math.sin(a) * o.r - 7,
                }}
              />
            );
          })}
        </motion.div>
      ))}

      {/* flying mail across the screen */}
      {!reduce &&
        [0, 1].map((i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{ top: i ? "78%" : "24%" }}
            initial={{ x: "-12vw", y: 0, rotate: -8 }}
            animate={{ x: "112vw", y: [0, -60, 20, -30], rotate: [-8, 6, -4, 8] }}
            transition={{ duration: 14 + i * 5, delay: 2 + i * 6, repeat: Infinity, ease: "linear", repeatDelay: 4 }}
          >
            <Envelope size={38} />
          </motion.div>
        ))}

      {/* floating objects with depth parallax */}
      {FLOATERS.map((f, i) => (
        <FloaterItem key={i} f={f} mx={mx} my={my} reduce={reduce} />
      ))}

      {/* click bursts */}
      <AnimatePresence>
        {bursts.map((b) =>
          Array.from({ length: 8 }).map((_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return (
              <motion.div
                key={`${b.id}-${i}`}
                className="pointer-events-none fixed"
                style={{ left: b.x - 12, top: b.y - 12 }}
                initial={{ x: 0, y: 0, scale: 0.4, opacity: 1 }}
                animate={{ x: Math.cos(a) * 90, y: Math.sin(a) * 90 + 30, scale: 1, opacity: 0, rotate: 180 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              >
                <Coin size={24} />
              </motion.div>
            );
          }),
        )}
      </AnimatePresence>
    </div>
  );
}
