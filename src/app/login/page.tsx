import Link from "next/link";
import { Backdrop } from "@/components/motion/backdrop";
import { Logo } from "@/components/brand/logo";

// Placeholder until Firebase is connected in Stage 2.
export default function LoginPage() {
  return (
    <main className="relative grid min-h-dvh place-items-center px-5">
      <Backdrop />
      <div className="relative w-full max-w-sm rounded-3xl border border-line bg-raised p-8 text-center">
        <Logo className="justify-center" />
        <h1 className="mt-6 font-display text-2xl font-bold">Sign in is almost ready</h1>
        <p className="mt-2 text-muted">Google sign-in turns on once the Firebase project is connected.</p>
        <Link href="/" className="mt-6 inline-flex rounded-full border border-line px-5 py-2.5 font-semibold hover:bg-fg/5">
          Back to home
        </Link>
      </div>
    </main>
  );
}
