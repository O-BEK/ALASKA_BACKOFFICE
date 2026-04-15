# UX/UI Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Appliquer les 9 améliorations UX/UI identifiées lors de l'audit du 2026-04-14 — quick fixes, KPIs manquants sur le dashboard, fusion navigation Semaine, séparation Charges/Modèles, table mobile Reporting et déplacement de la projection intelligente.

**Architecture:** Modifications progressives et indépendantes sur les pages existantes. Les Tasks 1–3 sont des quick wins sans toucher aux API. Les Tasks 4–5 étendent `buildDashboardData` dans `analytics.ts`, le contrat Zod `contracts.ts`, et le hook `useDashboard.ts`. Les Tasks 6–9 sont des refactors UI purs.

**Tech Stack:** Next.js 14 App Router, React, TypeScript, Tailwind CSS, Recharts, Zod, Vitest

---

## Fichiers modifiés

| Fichier | Tâches concernées |
|---------|-------------------|
| `app/(dashboard)/saisie/page.tsx` | T1, T6 |
| `app/(dashboard)/page.tsx` | T1, T4, T5 |
| `app/(dashboard)/semaine/page.tsx` | T2, T6 |
| `app/(dashboard)/charges/page.tsx` | T3, T7 |
| `app/(dashboard)/reporting/page.tsx` | T8, T9 |
| `app/(dashboard)/objectifs/page.tsx` | T9 |
| `lib/server/analytics.ts` | T4, T5 |
| `lib/contracts.ts` | T4, T5 |
| `lib/hooks/useDashboard.ts` | T4, T5 |
| `tests/analytics.test.ts` | T4, T5 |

---

## Task 1 — Quick text fixes (viewMonth + badge "Low")

**Files:**
- Modify: `app/(dashboard)/saisie/page.tsx`
- Modify: `app/(dashboard)/page.tsx`

### Contexte
- L'onglet "Mois" dans `/saisie` affiche le mois au format brut `2026-04` au lieu de `Avril 2026`.
- Le badge de priorité "Low" dans le dashboard est en anglais alors que tout le reste est en français.

---

- [ ] **Step 1 : Corriger le format d'affichage du mois dans /saisie**

Dans `app/(dashboard)/saisie/page.tsx`, cherche le bloc de l'onglet "Mois" (autour de la ligne 388).
Le sélecteur affiche actuellement :
```tsx
<p className="text-sm font-semibold text-alaska-dark">{viewMonth}</p>
```

Remplace par (réutilise `MONTHS_FR` déjà déclaré dans le fichier) :
```tsx
<p className="text-sm font-semibold text-alaska-dark">
  {(() => {
    const [y, m] = viewMonth.split("-")
    const MONTHS_FR = ["Jan","Fév","Mars","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"]
    return `${MONTHS_FR[parseInt(m) - 1]} ${y}`
  })()}
</p>
```

- [ ] **Step 2 : Traduire "Low" → "Faible" dans le dashboard**

Dans `app/(dashboard)/page.tsx`, cherche la ligne :
```tsx
<span className={cn("text-[11px] font-medium", action.priority === "urgent" ? "text-red-500" : action.priority === "medium" ? "text-amber-600" : "text-alaska-sage")}>{action.priority === "urgent" ? "URGENT" : action.priority === "medium" ? "MOYEN" : "Low"}</span>
```

Remplace `"Low"` par `"FAIBLE"` :
```tsx
<span className={cn("text-[11px] font-medium", action.priority === "urgent" ? "text-red-500" : action.priority === "medium" ? "text-amber-600" : "text-alaska-sage")}>{action.priority === "urgent" ? "URGENT" : action.priority === "medium" ? "MOYEN" : "FAIBLE"}</span>
```

- [ ] **Step 3 : Vérifier visuellement**

```bash
npm run lint && npx tsc --noEmit
```
Résultat attendu : 0 erreurs.

- [ ] **Step 4 : Commit**

```bash
git add app/\(dashboard\)/saisie/page.tsx app/\(dashboard\)/page.tsx
git commit -m "fix: format mois lisible dans onglet Mois, badge priorité Low → FAIBLE"
```

---

## Task 2 — Seuil hebdomadaire dans /semaine

**Files:**
- Modify: `app/(dashboard)/semaine/page.tsx`

### Contexte
Dans `semaine/page.tsx`, `weeklyBreakeven` et `pctSeuil` sont déjà calculés mais aucune card ne les affiche. Il faut ajouter une 3ème card KPI.

---

- [ ] **Step 1 : Ajouter la 3ème card KPI**

