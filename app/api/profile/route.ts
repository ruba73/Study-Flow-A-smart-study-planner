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
      id: true,
      name: true,
      email: true,
      avatar: true,
      profile: true,
      stats: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user });
}

export async function PATCH(request: NextRequest) {
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    name?: string;
    email?: string;
    avatar?: string | null;
    profile?: {
      schoolLevel?: "high-school" | "undergraduate" | "graduate" | "professional";
      timezone?: string;
      language?: string;
      focusHours?: "morning" | "afternoon" | "evening" | "night" | "flexible";
    };
  };

  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();

  if (!name || !email) {
    return NextResponse.json({ message: "Name and email are required" }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser && existingUser.id !== userId) {
    return NextResponse.json({ message: "Email is already in use" }, { status: 400 });
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { profile: true },
  });

  if (!currentUser) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  const currentProfile = currentUser.profile as Record<string, unknown>;

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      name,
      email,
      avatar: body.avatar ?? null,
      profile: {
        ...currentProfile,
        schoolLevel: body.profile?.schoolLevel ?? currentProfile.schoolLevel,
        timezone: body.profile?.timezone ?? currentProfile.timezone,
        language: body.profile?.language ?? currentProfile.language,
        focusHours: body.profile?.focusHours ?? currentProfile.focusHours,
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      profile: true,
      stats: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ user: updatedUser });
}
