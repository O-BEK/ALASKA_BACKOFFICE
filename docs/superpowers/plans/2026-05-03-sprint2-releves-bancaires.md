# Sprint 2 — Relevés Bancaires PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre l'upload de relevés bancaires PDF (Banque Populaire + CFG), extraire les transactions, les afficher et les intégrer dans le bloc "Consolidation externe" du reporting.

**Architecture:** Nouvelle colonne de tables Supabase (`bank_statement_imports`, `bank_transactions`), bucket Storage `bank-statements`, parsers server-side avec `pdf-parse`, nouvelles routes API `/api/bank-statements/*`, nouvel onglet "Relevés" sur la page `/import`, et alimentation du bloc "Consolidation externe" dans `/reporting`.

**Tech Stack:** TypeScript, Next.js 14 App Router, Supabase (PostgreSQL + Storage), `pdf-parse`, Zod, Vitest, Tailwind CSS

---

## Fichiers créés / modifiés

| Fichier | Rôle |
|---|---|
| `supabase/migrations/20260503000000_bank_statements.sql` | Tables + bucket + RLS |
| `lib/bank-parsers/types.ts` | Types partagés des parsers |
| `lib/bank-parsers/banque-populaire.ts` | Parser PDF Banque Populaire |
| `lib/bank-parsers/cfg.ts` | Parser PDF CFG Bank |
| `lib/server/bank-store.ts` | CRUD Supabase pour bank_statements |
| `app/api/bank-statements/route.ts` | GET liste + POST upload/preview |
| `app/api/bank-statements/commit/route.ts` | POST commit transactions |
| `app/api/bank-statements/[id]/route.ts` | GET transactions d'un import |
| `tests/bank-parser.test.ts` | Tests parsers (texte brut simulé) |
| `app/(dashboard)/import/page.tsx` | Onglet "Relevés" |
| `lib/server/analytics.ts` | `buildBankConsolidation()` |
| `lib/contracts.ts` | `bankConsolidationSchema` + type |
| `app/api/reporting/route.ts` | Champ `bankConsolidation` |
| `app/(dashboard)/reporting/page.tsx` | Bloc "Consolidation externe" alimenté |
| `tests/api-auth.test.ts` | Routes bank-statements dans tests auth |

---

## Task 1 : Installer pdf-parse

**Fichiers :**
- Modify: `package.json`

- [ ] **Step 1 : Installer la dépendance**

```bash
npm install pdf-parse
npm install -D @types/pdf-parse
```

- [ ] **Step 2 : Vérifier**

```bash
node -e "require('pdf-parse'); console.log('ok')"
```

Résultat attendu : `ok`

- [ ] **Step 3 : Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add pdf-parse for bank statement parsing"
```

---

## Task 2 : Migration DB — tables et bucket

**Fichiers :**
- Create: `supabase/migrations/20260503000000_bank_statements.sql`

- [ ] **Step 1 : Créer le fichier de migration**

Créer `supabase/migrations/20260503000000_bank_statements.sql` :

```sql
-- Tables relevés bancaires

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

-- Index pour les lookups par période
create index if not exists idx_bank_transactions_import on public.bank_transactions(import_id);
create index if not exists idx_bank_transactions_date on public.bank_transactions(date);
create index if not exists idx_bank_imports_period on public.bank_statement_imports(period_start, period_end);

-- RLS : admin uniquement
alter table public.bank_statement_imports enable row level security;
alter table public.bank_transactions enable row level security;

create policy "admin read bank imports"
  on public.bank_statement_imports for select
  using (public.auth_user_role() = 'admin');

create policy "admin insert bank imports"
  on public.bank_statement_imports for insert
  with check (public.auth_user_role() = 'admin');

create policy "admin delete bank imports"
  on public.bank_statement_imports for delete
  using (public.auth_user_role() = 'admin');

create policy "admin read bank transactions"
  on public.bank_transactions for select
  using (public.auth_user_role() = 'admin');

create policy "admin insert bank transactions"
  on public.bank_transactions for insert
  with check (public.auth_user_role() = 'admin');

create policy "admin delete bank transactions"
  on public.bank_transactions for delete
  using (public.auth_user_role() = 'admin');

-- Bucket Storage bank-statements
insert into storage.buckets (id, name, public)
values ('bank-statements', 'bank-statements', false)
on conflict (id) do nothing;

create policy "admin upload bank statements"
  on storage.objects for insert
  with check (
    bucket_id = 'bank-statements'
    and public.auth_user_role() = 'admin'
  );

create policy "admin read bank statements"
  on storage.objects for select
  using (
    bucket_id = 'bank-statements'
    and public.auth_user_role() = 'admin'
  );
```

- [ ] **Step 2 : Appliquer la migration en production via le dashboard Supabase**

Ouvrir le dashboard Supabase → SQL Editor → coller et exécuter le contenu du fichier.

- [ ] **Step 3 : Commit**

```bash
git add supabase/migrations/20260503000000_bank_statements.sql
git commit -m "feat: add bank_statement_imports and bank_transactions tables + bucket"
```

---

## Task 3 : Types partagés des parsers

**Fichiers :**
- Create: `lib/bank-parsers/types.ts`

- [ ] **Step 1 : Créer le fichier de types**

```typescript
export type BankCode = "bp" | "cfg"

