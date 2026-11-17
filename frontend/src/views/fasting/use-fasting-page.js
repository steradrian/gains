import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { t } from '../../lib/i18n.js'
import { fmtDur } from '../../lib/format.js'
import { confirmSheet } from '../../sheets.jsx'
import { nutritionAvailable } from '../../lib/nutrition/api.js'
import { DEFAULT_GOAL_HOURS, canReopen, lengthOf, usualStart, validGoal } from '../../lib/nutrition/fasting.js'
import { writeErrorText } from '../../lib/nutrition/log-feedback.js'
import { useNutrition } from '../../lib/nutrition/store.js'
import { setFastingEnabled, useFasting, useNow } from '../../lib/nutrition/use-fasting.js'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { fastChangeStartSheet } from '../../components/FastChangeStartSheet.jsx'
import { fastStartSheet } from '../../components/FastStartSheet.jsx'
import { dateText } from './fast-format.js'

const START_PARAM = 'start'

// Everything the Fasting page does: reads the settings and the fasts, picks the view, and runs
// Turn on/off, Start, Change start, End (with its Undo) and Remove. NutriTrace keeps the fasts;
// whether the tracker is on is its `fastingEnabled` setting. The Start drawer lives in the URL
// (`?start=1`): the drawer opens when it is there and the page is idle, and the parameter goes
// when the drawer closes however it closed. The URL is replaced, never pushed, because the sheet
// frame already holds the history entry that Back closes the drawer with.
export function useFastingPage() {
  const user = useStore(s => s.user)
  const available = nutritionAvailable(user)
  const settings = useNutrition(s => s.settings)
  const { status, active, history } = useFasting()
  const on = settings.data?.fastingEnabled === true
  const now = useNow(true, active ? 1000 : 60000)
  const [params, setParams] = useSearchParams()
  const [picked, setPicked] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const startRef = useRef(null)
  const changeRef = useRef(null)
  const closedRef = useRef(false)
  const alive = useRef(true)

  const saved = Number(settings.data?.fastingDefaultHours)
  const hours = picked ?? (validGoal(saved) ? saved : DEFAULT_GOAL_HOURS)
  const hour12 = settings.data?.timeFormat !== '24h'
  const startOpen = params.get(START_PARAM) === '1'

  useEffect(() => {
    if (!available) return
    useNutrition.getState().loadSettings()
  }, [available])
  // A fast started or ended on another device shows up when the page opens and when the app
  // comes back to the front.
  useEffect(() => {
    if (!available || !on) return undefined
    useFasting.getState().load({ force: true })
    const refresh = () => { if (document.visibilityState === 'visible') useFasting.getState().load({ force: true }) }
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
  }, [available, on])

  let view
  if (!available) view = 'unavailable'
  else if (!settings.data) view = settings.status === 'loading' || settings.status === 'idle' ? 'loading' : 'settings-error'
  else if (!on) view = 'off'
  else if (status === 'error') view = 'fasts-error'
  else if (status !== 'ready') view = 'loading'
  else view = active ? 'running' : 'idle'

  const clearStart = useCallback(() => {
    if (!alive.current) return
    setParams(p => { const next = new URLSearchParams(p); next.delete(START_PARAM); return next }, { replace: true })
  }, [setParams])

  // The drawers are ours to close when the page stops needing them (it left, or the fast started
  // or ended on another device); the parameter follows the drawer, whoever closed it.
  useEffect(() => {
    alive.current = true
    const unsubscribe = useUI.subscribe(s => {
      const open = id => s.sheets.some(x => x.id === id)
      if (startRef.current && !open(startRef.current.id)) { startRef.current = null; closedRef.current = true; clearStart() }
      if (changeRef.current && !open(changeRef.current.id)) changeRef.current = null
    })
    return () => {
      alive.current = false
      unsubscribe()
      startRef.current?.close()
      changeRef.current?.close()
    }
  }, [clearStart])
  useEffect(() => {
    if (view !== 'running') changeRef.current?.close()
    if (view === 'running') startRef.current?.close()
  }, [view])

  const startFast = useCallback(async (goal, startAt) => {
    try {
      const { started } = await useFasting.getState().start(goal, startAt)
      startRef.current?.close()
      useUI.getState().toast(started ? t('Fast started: {0} h goal', goal) : t('A fast is already running'))
      return null
    } catch (e) {
      return writeErrorText(e)
    }
  }, [])

  // A drawer that was just closed is not opened again by the parameter that has not gone yet.
  useEffect(() => { if (!startOpen) closedRef.current = false }, [startOpen])
  useEffect(() => {
    if (!startOpen || view !== 'idle' || startRef.current || closedRef.current) return
    startRef.current = fastStartSheet({ hour12, initialHours: hours, onStart: startFast })
  }, [startOpen, view, hour12, hours, startFast])

  const turn = async next => {
    setBusy(true)
    setError(null)
    try {
      await setFastingEnabled(next)
    } catch (e) {
      setError(writeErrorText(e))
    }
    setBusy(false)
  }

  const end = async () => {
    setBusy(true)
    try {
      const done = await useFasting.getState().end()
      if (done) {
        const undo = canReopen(done, Date.now())
          ? { action: t('Undo'), onAction: () => useFasting.getState().reopen(done).catch(e => useUI.getState().toast(writeErrorText(e))) }
          : undefined
        useUI.getState().toast(t('Fast ended: {0}', fmtDur(lengthOf(done))), undo)
      }
    } catch (e) {
      useUI.getState().toast(writeErrorText(e))
    }
    setBusy(false)
  }

  const changeStart = () => {
    if (!active || changeRef.current) return
    changeRef.current = fastChangeStartSheet({
      fast: active,
      hour12,
      onSave: async startAt => {
        try {
          await useFasting.getState().editStart(startAt)
          changeRef.current?.close()
          useUI.getState().toast(t('Start time updated'))
          return null
        } catch (e) {
          return writeErrorText(e)
        }
      },
    })
  }

  const remove = fast => {
    const when = dateText(Date.parse(fast.start_at))
    confirmSheet({
      title: t('Remove this fast?'),
      message: t('The {0} fast on {1} is deleted from your history.', fmtDur(lengthOf(fast)), when),
      confirmText: t('Remove'),
      danger: true,
      onConfirm: () => useFasting.getState().remove(fast.id).catch(e => useUI.getState().toast(writeErrorText(e))),
    })
  }

  return {
    view, now, hour12, fast: active, history, hours, busy, error,
    usualStart: usualStart(history, now),
    onRetry: () => {
      if (settings.data) useFasting.getState().load({ force: true })
      else useNutrition.getState().loadSettings({ force: true })
    },
    onPick: setPicked,
    onTurnOn: () => turn(true),
    onTurnOff: () => turn(false),
    onOpenStart: () => setParams(p => { const next = new URLSearchParams(p); next.set(START_PARAM, '1'); return next }, { replace: true }),
    onChangeStart: changeStart,
    onEnd: end,
    onRemove: remove,
  }
}
