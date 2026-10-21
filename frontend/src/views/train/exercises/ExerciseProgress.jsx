import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Icon from '../../../components/Icon.jsx'
import { Thumb } from '../../../components/Media.jsx'
import OneRmCalculator from '../../../components/OneRmCalculator.jsx'
import PastSetsList from '../../../components/PastSetsList.jsx'
import { selectSheet } from '../../../components/ui.jsx'
import GlassRow from '../../../ds/GlassRow.jsx'
import LineChart from '../../../ds/LineChart.jsx'
import StageEmpty from '../../../ds/StageEmpty.jsx'
import StagePage from '../../../ds/StagePage.jsx'
import StageSection from '../../../ds/StageSection.jsx'
import StageSegmented from '../../../ds/StageSegmented.jsx'
import StatTiles from '../../../ds/StatTiles.jsx'
import { EXIDX, isAssisted, isCardio, matchExercise } from '../../../lib/exercises.js'
import { bestSetIndex, exerciseHistory, trendDelta } from '../../../lib/exercise-history.js'
import { bestSetLabel } from '../../../lib/best-set.js'
import { exerciseNameText, fmtDate, fmtMonth, fmtNum, fmtVol } from '../../../lib/format.js'
import { setLabel } from '../../../lib/history.js'
import { t } from '../../../lib/i18n.js'
import { rangeFrom, rangeOptions } from '../../../lib/progress-range.js'
import { useExerciseProgress } from '../../../lib/use-exercise-progress.js'
import { useStore } from '../../../store/useStore.js'
import { exerciseDetailSheet, workoutDetailSheet } from '../../../sheets.jsx'
import './progress.css'

const NEW_BESTS = 3
const AXIS_LABELS = 4

// The period the hero line says it covers, for the ranges the segmented control offers.
const periodOf = range => ({ 30: t('1 month'), 90: t('3 months'), 365: t('1 year') })[range]

// Month names under the line: a few, evenly spread over the points the chart draws.
function axisOf(points) {
  const n = points.length
  const k = Math.min(AXIS_LABELS, n)
  return Array.from({ length: k }, (_, i) => fmtMonth(points[Math.round((i * (n - 1)) / Math.max(1, k - 1))].d))
}

