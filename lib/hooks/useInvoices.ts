"use client"

import { useCallback, useEffect, useState } from "react"
import { parseInvoicesPayload } from "@/lib/contracts"
import type { InvoicePaymentMethod, InvoiceStatus, InvoiceWithTotals } from "@/lib/types"

export function useInvoices() {
  const [invoices, setInvoices] = useState<InvoiceWithTotals[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState("FAC202531")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/invoices")
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error || `Erreur ${response.status}`)
      const { invoices, next_invoice_number } = parseInvoicesPayload(json)
      setInvoices(invoices)
      setNextInvoiceNumber(next_invoice_number)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const createInvoice = async (data: {
    invoice_number?: string
    client_name: string
    client_rc?: string
    client_address?: string
    invoice_date: string
    payment_method: InvoicePaymentMethod
    bank_account_id?: string | null
    notes?: string
    lines: Array<{
      description: string
      quantity: number
      unit_price_ht: number
      tva_rate: number
      line_order: number
    }>
  }) => {
    const response = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    const json = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(json.error || `Erreur ${response.status}`)
    await load()
  }

  const updateStatus = async (id: string, status: InvoiceStatus) => {
    const response = await fetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    const json = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(json.error || `Erreur ${response.status}`)
    setInvoices((prev) => prev.map((inv) => (inv.id === id ? { ...inv, status } : inv)))
  }

  const downloadPdf = async (id: string, clientName: string, invoiceNumber: string) => {
    const response = await fetch(`/api/invoices/${id}/pdf`)
    if (!response.ok) throw new Error("Impossible de générer le PDF")
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    const safeClientName = clientName
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
      .replace(/\s+/g, " ")
      .replace(/[. ]+$/g, "")
      .trim() || "Client"
    a.href = url
    a.download = `${safeClientName} - ${invoiceNumber}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  const deleteInvoice = async (id: string) => {
    const response = await fetch(`/api/invoices/${id}`, { method: "DELETE" })
    if (!response.ok) {
      const json = await response.json().catch(() => ({}))
      throw new Error(json.error || `Erreur ${response.status}`)
    }
    await load()
  }

  return { invoices, nextInvoiceNumber, loading, error, createInvoice, updateStatus, downloadPdf, deleteInvoice, reload: load }
}
