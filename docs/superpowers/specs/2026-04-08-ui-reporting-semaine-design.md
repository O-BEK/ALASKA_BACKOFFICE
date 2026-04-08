# Design — Refonte UI + Reporting + Page Semaine

**Date :** 2026-04-08  
**Statut :** Approuvé  
**Sous-projets :** 3 (UI redesign → Reporting → Page /semaine)

---

## Contexte

Application de pilotage financier pour le restaurant Alaska Neo Bistrot (Rabat).  
Stack : Next.js App Router, TypeScript, Tailwind, shadcn/ui, localStorage, Recharts.  
Tout le code est dans `claude/`. Ne jamais remonter au dossier parent.

---

## Sous-projet 1 : Refonte UI complète

### Design System

**Palette Tailwind** — à ajouter dans `tailwind.config.ts` sous `theme.extend.colors.alaska` :

```
sage:    #4a6741   actions primaires, nav active, accents
cream:   #f5f0e8   fond général du contenu
dark:    #1a1a16   sidebar, textes forts, récap saisie
gold:    #c9a96e   KPIs importants, séparateurs, solde positif
muted:   #7a7a6a   textes secondaires, labels
sage-lt: #e8ede7   hover states, badges clairs, fond section
```

**Typographies** — Next.js font loader dans `app/layout.tsx` :
- `Playfair_Display` (serif, subsets: latin) → `font-playfair` — chiffres KPI, titres de page
- `DM_Sans` (sans-serif, subsets: latin) → `font-sans` — tout le reste

