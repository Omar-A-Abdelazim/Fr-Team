"use client";

import Link from "next/link";
import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export function Nav() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 24));

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-3">
      <motion.nav
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "mx-auto flex max-w-6xl items-center justify-between rounded-2xl px-4 transition-[background-color,border-color,padding] duration-300",
          scrolled
            ? "border border-line bg-raised/80 py-2 backdrop-blur-md"
            : "border border-transparent py-3",
        )}
      >
        <Link href="/" aria-label="FR Hub home">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <a
            href="#how"
            className="hidden rounded-full px-3 py-2 text-sm text-muted transition-colors hover:text-fg sm:block"
          >
            How it works
          </a>
          <ThemeToggle />
          <Link
            href="/login"
            className="rounded-full bg-blue px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Sign in
          </Link>
        </div>
      </motion.nav>
    </header>
  );
}
