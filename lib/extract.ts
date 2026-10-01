// Turn an uploaded CV file (PDF, DOCX or TXT) into plain text. No AI involved.
import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";

export async function fileToText(buf: Buffer, filename: string): Promise<string> {
  // Postgres text cannot hold NUL bytes, and some PDFs (e.g. ones exported from design tools) contain them.
  return (await rawText(buf, filename)).replace(/\u0000/g, "").replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g, " ");
}

async function rawText(buf: Buffer, filename: string): Promise<string> {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) {
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await extractText(pdf, { mergePages: false });
    return (Array.isArray(text) ? text.join("\n\n") : text).trim();
  }
  if (lower.endsWith(".docx")) {
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return value.trim();
  }
  if (lower.endsWith(".txt") || lower.endsWith(".md")) return buf.toString("utf8").trim();
  throw new Error(`Unsupported file type: ${filename}. Upload a PDF, DOCX or TXT.`);
}
