import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { EXIDX, matchExercise } from '../lib/exercises.js'
import { setLabel } from '../lib/history.js'
import { fmtNum, fmtDate, exerciseNameText } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { rangeFrom, rangeOptions } from '../lib/progress-range.js'
import { useExerciseProgress } from '../lib/use-exercise-progress.js'
import { exerciseDetailSheet, exerciseHistorySheet, menuSheet, workoutDetailSheet } from '../sheets.jsx'
import { Inline, Page } from '../components/layout.jsx'
import { Card, EmptyState } from '../components/blocks.jsx'
import LineChart from '../components/LineChart.jsx'
import Icon from '../components/Icon.jsx'
import { Thumb } from '../components/Media.jsx'
import { HeroStatus, MediaRow, SectionHeader, TabSection } from '../components/tab-kit.jsx'
import { Row, Section, Segmented, selectSheet } from '../components/ui.jsx'

// Progress › Strength (ux-redesign-tabs §4.3, ui-redesign-components §4), in order: the exercise
// (its card opens the picker), its best, the chart metric, the range, the chart, the last five
// sessions and the way into Structural balance. ⋯ holds the exercise's details and its history.
//
// Deep link: /progress/strength?ex=<exercise id>[&range=<days>] opens on that exercise (Search's
// exercise sheet links to it with ?ex=). An id with no logged sessions, or none in the catalogue,
// stays on that exercise: its card and an empty state in place of the chart, the picker still
// there to switch, and ⋯ offering just its details. With no workouts at all, "No lifts yet"
// shows whatever ?ex= says. Without ?ex= the exercise trained heaviest opens. Without ?range= the chart
// starts on All; picking another exercise or range writes it to the address (replace), so a
// reload comes back to it.
export default function Strength() {
  const nav = useNavigate()
  const { search } = useLocation()
  const S = useStore(s => s.S)
  const [exId, setExId] = useState(() => new URLSearchParams(search).get('ex'))
  const [exMetric, setExMetric] = useState('top')
  const [exRange, setExRange] = useState(() => rangeFrom(search, 0))
  const p = useExerciseProgress(S, { exId, exRange, exMetric })
  const { curEx, hd, kind } = p
  // The address names an exercise the log has no sets for; curEx is then the heaviest lift.
  const unlogged = !!curEx && !!exId && curEx !== exId

  const write = (key, value) => {
    const q = new URLSearchParams(search)
    q.set(key, value)
    nav('/progress/strength?' + q, { replace: true })
  }
  const pickEx = id => { setExId(id); write('ex', id) }
  const pickRange = v => { setExRange(v); write('range', v) }
  const labelOf = id => (EXIDX[id] ? exerciseNameText(EXIDX[id]) : p.nameOf(id))
  const openPicker = () => selectSheet({
    title: t('Exercise'), value: unlogged ? exId : curEx, onChange: pickEx,
    options: p.exHist.map(id => ({ value: id, label: labelOf(id) + (p.exCurrent[id].mx ? ' · ' + fmtNum(p.exCurrent[id].mx) + ' ' + p.exCurrent[id].unit : '') })),
    search: {
      placeholder: t('Search…'),
      label: t('Search…'),
      emptyLabel: t('No match'),
      match: (option, query) => matchExercise(p.matcherOf(option.value), query),
    },
  })
  // An id that is neither in the catalogue nor in the log: no name to show but the id itself.
  const unknownEx = id => !EXIDX[id] && p.nameOf(id) === id
  const exerciseCard = (id, subtitle) => <TabSection>
    <MediaRow variant="exercise" art={<Thumb ex={EXIDX[id] || { id, n: p.nameOf(id), missing: true }} />}
      title={unknownEx(id) ? t('Unknown exercise') : labelOf(id)} subtitle={subtitle} onOpen={openPicker} chevron />
  </TabSection>
  const detailsItem = id => EXIDX[id] && { icon: 'info', label: t('Exercise details'), onClick: () => exerciseDetailSheet(EXIDX[id]) }
  const moreButton = (id, items) => <button type="button" className="iconbtn" aria-label={t('More')} onClick={() => menuSheet({
    title: labelOf(id), items,
  })}><Icon name="more" /></button>
  // The exercise with no sets has no history to open: only its details, and only for a catalogue id.
  const more = !curEx ? null
    : unlogged ? EXIDX[exId] && moreButton(exId, [detailsItem(exId)])
    : moreButton(curEx, [detailsItem(curEx), { icon: 'history', label: t('Exercise history'), onClick: () => exerciseHistorySheet(curEx) }])

  if (!curEx) {
    return <Page title={t('Strength')}>
      <EmptyState icon="trophy" title={t('No lifts yet')}>{t('Finish your first workout and your progress curves will show up here.')}</EmptyState>
    </Page>
  }

  if (unlogged) {
    return <Page title={t('Strength')} action={more}>
      {exerciseCard(exId, t('Change exercise'))}
      <TabSection>
        <Card>
          <EmptyState icon="trophy" title={t('No sets logged yet')}>{t('Log it in a workout and its curve shows up here.')}</EmptyState>
        </Card>
      </TabSection>
    </Page>
  }

  const best = p.onE1 ? { value: p.e1Best.est, unit: S.unit, eyebrow: t('Best estimated 1RM') }
    : p.onMax ? { value: p.maxBest, unit: t('reps'), eyebrow: t('Most reps in a Max set') }
    : { value: p.exBest, unit: p.exUnit, eyebrow: p.curCardio ? t('Top speed') : p.curTimed ? t('Longest hold') : p.repsOnly ? t('Most reps in a set') : t('Best set') }
  const caption = p.onSets ? (p.perSet.metric === 'reps' ? t('Reps in each working set, one line per set number') : t('Estimated 1RM of each working set, one line per set number'))
    : p.onMax ? t('Most reps in a Max set per workout')
    : p.onEff ? t('Average effort per workout')
    : p.onE1 ? t('Estimated 1RM per workout')
    : p.curCardio ? t('Top speed per workout') : p.curTimed ? t('Longest hold per workout') : p.repsOnly ? t('Most reps in a set per workout') : t('Best set weight per workout')
  const current = p.exCurrent[curEx]

  return <Page title={t('Strength')} action={more}>
    {exerciseCard(curEx, current.mx ? t('Now {0}', fmtNum(current.mx) + ' ' + current.unit) : t('Change exercise'))}
    <TabSection>
      <HeroStatus eyebrow={best.eyebrow} value={fmtNum(best.value)} unit={best.unit}
        caption={p.onE1 ? t('Best estimate from {0} on {1}. An estimate, not a tested max.', fmtNum(p.e1Best.w) + ' ' + S.unit + ' × ' + p.e1Best.r, fmtDate(p.e1Best.d, true)) : t('All time')} />
    </TabSection>
    <TabSection>
      {p.options.length > 1 && <Segmented className="seg-range" ariaLabel={t('Chart')} value={p.shown} onChange={setExMetric} options={p.options} />}
      <Segmented className="seg-range" ariaLabel={t('Range')} value={exRange} onChange={pickRange} options={rangeOptions()} />
      <Card>
        <div className="chart">
          {p.rangeTooShort
            ? <EmptyState className="small">{t('Fewer than two workouts in this period. Pick a longer one.')}</EmptyState>
            : p.onSets
            ? <LineChart points={p.perSetChart.anchors} series={p.perSetChart.series} h={150} unit={p.perSet.metric === 'reps' ? t('reps') : S.unit} label={caption} />
            : p.onMax
            ? <LineChart points={p.maxChartPts} h={150} unit={t('reps')} color="var(--blue)" label={caption} />
            : p.onEff
            ? <LineChart points={p.effPts} h={150} unit={hd} color="var(--yellow)" invert={kind === 'rir'} label={caption} />
            : <LineChart points={p.chartPts} h={150} unit={p.exUnit} color="var(--blue)" label={caption} />}
        </div>
        {p.onSets && !p.rangeTooShort && <Inline gap={6} wrap className="small mt-3">
          {p.perSetChart.ns.map(n => <Inline key={n} as="span" gap={2.5}>
            <span className={'set-key set-key-' + n} aria-hidden="true" />{t('Set {0}', n)}
          </Inline>)}
        </Inline>}
        <div className="small dim mt-4">{caption}</div>
        {p.onSets && (p.perSet.drop || p.perSet.hidden > 0) && <div className="small dim mt-2">
          {p.perSet.drop && t('Where you most often drop off: set {0} ({1} of {2} workouts)', p.perSet.drop.n, p.perSet.drop.count, p.perSet.drop.of)}
          {p.perSet.drop && p.perSet.hidden > 0 ? ' · ' : ''}
          {p.perSet.hidden > 0 && t('Only the first {0} sets are drawn.', p.perSet.ns.length)}
        </div>}
        {p.shown === 'top' && p.showEff && <div className="small dim mt-2">
          {t('A fuller dot means less left in the tank. The same weight at a lower {0} is progress the line alone doesn’t show.', hd)}
        </div>}
      </Card>
    </TabSection>
    <TabSection>
      <SectionHeader title={t('Session history')} />
      <Section>
        {p.sessions.map(s => <Row key={s.t + ':' + s.d} title={fmtDate(s.d, true)}
          subtitle={s.sets.map(x => setLabel(curEx, x, s.target, p.speedUnit)).join('  ')}
          accessory="chevron" onClick={() => workoutDetailSheet(s.w)} />)}
      </Section>
    </TabSection>
    <TabSection>
      <Section>
        <Row glyph="scale" title={t('Structural balance')} subtitle={t('See which lift is holding back the rest.')}
          accessory="chevron" onClick={() => nav('/progress/strength/balance')} />
      </Section>
    </TabSection>
  </Page>
}
