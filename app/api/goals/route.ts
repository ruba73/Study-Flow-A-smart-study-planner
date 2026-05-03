import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const goals = await prisma.goal.findMany({
    where: { userId, type: "academic-course", status: { not: "completed" } },
    orderBy: [{ status: "asc" }, { targetDate: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      priority: true,
      difficulty: true,
      progress: true,
      targetDate: true,
      estimatedTotalHours: true,
      topics: true,
      status: true,
    },
  });

  return NextResponse.json({ goals });
}

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    title?: string;
    description?: string;
    priority?: "low" | "medium" | "high";
    estimatedTotalHours?: number;
    targetDate?: string;
  };

  if (!body.title?.trim() || !body.targetDate) {
    return NextResponse.json({ message: "Title and deadline are required" }, { status: 400 });
  }

  const goal = await prisma.goal.create({
    data: {
      userId,
      title: body.title.trim(),
      description: body.description?.trim() || null,
      type: "academic-course",
      targetDate: new Date(body.targetDate),
      priority: body.priority ?? "medium",
      difficulty: body.priority === "high" ? 4 : body.priority === "low" ? 2 : 3,
      status: "not-started",
      progress: 0,
      topics: [],
      resources: [],
      prerequisites: [],
      estimatedTotalHours: body.estimatedTotalHours ?? 10,
      actualHoursSpent: 0,
      isShared: false,
    },
    select: {
      id: true,
      title: true,
      priority: true,
      difficulty: true,
      progress: true,
      targetDate: true,
      estimatedTotalHours: true,
      topics: true,
      status: true,
    },
  });

  return NextResponse.json({ goal }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    id?: string;
    title?: string;
    description?: string;
    priority?: "low" | "medium" | "high";
    estimatedTotalHours?: number;
    targetDate?: string;
  };

  if (!body.id || !body.title?.trim() || !body.targetDate) {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }

  const goal = await prisma.goal.updateMany({
    where: { id: body.id, userId },
    data: {
      title: body.title.trim(),
      description: body.description?.trim() || null,
      targetDate: new Date(body.targetDate),
      priority: body.priority ?? "medium",
      difficulty: body.priority === "high" ? 4 : body.priority === "low" ? 2 : 3,
      estimatedTotalHours: body.estimatedTotalHours ?? 10,
    },
  });

  return NextResponse.json({ ok: goal.count > 0 });
}

