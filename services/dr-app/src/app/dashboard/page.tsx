import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DashboardTabs } from "@/app/dashboard/DashboardTabs";
import { getDashboardData } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  const dashboardData = await getDashboardData({
    id: session.user.id,
    role: session.user.role,
    avatarUrl: session.user.avatarUrl ?? null
  });

  return (
    <div className="relative left-1/2 right-1/2 h-[calc(100dvh-140px)] max-h-[calc(100dvh-140px)] w-screen -mx-[50vw] overflow-hidden">
      <DashboardTabs {...dashboardData} />
    </div>
  );
}
