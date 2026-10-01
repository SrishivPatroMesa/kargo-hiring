"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { IconCheck, IconFile, IconUpload } from "@/components/Icons";

type Role = "PM" | "SPM";
type Item = {
  key: string;
  file: File;
  role: Role | "";
  name: string;
  state: "queued" | "processing" | "scored" | "duplicate" | "error";
  message?: string;
};

// pm_01_x.pdf -> PM, spm_16_x.pdf -> SPM, anything else -> the default you pick
function guessRole(filename: string): Role | "" {
  const f = filename.toLowerCase();
  if (/^spm[_\-\s]|senior/.test(f)) return "SPM";
  if (/^pm[_\-\s]/.test(f)) return "PM";
  return "";
}

const CONCURRENCY = 2;

export default function UploadPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [defaultRole, setDefaultRole] = useState<Role | "">("");
  const [over, setOver] = useState(false);
  const [running, setRunning] = useState(false);
  const [drafting, setDrafting] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const update = (key: string, patch: Partial<Item>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  function add(files: FileList | File[]) {
    const ok = Array.from(files).filter((f) => /\.(pdf|docx|txt)$/i.test(f.name));
    setItems((xs) => [
      ...xs,
      ...ok.filter((f) => !xs.some((x) => x.file.name === f.name && x.file.size === f.size)).map((f) => ({
        key: `${f.name}-${f.size}-${Math.random()}`, file: f, role: guessRole(f.name), name: "", state: "queued" as const,
      })),
    ]);
    setDone(false);
  }

  const roleOf = (it: Item) => it.role || defaultRole;
  const queued = items.filter((i) => i.state === "queued" || i.state === "error");
  const missingRole = queued.filter((i) => !roleOf(i)).length;

  async function processOne(it: Item) {
    update(it.key, { state: "processing", message: "Reading and scoring…" });
    const fd = new FormData();
    fd.append("file", it.file);
    fd.append("role", roleOf(it));
    if (it.name.trim()) fd.append("name", it.name.trim());
    try {
      const r = await fetch("/api/candidates", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({ error: `Upload failed (${r.status})` }));
      if (!r.ok) throw new Error(j.error);
      update(it.key, j.duplicate ? { state: "duplicate", message: "Already uploaded - skipped" } : { state: "scored", message: "Scored on both rubrics" });
    } catch (e) {
      update(it.key, { state: "error", message: (e as Error).message });
    }
  }

  async function start() {
    setRunning(true); setDone(false);
    const queue = [...queued];
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) await processOne(queue.shift()!);
    }));
    // briefs + emails for everyone, in small batches
    let remaining = 1, stalls = 0;
    while (remaining > 0 && stalls < 3) {
      try {
        const r = await fetch("/api/reconcile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 4 }) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        remaining = j.remaining;
        stalls = j.drafted === 0 && remaining > 0 ? stalls + 1 : 0;
        setDrafting(remaining ? `Writing briefs and email drafts: ${remaining} left` : null);
      } catch (e) {
        stalls++;
        setDrafting(`Drafting paused: ${(e as Error).message}`);
        await new Promise((res) => setTimeout(res, 3000));
      }
    }
    setDrafting(remaining > 0 ? `${remaining} drafts still missing. Open the shortlist and they will be retried.` : null);
    setRunning(false); setDone(true);
  }

  const stats = {
    scored: items.filter((i) => i.state === "scored").length,
    errors: items.filter((i) => i.state === "error").length,
  };

  const finished = items.filter((i) => i.state === "scored" || i.state === "duplicate" || i.state === "error").length;
  const pct = items.length ? Math.round((finished / items.length) * 100) : 0;

  return (
    <main>
      <div className="page-head">
        <div>
          <h1>Upload CVs</h1>
          <p className="sub">Add one CV or all sixty. Each is scored against both the PM and SPM rubric and gets a draft reply.</p>
        </div>
      </div>

      <div className="upload-grid">
        <div
          className={`drop ${over ? "over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
        >
          <div className="drop-icon"><IconUpload size={28} /></div>
          <h2>Drop CVs here</h2>
          <p style={{ margin: "0 0 18px", color: "var(--muted)" }}>PDF, DOCX or TXT, up to 10 MB each</p>
          <button className="btn primary big" onClick={() => input.current?.click()}>Choose files</button>
          <input ref={input} type="file" multiple accept=".pdf,.docx,.txt" hidden onChange={(e) => e.target.files && add(e.target.files)} />
        </div>

        <div className="panel steps">
          <h2 style={{ marginBottom: 2 }}>What happens to each CV</h2>
          <div className="step"><span className="step-n">1</span><span><b>Personal details set aside</b>Name, email and phone are stored privately and never sent to the AI.</span></div>
          <div className="step"><span className="step-n">2</span><span><b>Scored on both rubrics</b>Every criterion gets a 1 to 5 score and a one-line reason.</span></div>
          <div className="step"><span className="step-n">3</span><span><b>Ranked and drafted</b>The top 5 per role get a brief and an invitation. Everyone else gets a kind decline.</span></div>
          <div className="step"><span className="step-n">4</span><span><b>You decide</b>Nothing is sent until you press Confirm &amp; send.</span></div>
        </div>
      </div>

      {items.length > 0 && (
        <>
          <div className="controls">
            <label style={{ fontWeight: 650, fontSize: 14 }}>
              Role for files without one{" "}
              <select value={defaultRole} onChange={(e) => setDefaultRole(e.target.value as Role | "")}>
                <option value="">Choose…</option>
                <option value="PM">Product Manager</option>
                <option value="SPM">Senior Product Manager</option>
              </select>
            </label>
            <button className="btn go big" disabled={running || !queued.length || missingRole > 0} onClick={start}>
              {running ? "Working…" : `Score ${queued.length} CV${queued.length === 1 ? "" : "s"}`}
            </button>
            {!running && <button className="btn link" onClick={() => setItems(items.filter((i) => i.state === "processing"))}>Clear list</button>}
            <div className="progress" aria-label={`${pct}% processed`}><div style={{ width: `${pct}%` }} /></div>
            <span className="note num" style={{ margin: 0 }}>{stats.scored} scored{stats.errors ? `, ${stats.errors} failed` : ""}</span>
          </div>
          {missingRole > 0 && <p className="warn">{missingRole} file(s) need a role. Pick one per file or set the default above.</p>}
          {drafting && <div className="drafting" style={{ marginBottom: 14 }} role="status"><span className="spinner" />{drafting}</div>}
          {done && !drafting && <div className="banner info" style={{ background: "var(--teal-wash)", color: "var(--teal)" }}><IconCheck />All done. <Link href="/">Open the shortlist</Link></div>}

          <div className="files-wrap">
            <table className="files">
              <thead><tr><th>File</th><th>Applied for</th><th>Name (detected automatically)</th><th>Status</th></tr></thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.key}>
                    <td><span className="file-name"><IconFile size={16} />{it.file.name}</span></td>
                    <td>
                      <select value={it.role} disabled={it.state === "processing" || it.state === "scored"} onChange={(e) => update(it.key, { role: e.target.value as Role | "" })}>
                        <option value="">{defaultRole ? `Default (${defaultRole})` : "Choose…"}</option>
                        <option value="PM">PM</option>
                        <option value="SPM">SPM</option>
                      </select>
                    </td>
                    <td><input value={it.name} placeholder="Auto" disabled={it.state !== "queued" && it.state !== "error"} onChange={(e) => update(it.key, { name: e.target.value })} /></td>
                    <td>
                      <span className={`st st-${it.state === "duplicate" ? "scored" : it.state}`}>
                        {it.state === "processing" && <span className="spinner" />}
                        {(it.state === "scored" || it.state === "duplicate") && <IconCheck size={14} />}
                        {it.message || "Waiting"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
