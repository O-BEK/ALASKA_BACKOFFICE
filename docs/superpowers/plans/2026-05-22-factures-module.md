# Module Factures — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un module de facturation B2B à Alaska Pilot — émission de factures TVA 10% (Maroc), PDF téléchargeable, numérotation séquentielle automatique `FAC-YYYY-NNN`.

**Architecture:** Tables Supabase `invoices` + `invoice_lines` avec RLS admin-only. API routes Next.js pour CRUD et génération PDF côté serveur. Page `/factures` (admin uniquement) avec liste et formulaire multi-lignes.

**Tech Stack:** Next.js 14 App Router · Supabase/PostgreSQL · `@react-pdf/renderer` v4 · Vitest · TypeScript · Tailwind CSS

---

## Cartographie des fichiers

| Action | Fichier |
|---|---|
| Créer | `supabase/migrations/20260522000000_invoices.sql` |
| Créer | `lib/invoice-calculations.ts` |
| Créer | `lib/server/invoice-utils.ts` |
| Créer | `lib/pdf/InvoicePdf.tsx` |
| Créer | `lib/hooks/useInvoices.ts` |
| Créer | `app/api/invoices/route.ts` |
| Créer | `app/api/invoices/[id]/route.ts` |
| Créer | `app/api/invoices/[id]/pdf/route.ts` |
| Créer | `app/(dashboard)/factures/page.tsx` |
| Créer | `tests/invoice-calculations.test.ts` |
| Créer | `tests/invoice-utils.test.ts` |
| Modifier | `next.config.mjs` |
| Modifier | `lib/types.ts` |
| Modifier | `lib/contracts.ts` |
| Modifier | `lib/supabase/middleware.ts` |
| Modifier | `components/layout/AppShell.tsx` |
| Modifier | `.env.example` |

---

## Task 1 : Installer la dépendance PDF et configurer Next.js

**Files:**
- Modify: `next.config.mjs`

- [ ] **Step 1 : Installer @react-pdf/renderer**

```bash
npm install @react-pdf/renderer
```

Résultat attendu : `@react-pdf/renderer` apparaît dans `dependencies` dans `package.json`.

- [ ] **Step 2 : Ajouter le package aux external packages dans next.config.mjs**

Contenu complet de `next.config.mjs` après modification :

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdfjs-dist", "@react-pdf/renderer"],
  },
}

export default nextConfig
```

- [ ] **Step 3 : Vérifier que le build ne casse pas**

```bash
npm run build
```

Résultat attendu : build réussi (0 erreurs TypeScript).

- [ ] **Step 4 : Commit**

```bash
git add package.json package-lock.json next.config.mjs
git commit -m "chore: install @react-pdf/renderer, add to server external packages"
```

---

## Task 2 : Migration SQL — tables invoices + invoice_lines

**Files:**
- Create: `supabase/migrations/20260522000000_invoices.sql`

- [ ] **Step 1 : Créer le fichier de migration**

Créer `supabase/migrations/20260522000000_invoices.sql` avec ce contenu :

```sql
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
```

- [ ] **Step 2 : Appliquer la migration sur Supabase**

```bash
npx supabase db push
```

Résultat attendu : "Applying migration 20260522000000_invoices.sql" sans erreur.

- [ ] **Step 3 : Commit**

```bash
git add supabase/migrations/20260522000000_invoices.sql
git commit -m "feat: add invoices and invoice_lines tables with admin RLS"
```

---

## Task 3 : Types TypeScript + Contrats Zod

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/contracts.ts`

- [ ] **Step 1 : Ajouter les types dans lib/types.ts**

Ajouter à la fin de `lib/types.ts` :

```typescript
export type InvoiceStatus = "draft" | "sent" | "paid"

export interface InvoiceLine {
  id: string
  invoice_id: string
  description: string
  quantity: number
  unit_price_ht: number
  tva_rate: number
  line_order: number
}

export interface Invoice {
  id: string
  invoice_number: string
  client_name: string
  client_rc: string | null
  client_address: string | null
  invoice_date: string
  status: InvoiceStatus
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface InvoiceWithLines extends Invoice {
  lines: InvoiceLine[]
}

export interface InvoiceWithTotals extends Invoice {
  total_ht: number
  tva_amount: number
  total_ttc: number
}
```

- [ ] **Step 2 : Ajouter les schémas Zod et parsers dans lib/contracts.ts**

Ajouter à la fin de `lib/contracts.ts` (après les exports existants) :

```typescript
// --- Invoices ---

const invoiceLineSchema = z.object({
  id: z.string().catch(""),
  invoice_id: z.string().catch(""),
  description: z.string().catch(""),
  quantity: z.coerce.number().catch(1),
  unit_price_ht: z.coerce.number().catch(0),
  tva_rate: z.coerce.number().catch(10),
  line_order: z.coerce.number().catch(0),
})

const invoiceSchema = z.object({
  id: z.string().catch(""),
  invoice_number: z.string().catch(""),
  client_name: z.string().catch(""),
  client_rc: z.string().nullable().catch(null),
  client_address: z.string().nullable().catch(null),
  invoice_date: z.string().catch(""),
  status: z.enum(["draft", "sent", "paid"]).catch("draft"),
  notes: z.string().nullable().catch(null),
  created_by: z.string().nullable().catch(null),
  created_at: z.string().catch(""),
})

const invoiceWithTotalsSchema = invoiceSchema.extend({
  total_ht: z.coerce.number().catch(0),
  tva_amount: z.coerce.number().catch(0),
  total_ttc: z.coerce.number().catch(0),
})

export function parseInvoicesPayload(raw: unknown): { invoices: import("@/lib/types").InvoiceWithTotals[]; total: number } {
  const s = z.object({
    invoices: z.array(invoiceWithTotalsSchema).catch([]),
    total: z.coerce.number().catch(0),
  })
  return s.parse(raw) as { invoices: import("@/lib/types").InvoiceWithTotals[]; total: number }
}

export function parseInvoiceDetail(raw: unknown): import("@/lib/types").InvoiceWithLines {
  const s = invoiceSchema.extend({
    lines: z.array(invoiceLineSchema).catch([]),
  })
  return s.parse(raw) as import("@/lib/types").InvoiceWithLines
}

export const createInvoiceBodySchema = z.object({
  client_name: z.string().min(1),
  client_rc: z.string().optional(),
  client_address: z.string().optional(),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
  lines: z
    .array(
      z.object({
        description: z.string().min(1),
        quantity: z.number().positive(),
        unit_price_ht: z.number().min(0),
        tva_rate: z.number().min(0).max(100),
        line_order: z.number().int().min(0),
      })
    )
    .min(1),
})

export type CreateInvoiceBody = z.infer<typeof createInvoiceBodySchema>
```

