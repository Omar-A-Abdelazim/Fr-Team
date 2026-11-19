import { Shell } from "@/components/app/shell";

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return <Shell variant="member">{children}</Shell>;
}
