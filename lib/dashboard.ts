import prisma from "@/lib/prisma";
import { Progress } from "@/models/Progress";

export interface DashboardTaskItem {
  id: string;
  title: string;
  priority: "high" | "medium" | "low";
  time: string;
  completed: boolean;
}

export interface DashboardDeadlineItem {
  id: string;
  title: string;
  daysLeft: number;
  color: string;
}

export interface DashboardActivityItem {
  id: string;
  status: string;
  title: string;
  time: string;
}

export interface DashboardSessionItem {
  id: string;
  subject: string;
  topic: string;
  time: string;
  duration: string;
  difficulty: "easy" | "medium" | "hard";
}

export interface DashboardData {
  welcome: {
    userName: string;
    currentStreak: number;
    tasksRemaining: number;
  };
  stats: {
    activeGoals: number;
    studyHoursWeek: number;
    completionRate: number;
    goalsAchieved: number;
  };
  tasks: DashboardTaskItem[];
  progress: {
    daily: {
      percentage: number;
      completed: number;
      total: number;
    };
    weekly: {
      percentage: number;
      completed: number;
      total: number;
    };
    upcomingDeadlines: DashboardDeadlineItem[];
  };
  activities: DashboardActivityItem[];
  sessions: DashboardSessionItem[];
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function startOfDay(date = new Date()) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date = new Date()) {
  const next = startOfDay(date);
  next.setDate(next.getDate() + 1);
  return next;
}

function startOfWeek(date = new Date()) {
  const next = startOfDay(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  return next;
}

function endOfWeek(date = new Date()) {
  const next = startOfWeek(date);
  next.setDate(next.getDate() + 7);
  return next;
}

function formatTimeLabel(date?: Date | null, fallback?: string | null) {
  if (date) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return fallback?.trim() || "Any time";
}

function formatRelativeTime(date: Date) {
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));

  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function toTaskPriority(difficulty?: number | null) {
  if ((difficulty ?? 0) >= 4) return "high";
  if ((difficulty ?? 0) <= 2) return "low";
  return "medium";
}

function toSessionDifficulty(value: number) {
  if (value <= 2) return "easy";
  if (value >= 4) return "hard";
  return "medium";
}

function toDeadlineColor(daysLeft: number) {
  if (daysLeft <= 2) return "text-red-600";
  if (daysLeft <= 7) return "text-yellow-600";
  return "text-green-600";
}

