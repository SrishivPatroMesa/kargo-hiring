import { NextResponse } from "next/server";
import { ingestCv } from "@/lib/pipeline";
import type { Role } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

// Upload one CV: extract text, split off personal details (no AI), store, score on both rubrics.
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const role = String(form.get("role") || "");
    const name = String(form.get("name") || "").trim() || null;
    if (!(file instanceof File)) return NextResponse.json({ error: "No file attached" }, { status: 400 });
    if (role !== "PM" && role !== "SPM") return NextResponse.json({ error: "Pick the role they applied for" }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "File is larger than 10 MB" }, { status: 400 });
    const buf = Buffer.from(await file.arrayBuffer());
    const r = await ingestCv({ buf, filename: file.name, role: role as Role, name });
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
