"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CandidateView } from "@/lib/queries";
import type { Role } from "@/lib/db";

const ROLE_NAME: Record<Role, string> = { PM: "Product Manager", SPM: "Senior Product Manager" };
const COLORS = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--c6)"];

type Props = {
  role: Role;
  candidates: CandidateView[];
  topN: number;
  minScore: number;
  criteria: Record<Role, string[]>;
  warnings: { noPassword: boolean; noResend: boolean; override: string | null };
};

async function api(url: string, init?: RequestInit) {
  const r = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j;
}

export default function Dashboard({ role, candidates, topN, minScore, criteria, warnings }: Props) {
  const router = useRouter();
  const [drafting, setDrafting] = useState<string | null>(null);
  const running = useRef(false);

  const needsDraft = candidates.filter((c) => c.status === "scored" && !c.sentAt && !c.draftReady).length;

  // Keep briefs and drafts in step with the ranking, automatically.
  useEffect(() => {
    if (!needsDraft || running.current) return;
    running.current = true;
    (async () => {
      let remaining = needsDraft;
      let stalls = 0;
      while (remaining > 0 && stalls < 3) {
        setDrafting(`Writing briefs and email drafts: ${remaining} left`);
        try {
          const r = await api("/api/reconcile", { method: "POST", body: JSON.stringify({ limit: 4 }) });
          stalls = r.drafted === 0 ? stalls + 1 : 0;
          if (r.errors?.length) setDrafting(`Some drafts failed, retrying: ${r.errors[0]}`);
          remaining = r.remaining;
        } catch (e) {
          stalls++;
          setDrafting(`Drafting paused: ${(e as Error).message}`);
          await new Promise((res) => setTimeout(res, 3000));
        }
        router.refresh();
      }
      setDrafting(remaining > 0 ? `${remaining} drafts still missing. Reload the page to retry.` : null);
      running.current = false;
    })();
  }, [needsDraft, router]);

  const applicants = candidates.filter((c) => c.appliedRole === role);
  const pending = applicants.filter((c) => c.status !== "scored");
  const ranked = applicants.filter((c) => c.status === "scored" && c.scores[role]).sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  const lineAt = ranked.filter((c, i) => i < topN && c.scores[role]!.total >= minScore).length;
  const count = (r: Role) => candidates.filter((c) => c.appliedRole === r).length;
  const invites = ranked.filter((c) => c.decision === "invite").length;
  const sent = ranked.filter((c) => c.sentAt).length;
  const other: Role = role === "PM" ? "SPM" : "PM";
  const crossFits = candidates.filter((c) => c.appliedRole === other && c.status === "scored" && c.crossRank !== null && c.crossRank <= topN);

  return (
    <>
      {warnings.noPassword && <div className="banner">APP_PASSWORD is not set, so anyone with this link can see candidates&apos; details. Set it in your hosting environment variables.</div>}
      {warnings.noResend && <div className="banner info">Sending is off until RESEND_API_KEY is set. You can still review and edit every draft.</div>}
      {warnings.override && <div className="banner info">Test mode: every email goes to {warnings.override} instead of the candidate.</div>}

      <div className="tabs" role="tablist">
        {(["PM", "SPM"] as Role[]).map((r) => (
          <Link key={r} href={`/?role=${r}`} className={r === role ? "on" : ""} role="tab" aria-selected={r === role}>
            {ROLE_NAME[r]} ({count(r)})
          </Link>
        ))}
      </div>

      <p className="summary">
        <span><b className="num">{ranked.length}</b> ranked</span>
        <span><b className="num">{invites}</b> to interview</span>
        <span><b className="num">{ranked.length - invites}</b> to decline</span>
        <span><b className="num">{sent}</b> emails sent</span>
        {drafting && <span className="st-processing">{drafting}</span>}
      </p>

      {pending.length > 0 && (
        <div className="list" style={{ marginBottom: 20 }}>
          {pending.map((c) => <PendingRow key={c.id} c={c} onChange={() => router.refresh()} />)}
        </div>
      )}

      <div className="list">
        {ranked.map((c, i) => (
          <div key={c.id}>
            {i === 0 && lineAt === 0 && (
              <div className="line">No one scores {minScore} or more yet, so every draft is a decline. You can switch anyone to interview.</div>
            )}
            <Row c={c} role={role} topN={topN} names={criteria[role]} onChange={() => router.refresh()} />
            {i === lineAt - 1 && ranked.length > lineAt && (
              <div className="line">Interview line: the top {topN} scoring {minScore} or more get an invitation draft. Everyone below gets a decline draft. You can switch anyone.</div>
            )}
          </div>
        ))}
      </div>

      {crossFits.length > 0 && (
        <p className="note" style={{ marginTop: 18 }}>
          Applied for {ROLE_NAME[other]} but would rank in the top {topN} here:{" "}
          {crossFits.map((c, i) => (
            <span key={c.id}>{i > 0 && ", "}{c.name} ({c.scores[role]?.total.toFixed(1)})</span>
          ))}
          . Their {ROLE_NAME[other]} draft is unaffected.
        </p>
      )}
    </>
  );
}

