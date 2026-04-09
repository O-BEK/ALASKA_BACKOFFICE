"use client"

import { useCallback, useEffect, useState } from "react"

export function useCaisseBalance() {
  const [balance, setBalance] = useState(0)
  const [toDeposit, setToDeposit] = useState(0)
  const [since, setSince] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(() => {
    setLoading(true)
    setError(null)
    let active = true
    fetch("/api/caisse/balance")
      .then(async (res) => {
        if (!active) return
        if (!res.ok) {
          setError(`Erreur ${res.status}`)
          return
        }
        const data = await res.json()
        if (!active) return
        setBalance(data.balance ?? 0)
        setToDeposit(data.toDeposit ?? 0)
        setSince(data.since ?? null)
      })
      .catch(() => {
        if (active) setError("Erreur réseau")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const cleanup = refetch()
    return cleanup
  }, [refetch])

  return { balance, toDeposit, since, loading, error, refetch }
}
