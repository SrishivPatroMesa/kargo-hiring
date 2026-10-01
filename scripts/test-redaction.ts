// Runs every CV in a folder through text extraction + redaction and reports what was found.
// Usage: npm run test:redaction -- /path/to/resumes
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileToText } from "../lib/extract.ts";
import { redactCv } from "../lib/pii.ts";

const dir = process.argv[2] || "./resumes";
const outDir = process.argv[3];
if (outDir) mkdirSync(outDir, { recursive: true });
let problems = 0;
for (const f of readdirSync(dir).sort()) {
  const text = await fileToText(readFileSync(join(dir, f)), f);
  const r = redactCv(text, { filename: f });
  const flag = r.warnings.length ? "  !! " + r.warnings.join(" | ") : "";
  if (r.warnings.length) problems++;
  console.log(`${f.padEnd(32)} ${String(r.personal.name).padEnd(20)} ${String(r.personal.email).padEnd(28)} ${String(r.personal.phone).padEnd(16)} ${text.length}c${flag}`);
  if (outDir) writeFileSync(join(outDir, f + ".txt"), r.content);
}
console.log(`\n${problems} file(s) with warnings`);
