import { useDeferredValue, useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { EXIDX, BODYPARTS, allExercises, equipmentOf, byCategory, searchExercises, similarExercises, figureOf } from '../lib/exercises.js'
import { activeProfile, exAvailable } from '../lib/equipment.js'
import { fmtNum, exCount } from '../lib/format.js'
import { buildSets, defaultConfig, modeOf, applyIntensifierPlan } from '../lib/history.js'
import { dropGrid } from '../lib/plates.js'
import { t, exerciseNameFor, exerciseNameClass } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import BodyMap from '../components/BodyMap.jsx'
import { Spacer } from '../components/layout.jsx'
import { SheetHeader } from '../components/sheet-layout.jsx'
import { Button as OldButton } from '../components/ui.jsx'
import BottomSheet from '../ds/BottomSheet.jsx'
import Button from '../ds/Button.jsx'
import ChipGroup from '../ds/ChipGroup.jsx'
import ExerciseStillRow from '../components/ExerciseStillRow.jsx'
import SegmentedControl from '../ds/SegmentedControl.jsx'
import Tag from '../ds/Tag.jsx'
import { sameMuscleFirst, swapMuscleOf } from '../lib/similar-exercises.js'
import { MUSCLE_NAME } from '../lib/muscles.js'
import { exercisesForMuscle } from '../lib/muscle-explore.js'
import { dbLoadFor, withMeaning, historyAs, ownedWeightsFor } from '../lib/dumbbells.js'
import { defaultIncrement, weightIncrement } from '../lib/progression.js'
import { swapActiveExercise } from '../lib/active-exercise-swap.js'
import { useSheetKeyboard, useRevealActiveGroupChip } from '../lib/use-sheet-keyboard.js'
import { useAutoMore } from '../lib/use-auto-more.js'
import { isFav, sortFavouritesFirst, sortYoursFirst } from '../lib/favourites.js'
import { buildPlannedEntry, builtOutOfProgression } from '../lib/session-start.js'
import { sessionHistory } from '../lib/backfill.js'
import { S, update, ui } from './shared.js'
import { confirmSheet } from './confirm-menu.jsx'
import { exConfigSheet } from './exercise-config.jsx'
import { customExSheet } from './exercise.jsx'

/* ============================ exercise picker ============================ */
// Exercises already used in your routines or past workouts (for the "Chosen" filter + a marker).
function usageMap(st) {
  const u = {}
  st.routines.forEach(r => r.ex.forEach(e => { u[e.id] = (u[e.id] || 0) + 1 }))
  st.workouts.forEach(w => w.entries.forEach(e => { u[e.id] = (u[e.id] || 0) + 1 }))
  return u
}
// The swap pickers' own scope (#473): exercises sharing the swapped exercise's target muscle.
const SAME = '≈'
const TABS = ['all', 'fav', 'muscle']

// T5.1–T5.3 the exercise picker, a full drawer. Tabs: All (the body part, Chosen ★ and same-muscle ≈
// chips, Type and Equipment), Favourites, By muscle (the body map). A tap picks, and the "+" on a row
// adds with the default settings, unless the caller opts into `multi`: then a tap ticks the row, and
// the foot reads `multi.label(n)` and hands every tick to `multi.onAdd` in the order they were ticked.
function ExercisePicker({ onPick, title, close, like, multi, routine, workout }) {
  const st = useStore(s => s.S)
  const usage = usageMap(st)
  const [q, setQ] = useState('')
  // What a swap is away from: the picker opens on what trains the same muscle, if anything you
  // can use does, and "All" is one tap back to everything.
  const likeEx = like ? (EXIDX[like] || allExercises(st).find(e => e.id === like) || null) : null
  // A muscle nothing else trains gets no chip at all rather than one that lists nothing.
  const likeTg = swapMuscleOf(likeEx) && sameMuscleFirst(allExercises(st), likeEx).length ? swapMuscleOf(likeEx) : ''
  const [tab, setTab] = useState('all')
  const [bp, setBp] = useState(() => {
    if (!likeTg) return ''
    const prof = activeProfile(st)
    return sameMuscleFirst(allExercises(st), likeEx).some(e => !prof || exAvailable(st, e)) ? SAME : ''
  })                                        // '' = all, '★' = chosen, '≈' = same muscle, else a body part
  const [muscle, setMuscle] = useState(null)
  const [eq, setEq] = useState('')          // '' = any equipment
  const [cat, setCat] = useState('')        // '' = any type
  const [showAll, setShowAll] = useState(false)
  const [shown, setShown] = useState(50)
  const [picked, setPicked] = useState([])  // multi: the exercises ticked, in order
  const searchRef = useRef(null)
  const bpStrip = useRef(null), eqStrip = useRef(null), catStrip = useRef(null)
  const onSearchFocus = useSheetKeyboard(searchRef)
  const moreRef = useAutoMore(() => setShown(s => s + 50))
  const all = allExercises(st)
  const profile = activeProfile(st)
  const figure = figureOf(st)
  const onAll = tab === 'all'
  const special = tab === 'fav' || (onAll && bp === '★')
  let inPart
  if (tab === 'fav') inPart = all.filter(e => isFav(st, e.id))
  else if (tab === 'muscle') inPart = muscle ? exercisesForMuscle(all, muscle) : []
  else if (bp === SAME) inPart = sameMuscleFirst(all, likeEx)
  else if (bp === '★') inPart = all.filter(e => usage[e.id])
  else inPart = all.filter(e => !bp || e.bp === bp)
  inPart = searchExercises(inPart, q)
  if (onAll && bp === '★') inPart = [...inPart].sort((a, b) => (usage[b.id] - usage[a.id]) || exerciseNameFor(a).localeCompare(exerciseNameFor(b)))
  // The Library's Type row (issue #521), with its fallback: a type the search or muscle group
  // narrowed away is ignored for this view, not forgotten. Favourites and By muscle have no filter rows.
  const { opts: catOpts, on: catOn, list: base } = byCategory(inPart, onAll ? cat : '')
  const eqFiltered = (profile && !showAll) ? base.filter(e => exAvailable(st, e)) : base
  const eqOpts = onAll ? equipmentOf(eqFiltered) : []
  // Drop the equipment filter if the search narrowed it away, so you never hit a dead end.
  const eqOn = eqOpts.includes(eq) ? eq : ''
  // Favourites float to the top of whatever the filters left (issue #6), the rest keeps its order.
  // On the same-muscle list the equipment order wins: what is on the same kit comes first,
  // favourites leading within each half.
  // While searching, what you have logged or planned follows right after them.
  const narrowedList = eqOn ? eqFiltered.filter(e => e.eq === eqOn) : eqFiltered
  const ranked = q.trim() ? sortYoursFirst(narrowedList, st, usage) : sortFavouritesFirst(narrowedList, st)
  const f = onAll && bp === SAME ? sameMuscleFirst(ranked, likeEx) : ranked
  const chosenCount = Object.keys(usage).length
  // The Library's live result count (GitLab !31), for the same reason: how many are left.
  const narrowed = !!(q.trim() || (onAll && bp) || tab !== 'all' || eqOn || catOn)
  useRevealActiveGroupChip(bpStrip, bp)
  useRevealActiveGroupChip(eqStrip, eqOn)
  useRevealActiveGroupChip(catStrip, catOn)
  // Close but not exact (a typo too many, most of the words, a similar name), listed under the
  // results once you have scrolled to their end, so a search almost never ends on nothing.
  // Worked out a beat behind the typing (useDeferredValue): the list itself never waits for it.
  const qLate = useDeferredValue(q)
  const pool = profile && !showAll ? all.filter(e => exAvailable(st, e)) : all
  const similar = q.trim() && qLate === q && !special && f.length <= shown
    ? similarExercises(tab === 'muscle'
      ? (muscle ? exercisesForMuscle(pool, muscle) : [])
      : pool.filter(e => bp === SAME || !bp || e.bp === bp), q, f, f.length ? 12 : 30)
    : []
  const noExact = f.length === 0 && similar.length > 0

  const tick = e => setPicked(p => (p.some(x => x.id === e.id) ? p.filter(x => x.id !== e.id) : [...p, e]))
  const add = () => { const exs = picked; close(); multi.onAdd(exs) }
  const create = () => customExSheet(null, ex => (multi ? setPicked(p => (p.some(x => x.id === ex.id) ? p : [...p, ex])) : onPick(ex)), q.trim())
  const pickBp = v => { setBp(v); if (v === '★') setEq(''); setShown(50) }
  const pickMuscle = m => { setMuscle(m === muscle ? null : m); setShown(50) }
  const pickRow = e => {
    const on = multi && picked.some(x => x.id === e.id)
    const fav = isFav(st, e.id)
    const mark = [
      usage[e.id] && <Tag key="chosen" icon="starFill">{t('Chosen')}</Tag>,
      multi && <span key="tick" className={'g-pk-tick' + (on ? ' on' : '')} aria-hidden="true">{on && <Icon name="check" className="g-icon" />}</span>,
    ].filter(Boolean)
    return <div key={e.id} className="g-pk-item">
      <ExerciseStillRow size={48} ex={e} figure={figure}
        title={<>{fav && <Icon name="starFill" className="g-icon g-pk-fav" />}<i className={exerciseNameClass(e)}>{exerciseNameFor(e)}</i></>}
        sub={[t(MUSCLE_NAME[e.tg] || e.tg || e.bp) + ' · ' + t(e.eq), workout?.sub?.(e)].filter(Boolean).join(' · ')}
        trailing={mark.length ? mark : false} pressed={multi ? !!on : undefined}
        onClick={() => (multi ? tick(e) : onPick(e))} />
      {/* A "+" glyph reads as "add this now": it adds with the default settings right away, where
          tapping the row opens the settings first, for when you want to set sets/reps before adding. */}
      {!multi && <button type="button" className="g-pk-add" aria-label={t('Add “{0}”', exerciseNameFor(e))}
        onClick={() => onPick(e, true)}><Icon name="plus" className="g-icon" /></button>}
    </div>
  }

  const head = <>
    <label className="g-lf-search">
      <Icon name="magnifier" className="g-icon" />
      <input ref={searchRef} type="search" value={q} placeholder={t('Search {0} exercises…', all.length)} aria-label={t('Search {0} exercises…', all.length)}
        enterKeyHint="search" onFocus={onSearchFocus} onChange={e => { setQ(e.target.value); setShown(50) }} />
      {narrowed && <span className="g-pk-count" role="status" aria-label={exCount(f.length)}>{fmtNum(f.length)}</span>}
      {q && <button type="button" className="g-lf-clear" onClick={() => { setQ(''); setShown(50); searchRef.current?.focus() }} aria-label={t('Clear')}><Icon name="xmark" className="g-icon" /></button>}
    </label>
    <div className="g-lf-tabs">
      <SegmentedControl label={t('Exercises')} value={tab} onChange={v => { setTab(v); setShown(50) }}
        options={TABS.map(v => ({ value: v, label: v === 'all' ? t('All') : v === 'fav' ? t('Favourites') : t('By muscle') }))} />
    </div>
  </>

  return <BottomSheet type="full" title={title || t('Add exercise')} chip={routine} chipIcon="clipboard" head={head}
    footer={multi && picked.length > 0 ? <Button block onClick={add}>{multi.label(picked.length)}</Button> : null}>
    {profile && <div className="g-pk-prof">
      <Icon name="kettlebell" className="g-icon" />
      <span>{showAll ? t('Showing all equipment') : t('Showing what you have in "{0}"', profile.name)}</span>
      <button type="button" onClick={() => setShowAll(v => !v)}>{showAll ? t('Filter by "{0}"', profile.name) : t('Show all equipment')}</button>
    </div>}
    {/* Changing muscle group keeps the equipment filter: if it still has exercises under the new
        group the filter stays applied, and if not the eqOn fallback above drops it for this view
        without forgetting the choice (issue #71). The Chosen chip clears it: that is a cross-body-part
        view where a stale equipment filter would be confusing. */}
    {onAll && <div className="g-pk-chips" ref={bpStrip}>
      <ChipGroup scroll label={t('Body part')} value={bp} onChange={pickBp} options={[
        ...(likeTg ? [{ value: SAME, label: <><Icon name="figureStrength" className="g-icon g-pk-cicon" />{t('Same muscle: {0}', t(MUSCLE_NAME[likeTg] || likeTg))}</> }] : []),
        ...(chosenCount > 0 ? [{ value: '★', label: <><Icon name="starFill" className="g-icon g-pk-cicon" />{t('Chosen')} ({chosenCount})</> }] : []),
        { value: '', label: t('All') },
        ...BODYPARTS.map(b => ({ value: b, label: t(b) })),
      ]} />
    </div>}
    {onAll && catOpts.length > 1 && <div className="g-pk-chips" ref={catStrip}>
      <ChipGroup scroll label={t('Type')} value={catOn} onChange={v => { setCat(v); setShown(50) }}
        options={[{ value: '', label: t('Any type') }, ...catOpts.map(x => ({ value: x, label: t(x) }))]} />
    </div>}
    {onAll && eqOpts.length > 1 && <div className="g-pk-chips" ref={eqStrip}>
      <ChipGroup scroll label={t('Equipment')} value={eqOn} onChange={v => { setEq(v); setShown(50) }}
        options={[{ value: '', label: t('Any equipment') }, ...eqOpts.map(x => ({ value: x, label: t(x) }))]} />
    </div>}
    {tab === 'muscle' && <>
      <div className="g-pk-map"><BodyMap body={st.body} selected={muscle} onMuscle={pickMuscle} label={t('Muscle map')} /></div>
      {muscle
        ? <p className="g-pk-head">{t(MUSCLE_NAME[muscle])} · {exCount(f.length)}</p>
        : <p className="g-pk-head g-pk-hint">{t('Choose a muscle to see exercises that train it.')}</p>}
    </>}
    <div className="g-pk-list">
      {!(onAll && bp === '★') && (tab !== 'muscle' || muscle) && !noExact && <button type="button" className="g-xrow g-pk-new" onClick={create}>
        <span className="g-xrow-ph"><Icon name="plusCircle" className="g-icon" /></span>
        <span className="g-xrow-b"><b>{t('Create your own exercise')}</b><span>{t('Name it and pick a body part')}</span></span>
        <Icon name="plus" className="g-icon g-xrow-chev" />
      </button>}
      {workout?.onAddRoutine && !q.trim() && <button type="button" className="g-xrow g-pk-new" onClick={() => { close(); workout.onAddRoutine() }}>
        <span className="g-xrow-ph"><Icon name="clipboard" className="g-icon" /></span>
        <span className="g-xrow-b"><b>{t('Add routine')}</b><span>{t('Bring another routine into this session')}</span></span>
        <Icon name="plus" className="g-icon g-xrow-chev" />
      </button>}
      {f.slice(0, shown).map(pickRow)}
      {f.length === 0 && tab === 'all' && bp === '★' && <p className="g-pk-note">{t('Nothing picked yet. Add some exercises and they’ll show up here.')}</p>}
      {f.length === 0 && tab === 'fav' && <p className="g-pk-note">{t('No favourites yet. Tap the star on an exercise to add one.')}</p>}
      {f.length === 0 && similar.length === 0 && q.trim() && <p className="g-pk-note">{t('No match')}</p>}
      {similar.length > 0 && <p className="g-pk-head">{f.length ? t('Similar exercises') : t('No exact match. These come close:')}</p>}
      {similar.map(pickRow)}
      {noExact && <button type="button" className="g-xrow g-pk-new" onClick={create}>
        <span className="g-xrow-ph"><Icon name="plusCircle" className="g-icon" /></span>
        <span className="g-xrow-b"><b>{t('Create your own exercise')}</b><span>{t('Name it and pick a body part')}</span></span>
        <Icon name="plus" className="g-icon g-xrow-chev" />
      </button>}
    </div>
    {f.length > shown && <div className="g-pk-more"><Button variant="secondary" block ref={moreRef} onClick={() => setShown(s => s + 50)}>{t('Show more')}</Button></div>}
  </BottomSheet>
}
// `title` names what the pick is for when it is not an add — the routine editor's Replace (#110).
// `like` is the exercise a swap or a replace is away from: the picker then opens on the ones that
// train the same muscle, same equipment first (#473). `routine` is the name of the routine the pick
// goes into, shown in the header. `multi: { label(n), onAdd(exs) }` makes the picker take several:
// without it a pick is one exercise (a tap configures, the "+" quick-adds).
// `workout: { sub(ex) -> string | null, onAddRoutine }` is the running workout's Add exercise (W1.18):
// `sub` adds to a row's muscle line when it returns text ("Last: …", "In this workout · added"),
// and `onAddRoutine` adds an "Add routine" row above the list, after closing the picker.
export const exercisePicker = (onPick, { title, like, multi, routine, workout } = {}) => ui().openSheet(close => <ExercisePicker onPick={onPick} title={title} like={like} multi={multi} routine={routine} workout={workout} close={close} />, { variant: 'ds' })

/**
 * The entry that takes the place of the active entry `current` when it is swapped for `ex` with
 * `cfg`. The running workout's Swap step (views/workout/workout-actions.js) builds it the same way.
 */
export function swapReplacement(st, current, ex, cfg) {
  const full = { ...cfg, id: ex.id }
  // A swap is an in-place substitution — routine identity is unchanged, so the replacement
  // keeps the slot's own `rid` and reads its prescription from that routine (not a
  // session-wide one). A slot with no `rid` is freestyle.
  const slotRoutine = current.rid ? st.routines.find(r => r.id === current.rid) : null
  const freestyle = !slotRoutine
  // Same rows the add flow builds: last time's loads and, in a planned session, the
  // prescription — swapping barbell for dumbbell bench must not start you at an empty bar.
  // Built from what came before the session's day when it is logged into the past (sessionHistory).
  const step = modeOf(full) === 'reps' ? weightIncrement(full, st.unit) : defaultIncrement(ex.id, st.unit)
  const past = sessionHistory(st)
  // A freestyle swap logs dumbbell weights the way the exercise means them now, and starts
  // from last time read in that meaning (lib/dumbbells.js), as a planned one does.
  const built = freestyle
    ? { target: withMeaning(st, cfg, ex.id), plan: null, sets: applyIntensifierPlan(buildSets(historyAs(past, ex.id, dbLoadFor(st, full)), full, { step: (modeOf(full) === 'reps' && ownedWeightsFor(st, full)) || step, preferLast: true }), full, dropGrid(st, full)) }
    : buildPlannedEntry(past, full, slotRoutine, { noProg: builtOutOfProgression(current, slotRoutine) })
  return {
    id: ex.id,
    ...built,
    ...(current.rid ? { rid: current.rid } : {}),
    // A slot kept out of progression stays out once swapped. Replaced in place the entry keeps
    // it anyway; inserted beside logged sets, the replacement would otherwise count as a
    // regular session of the new exercise. Only a deload or rehab slot is built without a
    // prescription (above): one kept out by hand keeps the marker and its Undo on the card,
    // and an Undo must leave numbers that are right to count.
    ...(current.noProg === true ? { noProg: true } : {}),
  }
}

/** Start a safe swap for one exact active-workout occurrence. */
export function swapActiveWorkoutExercise(index) {
  const active = S().active
  if (!active?.entries?.[index]) return

  // The "+" on a picker row commits with the default config, exactly as it does in the add
  // flows; tapping the row still opens the config sheet first.
  // Worded for the session, not the routine: a swap changes today's workout only.
  const picker = exercisePicker((ex, quick) => quick ? swapTo(ex, defaultConfig(ex.id)) : exConfigSheet(ex, null, cfg => swapTo(ex, cfg), null, null, null, null, t('Use in this workout')), { title: t('Swap exercise'), like: active.entries[index].id })
  function swapTo(ex, cfg) {
    // The picker is a chooser here, not a stack you keep adding from: one swap, then back to
    // the workout. (The add flow deliberately leaves it open.)
    picker.close()
    const st = S()
    const current = st.active?.entries?.[index]
    if (!current) return
    const replacement = swapReplacement(st, current, ex, cfg)

    const apply = options => {
      // A timed callback closes over entry/set indexes. Invalidate it, and the current rest,
      // before the selected occurrence can be replaced or a new entry shifts those indexes.
      ui().stopWork()
      ui().stopRest()
      update(state => { swapActiveExercise(state.active, index, replacement, options) }, true)
    }
    const logged = (current.sets || []).some(set => set.done === true)
    if (!logged) { apply(); return }

    if (current.sg) {
      ui().openSheet(close => <>
        <SheetHeader title={t('Swap exercise?')} />
        <div className="muted small mb-6">
          {t('Logged sets stay with the original exercise. Choose where the replacement belongs.')}
        </div>
        <OldButton variant="primary" onClick={() => { close(); apply({ loggedConfirmed: true, groupDisposition: 'keep' }) }}>
          {t('Keep replacement in this group')}
        </OldButton>
        <Spacer size={4} />
        <OldButton variant="ghost" onClick={() => { close(); apply({ loggedConfirmed: true, groupDisposition: 'detach' }) }}>
          {t('Insert after this group')}
        </OldButton>
      </>)
      return
    }

    confirmSheet({
      title: t('Swap exercise?'),
      message: t('Logged sets stay with the original exercise. The replacement will be inserted afterward.'),
      confirmText: t('Continue'),
      onConfirm: () => apply({ loggedConfirmed: true })
    })
  }
}