export interface BankTransaction {
  date: string   // YYYY-MM-DD
  label: string
  debit: number
  credit: number
  balance: number
}

export interface ParsedStatement {
  bank: BankCode
  period_start: string  // YYYY-MM-DD (première transaction)
  period_end: string    // YYYY-MM-DD (dernière transaction)
  transactions: BankTransaction[]
}
```

- [ ] **Step 2 : Commit**

```bash
git add lib/bank-parsers/types.ts
git commit -m "feat: add bank parser shared types"
```

---

## Task 4 : Parser Banque Populaire

**Fichiers :**
- Create: `lib/bank-parsers/banque-populaire.ts`

> **⚠️ Note importante :** Le format du texte extrait par pdf-parse varie selon la version du PDF et l'agence. Les regex ci-dessous correspondent au format le plus courant des relevés Banque Populaire Maroc. Il sera nécessaire de les valider avec un vrai fichier PDF et d'ajuster si nécessaire (voir Task 5 pour le workflow de débogage).

- [ ] **Step 1 : Créer le parser**

```typescript
import type { BankTransaction, ParsedStatement } from "./types"

// Convertit un nombre au format MAD : "1.234,56" ou "1234,56" ou "1,234.56" → 1234.56
function parseMadAmount(raw: string): number {
  if (!raw || raw.trim() === "") return 0
  // Supprimer espaces et points de séparation milliers, remplacer virgule décimale par point
  const cleaned = raw.trim().replace(/\s/g, "").replace(/\.(?=\d{3})/g, "").replace(",", ".")
  const value = parseFloat(cleaned)
  return isNaN(value) ? 0 : value
}

// Convertit une date "DD/MM/YYYY" → "YYYY-MM-DD"
function parseDate(raw: string): string | null {
  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return null
  return `${match[3]}-${match[2]}-${match[1]}`
}

// Regex pour détecter une ligne de transaction BP :
// Format : DD/MM/YYYY  <libellé>  <débit ou vide>  <crédit ou vide>  <solde>
// Les montants peuvent être séparés par des espaces multiples
const TX_LINE = /^(\d{2}\/\d{2}\/\d{4})\s{2,}(.+?)\s{2,}([\d\s.,]*)?\s{2,}([\d\s.,]*)?\s{2,}([\d\s.,]+)$/

export function parseBanquePopulaire(text: string): ParsedStatement {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
  const transactions: BankTransaction[] = []

  for (const line of lines) {
    const match = line.match(TX_LINE)
    if (!match) continue
    const date = parseDate(match[1])
    if (!date) continue
    const label = match[2].trim()
    const debit = parseMadAmount(match[3] ?? "")
    const credit = parseMadAmount(match[4] ?? "")
    const balance = parseMadAmount(match[5] ?? "")
    if (!label) continue
    transactions.push({ date, label, debit, credit, balance })
  }

  const dates = transactions.map((t) => t.date).sort()
  return {
    bank: "bp",
    period_start: dates[0] ?? "",
    period_end: dates[dates.length - 1] ?? "",
    transactions,
  }
}
```

- [ ] **Step 2 : Commit**

```bash
git add lib/bank-parsers/banque-populaire.ts
git commit -m "feat: add Banque Populaire PDF parser"
```

---

## Task 5 : Parser CFG Bank

**Fichiers :**
- Create: `lib/bank-parsers/cfg.ts`

> **⚠️ Note importante :** Même précaution que pour le parser BP. CFG Bank Maroc utilise un format PDF légèrement différent — les colonnes débit/crédit peuvent être fusionnées avec un signe négatif pour les débits.

- [ ] **Step 1 : Créer le parser**

```typescript
import type { BankTransaction, ParsedStatement } from "./types"

function parseMadAmount(raw: string): number {
  if (!raw || raw.trim() === "") return 0
  const cleaned = raw.trim().replace(/\s/g, "").replace(/\.(?=\d{3})/g, "").replace(",", ".")
  const value = parseFloat(cleaned)
  return isNaN(value) ? 0 : value
}

function parseDate(raw: string): string | null {
  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return null
  return `${match[3]}-${match[2]}-${match[1]}`
}

// CFG : format avec colonne "Mouvement" signée (négatif = débit)
// DD/MM/YYYY  <libellé>  <mouvement>  <solde>
const TX_LINE_SIGNED = /^(\d{2}\/\d{2}\/\d{4})\s{2,}(.+?)\s{2,}(-?[\d\s.,]+)\s{2,}([\d\s.,]+)$/

// CFG : format avec colonnes séparées débit / crédit
const TX_LINE_SPLIT = /^(\d{2}\/\d{2}\/\d{4})\s{2,}(.+?)\s{2,}([\d\s.,]*)\s{2,}([\d\s.,]*)\s{2,}([\d\s.,]+)$/

