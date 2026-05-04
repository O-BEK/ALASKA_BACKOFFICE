create table if not exists public.bank_statement_imports (
  id uuid primary key default gen_random_uuid(),
  bank text not null check (bank in ('bp', 'cfg')),
  period_start date not null,
  period_end date not null,
  storage_path text not null,
  imported_at timestamptz not null default now(),
  transaction_count integer not null default 0,
  user_id uuid references auth.users(id) on delete set null
);

create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.bank_statement_imports(id) on delete cascade,
  bank text not null check (bank in ('bp', 'cfg')),
  date date not null,
  label text not null,
  debit numeric not null default 0,
  credit numeric not null default 0,
  balance numeric not null default 0
);

create index if not exists idx_bank_transactions_import on public.bank_transactions(import_id);
create index if not exists idx_bank_transactions_date on public.bank_transactions(date);
create index if not exists idx_bank_imports_period on public.bank_statement_imports(period_start, period_end);

alter table public.bank_statement_imports enable row level security;
alter table public.bank_transactions enable row level security;

drop policy if exists "admin read bank imports" on public.bank_statement_imports;
create policy "admin read bank imports"
  on public.bank_statement_imports for select
  using (public.auth_user_role() = 'admin');

drop policy if exists "admin insert bank imports" on public.bank_statement_imports;
create policy "admin insert bank imports"
  on public.bank_statement_imports for insert
  with check (public.auth_user_role() = 'admin');

drop policy if exists "admin delete bank imports" on public.bank_statement_imports;
create policy "admin delete bank imports"
  on public.bank_statement_imports for delete
  using (public.auth_user_role() = 'admin');

drop policy if exists "admin read bank transactions" on public.bank_transactions;
create policy "admin read bank transactions"
  on public.bank_transactions for select
  using (public.auth_user_role() = 'admin');

drop policy if exists "admin insert bank transactions" on public.bank_transactions;
create policy "admin insert bank transactions"
  on public.bank_transactions for insert
  with check (public.auth_user_role() = 'admin');

drop policy if exists "admin delete bank transactions" on public.bank_transactions;
create policy "admin delete bank transactions"
  on public.bank_transactions for delete
  using (public.auth_user_role() = 'admin');

insert into storage.buckets (id, name, public)
values ('bank-statements', 'bank-statements', false)
on conflict (id) do nothing;

drop policy if exists "admin upload bank statements" on storage.objects;
create policy "admin upload bank statements"
  on storage.objects for insert
  with check (
    bucket_id = 'bank-statements'
    and public.auth_user_role() = 'admin'
  );

drop policy if exists "admin read bank statements" on storage.objects;
create policy "admin read bank statements"
  on storage.objects for select
  using (
    bucket_id = 'bank-statements'
    and public.auth_user_role() = 'admin'
  );
