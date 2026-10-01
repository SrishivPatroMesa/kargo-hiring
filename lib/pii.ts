// Personal-detail extraction and redaction.
// Runs locally in code BEFORE any AI call. Nothing in this file talks to an AI model,
// so the candidate's name, email and phone never leave our server/database.

export type PersonalDetails = {
  name: string | null;
  email: string | null;
  phone: string | null;
};

export type RedactionResult = {
  personal: PersonalDetails;
  content: string; // CV text with personal details removed - the only thing AI ever sees
  warnings: string[]; // anything that looked like it might have survived redaction
};

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const URL_RE =
  /(https?:\/\/[^\s|,;)]+|www\.[^\s|,;)]+|\b(?:linkedin|github|gitlab|behance|dribbble|medium|twitter|x)\.com\/[^\s|,;)]*|\b[\w-]+\.(?:vercel\.app|netlify\.app|github\.io|notion\.site)[^\s|,;)]*)/gi;

const NOT_NAME_WORDS = new Set(
  (
    "resume cv curriculum vitae final updated new latest copy draft pm spm product manager senior " +
    "summary profile experience education skills contact india mumbai bangalore bengaluru delhi pune " +
    "chennai hyderabad kolkata noida gurgaon gurugram strategy operations leader lead head associate " +
    "analyst engineer consultant professional work email phone mobile portfolio linkedin address " +
    "the and of for with at in on new ncr maharashtra karnataka"
  ).split(/\s+/)
);

function titleCase(w: string) {
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Try to read a name from the uploaded file name, e.g. "pm_01_priya_krishnan.pdf" -> "Priya Krishnan". */
export function nameFromFilename(filename: string): string | null {
  const base = filename.replace(/\.[a-z0-9]+$/i, "");
  const words = base
    .split(/[_\-\s.]+/)
    .filter(Boolean)
    .filter((w) => !/^\d+$/.test(w))
    .filter((w) => !NOT_NAME_WORDS.has(w.toLowerCase()));
  if (words.length < 2 || words.length > 4) return null;
  if (!words.every((w) => /^[a-z]{2,}$/i.test(w))) return null;
  return words.map(titleCase).join(" ");
}

/** Fallback: look for a 2-3 word capitalised line near the top of the CV. */
export function nameFromText(text: string): string | null {
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 15);
  for (const raw of lines) {
    // split glued forms like "ROHANMehta" -> "ROHAN Mehta"
    const line = raw.replace(/([A-Z]{2,})([A-Z][a-z])/g, "$1 $2");
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length < 2 || words.length > 4) continue;
    if (!words.every((w) => /^[A-Za-z]{2,}$/.test(w))) continue;
    if (words.some((w) => NOT_NAME_WORDS.has(w.toLowerCase()))) continue;
    if (!words.every((w) => /^[A-Z]/.test(w))) continue;
    // de-duplicate "Rohan Mehta Rohan Mehta" style repeats
    const uniq: string[] = [];
    for (const w of words) if (!uniq.some((u) => u.toLowerCase() === w.toLowerCase())) uniq.push(w);
    if (uniq.length >= 2) return uniq.slice(0, 3).map(titleCase).join(" ");
  }
  return null;
}

/** Indian mobile numbers. CV text layers often glue or duplicate digit groups
 *  ("+91 98202 1134598202 11345"), and designed CVs put the contact block anywhere in the text. */
function findPhone(text: string): { display: string | null; parts: string[] } {
  const re = /(?<![\d.,₹$])(\+\s?91[\s-]*)?([6-9]\d{4})[\s-]?(\d{5})/g;
  let best: RegExpExecArray | null = null;
  for (let m; (m = re.exec(text)); ) {
    if (m[1]) { best = m; break; } // a +91-prefixed number is the strongest signal
    if (!best) best = m;
  }
  if (!best) return { display: null, parts: [] };
  return { display: `+91 ${best[2]} ${best[3]}`, parts: [best[2], best[3]] };
}

export function redactCv(text: string, opts: { filename?: string; nameOverride?: string | null }): RedactionResult {
  const warnings: string[] = [];
  const clean = text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    // "HARSH REDDYsquad_5@..." -> "HARSH REDDY squad_5@..." (name glued onto email by the PDF layer)
    .replace(/([A-Z]{2,})(?=[a-z0-9._%+-]+@)/g, "$1 ");

  // 1. Detect
  const emails = Array.from(new Set((clean.match(EMAIL_RE) || []).map((e) => e.toLowerCase())));
  const email = emails[0] || null;
  const phone = findPhone(clean);
  const name =
    (opts.nameOverride && opts.nameOverride.trim()) ||
    (opts.filename ? nameFromFilename(opts.filename) : null) ||
    nameFromText(clean);
  if (!name) warnings.push("Could not detect candidate name - add it manually.");
  if (!email) warnings.push("No email address found in CV.");
  if (!phone.display) warnings.push("No phone number found in CV.");

  // 2. Redact
  let out = clean;
  out = out.replace(EMAIL_RE, "[EMAIL]");
  out = out.replace(URL_RE, "[LINK]");
  // any run of 10+ digits (with spaces/dashes) that contains the detected phone
  out = out.replace(/(?:\+\s?91[\s-]*)?(?:\d[\s-]?){9,}\d/g, (run) => {
    const digits = run.replace(/\D/g, "");
    if (phone.parts.some((p) => digits.includes(p))) return "[PHONE] ";
    if (/^(?:91)?[6-9]\d{9}$/.test(digits)) return "[PHONE] ";
    return run;
  });
  for (const p of phone.parts) out = out.replace(new RegExp(`(?<!\\d)${p}(?!\\d)`, "g"), "[PHONE]");
  out = out.replace(/(Mob(?:ile)?(?: No)?|Phone|Tel|Contact)\s*[:.]?\s*\[PHONE\]/gi, "[PHONE]");

  if (name) {
    const tokens = name.split(/\s+/).filter((t) => t.length >= 2);
    // full name, including glued forms like "ROHANMehta" or "Rohan MEHTA"
    if (tokens.length >= 2) {
      const full = tokens.map(escapeRe).join("[\\s.]*");
      out = out.replace(new RegExp(full, "gi"), "[NAME]");
      const rev = [...tokens].reverse().map(escapeRe).join("[\\s,.]*");
      out = out.replace(new RegExp(rev, "gi"), "[NAME]");
    }
    // each name part on its own
    for (const t of tokens) {
      if (t.length < 3) continue;
      out = out.replace(new RegExp(`(?<![A-Za-z])${escapeRe(t)}(?![a-z])`, "gi"), "[NAME]");
    }
    out = out.replace(/(\[NAME\][\s|]*){2,}/g, "[NAME] ");
  }
  out = out.replace(/(\[PHONE\][\s|]*){2,}/g, "[PHONE] ");
  out = out.replace(/\n{3,}/g, "\n\n").trim();

  // 3. Verify nothing slipped through
  if (EMAIL_RE.test(out)) warnings.push("An email address may remain in CV content.");
  EMAIL_RE.lastIndex = 0;
  if (/(?<!\d)[6-9]\d{4}[\s-]?\d{5}/.test(out) || phone.parts.some((p) => out.includes(p))) warnings.push("A phone number may remain in CV content.");
  if (name) {
    for (const t of name.split(/\s+/)) {
      if (t.length >= 3 && new RegExp(`\\b${escapeRe(t)}\\b`, "i").test(out)) warnings.push(`Name part "${t}" may remain in CV content.`);
    }
  }

  return { personal: { name, email, phone: phone.display }, content: out, warnings };
}
