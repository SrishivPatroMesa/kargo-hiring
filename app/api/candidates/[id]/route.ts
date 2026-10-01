import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

// Edit personal details or the email draft.
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  if (b.personal) {
    const p = { name: b.personal.name?.trim() || null, email: b.personal.email?.trim() || null, phone: b.personal.phone?.trim() || null };
    await sql`update candidates set personal_details = personal_details || ${sql.json(p)}, updated_at = now() where id = ${id}`;
  }
  if (typeof b.subject === "string" && typeof b.body === "string") {
    const r = await sql`update candidates set email_subject = ${b.subject}, email_body = ${b.body}, email_edited = true,
      updated_at = now() where id = ${id} and sent_at is null returning id`;
    if (!r.length) return NextResponse.json({ error: "Already sent - cannot edit" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  await sql`delete from candidates where id = ${id}`;
  return NextResponse.json({ ok: true });
}