- [ ] **Step 3 : Vérifier la compilation TypeScript**

```bash
npx tsc --noEmit
```

Résultat attendu : 0 erreur.

- [ ] **Step 4 : Commit**

```bash
git add lib/types.ts lib/contracts.ts
git commit -m "feat: add Invoice types and Zod contracts"
```

---

## Task 4 : Calculs de facture — TDD

**Files:**
- Create: `tests/invoice-calculations.test.ts`
- Create: `lib/invoice-calculations.ts`

- [ ] **Step 1 : Écrire les tests (failing)**

Créer `tests/invoice-calculations.test.ts` :

```typescript
import { describe, it, expect } from "vitest"
import { calcLineTotalHt, calcInvoiceTotals } from "../lib/invoice-calculations"

describe("calcLineTotalHt", () => {
  it("multiplies quantity by unit_price_ht", () => {
    expect(calcLineTotalHt({ quantity: 3, unit_price_ht: 500, tva_rate: 10 })).toBe(1500)
  })
  it("returns 0 when quantity is 0", () => {
    expect(calcLineTotalHt({ quantity: 0, unit_price_ht: 500, tva_rate: 10 })).toBe(0)
  })
  it("handles decimal quantities", () => {
    expect(calcLineTotalHt({ quantity: 1.5, unit_price_ht: 200, tva_rate: 10 })).toBe(300)
  })
})

describe("calcInvoiceTotals", () => {
  it("computes totals for a single line at TVA 10%", () => {
    const result = calcInvoiceTotals([{ quantity: 2, unit_price_ht: 1000, tva_rate: 10 }])
    expect(result.total_ht).toBe(2000)
    expect(result.tva_amount).toBeCloseTo(200)
    expect(result.total_ttc).toBeCloseTo(2200)
  })
  it("sums multiple lines correctly", () => {
    const lines = [
      { quantity: 1, unit_price_ht: 500, tva_rate: 10 },
      { quantity: 4, unit_price_ht: 250, tva_rate: 10 },
    ]
    const result = calcInvoiceTotals(lines)
    expect(result.total_ht).toBe(1500)
    expect(result.tva_amount).toBeCloseTo(150)
    expect(result.total_ttc).toBeCloseTo(1650)
  })
  it("returns zero totals for empty lines", () => {
    const result = calcInvoiceTotals([])
    expect(result.total_ht).toBe(0)
    expect(result.tva_amount).toBe(0)
    expect(result.total_ttc).toBe(0)
  })
  it("applies tva_rate per line independently", () => {
    const lines = [
      { quantity: 1, unit_price_ht: 1000, tva_rate: 10 },
      { quantity: 1, unit_price_ht: 1000, tva_rate: 20 },
    ]
    const result = calcInvoiceTotals(lines)
    expect(result.total_ht).toBe(2000)
    expect(result.tva_amount).toBeCloseTo(300) // 100 + 200
    expect(result.total_ttc).toBeCloseTo(2300)
  })
})
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
npm run test -- tests/invoice-calculations.test.ts
```

Résultat attendu : FAIL — `Cannot find module '../lib/invoice-calculations'`.

- [ ] **Step 3 : Implémenter lib/invoice-calculations.ts**

Créer `lib/invoice-calculations.ts` :

```typescript
export interface InvoiceLineInput {
  quantity: number
  unit_price_ht: number
  tva_rate: number
}

export interface InvoiceTotals {
  total_ht: number
  tva_amount: number
  total_ttc: number
}

export function calcLineTotalHt(line: InvoiceLineInput): number {
  return line.quantity * line.unit_price_ht
}

export function calcInvoiceTotals(lines: InvoiceLineInput[]): InvoiceTotals {
  const total_ht = lines.reduce((sum, l) => sum + calcLineTotalHt(l), 0)
  const tva_amount = lines.reduce((sum, l) => sum + calcLineTotalHt(l) * (l.tva_rate / 100), 0)
  return { total_ht, tva_amount, total_ttc: total_ht + tva_amount }
}
```

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
npm run test -- tests/invoice-calculations.test.ts
```

Résultat attendu : 7 tests PASS.

- [ ] **Step 5 : Commit**

```bash
git add lib/invoice-calculations.ts tests/invoice-calculations.test.ts
git commit -m "feat: add invoice calculation utils with tests"
```

---

## Task 5 : Utilitaire de numérotation — TDD

**Files:**
- Create: `tests/invoice-utils.test.ts`
- Create: `lib/server/invoice-utils.ts`

- [ ] **Step 1 : Écrire les tests (failing)**

Créer `tests/invoice-utils.test.ts` :

```typescript
import { describe, it, expect } from "vitest"
import { buildInvoiceNumber } from "../lib/server/invoice-utils"

