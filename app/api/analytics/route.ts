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

function dateKey(date: Date) {
  const day = startOfDay(date);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function calculateTaskStreak(
  tasks: Array<{ completed: boolean; completedAt: Date | null; scheduledDate: Date | null }>,
  progressRows: Array<{ date: Date; timeStudied: number }>
) {
  const plannedByDay = new Map<string, { planned: number; completed: number }>();
  const completedWorkDays = new Set<string>();

  for (const task of tasks) {
    if (task.scheduledDate) {
      const key = dateKey(task.scheduledDate);
      const current = plannedByDay.get(key) ?? { planned: 0, completed: 0 };
      current.planned += 1;
      if (task.completed) current.completed += 1;
      plannedByDay.set(key, current);
    }

    if (task.completedAt) {
      completedWorkDays.add(dateKey(task.completedAt));
    }
  }

  for (const row of progressRows) {
    if (row.timeStudied > 0) {
      completedWorkDays.add(dateKey(row.date));
    }
  }

  function isStreakDay(day: Date) {
    const key = dateKey(day);
    const planned = plannedByDay.get(key);
    if (planned && planned.planned > 0) {
      return planned.completed >= planned.planned;
    }
    return completedWorkDays.has(key);
  }

  const today = startOfDay();
  let cursor = isStreakDay(today) ? today : addDays(today, -1);
  let streak = 0;

  while (isStreakDay(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
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

  const [user, progressRows, sessionRows, goalRows, taskRows, archivedCourseRows] = await Promise.all([
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
        actualHoursSpent: true,
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
    prisma.activityLog.findMany({
      where: { userId, type: "course_analytics_snapshot" },
      orderBy: { createdAt: "asc" },
      select: { metadata: true },
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
    const dayKey = dateKey(day);
    const matchingRows = progressRows.filter((row) => dateKey(row.date) === dayKey);
    const taskMinutes = taskRows
      .filter((task) => task.completed && task.completedAt && dateKey(task.completedAt) === dayKey)
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
  const archivedCourses = archivedCourseRows.map((row) => {
    const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};

    return {
      id: typeof metadata.goalId === "string" ? metadata.goalId : `archived-${String(metadata.title ?? "Course")}`,
      title: typeof metadata.title === "string" ? metadata.title : "Deleted subject",
      studiedHours: typeof metadata.studiedHours === "number" ? metadata.studiedHours : 0,
      progress: typeof metadata.progress === "number" ? metadata.progress : 0,
    };
  });

  const courseTimeMap = new Map<string, { name: string; value: number; progress: number }>();
  for (const goal of goalRows) {
    const completedHours = taskRows
      .filter((task) => task.goalId === goal.id && task.completed)
      .reduce((sum, task) => sum + task.estimatedDuration, 0) / 60;
    courseTimeMap.set(goal.id, {
      name: goal.title,
      value: Math.max(completedHours, goal.actualHoursSpent),
      progress: goal.progress,
    });
  }
  for (const archived of archivedCourses) {
    if (courseTimeMap.has(archived.id)) continue;
    courseTimeMap.set(archived.id, {
      name: archived.title,
      value: archived.studiedHours,
      progress: archived.progress,
    });
  }

  const courseEntries = Array.from(courseTimeMap.values());
  const timeByCourse = courseEntries.map((course, index) => ({
    name: course.name,
    value: Math.max(0, Math.round(course.value)),
    color: courseColors[index % courseColors.length],
  }));

  const progressClasses = ["bg-blue-500", "bg-green-600", "bg-purple-600", "bg-orange-500", "bg-red-600", "bg-indigo-600"];
  const courseProgress = courseEntries.map((course, index) => {
    const goal = goalRows.find((item) => item.title === course.name);
    if (!goal) {
      return {
        name: course.name,
        studied: `${Math.round(course.value)}h studied`,
        pct: course.progress,
        color: progressClasses[index % progressClasses.length],
      };
    }

    const goalTasks = taskRows.filter((task) => task.goalId === goal.id);
    const completedTasks = goalTasks.filter((task) => task.completed);
    const studiedHours = Math.max(
      completedTasks.reduce((sum, task) => sum + task.estimatedDuration, 0) / 60,
      goal.actualHoursSpent
    );
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
  const currentStreak = calculateTaskStreak(taskRows, progressRows);

  return NextResponse.json({
    kpis: [
      { label: "Study Streak", value: `${currentStreak} days`, icon: "Flame", iconBg: "bg-orange-50", iconColor: "text-orange-600" },
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
