alter table public.company_bank_accounts
  add column if not exists account_holder text,
  add column if not exists branch_name text,
  add column if not exists swift_code text;

insert into public.company_bank_accounts (
  label,
  bank_name,
  bank_code,
  city_code,
  account_number,
  rib_key,
  iban,
  account_holder,
  branch_name,
  swift_code
)
values (
  'Compte Banque Populaire',
  'Banque Populaire',
  '181',
  '810',
  '2121191426410004',
  '61',
  'MA64181810212119142641000461',
  'KAYZARAN SARL',
  'TAKADDOUM',
  'BCPOMAMC'
)
on conflict (iban) do update set
  label = excluded.label,
  bank_name = excluded.bank_name,
  bank_code = excluded.bank_code,
  city_code = excluded.city_code,
  account_number = excluded.account_number,
  rib_key = excluded.rib_key,
  account_holder = excluded.account_holder,
  branch_name = excluded.branch_name,
  swift_code = excluded.swift_code,
  is_active = true;
