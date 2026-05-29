"use client"

import React, { useState } from "react"
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

  const renderBold = (text: string) => {
    const parts = text.split(/\*\*(.+?)\*\*/)
    return parts.map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part)
  }

  const renderMarkdown = (text: string) => {
    const lines = text.split("\n")
    const elements: React.ReactNode[] = []
    let i = 0

    while (i < lines.length) {
      const line = lines[i]

      // Table: collect consecutive | lines
      if (line.trim().startsWith("|")) {
        const tableLines: string[] = []
        while (i < lines.length && lines[i].trim().startsWith("|")) {
          tableLines.push(lines[i])
          i++
        }
        const parseRow = (row: string) => row.split("|").map(c => c.trim()).filter(c => c !== "")
        const headers = parseRow(tableLines[0])
        const rows = tableLines.slice(2).map(parseRow)
        elements.push(
          <div key={`table-${i}`} className="overflow-x-auto my-2 rounded border border-gray-200">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-50">
                <tr>{headers.map((h, j) => <th key={j} className="text-left px-3 py-1.5 font-medium text-alaska-dark border-b border-gray-200">{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((row, r) => (
                  <tr key={r} className={r % 2 === 1 ? "bg-gray-50" : ""}>
                    {row.map((cell, j) => <td key={j} className="px-3 py-1.5 text-alaska-dark border-b border-gray-100 last:border-b-0">{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
        continue
      }

      // Section heading
      if (line.startsWith("## ")) {
        elements.push(<h3 key={i} className="font-semibold text-alaska-dark mt-5 mb-2 text-sm uppercase tracking-wide">{line.slice(3)}</h3>)
        i++; continue
      }

      // Horizontal rule
      if (line.trim() === "---") {
        elements.push(<hr key={i} className="border-gray-200 my-3" />)
        i++; continue
      }

      // Blockquote
      if (line.startsWith("> ")) {
        elements.push(
          <div key={i} className="border-l-2 border-amber-400 bg-amber-50 pl-3 py-1.5 rounded-r text-sm text-alaska-dark my-1">
            {renderBold(line.slice(2))}
          </div>
        )
        i++; continue
      }

      // Bullet list
      if (line.startsWith("- ") || line.startsWith("* ")) {
        elements.push(
          <div key={i} className="flex gap-2 text-sm text-alaska-dark">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-alaska-muted flex-shrink-0" />
            <span>{renderBold(line.slice(2))}</span>
          </div>
        )
        i++; continue
      }

      // Numbered list
      if (/^\d+\. /.test(line)) {
        const num = line.match(/^(\d+)\./)?.[1]
        const content = line.replace(/^\d+\. /, "")
        elements.push(
          <div key={i} className="flex gap-2 text-sm text-alaska-dark">
            <span className="font-semibold min-w-[1.2em] text-alaska-gold">{num}.</span>
            <span>{renderBold(content)}</span>
          </div>
        )
        i++; continue
      }

      // Empty line
      if (line.trim() === "") {
        elements.push(<div key={i} className="h-1.5" />)
        i++; continue
      }

      // Paragraph
      elements.push(<p key={i} className="text-sm text-alaska-dark leading-relaxed">{renderBold(line)}</p>)
      i++
    }

    return elements
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
