"use client";

import { motion } from "framer-motion";
import { Coins, Handshake, Percent, Send, Building2, type LucideIcon } from "lucide-react";
import { CountUp } from "@/components/motion/count-up";
import type { computeKpis } from "./stats";

type Kpis = ReturnType<typeof computeKpis>;

export function KpiRow({ kpis, rangeKey }: { kpis: Kpis; rangeKey: string }) {
  const items: { label: string; value: number; suffix?: string; icon: LucideIcon; tone: string; hero?: boolean }[] = [
    { label: "Sponsors logged", value: kpis.logged, icon: Building2, tone: "text-sky" },
    { label: "Contacted", value: kpis.contacted, icon: Send, tone: "text-sky" },
    { label: "Response rate", value: kpis.responseRate, suffix: "%", icon: Percent, tone: "text-amber" },
    { label: "Deals won", value: kpis.won, icon: Handshake, tone: "text-mint" },
    { label: "Points awarded", value: kpis.points, icon: Coins, tone: "text-gold", hero: true },
  ];
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((it, i) => (
        <motion.div
          key={it.label}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -3 }}
          className={`group ${it.hero ? "col-span-2 sm:col-span-1" : ""}`}
        >
          <div className="flex items-center gap-2 text-sm text-muted">
            <it.icon className={`size-4 transition-transform duration-300 group-hover:scale-125 group-hover:-rotate-6 ${it.tone}`} />
            {it.label}
          </div>
          <div className={`mt-1.5 font-display text-5xl font-bold tracking-tight ${it.hero ? "text-gold" : "text-fg"}`}>
            <CountUp key={`${rangeKey}-${it.value}`} to={it.value} />
            {it.suffix && <span className="text-3xl text-muted">{it.suffix}</span>}
          </div>
          <motion.div
            className={`mt-3 h-0.5 origin-left rounded-full ${it.hero ? "bg-gold" : "bg-line"}`}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.3 + i * 0.07, duration: 0.7, ease: "easeOut" }}
          />
        </motion.div>
      ))}
    </div>
  );
}
