"use client"

import { useEffect, useState } from "react"
import type { CalendarEvent } from "@/lib/calendar-context"

export function useCalendarEvents(month: string) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!month) return
    setLoading(true)
    fetch(`/api/calendar-events?month=${month}`)
      .then(r => r.json())
      .then(data => { setEvents(data.events || []) })
      .catch(() => { setEvents([]) })
      .finally(() => setLoading(false))
  }, [month])

  return { events, loading }
}