describe("buildInvoiceNumber", () => {
  it("returns FAC-YYYY-001 when no previous invoice exists", () => {
    expect(buildInvoiceNumber(2026, null)).toBe("FAC-2026-001")
  })
  it("increments from 001 to 002", () => {
    expect(buildInvoiceNumber(2026, "FAC-2026-001")).toBe("FAC-2026-002")
  })
  it("increments from 009 to 010", () => {
    expect(buildInvoiceNumber(2026, "FAC-2026-009")).toBe("FAC-2026-010")
  })
  it("increments from 099 to 100 (no padding truncation)", () => {
    expect(buildInvoiceNumber(2026, "FAC-2026-099")).toBe("FAC-2026-100")
  })
  it("uses a different year prefix", () => {
    expect(buildInvoiceNumber(2027, null)).toBe("FAC-2027-001")
  })
  it("pads sequence numbers below 100 to 3 digits", () => {
    expect(buildInvoiceNumber(2026, "FAC-2026-010")).toBe("FAC-2026-011")
  })
})
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
npm run test -- tests/invoice-utils.test.ts
```

Résultat attendu : FAIL — `Cannot find module '../lib/server/invoice-utils'`.

- [ ] **Step 3 : Implémenter lib/server/invoice-utils.ts**

Créer `lib/server/invoice-utils.ts` :

```typescript
import type { SupabaseClient } from "@supabase/supabase-js"

export function buildInvoiceNumber(year: number, lastInvoiceNumber: string | null): string {
  const prefix = `FAC-${year}-`
  if (!lastInvoiceNumber) return `${prefix}001`
  const lastNum = parseInt(lastInvoiceNumber.slice(prefix.length), 10)
  const next = isNaN(lastNum) ? 1 : lastNum + 1
  return `${prefix}${String(next).padStart(3, "0")}`
}

export async function nextInvoiceNumber(supabase: SupabaseClient, year?: number): Promise<string> {
  const y = year ?? new Date().getFullYear()
  const prefix = `FAC-${y}-`
  const { data } = await supabase
    .from("invoices")
    .select("invoice_number")
    .like("invoice_number", `${prefix}%`)
    .order("invoice_number", { ascending: false })
    .limit(1)
    .maybeSingle()
  return buildInvoiceNumber(y, data?.invoice_number ?? null)
}
```

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
npm run test -- tests/invoice-utils.test.ts
```

Résultat attendu : 6 tests PASS.

- [ ] **Step 5 : Lancer la suite complète pour détecter les régressions**

```bash
npm run test
```

Résultat attendu : tous les tests existants passent encore.

- [ ] **Step 6 : Commit**

```bash
git add lib/server/invoice-utils.ts tests/invoice-utils.test.ts
git commit -m "feat: add invoice number generation utility with tests"
```

---

## Task 6 : Composant PDF InvoicePdf

**Files:**
- Create: `lib/pdf/InvoicePdf.tsx`

- [ ] **Step 1 : Créer le répertoire lib/pdf et le composant**

Créer `lib/pdf/InvoicePdf.tsx` :

