import { sql, type Role } from "./db";
import { withName } from "./drafts";
import { TOP_N, MIN_SCORE } from "./pipeline";
import type { CriterionScore } from "./scoring";

export type CandidateView = {
  id: string;
  appliedRole: Role;
  name: string;
  email: string | null;
  phone: string | null;
  sourceFile: string | null;
  status: "processing" | "scored" | "error";
  error: string | null;
  warnings: string[];
  systemDecision: "invite" | "reject" | null;
  founderDecision: "invite" | "reject" | null;
  decision: "invite" | "reject" | null;
  brief: string | null;
  emailKind: "invite" | "reject" | null;
  subject: string;
  body: string;
  draftReady: boolean;
  sentAt: string | null;
  sentTo: string | null;
  cvContent: string;
  scores: Partial<Record<Role, { total: number; breakdown: CriterionScore[] }>>;
  rank: number | null; // rank for applied role among applicants of that role
  crossRank: number | null; // where they would rank among applicants of the other role
};

export async function loadDashboard() {
  const rows = await sql<{
    id: string; applied_role: Role; personal_details: { name?: string; email?: string; phone?: string; source_file?: string };
    status: CandidateView["status"]; error: string | null; redaction_warnings: string[];
    system_decision: CandidateView["systemDecision"]; founder_decision: CandidateView["founderDecision"];
    brief: string | null; email_kind: CandidateView["emailKind"]; email_subject: string | null; email_body: string | null;
    sent_at: Date | null; sent_to: string | null; cv_content: string; created_at: Date;
  }[]>`select * from candidates order by created_at asc`;
  const scoreRows = await sql<{ candidate_id: string; role: Role; total: string; breakdown: CriterionScore[] }[]>`
    select candidate_id, role, total, breakdown from scores`;

  const byId = new Map<string, CandidateView>();
  for (const r of rows) {
    const name = r.personal_details?.name || "Name not detected";
    const decision = r.founder_decision ?? r.system_decision;
    byId.set(r.id, {
      id: r.id, appliedRole: r.applied_role, name, email: r.personal_details?.email || null,
      phone: r.personal_details?.phone || null, sourceFile: r.personal_details?.source_file || null,
      status: r.status, error: r.error, warnings: r.redaction_warnings || [],
      systemDecision: r.system_decision, founderDecision: r.founder_decision, decision,
      brief: r.brief, emailKind: r.email_kind,
      subject: withName(r.email_subject, r.personal_details?.name || null),
      body: withName(r.email_body, r.personal_details?.name || null),
      draftReady: !!r.email_body && r.email_kind === decision && (decision !== "invite" || !!r.brief),
      sentAt: r.sent_at ? r.sent_at.toISOString() : null, sentTo: r.sent_to, cvContent: r.cv_content,
      scores: {}, rank: null, crossRank: null,
    });
  }
  for (const s of scoreRows) {
    const c = byId.get(s.candidate_id);
    if (c) c.scores[s.role] = { total: Number(s.total), breakdown: s.breakdown };
  }
  const all = [...byId.values()];
  for (const role of ["PM", "SPM"] as Role[]) {
    const ranked = all.filter((c) => c.appliedRole === role && c.scores[role]).sort((a, b) => b.scores[role]!.total - a.scores[role]!.total);
    ranked.forEach((c, i) => (c.rank = i + 1));
  }
  for (const c of all) {
    const other: Role = c.appliedRole === "PM" ? "SPM" : "PM";
    const mine = c.scores[other]?.total;
    if (mine === undefined) continue;
    const better = all.filter((o) => o.appliedRole === other && o.scores[other] && o.scores[other]!.total > mine).length;
    c.crossRank = better + 1;
  }
  return { candidates: all, topN: TOP_N, minScore: MIN_SCORE };
}
