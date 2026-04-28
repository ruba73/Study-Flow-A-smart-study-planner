import { Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardTaskItem } from "@/lib/dashboard";

const priorityColors: Record<DashboardTaskItem["priority"], string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-green-100 text-green-700",
};

interface TodaysTasksProps {
  tasks: DashboardTaskItem[];
}

export function TodaysTasks({ tasks }: TodaysTasksProps) {
  const preview = tasks.slice(0, 4);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Today&apos;s Tasks</CardTitle>
          <span className="text-sm text-gray-500">{tasks.length} total</span>
        </div>
      </CardHeader>

      <CardContent>
        {preview.length === 0 ? (
          <div className="py-8 text-center">
            <p className="mb-2 text-2xl">✅</p>
            <p className="text-sm text-gray-500">No tasks scheduled for today.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {preview.map((task) => (
              <div
                key={task.id}
                className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3"
              >
                <input
                  type="checkbox"
                  checked={task.completed}
                  readOnly
                  className="mt-1 h-4 w-4 cursor-default rounded border-gray-300 text-blue-600"
                />
                <div className="min-w-0 flex-1">
                  <h4
                    className={`text-sm font-medium ${
                      task.completed ? "text-gray-400 line-through" : "text-gray-900"
                    }`}
                  >
                    {task.title}
                  </h4>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${priorityColors[task.priority]}`}
                    >
                      {task.priority}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="h-3 w-3" /> {task.time}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {tasks.length > preview.length && (
              <p className="pt-1 text-sm text-gray-500">
                {tasks.length - preview.length} more task{tasks.length - preview.length === 1 ? "" : "s"} due today
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
