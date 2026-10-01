// Sends one email through Resend. Only ever called when the founder clicks "Confirm & send".

export function resolveRecipient(candidateEmail: string | null): { to: string | null; reason?: string } {
  const override = process.env.EMAIL_OVERRIDE_TO?.trim();
  if (override) return { to: override };
  if (!candidateEmail) return { to: null, reason: "This candidate has no email address on file. Add one with Edit details." };
  const allowed = (process.env.ALLOWED_EMAIL_DOMAINS || "mesaschool.co")
    .split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
  const domain = candidateEmail.split("@")[1]?.toLowerCase() || "";
  if (allowed.includes("*") || allowed.some((d) => domain === d || domain.endsWith("." + d))) return { to: candidateEmail };
  return { to: null, reason: `Blocked: ${domain} is not in ALLOWED_EMAIL_DOMAINS (${allowed.join(", ")}). This guard stops real people being emailed during testing.` };
}

export async function sendEmail(opts: { to: string; subject: string; text: string; idempotencyKey: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set. Add it in your hosting environment variables and redeploy.");
  const res = await fetch(`${process.env.RESEND_API_BASE || "https://api.resend.com"}/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "Idempotency-Key": opts.idempotencyKey,
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || "Arjun at Kargo <onboarding@resend.dev>",
      to: [opts.to],
      subject: opts.subject,
      text: opts.text,
      ...(process.env.REPLY_TO ? { reply_to: process.env.REPLY_TO } : {}),
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.message || res.statusText;
    if (/only send testing emails|verify a domain/i.test(msg)) {
      throw new Error(`Resend refused: ${msg} - on the free plan without a verified domain, Resend only delivers to the address you signed up with. Set EMAIL_OVERRIDE_TO to that address, or verify a domain in Resend.`);
    }
    throw new Error(`Resend error (${res.status}): ${msg}`);
  }
  return json.id as string;
}
