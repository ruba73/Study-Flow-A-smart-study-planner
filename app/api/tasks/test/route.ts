import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateAiJson } from "@/lib/ai-provider";
import { getSessionUserId } from "@/lib/session";
import { Prisma } from "@prisma/client";

interface TestQuestion {
  id: string;
  type: "mcq" | "true_false" | "short_answer";
  question: string;
  options?: string[];
  correctAnswer: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
}

interface TestResult {
  score: number;
  passed: boolean;
  feedback: string;
  strengths: string[];
  weakPoints: string[];
  questionResults: Array<{
    questionId: string;
    correct: boolean;
    score: number;
    feedback: string;
    topic: string;
  }>;
}

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

function readRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function readStoredTestResult(resources: unknown): TestResult | null {
  if (!Array.isArray(resources)) return null;
  const storedResult = resources.find((item) => readRecord(item).kind === "completion-test-result");
  const result = readRecord(readRecord(storedResult).result);
  if (typeof result.score !== "number" || typeof result.passed !== "boolean") return null;

  return {
    score: result.score,
    passed: result.passed,
    feedback: typeof result.feedback === "string" ? result.feedback : "",
    strengths: Array.isArray(result.strengths) ? result.strengths.filter((item): item is string => typeof item === "string") : [],
    weakPoints: Array.isArray(result.weakPoints) ? result.weakPoints.filter((item): item is string => typeof item === "string") : [],
    questionResults: Array.isArray(result.questionResults)
      ? result.questionResults.map((item) => {
          const record = readRecord(item);
          return {
            questionId: typeof record.questionId === "string" ? record.questionId : "",
            correct: Boolean(record.correct),
            score: Math.max(0, Math.min(100, Math.round(Number(record.score) || 0))),
            feedback: typeof record.feedback === "string" ? record.feedback : "",
            topic: typeof record.topic === "string" ? record.topic : "General review",
          };
        })
      : [],
  };
}

function readQuestions(resources: unknown): TestQuestion[] {
  if (!Array.isArray(resources)) return [];
  const test = resources.find((item) => readRecord(item).kind === "completion-test");
  const questions = Array.isArray(readRecord(test).questions) ? readRecord(test).questions as unknown[] : [];

  return questions
    .map((question, index): TestQuestion | null => {
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
        options,
        correctAnswer,
        topic,
        difficulty,
      };
    })
    .filter((question): question is TestQuestion => Boolean(question));
}

function parseGrade(text: string, questions: TestQuestion[]): TestResult {
  const parsed = readRecord(JSON.parse(text));
  const questionResults = Array.isArray(parsed.questionResults)
    ? parsed.questionResults.map((result) => {
        const item = readRecord(result);
        return {
          questionId: typeof item.questionId === "string" ? item.questionId : "",
          correct: Boolean(item.correct),
          score: Math.max(0, Math.min(100, Math.round(Number(item.score) || 0))),
          feedback: typeof item.feedback === "string" ? item.feedback : "",
          topic: typeof item.topic === "string" ? item.topic : "General review",
        };
      })
    : [];

  const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));
  return {
    score,
    passed: score >= 60,
    feedback: typeof parsed.feedback === "string" ? parsed.feedback : "",
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths.filter((item): item is string => typeof item === "string") : [],
    weakPoints: Array.isArray(parsed.weakPoints) ? parsed.weakPoints.filter((item): item is string => typeof item === "string") : [],
    questionResults: questionResults.length > 0 ? questionResults : questions.map((question) => ({
      questionId: question.id,
      correct: false,
      score: 0,
      feedback: "No grading details returned.",
      topic: question.topic,
    })),
  };
}

