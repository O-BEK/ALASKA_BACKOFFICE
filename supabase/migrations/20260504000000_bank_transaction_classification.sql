  alter table public.bank_transactions
    add column if not exists classification text not null default 'uncategorized',
    add column if not exists expense_category text,
    add column if not exists matched_label text,
    add column if not exists review_status text not null default 'suggested',
    add column if not exists notes text;

  do $$
  begin
    alter table public.bank_transactions
      add constraint bank_transactions_classification_check
      check (classification in (
        'supplier_payment',
        'fixed_charge',
        'staff_payment',
        'cash_deposit',
        'owner_injection',
        'external_income',
        'bank_fee',
        'ignore',
        'uncategorized'
      ));
  exception
    when duplicate_object then null;
  end $$;

  do $$
  begin
    alter table public.bank_transactions
      add constraint bank_transactions_expense_category_check
      check (expense_category is null or expense_category in ('MP', 'RH', 'CHARGES', 'AUTRE'));
  exception
    when duplicate_object then null;
  end $$;

  do $$
  begin
    alter table public.bank_transactions
      add constraint bank_transactions_review_status_check
      check (review_status in ('suggested', 'confirmed', 'ignored'));
  exception
    when duplicate_object then null;
  end $$;

  create index if not exists idx_bank_transactions_classification
    on public.bank_transactions(classification);

  create index if not exists idx_bank_transactions_review_status
    on public.bank_transactions(review_status);

  create table if not exists public.bank_transaction_rules (
    id uuid primary key default gen_random_uuid(),
    match_text text not null,
    classification text not null check (classification in (
      'supplier_payment',
      'fixed_charge',
      'staff_payment',
      'cash_deposit',
      'owner_injection',
      'external_income',
      'bank_fee',
      'ignore',
      'uncategorized'
    )),
    expense_category text check (expense_category is null or expense_category in ('MP', 'RH', 'CHARGES', 'AUTRE')),
    matched_label text not null,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
  );

  create index if not exists idx_bank_transaction_rules_active
    on public.bank_transaction_rules(is_active);

  alter table public.bank_transaction_rules enable row level security;

  create policy "admin read bank transaction rules"
    on public.bank_transaction_rules for select
    using (public.auth_user_role() = 'admin');

  create policy "admin insert bank transaction rules"
    on public.bank_transaction_rules for insert
    with check (public.auth_user_role() = 'admin');

  create policy "admin update bank transaction rules"
    on public.bank_transaction_rules for update
    using (public.auth_user_role() = 'admin')
    with check (public.auth_user_role() = 'admin');

  create policy "admin delete bank transaction rules"
    on public.bank_transaction_rules for delete
    using (public.auth_user_role() = 'admin');

  create policy "admin update bank transactions"
    on public.bank_transactions for update
    using (public.auth_user_role() = 'admin')
    with check (public.auth_user_role() = 'admin');

  create policy "admin update bank statement files"
    on storage.objects for update
    using (
      bucket_id = 'bank-statements'
      and public.auth_user_role() = 'admin'
    )
    with check (
      bucket_id = 'bank-statements'
      and public.auth_user_role() = 'admin'
    );
