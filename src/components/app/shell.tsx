"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/auth-context";
import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Inbox, BarChart3, Building2, CheckCheck, LogOut, Mail, Sparkles, Trophy } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { Ambient } from "@/components/fx/ambient";

const MotionLink = motion.create(Link);

function NavIcon({ icon: Icon, active, reduce }: { icon: LucideIcon; active: boolean; reduce: boolean }) {
  return (
    <span className="relative grid size-[18px] place-items-center">
      {active && !reduce && (
        <motion.span
          aria-hidden
          className="absolute -inset-1.5 rounded-full bg-sky blur-md"
          animate={{ opacity: [0.12, 0.45, 0.12], scale: [0.85, 1.25, 0.85] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <motion.span
        className="relative grid place-items-center"
        variants={reduce ? undefined : { hover: { rotate: [0, -14, 12, -6, 0], scale: [1, 1.2, 1.12, 1.05, 1], transition: { duration: 0.3 } } }}
      >
        <Icon className={cn("size-[18px]", active && "text-sky")} aria-hidden />
      </motion.span>
    </span>
  );
}

const MEMBER_NAV = [
  { href: "/app", label: "My sponsors", icon: Building2 },
  { href: "/app/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/app/emails", label: "Email composer", icon: Mail },
  { href: "/app/sent", label: "My emails", icon: Inbox },
];

const ADMIN_NAV = [
  { href: "/admin", label: "Overview", icon: BarChart3 },
  { href: "/admin/approvals", label: "Approvals", icon: CheckCheck },
  { href: "/admin/insights", label: "Refusal insights", icon: Sparkles },
  { href: "/admin/emails", label: "Email composer", icon: Mail },
];

export function Shell({ children, variant }: { children: React.ReactNode; variant: "member" | "admin" }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const isAdmin = profile?.role === "admin";
  const name = profile?.name ?? "";
  const nav = variant === "admin" ? ADMIN_NAV : MEMBER_NAV;
  const reduce = !!useReducedMotion();

  return (
    <div className="relative min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <Ambient />
      <aside className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-raised/90 px-4 py-3 backdrop-blur lg:h-dvh lg:flex-col lg:items-stretch lg:justify-start lg:border-b-0 lg:border-r lg:px-4 lg:py-6">
        <Link href="/app" className="lg:px-2">
          <Logo />
        </Link>

        <nav className="hidden lg:mt-10 lg:block">
          <ul className="space-y-1">
            {nav.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <MotionLink
                    href={item.href}
                    whileHover="hover"
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
                    <NavIcon icon={item.icon} active={active} reduce={reduce} />
                    {item.label}
                  </MotionLink>
                </li>
              );
            })}
          </ul>
          {isAdmin && (
            <Link
              href={variant === "admin" ? "/app" : "/admin"}
              className="mt-6 block rounded-xl border border-dashed border-line px-3 py-2.5 text-sm text-muted hover:text-fg"
            >
              {variant === "admin" ? "Switch to member view" : "Switch to admin view"}
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2 lg:mt-auto lg:justify-between lg:rounded-2xl lg:border lg:border-line lg:p-3">
          <div className="hidden min-w-0 flex-1 items-center gap-2.5 lg:flex">
            {profile?.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.photoURL} alt="" className="size-9 shrink-0 rounded-full" referrerPolicy="no-referrer" />
            ) : (
              <span
                className="grid size-9 shrink-0 place-items-center rounded-full font-display font-bold text-[#071a33]"
                style={{ background: profile?.color ?? "var(--sky)" }}
              >
                {name[0]?.toUpperCase()}
              </span>
            )}
            <div className="min-w-0 text-sm leading-tight">
              <p className="truncate font-semibold">{name}</p>
              <p className="truncate text-muted">{isAdmin ? "Admin" : "FR member"}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center lg:-mr-1">
            <ThemeToggle />
            <button
              type="button"
              onClick={async () => {
                await signOut();
                router.replace("/");
              }}
              aria-label="Sign out"
              title="Sign out"
              className="grid size-9 place-items-center rounded-full text-muted hover:bg-fg/5 hover:text-fg"
            >
              <LogOut className="size-4" />
            </button>
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
        className="relative z-[1] min-w-0 px-4 pb-28 pt-6 sm:px-8 lg:pb-12 lg:pt-10"
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
