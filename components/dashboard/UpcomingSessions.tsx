import { Calendar, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardSessionItem } from "@/lib/dashboard";

const difficultyStyles: Record<DashboardSessionItem["difficulty"], string> = {
  easy: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  hard: "bg-red-100 text-red-800",
};

interface UpcomingSessionsProps {
  sessions: DashboardSessionItem[];
}

export function UpcomingSessions({ sessions }: UpcomingSessionsProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Upcoming Study Sessions</CardTitle>
        <span className="text-sm text-gray-500">{sessions.length} scheduled</span>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <div className="py-12 text-center">
            <Calendar className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm font-medium text-gray-500">No upcoming sessions yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-4 transition-colors hover:bg-gray-100"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
                  <Calendar className="h-5 w-5 text-white" />
                </div>
                <div className="mx-4 min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-gray-900">{session.subject}</h3>
                  <p className="truncate text-xs text-gray-600">{session.topic}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="h-3 w-3" />
                    {session.time}
                  </p>
                </div>
                <div className="flex flex-shrink-0 flex-col items-end gap-1">
                  <span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                    {session.duration}
                  </span>
                  <span
                    className={`rounded-lg px-2 py-1 text-xs font-medium capitalize ${difficultyStyles[session.difficulty]}`}
                  >
                    {session.difficulty}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
