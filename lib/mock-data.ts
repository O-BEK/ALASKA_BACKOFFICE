import { DailyEntry, FixedCharge, ActionItem, Objective, MonthlyObjective, ImportRecord } from "./types"

// ─── CA MENSUEL 2025 ────────────────────────────────────────────────────────
export const MONTHLY_CA_2025: Record<string, { ca_caisse: number; ca_b2b: number }> = {
  "2025-01": { ca_caisse: 144569, ca_b2b: 0 },
  "2025-02": { ca_caisse: 153924, ca_b2b: 0 },
  "2025-03": { ca_caisse: 44250,  ca_b2b: 0 },
  "2025-04": { ca_caisse: 139282, ca_b2b: 58080 },
  "2025-05": { ca_caisse: 128522, ca_b2b: 0 },
  "2025-06": { ca_caisse: 123396, ca_b2b: 0 },
  "2025-07": { ca_caisse: 170668, ca_b2b: 0 },
  "2025-08": { ca_caisse: 141264, ca_b2b: 0 },
  "2025-09": { ca_caisse: 117958, ca_b2b: 0 },
  "2025-10": { ca_caisse: 155495, ca_b2b: 0 },
  "2025-11": { ca_caisse: 163130, ca_b2b: 0 },
  "2025-12": { ca_caisse: 153599, ca_b2b: 0 },
}

// ─── CA MENSUEL 2026 (Q1 réel) ───────────────────────────────────────────────
export const MONTHLY_CA_2026: Record<string, { ca_caisse: number; ca_b2b: number }> = {
  "2026-01": { ca_caisse: 213460, ca_b2b: 0 },
  "2026-02": { ca_caisse: 123472, ca_b2b: 0 },
  "2026-03": { ca_caisse: 95656,  ca_b2b: 49200 },
  "2026-04": { ca_caisse: 18106,  ca_b2b: 0 }, // partiel (7 jours)
}

// ─── DONNÉES JOURNALIÈRES AVRIL 2026 (partiel) ──────────────────────────────
export const DAILY_ENTRIES_2026: Record<string, DailyEntry> = {
  "2026-04-01": { date: "2026-04-01", ca_caisse: 2590, ca_b2b: 0, ca_soir: 466, pct_soir: 18, tickets_count: 34, mouvement_caisse: 0, cash_sales_journal: null, cash_movements_journal: null, cash_opening_fund: null, cash_closing_fund: null, cash_journal_sessions: 0, cash_journal_anomaly: false, cash_journal_import_id: null, notes: "", source: "csv_import", expenses: [{ id: "e1", category: "MP", label: "Boucher", amount: 1200 }, { id: "e2", category: "MP", label: "Courses", amount: 560 }, { id: "e3", category: "RH", label: "Othman", amount: 3000 }] },
  "2026-04-02": { date: "2026-04-02", ca_caisse: 1721, ca_b2b: 0, ca_soir: 378, pct_soir: 22, tickets_count: 21, mouvement_caisse: 0, cash_sales_journal: null, cash_movements_journal: null, cash_opening_fund: null, cash_closing_fund: null, cash_journal_sessions: 0, cash_journal_anomaly: false, cash_journal_import_id: null, notes: "", source: "csv_import", expenses: [{ id: "e4", category: "MP", label: "Poissonnier", amount: 890 }, { id: "e5", category: "MP", label: "Courses", amount: 340 }] },
  "2026-04-03": { date: "2026-04-03", ca_caisse: 3840, ca_b2b: 0, ca_soir: 691, pct_soir: 18, tickets_count: 45, mouvement_caisse: 0, cash_sales_journal: null, cash_movements_journal: null, cash_opening_fund: null, cash_closing_fund: null, cash_journal_sessions: 0, cash_journal_anomaly: false, cash_journal_import_id: null, notes: "", source: "csv_import", expenses: [{ id: "e6", category: "MP", label: "Boucher", amount: 1500 }, { id: "e7", category: "RH", label: "Ramzi", amount: 1426 }] },
  "2026-04-04": { date: "2026-04-04", ca_caisse: 1884, ca_b2b: 0, ca_soir: 452, pct_soir: 24, tickets_count: 26, mouvement_caisse: 0, cash_sales_journal: null, cash_movements_journal: null, cash_opening_fund: null, cash_closing_fund: null, cash_journal_sessions: 0, cash_journal_anomaly: false, cash_journal_import_id: null, notes: "", source: "csv_import", expenses: [{ id: "e8", category: "MP", label: "Courses", amount: 420 }, { id: "e9", category: "MP", label: "Eau", amount: 180 }] },
  "2026-04-05": { date: "2026-04-05", ca_caisse: 4271, ca_b2b: 0, ca_soir: 897, pct_soir: 21, tickets_count: 52, mouvement_caisse: 0, cash_sales_journal: null, cash_movements_journal: null, cash_opening_fund: null, cash_closing_fund: null, cash_journal_sessions: 0, cash_journal_anomaly: false, cash_journal_import_id: null, notes: "Samedi — service soir fort", source: "csv_import", expenses: [{ id: "e10", category: "MP", label: "Boucher", amount: 1800 }, { id: "e11", category: "MP", label: "Poissonnier", amount: 950 }, { id: "e12", category: "RH", label: "Noeman", amount: 2000 }] },
  "2026-04-06": { date: "2026-04-06", ca_caisse: 2320, ca_b2b: 0, ca_soir: 510, pct_soir: 22, tickets_count: 31, mouvement_caisse: 0, cash_sales_journal: null, cash_movements_journal: null, cash_opening_fund: null, cash_closing_fund: null, cash_journal_sessions: 0, cash_journal_anomaly: false, cash_journal_import_id: null, notes: "", source: "csv_import", expenses: [{ id: "e13", category: "MP", label: "Courses", amount: 380 }] },
  "2026-04-07": { date: "2026-04-07", ca_caisse: 1480, ca_b2b: 0, ca_soir: 296, pct_soir: 20, tickets_count: 19, mouvement_caisse: 0, cash_sales_journal: null, cash_movements_journal: null, cash_opening_fund: null, cash_closing_fund: null, cash_journal_sessions: 0, cash_journal_anomaly: false, cash_journal_import_id: null, notes: "", source: "csv_import", expenses: [] },
}

