import { Award } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard";

interface WelcomeCardProps {
  welcome: DashboardData["welcome"];
}

export function WelcomeCard({ welcome }: WelcomeCardProps) {
  const today = new Date();
  const formattedDate = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 p-6 text-white">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h1 className="mb-2 text-xl font-bold">Welcome back, {welcome.userName}! 👋</h1>
          <p className="mb-2 text-sm text-white/80">{formattedDate}</p>
          <p className="text-sm text-white/80">
            You have {welcome.tasksRemaining} tasks remaining for today
          </p>
        </div>

        <div className="ml-3 rounded-lg bg-white/20 px-3 py-3 backdrop-blur-sm">
          <div className="mb-1 flex items-center gap-1">
            <Award className="h-4 w-4 text-white" />
            <span className="text-xs">Current Streak</span>
          </div>
          <p className="text-center text-3xl font-bold">{welcome.currentStreak} days</p>
        </div>
      </div>
    </div>
  );
}
