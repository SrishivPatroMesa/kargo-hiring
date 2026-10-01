"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CandidateView } from "@/lib/queries";
import type { Role } from "@/lib/db";
import { IconChevron, IconFlag, IconInfo, IconLock, IconSend, IconSpark, IconSwap, IconTrash } from "./Icons";

const ROLE_NAME: Record<Role, string> = { PM: "Product Manager", SPM: "Senior Product Manager" };
const COLORS = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--c6)"];
const AVATAR = ["#1f4e8c", "#12877a", "#6b4fa0", "#3c8fb5", "#b0662b", "#4a5d78", "#8a5a9c", "#2f7d5b"];

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

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || "?") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}
function avatarColor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR[h % AVATAR.length];
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
  const count = (r: Role) => candidates.filter((c) => c.appliedRole === r).length;
  const lineAt = ranked.filter((c, i) => i < topN && c.scores[role]!.total >= minScore).length;
  const invites = ranked.filter((c) => c.decision === "invite").length;
  const sent = ranked.filter((c) => c.sentAt).length;
  const avg = ranked.length ? ranked.reduce((a, c) => a + c.scores[role]!.total, 0) / ranked.length : 0;
  const other: Role = role === "PM" ? "SPM" : "PM";
  const crossFits = candidates.filter(
    (c) => c.appliedRole === other && c.status === "scored" && c.crossRank !== null && c.crossRank <= topN && (c.scores[role]?.total ?? 0) >= minScore
  );
  const cutoff = lineAt > 0 ? ranked[lineAt - 1].scores[role]!.total : minScore;

  return (
    <main>
      {warnings.noPassword && <div className="banner"><IconLock />APP_PASSWORD is not set, so anyone with this link can see candidates&apos; details. Set it in your hosting environment variables.</div>}
      {warnings.noResend && <div className="banner info"><IconInfo />Sending is off until RESEND_API_KEY is set. You can still review and edit every draft.</div>}
      {warnings.override && <div className="banner info"><IconInfo />Test mode: every email goes to {warnings.override} instead of the candidate.</div>}

      <div className="page-head">
        <div>
          <h1>Who to interview for {ROLE_NAME[role]}</h1>
          <p className="sub">Ranked against the pattern in Kargo&apos;s best hires. You review every email before it goes.</p>
        </div>
        <div className="seg" role="tablist" aria-label="Role">
          {(["PM", "SPM"] as Role[]).map((r) => (
            <Link key={r} href={`/?role=${r}`} className={r === role ? "on" : ""} role="tab" aria-selected={r === role}>
              {ROLE_NAME[r]} <span className="count num">{count(r)}</span>
            </Link>
          ))}
        </div>
      </div>

      <section className="overview" aria-label="Overview">
        <div className="panel">
          <div className="stats">
            <div className="stat"><div className="v num">{ranked.length}</div><div className="l">Ranked</div></div>
            <div className="stat"><div className="v num teal">{invites}</div><div className="l">To interview</div></div>
            <div className="stat"><div className="v num">{avg.toFixed(0)}</div><div className="l">Avg score</div></div>
            <div className="stat"><div className="v num orange">{sent}</div><div className="l">Emails sent</div></div>
          </div>
          <div className="funnel" aria-label="Pipeline">
            {[
              { l: "Applied", v: applicants.length, cls: "" },
              { l: "Scored", v: ranked.length, cls: "" },
              { l: "Interview", v: invites, cls: "teal" },
              { l: "Emailed", v: sent, cls: "orange" },
            ].map((f) => (
              <div className="funnel-row" key={f.l}>
                <span className="fl">{f.l}</span>
                <div className="track"><div className={`fill ${f.cls}`} style={{ width: `${applicants.length ? (f.v / applicants.length) * 100 : 0}%` }} /></div>
                <span className="fv num">{f.v}</span>
              </div>
            ))}
          </div>
          {drafting && <div className="drafting" role="status"><span className="spinner" />{drafting}</div>}
        </div>

        <div className="panel chart">
          <h2>Score distribution</h2>
          <p className="panel-note">Everyone right of the orange line gets an interview draft.</p>
          <Histogram scores={ranked.map((c) => c.scores[role]!.total)} cutoff={cutoff} />
        </div>
      </section>

      {pending.length > 0 && (
        <div className="pending">
          {pending.map((c) => <PendingRow key={c.id} c={c} onChange={() => router.refresh()} />)}
        </div>
      )}

      <div className="list-head">
        <h2 style={{ margin: 0 }}>Ranked candidates</h2>
        <div className="legend" aria-label="Score bar colours">
          {criteria[role].map((n, i) => <span key={n}><i className="sw" style={{ background: COLORS[i] }} />{n}</span>)}
        </div>
      </div>

      <div className="list">
        {ranked.map((c, i) => (
          <div key={c.id}>
            {i === 0 && lineAt === 0 && (
              <div className="line"><IconFlag size={16} />No one scores {minScore} or more yet, so every draft is a decline. You can switch anyone to interview.</div>
            )}
            <Row c={c} role={role} topN={topN} names={criteria[role]} onChange={() => router.refresh()} />
            {i === lineAt - 1 && ranked.length > lineAt && (
              <div className="line"><IconFlag size={16} />Interview line. The top {topN} scoring {minScore} or more get an invitation draft, everyone below gets a decline draft. You can switch anyone.</div>
            )}
          </div>
        ))}
      </div>

      {crossFits.length > 0 && (
        <div className="cross" style={{ marginTop: 16 }}>
          <IconSpark size={16} />
          <span>
            Applied for {ROLE_NAME[other]} but would also make this shortlist:{" "}
            {crossFits.map((c, i) => <b key={c.id}>{i > 0 && ", "}{c.name} ({c.scores[role]?.total.toFixed(0)})</b>)}.
          </span>
        </div>
      )}
    </main>
  );
}

