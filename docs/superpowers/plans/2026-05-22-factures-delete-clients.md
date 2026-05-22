# Factures — Suppression & Carnet d'entreprises

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter la suppression de factures brouillon et un carnet d'entreprises clientes (nom, adresse, ICE) avec autocomplétion dans le formulaire de création de facture.

**Architecture:** Nouvelle table `clients` avec RLS admin uniquement. Deux nouvelles routes API (`/api/clients` et `/api/clients/[id]`). La suppression de facture est ajoutée comme handler `DELETE` sur la route existante `/api/invoices/[id]`. La page `/factures` intègre l'autocomplétion client et une section de gestion des entreprises.

**Tech Stack:** Next.js 14 App Router, Supabase/PostgreSQL, Zod, React hooks, Tailwind CSS, shadcn/ui

---

## File Map

| Action | Fichier |
|--------|---------|
| Créer | `supabase/migrations/20260522100000_clients.sql` |
| Modifier | `lib/types.ts` — ajouter `Client` |
| Modifier | `lib/contracts.ts` — ajouter `clientSchema`, `parseClientsPayload`, `createClientBodySchema` |
| Créer | `app/api/clients/route.ts` — GET + POST |
| Créer | `app/api/clients/[id]/route.ts` — DELETE |
| Modifier | `app/api/invoices/[id]/route.ts` — ajouter DELETE handler |
| Créer | `lib/hooks/useClients.ts` |
| Modifier | `lib/hooks/useInvoices.ts` — ajouter `deleteInvoice` |
| Modifier | `app/(dashboard)/factures/page.tsx` — delete button, autocomplete, section entreprises |
| Modifier | `tests/api-auth.test.ts` — couvrir les nouveaux DELETE |

---

### Task 1 : Migration SQL — table `clients`

**Files:**
- Create: `supabase/migrations/20260522100000_clients.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
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
```

- [ ] **Step 2 : Appliquer via Supabase MCP**

```
mcp__supabase__apply_migration avec le contenu ci-dessus
```

Vérifier qu'aucune erreur n'est retournée.

- [ ] **Step 3 : Commit**

```bash
git add supabase/migrations/20260522100000_clients.sql
git commit -m "feat: add clients table with RLS"
```

---

### Task 2 : Types & Contrats

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/contracts.ts`

- [ ] **Step 1 : Ajouter le type `Client` dans `lib/types.ts`**

Ajouter après la dernière interface (à la fin du fichier) :

```typescript
export interface Client {
  id: string
  name: string
  address: string | null
  ice: string | null
  created_at: string
}
```

- [ ] **Step 2 : Ajouter les parseurs dans `lib/contracts.ts`**

Ajouter à la fin du fichier (après le bloc `// --- Invoices ---`) :

```typescript
// --- Clients ---

import type { Client } from "@/lib/types"

const clientSchema = z.object({
  id: z.string().catch(""),
  name: z.string().catch(""),
  address: z.string().nullable().catch(null),
  ice: z.string().nullable().catch(null),
  created_at: z.string().catch(""),
})

export function parseClientsPayload(raw: unknown): { clients: Client[] } {
  return z.object({ clients: z.array(clientSchema).catch([]) }).parse(raw) as { clients: Client[] }
}

export const createClientBodySchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  ice: z.string().optional(),
})

export type CreateClientBody = z.infer<typeof createClientBodySchema>
```

Note : `Client` est déjà importé en tête de `contracts.ts` via les imports de types — ajouter `Client` à la liste d'imports existante en haut du fichier.

- [ ] **Step 3 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Expected : aucune erreur.

- [ ] **Step 4 : Commit**

```bash
git add lib/types.ts lib/contracts.ts
git commit -m "feat: add Client type and Zod contracts"
```

---

### Task 3 : API GET/POST `/api/clients`

**Files:**
- Create: `app/api/clients/route.ts`

- [ ] **Step 1 : Créer la route**

