"use client";
import { useState } from "react";
import { IconLock } from "@/components/Icons";

export default function Login() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
    if (r.ok) window.location.href = "/";
    else { setErr("That password is not right."); setBusy(false); }
  }
  return (
    <div className="login-wrap">
      <section className="login-art">
        <div>
          <h1>Hire the people who&apos;ve done the work.</h1>
          <p>Every CV is scored against the pattern in Kargo&apos;s best hires, ranked, and given a draft reply. Nothing is sent until you confirm it.</p>
        </div>
        <p style={{ fontSize: 13 }}>Personal details are stored privately and never sent to the AI.</p>
        <svg className="stack" width="360" height="240" viewBox="0 0 360 240" aria-hidden>
          {[
            [40, 160, "#e8702a"], [150, 160, "#3c8fb5"], [260, 160, "#1f4e8c"],
            [95, 92, "#12877a"], [205, 92, "#e0a126"], [150, 24, "#ffffff"],
          ].map(([x, y, c], i) => (
            <g key={i}>
              <rect x={x as number} y={y as number} width="104" height="62" rx="5" fill={c as string} opacity={c === "#ffffff" ? 0.9 : 1} />
              {Array.from({ length: 7 }, (_, k) => (
                <line key={k} x1={(x as number) + 14 + k * 12.5} x2={(x as number) + 14 + k * 12.5} y1={(y as number) + 10} y2={(y as number) + 52} stroke="rgba(14,33,64,.25)" strokeWidth="2" />
              ))}
            </g>
          ))}
        </svg>
      </section>
      <section className="login-form">
        <form onSubmit={go}>
          <div className="drop-icon" style={{ margin: "0 0 18px", width: 48, height: 48, borderRadius: 14 }}><IconLock size={22} /></div>
          <h1 style={{ fontSize: 26 }}>Sign in</h1>
          <p className="sub" style={{ marginBottom: 22 }}>This dashboard holds candidates&apos; personal details.</p>
          <label htmlFor="pw">Password</label>
          <input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
          {err && <p className="warn">{err}</p>}
          <button className="btn primary big" type="submit" disabled={busy} style={{ width: "100%", justifyContent: "center" }}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
      </section>
    </div>
  );
}