```tsx
import "server-only"
import React from "react"
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer"
import type { Invoice, InvoiceLine } from "@/lib/types"
import type { InvoiceTotals } from "@/lib/invoice-calculations"

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 40,
    color: "#1a1a1a",
  },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  logo: { width: 64, height: 64, objectFit: "contain" },
  companyBlock: { textAlign: "right" },
  companyName: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  invoiceTitle: { fontSize: 22, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    marginTop: 18,
    borderBottomWidth: 0.5,
    borderBottomColor: "#cccccc",
    paddingBottom: 3,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    padding: "6 8",
    fontFamily: "Helvetica-Bold",
    marginTop: 12,
  },
  tableRow: {
    flexDirection: "row",
    padding: "5 8",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ebebeb",
  },
  col1: { flex: 5 },
  col2: { flex: 1, textAlign: "right" },
  col3: { flex: 2, textAlign: "right" },
  col4: { flex: 2, textAlign: "right" },
  totalsSection: { marginTop: 16, alignItems: "flex-end" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 3,
    gap: 24,
  },
  totalLabel: { width: 72, textAlign: "right" },
  totalValue: { width: 88, textAlign: "right" },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#1a1a1a",
    gap: 24,
  },
  grandTotalLabel: { width: 72, textAlign: "right", fontFamily: "Helvetica-Bold", fontSize: 12 },
  grandTotalValue: { width: 88, textAlign: "right", fontFamily: "Helvetica-Bold", fontSize: 12 },
  notes: { marginTop: 20, fontSize: 9, color: "#555555" },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#888888",
    textAlign: "center",
    borderTopWidth: 0.5,
    borderTopColor: "#cccccc",
    paddingTop: 6,
  },
  muted: { color: "#666666" },
})

function fmtMad(n: number): string {
  return (
    n.toLocaleString("fr-MA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " MAD"
  )
}

interface CompanyInfo {
  name: string
  address: string
  rc: string
  ice: string
}

interface InvoicePdfProps {
  invoice: Invoice & { lines: InvoiceLine[] }
  totals: InvoiceTotals
  logoBase64?: string
  company: CompanyInfo
}

export function InvoicePdf({ invoice, totals, logoBase64, company }: InvoicePdfProps) {
  const sortedLines = [...invoice.lines].sort((a, b) => a.line_order - b.line_order)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header : logo à gauche, infos émetteur à droite */}
        <View style={styles.header}>
          <View>
            {logoBase64 ? (
              <Image src={logoBase64} style={styles.logo} />
            ) : null}
          </View>
          <View style={styles.companyBlock}>
            <Text style={styles.companyName}>{company.name}</Text>
            {company.address ? <Text style={styles.muted}>{company.address}</Text> : null}
            {company.rc ? <Text style={styles.muted}>RC : {company.rc}</Text> : null}
            {company.ice ? <Text style={styles.muted}>ICE : {company.ice}</Text> : null}
          </View>
        </View>

        {/* Titre + numéro + date */}
        <Text style={styles.invoiceTitle}>FACTURE</Text>
        <View style={styles.metaRow}>
          <Text>N° {invoice.invoice_number}</Text>
          <Text style={styles.muted}>Date : {invoice.invoice_date}</Text>
        </View>

        {/* Bloc client */}
        <Text style={styles.sectionTitle}>Facturé à</Text>
        <Text style={{ fontFamily: "Helvetica-Bold" }}>{invoice.client_name}</Text>
        {invoice.client_rc ? <Text style={styles.muted}>RC : {invoice.client_rc}</Text> : null}
        {invoice.client_address ? <Text style={styles.muted}>{invoice.client_address}</Text> : null}

        {/* Tableau des prestations */}
        <View style={styles.tableHeader}>
          <Text style={styles.col1}>Désignation</Text>
          <Text style={styles.col2}>Qté</Text>
          <Text style={styles.col3}>PU HT (MAD)</Text>
          <Text style={styles.col4}>Total HT (MAD)</Text>
        </View>
        {sortedLines.map((line, i) => (
          <View key={line.id || String(i)} style={styles.tableRow}>
            <Text style={styles.col1}>{line.description}</Text>
            <Text style={styles.col2}>{line.quantity}</Text>
            <Text style={styles.col3}>{fmtMad(line.unit_price_ht)}</Text>
            <Text style={styles.col4}>{fmtMad(line.quantity * line.unit_price_ht)}</Text>
          </View>
        ))}

        {/* Récapitulatif */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total HT</Text>
            <Text style={styles.totalValue}>{fmtMad(totals.total_ht)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TVA 10%</Text>
            <Text style={styles.totalValue}>{fmtMad(totals.tva_amount)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total TTC</Text>
            <Text style={styles.grandTotalValue}>{fmtMad(totals.total_ttc)}</Text>
          </View>
        </View>

        {/* Notes */}
        {invoice.notes ? (
          <View style={styles.notes}>
            <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 2 }}>Notes</Text>
            <Text>{invoice.notes}</Text>
          </View>
        ) : null}

        {/* Pied de page légal */}
        <Text style={styles.footer}>
          Facture soumise à la TVA au taux de 10% — Paiement à réception de la facture sauf accord préalable écrit
        </Text>
      </Page>
    </Document>
  )
}
```

- [ ] **Step 2 : Vérifier la compilation TypeScript**

```bash
npx tsc --noEmit
```

Résultat attendu : 0 erreur.

- [ ] **Step 3 : Commit**

```bash
git add lib/pdf/InvoicePdf.tsx
git commit -m "feat: add InvoicePdf react-pdf component (A4, TVA 10%, logo)"
```

---

## Task 7 : API GET + POST /api/invoices

**Files:**
- Create: `app/api/invoices/route.ts`

- [ ] **Step 1 : Créer app/api/invoices/route.ts**

