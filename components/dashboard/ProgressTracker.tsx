import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardData } from "@/lib/dashboard";

interface ProgressTrackerProps {
  progress: DashboardData["progress"];
}

export function ProgressTracker({ progress }: ProgressTrackerProps) {
  const dailyPercentage = Math.min(100, Math.max(0, progress.daily.percentage));
  const weeklyPercentage = Math.min(100, Math.max(0, progress.weekly.percentage));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-bold">Progress Tracker</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Daily Progress</span>
            <span className="text-sm font-semibold text-blue-600">{dailyPercentage}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-blue-600 transition-all duration-300"
              style={{ width: `${dailyPercentage}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {progress.daily.completed} of {progress.daily.total} tasks completed
          </p>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Weekly Progress</span>
            <span className="text-sm font-semibold text-green-600">{weeklyPercentage}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-green-600 transition-all duration-300"
              style={{ width: `${weeklyPercentage}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {progress.weekly.completed} of {progress.weekly.total} study hours completed
          </p>
        </div>

        <div className="w-full border-t border-gray-200" />

        <div className="space-y-2">
          <h2 className="text-sm font-bold text-gray-700">Upcoming Deadlines</h2>
          {progress.upcomingDeadlines.length === 0 ? (
            <p className="text-sm text-gray-500">No upcoming deadlines.</p>
          ) : (
            progress.upcomingDeadlines.map((deadline) => (
              <div key={deadline.id} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{deadline.title}</span>
                <span className={`text-sm font-medium ${deadline.color}`}>
                  {deadline.daysLeft} day{deadline.daysLeft === 1 ? "" : "s"}
                </span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
