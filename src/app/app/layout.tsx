import { AuthGate } from "@/components/app/auth-gate";
import { Shell } from "@/components/app/shell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <Shell variant="member">{children}</Shell>
    </AuthGate>
  );
}