```typescript
import { NextResponse } from "next/server"
import { createClient, isAdmin } from "@/lib/supabase/server"
import { calcInvoiceTotals } from "@/lib/invoice-calculations"
import { createInvoiceBodySchema } from "@/lib/contracts"
import { nextInvoiceNumber } from "@/lib/server/invoice-utils"
import type { InvoiceWithTotals } from "@/lib/types"

export async function GET() {
  const supabase = createClient()
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user || !(await isAdmin(supabase, user.id))) {
      return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
    }

    const { data, error } = await supabase
      .from("invoices")
      .select("*, invoice_lines (id, quantity, unit_price_ht, tva_rate, line_order)")
      .order("invoice_date", { ascending: false })

    if (error) throw new Error(error.message)

    const invoices: InvoiceWithTotals[] = (data ?? []).map((inv: any) => {
      const lines: Array<{ quantity: number; unit_price_ht: number; tva_rate: number }> =
        inv.invoice_lines ?? []
      const { total_ht, tva_amount, total_ttc } = calcInvoiceTotals(lines)
      const { invoice_lines: _lines, ...rest } = inv
      return { ...rest, total_ht, tva_amount, total_ttc }
    })

    return NextResponse.json({ invoices, total: invoices.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    console.error("[api/invoices GET]", message)
    return NextResponse.json({ error: "Impossible de charger les factures." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const supabase = createClient()
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user || !(await isAdmin(supabase, user.id))) {
      return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
    }

    const raw = await request.json()
    const body = createInvoiceBodySchema.parse(raw)
    const invoice_number = await nextInvoiceNumber(supabase)

    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .insert({
        invoice_number,
        client_name: body.client_name,
        client_rc: body.client_rc ?? null,
        client_address: body.client_address ?? null,
        invoice_date: body.invoice_date,
        notes: body.notes ?? null,
        created_by: user.id,
      })
      .select()
      .single()

    if (invErr || !invoice) throw new Error(invErr?.message ?? "Échec création facture")

    const lineRows = body.lines.map((l, i) => ({
      invoice_id: invoice.id,
      description: l.description,
      quantity: l.quantity,
      unit_price_ht: l.unit_price_ht,
      tva_rate: l.tva_rate,
      line_order: l.line_order ?? i,
    }))

    const { error: linesErr } = await supabase.from("invoice_lines").insert(lineRows)
    if (linesErr) throw new Error(linesErr.message)

    return NextResponse.json({ invoice }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    console.error("[api/invoices POST]", message)
    return NextResponse.json(
      { error: `Impossible de créer la facture. ${message}` },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2 : Vérifier la compilation TypeScript**

```bash
npx tsc --noEmit
```

Résultat attendu : 0 erreur.

- [ ] **Step 3 : Commit**

```bash
git add app/api/invoices/route.ts
git commit -m "feat: add GET+POST /api/invoices route"
```

---

## Task 8 : API GET + PATCH /api/invoices/[id]

**Files:**
- Create: `app/api/invoices/[id]/route.ts`

- [ ] **Step 1 : Créer app/api/invoices/[id]/route.ts**

```typescript
import { NextResponse } from "next/server"
import { createClient, isAdmin } from "@/lib/supabase/server"

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user || !(await isAdmin(supabase, user.id))) {
      return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
    }

    const { data, error } = await supabase
      .from("invoices")
      .select("*, invoice_lines (*)")
      .eq("id", params.id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Facture introuvable." }, { status: 404 })
    }

    const lines = (data.invoice_lines ?? []).sort(
      (a: { line_order: number }, b: { line_order: number }) => a.line_order - b.line_order
    )

    return NextResponse.json({ invoice: { ...data, lines } })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    console.error("[api/invoices/[id] GET]", message)
    return NextResponse.json({ error: "Impossible de charger la facture." }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user || !(await isAdmin(supabase, user.id))) {
      return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
    }

    const { status } = await request.json()
    if (!["draft", "sent", "paid"].includes(status)) {
      return NextResponse.json({ error: "Statut invalide." }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("invoices")
      .update({ status })
      .eq("id", params.id)
      .select()
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Facture introuvable." }, { status: 404 })
    }

    return NextResponse.json({ invoice: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    console.error("[api/invoices/[id] PATCH]", message)
    return NextResponse.json({ error: "Impossible de mettre à jour la facture." }, { status: 500 })
  }
}
```

- [ ] **Step 2 : Vérifier la compilation TypeScript**

```bash
npx tsc --noEmit
```

Résultat attendu : 0 erreur.

- [ ] **Step 3 : Commit**

```bash
git add "app/api/invoices/[id]/route.ts"
git commit -m "feat: add GET+PATCH /api/invoices/[id] route"
```

---

## Task 9 : API PDF /api/invoices/[id]/pdf

**Files:**
- Create: `app/api/invoices/[id]/pdf/route.ts`

- [ ] **Step 1 : Créer app/api/invoices/[id]/pdf/route.ts**

```typescript
import { NextResponse } from "next/server"
import { createClient, isAdmin } from "@/lib/supabase/server"
import { renderToBuffer } from "@react-pdf/renderer"
import { InvoicePdf } from "@/lib/pdf/InvoicePdf"
import { calcInvoiceTotals } from "@/lib/invoice-calculations"
import fs from "fs"
import path from "path"
import React from "react"

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user || !(await isAdmin(supabase, user.id))) {
      return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
    }

    const { data, error } = await supabase
      .from("invoices")
      .select("*, invoice_lines (*)")
      .eq("id", params.id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Facture introuvable." }, { status: 404 })
    }

    const lines = (data.invoice_lines ?? []).sort(
      (a: { line_order: number }, b: { line_order: number }) => a.line_order - b.line_order
    )
    const totals = calcInvoiceTotals(lines)

    const logoPath = path.join(process.cwd(), "public", "logo.png")
    const logoBase64 = fs.existsSync(logoPath)
      ? `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`
      : undefined

    const company = {
      name: process.env.NEXT_PUBLIC_COMPANY_NAME ?? "Alaska Neo Bistrot",
      address: process.env.NEXT_PUBLIC_COMPANY_ADDRESS ?? "",
      rc: process.env.NEXT_PUBLIC_COMPANY_RC ?? "",
      ice: process.env.NEXT_PUBLIC_COMPANY_ICE ?? "",
    }

    const pdfBuffer = await renderToBuffer(
      React.createElement(InvoicePdf, {
        invoice: { ...data, lines },
        totals,
        logoBase64,
        company,
      })
    )

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${data.invoice_number}.pdf"`,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    console.error("[api/invoices/[id]/pdf]", message)
    return NextResponse.json({ error: "Impossible de générer le PDF." }, { status: 500 })
  }
}
```

- [ ] **Step 2 : Vérifier la compilation TypeScript**

```bash
npx tsc --noEmit
```

Résultat attendu : 0 erreur.

- [ ] **Step 3 : Commit**

```bash
git add "app/api/invoices/[id]/pdf/route.ts"
git commit -m "feat: add GET /api/invoices/[id]/pdf — server-side PDF generation"
```

---

## Task 10 : Hook client useInvoices

**Files:**
- Create: `lib/hooks/useInvoices.ts`

- [ ] **Step 1 : Créer lib/hooks/useInvoices.ts**

```typescript
"use client"

import { useCallback, useEffect, useState } from "react"
import { parseInvoicesPayload } from "@/lib/contracts"
import type { InvoiceStatus, InvoiceWithTotals } from "@/lib/types"

