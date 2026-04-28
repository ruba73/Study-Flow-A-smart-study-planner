import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function PATCH(request: NextRequest) {
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    currentPassword?: string;
    newPassword?: string;
    confirmNewPassword?: string;
  };

  const currentPassword = body.currentPassword?.trim() || "";
  const newPassword = body.newPassword?.trim() || "";
  const confirmNewPassword = body.confirmNewPassword?.trim() || "";

  if (!currentPassword || !newPassword || !confirmNewPassword) {
    return NextResponse.json({ message: "All password fields are required" }, { status: 400 });
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ message: "New password must be at least 8 characters" }, { status: 400 });
  }

  if (newPassword !== confirmNewPassword) {
    return NextResponse.json({ message: "New password and confirmation do not match" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true },
  });

  if (!user) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  const passwordMatches = await bcrypt.compare(currentPassword, user.password);
  if (!passwordMatches) {
    return NextResponse.json({ message: "Current password is incorrect" }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  return NextResponse.json({ ok: true });
}