```typescript
// app/api/clients/route.ts
import { NextResponse } from "next/server"
import { createClient, isAdmin } from "@/lib/supabase/server"
import { createClientBodySchema } from "@/lib/contracts"

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
      .from("clients")
      .select("*")
      .order("name", { ascending: true })

    if (error) throw new Error(error.message)
    return NextResponse.json({ clients: data ?? [] })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    console.error("[api/clients GET]", message)
    return NextResponse.json({ error: "Impossible de charger les entreprises." }, { status: 500 })
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
    const body = createClientBodySchema.parse(raw)

    const { data, error } = await supabase
      .from("clients")
      .insert({
        name: body.name,
        address: body.address ?? null,
        ice: body.ice ?? null,
        created_by: user.id,
      })
      .select()
      .single()

    if (error || !data) throw new Error(error?.message ?? "Échec création")
    return NextResponse.json({ client: data }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    console.error("[api/clients POST]", message)
    return NextResponse.json({ error: "Impossible de créer l'entreprise." }, { status: 500 })
  }
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3 : Commit**

```bash
git add app/api/clients/route.ts
git commit -m "feat: add GET/POST /api/clients"
```

---

### Task 4 : API DELETE `/api/clients/[id]`

**Files:**
- Create: `app/api/clients/[id]/route.ts`

- [ ] **Step 1 : Créer la route**

```typescript
// app/api/clients/[id]/route.ts
import { NextResponse } from "next/server"
import { createClient, isAdmin } from "@/lib/supabase/server"

export async function DELETE(
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

    const { error } = await supabase.from("clients").delete().eq("id", params.id)
    if (error) {
      console.error("[api/clients/[id] DELETE]", error.message)
      return NextResponse.json({ error: "Impossible de supprimer l'entreprise." }, { status: 500 })
    }

    return new Response(null, { status: 204 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    console.error("[api/clients/[id] DELETE]", message)
    return NextResponse.json({ error: "Impossible de supprimer l'entreprise." }, { status: 500 })
  }
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3 : Commit**

```bash
git add "app/api/clients/[id]/route.ts"
git commit -m "feat: add DELETE /api/clients/[id]"
```

---

### Task 5 : DELETE `/api/invoices/[id]`

**Files:**
- Modify: `app/api/invoices/[id]/route.ts`

- [ ] **Step 1 : Ajouter le handler DELETE**

Ajouter après le handler `PATCH` existant (fin du fichier) :

```typescript
export async function DELETE(
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

    const { data: inv, error: fetchErr } = await supabase
      .from("invoices")
      .select("status")
      .eq("id", params.id)
      .single()

    if (fetchErr || !inv) {
      return NextResponse.json({ error: "Facture introuvable." }, { status: 404 })
    }
    if (inv.status !== "draft") {
      return NextResponse.json(
        { error: "Seules les factures en brouillon peuvent être supprimées." },
        { status: 409 }
      )
    }

    const { error } = await supabase.from("invoices").delete().eq("id", params.id)
    if (error) {
      console.error("[api/invoices/[id] DELETE]", error.message)
      return NextResponse.json({ error: "Impossible de supprimer la facture." }, { status: 500 })
    }

    return new Response(null, { status: 204 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    console.error("[api/invoices/[id] DELETE]", message)
    return NextResponse.json({ error: "Impossible de supprimer la facture." }, { status: 500 })
  }
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3 : Commit**

```bash
git add "app/api/invoices/[id]/route.ts"
git commit -m "feat: add DELETE /api/invoices/[id] (draft only)"
```

---

### Task 6 : Hook `useClients`

**Files:**
- Create: `lib/hooks/useClients.ts`

- [ ] **Step 1 : Créer le hook**

```typescript
// lib/hooks/useClients.ts
"use client"

import { useCallback, useEffect, useState } from "react"
import { parseClientsPayload } from "@/lib/contracts"
import type { Client } from "@/lib/types"

export function useClients() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/clients")
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`)
      const { clients } = parseClientsPayload(json)
      setClients(clients)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const addClient = async (data: { name: string; address?: string; ice?: string }) => {
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`)
    await load()
  }

  const deleteClient = async (id: string) => {
    const res = await fetch(`/api/clients/${id}`, { method: "DELETE" })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      throw new Error(json.error || `Erreur ${res.status}`)
    }
    setClients((prev) => prev.filter((c) => c.id !== id))
  }

  return { clients, loading, error, addClient, deleteClient, reload: load }
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3 : Commit**

