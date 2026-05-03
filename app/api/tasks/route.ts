import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { generateAiJson, getAiModel } from "@/lib/ai-provider";
import { createCompletionTestIfReady as createBatchedCompletionTestIfReady } from "@/lib/completion-exam";

interface CompletionTestQuestion {
  id: string;
  type: "mcq" | "true_false" | "short_answer";
  question: string;
  options?: string[];
  correctAnswer: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
}

interface CompletionTestResource {
  kind: "completion-test";
  generatedBy?: string;
  generatedAt?: string;
  aiModel?: string;
  questions: CompletionTestQuestion[];
}

interface CompletionTestResponse {
  questions: Array<Omit<CompletionTestQuestion, "correctAnswer">>;
}

function readRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function readCompletionTest(resources: unknown): CompletionTestResource | null {
  if (!Array.isArray(resources)) return null;
  const test = resources.find((item) => readRecord(item).kind === "completion-test");
  if (!test) return null;
  const record = readRecord(test);
  const questions = Array.isArray(record.questions) ? record.questions : [];
  return {
    kind: "completion-test",
    questions: questions
      .map((question, index): CompletionTestQuestion | null => {
        const item = readRecord(question);
        const type = item.type === "true_false" ? "true_false" : item.type === "short_answer" || item.type === "free" ? "short_answer" : "mcq";
        const questionText = typeof item.question === "string" ? item.question.trim() : "";
        const correctAnswer = typeof item.correctAnswer === "string" ? item.correctAnswer.trim() : "";
        const topic = typeof item.topic === "string" && item.topic.trim() ? item.topic.trim() : "General review";
        const difficulty =
          item.difficulty === "easy" || item.difficulty === "hard" || item.difficulty === "medium" ? item.difficulty : "medium";
        const options = Array.isArray(item.options) ? item.options.filter((option): option is string => typeof option === "string") : undefined;
        if (!questionText || !correctAnswer) return null;
        return {
          id: typeof item.id === "string" && item.id.trim() ? item.id : `q${index + 1}`,
          type,
          question: questionText,
          options:
            type === "mcq" && options && options.length >= 4
              ? options.slice(0, 4)
              : type === "true_false"
                ? ["True", "False"]
                : undefined,
          correctAnswer,
          topic,
          difficulty,
        };
      })
      .filter((question): question is CompletionTestQuestion => Boolean(question)),
    generatedBy: typeof record.generatedBy === "string" ? record.generatedBy : undefined,
    generatedAt: typeof record.generatedAt === "string" ? record.generatedAt : undefined,
    aiModel: typeof record.aiModel === "string" ? record.aiModel : undefined,
  };
}

function sanitizeCompletionTest(resources: unknown): CompletionTestResponse | null {
  const test = readCompletionTest(resources);
  if (!test || test.questions.length === 0) return null;
  return {
    questions: test.questions.map((question) => ({
      id: question.id,
      type: question.type,
      question: question.question,
      options: question.options,
      topic: question.topic,
      difficulty: question.difficulty,
    })),
  };
}

function sanitizeCompletionTestResource(resources: unknown) {
  const test = readCompletionTest(resources);
  if (!test || test.questions.length === 0) return null;
  return {
    generatedBy: test.generatedBy ?? "unknown",
    generatedAt: test.generatedAt ?? null,
    aiModel: test.aiModel ?? null,
    ...sanitizeCompletionTest(resources),
  };
}

function hasPassedCompletionTest(resources: unknown) {
  if (!Array.isArray(resources)) return false;
  return resources.some((resource) => {
    const item = readRecord(resource);
    if (item.kind !== "completion-test-result") return false;
    return Boolean(readRecord(item.result).passed);
  });
}

function isFailedCompletionReviewFilter() {
  return { path: "$.source", equals: "failed-completion-test" } as const;
}

function isFailedCompletionReviewTask(task: { isReview?: boolean; reviewSchedule?: unknown; type?: string }) {
  const reviewSchedule = readRecord(task.reviewSchedule);
  return Boolean(task.isReview || task.type === "review") && reviewSchedule.source === "failed-completion-test";
}

