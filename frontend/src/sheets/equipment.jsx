import { useStore } from '../store/useStore.js'
import { isBodyweightEq, exOr } from '../lib/exercises.js'
import { fmtNum } from '../lib/format.js'
import { usesBar, defaultBarWeight, hasBarOverride, isNoBar } from '../lib/bar.js'
import { withLoadKind, loadKindFor, baseWeightFor } from '../lib/plates.js'
import { t, exerciseNameFor, exerciseNameClass } from '../lib/i18n.js'
import Stepper from '../components/Stepper.jsx'
import { Inline } from '../components/layout.jsx'
import { SheetHeader } from '../components/sheet-layout.jsx'
import { Button, Switch, Segmented, Row } from '../components/ui.jsx'
import { isOneArm } from '../lib/dumbbells.js'
import DumbbellsDrawer from '../views/train/gym/DumbbellsDrawer.jsx'
import PlatesDrawer from '../views/train/gym/PlatesDrawer.jsx'
import ProfileDrawer from '../views/train/gym/ProfileDrawer.jsx'
import { update, ui } from './shared.js'

/* ============================ plate loading ============================ */
// One editor for every place an exercise's loading shows up (exercise detail, exercise config,
// mid-workout sheet). Three things, all per exercise and display-only (lib/plates.js):
//   • how the weight is loaded — per side of a bar, one stack, or not plate-loaded at all
//     (S.loadKind; absent = derived from the equipment, so most exercises never store it);
//   • the base weight before any plate goes on — the bar (S.barWeights, profile unit, lib/bar.js;
//     stepping down to 0 clears the override and falls back to the bar type's default), or a
//     sled's / machine's own weight for anything else;
//   • "No bar" for a bar exercise: an explicit 0 (issue #138 — a counterbalanced Smith machine),
//     so the whole total is plates. Distinct from the stepper's 0, which means "default".
// `cfg` is the routine/session config the caller has (its `bodyweight` flag turns a dumbbell
// exercise into "added weight", i.e. a single stack) — the default kind is derived from the
// same thing the workout screen derives it from, so what the editor shows as chosen is what
// the rows do. Without one, the equipment alone decides.
export function BarWeightEditor({ ex, cfg, extra }) {
  const st = useStore(s => s.S)
  const bar = usesBar(ex)
  const ctx = { ...(cfg || {}), id: ex.id }
  const kind = loadKindFor(st, ctx)
  const explicit = hasBarOverride(st, ex.id)
  const noBar = bar && isNoBar(st, ex.id)
  const def = defaultBarWeight(ex.eq, st.unit)
  const base = baseWeightFor(st, ex)
  // The kinds a pick would only be restating. With a `cfg` there is one: the same default the
  // rows derive. Without one the equipment decides — and for body-weight equipment that answer
  // ('single', the load being whatever you hang on) is not the one a routine logging the total
  // derives ('none', bodyweight: false), so the segment sits lit on a kind the rows do not use
  // and the pick that would fix it is the only way to say so: both readings are consulted, and
  // it is stored unless it is the default under either. Everything else keeps the plain rule —
  // a dumbbell's cfg-less 'none' is what a dumbbell row derives, and storing it would freeze
  // 'none' onto the exercise everywhere, override the 'single' an added-weight entry derives,
  // and leave no pick that takes the key off again.
  const defaults = cfg ? [loadKindFor(null, ctx)]
    : isBodyweightEq(ex.id) ? [true, false].map(b => loadKindFor(null, { id: ex.id, bodyweight: b }))
    : [loadKindFor(null, ctx)]
  // Picking what the equipment already implies puts the exercise back on it (a stamped null,
  // lib/plates.js), so a later change of the equipment's own default still reaches it.
  const setKind = k => update(s => {
    s.loadKind = withLoadKind(s.loadKind, ex.id, defaults.every(d => d === k) ? null : k)
  })
  const setBar = v => update(s => {
    s.barWeights = s.barWeights || {}
    const n = Math.max(0, Math.round((v || 0) * 100) / 100)
    if (n > 0) s.barWeights[ex.id] = n; else delete s.barWeights[ex.id]
  })
  // "No bar" is a stored 0, which is a different thing from no entry at all: a counterbalanced
  // Smith carriage weighs nothing in your hands, so the plate math and the drop-set steps must
  // start from what you logged (issue #138). Clearing it goes back to the bar type's default.
  const setNoBar = on => update(s => {
    s.barWeights = s.barWeights || {}
    if (on) s.barWeights[ex.id] = 0; else delete s.barWeights[ex.id]
  })
  return <>
    <Segmented className="seg-inline" value={kind} onChange={setKind}
      options={[{ value: 'pairs', label: t('Per side') }, { value: 'single', label: t('Single stack') }, { value: 'none', label: t('Off') }]} />
    <div className="small dim mt-4 mb-6">
      {kind === 'pairs' ? t('Plates split over both sides of a bar.')
        : kind === 'single' ? t('One stack: a belt, a landmine, a plate-loaded machine, a sled.')
          : t('No plate line under the sets.')}
    </div>
    {kind !== 'none' && <>
      {bar && <div className="list menu-list mb-3">
        <Row icon="barbell" title={t('No bar')} subtitle={t('The weight you log is all plates.')}>
          <Switch checked={noBar} onChange={setNoBar} />
        </Row>
      </div>}
      {!noBar && <Inline className="cfgrow mb-3">
        <Stepper label={bar ? t('Bar ({0})', st.unit) : t('Base weight ({0})', st.unit)} value={base} step={2.5} onChange={setBar} />
      </Inline>}
      <div className="small dim mb-9">
        {noBar ? t('Plates are counted from 0. Turn this off for the default ({0}).', fmtNum(def) + ' ' + st.unit)
          : bar ? (explicit ? t('Set to 0 to go back to the default ({0}).', fmtNum(def) + ' ' + st.unit) : t('Default for this bar type.'))
            : t('The machine or sled itself, before any plate goes on. 0 if it is all plates.')}
        {extra ? ' ' + extra : ''}
      </div>
    </>}
  </>
}

