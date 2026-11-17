import { t, tn } from '../../../lib/i18n.js'
import { fmtDateRange } from '../../../lib/format.js'
import { mePath } from '../../../lib/tab-route.js'
import Button from '../../../ds/Button.jsx'
import StageFooter from '../../../ds/StageFooter.jsx'
import StageSection from '../../../ds/StageSection.jsx'
import StatTiles from '../../../ds/StatTiles.jsx'
import SettingRow from '../SettingRow.jsx'
import SettingsPage from '../SettingsPage.jsx'
import { Card } from './prefs-rows.jsx'

const NAMES_SHOWN = 6

const headlineOf = o => {
  if (o.kind === 'bodyweight') return tn('{0} weigh-in imported', '{0} weigh-ins imported', o.imported)
  // A workouts file with weigh-ins along (MacroFactor) reads like Hevy's: each part that came in.
  if (o.kind === 'workouts' && !o.weighIns) return tn('{0} workout imported', '{0} workouts imported', o.imported)
  return [
    o.imported > 0 && tn('{0} workout imported', '{0} workouts imported', o.imported),
    o.routines > 0 && tn('{0} routine imported', '{0} routines imported', o.routines),
    o.weighIns > 0 && tn('{0} weigh-in imported', '{0} weigh-ins imported', o.weighIns),
  ].filter(Boolean).join(' · ')
}

// The numbers come from the import itself (lib/import-outcome.js), not from the file: a day the
// history already had is left alone, and its sets are not counted.
const tilesOf = o => {
  if (o.kind === 'bodyweight') return []
  const tiles = []
  if (o.imported > 0) {
    tiles.push({ key: 'sets', label: t('Sets'), value: o.sets })
    tiles.push({ key: 'matched', label: t('Matched'), value: o.matched, sub: t('exercises') })
    tiles.push({ key: 'new', label: t('New'), value: o.newNames.length, sub: t('your own') })
  }
  return tiles
}

// Where the imported data shows: workouts in History, routines in Routines, weigh-ins in Body.
const targetOf = o => {
  if (o.kind === 'bodyweight') return { path: mePath('body'), label: t('See it in Body') }
  if ((o.kind === 'workouts' && !o.weighIns) || o.imported > 0) return { path: '/train/history', label: t('See it in History') }
  if (o.kind === 'hevy' && o.routines > 0) return { path: '/train/routines', label: t('See it in Routines') }
  return { path: mePath('body'), label: t('See it in Body') }
}

/**
 * Import done (board St1Imported): `outcome` is what lib/import-outcome.js reports for a file or
 * Hevy import. `onOpen(path)` goes to where the imported data shows: History, or Body for a
 * body-weight file.
 */
export default function ImportDoneScreen({ outcome: o, onOpen }) {
  const range = fmtDateRange(o.from, o.to, true)
  const line = o.source ? (range ? t('From {0}, {1}', o.source, range) : t('From {0}', o.source)) : range
  const tiles = tilesOf(o)
  const names = o.newNames || []
  const target = targetOf(o)
  return (
    <SettingsPage title={t('Import done')} line={o.source || undefined}>
      <div className="g-imp-done">
        <h2 className="g-imp-head">{headlineOf(o)}</h2>
        {line && <p className="g-imp-line">{line}</p>}
        {tiles.length > 0 && <StatTiles tone="stage" items={tiles} />}
        {names.length > 0 && <>
          <StageSection title={t('Worth a look')} />
          <Card>
            <SettingRow icon="dumbbell" title={tn('{0} became your own exercise', '{0} became your own exercises', names.length)}
              sub={names.slice(0, NAMES_SHOWN).join(', ') + (names.length > NAMES_SHOWN ? ', …' : '')} />
          </Card>
        </>}
        {o.leftAlone > 0 && <Card>
          <SettingRow icon="calendar" title={tn('{0} day left alone', '{0} days left alone', o.leftAlone)}
            sub={o.kind === 'bodyweight' ? t('They already had a weigh-in') : t('They already had a workout in Gains')} />
        </Card>}
      </div>
      <StageFooter sticky={false}>
        <Button onClick={() => onOpen(target.path)}>{target.label}</Button>
      </StageFooter>
    </SettingsPage>
  )
}
