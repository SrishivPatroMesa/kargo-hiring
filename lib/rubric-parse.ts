// Parses rubric.txt. Format per role section:
//   === PM ===
//   Criterion name: ...
//   What a strong candidate looks like: ...
//   What a weak candidate looks like: ...
//   Weight: 25%
//   Source: ...
export type Criterion = {
  role: "PM" | "SPM";
  position: number;
  name: string;
  strong: string;
  weak: string;
  weight: number;
  source: string | null;
};

export function parseRubric(txt: string): Criterion[] {
  const out: Criterion[] = [];
  const sections = txt.split(/^===\s*(PM|SPM)\s*===\s*$/m);
  // sections = [preamble, "PM", body, "SPM", body]
  for (let i = 1; i < sections.length; i += 2) {
    const role = sections[i] as "PM" | "SPM";
    const blocks = sections[i + 1].split(/^Criterion name:/m).slice(1);
    blocks.forEach((b, idx) => {
      const field = (label: string) => {
        const m = b.match(new RegExp(`^${label}:\\s*([\\s\\S]*?)(?=^\\S[^\\n]*:|$(?![\\s\\S]))`, "m"));
        return m ? m[1].replace(/\s+/g, " ").trim() : "";
      };
      const name = b.split("\n")[0].trim();
      const weight = parseInt(field("Weight").replace("%", ""), 10);
      out.push({
        role,
        position: idx + 1,
        name,
        strong: field("What a strong candidate looks like"),
        weak: field("What a weak candidate looks like"),
        weight,
        source: field("Source") || null,
      });
    });
  }
  for (const role of ["PM", "SPM"] as const) {
    const rows = out.filter((c) => c.role === role);
    const sum = rows.reduce((a, c) => a + c.weight, 0);
    if (rows.length < 4 || rows.length > 6) throw new Error(`rubric.txt: ${role} has ${rows.length} criteria (need 4-6)`);
    if (sum !== 100) throw new Error(`rubric.txt: ${role} weights add up to ${sum}%, not 100%`);
    for (const c of rows) if (!c.name || !c.strong || !c.weak || Number.isNaN(c.weight)) throw new Error(`rubric.txt: incomplete criterion "${c.name}" (${role})`);
  }
  return out;
}
