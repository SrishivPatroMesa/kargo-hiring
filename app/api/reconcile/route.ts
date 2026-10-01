import { NextResponse } from "next/server";
import { reconcile } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 60;

// Applies the line (top N per role) and writes any missing/outdated briefs and email drafts, a few at a time.
export async function POST(req: Request) {
  try {
    const { limit } = await req.json().catch(() => ({ limit: 4 }));
    return NextResponse.json(await reconcile(Math.min(Number(limit) || 4, 6)));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