function Bar({ breakdown }: { breakdown: { weight: number; score: number; criterion: string }[] }) {
  return (
    <div className="bar" aria-hidden>
      {breakdown.map((b, i) => (
        <span key={b.criterion} title={`${b.criterion}: ${b.score}/5`} style={{ width: `${(b.weight * b.score) / 5}%`, background: COLORS[i % COLORS.length] }} />
      ))}
    </div>
  );
}

function DecisionPill({ c }: { c: CandidateView }) {
  if (c.sentAt) return <span className="pill sent">Sent</span>;
  if (!c.decision) return <span className="pill wait">Waiting</span>;
  return (
    <span>
      <span className={`pill ${c.decision}`}>{c.decision === "invite" ? "Interview" : "Decline"}</span>
      {c.founderDecision && <span className="yours">your call</span>}
    </span>
  );
}

function PendingRow({ c, onChange }: { c: CandidateView; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <div className="row" style={{ padding: "10px 6px" }}>
      <b>{c.name}</b>{" "}
      {c.status === "processing" ? <span className="st-processing">Scoring…</span> : <span className="st-error">Scoring failed: {c.error}</span>}
      <div className="actions">
        <button className="btn" disabled={busy} onClick={async () => {
          setBusy(true); setErr("");
          try { await api(`/api/candidates/${c.id}/rescore`, { method: "POST" }); onChange(); } catch (e) { setErr((e as Error).message); }
          setBusy(false);
        }}>{busy ? "Scoring…" : "Score again"}</button>
        <button className="btn danger" onClick={async () => { if (confirm(`Remove ${c.name}?`)) { await api(`/api/candidates/${c.id}`, { method: "DELETE" }); onChange(); } }}>Remove</button>
        {err && <span className="warn">{err}</span>}
      </div>
    </div>
  );
}

