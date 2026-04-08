# Alaska Pilot — MVP Phase 1 Design

**Date :** 2026-04-07  
**Projet :** Alaska Neo Bistrot — Application de pilotage financier  
**Scope :** Phase 1 MVP (sans Supabase — mock data + localStorage)

---

## 1. Contexte

Application Next.js 14 (App Router) de pilotage financier pour le restaurant Alaska Neo Bistrot (Rabat). Remplace deux fichiers Excel. Deux rôles : `admin` (Othman) et `manager` (responsable resto).

Stack : Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Recharts, Supabase (branché en Phase 2).

---

## 2. Architecture & Data Layer

### Principe fondamental

Les hooks sont la seule frontière entre la source de données et l'UI. Aujourd'hui ils lisent des mocks + localStorage. En Phase 2, on remplace l'implémentation interne sans toucher à l'UI.

### Structure

```
lib/
├── mock-data.ts              ← Données historiques réelles Alaska (CA 2025, Q1 2026, charges, actions)
├── calculations.ts           ← Fonctions pures : seuil, marge, projections
├── local-store.ts            ← Helpers localStorage (saisies fraîches)
└── hooks/
    ├── useDashboard.ts       ← KPIs agrégés du mois sélectionné
    ├── useDailyEntry.ts      ← Lecture/écriture saisie du jour
    ├── useWeekView.ts        ← 7 jours agrégés
    ├── useCharges.ts         ← Charges fixes + simulation
    └── useObjectives.ts      ← Objectifs annuels + actions plan
```

### Pattern de hook (remplacement Supabase en une ligne)

```ts
export function useDashboard(month: string) {
  const mockData = getMockDashboard(month)       // ← remplacer par supabase query
  const localEntries = getLocalEntries(month)    // ← remplacer par rien (déjà en DB)
  return mergeDashboardData(mockData, localEntries)
}
```

### Persistence locale

```
localStorage/
├── alaska_daily_sales        ← { [date: YYYY-MM-DD]: DailyEntry }
└── alaska_selected_month     ← "2026-04"
```

Les saisies locales sont fusionnées avec le mock historique dans les hooks. Le dashboard recalcule les KPIs en temps réel quand une saisie est modifiée.

---

## 3. Données Mock

`lib/mock-data.ts` contient les vraies données du restaurant :

- **CA mensuel 2025** : Jan→Déc (12 mois complets, source specs 00)
- **CA Q1 2026** : Jan, Fév, Mars journalier
- **Charges fixes** : 9 employés + loyer + énergie + télécom + divers (~98 400 MAD/mois)
- **Plan d'action** : 14 actions sur 5 leviers (Soir, Terrasse, B2B, Marketing, Pilotage)
- **Objectifs** : 2025 réel 1 752 217, 2026 cible 2 278 000, 3 scénarios

---

## 4. Pages MVP

### 4.1 Dashboard (`/` — admin only)

**Composants :**
- `MonthPicker` — navigation ← mois → en haut de page
- `KPICard` × 4 — CA caisse, dépenses, marge nette, CA/jour moyen. Chaque carte affiche delta vs mois précédent.
- `TodayCard` — CA + dépenses du jour, badge "Non renseigné" si absent
- `BreakevenGauge` — barre horizontale colorée (rouge/orange/vert selon % du seuil 136 667 MAD)
- `WeeklyBarChart` (Recharts) — barres CA par semaine du mois, ligne de référence seuil hebdo
- `AnnualLineChart` (Recharts) — courbe CA 12 mois vs seuil fixe en pointillés rouges
- `ActionList` — top 3 actions prioritaires, cliquables (modal statut)
- `QuickActions` — 3 boutons : Import CSV, Saisie, Reporting

**États particuliers :** bannière orange si CSV non importé pour le mois courant ; message vide si aucune donnée.

### 4.2 Saisie (`/saisie` — admin + manager)

**Structure :** 3 onglets — Saisie / Semaine / Mois

**Onglet Saisie :**
- `DateNavigator` — flèches jour ← →, bouton "Aujourd'hui", badge état (✅🟡⬜📤)
- `CACaisseSection` — input MAD, boutons +500/+1000/+2000/+5000, champ notes, badge source (manual/CSV)
- `ExpenseGroup` × 3 — Matières Premières (7 postes) / Personnel (11 employés) / Autres Charges (5 postes). Chaque groupe est expansible. Postes à 0 repliés par défaut.
- `DailySummaryCard` — récap CA / Total dépenses / Marge nette / Taux marge + bouton Enregistrer
- Auto-save : debounce 2s vers localStorage

