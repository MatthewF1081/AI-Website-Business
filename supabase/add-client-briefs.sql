-- Client website questionnaire (onboarding.html) for Supabase.
-- Run once in Supabase > SQL Editor after schema.sql. Safe to run again.
-- Clients can only send briefs and upload images; only team members can see them.

create table if not exists public.client_briefs (http://localhost:5173/
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name       text not null check (char_length(name) between 1 and 200),
  business   text check (char_length(business) <= 200),
  email      text check (char_length(email) <= 320),
  phone      text check (char_length(phone) <= 40),
  answers    jsonb not null default '{}'::jsonb check (pg_column_size(answers) <= 200000),
  files      jsonb not null default '[]'::jsonb check (jsonb_array_length(files) <= 30),
  status     text not null default 'new' check (status in ('new', 'reviewed', 'in_progress', 'done'))
);

create index if not exists client_briefs_created_at_idx on public.client_briefs (created_at desc);

drop trigger if exists client_briefs_touch_updated_at on public.client_briefs;
create trigger client_briefs_touch_updated_at before update on public.client_briefs
  for each row execute function public.touch_updated_at();

alter table public.client_briefs enable row level security;

drop policy if exists "Clients can send briefs" on public.client_briefs;
create policy "Clients can send briefs" on public.client_briefs
  for insert to anon with check (status = 'new');

drop policy if exists "Team can read briefs" on public.client_briefs;
create policy "Team can read briefs" on public.client_briefs
  for select to authenticated using (public.is_team_member());

drop policy if exists "Team can update briefs" on public.client_briefs;
create policy "Team can update briefs" on public.client_briefs
  for update to authenticated using (public.is_team_member()) with check (public.is_team_member());

drop policy if exists "Team can delete briefs" on public.client_briefs;
create policy "Team can delete briefs" on public.client_briefs
  for delete to authenticated using (public.is_team_member());

-- Private storage bucket for logos and photos (15 MB per file, images and PDFs only).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-uploads', 'client-uploads', false, 15728640,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/svg+xml', 'application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Clients can upload brief files" on storage.objects;
create policy "Clients can upload brief files" on storage.objects
  for insert to anon with check (bucket_id = 'client-uploads');

drop policy if exists "Team can view brief files" on storage.objects;
create policy "Team can view brief files" on storage.objects
  for select to authenticated using (bucket_id = 'client-uploads' and public.is_team_member());

drop policy if exists "Team can delete brief files" on storage.objects;
create policy "Team can delete brief files" on storage.objects
  for delete to authenticated using (bucket_id = 'client-uploads' and public.is_team_member());
