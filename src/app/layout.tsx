import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/instrument-sans";
import "@fontsource/cairo/400.css";
import "@fontsource/cairo/700.css";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "FR Hub · IEEE MET",
  description:
    "The IEEE MET Fundraising team's home for sponsors, deals and outreach.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#071a33" },
    { media: "(prefers-color-scheme: light)", color: "#f3f7fb" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