function humanizeActivityType(type: string) {
  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function roundHours(minutes: number) {
  return Math.round((minutes / 60) * 10) / 10;
}

function formatMinutesAsHours(minutes: number) {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(remainingMinutes).padStart(2, "0")}`;
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const todayStart = startOfDay();
  const tomorrowStart = endOfDay(todayStart);
  const weekStart = startOfWeek();
  const weekEnd = endOfWeek();

  const [
    user,
    latestProgress,
    activeGoals,
    goalsAchieved,
    progressRows,
    todayTasks,
    upcomingGoals,
    activityRows,
    sessionRows,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    }),
    prisma.progress.findFirst({
      where: { userId },
      orderBy: { date: "desc" },
      select: { currentStreak: true },
    }),
    prisma.goal.count({
      where: { userId, status: { in: ["not-started", "in-progress", "paused"] } },
    }),
    prisma.goal.count({
      where: { userId, status: "completed" },
    }),
    prisma.progress.findMany({
      where: {
        userId,
        date: {
          gte: weekStart,
          lt: weekEnd,
        },
      },
      select: {
        date: true,
        plannedTime: true,
        timeStudied: true,
        tasksPlanned: true,
        tasksCompleted: true,
        completionRate: true,
      },
    }),
    prisma.task.findMany({
      where: {
        userId,
        OR: [
          { scheduledDate: { gte: todayStart, lt: tomorrowStart } },
          { dueDate: { gte: todayStart, lt: tomorrowStart } },
        ],
      },
      orderBy: [{ completed: "asc" }, { scheduledDate: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }],
      take: 12,
      select: {
        id: true,
        title: true,
        completed: true,
        dueDate: true,
        scheduledDate: true,
        scheduledTime: true,
        difficulty: true,
      },
    }),
    prisma.goal.findMany({
      where: {
        userId,
        status: { not: "completed" },
        targetDate: { gte: todayStart },
      },
      orderBy: { targetDate: "asc" },
      take: 3,
      select: {
        id: true,
        title: true,
        priority: true,
        targetDate: true,
      },
    }),
    prisma.activityLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        type: true,
        description: true,
        createdAt: true,
      },
    }),
    prisma.studySession.findMany({
      where: {
        userId,
        status: { in: ["scheduled", "active", "paused"] },
        plannedStartTime: { gte: new Date() },
      },
      orderBy: { plannedStartTime: "asc" },
      take: 4,
      select: {
        id: true,
        title: true,
        type: true,
        plannedStartTime: true,
        plannedDuration: true,
      },
    }),
  ]);

  const streak = latestProgress?.currentStreak ?? (await Progress.calculateStreak(userId));
  const tasksRemaining = todayTasks.filter((task) => !task.completed).length;
  const weeklyMinutes = progressRows.reduce((sum, row) => sum + row.timeStudied, 0);
  const weeklyPlannedMinutes = progressRows.reduce((sum, row) => sum + row.plannedTime, 0);
  const weeklyTasksPlanned = progressRows.reduce((sum, row) => sum + row.tasksPlanned, 0);
  const weeklyTasksCompleted = progressRows.reduce((sum, row) => sum + row.tasksCompleted, 0);
  const dailyTasksCompleted = todayTasks.filter((task) => task.completed).length;
  const dailyTotalTasks = todayTasks.length;
  const rawWeeklyCompletionRate =
    weeklyTasksPlanned > 0 ? Math.round((weeklyTasksCompleted / weeklyTasksPlanned) * 100) : 0;
  const weeklyCompletionRate = Math.min(100, rawWeeklyCompletionRate);
  const weeklyCompletedHours = Math.round(weeklyMinutes / 60);
  const weeklyTargetHours = Math.max(Math.round(weeklyPlannedMinutes / 60), weeklyCompletedHours);

  return {
    welcome: {
      userName: user?.name || "there",
      currentStreak: streak,
      tasksRemaining,
    },
    stats: {
      activeGoals,
      studyHoursWeek: roundHours(weeklyMinutes),
      completionRate: weeklyCompletionRate,
      goalsAchieved,
    },
    tasks: todayTasks.map((task) => ({
      id: task.id,
      title: task.title,
      priority: toTaskPriority(task.difficulty),
      time: formatTimeLabel(task.scheduledDate ?? task.dueDate, task.scheduledTime),
      completed: task.completed,
    })),
    progress: {
      daily: {
        percentage: dailyTotalTasks > 0 ? Math.round((dailyTasksCompleted / dailyTotalTasks) * 100) : 0,
        completed: dailyTasksCompleted,
        total: dailyTotalTasks,
      },
      weekly: {
        percentage: weeklyCompletionRate,
        completed: weeklyCompletedHours,
        total: weeklyTargetHours,
      },
      upcomingDeadlines: upcomingGoals.map((goal) => {
        const daysLeft = Math.max(0, Math.ceil((goal.targetDate.getTime() - todayStart.getTime()) / DAY_IN_MS));
        return {
          id: goal.id,
          title: goal.title,
          daysLeft,
          color: toDeadlineColor(daysLeft),
        };
      }),
    },
    activities: activityRows.map((activity) => ({
      id: activity.id,
      status: humanizeActivityType(activity.type),
      title: activity.description,
      time: formatRelativeTime(activity.createdAt),
    })),
    sessions: sessionRows.map((session) => ({
      id: session.id,
      subject: session.title,
      topic: humanizeActivityType(session.type),
      time: session.plannedStartTime.toLocaleString("en-US", {
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
      }),
      duration: formatMinutesAsHours(session.plannedDuration),
      difficulty: toSessionDifficulty(Math.min(5, Math.max(1, Math.round(session.plannedDuration / 45)))),
    })),
  };
}
