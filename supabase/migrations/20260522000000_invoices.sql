create table if not exists public.invoices (
  id             uuid primary key default gen_random_uuid(),
  invoice_number text unique not null,
  client_name    text not null,
  client_rc      text,
  client_address text,
  invoice_date   date not null default current_date,
  status         text not null default 'draft'
                   check (status in ('draft', 'sent', 'paid')),
  notes          text,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);

create table if not exists public.invoice_lines (
  id             uuid primary key default gen_random_uuid(),
  invoice_id     uuid not null references public.invoices(id) on delete cascade,
  description    text not null,
  quantity       numeric(10,2) not null default 1,
  unit_price_ht  numeric(10,2) not null,
  tva_rate       numeric(5,2) not null default 10.00,
  line_order     int not null default 0
);

create index if not exists idx_invoice_lines_invoice on public.invoice_lines(invoice_id);
create index if not exists idx_invoices_number on public.invoices(invoice_number);
create index if not exists idx_invoices_date on public.invoices(invoice_date);

alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;

-- Policies invoices
drop policy if exists "admin select invoices" on public.invoices;
create policy "admin select invoices" on public.invoices
  for select using (public.auth_user_role() = 'admin');

drop policy if exists "admin insert invoices" on public.invoices;
create policy "admin insert invoices" on public.invoices
  for insert with check (public.auth_user_role() = 'admin');

drop policy if exists "admin update invoices" on public.invoices;
create policy "admin update invoices" on public.invoices
  for update using (public.auth_user_role() = 'admin');

drop policy if exists "admin delete invoices" on public.invoices;
create policy "admin delete invoices" on public.invoices
  for delete using (public.auth_user_role() = 'admin');

-- Policies invoice_lines
drop policy if exists "admin select invoice_lines" on public.invoice_lines;
create policy "admin select invoice_lines" on public.invoice_lines
  for select using (public.auth_user_role() = 'admin');

drop policy if exists "admin insert invoice_lines" on public.invoice_lines;
create policy "admin insert invoice_lines" on public.invoice_lines
  for insert with check (public.auth_user_role() = 'admin');

drop policy if exists "admin update invoice_lines" on public.invoice_lines;
create policy "admin update invoice_lines" on public.invoice_lines
  for update using (public.auth_user_role() = 'admin');

drop policy if exists "admin delete invoice_lines" on public.invoice_lines;
create policy "admin delete invoice_lines" on public.invoice_lines
  for delete using (public.auth_user_role() = 'admin');
