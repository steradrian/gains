import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { todayISO } from '../../../lib/format.js'
import { rangeFrom, rangeStart, rememberRange, storedRange } from '../../../lib/progress-range.js'
import { SYNCED_FP_KEY, useStore } from '../../../store/useStore.js'
import { bodyOf, waitingDays } from './body-data.js'
import { measureOf } from './measure-data.js'

// The Body page's three tabs and the address each keeps (/me/body, /me/body/measurements,
// /me/body/photos): one page, switched in place (replace), so Back leaves the page whichever tab it
// ends on. The query (?range=) rides along.
export const BODY_TABS = [
  { value: 'weigh-ins', path: '/me/body' },
  { value: 'measurements', path: '/me/body/measurements' },
  { value: 'photos', path: '/me/body/photos' },
]

const tabAt = pathname => BODY_TABS.find(t => t.path === pathname)?.value || 'weigh-ins'

const syncedFingerprint = () => {
  try { return JSON.parse(localStorage.getItem(SYNCED_FP_KEY)) } catch { return null }
}

/**
 * What the Body page needs: the tab and range from the address (read on every render, never copied
 * into state), the Weigh-ins data for that range, and the days whose weigh-in is waiting for the
 * server (only while `offline`: the stamp of the last agreed copy is all there is to tell by).
 */
export function useBody({ offline = false } = {}) {
  const nav = useNavigate()
  const { pathname, search } = useLocation()
  const S = useStore(s => s.S)
  const tab = tabAt(pathname)
  const range = rangeFrom(search, storedRange())
  const from = useMemo(() => rangeStart(range), [range])
  const today = todayISO()
  const data = useMemo(() => bodyOf(S, { from, today }), [S, from, today])
  const measure = useMemo(() => measureOf(S, { from }), [S, from])
  const waiting = useMemo(() => new Set(offline ? waitingDays(S, syncedFingerprint()) : []), [S, offline])

  const pickRange = value => {
    rememberRange(value)
    const q = new URLSearchParams(search)
    q.set('range', String(value))
    nav(pathname + '?' + q.toString(), { replace: true })
  }
  const pickTab = value => nav(BODY_TABS.find(t => t.value === value).path + search, { replace: true })

  return { tab, range, data, measure, waiting, asks: S.weighIn !== false, pickRange, pickTab }
}
