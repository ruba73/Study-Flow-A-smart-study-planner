import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { generateOpenRouterJson } from "@/lib/openrouter";

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

function parseTime(time: string) {
  const [hour = 9, minute = 0] = time.split(":").map(Number);
  return { hour, minute };
}

function minutesBetween(startTime: string, endTime: string) {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  return Math.max(60, (end.hour * 60 + end.minute) - (start.hour * 60 + start.minute));
}

function setTimeFromMinutes(date: Date, startTime: string, minuteOffset: number) {
  const start = parseTime(startTime);
  const next = new Date(date);
  next.setHours(start.hour, start.minute + minuteOffset, 0, 0);
  return next;
}

function toScheduledTime(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function weekdayIndex(date: Date) {
  return date.getDay() === 0 ? 6 : date.getDay() - 1;
}

function priorityWeight(priority: string) {
  if (priority === "high") return 1.25;
  if (priority === "low") return 0.85;
  return 1;
}

function addMinutesToTime(time: string, minutes: number) {
  const { hour, minute } = parseTime(time);
  const total = Math.max(0, Math.min(23 * 60 + 59, hour * 60 + minute + minutes));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function buildFallbackPlanFixes(args: {
  remaining: string;
  studyHoursPerDay: number;
  studyDaysPerWeek: number;
  startTime: string;
  endTime: string;
  breakDuration: number;
}) {
  const availableMinutes = minutesBetween(args.startTime, args.endTime);
  const extendedEndTime = addMinutesToTime(args.endTime, 60);

  return [
    {
      title: "Add one more study day",
      description: `Increase study days from ${args.studyDaysPerWeek} to ${Math.min(7, args.studyDaysPerWeek + 1)} so the remaining work can be spread out before the deadline.`,
      changes: {
        studyHoursPerDay: args.studyHoursPerDay,
        studyDaysPerWeek: Math.min(7, args.studyDaysPerWeek + 1),
        startTime: args.startTime,
        endTime: args.endTime,
        breakDuration: args.breakDuration,
      },
    },
    {
      title: "Extend the daily window",
      description: `Keep the same number of study days, but extend the daily availability window by about one hour.`,
      changes: {
        studyHoursPerDay: Math.min(12, Math.max(args.studyHoursPerDay, Math.ceil((availableMinutes + 60) / 60))),
        studyDaysPerWeek: args.studyDaysPerWeek,
        startTime: args.startTime,
        endTime: extendedEndTime,
        breakDuration: args.breakDuration,
      },
    },
    {
      title: "Use shorter breaks",
      description: "Reduce break time to create more room for scheduled work without changing deadlines.",
      changes: {
        studyHoursPerDay: args.studyHoursPerDay,
        studyDaysPerWeek: args.studyDaysPerWeek,
        startTime: args.startTime,
        endTime: args.endTime,
        breakDuration: Math.max(5, Math.min(args.breakDuration, 10)),
      },
    },
  ];
}

async function suggestPlanFixes(args: {
  remaining: string;
  studyHoursPerDay: number;
  studyDaysPerWeek: number;
  startTime: string;
  endTime: string;
  breakDuration: number;
}) {
  const fallback = buildFallbackPlanFixes(args);

  try {
    const responseText = await generateOpenRouterJson({
      systemInstruction:
        "You are an academic scheduling assistant. Suggest practical configuration changes that help a student complete unscheduled study work before deadlines. Return only valid JSON.",
      schemaName: "study_plan_fixes",
      schema: {
        type: "object",
        properties: {
          suggestions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                changes: {
                  type: "object",
                  properties: {
                    studyHoursPerDay: { type: "integer" },
                    studyDaysPerWeek: { type: "integer" },
                    startTime: { type: "string" },
                    endTime: { type: "string" },
                    breakDuration: { type: "integer" },
                  },
                  required: ["studyHoursPerDay", "studyDaysPerWeek", "startTime", "endTime", "breakDuration"],
                },
              },
              required: ["title", "description", "changes"],
            },
          },
        },
        required: ["suggestions"],
      },
      prompt: `The study-plan generator could not schedule all work.

Remaining unscheduled work: ${args.remaining}

Current settings:
- Study hours per day: ${args.studyHoursPerDay}
- Study days per week: ${args.studyDaysPerWeek}
- Daily availability: ${args.startTime}-${args.endTime}
- Break duration: ${args.breakDuration} minutes

Suggest 3 specific fixes. Keep values realistic: studyHoursPerDay 1-12, studyDaysPerWeek 1-7, breakDuration 5-60. Include one option that changes time availability, one option that changes study days/hours, and one option that reduces breaks or scope.`,
    });

    const parsed = JSON.parse(responseText) as { suggestions?: typeof fallback };
    return Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0 ? parsed.suggestions.slice(0, 3) : fallback;
  } catch {
    return fallback;
  }
}

