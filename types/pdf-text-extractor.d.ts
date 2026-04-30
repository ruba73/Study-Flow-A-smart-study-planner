declare module "@/lib/pdf-text-extractor.cjs" {
  export function extractPdfText(buffer: Buffer): Promise<string>;
}
