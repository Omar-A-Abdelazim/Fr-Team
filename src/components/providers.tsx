"use client";

import { ThemeProvider } from "next-themes";
import { MotionConfig } from "framer-motion";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/firebase/auth-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <MotionConfig reducedMotion="user">
        <AuthProvider>{children}</AuthProvider>
        <Toaster richColors position="bottom-right" />
      </MotionConfig>
    </ThemeProvider>
  );
}
