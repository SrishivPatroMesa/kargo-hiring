import { getRubric } from "@/lib/rubric";

export const dynamic = "force-dynamic";
const COLORS = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--c6)"];

export default async function RubricPage() {
  let rubric;
  try { rubric = await getRubric(); } catch (e) {
    return <main><div className="banner">Could not load the rubric: {(e as Error).message}</div></main>;
  }
  return (
    <main>
      <div className="page-head">
        <div>
          <h1>The rubric</h1>
          <p className="sub">Built from what Kargo&apos;s five strongest hires had in common, not from the job descriptions. Each criterion is scored 1 to 5 and weighted to a total out of 100.</p>
        </div>
      </div>
      <div className="rubric">
        {(["PM", "SPM"] as const).map((role) => (
          <section key={role} className="panel">
            <h2>{role === "PM" ? "Product Manager" : "Senior Product Manager"}</h2>
            <div className="rubric-weights" aria-label="Weights">
              {rubric[role].map((c, i) => <span key={c.name} title={`${c.name} ${c.weight}%`} style={{ width: `${c.weight}%`, background: COLORS[i] }} />)}
            </div>
            {rubric[role].map((c, i) => (
              <div className="rubric-item" key={c.name}>
                <h3><i className="sw" style={{ background: COLORS[i] }} />{c.name}<span className="wt num">{c.weight}%</span></h3>
                <p><b>Strong:</b> {c.strong}</p>
                <p><b>Weak:</b> {c.weak}</p>
                {c.source && <div className="src">Drawn from {c.source}</div>}
              </div>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}