function fallbackGrade(questions: TestQuestion[], answers: Record<string, string>): TestResult {
  const shortAnswerOnly = questions.every((question) => question.type === "short_answer");
  if (shortAnswerOnly) {
    const results = questions.map((question) => {
      const answer = (answers[question.id] ?? "").trim();
      const wordCount = answer.split(/\s+/).filter(Boolean).length;
      const score = wordCount >= 20 ? 100 : wordCount >= 10 ? 70 : 0;
      return {
        questionId: question.id,
        correct: score >= 70,
        score,
        feedback: score >= 70 ? "Accepted. Your answer is detailed enough for a manual review check." : "Add more detail, including an example or use case.",
        topic: question.topic,
      };
    });
    const score = Math.round(results.reduce((sum, result) => sum + result.score, 0) / Math.max(1, results.length));
    const weakPoints = Array.from(new Set(results.filter((result) => !result.correct).map((result) => result.topic)));
    return {
      score,
      passed: score >= 60,
      feedback: score >= 60 ? "You passed the review check." : "Expand the weak answers and review those topics again.",
      strengths: Array.from(new Set(results.filter((result) => result.correct).map((result) => result.topic))),
      weakPoints,
      questionResults: results,
    };
  }

  const results = questions.map((question) => {
    const answer = (answers[question.id] ?? "").trim().toLowerCase();
    const expected = question.correctAnswer.trim().toLowerCase();
    const correct = (question.type === "mcq" || question.type === "true_false") && answer === expected;
    return {
      questionId: question.id,
      correct,
      score: correct ? 100 : 0,
      feedback: correct ? "Correct." : `Expected: ${question.correctAnswer}`,
      topic: question.topic,
    };
  });
  const score = Math.round(results.reduce((sum, result) => sum + result.score, 0) / Math.max(1, results.length));
  const weakPoints = Array.from(new Set(results.filter((result) => !result.correct).map((result) => result.topic)));
  return {
    score,
    passed: score >= 60,
    feedback: score >= 60 ? "You passed the completion test." : "Review the weak points and complete the new tasks before retaking the test.",
    strengths: Array.from(new Set(results.filter((result) => result.correct).map((result) => result.topic))),
    weakPoints,
    questionResults: results,
  };
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function isFailedCompletionReviewFilter() {
  return { path: "$.source", equals: "failed-completion-test" } as const;
}

async function syncGoalProgress(userId: string, goalId: string) {
  const [totalTasks, completedTasks, completedDuration, openExamTasks] = await Promise.all([
    prisma.task.count({ where: { userId, goalId, type: { not: "quiz" }, NOT: { reviewSchedule: isFailedCompletionReviewFilter() } } }),
    prisma.task.count({ where: { userId, goalId, completed: true, type: { not: "quiz" }, NOT: { reviewSchedule: isFailedCompletionReviewFilter() } } }),
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

async function createWeakPointTasks(userId: string, goalId: string, weakPoints: string[]) {
  const uniqueWeakPoints = Array.from(new Set(weakPoints.map((point) => point.trim()).filter(Boolean))).slice(0, 5);
  const today = startOfDay();

  await prisma.task.deleteMany({
    where: {
      userId,
      goalId,
      completed: false,
      type: "review",
      reviewSchedule: isFailedCompletionReviewFilter(),
    },
  });

  for (const [index, weakPoint] of uniqueWeakPoints.entries()) {
    const scheduledDate = addDays(today, index);
    await prisma.task.create({
      data: {
        userId,
        goalId,
        title: `Review weak point: ${weakPoint}`,
        description: `Re-study ${weakPoint}, write a short explanation in your own words, and solve or create two practice questions before retaking the subject test.`,
        type: "review",
        estimatedDuration: 45,
        difficulty: 3,
        status: "not-started",
        dueDate: scheduledDate,
        scheduledDate,
        scheduledTime: "09:00",
        completed: false,
        timeSpent: 0,
        isReview: true,
        reviewSchedule: { source: "failed-completion-test" },
        resources: [{ kind: "weak-point-review", weakPoint }],
        dependsOn: [],
        linkedTasks: [],
        isManual: false,
      },
    });
  }
}

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { taskId?: string; answers?: Record<string, string> };
  if (!body.taskId || !body.answers || typeof body.answers !== "object") {
    return NextResponse.json({ message: "Task id and answers are required" }, { status: 400 });
  }

  const task = await prisma.task.findFirst({
    where: { id: body.taskId, userId, type: "quiz" },
    select: { id: true, goalId: true, title: true, resources: true, completed: true },
  });

  if (!task) {
    return NextResponse.json({ message: "Test task not found. Refresh Tasks and try again." }, { status: 404 });
  }

  if (task.completed) {
    const storedResult = readStoredTestResult(task.resources);
    if (storedResult) {
      return NextResponse.json({
        result: storedResult,
        nextAction: storedResult.passed ? "completed" : "review",
      });
    }

    return NextResponse.json({ message: "This test was already submitted. Refresh Tasks to see the latest state." }, { status: 409 });
  }

  const goal = await prisma.goal.findFirst({
    where: { id: task.goalId, userId },
    select: { id: true, title: true },
  });

  if (!goal) {
    return NextResponse.json({ message: "Subject not found" }, { status: 404 });
  }

  const questions = readQuestions(task.resources);
  if (questions.length === 0) {
    return NextResponse.json({ message: "This test does not have questions." }, { status: 400 });
  }

  let result: TestResult;
  if (questions.every((question) => question.type === "short_answer")) {
    result = fallbackGrade(questions, body.answers);
  } else {
  try {
    const responseText = await generateAiJson({
      systemInstruction:
        "You are a strict but fair academic grader. Grade only against the answer key and accepted key points. Return only valid JSON.",
      schemaName: "completion_test_grade",
      prompt: `Grade this subject completion test. Passing is 60%.

Subject: ${goal.title}

Questions, answer key, and student answers:
${questions
  .map((question, index) => `${index + 1}. ID: ${question.id} [${question.type}] Topic: ${question.topic}; Difficulty: ${question.difficulty}
Question: ${question.question}
Correct answer/key points: ${question.correctAnswer}
Student answer: ${(body.answers?.[question.id] ?? "").trim() || "[blank]"}`)
  .join("\n\n")}

For MCQ and true/false answers, mark correct only when the selected answer matches the key. For short answers, give partial credit based on correctness, completeness, and use of the expected key points.
Return concise feedback. If the score is 60 or more, include what the student did well and what still went wrong. If below 60, list weakPoints as concrete topics to review.`,
      schema: {
        type: "object",
        properties: {
          score: { type: "integer" },
          feedback: { type: "string" },
          strengths: { type: "array", items: { type: "string" } },
          weakPoints: { type: "array", items: { type: "string" } },
          questionResults: {
            type: "array",
            items: {
              type: "object",
              properties: {
                questionId: { type: "string" },
                correct: { type: "boolean" },
                score: { type: "integer" },
                feedback: { type: "string" },
                topic: { type: "string" },
              },
              required: ["questionId", "correct", "score", "feedback", "topic"],
            },
          },
        },
        required: ["score", "feedback", "strengths", "weakPoints", "questionResults"],
      },
      maxTokens: 900,
      requestAttempts: 1,
    });
    result = parseGrade(responseText, questions);
  } catch {
    result = fallbackGrade(questions, body.answers);
  }
  }

  const completedAt = new Date();
  await prisma.task.update({
    where: { id: task.id },
    data: {
      completed: true,
      completedAt,
      status: "done",
      resources: toJsonValue([
        ...(Array.isArray(task.resources) ? task.resources : []),
        { kind: "completion-test-result", answers: body.answers, result },
      ]),
    },
  });

  if (result.passed) {
    await prisma.goal.updateMany({
      where: { id: goal.id, userId },
      data: { status: "completed", progress: 100 },
    });
  } else {
    const weakPoints =
      result.weakPoints.length > 0
        ? result.weakPoints
        : Array.from(new Set(result.questionResults.filter((item) => !item.correct).map((item) => item.topic)));
    await createWeakPointTasks(userId, goal.id, weakPoints);
    await syncGoalProgress(userId, goal.id);
    await prisma.goal.updateMany({
      where: { id: goal.id, userId, status: { not: "completed" } },
      data: { status: "in-progress", progress: 95 },
    });
  }

  return NextResponse.json({
    result,
    nextAction: result.passed ? "completed" : "review",
  });
}
