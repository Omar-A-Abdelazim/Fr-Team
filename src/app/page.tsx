import { AuthScene } from "@/components/auth/scene";
import { AuthCard } from "@/components/auth/auth-card";

export default function Home() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <AuthScene />
      <div className="relative z-10 flex w-full flex-col items-center">
        <h1 className="sr-only">FR Hub, IEEE MET fundraising workspace</h1>
        <AuthCard />
      </div>
    </main>
  );
}
