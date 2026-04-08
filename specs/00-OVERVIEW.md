# Alaska Pilot — Vue d'ensemble & Architecture

> Spec version : 1.0 — Avril 2026
> Projet : Application de pilotage du restaurant Alaska Neo Bistrot
> Client : KAYZARAN SARL — Othman Bekri

---

## 1. Contexte & objectif

Alaska Neo Bistrot (Rabat, ouvert sept. 2024) a besoin d'un outil centralisé pour :

- Suivre le CA quotidien (import CSV caisse mensuel)
- Enregistrer les dépenses quotidiennes (matières premières + personnel)
- Piloter les charges fixes et simuler leur impact sur la rentabilité
- Fixer des objectifs annuels et suivre leur progression
- Gérer un plan d'action (leviers de croissance : soir, terrasse, B2B)
- Produire des rapports synthétiques mensuels

L'app remplace deux outils manuels actuels :
1. `Alaska_Suivi_Semaines_2026.xlsx` — 14 feuilles, difficile sur mobile
2. `ALASKA_BusinessPlan_V3.xlsx` — tableau de bord statique

---

## 2. Stack technique

| Couche | Choix | Justification |
|---|---|---|
| Framework | **Next.js 14** (App Router) | Full-stack, SSR, API routes, TypeScript natif |
| Language | **TypeScript** | Typage strict, moins de bugs, meilleure DX |
| UI | **Tailwind CSS** + shadcn/ui | Mobile-first, composants prêts, cohérent |
| Base de données | **Supabase** (PostgreSQL) | Auth intégrée, storage pour CSV, RLS par rôle |
| ORM | **Prisma** ou Supabase client direct | À décider par le développeur |
| Charts | **Recharts** ou **Chart.js** | Léger, compatible Next.js |
| Hébergement | **Vercel** | Intégration Next.js native, déploiement en 1 clic |
| Authentification | **Supabase Auth** (email/password) | Simple, sécurisé, gratuit |
| Storage fichiers | **Supabase Storage** | Upload CSV caisse |

### Contraintes techniques
- App **mobile-first** : utilisée depuis téléphone par le responsable resto
- **PWA optionnel** (phase 2) : installable sur écran d'accueil mobile
- **Offline partiel** (phase 2) : saisie de dépenses sans connexion
- Pas de framework mobile natif — uniquement web responsive

---

## 3. Structure du projet Next.js

```
alaska-pilot/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                  # Sidebar + bottom nav
│   │   ├── page.tsx                    # Dashboard principal
│   │   ├── saisie/page.tsx             # Saisie dépenses quotidiennes
│   │   ├── semaine/page.tsx            # Vue hebdomadaire
│   │   ├── charges/page.tsx            # Gestion charges fixes [ADMIN]
│   │   ├── objectifs/page.tsx          # Objectifs & plan d'action [ADMIN]
│   │   ├── import/page.tsx             # Import CSV caisse [ADMIN]
│   │   └── reporting/page.tsx          # Rapports & exports [ADMIN]
│   └── api/
│       ├── import-csv/route.ts         # Parse & import CSV caisse
│       ├── expenses/route.ts           # CRUD dépenses quotidiennes
│       ├── charges/route.ts            # CRUD charges fixes
│       └── dashboard/route.ts          # Données agrégées dashboard
├── components/
│   ├── ui/                             # shadcn/ui components
│   ├── charts/                         # Wrappers recharts
│   ├── forms/                          # Formulaires spécifiques
│   └── layout/                         # Header, Sidebar, BottomNav
├── lib/
│   ├── supabase.ts                     # Client Supabase
│   ├── csv-parser.ts                   # Parser CSV caisse spécifique
│   ├── calculations.ts                 # Calculs financiers (marge, seuil, etc.)
│   └── types.ts                        # TypeScript types partagés
├── specs/                              # CE DOSSIER — specs du projet
├── data/
│   └── seed.sql                        # Données historiques 2025-2026
└── supabase/
    └── migrations/                     # SQL migrations
```

