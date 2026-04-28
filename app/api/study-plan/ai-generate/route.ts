import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateOpenRouterJson } from "@/lib/openrouter";
import { getSessionUserId } from "@/lib/session";

interface AiGeneratedTask {
  title: string;
  description: string;
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
Deadline: ${deadline.toISOString().split("T")[0]}
Remaining estimated hours: ${remainingHours}
Preferred daily study hours: ${preferredDailyHours}
Study days per week: ${studyDaysPerWeek}
Study window: ${startTime}-${endTime}
Break duration: ${breakDuration} minutes
Today: ${today.toISOString().split("T")[0]}

Known materials:
${materialSummary || "- No materials have been uploaded or suggested yet."}

Generate between 4 and 12 study tasks using the extracted material text when available. Do not create generic tasks like "study chapter"; make each task about concrete concepts, sections, examples, or practice work from the materials. Each task must be specific enough to complete in one session. Schedule every task on or before the deadline.`,
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
        suggestions: [
          "Check that OPENROUTER_API_KEY has credits and is valid.",
          "Use a model that supports JSON responses, such as openai/gpt-4o-mini or deepseek/deepseek-v4-pro on OpenRouter.",
          "Confirm uploaded materials show text ready, then try AI Generate Tasks again.",
        ],
      },
      { status: 502 }
    );
  }

  await prisma.task.deleteMany({
    where: {
      userId,
      goalId: goal.id,
      isManual: false,
      completed: false,
      type: "study",
      scheduledDate: { gte: today },
    },
  });

  await prisma.studySession.deleteMany({
    where: { userId, goalId: goal.id, plannedStartTime: { gte: today }, status: "scheduled" },
  });

  const sessions = [];

  for (const task of generatedTasks) {
    const scheduledDate = normalizeDate(task.scheduledDate, today, deadline);
    const dueDate = normalizeDate(task.dueDate, scheduledDate, deadline);
    const scheduledTime = normalizeTime(task.scheduledTime, startTime);
    const plannedStartTime = new Date(`${scheduledDate.toISOString().split("T")[0]}T${scheduledTime}:00`);
    const estimatedDuration = Math.max(30, Math.min(180, Math.round(task.estimatedDuration)));
    const difficulty = Math.max(1, Math.min(5, Math.round(task.difficulty)));

    const session = await prisma.studySession.create({
      data: {
        userId,
        goalId: goal.id,
        title: task.title,
        type: "study",
        plannedStartTime,
        plannedDuration: estimatedDuration,
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
        title: task.title.trim(),
        description: task.description.trim(),
        type: "study",
        estimatedDuration,
        difficulty,
        status: "not-started",
        dueDate,
        scheduledDate,
        scheduledTime,
        completed: false,
        timeSpent: 0,
        isReview: false,
        resources: task.source ? [{ title: task.source }] : [],
        dependsOn: [],
        linkedTasks: [],
        isManual: false,
      },
    });

    sessions.push(session);
  }

  return NextResponse.json({ sessions, tasksCreated: generatedTasks.length, fallback: false, aiError: null });
}
