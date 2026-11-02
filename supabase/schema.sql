-- Lead CRM database for Supabase.
-- Paste this whole file into Supabase > SQL Editor and click Run.
-- Safe to run again; it won't delete existing leads.

create extension if not exists pgcrypto;

-- People allowed to use the CRM (must match their Supabase login email).
create table if not exists public.team_members (
  email text primary key check (email = lower(email))
);

create table if not exists public.leads (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  name         text not null check (char_length(name) between 1 and 200),
  company      text check (char_length(company) <= 200),
  email        text check (char_length(email) <= 320),
  phone        text check (char_length(phone) <= 40),
  trade        text check (char_length(trade) <= 100),
  package      text check (char_length(package) <= 60),
  website      text check (char_length(website) <= 500),
  service_area text check (char_length(service_area) <= 200),
  timeline     text check (char_length(timeline) <= 100),
  message      text check (char_length(message) <= 5000),
  source       text check (char_length(source) <= 60),
  stage        text not null default 'new' check (stage in ('new', 'contacted', 'proposal', 'won', 'lost')),
  value        numeric not null default 0 check (value >= 0),
  follow_up    date,
  notes        jsonb not null default '[]'::jsonb
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists leads_touch_updated_at on public.leads;
create trigger leads_touch_updated_at before update on public.leads
  for each row execute function public.touch_updated_at();

create or replace function public.is_team_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.team_members
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- Row level security: visitors can only submit; only the team can see or change leads.
alter table public.leads enable row level security;
alter table public.team_members enable row level security;

drop policy if exists "Visitors can submit leads" on public.leads;
create policy "Visitors can submit leads" on public.leads
  for insert to anon
  with check (stage = 'new' and value = 0 and notes = '[]'::jsonb and follow_up is null);

drop policy if exists "Team can read leads" on public.leads;
create policy "Team can read leads" on public.leads
  for select to authenticated using (public.is_team_member());

drop policy if exists "Team can add leads" on public.leads;
create policy "Team can add leads" on public.leads
  for insert to authenticated with check (public.is_team_member());

drop policy if exists "Team can update leads" on public.leads;
create policy "Team can update leads" on public.leads
  for update to authenticated using (public.is_team_member()) with check (public.is_team_member());

drop policy if exists "Team can delete leads" on public.leads;
create policy "Team can delete leads" on public.leads
  for delete to authenticated using (public.is_team_member());

drop policy if exists "Members can see their own membership" on public.team_members;
create policy "Members can see their own membership" on public.team_members
  for select to authenticated using (email = lower(auth.jwt() ->> 'email'));

-- Live updates in the CRM when a new lead arrives.
do $$
begin
  alter publication supabase_realtime add table public.leads;
exception when duplicate_object then null;
end $$;

-- LAST STEP: add your team's login emails (lowercase), then run this line.
-- insert into public.team_members (email) values ('you@yourcompany.com') on conflict do nothing;
