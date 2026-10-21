import { useEffect, useState } from 'react'
import { t } from '../lib/i18n.js'
import { fmtDur } from '../lib/format.js'
import { closeThenNav } from '../lib/nav.js'
import { useUI } from '../store/useUI.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { DEFAULT_GOAL_HOURS, progressOf, validGoal } from '../lib/nutrition/fasting.js'
import { useFasting, useFastingOn, useNow } from '../lib/nutrition/use-fasting.js'
import { writeErrorText } from '../lib/nutrition/log-feedback.js'

/** The + sheet's Fast item (a MenuList item), there only while fasting is switched on
 *  (ia-proposal §4), else null. Idle, one tap starts a fast of the plan used last; running, it
 *  shows the time fasted and opens the Fasting page. */
export function usePlusFast(close) {
  const on = useFastingOn()
  const { status, active } = useFasting()
  const defaultHours = useNutrition(s => s.settings.data?.fastingDefaultHours)
  const [busy, setBusy] = useState(false)
  const now = useNow(!!active)

  useEffect(() => { if (on) useFasting.getState().load() }, [on])

  if (!on || status !== 'ready') return null

  if (active) {
    return { key: 'fast', icon: 'timer', label: t('Fasting'), value: fmtDur(progressOf(active, now).elapsedMs), onClick: () => closeThenNav(close, '/food/fasting') }
  }

  const hours = validGoal(Number(defaultHours)) ? Number(defaultHours) : DEFAULT_GOAL_HOURS
  const start = async () => {
    setBusy(true)
    try {
      const { started } = await useFasting.getState().start(hours)
      close()
      useUI.getState().toast(started ? t('Fast started: {0} h goal', hours) : t('A fast is already running'))
    } catch (e) {
      useUI.getState().toast(writeErrorText(e))
      setBusy(false)
    }
  }
  return { key: 'fast', icon: 'timer', label: t('Fast'), value: t('{0} h', hours), ariaLabel: t('Start a {0} hour fast', hours), onClick: start, disabled: busy }
}
