import { AuthGate } from "@/components/app/auth-gate";
import { Shell } from "@/components/app/shell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate admin>
      <Shell variant="admin">{children}</Shell>
    </AuthGate>
  );
}
