create table if not exists public.company_bank_accounts (
  id             uuid primary key default gen_random_uuid(),
  label          text not null check (length(trim(label)) > 0),
  bank_name      text not null check (length(trim(bank_name)) > 0),
  bank_code      text,
  city_code      text,
  account_number text not null check (length(trim(account_number)) > 0),
  rib_key        text,
  iban           text not null unique check (length(trim(iban)) > 0),
  is_active      boolean not null default true,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists idx_company_bank_accounts_active
  on public.company_bank_accounts(is_active, bank_name);

alter table public.company_bank_accounts enable row level security;

drop policy if exists "admin select company bank accounts" on public.company_bank_accounts;
create policy "admin select company bank accounts" on public.company_bank_accounts
  for select using (public.auth_user_role() = 'admin');

drop policy if exists "admin insert company bank accounts" on public.company_bank_accounts;
create policy "admin insert company bank accounts" on public.company_bank_accounts
  for insert with check (public.auth_user_role() = 'admin');

drop policy if exists "admin update company bank accounts" on public.company_bank_accounts;
create policy "admin update company bank accounts" on public.company_bank_accounts
  for update using (public.auth_user_role() = 'admin')
  with check (public.auth_user_role() = 'admin');

drop policy if exists "admin delete company bank accounts" on public.company_bank_accounts;
create policy "admin delete company bank accounts" on public.company_bank_accounts
  for delete using (public.auth_user_role() = 'admin');

insert into public.company_bank_accounts (
  label,
  bank_name,
  bank_code,
  city_code,
  account_number,
  rib_key,
  iban
)
values (
  'Compte principal CFG',
  'CFG Bank',
  '050',
  '810',
  '0060110872772001',
  '56',
  '050810006011087277200156'
)
on conflict (iban) do nothing;

alter table public.invoices
  add column if not exists payment_method text not null default 'bank_transfer'
    check (payment_method in ('cheque', 'bank_transfer')),
  add column if not exists bank_account_id uuid
    references public.company_bank_accounts(id) on delete restrict;

update public.invoices
set bank_account_id = (
  select id
  from public.company_bank_accounts
  where iban = '050810006011087277200156'
  limit 1
)
where payment_method = 'bank_transfer'
  and bank_account_id is null;

create index if not exists idx_invoices_bank_account
  on public.invoices(bank_account_id)
  where bank_account_id is not null;
