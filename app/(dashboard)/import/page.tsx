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
import { BANK_CLASSIFICATION_LABELS } from "@/lib/bank-classification"
import type { BankExpenseCategory, BankTransaction, BankTransactionClassification, BankTransactionReviewStatus } from "@/lib/bank-parsers/types"

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

const IMPORT_TABS = ["POS", "Relevés"] as const
type ImportTab = typeof IMPORT_TABS[number]
const BANK_CLASSIFICATIONS = Object.keys(BANK_CLASSIFICATION_LABELS) as BankTransactionClassification[]
const BANK_EXPENSE_CATEGORIES: BankExpenseCategory[] = ["MP", "RH", "CHARGES", "AUTRE"]

export default function ImportPage() {
  const [step, setStep] = useState<Step>("upload")
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [fileContent, setFileContent] = useState("")
  const [preview, setPreview] = useState<ParsedDay[]>([])
  const [duplicates, setDuplicates] = useState<string[]>([])
  const [result, setResult] = useState<ImportRecord | null>(null)
  const [history, setHistory] = useState<ImportRecord[]>([])
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [error, setError] = useState("")
  const [importTab, setImportTab] = useState<ImportTab>("POS")

  // Bank statement states
  const [bankFile, setBankFile] = useState<File | null>(null)
  const [bankCode, setBankCode] = useState<"bp" | "cfg">("bp")
  const [bankPreview, setBankPreview] = useState<import("@/lib/bank-parsers/types").ParsedStatement | null>(null)
  const [bankImporting, setBankImporting] = useState(false)
  const [bankCommitting, setBankCommitting] = useState(false)
  const [bankError, setBankError] = useState("")
  const [bankSuccess, setBankSuccess] = useState("")
  const [bankImports, setBankImports] = useState<Array<{ id: string; bank: string; period_start: string; period_end: string; transaction_count: number; imported_at: string }>>([])
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([])
  const [bankReviewLoading, setBankReviewLoading] = useState(false)

  // POS Sync
  const today = new Date().toISOString().slice(0, 10)
  const defaultSyncStart = today.slice(0, 7) + "-01"
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

  useEffect(() => {
    fetch("/api/bank-statements")
      .then(async (r) => r.json())
      .then((data) => setBankImports(data.imports ?? []))
      .catch(() => setBankImports([]))
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

  const fileToBase64 = async (selected: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result ?? ""))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(selected)
    })

  const handleFile = async (selected: File) => {
    if (!selected.name.endsWith(".csv")) {
      setError("Format non supporté. Veuillez importer un fichier .csv")
      return
    }
    setFile(selected)
    setFileContent("")
    setError("")
    try {
      const content = await selected.text()
      const parsed = parseCSV(content)
      setFileContent(content)
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
      body: JSON.stringify({ filename: file.name, content: fileContent, parsed: safePreview, commit: true }),
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

  const handleBankFile = async (file: File) => {
    setBankPreview(null)
    setBankError("")
    setBankSuccess("")
    setBankImporting(true)
    try {
      const form = new FormData()
      form.append("file", file)
      form.append("bank", bankCode)
      const res = await fetch("/api/bank-statements", { method: "POST", body: form })
      const data = await res.json()
      if (!res.ok) {
        setBankError(data.error || "Erreur parsing PDF")
        return
      }
      setBankFile(file)
      setBankPreview(data.preview)
    } catch {
      setBankError("Erreur réseau")
    } finally {
      setBankImporting(false)
    }
  }

  const handleBankCommit = async () => {
    if (!bankPreview || !bankFile || bankCommitting) return
    setBankCommitting(true)
    setBankError("")
    try {
      const file_base64 = await fileToBase64(bankFile)
      const res = await fetch("/api/bank-statements/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statement: bankPreview, filename: bankFile.name, file_base64 }),
      })
      const data = await res.json()
      if (!res.ok) { setBankError(data.error || "Erreur commit"); return }
      setBankSuccess(`${data.count} transactions importées (${data.import.period_start} → ${data.import.period_end})`)
      setBankPreview(null)
      setBankFile(null)
      setBankImports((prev) => [data.import, ...prev])
      await loadBankTransactions(data.import.id)
    } catch {
      setBankError("Erreur réseau")
    } finally {
      setBankCommitting(false)
    }
  }

  const loadBankTransactions = async (importId: string) => {
    setBankReviewLoading(true)
    setBankError("")
    try {
      const res = await fetch(`/api/bank-statements/${importId}`)
      const data = await res.json()
      if (!res.ok) {
        setBankError(data.error || "Impossible de charger les transactions.")
        return
      }
      setBankTransactions(data.transactions ?? [])
    } catch {
      setBankError("Erreur réseau")
    } finally {
      setBankReviewLoading(false)
    }
  }

  const patchBankTransaction = async (
    tx: BankTransaction,
    patch: Partial<Pick<BankTransaction, "classification" | "expense_category" | "matched_label" | "review_status" | "notes">>
  ) => {
    if (!tx.id) return
    const next = {
      classification: patch.classification ?? tx.classification ?? "uncategorized",
      expense_category: patch.expense_category === undefined ? tx.expense_category ?? null : patch.expense_category,
      matched_label: patch.matched_label === undefined ? tx.matched_label ?? null : patch.matched_label,
      review_status: patch.review_status ?? tx.review_status ?? "confirmed",
      notes: patch.notes === undefined ? tx.notes ?? null : patch.notes,
    }
    const res = await fetch(`/api/bank-transactions/${tx.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    })
    const data = await res.json()
    if (!res.ok) {
      setBankError(data.error || "Modification impossible.")
      return
    }
    setBankTransactions((prev) => prev.map((item) => item.id === tx.id ? data.transaction : item))
  }

  const createRuleFromTransaction = async (tx: BankTransaction) => {
    const matched_label = tx.matched_label || tx.label
    const match_text = tx.label.split(/\s+/).slice(0, 3).join(" ")
    const res = await fetch("/api/bank-transaction-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        match_text,
        classification: tx.classification ?? "supplier_payment",
        expense_category: tx.expense_category ?? null,
        matched_label,
      }),
    })
    if (!res.ok) {
      const data = await res.json()
      setBankError(data.error || "Règle impossible à créer.")
      return
    }
    setBankSuccess(`Règle créée pour "${match_text}"`)
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="font-playfair text-2xl font-bold text-alaska-dark">Imports</h1>
        <p className="text-alaska-muted text-sm mt-1">Ventes POS, journal caisse et relevés bancaires</p>
      </div>

      {/* Sélecteur onglets POS / Relevés */}
      <div className="flex bg-white border border-alaska-sage-lt rounded-lg p-1 gap-1">
        {IMPORT_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setImportTab(t)}
            className={cn(
              "flex-1 py-2 rounded-md text-sm font-medium transition",
              importTab === t ? "bg-alaska-sage text-white" : "text-alaska-muted hover:bg-alaska-sage-lt"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {importTab === "POS" && (
      <>

      {step === "upload" && (
        <div className="space-y-4">
          {/* POS Sync */}
          <Card className="bg-white border border-alaska-sage-lt rounded-xl">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm text-alaska-dark">Synchroniser depuis POS</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <label className="text-xs text-alaska-muted block mb-1 text-center sm:text-left">Du</label>
                  <input
                    type="date"
                    value={syncStart}
                    max={syncEnd}
                    onChange={(e) => setSyncStart(e.target.value)}
                    className="w-full border border-alaska-sage-lt rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-alaska-sage"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-alaska-muted block mb-1 text-center sm:text-left">Au</label>
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
                {syncing ? "Synchronisation ventes…" : "Synchroniser ventes POS"}
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
                <div className="overflow-x-auto">
                <table className="w-full min-w-[440px] text-sm">
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
                </div>
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
                          {imp.import_type === "cash_journal_xls" ? "Journal caisse" : "Ventes POS"} · {imp.days_imported}j · {formatMAD(imp.ca_total)}
                          {imp.date_range_start && ` · ${imp.date_range_start.slice(0, 7)}`}
                          {imp.storage_path ? " · source archivée" : ""}
                        </p>
                      </div>
                      <span className="text-xs text-alaska-muted flex-shrink-0">{imp.imported_at.slice(0, 10)}</span>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          )}

          {safeSummary.length === 0 && safeHistory.length === 0 && (
            <Card className="bg-white border border-dashed border-alaska-sage rounded-xl">
              <CardContent className="py-8 text-center space-y-2">
                <p className="font-medium text-alaska-dark">Aucun import en base</p>
                <p className="text-sm text-alaska-muted">Synchronise le POS ou dépose un CSV pour créer le premier historique traçable.</p>
              </CardContent>
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

          <div className="flex flex-col gap-3 sm:flex-row">
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

      </>
      )}

      {importTab === "Relevés" && (
        <div className="space-y-4">
          <Card className="bg-white border border-alaska-sage-lt rounded-xl">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm text-alaska-dark">Uploader un relevé bancaire PDF</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 space-y-3">
              {/* Sélection banque */}
              <div className="flex gap-2">
                {(["bp", "cfg"] as const).map((code) => (
                  <button
                    key={code}
                    onClick={() => {
                      setBankCode(code)
                      setBankPreview(null)
                      setBankFile(null)
                      setBankError("")
                    }}
                    className={cn(
                      "flex-1 py-2 rounded-lg border text-sm font-medium transition",
                      bankCode === code
                        ? "border-alaska-sage bg-alaska-sage-lt text-alaska-sage"
                        : "border-alaska-sage-lt text-alaska-muted hover:bg-alaska-sage-lt"
                    )}
                  >
                    {code === "bp" ? "Banque Populaire" : "CFG Bank"}
                  </button>
                ))}
              </div>

              {/* Zone upload */}
              {!bankPreview && (
                <label className="block w-full cursor-pointer border-2 border-dashed border-alaska-sage-lt rounded-xl p-6 text-center hover:border-alaska-sage transition">
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleBankFile(f) }}
                  />
                  <p className="text-sm text-alaska-muted">
                    {bankImporting ? "Analyse en cours..." : "Déposer le relevé PDF ici ou cliquer pour choisir"}
                  </p>
                  {bankFile && !bankImporting && (
                    <p className="text-xs text-alaska-sage mt-1">{bankFile.name}</p>
                  )}
                </label>
              )}

              {/* Erreur */}
              {bankError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-xl border border-red-200">
                  <AlertCircle size={16} /><span>{bankError}</span>
                </div>
              )}

              {/* Succès */}
              {bankSuccess && (
                <div className="flex items-center gap-2 text-sm text-alaska-sage bg-alaska-sage-lt p-3 rounded-xl">
                  <CheckCircle2 size={16} /><span>{bankSuccess}</span>
                </div>
              )}

              {/* Preview transactions */}
              {bankPreview && (
                <div className="space-y-3">
                  <p className="text-sm text-alaska-dark">
                    <span className="font-semibold">{bankPreview.transactions.length} transactions</span>
                    {" · "}{bankPreview.period_start} → {bankPreview.period_end}
                  </p>
                  <div className="overflow-x-auto rounded-lg border border-alaska-sage-lt">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-alaska-sage-lt">
                          <th className="px-3 py-2 text-left text-alaska-muted">Date</th>
                          <th className="px-3 py-2 text-left text-alaska-muted">Libellé</th>
                          <th className="px-3 py-2 text-right text-alaska-muted">Débit</th>
                          <th className="px-3 py-2 text-right text-alaska-muted">Crédit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bankPreview.transactions.slice(0, 15).map((tx, i) => (
                          <tr key={i} className="border-t border-alaska-sage-lt">
                            <td className="px-3 py-1.5 text-alaska-muted">{tx.date}</td>
                            <td className="px-3 py-1.5 text-alaska-dark max-w-[200px] truncate">{tx.label}</td>
                            <td className="px-3 py-1.5 text-right text-orange-600">{tx.debit > 0 ? formatMAD(tx.debit) : "—"}</td>
                            <td className="px-3 py-1.5 text-right text-alaska-sage">{tx.credit > 0 ? formatMAD(tx.credit) : "—"}</td>
                          </tr>
                        ))}
                        {bankPreview.transactions.length > 15 && (
                          <tr><td colSpan={4} className="px-3 py-2 text-center text-alaska-muted text-xs">+{bankPreview.transactions.length - 15} autres transactions</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 border-alaska-sage-lt" onClick={() => { setBankPreview(null); setBankFile(null) }}>
                      Annuler
                    </Button>
                    <Button
                      className="flex-1 bg-alaska-sage hover:bg-alaska-sage/90 text-white"
                      onClick={() => void handleBankCommit()}
                      disabled={bankCommitting}
                    >
                      {bankCommitting ? "Import en cours..." : `Confirmer (${bankPreview.transactions.length} tx)`}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Historique imports relevés */}
          {bankImports.length > 0 && (
            <Card className="bg-white border border-alaska-sage-lt rounded-xl">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm text-alaska-dark">Historique des relevés importés</CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="space-y-2">
                  {bankImports.map((imp) => (
                    <button
                      key={imp.id}
                      className="w-full flex justify-between items-center text-sm py-1.5 border-b border-alaska-sage-lt last:border-0 text-left hover:bg-alaska-sage-lt/30"
                      onClick={() => void loadBankTransactions(imp.id)}
                    >
                      <span className="text-alaska-dark font-medium">{imp.bank === "bp" ? "Banque Populaire" : "CFG Bank"}</span>
                      <span className="text-alaska-muted text-xs">{imp.period_start} → {imp.period_end}</span>
                      <span className="text-alaska-sage text-xs">{imp.transaction_count} tx</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-white border border-alaska-sage-lt rounded-xl">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm text-alaska-dark">Revue des transactions bancaires</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              {bankReviewLoading ? (
                <p className="text-sm text-alaska-muted">Chargement...</p>
              ) : bankTransactions.length === 0 ? (
                <p className="text-sm text-alaska-muted">Clique sur un import de l&apos;historique pour revoir ses transactions.</p>
              ) : (
                <div className="space-y-2">
                  {bankTransactions.map((tx) => (
                    <div key={tx.id ?? `${tx.date}-${tx.label}`} className="rounded-lg border border-alaska-sage-lt p-3 space-y-2">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-xs text-alaska-muted">{tx.date}</p>
                          <p className="text-sm font-medium text-alaska-dark truncate">{tx.label}</p>
                        </div>
                        <div className="text-sm font-playfair font-bold text-right">
                          {tx.debit > 0 ? <span className="text-orange-600">-{formatMAD(tx.debit)}</span> : <span className="text-alaska-sage">+{formatMAD(tx.credit)}</span>}
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-[1.2fr_0.8fr_1fr]">
                        <select
                          value={tx.classification ?? "uncategorized"}
                          className="border border-alaska-sage-lt rounded-lg px-2 py-1.5 text-xs"
                          onChange={(e) => void patchBankTransaction(tx, {
                            classification: e.target.value as BankTransactionClassification,
                            review_status: e.target.value === "ignore" ? "ignored" : "confirmed",
                          })}
                        >
                          {BANK_CLASSIFICATIONS.map((classification) => (
                            <option key={classification} value={classification}>{BANK_CLASSIFICATION_LABELS[classification]}</option>
                          ))}
                        </select>
                        <select
                          value={tx.expense_category ?? ""}
                          className="border border-alaska-sage-lt rounded-lg px-2 py-1.5 text-xs"
                          onChange={(e) => void patchBankTransaction(tx, {
                            expense_category: e.target.value ? e.target.value as BankExpenseCategory : null,
                            review_status: "confirmed",
                          })}
                        >
                          <option value="">Sans catégorie</option>
                          {BANK_EXPENSE_CATEGORIES.map((category) => (
                            <option key={category} value={category}>{category}</option>
                          ))}
                        </select>
                        <input
                          value={tx.matched_label ?? ""}
                          placeholder="Libellé rapproché"
                          className="border border-alaska-sage-lt rounded-lg px-2 py-1.5 text-xs"
                          onChange={(e) => {
                            const value = e.target.value
                            setBankTransactions((prev) => prev.map((item) => item.id === tx.id ? { ...item, matched_label: value } : item))
                          }}
                          onBlur={(e) => void patchBankTransaction(tx, { matched_label: e.target.value || null, review_status: "confirmed" })}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          className="h-8 bg-alaska-sage hover:bg-alaska-sage/90 text-white text-xs"
                          onClick={() => void patchBankTransaction(tx, { review_status: "confirmed" as BankTransactionReviewStatus })}
                        >
                          Confirmer
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 border-alaska-sage-lt text-xs"
                          onClick={() => void patchBankTransaction(tx, { classification: "ignore", review_status: "ignored", expense_category: null })}
                        >
                          Ignorer
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 border-alaska-sage-lt text-xs"
                          onClick={() => void createRuleFromTransaction(tx)}
                          disabled={!tx.classification || tx.classification === "uncategorized"}
                        >
                          Créer règle
                        </Button>
                        <span className={cn(
                          "ml-auto text-xs self-center",
                          tx.review_status === "confirmed" ? "text-alaska-sage" : tx.review_status === "ignored" ? "text-alaska-muted" : "text-amber-600"
                        )}>
                          {tx.review_status === "confirmed" ? "confirmé" : tx.review_status === "ignored" ? "ignoré" : "à revoir"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
