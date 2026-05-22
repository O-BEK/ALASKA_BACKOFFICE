"use client"

import { useCallback, useEffect, useState } from "react"
import { parseClientsPayload } from "@/lib/contracts"
import type { Client } from "@/lib/types"

export function useClients() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/clients")
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`)
      const { clients } = parseClientsPayload(json)
      setClients(clients)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const addClient = async (data: { name: string; address?: string; ice?: string }) => {
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`)
    await load()
  }

  const deleteClient = async (id: string) => {
    const res = await fetch(`/api/clients/${id}`, { method: "DELETE" })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      throw new Error(json.error || `Erreur ${res.status}`)
    }
    setClients((prev) => prev.filter((c) => c.id !== id))
  }

  return { clients, loading, error, addClient, deleteClient, reload: load }
}
