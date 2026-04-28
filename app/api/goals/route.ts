import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const goals = await prisma.goal.findMany({
    where: { userId, status: { not: "completed" } },
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
    select: { id: true },
  });

  if (!existingGoal) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.task.deleteMany({ where: { goalId: id, userId } }),
    prisma.studySession.deleteMany({ where: { goalId: id, userId } }),
    prisma.studyPlan.deleteMany({ where: { goalId: id, userId } }),
    prisma.progress.deleteMany({ where: { goalId: id, userId } }),
    prisma.flashcard.deleteMany({ where: { goalId: id, userId } }),
    prisma.material.deleteMany({ where: { goalId: id, userId } }),
    prisma.notification.deleteMany({ where: { relatedEntityId: id, relatedEntityType: "Goal", userId } }),
    prisma.activityLog.deleteMany({ where: { relatedEntityId: id, relatedEntityType: "Goal", userId } }),
    prisma.goal.deleteMany({ where: { id, userId } }),
  ]);

  return NextResponse.json({ ok: true });
}
