"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { parseImportHistoryPayload } from "@/lib/contracts"
import { parseCSV } from "@/lib/csv-parser"
import { formatMAD } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, FileText, RefreshCw, UploadCloud, X, XCircle } from "lucide-react"
import type { ImportRecord } from "@/lib/types"
import { cn } from "@/lib/utils"

type ParsedDay = {
  date: string
  ca_caisse: number
  ca_b2b: number
  ca_soir: number
  pct_soir: number
  tickets_count: number
}

type MonthlySummary = {
  month: string
  days_csv: number
  days_manual: number
  ca_total: number
}

type Step = "upload" | "preview" | "done"

const MONTHS_FR = ["Jan","Fév","Mars","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"]
function monthLabel(m: string) {
  if (!m) return ""
  const [y, mo] = m.split("-")
  return `${MONTHS_FR[parseInt(mo) - 1]} ${y}`
}

export default function ImportPage() {
  const [step, setStep] = useState<Step>("upload")
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ParsedDay[]>([])
  const [duplicates, setDuplicates] = useState<string[]>([])
  const [result, setResult] = useState<ImportRecord | null>(null)
  const [history, setHistory] = useState<ImportRecord[]>([])
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [error, setError] = useState("")

  // POS Sync
  const today = new Date().toISOString().slice(0, 10)
  const twoMonthsAgo = new Date(); twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2)
  const defaultSyncStart = twoMonthsAgo.toISOString().slice(0, 7) + "-01"
  const [syncStart, setSyncStart] = useState(defaultSyncStart)
  const [syncEnd, setSyncEnd] = useState(today)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ days_imported: number; ca_total: number; filename: string } | null>(null)
  const [syncError, setSyncError] = useState("")
  const [journalSyncing, setJournalSyncing] = useState(false)
  const [journalSyncResult, setJournalSyncResult] = useState<{ days_imported: number; cash_sales_total: number; cash_movements_total: number; anomalies: number; filename: string } | null>(null)
  const [journalSyncError, setJournalSyncError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const safePreview = Array.isArray(preview) ? preview : []
  const safeDuplicates = Array.isArray(duplicates) ? duplicates : []
  const safeHistory = Array.isArray(history) ? history : []
  const safeSummary = Array.isArray(monthlySummary) ? monthlySummary : []

  const loadData = () => {
    fetch("/api/import-csv")
      .then(async (response) => parseImportHistoryPayload(await response.json()))
      .then((payload) => {
        setHistory(payload.history)
        setMonthlySummary(payload.monthly_summary)
      })
      .catch(() => {
        setHistory([])
        setMonthlySummary([])
      })
  }

  useEffect(() => { loadData() }, [])

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
    setStep("done")
    loadData()
  }

  const handleSync = useCallback(async () => {
    setSyncing(true)
    setSyncError("")
    setSyncResult(null)
    const res = await fetch("/api/pos-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: syncStart, endDate: syncEnd }),
    })
    const data = await res.json()
    if (!res.ok) {
      setSyncError(data.error || "Erreur synchronisation POS.")
      setSyncing(false)
      return
    }
    setSyncResult(data)
    setSyncing(false)
    loadData()
  }, [syncStart, syncEnd])

  const handleJournalSync = useCallback(async () => {
    setJournalSyncing(true)
    setJournalSyncError("")
    setJournalSyncResult(null)
    const res = await fetch("/api/pos-sync/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: syncStart, endDate: syncEnd }),
    })
    const data = await res.json()
    if (!res.ok) {
      setJournalSyncError(data.error || "Erreur synchronisation journal.")
      setJournalSyncing(false)
      return
    }
    setJournalSyncResult(data)
    setJournalSyncing(false)
    loadData()
  }, [syncStart, syncEnd])

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="font-playfair text-2xl font-bold text-alaska-dark">Imports POS</h1>
        <p className="text-alaska-muted text-sm mt-1">CSV ventes pour le CA global, journal de caisse pour le pilotage cash physique</p>
      </div>

      {step === "upload" && (
        <div className="space-y-4">
          {/* POS Sync */}
          <Card className="bg-white border border-alaska-sage-lt rounded-xl">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm text-alaska-dark">Synchroniser depuis POS</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 space-y-3">
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <label className="text-xs text-alaska-muted block mb-1">Du</label>
                  <input
                    type="date"
                    value={syncStart}
                    max={syncEnd}
                    onChange={(e) => setSyncStart(e.target.value)}
                    className="w-full border border-alaska-sage-lt rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-alaska-sage"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-alaska-muted block mb-1">Au</label>
                  <input
                    type="date"
                    value={syncEnd}
                    min={syncStart}
                    onChange={(e) => setSyncEnd(e.target.value)}
                    className="w-full border border-alaska-sage-lt rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-alaska-sage"
                  />
                </div>
              </div>
              <Button
                className="w-full gap-2 bg-alaska-sage hover:bg-alaska-sage/90 text-white"
                onClick={() => void handleSync()}
                disabled={syncing}
              >
                <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
                {syncing ? "Synchronisation CSV…" : "Synchroniser ventes CSV"}
              </Button>
              <Button
                variant="outline"
                className="w-full gap-2 border-alaska-sage text-alaska-sage hover:bg-alaska-sage-lt"
                onClick={() => void handleJournalSync()}
                disabled={journalSyncing}
              >
                <RefreshCw size={16} className={journalSyncing ? "animate-spin" : ""} />
                {journalSyncing ? "Synchronisation journal…" : "Synchroniser journal caisse"}
              </Button>
              {syncError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-xl border border-red-200">
                  <AlertCircle size={16} /> {syncError}
                </div>
              )}
              {syncResult && (
                <div className="flex items-center gap-2 text-sm text-alaska-sage bg-alaska-sage-lt p-3 rounded-xl">
                  <CheckCircle2 size={16} />
                  <span>
                    {syncResult.days_imported} jours importés · {formatMAD(syncResult.ca_total)}
                  </span>
                </div>
              )}
              {journalSyncError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-xl border border-red-200">
                  <AlertCircle size={16} /> {journalSyncError}
                </div>
              )}
              {journalSyncResult && (
                <div className="flex items-center gap-2 text-sm text-alaska-dark bg-alaska-sage-lt p-3 rounded-xl">
                  <CheckCircle2 size={16} />
                  <span>
                    {journalSyncResult.days_imported} jours journal · cash POS {formatMAD(journalSyncResult.cash_sales_total)} · mouvements {formatMAD(journalSyncResult.cash_movements_total)}
                    {journalSyncResult.anomalies > 0 ? ` · ${journalSyncResult.anomalies} alerte(s)` : ""}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Drop zone */}
          <Card
            className={cn(
              "border-2 border-dashed cursor-pointer rounded-xl transition",
              dragging ? "border-alaska-sage bg-alaska-sage-lt" : "border-alaska-sage-lt hover:border-alaska-sage hover:bg-alaska-sage-lt/40"
            )}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
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

          {/* Données en base par mois */}
          {safeSummary.length > 0 && (
            <Card className="bg-white border border-alaska-sage-lt rounded-xl">
              <CardHeader className="pb-2 pt-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm text-alaska-dark">Données en base</CardTitle>
                  <p className="text-xs text-alaska-muted">Chaque import remplace les jours existants</p>
                </div>
              </CardHeader>
              <CardContent className="pb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-alaska-muted border-b border-alaska-sage-lt">
                      <th className="text-left pb-2">Mois</th>
                      <th className="text-right pb-2">Jours CSV</th>
                      <th className="text-right pb-2">Jours manuels</th>
                      <th className="text-right pb-2">CA total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-alaska-sage-lt">
                    {safeSummary.map((row) => (
                      <tr key={row.month} className="hover:bg-alaska-sage-lt/20">
                        <td className="py-1.5 font-medium text-alaska-dark">{monthLabel(row.month)}</td>
                        <td className="text-right">
                          {row.days_csv > 0 ? (
                            <span className="inline-flex items-center gap-1 text-alaska-sage">
                              <CheckCircle2 size={11} /> {row.days_csv}j
                            </span>
                          ) : (
                            <span className="text-alaska-muted">—</span>
                          )}
                        </td>
                        <td className="text-right text-alaska-muted">
                          {row.days_manual > 0 ? `${row.days_manual}j` : "—"}
                        </td>
                        <td className="text-right font-playfair font-semibold text-alaska-dark">
                          {formatMAD(row.ca_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Historique imports (collapsible) */}
          {safeHistory.length > 0 && (
            <Card className="bg-white border border-alaska-sage-lt rounded-xl">
              <button
                className="w-full text-left"
                onClick={() => setShowHistory((v) => !v)}
              >
                <CardHeader className="pb-2 pt-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm text-alaska-dark">
                      Historique imports ({safeHistory.length})
                    </CardTitle>
                    {showHistory ? <ChevronUp size={14} className="text-alaska-muted" /> : <ChevronDown size={14} className="text-alaska-muted" />}
                  </div>
                </CardHeader>
              </button>
              {showHistory && (
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
                          {imp.import_type === "cash_journal_xls" ? "Journal caisse" : "Ventes CSV"} · {imp.days_imported}j · {formatMAD(imp.ca_total)}
                          {imp.date_range_start && ` · ${imp.date_range_start.slice(0, 7)}`}
                        </p>
                      </div>
                      <span className="text-xs text-alaska-muted flex-shrink-0">{imp.imported_at.slice(0, 10)}</span>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          )}
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
                  {" · CA "}{formatMAD(safePreview.reduce((sum, row) => sum + row.ca_caisse + row.ca_b2b, 0))}
                </p>
              </div>
            </CardContent>
          </Card>

          {safeDuplicates.length > 0 && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="font-medium mb-1">{safeDuplicates.length} date(s) déjà en base — données remplacées :</p>
              <p className="text-xs">{safeDuplicates.slice(0, 10).join(", ")}{safeDuplicates.length > 10 ? ` + ${safeDuplicates.length - 10} autres` : ""}</p>
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
                      <th className="text-right pb-2">Espèces</th>
                      <th className="text-right pb-2">CB</th>
                      <th className="text-right pb-2">Total</th>
                      <th className="text-right pb-2">Tickets</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-alaska-sage-lt">
                    {safePreview.slice(0, 10).map((row) => (
                      <tr key={row.date} className="hover:bg-alaska-sage-lt/30">
                        <td className="py-1.5 text-alaska-dark">{row.date}</td>
                        <td className="text-right text-alaska-muted">{formatMAD(row.ca_caisse)}</td>
                        <td className="text-right text-alaska-muted">{formatMAD(row.ca_b2b)}</td>
                        <td className="text-right font-playfair font-medium text-alaska-dark">{formatMAD(row.ca_caisse + row.ca_b2b)}</td>
                        <td className="text-right text-alaska-muted">{row.tickets_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {safePreview.length > 10 && (
                  <p className="text-xs text-alaska-muted text-center pt-2">+ {safePreview.length - 10} jours supplémentaires</p>
                )}
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
                <p>{result.days_imported} jours importés · {result.rows_processed} tickets</p>
                <p className="font-playfair font-semibold text-lg">{formatMAD(result.ca_total)}</p>
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
