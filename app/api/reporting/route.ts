import { NextResponse } from "next/server"
import { buildLastSixMonths, monthReporting } from "@/lib/server/analytics"
import { createClient } from "@/lib/supabase/server"
import { readSnapshot } from "@/lib/server/supabase-store"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const month = searchParams.get("month") || new Date().toISOString().slice(0, 7)
  const supabase = createClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const db = await readSnapshot(supabase)

    return NextResponse.json({
      ...monthReporting(db, month),
      last6: buildLastSixMonths(db, month),
    })
  } catch {
    return NextResponse.json({ error: "Impossible de charger le reporting." }, { status: 500 })
  }
}
