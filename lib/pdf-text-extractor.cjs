async function extractPdfText(buffer) {
  const pdfjs = require("pdfjs-dist/legacy/build/pdf.js");
  const document = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
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

module.exports = { extractPdfText };
