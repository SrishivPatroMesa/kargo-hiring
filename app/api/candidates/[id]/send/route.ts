import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { withName } from "@/lib/drafts";
import { resolveRecipient, sendEmail } from "@/lib/email";

export const runtime = "nodejs";

type Row = {
  personal_details: { name: string | null; email: string | null };
  email_subject: string | null;
  email_body: string | null;
  sent_at: string | null;
};

// The founder's "Confirm & send". Nothing is ever sent without this call.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [c] = await sql<Row[]>`select personal_details, email_subject, email_body, sent_at from candidates where id = ${id}`;
  if (!c) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  if (c.sent_at) return NextResponse.json({ error: "Already sent" }, { status: 409 });
  if (!c.email_body || !c.email_subject) return NextResponse.json({ error: "No draft yet - wait for drafting to finish" }, { status: 409 });

  const { to, reason } = resolveRecipient(c.personal_details?.email);
  if (!to) return NextResponse.json({ error: reason }, { status: 400 });

  // Claim the send first so a double-click cannot send twice.
  const claimed = await sql`update candidates set sent_at = now(), sent_to = ${to} where id = ${id} and sent_at is null returning id`;
  if (!claimed.length) return NextResponse.json({ error: "Already sent" }, { status: 409 });

  try {
    const name = c.personal_details?.name;
    const resendId = await sendEmail({
      to,
      subject: withName(c.email_subject, name),
      text: withName(c.email_body, name),
      idempotencyKey: `candidate-${id}`,
    });
    await sql`update candidates set resend_id = ${resendId}, updated_at = now() where id = ${id}`;
    return NextResponse.json({ ok: true, to, resendId });
  } catch (e) {
    await sql`update candidates set sent_at = null, sent_to = null where id = ${id}`;
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