// ─── CHARGES FIXES ──────────────────────────────────────────────────────────
export const FIXED_CHARGES: FixedCharge[] = [
  { id: "fc1",  name: "Loyer",        category: "IMMOBILIER", amount: 34000, type: "fixed",      payment_day: 1,    is_staff: false, is_active: true, start_date: "2024-10-01", end_date: null },
  { id: "fc2",  name: "Électricité",  category: "ENERGIE",    amount: 6000,  type: "variable",   payment_day: null, is_staff: false, is_active: true, start_date: "2024-10-01", end_date: null },
  { id: "fc3",  name: "Gaz",          category: "ENERGIE",    amount: 1800,  type: "variable",   payment_day: null, is_staff: false, is_active: true, start_date: "2024-10-01", end_date: null },
  { id: "fc4",  name: "Internet",     category: "TELECOM",    amount: 500,   type: "fixed",      payment_day: 1,    is_staff: false, is_active: true, start_date: "2024-10-01", end_date: null },
  { id: "fc5",  name: "Transport",    category: "DIVERS",     amount: 6200,  type: "variable",   payment_day: null, is_staff: false, is_active: true, start_date: "2024-10-01", end_date: null },
  { id: "fc6",  name: "Divers",       category: "DIVERS",     amount: 10000, type: "variable",   payment_day: null, is_staff: false, is_active: true, start_date: "2024-10-01", end_date: null },
  { id: "fc0",  name: "Othman",       category: "PERSONNEL",  amount: 0,     type: "semi-fixed", payment_day: null, is_staff: true,  is_active: true, start_date: "2024-10-01", end_date: null },
  { id: "fc7",  name: "Ramzi",        category: "PERSONNEL",  amount: 5500,  type: "semi-fixed", payment_day: 1,    is_staff: true,  is_active: true, start_date: "2024-10-01", end_date: null },
  { id: "fc8",  name: "Leila",        category: "PERSONNEL",  amount: 3200,  type: "semi-fixed", payment_day: 21,   is_staff: true,  is_active: true, start_date: "2024-10-01", end_date: null },
  { id: "fc9",  name: "Noeman",       category: "PERSONNEL",  amount: 4500,  type: "semi-fixed", payment_day: 1,    is_staff: true,  is_active: true, start_date: "2024-10-01", end_date: null },
  { id: "fc10", name: "Mike",         category: "PERSONNEL",  amount: 6000,  type: "semi-fixed", payment_day: 1,    is_staff: true,  is_active: true, start_date: "2024-10-01", end_date: null },
  { id: "fc11", name: "Paul",         category: "PERSONNEL",  amount: 3800,  type: "semi-fixed", payment_day: 17,   is_staff: true,  is_active: true, start_date: "2024-10-01", end_date: null },
  { id: "fc12", name: "Adil",         category: "PERSONNEL",  amount: 3200,  type: "semi-fixed", payment_day: 21,   is_staff: true,  is_active: true, start_date: "2024-10-01", end_date: null },
  { id: "fc13", name: "Glody",        category: "PERSONNEL",  amount: 3500,  type: "semi-fixed", payment_day: 21,   is_staff: true,  is_active: true, start_date: "2024-10-01", end_date: null },
  { id: "fc14", name: "Aicha",        category: "PERSONNEL",  amount: 3000,  type: "semi-fixed", payment_day: 21,   is_staff: true,  is_active: true, start_date: "2024-10-01", end_date: null },
  { id: "fc15", name: "Chaimae",      category: "PERSONNEL",  amount: 3500,  type: "semi-fixed", payment_day: 24,   is_staff: true,  is_active: true, start_date: "2024-10-01", end_date: null },
]

