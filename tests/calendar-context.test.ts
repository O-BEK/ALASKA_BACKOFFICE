import { describe, expect, it } from 'vitest'
import {
  getEventsForPeriod,
  getClosedDays,
  getCaAdjusted,
  getAnnotationsForPeriod,
  isN1ComparisonValid,
  type CalendarEvent,
} from '../lib/calendar-context'

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: '1',
    date_start: '2026-05-01',
    date_end: '2026-05-03',
    type: 'religious',
    name: 'Aïd al-Adha',
    impact: 'closed',
    notes: null,
    editable: true,
    ...overrides,
  }
}

describe('getEventsForPeriod', () => {
  it('returns events that overlap with the period', () => {
    const event = makeEvent({ date_start: '2026-05-29', date_end: '2026-05-31' })
    const result = getEventsForPeriod(new Date(2026, 4, 1), new Date(2026, 4, 31), [event])
    expect(result).toHaveLength(1)
  })

  it('excludes events entirely outside the period', () => {
    const event = makeEvent({ date_start: '2026-06-01', date_end: '2026-06-03' })
    const result = getEventsForPeriod(new Date(2026, 4, 1), new Date(2026, 4, 31), [event])
    expect(result).toHaveLength(0)
  })

  it('includes events that start before and end within period', () => {
    const event = makeEvent({ date_start: '2026-04-28', date_end: '2026-05-03' })
    const result = getEventsForPeriod(new Date(2026, 4, 1), new Date(2026, 4, 31), [event])
    expect(result).toHaveLength(1)
  })
})

describe('getClosedDays', () => {
  it('counts days covered by closed events within period', () => {
    const event = makeEvent({ date_start: '2026-05-29', date_end: '2026-05-31', impact: 'closed' })
    const result = getClosedDays(new Date(2026, 4, 1), new Date(2026, 4, 31), [event])
    expect(result).toBe(3)
  })

  it('does not count reduced or boost events', () => {
    const event = makeEvent({ date_start: '2026-05-01', date_end: '2026-05-31', impact: 'reduced' })
    const result = getClosedDays(new Date(2026, 4, 1), new Date(2026, 4, 31), [event])
    expect(result).toBe(0)
  })

  it('clips event dates to period boundaries', () => {
    const event = makeEvent({ date_start: '2026-04-28', date_end: '2026-05-02', impact: 'closed' })
    const result = getClosedDays(new Date(2026, 4, 1), new Date(2026, 4, 31), [event])
    expect(result).toBe(2) // only May 1 and May 2
  })
})

describe('getCaAdjusted', () => {
  it('adjusts CA proportionally when days are missing', () => {
    // 28 open days, 31 total, CA = 140000 → adjusted = 155000
    expect(getCaAdjusted(140000, 28, 31)).toBe(155000)
  })

  it('returns original CA when all days are open', () => {
    expect(getCaAdjusted(140000, 31, 31)).toBe(140000)
  })

  it('returns original CA when daysOpen >= daysInPeriod', () => {
    expect(getCaAdjusted(100000, 32, 31)).toBe(100000)
  })
})

describe('getAnnotationsForPeriod', () => {
  it('returns warning with ca_adjusted for closed event', () => {
    const event = makeEvent({ date_start: '2026-05-29', date_end: '2026-05-31', impact: 'closed', name: 'Aïd al-Adha' })
    const annotations = getAnnotationsForPeriod(new Date(2026, 4, 1), new Date(2026, 4, 31), [event], 140000)
    expect(annotations).toHaveLength(1)
    expect(annotations[0].type).toBe('warning')
    expect(annotations[0].label).toBe('Aïd al-Adha')
    expect(annotations[0].ca_adjusted).toBeGreaterThan(140000)
    expect(annotations[0].detail).toContain('3 jours')
  })

  it('returns info annotation for reduced event', () => {
    const event = makeEvent({ impact: 'reduced', name: 'Ramadan 2026', type: 'religious' })
    const annotations = getAnnotationsForPeriod(new Date(2026, 4, 1), new Date(2026, 4, 31), [event], 140000)
    expect(annotations).toHaveLength(1)
    expect(annotations[0].type).toBe('info')
    expect(annotations[0].icon).toBe('🌙')
  })

  it('returns boost annotation for school_holiday', () => {
    const event = makeEvent({ impact: 'boost', name: 'Vacances été', type: 'school_holiday' })
    const annotations = getAnnotationsForPeriod(new Date(2026, 4, 1), new Date(2026, 4, 31), [event], 140000)
    expect(annotations).toHaveLength(1)
    expect(annotations[0].type).toBe('boost')
    expect(annotations[0].icon).toBe('🏫')
  })

  it('returns empty array when no events in period', () => {
    const annotations = getAnnotationsForPeriod(new Date(2026, 4, 1), new Date(2026, 4, 31), [], 140000)
    expect(annotations).toHaveLength(0)
  })
})

describe('isN1ComparisonValid', () => {
  it('returns invalid when closed religious event shifts between years', () => {
    const aidN = makeEvent({ date_start: '2026-05-29', date_end: '2026-05-31', type: 'religious', impact: 'closed', name: 'Aïd al-Adha' })
    const aidN1 = makeEvent({ date_start: '2025-06-05', date_end: '2025-06-07', type: 'religious', impact: 'closed', name: 'Aïd al-Adha' })

    const result = isN1ComparisonValid(
      { start: new Date(2026, 4, 1), end: new Date(2026, 4, 31) },
      { start: new Date(2025, 4, 1), end: new Date(2025, 4, 31) },
      [aidN, aidN1]
    )
    expect(result.valid).toBe(false)
    expect(result.note).toContain('Aïd al-Adha')
  })

  it('returns valid when no religious events in either period', () => {
    const result = isN1ComparisonValid(
      { start: new Date(2026, 1, 1), end: new Date(2026, 1, 28) },
      { start: new Date(2025, 1, 1), end: new Date(2025, 1, 28) },
      []
    )
    expect(result.valid).toBe(true)
  })
})
