"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { UserRole } from "@/lib/types"

export function useUserRole() {
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const supabase = createClient()

    const loadRole = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!active) return

        if (!user) {
          setRole(null)
          return
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single()

        if (!active) return
        setRole((profile?.role || "manager") as UserRole)
      } catch {
        if (active) setRole("manager")
      } finally {
        if (active) setLoading(false)
      }
    }

    loadRole()

    return () => {
      active = false
    }
  }, [])

  return { role, loading }
}
