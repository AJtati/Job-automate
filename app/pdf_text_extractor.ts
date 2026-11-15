import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

type PDFTextItem = {
  str?: unknown;
  transform?: number[];
  width?: number;
  hasEOL?: boolean;
};

/**
 * Extract selectable text from a PDF without relying on platform utilities.
 * PDF.js runs in-process in Bun, so packaged apps do not need Python, Poppler,
 * Swift command-line tools, or a browser executable to import resume PDFs.
 */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const loadingTask = getDocument({
    data: new Uint8Array(bytes),
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: true,
    verbosity: 0,
  });

  try {
    const document = await loadingTask.promise;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const lines: string[] = [];
      let line = "";
      let previousY: number | undefined;
      let previousEndX: number | undefined;

      const flushLine = () => {
        const trimmed = line.trim();
        if (trimmed) lines.push(trimmed);
        line = "";
        previousY = undefined;
        previousEndX = undefined;
      };

      for (const rawItem of content.items as PDFTextItem[]) {
        if (typeof rawItem.str !== "string") continue;

        const text = rawItem.str;
        const x = rawItem.transform?.[4];
        const y = rawItem.transform?.[5];
        const width = rawItem.width;

        if (
          line &&
          y !== undefined &&
          previousY !== undefined &&
          Math.abs(y - previousY) > 2
        ) {
          flushLine();
        } else if (
          line &&
          x !== undefined &&
          previousEndX !== undefined &&
          x - previousEndX > 1
        ) {
          line += " ";
        }

        line += text;
        if (y !== undefined) previousY = y;
        if (x !== undefined && width !== undefined) previousEndX = x + width;
        if (rawItem.hasEOL) flushLine();
      }

      flushLine();
      pages.push(lines.join("\n"));
      await page.cleanup();
    }

    return pages.join("\n\n");
  } finally {
    await loadingTask.destroy();
  }
}