export function parseCfg(text: string): ParsedStatement {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
  const transactions: BankTransaction[] = []

  for (const line of lines) {
    // Tenter format signé d'abord
    let match = line.match(TX_LINE_SIGNED)
    if (match) {
      const date = parseDate(match[1])
      if (!date) continue
      const label = match[2].trim()
      const mouvement = parseMadAmount(match[3])
      const balance = parseMadAmount(match[4])
      const debit = mouvement < 0 ? Math.abs(mouvement) : 0
      const credit = mouvement >= 0 ? mouvement : 0
      if (!label) continue
      transactions.push({ date, label, debit, credit, balance })
      continue
    }

    // Tenter format colonnes séparées
    match = line.match(TX_LINE_SPLIT)
    if (match) {
      const date = parseDate(match[1])
      if (!date) continue
      const label = match[2].trim()
      const debit = parseMadAmount(match[3] ?? "")
      const credit = parseMadAmount(match[4] ?? "")
      const balance = parseMadAmount(match[5] ?? "")
      if (!label) continue
      transactions.push({ date, label, debit, credit, balance })
    }
  }

  const dates = transactions.map((t) => t.date).sort()
  return {
    bank: "cfg",
    period_start: dates[0] ?? "",
    period_end: dates[dates.length - 1] ?? "",
    transactions,
  }
}
```

- [ ] **Step 2 : Commit**

```bash
git add lib/bank-parsers/cfg.ts
git commit -m "feat: add CFG Bank PDF parser"
```

---

## Task 6 : Tests des parsers

**Fichiers :**
- Create: `tests/bank-parser.test.ts`

- [ ] **Step 1 : Créer le fichier de tests avec du texte représentatif**

```typescript
import { describe, expect, it } from "vitest"
import { parseBanquePopulaire } from "../lib/bank-parsers/banque-populaire"
import { parseCfg } from "../lib/bank-parsers/cfg"

// Texte brut simulé représentatif du format BP après extraction pdf-parse
const BP_SAMPLE = `
BANQUE POPULAIRE DU MAROC
RELEVÉ DE COMPTE
Période du 01/01/2026 au 31/01/2026

Date          Libellé                              Débit         Crédit        Solde
01/01/2026  VERSEMENT ESPECES                                  5,000.00      50,000.00
05/01/2026  VIREMENT FOURNISSEUR ALI                2,000.00                 48,000.00
15/01/2026  REMISE CHEQUE                                      3,500.00      51,500.00
20/01/2026  PRELEVEMENT LOYER                       8,000.00                 43,500.00
`.trim()

// Texte brut simulé représentatif du format CFG (colonne signée)
const CFG_SAMPLE = `
CFG BANK
EXTRAIT DE COMPTE
Du 01/01/2026 au 31/01/2026

Date          Libellé                     Mouvement       Solde
02/01/2026  REMISE ESPECES              +4,500.00       60,000.00
08/01/2026  VIREMENT EMIS FOURNISSEUR   -3,000.00       57,000.00
18/01/2026  VIREMENT RECU CLIENT        +7,000.00       64,000.00
`.trim()

describe("parseBanquePopulaire", () => {
  it("extrait les transactions du texte brut", () => {
    const result = parseBanquePopulaire(BP_SAMPLE)
    expect(result.bank).toBe("bp")
    expect(result.transactions.length).toBe(4)
  })

  it("parse correctement les dates en YYYY-MM-DD", () => {
    const result = parseBanquePopulaire(BP_SAMPLE)
    expect(result.transactions[0].date).toBe("2026-01-01")
    expect(result.transactions[1].date).toBe("2026-01-05")
  })

  it("sépare débit et crédit", () => {
    const result = parseBanquePopulaire(BP_SAMPLE)
    expect(result.transactions[0].credit).toBe(5000)
    expect(result.transactions[0].debit).toBe(0)
    expect(result.transactions[1].debit).toBe(2000)
    expect(result.transactions[1].credit).toBe(0)
  })

  it("calcule period_start et period_end", () => {
    const result = parseBanquePopulaire(BP_SAMPLE)
    expect(result.period_start).toBe("2026-01-01")
    expect(result.period_end).toBe("2026-01-20")
  })
})

