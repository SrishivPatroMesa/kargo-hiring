import { createHash } from "node:crypto";
import { sql, type Role, ROLES } from "./db";
import { fileToText } from "./extract";
import { redactCv } from "./pii";
import { getRubric } from "./rubric";
import { scoreCandidate } from "./scoring";
import { draftInvite, draftRejection } from "./drafts";

export const TOP_N = Math.max(1, parseInt(process.env.TOP_N || "5", 10));
// A candidate also needs at least this weighted score (0-100) to be above the line,
// so a thin applicant pool does not push weak candidates into interviews.
export const MIN_SCORE = Math.max(0, Number(process.env.MIN_SCORE ?? 40));

/** Step 0-1: read the file, split personal details from content (no AI), store, then score on both rubrics. */
export async function ingestCv(opts: { buf: Buffer; filename: string; role: Role; name?: string | null }) {
  const text = await fileToText(opts.buf, opts.filename);
  if (text.replace(/\s/g, "").length < 200) {
    throw new Error("Could not read enough text from this file. If it is a scanned image, upload a text-based PDF or DOCX.");
  }
  const red = redactCv(text, { filename: opts.filename, nameOverride: opts.name });
  const hash = createHash("sha256").update(opts.role + "\n" + red.content).digest("hex");

  const existing = await sql<{ id: string; status: string }[]>`select id, status from candidates where cv_hash = ${hash}`;
  if (existing.length && existing[0].status !== "error") return { id: existing[0].id, duplicate: true };
  if (existing.length) await sql`delete from candidates where id = ${existing[0].id}`;

  const personal = { ...red.personal, source_file: opts.filename };
  const [row] = await sql<{ id: string }[]>`
    insert into candidates (applied_role, personal_details, cv_content, redaction_warnings, cv_hash, status)
    values (${opts.role}, ${sql.json(personal)}, ${red.content}, ${sql.json(red.warnings)}, ${hash}, 'processing')
    returning id`;
  await scoreById(row.id);
  return { id: row.id, duplicate: false };
}

export async function scoreById(id: string) {
  const [c] = await sql<{ cv_content: string }[]>`select cv_content from candidates where id = ${id}`;
  if (!c) throw new Error("Candidate not found");
  try {
    const rubric = await getRubric();
    // Only the redacted CV content goes to the AI.
    const { scores, model } = await scoreCandidate(c.cv_content, rubric);
    for (const s of scores) {
      await sql`insert into scores (candidate_id, role, total, breakdown, model)
        values (${id}, ${s.role}, ${s.total}, ${sql.json(s.breakdown)}, ${model})
        on conflict (candidate_id, role) do update set total = excluded.total, breakdown = excluded.breakdown,
          model = excluded.model, created_at = now()`;
    }
    await sql`update candidates set status = 'scored', error = null, updated_at = now() where id = ${id}`;
  } catch (e) {
    await sql`update candidates set status = 'error', error = ${(e as Error).message.slice(0, 500)}, updated_at = now() where id = ${id}`;
    throw e;
  }
}

/** Recompute the line for each role and refresh any brief/draft that no longer matches the decision. */
export async function applyLine() {
  for (const role of ROLES) {
    await sql`
      with ranked as (
        select c.id, s.total, row_number() over (order by s.total desc, c.created_at asc) as rk
        from candidates c join scores s on s.candidate_id = c.id and s.role = c.applied_role
        where c.status = 'scored' and c.applied_role = ${role}
      )
      , decided as (
        select id, case when rk <= ${TOP_N} and total >= ${MIN_SCORE} then 'invite' else 'reject' end as d from ranked
      )
      update candidates c set system_decision = x.d, updated_at = now()
      from decided x
      where c.id = x.id and c.system_decision is distinct from x.d`;
  }
}

type DraftJob = { id: string; applied_role: Role; cv_content: string; decision: "invite" | "reject" };

async function pendingDrafts(limit?: number, onlyId?: string) {
  return sql<DraftJob[]>`
    select id, applied_role, cv_content, coalesce(founder_decision, system_decision) as decision
    from candidates
    where status = 'scored' and sent_at is null
      and coalesce(founder_decision, system_decision) is not null
      and (email_kind is distinct from coalesce(founder_decision, system_decision)
           or email_body is null
           or (coalesce(founder_decision, system_decision) = 'invite' and brief is null))
      ${onlyId ? sql`and id = ${onlyId}` : sql``}
    order by (coalesce(founder_decision, system_decision) = 'invite') desc, created_at asc
    ${limit ? sql`limit ${limit}` : sql``}`;
}

async function writeDraft(job: DraftJob) {
  if (job.decision === "invite") {
    const [s] = await sql<{ role: Role; total: number; breakdown: never }[]>`
      select role, total::float as total, breakdown from scores where candidate_id = ${job.id} and role = ${job.applied_role}`;
    const d = await draftInvite(job.cv_content, job.applied_role, s as never);
    await sql`update candidates set brief = ${d.brief}, email_kind = 'invite', email_subject = ${d.subject},
      email_body = ${d.body}, email_edited = false, updated_at = now() where id = ${job.id} and sent_at is null`;
  } else {
    const d = await draftRejection(job.cv_content, job.applied_role);
    await sql`update candidates set brief = null, email_kind = 'reject', email_subject = ${d.subject},
      email_body = ${d.body}, email_edited = false, updated_at = now() where id = ${job.id} and sent_at is null`;
  }
}

/** Generates up to `limit` missing/outdated drafts (kept small so each request finishes inside the hosting timeout). */
export async function reconcile(limit = 4, onlyId?: string) {
  await applyLine();
  const jobs = await pendingDrafts(limit, onlyId);
  const errors: string[] = [];
  await Promise.all(
    jobs.map((j) => writeDraft(j).catch((e) => errors.push(`${j.id}: ${(e as Error).message}`)))
  );
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from candidates
    where status = 'scored' and sent_at is null and coalesce(founder_decision, system_decision) is not null
      and (email_kind is distinct from coalesce(founder_decision, system_decision) or email_body is null
           or (coalesce(founder_decision, system_decision) = 'invite' and brief is null))`;
  return { drafted: jobs.length - errors.length, remaining: n, errors };
}
