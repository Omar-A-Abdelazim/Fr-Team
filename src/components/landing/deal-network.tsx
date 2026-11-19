"use client";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { useRef } from "react";

type Node = {
  id: string;
  label: string;
  x: number;
  y: number;
  tone: "gold" | "sky" | "mint" | "blue";
  pts: string;
};

const C = { x: 260, y: 260 };

// Partners orbiting the branch. Labels are partner types, never real brands.
const NODES: Node[] = [
  { id: "fund", label: "Fund", x: 260, y: 62, tone: "gold", pts: "+5" },
  { id: "cat", label: "Catering", x: 448, y: 170, tone: "mint", pts: "+3" },
  { id: "host", label: "Host", x: 430, y: 380, tone: "sky", pts: "+2" },
  { id: "course", label: "Courses", x: 250, y: 462, tone: "blue", pts: "+1" },
  { id: "tech", label: "Technical", x: 78, y: 372, tone: "sky", pts: "+1" },
  { id: "fund2", label: "Fund", x: 84, y: 150, tone: "gold", pts: "+5" },
];

const toneVar = {
  gold: "var(--gold)",
  sky: "var(--sky)",
  mint: "var(--mint)",
  blue: "var(--blue)",
} as const;

function curve(n: Node) {
  // Gentle bend so lines feel like flows rather than spokes.
  const mx = (n.x + C.x) / 2 + (n.y - C.y) * 0.18;
  const my = (n.y + C.y) / 2 - (n.x - C.x) * 0.18;
  return `M ${n.x} ${n.y} Q ${mx} ${my} ${C.x} ${C.y}`;
}

export function DealNetwork() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 20 });
  const sy = useSpring(my, { stiffness: 60, damping: 20 });
  const rotX = useTransform(sy, [-0.5, 0.5], [6, -6]);
  const rotY = useTransform(sx, [-0.5, 0.5], [-8, 8]);
  const nearX = useTransform(sx, [-0.5, 0.5], [-14, 14]);
  const nearY = useTransform(sy, [-0.5, 0.5], [-14, 14]);

  function onMove(e: React.PointerEvent) {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  }

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={() => {
        mx.set(0);
        my.set(0);
      }}
      className="relative mx-auto aspect-square w-full max-w-[520px] [perspective:1000px]"
    >
      <motion.div style={{ rotateX: rotX, rotateY: rotY }} className="absolute inset-0">
        <svg
          viewBox="0 0 520 520"
          className="size-full overflow-visible"
          role="img"
          aria-label="Partners of every type connecting to the IEEE MET branch"
        >
          <defs>
            <radialGradient id="core" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--sky)" stopOpacity="0.55" />
              <stop offset="100%" stopColor="var(--sky)" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* orbits */}
          <g className="animate-spin-slow" style={{ transformOrigin: "260px 260px" }}>
            <circle cx={C.x} cy={C.y} r="200" fill="none" stroke="var(--line)" strokeDasharray="2 10" />
          </g>
          <g className="animate-spin-slower" style={{ transformOrigin: "260px 260px" }}>
            <circle cx={C.x} cy={C.y} r="130" fill="none" stroke="var(--line)" strokeDasharray="1 7" />
          </g>

          {/* flows */}
          {NODES.map((n, i) => (
            <g key={n.id}>
              <motion.path
                id={`flow-${n.id}`}
                d={curve(n)}
                fill="none"
                stroke={toneVar[n.tone]}
                strokeOpacity={0.55}
                strokeWidth={1.5}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.9, delay: 0.3 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
              />
              {!reduce && (
                // a coin travelling from partner to branch
                <circle r="5" fill="var(--gold)" opacity="0">
                  <animate
                    attributeName="opacity"
                    values="0;1;1;0"
                    keyTimes="0;0.15;0.85;1"
                    dur={`${2.6 + (i % 3) * 0.5}s`}
                    begin={`${1.4 + i * 0.45}s`}
                    repeatCount="indefinite"
                  />
                  <animateMotion
                    dur={`${2.6 + (i % 3) * 0.5}s`}
                    begin={`${1.4 + i * 0.45}s`}
                    repeatCount="indefinite"
                    calcMode="spline"
                    keyTimes="0;1"
                    keySplines="0.4 0 0.2 1"
                  >
                    <mpath href={`#flow-${n.id}`} />
                  </animateMotion>
                </circle>
              )}
            </g>
          ))}

          {/* branch core */}
          <circle cx={C.x} cy={C.y} r="92" fill="url(#core)" />
          <motion.g
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: "260px 260px" }}
          >
            <circle cx={C.x} cy={C.y} r="52" fill="var(--blue)" />
            <circle cx={C.x} cy={C.y} r="52" fill="none" stroke="var(--sky)" strokeOpacity="0.6" strokeWidth="2" />
            <text x={C.x} y={C.y - 4} textAnchor="middle" className="fill-white font-display text-[17px] font-bold">
              IEEE MET
            </text>
            <text x={C.x} y={C.y + 16} textAnchor="middle" className="fill-white/75 text-[11px]">
              Student Branch
            </text>
          </motion.g>
        </svg>

        {/* partner chips, rendered in HTML so text stays crisp and they can float closer to the viewer */}
        <motion.div style={{ x: nearX, y: nearY }} className="absolute inset-0">
          {NODES.map((n, i) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.2 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${(n.x / 520) * 100}%`, top: `${(n.y / 520) * 100}%` }}
            >
              <div className="flex items-center gap-2 rounded-full border border-line bg-raised px-3 py-1.5 text-xs font-semibold shadow-[0_8px_30px_-12px_var(--glow)] sm:text-sm">
                <span className="size-2 rounded-full" style={{ background: toneVar[n.tone] }} />
                {n.label}
                <span className="text-gold">{n.pts}</span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
