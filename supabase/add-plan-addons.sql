-- Adds the monthly plan and add-ons to each lead.
-- Paste into Supabase > SQL Editor and click Run. Safe to run more than once.

alter table public.leads add column if not exists plan text check (char_length(plan) <= 60);
alter table public.leads add column if not exists addons text check (char_length(addons) <= 500);

-- Older leads saved a monthly plan in the package column; move those over.
update public.leads
set plan = package, package = null
where package in ('Care', 'Leads', 'Dominate') and plan is null;
