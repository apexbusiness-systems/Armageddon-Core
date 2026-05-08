create extension if not exists "pgcrypto";

create table if not exists public.armageddon_intake (
  id uuid primary key default gen_random_uuid(),
  system_name text not null,
  contact_name text not null,
  email text not null,
  company text,
  tier text not null check (tier in ('Self-Serve', 'Verified', 'Certified', 'Enterprise')),
  description text not null,
  source text,
  created_at timestamptz not null default now(),
  status text not null default 'new'
);

alter table public.armageddon_intake enable row level security;

revoke all on table public.armageddon_intake from anon, authenticated;

drop policy if exists "service role can insert armageddon intake" on public.armageddon_intake;
create policy "service role can insert armageddon intake"
  on public.armageddon_intake
  for insert
  to service_role
  with check (true);
