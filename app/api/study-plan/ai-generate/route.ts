import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateOpenRouterJson } from "@/lib/openrouter";
import { getSessionUserId } from "@/lib/session";

interface AiGeneratedTask {
  title: string;
  description: string;
  studyFocus?: string[];
  materialReference?: string;
  aiQuestion?: string;
  estimatedDuration: number;
  difficulty: number;
  scheduledDate: string;
  scheduledTime: string;
  dueDate: string;
  source: string;
}

interface AiPlanResponse {
  tasks: AiGeneratedTask[];
}

interface PlanningMaterial {
  title: string;
  source: string;
  url: string | null;
  status: string;
  metadata: unknown;
}

function startOfDay(date = new Date()) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function formatLocalDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function weekdayIndex(date: Date) {
  return date.getDay() === 0 ? 6 : date.getDay() - 1;
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

function addMinutesToTime(time: string, minutes: number) {
  const { hour, minute } = parseTime(time);
  const total = Math.max(0, Math.min(23 * 60 + 59, hour * 60 + minute + minutes));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function formatTimeFromMinutes(totalMinutes: number) {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, totalMinutes));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

function timeToMinutes(time: string) {
  const { hour, minute } = parseTime(time);
  return hour * 60 + minute;
}

function countActiveDaysThrough(startDate: Date, endDate: Date, activeWeekdays: Set<number>) {
  let count = 0;
  for (let cursor = startOfDay(startDate); cursor <= endDate; cursor = addDays(cursor, 1)) {
    if (activeWeekdays.has(weekdayIndex(cursor))) count += 1;
  }
  return Math.max(1, count);
}

function buildPlanFixes(args: {
  remainingHours: number;
  availableDaysBeforeDeadline: number;
  studyHoursPerDay: number;
  studyDaysPerWeek: number;
  startTime: string;
  endTime: string;
  breakDuration: number;
}) {
  function capacityFor(changes: {
    studyHoursPerDay: number;
    studyDaysPerWeek: number;
    startTime: string;
    endTime: string;
    breakDuration: number;
  }) {
    const dailyWindowHours = Math.floor(minutesBetween(changes.startTime, changes.endTime) / 60);
    const activeDays = Math.min(args.availableDaysBeforeDeadline, changes.studyDaysPerWeek);
    return Math.min(changes.studyHoursPerDay, dailyWindowHours) * activeDays;
  }

  function canFit(changes: {
    studyHoursPerDay: number;
    studyDaysPerWeek: number;
    startTime: string;
    endTime: string;
    breakDuration: number;
  }) {
    return capacityFor(changes) >= args.remainingHours;
  }

  const requiredDailyHours = Math.ceil(args.remainingHours / Math.max(1, Math.min(args.availableDaysBeforeDeadline, args.studyDaysPerWeek)));
  const suggestions = [
    {
      title: "Add more study hours",
      description: `Increase daily study time so there is enough room for about ${args.remainingHours} hours before the deadline.`,
      changes: {
        studyHoursPerDay: Math.min(12, Math.max(args.studyHoursPerDay + 1, requiredDailyHours)),
        studyDaysPerWeek: args.studyDaysPerWeek,
        startTime: args.startTime,
        endTime: args.endTime,
        breakDuration: args.breakDuration,
      },
    },
  ];

  if (args.availableDaysBeforeDeadline > args.studyDaysPerWeek && args.studyDaysPerWeek < 7) {
    suggestions.push(
      {
        title: "Study more days",
        description: "Spread the remaining work across more available days before the deadline.",
        changes: {
          studyHoursPerDay: args.studyHoursPerDay,
          studyDaysPerWeek: Math.min(args.availableDaysBeforeDeadline, 7, args.studyDaysPerWeek + 1),
          startTime: args.startTime,
          endTime: args.endTime,
          breakDuration: args.breakDuration,
        },
      }
    );
  }

  suggestions.push(
    {
      title: "Extend the daily window",
      description: "Keep the same days, but extend the available study window so longer sessions can fit.",
      changes: {
        studyHoursPerDay: Math.min(12, Math.max(args.studyHoursPerDay, args.studyHoursPerDay + 1)),
        studyDaysPerWeek: args.studyDaysPerWeek,
        startTime: args.startTime,
        endTime: addMinutesToTime(args.endTime, 60),
        breakDuration: Math.max(5, Math.min(args.breakDuration, 10)),
      },
    },
    {
      title: "Use shorter breaks",
      description: "Reduce breaks to reclaim study time without requiring another calendar day.",
      changes: {
        studyHoursPerDay: args.studyHoursPerDay,
        studyDaysPerWeek: args.studyDaysPerWeek,
        startTime: args.startTime,
        endTime: args.endTime,
        breakDuration: Math.max(5, Math.min(args.breakDuration, 10)),
      },
    }
  );

  const uniqueSuggestions = [];
  const seenChanges = new Set<string>();

  for (const suggestion of suggestions) {
    if (!canFit(suggestion.changes)) continue;

    const key = [
      suggestion.changes.studyHoursPerDay,
      suggestion.changes.studyDaysPerWeek,
      suggestion.changes.startTime,
      suggestion.changes.endTime,
      suggestion.changes.breakDuration,
    ].join("|");

    if (seenChanges.has(key)) continue;
    seenChanges.add(key);
    uniqueSuggestions.push(suggestion);
  }

  return uniqueSuggestions.slice(0, 3);
}

function normalizeTime(value: string, fallback: string) {
  return /^\d{2}:\d{2}$/.test(value) ? value : fallback;
}

function normalizeDate(value: string, minDate: Date, maxDate: Date) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return minDate;
  if (parsed < minDate) return minDate;
  if (parsed > maxDate) return maxDate;
  return parsed;
}