function startOfDay(date = new Date()) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function getWeekNumber(date: Date) {
  const current = startOfDay(date);
  current.setDate(current.getDate() + 3 - ((current.getDay() + 6) % 7));
  const week1 = new Date(current.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(((current.getTime() - week1.getTime()) / 86_400_000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  );
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateKey(date: Date) {
  const day = startOfDay(date);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}

function buildMaterialSummary(materials: Array<{ title: string; source: string; url: string | null; metadata: unknown }>) {
  const maxTotalChars = 6_000;
  const maxPerMaterialChars = 2_000;
  let remainingChars = maxTotalChars;

  return materials
    .map((material, index) => {
      const metadata = readRecord(material.metadata);
      const extractedText = typeof metadata.extractedText === "string" ? metadata.extractedText.trim() : "";
      const excerptLimit = Math.max(0, Math.min(maxPerMaterialChars, remainingChars));
      const excerpt = extractedText.slice(0, excerptLimit);
      remainingChars -= excerpt.length;
      const source = material.url ? `${material.source}: ${material.url}` : material.source;
      if (!excerpt) return `${index + 1}. ${material.title} (${source})`;
      return `${index + 1}. ${material.title} (${source})\n${excerpt}`;
    })
    .join("\n\n");
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function buildTaskMaterialSummary(tasks: Array<{ title: string; description: string | null; resources: unknown }>) {
  return tasks
    .map((task, index) => {
      const resources = Array.isArray(task.resources) ? task.resources : [];
      const resourceDetails = resources
        .map((resource) => {
          const item = readRecord(resource);
          const studyFocus = readStringArray(item.studyFocus);
          const parts = [
            typeof item.materialReference === "string" && item.materialReference.trim() ? `Material: ${item.materialReference.trim()}` : "",
            studyFocus.length > 0 ? `Study focus: ${studyFocus.join("; ")}` : "",
            typeof item.aiQuestion === "string" && item.aiQuestion.trim() ? `Planned question: ${item.aiQuestion.trim()}` : "",
          ].filter(Boolean);
          return parts.join("\n");
        })
        .filter(Boolean)
        .join("\n");

      return [
        `${index + 1}. Topic studied: ${task.title}`,
        task.description ? `Task description: ${task.description}` : "",
        resourceDetails,
      ].filter(Boolean).join("\n");
    })
    .join("\n\n");
}

function parseGeneratedTest(text: string): CompletionTestQuestion[] {
  const badQuestionPatterns = [
    /which statement matches/i,
    /which answer best reflects/i,
    /what (is|was) (this )?(the )?material about/i,
    /what did you study/i,
    /which topic was covered/i,
  ];
  const parsed = JSON.parse(text) as { questions?: unknown[] };
  return (parsed.questions ?? [])
    .map((question, index): CompletionTestQuestion | null => {
      const item = readRecord(question);
      const type = item.type === "true_false" ? "true_false" : item.type === "short_answer" || item.type === "free" ? "short_answer" : "mcq";
      const questionText = typeof item.question === "string" ? item.question.trim() : "";
      let correctAnswer = typeof item.correctAnswer === "string" ? item.correctAnswer.trim() : "";
      if (type === "true_false") {
        correctAnswer = correctAnswer.charAt(0).toUpperCase() + correctAnswer.slice(1).toLowerCase();
      }
      const topic = typeof item.topic === "string" && item.topic.trim() ? item.topic.trim() : "General review";
      const difficulty =
        item.difficulty === "easy" || item.difficulty === "hard" || item.difficulty === "medium" ? item.difficulty : "medium";
      const options = Array.isArray(item.options) ? item.options.filter((option): option is string => typeof option === "string") : [];
      if (!questionText || !correctAnswer) return null;
      if (badQuestionPatterns.some((pattern) => pattern.test(questionText))) return null;
      const mcqOptions = Array.from(new Set([correctAnswer, ...options])).slice(0, 4);
      if (type === "mcq" && mcqOptions.some((option) => /^((completed )?task|task description|material|study focus|planned question):/i.test(option))) {
        return null;
      }
      if (type === "mcq" && mcqOptions.length !== 4) return null;
      if (type === "true_false" && correctAnswer !== "True" && correctAnswer !== "False") return null;
      return {
        id: `q${index + 1}`,
        type,
        question: questionText,
        options: type === "mcq" ? mcqOptions : type === "true_false" ? ["True", "False"] : undefined,
        correctAnswer,
        topic,
        difficulty,
      };
    })
    .filter((question): question is CompletionTestQuestion => Boolean(question))
    .filter((question) => question.type !== "mcq" || (question.options?.length ?? 0) === 4)
    .slice(0, 12);
}

function normalizeQuestionText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueQuestions(questions: CompletionTestQuestion[]) {
  const seen = new Set<string>();
  const result: CompletionTestQuestion[] = [];

  for (const question of questions) {
    const key = normalizeQuestionText(question.question);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(question);
  }

  return result;
}

function trimToRequiredShape(questions: CompletionTestQuestion[]) {
  const unique = uniqueQuestions(questions);
  return [
    ...unique.filter((question) => question.type === "mcq"),
    ...unique.filter((question) => question.type === "true_false"),
    ...unique.filter((question) => question.type === "short_answer"),
  ].slice(0, 12).map((question, index) => ({ ...question, id: `q${index + 1}` }));
}

function hasRequiredExamShape(questions: CompletionTestQuestion[]) {
  return questions.length > 0 && questions.length <= 12;
}

function shouldUseAiExamGeneration() {
  return process.env.AI_EXAM_GENERATION === "true";
}

function publicExamGenerationMessage(message: string | null) {
  if (!message) return null;
  if (message.includes("AI_MODEL")) return "AI provider is not configured.";
  if (message.includes("AI returned") || message.includes("AI did not return")) return message;
  if (message.includes("AI provider")) return "AI provider could not generate a valid exam right now.";
  return "AI could not generate a valid exam from the uploaded material.";
}

async function createCompletionTestIfReady(userId: string, goalId: string) {
  const goal = await prisma.goal.findFirst({
    where: { id: goalId, userId },
    select: { id: true, title: true, description: true, difficulty: true, topics: true, targetDate: true, status: true },
  });

  if (!goal) {
    return null;
  }

  const completedExamTasks = await prisma.task.findMany({
    where: { userId, goalId, completed: true, type: "quiz" },
    select: { resources: true },
  });
  if (completedExamTasks.some((task) => hasPassedCompletionTest(task.resources))) {
    return null;
  }

  const openExamTasks = await prisma.task.findMany({
    where: { userId, goalId, completed: false, type: "quiz" },
    orderBy: { createdAt: "asc" },
    select: { id: true, resources: true },
  });
  const existingExam = openExamTasks.find((task) => hasRequiredExamShape(readCompletionTest(task.resources)?.questions ?? []));
  if (existingExam) {
    const duplicateExamIds = openExamTasks.filter((task) => task.id !== existingExam.id).map((task) => task.id);
    if (duplicateExamIds.length > 0) {
      await prisma.task.deleteMany({ where: { userId, goalId, id: { in: duplicateExamIds }, completed: false, type: "quiz" } });
    }
    await prisma.goal.updateMany({
      where: { id: goalId, userId },
      data: { status: "in-progress", progress: 95 },
    });
    return existingExam.id;
  }
  if (openExamTasks.length > 0) {
    await prisma.task.deleteMany({ where: { userId, goalId, id: { in: openExamTasks.map((task) => task.id) }, completed: false, type: "quiz" } });
  }

  const [materials, completedTasks] = await Promise.all([
    prisma.material.findMany({
      where: { userId, goalId },
      select: { title: true, source: true, url: true, metadata: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.task.findMany({
      where: {
        userId,
        goalId,
        completed: true,
        type: { not: "quiz" },
      },
      select: {
        title: true,
        description: true,
        resources: true,
      },
      orderBy: { completedAt: "asc" },
    }),
  ]);

  const materialSummary = buildMaterialSummary(materials);
  const taskMaterialSummary = buildTaskMaterialSummary(completedTasks);
  let questions: CompletionTestQuestion[] = [];
  let aiGenerationError: string | null = null;

  if (!shouldUseAiExamGeneration()) {
    throw new Error("AI exam generation is disabled.");
  }

  try {
    const responseText = await generateAiJson({
      systemInstruction:
        "You are an expert university exam writer. Internally benchmark the studied topics against common quizzes, exams, assignments, and certification-style assessments for the same subject area, then write original exam-style questions. Return only JSON.",
      schemaName: "completion_test",
      prompt: `Create a final exam with no more than 12 questions for this subject based only on the uploaded/readable material and completed study-task material.

Subject: ${goal.title}
Description: ${goal.description ?? "No description provided"}
Difficulty: ${goal.difficulty}/5
Topics: ${Array.isArray(goal.topics) ? goal.topics.join(", ") || "Not listed" : "Not listed"}

Completed study tasks and their planned material:
${taskMaterialSummary || "No completed task resources were found."}

Uploaded/readable materials:
${materialSummary || "No readable uploaded material text is available."}

First, internally research from your training knowledge what similar quizzes and exams usually ask for these topics. Use that research only to choose question styles and difficulty. Do not output the research.

Generate between 1 and 12 original exam questions based only on the provided material.
Choose the number and mix of multiple-choice, true/false, and short-answer questions based on the material.

The questions must look like real exam questions:
- Ask direct concept, calculation, interpretation, scenario, debugging, comparison, case-study, or decision questions.
- Use concrete situations from the studied material when available, such as datasets, models, metrics, algorithms, diagrams, equations, or procedures.
- For case/practical material, ask what the student would choose, compute, interpret, fix, or conclude.
- For theory material, ask about definitions, assumptions, differences, implications, limitations, and examples.

Do not ask meta questions such as "which statement matches the material", "what did you study", "what is this material about", or "which topic was covered".
Do not use task titles, material titles, file names, or labels as answers.
Do not make every correct answer a copied sentence from the study plan. Convert studied points into assessment questions.
Base questions on the provided material. If no material is provided or if it is too short, generate questions based on the topics mentioned in the task titles and descriptions using your general knowledge.

Use these type values exactly:
- "mcq" for multiple choice.
- "true_false" for true/false.
- "short_answer" for short answer.

Every MCQ must have exactly 4 plausible options and one correct answer exactly matching one option. Distractors must be realistic misconceptions.
Every true/false question must have options ["True", "False"] and correctAnswer exactly "True" or "False".
Every short-answer question must have options [] and correctAnswer should describe the expected key points.
Every question must include difficulty exactly "easy", "medium", or "hard".
Every question must include a specific topic so weak areas can be diagnosed.
Do not repeat any question or ask the same idea twice with only different wording.`,
      schema: {
        type: "object",
        properties: {
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["mcq", "true_false", "short_answer"] },
                question: { type: "string" },
                options: { type: "array", items: { type: "string" } },
                correctAnswer: { type: "string" },
                topic: { type: "string" },
                difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
              },
              required: ["type", "question", "options", "correctAnswer", "topic", "difficulty"],
            },
          },
        },
        required: ["questions"],
      },
        maxTokens: 1600,
        requestAttempts: 1,
    });
    questions = trimToRequiredShape(parseGeneratedTest(responseText));
  } catch (error) {
    aiGenerationError = error instanceof Error ? error.message : "AI exam generation failed.";
  }

  if (!hasRequiredExamShape(questions)) {
    const shapeError =
      questions.length === 0
        ? "AI did not return any valid exam questions."
        : `AI returned ${questions.length} valid questions, but the exam can have at most 12 questions.`;
    throw new Error(aiGenerationError ? `${aiGenerationError} ${shapeError}` : shapeError);
  }

  const today = startOfDay();
  const testTask = await prisma.task.create({
    data: {
      userId,
      goalId,
      title: `${goal.title} exam`,
      description: "Answer the generated exam questions based on the material you just studied. The AI grader will score the result and open review tasks for weak areas if needed.",
      type: "quiz",
      estimatedDuration: Math.max(30, Math.min(90, questions.length * 6)),
      difficulty: goal.difficulty,
      status: "not-started",
      dueDate: today,
      scheduledDate: today,
      scheduledTime: "09:00",
      completed: false,
      timeSpent: 0,
      isReview: false,
      resources: [{
        kind: "completion-test",
        generatedBy: "ai",
        generatedAt: new Date().toISOString(),
        aiModel: getAiModel(),
        questions: questions.map((question) => ({ ...question, options: question.options ?? [] })),
      }],
      dependsOn: [],
      linkedTasks: [],
      isManual: false,
    },
    select: { id: true },
  });

  await prisma.goal.updateMany({
    where: { id: goalId, userId },
    data: { status: "in-progress", progress: 95 },
  });

  return testTask.id;
}

async function syncGoalProgress(userId: string, goalId: string) {
  const [totalTasks, completedTasks, completedDuration, openExamTasks] = await Promise.all([
    prisma.task.count({ where: { userId, goalId, type: { not: "quiz" }, NOT: { reviewSchedule: isFailedCompletionReviewFilter() } } }),
    prisma.task.count({
      where: { userId, goalId, completed: true, type: { not: "quiz" }, NOT: { reviewSchedule: isFailedCompletionReviewFilter() } },
    }),
    prisma.task.aggregate({
      where: { userId, goalId, completed: true, type: { not: "quiz" }, NOT: { reviewSchedule: isFailedCompletionReviewFilter() } },
      _sum: { estimatedDuration: true },
    }),
    prisma.task.count({ where: { userId, goalId, completed: false, type: "quiz" } }),
  ]);

  const learningProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const progress = learningProgress >= 100 ? 95 : learningProgress;
  const actualHoursSpent = Math.round(((completedDuration._sum.estimatedDuration ?? 0) / 60) * 10) / 10;

  await prisma.goal.updateMany({
    where: { id: goalId, userId, status: { not: "completed" } },
    data: {
      progress,
      actualHoursSpent,
      status: progress > 0 || openExamTasks > 0 ? "in-progress" : "not-started",
    },
  });
}

async function syncSessionStatus(userId: string, sessionId: string | null) {
  if (!sessionId) return;

  const [totalTasks, completedTasks] = await Promise.all([
    prisma.task.count({ where: { userId, sessionId } }),
    prisma.task.count({ where: { userId, sessionId, completed: true } }),
  ]);

  await prisma.studySession.updateMany({
    where: { id: sessionId, userId },
    data: {
      status: totalTasks > 0 && completedTasks === totalTasks ? "completed" : completedTasks > 0 ? "in-progress" : "scheduled",
    },
  });
}

async function syncDailyProgress(userId: string, date = new Date()) {
  const day = startOfDay(date);
  const nextDay = new Date(day);
  nextDay.setDate(nextDay.getDate() + 1);

  const [planned, completed, timeStudied] = await Promise.all([
    prisma.task.count({ where: { userId, scheduledDate: { gte: day, lt: nextDay } } }),
    prisma.task.count({ where: { userId, completed: true, completedAt: { gte: day, lt: nextDay } } }),
    prisma.task.aggregate({
      where: { userId, completed: true, completedAt: { gte: day, lt: nextDay } },
      _sum: { estimatedDuration: true },
    }),
  ]);

  const skipped = Math.max(0, planned - completed);
  const week = getWeekNumber(day);
  const month = day.getMonth() + 1;
  const year = day.getFullYear();
  const studiedMinutes = timeStudied._sum.estimatedDuration ?? 0;

  const existingProgress = await prisma.progress.findFirst({
    where: { userId, date: day },
    select: { id: true },
  });

  const progressData = {
    week,
    month,
    year,
    plannedTime: planned * 60,
    actualTime: studiedMinutes,
    timeStudied: studiedMinutes,
    tasksPlanned: planned,
    tasksCompleted: completed,
    tasksSkipped: skipped,
    completionRate: planned > 0 ? Math.round((completed / planned) * 100) : 0,
    status: completed >= planned && planned > 0 ? "on-track" : "behind",
  };

  if (existingProgress) {
    await prisma.progress.update({
      where: { id: existingProgress.id },
      data: progressData,
    });
    return;
  }

  await prisma.progress.create({
    data: {
      userId,
      date: day,
      ...progressData,
      topicMastery: {},
      currentStreak: 0,
      burnoutScore: 0,
    },
  });
}

async function syncUserStats(userId: string) {
  const userExists = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!userExists) return;

  const [completedGoals, totalGoals, totalStudyTime, taskRows, progressRows] = await Promise.all([
    prisma.goal.count({ where: { userId, status: "completed" } }),
    prisma.goal.count({ where: { userId } }),
    prisma.task.aggregate({
      where: { userId, completed: true },
      _sum: { estimatedDuration: true },
    }),
    prisma.task.findMany({
      where: { userId },
      select: { completed: true, completedAt: true, scheduledDate: true },
    }),
    prisma.progress.findMany({
      where: { userId },
      select: { date: true, timeStudied: true },
    }),
  ]);

  const plannedByDay = new Map<string, { planned: number; completed: number }>();
  const completedWorkDays = new Set<string>();

  for (const task of taskRows) {
    if (task.scheduledDate) {
      const key = dateKey(task.scheduledDate);
      const current = plannedByDay.get(key) ?? { planned: 0, completed: 0 };
      current.planned += 1;
      if (task.completed) current.completed += 1;
      plannedByDay.set(key, current);
    }

    if (task.completedAt) {
      completedWorkDays.add(dateKey(task.completedAt));
    }
  }

  for (const progress of progressRows) {
    if (progress.timeStudied > 0) {
      completedWorkDays.add(dateKey(progress.date));
    }
  }

  function isStreakDay(day: Date) {
    const key = dateKey(day);
    const planned = plannedByDay.get(key);
    if (planned && planned.planned > 0) {
      return planned.completed >= planned.planned;
    }
    return completedWorkDays.has(key);
  }

  const today = startOfDay();
  let cursor = isStreakDay(today) ? today : addDays(today, -1);
  let currentStreak = 0;

  while (isStreakDay(cursor)) {
    currentStreak += 1;
    cursor = addDays(cursor, -1);
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      stats: {
        currentStreak,
        completedGoals,
        totalGoals,
        totalStudyTime: totalStudyTime._sum.estimatedDuration ?? 0,
      },
    },
  });
}