// What a dumbbell or kettlebell weight means (issue #474, lib/dumbbells.js): as entered (the
// default, how every set before this was counted), one bell, or both together. `value` is the
// meaning in force and `onChange` stores a pick; the caller decides where (the routine's slot or
// the exercise's own default). The line under it says what the pick does to the numbers.
export function DbLoadPicker({ ex, cfg, value, onChange }) {
  const one = isOneArm({ ...(cfg || {}), id: ex.id })
  return <>
    <Segmented className="seg-inline" value={value} onChange={onChange}
      options={[{ value: 'as', label: t('As entered') }, { value: 'each', label: t('Each') }, { value: 'total', label: t('Both') }]} />
    <div className="small dim mt-4 mb-9">
      {value === 'each' ? (one ? t('The weight of the one you hold. One arm, so it counts once.') : t('The weight of one, so 20 means 20 in each hand. Volume counts both.'))
        : value === 'total' ? t('Both together, so 40 means two 20s.')
          : t('Counted as you type it, the way it always was.')}
    </div>
  </>
}

// Mid-workout sheet behind the ⋯ menu's "Plate loading" — same values, same editor.
function BarWeightSheet({ exId, cfg, close }) {
  const ex = exOr(exId)
  return <>
    <SheetHeader title={t('Plate loading')} />
    <div className={`muted small mb-6 ${exerciseNameClass(ex)}`}>{exerciseNameFor(ex)}</div>
    <BarWeightEditor ex={ex} cfg={cfg} extra={t('Applies to this exercise everywhere, not just this plan.')} />
    <Button variant="primary" onClick={close}>{t('Done')}</Button>
  </>
}
export const barWeightSheet = (exId, cfg) => ui().openSheet(close => <BarWeightSheet exId={exId} cfg={cfg} close={close} />)

// The three drawers over Gym setup (views/train/gym/): the plates you own, the dumbbells you own,
// and one equipment profile. These are their openers, and the names Gym setup and the rest of the
// app call.
export const plateInventorySheet = () => ui().openSheet(close => <PlatesDrawer close={close} />, { variant: 'ds' })

export const dumbbellInventorySheet = () => ui().openSheet(close => <DumbbellsDrawer close={close} />, { variant: 'ds' })

// Create or edit one profile ("Home", "Gym", ...): a name plus a checklist of what you have.
export const equipmentProfileSheet = profile => ui().openSheet(close => <ProfileDrawer profile={profile} close={close} />, { variant: 'ds' })
