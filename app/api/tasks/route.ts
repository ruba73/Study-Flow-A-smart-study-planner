import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

function startOfDay(date = new Date()) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function getWeekNumber(date: Date) {
  const current = startOfDay(date);
  current.setDate(current.getDate() + 3 - ((current.getDay() + 6) % 7));
  const week1 = new Date(current.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(((current.getTime() - week1.getTime()) / 86_400_000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  );
}

async function syncGoalProgress(userId: string, goalId: string) {
  const [totalTasks, completedTasks, completedDuration] = await Promise.all([
    prisma.task.count({ where: { userId, goalId } }),
    prisma.task.count({ where: { userId, goalId, completed: true } }),
    prisma.task.aggregate({
      where: { userId, goalId, completed: true },
      _sum: { estimatedDuration: true },
    }),
  ]);

  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const actualHoursSpent = Math.round(((completedDuration._sum.estimatedDuration ?? 0) / 60) * 10) / 10;

  await prisma.goal.updateMany({
    where: { id: goalId, userId },
    data: {
      progress,
      actualHoursSpent,
      status: progress >= 100 ? "completed" : progress > 0 ? "in-progress" : "not-started",
    },
  });
}

async function completeGoalIfAllTasksDone(userId: string, goalId: string) {
  const [goal, totalTasks, incompleteTasks] = await Promise.all([
    prisma.goal.findFirst({
      where: { id: goalId, userId },
      select: { id: true },
    }),
    prisma.task.count({ where: { userId, goalId } }),
    prisma.task.count({ where: { userId, goalId, completed: false } }),
  ]);

  if (!goal || totalTasks === 0 || incompleteTasks > 0) {
    return false;
  }

  await prisma.goal.updateMany({
    where: { id: goalId, userId },
    data: {
      status: "completed",
      progress: 100,
    },
  });

  return true;
}

async function syncSessionStatus(userId: string, sessionId: string | null) {
  if (!sessionId) return;

  const [totalTasks, completedTasks] = await Promise.all([
    prisma.task.count({ where: { userId, sessionId } }),
    prisma.task.count({ where: { userId, sessionId, completed: true } }),
  ]);

  await prisma.studySession.updateMany({
    where: { id: sessionId, userId },
    data: {
      status: totalTasks > 0 && completedTasks === totalTasks ? "completed" : completedTasks > 0 ? "in-progress" : "scheduled",
    },
  });
}

async function syncDailyProgress(userId: string, date = new Date()) {
  const day = startOfDay(date);
  const nextDay = new Date(day);
  nextDay.setDate(nextDay.getDate() + 1);

  const [planned, completed, timeStudied] = await Promise.all([
    prisma.task.count({ where: { userId, scheduledDate: { gte: day, lt: nextDay } } }),
    prisma.task.count({ where: { userId, completed: true, completedAt: { gte: day, lt: nextDay } } }),
    prisma.task.aggregate({
      where: { userId, completed: true, completedAt: { gte: day, lt: nextDay } },
      _sum: { estimatedDuration: true },
    }),
  ]);

  const skipped = Math.max(0, planned - completed);
  const week = getWeekNumber(day);
  const month = day.getMonth() + 1;
  const year = day.getFullYear();
  const studiedMinutes = timeStudied._sum.estimatedDuration ?? 0;

  const existingProgress = await prisma.progress.findFirst({
    where: { userId, date: day },
    select: { id: true },
  });

  const progressData = {
    week,
    month,
    year,
    plannedTime: planned * 60,
    actualTime: studiedMinutes,
    timeStudied: studiedMinutes,
    tasksPlanned: planned,
    tasksCompleted: completed,
    tasksSkipped: skipped,
    completionRate: planned > 0 ? Math.round((completed / planned) * 100) : 0,
    status: completed >= planned && planned > 0 ? "on-track" : "behind",
  };

  if (existingProgress) {
    await prisma.progress.update({
      where: { id: existingProgress.id },
      data: progressData,
    });
    return;
  }

  await prisma.progress.create({
    data: {
      userId,
      date: day,
      ...progressData,
      topicMastery: {},
      currentStreak: 0,
      burnoutScore: 0,
    },
  });
}

async function syncUserStats(userId: string) {
  const [completedGoals, totalGoals, totalStudyTime] = await Promise.all([
    prisma.goal.count({ where: { userId, status: "completed" } }),
    prisma.goal.count({ where: { userId } }),
    prisma.task.aggregate({
      where: { userId, completed: true },
      _sum: { estimatedDuration: true },
    }),
  ]);

  await prisma.user.update({
    where: { id: userId },
    data: {
      stats: {
        currentStreak: 0,
        completedGoals,
        totalGoals,
        totalStudyTime: totalStudyTime._sum.estimatedDuration ?? 0,
      },
    },
  });
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const tasks = await prisma.task.findMany({
    where: { userId },
    orderBy: [{ completed: "asc" }, { dueDate: "asc" }, { scheduledDate: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      difficulty: true,
      type: true,
      dueDate: true,
      scheduledDate: true,
      scheduledTime: true,
      completed: true,
    },
  });

  return NextResponse.json({ tasks });
}

export async function PATCH(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { id?: string; completed?: boolean };
  if (!body.id || typeof body.completed !== "boolean") {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }

  const existingTask = await prisma.task.findFirst({
    where: { id: body.id, userId },
    select: {
      id: true,
      goalId: true,
      sessionId: true,
      completedAt: true,
    },
  });

  if (!existingTask) {
    return NextResponse.json({ message: "Task not found" }, { status: 404 });
  }

  const previousCompletionDate = existingTask.completedAt;
  const completionDate = new Date();

  await prisma.task.update({
    where: { id: existingTask.id },
    data: {
      completed: body.completed,
      status: body.completed ? "done" : "not-started",
      completedAt: body.completed ? completionDate : null,
    },
  });

  await syncGoalProgress(userId, existingTask.goalId);
  await syncSessionStatus(userId, existingTask.sessionId);
  const completedGoal = body.completed ? await completeGoalIfAllTasksDone(userId, existingTask.goalId) : false;

  await Promise.all([
    syncDailyProgress(userId, completionDate),
    previousCompletionDate ? syncDailyProgress(userId, previousCompletionDate) : Promise.resolve(),
    syncUserStats(userId),
  ]);

  return NextResponse.json({ ok: true, completedGoal });
}
