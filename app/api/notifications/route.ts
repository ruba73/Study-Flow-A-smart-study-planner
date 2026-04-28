import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET(request: NextRequest) {
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

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

  const unreadCount = notifications.filter((item) => !item.isRead).length;

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
