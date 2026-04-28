import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      profile: true,
      preferences: true,
    },
  });

  return NextResponse.json({ user });
}

export async function PATCH(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    profile?: Record<string, unknown>;
    preferences?: Record<string, unknown>;
  };

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { profile: true, preferences: true },
  });

  if (!existing) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  const profile = existing.profile as Record<string, unknown>;
  const preferences = existing.preferences as Record<string, unknown>;
  const existingNotifications = (preferences.notifications ?? {}) as Record<string, unknown>;
  const existingBreakRules = (preferences.breakRules ?? {}) as Record<string, unknown>;

  await prisma.user.update({
    where: { id: userId },
    data: {
      profile: {
        ...profile,
        ...(body.profile ?? {}),
      },
      preferences: {
        ...preferences,
        ...(body.preferences ?? {}),
        breakRules: {
          ...existingBreakRules,
          ...(((body.preferences?.breakRules as Record<string, unknown> | undefined) ?? {})),
        },
        notifications: {
          ...existingNotifications,
          ...(((body.preferences?.notifications as Record<string, unknown> | undefined) ?? {})),
        },
      },
    },
  });

  return NextResponse.json({ ok: true });
}
