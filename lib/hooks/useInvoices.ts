"use client"

import { useCallback, useEffect, useState } from "react"
import { parseInvoicesPayload } from "@/lib/contracts"
import type { InvoiceStatus, InvoiceWithTotals } from "@/lib/types"

export function useInvoices() {
  const [invoices, setInvoices] = useState<InvoiceWithTotals[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/invoices")
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error || `Erreur ${response.status}`)
      const { invoices } = parseInvoicesPayload(json)
      setInvoices(invoices)
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
    client_name: string
    client_rc?: string
    client_address?: string
    invoice_date: string
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

  const downloadPdf = async (id: string, invoiceNumber: string) => {
    const response = await fetch(`/api/invoices/${id}/pdf`)
    if (!response.ok) throw new Error("Impossible de générer le PDF")
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${invoiceNumber}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  const deleteInvoice = async (id: string) => {
    const response = await fetch(`/api/invoices/${id}`, { method: "DELETE" })
    if (!response.ok) {
      const json = await response.json().catch(() => ({}))
      throw new Error(json.error || `Erreur ${response.status}`)
    }
    setInvoices((prev) => prev.filter((inv) => inv.id !== id))
  }

  return { invoices, loading, error, createInvoice, updateStatus, downloadPdf, deleteInvoice, reload: load }
}
