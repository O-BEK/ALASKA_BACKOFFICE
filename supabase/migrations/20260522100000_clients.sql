-- supabase/migrations/20260522100000_clients.sql
create table if not exists public.clients (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  address    text,
  ice        text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_clients_name on public.clients(name);

alter table public.clients enable row level security;

drop policy if exists "admin select clients" on public.clients;
create policy "admin select clients" on public.clients
  for select using (public.auth_user_role() = 'admin');

drop policy if exists "admin insert clients" on public.clients;
create policy "admin insert clients" on public.clients
  for insert with check (public.auth_user_role() = 'admin');

drop policy if exists "admin update clients" on public.clients;
create policy "admin update clients" on public.clients
  for update using (public.auth_user_role() = 'admin');

drop policy if exists "admin delete clients" on public.clients;
create policy "admin delete clients" on public.clients
  for delete using (public.auth_user_role() = 'admin');
