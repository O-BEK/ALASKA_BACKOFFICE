"use client"

import { useCallback, useEffect, useState } from "react"
import { parseCompanyBankAccountsPayload } from "@/lib/contracts"
import type { CompanyBankAccount } from "@/lib/types"

export interface NewCompanyBankAccount {
  label: string
  bank_name: string
  bank_code?: string
  city_code?: string
  account_number: string
  rib_key?: string
  iban: string
}

export function useCompanyBankAccounts() {
  const [bankAccounts, setBankAccounts] = useState<CompanyBankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/company-bank-accounts")
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error || `Erreur ${response.status}`)
      const { bank_accounts } = parseCompanyBankAccountsPayload(json)
      setBankAccounts(bank_accounts)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const addBankAccount = async (data: NewCompanyBankAccount) => {
    const response = await fetch("/api/company-bank-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    const json = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(json.error || `Erreur ${response.status}`)
    await load()
  }

  const deleteBankAccount = async (id: string) => {
    const response = await fetch(`/api/company-bank-accounts/${id}`, { method: "DELETE" })
    if (!response.ok) {
      const json = await response.json().catch(() => ({}))
      throw new Error(json.error || `Erreur ${response.status}`)
    }
    setBankAccounts((previous) => previous.filter((account) => account.id !== id))
  }

  return { bankAccounts, loading, error, addBankAccount, deleteBankAccount, reload: load }
}
