import { useDeferredValue, useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { similarExercises, figureOf } from '../lib/exercises.js'
import { exAvailable } from '../lib/equipment.js'
import { fmtNum, exCount } from '../lib/format.js'
import { defaultConfig } from '../lib/history.js'
import { t, exerciseNameFor, exerciseNameClass } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import BodyMap from '../components/BodyMap.jsx'
import { Spacer } from '../components/layout.jsx'
import { SheetHeader } from '../components/sheet-layout.jsx'
import { Button as OldButton } from '../components/ui.jsx'
import BottomSheet from '../ds/BottomSheet.jsx'
import Button from '../ds/Button.jsx'
import ExerciseStillRow from '../components/ExerciseStillRow.jsx'
import SegmentedControl from '../ds/SegmentedControl.jsx'
import StageEmpty from '../ds/StageEmpty.jsx'
import Tag from '../ds/Tag.jsx'
import { SAME, activeFilterCount, createPickerView, pickerContext, pickerList, usePickerView } from '../lib/picker-view.js'
import { sameMuscleFirst } from '../lib/similar-exercises.js'
import { MUSCLE_NAME } from '../lib/muscles.js'
import { exercisesForMuscle } from '../lib/muscle-explore.js'
import { swapReplacement } from '../lib/swap-replacement.js'
import { swapActiveExercise } from '../lib/active-exercise-swap.js'
import { useAutoMore } from '../lib/use-auto-more.js'
import { isFav } from '../lib/favourites.js'
import { S, update, ui } from './shared.js'
import { confirmSheet } from './confirm-menu.jsx'
import { exConfigSheet } from './exercise-config.jsx'
import { customExSheet } from './exercise.jsx'
import PickerFilters from './exercise-picker-filters.jsx'

/* ============================ exercise picker ============================ */
const TABS = ['all', 'fav', 'muscle']

// T5.1–T5.3 the exercise picker, a full drawer. Each tab does its own thing: All is the whole
// catalogue (search, Filters, the Chosen toggle), Favourites is what you starred plus what you used
// lately, By muscle is the body map and, once a muscle is tapped, the exercises that train it.
// Body part, type and equipment live in the Filters sub-panel (exercise-picker-filters.jsx), opened
// from the button beside the search. A tap picks, and the "+" on a row adds with the default
// settings, unless the caller opts into `multi`: then a tap ticks the row, and the foot reads
// `multi.label(n)` and hands every tick to `multi.onAdd` in the order they were ticked.
function ExercisePicker({ onPick, title, close, like, multi, routine, workout }) {
  const st = useStore(s => s.S)
  const ctx = pickerContext(st, like)
  const { all, usage, profile, likeEx, likeTg } = ctx
  // What a swap is away from: the picker opens on what trains the same muscle, if anything you
  // can use does, and "All" in the Filters is one tap back to everything.
  const [view] = useState(() => createPickerView({
    bp: likeTg && sameMuscleFirst(all, likeEx).some(e => !profile || exAvailable(st, e)) ? SAME : '',
  }))
  const v = usePickerView(view)
  const { q, tab, muscle, chosen, showAll } = v
  const [shown, setShown] = useState(50)
  const [picked, setPicked] = useState([])  // multi: the exercises ticked, in order
  const searchRef = useRef(null)
  const moreRef = useAutoMore(() => setShown(s => s + 50))
  const figure = figureOf(st)
  const { list: f, catOn, eqOn, bp, special } = pickerList(st, v, ctx)
  const filterCount = activeFilterCount({ bp, catOn, eqOn })
  const chosenCount = Object.keys(usage).length
  useEffect(() => { setShown(50) }, [q, tab, bp, catOn, eqOn, muscle, chosen])
  // The Library's live result count (GitLab !31), for the same reason: how many are left.
  const narrowed = !!(q.trim() || filterCount || (tab === 'all' && chosen) || tab !== 'all')
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
  const openFilters = () => ui().openSheet(back => <PickerFilters store={view} like={like} close={back} />, { variant: 'ds' })
  const pickMuscle = m => view.set({ muscle: m === muscle ? null : m })
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
  // Favourites lists the starred ones, then what was used lately, each under its own heading while
  // you are not searching.
  const rows = f.slice(0, shown).flatMap((e, i, list) => {
    if (tab !== 'fav' || q.trim()) return [pickRow(e)]
    const starred = isFav(st, e.id)
    const head = i === 0 || starred !== isFav(st, list[i - 1].id)
    return head ? [<p key={'h' + e.id} className="g-pk-head">{starred ? t('Starred') : t('Recently used')}</p>, pickRow(e)] : [pickRow(e)]
  })
  const newRow = <button type="button" className="g-xrow g-pk-new" onClick={create}>
    <span className="g-xrow-ph"><Icon name="plusCircle" className="g-icon" /></span>
    <span className="g-xrow-b"><b>{t('Create your own exercise')}</b><span>{t('Name it and pick a body part')}</span></span>
    <Icon name="plus" className="g-icon g-xrow-chev" />
  </button>
  const favEmpty = tab === 'fav' && f.length === 0 && !q.trim() && !filterCount

  const head = <>
    <div className="g-pk-searchrow">
      <label className="g-lf-search">
        <Icon name="magnifier" className="g-icon" />
        <input ref={searchRef} type="search" value={q} placeholder={t('Search {0} exercises…', all.length)} aria-label={t('Search {0} exercises…', all.length)}
          enterKeyHint="search" onChange={e => view.set({ q: e.target.value })} />
        {narrowed && f.length > 0 && <span className="g-pk-count" role="status" aria-label={exCount(f.length)}>{fmtNum(f.length)}</span>}
        {q && <button type="button" className="g-lf-clear" onClick={() => { view.set({ q: '' }); searchRef.current?.focus() }} aria-label={t('Clear')}><Icon name="xmark" className="g-icon" /></button>}
      </label>
      <button type="button" className={'g-pk-filter' + (filterCount ? ' on' : '')} onClick={openFilters}
        aria-label={filterCount ? t('Filters, {0} active', filterCount) : t('Filters')}>
        <Icon name="slider" className="g-icon" />
        {filterCount > 0 && <span className="g-pk-badge" aria-hidden="true">{filterCount}</span>}
      </button>
    </div>
    <div className="g-lf-tabs">
      <SegmentedControl label={t('Exercises')} value={tab} onChange={value => view.set({ tab: value })}
        options={TABS.map(value => ({ value, label: value === 'all' ? t('All') : value === 'fav' ? t('Favourites') : t('By muscle') }))} />
    </div>
  </>

  return <BottomSheet type="full" title={title || t('Add exercise')} chip={routine} chipIcon="clipboard" head={head}
    footer={multi && picked.length > 0 ? <Button block onClick={add}>{multi.label(picked.length)}</Button> : null}>
    {profile && <div className="g-pk-prof">
      <Icon name="kettlebell" className="g-icon" />
      <span>{showAll ? t('Showing all equipment') : t('Showing what you have in "{0}"', profile.name)}</span>
      <button type="button" onClick={() => view.set({ showAll: !showAll })}>{showAll ? t('Filter by "{0}"', profile.name) : t('Show all equipment')}</button>
    </div>}
    {tab === 'all' && chosenCount > 0 && <div className="g-pk-chips">
      <button type="button" className={'g-cchip' + (chosen ? ' on' : '')} aria-pressed={chosen} onClick={() => view.set({ chosen: !chosen })}>
        <Icon name="starFill" className="g-icon g-pk-cicon" />{t('Chosen')} ({chosenCount})
      </button>
    </div>}
    {tab === 'muscle' && (muscle
      ? <>
        <button type="button" className="g-xrow g-pk-back" onClick={() => view.set({ muscle: null })}>
          <Icon name="chevronLeft" className="g-icon" />
          <span className="g-xrow-b"><b>{t('All muscles')}</b></span>
        </button>
        <p className="g-pk-head">{t(MUSCLE_NAME[muscle])} · {exCount(f.length)}</p>
      </>
      : <>
        <div className="g-pk-map"><BodyMap body={st.body} selected={muscle} onMuscle={pickMuscle} label={t('Muscle map')} /></div>
        <p className="g-pk-head g-pk-hint">{t('Choose a muscle to see exercises that train it.')}</p>
      </>)}
    {favEmpty
      ? <StageEmpty tone="light" card={false} icon="star" title={t('No favourites yet')}
        body={t('Star an exercise and it lands here, with what you used lately.')}
        action={t('Browse all exercises')} onClick={() => view.set({ tab: 'all' })} />
      : <div className="g-pk-list">
        {!(tab === 'all' && chosen) && (tab !== 'muscle' || muscle) && !noExact && newRow}
        {workout?.onAddRoutine && !q.trim() && <button type="button" className="g-xrow g-pk-new" onClick={() => { close(); workout.onAddRoutine() }}>
          <span className="g-xrow-ph"><Icon name="clipboard" className="g-icon" /></span>
          <span className="g-xrow-b"><b>{t('Add routine')}</b><span>{t('Bring another routine into this session')}</span></span>
          <Icon name="plus" className="g-icon g-xrow-chev" />
        </button>}
        {rows}
        {f.length === 0 && tab === 'all' && chosen && <p className="g-pk-note">{t('Nothing picked yet. Add some exercises and they’ll show up here.')}</p>}
        {f.length === 0 && similar.length === 0 && (q.trim() || filterCount > 0) && <p className="g-pk-note">{t('No match')}</p>}
        {similar.length > 0 && <p className="g-pk-head">{f.length ? t('Similar exercises') : t('No exact match. These come close:')}</p>}
        {similar.map(pickRow)}
        {noExact && newRow}
      </div>}
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