export function useInvoices() {
  const [invoices, setInvoices] = useState<InvoiceWithTotals[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/invoices")
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error || `Erreur ${response.status}`)
      const { invoices } = parseInvoicesPayload(json)
      setInvoices(invoices)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const createInvoice = async (data: {
    client_name: string
    client_rc?: string
    client_address?: string
    invoice_date: string
    notes?: string
    lines: Array<{
      description: string
      quantity: number
      unit_price_ht: number
      tva_rate: number
      line_order: number
    }>
  }) => {
    const response = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    const json = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(json.error || `Erreur ${response.status}`)
    await load()
  }

  const updateStatus = async (id: string, status: InvoiceStatus) => {
    const response = await fetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    const json = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(json.error || `Erreur ${response.status}`)
    setInvoices((prev) => prev.map((inv) => (inv.id === id ? { ...inv, status } : inv)))
  }

  const downloadPdf = async (id: string, invoiceNumber: string) => {
    const response = await fetch(`/api/invoices/${id}/pdf`)
    if (!response.ok) throw new Error("Impossible de générer le PDF")
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${invoiceNumber}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  return { invoices, loading, error, createInvoice, updateStatus, downloadPdf, reload: load }
}
```

- [ ] **Step 2 : Vérifier la compilation TypeScript**

```bash
npx tsc --noEmit
```

Résultat attendu : 0 erreur.

- [ ] **Step 3 : Commit**

```bash
git add lib/hooks/useInvoices.ts
git commit -m "feat: add useInvoices hook (list, create, updateStatus, downloadPdf)"
```

---

## Task 11 : Middleware + Navigation sidebar

**Files:**
- Modify: `lib/supabase/middleware.ts`
- Modify: `components/layout/AppShell.tsx`

- [ ] **Step 1 : Ajouter /factures dans middleware.ts**

Dans `lib/supabase/middleware.ts`, modifier :

1. Ajouter `"/factures"` dans `ADMIN_ROUTES` :

```typescript
// Avant
const ADMIN_ROUTES = ["/", "/charges", "/objectifs", "/import", "/reporting"]

// Après
const ADMIN_ROUTES = ["/", "/charges", "/objectifs", "/import", "/reporting", "/factures"]
```

2. Ajouter `pathname.startsWith("/factures")` dans `isProtectedRoute` :

```typescript
// Avant
const isProtectedRoute =
  pathname === "/" ||
  pathname.startsWith("/saisie") ||
  pathname.startsWith("/semaine") ||
  pathname.startsWith("/charges") ||
  pathname.startsWith("/objectifs") ||
  pathname.startsWith("/import") ||
  pathname.startsWith("/reporting")

// Après
const isProtectedRoute =
  pathname === "/" ||
  pathname.startsWith("/saisie") ||
  pathname.startsWith("/semaine") ||
  pathname.startsWith("/charges") ||
  pathname.startsWith("/objectifs") ||
  pathname.startsWith("/import") ||
  pathname.startsWith("/reporting") ||
  pathname.startsWith("/factures")
```

- [ ] **Step 2 : Ajouter /factures dans la navigation admin (AppShell.tsx)**

Dans `components/layout/AppShell.tsx` :

1. Modifier la ligne d'import Lucide pour inclure `FileText` :

```typescript
// Avant
import { CalendarDays, Edit3, FileBarChart, Home, LogOut, Menu, Settings, Target, UploadCloud, X } from "lucide-react"

// Après
import { CalendarDays, Edit3, FileBarChart, FileText, Home, LogOut, Menu, Settings, Target, UploadCloud, X } from "lucide-react"
```

2. Ajouter l'entrée dans `navByRole.admin` (après `"/import"`, avant `"/charges"`) :

```typescript
// Avant
const navByRole: Record<UserRole, { href: string; label: string; icon: any }[]> = {
  admin: [
    { href: "/", icon: Home, label: "Accueil" },
    { href: "/saisie", icon: Edit3, label: "Caisse" },
    { href: "/semaine", icon: CalendarDays, label: "Semaine" },
    { href: "/reporting", icon: FileBarChart, label: "Pilotage" },
    { href: "/objectifs", icon: Target, label: "Objectifs" },
    { href: "/import", icon: UploadCloud, label: "Imports" },
    { href: "/charges", icon: Settings, label: "Réglages" },
  ],

// Après
const navByRole: Record<UserRole, { href: string; label: string; icon: any }[]> = {
  admin: [
    { href: "/", icon: Home, label: "Accueil" },
    { href: "/saisie", icon: Edit3, label: "Caisse" },
    { href: "/semaine", icon: CalendarDays, label: "Semaine" },
    { href: "/reporting", icon: FileBarChart, label: "Pilotage" },
    { href: "/objectifs", icon: Target, label: "Objectifs" },
    { href: "/import", icon: UploadCloud, label: "Imports" },
    { href: "/factures", icon: FileText, label: "Factures" },
    { href: "/charges", icon: Settings, label: "Réglages" },
  ],
```

- [ ] **Step 3 : Vérifier la compilation TypeScript**

```bash
npx tsc --noEmit
```

Résultat attendu : 0 erreur.

- [ ] **Step 4 : Commit**

```bash
git add lib/supabase/middleware.ts components/layout/AppShell.tsx
git commit -m "feat: add /factures to admin routes, middleware and sidebar nav"
```

---

## Task 12 : Page /factures

**Files:**
- Create: `app/(dashboard)/factures/page.tsx`

- [ ] **Step 1 : Créer app/(dashboard)/factures/page.tsx**

```tsx
"use client"

import { useState } from "react"
import { Download, FileText, Plus, Trash2 } from "lucide-react"
import { useInvoices } from "@/lib/hooks/useInvoices"
import { calcInvoiceTotals } from "@/lib/invoice-calculations"
import { formatMAD } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { InvoiceStatus } from "@/lib/types"

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; className: string }> = {
  draft: { label: "Brouillon", className: "bg-gray-100 text-gray-600" },
  sent: { label: "Envoyée", className: "bg-blue-100 text-blue-700" },
  paid: { label: "Payée", className: "bg-green-100 text-green-700" },
}

interface FormLine {
  description: string
  quantity: string
  unit_price_ht: string
}

const emptyLine = (): FormLine => ({ description: "", quantity: "1", unit_price_ht: "" })

export default function FacturesPage() {
  const { invoices, loading, error, createInvoice, updateStatus, downloadPdf } = useInvoices()

  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)

  const [clientName, setClientName] = useState("")
  const [clientRc, setClientRc] = useState("")
  const [clientAddress, setClientAddress] = useState("")
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState("")
  const [lines, setLines] = useState<FormLine[]>([emptyLine()])

  const resetForm = () => {
    setClientName("")
    setClientRc("")
    setClientAddress("")
    setNotes("")
    setInvoiceDate(new Date().toISOString().slice(0, 10))
    setLines([emptyLine()])
    setFormError(null)
    setShowForm(false)
  }

  const parsedLines = lines.map((l, i) => ({
    description: l.description,
    quantity: parseFloat(l.quantity) || 0,
    unit_price_ht: parseFloat(l.unit_price_ht) || 0,
    tva_rate: 10,
    line_order: i,
  }))

  const totals = calcInvoiceTotals(parsedLines)

  const handleLineChange = (i: number, field: keyof FormLine, value: string) => {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)))
  }

  const handleSubmit = async () => {
    setFormError(null)
    if (!clientName.trim()) {
      setFormError("Le nom du client est requis.")
      return
    }
    const validLines = parsedLines.filter((l) => l.description.trim() && l.quantity > 0)
    if (validLines.length === 0) {
      setFormError("Ajoutez au moins une ligne avec une désignation et une quantité.")
      return
    }
    setSubmitting(true)
    try {
      await createInvoice({
        client_name: clientName.trim(),
        client_rc: clientRc.trim() || undefined,
        client_address: clientAddress.trim() || undefined,
        invoice_date: invoiceDate,
        notes: notes.trim() || undefined,
        lines: validLines,
      })
      resetForm()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur lors de la création")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDownload = async (id: string, invoiceNumber: string) => {
    setDownloading(id)
    try {
      await downloadPdf(id, invoiceNumber)
    } catch {
      // erreur silencieuse — le bouton reprend son état normal
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-alaska-dark">Factures</h1>
          <p className="text-sm text-alaska-muted mt-1">
            Émission de factures B2B avec TVA 10% (Maroc)
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus size={16} /> Nouvelle facture
          </Button>
        )}
      </div>

      {/* Formulaire de création */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nouvelle facture</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Infos client */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-alaska-muted">
                  Entreprise cliente *
                </label>
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Nom de l'entreprise"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-alaska-muted">RC</label>
                <Input
                  value={clientRc}
                  onChange={(e) => setClientRc(e.target.value)}
                  placeholder="Registre de commerce"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-alaska-muted">Adresse</label>
                <Input
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  placeholder="Adresse (optionnel)"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-alaska-muted">Date de facture</label>
                <Input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                />
              </div>
            </div>

            {/* Lignes de prestation */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-alaska-muted">Prestations</label>
              <div className="hidden md:grid grid-cols-12 gap-2 text-xs text-alaska-muted px-1">
                <span className="col-span-5">Désignation</span>
                <span className="col-span-2 text-right">Quantité</span>
                <span className="col-span-3 text-right">PU HT (MAD)</span>
                <span className="col-span-2 text-right">Total HT</span>
              </div>
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <Input
                    className="col-span-5"
                    value={line.description}
                    onChange={(e) => handleLineChange(i, "description", e.target.value)}
                    placeholder="Désignation de la prestation"
                  />
                  <Input
                    className="col-span-2 text-right"
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.quantity}
                    onChange={(e) => handleLineChange(i, "quantity", e.target.value)}
                  />
                  <Input
                    className="col-span-3 text-right"
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unit_price_ht}
                    onChange={(e) => handleLineChange(i, "unit_price_ht", e.target.value)}
                    placeholder="0.00"
                  />
                  <div className="col-span-1 text-right text-sm font-medium text-alaska-dark">
                    {formatMAD(
                      (parseFloat(line.quantity) || 0) * (parseFloat(line.unit_price_ht) || 0)
                    )}
                  </div>
                  <div className="col-span-1 flex justify-center">
                    {lines.length > 1 && (
                      <button
                        onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-red-400 hover:text-red-600 transition"
                        aria-label="Supprimer la ligne"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLines((prev) => [...prev, emptyLine()])}
                className="gap-1"
              >
                <Plus size={14} /> Ajouter une ligne
              </Button>
            </div>

            {/* Récapitulatif live */}
            <div className="bg-alaska-cream rounded-lg p-4 text-sm space-y-1.5">
              <div className="flex justify-between text-alaska-muted">
                <span>Total HT</span>
                <span>{formatMAD(totals.total_ht)}</span>
              </div>
              <div className="flex justify-between text-alaska-muted">
                <span>TVA 10%</span>
                <span>{formatMAD(totals.tva_amount)}</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t border-alaska-dark/10 pt-2">
                <span>Total TTC</span>
                <span>{formatMAD(totals.total_ttc)}</span>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-alaska-muted">Notes (optionnel)</label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observations, conditions particulières..."
              />
            </div>

            {formError && <p className="text-red-500 text-sm">{formError}</p>}

            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Enregistrement..." : "Enregistrer la facture"}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Liste des factures */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText size={16} />
            Factures émises{" "}
            {!loading && <span className="text-alaska-muted font-normal">({invoices.length})</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <p className="text-alaska-muted text-sm py-4">Chargement...</p>}
          {error && <p className="text-red-500 text-sm">{error}</p>}
          {!loading && !error && invoices.length === 0 && (
            <p className="text-alaska-muted text-sm text-center py-10">
              Aucune facture. Cliquez sur &quot;Nouvelle facture&quot; pour commencer.
            </p>
          )}
          {invoices.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium text-alaska-muted">N°</th>
                    <th className="pb-2 font-medium text-alaska-muted">Client</th>
                    <th className="pb-2 font-medium text-alaska-muted hidden md:table-cell">
                      Date
                    </th>
                    <th className="pb-2 font-medium text-alaska-muted text-right">Total TTC</th>
                    <th className="pb-2 font-medium text-alaska-muted">Statut</th>
                    <th className="pb-2 font-medium text-alaska-muted text-right">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoices.map((inv) => {
                    const s = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.draft
                    return (
                      <tr key={inv.id} className="hover:bg-alaska-cream/40 transition">
                        <td className="py-3 font-mono text-xs text-alaska-muted">
                          {inv.invoice_number}
                        </td>
                        <td className="py-3">
                          <div className="font-medium">{inv.client_name}</div>
                          {inv.client_rc && (
                            <div className="text-xs text-alaska-muted">RC: {inv.client_rc}</div>
                          )}
                        </td>
                        <td className="py-3 hidden md:table-cell text-alaska-muted">
                          {inv.invoice_date}
                        </td>
                        <td className="py-3 text-right font-medium">
                          {formatMAD(inv.total_ttc)}
                        </td>
                        <td className="py-3">
                          <select
                            value={inv.status}
                            onChange={(e) =>
                              updateStatus(inv.id, e.target.value as InvoiceStatus)
                            }
                            className={`text-xs px-2 py-1 rounded-full border-0 cursor-pointer font-medium ${s.className}`}
                          >
                            <option value="draft">Brouillon</option>
                            <option value="sent">Envoyée</option>
                            <option value="paid">Payée</option>
                          </select>
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => handleDownload(inv.id, inv.invoice_number)}
                            disabled={downloading === inv.id}
                            className="inline-flex items-center gap-1 text-alaska-sage hover:text-alaska-dark text-xs transition disabled:opacity-50"
                            aria-label={`Télécharger PDF de la facture ${inv.invoice_number}`}
                          >
                            <Download size={14} />
                            {downloading === inv.id ? "..." : "PDF"}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2 : Vérifier la compilation TypeScript**

```bash
npx tsc --noEmit
```

Résultat attendu : 0 erreur.

- [ ] **Step 3 : Lancer les tests complets**

```bash
npm run test
```

Résultat attendu : tous les tests passent (y compris les 13 nouveaux).

- [ ] **Step 4 : Lint**

```bash
npm run lint
```

Résultat attendu : 0 erreur.

- [ ] **Step 5 : Commit**

```bash
git add "app/(dashboard)/factures/page.tsx"
git commit -m "feat: add /factures page — invoice list and creation form"
```

---

## Task 13 : Variables d'environnement

**Files:**
- Modify: `.env.example`

- [ ] **Step 1 : Ajouter les variables company dans .env.example**

Ajouter à la fin de `.env.example` :

```env
# Informations émetteur — utilisées sur les factures PDF
NEXT_PUBLIC_COMPANY_NAME=Alaska Neo Bistrot
NEXT_PUBLIC_COMPANY_ADDRESS=Rabat, Maroc
NEXT_PUBLIC_COMPANY_RC=
NEXT_PUBLIC_COMPANY_ICE=
```

- [ ] **Step 2 : Build final pour vérifier**

```bash
npm run build
```

Résultat attendu : build réussi, 0 erreur.

- [ ] **Step 3 : Commit final**

```bash
git add .env.example
git commit -m "chore: add company env vars for PDF invoices"
```

---

## Auto-review — couverture du spec

| Exigence spec | Couvert par |
|---|---|
| Table `invoices` avec statut + numérotation | Task 2 |
| Table `invoice_lines` avec TVA 10% | Task 2 |
| RLS admin-only sur les deux tables | Task 2 |
| Numérotation `FAC-YYYY-NNN` auto-incrémentale | Task 5 (`buildInvoiceNumber` + `nextInvoiceNumber`) |
| Calculs HT / TVA 10% / TTC | Task 4 (`calcInvoiceTotals`) |
| Types TypeScript `Invoice`, `InvoiceLine`, `InvoiceWithTotals` | Task 3 |
| Contrats Zod + parsers | Task 3 |
| `GET /api/invoices` — liste avec totaux | Task 7 |
| `POST /api/invoices` — création + lignes | Task 7 |
| `GET /api/invoices/[id]` — détail | Task 8 |
| `PATCH /api/invoices/[id]` — statut | Task 8 |
| `GET /api/invoices/[id]/pdf` — PDF serveur | Task 9 |
| Composant PDF A4 (logo, client RC, tableau, totaux, footer légal) | Task 6 |
| Variables d'env `NEXT_PUBLIC_COMPANY_*` | Task 6 + Task 13 |
| Hook `useInvoices` (createInvoice, updateStatus, downloadPdf) | Task 10 |
| `/factures` dans middleware (admin-only, route protégée) | Task 11 |
| Entrée "Factures" dans la sidebar admin | Task 11 |
| Page `/factures` — liste + formulaire multi-lignes + récap live | Task 12 |
| Tests `invoice-calculations.test.ts` | Task 4 |
| Tests `invoice-utils.test.ts` | Task 5 |
