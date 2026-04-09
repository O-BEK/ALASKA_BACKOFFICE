"use client"

import { useEffect, useRef, useState } from "react"
import { parseImportHistoryPayload } from "@/lib/contracts"
import { parseCSV } from "@/lib/csv-parser"
import { formatMAD } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, AlertTriangle, CheckCircle2, FileText, UploadCloud, X, XCircle } from "lucide-react"
import type { ImportRecord } from "@/lib/types"
import { cn } from "@/lib/utils"

type ParsedDay = {
  date: string
  ca_caisse: number
  ca_soir: number
  pct_soir: number
  tickets_count: number
}

type Step = "upload" | "preview" | "done"

export default function ImportPage() {
  const [step, setStep] = useState<Step>("upload")
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ParsedDay[]>([])
  const [duplicates, setDuplicates] = useState<string[]>([])
  const [result, setResult] = useState<ImportRecord | null>(null)
  const [history, setHistory] = useState<ImportRecord[]>([])
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const safePreview = Array.isArray(preview) ? preview : []
  const safeDuplicates = Array.isArray(duplicates) ? duplicates : []
  const safeHistory = Array.isArray(history) ? history : []

  useEffect(() => {
    fetch("/api/import-csv")
      .then(async (response) => parseImportHistoryPayload(await response.json()))
      .then((payload) => setHistory(payload.history))
      .catch(() => setHistory([]))
  }, [])

  const readJsonSafely = async (response: Response) => {
    const raw = await response.text()
    try {
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {
        error:
          response.status === 413
            ? "Le fichier est trop volumineux pour être envoyé tel quel."
            : `Réponse serveur invalide (${response.status}).`,
      }
    }
  }

  const handleFile = async (selected: File) => {
    if (!selected.name.endsWith(".csv")) {
      setError("Format non supporté. Veuillez importer un fichier .csv")
      return
    }

    setFile(selected)
    setError("")

    try {
      const parsed = parseCSV(await selected.text())
      const response = await fetch("/api/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: selected.name, parsed }),
      })
      const payload = await readJsonSafely(response)
      if (!response.ok) {
        setError(payload.error || "Format CSV non reconnu.")
        return
      }

      setPreview(parsed)
      setDuplicates(Array.isArray(payload.duplicates) ? payload.duplicates as string[] : [])
      setStep("preview")
    } catch {
      setError("Format CSV non reconnu. Vérifie que c'est bien un export caisse valide.")
    }
  }

  const handleConfirm = async () => {
    if (!file || safePreview.length === 0) return

    const response = await fetch("/api/import-csv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, parsed: safePreview, commit: true }),
    })
    const payload = await readJsonSafely(response)
    if (!response.ok) {
      setError(payload.error || "Import impossible.")
      return
    }

    setResult(payload.result as ImportRecord)
    setHistory((prev) => [payload.result as ImportRecord, ...prev])
    setStep("done")
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="font-playfair text-2xl font-bold text-alaska-dark">Import CSV Caisse</h1>
        <p className="text-alaska-muted text-sm mt-1">Importer le rapport mensuel de votre logiciel de caisse</p>
      </div>

      {step === "upload" && (
        <div className="space-y-4">
          <Card
            className={cn(
              "border-2 border-dashed cursor-pointer rounded-xl transition",
              dragging ? "border-alaska-sage bg-alaska-sage-lt" : "border-alaska-sage-lt hover:border-alaska-sage hover:bg-alaska-sage-lt/40"
            )}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              const dropped = e.dataTransfer.files[0]
              if (dropped) void handleFile(dropped)
            }}
            onClick={() => inputRef.current?.click()}
          >
            <CardContent className="pt-10 pb-10 flex flex-col items-center gap-4">
              <UploadCloud size={40} className={dragging ? "text-alaska-sage" : "text-alaska-muted"} />
              <div className="text-center">
                <p className="font-semibold text-alaska-dark">Glisser-déposer le CSV ici</p>
                <p className="text-sm text-alaska-muted">ou cliquer pour sélectionner</p>
              </div>
              <p className="text-xs text-alaska-muted">Format : .csv · Taille max : 10 MB</p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const selected = e.target.files?.[0]
                  if (selected) void handleFile(selected)
                }}
              />
            </CardContent>
          </Card>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-xl border border-red-200">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <Card className="bg-white border border-alaska-sage-lt rounded-xl">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm text-alaska-dark">Derniers imports</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-4">
              {safeHistory.map((imp) => (
                <div key={imp.id} className="flex items-center gap-3 p-2 bg-alaska-sage-lt/30 rounded-lg">
                  {imp.status === "error" ? (
                    <XCircle size={16} className="text-red-500 flex-shrink-0" />
                  ) : imp.status === "partial" ? (
                    <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
                  ) : (
                    <CheckCircle2 size={16} className="text-alaska-sage flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-alaska-dark truncate">{imp.filename}</p>
                    <p className="text-xs text-alaska-muted">
                      {imp.days_imported} jours · {formatMAD(imp.ca_total)}
                    </p>
                  </div>
                  <span className="text-xs text-alaska-muted">{imp.imported_at.slice(0, 10)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          <Card className="bg-alaska-sage-lt border border-alaska-sage/30 rounded-xl">
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <FileText size={20} className="text-alaska-sage" />
              <div>
                <p className="font-semibold text-sm text-alaska-dark">{file?.name}</p>
                <p className="text-xs text-alaska-sage">
                  {safePreview.length} jours · {safePreview.reduce((sum, row) => sum + row.tickets_count, 0)} tickets
                </p>
              </div>
            </CardContent>
          </Card>

          {safeDuplicates.length > 0 && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
              Les dates suivantes seront mises à jour: {safeDuplicates.join(", ")}
            </div>
          )}

          <Card className="bg-white border border-alaska-sage-lt rounded-xl">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm text-alaska-dark">Aperçu — {safePreview.length} jours</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-alaska-muted border-b border-alaska-sage-lt">
                      <th className="text-left pb-2">Date</th>
                      <th className="text-right pb-2">CA</th>
                      <th className="text-right pb-2">Soir %</th>
                      <th className="text-right pb-2">Tickets</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-alaska-sage-lt">
                    {safePreview.slice(0, 10).map((row) => (
                      <tr key={row.date} className="hover:bg-alaska-sage-lt/30">
                        <td className="py-1.5 text-alaska-dark">{row.date}</td>
                        <td className="text-right font-playfair font-medium text-alaska-dark">{formatMAD(row.ca_caisse)}</td>
                        <td className="text-right text-alaska-muted">{row.pct_soir.toFixed(0)}%</td>
                        <td className="text-right text-alaska-muted">{row.tickets_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {safePreview.length > 10 && <p className="text-xs text-alaska-muted text-center pt-2">+ {safePreview.length - 10} jours supplémentaires</p>}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 gap-2 border-alaska-sage-lt hover:bg-alaska-sage-lt"
              onClick={() => setStep("upload")}
            >
              <X size={16} /> Annuler
            </Button>
            <Button className="flex-1 gap-2 bg-alaska-sage hover:bg-alaska-sage/90 text-white" onClick={() => void handleConfirm()}>
              <CheckCircle2 size={16} /> Confirmer l&apos;import
            </Button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <Card className="bg-alaska-sage-lt border border-alaska-sage/30 rounded-xl">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <CheckCircle2 size={48} className="text-alaska-sage mx-auto" />
            <div>
              <h2 className="font-playfair text-xl font-bold text-alaska-dark">Import terminé !</h2>
              <div className="mt-4 space-y-1 text-sm text-alaska-dark">
                <p>✅ {result.days_imported} jours importés</p>
                <p>✅ {result.rows_processed} tickets traités</p>
                <p>✅ CA total : {formatMAD(result.ca_total)}</p>
              </div>
            </div>
            <Button className="bg-alaska-sage hover:bg-alaska-sage/90 text-white" onClick={() => setStep("upload")}>
              Nouvel import
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
