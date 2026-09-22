"use client"

import { useEffect, useRef, useState } from "react"
import { Building2, ChevronDown, ChevronUp, Download, FileText, Landmark, Plus, Trash2, X } from "lucide-react"
import { useInvoices } from "@/lib/hooks/useInvoices"
import { useClients } from "@/lib/hooks/useClients"
import { useCompanyBankAccounts } from "@/lib/hooks/useCompanyBankAccounts"
import { calcInvoiceTotals } from "@/lib/invoice-calculations"
import { formatMAD } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { InvoicePaymentMethod, InvoiceStatus } from "@/lib/types"

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
  const { invoices, loading, error, createInvoice, updateStatus, downloadPdf, deleteInvoice } = useInvoices()
  const { clients, addClient, deleteClient } = useClients()
  const {
    bankAccounts,
    loading: bankAccountsLoading,
    error: bankAccountsError,
    addBankAccount,
    deleteBankAccount,
  } = useCompanyBankAccounts()

  // --- Invoice form ---
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const [clientName, setClientName] = useState("")
  const [clientIce, setClientIce] = useState("")
  const [clientAddress, setClientAddress] = useState("")
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10))
  const [paymentMethod, setPaymentMethod] = useState<InvoicePaymentMethod>("bank_transfer")
  const [bankAccountId, setBankAccountId] = useState("")
  const [notes, setNotes] = useState("")
  const [lines, setLines] = useState<FormLine[]>([emptyLine()])
  const [saveClient, setSaveClient] = useState(false)

  // Autocomplete
  const [suggestions, setSuggestions] = useState<typeof clients>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const clientInputRef = useRef<HTMLInputElement>(null)

  // Delete invoice
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Entreprises section
  const [showClients, setShowClients] = useState(false)
  const [clientForm, setClientForm] = useState({ name: "", address: "", ice: "" })
  const [clientFormError, setClientFormError] = useState<string | null>(null)
  const [savingClient, setSavingClient] = useState(false)
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null)
  const [clientDeleteError, setClientDeleteError] = useState<string | null>(null)

  // Comptes bancaires de la société
  const [showBankAccounts, setShowBankAccounts] = useState(false)
  const [bankAccountForm, setBankAccountForm] = useState({
    label: "",
    bank_name: "",
    bank_code: "",
    city_code: "",
    account_number: "",
    rib_key: "",
    iban: "",
  })
  const [bankAccountFormError, setBankAccountFormError] = useState<string | null>(null)
  const [savingBankAccount, setSavingBankAccount] = useState(false)
  const [deletingBankAccountId, setDeletingBankAccountId] = useState<string | null>(null)

  useEffect(() => {
    if (!bankAccountId && bankAccounts.length > 0) {
      setBankAccountId(bankAccounts[0].id)
    }
  }, [bankAccountId, bankAccounts])

  // --- Autocomplete helpers ---
  const handleClientNameChange = (value: string) => {
    setClientName(value)
    setSaveClient(false)
    if (value.trim().length === 0) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    const filtered = clients.filter((c) =>
      c.name.toLowerCase().includes(value.toLowerCase())
    )
    setSuggestions(filtered)
    setShowSuggestions(filtered.length > 0)
  }

  const selectSuggestion = (client: typeof clients[number]) => {
    setClientName(client.name)
    setClientIce(client.ice ?? "")
    setClientAddress(client.address ?? "")
    setSuggestions([])
    setShowSuggestions(false)
  }

  const isNewClient =
    clientName.trim().length > 0 &&
    !clients.some((c) => c.name.toLowerCase() === clientName.trim().toLowerCase())

  // --- Invoice form ---
  const resetForm = () => {
    setClientName("")
    setClientIce("")
    setClientAddress("")
    setNotes("")
    setInvoiceDate(new Date().toISOString().slice(0, 10))
    setPaymentMethod("bank_transfer")
    setBankAccountId(bankAccounts[0]?.id ?? "")
    setLines([emptyLine()])
    setFormError(null)
    setSaveClient(false)
    setShowSuggestions(false)
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
    if (paymentMethod === "bank_transfer" && !bankAccountId) {
      setFormError("Sélectionnez ou ajoutez un compte bancaire pour le virement.")
      return
    }
    setSubmitting(true)
    try {
      await createInvoice({
        client_name: clientName.trim(),
        client_rc: clientIce.trim() || undefined,
        client_address: clientAddress.trim() || undefined,
        invoice_date: invoiceDate,
        payment_method: paymentMethod,
        bank_account_id: paymentMethod === "bank_transfer" ? bankAccountId : null,
        notes: notes.trim() || undefined,
        lines: validLines,
      })
      if (saveClient && isNewClient) {
        await addClient({
          name: clientName.trim(),
          address: clientAddress.trim() || undefined,
          ice: clientIce.trim() || undefined,
        })
      }
      resetForm()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur lors de la création")
    } finally {
      setSubmitting(false)
    }
  }

  // --- Download ---
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

  // --- Delete invoice ---
  const handleDeleteInvoice = async (id: string) => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteInvoice(id)
      setConfirmDeleteId(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Erreur lors de la suppression")
      setConfirmDeleteId(null)
    } finally {
      setDeleting(false)
    }
  }

  // --- Client form ---
  const handleAddClient = async () => {
    setClientFormError(null)
    if (!clientForm.name.trim()) {
      setClientFormError("Le nom est requis.")
      return
    }
    setSavingClient(true)
    try {
      await addClient({
        name: clientForm.name.trim(),
        address: clientForm.address.trim() || undefined,
        ice: clientForm.ice.trim() || undefined,
      })
      setClientForm({ name: "", address: "", ice: "" })
    } catch (err) {
      setClientFormError(err instanceof Error ? err.message : "Erreur")
    } finally {
      setSavingClient(false)
    }
  }

  const handleDeleteClient = async (id: string) => {
    setDeletingClientId(id)
    setClientDeleteError(null)
    try {
      await deleteClient(id)
    } catch (err) {
      setClientDeleteError(err instanceof Error ? err.message : "Erreur lors de la suppression")
    } finally {
      setDeletingClientId(null)
    }
  }

  const handleAddBankAccount = async () => {
    setBankAccountFormError(null)
    if (
      !bankAccountForm.label.trim() ||
      !bankAccountForm.bank_name.trim() ||
      !bankAccountForm.account_number.trim() ||
      !bankAccountForm.iban.trim()
    ) {
      setBankAccountFormError("Libellé, banque, numéro de compte et IBAN/RIB sont requis.")
      return
    }

    setSavingBankAccount(true)
    try {
      await addBankAccount({
        label: bankAccountForm.label.trim(),
        bank_name: bankAccountForm.bank_name.trim(),
        bank_code: bankAccountForm.bank_code.trim() || undefined,
        city_code: bankAccountForm.city_code.trim() || undefined,
        account_number: bankAccountForm.account_number.trim(),
        rib_key: bankAccountForm.rib_key.trim() || undefined,
        iban: bankAccountForm.iban.trim(),
      })
      setBankAccountForm({
        label: "",
        bank_name: "",
        bank_code: "",
        city_code: "",
        account_number: "",
        rib_key: "",
        iban: "",
      })
    } catch (err) {
      setBankAccountFormError(err instanceof Error ? err.message : "Erreur lors de l'ajout")
    } finally {
      setSavingBankAccount(false)
    }
  }

  const handleDeleteBankAccount = async (id: string) => {
    setDeletingBankAccountId(id)
    setBankAccountFormError(null)
    try {
      await deleteBankAccount(id)
      setBankAccountId((current) => (current === id ? "" : current))
    } catch (err) {
      setBankAccountFormError(err instanceof Error ? err.message : "Erreur lors de la suppression")
    } finally {
      setDeletingBankAccountId(null)
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
              {/* Autocomplete client name */}
              <div className="space-y-1 relative">
                <label htmlFor="client-name" className="text-xs font-medium text-alaska-muted">
                  Entreprise cliente *
                </label>
                <Input
                  id="client-name"
                  ref={clientInputRef}
                  value={clientName}
                  onChange={(e) => handleClientNameChange(e.target.value)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  placeholder="Nom de l'entreprise"
                  autoComplete="off"
                />
                {showSuggestions && (
                  <ul className="absolute z-20 left-0 right-0 bg-white border border-gray-200 rounded-md shadow-md mt-0.5 max-h-48 overflow-y-auto">
                    {suggestions.map((c) => (
                      <li
                        key={c.id}
                        onMouseDown={() => selectSuggestion(c)}
                        className="px-3 py-2 cursor-pointer hover:bg-alaska-cream text-sm"
                      >
                        <div className="font-medium">{c.name}</div>
                        {c.ice && <div className="text-xs text-alaska-muted">ICE : {c.ice}</div>}
                      </li>
                    ))}
                  </ul>
                )}
                {isNewClient && (
                  <label className="flex items-center gap-2 text-xs text-alaska-muted mt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveClient}
                      onChange={(e) => setSaveClient(e.target.checked)}
                      className="rounded"
                    />
                    Enregistrer cette entreprise dans le carnet
                  </label>
                )}
              </div>

              <div className="space-y-1">
                <label htmlFor="client-ice" className="text-xs font-medium text-alaska-muted">ICE</label>
                <Input
                  id="client-ice"
                  value={clientIce}
                  onChange={(e) => setClientIce(e.target.value)}
                  placeholder="Identifiant commun de l'entreprise"
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

            {/* Mode de paiement */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-alaska-muted">Mode de paiement</label>
              <div className="inline-flex rounded-md border border-gray-200 bg-white p-1" role="group" aria-label="Mode de paiement">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("bank_transfer")}
                  className={`px-3 py-1.5 text-sm rounded transition ${
                    paymentMethod === "bank_transfer"
                      ? "bg-alaska-dark text-white"
                      : "text-alaska-muted hover:text-alaska-dark"
                  }`}
                >
                  Virement bancaire
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("cheque")}
                  className={`px-3 py-1.5 text-sm rounded transition ${
                    paymentMethod === "cheque"
                      ? "bg-alaska-dark text-white"
                      : "text-alaska-muted hover:text-alaska-dark"
                  }`}
                >
                  Chèque
                </button>
              </div>

              {paymentMethod === "bank_transfer" && (
                <div className="max-w-md space-y-1">
                  <label htmlFor="invoice-bank-account" className="text-xs font-medium text-alaska-muted">
                    Compte à afficher sur la facture
                  </label>
                  <select
                    id="invoice-bank-account"
                    value={bankAccountId}
                    onChange={(event) => setBankAccountId(event.target.value)}
                    disabled={bankAccountsLoading || bankAccounts.length === 0}
                    className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-alaska-dark disabled:bg-gray-50 disabled:text-alaska-muted"
                  >
                    {bankAccounts.length === 0 ? (
                      <option value="">Aucun compte enregistré</option>
                    ) : (
                      bankAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.label} — {account.bank_name}
                        </option>
                      ))
                    )}
                  </select>
                  {bankAccountsError && <p className="text-xs text-red-500">{bankAccountsError}</p>}
                  {!bankAccountsLoading && bankAccounts.length === 0 && (
                    <p className="text-xs text-alaska-muted">
                      Ajoutez d&apos;abord un compte dans la section Comptes bancaires ci-dessous.
                    </p>
                  )}
                </div>
              )}
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
              <Button
                onClick={handleSubmit}
                disabled={submitting || (paymentMethod === "bank_transfer" && !bankAccountId)}
              >
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
          {deleteError && <p className="text-red-500 text-sm mb-2">{deleteError}</p>}
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
                    <th className="pb-2 font-medium text-alaska-muted hidden md:table-cell">Date</th>
                    <th className="pb-2 font-medium text-alaska-muted text-right">Total TTC</th>
                    <th className="pb-2 font-medium text-alaska-muted">Statut</th>
                    <th className="pb-2 font-medium text-alaska-muted text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoices.map((inv) => {
                    const s = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.draft
                    const isConfirming = confirmDeleteId === inv.id
                    return (
                      <tr key={inv.id} className="hover:bg-alaska-cream/40 transition">
                        <td className="py-3 font-mono text-xs text-alaska-muted">
                          {inv.invoice_number}
                        </td>
                        <td className="py-3">
                          <div className="font-medium">{inv.client_name}</div>
                          {inv.client_rc && (
                            <div className="text-xs text-alaska-muted">ICE : {inv.client_rc}</div>
                          )}
                          <div className="text-xs text-alaska-muted mt-0.5">
                            {inv.payment_method === "cheque" ? "Chèque" : "Virement bancaire"}
                          </div>
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
                        <td className="py-3">
                          <div className="flex items-center justify-end gap-3">
                            <button
                              onClick={() => handleDownload(inv.id, inv.invoice_number)}
                              disabled={downloading === inv.id}
                              className="inline-flex items-center gap-1 text-alaska-sage hover:text-alaska-dark text-xs transition disabled:opacity-50"
                              aria-label={`Télécharger PDF de la facture ${inv.invoice_number}`}
                            >
                              <Download size={14} />
                              {downloading === inv.id ? "..." : "PDF"}
                            </button>
                            {inv.status === "draft" && !isConfirming && (
                              <button
                                onClick={() => setConfirmDeleteId(inv.id)}
                                className="text-gray-400 hover:text-red-500 transition"
                                aria-label={`Supprimer la facture ${inv.invoice_number}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                            {inv.status === "draft" && isConfirming && (
                              <div className="flex items-center gap-1.5 text-xs">
                                <button
                                  onClick={() => handleDeleteInvoice(inv.id)}
                                  disabled={deleting}
                                  className="text-red-600 font-medium hover:underline disabled:opacity-50"
                                >
                                  {deleting ? "..." : "Oui"}
                                </button>
                                <span className="text-alaska-muted">/</span>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="text-alaska-muted hover:text-alaska-dark"
                                >
                                  Non
                                </button>
                              </div>
                            )}
                          </div>
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

      {/* Section Entreprises */}
      <Card>
        <CardHeader>
          <button
            className="w-full flex items-center justify-between text-left"
            onClick={() => setShowClients((v) => !v)}
          >
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 size={16} />
              Entreprises enregistrées
              <span className="text-alaska-muted font-normal text-sm">({clients.length})</span>
            </CardTitle>
            {showClients ? <ChevronUp size={16} className="text-alaska-muted" /> : <ChevronDown size={16} className="text-alaska-muted" />}
          </button>
        </CardHeader>
        {showClients && (
          <CardContent className="space-y-4">
            {/* Formulaire ajout */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input
                value={clientForm.name}
                onChange={(e) => setClientForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nom de l'entreprise *"
              />
              <Input
                value={clientForm.ice}
                onChange={(e) => setClientForm((f) => ({ ...f, ice: e.target.value }))}
                placeholder="ICE"
              />
              <Input
                value={clientForm.address}
                onChange={(e) => setClientForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Adresse"
              />
            </div>
            {clientFormError && <p className="text-red-500 text-xs">{clientFormError}</p>}
            {clientDeleteError && <p className="text-red-500 text-xs">{clientDeleteError}</p>}
            <Button size="sm" variant="outline" onClick={handleAddClient} disabled={savingClient} className="gap-1">
              <Plus size={14} /> {savingClient ? "Enregistrement..." : "Ajouter"}
            </Button>

            {/* Liste */}
            {clients.length === 0 && (
              <p className="text-alaska-muted text-sm text-center py-4">Aucune entreprise enregistrée.</p>
            )}
            {clients.length > 0 && (
              <div className="divide-y border rounded-lg overflow-hidden">
                {clients.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-alaska-cream/30">
                    <div>
                      <div className="font-medium text-sm">{c.name}</div>
                      <div className="text-xs text-alaska-muted space-x-3">
                        {c.ice && <span>ICE : {c.ice}</span>}
                        {c.address && <span>{c.address}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteClient(c.id)}
                      disabled={deletingClientId === c.id}
                      className="text-gray-400 hover:text-red-500 transition disabled:opacity-40 ml-4"
                      aria-label={`Supprimer ${c.name}`}
                    >
                      {deletingClientId === c.id ? <X size={14} /> : <Trash2 size={14} />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Section Comptes bancaires */}
      <Card>
        <CardHeader>
          <button
            className="w-full flex items-center justify-between text-left"
            onClick={() => setShowBankAccounts((visible) => !visible)}
          >
            <CardTitle className="text-base flex items-center gap-2">
              <Landmark size={16} />
              Comptes bancaires
              <span className="text-alaska-muted font-normal text-sm">({bankAccounts.length})</span>
            </CardTitle>
            {showBankAccounts ? (
              <ChevronUp size={16} className="text-alaska-muted" />
            ) : (
              <ChevronDown size={16} className="text-alaska-muted" />
            )}
          </button>
        </CardHeader>
        {showBankAccounts && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label htmlFor="bank-label" className="text-xs font-medium text-alaska-muted">Libellé *</label>
                <Input
                  id="bank-label"
                  value={bankAccountForm.label}
                  onChange={(event) => setBankAccountForm((form) => ({ ...form, label: event.target.value }))}
                  placeholder="Compte principal BP"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="bank-name" className="text-xs font-medium text-alaska-muted">Banque *</label>
                <Input
                  id="bank-name"
                  value={bankAccountForm.bank_name}
                  onChange={(event) => setBankAccountForm((form) => ({ ...form, bank_name: event.target.value }))}
                  placeholder="Banque Populaire"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="bank-code" className="text-xs font-medium text-alaska-muted">Code banque</label>
                <Input
                  id="bank-code"
                  value={bankAccountForm.bank_code}
                  onChange={(event) => setBankAccountForm((form) => ({ ...form, bank_code: event.target.value }))}
                  placeholder="3 chiffres"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="bank-city-code" className="text-xs font-medium text-alaska-muted">Code ville / agence</label>
                <Input
                  id="bank-city-code"
                  value={bankAccountForm.city_code}
                  onChange={(event) => setBankAccountForm((form) => ({ ...form, city_code: event.target.value }))}
                  placeholder="3 chiffres"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label htmlFor="bank-account-number" className="text-xs font-medium text-alaska-muted">N° de compte *</label>
                <Input
                  id="bank-account-number"
                  value={bankAccountForm.account_number}
                  onChange={(event) => setBankAccountForm((form) => ({ ...form, account_number: event.target.value }))}
                  placeholder="Numéro de compte"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="bank-rib-key" className="text-xs font-medium text-alaska-muted">Clé RIB</label>
                <Input
                  id="bank-rib-key"
                  value={bankAccountForm.rib_key}
                  onChange={(event) => setBankAccountForm((form) => ({ ...form, rib_key: event.target.value }))}
                  placeholder="2 chiffres"
                />
              </div>
              <div className="space-y-1 md:col-span-2 lg:col-span-1">
                <label htmlFor="bank-iban" className="text-xs font-medium text-alaska-muted">IBAN / RIB complet *</label>
                <Input
                  id="bank-iban"
                  value={bankAccountForm.iban}
                  onChange={(event) => setBankAccountForm((form) => ({ ...form, iban: event.target.value }))}
                  placeholder="IBAN ou RIB complet"
                />
              </div>
            </div>

            {(bankAccountFormError || bankAccountsError) && (
              <p className="text-red-500 text-xs">{bankAccountFormError || bankAccountsError}</p>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleAddBankAccount}
              disabled={savingBankAccount}
              className="gap-1"
            >
              <Plus size={14} /> {savingBankAccount ? "Enregistrement..." : "Ajouter le compte"}
            </Button>

            {bankAccountsLoading && <p className="text-sm text-alaska-muted">Chargement...</p>}
            {!bankAccountsLoading && bankAccounts.length === 0 && (
              <p className="text-alaska-muted text-sm text-center py-4">Aucun compte bancaire enregistré.</p>
            )}
            {bankAccounts.length > 0 && (
              <div className="divide-y border rounded-lg overflow-hidden">
                {bankAccounts.map((account) => (
                  <div key={account.id} className="flex items-center justify-between gap-4 px-3 py-3 hover:bg-alaska-cream/30">
                    <div className="min-w-0">
                      <div className="font-medium text-sm">
                        {account.label} <span className="font-normal text-alaska-muted">· {account.bank_name}</span>
                      </div>
                      <div className="text-xs text-alaska-muted break-all">
                        {account.iban}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteBankAccount(account.id)}
                      disabled={deletingBankAccountId === account.id}
                      className="shrink-0 text-gray-400 hover:text-red-500 transition disabled:opacity-40"
                      aria-label={`Supprimer ${account.label}`}
                      title="Supprimer le compte"
                    >
                      {deletingBankAccountId === account.id ? <X size={14} /> : <Trash2 size={14} />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  )
}