Dans `app/(dashboard)/semaine/page.tsx`, trouve le bloc des 2 cards KPI :
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
```

Remplace cette grille par une grille à 3 colonnes avec la 3ème card :
```tsx
<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
  {/* card Cash théorique enveloppe — inchangée */}
  ...
  {/* card CA global indicatif — inchangée */}
  ...
  {/* NOUVEAU */}
  <Card className="bg-white border border-alaska-sage-lt rounded-xl">
    <CardContent className="pt-4 pb-4">
      <p className="text-[11px] text-alaska-muted uppercase tracking-wide">Seuil semaine</p>
      <p className={cn(
        "text-2xl font-playfair font-bold mt-1",
        pctSeuil >= 100 ? "text-alaska-sage" : pctSeuil >= 70 ? "text-amber-500" : "text-red-500"
      )}>
        {pctSeuil.toFixed(0)}%
      </p>
      <p className="text-xs text-alaska-muted mt-1">
        {formatMAD(weekTotals.caGlobal)} / {formatMAD(weeklyBreakeven)}
      </p>
    </CardContent>
  </Card>
</div>
```

> Note : `formatMAD` est déjà importé dans ce fichier.

- [ ] **Step 2 : Vérifier**

```bash
npm run lint && npx tsc --noEmit
```
Résultat attendu : 0 erreurs.

- [ ] **Step 3 : Commit**

```bash
git add app/\(dashboard\)/semaine/page.tsx
git commit -m "feat: ajouter card seuil de rentabilité hebdomadaire dans vue Semaine"
```

---

## Task 3 — Card "CA/jour minimum" + % par catégorie dans /charges

**Files:**
- Modify: `app/(dashboard)/charges/page.tsx`

### Contexte
L'écran Charges affiche 2 KPI cards : "Total mensuel" et "Seuil rentabilité". Il manque une indication du CA journalier minimum nécessaire pour couvrir ces charges. Chaque catégorie affiche un total mais pas son poids relatif.

---

- [ ] **Step 1 : Ajouter la 3ème KPI card "CA / jour minimum"**

Dans `app/(dashboard)/charges/page.tsx`, le `breakeven` est déjà disponible depuis `useCharges()`.

Ajoute une variable en haut du composant :
```tsx
const daysInCurrentMonth = new Date(
  new Date().getFullYear(),
  new Date().getMonth() + 1,
  0
).getDate()
const dailyMinCA = Math.round(breakeven / daysInCurrentMonth)
```

Puis dans la grille des KPI cards, passe de `sm:grid-cols-2` à `sm:grid-cols-3` et ajoute la 3ème card :
```tsx
<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
  {/* cards existantes inchangées */}
  <Card className="bg-white border border-alaska-sage-lt rounded-xl">
    <CardContent className="pt-4 pb-4">
      <p className="text-[11px] text-alaska-muted uppercase tracking-wide">CA / jour min.</p>
      <p className="text-2xl font-playfair font-bold text-alaska-dark">{formatMAD(dailyMinCA)}</p>
      <p className="text-[11px] text-alaska-muted mt-1">Sur {daysInCurrentMonth} jours ce mois</p>
    </CardContent>
  </Card>
