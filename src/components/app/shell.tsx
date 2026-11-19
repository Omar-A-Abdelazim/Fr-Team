"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { BarChart3, Building2, CheckCheck, LogOut, Mail, Sparkles, Trophy } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const MEMBER_NAV = [
  { href: "/app", label: "My sponsors", icon: Building2 },
  { href: "/app/leaderboard", label: "Leaderboard", icon: Trophy },
];

const ADMIN_NAV = [
  { href: "/admin", label: "Overview", icon: BarChart3 },
  { href: "/admin/approvals", label: "Approvals", icon: CheckCheck },
  { href: "/admin/insights", label: "Refusal insights", icon: Sparkles },
  { href: "/admin/emails", label: "Email composer", icon: Mail },
];

export function Shell({ children, variant }: { children: React.ReactNode; variant: "member" | "admin" }) {
  const pathname = usePathname();
  const nav = variant === "admin" ? ADMIN_NAV : MEMBER_NAV;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-raised/90 px-4 py-3 backdrop-blur lg:h-dvh lg:flex-col lg:items-stretch lg:justify-start lg:border-b-0 lg:border-r lg:px-4 lg:py-6">
        <Link href="/" className="lg:px-2">
          <Logo />
        </Link>

        <nav className="hidden lg:mt-10 lg:block">
          <ul className="space-y-1">
            {nav.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                      active ? "text-fg" : "text-muted hover:text-fg",
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId={`nav-${variant}`}
                        className="absolute inset-0 -z-10 rounded-xl bg-blue/15"
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      />
                    )}
                    <item.icon className={cn("size-[18px]", active && "text-sky")} aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <Link
            href={variant === "admin" ? "/app" : "/admin"}
            className="mt-6 block rounded-xl border border-dashed border-line px-3 py-2.5 text-sm text-muted hover:text-fg"
          >
            {variant === "admin" ? "Switch to member view" : "Switch to admin view"}
          </Link>
        </nav>

        <div className="flex items-center gap-2 lg:mt-auto lg:justify-between lg:rounded-2xl lg:border lg:border-line lg:p-3">
          <div className="hidden items-center gap-2.5 lg:flex">
            <span className="grid size-9 place-items-center rounded-full bg-sky font-display font-bold text-[#071a33]">O</span>
            <div className="text-sm leading-tight">
              <p className="font-semibold">Omar</p>
              <p className="text-muted">{variant === "admin" ? "FR Head" : "FR member"}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link href="/" aria-label="Sign out" className="grid size-10 place-items-center rounded-full text-muted hover:bg-fg/5 hover:text-fg">
              <LogOut className="size-4" />
            </Link>
          </div>
        </div>
      </aside>

      {/* mobile bottom nav */}
      <nav className="fixed inset-x-3 bottom-3 z-40 flex justify-around rounded-2xl border border-line bg-raised/95 p-1.5 backdrop-blur lg:hidden">
        {nav.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn("flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px]", active ? "bg-blue/15 text-fg" : "text-muted")}
            >
              <item.icon className="size-5" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <motion.main
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="min-w-0 px-4 pb-28 pt-6 sm:px-8 lg:pb-12 lg:pt-10"
      >
        {children}
      </motion.main>
    </div>
  );
}

export function StatusBadge({ label, color, ink }: { label: string; color: string; ink: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: color, color: ink }}>
      {label}
    </span>
  );
}
