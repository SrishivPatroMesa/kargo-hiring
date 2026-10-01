import Link from "next/link";
import { loadDashboard } from "@/lib/queries";
import { getRubric } from "@/lib/rubric";
import Dashboard from "@/components/Dashboard";
import type { Role } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role: r } = await searchParams;
  const role: Role = r === "SPM" ? "SPM" : "PM";
  const missing = ["DATABASE_URL", "GEMINI_API_KEY"].filter((k) => !process.env[k]);
  if (missing.length) {
    return <div className="banner">Missing environment variables: {missing.join(", ")}. Add them in .env.local (local) or your hosting settings, then redeploy.</div>;
  }
  let data, rubric;
  try {
    [data, rubric] = await Promise.all([loadDashboard(), getRubric()]);
  } catch (e) {
    return <div className="banner">Could not reach the database: {(e as Error).message}. Check DATABASE_URL and that db/schema.sql has been run.</div>;
  }
  if (data.candidates.length === 0) {
    return (
      <>
        <h1>Shortlist</h1>
        <p className="sub">No candidates yet. <Link href="/upload">Upload CVs</Link> to score them against the rubric.</p>
      </>
    );
  }
  const criteria = Object.fromEntries((["PM", "SPM"] as Role[]).map((k) => [k, rubric[k].map((c) => c.name)])) as Record<Role, string[]>;
  return (
    <Dashboard
      role={role}
      candidates={data.candidates}
      topN={data.topN}
      minScore={data.minScore}
      criteria={criteria}
      warnings={{ noPassword: !process.env.APP_PASSWORD, noResend: !process.env.RESEND_API_KEY, override: process.env.EMAIL_OVERRIDE_TO || null }}
    />
  );
}