describe("parseCfg", () => {
  it("extrait les transactions du format signé", () => {
    const result = parseCfg(CFG_SAMPLE)
    expect(result.bank).toBe("cfg")
    expect(result.transactions.length).toBe(3)
  })

  it("convertit les montants signés en débit/crédit", () => {
    const result = parseCfg(CFG_SAMPLE)
    expect(result.transactions[0].credit).toBe(4500)
    expect(result.transactions[0].debit).toBe(0)
    expect(result.transactions[1].debit).toBe(3000)
    expect(result.transactions[1].credit).toBe(0)
  })

  it("parse correctement les dates", () => {
    const result = parseCfg(CFG_SAMPLE)
    expect(result.transactions[0].date).toBe("2026-01-02")
  })
})
```

- [ ] **Step 2 : Lancer les tests**

```bash
npm run test -- --reporter=verbose tests/bank-parser.test.ts
```

Résultat attendu : PASS — si FAIL, ajuster les regex dans les parsers pour correspondre au texte simulé, puis re-tester.

> **Note :** Ces tests utilisent du texte simulé. Quand tu auras un vrai PDF, extraire son texte brut avec `node -e "require('pdf-parse')(require('fs').readFileSync('releve.pdf')).then(d => console.log(d.text))"` et ajuster les parsers si le format diffère.

- [ ] **Step 3 : Commit**

```bash
git add tests/bank-parser.test.ts
git commit -m "test: add bank parser tests with representative sample text"
```

---

## Task 7 : Couche serveur bank-store

**Fichiers :**
- Create: `lib/server/bank-store.ts`

- [ ] **Step 1 : Créer le fichier**

```typescript
import type { BankTransaction, BankCode, ParsedStatement } from "@/lib/bank-parsers/types"

type SupabaseAdminClient = ReturnType<typeof import("@/lib/supabase/server").createAdminClient>

export interface BankImportRecord {
  id: string
  bank: BankCode
  period_start: string
  period_end: string
  storage_path: string
  imported_at: string
  transaction_count: number
}

export async function listBankImports(supabase: SupabaseAdminClient): Promise<BankImportRecord[]> {
  const { data, error } = await supabase
    .from("bank_statement_imports")
    .select("*")
    .order("period_start", { ascending: false })
    .limit(24)
  if (error) throw new Error(error.message)
  return (data ?? []) as BankImportRecord[]
}