function countActiveDaysThrough(startDate: Date, endDate: Date, activeWeekdays: Set<number>) {
  let count = 0;
  for (let cursor = startOfDay(startDate); cursor <= endDate; cursor = addDays(cursor, 1)) {
    if (activeWeekdays.has(weekdayIndex(cursor))) count += 1;
  }
  return Math.max(1, count);
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const [user, goals, sessions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { profile: true, preferences: true },
    }),
    prisma.goal.findMany({
      where: { userId, status: { not: "completed" } },
      orderBy: [{ priority: "desc" }, { targetDate: "asc" }],
      select: {
        id: true,
        title: true,
        priority: true,
        progress: true,
        targetDate: true,
        estimatedTotalHours: true,
      },
    }),
    prisma.studySession.findMany({
      where: { userId, plannedStartTime: { gte: startOfDay() } },
      orderBy: { plannedStartTime: "asc" },
      take: 30,
      select: {
        id: true,
        title: true,
        type: true,
        plannedStartTime: true,
        plannedDuration: true,
        status: true,
      },
    }),
  ]);

  return NextResponse.json({ user, goals, sessions });
}

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    studyHoursPerDay?: number;
    studyDaysPerWeek?: number;
    startTime?: string;
    endTime?: string;
    breakDuration?: number;
  };

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { profile: true, preferences: true },
  });

  const currentProfile = (currentUser?.profile as Record<string, unknown> | null) ?? {};
  const currentPreferences = (currentUser?.preferences as Record<string, unknown> | null) ?? {};
  const currentBreakRules = (currentPreferences.breakRules as Record<string, unknown> | undefined) ?? {};

  const savedStudyHoursPerDay =
    typeof currentPreferences.maxStudyHoursPerDay === "number" ? currentPreferences.maxStudyHoursPerDay : 4;
  const savedMaxSessionsPerDay =
    typeof currentPreferences.maxSessionsPerDay === "number" ? currentPreferences.maxSessionsPerDay : 2;

  const studyHoursPerDay = Math.max(1, Math.min(12, body.studyHoursPerDay ?? savedStudyHoursPerDay));
  const studyDaysPerWeek = Math.max(
    1,
    Math.min(7, body.studyDaysPerWeek ?? Math.min(7, Math.max(1, Math.ceil((savedMaxSessionsPerDay * 7) / 2))))
  );
  const startTime =
    body.startTime ??
    (typeof currentProfile.availabilityStartTime === "string" ? currentProfile.availabilityStartTime : "09:00");
  const endTime =
    body.endTime ??
    (typeof currentProfile.availabilityEndTime === "string" ? currentProfile.availabilityEndTime : "21:00");
  const breakDuration = Math.max(
    5,
    Math.min(60, body.breakDuration ?? (typeof currentBreakRules.breakDuration === "number" ? currentBreakRules.breakDuration : 10))
  );

  const goals = await prisma.goal.findMany({
    where: { userId, status: { not: "completed" } },
    orderBy: [{ targetDate: "asc" }, { priority: "desc" }],
    select: {
      id: true,
      title: true,
      priority: true,
      progress: true,
      targetDate: true,
      difficulty: true,
      estimatedTotalHours: true,
      actualHoursSpent: true,
    },
  });

  if (goals.length === 0) {
    return NextResponse.json({ message: "Add at least one goal before generating a study plan" }, { status: 400 });
  }

  const availableMinutes = minutesBetween(startTime, endTime);
  const preferredMinutesPerDay = Math.min(studyHoursPerDay * 60, availableMinutes);
  const sessionMinutes = Math.min(120, Math.max(30, Math.floor(Math.min(preferredMinutesPerDay, availableMinutes) / 2)));
  const today = startOfDay();
  const activeWeekdays = new Set(Array.from({ length: studyDaysPerWeek }).map((_, idx) => idx));
  const latestTargetDate = goals.reduce((latest, goal) => {
    const deadline = startOfDay(goal.targetDate);
    return deadline > latest ? deadline : latest;
  }, today);
  const planningEndDate = latestTargetDate > addDays(today, 365) ? addDays(today, 365) : latestTargetDate;

  const goalPlans = goals.map((goal) => {
    const progressRemaining = goal.estimatedTotalHours * (1 - Math.min(100, Math.max(0, goal.progress)) / 100);
    const remainingHours = Math.max(0, progressRemaining - goal.actualHoursSpent);
    return {
      ...goal,
      deadline: startOfDay(goal.targetDate),
      remainingMinutes: Math.ceil(remainingHours * 60),
    };
  }).filter((goal) => goal.remainingMinutes > 0);

  await prisma.task.deleteMany({
    where: {
      userId,
      isManual: false,
      completed: false,
      scheduledDate: { gte: today },
      type: "study",
    },
  });

  await prisma.studySession.deleteMany({
    where: { userId, plannedStartTime: { gte: today }, status: "scheduled" },
  });

  const createdSessions: Array<{
    id: string;
    title: string;
    type: string;
    plannedStartTime: Date;
    plannedDuration: number;
    status: string;
  }> = [];

  for (let date = today; date <= planningEndDate; date = addDays(date, 1)) {
    if (!activeWeekdays.has(weekdayIndex(date))) continue;

    const dueGoals = goalPlans.filter((goal) => goal.remainingMinutes > 0 && goal.deadline >= date);
    if (dueGoals.length === 0) continue;

    const requiredToday = dueGoals.reduce((sum, goal) => {
      const activeDaysLeft = countActiveDaysThrough(date, goal.deadline, activeWeekdays);
      return sum + Math.ceil(goal.remainingMinutes / activeDaysLeft);
    }, 0);

    let remainingDayMinutes = Math.min(availableMinutes, Math.max(preferredMinutesPerDay, requiredToday));
    let minuteOffset = 0;

    while (remainingDayMinutes >= 30 && dueGoals.some((goal) => goal.remainingMinutes > 0)) {
      const goal = dueGoals
        .filter((item) => item.remainingMinutes > 0)
        .sort((a, b) => {
          const aDays = countActiveDaysThrough(date, a.deadline, activeWeekdays);
          const bDays = countActiveDaysThrough(date, b.deadline, activeWeekdays);
          const aPressure = (a.remainingMinutes / aDays) * priorityWeight(a.priority);
          const bPressure = (b.remainingMinutes / bDays) * priorityWeight(b.priority);
          return bPressure - aPressure || a.deadline.getTime() - b.deadline.getTime();
        })[0];

      const plannedDuration = Math.min(sessionMinutes, remainingDayMinutes, goal.remainingMinutes);
      const sessionStart = setTimeFromMinutes(date, startTime, minuteOffset);
      const session = await prisma.studySession.create({
        data: {
          userId,
          goalId: goal.id,
          title: `${goal.title} Focus Session`,
          type: "study",
          plannedStartTime: sessionStart,
          plannedDuration,
          actualDuration: 0,
          status: "scheduled",
          tasks: [],
          pauseCount: 0,
          totalPauseTime: 0,
          breaks: [],
        },
        select: {
          id: true,
          title: true,
          type: true,
          plannedStartTime: true,
          plannedDuration: true,
          status: true,
        },
      });

      await prisma.task.create({
        data: {
          userId,
          goalId: goal.id,
          sessionId: session.id,
          title: `Study ${goal.title}`,
          description: `Scheduled study session for ${goal.title}.`,
          type: "study",
          estimatedDuration: plannedDuration,
          difficulty: goal.difficulty,
          status: "not-started",
          dueDate: goal.deadline,
          scheduledDate: date,
          scheduledTime: toScheduledTime(sessionStart),
          completed: false,
          timeSpent: 0,
          isReview: false,
          resources: [],
          dependsOn: [],
          linkedTasks: [],
          isManual: false,
        },
      });

      createdSessions.push(session);
      goal.remainingMinutes -= plannedDuration;
      remainingDayMinutes -= plannedDuration + breakDuration;
      minuteOffset += plannedDuration + breakDuration;

      if (minuteOffset >= availableMinutes) break;
    }
  }

  if (goalPlans.some((goal) => goal.remainingMinutes > 0)) {
    const remaining = goalPlans
      .filter((goal) => goal.remainingMinutes > 0)
      .map((goal) => `${goal.title}: ${Math.ceil(goal.remainingMinutes / 60)}h`)
      .join(", ");
    const suggestions = await suggestPlanFixes({
      remaining,
      studyHoursPerDay,
      studyDaysPerWeek,
      startTime,
      endTime,
      breakDuration,
    });

    return NextResponse.json(
      {
        message: `The current availability window is not enough to finish every subject before its deadline. Remaining unscheduled work: ${remaining}.`,
        sessions: createdSessions,
        suggestions,
      },
      { status: 409 }
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      profile: {
        ...currentProfile,
        availabilityStartTime: startTime,
        availabilityEndTime: endTime,
      },
      preferences: {
        ...currentPreferences,
        maxStudyHoursPerDay: studyHoursPerDay,
        maxSessionsPerDay: Math.max(1, Math.ceil(preferredMinutesPerDay / Math.max(1, sessionMinutes))),
        breakRules: {
          ...currentBreakRules,
          breakDuration,
        },
      },
    },
  });

  const sessions = await prisma.studySession.findMany({
    where: { userId, plannedStartTime: { gte: startOfDay() } },
    orderBy: { plannedStartTime: "asc" },
    take: 30,
    select: {
      id: true,
      title: true,
      type: true,
      plannedStartTime: true,
      plannedDuration: true,
      status: true,
    },
  });

  return NextResponse.json({ sessions });
}
