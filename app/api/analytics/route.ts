import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

function startOfDay(date = new Date()) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfWeek(date = new Date()) {
  const next = startOfDay(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  return next;
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const weekStart = startOfWeek();
  const currentDayStart = startOfDay();
  const sixWeeksAgo = new Date(weekStart);
  sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 35);
  const sixDaysAgo = new Date(currentDayStart);
  sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);

  const [user, progressRows, sessionRows, goalRows, taskRows] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { stats: true },
    }),
    prisma.progress.findMany({
      where: { userId, date: { gte: sixWeeksAgo } },
      orderBy: { date: "asc" },
      select: {
        date: true,
        week: true,
        year: true,
        timeStudied: true,
        plannedTime: true,
      },
    }),
    prisma.studySession.findMany({
      where: { userId },
      select: {
        type: true,
        plannedDuration: true,
        status: true,
      },
    }),
    prisma.goal.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        progress: true,
        status: true,
      },
    }),
    prisma.task.findMany({
      where: { userId },
      select: {
        goalId: true,
        type: true,
        estimatedDuration: true,
        completed: true,
        completedAt: true,
        scheduledDate: true,
      },
    }),
  ]);

  const stats = (user?.stats ?? {
    currentStreak: 0,
    completedGoals: 0,
    totalGoals: 0,
    totalStudyTime: 0,
  }) as {
    currentStreak: number;
    completedGoals: number;
    totalGoals: number;
    totalStudyTime: number;
  };

  const weeklyStudyMap = new Map<string, { actual: number; target: number }>();
  for (const row of progressRows) {
    const key = `${row.year}-W${row.week}`;
    const current = weeklyStudyMap.get(key) ?? { actual: 0, target: 0 };
    current.actual += Math.round((row.timeStudied / 60) * 10) / 10;
    current.target += Math.round((row.plannedTime / 60) * 10) / 10;
    weeklyStudyMap.set(key, current);
  }

  const weeklyStudy = Array.from(weeklyStudyMap.values())
    .slice(-6)
    .map((value, index) => ({
      week: `Week ${index + 1}`,
      actual: value.actual,
      target: value.target,
    }));

  const dailyConsistency = Array.from({ length: 7 }).map((_, index) => {
    const day = new Date(sixDaysAgo);
    day.setDate(sixDaysAgo.getDate() + index);
    const dayKey = day.toISOString().split("T")[0];
    const matchingRows = progressRows.filter((row) => row.date.toISOString().split("T")[0] === dayKey);
    const taskMinutes = taskRows
      .filter((task) => task.completed && task.completedAt?.toISOString().split("T")[0] === dayKey)
      .reduce((sum, task) => sum + task.estimatedDuration, 0);
    const progressMinutes = matchingRows.reduce((sum, row) => sum + row.timeStudied, 0);
    const hours = Math.max(taskMinutes, progressMinutes) / 60;
    return {
      day: day.toLocaleDateString("en-US", { weekday: "short" }),
      hours: Math.round(hours * 10) / 10,
    };
  });

  const sessionTypeMap = new Map<string, number>();
  for (const task of taskRows.filter((item) => item.completed)) {
    const key = task.type.charAt(0).toUpperCase() + task.type.slice(1);
    sessionTypeMap.set(key, (sessionTypeMap.get(key) ?? 0) + 1);
  }
  if (sessionTypeMap.size === 0) {
    for (const session of sessionRows) {
      const key = session.type.charAt(0).toUpperCase() + session.type.slice(1);
      sessionTypeMap.set(key, (sessionTypeMap.get(key) ?? 0) + 1);
    }
  }

  const sessionColors = ["#3B82F6", "#8B5CF6", "#10B981", "#F97316"];
  const sessionType = Array.from(sessionTypeMap.entries()).map(([name, value], index) => ({
    name,
    value,
    color: sessionColors[index % sessionColors.length],
  }));

  const courseColors = ["#3B82F6", "#16A34A", "#7C3AED", "#F97316", "#DC2626", "#4F46E5"];
  const timeByCourse = goalRows.map((goal, index) => ({
    name: goal.title,
    value: Math.max(
      0,
      Math.round(
        taskRows
          .filter((task) => task.goalId === goal.id && task.completed)
          .reduce((sum, task) => sum + task.estimatedDuration, 0) / 60
      )
    ),
    color: courseColors[index % courseColors.length],
  }));

  const progressClasses = ["bg-blue-500", "bg-green-600", "bg-purple-600", "bg-orange-500", "bg-red-600", "bg-indigo-600"];
  const courseProgress = goalRows.map((goal, index) => {
    const goalTasks = taskRows.filter((task) => task.goalId === goal.id);
    const completedTasks = goalTasks.filter((task) => task.completed);
    const studiedHours = completedTasks.reduce((sum, task) => sum + task.estimatedDuration, 0) / 60;
    const progress = goalTasks.length > 0 ? Math.round((completedTasks.length / goalTasks.length) * 100) : goal.progress;

    return {
      name: goal.title,
      studied: `${Math.round(studiedHours)}h studied`,
      pct: progress,
      color: progressClasses[index % progressClasses.length],
    };
  });

  const avgHoursPerDay =
    dailyConsistency.length > 0
      ? (
          dailyConsistency.reduce((sum, item) => sum + item.hours, 0) / dailyConsistency.length
        ).toFixed(1)
      : "0.0";

  const sessionsCompleted = taskRows.filter((task) => task.completed).length;
  const completedGoals = courseProgress.filter((goal) => goal.pct >= 100).length;

  return NextResponse.json({
    kpis: [
      { label: "Study Streak", value: `${stats.currentStreak} days`, icon: "Flame", iconBg: "bg-orange-50", iconColor: "text-orange-600" },
      { label: "Avg. Hours/Day", value: `${avgHoursPerDay}h`, icon: "Clock", iconBg: "bg-blue-50", iconColor: "text-blue-600" },
      { label: "Sessions Completed", value: String(sessionsCompleted), icon: "Target", iconBg: "bg-green-50", iconColor: "text-green-600" },
      { label: "Goals Achieved", value: `${completedGoals}/${goalRows.length || stats.totalGoals}`, icon: "Award", iconBg: "bg-purple-50", iconColor: "text-purple-600" },
    ],
    weeklyStudy,
    dailyConsistency,
    sessionType,
    timeByCourse,
    courseProgress,
  });
}