export async function DELETE(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ message: "Goal id is required" }, { status: 400 });
  }

  const existingGoal = await prisma.goal.findFirst({
    where: { id, userId },
    select: {
      id: true,
      title: true,
      progress: true,
      actualHoursSpent: true,
      estimatedTotalHours: true,
      status: true,
      priority: true,
      targetDate: true,
      createdAt: true,
    },
  });

  if (!existingGoal) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const [
    taskRows,
    sessionRows,
    materialCount,
    progressRows,
  ] = await Promise.all([
    prisma.task.findMany({
      where: { goalId: id, userId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        title: true,
        type: true,
        estimatedDuration: true,
        completed: true,
        completedAt: true,
        scheduledDate: true,
        dueDate: true,
        timeSpent: true,
        isReview: true,
      },
    }),
    prisma.studySession.findMany({
      where: { goalId: id, userId },
      orderBy: { plannedStartTime: "asc" },
      select: {
        title: true,
        type: true,
        plannedStartTime: true,
        plannedDuration: true,
        actualDuration: true,
        status: true,
      },
    }),
    prisma.material.count({ where: { goalId: id, userId } }),
    prisma.progress.findMany({
      where: { goalId: id, userId },
      orderBy: { date: "asc" },
      select: {
        date: true,
        week: true,
        month: true,
        year: true,
        plannedTime: true,
        actualTime: true,
        timeStudied: true,
        tasksPlanned: true,
        tasksCompleted: true,
        completionRate: true,
      },
    }),
  ]);

  const totalTasks = taskRows.length;
  const completedTasks = taskRows.filter((task) => task.completed).length;
  const completedTaskMinutes = taskRows
    .filter((task) => task.completed)
    .reduce((sum, task) => sum + task.estimatedDuration, 0);
  const totalSessions = sessionRows.length;
  const completedSessions = sessionRows.filter((session) => session.status === "completed").length;
  const completedSessionMinutes = sessionRows
    .filter((session) => session.status === "completed")
    .reduce((sum, session) => sum + Math.max(session.actualDuration, session.plannedDuration), 0);
  const taskTypeBreakdown = taskRows.reduce<Record<string, { total: number; completed: number; minutes: number }>>(
    (result, task) => {
      const current = result[task.type] ?? { total: 0, completed: 0, minutes: 0 };
      current.total += 1;
      if (task.completed) {
        current.completed += 1;
        current.minutes += task.estimatedDuration;
      }
      result[task.type] = current;
      return result;
    },
    {}
  );

  const studiedHours = Math.max(
    existingGoal.actualHoursSpent,
    completedTaskMinutes / 60,
    completedSessionMinutes / 60
  );
  const deletedAt = new Date();

  await prisma.$transaction([
    prisma.activityLog.create({
      data: {
        userId,
        type: "course_analytics_snapshot",
        description: `Saved analytics history for ${existingGoal.title}`,
        relatedEntityId: id,
        relatedEntityType: "AnalyticsSnapshot",
        metadata: {
          goalId: id,
          title: existingGoal.title,
          studiedHours,
          progress: existingGoal.progress,
          estimatedTotalHours: existingGoal.estimatedTotalHours,
          status: existingGoal.status,
          priority: existingGoal.priority,
          targetDate: existingGoal.targetDate.toISOString(),
          createdAt: existingGoal.createdAt.toISOString(),
          deletedAt: deletedAt.toISOString(),
          totalTasks,
          completedTasks,
          incompleteTasks: totalTasks - completedTasks,
          completedTaskMinutes,
          totalSessions,
          completedSessions,
          completedSessionMinutes,
          materialCount,
          taskTypeBreakdown,
          taskHistory: taskRows.map((task) => ({
            title: task.title,
            type: task.type,
            estimatedDuration: task.estimatedDuration,
            completed: task.completed,
            completedAt: task.completedAt?.toISOString() ?? null,
            scheduledDate: task.scheduledDate?.toISOString() ?? null,
            dueDate: task.dueDate?.toISOString() ?? null,
            timeSpent: task.timeSpent,
            isReview: task.isReview,
          })),
          sessionHistory: sessionRows.map((session) => ({
            title: session.title,
            type: session.type,
            plannedStartTime: session.plannedStartTime.toISOString(),
            plannedDuration: session.plannedDuration,
            actualDuration: session.actualDuration,
            status: session.status,
          })),
          progressHistory: progressRows.map((row) => ({
            date: row.date.toISOString(),
            week: row.week,
            month: row.month,
            year: row.year,
            plannedTime: row.plannedTime,
            actualTime: row.actualTime,
            timeStudied: row.timeStudied,
            tasksPlanned: row.tasksPlanned,
            tasksCompleted: row.tasksCompleted,
            completionRate: row.completionRate,
          })),
        },
      },
    }),
    prisma.task.deleteMany({ where: { goalId: id, userId } }),
    prisma.studySession.deleteMany({ where: { goalId: id, userId } }),
    prisma.studyPlan.deleteMany({ where: { goalId: id, userId } }),
    prisma.progress.deleteMany({ where: { goalId: id, userId } }),
    prisma.flashcard.deleteMany({ where: { goalId: id, userId } }),
    prisma.material.deleteMany({ where: { goalId: id, userId } }),
    prisma.notification.deleteMany({ where: { relatedEntityId: id, relatedEntityType: "Goal", userId } }),
    prisma.goal.deleteMany({ where: { id, userId } }),
  ]);

  return NextResponse.json({ ok: true });
}
