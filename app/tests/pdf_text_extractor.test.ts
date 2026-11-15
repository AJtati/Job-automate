import { describe, expect, test } from "bun:test";
import { extractPdfText } from "../pdf_text_extractor";

function createTextPdf(firstLine: string, secondLine: string): Uint8Array {
  const content = [
    "BT",
    "/F1 12 Tf",
    "72 720 Td",
    "(" + firstLine + ") Tj",
    "0 -18 Td",
    "(" + secondLine + ") Tj",
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Length " +
      Buffer.byteLength(content, "ascii") +
      " >>\nstream\n" +
      content +
      "\nendstream",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, "ascii"));
    pdf += (index + 1) + " 0 obj\n" + body + "\nendobj\n";
  });

  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += "xref\n0 " + (objects.length + 1) + "\n";
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    pdf += String(offset).padStart(10, "0") + " 00000 n \n";
  }
  pdf +=
    "trailer\n<< /Size " +
    (objects.length + 1) +
    " /Root 1 0 R >>\nstartxref\n" +
    xrefOffset +
    "\n%%EOF\n";

  return new Uint8Array(Buffer.from(pdf, "ascii"));
}

describe("PDF text extraction", () => {
  test("reads selectable text and preserves separate lines", async () => {
    const text = await extractPdfText(
      createTextPdf("Packaging proof", "ATS parse ready"),
    );

    expect(text).toContain("Packaging proof");
    expect(text).toContain("ATS parse ready");
    expect(text).toContain("\n");
  });
});
