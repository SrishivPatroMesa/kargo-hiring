-- Kargo hiring dashboard schema. Safe to run more than once.
create extension if not exists pgcrypto;

-- The rubric, one row per criterion per role. Seeded from rubric.txt (see rubric_seed.sql / npm run db:setup).
create table if not exists rubric_criteria (
  id serial primary key,
  role text not null check (role in ('PM','SPM')),
  position int not null,
  name text not null,
  strong text not null,       -- what a strong candidate looks like
  weak text not null,         -- what a weak candidate looks like
  weight int not null check (weight between 0 and 100),
  source text,                -- which hire profile(s) this criterion came from
  unique (role, name)
);

create table if not exists candidates (
  id uuid primary key default gen_random_uuid(),
  applied_role text not null check (applied_role in ('PM','SPM')),
  -- PRIVATE. Name, email, phone, original file name. Never sent to any AI step.
  personal_details jsonb not null default '{}'::jsonb,
  -- CV text with personal details removed. The only CV text the AI ever sees.
  cv_content text not null,
  redaction_warnings jsonb not null default '[]'::jsonb,
  cv_hash text unique,            -- stops the same CV being uploaded twice
  status text not null default 'processing' check (status in ('processing','scored','error')),
  error text,
  -- decision: system recommendation (from the line) or founder override
  system_decision text check (system_decision in ('invite','reject')),
  founder_decision text check (founder_decision in ('invite','reject')),
  brief text,                     -- 3-sentence interview brief (invites only)
  email_kind text check (email_kind in ('invite','reject')),
  email_subject text,
  email_body text,                -- contains [NAME]; real name substituted at display/send time
  email_edited boolean not null default false,
  sent_at timestamptz,
  sent_to text,
  resend_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every candidate is scored against BOTH rubrics, whichever role they applied for.
create table if not exists scores (
  candidate_id uuid not null references candidates(id) on delete cascade,
  role text not null check (role in ('PM','SPM')),
  total numeric(5,1) not null,            -- 0-100 weighted
  breakdown jsonb not null,               -- [{criterion, weight, score(1-5), reason}]
  model text,
  created_at timestamptz not null default now(),
  primary key (candidate_id, role)
);

create index if not exists scores_role_total on scores(role, total desc);

-- Supabase exposes tables in "public" over its REST API to anyone with the anon key.
-- Turning RLS on with no policies blocks that, so personal details can only be read
-- through this app's server (which connects as the table owner and is not affected).
alter table rubric_criteria enable row level security;
alter table candidates enable row level security;
alter table scores enable row level security;