function normalizeInteger(value: unknown, fallback: number, min: number, max: number) {
  const numericValue = typeof value === "number" ? value : Number(value);
  const safeValue = Number.isFinite(numericValue) ? Math.round(numericValue) : fallback;
  return Math.max(min, Math.min(max, safeValue));
}

function parseAiPlan(text: string): AiPlanResponse {
  const parsed = JSON.parse(text) as AiPlanResponse;
  return {
    tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
  };
}

function classifyOpenRouterError(error: unknown) {
  const message = error instanceof Error ? error.message : "OpenRouter request failed";
  return { code: "openrouter_error", message };
}

function readMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return metadata as Record<string, unknown>;
}

function buildMaterialSummary(materials: PlanningMaterial[]) {
  const maxTotalChars = 60_000;
  const maxPerMaterialChars = 25_000;
  let remainingChars = maxTotalChars;

  return materials
    .map((material, index) => {
      const metadata = readMetadata(material.metadata);
      const extractedText = typeof metadata.extractedText === "string" ? metadata.extractedText.trim() : "";
      const excerptLimit = Math.max(0, Math.min(maxPerMaterialChars, remainingChars));
      const excerpt = extractedText.slice(0, excerptLimit);
      remainingChars -= excerpt.length;

      const details = [
        `${index + 1}. ${material.title} (${material.source})`,
        material.url ? `URL: ${material.url}` : "",
        `status: ${material.status}`,
        typeof metadata.extractionStatus === "string" ? `text extraction: ${metadata.extractionStatus}` : "",
        typeof metadata.reason === "string" ? `reason: ${metadata.reason}` : "",
      ].filter(Boolean).join("; ");

      if (!excerpt) return details;
      const truncated = metadata.extractionTruncated || extractedText.length > excerpt.length ? "\n[Material excerpt truncated]" : "";
      return `${details}\nExtracted material text:\n${excerpt}${truncated}`;
    })
    .join("\n\n");
}

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    goalId?: string;
    studyHoursPerDay?: number;
    studyDaysPerWeek?: number;
    startTime?: string;
    endTime?: string;
    breakDuration?: number;
  };

  if (!body.goalId) {
    return NextResponse.json({ message: "Goal id is required" }, { status: 400 });
  }

  const goal = await prisma.goal.findFirst({
    where: { id: body.goalId, userId, status: { not: "completed" } },
    select: {
      id: true,
      title: true,
      description: true,
      priority: true,
      difficulty: true,
      progress: true,
      targetDate: true,
      estimatedTotalHours: true,
      actualHoursSpent: true,
    },
  });

  if (!goal) {
    return NextResponse.json({ message: "Subject not found" }, { status: 404 });
  }

  const materials: PlanningMaterial[] = await prisma.material.findMany({
    where: { userId, goalId: goal.id },
    select: {
      title: true,
      source: true,
      url: true,
      status: true,
      metadata: true,
    },
  });

  const today = startOfDay();
  const deadline = startOfDay(goal.targetDate);
  const preferredDailyHours = Math.max(1, Math.min(12, body.studyHoursPerDay ?? 4));
  const studyDaysPerWeek = Math.max(1, Math.min(7, body.studyDaysPerWeek ?? 5));
  const startTime = normalizeTime(body.startTime ?? "09:00", "09:00");
  const endTime = normalizeTime(body.endTime ?? "21:00", "21:00");
  const breakDuration = Math.max(5, Math.min(60, body.breakDuration ?? 10));
  const remainingHours = Math.max(
    1,
    Math.ceil(goal.estimatedTotalHours * (1 - Math.min(100, Math.max(0, goal.progress)) / 100) - goal.actualHoursSpent)
  );
  const activeWeekdays = new Set(Array.from({ length: studyDaysPerWeek }).map((_, index) => index));
  const activeDays = countActiveDaysThrough(today, deadline, activeWeekdays);
  const availableDailyHours = Math.min(preferredDailyHours, Math.floor(minutesBetween(startTime, endTime) / 60));
  const availableHoursBeforeDeadline = activeDays * availableDailyHours;
  const planFixes = buildPlanFixes({
    remainingHours,
    availableDaysBeforeDeadline: activeDays,
    studyHoursPerDay: preferredDailyHours,
    studyDaysPerWeek,
    startTime,
    endTime,
    breakDuration,
  });

  if (availableHoursBeforeDeadline < remainingHours) {
    return NextResponse.json(
      {
        message: `Your current generation settings allow about ${availableHoursBeforeDeadline}h before the deadline, but this subject needs about ${remainingHours}h.`,
        sessions: [],
        suggestions: planFixes,
      },
      { status: 409 }
    );
  }

  const materialSummary = buildMaterialSummary(materials);

  let aiError: { code: string; message: string } | null = null;
  let generatedTasks: AiGeneratedTask[] = [];

  try {
    const responseText = await generateOpenRouterJson({
      systemInstruction:
        "You are an academic study planner. Break a subject into concrete study tasks based on the extracted chapter/material text. Return only valid JSON matching the schema.",
      schemaName: "study_task_plan",
      prompt: `Create a task plan for this subject.

Subject: ${goal.title}
Description: ${goal.description ?? "No description provided"}
Priority: ${goal.priority}
Difficulty: ${goal.difficulty}/5
Deadline: ${formatLocalDate(deadline)}
Remaining estimated hours: ${remainingHours}
Preferred daily study hours: ${preferredDailyHours}
Study days per week: ${studyDaysPerWeek}
Study window: ${startTime}-${endTime}
Break duration: ${breakDuration} minutes
Today: ${formatLocalDate(today)}

Known materials:
${materialSummary || "- No materials have been uploaded or suggested yet."}

Generate between 4 and 12 study tasks using the extracted material text when available. Do not create generic tasks like "study chapter"; make each task about concrete concepts, sections, examples, slides, examples, equations, or practice work from the materials.

Every task must be one clickable session card for the student. For each task:
- title: short and specific.
- description: 2-4 sentences explaining exactly what to study and what output to produce by the end of the session.
- studyFocus: 3-6 concrete bullets from the uploaded/suggested material.
- materialReference: name the source material and chapter/section/slide/topic when inferable.
- aiQuestion: a concise question the student can send to the materials AI chat for deeper help.
- estimatedDuration: choose a realistic session length based on the material's complexity and workload. Use shorter sessions for definitions/review, medium sessions for concept learning, and longer sessions for practice, diagrams, coding, or synthesis. Vary session lengths naturally; do not make every session the same length.

Distribute the tasks so the available uploaded material is covered before the deadline. Schedule every task on or before the deadline.`,
      schema: {
        type: "object",
        properties: {
          tasks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                studyFocus: {
                  type: "array",
                  items: { type: "string" },
                },
                materialReference: { type: "string" },
                aiQuestion: { type: "string" },
                estimatedDuration: { type: "integer" },
                difficulty: { type: "integer" },
                scheduledDate: { type: "string" },
                scheduledTime: { type: "string" },
                dueDate: { type: "string" },
                source: { type: "string" },
              },
              required: [
                "title",
                "description",
                "studyFocus",
                "materialReference",
                "aiQuestion",
                "estimatedDuration",
                "difficulty",
                "scheduledDate",
                "scheduledTime",
                "dueDate",
                "source",
              ],
            },
          },
        },
        required: ["tasks"],
      },
    });

    generatedTasks = parseAiPlan(responseText).tasks.slice(0, 12);
  } catch (error) {
    aiError = classifyOpenRouterError(error);
  }

  if (generatedTasks.length === 0) {
    return NextResponse.json(
      {
        message: "The AI provider could not generate tasks. No fallback tasks were created.",
        aiError,
        suggestions: [],
      },
      { status: 502 }
    );
  }

  const availableMinutes = minutesBetween(startTime, endTime);
  const windowStartMinutes = timeToMinutes(startTime);
  let scheduleDate = new Date(today);
  let scheduleOffset = 0;
  const scheduledTasks = [];

  for (const task of generatedTasks) {
    const taskTitle = typeof task.title === "string" && task.title.trim() ? task.title.trim() : `Study ${goal.title}`;
    const taskDescription =
      typeof task.description === "string" && task.description.trim()
        ? task.description.trim()
        : `Study the relevant material for ${goal.title} and write down the key ideas, examples, and questions to review.`;
    const estimatedDuration = normalizeInteger(task.estimatedDuration, 75, 30, Math.min(180, availableMinutes));
    const difficulty = normalizeInteger(task.difficulty, goal.difficulty, 1, 5);

    while (
      scheduleDate <= deadline &&
      (!activeWeekdays.has(weekdayIndex(scheduleDate)) || scheduleOffset + estimatedDuration > availableMinutes)
    ) {
      scheduleDate = addDays(scheduleDate, 1);
      scheduleOffset = 0;
    }

    if (scheduleDate > deadline) {
      return NextResponse.json(
        {
          message: `The generated sessions no longer fit before the deadline with the current settings.`,
          sessions: [],
          suggestions: planFixes,
        },
        { status: 409 }
      );
    }

    const dateKey = formatLocalDate(scheduleDate);
    const scheduledDate = new Date(`${dateKey}T00:00:00`);
    const dueDate = normalizeDate(task.dueDate, scheduledDate, deadline);
    const scheduledTime = formatTimeFromMinutes(windowStartMinutes + scheduleOffset);
    const plannedStartTime = new Date(`${dateKey}T${scheduledTime}:00`);
    scheduleOffset += estimatedDuration + breakDuration;

    scheduledTasks.push({
      task,
      taskTitle,
      taskDescription,
      scheduledDate,
      dueDate,
      scheduledTime,
      plannedStartTime,
      estimatedDuration,
      difficulty,
    });
  }

  await prisma.task.deleteMany({
    where: {
      userId,
      goalId: goal.id,
      isManual: false,
      completed: false,
      type: "study",
    },
  });

  await prisma.studySession.deleteMany({
    where: { userId, goalId: goal.id, status: "scheduled" },
  });

  const sessions = [];

  for (const scheduledTask of scheduledTasks) {
    const session = await prisma.studySession.create({
      data: {
        userId,
        goalId: goal.id,
        title: scheduledTask.taskTitle,
        type: "study",
        plannedStartTime: scheduledTask.plannedStartTime,
        plannedDuration: scheduledTask.estimatedDuration,
        actualDuration: 0,
        status: "scheduled",
        tasks: [],
        pauseCount: 0,
        totalPauseTime: 0,
        breaks: [],
      },
      select: {
        id: true,
        goalId: true,
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
        title: scheduledTask.taskTitle,
        description: scheduledTask.taskDescription,
        type: "study",
        estimatedDuration: scheduledTask.estimatedDuration,
        difficulty: scheduledTask.difficulty,
        status: "not-started",
        dueDate: scheduledTask.dueDate,
        scheduledDate: scheduledTask.scheduledDate,
        scheduledTime: scheduledTask.scheduledTime,
        completed: false,
        timeSpent: 0,
        isReview: false,
        resources: [
          {
            title: scheduledTask.task.source || scheduledTask.task.materialReference || "Uploaded material",
            materialReference: scheduledTask.task.materialReference ?? scheduledTask.task.source ?? "",
            studyFocus: Array.isArray(scheduledTask.task.studyFocus) ? scheduledTask.task.studyFocus.filter((item) => typeof item === "string") : [],
            aiQuestion: scheduledTask.task.aiQuestion ?? `Explain ${scheduledTask.taskTitle} using my uploaded materials.`,
          },
        ],
        dependsOn: [],
        linkedTasks: [],
        isManual: false,
      },
    });

    sessions.push({
      ...session,
      task: {
        title: scheduledTask.taskTitle,
        description: scheduledTask.taskDescription,
        studyFocus: Array.isArray(scheduledTask.task.studyFocus) ? scheduledTask.task.studyFocus.filter((item) => typeof item === "string") : [],
        materialReference: scheduledTask.task.materialReference ?? scheduledTask.task.source ?? "",
        aiQuestion: scheduledTask.task.aiQuestion ?? `Explain ${scheduledTask.taskTitle} using my uploaded materials.`,
      },
    });
  }

  return NextResponse.json({ sessions, tasksCreated: generatedTasks.length, fallback: false, aiError: null });
}