async function archiveAndDeleteGoal(userId: string, goalId: string, options: { markCompleted?: boolean } = {}) {
  const existingGoal = await prisma.goal.findFirst({
    where: { id: goalId, userId },
    select: {
      id: true,
      title: true,
      progress: true,
      actualHoursSpent: true,
      estimatedTotalHours: true,
      status: true,
      priority: true,
      targetDate: true,
      createdAt: true,
    },
  });

  if (!existingGoal) return false;

  const [taskRows, sessionRows, materialCount, progressRows] = await Promise.all([
    prisma.task.findMany({
      where: { goalId, userId },
      orderBy: { createdAt: "asc" },
      select: {
        title: true,
        type: true,
        estimatedDuration: true,
        completed: true,
        completedAt: true,
        scheduledDate: true,
        dueDate: true,
        timeSpent: true,
        isReview: true,
      },
    }),
    prisma.studySession.findMany({
      where: { goalId, userId },
      orderBy: { plannedStartTime: "asc" },
      select: {
        title: true,
        type: true,
        plannedStartTime: true,
        plannedDuration: true,
        actualDuration: true,
        status: true,
      },
    }),
    prisma.material.count({ where: { goalId, userId } }),
    prisma.progress.findMany({
      where: { goalId, userId },
      orderBy: { date: "asc" },
      select: {
        date: true,
        week: true,
        month: true,
        year: true,
        plannedTime: true,
        actualTime: true,
        timeStudied: true,
        tasksPlanned: true,
        tasksCompleted: true,
        completionRate: true,
      },
    }),
  ]);

  const totalTasks = taskRows.length;
  const completedTasks = taskRows.filter((task) => task.completed).length;
  const completedTaskMinutes = taskRows
    .filter((task) => task.completed)
    .reduce((sum, task) => sum + task.estimatedDuration, 0);
  const totalSessions = sessionRows.length;
  const completedSessions = sessionRows.filter((session) => session.status === "completed").length;
  const completedSessionMinutes = sessionRows
    .filter((session) => session.status === "completed")
    .reduce((sum, session) => sum + Math.max(session.actualDuration, session.plannedDuration), 0);
  const taskTypeBreakdown = taskRows.reduce<Record<string, { total: number; completed: number; minutes: number }>>(
    (result, task) => {
      const current = result[task.type] ?? { total: 0, completed: 0, minutes: 0 };
      current.total += 1;
      if (task.completed) {
        current.completed += 1;
        current.minutes += task.estimatedDuration;
      }
      result[task.type] = current;
      return result;
    },
    {}
  );

  const studiedHours = Math.max(existingGoal.actualHoursSpent, completedTaskMinutes / 60, completedSessionMinutes / 60);
  const deletedAt = new Date();
  const archivedProgress = options.markCompleted ? 100 : existingGoal.progress;
  const archivedStatus = options.markCompleted ? "completed" : existingGoal.status;

  await prisma.$transaction([
    prisma.activityLog.create({
      data: {
        userId,
        type: "course_analytics_snapshot",
        description: `Saved analytics history for ${existingGoal.title}`,
        relatedEntityId: goalId,
        relatedEntityType: "AnalyticsSnapshot",
        metadata: {
          goalId,
          title: existingGoal.title,
          studiedHours,
          progress: archivedProgress,
          estimatedTotalHours: existingGoal.estimatedTotalHours,
          status: archivedStatus,
          priority: existingGoal.priority,
          targetDate: existingGoal.targetDate.toISOString(),
          createdAt: existingGoal.createdAt.toISOString(),
          deletedAt: deletedAt.toISOString(),
          totalTasks,
          completedTasks,
          incompleteTasks: totalTasks - completedTasks,
          completedTaskMinutes,
          totalSessions,
          completedSessions,
          completedSessionMinutes,
          materialCount,
          taskTypeBreakdown,
          taskHistory: taskRows.map((task) => ({
            title: task.title,
            type: task.type,
            estimatedDuration: task.estimatedDuration,
            completed: task.completed,
            completedAt: task.completedAt?.toISOString() ?? null,
            scheduledDate: task.scheduledDate?.toISOString() ?? null,
            dueDate: task.dueDate?.toISOString() ?? null,
            timeSpent: task.timeSpent,
            isReview: task.isReview,
          })),
          sessionHistory: sessionRows.map((session) => ({
            title: session.title,
            type: session.type,
            plannedStartTime: session.plannedStartTime.toISOString(),
            plannedDuration: session.plannedDuration,
            actualDuration: session.actualDuration,
            status: session.status,
          })),
          progressHistory: progressRows.map((row) => ({
            date: row.date.toISOString(),
            week: row.week,
            month: row.month,
            year: row.year,
            plannedTime: row.plannedTime,
            actualTime: row.actualTime,
            timeStudied: row.timeStudied,
            tasksPlanned: row.tasksPlanned,
            tasksCompleted: row.tasksCompleted,
            completionRate: row.completionRate,
          })),
        },
      },
    }),
    prisma.task.deleteMany({ where: { goalId, userId } }),
    prisma.studySession.deleteMany({ where: { goalId, userId } }),
    prisma.studyPlan.deleteMany({ where: { goalId, userId } }),
    prisma.progress.deleteMany({ where: { goalId, userId } }),
    prisma.flashcard.deleteMany({ where: { goalId, userId } }),
    prisma.material.deleteMany({ where: { goalId, userId } }),
    prisma.notification.deleteMany({ where: { relatedEntityId: goalId, relatedEntityType: "Goal", userId } }),
    prisma.goal.deleteMany({ where: { id: goalId, userId } }),
  ]);

  return true;
}

