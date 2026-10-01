import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sql, type Role } from "./db";
import { parseRubric, type Criterion } from "./rubric-parse";

/** Loads the rubric from the database. If the table is empty, seeds it from rubric.txt first. */
export async function getRubric(): Promise<Record<Role, Criterion[]>> {
  let rows = await sql<Criterion[]>`select role, position, name, strong, weak, weight, source from rubric_criteria order by role, position`;
  if (rows.length === 0) {
    const crit = parseRubric(readFileSync(join(process.cwd(), "rubric.txt"), "utf8"));
    for (const c of crit) {
      await sql`insert into rubric_criteria (role, position, name, strong, weak, weight, source)
        values (${c.role}, ${c.position}, ${c.name}, ${c.strong}, ${c.weak}, ${c.weight}, ${c.source})
        on conflict (role, name) do nothing`;
    }
    rows = await sql<Criterion[]>`select role, position, name, strong, weak, weight, source from rubric_criteria order by role, position`;
  }
  return { PM: rows.filter((r) => r.role === "PM"), SPM: rows.filter((r) => r.role === "SPM") };
}
