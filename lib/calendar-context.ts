export type CalendarEventType = 'school_holiday' | 'public_holiday' | 'religious' | 'closure' | 'high_traffic'
export type CalendarImpact = 'closed' | 'reduced' | 'boost'

export interface CalendarEvent {
  id: string
  date_start: string  // YYYY-MM-DD
  date_end: string    // YYYY-MM-DD
  type: CalendarEventType
  name: string
  impact: CalendarImpact
  notes: string | null
  editable: boolean
}

export interface CalendarAnnotation {
  type: 'warning' | 'info' | 'boost' | 'correction'
  icon: string
  label: string
  detail: string
  ca_adjusted?: number
  vs_n1_note?: string
}

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function getEventsForPeriod(
  dateStart: Date,
  dateEnd: Date,
  events: CalendarEvent[]
): CalendarEvent[] {
  return events.filter(e => {
    const s = parseLocalDate(e.date_start)
    const end = parseLocalDate(e.date_end)
    return s <= dateEnd && end >= dateStart
  })
}

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function getClosedDays(
  dateStart: Date,
  dateEnd: Date,
  events: CalendarEvent[]
): number {
  const closedEvents = events.filter(e => e.impact === 'closed')
  let count = 0
  const current = new Date(dateStart)
  while (current <= dateEnd) {
    const dayStr = toLocalDateStr(current)
    const isClosed = closedEvents.some(e => dayStr >= e.date_start && dayStr <= e.date_end)
    if (isClosed) count++
    current.setDate(current.getDate() + 1)
  }
  return count
}

export function getCaAdjusted(
  caTotal: number,
  daysOpen: number,
  daysInPeriod: number
): number {
  if (daysOpen <= 0 || daysOpen >= daysInPeriod) return caTotal
  return Math.round((caTotal / daysOpen) * daysInPeriod)
}

export function getAnnotationsForPeriod(
  dateStart: Date,
  dateEnd: Date,
  events: CalendarEvent[],
  caTotal: number
): CalendarAnnotation[] {
  const relevantEvents = getEventsForPeriod(dateStart, dateEnd, events)
  if (relevantEvents.length === 0) return []

  const daysInPeriod = Math.round((dateEnd.getTime() - dateStart.getTime()) / 86400000) + 1
  const annotations: CalendarAnnotation[] = []

  for (const event of relevantEvents) {
    if (event.impact === 'closed') {
      const eventStart = parseLocalDate(event.date_start)
      const eventEnd = parseLocalDate(event.date_end)
      const overlapStart = new Date(Math.max(dateStart.getTime(), eventStart.getTime()))
      const overlapEnd = new Date(Math.min(dateEnd.getTime(), eventEnd.getTime()))
      const closedInPeriod = getClosedDays(overlapStart, overlapEnd, [event])
      const daysOpen = daysInPeriod - closedInPeriod
      annotations.push({
        type: 'warning',
        icon: '📅',
        label: event.name,
        detail: `${closedInPeriod} jour${closedInPeriod > 1 ? 's' : ''} de fermeture inclus`,
        ca_adjusted: getCaAdjusted(caTotal, daysOpen, daysInPeriod),
      })
    } else if (event.impact === 'reduced') {
      annotations.push({
        type: 'info',
        icon: event.type === 'religious' ? '🌙' : 'ℹ️',
        label: event.name,
        detail: event.notes || 'Impact sur le CA attendu',
      })
    } else if (event.impact === 'boost') {
      annotations.push({
        type: 'boost',
        icon: event.type === 'school_holiday' ? '🏫' : '🎉',
        label: event.name,
        detail: event.notes || 'Période haute fréquentation',
      })
    }
  }

  return annotations
}

export function isN1ComparisonValid(
  period: { start: Date; end: Date },
  periodN1: { start: Date; end: Date },
  events: CalendarEvent[]
): { valid: boolean; note?: string } {
  const currentReligious = getEventsForPeriod(period.start, period.end, events)
    .filter(e => e.type === 'religious' && e.impact === 'closed')
    .map(e => e.name)

  const n1Religious = getEventsForPeriod(periodN1.start, periodN1.end, events)
    .filter(e => e.type === 'religious' && e.impact === 'closed')
    .map(e => e.name)

  const currentNames = new Set(currentReligious)
  const n1Names = new Set(n1Religious)

  const inCurrentNotN1 = currentReligious.filter(n => !n1Names.has(n))
  const inN1NotCurrent = n1Religious.filter(n => !currentNames.has(n))
  const shifted = [...inCurrentNotN1, ...inN1NotCurrent]

  if (shifted.length > 0) {
    return {
      valid: false,
      note: `Comparaison N-1 décalée — ${Array.from(new Set(shifted)).join(', ')} tombait à une autre période en N-1`,
    }
  }

  return { valid: true }
}
