"use client"

import { useCallback, useEffect, useState } from "react"

export function useCaisseBalance() {
  const [balance, setBalance] = useState(0)
  const [toDeposit, setToDeposit] = useState(0)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(() => {
    setLoading(true)
    fetch("/api/caisse/balance")
      .then(async (res) => {
        if (!res.ok) return
        const data = await res.json()
        setBalance(data.balance ?? 0)
        setToDeposit(data.toDeposit ?? 0)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { balance, toDeposit, loading, refetch }
}