**Conventions composants :**
- Cards : `bg-white border border-alaska-sage-lt rounded-xl` (pas d'ombres fortes)
- Fond page : `bg-alaska-cream`
- Bouton primaire : `bg-alaska-sage text-white hover:bg-alaska-sage/90`
- Focus inputs : `focus:ring-alaska-sage focus:border-alaska-sage`

---

### Navigation — Layout `app/(dashboard)/layout.tsx`

**Desktop sidebar :**
```
bg-alaska-dark (w-56)
├── Logo "🐟 Alaska / Pilotage" — Playfair Display, text-white
├── Nav items :
│   ├── Actif : bg-alaska-sage text-white rounded-lg
│   └── Inactif : text-alaska-muted hover:bg-white/5 hover:text-white
├── Séparateur gold subtil avant "Administration"
└── Bottom : nom utilisateur + rôle, text-alaska-muted
```

**Mobile bottom nav :**
```
bg-alaska-dark (h-16, safe-area-bottom)
4 items : Dashboard, Saisie, Semaine, + (menu)
Actif : text-alaska-sage + label visible
Inactif : text-alaska-muted
```

---

### Dashboard `app/(dashboard)/page.tsx`

**4 KPI cards (grille 2×2 sur mobile, 4 colonnes sur desktop) :**

| KPI | Valeur | Style |
|---|---|---|
| CA Caisse | chiffre MAD | Playfair Display, text-alaska-dark |
| Dépenses | -chiffre MAD | text-orange-600 |
| Solde caisse | CA - dépenses | gold si positif, rouge si négatif |
| Seuil | % + barre | jauge sage |

- Delta mois précédent sous chaque KPI (↑/↓ en petit)
- Fond cards : `bg-white`

**Graphique CA 12 mois :**
- Recharts `AreaChart` — couleur stroke `#4a6741`, fill `#4a6741/10`
- Fond crème

**Card objectif mensuel :**
- Barre progression sage
- Note contextuelle si Ramadan (mars) ou événement

**Top 3 actions :**
- Badge levier coloré : soir=sage, terrasse=gold, b2b=amber, marketing=blue, pilotage=purple
- Chevron → vers /objectifs

---

### Saisie `app/(dashboard)/saisie/page.tsx`

Logique inchangée — refonte visuelle uniquement :
- Fond `bg-alaska-cream`
- Tabs : actif `bg-alaska-sage text-white`, inactif `text-alaska-muted`
- Récap solde caisse : fond `bg-alaska-dark`, chiffre en Playfair + `text-alaska-gold`
- ExpenseGroup : titre section en sage, inputs focus sage
- WeekGrid : header colonnes `bg-alaska-sage-lt`, solde positif `text-alaska-gold`

---

### Charges `app/(dashboard)/charges/page.tsx`

- Header : total charges fixes en Playfair Display
- Groupes par catégorie avec barres horizontales sage (% du total)
- Simulateur "et si" — fond sage-lt
- Bouton ajouter en sage

---

### Objectifs `app/(dashboard)/objectifs/page.tsx`

- Badges levier : couleur par type (soir=sage, terrasse=gold, b2b=amber)
- Progression annuelle : grand chiffre Playfair + barre sage
- Trajectoire 3 ans : Recharts LineChart sage

---

### Import `app/(dashboard)/import/page.tsx`

- Zone drag-drop : bordure tiretée sage, icône sage
- Historique : badges statut colorés

---

## Sous-projet 2 : Reporting `app/(dashboard)/reporting/page.tsx`

**Remplacement de la page minimale actuelle par 4 sections :**

### Section 1 — KPIs mois sélectionné
- Même 4 KPIs que dashboard mais pour le mois sélectionné
- Comparaison vs mois précédent + vs objectif

### Section 2 — Dépenses par poste (barres horizontales)
```
Othman      9 050  ████████░░
Boucher     1 964  ████░░░░░░
Courses     2 236  █████░░░░░
Noeman      2 000  ████░░░░░░
```
- `BarChart` horizontal Recharts, couleur sage
- Données depuis `getLocalEntries()` agrégées sur le mois

### Section 3 — Évolution CA 6 mois
- `AreaChart` Recharts — CA caisse + objectif mensuel (ligne tiretée)
- Couleurs : sage pour CA réel, gold pour objectif

### Section 4 — Répartition dépenses (donut)
- `PieChart` Recharts — MP / RH / CHARGES / AUTRE
- Couleurs : sage, gold, amber, muted

### Export
- Bouton "Exporter CSV" — génère un CSV du mois avec CA + dépenses par poste

---

## Sous-projet 3 : Page /semaine `app/(dashboard)/semaine/page.tsx`

**Remplace le placeholder actuel par une vraie page :**

### KPIs semaine (4 cards)
- CA semaine, Sorties, Solde semaine, % seuil hebdo (31 566 MAD)

### Grille éditable (desktop)
- Réutilise `<WeekGrid>` depuis `components/saisie/WeekGrid.tsx`
- Navigation ‹ semaine précédente / semaine suivante ›
- Alimentée par `useWeekEntries(weekStart)`

### Liste mobile (< md)
- 7 jours avec statut (✅/🟡/⬜)
- Clic → redirige vers `/saisie` avec ce jour sélectionné

### Dépenses par poste (cette semaine)
- Barres horizontales — même composant que Reporting
- Top 6 postes de la semaine

---

## Fichiers à créer / modifier

### Design system
| Fichier | Action |
|---|---|
| `tailwind.config.ts` | Ajouter couleurs alaska + polices |
| `app/layout.tsx` | Charger Playfair Display + DM Sans via next/font |
| `app/globals.css` | Variables CSS + base body font |

### Layout
| Fichier | Action |
|---|---|
| `app/(dashboard)/layout.tsx` | Refonte sidebar dark + mobile bottom nav |

### Pages (visuelles uniquement sauf Reporting et Semaine)
| Fichier | Action |
|---|---|
| `app/(dashboard)/page.tsx` | Dashboard — KPIs + graphiques Alaska |
| `app/(dashboard)/saisie/page.tsx` | Visual polish |
| `app/(dashboard)/charges/page.tsx` | Barres proportionnelles + polish |
| `app/(dashboard)/objectifs/page.tsx` | Badges colorés + polish |
| `app/(dashboard)/import/page.tsx` | Visual polish |
| `app/(dashboard)/reporting/page.tsx` | Refaire entièrement — 4 sections + charts |
| `app/(dashboard)/semaine/page.tsx` | Implémenter entièrement |

### Composant partagé
| Fichier | Action |
|---|---|
| `components/ExpenseBar.tsx` | Barres horizontales réutilisables (Reporting + Semaine) |

---

## Règles transversales

- Tous les montants MAD : `formatMAD()` existant
- Tous les grands chiffres : classe `font-playfair`
- Pas de modifications à `lib/` (types, hooks, mock-data, calculations) — UI only sauf Reporting qui lit localStorage
- Conserver la logique fonctionnelle existante — ne changer que le rendu
