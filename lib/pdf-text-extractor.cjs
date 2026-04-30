/* eslint-disable @typescript-eslint/no-require-imports */

const path = require("path");
const { createRequire } = require("module");

const runtimeRequire = createRequire(`${process.cwd()}${path.sep}package.json`);

async function extractWithPdfJs(buffer) {
  const pdfjs = runtimeRequire("pdfjs-dist/legacy/build/pdf.js");
  pdfjs.GlobalWorkerOptions.workerSrc = runtimeRequire.resolve("pdfjs-dist/legacy/build/pdf.worker.js");
  const document = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    standardFontDataUrl: `${path.dirname(runtimeRequire.resolve("pdfjs-dist/package.json"))}/standard_fonts/`,
  }).promise;
  const pageTexts = [];

  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");
      pageTexts.push(pageText);
      page.cleanup();
    }
  } finally {
    await document.destroy();
  }

  return pageTexts.join("\n\n");
}

async function extractWithPdfParse(buffer) {
  const pdfParse = runtimeRequire("pdf-parse/lib/pdf-parse.js");
  const result = await pdfParse(buffer);
  return result.text || "";
}

async function extractPdfText(buffer) {
  const failures = [];

  for (const extractor of [extractWithPdfJs, extractWithPdfParse]) {
    try {
      const text = await extractor(buffer);
      if (typeof text === "string" && text.trim()) {
        return text;
      }
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (failures.length > 0) {
    throw new Error(`Could not extract text from PDF: ${failures.join(" | ")}`);
  }

  return "";
}

module.exports = { extractPdfText };
