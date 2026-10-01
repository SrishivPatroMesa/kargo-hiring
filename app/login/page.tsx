"use client";
import { useState } from "react";

export default function Login() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  async function go(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
    if (r.ok) window.location.href = "/";
    else setErr("That password is not right.");
  }
  return (
    <form className="login" onSubmit={go}>
      <h1>Sign in</h1>
      <p className="sub">This dashboard holds candidates&apos; personal details.</p>
      <label htmlFor="pw">Password</label>
      <input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
      {err && <p className="warn">{err}</p>}
      <button className="btn primary" type="submit">Sign in</button>
    </form>
  );
}
