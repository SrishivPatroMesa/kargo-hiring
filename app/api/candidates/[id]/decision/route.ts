import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { reconcile } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 60;

// Founder overrides the system's invite/decline call (or resets to the system call), and the draft is rewritten.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { decision } = await req.json().catch(() => ({}));
  if (decision !== "invite" && decision !== "reject" && decision !== null) {
    return NextResponse.json({ error: "decision must be invite, reject or null" }, { status: 400 });
  }
  const r = await sql`update candidates set founder_decision = ${decision}, updated_at = now()
    where id = ${id} and sent_at is null returning id`;
  if (!r.length) return NextResponse.json({ error: "Already sent - decision is final" }, { status: 409 });
  try {
    return NextResponse.json(await reconcile(1, id));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