// T7.0 Progress and T7.1 Past sets, /progress/strength?ex=<id>[&range=<days>][&view=sets]: one
// exercise's trend and what it did, on the stage. The exercise, the range and the view are in the
// address (replaced, never pushed), so a reload comes back to them and back leaves the page.
// An id with no logged sessions stays on that exercise with an empty state; with no workouts at
// all "No lifts yet" shows whatever ?ex= says. Without ?ex= the exercise trained heaviest opens;
// without ?range= the chart starts on All.
export default function ExerciseProgress() {
  const nav = useNavigate()
  const { search } = useLocation()
  const S = useStore(s => s.S)
  const [exId, setExId] = useState(() => new URLSearchParams(search).get('ex'))
  const [picked, setPicked] = useState(null)
  const [exRange, setExRange] = useState(() => rangeFrom(search, 0))
  const [view, setView] = useState(() => (new URLSearchParams(search).get('view') === 'sets' ? 'sets' : 'progress'))
  // The estimated 1RM leads when the exercise has one, as the board draws it; the chart falls back
  // to the top set on its own for the rest.
  const p = useExerciseProgress(S, { exId, exRange, exMetric: picked ?? 'e1rm' })
  const { curEx, hd } = p
  // The address names an exercise the log has no sets for; curEx is then the heaviest lift.
  const unlogged = !!curEx && !!exId && curEx !== exId
  const shownId = unlogged ? exId : curEx
  const h = useMemo(() => exerciseHistory(S, shownId, { limit: Infinity }), [S, shownId])

  const write = (key, value) => {
    const q = new URLSearchParams(search)
    if (value == null) q.delete(key)
    else q.set(key, value)
    const query = q.toString()
    nav('/progress/strength' + (query ? '?' + query : ''), { replace: true })
  }
  const pickEx = id => { setExId(id); write('ex', id) }
  const pickRange = v => { setExRange(v); write('range', v) }
  const pickView = v => { setView(v); write('view', v === 'sets' ? 'sets' : null) }

  const labelOf = id => (EXIDX[id] ? exerciseNameText(EXIDX[id]) : p.nameOf(id))
  // An id that is neither in the catalogue nor in the log: no name to show but the id itself.
  const unknownEx = id => !EXIDX[id] && p.nameOf(id) === id
  const openPicker = () => selectSheet({
    title: t('Exercise'), value: shownId, onChange: pickEx,
    options: p.exHist.map(id => ({ value: id, label: labelOf(id) + (p.exCurrent[id].mx ? ' · ' + fmtNum(p.exCurrent[id].mx) + ' ' + p.exCurrent[id].unit : '') })),
    search: {
      placeholder: t('Search…'),
      label: t('Search…'),
      emptyLabel: t('No match'),
      match: (option, query) => matchExercise(p.matcherOf(option.value), query),
    },
  })
  const openWorkout = id => {
    const w = S.workouts.find(x => x.id === id)
    if (w) workoutDetailSheet(w)
  }

  if (!curEx) {
    return (
      <StagePage title={t('Strength')} parent="/progress">
        <div className="g-xp">
          <StageEmpty icon="trophy" title={t('No lifts yet')} body={t('Finish your first workout and your progress curves will show up here.')} />
        </div>
      </StagePage>
    )
  }

  const ex = EXIDX[shownId] || { id: shownId, n: p.nameOf(shownId), missing: true }
  const title = unknownEx(shownId) ? t('Unknown exercise') : labelOf(shownId)
  const actions = EXIDX[shownId] ? [{ icon: 'info', label: t('How to'), onClick: () => exerciseDetailSheet(EXIDX[shownId]) }] : []
  const pill = (
    <button type="button" className="g-xp-pick g-glass" aria-haspopup="dialog" onClick={openPicker}>
      {t('Change exercise')}<Icon name="chevronDown" className="g-icon" />
    </button>
  )

  const strip = (
    <StageSegmented label={t('Exercise views')} value={view} onChange={pickView}
      options={[{ value: 'progress', label: t('Progress') }, { value: 'sets', label: t('History') }]} />
  )

  // The exercise stays on its page with its empty states, in both views, and the picker to leave it.
  if (unlogged) {
    return (
      <StagePage title={title} actions={actions} parent="/progress">
        <div className="g-xp">
          {pill}
          {strip}
          {view === 'sets'
            ? <PastSetsList exId={shownId} history={h} />
            : <StageEmpty icon="trophy" title={t('No sets logged yet')} body={t('Log it in a workout and its curve shows up here.')} />}
        </div>
      </StagePage>
    )
  }

  if (view === 'sets') {
    return (
      <StagePage title={title} actions={actions} parent="/progress">
        <div className="g-xp">
          {pill}
          {strip}
          <PastSetsList exId={shownId} history={h} onOpen={openWorkout} />
        </div>
      </StagePage>
    )
  }

  const best = p.onE1 ? { value: p.e1Best.est, unit: S.unit, eyebrow: t('Best estimated 1RM') }
    : p.onMax ? { value: p.maxBest, unit: t('reps'), eyebrow: t('Most reps in a Max set') }
    : { value: p.exBest, unit: p.exUnit, eyebrow: p.curCardio ? t('Top speed') : p.curTimed ? t('Longest hold') : p.repsOnly ? t('Most reps in a set') : t('Best set') }
  const caption = p.onSets ? (p.perSet.metric === 'reps' ? t('Reps in each working set, one line per set number') : t('Estimated 1RM of each working set, one line per set number'))
    : p.onMax ? t('Most reps in a Max set per workout')
    : p.onEff ? t('Average effort per workout')
    : p.onE1 ? t('Estimated 1RM per workout')
    : p.curCardio ? t('Top speed per workout') : p.curTimed ? t('Longest hold per workout') : p.repsOnly ? t('Most reps in a set per workout') : t('Best set weight per workout')
  const chartUnit = p.onE1 ? S.unit : p.onMax ? t('reps') : p.onEff ? hd : p.exUnit

  // "up 6 kg in 3 months": said for the weight, estimate and rep lines when the window holds two
  // points and they differ. Effort is not a gain, and the per-set lines have no single number.
  const trend = p.onSets || p.onEff ? null : trendDelta(p.chartPts)
  const trendLine = (() => {
    if (!trend || !trend.delta) return null
    const amount = fmtNum(Math.abs(trend.delta)) + ' ' + chartUnit
    const up = trend.delta > 0
    const period = periodOf(exRange)
    if (period) return up ? t('up {0} in {1}', amount, period) : t('down {0} in {1}', amount, period)
    const since = fmtMonth(p.chartPts[0].d, true)
    return up ? t('up {0} since {1}', amount, since) : t('down {0} since {1}', amount, since)
  })()

  const bestSet = bestSetLabel(S, ex)
  const oldest = h.sessions.at(-1)
  // "Last workout" is only said when the newest session has a volume to show.
  const lastVolume = h.sessions[0]?.volume > 0 ? h.sessions[0].volume : null
  // The best set reads "82.5 kg" with "× 6 · Mon 12 Oct" under it when it is a loaded rep set.
  const [bestValue, ...bestRest] = bestSet ? bestSet.label.split(' × ') : []
  const tiles = [
    bestSet && { label: t('Best set'), value: bestValue, sub: (bestRest.length ? '× ' + bestRest.join(' × ') + ' · ' : '') + fmtDate(bestSet.d, true) },
    oldest && { label: t('Sessions'), value: fmtNum(h.total), sub: t('since {0}', fmtMonth(oldest.d, true)) },
    lastVolume && { label: t('Volume'), value: fmtVol(lastVolume, S.unit), sub: t('last workout') },
  ].filter(Boolean)

  const bests = h.sessions.filter(s => s.pr).slice(0, NEW_BESTS)
  const chartShort = p.chartPts.length < 2
  const points = p.chartPts

  let chart
  if (chartShort) {
    chart = (
      <p className="g-xp-short g-glass">
        {exRange !== 0 && h.points.length >= 2 ? t('Fewer than two workouts in this period. Pick a longer one.') : t('Log it twice to see a trend.')}
      </p>
    )
  } else if (p.onSets) {
    // One line per set number, on the anchoring sessions' dates; a set number a session did not
    // reach leaves a gap.
    const anchors = p.perSetChart.anchors
    const setUnit = p.perSet.metric === 'reps' ? t('reps') : S.unit
    chart = <>
      <LineChart
        tone="stage" label={caption} unit={setUnit} labels={axisOf(anchors)}
        values={anchors.map(a => a.y)}
        pointLabels={anchors.map(a => fmtDate(a.d, true) + (a.note ? ': ' + a.note : ''))}
        series={p.perSetChart.series.map(s => ({ color: s.color, values: anchors.map(a => s.points.find(q => q.t === a.t)?.y ?? null) }))}
      />
      <span className="g-xp-keys">
        {p.perSetChart.ns.map(n => <span key={n}><i className={'set-key set-key-' + n} aria-hidden="true" />{t('Set {0}', n)}</span>)}
      </span>
      {(p.perSet.drop || p.perSet.hidden > 0) && (
        <span className="g-xp-fine">
          {p.perSet.drop && t('Where you most often drop off: set {0} ({1} of {2} workouts)', p.perSet.drop.n, p.perSet.drop.count, p.perSet.drop.of)}
          {p.perSet.drop && p.perSet.hidden > 0 ? ' · ' : ''}
          {p.perSet.hidden > 0 && t('Only the first {0} sets are drawn.', p.perSet.ns.length)}
        </span>
      )}
    </>
  } else {
    // Effort reads the other way when it is counted in reps left: fewer is a harder set, so the
    // line is drawn flipped and the readout keeps the real number.
    chart = (
      <LineChart
        tone="stage" label={caption} unit={chartUnit} labels={axisOf(points)}
        values={points.map(x => (p.onEff && p.kind === 'rir' ? -x.y : x.y))}
        marks={p.shown === 'top' ? points.map(x => x.m) : undefined}
        pointLabels={points.map(x => fmtDate(x.d, true) + ': ' + fmtNum(x.y) + ' ' + chartUnit + (x.note ? ' · ' + x.note : ''))}
      />
    )
  }

  return (
    <StagePage title={title} actions={actions} parent="/progress">
      <div className="g-xp">
        {pill}
        {strip}
        <div className="g-xp-hero">
          <span className="g-xp-pic"><Thumb ex={ex} /></span>
          <div className="g-xp-hb">
            <b className="g-xp-big">{fmtNum(best.value)}<small> {best.unit}</small></b>
            <span className="g-xp-line">{trendLine ? best.eyebrow + ' · ' + trendLine : best.eyebrow}</span>
            {p.onE1 && (
              <span className="g-xp-fine">
                {t('Best estimate from {0} on {1}. An estimate, not a tested max.', fmtNum(p.e1Best.w) + ' ' + S.unit + ' × ' + p.e1Best.r, fmtDate(p.e1Best.d, true))}
              </span>
            )}
          </div>
        </div>
        <StageSegmented label={t('Range')} value={exRange} onChange={pickRange} options={rangeOptions()} />
        {p.options.length > 1 && <StageSegmented label={t('Chart')} value={p.shown} onChange={setPicked} options={p.options} />}
        {chart}
        {!chartShort && !p.onSets && <p className="g-xp-fine">{caption}</p>}
        {!chartShort && p.shown === 'top' && p.showEff && (
          <p className="g-xp-fine">{t('A fuller dot means less left in the tank. The same weight at a lower {0} is progress the line alone doesn’t show.', hd)}</p>
        )}
        <StatTiles tone="stage" items={tiles} />
        {bests.length > 0 && <>
          <StageSection title={t('New bests')} />
          <div className="g-xp-list">
            {bests.map(s => (
              <GlassRow key={s.id} trailing="chev" onClick={() => pickView('sets')}
                title={setLabel(shownId, s.sets[bestSetIndex(s, h.metric)], s.target, p.speedUnit)}
                sub={fmtDate(s.d, true) + (s.e1rm != null ? ' · ' + t('est. 1RM {0}', fmtNum(s.e1rm) + ' ' + S.unit) : '')} />
            ))}
          </div>
        </>}
        {!isCardio(ex) && !isAssisted(ex) && (
          <div className="g-xp-light"><OneRmCalculator ex={ex} /></div>
        )}
        <GlassRow trailing="chev" title={t('Structural balance')} sub={t('See which lift is holding back the rest.')}
          onClick={() => nav('/progress/strength/balance')} />
      </div>
    </StagePage>
  )
}