async function ensureMissingExamsForReadyGoals(userId: string) {
  const goals = await prisma.goal.findMany({
    where: { userId, type: "academic-course", status: { not: "completed" } },
    select: { id: true },
  });

  const warnings: string[] = [];

  for (const goal of goals) {
    const [learningTasks, remainingLearningTasks, openExamTasks] = await Promise.all([
      prisma.task.count({
        where: { userId, goalId: goal.id, type: { not: "quiz" }, NOT: { reviewSchedule: isFailedCompletionReviewFilter() } },
      }),
      prisma.task.count({
        where: { userId, goalId: goal.id, completed: false, type: { not: "quiz" }, NOT: { reviewSchedule: isFailedCompletionReviewFilter() } },
      }),
      prisma.task.count({
        where: { userId, goalId: goal.id, completed: false, type: "quiz" },
      }),
    ]);

    if (learningTasks === 0 || remainingLearningTasks > 0 || openExamTasks > 0) continue;

    try {
      await createBatchedCompletionTestIfReady(userId, goal.id);
    } catch (error) {
      const message = publicExamGenerationMessage(error instanceof Error ? error.message : null);
      warnings.push(message ?? "AI exam generation is still pending.");
      console.warn("AI exam generation is pending or failed during task sync.", error);
    }
  }

  return warnings;
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const today = startOfDay();
  await prisma.task.updateMany({
    where: {
      userId,
      completed: false,
      scheduledDate: { lt: today },
    },
    data: {
      scheduledDate: today,
      dueDate: today,
    },
  });
  const examWarnings = await ensureMissingExamsForReadyGoals(userId);

  const tasks = await prisma.task.findMany({
    where: { userId },
    orderBy: [{ completed: "asc" }, { dueDate: "asc" }, { scheduledDate: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      goalId: true,
      title: true,
      description: true,
      difficulty: true,
      type: true,
      dueDate: true,
      scheduledDate: true,
      scheduledTime: true,
      completed: true,
      createdAt: true,
      resources: true,
    },
  });

  const visibleTasks: typeof tasks = [];
  const openExamGoalIds = new Set<string>();
  for (const task of tasks) {
    if (task.type === "quiz" && !task.completed) {
      const remainingLearningTasks = await prisma.task.count({
        where: { userId, goalId: task.goalId, completed: false, type: { not: "quiz" }, NOT: { reviewSchedule: isFailedCompletionReviewFilter() } },
      });
      if (remainingLearningTasks > 0) continue;
      if (openExamGoalIds.has(task.goalId)) continue;
      if (!sanitizeCompletionTestResource(task.resources)) continue;
      openExamGoalIds.add(task.goalId);
    }
    visibleTasks.push(task);
  }

  return NextResponse.json({
    examWarnings,
    tasks: visibleTasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      difficulty: task.difficulty,
      type: task.type,
      dueDate: task.dueDate,
      scheduledDate: task.scheduledDate,
      scheduledTime: task.scheduledTime,
      completed: task.completed,
      completionTest: task.type === "quiz" && !task.completed ? sanitizeCompletionTestResource(task.resources) : null,
    })),
  });
}

