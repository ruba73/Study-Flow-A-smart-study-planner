import { BookOpen, Clock, Target, TrendingUp } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard";
import { StatCard } from "./StatCard";

interface StatsGridProps {
  stats: DashboardData["stats"];
}

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
      <StatCard
        title="Active Goals"
        value={stats.activeGoals}
        icon={BookOpen}
        iconColor="text-blue-600"
        iconBgColor="bg-blue-50"
      />
      <StatCard
        title="Study Hours (Week)"
        value={stats.studyHoursWeek}
        icon={Clock}
        iconColor="text-green-600"
        iconBgColor="bg-green-50"
      />
      <StatCard
        title="Task Completion"
        value={`${stats.completionRate}%`}
        icon={TrendingUp}
        iconColor="text-purple-600"
        iconBgColor="bg-purple-50"
      />
      <StatCard
        title="Goals Achieved"
        value={stats.goalsAchieved}
        icon={Target}
        iconColor="text-orange-600"
        iconBgColor="bg-orange-50"
      />
    </div>
  );
}
