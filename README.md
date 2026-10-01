# Kargo hiring dashboard

Arjun uploads CVs. The system splits off personal details, scores every candidate against the PM **and** SPM rubric, ranks them, writes a 3-sentence interview brief for the top candidates, and drafts an invite or a warm decline for everyone. Arjun reads, decides, and clicks **Confirm & send**. Nothing goes out without him.

Stack: Next.js 15 on Vercel · Postgres (Supabase or Neon) · Gemini Flash · Resend.

## How it works

```
Upload CV + role ──► text extracted (PDF / DOCX / TXT)
                 ──► name, email, phone pulled out IN CODE, stored in candidates.personal_details
                 ──► redacted text stored in candidates.cv_content   ◄── the only thing AI ever sees
                 ──► Gemini scores it on PM + SPM rubric (1–5 + one-line reason per criterion)
                 ──► code computes weighted totals, ranks, applies the line (top N per role, score ≥ MIN_SCORE)
                 ──► Gemini writes brief + invite (above line) or decline (below line), with [NAME] placeholder
Dashboard        ──► real first name substituted in code ──► Arjun edits / switches / Confirm & send ──► Resend
```

If a new CV pushes someone below the line, their invite is redrafted as a decline automatically. Sent emails are never changed. Arjun can switch anyone between interview and decline; the draft is rewritten.

## Setup (about 15 minutes)

### 1. Database
**Supabase:** create a project → **Connect** → copy the **Transaction pooler** URI (port 6543) and put your database password in it.
**Neon:** create a project → copy the pooled connection string.

Then either:
- paste `db/schema.sql` and then `db/rubric_seed.sql` into the Supabase/Neon **SQL editor** and run them, or
- `npm install`, put `DATABASE_URL` in `.env.local`, run `npm run db:setup`.

Check: `rubric_criteria` has 10 rows (5 PM, 5 SPM). (The app also seeds it from `rubric.txt` on first use if the table is empty.)

### 2. Environment variables
Copy `.env.example` to `.env.local` and fill in:

| Variable | What |
|---|---|
| `DATABASE_URL` | from step 1 |
| `GEMINI_API_KEY` | aistudio.google.com → Get API key |
| `GEMINI_MODEL` | optional. Default `gemini-flash-latest`, falls back to `gemini-2.5-flash` |
| `APP_PASSWORD` | anything; the dashboard holds personal data |
| `TOP_N`, `MIN_SCORE` | the line: top 5 per role scoring ≥ 40 get invites |
| `RESEND_API_KEY` | leave blank until B-2 |
| `RESEND_FROM` | `Arjun at Kargo <onboarding@resend.dev>` unless you verify a domain |
| `EMAIL_OVERRIDE_TO` | see Resend note below |
| `ALLOWED_EMAIL_DOMAINS` | `mesaschool.co`. Sends to any other domain are refused |

`.env.local` is in `.gitignore`. Confirm with `git check-ignore .env.local` before pushing.

### 3. Run locally (optional)
```
npm install
npm run dev        # http://localhost:3000
```

### 4. Deploy
Push to GitHub → Vercel **Add New Project** → import the repo → add the same environment variables → **Deploy**. No build settings to change.

## Checkpoints

- **L4-2** – Vercel URL opens (log in with `APP_PASSWORD`) → **Upload CVs** page loads. `rubric_criteria` has rows.
- **B-1** – Upload 3 CVs first (e.g. `pm_01_priya_krishnan.pdf` as PM, `spm_30_priya_iyer.pdf` as SPM, `05_ishaan_roy.pdf` as PM). In Supabase, `candidates.personal_details` has name/email/phone; `cv_content` shows `[NAME] [EMAIL] [PHONE]`; `scores` has a PM and an SPM row per candidate. Then drag in all 60. Files starting `pm_`/`spm_` get their role automatically; pick a default for the rest. The page scores 2 at a time, then writes all briefs and drafts.
- **B-2** – Add `RESEND_API_KEY` in Vercel, redeploy. Open a candidate → **Confirm & send**. `sent_at`, `sent_to` and `resend_id` fill in.
- **B-3** – Upload 2 new CVs, open the shortlist, read brief + draft, send. Under 5 minutes end to end.

### Resend: read this before B-2
On Resend's free plan **without a verified domain**, you can only send to the email address you signed up with. Sending to `squad_N@pg27.mesaschool.co` will be refused unless that is your Resend login. Two fixes:
- set `EMAIL_OVERRIDE_TO` to your Resend sign-up address. Every email goes there (a banner on the dashboard says so), or
- verify a domain in Resend and set `RESEND_FROM` to an address on it.

### Gemini rate limits
The free tier allows a limited number of requests per minute. The app retries automatically on 429s; 60 CVs is about 130 calls and can take several minutes on the free tier. If drafting stalls, reload the shortlist: it resumes where it stopped.

## Data privacy block (answers)

**Free tier vs billed Gemini API.** On the free tier (unpaid AI Studio key), Google's terms allow prompts and responses to be used to improve its products, and human reviewers may read them. With billing enabled on the project, Google does not use your prompts or responses to improve its products. Same API, same code; the difference is whether the Cloud project has billing turned on. For real candidate data, use a billed project.

**What the extraction step does for DPDP.** It separates identifying personal data (name, email, phone, profile links) from CV content at the moment of upload, in our own code, before any AI call. Gemini only ever receives the redacted text and writes `[NAME]`; the real name is substituted on our server when Arjun views or sends. That is data minimisation and purpose limitation: the third-party processor gets no direct identifiers, the personal data stays in one access-controlled place (password-gated app; Supabase RLS on, so the public anon key cannot read it), and deleting a candidate removes all of it. A real deployment would also need a notice to applicants, a retention period and a deletion process.

You can check this yourself: every candidate card has **What the AI saw**. In testing on all 60 CVs, no candidate email, phone number or name reached any AI prompt.

## The rubric
`rubric.txt` was derived from the 8 past-hire profiles (Exceeds vs Meets/Below), not from the job descriptions. Every criterion names the hire(s) it came from. It is also shown in the app under **Rubric**. To change it, edit `rubric.txt`, run `node --experimental-strip-types scripts/make-rubric-seed.ts`, run `db/rubric_seed.sql`, then rescore.

## Files
```
rubric.txt                 the rubric (source of truth)
db/schema.sql              tables (rubric_criteria, candidates, scores)
db/rubric_seed.sql         rubric rows, generated from rubric.txt
lib/pii.ts                 personal-detail extraction + redaction (no AI)
lib/scoring.ts             rubric scoring (Gemini)
lib/drafts.ts              brief + emails (Gemini), name substitution
lib/pipeline.ts            upload → score → line → drafts
lib/email.ts               Resend + recipient guard
app/                       pages and API routes
scripts/test-redaction.ts  run redaction over a folder of CVs and report
```
