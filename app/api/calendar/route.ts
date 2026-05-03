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

function formatLocalDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatLocalTime(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
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
        completed: false,
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
        sessionId: true,
      },
    }),
    prisma.studySession.findMany({
      where: { userId, status: { not: "completed" } },
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
    ...tasks.filter((task) => !task.sessionId).map((task) => {
      const date = (task.scheduledDate ?? task.dueDate)!;
      const type: CalendarEventType =
        task.type === "quiz" ? "exam" : task.dueDate && !task.scheduledDate ? "deadline" : "task";
      return {
        id: `task-${task.id}`,
        title: task.title,
        date: formatLocalDate(date),
        time: task.scheduledTime || formatLocalTime(date) || "09:00",
        type,
        subject: task.type,
        color: colorForType(type, task.difficulty),
      };
    }),
    ...sessions.map((session) => ({
      id: `session-${session.id}`,
      title: session.title,
      date: formatLocalDate(session.plannedStartTime),
      time: formatLocalTime(session.plannedStartTime),
      duration: formatMinutesAsHours(session.plannedDuration),
      type: "session" as const,
      subject: session.type,
      color: colorForType("session"),
    })),
    ...goals.map((goal) => ({
      id: `goal-${goal.id}`,
      title: goal.title,
      date: formatLocalDate(goal.targetDate),
      time: "23:59",
      type: "deadline" as const,
      subject: "Goal",
      color: colorForType("deadline"),
    })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  return NextResponse.json({ events });
}
