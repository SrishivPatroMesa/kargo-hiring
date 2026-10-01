// One-time database setup: creates tables and loads the rubric.
// Usage: DATABASE_URL="postgres://..." npm run db:setup   (or put DATABASE_URL in .env.local)
import { readFileSync, existsSync } from "node:fs";
import postgres from "postgres";

if (!process.env.DATABASE_URL && existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*"?([^"\n]+)"?/);
    if (m) process.env.DATABASE_URL = m[1].trim();
  }
}
if (!process.env.DATABASE_URL) { console.error("Set DATABASE_URL first (in .env.local or the shell)."); process.exit(1); }

const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: process.env.DATABASE_URL.includes("localhost") ? false : "require", max: 1 });
try {
  await sql.unsafe(readFileSync("db/schema.sql", "utf8"));
  console.log("Tables ready.");
  await sql.unsafe(readFileSync("db/rubric_seed.sql", "utf8"));
  const rows = await sql`select role, count(*)::int as n, sum(weight)::int as w from rubric_criteria group by role order by role`;
  for (const r of rows) console.log(`rubric_criteria: ${r.role} - ${r.n} criteria, weights ${r.w}%`);
} catch (e) {
  console.error("Setup failed:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