function Histogram({ scores, cutoff }: { scores: number[]; cutoff: number }) {
  const W = 520, H = 200, padL = 28, padR = 14, padB = 26, padT = 18;
  const buckets = Array.from({ length: 10 }, (_, i) => scores.filter((s) => (i === 9 ? s >= 90 : s >= i * 10 && s < i * 10 + 10)).length);
  const max = Math.max(1, ...buckets);
  const bw = (W - padL - padR) / 10;
  const x = (score: number) => padL + (score / 100) * (W - padL - padR);
  const y = (n: number) => H - padB - (n / max) * (H - padB - padT);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Score distribution of ${scores.length} candidates, interview line at ${cutoff.toFixed(0)}`}>
      {[0, Math.ceil(max / 2), max].map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--rule)" />
          <text x={padL - 8} y={y(t) + 4} textAnchor="end" className="axis">{t}</text>
        </g>
      ))}
      {buckets.map((n, i) => {
        const above = i * 10 + 10 > cutoff;
        return n > 0 ? (
          <rect key={i} x={padL + i * bw + 4} y={y(n)} width={bw - 8} height={H - padB - y(n)} rx={4}
            fill={above ? "var(--teal)" : "var(--c5)"} opacity={above ? 1 : 0.55}>
            <title>{`${i * 10}–${i * 10 + 9}: ${n} candidate${n === 1 ? "" : "s"}`}</title>
          </rect>
        ) : null;
      })}
      {[0, 20, 40, 60, 80, 100].map((t) => <text key={t} x={x(t)} y={H - 8} textAnchor="middle" className="axis">{t}</text>)}
      <line x1={x(cutoff)} x2={x(cutoff)} y1={padT - 6} y2={H - padB} stroke="var(--orange)" strokeWidth={2.5} strokeDasharray="6 4" />
      <text x={x(cutoff) + (cutoff > 75 ? -6 : 6)} y={padT + 4} textAnchor={cutoff > 75 ? "end" : "start"} className="line-label">Interview line {cutoff.toFixed(0)}</text>
    </svg>
  );
}

function Ring({ value, tone }: { value: number; tone: string }) {
  const r = 21, c = 2 * Math.PI * r;
  return (
    <div className="ring" aria-label={`Score ${value.toFixed(1)} out of 100`}>
      <svg width="50" height="50" viewBox="0 0 50 50">
        <circle cx="25" cy="25" r={r} fill="none" stroke="var(--rule)" strokeWidth="4" />
        <circle cx="25" cy="25" r={r} fill="none" stroke={tone} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} />
      </svg>
      <b className="num">{value.toFixed(0)}</b>
    </div>
  );
}

function Bar({ breakdown, names }: { breakdown: { weight: number; score: number; criterion: string }[]; names: string[] }) {
  return (
    <div className="bar" aria-hidden>
      {breakdown.map((b, i) => {
        const k = names.indexOf(b.criterion);
        return <span key={b.criterion} title={`${b.criterion}: ${b.score}/5`} style={{ width: `${(b.weight * b.score) / 5}%`, background: COLORS[k >= 0 ? k : i] }} />;
      })}
    </div>
  );
}

function DecisionPill({ c }: { c: CandidateView }) {
  if (c.sentAt) return <span className="pill sent"><IconSend size={13} />Sent</span>;
  if (!c.decision) return <span className="pill wait">Waiting</span>;
  return (
    <span>
      <span className={`pill ${c.decision}`}><span className="dot" />{c.decision === "invite" ? "Interview" : "Decline"}</span>
      {c.founderDecision && <span className="yours">your call</span>}
    </span>
  );
}

function PendingRow({ c, onChange }: { c: CandidateView; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <div className="pending-row">
      <b>{c.name}</b>
      {c.status === "processing"
        ? <span className="st st-processing"><span className="spinner" />Scoring</span>
        : <span className="st st-error">Scoring failed: {c.error}</span>}
      <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        <button className="btn" disabled={busy} onClick={async () => {
          setBusy(true); setErr("");
          try { await api(`/api/candidates/${c.id}/rescore`, { method: "POST" }); onChange(); } catch (e) { setErr((e as Error).message); }
          setBusy(false);
        }}>{busy ? "Scoring…" : "Score again"}</button>
        <button className="btn danger" onClick={async () => { if (confirm(`Remove ${c.name}?`)) { await api(`/api/candidates/${c.id}`, { method: "DELETE" }); onChange(); } }}>Remove</button>
      </span>
      {err && <span className="warn">{err}</span>}
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
  const tone = c.sentAt ? "var(--steel)" : c.decision === "invite" ? "var(--teal)" : c.decision === "reject" ? "var(--red)" : "var(--c5)";

  async function run(label: string, fn: () => Promise<unknown>, success?: string) {
    setBusy(label); setMsg(null);
    try { await fn(); if (success) setMsg({ ok: true, text: success }); onChange(); }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    setBusy(null);
  }

  const save = () => api(`/api/candidates/${c.id}`, { method: "PATCH", body: JSON.stringify({ subject, body }) });
  const rankCls = c.rank && c.rank <= 3 ? `r${c.rank}` : "";

  return (
    <div className={`row ${open ? "open" : ""}`}>
      <button className="row-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className={`rank num ${rankCls}`}>{c.rank}</span>
        <span className="who">
          <span className="avatar" style={{ background: avatarColor(c.name) }}>{initials(c.name)}</span>
          <span className="who-text">
            <div className="n">{c.name}</div>
            <div className={`m ${c.warnings.length ? "warn" : ""}`}>{c.warnings.length ? "Check personal details" : c.email}</div>
          </span>
        </span>
        <Ring value={score.total} tone={tone} />
        <Bar breakdown={score.breakdown} names={names} />
        <span className="decision"><DecisionPill c={c} /></span>
        <span className={`status ${c.draftReady ? "ready" : ""}`}>
          {c.sentAt ? `Sent ${new Date(c.sentAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
            : c.draftReady ? "Draft ready" : <><span className="spinner" />Drafting</>}
        </span>
        <span className="chev" aria-hidden><IconChevron size={18} /></span>
      </button>

      {open && (
        <div className="detail">
          <section className="card">
            <h2>Why rank {c.rank}</h2>
            <div className="crit">
              {score.breakdown.map((b, i) => {
                const k = names.indexOf(b.criterion);
                const col = COLORS[k >= 0 ? k : i];
                return (
                  <div className="crit-row" key={b.criterion}>
                    <span className="crit-name"><i className="sw" style={{ background: col }} />{b.criterion} <span className="w">{b.weight}%</span></span>
                    <span className="pips" aria-label={`${b.score} out of 5`}>
                      {[1, 2, 3, 4, 5].map((p) => <i key={p} style={p <= b.score ? { background: col } : undefined} />)}
                      <b className="num" style={{ marginLeft: 6, fontSize: 13 }}>{b.score}/5</b>
                    </span>
                    <span className="crit-reason">{b.reason}</span>
                  </div>
                );
              })}
            </div>

            {c.decision === "invite" && (c.brief
              ? <div className="brief"><h3><IconSpark size={16} />Interview brief</h3>{c.brief}</div>
              : <p className="note">Brief is being written…</p>)}

            {otherScore && (
              <div className="cross">
                <IconSwap size={16} />
                <span>
                  {ROLE_NAME[otherRole]} score <b className="num">{otherScore.total.toFixed(1)}</b>
                  {c.crossRank && `, would rank ${c.crossRank} among ${ROLE_NAME[otherRole]} applicants`}
                  {c.crossRank && c.crossRank <= topN ? " (inside that shortlist)" : ""}
                </span>
              </div>
            )}

            {c.warnings.map((w) => <p key={w} className="warn">{w}</p>)}

            {editing ? (
              <div className="edit-grid">
                <label>Name<input value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} /></label>
                <label>Email<input value={details.email} onChange={(e) => setDetails({ ...details, email: e.target.value })} /></label>
                <label>Phone<input value={details.phone} onChange={(e) => setDetails({ ...details, phone: e.target.value })} /></label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn primary" onClick={() => run("details", async () => { await api(`/api/candidates/${c.id}`, { method: "PATCH", body: JSON.stringify({ personal: details }) }); setEditing(false); }, "Details saved")}>Save details</button>
                  <button className="btn" onClick={() => setEditing(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="meta">
                <span>{c.phone || "No phone"}</span>
                <span>{c.sourceFile}</span>
                <button className="btn link" onClick={() => setEditing(true)}>Edit details</button>
              </div>
            )}

            <details className="cv">
              <summary>What the AI saw (CV with personal details removed)</summary>
              <pre>{c.cvContent}</pre>
            </details>
          </section>

          <section className="mail" aria-label="Email draft">
            <div className="mail-head">
              <div className="mail-kind">
                <h3 style={{ margin: 0 }}>{c.emailKind === "invite" ? "Interview invitation" : c.emailKind === "reject" ? "Decline email" : "Email"}</h3>
                {c.sentAt ? <span className="pill sent"><IconSend size={13} />Sent</span> : c.decision && <span className={`pill ${c.decision}`}><span className="dot" />{c.decision === "invite" ? "Interview" : "Decline"}</span>}
              </div>
              <div className="mail-field"><span>To</span><b style={{ fontWeight: 600, paddingLeft: 9 }}>{c.sentTo || c.email || "no email on file"}</b></div>
              {(c.draftReady || c.sentAt) && (
                <div className="mail-field">
                  <label htmlFor={`s-${c.id}`}><span>Subject</span></label>
                  <input id={`s-${c.id}`} value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!!c.sentAt} />
                </div>
              )}
            </div>
            {!c.draftReady && !c.sentAt ? (
              <p className="note" style={{ padding: "18px" }}><span className="spinner" style={{ display: "inline-block", verticalAlign: "-2px", marginRight: 8 }} />The draft is being written and appears here automatically.</p>
            ) : (
              <textarea aria-label="Message" value={body} onChange={(e) => setBody(e.target.value)} disabled={!!c.sentAt} />
            )}

            {!c.sentAt ? (
              <div className="mail-foot">
                <button
                  className={`btn ${c.decision === "invite" ? "go" : "primary"}`}
                  disabled={!c.draftReady || !!busy}
                  onClick={() => {
                    if (!confirm(`Send this ${c.decision === "invite" ? "interview invitation" : "decline email"} to ${c.name}?`)) return;
                    run("send", async () => { if (dirty) await save(); await api(`/api/candidates/${c.id}/send`, { method: "POST" }); }, "Sent");
                  }}
                ><IconSend size={15} />{busy === "send" ? "Sending…" : "Confirm & send"}</button>
                {dirty && <button className="btn" disabled={!!busy} onClick={() => run("save", save, "Saved")}>Save edits</button>}
                <button className="btn" disabled={!!busy} onClick={() => run("switch", () => api(`/api/candidates/${c.id}/decision`, { method: "POST", body: JSON.stringify({ decision: c.decision === "invite" ? "reject" : "invite" }) }))}>
                  <IconSwap size={15} />{busy === "switch" ? "Rewriting…" : c.decision === "invite" ? "Decline instead" : "Interview instead"}
                </button>
                {c.founderDecision && c.founderDecision !== c.systemDecision && (
                  <button className="btn link" disabled={!!busy} onClick={() => run("reset", () => api(`/api/candidates/${c.id}/decision`, { method: "POST", body: JSON.stringify({ decision: null }) }))}>Back to suggested</button>
                )}
                <button className="btn link danger" style={{ marginLeft: "auto" }} disabled={!!busy} onClick={() => { if (confirm(`Remove ${c.name} from the list?`)) run("del", () => api(`/api/candidates/${c.id}`, { method: "DELETE" })); }}><IconTrash size={15} />Remove</button>
                {msg && <span className={msg.ok ? "st st-scored" : "warn"} style={{ width: "100%" }}>{msg.text}</span>}
              </div>
            ) : (
              <div className="mail-foot"><span className="st st-scored">Sent to {c.sentTo} on {new Date(c.sentAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span></div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
