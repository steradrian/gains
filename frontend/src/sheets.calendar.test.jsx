// @vitest-environment happy-dom
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { isoOf, todayISO } from './lib/format.js'
import { setNav } from './lib/nav.js'
import { calendarSheet } from './sheets.jsx'

const mounted = []

function renderTop() {
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}

describe('Calendar canonical workout days', () => {
  let original

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    original = useStore.getState().S
    useUI.setState({ sheets: [] })
    document.body.innerHTML = ''
  })

  afterEach(() => {
    act(() => { mounted.splice(0).forEach(root => root.unmount()) })
    useStore.setState({ S: original })
  })

  it('keeps multiple legacy sessions on the heatmap fallback day clickable in Calendar', () => {
    const day = todayISO()
    const start = new Date(day + 'T09:00:00').getTime()
    useStore.setState({ S: {
      ...original,
      workouts: [
        { id: 'legacy-a', d: '', start, end: start + 15 * 60000, name: 'Legacy A', vol: 100, entries: [] },
        { id: 'legacy-b', d: 'not-a-day', start: start + 30 * 60000, end: start + 45 * 60000, name: 'Legacy B', vol: 200, entries: [] },
      ],
    } })

    calendarSheet(day)
    const host = renderTop()
    expect(host.textContent).toContain('2 workouts')
    const trainedDay = host.querySelector('button.cal-d.has')
    expect(trainedDay).toBeTruthy()

    act(() => trainedDay.click())
    const sessions = renderTop()
    expect(sessions.textContent).toContain('Legacy A')
    expect(sessions.textContent).toContain('Legacy B')
  })
})

describe('Calendar — a past day opens its Day page (PR07 D1)', () => {
  let original
  const go = vi.fn()
  const shift = n => { const d = new Date(todayISO() + 'T12:00:00'); d.setDate(d.getDate() + n); return isoOf(d) }
  const dayButton = (host, iso) => [...host.querySelectorAll('button.cal-d')].find(b => b.textContent === String(Number(iso.slice(8))))
  const past = shift(-2)
  const start = new Date(past + 'T09:00:00').getTime()
  const install = over => useStore.setState({ S: { ...original, workouts: [{ id: 'p', d: past, start, end: start + 3600000, name: 'Push', vol: 0, entries: [] }], dayNotes: {}, ...over } })

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    original = useStore.getState().S
    useUI.setState({ sheets: [] })
    document.body.innerHTML = ''
    go.mockClear()
    setNav(go)
    window.location.hash = '#/progress/load'
  })

  afterEach(() => {
    act(() => { mounted.splice(0).forEach(root => root.unmount()) })
    useStore.setState({ S: original })
    setNav(() => {})
    window.location.hash = ''
  })

  it('a past trained day opens its Day page under the tab the calendar is on, instead of the workout', () => {
    install()
    calendarSheet(past)
    const host = renderTop()
    act(() => dayButton(host, past).click())
    expect(go).toHaveBeenCalledWith('/me/day/' + past)
    expect(useUI.getState().sheets).toHaveLength(0)
  })

  it('a day before the first log keeps the day sheet', () => {
    install({ workouts: [], bodyweight: [], measurements: [] })
    calendarSheet(past)
    const host = renderTop()
    act(() => dayButton(host, past).click())
    expect(go).not.toHaveBeenCalled()
    expect(useUI.getState().sheets).toHaveLength(1)
  })
})
