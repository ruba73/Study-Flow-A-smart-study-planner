import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

type CalendarEventType = "session" | "task" | "exam" | "deadline";

function colorForType(type: CalendarEventType, difficulty?: number) {
  if (type === "deadline") return "orange";
  if (type === "exam") return "purple";
  if (type === "task") return difficulty && difficulty >= 4 ? "red" : "blue";
  if ((difficulty ?? 0) >= 4) return "red";
  if ((difficulty ?? 0) <= 2) return "green";
  return "blue";
}

function formatMinutesAsHours(minutes: number) {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(remainingMinutes).padStart(2, "0")}`;
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const [tasks, sessions, goals] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId,
        OR: [{ dueDate: { not: null } }, { scheduledDate: { not: null } }],
      },
      select: {
        id: true,
        title: true,
        type: true,
        difficulty: true,
        dueDate: true,
        scheduledDate: true,
        scheduledTime: true,
      },
    }),
    prisma.studySession.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        type: true,
        plannedStartTime: true,
        plannedDuration: true,
      },
    }),
    prisma.goal.findMany({
      where: { userId, status: { not: "completed" } },
      select: {
        id: true,
        title: true,
        targetDate: true,
      },
    }),
  ]);

  const events = [
    ...tasks.map((task) => {
      const date = (task.scheduledDate ?? task.dueDate)!;
      const type: CalendarEventType =
        task.type === "quiz" ? "exam" : task.dueDate && !task.scheduledDate ? "deadline" : "task";
      return {
        id: `task-${task.id}`,
        title: task.title,
        date: date.toISOString().split("T")[0],
        time: task.scheduledTime || date.toISOString().slice(11, 16) || "09:00",
        type,
        subject: task.type,
        color: colorForType(type, task.difficulty),
      };
    }),
    ...sessions.map((session) => ({
      id: `session-${session.id}`,
      title: session.title,
      date: session.plannedStartTime.toISOString().split("T")[0],
      time: session.plannedStartTime.toISOString().slice(11, 16),
      duration: formatMinutesAsHours(session.plannedDuration),
      type: "session" as const,
      subject: session.type,
      color: colorForType("session"),
    })),
    ...goals.map((goal) => ({
      id: `goal-${goal.id}`,
      title: goal.title,
      date: goal.targetDate.toISOString().split("T")[0],
      time: "23:59",
      type: "deadline" as const,
      subject: "Goal",
      color: colorForType("deadline"),
    })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  return NextResponse.json({ events });
}
