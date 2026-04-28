import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { WelcomeCard } from "@/components/dashboard/WelcomeCard";
import { StatsGrid } from "@/components/dashboard/StatsGrid";
import { TodaysTasks } from "@/components/dashboard/TodaysTasks";
import { ProgressTracker } from "@/components/dashboard/ProgressTracker";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { UpcomingSessions } from "@/components/dashboard/UpcomingSessions";
import { authOptions } from "@/auth";
import { getDashboardData } from "@/lib/dashboard";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user && "id" in session.user ? String(session.user.id) : null;

  if (!userId) {
    redirect("/Auth?mode=login");
  }

  const dashboard = await getDashboardData(userId);

  return (
    <div className="min-h-full bg-gray-50">
      <div className="p-4 sm:p-4 lg:p-4">
        <div className="space-y-6 sm:space-y-8">
          <WelcomeCard welcome={dashboard.welcome} />
          <StatsGrid stats={dashboard.stats} />

          <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
            <TodaysTasks tasks={dashboard.tasks} />
            <ProgressTracker progress={dashboard.progress} />
            <RecentActivity activities={dashboard.activities} />
          </div>

          <UpcomingSessions sessions={dashboard.sessions} />
        </div>
      </div>
    </div>
  );
}
