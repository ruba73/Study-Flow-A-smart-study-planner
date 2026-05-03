import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import prisma from "@/lib/prisma";

export async function getSessionUserId() {
  const session = await getServerSession(authOptions);
  const sessionUserId = session?.user && "id" in session.user ? String(session.user.id) : null;
  const email = session?.user?.email?.trim().toLowerCase();

  if (sessionUserId) {
    const user = await prisma.user.findUnique({
      where: { id: sessionUserId },
      select: { id: true },
    });
    if (user) return user.id;
  }

  if (email) {
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, googleId: true },
    });

    if (existingUser) {
      if (sessionUserId && !existingUser.googleId) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { googleId: sessionUserId },
        });
      }
      return existingUser.id;
    }

    const createdUser = await prisma.user.create({
      data: {
        name: session.user?.name || email,
        email,
        password: "",
        googleId: sessionUserId,
        profile: {
          weeklyAvailability: [],
          preferredSessionLength: 60,
          focusHours: "flexible",
          timezone: "UTC",
          language: "en",
          skillsLevel: {},
        },
        preferences: {
          maxStudyHoursPerDay: 6,
          maxSessionsPerDay: 4,
          preferredRestDay: "sunday",
          sessionLength: 60,
          breakRules: {
            enabled: true,
            workDuration: 50,
            breakDuration: 10,
            longBreak: 30,
          },
          difficultyBalancing: true,
          bufferTime: 20,
          notifications: {
            email: true,
            push: true,
            inApp: true,
            reminderMinutesBefore: 30,
            dailyReminder: true,
            weeklyReport: true,
          },
          accessibility: {
            darkMode: false,
            fontSize: "medium",
            reducedMotion: false,
          },
        },
        stats: {
          totalGoals: 0,
          completedGoals: 0,
          totalStudyTime: 0,
          currentStreak: 0,
          longestStreak: 0,
          totalTasks: 0,
          completedTasks: 0,
        },
      },
      select: { id: true },
    });
    return createdUser.id;
  }

  return sessionUserId;
}
