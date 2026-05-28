import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createClient, isAdmin } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function buildRichContext(month: string): Promise<string> {
  const adminSupabase = createAdminClient()
  const [yearStr, monthStr] = month.split("-")
  const year = Number(yearStr)
  const rawMonth = Number(monthStr)
  const lastDay = new Date(year, rawMonth, 0).getDate()

  const [salesRes, expensesRes, objectiveRes, calendarRes, chargesRes] = await Promise.all([
    adminSupabase.from("daily_sales").select("date, ca_caisse, ca_b2b, tickets_count").gte("date", `${month}-01`).lte("date", `${month}-${lastDay}`).order("date"),
    adminSupabase.from("expenses").select("date, category, amount, label").gte("date", `${month}-01`).lte("date", `${month}-${lastDay}`),
    adminSupabase.from("monthly_objectives").select("target_amount").eq("month", month).maybeSingle(),
    adminSupabase.from("calendar_events").select("name, date_start, date_end, impact, type").lte("date_start", `${month}-${lastDay}`).gte("date_end", `${month}-01`),
    adminSupabase.from("fixed_charges").select("name, amount, category, is_active").eq("is_active", true),
  ])

  const sales = salesRes.data || []
  const ca_total = sales.reduce((s, r) => s + (r.ca_caisse ?? 0) + (r.ca_b2b ?? 0), 0)
  const ca_caisse = sales.reduce((s, r) => s + (r.ca_caisse ?? 0), 0)
  const ca_b2b = sales.reduce((s, r) => s + (r.ca_b2b ?? 0), 0)
  const total_tickets = sales.reduce((s, r) => s + (r.tickets_count ?? 0), 0)
  const avg_ticket = total_tickets > 0 ? Math.round(ca_total / total_tickets) : 0
  const days_with_data = sales.length
  const ca_per_day = days_with_data > 0 ? Math.round(ca_total / days_with_data) : 0

  const expenses = expensesRes.data || []
  const byCategory = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + (e.amount ?? 0)
    return acc
  }, {} as Record<string, number>)
  const total_expenses = Object.values(byCategory).reduce((s, v) => s + v, 0)
  const food_cost_pct = ca_total > 0 ? ((byCategory["MP"] ?? 0) / ca_total * 100).toFixed(1) : "N/A"

  // N-1
  const n1Year = rawMonth === 1 ? year - 1 : year
  const n1Month = rawMonth === 1 ? 12 : rawMonth - 1
  const n1Key = `${n1Year}-${String(n1Month).padStart(2, "0")}`
  const n1LastDay = new Date(n1Year, n1Month, 0).getDate()
  const { data: n1Sales } = await adminSupabase.from("daily_sales").select("ca_caisse, ca_b2b").gte("date", `${n1Key}-01`).lte("date", `${n1Key}-${n1LastDay}`)
  const ca_n1 = (n1Sales || []).reduce((s, r) => s + (r.ca_caisse ?? 0) + (r.ca_b2b ?? 0), 0)

  const objective = objectiveRes.data?.target_amount ?? null
  const charges_total = (chargesRes.data || []).reduce((s, c) => s + (c.amount ?? 0), 0)
  const breakeven = charges_total > 0 ? Math.round(charges_total / 0.72) : 136667
  const breakeven_pct = ca_total > 0 ? (ca_total / breakeven * 100).toFixed(1) : "0"

  const calEvents = calendarRes.data || []
  const monthLabel = format(new Date(year, rawMonth - 1, 1), "MMMM yyyy", { locale: fr })
  const n1Label = format(new Date(n1Year, n1Month - 1, 1), "MMMM yyyy", { locale: fr })

  return `RAPPORT MENSUEL COMPLET — ${monthLabel}

=== CHIFFRE D'AFFAIRES ===
CA total : ${ca_total.toLocaleString("fr-MA")} MAD
  Caisse (espèces+CB) : ${ca_caisse.toLocaleString("fr-MA")} MAD
  B2B (facturé) : ${ca_b2b.toLocaleString("fr-MA")} MAD
CA ${n1Label} (N-1) : ${ca_n1.toLocaleString("fr-MA")} MAD | Évolution : ${ca_n1 > 0 ? ((ca_total - ca_n1) / ca_n1 * 100).toFixed(1) + "%" : "N/A"}
Jours avec données : ${days_with_data} | CA/jour moyen : ${ca_per_day.toLocaleString("fr-MA")} MAD
Tickets : ${total_tickets} | Ticket moyen : ${avg_ticket.toLocaleString("fr-MA")} MAD

=== OBJECTIF ===
Objectif mensuel : ${objective ? objective.toLocaleString("fr-MA") + " MAD" : "Non défini"}
${objective ? `Atteinte : ${(ca_total / objective * 100).toFixed(1)}% | Écart : ${(ca_total - objective >= 0 ? "+" : "") + (ca_total - objective).toLocaleString("fr-MA")} MAD` : ""}
Seuil de rentabilité : ${breakeven.toLocaleString("fr-MA")} MAD | Atteinte : ${breakeven_pct}%

=== DÉPENSES ===
Total dépenses saisies : ${total_expenses.toLocaleString("fr-MA")} MAD
  Matières premières (MP) : ${(byCategory["MP"] ?? 0).toLocaleString("fr-MA")} MAD | Food cost : ${food_cost_pct}% (seuil : 28%)
  Ressources humaines (RH) : ${(byCategory["RH"] ?? 0).toLocaleString("fr-MA")} MAD
  Charges : ${(byCategory["CHARGES"] ?? 0).toLocaleString("fr-MA")} MAD
  Autres : ${(byCategory["AUTRE"] ?? 0).toLocaleString("fr-MA")} MAD

=== CHARGES FIXES ===
Total charges fixes actives : ${charges_total.toLocaleString("fr-MA")} MAD/mois

=== CONTEXTE CALENDAIRE ===
${calEvents.length > 0
  ? calEvents.map(e => `- ${e.name} (${e.date_start} → ${e.date_end}) : ${e.impact}`).join("\n")
  : "- Aucun événement particulier"}`
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 })
  if (!(await isAdmin(supabase, user.id))) return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Assistant IA non configuré." }, { status: 503 })
  }

  try {
    const { month } = await request.json()
    if (!month || typeof month !== "string") {
      return NextResponse.json({ error: "Mois invalide." }, { status: 400 })
    }

    const adminSupabase = createAdminClient()

    // Check cache
    const { data: cached } = await adminSupabase
      .from("ai_monthly_summaries")
      .select("summary_md, generated_at, model_used")
      .eq("month", month)
      .maybeSingle()

    if (cached) {
      return NextResponse.json({ summary_md: cached.summary_md, generated_at: cached.generated_at, cached: true })
    }

    // Generate
    const context = await buildRichContext(month)

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: `Tu es l'assistant financier d'Alaska Neo Bistrot, un restaurant à Rabat (Maroc).
Génère une analyse mensuelle structurée, concise et actionnable. Réponds en français.
Les montants sont en MAD. Utilise uniquement les données fournies.
Format de réponse en markdown avec exactement ces sections :
## CA & Performance
## Food Cost & Dépenses
## Points de vigilance
## Recommandations`,
      messages: [{ role: "user", content: `Génère l'analyse financière mensuelle :\n\n${context}` }],
    })

    const content = response.content[0]
    if (content.type !== "text") throw new Error("Type de réponse inattendu")

    const generated_at = new Date().toISOString()

    await adminSupabase.from("ai_monthly_summaries").insert({
      month,
      generated_at,
      summary_md: content.text,
      model_used: "claude-sonnet-4-6",
      context_snapshot: { month, generated_at },
    })

    return NextResponse.json({ summary_md: content.text, generated_at, cached: false })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    console.error("[api/ai/summary]", message)
    return NextResponse.json({ error: "Impossible de générer l'analyse." }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 })
  if (!(await isAdmin(supabase, user.id))) return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const month = searchParams.get("month")
  if (!month) return NextResponse.json({ error: "Mois manquant." }, { status: 400 })

  const adminSupabase = createAdminClient()
  await adminSupabase.from("ai_monthly_summaries").delete().eq("month", month)
  return NextResponse.json({ success: true })
}
