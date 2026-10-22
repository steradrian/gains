import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import { t } from '../../../lib/i18n.js'
import { COACH_COMING_SOON } from '../../../lib/coach-availability.js'
import { writeErrorText } from '../../../lib/nutrition/log-feedback.js'
import { activityTracked, foodTracked, trainingTracked } from '../../../lib/nutrition/food-tracked.js'
import { nutritionAvailable } from '../../../lib/nutrition/api.js'
import { useNutrition } from '../../../lib/nutrition/store.js'
import { setFastingEnabled } from '../../../lib/nutrition/use-fasting.js'
import { settingOf, useNtSettings } from '../../../lib/nutrition/use-nt-settings.js'
import { featuresFor, pageTrail, PAGES } from '../../settings-pages.js'
import { useSettingsCtx } from '../use-settings-ctx.js'
import { settingsPath } from '../paths.js'
import FeaturesScreen from './FeaturesScreen.jsx'
import { friendsRow } from './features-rows.js'

// Settings > Features: wires the store to FeaturesScreen. Every write is one the app already had:
// Fasting is NutriTrace's `fastingEnabled` (setFastingEnabled), Water its `waterShowInDiary`
// (useNtSettings), and Training, Food and Activity are `S.trackTraining`, `S.trackFood` and
// `S.trackActivity` (lib/nutrition/food-tracked.js). Fasting waits for NutriTrace's settings;
// settings that did not load say so, with a way to ask again.
export default function FeaturesPage() {
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const update = useStore(s => s.update)
  const ctx = useSettingsCtx()
  const nav = useNavigate()
  const toast = useUI(s => s.toast)
  const nt = useNtSettings()
  const settingsStatus = useNutrition(s => s.settings.status)
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState(null)

  // Food is a switch only where the diary exists (the web app, signed in).
  const foodHere = nutritionAvailable(user)
  const training = trainingTracked(S)
  const food = foodHere && foodTracked(S)
  const activity = activityTracked(S)

  // Food off hides Food everywhere and deletes nothing, so it is one tap with Undo for 8 s.
  const setFood = on => {
    update(s => { s.trackFood = on })
    if (!on) toast(t('Stopped tracking food. Your diary is kept'), { action: t('Undo'), onAction: () => update(s => { s.trackFood = true }) })
  }

  const setFasting = async on => {
    setSwitching(true)
    setError(null)
    try { await setFastingEnabled(on) } catch (e) { setError(writeErrorText(e)) }
    setSwitching(false)
  }

  const tracked = [training && t('Training'), food && t('Food'), activity && t('Activity')].filter(Boolean)
  const off = [
    !training && t('Training'),
    foodHere && !food && t('Food'),
    !activity && t('Activity'),
    ctx.nutrition && !ctx.fastingOn && t('Fasting'),
  ].filter(Boolean)
  const line = [tracked.join(', '), off.map(n => t('{0} off', n)).join(', ')].filter(Boolean).join(' · ')

  const valueOf = e => {
    const on = e.feature(S, ctx)
    return on == null ? null : on ? t('On') : t('Off')
  }

  // One of Training and Food stays on: Today has no profile without either.
  return (
    <FeaturesScreen
      title={t(PAGES.features.title)}
      line={line}
      track={{
        training: { on: training, disabled: training && !food, onChange: v => update(s => { s.trackTraining = v }) },
        food: foodHere ? { on: food, disabled: food && !training, onChange: setFood } : null,
        activity: { on: activity, onChange: v => update(s => { s.trackActivity = v }) },
      }}
      fasting={ctx.nutrition ? {
        on: !!ctx.fastingOn, disabled: switching || !ctx.ntSettings, error, onChange: setFasting,
        unread: !ctx.ntSettings && settingsStatus === 'error',
        onRetry: () => useNutrition.getState().loadSettings({ force: true }),
      } : null}
      coach={{ soon: COACH_COMING_SOON, onOpen: () => nav(PAGES.coach.to) }}
      water={ctx.nutrition ? {
        on: settingOf(ctx.ntSettings, 'waterShowInDiary'),
        disabled: !ctx.ntSettings || !!nt.busy.waterShowInDiary,
        onChange: v => nt.save('waterShowInDiary', v),
      } : null}
      extra={friendsRow({ S, ctx, update })}
      links={featuresFor(ctx).map(e => ({
        key: e.page + ':' + e.title, icon: PAGES[e.page].icon, title: t(e.title), sub: pageTrail(e.page), value: valueOf(e),
        onClick: () => nav(settingsPath(e.page), { state: e.via ? { find: e.title, via: e.via } : { find: e.title } }),
      }))}
    />
  )
}
