import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import JSZip from "jszip";
import mammoth from "mammoth";

export const runtime = "nodejs";

const MAX_STORED_TEXT_CHARS = 120_000;

const supportedMimeTypes = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const supportedExtensions = [".pdf", ".txt", ".md", ".doc", ".docx", ".pptx"];

function isSupportedMaterialFile(file: File) {
  const fileName = file.name.toLowerCase();
  return supportedMimeTypes.has(file.type) || supportedExtensions.some((extension) => fileName.endsWith(extension));
}

function normalizeMimeType(file: File) {
  const fileName = file.name.toLowerCase();
  if (file.type) return file.type;
  if (fileName.endsWith(".txt")) return "text/plain";
  if (fileName.endsWith(".md")) return "text/markdown";
  if (fileName.endsWith(".doc")) return "application/msword";
  if (fileName.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (fileName.endsWith(".pptx")) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  return "application/pdf";
}

function normalizeExtractedText(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function decodeXmlText(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

function slideNumber(path: string) {
  const match = path.match(/slide(\d+)\.xml$/);
  return match ? Number(match[1]) : 0;
}

async function extractPptxText(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.values(zip.files)
    .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/.test(entry.name))
    .sort((a, b) => slideNumber(a.name) - slideNumber(b.name));

  const slides = await Promise.all(
    slideFiles.map(async (entry) => {
      const xml = await entry.async("text");
      const textRuns = Array.from(xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g))
        .map((match) => decodeXmlText(match[1] ?? "").trim())
        .filter(Boolean);
      return textRuns.join("\n");
    })
  );

  return slides
    .map((slideText, index) => slideText ? `Slide ${index + 1}\n${slideText}` : "")
    .filter(Boolean)
    .join("\n\n");
}

async function extractMaterialText(file: File, mimeType: string) {
  const fileName = file.name.toLowerCase();

  try {
    let text = "";

    if (mimeType === "text/plain" || mimeType === "text/markdown" || fileName.endsWith(".txt") || fileName.endsWith(".md")) {
      text = await file.text();
    } else if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
      const { extractPdfText } = await import("@/lib/pdf-text-extractor.cjs");
      text = await extractPdfText(Buffer.from(await file.arrayBuffer()));
    } else if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileName.endsWith(".docx")
    ) {
      const result = await mammoth.extractRawText({ buffer: Buffer.from(await file.arrayBuffer()) });
      text = result.value;
    } else if (
      mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
      fileName.endsWith(".pptx")
    ) {
      text = await extractPptxText(Buffer.from(await file.arrayBuffer()));
    } else {
      return {
        extractedText: "",
        extractionStatus: "unsupported",
        extractionError: "Text extraction is only available for PDF, TXT, Markdown, DOCX, and PPTX files.",
      };
    }

    const normalizedText = normalizeExtractedText(text);
    return {
      extractedText: normalizedText.slice(0, MAX_STORED_TEXT_CHARS),
      extractedCharCount: normalizedText.length,
      extractionStatus: normalizedText ? "ready" : "empty",
      extractionTruncated: normalizedText.length > MAX_STORED_TEXT_CHARS,
    };
  } catch (error) {
    return {
      extractedText: "",
      extractionStatus: "failed",
      extractionError: error instanceof Error ? error.message : "Could not extract text from this file.",
    };
  }
}

export async function GET(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const goalId = request.nextUrl.searchParams.get("goalId");
  if (!goalId) {
    return NextResponse.json({ message: "Goal id is required" }, { status: 400 });
  }

  const materials = await prisma.material.findMany({
    where: { userId, goalId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      source: true,
      url: true,
      status: true,
      metadata: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    materials: materials.map((material) => {
      const metadata = material.metadata && typeof material.metadata === "object" && !Array.isArray(material.metadata)
        ? (material.metadata as Record<string, unknown>)
        : {};

      return {
        ...material,
        metadata: undefined,
        extractionStatus:
          typeof metadata.extractionStatus === "string"
            ? metadata.extractionStatus
            : material.source === "upload"
              ? "not-extracted"
              : null,
        extractionError: typeof metadata.extractionError === "string" ? metadata.extractionError : null,
        extractionTruncated: Boolean(metadata.extractionTruncated),
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const goalId = String(formData.get("goalId") ?? "");
  const files = formData.getAll("files").filter((item): item is File => item instanceof File);
  const legacyFile = formData.get("file");
  if (legacyFile instanceof File) {
    files.push(legacyFile);
  }

  if (!goalId || files.length === 0) {
    return NextResponse.json({ message: "Goal and at least one material file are required" }, { status: 400 });
  }

  const unsupportedFile = files.find((file) => !isSupportedMaterialFile(file));
  if (unsupportedFile) {
    return NextResponse.json({ message: "Upload a PDF, text, Markdown, DOC, DOCX, or PPTX file" }, { status: 400 });
  }

  const goal = await prisma.goal.findFirst({
    where: { id: goalId, userId },
    select: { id: true, title: true },
  });

  if (!goal) {
    return NextResponse.json({ message: "Subject not found" }, { status: 404 });
  }

  const materials = [];

  for (const file of files) {
    const mimeType = normalizeMimeType(file);
    const extracted = await extractMaterialText(file, mimeType);
    const material = await prisma.material.create({
      data: {
        userId,
        goalId,
        title: file.name.replace(/\.(pdf|txt|md|docx?|pptx)$/i, ""),
        fileName: file.name,
        mimeType,
        sizeBytes: file.size,
        source: "upload",
        status: extracted.extractionStatus === "failed" ? "needs-review" : "ready",
        metadata: {
          provider: "local",
          ...extracted,
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
    });

    materials.push(material);
  }

  return NextResponse.json({
    materials,
    failedFiles: materials.filter((material) => material.status === "needs-review").map((material) => material.fileName),
  }, { status: 201 });
}