```bash
git add lib/hooks/useClients.ts
git commit -m "feat: add useClients hook"
```

---

### Task 7 : Ajouter `deleteInvoice` dans `useInvoices`

**Files:**
- Modify: `lib/hooks/useInvoices.ts`

- [ ] **Step 1 : Ajouter la fonction dans le hook**

Dans `lib/hooks/useInvoices.ts`, ajouter avant le `return` final :

```typescript
  const deleteInvoice = async (id: string) => {
    const response = await fetch(`/api/invoices/${id}`, { method: "DELETE" })
    if (!response.ok) {
      const json = await response.json().catch(() => ({}))
      throw new Error(json.error || `Erreur ${response.status}`)
    }
    setInvoices((prev) => prev.filter((inv) => inv.id !== id))
  }
```

Et ajouter `deleteInvoice` dans l'objet retourné :

```typescript
  return { invoices, loading, error, createInvoice, updateStatus, downloadPdf, deleteInvoice, reload: load }
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3 : Commit**

```bash
git add lib/hooks/useInvoices.ts
git commit -m "feat: add deleteInvoice to useInvoices hook"
```

---

### Task 8 : Tests auth pour les nouveaux DELETE

**Files:**
- Modify: `tests/api-auth.test.ts`

- [ ] **Step 1 : Lire les imports existants du test pour identifier le pattern de mock Supabase**

Le fichier `tests/api-auth.test.ts` expose une fonction `makeSupabaseMock(user, role)` et importe les routes via des imports dynamiques. Suivre le même pattern.

- [ ] **Step 2 : Ajouter les cas de test DELETE**

Dans `tests/api-auth.test.ts`, après les tests existants sur `/api/invoices`, ajouter :

```typescript
describe("DELETE /api/invoices/[id] — auth", () => {
  it("retourne 403 pour manager", async () => {
    vi.mocked(createServerClient).mockReturnValue(
      makeSupabaseMock({ id: "manager-1" }, "manager") as any
    )
    const { DELETE } = await import("@/app/api/invoices/[id]/route")
    const res = await DELETE(new Request("http://localhost"), {
      params: { id: "some-uuid" },
    })
    expect(res.status).toBe(403)
  })
})

