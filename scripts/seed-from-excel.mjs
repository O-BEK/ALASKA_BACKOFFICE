/**
 * seed-from-excel.mjs
 *
 * Importe l'historique réel Alaska depuis le fichier Excel de suivi semaines.
 * Upsert dans Supabase (daily_sales + expenses) via le service role key (bypass RLS).
 *
 * Usage :
 *   node --env-file=.env.local scripts/seed-from-excel.mjs "<chemin/vers/Alaska_Suivi_Semaines_2026.xlsx>"
 *
 * Variables requises dans .env.local :
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"
import { resolve } from "path"
import { createRequire } from "module"

const require = createRequire(import.meta.url)
const xlsx = require("xlsx")

// ─── Configuration ────────────────────────────────────────────────────────────

const EXCEL_PATH = process.argv[2]
  ? resolve(process.argv[2])
  : resolve("C:/Users/OthmanBEKRI/OneDrive - UTM/09 - KAYZARAN/ALASKA/03.CAISSE/Alaska_Suivi_Semaines_2026.xlsx")

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌  Variables manquantes dans .env.local :")
  if (!SUPABASE_URL) console.error("   NEXT_PUBLIC_SUPABASE_URL")
  if (!SERVICE_ROLE_KEY) console.error("   SUPABASE_SERVICE_ROLE_KEY")
  console.error("\n   Récupère la service role key dans Supabase → Project Settings → API → service_role")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ─── Catégorie mapping ────────────────────────────────────────────────────────

function mapCategory(raw) {
  if (raw === "MP") return "MP"
  if (raw === "RH" || raw === "Boss") return "RH"
  if (raw === "CHARGES") return "CHARGES"
  return "AUTRE"
}

// ─── Parse Excel ──────────────────────────────────────────────────────────────

console.log(`📂  Lecture du fichier : ${EXCEL_PATH}`)
const wb = xlsx.readFile(EXCEL_PATH)

const sheetNames = wb.SheetNames.filter((n) => /^S\.\d+$/.test(n))
console.log(`📋  Feuilles détectées : ${sheetNames.join(", ")}`)

const byDate = {}

for (const sheetName of sheetNames) {
  const ws = wb.Sheets[sheetName]
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1 })

  // Ligne d'en-tête dépenses (index 14) — contient les numéros de série des dates
  const headerRow = rows[14] || []

  // Lignes journalières (index 5 à 11)
  const dailyRows = rows.slice(5, 12).filter(
    (r) => r[0] && typeof r[0] === "number" && r[0] > 40000
  )

  // Lignes dépenses (index 15+)
  const expRows = rows.slice(15).filter(
    (r) => r[0] && r[1] && typeof r[0] === "string" && String(r[0]).trim() !== ""
  )

  for (const row of dailyRows) {
    const serial = row[0]
    const ca = Number(row[1] || 0)

    // Convertir numéro de série Excel → YYYY-MM-DD
    const d = xlsx.SSF.parse_date_code(serial)
    const dateStr = `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`

    // Colonne de ce jour dans la ligne d'en-tête dépenses
    const colIdx = headerRow.indexOf(serial)

    const expenses = []
    if (colIdx >= 0) {
      for (const expRow of expRows) {
        const rawCat = String(expRow[0] || "").trim()
        const label = String(expRow[1] || "").trim()
        const amount = Number(expRow[colIdx] || 0)

        if (!label || amount <= 0) continue
        expenses.push({ category: mapCategory(rawCat), label, amount })
      }
    }

    // N'importer que les jours avec données
    if (ca > 0 || expenses.length > 0) {
      byDate[dateStr] = { date: dateStr, ca_caisse: ca, expenses }
    }
  }
}

const days = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))

if (days.length === 0) {
  console.error("❌  Aucune donnée trouvée dans le fichier Excel.")
  process.exit(1)
}

const firstDate = days[0].date
const lastDate = days[days.length - 1].date
const totalExpenses = days.reduce((s, d) => s + d.expenses.length, 0)

console.log(`\n📊  Données parsées :`)
console.log(`   ${days.length} jours  (${firstDate} → ${lastDate})`)
console.log(`   ${totalExpenses} lignes de dépenses`)

// ─── Upsert daily_sales ───────────────────────────────────────────────────────

console.log("\n⬆️   Upsert daily_sales...")

const salesRows = days.map((d) => ({
  date: d.date,
  ca_caisse: d.ca_caisse,
  ca_b2b: 0,
  ca_soir: 0,
  pct_soir: 0,
  tickets_count: 0,
  notes: "",
  source: "manual",
  import_id: null,
  created_by: null,
  updated_at: new Date().toISOString(),
}))

// Upsert par lots de 100
const BATCH = 100
let salesOk = 0
for (let i = 0; i < salesRows.length; i += BATCH) {
  const batch = salesRows.slice(i, i + BATCH)
  const { error } = await supabase
    .from("daily_sales")
    .upsert(batch, { onConflict: "date" })
  if (error) {
    console.error(`   ❌  Lot ${i}–${i + batch.length} : ${error.message}`)
  } else {
    salesOk += batch.length
  }
}
console.log(`   ✅  ${salesOk}/${salesRows.length} jours upsertés`)

// ─── Remplacer expenses ───────────────────────────────────────────────────────

console.log("\n🗑️   Suppression des dépenses existantes pour ces dates...")

const dates = days.map((d) => d.date)
// Supprimer par lots pour éviter les URL trop longues
for (let i = 0; i < dates.length; i += BATCH) {
  const batch = dates.slice(i, i + BATCH)
  const { error } = await supabase.from("expenses").delete().in("date", batch)
  if (error) console.error(`   ❌  Delete lot ${i} : ${error.message}`)
}

console.log("\n⬆️   Insertion des dépenses réelles...")

const expenseRows = days.flatMap((d) =>
  d.expenses.map((e) => ({
    date: d.date,
    category: e.category,
    label: e.label,
    amount: e.amount,
    notes: "",
    created_by: null,
    updated_at: new Date().toISOString(),
  }))
)

let expOk = 0
for (let i = 0; i < expenseRows.length; i += BATCH) {
  const batch = expenseRows.slice(i, i + BATCH)
  const { error } = await supabase.from("expenses").insert(batch)
  if (error) {
    console.error(`   ❌  Lot dépenses ${i} : ${error.message}`)
  } else {
    expOk += batch.length
  }
}
console.log(`   ✅  ${expOk}/${expenseRows.length} dépenses insérées`)

// ─── Résumé ───────────────────────────────────────────────────────────────────

console.log("\n✨  Import terminé !")
console.log(`   Période : ${firstDate} → ${lastDate}`)
console.log(`   ${salesOk} jours · ${expOk} dépenses`)
console.log("\n   Recharge le dashboard pour voir les données réelles.")
