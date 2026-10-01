import { getRubric } from "@/lib/rubric";

export const dynamic = "force-dynamic";

export default async function RubricPage() {
  let rubric;
  try { rubric = await getRubric(); } catch (e) {
    return <div className="banner">Could not load the rubric: {(e as Error).message}</div>;
  }
  return (
    <>
      <h1>Rubric</h1>
      <p className="sub">Every candidate is scored 1–5 on each criterion for both roles. Weighted total out of 100. Built from the pattern in Kargo&apos;s past hires, not from the job descriptions.</p>
      <div className="rubric">
        {(["PM", "SPM"] as const).map((role) => (
          <section key={role}>
            <h2>{role === "PM" ? "Product Manager" : "Senior Product Manager"}</h2>
            <ol>
              {rubric[role].map((c) => (
                <li key={c.name}>
                  <b>{c.name}</b> · <span className="w">{c.weight}%</span>
                  <div><b>Strong:</b> {c.strong}</div>
                  <div><b>Weak:</b> {c.weak}</div>
                  {c.source && <div className="note">From: {c.source}</div>}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </>
  );
}
