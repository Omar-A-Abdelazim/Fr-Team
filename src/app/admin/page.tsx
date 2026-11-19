import { AdminOverview } from "@/components/admin/overview";
import { CURRENT_USER_ID, MOCK_MEMBERS, MOCK_SPONSORS } from "@/lib/mock-data";

export default function AdminPage() {
  const me = MOCK_MEMBERS.find((m) => m.id === CURRENT_USER_ID) ?? MOCK_MEMBERS[0];
  return <AdminOverview greeting="Welcome back" name={me.name} sponsors={MOCK_SPONSORS} members={MOCK_MEMBERS} />;
}
