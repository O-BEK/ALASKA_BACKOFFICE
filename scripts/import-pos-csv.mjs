/**
 * import-pos-csv.mjs
 *
 * Importe l'export POS complet (ventes par ticket avec "Moyens de paiements")
 * dans Supabase : ca_caisse = espèces, ca_b2b = carte + glovo.
 *
 * Usage :
 *   node --env-file=.env.local scripts/import-pos-csv.mjs "<chemin/vers/ventes.csv>"
 */

import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"
import { resolve } from "path"

const CSV_PATH = process.argv[2]
if (!CSV_PATH) {
  console.error("❌  Chemin CSV requis : node --env-file=.env.local scripts/import-pos-csv.mjs <fichier.csv>")
  process.exit(1)
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌  Variables manquantes dans .env.local")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// ─── Parse CSV ────────────────────────────────────────────────────────────────

console.log(`📂  Lecture : ${resolve(CSV_PATH)}`)
const content = readFileSync(resolve(CSV_PATH), "utf-8")
const lines = content.split("\n").map(l => l.trim()).filter(Boolean)

// Detect separator
const sep = lines[0].includes(";") ? ";" : ","

function parseLine(line) {
  const cols = []
  let cur = ""
  let inQ = false
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ }
    else if (ch === sep && !inQ) { cols.push(cur.trim()); cur = "" }
    else { cur += ch }
  }
  cols.push(cur.trim())
  return cols
}

const headers = parseLine(lines[0]).map(h => h.replace(/^"|"$/g, ""))
const idx = {
  date: headers.indexOf("Date"),
  heure: headers.indexOf("Heure"),
  ticket: headers.indexOf("Num ticket"),
  prix: headers.indexOf("Prix de vente"),
  qte: headers.indexOf("Quantité"),
  payment: headers.indexOf("Moyens de paiements"),
}

if (idx.date === -1 || idx.prix === -1) {
  console.error("❌  Colonnes 'Date' ou 'Prix de vente' introuvables")
  process.exit(1)
}

// Group by date
const byDate = {}

for (const line of lines.slice(1)) {
  const cols = parseLine(line)
  const rawDate = cols[idx.date]?.replace(/^"|"$/g, "").trim()
  const rawPrix = cols[idx.prix]?.replace(/^"|"$/g, "").trim().replace(",", ".")
  const rawQte  = idx.qte >= 0 ? cols[idx.qte]?.replace(/^"|"$/g, "").trim().replace(",", ".") : "1"
  const rawPay  = idx.payment >= 0 ? cols[idx.payment]?.replace(/^"|"$/g, "").trim() : ""
  const rawTime = idx.heure >= 0 ? cols[idx.heure]?.replace(/^"|"$/g, "").trim() : ""
  const rawTicket = idx.ticket >= 0 ? cols[idx.ticket]?.replace(/^"|"$/g, "").trim() : ""

  if (!rawDate || !rawPrix) continue
  const prix = parseFloat(rawPrix)
  const qte = parseFloat(rawQte) || 1
  if (isNaN(prix) || prix <= 0) continue
  const amount = Math.round(prix * qte * 100) / 100

  // Convert date YYYY-MM-DD (already ISO) or DD/MM/YYYY
  let date
  if (rawDate.includes("/")) {
    const [d, m, y] = rawDate.split("/")
    if (!d || !m || !y) continue
    date = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
  } else {
    date = rawDate
  }

  if (!byDate[date]) byDate[date] = { cash: 0, card: 0, soir: 0, tickets: new Set() }

  const payLower = rawPay.toLowerCase()
  const isCash = payLower.includes("esp") || payLower.includes("cash")
  if (isCash) {
    byDate[date].cash += amount
  } else {
    byDate[date].card += amount
  }

  if (rawTicket) byDate[date].tickets.add(rawTicket)

  // Soir >= 19h
  if (rawTime) {
    const hour = parseInt(rawTime.split(":")[0])
    if (!isNaN(hour) && hour >= 19) byDate[date].soir += amount
  }
}

const days = Object.entries(byDate)
  .map(([date, d]) => ({
    date,
    ca_caisse: Math.round(d.cash * 100) / 100,
    ca_b2b: Math.round(d.card * 100) / 100,
    ca_soir: Math.round(d.soir * 100) / 100,
    pct_soir: (d.cash + d.card) > 0 ? (d.soir / (d.cash + d.card)) * 100 : 0,
    tickets_count: d.tickets.size,
  }))
  .filter(d => d.ca_caisse > 0 || d.ca_b2b > 0)
  .sort((a, b) => a.date.localeCompare(b.date))

const first = days[0]?.date
const last = days[days.length - 1]?.date
console.log(`\n📊  ${days.length} jours (${first} → ${last})`)
console.log(`   CA Espèces total  : ${days.reduce((s, d) => s + d.ca_caisse, 0).toLocaleString("fr-MA")} MAD`)
console.log(`   CA Carte total    : ${days.reduce((s, d) => s + d.ca_b2b, 0).toLocaleString("fr-MA")} MAD`)

// ─── Récupérer ca_caisse existants pour les préserver ────────────────────────

console.log("\n🔍  Lecture des CA caisse existants...")
const dates = days.map(d => d.date)
const existingMap = {}
for (let i = 0; i < dates.length; i += 200) {
  const { data } = await supabase
    .from("daily_sales")
    .select("date, ca_caisse")
    .in("date", dates.slice(i, i + 200))
  for (const row of data || []) existingMap[row.date] = row.ca_caisse
}

// ─── Upsert daily_sales ───────────────────────────────────────────────────────

console.log("\n⬆️   Upsert daily_sales (ca_caisse préservé si déjà saisi)...")
const now = new Date().toISOString()
const BATCH = 100
let ok = 0

for (let i = 0; i < days.length; i += BATCH) {
  const batch = days.slice(i, i + BATCH).map(d => ({
    date: d.date,
    ca_caisse: existingMap[d.date] ?? 0,  // préservé si saisi, sinon 0
    ca_b2b: d.ca_b2b,  // carte uniquement depuis CSV
    ca_soir: d.ca_soir,
    pct_soir: d.pct_soir,
    tickets_count: d.tickets_count,
    notes: "",
    source: "csv_import",
    import_id: null,
    created_by: null,
    updated_at: now,
  }))
  const { error } = await supabase.from("daily_sales").upsert(batch, { onConflict: "date" })
  if (error) console.error(`   ❌  Lot ${i} : ${error.message}`)
  else ok += batch.length
}

console.log(`   ✅  ${ok}/${days.length} jours upsertés`)
console.log("\n✨  Import terminé ! Recharge le dashboard.")