</div>
```

- [ ] **Step 2 : Afficher le % du total par catégorie**

Dans la boucle qui affiche chaque catégorie (`.map(([cat, label]) => {`), le `catTotal` et `totalActive` sont accessibles. Modifie le header de chaque card catégorie pour afficher le % :

```tsx
<CardHeader className="pb-2 pt-4">
  <div className="flex items-center justify-between">
    <CardTitle className="text-sm font-semibold text-alaska-dark">{label}</CardTitle>
    <div className="text-right">
      <span className="text-sm font-playfair font-bold text-alaska-sage">{formatMAD(catTotal)}</span>
      {totalActive > 0 && (
        <span className="ml-2 text-xs text-alaska-muted">
          {Math.round((catTotal / totalActive) * 100)}%
        </span>
      )}
    </div>
  </div>
</CardHeader>
```

- [ ] **Step 3 : Vérifier**

```bash
npm run lint && npx tsc --noEmit
```
Résultat attendu : 0 erreurs.

- [ ] **Step 4 : Commit**

```bash
git add app/\(dashboard\)/charges/page.tsx
git commit -m "feat: ajouter CA/jour minimum et % par catégorie dans Charges"
```

---

## Task 4 — Deltas Dépenses et Marge nette sur le dashboard

**Files:**
- Modify: `lib/server/analytics.ts`
- Modify: `lib/contracts.ts`
- Modify: `lib/hooks/useDashboard.ts`
- Modify: `app/(dashboard)/page.tsx`
- Modify: `tests/analytics.test.ts`

### Contexte
Actuellement seul `delta_ca` (variation CA vs mois précédent) est calculé dans `buildDashboardData`. Il faut ajouter `delta_expenses` et `delta_marge` avec la même logique.

---

- [ ] **Step 1 : Écrire les tests dans analytics.test.ts**

Dans `tests/analytics.test.ts`, ajoute dans la suite existante :
```typescript
it("buildDashboardData inclut delta_expenses et delta_marge", () => {
  const db = makeMockDb({
    sales: [
      { date: "2026-04-01", ca_caisse: 3000, ca_b2b: 500 },
    ],
    expenses: [
      { date: "2026-04-01", amount: 800, label: "MP" },
    ],
    prevSales: [
      { date: "2026-03-01", ca_caisse: 2000, ca_b2b: 400 },
    ],
    prevExpenses: [
      { date: "2026-03-01", amount: 1000, label: "MP" },
    ],
  })
  const result = buildDashboardData(db, "2026-04")
  expect(result.delta_expenses).toBeLessThan(0) // dépenses ont baissé
  expect(typeof result.delta_marge).toBe("number")
})
```

> Note : adapte `makeMockDb` à la signature existante dans le fichier de test.

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

```bash
npm run test -- tests/analytics.test.ts
```
Résultat attendu : le test sur `delta_expenses` et `delta_marge` échoue car ces champs n'existent pas encore.

- [ ] **Step 3 : Ajouter delta_expenses et delta_marge dans analytics.ts**

Dans `lib/server/analytics.ts`, dans la fonction `buildDashboardData` (autour de la ligne 305), après la ligne qui calcule `delta_ca` :
```typescript
const delta_ca = previous.ca_total > 0 ? ((kpis.ca_total - previous.ca_total) / previous.ca_total) * 100 : 0
```

Ajoute :
```typescript
const delta_expenses =
  previous.total_expenses > 0
    ? ((kpis.total_expenses - previous.total_expenses) / previous.total_expenses) * 100
    : 0
const delta_marge =
  previous.marge_nette !== 0
    ? kpis.marge_nette - previous.marge_nette
    : 0
```

Puis dans le `return { ... }` de `buildDashboardData`, ajoute ces deux champs :
```typescript
return {
  kpis,
  delta_ca,
  delta_expenses,   // NOUVEAU
  delta_marge,      // NOUVEAU
  last12,
  ...
}
```

- [ ] **Step 4 : Étendre le contrat Zod dans contracts.ts**

Dans `lib/contracts.ts`, dans `dashboardStateSchema`, après `delta_ca` :
```typescript
delta_ca: z.coerce.number().catch(0),
delta_expenses: z.coerce.number().catch(0),   // NOUVEAU
delta_marge: z.coerce.number().catch(0),       // NOUVEAU
```

- [ ] **Step 5 : Étendre le type dans useDashboard.ts**

Dans `lib/hooks/useDashboard.ts`, dans l'interface `DashboardState`, après `delta_ca: number` :
```typescript
delta_ca: number
delta_expenses: number   // NOUVEAU
delta_marge: number      // NOUVEAU
```

Dans `useState` initial et dans les deux blocs `catch`, ajoute `delta_expenses: 0, delta_marge: 0`.

Dans `useEffect`, la ligne :
```typescript
const { kpis, delta_ca, last12, ... } = useDashboard(month)
```
est dans la page, pas dans le hook. Le hook retourne `{ ...state, loading, error }` — rien à changer ici tant que le state est bien initialisé.

- [ ] **Step 6 : Afficher les deltas dans dashboard/page.tsx**

Dans `app/(dashboard)/page.tsx`, la ligne qui déstructure le hook :
```typescript
const { kpis, delta_ca, last12, hasMonthData, monthObjective, weeklyMonth, loading, error } = useDashboard(month)
```

Ajoute `delta_expenses` et `delta_marge` :
```typescript
const { kpis, delta_ca, delta_expenses, delta_marge, last12, hasMonthData, monthObjective, weeklyMonth, loading, error } = useDashboard(month)
```

Puis dans les KPI cards, modifie la card "Dépenses" :
```tsx
<KPICard
  title="Dépenses"
  value={formatMAD(kpis.total_expenses)}
  delta={delta_expenses}
  deltaInverted   // une hausse des dépenses est négative — voir Step 6b
  icon={<ShoppingCart size={16} className="text-orange-500" />}
  valueClass="text-orange-600"
/>
```

Et la card "Marge nette", ajoute un sous-texte avec la variation absolue :
```tsx
<KPICard
  title="Marge nette"
  value={formatMAD(kpis.marge_nette)}
  sub={delta_marge !== 0
    ? `${delta_marge >= 0 ? "+" : ""}${formatMAD(delta_marge)} vs mois préc.`
    : `${kpis.taux_marge.toFixed(1)}% du CA`}
  icon={...}
  valueClass={...}
/>
```

**Step 6b — Ajouter la prop `deltaInverted` à `KPICard`**

Dans la définition de `KPICard` (en bas de `page.tsx`) :
```tsx
function KPICard({
  title, value, sub, delta, deltaInverted, icon, valueClass,
}: {
  title: string
  value: string
  sub?: string
  delta?: number
  deltaInverted?: boolean   // NOUVEAU : une hausse est mauvaise (ex: dépenses)
  icon: ReactNode
  valueClass?: string
}) {
  return (
    <Card ...>
      <CardContent ...>
        ...
        {delta !== undefined && (
          <p className={cn(
            "mt-1 text-xs",
            deltaInverted
              ? delta <= 0 ? "text-alaska-sage" : "text-red-500"
              : delta >= 0 ? "text-alaska-sage" : "text-red-500"
          )}>
            {formatPct(delta)} vs mois précédent
          </p>
        )}
        ...
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 7 : Lancer les tests**

```bash
npm run test -- tests/analytics.test.ts
```
Résultat attendu : tous les tests passent.

- [ ] **Step 8 : Build et lint**

```bash
npm run lint && npx tsc --noEmit && npm run build
```
Résultat attendu : 0 erreurs.

- [ ] **Step 9 : Commit**

```bash
git add lib/server/analytics.ts lib/contracts.ts lib/hooks/useDashboard.ts app/\(dashboard\)/page.tsx tests/analytics.test.ts
git commit -m "feat: ajouter delta_expenses et delta_marge sur les cards dashboard"
```

---

## Task 5 — KPIs secondaires sur le dashboard (ticket moyen, couverture, mix cash)

**Files:**
- Modify: `lib/server/analytics.ts`
- Modify: `lib/contracts.ts`
- Modify: `lib/hooks/useDashboard.ts`
- Modify: `app/(dashboard)/page.tsx`
- Modify: `tests/analytics.test.ts`

### Contexte
Trois KPIs actuellement visibles uniquement dans le Reporting doivent apparaître sur le dashboard :
- `avg_ticket` : CA total / nombre de tickets du mois
- `coverage_pct` : nombre de jours saisis / nombre de jours dans le mois
- `mix_cash_pct` : ca_caisse / ca_total

Ces champs seront ajoutés dans la réponse de `/api/dashboard` via `buildDashboardData`.

---

- [ ] **Step 1 : Écrire les tests**

Dans `tests/analytics.test.ts`, ajoute :
```typescript
it("buildDashboardData inclut avg_ticket, coverage_pct et mix_cash_pct", () => {
  const db = makeMockDb({
    sales: [
      { date: "2026-04-01", ca_caisse: 2000, ca_b2b: 500, tickets_count: 20 },
      { date: "2026-04-02", ca_caisse: 1800, ca_b2b: 400, tickets_count: 18 },
    ],
  })
  const result = buildDashboardData(db, "2026-04")
  // avg_ticket = (2000+500+1800+400) / (20+18) = 4700/38 ≈ 123.7
  expect(result.kpis_secondary.avg_ticket).toBeCloseTo(123.7, 0)
  // 2 jours saisis sur 30 jours en avril
  expect(result.kpis_secondary.coverage_pct).toBeCloseTo((2 / 30) * 100, 0)
  // mix_cash = (2000+1800) / (2000+500+1800+400) = 3800/4700 ≈ 80.9%
  expect(result.kpis_secondary.mix_cash_pct).toBeCloseTo(80.9, 0)
})
```

- [ ] **Step 2 : Lancer les tests pour vérifier l'échec**

```bash
npm run test -- tests/analytics.test.ts
```
Résultat attendu : le test `kpis_secondary` échoue.

- [ ] **Step 3 : Ajouter kpis_secondary dans analytics.ts**

Dans `lib/server/analytics.ts`, dans `buildDashboardData`, après le bloc qui calcule `weeklyMonth` :

```typescript
// KPIs secondaires
const monthSales = monthEntries(db, month)
const totalTickets = monthSales.reduce((sum, s) => sum + (s.tickets_count ?? 0), 0)
const daysInMonth = monthEnd.getDate()
const kpis_secondary = {
  avg_ticket: totalTickets > 0 ? kpis.ca_total / totalTickets : 0,
  coverage_pct: daysInMonth > 0 ? (kpis.days_count / daysInMonth) * 100 : 0,
  mix_cash_pct: kpis.ca_total > 0 ? (kpis.ca_caisse / kpis.ca_total) * 100 : 0,
}
```

Ajoute `kpis_secondary` dans le `return`.

> Note : `monthEnd` est déjà calculé via `monthBounds(month)` plus haut dans la fonction.

- [ ] **Step 4 : Étendre le contrat Zod**

Dans `lib/contracts.ts`, ajoute un nouveau schéma et l'intègre dans `dashboardStateSchema` :

```typescript
const dashboardKpisSecondarySchema = z.object({
  avg_ticket: z.coerce.number().catch(0),
  coverage_pct: z.coerce.number().catch(0),
  mix_cash_pct: z.coerce.number().catch(0),
})
```

Dans `dashboardStateSchema` :
```typescript
kpis_secondary: dashboardKpisSecondarySchema.catch({
  avg_ticket: 0,
  coverage_pct: 0,
  mix_cash_pct: 0,
}),
```

- [ ] **Step 5 : Étendre useDashboard.ts**

Dans `lib/hooks/useDashboard.ts`, dans `DashboardState` :
```typescript
kpis_secondary: {
  avg_ticket: number
  coverage_pct: number
  mix_cash_pct: number
}
```

Dans `useState` initial et les deux blocs d'erreur/disabled, ajoute :
```typescript
kpis_secondary: { avg_ticket: 0, coverage_pct: 0, mix_cash_pct: 0 },
```

- [ ] **Step 6 : Afficher la ligne de KPIs secondaires dans page.tsx**

Dans `app/(dashboard)/page.tsx`, déstructure `kpis_secondary` :
```typescript
const { kpis, delta_ca, delta_expenses, delta_marge, kpis_secondary, last12, ... } = useDashboard(month)
```

Ajoute une bande de 3 métriques compactes **après** la grille des 4 KPI cards, dans le bloc `!loading` :

```tsx
{kpis.ca_total > 0 && (
  <div className="grid grid-cols-3 gap-2">
    <SecondaryKPI
      label="Ticket moyen"
      value={kpis_secondary.avg_ticket > 0 ? formatMAD(kpis_secondary.avg_ticket) : "—"}
    />
    <SecondaryKPI
      label={`${kpis.days_count} / ${daysInMonth(month)} jours`}
      value={`${kpis_secondary.coverage_pct.toFixed(0)}% couvert`}
    />
    <SecondaryKPI
      label="Mix espèces"
      value={kpis_secondary.mix_cash_pct > 0 ? `${kpis_secondary.mix_cash_pct.toFixed(0)}%` : "—"}
    />
  </div>
)}
```

Ajoute le composant `SecondaryKPI` en bas de `page.tsx` :
```tsx
function SecondaryKPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-alaska-sage-lt bg-white px-3 py-2.5 text-center">
      <p className="text-[10px] uppercase tracking-wide text-alaska-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-alaska-dark">{value}</p>
    </div>
  )
}
```

- [ ] **Step 7 : Lancer les tests**

```bash
npm run test -- tests/analytics.test.ts
```
Résultat attendu : tous les tests passent.

- [ ] **Step 8 : Build**

```bash
npm run lint && npx tsc --noEmit && npm run build
```

- [ ] **Step 9 : Commit**

```bash
git add lib/server/analytics.ts lib/contracts.ts lib/hooks/useDashboard.ts app/\(dashboard\)/page.tsx tests/analytics.test.ts
git commit -m "feat: ajouter KPIs secondaires dashboard — ticket moyen, couverture, mix cash"
```

---

## Task 6 — Fusionner la navigation Semaine

**Files:**
- Modify: `app/(dashboard)/saisie/page.tsx`
- Modify: `app/(dashboard)/semaine/page.tsx`

### Contexte
L'onglet "Semaine" dans `/saisie` fait doublon avec la route `/semaine` du menu. On supprime l'onglet de `/saisie` et on ajoute :
1. Un lien "← Semaine" sur `/saisie` quand l'URL contient `?date=`
2. Un lien "Saisir" sur chaque ligne de la liste mobile dans `/semaine`

---

- [ ] **Step 1 : Supprimer l'onglet Semaine de /saisie**

Dans `app/(dashboard)/saisie/page.tsx`, modifie la constante `TABS` :
```tsx
const TABS = ["Caisse", "Mois"] as const
type Tab = typeof TABS[number]
```

Supprime toute référence à `tab === "Semaine"` (le bloc JSX de l'onglet Semaine, lignes 324–384 environ) et supprime les hooks `useWeekView`, `useWeekEntries` qui n'étaient utilisés que dans cet onglet.

> Vérifie avant de supprimer : cherche `useWeekView` et `useWeekEntries` dans ce fichier — ils ne sont utilisés que dans le bloc Semaine.

Supprime aussi les imports devenus inutiles : `WeekGrid`, `useWeekView`, `useWeekEntries`, `handleWeekCAUpdate`, `handleWeekExpenseUpdate`.

Le filtre `availableTabs` devient :
```tsx
const availableTabs = isAdmin ? TABS : (["Caisse"] as const)
```

- [ ] **Step 2 : Ajouter le bouton "← Semaine" quand ?date= est présent**

Dans `app/(dashboard)/saisie/page.tsx`, après la déclaration de `initialRequestedDate`, ajoute :
```tsx
const cameFromWeek = !!initialRequestedDate
```

Puis dans le JSX, ajoute ce lien **avant** les onglets, conditionné à `cameFromWeek` :
```tsx
{cameFromWeek && (
  <Link
    href="/semaine"
    className="inline-flex items-center gap-1.5 text-sm text-alaska-sage hover:underline"
  >
    <ChevronLeft size={14} /> Retour semaine
  </Link>
)}
```

`ChevronLeft` est déjà importé dans ce fichier.

- [ ] **Step 3 : Ajouter lien "Saisir" dans la liste mobile de /semaine**

Dans `app/(dashboard)/semaine/page.tsx`, dans le bloc mobile (`md:hidden`), chaque bouton de jour ouvre `router.push(...)`. Modifie ces boutons pour qu'ils naviguent vers `/saisie?date=...` directement :

```tsx
<button
  key={day.date}
  onClick={() => router.push(`/saisie?date=${day.date}`)}
  className="w-full flex items-center justify-between p-3 bg-alaska-sage-lt/40 hover:bg-alaska-sage-lt rounded-lg transition text-left"
>
  <div className="flex items-center gap-3">
    <span className="text-sm">{day.status === "full" ? "✅" : day.status === "partial" ? "🟡" : "⬜"}</span>
    <span className="text-sm font-medium capitalize text-alaska-dark">{day.label}</span>
  </div>
  <div className="flex items-center gap-2">
    <div className="text-right">
      <p className="text-sm font-semibold text-alaska-dark">
        {day.entry ? formatMAD(getCashSalesReference(day.entry)) : "—"}
      </p>
      {day.totalExpenses > 0 && (
        <p className="text-xs text-alaska-muted">Achats: {formatMAD(day.totalExpenses)}</p>
      )}
    </div>
    <ChevronRight size={14} className="text-alaska-muted flex-shrink-0" />
  </div>
</button>
```

`ChevronRight` est déjà importé dans `semaine/page.tsx`.

- [ ] **Step 4 : Vérifier les tests middleware**

```bash
npm run test -- tests/middleware.test.ts
npm run lint && npx tsc --noEmit
```
Résultat attendu : 0 erreurs.

- [ ] **Step 5 : Commit**

```bash
git add app/\(dashboard\)/saisie/page.tsx app/\(dashboard\)/semaine/page.tsx
git commit -m "feat: supprimer onglet Semaine de /saisie, ajouter retour contextuel et lien saisir depuis /semaine"
```

---

## Task 7 — Séparer Charges fixes et Modèles de saisie avec des onglets

**Files:**
- Modify: `app/(dashboard)/charges/page.tsx`

### Contexte
L'écran Charges mélange "Charges fixes" (loyer, salaires…) et "Modèles de saisie journalière" (items suggérés lors de la saisie), deux fonctions sans rapport apparent. On les sépare avec deux onglets.

---

- [ ] **Step 1 : Ajouter l'état de l'onglet actif**

En haut du composant `ChargesPage`, ajoute :
```tsx
const [activeTab, setActiveTab] = useState<"charges" | "modeles">("charges")
```

- [ ] **Step 2 : Ajouter le sélecteur d'onglets**

Dans le JSX de `ChargesPage`, remplace le titre courant :
```tsx
<div>
  <h1 className="font-playfair text-2xl font-bold text-alaska-dark">Charges fixes</h1>
  <p className="text-alaska-muted text-sm mt-1">Gestion et simulation d&apos;impact</p>
</div>
```

Par un header avec onglets :
```tsx
<div>
  <h1 className="font-playfair text-2xl font-bold text-alaska-dark">Charges</h1>
  <div className="flex gap-1 mt-3 bg-white border border-alaska-sage-lt rounded-lg p-1 w-fit">
    <button
      onClick={() => setActiveTab("charges")}
      className={cn(
        "px-4 py-2 rounded-md text-sm font-medium transition",
        activeTab === "charges" ? "bg-alaska-sage text-white" : "text-alaska-muted hover:bg-alaska-sage-lt"
      )}
    >
      Charges fixes
    </button>
    <button
      onClick={() => setActiveTab("modeles")}
      className={cn(
        "px-4 py-2 rounded-md text-sm font-medium transition",
        activeTab === "modeles" ? "bg-alaska-sage text-white" : "text-alaska-muted hover:bg-alaska-sage-lt"
      )}
    >
      Modèles de saisie
    </button>
  </div>
</div>
```

- [ ] **Step 3 : Conditionner l'affichage**

Wrape le bloc des charges fixes (KPI cards, simulateur, liste par catégorie) dans :
```tsx
{activeTab === "charges" && (
  <div className="space-y-6">
    {/* ... tout le contenu charges fixes existant ... */}
  </div>
)}
```

Wrape le bloc des modèles de saisie (titre "Modèles de saisie", liste des sections, bouton "Nouvelle section") dans :
```tsx
{activeTab === "modeles" && (
  <div className="space-y-4">
    {/* ... tout le contenu modèles existant, sans le <div className="pt-4"> inutile ... */}
  </div>
)}
```

Supprime le `<div className="pt-4">` et les `<h2>` / `<p>` qui faisaient l'ancienne séparation visuelle entre les deux sections.

- [ ] **Step 4 : Vérifier**

```bash
npm run lint && npx tsc --noEmit
```

- [ ] **Step 5 : Commit**

```bash
git add app/\(dashboard\)/charges/page.tsx
git commit -m "feat: séparer Charges fixes et Modèles de saisie en deux onglets"
```

---

## Task 8 — Table des 6 mois responsive mobile dans /reporting

**Files:**
- Modify: `app/(dashboard)/reporting/page.tsx`

### Contexte
La table des 6 prochains mois dans la "Projection intelligente" a `min-w-[560px]` qui force un scroll horizontal sur mobile. On remplace par un affichage en cartes empilées sur mobile et table sur desktop.

---

- [ ] **Step 1 : Localiser la table dans reporting/page.tsx**

Cherche `min-w-[560px]` dans le fichier. C'est la table de `monthlyProjection` qui itère sur les 6 prochains mois.

- [ ] **Step 2 : Remplacer la table par un affichage responsive**

Remplace le bloc `<div className="overflow-x-auto"><table ...>` par :

```tsx
{/* Table desktop */}
<div className="hidden sm:block overflow-x-auto">
  <table className="w-full text-sm">
    <thead>
      <tr className="border-b border-alaska-sage-lt text-left text-xs uppercase tracking-wide text-alaska-muted">
        <th className="pb-2 font-medium">Mois</th>
        <th className="pb-2 font-medium">Sans alcool</th>
        <th className="pb-2 font-medium">Avec alcool</th>
        <th className="pb-2 font-medium">Objectif</th>
        <th className="pb-2 font-medium">Source</th>
      </tr>
    </thead>
    <tbody>
      {monthlyProjection.map((row) => (
        <tr key={row.month} className="border-b border-alaska-sage-lt/50 last:border-0">
          <td className="py-2 font-medium text-alaska-dark">{row.month_label}</td>
          <td className="py-2 text-alaska-muted">{formatMAD(row.sans_alcool)}</td>
          <td className="py-2 font-medium text-alaska-sage">{formatMAD(row.avec_alcool)}</td>
          <td className="py-2 text-alaska-muted">{row.objective > 0 ? formatMAD(row.objective) : "—"}</td>
          <td className="py-2 text-xs text-alaska-muted">{row.source}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>

{/* Cards mobile */}
<div className="sm:hidden space-y-2">
  {monthlyProjection.map((row) => (
    <div key={row.month} className="rounded-lg border border-alaska-sage-lt p-3 bg-white">
      <p className="text-sm font-semibold text-alaska-dark mb-2">{row.month_label}</p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-alaska-muted">Sans alcool</p>
          <p className="font-medium text-alaska-dark">{formatMAD(row.sans_alcool)}</p>
        </div>
        <div>
          <p className="text-alaska-muted">Avec alcool</p>
          <p className="font-medium text-alaska-sage">{formatMAD(row.avec_alcool)}</p>
        </div>
        {row.objective > 0 && (
          <div>
            <p className="text-alaska-muted">Objectif</p>
            <p className="font-medium text-alaska-dark">{formatMAD(row.objective)}</p>
          </div>
        )}
        <div>
          <p className="text-alaska-muted">Source</p>
          <p className="font-medium text-alaska-dark">{row.source}</p>
        </div>
      </div>
    </div>
  ))}
</div>
```

> Note : vérifie les noms de champs exacts de `monthlyProjection` dans le fichier (cherche `monthlyProjection.map`). Adapte `row.month_label`, `row.sans_alcool`, `row.avec_alcool`, `row.objective`, `row.source` aux vrais noms.

- [ ] **Step 3 : Vérifier**

```bash
npm run lint && npx tsc --noEmit
```

- [ ] **Step 4 : Commit**

```bash
git add app/\(dashboard\)/reporting/page.tsx
git commit -m "fix: table projection 6 mois responsive mobile dans Reporting"
```

---

## Task 9 — Déplacer la Projection intelligente vers Objectifs/Trajectoire

**Files:**
- Modify: `app/(dashboard)/objectifs/page.tsx`
- Modify: `app/(dashboard)/reporting/page.tsx`

### Contexte
La "Projection intelligente" (scénario alcool, trajectoire annuelle, 6 prochains mois) est une vision stratégique long terme (3–5 ans). Elle n'a pas sa place dans le reporting mensuel opérationnel. On la déplace dans l'onglet "Trajectoire" de `/objectifs` et on la retire du reporting.

L'onglet "Trajectoire" affiche déjà une courbe objectifs/réalisé depuis `useObjectives`. On **ajoute** la smart projection en dessous, en fetchant `/api/reporting?month=<mois courant>` depuis l'onglet.

---

- [ ] **Step 1 : Ajouter le fetch de smart projection dans objectifs/page.tsx**

Dans `app/(dashboard)/objectifs/page.tsx`, ajoute l'import `parseReportingPayload` :
```tsx
import { parseReportingPayload } from "@/lib/contracts"
```

Puis dans `ObjectifsPage`, ajoute les états :
```tsx
const [smartProjection, setSmartProjection] = useState<ReturnType<typeof parseReportingPayload>["smartProjection"] | null>(null)
const [projectionLoading, setProjectionLoading] = useState(false)
```

Et l'effet déclenché quand l'onglet "Trajectoire" est actif :
```tsx
useEffect(() => {
  if (tab !== "Trajectoire") return
  setProjectionLoading(true)
  const currentMonth = new Date().toISOString().slice(0, 7)
  fetch(`/api/reporting?month=${currentMonth}`)
    .then(async (res) => {
      const json = await res.json()
      return parseReportingPayload(json)
    })
    .then((data) => setSmartProjection(data.smartProjection))
    .catch(() => setSmartProjection(null))
    .finally(() => setProjectionLoading(false))
}, [tab])
```

- [ ] **Step 2 : Afficher la projection dans l'onglet Trajectoire**

Dans le JSX de l'onglet "Trajectoire" (cherche `tab === "Trajectoire"`), ajoute à la fin du contenu existant :

```tsx
{projectionLoading && (
  <div className="h-40 animate-pulse rounded-xl bg-alaska-sage-lt/40 mt-4" />
)}
{!projectionLoading && smartProjection && (
  <Card className="rounded-xl border border-alaska-sage-lt bg-white mt-4">
    <CardHeader className="pb-2">
      <CardTitle className="text-base text-alaska-dark">Projection intelligente</CardTitle>
      <CardDescription className="text-xs text-alaska-muted">
        Scénario sans alcool vs avec licence alcool
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-alaska-sage-lt px-3 py-3">
          <p className="text-[11px] uppercase tracking-wide text-alaska-muted">Croissance retenue</p>
          <p className="mt-1 text-sm font-medium text-alaska-dark">
            {smartProjection.assumptions.growth_pct.toFixed(1)}% / an
          </p>
        </div>
        <div className="rounded-lg border border-alaska-sage-lt px-3 py-3">
          <p className="text-[11px] uppercase tracking-wide text-alaska-muted">Part caisse</p>
          <p className="mt-1 text-sm font-medium text-alaska-dark">
            {smartProjection.assumptions.caisse_share_pct.toFixed(0)}% du CA
          </p>
        </div>
        <div className="rounded-lg border border-alaska-sage-lt px-3 py-3">
          <p className="text-[11px] uppercase tracking-wide text-alaska-muted">Uplift alcool</p>
          <p className="mt-1 text-sm font-medium text-alaska-dark">
            +{smartProjection.assumptions.alcool_uplift_pct.toFixed(0)}% ticket
          </p>
        </div>
        <div className="rounded-lg border border-alaska-sage-lt px-3 py-3">
          <p className="text-[11px] uppercase tracking-wide text-alaska-muted">Effet CA total</p>
          <p className="mt-1 text-sm font-medium text-alaska-sage">
            +{smartProjection.assumptions.alcool_effect_on_total_pct.toFixed(0)}%
          </p>
        </div>
      </div>
      <p className="text-xs text-alaska-muted">
        Voir le Reporting pour la trajectoire annuelle complète et les 6 prochains mois.
      </p>
    </CardContent>
  </Card>
)}
```

Ajoute l'import `CardDescription` si absent du fichier.

- [ ] **Step 3 : Retirer la carte "Projection intelligente" du reporting**

Dans `app/(dashboard)/reporting/page.tsx`, supprime le bloc `<Card>` dont le `CardTitle` est "Projection intelligente" (la card qui contient le `LineChart` annuel et la table des 6 mois).

> Le bloc "Projection & rythme" (court terme, fin du mois courant) reste dans le reporting — ne le supprime pas.

Supprime aussi les imports devenus inutiles dans reporting si `LineChart` et `Line` ne sont plus utilisés.

- [ ] **Step 4 : Vérifier**

```bash
npm run lint && npx tsc --noEmit && npm run build
```
Résultat attendu : 0 erreurs.

- [ ] **Step 5 : Commit**

```bash
git add app/\(dashboard\)/objectifs/page.tsx app/\(dashboard\)/reporting/page.tsx
git commit -m "feat: déplacer projection intelligente dans Objectifs/Trajectoire, retirer du Reporting"
```

---

## Vérification finale

- [ ] **Lancer la suite de tests complète**

```bash
npm run test
```
Résultat attendu : tous les tests passent (30+).

- [ ] **Build de production**

```bash
npm run build
```
Résultat attendu : 0 erreurs TypeScript, build réussi.

- [ ] **Commit de clôture**

```bash
git add .
git commit -m "chore: vérification finale — suite UX/UI improvements complète"
```

---

## Récapitulatif des tâches

| # | Tâche | Effort estimé | Fichiers touchés |
|---|-------|--------------|-----------------|
| T1 | Quick text fixes | 30 min | saisie/page, page |
| T2 | Seuil hebdo dans Semaine | 20 min | semaine/page |
| T3 | CA/jour min + % catégories dans Charges | 30 min | charges/page |
| T4 | Deltas Dépenses + Marge nette dashboard | 1h | analytics, contracts, useDashboard, page, tests |
| T5 | KPIs secondaires dashboard | 1.5h | analytics, contracts, useDashboard, page, tests |
| T6 | Fusion navigation Semaine | 1h | saisie/page, semaine/page |
| T7 | Onglets Charges / Modèles | 45 min | charges/page |
| T8 | Table Reporting mobile | 30 min | reporting/page |
| T9 | Projection intelligente → Objectifs | 1.5h | objectifs/page, reporting/page |