describe("DELETE /api/clients/[id] — auth", () => {
  it("retourne 403 pour manager", async () => {
    vi.mocked(createServerClient).mockReturnValue(
      makeSupabaseMock({ id: "manager-1" }, "manager") as any
    )
    const { DELETE } = await import("@/app/api/clients/[id]/route")
    const res = await DELETE(new Request("http://localhost"), {
      params: { id: "some-uuid" },
    })
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 3 : Lancer les tests**

```bash
npm run test
```

Expected : tous les tests passent (les deux nouveaux inclus).

- [ ] **Step 4 : Commit**

```bash
git add tests/api-auth.test.ts
git commit -m "test: cover DELETE invoices and clients auth"
```

---

### Task 9 : Page `/factures` — suppression + autocomplete + section entreprises

**Files:**
- Modify: `app/(dashboard)/factures/page.tsx`

C'est la tâche la plus volumineuse. Elle remplace complètement le fichier.

- [ ] **Step 1 : Écrire la nouvelle page**

```typescript
// app/(dashboard)/factures/page.tsx
"use client"

import { useRef, useState } from "react"
import { Building2, ChevronDown, ChevronUp, Download, FileText, Plus, Trash2, X } from "lucide-react"
import { useInvoices } from "@/lib/hooks/useInvoices"
import { useClients } from "@/lib/hooks/useClients"
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
  id: number
  description: string
  quantity: string
  unit_price_ht: string
}

let lineCounter = 0
const emptyLine = (): FormLine => ({ id: lineCounter++, description: "", quantity: "1", unit_price_ht: "" })

export default function FacturesPage() {
  const { invoices, loading, error, createInvoice, updateStatus, downloadPdf, deleteInvoice } = useInvoices()
  const { clients, addClient, deleteClient } = useClients()

  // --- Invoice form ---
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const [clientName, setClientName] = useState("")
  const [clientIce, setClientIce] = useState("")
  const [clientAddress, setClientAddress] = useState("")
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState("")
  const [lines, setLines] = useState<FormLine[]>([emptyLine()])
  const [saveClient, setSaveClient] = useState(false)

  // Autocomplete
  const [suggestions, setSuggestions] = useState<typeof clients>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const clientInputRef = useRef<HTMLInputElement>(null)

  // Delete invoice
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Entreprises section
  const [showClients, setShowClients] = useState(false)
  const [clientForm, setClientForm] = useState({ name: "", address: "", ice: "" })
  const [clientFormError, setClientFormError] = useState<string | null>(null)
  const [savingClient, setSavingClient] = useState(false)
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null)

  // --- Autocomplete helpers ---
  const handleClientNameChange = (value: string) => {
    setClientName(value)
    setSaveClient(false)
    if (value.trim().length === 0) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    const filtered = clients.filter((c) =>
      c.name.toLowerCase().includes(value.toLowerCase())
    )
    setSuggestions(filtered)
    setShowSuggestions(filtered.length > 0)
  }

  const selectSuggestion = (client: typeof clients[number]) => {
    setClientName(client.name)
    setClientIce(client.ice ?? "")
    setClientAddress(client.address ?? "")
    setSuggestions([])
    setShowSuggestions(false)
  }

  const isNewClient =
    clientName.trim().length > 0 &&
    !clients.some((c) => c.name.toLowerCase() === clientName.trim().toLowerCase())

  // --- Invoice form ---
  const resetForm = () => {
    setClientName("")
    setClientIce("")
    setClientAddress("")
    setNotes("")
    setInvoiceDate(new Date().toISOString().slice(0, 10))
    setLines([emptyLine()])
    setFormError(null)
    setSaveClient(false)
    setShowSuggestions(false)
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

  const handleLineChange = (i: number, field: "description" | "quantity" | "unit_price_ht", value: string) => {
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
        client_rc: clientIce.trim() || undefined,
        client_address: clientAddress.trim() || undefined,
        invoice_date: invoiceDate,
        notes: notes.trim() || undefined,
        lines: validLines,
      })
      if (saveClient && isNewClient) {
        await addClient({
          name: clientName.trim(),
          address: clientAddress.trim() || undefined,
          ice: clientIce.trim() || undefined,
        })
      }
      resetForm()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur lors de la création")
    } finally {
      setSubmitting(false)
    }
  }

  // --- Download ---
  const handleDownload = async (id: string, invoiceNumber: string) => {
    setDownloading(id)
    setDownloadError(null)
    try {
      await downloadPdf(id, invoiceNumber)
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Erreur lors du téléchargement PDF")
    } finally {
      setDownloading(null)
    }
  }

  // --- Delete invoice ---
  const handleDeleteInvoice = async (id: string) => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteInvoice(id)
      setConfirmDeleteId(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Erreur lors de la suppression")
      setConfirmDeleteId(null)
    } finally {
      setDeleting(false)
    }
  }

  // --- Client form ---
  const handleAddClient = async () => {
    setClientFormError(null)
    if (!clientForm.name.trim()) {
      setClientFormError("Le nom est requis.")
      return
    }
    setSavingClient(true)
    try {
      await addClient({
        name: clientForm.name.trim(),
        address: clientForm.address.trim() || undefined,
        ice: clientForm.ice.trim() || undefined,
      })
      setClientForm({ name: "", address: "", ice: "" })
    } catch (err) {
      setClientFormError(err instanceof Error ? err.message : "Erreur")
    } finally {
      setSavingClient(false)
    }
  }

  const handleDeleteClient = async (id: string) => {
    setDeletingClientId(id)
    try {
      await deleteClient(id)
    } finally {
      setDeletingClientId(null)
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
              {/* Autocomplete client name */}
              <div className="space-y-1 relative">
                <label htmlFor="client-name" className="text-xs font-medium text-alaska-muted">
                  Entreprise cliente *
                </label>
                <Input
                  id="client-name"
                  ref={clientInputRef}
                  value={clientName}
                  onChange={(e) => handleClientNameChange(e.target.value)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  placeholder="Nom de l'entreprise"
                  autoComplete="off"
                />
                {showSuggestions && (
                  <ul className="absolute z-20 left-0 right-0 bg-white border border-gray-200 rounded-md shadow-md mt-0.5 max-h-48 overflow-y-auto">
                    {suggestions.map((c) => (
                      <li
                        key={c.id}
                        onMouseDown={() => selectSuggestion(c)}
                        className="px-3 py-2 cursor-pointer hover:bg-alaska-cream text-sm"
                      >
                        <div className="font-medium">{c.name}</div>
                        {c.ice && <div className="text-xs text-alaska-muted">ICE : {c.ice}</div>}
                      </li>
                    ))}
                  </ul>
                )}
                {isNewClient && (
                  <label className="flex items-center gap-2 text-xs text-alaska-muted mt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveClient}
                      onChange={(e) => setSaveClient(e.target.checked)}
                      className="rounded"
                    />
                    Enregistrer cette entreprise dans le carnet
                  </label>
                )}
              </div>

              <div className="space-y-1">
                <label htmlFor="client-ice" className="text-xs font-medium text-alaska-muted">ICE</label>
                <Input
                  id="client-ice"
                  value={clientIce}
                  onChange={(e) => setClientIce(e.target.value)}
                  placeholder="Identifiant commun de l'entreprise"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="client-address" className="text-xs font-medium text-alaska-muted">Adresse</label>
                <Input
                  id="client-address"
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  placeholder="Adresse (optionnel)"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="invoice-date" className="text-xs font-medium text-alaska-muted">Date de facture</label>
                <Input
                  id="invoice-date"
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
                <span className="col-span-1 text-right">Total HT</span>
                <span className="col-span-1" />
              </div>
              {lines.map((line, i) => (
                <div key={line.id} className="grid grid-cols-12 gap-2 items-center">
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
              <label htmlFor="invoice-notes" className="text-xs font-medium text-alaska-muted">Notes (optionnel)</label>
              <Input
                id="invoice-notes"
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
          {downloadError && <p className="text-red-500 text-sm mb-2">{downloadError}</p>}
          {deleteError && <p className="text-red-500 text-sm mb-2">{deleteError}</p>}
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
                    <th className="pb-2 font-medium text-alaska-muted hidden md:table-cell">Date</th>
                    <th className="pb-2 font-medium text-alaska-muted text-right">Total TTC</th>
                    <th className="pb-2 font-medium text-alaska-muted">Statut</th>
                    <th className="pb-2 font-medium text-alaska-muted text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoices.map((inv) => {
                    const s = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.draft
                    const isConfirming = confirmDeleteId === inv.id
                    return (
                      <tr key={inv.id} className="hover:bg-alaska-cream/40 transition">
                        <td className="py-3 font-mono text-xs text-alaska-muted">
                          {inv.invoice_number}
                        </td>
                        <td className="py-3">
                          <div className="font-medium">{inv.client_name}</div>
                          {inv.client_rc && (
                            <div className="text-xs text-alaska-muted">ICE : {inv.client_rc}</div>
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
                            {(Object.keys(STATUS_CONFIG) as InvoiceStatus[]).map((st) => (
                              <option key={st} value={st}>{STATUS_CONFIG[st].label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center justify-end gap-3">
                            <button
                              onClick={() => handleDownload(inv.id, inv.invoice_number)}
                              disabled={downloading === inv.id}
                              className="inline-flex items-center gap-1 text-alaska-sage hover:text-alaska-dark text-xs transition disabled:opacity-50"
                              aria-label={`Télécharger PDF de la facture ${inv.invoice_number}`}
                            >
                              <Download size={14} />
                              {downloading === inv.id ? "..." : "PDF"}
                            </button>
                            {inv.status === "draft" && !isConfirming && (
                              <button
                                onClick={() => setConfirmDeleteId(inv.id)}
                                className="text-gray-400 hover:text-red-500 transition"
                                aria-label={`Supprimer la facture ${inv.invoice_number}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                            {inv.status === "draft" && isConfirming && (
                              <div className="flex items-center gap-1.5 text-xs">
                                <button
                                  onClick={() => handleDeleteInvoice(inv.id)}
                                  disabled={deleting}
                                  className="text-red-600 font-medium hover:underline disabled:opacity-50"
                                >
                                  {deleting ? "..." : "Oui"}
                                </button>
                                <span className="text-alaska-muted">/</span>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="text-alaska-muted hover:text-alaska-dark"
                                >
                                  Non
                                </button>
                              </div>
                            )}
                          </div>
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

      {/* Section Entreprises */}
      <Card>
        <CardHeader>
          <button
            className="w-full flex items-center justify-between text-left"
            onClick={() => setShowClients((v) => !v)}
          >
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 size={16} />
              Entreprises enregistrées
              <span className="text-alaska-muted font-normal text-sm">({clients.length})</span>
            </CardTitle>
            {showClients ? <ChevronUp size={16} className="text-alaska-muted" /> : <ChevronDown size={16} className="text-alaska-muted" />}
          </button>
        </CardHeader>
        {showClients && (
          <CardContent className="space-y-4">
            {/* Formulaire ajout */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input
                value={clientForm.name}
                onChange={(e) => setClientForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nom de l'entreprise *"
              />
              <Input
                value={clientForm.ice}
                onChange={(e) => setClientForm((f) => ({ ...f, ice: e.target.value }))}
                placeholder="ICE"
              />
              <Input
                value={clientForm.address}
                onChange={(e) => setClientForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Adresse"
              />
            </div>
            {clientFormError && <p className="text-red-500 text-xs">{clientFormError}</p>}
            <Button size="sm" variant="outline" onClick={handleAddClient} disabled={savingClient} className="gap-1">
              <Plus size={14} /> {savingClient ? "Enregistrement..." : "Ajouter"}
            </Button>

            {/* Liste */}
            {clients.length === 0 && (
              <p className="text-alaska-muted text-sm text-center py-4">Aucune entreprise enregistrée.</p>
            )}
            {clients.length > 0 && (
              <div className="divide-y border rounded-lg overflow-hidden">
                {clients.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-alaska-cream/30">
                    <div>
                      <div className="font-medium text-sm">{c.name}</div>
                      <div className="text-xs text-alaska-muted space-x-3">
                        {c.ice && <span>ICE : {c.ice}</span>}
                        {c.address && <span>{c.address}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteClient(c.id)}
                      disabled={deletingClientId === c.id}
                      className="text-gray-400 hover:text-red-500 transition disabled:opacity-40 ml-4"
                      aria-label={`Supprimer ${c.name}`}
                    >
                      {deletingClientId === c.id ? <X size={14} /> : <Trash2 size={14} />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  )
}
```

- [ ] **Step 2 : Vérifier TypeScript et lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected : aucune erreur.

- [ ] **Step 3 : Lancer les tests**

```bash
npm run test
```

Expected : tous verts.

- [ ] **Step 4 : Commit**

```bash
git add app/(dashboard)/factures/page.tsx lib/hooks/useClients.ts
git commit -m "feat: invoice delete, client autocomplete, entreprises section"
```

---

### Task 10 : Build final

- [ ] **Step 1 : Build de production**

```bash
npm run build
```

Expected : build réussi sans erreurs.

- [ ] **Step 2 : Commit de clôture si nécessaire**

Si des fichiers ont été modifiés par le build :

```bash
git add -A
git commit -m "chore: post-build cleanup"
```
