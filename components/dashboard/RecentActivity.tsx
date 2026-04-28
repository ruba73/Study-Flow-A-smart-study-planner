import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardActivityItem } from "@/lib/dashboard";

interface RecentActivityProps {
  activities: DashboardActivityItem[];
}

export function RecentActivity({ activities }: RecentActivityProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-bold">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-sm text-gray-500">No recent activity yet.</p>
        ) : (
          <div className="space-y-2">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3">
                <div className="mt-1.5 h-2 w-2 rounded-full bg-blue-600" />
                <div className="space-x-1">
                  <span className="text-sm font-semibold text-gray-700">{activity.status}:</span>
                  <span className="text-sm text-gray-500">{activity.title}</span>
                  <p className="text-xs text-gray-500">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
