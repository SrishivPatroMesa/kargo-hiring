// Regenerates db/rubric_seed.sql from rubric.txt. Run after editing rubric.txt:
//   node --experimental-strip-types scripts/make-rubric-seed.ts
import { readFileSync, writeFileSync } from "node:fs";
import { parseRubric } from "../lib/rubric-parse.ts";
const crit = parseRubric(readFileSync("rubric.txt", "utf8"));
const q = (s: string | null) => (s === null ? "null" : `'${s.replace(/'/g, "''")}'`);
const rows = crit.map((c) => `  ('${c.role}', ${c.position}, ${q(c.name)}, ${q(c.strong)}, ${q(c.weak)}, ${c.weight}, ${q(c.source)})`);
writeFileSync("db/rubric_seed.sql", `-- Generated from rubric.txt. Replaces the rubric (scores already given are kept).
delete from rubric_criteria;
insert into rubric_criteria (role, position, name, strong, weak, weight, source) values
${rows.join(",\n")};
`);
console.log(`Wrote ${crit.length} criteria to db/rubric_seed.sql`);
