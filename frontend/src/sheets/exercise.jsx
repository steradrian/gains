import { useId, useMemo, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { smOf, exOr, isCustomEx } from '../lib/exercises.js'
import { fmtDate, fmtNum, exerciseNameText, fmtVol, uid, exCount } from '../lib/format.js'
import { cleanupSg, lastEntryFor, setLabel, modeOf } from '../lib/history.js'
import { t, tn, instrFor, instrTranslated, descFor, exerciseNameFor, exerciseNameClass, getLang, useLang } from '../lib/i18n.js'
import { nav, closeThenNav, onSheetEntry } from '../lib/nav.js'
import { hasProgress } from '../lib/use-exercise-progress.js'
import { visit } from '../lib/search/session.js'
import { isWorkoutPath } from '../lib/tab-route.js'
import { usesBar } from '../lib/bar.js'
import { loadKindFor, baseWeightFor } from '../lib/plates.js'
import Media, { Thumb } from '../components/Media.jsx'
import { openExternal } from '../components/CustomMedia.jsx'
import CustomExerciseForm from '../components/CustomExerciseForm.jsx'
import LineChart from '../components/LineChart.jsx'
import Icon from '../components/Icon.jsx'
import { EmptyState, ItemRow, SectionTitle, Tag } from '../components/blocks.jsx'
import { Inline } from '../components/layout.jsx'
import { cx } from '../lib/ui-kit.js'
import { Segmented } from '../components/ui.jsx'
import { glyphOf, DEFAULT_GLYPH } from '../lib/glyphs.js'
import { exerciseMuscleSnapshot, MUSCLE_NAME, muscleWeightsOf, musclesOf } from '../lib/muscles.js'
import { exerciseHistory, bestSetFor } from '../lib/exercise-history.js'
import { isBellEx, dbLoadFor, withDbLoad, currentDbLoad } from '../lib/dumbbells.js'
import { speedUnitOf } from '../lib/speed.js'
import { isFav, toggleFav } from '../lib/favourites.js'
import BodyMap from '../ds/BodyMap.jsx'
import BottomSheet from '../ds/BottomSheet.jsx'
import DetailRow from '../ds/DetailRow.jsx'
import IconButton from '../ds/IconButton.jsx'
import MenuList from '../ds/MenuList.jsx'
import Tabs from '../ds/Tabs.jsx'
import DsTag from '../ds/Tag.jsx'
import { S, update, ui, toast } from './shared.js'
import { confirmSheet } from './confirm-menu.jsx'
import { exConfigSheet } from './exercise-config.jsx'
import { barWeightSheet, DbLoadPicker } from './equipment.jsx'
import '../views/train/exercises/exercises.css'

/* ============================ exercise detail ============================ */
// A muscle the catalogue credits with nothing (a bench press's biceps, #359) is not one it trains,
// so it is not shown as a tag either; "By muscle" already leaves the exercise out.
export const trainedBy = ex => { const weights = muscleWeightsOf(ex); return slug => weights[slug] !== 0 }
// The drawer's tags: body part, main muscles, equipment, then up to three helpers. A word
// says once what it says: the body part "Chest" and the main muscle "Chest" of a bench press
// were two tags (QA 10-06), and a helper never repeats a main muscle.
export function detailTags(ex) {
  const seen = new Set()
  const out = []
  const add = (label, extra) => {
    const k = String(label || '').trim().toLocaleLowerCase()
    if (!k || seen.has(k)) return false
    seen.add(k)
    out.push({ key: out.length, label, ...extra })
    return true
  }
  add(t(ex.bp), { acc: true })
  if (ex.bp === 'cardio') add(t(MUSCLE_NAME['cardiovascular system']), { icon: 'figureStrength' })
  else for (const s of (ex.primaries?.length ? ex.primaries : (ex.tg ? [ex.tg] : [])).filter(trainedBy(ex))) add(t(MUSCLE_NAME[s] || s), { icon: 'figureStrength' })
  add(t(ex.eq), { icon: 'kettlebell' })
  let helpers = 0
  for (const s of (ex.secondaries?.length ? ex.secondaries : smOf(ex)).filter(trainedBy(ex))) {
    if (helpers >= 3) break
    if (add(t(MUSCLE_NAME[s] || s))) helpers++
  }
  return out
}

// "Best 82.5 kg × 6 · Mon 12 Oct": the best set in the mode it was last logged in, read in the
// exercise's current dumbbell meaning, or nothing when there is none.
function bestLine(st, ex) {
  const last = lastEntryFor(st, ex.id)
  const mode = modeOf({ ...(last?.target || {}), id: ex.id })
  const best = bestSetFor(st, ex.id, mode, currentDbLoad(st, ex.id))
  if (!best) return null
  let label = setLabel(ex.id, best.set, best.target, speedUnitOf(st))
  // A plain loaded set reads "82.5×6"; here it carries its unit, as the board draws it.
  const plain = fmtNum(best.set.w) + '×'
  if (mode === 'reps' && best.set.w > 0 && label.startsWith(plain)) label = `${fmtNum(best.set.w)} ${st.unit} × ${label.slice(plain.length)}`
  return t('Best {0} · {1}', label, fmtDate(best.d, true))
}

// The muscle map beside "Primary · Chest" and "Additional · Triceps, Shoulders": main muscles at
// full shade, helpers at half.
function musclesOfEx(ex) {
  const trained = trainedBy(ex)
  const prim = ex.bp === 'cardio' ? ['cardiovascular system'] : (ex.primaries?.length ? ex.primaries : (ex.tg ? [ex.tg] : [])).filter(trained)
  const sec = (ex.secondaries?.length ? ex.secondaries : smOf(ex)).filter(trained).filter(s => !prim.includes(s))
  const name = s => t(MUSCLE_NAME[s] || s)
  const levels = Object.fromEntries(Object.entries(musclesOf(ex)).map(([slug, w]) => [slug, w >= 1 ? 4 : 2]))
  return { primary: [...new Set(prim.map(name))], secondary: [...new Set(sec.map(name))], levels }
}

// What the plate-loading row says it is set to, as the workout's ⋯ menu says it.
function loadSummary(st, ex) {
  const kind = loadKindFor(st, ex.id)
  const base = baseWeightFor(st, ex.id)
  return kind === 'none' ? t('Off')
    : kind === 'single' ? t('Single stack')
      : !usesBar(ex) ? t('Per side')
        : base > 0 ? t('Bar {0}', fmtNum(base) + ' ' + st.unit) : t('No bar')
}

// The ⋯ menu sits on the drawer's history entry with one of its own. An action that leaves the
// drawer as well waits for the menu's entry to be walked off first, so the drawer's own close can
// hand its entry on (closeThenNav) and no entry is left behind.
const WALK_OFF_MS = 400
function afterMenu(closeMenu, then) {
  if (!onSheetEntry()) { closeMenu(); then(); return }
  let done = false
  const go = () => {
    if (done) return
    done = true
    clearTimeout(timer)
    globalThis.removeEventListener('popstate', go)
    then()
  }
  const timer = setTimeout(go, WALK_OFF_MS)
  globalThis.addEventListener('popstate', go)
  closeMenu()
}

const inWorkout = () => isWorkoutPath(String(globalThis.location?.hash || '').slice(1))

// Edit opens the Create exercise page (T6.4) in place of the drawer; inside a running workout it
// stays a drawer, so nobody leaves the workout.
function editCustomEx(ex, closeDrawer) {
  if (inWorkout()) { closeDrawer(); customExSheet(ex); return }
  closeThenNav(closeDrawer, '/train/exercises/new?edit=' + encodeURIComponent(ex.id))
}

function exerciseMenuSheet(ex, closeDrawer) {
  ui().openSheet(closeMenu => (
    <BottomSheet title={<span className={exerciseNameClass(ex)}>{exerciseNameFor(ex)}</span>}>
      <MenuList label={t('Exercise options')} items={[
        { key: 'edit', icon: 'pencil', label: t('Edit'), onClick: () => afterMenu(closeMenu, () => editCustomEx(ex, closeDrawer)) },
        { key: 'delete', icon: 'trash', label: t('Delete'), tone: 'danger', onClick: () => afterMenu(closeMenu, () => deleteCustomEx(ex, closeDrawer)) },
      ]} />
    </BottomSheet>
  ), { variant: 'ds' })
}

// T6.1: the exercise drawer. The head (picture, tags, best set, star, and ⋯ for a custom exercise)
// and the tabs stay put while the content scrolls. How to is the description, the muscle map, the
// steps, Add to my plan, the catalogue fix link and the exercise's own setup. Progress and History
// open the exercise's strength page (T7.0, T7.1) in the drawer's place, through a running Search
// as well (search/session.js visit); before the exercise is logged they say so instead. Inside a
// running workout, History stays the light history drawer.
function ExerciseDrawer({ ex, close }) {
  useLang() // the description and steps arrive in their own chunk the first time a drawer asks
  const st = useStore(s => s.S)
  const panelId = useId()
  const [tab, setTab] = useState('how')
  const logged = hasProgress(st, ex.id)
  const fav = isFav(st, ex.id)
  const custom = isCustomEx(ex)
  const best = bestLine(st, ex)
  const muscles = musclesOfEx(ex)
  const steps = instrFor(ex)

  const onTab = v => {
    if (v === 'how' || !logged) { setTab(v); return }
    if (v === 'history' && inWorkout()) { exerciseHistorySheet(ex.id); return }
    const path = '/progress/strength?ex=' + encodeURIComponent(ex.id) + (v === 'history' ? '&view=sets' : '')
    const replace = onSheetEntry()
    close()
    visit(path, { replace })
  }
  const flipFav = () => {
    let on = false
    update(s => { on = toggleFav(s, ex.id) })
    const name = exerciseNameText(ex)
    ui().toast(on ? t('Added {0} to favourites', name) : t('Removed {0} from favourites', name), {
      action: t('Undo'), icon: on ? 'starFill' : 'star',
      onAction: () => update(s => { if (isFav(s, ex.id) === on) toggleFav(s, ex.id) }),
    })
  }

  const head = <>
    <div className="g-xd-head">
      <span className="g-xd-pic"><Thumb ex={ex} /></span>
      <span className="g-xd-meta">
        <span className="g-xd-tags">
          {detailTags(ex).map(tg => <DsTag key={tg.key} tone={tg.acc ? 'accent' : 'muted'}>{tg.label}</DsTag>)}
        </span>
        {best && <span className="g-xd-best">{best}</span>}
      </span>
      <span className="g-xd-acts">
        <IconButton tone="tonal" icon={fav ? 'starFill' : 'star'} aria-pressed={fav} className={cx('g-xd-star', fav && 'on')}
          label={fav ? t('Remove from favourites') : t('Add to favourites')} onClick={flipFav} />
        {custom && <IconButton tone="tonal" icon="more" label={t('Exercise options')} onClick={() => exerciseMenuSheet(ex, close)} />}
      </span>
    </div>
    <Tabs ariaLabel={t('Exercise views')} value={tab} onChange={onTab} controls={panelId}
      options={[{ value: 'how', label: t('How to') }, { value: 'progress', label: t('Progress') }, { value: 'history', label: t('History') }]} />
  </>

  return (
    <BottomSheet type="full" title={<span className={exerciseNameClass(ex)}>{exerciseNameFor(ex)}</span>} head={head}>
      <div id={panelId} role="tabpanel" className="g-xd-panel">
        {tab !== 'how' ? <p className="g-xd-empty">{t('No sessions logged yet')}</p> : <>
          <Media ex={ex} compact />
          {descFor(ex) && <p className="g-xd-desc">{descFor(ex)}</p>}
          {(muscles.primary.length > 0 || muscles.secondary.length > 0) && (
            <div className="g-xd-muscles">
              <BodyMap tone="light" body={st.body} levels={muscles.levels} width={74} />
              <span className="g-xd-mlines">
                {muscles.primary.length > 0 && <span><b>{t('Primary')}</b> · {muscles.primary.join(', ')}</span>}
                {muscles.secondary.length > 0 && <span><b>{t('Additional')}</b> · {muscles.secondary.join(', ')}</span>}
              </span>
            </div>
          )}
          {steps.length > 0 && <>
            {getLang() !== 'en' && !instrTranslated(ex) && <p className="g-xd-note">{t('instructions in English')}</p>}
            <ol className="g-xd-steps">
              {steps.map((s, i) => <li key={i}><span aria-hidden="true">{i + 1}</span>{s}</li>)}
            </ol>
          </>}
          <div className="g-xd-rows">
            <DetailRow icon="plus" title={t('Add to my plan')} sub={t('Pick a routine. Sets, reps and weight come next.')} onClick={() => addToRoutineSheet(ex)} />
            {/* The catalogue is community-edited (catalogue/README.md): a wrong muscle, a clumsy step or
                a missing translation is one tap from an issue that already names the exercise. */}
            {!custom && !ex.missing && <DetailRow icon="pencil" title={t('Suggest a fix for this exercise')} sub={t('Opens the catalogue on GitHub')}
              onClick={() => openExternal('https://github.com/steradrian/gains/issues/new?template=exercise.yml&exercise=' + encodeURIComponent(ex.id + ', ' + ex.n))} />}
          </div>
          <ExerciseSetup ex={ex} st={st} />
        </>}
      </div>
    </BottomSheet>
  )
}

// "Your setup": how this exercise is loaded wherever it is logged. Plate loading opens its own
// drawer; Weight means (S.dbLoad, stamped like the loading) is picked here. A routine can still
// pick its own meaning on the exercise's settings.
function ExerciseSetup({ ex, st }) {
  const plates = modeOf({ id: ex.id }) === 'reps'
  const bell = isBellEx(ex)
  if (!plates && !bell) return null
  return (
    <div className="g-xd-setup">
      <h3>{t('Your setup')}</h3>
      {plates && <DetailRow icon="plate" title={t('Plate loading')} value={loadSummary(st, ex)} onClick={() => barWeightSheet(ex.id)} />}
      {bell && <>
        <DetailRow icon="dumbbell" title={t('Weight means')} />
        <DbLoadPicker ex={ex} value={dbLoadFor(st, ex.id)} onChange={v => update(s => { s.dbLoad = withDbLoad(s.dbLoad, ex.id, v) })} />
      </>}
    </div>
  )
}

// The second argument ({ progress }, from Search) is still accepted; every drawer now has Progress
// and History, so it changes nothing.
export const exerciseDetailSheet = ex => ui().openSheet(close => <ExerciseDrawer ex={ex} close={close} />, { variant: 'ds' })

/* ============================ exercise history ============================ */
// What you did on this exercise before, reachable mid-workout (issue #43): the curve first,
// then the last sessions set by set, so the question "what did I do last month" is answered
// without leaving the workout for Stats. Derived once per log change — the sheet re-renders on
// every store tick while a session runs, and LineChart drops its hover whenever `points`
// changes identity, so a series rebuilt per render would lose the tooltip under your finger.
function ExerciseHistory({ exId }) {
  const st = useStore(s => s.S)
  const ex = exOr(exId)
  const h = useMemo(() => exerciseHistory(st, exId), [st.workouts, exId])
  const [curve, setCurve] = useState('top')
  const onE1 = curve === 'e1rm' && h.e1rmPoints.length > 0
  const unit = h.metric === 'weight' ? st.unit : h.metric === 'reps' ? t('reps') : h.metric === 'sec' ? 's' : t('min')
  const e1Best = useMemo(() => Math.max(0, ...h.e1rmPoints.map(p => p.y)), [h])
  if (!h.total) return <>
    <h3 className={exerciseNameClass(ex)}>{exerciseNameFor(ex)}</h3>
    <EmptyState icon="history">{t('No sessions logged yet')}</EmptyState>
  </>
  const tail = s => [
    s.volume > 0 && t('Volume') + ' ' + fmtVol(s.volume, st.unit),
    s.e1rm != null && t('Est. 1RM') + ' ' + fmtNum(s.e1rm) + ' ' + st.unit,
  ].filter(Boolean).join(' · ')
  return <>
    <h3 className={cx(exerciseNameClass(ex), 'mb-1')}>{exerciseNameFor(ex)}</h3>
    <div className="muted small mb-5">{t('Exercise history')} · {tn('{0} session', '{0} sessions', h.total)}</div>
    {/* Only reps work with a load produces an estimate, so the toggle is absent for the rest. */}
    {h.e1rmPoints.length > 0 && h.metric === 'weight' && <Segmented className="seg-range" value={curve} onChange={setCurve}
      options={[{ value: 'top', label: t('Top set') }, { value: 'e1rm', label: t('Est. 1RM') }]} />}
    <div className="chart mt-4">
      <LineChart points={onE1 ? h.e1rmPoints : h.points} h={140} unit={onE1 ? st.unit : unit} color="var(--blue)" label={exerciseNameFor(ex) + ' · ' + t(onE1 ? 'Est. 1RM' : 'Top set')} />
    </div>
    <Inline gap={2.5} className="small mt-3 mb-2">
      <Icon name="trophy" className="ink-warn" style={{ fontSize: 14 }} />
      {t('Best:')} <b className="accent">{fmtNum(onE1 ? e1Best : h.best)} {onE1 ? st.unit : unit}</b>
    </Inline>
    <SectionTitle>{h.sessions.length < h.total ? t('Last {0} sessions', h.sessions.length) : t('Sessions')}</SectionTitle>
    <div className="list">
      {h.sessions.map(s => <div key={s.id} className="item ai-start">
        <div className="grow">
          <div className="tt">{fmtDate(s.d, true)} {s.pr && <span className="pr"><Icon name="trophy" />PR</span>}</div>
          <div className="ss">{s.sets.map(x => setLabel(exId, x, s.target, speedUnitOf(st))).join('  ·  ')}</div>
          {tail(s) && <div className="small dim" style={{ marginTop: 3 }}>{tail(s)}</div>}
        </div>
        {s.value != null && s.value > 0 && <b className="accent nocap" style={{ whiteSpace: 'nowrap' }}>{fmtNum(s.value)} {unit}</b>}
      </div>)}
    </div>
  </>
}
export const exerciseHistorySheet = exId => ui().openSheet(close => <ExerciseHistory exId={exId} close={close} />)

/* ============================ add to routine ============================ */
// The new entry's config starts from defaultConfig (lib/history.js), which a custom exercise's own
// "How you log it" seeds (customExDefaults); the routine's existing entries are never touched.
// While a workout runs this still works: "New routine" creates the routine and opens its editor,
// and starts nothing.
function AddToRoutine({ ex, close }) {
  const st = useStore(s => s.S)
  const pick = rid => {
    close()
    const isNew = rid === '_new'
    exConfigSheet(ex, null, cfg => {
      update(s => {
        let r = isNew ? { id: uid(), name: t('New routine'), emoji: DEFAULT_GLYPH, ex: [] } : s.routines.find(x => x.id === rid)
        if (isNew) s.routines.push(r)
        if (r) r.ex.push({ id: ex.id, ...cfg })
      })
      const r = isNew ? S().routines[S().routines.length - 1] : st.routines.find(x => x.id === rid)
      toast(t('“{0}” added to {1}', exerciseNameText(ex), r ? r.name : t('routine')))
      if (isNew && r) nav('/train/routines/' + r.id)
    }, null, isNew ? null : st.routines.find(x => x.id === rid))
  }
  return <>
    <h3 className={exerciseNameClass(ex)}>{t('Add “{0}”', exerciseNameFor(ex))}</h3>
    <div className="muted small mb-6">{t('Pick a routine. Sets, reps and weight come next.')}</div>
    <div className="list">
      {st.routines.map(r => <ItemRow key={r.id}
        lead={<span className="lrow-i"><Icon name={glyphOf(r.emoji)} /></span>}
        title={r.name}
        subtitle={exCount(r.ex.length)}
        trailing={<>{r.ex.some(e => e.id === ex.id) && <Tag>{t('already in')}</Tag>}<Icon name="plus" className="chev" /></>}
        onClick={() => pick(r.id)} />)}
      <ItemRow
        lead={<span className="lrow-i" style={{ background: 'var(--surface-3)' }}><Icon name="plusCircle" /></span>}
        title={t('New routine')}
        subtitle={t('Create one and start with this exercise')}
        trailing={<Icon name="plus" className="chev" />}
        onClick={() => pick('_new')} />
    </div>
  </>
}
export const addToRoutineSheet = ex => ui().openSheet(close => <AddToRoutine ex={ex} close={close} />)

/* ============================ custom exercises (issue #11) ============================ */
// The drawer host of the Create exercise form (T6.4), for the callers that sit inside a drawer or
// the workout (the picker, the exercise settings, the + sheet, Search). The page host is
// views/train/exercises/CreateExercise.jsx.
function CustomExerciseDrawer({ existing, prefill, onDone, close }) {
  return (
    <BottomSheet type="full" title={existing ? t('Edit custom exercise') : t('New exercise')}>
      <CustomExerciseForm existing={existing} prefill={prefill} tone="light"
        onSaved={ex => { close(); onDone?.(ex) }}
        onDelete={existing ? () => { close(); deleteCustomEx(existing) } : undefined} />
    </BottomSheet>
  )
}
export const customExSheet = (existing, onDone, prefill) => ui().openSheet(close => <CustomExerciseDrawer existing={existing} prefill={prefill} onDone={onDone} close={close} />, { variant: 'ds' })

export function deleteCustomEx(ex, afterDelete) {
  if (S().active?.entries.some(e => e.id === ex.id)) { toast(t('Finish your current workout first')); return }
  confirmSheet({
    title: t('Delete “{0}”?', ex.n),
    message: t('It will be removed from your routines. Already-logged workouts keep their sets.'),
    confirmText: t('Delete'), danger: true,
    onConfirm: () => {
      update(s => {
        // Keep display and muscle metadata in history before the custom catalogue row disappears.
        const snapshot = exerciseMuscleSnapshot(ex)
        s.workouts.forEach(w => w.entries.forEach(e => {
          if (e.id !== ex.id) return
          e.n = ex.n
          if (!e.muscleSnapshot || !Object.keys(e.muscleSnapshot).length) e.muscleSnapshot = snapshot
        }))
        s.customEx = (s.customEx || []).filter(x => x.id !== ex.id)
        s.routines.forEach(r => { r.ex = r.ex.filter(e => e.id !== ex.id); cleanupSg(r.ex) })
        delete s.exWeights[ex.id]
        s.favEx = (s.favEx || []).filter(id => id !== ex.id)
      })
      toast(t('Exercise deleted'))
      afterDelete && afterDelete()
    }
  })
}
