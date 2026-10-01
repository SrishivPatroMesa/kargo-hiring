// Single-user password gate. The cookie holds a hash of APP_PASSWORD, never the password itself.
export const AUTH_COOKIE = "kargo_auth";

export async function passwordToken(password: string) {
  const data = new TextEncoder().encode(`kargo-hiring:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
