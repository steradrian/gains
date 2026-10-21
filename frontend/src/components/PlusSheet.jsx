import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { todayISO } from '../lib/format.js'
import { workoutRunning } from '../lib/tab-route.js'
import { closeThenNav, closeThenReplace } from '../lib/nav.js'
import { bwSheet, customExSheet, exerciseDetailSheet, logPastWorkoutSheet, startOrResume } from '../sheets.jsx'
import { addRoutine } from '../views/Plan.jsx'
import { measurementLogSheet } from '../views/Measurements.jsx'
import { nutritionAvailable } from '../lib/nutrition/api.js'
import { dayName } from '../lib/nutrition/log-feedback.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { settingOf } from '../lib/nutrition/use-nt-settings.js'
import { waterButtons } from '../lib/nutrition/water.js'
import { useUnits } from '../lib/nutrition/use-units.js'
import ActionGrid from '../ds/ActionGrid.jsx'
import BottomSheet from '../ds/BottomSheet.jsx'
import MenuList from '../ds/MenuList.jsx'
import Elapsed from './Elapsed.jsx'
import { pickMealSheet, useSheetTarget } from './LoggingTo.jsx'
import { quickKcalSheet } from './QuickKcalSheet.jsx'
import { foodPickerSheet } from './FoodPickerSheet.jsx'
import { scanSheet } from './ScanSheet.jsx'
import { usePlusFast } from './use-plus-fast.js'
import { addWater, waterAria } from './WaterCard.jsx'

const under = (pathname, base) => pathname === base || pathname.startsWith(base + '/')

// The items for what is on screen (at most two), as MenuList items taking the sheet's close.
function hereItems(pathname) {
  if (pathname === '/train/routines') return [{ icon: 'clipboard', label: t('New routine'), act: close => addRoutine(to => closeThenNav(close, to)) }]
  if (under(pathname, '/train/exercises')) return [{ icon: 'dumbbell', label: t('New exercise'), act: close => { close(); customExSheet(null, ex => exerciseDetailSheet(ex)) } }]
  if (under(pathname, '/progress/body')) return [
    { icon: 'ruler', label: t('Log measurements'), act: close => { close(); measurementLogSheet() } },
    // Photos is a segment of the page the sheet is over: it takes that page's place, so back goes to Progress.
    { icon: 'camera', label: t('Add photo'), act: close => closeThenReplace(close, '/progress/body/photos') },
  ]
  return []
}

// Add to Today, the centre + (board T18Add): the same drawer on every tab. The tiles log what a day
// is made of; the list under them holds what fits the screen you are on, then the rest. The chip
// names the day and meal the logs go to (the shared selection when it opened) and changes the meal.
// Log activity logs a past workout, to that day when it is one before today.
function PlusSheet({ close, pathname }) {
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const live = workoutRunning(S)
  // Nutrition only where NutriTrace is reachable (the web app, signed in).
  const food = nutritionAvailable(user)
  const target = useSheetTarget()
  const [watering, setWatering] = useState(false)
  const units = useUnits()
  useEffect(() => { if (food) useNutrition.getState().loadSettings() }, [food])
  const settings = useNutrition(s => s.settings.data)
  const fast = usePlusFast(close)
  const water = async ml => { setWatering(true); if (await addWater(target.date, ml)) close(); else setWatering(false) }
  const glasses = food ? waterButtons(settings) : []
  const where = { date: target.date, meal: target.meal, mealName: target.mealName }
  const past = target.date < todayISO()

  const tiles = [
    ...(food ? [
      { icon: 'utensils', label: t('Log food'), onClick: () => { close(); foodPickerSheet() } },
      { icon: 'scanBarcode', label: t('Scan'), onClick: () => { close(); scanSheet({ ...where, onSearch: foodPickerSheet }) } },
      { icon: 'droplet', label: t('Water'), ariaLabel: waterAria(glasses[0], units), disabled: watering, onClick: () => water(glasses[0].ml) },
    ] : []),
    { icon: 'scale', label: t('Weigh-in'), onClick: () => { close(); bwSheet({ date: target.date }) } },
    {
      icon: 'play', label: S.active ? t('Resume workout') : t('Start workout'), onClick: () => { close(); startOrResume() },
      detail: live ? <Elapsed start={S.active.start} /> : null,
    },
    { icon: 'history', label: t('Log activity'), onClick: () => { close(); logPastWorkoutSheet(past ? { iso: target.date } : undefined) } },
  ]
  const items = [
    ...hereItems(pathname).map(x => ({ icon: x.icon, label: x.label, onClick: () => x.act(close) })),
    food && settingOf(settings, 'showQuickCalories') && { icon: 'bolt', label: t('Quick kcal'), onClick: () => { close(); quickKcalSheet(where) } },
    // The first container is the Water tile; the others are a tap each here.
    ...glasses.slice(1).map(b => ({ key: 'water-' + b.id, icon: 'droplet', label: t('Water'), value: units.water(b.ml), ariaLabel: waterAria(b, units), disabled: watering, onClick: () => water(b.ml) })),
    fast,
    S.checkIn !== false && { icon: 'qr', label: t('Gym check-in'), onClick: () => closeThenNav(close, '/train/checkin') },
  ].filter(Boolean)

  return (
    <BottomSheet title={past ? t('Add') : t('Add to Today')}
      chip={food ? dayName(target.date) + ' · ' + target.mealName : dayName(target.date)}
      onChip={food ? () => pickMealSheet(target) : undefined}>
      <ActionGrid size="lg" items={tiles} />
      {items.length > 0 && <MenuList items={items} label={t('More')} />}
    </BottomSheet>
  )
}

export function openPlusSheet(pathname) {
  useUI.getState().openSheet(close => <PlusSheet close={close} pathname={pathname} />, { variant: 'ds' })
}
