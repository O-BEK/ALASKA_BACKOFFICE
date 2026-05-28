import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function buildChatContext(month: string): Promise<string> {
  const adminSupabase = createAdminClient()
  const [yearStr, monthStr] = month.split("-")
  const year = Number(yearStr)
  const rawMonth = Number(monthStr)
  const lastDay = new Date(year, rawMonth, 0).getDate()

  const [salesRes, expensesRes, objectiveRes, calendarRes] = await Promise.all([
    adminSupabase
      .from("daily_sales")
      .select("date, ca_caisse, ca_b2b")
      .gte("date", `${month}-01`)
      .lte("date", `${month}-${lastDay}`),
    adminSupabase
      .from("expenses")
      .select("category, amount")
      .gte("date", `${month}-01`)
      .lte("date", `${month}-${lastDay}`),
    adminSupabase
      .from("monthly_objectives")
      .select("target_amount")
      .eq("month", month)
      .maybeSingle(),
    adminSupabase
      .from("calendar_events")
      .select("name, date_start, date_end, impact, type")
      .lte("date_start", `${month}-${lastDay}`)
      .gte("date_end", `${month}-01`),
  ])

  const sales = salesRes.data || []
  const ca_total = sales.reduce((sum, s) => sum + (s.ca_caisse ?? 0) + (s.ca_b2b ?? 0), 0)
  const ca_caisse = sales.reduce((sum, s) => sum + (s.ca_caisse ?? 0), 0)
  const ca_b2b = sales.reduce((sum, s) => sum + (s.ca_b2b ?? 0), 0)

  const expenses = expensesRes.data || []
  const byCategory = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + (e.amount ?? 0)
    return acc
  }, {} as Record<string, number>)

  const objective = objectiveRes.data?.target_amount ?? null

  // N-1 month
  const n1Year = rawMonth === 1 ? year - 1 : year
  const n1Month = rawMonth === 1 ? 12 : rawMonth - 1
  const n1Key = `${n1Year}-${String(n1Month).padStart(2, "0")}`
  const n1LastDay = new Date(n1Year, n1Month, 0).getDate()
  const { data: n1Sales } = await adminSupabase
    .from("daily_sales")
    .select("ca_caisse, ca_b2b")
    .gte("date", `${n1Key}-01`)
    .lte("date", `${n1Key}-${n1LastDay}`)
  const ca_n1 = (n1Sales || []).reduce((sum, s) => sum + (s.ca_caisse ?? 0) + (s.ca_b2b ?? 0), 0)

  const calEvents = calendarRes.data || []
  const monthLabel = format(new Date(year, rawMonth - 1, 1), "MMMM yyyy", { locale: fr })
  const n1Label = format(new Date(n1Year, n1Month - 1, 1), "MMMM yyyy", { locale: fr })

  return `DONNÉES FINANCIÈRES — ${monthLabel}

CA total : ${ca_total.toLocaleString("fr-MA")} MAD (caisse: ${ca_caisse.toLocaleString("fr-MA")}, B2B: ${ca_b2b.toLocaleString("fr-MA")})
CA ${n1Label} (N-1) : ${ca_n1.toLocaleString("fr-MA")} MAD${ca_n1 > 0 ? ` (${((ca_total - ca_n1) / ca_n1 * 100).toFixed(1)}%)` : ""}
Objectif mensuel : ${objective ? objective.toLocaleString("fr-MA") + " MAD" : "Non défini"}${objective ? ` | Écart : ${(ca_total - objective >= 0 ? "+" : "") + (ca_total - objective).toLocaleString("fr-MA")} MAD` : ""}

Dépenses :
- Matières premières : ${(byCategory["MP"] ?? 0).toLocaleString("fr-MA")} MAD
- Ressources humaines : ${(byCategory["RH"] ?? 0).toLocaleString("fr-MA")} MAD
- Charges : ${(byCategory["CHARGES"] ?? 0).toLocaleString("fr-MA")} MAD
- Autres : ${(byCategory["AUTRE"] ?? 0).toLocaleString("fr-MA")} MAD

Événements calendaires ce mois :
${calEvents.length > 0
  ? calEvents.map(e => `- ${e.name} (${e.date_start}→${e.date_end}, impact: ${e.impact})`).join("\n")
  : "- Aucun événement particulier"}

Date du jour : ${format(new Date(), "d MMMM yyyy", { locale: fr })}`
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Assistant IA non configuré." }, { status: 503 })
  }

  try {
    const { messages, month } = await request.json()
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages invalides." }, { status: 400 })
    }

    const currentMonth = typeof month === "string" ? month : new Date().toISOString().slice(0, 7)
    const context = await buildChatContext(currentMonth)

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: `Tu es l'assistant financier d'Alaska Neo Bistrot, un restaurant à Rabat (Maroc).
Tu analyses les données financières et le contexte calendaire pour aider le gérant à piloter son activité.
Réponds toujours en français. Sois concis et direct. Utilise des chiffres précis quand tu les cites.
Les montants sont en MAD (dirhams marocains). Ne jamais inventer de données.

${context}`,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    })

    const content = response.content[0]
    if (content.type !== "text") throw new Error("Type de réponse inattendu")

    return NextResponse.json({ reply: content.text })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    console.error("[api/ai/chat]", message)
    return NextResponse.json({ error: "Impossible de contacter l'assistant." }, { status: 500 })
  }
}