export async function saveBankImport(
  supabase: SupabaseAdminClient,
  userId: string,
  statement: ParsedStatement,
  storagePath: string
): Promise<BankImportRecord> {
  const { data, error } = await supabase
    .from("bank_statement_imports")
    .insert({
      bank: statement.bank,
      period_start: statement.period_start,
      period_end: statement.period_end,
      storage_path: storagePath,
      transaction_count: statement.transactions.length,
      user_id: userId,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as BankImportRecord
}

export async function saveBankTransactions(
  supabase: SupabaseAdminClient,
  importId: string,
  bank: BankCode,
  transactions: BankTransaction[]
): Promise<void> {
  if (transactions.length === 0) return
  const rows = transactions.map((t) => ({
    import_id: importId,
    bank,
    date: t.date,
    label: t.label,
    debit: t.debit,
    credit: t.credit,
    balance: t.balance,
  }))
  const { error } = await supabase.from("bank_transactions").insert(rows)
  if (error) throw new Error(error.message)
}

export async function getBankTransactions(
  supabase: SupabaseAdminClient,
  importId: string
): Promise<BankTransaction[]> {
  const { data, error } = await supabase
    .from("bank_transactions")
    .select("*")
    .eq("import_id", importId)
    .order("date", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as BankTransaction[]
}

export async function getBankTransactionsByPeriod(
  supabase: SupabaseAdminClient,
  month: string  // "YYYY-MM"
): Promise<BankTransaction[]> {
  const { data, error } = await supabase
    .from("bank_transactions")
    .select("*")
    .gte("date", `${month}-01`)
    .lte("date", `${month}-31`)
    .order("date", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as BankTransaction[]
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Résultat attendu : aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add lib/server/bank-store.ts
git commit -m "feat: add bank-store CRUD layer for bank statements"
```

---

## Task 8 : Route API GET/POST `/api/bank-statements`

**Fichiers :**
- Create: `app/api/bank-statements/route.ts`

- [ ] **Step 1 : Créer la route**

```typescript
import { NextResponse } from "next/server"
import { createClient, createAdminClient } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/supabase/server"
import { parseBanquePopulaire } from "@/lib/bank-parsers/banque-populaire"
import { parseCfg } from "@/lib/bank-parsers/cfg"
import { listBankImports } from "@/lib/server/bank-store"
import type { BankCode } from "@/lib/bank-parsers/types"
import pdfParse from "pdf-parse"

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
  }
  const imports = await listBankImports(createAdminClient())
  return NextResponse.json({ imports })
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get("file") as File | null
  const bank = formData.get("bank") as BankCode | null

  if (!file || !bank || !["bp", "cfg"].includes(bank)) {
    return NextResponse.json({ error: "Fichier PDF et banque requis (bp | cfg)." }, { status: 400 })
  }
  if (!file.name.endsWith(".pdf")) {
    return NextResponse.json({ error: "Format non supporté. Fichier .pdf requis." }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const parsed = await pdfParse(buffer)
  const text = parsed.text

  const statement = bank === "bp" ? parseBanquePopulaire(text) : parseCfg(text)

  if (statement.transactions.length === 0) {
    return NextResponse.json({
      error: "Aucune transaction détectée dans ce PDF. Le format du relevé n'a pas pu être reconnu.",
    }, { status: 422 })
  }

  return NextResponse.json({
    preview: statement,
    raw_text_preview: text.slice(0, 500),  // pour débogage format
  })
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3 : Commit**

```bash
git add app/api/bank-statements/route.ts
git commit -m "feat: add GET/POST /api/bank-statements route"
```

---

## Task 9 : Route API POST `/api/bank-statements/commit`

**Fichiers :**
- Create: `app/api/bank-statements/commit/route.ts`

- [ ] **Step 1 : Créer la route**

```typescript
import { NextResponse } from "next/server"
import { createClient, createAdminClient, isAdmin } from "@/lib/supabase/server"
import { saveBankImport, saveBankTransactions } from "@/lib/server/bank-store"
import type { ParsedStatement } from "@/lib/bank-parsers/types"

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
  }

  const body = await request.json() as { statement: ParsedStatement; filename: string }
  if (!body?.statement?.bank || !body?.statement?.transactions) {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 })
  }

  const admin = createAdminClient()
  const { statement, filename } = body

  // Uploader le fichier brut dans Storage si fourni en base64
  const storagePath = `${statement.bank}/${statement.period_start?.slice(0, 7)}/${filename}`

  // Sauvegarder l'import
  const importRecord = await saveBankImport(admin, user.id, statement, storagePath)

  // Sauvegarder les transactions
  await saveBankTransactions(admin, importRecord.id, statement.bank, statement.transactions)

  return NextResponse.json({ import: importRecord, count: statement.transactions.length })
}
```

- [ ] **Step 2 : Commit**

```bash
git add app/api/bank-statements/commit/route.ts
git commit -m "feat: add POST /api/bank-statements/commit route"
```

---

## Task 10 : Route API GET `/api/bank-statements/[id]`

**Fichiers :**
- Create: `app/api/bank-statements/[id]/route.ts`

- [ ] **Step 1 : Créer la route**

```typescript
import { NextResponse } from "next/server"
import { createClient, createAdminClient, isAdmin } from "@/lib/supabase/server"
import { getBankTransactions } from "@/lib/server/bank-store"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
  }

  const transactions = await getBankTransactions(createAdminClient(), params.id)
  return NextResponse.json({ transactions })
}
```

- [ ] **Step 2 : Commit**

```bash
git add app/api/bank-statements/\[id\]/route.ts
git commit -m "feat: add GET /api/bank-statements/[id] route"
```

---

## Task 11 : Onglet "Relevés" sur la page `/import`

**Fichiers :**
- Modify: `app/(dashboard)/import/page.tsx`

- [ ] **Step 1 : Ajouter les imports et états pour l'onglet Relevés**

En haut du composant, ajouter les nouveaux états après les états existants :

```typescript
// Onglet Relevés
const IMPORT_TABS = ["POS", "Relevés"] as const
type ImportTab = typeof IMPORT_TABS[number]
const [importTab, setImportTab] = useState<ImportTab>("POS")
const [bankFile, setBankFile] = useState<File | null>(null)
const [bankCode, setBankCode] = useState<"bp" | "cfg">("bp")
const [bankPreview, setBankPreview] = useState<import("@/lib/bank-parsers/types").ParsedStatement | null>(null)
const [bankImporting, setBankImporting] = useState(false)
const [bankCommitting, setBankCommitting] = useState(false)
const [bankError, setBankError] = useState("")
const [bankSuccess, setBankSuccess] = useState("")
const [bankImports, setBankImports] = useState<Array<{ id: string; bank: string; period_start: string; period_end: string; transaction_count: number; imported_at: string }>>([])
```

- [ ] **Step 2 : Ajouter le chargement de l'historique des relevés**

Dans `useEffect` existant ou en ajouter un nouveau :

```typescript
useEffect(() => {
  fetch("/api/bank-statements")
    .then(async (r) => r.json())
    .then((data) => setBankImports(data.imports ?? []))
    .catch(() => setBankImports([]))
}, [])
```

- [ ] **Step 3 : Ajouter les handlers**

Après les handlers existants (`handleFile`, `handleConfirm`, etc.) :

```typescript
const handleBankFile = async (file: File) => {
  setBankFile(file)
  setBankPreview(null)
  setBankError("")
  setBankSuccess("")
  setBankImporting(true)
  try {
    const form = new FormData()
    form.append("file", file)
    form.append("bank", bankCode)
    const res = await fetch("/api/bank-statements", { method: "POST", body: form })
    const data = await res.json()
    if (!res.ok) { setBankError(data.error || "Erreur parsing PDF"); return }
    setBankPreview(data.preview)
  } catch {
    setBankError("Erreur réseau")
  } finally {
    setBankImporting(false)
  }
}

const handleBankCommit = async () => {
  if (!bankPreview || !bankFile) return
  setBankCommitting(true)
  setBankError("")
  try {
    const res = await fetch("/api/bank-statements/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statement: bankPreview, filename: bankFile.name }),
    })
    const data = await res.json()
    if (!res.ok) { setBankError(data.error || "Erreur commit"); return }
    setBankSuccess(`${data.count} transactions importées (${data.import.period_start} → ${data.import.period_end})`)
    setBankPreview(null)
    setBankFile(null)
    setBankImports((prev) => [data.import, ...prev])
  } catch {
    setBankError("Erreur réseau")
  } finally {
    setBankCommitting(false)
  }
}
```

- [ ] **Step 4 : Ajouter le sélecteur d'onglets et la section Relevés dans le JSX**

Juste après le `<div>` du titre de la page et avant `{step === "upload" && ...}`, ajouter le sélecteur d'onglets :

```tsx
{/* Sélecteur d'onglet POS / Relevés */}
<div className="flex bg-white border border-alaska-sage-lt rounded-lg p-1 gap-1">
  {IMPORT_TABS.map((t) => (
    <button
      key={t}
      onClick={() => setImportTab(t)}
      className={cn(
        "flex-1 py-2 rounded-md text-sm font-medium transition",
        importTab === t ? "bg-alaska-sage text-white" : "text-alaska-muted hover:bg-alaska-sage-lt"
      )}
    >
      {t}
    </button>
  ))}
</div>
```

Puis envelopper tout le contenu existant (`{step === "upload" && ...}` etc.) dans `{importTab === "POS" && (...)}`.

Après ce bloc, ajouter `{importTab === "Relevés" && (...)}` :

```tsx
{importTab === "Relevés" && (
  <div className="space-y-4">
    <Card className="bg-white border border-alaska-sage-lt rounded-xl">
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-sm text-alaska-dark">Uploader un relevé bancaire PDF</CardTitle>
      </CardHeader>
      <CardContent className="pb-4 space-y-3">
        {/* Sélection banque */}
        <div className="flex gap-2">
          {(["bp", "cfg"] as const).map((code) => (
            <button
              key={code}
              onClick={() => setBankCode(code)}
              className={cn(
                "flex-1 py-2 rounded-lg border text-sm font-medium transition",
                bankCode === code
                  ? "border-alaska-sage bg-alaska-sage-lt text-alaska-sage"
                  : "border-alaska-sage-lt text-alaska-muted hover:bg-alaska-sage-lt"
              )}
            >
              {code === "bp" ? "Banque Populaire" : "CFG Bank"}
            </button>
          ))}
        </div>

        {/* Zone upload */}
        {!bankPreview && (
          <label className="block w-full cursor-pointer border-2 border-dashed border-alaska-sage-lt rounded-xl p-6 text-center hover:border-alaska-sage transition">
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleBankFile(f) }}
            />
            <p className="text-sm text-alaska-muted">
              {bankImporting ? "Analyse en cours..." : "Déposer le relevé PDF ici ou cliquer pour choisir"}
            </p>
            {bankFile && !bankImporting && (
              <p className="text-xs text-alaska-sage mt-1">{bankFile.name}</p>
            )}
          </label>
        )}

        {/* Erreur */}
        {bankError && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-xl border border-red-200">
            <span>{bankError}</span>
          </div>
        )}

        {/* Succès */}
        {bankSuccess && (
          <div className="flex items-center gap-2 text-sm text-alaska-sage bg-alaska-sage-lt p-3 rounded-xl">
            <span>{bankSuccess}</span>
          </div>
        )}

        {/* Preview transactions */}
        {bankPreview && (
          <div className="space-y-3">
            <p className="text-sm text-alaska-dark">
              <span className="font-semibold">{bankPreview.transactions.length} transactions</span>
              {" · "}{bankPreview.period_start} → {bankPreview.period_end}
            </p>
            <div className="overflow-x-auto rounded-lg border border-alaska-sage-lt">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-alaska-sage-lt">
                    <th className="px-3 py-2 text-left text-alaska-muted">Date</th>
                    <th className="px-3 py-2 text-left text-alaska-muted">Libellé</th>
                    <th className="px-3 py-2 text-right text-alaska-muted">Débit</th>
                    <th className="px-3 py-2 text-right text-alaska-muted">Crédit</th>
                  </tr>
                </thead>
                <tbody>
                  {bankPreview.transactions.slice(0, 15).map((tx, i) => (
                    <tr key={i} className="border-t border-alaska-sage-lt">
                      <td className="px-3 py-1.5 text-alaska-muted">{tx.date}</td>
                      <td className="px-3 py-1.5 text-alaska-dark max-w-[200px] truncate">{tx.label}</td>
                      <td className="px-3 py-1.5 text-right text-orange-600">{tx.debit > 0 ? formatMAD(tx.debit) : "—"}</td>
                      <td className="px-3 py-1.5 text-right text-alaska-sage">{tx.credit > 0 ? formatMAD(tx.credit) : "—"}</td>
                    </tr>
                  ))}
                  {bankPreview.transactions.length > 15 && (
                    <tr><td colSpan={4} className="px-3 py-2 text-center text-alaska-muted text-xs">+{bankPreview.transactions.length - 15} autres transactions</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 border-alaska-sage-lt" onClick={() => { setBankPreview(null); setBankFile(null) }}>
                Annuler
              </Button>
              <Button
                className="flex-1 bg-alaska-sage hover:bg-alaska-sage/90 text-white"
                onClick={() => void handleBankCommit()}
                disabled={bankCommitting}
              >
                {bankCommitting ? "Import en cours..." : `Confirmer (${bankPreview.transactions.length} transactions)`}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>

    {/* Historique imports */}
    {bankImports.length > 0 && (
      <Card className="bg-white border border-alaska-sage-lt rounded-xl">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm text-alaska-dark">Historique des relevés importés</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="space-y-2">
            {bankImports.map((imp) => (
              <div key={imp.id} className="flex justify-between items-center text-sm py-1.5 border-b border-alaska-sage-lt last:border-0">
                <span className="text-alaska-dark font-medium">{imp.bank === "bp" ? "Banque Populaire" : "CFG Bank"}</span>
                <span className="text-alaska-muted">{imp.period_start} → {imp.period_end}</span>
                <span className="text-alaska-sage">{imp.transaction_count} tx</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )}
  </div>
)}
```

- [ ] **Step 5 : Ajouter les imports manquants en haut du fichier**

Vérifier que `cn` est importé (il l'est déjà si `import { cn } from "@/lib/utils"` existe). Vérifier que `formatMAD` est importé.

- [ ] **Step 6 : Build**

```bash
npm run build
```

Résultat attendu : aucune erreur.

- [ ] **Step 7 : Commit**

```bash
git add app/\(dashboard\)/import/page.tsx
git commit -m "feat: add Relevés bancaires tab to /import page"
```

---

## Task 12 : Intégrer dans le reporting — `buildBankConsolidation`

**Fichiers :**
- Modify: `lib/server/analytics.ts`
- Modify: `lib/contracts.ts`
- Modify: `app/api/reporting/route.ts`

- [ ] **Step 1 : Ajouter `buildBankConsolidation` dans analytics.ts**

En fin de fichier, avant la dernière accolade exportée :

```typescript
export async function buildBankConsolidation(
  supabase: ReturnType<typeof import("@/lib/supabase/server").createAdminClient>,
  month: string
) {
  const { getBankTransactionsByPeriod, listBankImports } = await import("@/lib/server/bank-store")
  const transactions = await getBankTransactionsByPeriod(supabase, month)
  const imports = await listBankImports(supabase)
  const monthImports = imports.filter(
    (imp) => imp.period_start.startsWith(month) || imp.period_end.startsWith(month)
  )

  const byBank = (["bp", "cfg"] as const).map((bank) => {
    const bankTx = transactions.filter((t) => t.bank === bank)
    return {
      bank,
      label: bank === "bp" ? "Banque Populaire" : "CFG Bank",
      total_debit: bankTx.reduce((sum, t) => sum + t.debit, 0),
      total_credit: bankTx.reduce((sum, t) => sum + t.credit, 0),
      transaction_count: bankTx.length,
    }
  }).filter((b) => b.transaction_count > 0)

  const total_debit = byBank.reduce((sum, b) => sum + b.total_debit, 0)
  const total_credit = byBank.reduce((sum, b) => sum + b.total_credit, 0)

  return {
    has_data: byBank.length > 0,
    banks: byBank,
    total_debit,
    total_credit,
    import_count: monthImports.length,
  }
}
```

- [ ] **Step 2 : Ajouter `bankConsolidationSchema` dans contracts.ts**

Dans `lib/contracts.ts`, après le schéma de reporting existant, ajouter :

```typescript
export const bankConsolidationSchema = z.object({
  has_data: z.boolean().catch(false),
  banks: z.array(z.object({
    bank: z.string(),
    label: z.string(),
    total_debit: z.coerce.number().catch(0),
    total_credit: z.coerce.number().catch(0),
    transaction_count: z.coerce.number().catch(0),
  })).catch([]),
  total_debit: z.coerce.number().catch(0),
  total_credit: z.coerce.number().catch(0),
  import_count: z.coerce.number().catch(0),
})

export type BankConsolidation = z.infer<typeof bankConsolidationSchema>
```

- [ ] **Step 3 : Ajouter `bankConsolidation` dans la route reporting**

Dans `app/api/reporting/route.ts`, au moment où les données sont construites, ajouter :

```typescript
const bankConsolidation = await buildBankConsolidation(createAdminClient(), month)
// puis l'inclure dans la réponse :
return NextResponse.json({ ...reportingData, bankConsolidation })
```

- [ ] **Step 4 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 5 : Commit**

```bash
git add lib/server/analytics.ts lib/contracts.ts app/api/reporting/route.ts
git commit -m "feat: add buildBankConsolidation and wire into /api/reporting"
```

---

## Task 13 : Afficher la consolidation dans `/reporting`

**Fichiers :**
- Modify: `app/(dashboard)/reporting/page.tsx`

- [ ] **Step 1 : Mettre à jour le hook ou l'appel API pour lire `bankConsolidation`**

Dans la page reporting, trouver où `bankConsolidation` est actuellement un bloc vide (bloc "Consolidation externe"). Remplacer le placeholder par le contenu réel :

Chercher dans la page reporting le bloc qui contient "Consolidation externe" et remplacer son contenu par :

```tsx
{/* Consolidation externe — données bancaires */}
<Card className="bg-white border border-alaska-sage-lt rounded-xl">
  <CardHeader className="pb-2 pt-4">
    <CardTitle className="text-base text-alaska-dark">Consolidation bancaire</CardTitle>
  </CardHeader>
  <CardContent className="pb-4 space-y-3">
    {!reporting.bankConsolidation?.has_data ? (
      <p className="text-sm text-alaska-muted text-center py-4">
        Aucun relevé bancaire importé pour ce mois. <br />
        <Link href="/import" className="text-alaska-sage hover:underline">Importer un relevé →</Link>
      </p>
    ) : (
      <>
        {reporting.bankConsolidation.banks.map((bank) => (
          <div key={bank.bank} className="space-y-1">
            <p className="text-xs font-semibold text-alaska-dark uppercase tracking-wide">{bank.label}</p>
            <div className="flex justify-between text-sm">
              <span className="text-alaska-muted">Sorties (débits)</span>
              <span className="font-playfair font-bold text-orange-600">-{formatMAD(bank.total_debit)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-alaska-muted">Entrées (crédits)</span>
              <span className="font-playfair font-bold text-alaska-sage">+{formatMAD(bank.total_credit)}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-alaska-sage-lt pt-1">
              <span className="text-alaska-muted">Flux net</span>
              <span className={cn("font-playfair font-bold", bank.total_credit - bank.total_debit >= 0 ? "text-alaska-sage" : "text-orange-600")}>
                {formatMAD(bank.total_credit - bank.total_debit)}
              </span>
            </div>
          </div>
        ))}
        {reporting.bankConsolidation.banks.length > 1 && (
          <div className="border-t border-alaska-sage-lt pt-2 flex justify-between text-sm font-semibold">
            <span className="text-alaska-dark">Total toutes banques — sorties</span>
            <span className="font-playfair text-orange-600">-{formatMAD(reporting.bankConsolidation.total_debit)}</span>
          </div>
        )}
      </>
    )}
  </CardContent>
</Card>
```

- [ ] **Step 2 : Mettre à jour le contrat de parsing si nécessaire**

Si la page reporting parse la réponse API avec Zod (via `lib/contracts.ts`), ajouter `bankConsolidation: bankConsolidationSchema.catch(...)` dans le schéma de la réponse reporting.

- [ ] **Step 3 : Build**

```bash
npm run build
```

- [ ] **Step 4 : Commit**

```bash
git add app/\(dashboard\)/reporting/page.tsx
git commit -m "feat: display bank consolidation in reporting page"
```

---

## Task 14 : Tests auth pour les nouvelles routes

**Fichiers :**
- Modify: `tests/api-auth.test.ts`

- [ ] **Step 1 : Ajouter les routes bank-statements dans les tests auth**

Trouver dans `tests/api-auth.test.ts` la liste des routes admin-only. Ajouter :

```typescript
{ method: "GET", path: "/api/bank-statements", role: "admin", expectedStatus: 200 },
{ method: "GET", path: "/api/bank-statements", role: "manager", expectedStatus: 403 },
{ method: "GET", path: "/api/bank-statements/fake-id", role: "admin", expectedStatus: 200 },
{ method: "GET", path: "/api/bank-statements/fake-id", role: "manager", expectedStatus: 403 },
```

- [ ] **Step 2 : Lancer les tests**

```bash
npm run test
```

Résultat attendu : tous PASS.

- [ ] **Step 3 : Commit**

```bash
git add tests/api-auth.test.ts
git commit -m "test: add bank-statements routes to api-auth tests"
```

---

## Task 15 : Vérification finale Sprint 2

- [ ] **Step 1 : Lancer tous les tests**

```bash
npm run test
```

- [ ] **Step 2 : Lint et build**

```bash
npm run lint && npm run build
```

- [ ] **Step 3 : Tester manuellement le flux complet**

1. Aller sur `/import` → onglet "Relevés"
2. Sélectionner "Banque Populaire" → uploader un PDF
3. Vérifier la preview des transactions
4. Confirmer l'import
5. Aller sur `/reporting` → vérifier le bloc "Consolidation bancaire"

> **Si aucune transaction n'est détectée lors de l'upload PDF :**
> L'erreur 422 "format non reconnu" signifie que les regex des parsers ne correspondent pas au format du PDF réel. Pour déboguer :
> ```bash
> node -e "const pdfParse = require('pdf-parse'); pdfParse(require('fs').readFileSync('releve.pdf')).then(d => console.log(d.text.slice(0, 2000)))"
> ```
> Puis ajuster les regex dans `lib/bank-parsers/banque-populaire.ts` ou `lib/bank-parsers/cfg.ts` en fonction du texte brut extrait.