---

## 4. Rôles utilisateurs

Deux rôles définis au niveau Supabase RLS :

| Rôle | Email | Accès |
|---|---|---|
| `admin` | othman@alaska.ma (ou autre) | Accès total à toutes les fonctionnalités |
| `manager` | manager@alaska.ma (ou autre) | Saisie + vue semaine uniquement (voir spec 01) |

---

## 5. Pages et accès par rôle

| Page | Admin | Manager | Description |
|---|---|---|---|
| Dashboard principal | ✅ | ❌ (redirect saisie) | KPIs, graphiques, objectifs |
| Saisie dépenses | ✅ | ✅ | Formulaire dépenses + CA caisse |
| Vue semaine | ✅ | ✅ | Résumé 7 jours |
| Gestion charges | ✅ | ❌ | Charges fixes, simulation |
| Objectifs & actions | ✅ | ❌ | Objectifs annuels, plan d'action |
| Import CSV caisse | ✅ | ❌ | Upload rapport mensuel caisse |
| Reporting | ✅ | ❌ | Rapports, exports PDF/CSV |

---

## 6. Données historiques à précharger

À l'initialisation de la base de données, les données suivantes doivent être importées :

**CA mensuel (caisse) — 2025 :**
| Mois | CA Caisse | CA B2B | CA Total |
|---|---|---|---|
| Jan 2025 | 144 569 | 0 | 144 569 |
| Fév 2025 | 153 924 | 0 | 153 924 |
| Mars 2025 | 44 250 | 0 | 44 250 |
| Avr 2025 | 139 282 | 58 080 | 197 362 |
| Mai 2025 | 128 522 | 0 | 128 522 |
| Jun 2025 | 123 396 | 0 | 123 396 |
| Jul 2025 | 170 668 | 0 | 170 668 |
| Aoû 2025 | 141 264 | 0 | 141 264 |
| Sep 2025 | 117 958 | 0 | 117 958 |
| Oct 2025 | 155 495 | 0 | 155 495 |
| Nov 2025 | 163 130 | 0 | 163 130 |
| Déc 2025 | 153 599 | 0 | 153 599 |
| **TOTAL** | **1 636 057** | **58 080** | **1 694 137** |

**CA 2024 (3 mois ouverture) :**
| Mois | CA Caisse | CA B2B |
|---|---|---|
| Oct 2024 | 125 235 | 49 200 |
| Nov 2024 | 119 928 | 0 |
| Déc 2024 | 124 436 | 0 |

**Dépenses quotidiennes 2026 :** fichier `data/expenses_2026_seed.json` (91 jours extraits de l'Excel existant)

---

## 7. Phases de développement

### Phase 1 — MVP (priorité absolue)
- Authentification (2 rôles)
- Dashboard KPIs (admin)
- Saisie dépenses quotidiennes (admin + manager)
- Vue semaine (admin + manager)
- Import CSV caisse mensuel
- Gestion charges fixes basique

### Phase 2 — Pilotage complet
- Objectifs annuels + suivi progression
- Plan d'action avec statuts
- Simulation charges ("et si j'embauche X ?")
- Reporting mensuel PDF

### Phase 3 — Optimisations
- PWA (installable mobile)
- Notifications (seuil de rentabilité dépassé/non atteint)
- Offline saisie dépenses

---

## 8. Contraintes métier importantes

- **Seuil de rentabilité** = 98 400 ÷ 72% = **136 667 MAD/mois** (charges fixes / taux marge sur coût variable)
- **Taux charges variables** estimé à 28% du CA (matières premières)
- Ramadan impacte fortement mars — à annoter dans les données
- Les chiffres **CA caisse** et **CA B2B (facturé)** sont à suivre séparément
- Le restaurant est ouvert **7j/7 depuis mai 2025**
- Le service du soir est actif **depuis juillet 2025**
