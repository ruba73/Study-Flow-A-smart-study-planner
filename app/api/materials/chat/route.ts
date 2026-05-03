import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateAiText } from "@/lib/ai-provider";
import { getSessionUserId } from "@/lib/session";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const MAX_TOTAL_CONTEXT_CHARS = 10_000;
const MAX_MATERIAL_CONTEXT_CHARS = 4_000;

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<ChatMessage>;
  return (message.role === "user" || message.role === "assistant") && typeof message.content === "string";
}

function readMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return metadata as Record<string, unknown>;
}

function summarizeMetadata(metadata: unknown) {
  const record = readMetadata(metadata);
  const parts = [
    typeof record.type === "string" ? `type: ${record.type}` : "",
    typeof record.reason === "string" ? `why useful: ${record.reason}` : "",
    typeof record.extractionStatus === "string" ? `text extraction: ${record.extractionStatus}` : "",
  ].filter(Boolean);
  return parts.length > 0 ? ` (${parts.join("; ")})` : "";
}

function buildMaterialContext(materials: Array<{
  title: string;
  fileName: string | null;
  source: string;
  url: string | null;
  status: string;
  metadata: unknown;
}>) {
  if (materials.length === 0) return "No materials are attached to this subject yet.";

  let remainingChars = MAX_TOTAL_CONTEXT_CHARS;

  return materials
    .map((material, index) => {
      const metadata = readMetadata(material.metadata);
      const source = material.source === "upload" ? material.fileName || "uploaded file" : material.url || "suggested resource";
      const extractedText = typeof metadata.extractedText === "string" ? metadata.extractedText.trim() : "";
      const excerptLimit = Math.max(0, Math.min(MAX_MATERIAL_CONTEXT_CHARS, remainingChars));
      const excerpt = extractedText.slice(0, excerptLimit);
      remainingChars -= excerpt.length;

      const details = `${index + 1}. ${material.title} - ${source}; status: ${material.status}${summarizeMetadata(material.metadata)}`;
      if (!excerpt) return details;

      const truncated = metadata.extractionTruncated || extractedText.length > excerpt.length ? "\n[Excerpt truncated for chat context]" : "";
      return `${details}\nExtracted chapter/material text:\n${excerpt}${truncated}`;
    })
    .join("\n\n");
}

function hasExtractedText(materials: Array<{ metadata: unknown }>) {
  return materials.some((material) => {
    const metadata = readMetadata(material.metadata);
    return typeof metadata.extractedText === "string" && metadata.extractedText.trim().length > 0;
  });
}

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    goalId?: string;
    materialId?: string;
    messages?: unknown[];
  };

  if (!body.goalId) {
    return NextResponse.json({ message: "Goal id is required" }, { status: 400 });
  }

  const messages = (body.messages ?? []).filter(isChatMessage).slice(-4);
  const latestQuestion = [...messages].reverse().find((message) => message.role === "user")?.content.trim();
  if (!latestQuestion) {
    return NextResponse.json({ message: "Ask a question first." }, { status: 400 });
  }

  const goal = await prisma.goal.findFirst({
    where: { id: body.goalId, userId },
    select: {
      id: true,
      title: true,
      description: true,
      priority: true,
      difficulty: true,
      targetDate: true,
      topics: true,
    },
  });

  if (!goal) {
    return NextResponse.json({ message: "Subject not found" }, { status: 404 });
  }

  const materials = await prisma.material.findMany({
    where: {
      userId,
      goalId: goal.id,
      ...(body.materialId ? { id: body.materialId } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      title: true,
      fileName: true,
      source: true,
      url: true,
      status: true,
      metadata: true,
    },
  });

  const materialContext = buildMaterialContext(materials);
  const selectedUploadWithoutText =
    body.materialId &&
    materials.length > 0 &&
    !hasExtractedText(materials) &&
    materials.some((material) => material.source === "upload");

  if (selectedUploadWithoutText) {
    return NextResponse.json({
      answer:
        "I do not have readable text for this uploaded material yet. Please re-upload this chapter so I can extract its text, then ask again.",
    });
  }

  try {
    const answer = await generateAiText({
      systemInstruction: `You are a study assistant helping a student with one subject.

Subject: ${goal.title}
Description: ${goal.description ?? "No description provided"}
Priority: ${goal.priority}
Difficulty: ${goal.difficulty}/5
Deadline: ${goal.targetDate.toISOString().split("T")[0]}
Topics: ${Array.isArray(goal.topics) ? goal.topics.join(", ") || "Not listed" : "Not listed"}

Available materials:
${materialContext}

Use the extracted material text as your primary grounding. If the answer is present in the extracted text, explain it directly and cite the material title in plain language. If the needed chapter content was not extracted or is outside the provided excerpt, say that and still help from the available subject/material context. Give concise, useful explanations, examples, quiz questions, or next study steps.`,
      messages,
    });

    return NextResponse.json({ answer });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI chat is unavailable.";
    return NextResponse.json({ message }, { status: 502 });
  }
}