**Onglet Semaine :**
- `WeekNavigator` — semaine précédente / suivante
- KPIs semaine : CA, dépenses, marge, seuil hebdo %
- `WeekRow` × 7 — chaque jour cliquable → onglet Saisie avec ce jour
- `ExpenseBreakdown` — barres horizontales dépenses par poste

**Onglet Mois :**
- Vue simplifiée : total dépenses, jours saisis, répartition par catégorie
- Manager ne voit pas les marges/seuil

### 4.3 Import CSV (`/import` — admin only)

**Flux 3 étapes :**
1. `DropZone` — drag & drop ou click, formats .csv, 10MB max
2. `ImportPreviewTable` — tableau aperçu (date, CA MAD, soir %) + warning doublons + boutons Annuler/Confirmer
3. Écran succès — stats import (jours, lignes, CA total)

`ImportHistory` — 12 derniers imports listés en bas de page.

Parser CSV (`lib/csv-parser.ts`) : détecte séparateur ; ou ,, agrège par date, calcule ca_soir (≥19h), compte tickets uniques.

### 4.4 Charges Fixes (`/charges` — admin only)

- Header : total charges actuel + seuil calculé
- Liste par catégorie : Immobilier / Personnel / Énergie / Télécom / Divers
- Chaque ligne : nom, montant, boutons ✏️ modifier / désactiver
- `ChargeModal` — modifier montant + date d'effet, alerte si nouveau seuil > CA moyen 3 mois
- `SimulatorPanel` — mode "Et si..." : ajouter charges hypothétiques, calcul nouveau seuil en temps réel, sans modifier les données réelles

### 4.5 Objectifs (`/objectifs` — admin only)

**3 onglets :**
1. **Objectifs financiers** : tableau années (2025 réel / 2026 en cours / 2027 futur), décomposition mensuelle éditable, graphique progression + courbe objectif
2. **Plan d'action** : 14 actions sur 5 leviers, filtres, statut modifiable, `ActionCard` avec modal
3. **Trajectoire 3 ans** : tableau 3 scénarios + graphique courbes

### 4.6 Reporting (`/reporting` — admin only)

- Sélecteur type de rapport (mensuel / annuel / comparaison) + période
- Affichage rapport en page
- Exports CSV (dépenses, CA annuel) — téléchargement direct côté client
- Export PDF : phase 2 (mentionné mais non implémenté)

---

## 5. Composants partagés

| Composant | Usage |
|-----------|-------|
| `MonthPicker` | Dashboard, Reporting, Saisie onglet Mois |
| `StatBadge` | Partout — badge coloré selon valeur vs seuil |
| `EmptyState` | Toutes pages si aucune donnée |
| `BreakevenGauge` | Dashboard + Charges |

---

## 6. Calculs financiers (`lib/calculations.ts`)

```ts
// Seuil de rentabilité
breakeven(fixedCharges, variableCostRate = 0.28) = fixedCharges / (1 - variableCostRate)
// → 98 400 / 0.72 = 136 667 MAD

// Marge nette estimée
netMargin(caCaisse, expenses) = caCaisse - expenses - (caCaisse * 0.28)

// Taux de marge
marginRate(netMargin, caCaisse) = netMargin / caCaisse * 100

// % seuil atteint
breakevenPct(caCaisse, breakeven) = caCaisse / breakeven * 100

// Projection fin d'année
yearEndProjection(monthlyAvg, remainingMonths, cumulativeReal) = cumulativeReal + (monthlyAvg * remainingMonths)
```

---

## 7. Design visuel

- **Couleurs primaires :** `#1F3864` (bleu Alaska), `#2E75B6` (bleu clair)
- **Statuts :** vert `#16a34a`, orange `#ea580c`, rouge `#dc2626`
- **Mobile-first :** breakpoint principal à 768px. Sidebar desktop, bottom-nav mobile.
- **Recharts :** palette cohérente avec les couleurs Alaska
- **Animations :** transitions subtiles sur les KPIs, gauge animée à l'entrée

---

## 8. Ordre d'implémentation

1. `lib/mock-data.ts` + `lib/calculations.ts` + `lib/local-store.ts`
2. Hooks (`useDashboard`, `useDailyEntry`, `useWeekView`, `useCharges`, `useObjectives`)
3. Dashboard (page la plus représentative, valide les composants partagés)
4. Saisie (page la plus utilisée, 3 onglets)
5. Import CSV (parser + UI)
6. Charges fixes (CRUD + simulateur)
7. Objectifs (plan d'action + trajectoire)
8. Reporting (exports CSV)

---

## 9. Hors scope Phase 1

- Export PDF
- PWA / offline
- Notifications push
- Connexion Supabase réelle
- Rapport comparaison N vs N-1 (affiché mais données statiques)
