"use client";

import { animate, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

export function CountUp({
  to,
  duration = 1.2,
  prefix = "",
  className,
}: {
  to: number;
  duration?: number;
  prefix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      const id = requestAnimationFrame(() => setValue(to));
      return () => cancelAnimationFrame(id);
    }
    const controls = animate(0, to, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, to, duration, reduce]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {value}
    </span>
  );
}
