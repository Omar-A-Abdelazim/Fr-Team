"use client";

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from "framer-motion";
import { useEffect } from "react";
import { Arrow, Bars, Coin, Envelope, Rings, Spark } from "@/components/auth/shapes";

type Item = {
  el: React.ReactNode;
  left: string;
  top: string;
  depth: number;
  bob: number;
  spin: number;
  dur: number;
  opacity: number;
  hideSm?: boolean;
};

const ITEMS: Item[] = [
  { el: <Coin size={40} />, left: "6%", top: "14%", depth: 36, bob: 18, spin: 40, dur: 9, opacity: 0.48 },
  { el: <Envelope size={46} />, left: "88%", top: "10%", depth: 26, bob: 14, spin: -10, dur: 7, opacity: 0.45, hideSm: true },
  { el: <Rings size={48} />, left: "92%", top: "58%", depth: 44, bob: 20, spin: 12, dur: 11, opacity: 0.42 },
  { el: <Bars size={36} />, left: "4%", top: "66%", depth: 30, bob: 16, spin: -8, dur: 10, opacity: 0.45, hideSm: true },
  { el: <Arrow size={32} />, left: "46%", top: "8%", depth: 20, bob: 22, spin: 0, dur: 6, opacity: 0.48, hideSm: true },
  { el: <Coin size={24} />, left: "72%", top: "86%", depth: 52, bob: 12, spin: -60, dur: 8, opacity: 0.48 },
  { el: <Spark size={22} color="var(--gold)" />, left: "20%", top: "88%", depth: 24, bob: 10, spin: 90, dur: 7, opacity: 0.5 },
  { el: <Spark size={24} />, left: "80%", top: "34%", depth: 34, bob: 12, spin: -90, dur: 9, opacity: 0.48, hideSm: true },
  { el: <Envelope size={30} />, left: "30%", top: "94%", depth: 40, bob: 12, spin: 10, dur: 12, opacity: 0.35 },
  { el: <Rings size={30} />, left: "14%", top: "38%", depth: 28, bob: 14, spin: -14, dur: 13, opacity: 0.32, hideSm: true },
  { el: <Spark size={20} color="var(--mint)" />, left: "60%", top: "62%", depth: 46, bob: 10, spin: 120, dur: 14, opacity: 0.4, hideSm: true },
  { el: <Bars size={28} />, left: "96%", top: "86%", depth: 32, bob: 14, spin: 8, dur: 10, opacity: 0.35 },
];

const ORBS = [
  { cls: "left-[-10%] top-[-8%] size-[520px] bg-blue", dx: 60, dy: 40, dur: 26, o: 0.16 },
  { cls: "right-[-12%] top-[30%] size-[460px] bg-sky", dx: -50, dy: 50, dur: 32, o: 0.12 },
  { cls: "bottom-[-14%] left-[28%] size-[420px] bg-gold", dx: 40, dy: -40, dur: 28, o: 0.1 },
];

function Floater({ f, mx, my, reduce }: { f: Item; mx: MotionValue<number>; my: MotionValue<number>; reduce: boolean }) {
  const x = useTransform(mx, (v) => v * f.depth);
  const y = useTransform(my, (v) => v * f.depth);
  return (
    <motion.div className={`absolute ${f.hideSm ? "hidden md:block" : ""}`} style={{ left: f.left, top: f.top, x, y, opacity: f.opacity }}>
      <motion.div
        animate={reduce ? undefined : { y: [0, -f.bob, 0], rotate: [0, f.spin / 2, f.spin] }}
        transition={{ duration: f.dur, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
      >
        {f.el}
      </motion.div>
    </motion.div>
  );
}

/** Subtle fixed background life: floating deal objects, blurred orbs and mouse parallax. */
export function Ambient() {
  const reduce = !!useReducedMotion();
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const mx = useSpring(rawX, { stiffness: 40, damping: 20 });
  const my = useSpring(rawY, { stiffness: 40, damping: 20 });

  useEffect(() => {
    if (reduce) return;
    const move = (e: PointerEvent) => {
      rawX.set(e.clientX / window.innerWidth - 0.5);
      rawY.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [reduce, rawX, rawY]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* lower overall strength in the light theme */}
      <div className="absolute inset-0 opacity-100">
        {ORBS.map((o, i) => (
          <motion.div
            key={i}
            className={`absolute rounded-full blur-[110px] ${o.cls}`}
            style={{ opacity: o.o }}
            animate={reduce ? undefined : { x: [0, o.dx, 0], y: [0, o.dy, 0] }}
            transition={{ duration: o.dur, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
          />
        ))}
        {ITEMS.map((f, i) => (
          <Floater key={i} f={f} mx={mx} my={my} reduce={reduce} />
        ))}
      </div>
    </div>
  );
}