function Row({ c, role, topN, names, onChange }: { c: CandidateView; role: Role; topN: number; names: string[]; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(c.subject);
  const [body, setBody] = useState(c.body);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [details, setDetails] = useState({ name: c.name, email: c.email || "", phone: c.phone || "" });

  useEffect(() => { setSubject(c.subject); setBody(c.body); }, [c.subject, c.body]);

  const score = c.scores[role]!;
  const otherRole: Role = role === "PM" ? "SPM" : "PM";
  const otherScore = c.scores[otherRole];
  const dirty = subject !== c.subject || body !== c.body;

  async function run(label: string, fn: () => Promise<unknown>, success?: string) {
    setBusy(label); setMsg(null);
    try { await fn(); if (success) setMsg({ ok: true, text: success }); onChange(); }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    setBusy(null);
  }

  const save = () => api(`/api/candidates/${c.id}`, { method: "PATCH", body: JSON.stringify({ subject, body }) });

  return (
    <div className={`row ${open ? "open" : ""}`}>
      <button className="row-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="rank num">{c.rank}</span>
        <span className="who">
          <div className="n">{c.name}</div>
          <div className="m">{c.warnings.length ? "Check personal details" : c.email}</div>
        </span>
        <span className="total num">{score.total.toFixed(1)}</span>
        <Bar breakdown={score.breakdown} />
        <DecisionPill c={c} />
        <span className="sentcol m" style={{ fontSize: 13, color: "var(--muted)" }}>
          {c.sentAt ? `Sent ${new Date(c.sentAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : c.draftReady ? "Draft ready" : "Drafting…"}
        </span>
        <span className="chev" aria-hidden>›</span>
      </button>

      {open && (
        <div className="detail">
          <section>
            <h2>Why rank {c.rank}</h2>
            <table className="crit">
              <tbody>
                {score.breakdown.map((b, i) => (
                  <tr key={b.criterion}>
                    <td style={{ width: "38%" }}>
                      <span className="sw" style={{ background: COLORS[names.indexOf(b.criterion) >= 0 ? names.indexOf(b.criterion) : i] }} />
                      <span className="cn">{b.criterion}</span> <span className="w">{b.weight}%</span>
                    </td>
                    <td className="s num">{b.score}/5</td>
                    <td className="r">{b.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {c.decision === "invite" && (c.brief ? <div className="brief"><b>Interview brief.</b> {c.brief}</div> : <p className="note">Brief is being written…</p>)}

            {otherScore && (
              <p className="note">
                {ROLE_NAME[otherRole]} score: <b className="num">{otherScore.total.toFixed(1)}</b>
                {c.crossRank && ` (would rank ${c.crossRank} among ${ROLE_NAME[otherRole]} applicants${c.crossRank <= topN ? ", above that line" : ""})`}
              </p>
            )}

            {c.warnings.map((w) => <p key={w} className="warn">{w}</p>)}

            {editing ? (
              <div className="email" style={{ marginTop: 10 }}>
                <label>Name</label><input value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} />
                <label style={{ marginTop: 6 }}>Email</label><input value={details.email} onChange={(e) => setDetails({ ...details, email: e.target.value })} />
                <label style={{ marginTop: 6 }}>Phone</label><input value={details.phone} onChange={(e) => setDetails({ ...details, phone: e.target.value })} />
                <div className="actions">
                  <button className="btn primary" onClick={() => run("details", async () => { await api(`/api/candidates/${c.id}`, { method: "PATCH", body: JSON.stringify({ personal: details }) }); setEditing(false); }, "Details saved")}>Save details</button>
                  <button className="btn" onClick={() => setEditing(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <p className="note">{c.phone || "No phone"} · {c.sourceFile} · <button className="btn link" onClick={() => setEditing(true)}>Edit details</button></p>
            )}

            <details className="cv">
              <summary>What the AI saw (CV with personal details removed)</summary>
              <pre>{c.cvContent}</pre>
            </details>
          </section>

          <section className="email">
            <h2>{c.emailKind === "invite" ? "Interview invitation" : c.emailKind === "reject" ? "Decline email" : "Email"} {c.sentAt && "· sent"}</h2>
            {!c.draftReady && !c.sentAt ? (
              <p className="note">The draft is being written. It appears here automatically.</p>
            ) : (
              <>
                <div className="to">To: {c.sentTo || c.email || "no email on file"}</div>
                <label htmlFor={`s-${c.id}`}>Subject</label>
                <input id={`s-${c.id}`} value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!!c.sentAt} />
                <label htmlFor={`b-${c.id}`} style={{ marginTop: 10 }}>Message</label>
                <textarea id={`b-${c.id}`} value={body} onChange={(e) => setBody(e.target.value)} disabled={!!c.sentAt} />
              </>
            )}

            {!c.sentAt && (
              <div className="actions">
                <button
                  className={`btn ${c.decision === "invite" ? "go" : "primary"}`}
                  disabled={!c.draftReady || !!busy}
                  onClick={() => {
                    if (!confirm(`Send this ${c.decision === "invite" ? "interview invitation" : "decline email"} to ${c.name}?`)) return;
                    run("send", async () => { if (dirty) await save(); await api(`/api/candidates/${c.id}/send`, { method: "POST" }); }, "Sent");
                  }}
                >{busy === "send" ? "Sending…" : "Confirm & send"}</button>
                {dirty && <button className="btn" disabled={!!busy} onClick={() => run("save", save, "Saved")}>Save edits</button>}
                <button className="btn" disabled={!!busy} onClick={() => run("switch", () => api(`/api/candidates/${c.id}/decision`, { method: "POST", body: JSON.stringify({ decision: c.decision === "invite" ? "reject" : "invite" }) }))}>
                  {busy === "switch" ? "Rewriting…" : c.decision === "invite" ? "Decline instead" : "Interview instead"}
                </button>
                {c.founderDecision && c.founderDecision !== c.systemDecision && (
                  <button className="btn link" disabled={!!busy} onClick={() => run("reset", () => api(`/api/candidates/${c.id}/decision`, { method: "POST", body: JSON.stringify({ decision: null }) }))}>Back to suggested</button>
                )}
                <button className="btn link danger" disabled={!!busy} onClick={() => { if (confirm(`Remove ${c.name} from the list?`)) run("del", () => api(`/api/candidates/${c.id}`, { method: "DELETE" })); }}>Remove</button>
              </div>
            )}
            {msg && <p className={msg.ok ? "note st-scored" : "warn"}>{msg.text}</p>}
          </section>
        </div>
      )}
    </div>
  );
}
