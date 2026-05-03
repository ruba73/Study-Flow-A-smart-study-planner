import prisma from "@/lib/prisma";
import { generateAiJson, getAiModel } from "@/lib/ai-provider";

export interface CompletionTestQuestion {
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

function readRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function readCompletionTest(resources: unknown): CompletionTestResource | null {
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

export function sanitizeCompletionTestResource(resources: unknown) {
  const test = readCompletionTest(resources);
  if (!test || test.questions.length === 0) return null;
  return {
    generatedBy: test.generatedBy ?? "unknown",
    generatedAt: test.generatedAt ?? null,
    aiModel: test.aiModel ?? null,
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

export function hasPassedCompletionTest(resources: unknown) {
  if (!Array.isArray(resources)) return false;
  return resources.some((resource) => {
    const item = readRecord(resource);
    if (item.kind !== "completion-test-result") return false;
    return Boolean(readRecord(item.result).passed);
  });
}

export function hasRequiredExamShape(questions: CompletionTestQuestion[]) {
  return questions.length > 0 && questions.length <= 12;
}

export function publicExamGenerationMessage(message: string | null) {
  if (!message) return null;
  if (message.includes("AI_MODEL")) return "AI provider is not configured.";
  if (message.toLowerCase().includes("user not found")) return "AI provider account could not be resolved. Check the API key and model access.";
  if (message.includes("AI returned") || message.includes("AI did not return")) return message;
  if (message.includes("AI provider")) return "AI provider could not generate a valid exam right now.";
  return "AI could not generate a valid exam from the uploaded material.";
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

function buildTaskMaterialSummary(tasks: Array<{ title: string; description: string | null; resources: unknown; completed?: boolean }>) {
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
        `${index + 1}. ${task.completed ? "Completed" : "Planned"} topic: ${task.title}`,
        task.description ? `Task description: ${task.description}` : "",
        resourceDetails,
      ].filter(Boolean).join("\n");
    })
    .join("\n\n");
}

function readStringField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function readAnswerField(record: Record<string, unknown>) {
  const directAnswer = readStringField(record, ["correctAnswer", "correct_answer", "answer", "correct", "solution"]);
  if (directAnswer) return directAnswer;

  for (const key of ["correctAnswer", "correct_answer", "answer", "correct", "solution"]) {
    const value = record[key];
    if (typeof value === "boolean") return value ? "True" : "False";
  }

  return "";
}

function normalizeGeneratedType(value: unknown, expectedType?: CompletionTestQuestion["type"]): CompletionTestQuestion["type"] {
  if (expectedType) return expectedType;

  const rawType = typeof value === "string" ? value.trim().toLowerCase().replace(/[\s-]+/g, "_") : "";
  if (["true_false", "true/false", "boolean", "bool", "tf", "t_f"].includes(rawType)) return "true_false";
  if (["short_answer", "short", "free", "free_response", "open_ended"].includes(rawType)) return "short_answer";
  return "mcq";
}

function parseGeneratedTest(text: string, expectedType?: CompletionTestQuestion["type"]): CompletionTestQuestion[] {
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
      const type = normalizeGeneratedType(item.type, expectedType);
      const questionText = readStringField(item, ["question", "prompt", "stem", "text"]);
      let correctAnswer = readAnswerField(item);
      if (type === "true_false") {
        const normalizedAnswer = correctAnswer.toLowerCase();
        if (["true", "t", "yes"].includes(normalizedAnswer)) correctAnswer = "True";
        if (["false", "f", "no"].includes(normalizedAnswer)) correctAnswer = "False";
      }
      const topic = typeof item.topic === "string" && item.topic.trim() ? item.topic.trim() : "General review";
      const difficulty =
        item.difficulty === "easy" || item.difficulty === "hard" || item.difficulty === "medium" ? item.difficulty : "medium";
      const options =
        type === "true_false"
          ? ["True", "False"]
          : Array.isArray(item.options)
            ? item.options.filter((option): option is string => typeof option === "string" && option.trim().length > 0).map((option) => option.trim())
            : [];
      if (!questionText || !correctAnswer) return null;
      if (badQuestionPatterns.some((pattern) => pattern.test(questionText))) return null;
      const mcqOptions = Array.from(new Set([correctAnswer, ...options])).slice(0, 4);
      if (type === "mcq" && mcqOptions.some((option) => /^((completed )?task|planned topic|task description|material|study focus|planned question):/i.test(option))) {
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

function examQuestionSchema() {
  return {
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
  };
}

async function generateCompleteAiExam(args: {
  subjectTitle: string;
  subjectDescription: string | null;
  difficulty: number;
  topics: unknown;
  materialSummary: string;
  taskMaterialSummary: string;
}) {
  let lastError: string | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const responseText = await generateAiJson({
        systemInstruction:
          "You are an expert university exam writer. Return only valid JSON. Keep questions concise and original.",
        schemaName: "completion_test",
        prompt: `Create an exam with no more than 12 questions for this subject.

Subject: ${args.subjectTitle}
Description: ${args.subjectDescription ?? "No description provided"}
Difficulty: ${args.difficulty}/5
Topics: ${Array.isArray(args.topics) ? args.topics.join(", ") || "Not listed" : "Not listed"}

Study tasks:
${args.taskMaterialSummary || "No study-task material was found."}

Uploaded/readable material:
${args.materialSummary || "No readable uploaded material text is available."}

Rules:
Return between 1 and 12 total questions. Choose the number and mix of question types based on the available material.
Allowed question types are "mcq", "true_false", and "short_answer".
Questions must test direct knowledge, application, comparison, interpretation, debugging, calculation, or scenario reasoning.
Do not ask meta questions about the material.
Do not use task titles, file names, or labels as answers.
Every MCQ must have exactly 4 plausible options and correctAnswer must exactly match one option.
Every true/false question must have options ["True", "False"] and correctAnswer exactly "True" or "False".
Every short-answer question must have options [] and correctAnswer must describe the expected key points.
Every question must include a specific topic and difficulty.`,
        schema: examQuestionSchema(),
        maxTokens: 2800,
        temperature: 0.1,
        timeoutMs: 90_000,
        requestAttempts: 2,
      });

      const questions = trimToRequiredShape(parseGeneratedTest(responseText));
      if (hasRequiredExamShape(questions)) {
        return questions;
      }
      lastError =
        questions.length === 0
          ? "AI did not return any valid exam questions."
          : `AI returned ${questions.length} valid questions, but the exam can have at most 12 questions.`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "AI exam generation failed.";
    }
  }

  throw new Error(lastError ?? "AI could not generate a valid exam.");
}

export async function createCompletionTestIfReady(userId: string, goalId: string, scheduledDate?: Date) {
  const goal = await prisma.goal.findFirst({
    where: { id: goalId, userId },
    select: { id: true, title: true, description: true, difficulty: true, topics: true },
  });

  if (!goal) return null;

  const completedExamTasks = await prisma.task.findMany({
    where: { userId, goalId, completed: true, type: "quiz" },
    select: { resources: true },
  });
  if (completedExamTasks.some((task) => hasPassedCompletionTest(task.resources))) return null;

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
    return existingExam.id;
  }
  if (openExamTasks.length > 0) {
    await prisma.task.deleteMany({ where: { userId, goalId, id: { in: openExamTasks.map((task) => task.id) }, completed: false, type: "quiz" } });
  }

  const [materials, learningTasks] = await Promise.all([
    prisma.material.findMany({
      where: { userId, goalId },
      select: { title: true, source: true, url: true, metadata: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.task.findMany({
      where: { userId, goalId, type: { not: "quiz" } },
      select: { title: true, description: true, resources: true, completed: true },
      orderBy: [{ completed: "desc" }, { scheduledDate: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const materialSummary = buildMaterialSummary(materials);
  const taskMaterialSummary = buildTaskMaterialSummary(learningTasks);
  let questions: CompletionTestQuestion[] = [];
  let aiGenerationError: string | null = null;

  try {
    questions = await generateCompleteAiExam({
      subjectTitle: goal.title,
      subjectDescription: goal.description,
      difficulty: goal.difficulty,
      topics: goal.topics,
      materialSummary,
      taskMaterialSummary,
    });
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

  const examDate = scheduledDate ?? new Date();
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
      dueDate: examDate,
      scheduledDate: examDate,
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

  const duplicateExams = await prisma.task.findMany({
    where: { userId, goalId, completed: false, type: "quiz", id: { not: testTask.id } },
    select: { id: true },
  });
  if (duplicateExams.length > 0) {
    await prisma.task.deleteMany({ where: { id: { in: duplicateExams.map((task) => task.id) }, userId, goalId, completed: false, type: "quiz" } });
  }

  return testTask.id;
}
