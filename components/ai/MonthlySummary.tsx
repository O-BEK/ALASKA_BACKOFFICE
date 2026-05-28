"use client"

import { useState } from "react"
import { Loader2, RefreshCw, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type SummaryState = {
  summary_md: string | null
  generated_at: string | null
  cached: boolean
}

export function MonthlySummary({ month }: { month: string }) {
  const [state, setState] = useState<SummaryState>({ summary_md: null, generated_at: null, cached: false })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = async (forceRegen = false) => {
    setLoading(true)
    setError(null)

    if (forceRegen) {
      await fetch(`/api/ai/summary?month=${month}`, { method: "DELETE" })
    }

    try {
      const res = await fetch("/api/ai/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setState({ summary_md: data.summary_md, generated_at: data.generated_at, cached: data.cached })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue")
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("fr-MA", { day: "numeric", month: "long", year: "numeric" })

  const renderMarkdown = (text: string) => {
    return text.split("\n").map((line, i) => {
      if (line.startsWith("## ")) {
        return <h3 key={i} className="font-semibold text-alaska-dark mt-3 mb-1">{line.slice(3)}</h3>
      }
      if (line.startsWith("- ") || line.startsWith("* ")) {
        const content = line.slice(2).replace(/\*\*(.+?)\*\*/g, "$1")
        return <li key={i} className="text-sm text-alaska-dark ml-3 list-disc">{content}</li>
      }
      if (line.trim() === "") return <div key={i} className="h-1" />
      const rendered = line.replace(/\*\*(.+?)\*\*/g, "$1")
      return <p key={i} className="text-sm text-alaska-dark">{rendered}</p>
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles size={16} className="text-alaska-gold" aria-hidden="true" />
            Analyse IA
          </CardTitle>
          {state.generated_at && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-alaska-muted">
                {state.cached ? "Cache" : "Générée"} · {formatDate(state.generated_at)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => generate(true)}
                disabled={loading}
                aria-label="Régénérer l'analyse"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!state.summary_md && !loading && (
          <Button onClick={() => generate(false)} disabled={loading} className="w-full">
            <Sparkles size={14} className="mr-2" aria-hidden="true" />
            Générer l&apos;analyse du mois
          </Button>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-alaska-muted py-4 justify-center">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            Analyse en cours (15-20 secondes)...
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        {state.summary_md && (
          <div className="space-y-0.5">
            {renderMarkdown(state.summary_md)}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
