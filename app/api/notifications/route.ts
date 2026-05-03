import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { sendEmail } from "@/lib/email";

function startOfDay(date = new Date()) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatTime(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function readRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function emailNotificationsEnabled(preferences: unknown) {
  const notificationPrefs = readRecord(readRecord(preferences).notifications);
  return notificationPrefs.email !== false;
}

async function createNotificationOnce(args: {
  userId: string;
  emailTo?: string | null;
  emailEnabled?: boolean;
  type: string;
  title: string;
  message: string;
  actionUrl?: string;
  relatedEntityId: string;
  relatedEntityType: string;
}) {
  const existing = await prisma.notification.findFirst({
    where: {
      userId: args.userId,
      type: args.type,
      relatedEntityId: args.relatedEntityId,
      relatedEntityType: args.relatedEntityType,
    },
    select: { id: true },
  });

  if (existing) return;

  await prisma.notification.create({
    data: {
      userId: args.userId,
      type: args.type,
      title: args.title,
      message: args.message,
      actionUrl: args.actionUrl ?? null,
      relatedEntityId: args.relatedEntityId,
      relatedEntityType: args.relatedEntityType,
      sent: true,
    },
  });

  if (args.emailEnabled && args.emailTo) {
    try {
      await sendEmail({
        to: args.emailTo,
        subject: `StudyFlow: ${args.title}`,
        text: `${args.message}${args.actionUrl ? `\n\nOpen: ${args.actionUrl}` : ""}`,
      });
    } catch (error) {
      console.warn("Mock email notification failed.", error);
    }
  }
}

async function syncNotifications(userId: string) {
  const today = startOfDay();
  const tomorrow = addDays(today, 1);
  const soon = addDays(today, 4);

  const [user, tasks, sessions, goals] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        preferences: true,
      },
    }),
    prisma.task.findMany({
      where: {
        userId,
        completed: false,
        OR: [
          { dueDate: { lt: tomorrow } },
          { scheduledDate: { gte: today, lt: tomorrow } },
          { isReview: true },
        ],
      },
      select: {
        id: true,
        title: true,
        type: true,
        dueDate: true,
        scheduledDate: true,
        scheduledTime: true,
        isReview: true,
      },
      take: 50,
    }),
    prisma.studySession.findMany({
      where: {
        userId,
        status: { not: "completed" },
        plannedStartTime: { gte: today, lt: tomorrow },
      },
      select: {
        id: true,
        title: true,
        plannedStartTime: true,
      },
      take: 20,
    }),
    prisma.goal.findMany({
      where: {
        userId,
        status: { not: "completed" },
        targetDate: { gte: today, lt: soon },
      },
      select: {
        id: true,
        title: true,
        targetDate: true,
      },
      take: 20,
    }),
  ]);
  const emailTo = user?.email ?? null;
  const emailEnabled = emailNotificationsEnabled(user?.preferences);

  await Promise.all([
    ...tasks.map((task) => {
      const isOverdue = task.dueDate ? task.dueDate < today : false;
      const type = task.isReview || task.type === "review" ? "review-due" : isOverdue ? "deadline" : "reminder";
      return createNotificationOnce({
        userId,
        emailTo,
        emailEnabled,
        type,
        title: task.isReview || task.type === "review" ? "Review task due" : isOverdue ? "Task overdue" : "Task due today",
        message: task.scheduledTime
          ? `${task.title} is scheduled for ${task.scheduledTime}.`
          : `${task.title} needs your attention today.`,
        actionUrl: "/tasks",
        relatedEntityId: task.id,
        relatedEntityType: "Task",
      });
    }),
    ...sessions.map((session) =>
      createNotificationOnce({
        userId,
        emailTo,
        emailEnabled,
        type: "reminder",
        title: "Study session today",
        message: `${session.title} starts at ${formatTime(session.plannedStartTime)}.`,
        actionUrl: "/calendar",
        relatedEntityId: session.id,
        relatedEntityType: "Session",
      })
    ),
    ...goals.map((goal) => {
      const daysLeft = Math.ceil((startOfDay(goal.targetDate).getTime() - today.getTime()) / 86_400_000);
      return createNotificationOnce({
        userId,
        emailTo,
        emailEnabled,
        type: "deadline",
        title: daysLeft <= 0 ? "Deadline today" : "Deadline approaching",
        message: daysLeft <= 0 ? `${goal.title} is due today.` : `${goal.title} is due in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`,
        actionUrl: "/subjects",
        relatedEntityId: goal.id,
        relatedEntityType: "Goal",
      });
    }),
  ]);

  const oldReadCutoff = addDays(today, -30);
  await prisma.notification.deleteMany({
    where: {
      userId,
      isRead: true,
      createdAt: { lt: oldReadCutoff },
    },
  });
}

export async function GET(request: NextRequest) {
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  await syncNotifications(userId);

  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") || "50"), 100);

  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      title: true,
      message: true,
      isRead: true,
      actionUrl: true,
      createdAt: true,
    },
  });

  const unreadCount = await prisma.notification.count({ where: { userId, isRead: false } });

  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH(request: NextRequest) {
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { action?: string; id?: string };

  if (body.action === "mark-all-read") {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "mark-read" && body.id) {
    await prisma.notification.updateMany({
      where: { id: body.id, userId },
      data: { isRead: true, readAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ message: "Invalid request" }, { status: 400 });
}

export async function DELETE(request: NextRequest) {
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ message: "Notification id is required" }, { status: 400 });
  }

  await prisma.notification.deleteMany({
    where: { id, userId },
  });

  return NextResponse.json({ ok: true });
}