// ─── ACTIONS PLAN ────────────────────────────────────────────────────────────
export const ACTION_ITEMS: ActionItem[] = [
  { id: "a1",  lever: "soir",      title: "Créer une identité soir distincte",          description: "Carte soir spécifique, musique, éclairage tamisé, prix cible 200+ MAD", priority: "urgent", deadline: "T2 2026", budget_min: 0,     budget_max: 0,     impact: "Ticket moyen +20%",           status: "todo" },
  { id: "a2",  lever: "soir",      title: "Lancer réservation en ligne dîner",          description: "Plateforme de réservation, Google/TheFork ou solution custom",           priority: "urgent", deadline: "T2 2026", budget_min: 0,     budget_max: 2000,  impact: "Taux remplissage soir +30%",  status: "todo" },
  { id: "a3",  lever: "soir",      title: "Communication soir Instagram + Google Posts",description: "Posts dédiés service soir, stories, reels",                              priority: "urgent", deadline: "Immédiat",budget_min: 3000,  budget_max: 3000,  impact: "Notoriété soir x2",           status: "in_progress" },
  { id: "a4",  lever: "soir",      title: "Analyser jours forts soir + optimiser staffing", description: "Croiser données CSV avec jours semaine pour identifier les pics", priority: "medium", deadline: "T2 2026",  budget_min: 0,     budget_max: 0,     impact: "Réduction coûts RH -10%",    status: "todo" },
  { id: "a5",  lever: "terrasse",  title: "Obtenir autorisation terrasse Mairie",       description: "Démarches administratives Mairie de Rabat",                             priority: "urgent", deadline: "T2 2026", budget_min: 0,     budget_max: 5000,  impact: "+40 couverts été",            status: "todo" },
  { id: "a6",  lever: "terrasse",  title: "Aménager terrasse (mobilier, parasols)",     description: "Mobilier outdoor, parasols, éclairage",                                 priority: "medium", deadline: "T2 2026", budget_min: 25000, budget_max: 50000, impact: "+15 000 MAD/mois été",        status: "todo" },
  { id: "a7",  lever: "b2b",       title: "Créer catalogue événementiel B2B",           description: "Brochure commerciale + landing page offres séminaires/repas d'affaires", priority: "medium", deadline: "T2 2026", budget_min: 5000,  budget_max: 5000,  impact: "CA B2B +50%",                status: "todo" },
  { id: "a8",  lever: "b2b",       title: "Prospecter 5 nouveaux clients corporate",   description: "Cibler entreprises zone Rabat-Agdal",                                   priority: "medium", deadline: "T2 2026", budget_min: 0,     budget_max: 0,     impact: "+30 000 MAD/mois B2B",       status: "todo" },
  { id: "a9",  lever: "b2b",       title: "Relancer ANYA, GIZ, REDAL, UTM, Ambassade Canada", description: "Emails de relance personnalisés",                              priority: "low",    deadline: "Continu", budget_min: 0,     budget_max: 0,     impact: "Récupérer clients existants", status: "in_progress" },
  { id: "a10", lever: "marketing", title: "Mettre à jour menu Google Business Profile",description: "Photos, prix, description à jour",                                      priority: "urgent", deadline: "Immédiat",budget_min: 0,     budget_max: 0,     impact: "Visibilité Google +40%",      status: "todo" },
  { id: "a11", lever: "marketing", title: "Publier 2x/semaine sur Google Business Profile", description: "Posts réguliers plats du jour, ambiance",                        priority: "urgent", deadline: "Continu", budget_min: 0,     budget_max: 0,     impact: "Référencement local",         status: "todo" },
  { id: "a12", lever: "pilotage",  title: "MAJ hebdo tableau de bord (chaque lundi)", description: "Saisir les données de la semaine chaque lundi matin",                  priority: "urgent", deadline: "Immédiat",budget_min: 0,     budget_max: 0,     impact: "Pilotage temps réel",         status: "in_progress" },
  { id: "a13", lever: "pilotage",  title: "Analyser ratio salaires/CA (cible < 25%)",  description: "Calcul mensuel salaires vs CA pour optimiser staffing",                  priority: "medium", deadline: "T2 2026", budget_min: 0,     budget_max: 0,     impact: "Marge +5pts",                status: "todo" },
  { id: "a14", lever: "pilotage",  title: "Préparer offre Ramadan 2027",               description: "Anticiper avec menu Iftar, communication, réservations groupes",         priority: "medium", deadline: "T4 2026", budget_min: 0,     budget_max: 0,     impact: "CA mars 2027 +50%",          status: "todo" },
]

