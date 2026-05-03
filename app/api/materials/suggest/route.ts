import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateAiJson } from "@/lib/ai-provider";
import { getSessionUserId } from "@/lib/session";

interface SuggestedMaterial {
  title: string;
  url: string;
  type: string;
  reason: string;
}

interface MaterialSuggestionResponse {
  materials: SuggestedMaterial[];
}

function parseSuggestions(text: string): MaterialSuggestionResponse {
  const parsed = JSON.parse(text) as MaterialSuggestionResponse;
  return {
    materials: Array.isArray(parsed.materials) ? parsed.materials : [],
  };
}

function fallbackSuggestions(title: string): SuggestedMaterial[] {
  const encodedTitle = encodeURIComponent(title);
  return [
    {
      title: `${title} official documentation search`,
      url: `https://www.google.com/search?q=${encodedTitle}+official+documentation`,
      type: "Search",
      reason: "Use this to find official references and vendor documentation for the subject.",
    },
    {
      title: `${title} lecture notes search`,
      url: `https://www.google.com/search?q=${encodedTitle}+university+lecture+notes+pdf`,
      type: "Lecture notes",
      reason: "University notes often provide structured explanations and examples.",
    },
    {
      title: `${title} practice exercises search`,
      url: `https://www.google.com/search?q=${encodedTitle}+practice+exercises`,
      type: "Practice",
      reason: "Practice exercises help convert reading into active recall and application.",
    },
  ];
}

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { goalId?: string };
  if (!body.goalId) {
    return NextResponse.json({ message: "Goal id is required" }, { status: 400 });
  }

  const goal = await prisma.goal.findFirst({
    where: { id: body.goalId, userId },
    select: {
      id: true,
      title: true,
      description: true,
      priority: true,
      targetDate: true,
      estimatedTotalHours: true,
    },
  });

  if (!goal) {
    return NextResponse.json({ message: "Subject not found" }, { status: 404 });
  }

  let suggestions: SuggestedMaterial[] = [];
  let fallback = false;
  let aiError: string | null = null;

  try {
    const responseText = await generateAiJson({
      systemInstruction:
        "Suggest high-quality study materials for a student. You are running locally through AI provider and cannot browse the web. Prefer stable official websites, reputable open textbook sites, university resources, and search URLs that help the student find current materials. Return only valid JSON.",
      schemaName: "material_suggestions",
      prompt: `Subject: ${goal.title}
Description: ${goal.description ?? "No description provided"}
Deadline: ${goal.targetDate.toISOString().split("T")[0]}
Estimated hours: ${goal.estimatedTotalHours}

Suggest 5 useful study materials. Include a title, URL, short type label, and reason each helps.
If you are not certain a direct URL exists, use a Google search URL for that exact resource type instead of inventing a URL.`,
      schema: {
        type: "object",
        properties: {
          materials: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                url: { type: "string" },
                type: { type: "string" },
                reason: { type: "string" },
              },
              required: ["title", "url", "type", "reason"],
            },
          },
        },
        required: ["materials"],
      },
      maxTokens: 700,
      requestAttempts: 1,
    });

    suggestions = parseSuggestions(responseText).materials;
  } catch (error) {
    fallback = true;
    aiError = error instanceof Error ? error.message : "Local AI could not suggest materials.";
    suggestions = fallbackSuggestions(goal.title);
  }

  const normalizedSuggestions = suggestions.filter((material) => material.title.trim() && material.url.trim()).slice(0, 5);

  const saved = await prisma.$transaction(
    normalizedSuggestions.map((material) =>
      prisma.material.create({
        data: {
          userId,
          goalId: goal.id,
          title: material.title.trim(),
          source: "suggested",
          url: material.url.trim(),
          status: "suggested",
          metadata: {
            type: material.type,
            reason: material.reason,
          },
        },
        select: {
          id: true,
          title: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          source: true,
          url: true,
          status: true,
          createdAt: true,
        },
      })
    )
  );

  return NextResponse.json({ materials: saved, fallback, aiError });
}
