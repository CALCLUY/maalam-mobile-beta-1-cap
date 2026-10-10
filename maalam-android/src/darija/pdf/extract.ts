/**
 * Local PDF reading with pdf.js (runs entirely in the browser).
 * Used for page count, a text layer for the tutor, and a fallback when the
 * The maalam document analysis is unavailable.
 */
import type * as PdfJsModule from "pdfjs-dist";
// The worker ships inside the APK as its own asset; ?url resolves to a relative
// path served from the app origin (no jsDelivr).
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

/**
 * pdf.js is only needed once the user opens a PDF, so it stays in its own
 * chunk and is pulled in on first use instead of at startup.
 */
let pdfJsPromise: Promise<typeof PdfJsModule> | null = null;
function ensureWorker(): Promise<typeof PdfJsModule> {
  if (!pdfJsPromise) {
    pdfJsPromise = import("pdfjs-dist").then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      return mod;
    });
  }
  return pdfJsPromise;
}

export type ExtractedPage = { page: number; text: string };

export type ExtractedPdf = {
  pageCount: number;
  pages: ExtractedPage[];
  totalChars: number;
  /** True when most pages have almost no text layer (scanned / photographed). */
  looksScanned: boolean;
};

export class PdfReadError extends Error {
  constructor(
    message: string,
    readonly code: "password" | "invalid" | "unknown",
  ) {
    super(message);
  }
}

type TextItemLike = { str?: string; hasEOL?: boolean };

export async function extractPdfText(data: ArrayBuffer, maxPages = 120): Promise<ExtractedPdf> {
  const { getDocument } = await ensureWorker();
  // pdf.js transfers the buffer to the worker, so give it a copy.
  const task = getDocument({ data: new Uint8Array(data.slice(0)) });
  let pdf;
  try {
    pdf = await task.promise;
  } catch (error) {
    const name = (error as { name?: string })?.name ?? "";
    if (name === "PasswordException") throw new PdfReadError("PDF محمي بكلمة السر.", "password");
    if (name === "InvalidPDFException") throw new PdfReadError("الملف ماشي PDF صالح.", "invalid");
    throw new PdfReadError("ما قدرناش نقراو هاد الـ PDF.", "unknown");
  }

  const pages: ExtractedPage[] = [];
  const limit = Math.min(pdf.numPages, maxPages);
  let lowTextPages = 0;
  for (let number = 1; number <= limit; number += 1) {
    const page = await pdf.getPage(number);
    const content = await page.getTextContent();
    let text = "";
    for (const raw of content.items as TextItemLike[]) {
      if (typeof raw.str !== "string") continue;
      text += raw.str;
      text += raw.hasEOL ? "\n" : " ";
    }
    text = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    if (text.length < 40) lowTextPages += 1;
    pages.push({ page: number, text });
    page.cleanup();
  }
  const pageCount = pdf.numPages;
  await pdf.destroy();

  const totalChars = pages.reduce((sum, page) => sum + page.text.length, 0);
  return { pageCount, pages, totalChars, looksScanned: limit > 0 && lowTextPages / limit > 0.6 };
}