// ─── OBJECTIFS ───────────────────────────────────────────────────────────────
export const OBJECTIVES: Objective[] = [
  { id: "o1", year: 2026, type: "ca_total", target_amount: 1927439, scenario: "prudent" },
  { id: "o2", year: 2026, type: "ca_total", target_amount: 2277882, scenario: "realistic" },
  { id: "o3", year: 2026, type: "ca_total", target_amount: 2628326, scenario: "ambitious" },
  { id: "o4", year: 2027, type: "ca_total", target_amount: 2847352, scenario: "realistic" },
]

export const MONTHLY_OBJECTIVES_2026: MonthlyObjective[] = [
  { year: 2026, month: 1,  target_ca: 190000, notes: "" },
  { year: 2026, month: 2,  target_ca: 165000, notes: "" },
  { year: 2026, month: 3,  target_ca: 90000,  notes: "Ramadan — cible réduite" },
  { year: 2026, month: 4,  target_ca: 190000, notes: "" },
  { year: 2026, month: 5,  target_ca: 200000, notes: "Terrasse + soir" },
  { year: 2026, month: 6,  target_ca: 200000, notes: "" },
  { year: 2026, month: 7,  target_ca: 220000, notes: "Pic été" },
  { year: 2026, month: 8,  target_ca: 200000, notes: "" },
  { year: 2026, month: 9,  target_ca: 180000, notes: "" },
  { year: 2026, month: 10, target_ca: 195000, notes: "" },
  { year: 2026, month: 11, target_ca: 200000, notes: "" },
  { year: 2026, month: 12, target_ca: 190000, notes: "" },
]

// ─── HISTORIQUE IMPORTS ──────────────────────────────────────────────────────
export const IMPORT_HISTORY: ImportRecord[] = [
  { id: "i1", filename: "ventes_07042026_120153.csv", storage_path: null, import_type: "sales_csv", imported_at: "2026-04-07T12:01:53", rows_processed: 892,  days_imported: 7,  date_range_start: "2026-04-01", date_range_end: "2026-04-07", ca_total: 18106, status: "success" },
  { id: "i2", filename: "ventes_02032026_090000.csv", storage_path: null, import_type: "sales_csv", imported_at: "2026-03-02T09:00:00", rows_processed: 2840, days_imported: 28, date_range_start: "2026-02-01", date_range_end: "2026-02-28", ca_total: 123472, status: "success" },
  { id: "i3", filename: "ventes_03022026_080000.csv", storage_path: null, import_type: "sales_csv", imported_at: "2026-02-03T08:00:00", rows_processed: 3100, days_imported: 31, date_range_start: "2026-01-01", date_range_end: "2026-01-31", ca_total: 213460, status: "success" },
]

// ─── HELPERS ─────────────────────────────────────────────────────────────────
export function getMockMonthlyCA(month: string): { ca_caisse: number; ca_b2b: number } {
  return MONTHLY_CA_2026[month] || MONTHLY_CA_2025[month] || { ca_caisse: 0, ca_b2b: 0 }
}

export function getMockDailyEntry(date: string): DailyEntry | null {
  return DAILY_ENTRIES_2026[date] || null
}

export function getLastNMonths(n: number): string[] {
  const months: string[] = []
  const now = new Date(2026, 3, 7) // 7 avril 2026
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
  }
  return months
}