export async function PATCH(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { id?: string; completed?: boolean };
  if (!body.id || typeof body.completed !== "boolean") {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }

  const existingTask = await prisma.task.findFirst({
    where: { id: body.id, userId },
    select: {
      id: true,
      goalId: true,
      sessionId: true,
      type: true,
      isReview: true,
      reviewSchedule: true,
      completedAt: true,
    },
  });

  if (!existingTask) {
    return NextResponse.json({ message: "Task not found" }, { status: 404 });
  }

  if (existingTask.type === "quiz" && body.completed) {
    return NextResponse.json({ message: "Exam tasks must be completed by submitting the exam." }, { status: 400 });
  }

  const previousCompletionDate = existingTask.completedAt;
  const completionDate = new Date();

  await prisma.task.update({
    where: { id: existingTask.id },
    data: {
      completed: body.completed,
      status: body.completed ? "done" : "not-started",
      completedAt: body.completed ? completionDate : null,
    },
  });

  let generatedTestTaskId: string | null = null;
  let syncWarning: string | null = null;
  let examWarning: string | null = null;
  let remainingLearningTasks: number | null = null;
  let subjectDeleted = false;

  try {
    await syncSessionStatus(userId, existingTask.sessionId);
    const canTriggerExamGeneration = body.completed && !isFailedCompletionReviewTask(existingTask) && existingTask.type !== "review";
    const completedFailedReviewTask = body.completed && isFailedCompletionReviewTask(existingTask);

    if (body.completed) {
      remainingLearningTasks = await prisma.task.count({
        where: {
          userId,
          goalId: existingTask.goalId,
          completed: false,
          type: { not: "quiz" },
          NOT: { reviewSchedule: isFailedCompletionReviewFilter() },
        },
      });

      if (canTriggerExamGeneration && remainingLearningTasks === 0) {
        try {
          generatedTestTaskId = await createBatchedCompletionTestIfReady(userId, existingTask.goalId);
          if (!generatedTestTaskId) {
            examWarning = "All learning tasks are complete, but no active subject was found for exam generation.";
          }
        } catch (error) {
          examWarning = publicExamGenerationMessage(error instanceof Error ? error.message : null);
        }
      }

      if (completedFailedReviewTask) {
        const remainingFailedReviewTasks = await prisma.task.count({
          where: {
            userId,
            goalId: existingTask.goalId,
            completed: false,
            type: "review",
            reviewSchedule: isFailedCompletionReviewFilter(),
          },
        });

        if (remainingFailedReviewTasks === 0) {
          await Promise.all([
            syncDailyProgress(userId, completionDate),
            previousCompletionDate ? syncDailyProgress(userId, previousCompletionDate) : Promise.resolve(),
            syncUserStats(userId),
          ]);
          subjectDeleted = await archiveAndDeleteGoal(userId, existingTask.goalId, { markCompleted: true });
          return NextResponse.json({ ok: true, subjectDeleted, generatedTestTaskId, examWarning, syncWarning, remainingLearningTasks });
        }
      }
    } else if (existingTask.type !== "quiz") {
      await prisma.task.deleteMany({
        where: { userId, goalId: existingTask.goalId, completed: false, type: "quiz" },
      });
    }
    await syncGoalProgress(userId, existingTask.goalId);

    await Promise.all([
      syncDailyProgress(userId, completionDate),
      previousCompletionDate ? syncDailyProgress(userId, previousCompletionDate) : Promise.resolve(),
      syncUserStats(userId),
    ]);
  } catch (error) {
    syncWarning = error instanceof Error ? error.message : "Task was saved, but follow-up sync failed.";
  }

  return NextResponse.json({ ok: true, subjectDeleted, generatedTestTaskId, examWarning, syncWarning, remainingLearningTasks });
}
