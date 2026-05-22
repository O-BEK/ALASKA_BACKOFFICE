"use client"

import { useState } from "react"
import { Download, FileText, Plus, Trash2 } from "lucide-react"
import { useInvoices } from "@/lib/hooks/useInvoices"
import { calcInvoiceTotals } from "@/lib/invoice-calculations"
import { formatMAD } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { InvoiceStatus } from "@/lib/types"

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; className: string }> = {
  draft: { label: "Brouillon", className: "bg-gray-100 text-gray-600" },
  sent: { label: "Envoyée", className: "bg-blue-100 text-blue-700" },
  paid: { label: "Payée", className: "bg-green-100 text-green-700" },
}

interface FormLine {
  id: number
  description: string
  quantity: string
  unit_price_ht: string
}

let lineCounter = 0
const emptyLine = (): FormLine => ({ id: lineCounter++, description: "", quantity: "1", unit_price_ht: "" })

export default function FacturesPage() {
  const { invoices, loading, error, createInvoice, updateStatus, downloadPdf } = useInvoices()

  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const [clientName, setClientName] = useState("")
  const [clientRc, setClientRc] = useState("")
  const [clientAddress, setClientAddress] = useState("")
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState("")
  const [lines, setLines] = useState<FormLine[]>([emptyLine()])

  const resetForm = () => {
    setClientName("")
    setClientRc("")
    setClientAddress("")
    setNotes("")
    setInvoiceDate(new Date().toISOString().slice(0, 10))
    setLines([emptyLine()])
    setFormError(null)
    setShowForm(false)
  }

  const parsedLines = lines.map((l, i) => ({
    description: l.description,
    quantity: parseFloat(l.quantity) || 0,
    unit_price_ht: parseFloat(l.unit_price_ht) || 0,
    tva_rate: 10,
    line_order: i,
  }))

  const totals = calcInvoiceTotals(parsedLines)

  const handleLineChange = (i: number, field: "description" | "quantity" | "unit_price_ht", value: string) => {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)))
  }

  const handleSubmit = async () => {
    setFormError(null)
    if (!clientName.trim()) {
      setFormError("Le nom du client est requis.")
      return
    }
    const validLines = parsedLines.filter((l) => l.description.trim() && l.quantity > 0)
    if (validLines.length === 0) {
      setFormError("Ajoutez au moins une ligne avec une désignation et une quantité.")
      return
    }
    setSubmitting(true)
    try {
      await createInvoice({
        client_name: clientName.trim(),
        client_rc: clientRc.trim() || undefined,
        client_address: clientAddress.trim() || undefined,
        invoice_date: invoiceDate,
        notes: notes.trim() || undefined,
        lines: validLines,
      })
      resetForm()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur lors de la création")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDownload = async (id: string, invoiceNumber: string) => {
    setDownloading(id)
    setDownloadError(null)
    try {
      await downloadPdf(id, invoiceNumber)
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Erreur lors du téléchargement PDF")
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-alaska-dark">Factures</h1>
          <p className="text-sm text-alaska-muted mt-1">
            Émission de factures B2B avec TVA 10% (Maroc)
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus size={16} /> Nouvelle facture
          </Button>
        )}
      </div>

      {/* Formulaire de création */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nouvelle facture</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Infos client */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="client-name" className="text-xs font-medium text-alaska-muted">
                  Entreprise cliente *
                </label>
                <Input
                  id="client-name"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Nom de l'entreprise"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="client-rc" className="text-xs font-medium text-alaska-muted">RC</label>
                <Input
                  id="client-rc"
                  value={clientRc}
                  onChange={(e) => setClientRc(e.target.value)}
                  placeholder="Registre de commerce"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="client-address" className="text-xs font-medium text-alaska-muted">Adresse</label>
                <Input
                  id="client-address"
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  placeholder="Adresse (optionnel)"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="invoice-date" className="text-xs font-medium text-alaska-muted">Date de facture</label>
                <Input
                  id="invoice-date"
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                />
              </div>
            </div>

            {/* Lignes de prestation */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-alaska-muted">Prestations</label>
              <div className="hidden md:grid grid-cols-12 gap-2 text-xs text-alaska-muted px-1">
                <span className="col-span-5">Désignation</span>
                <span className="col-span-2 text-right">Quantité</span>
                <span className="col-span-3 text-right">PU HT (MAD)</span>
                <span className="col-span-1 text-right">Total HT</span>
                <span className="col-span-1" />
              </div>
              {lines.map((line, i) => (
                <div key={line.id} className="grid grid-cols-12 gap-2 items-center">
                  <Input
                    className="col-span-5"
                    value={line.description}
                    onChange={(e) => handleLineChange(i, "description", e.target.value)}
                    placeholder="Désignation de la prestation"
                  />
                  <Input
                    className="col-span-2 text-right"
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.quantity}
                    onChange={(e) => handleLineChange(i, "quantity", e.target.value)}
                  />
                  <Input
                    className="col-span-3 text-right"
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unit_price_ht}
                    onChange={(e) => handleLineChange(i, "unit_price_ht", e.target.value)}
                    placeholder="0.00"
                  />
                  <div className="col-span-1 text-right text-sm font-medium text-alaska-dark">
                    {formatMAD(
                      (parseFloat(line.quantity) || 0) * (parseFloat(line.unit_price_ht) || 0)
                    )}
                  </div>
                  <div className="col-span-1 flex justify-center">
                    {lines.length > 1 && (
                      <button
                        onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-red-400 hover:text-red-600 transition"
                        aria-label="Supprimer la ligne"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLines((prev) => [...prev, emptyLine()])}
                className="gap-1"
              >
                <Plus size={14} /> Ajouter une ligne
              </Button>
            </div>

            {/* Récapitulatif live */}
            <div className="bg-alaska-cream rounded-lg p-4 text-sm space-y-1.5">
              <div className="flex justify-between text-alaska-muted">
                <span>Total HT</span>
                <span>{formatMAD(totals.total_ht)}</span>
              </div>
              <div className="flex justify-between text-alaska-muted">
                <span>TVA 10%</span>
                <span>{formatMAD(totals.tva_amount)}</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t border-alaska-dark/10 pt-2">
                <span>Total TTC</span>
                <span>{formatMAD(totals.total_ttc)}</span>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label htmlFor="invoice-notes" className="text-xs font-medium text-alaska-muted">Notes (optionnel)</label>
              <Input
                id="invoice-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observations, conditions particulières..."
              />
            </div>

            {formError && <p className="text-red-500 text-sm">{formError}</p>}

            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Enregistrement..." : "Enregistrer la facture"}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Liste des factures */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText size={16} />
            Factures émises{" "}
            {!loading && <span className="text-alaska-muted font-normal">({invoices.length})</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <p className="text-alaska-muted text-sm py-4">Chargement...</p>}
          {error && <p className="text-red-500 text-sm">{error}</p>}
          {downloadError && <p className="text-red-500 text-sm mb-2">{downloadError}</p>}
          {!loading && !error && invoices.length === 0 && (
            <p className="text-alaska-muted text-sm text-center py-10">
              Aucune facture. Cliquez sur &quot;Nouvelle facture&quot; pour commencer.
            </p>
          )}
          {invoices.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium text-alaska-muted">N°</th>
                    <th className="pb-2 font-medium text-alaska-muted">Client</th>
                    <th className="pb-2 font-medium text-alaska-muted hidden md:table-cell">
                      Date
                    </th>
                    <th className="pb-2 font-medium text-alaska-muted text-right">Total TTC</th>
                    <th className="pb-2 font-medium text-alaska-muted">Statut</th>
                    <th className="pb-2 font-medium text-alaska-muted text-right">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoices.map((inv) => {
                    const s = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.draft
                    return (
                      <tr key={inv.id} className="hover:bg-alaska-cream/40 transition">
                        <td className="py-3 font-mono text-xs text-alaska-muted">
                          {inv.invoice_number}
                        </td>
                        <td className="py-3">
                          <div className="font-medium">{inv.client_name}</div>
                          {inv.client_rc && (
                            <div className="text-xs text-alaska-muted">RC: {inv.client_rc}</div>
                          )}
                        </td>
                        <td className="py-3 hidden md:table-cell text-alaska-muted">
                          {inv.invoice_date}
                        </td>
                        <td className="py-3 text-right font-medium">
                          {formatMAD(inv.total_ttc)}
                        </td>
                        <td className="py-3">
                          <select
                            value={inv.status}
                            onChange={(e) =>
                              updateStatus(inv.id, e.target.value as InvoiceStatus)
                            }
                            className={`text-xs px-2 py-1 rounded-full border-0 cursor-pointer font-medium ${s.className}`}
                          >
                            {(Object.keys(STATUS_CONFIG) as InvoiceStatus[]).map((st) => (
                              <option key={st} value={st}>{STATUS_CONFIG[st].label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => handleDownload(inv.id, inv.invoice_number)}
                            disabled={downloading === inv.id}
                            className="inline-flex items-center gap-1 text-alaska-sage hover:text-alaska-dark text-xs transition disabled:opacity-50"
                            aria-label={`Télécharger PDF de la facture ${inv.invoice_number}`}
                          >
                            <Download size={14} />
                            {downloading === inv.id ? "..." : "PDF"}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
