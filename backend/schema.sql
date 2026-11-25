-- Run in Supabase SQL editor on a new project. No public enquiry table access.
create table if not exists public.staff (user_id uuid primary key references auth.users(id) on delete cascade, role text not null check(role in ('admin','sales')));
create table if not exists public.enquiries (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), name text not null, company text, phone text not null, email text, location text, product text, message text not null, items jsonb not null default '[]', attribution jsonb not null default '{}', status text not null default 'new' check(status in ('new','contacted','qualified','quoted','won','lost')), notes text not null default '');
alter table public.staff enable row level security;
alter table public.enquiries enable row level security;
revoke all on public.staff, public.enquiries from anon, authenticated;
grant select on public.staff to authenticated;
grant select, update(status,notes) on public.enquiries to authenticated;
create policy staff_self on public.staff for select to authenticated using (user_id=auth.uid());
create policy enquiry_staff_read on public.enquiries for select to authenticated using (exists(select 1 from public.staff where user_id=auth.uid()));
create policy enquiry_staff_update on public.enquiries for update to authenticated using (exists(select 1 from public.staff where user_id=auth.uid())) with check (exists(select 1 from public.staff where user_id=auth.uid()));
-- Add staff manually after creating user in Auth: insert into public.staff(user_id,role) values ('USER_UUID','admin');
