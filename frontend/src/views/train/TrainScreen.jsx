import { useEffect, useMemo, useRef, useState } from 'react'
import { t } from '../../lib/i18n.js'
import { useDsAccent } from '../../lib/use-ds-accent.js'
import Elapsed from '../../components/Elapsed.jsx'
import { Page } from '../../components/layout.jsx'
import GlassActions from '../../ds/GlassActions.jsx'
import GlassList from '../../ds/GlassList.jsx'
import InlineBanner from '../../ds/InlineBanner.jsx'
import MusclesCard from '../../ds/MusclesCard.jsx'
import RingCarousel from '../../ds/RingCarousel.jsx'
import RoutineTiles from '../../ds/RoutineTiles.jsx'
import StageDayRail from '../../ds/StageDayRail.jsx'
import StageEmpty from '../../ds/StageEmpty.jsx'
import StageHeader from '../../ds/StageHeader.jsx'
import StageScreen from '../../ds/StageScreen.jsx'
import StageSection from '../../ds/StageSection.jsx'
import StageTrainCard from '../../ds/StageTrainCard.jsx'
import './train.css'

// The root shows the first few routines; Routines' See all has every one.
const ROUTINES = 3
const INTENT_ICON = { start: 'play', resume: 'play', 'train-anyway': 'play', 'see-workout': 'trophy', 'log-workout': 'plus' }
const MORE_ICON = { history: 'history', load: 'chartLine', coach: 'chat', plans: 'clipboard', gym: 'kettlebell', checkin: 'checkCircle' }

// Train on the stage (boards Tr2Train to Tr2Future): the header, the day rail, the missed-day
// banner, the rings, the four actions, the selected day's card, Routines and Your training; with
// training not set up (T2.9), the invitation instead. It draws what useTrain() gives it; the only
// state it keeps is the rail's page, which follows the selected day. The floating tab bar is the
// app's (#tabbar). While the search is open the tab root's own header (<Page root>) stands in,
// since the app's search types into its input. `ring` is the page the rings open on.
export default function TrainScreen({
  header, searching, selected, select, rail, card, rings, onRing, actions, onIntent, onPlan, onDayMenu,
  routines, onRoutine, onRoutineStart, musclesThisWeek, onMuscles, more, onMore, profile, setup, missed, ring = 0,
}) {
  const accent = useDsAccent()
  return (
    <StageScreen accent={accent}>
      <div className="train">
        {searching ? <Page root title={t('Training')} /> : <StageHeader {...header} />}
        {profile.kind === 'off'
          ? <Setup activities={profile.activities} {...setup} />
          : <>
            <Rail rail={rail} selected={selected} select={select} onPlan={onPlan} />
            {missed && (
              <div className="train-banner">
                <InlineBanner stage icon="calendar" title={missed.title} body={missed.body}
                  actions={[{ label: missed.moveLabel, solid: true, onClick: missed.onMove }, { label: missed.skipLabel, onClick: missed.onSkip }]} />
              </div>
            )}
            <RingCarousel slides={rings} start={ring} onOpen={onRing} />
            <GlassActions items={actions} />
            <DayCard card={card()} onIntent={onIntent} onDayMenu={onDayMenu} />
            <StageSection title={t('Routines')} action={t('See all')} onAction={actions.find(a => a.key === 'routines')?.onClick} />
            <RoutineTiles label={t('Routines')} items={tilesOf(routines, onRoutine, onRoutineStart)} />
            <StageSection title={t('Your training')} />
            <div className="train-gut">
              <MusclesCard title={t('Muscles this week')} period={musclesThisWeek.title} levels={musclesThisWeek.levels}
                note={musclesThisWeek.note} action={t('Training load')} onClick={onMuscles} />
              <GlassList items={more.map(row => ({ icon: MORE_ICON[row.key], title: row.title, sub: row.sub, onClick: () => onMore(row) }))} />
            </div>
          </>}
      </div>
    </StageScreen>
  )
}

// The rail on the week of the selected day: it pages there when a day is picked elsewhere ("See
// Monday"), and otherwise stays where it was swiped to. The page is kept as a week offset from
// today's, not an index: the rail's first week moves when older workouts arrive or the oldest is
// deleted, and the same offset is still the same week.
function Rail({ rail, selected, select, onPlan }) {
  const home = -rail.from
  const offsetOf = iso => rail.weeks.find(w => w.days.some(d => d.iso === iso))?.offset
  const [offset, setOffset] = useState(() => offsetOf(selected) ?? 0)
  // Only a new selection moves the page; a swipe keeps it.
  useEffect(() => {
    const at = offsetOf(selected)
    if (at !== undefined) setOffset(at)
  }, [selected])
  const shown = Math.min(Math.max(offset - rail.from, 0), rail.weeks.length - 1)
  const weeks = useMemo(() => rail.weeks.map(w => w.days), [rail])
  return (
    <StageDayRail
      weeks={weeks}
      week={shown}
      home={home}
      onWeek={i => setOffset(rail.weeks[i].offset)}
      title={rail.weeks[shown].title}
      action={t('Plan')}
      onAction={onPlan}
      selected={selected}
      onSelect={d => select(d.iso)}
      backLabel={rail.weeks[shown - 1]?.title}
      forwardLabel={rail.weeks[shown + 1]?.title}
    />
  )
}

// The selected day's card (useTrain's cardOf): the primary intent is the white button, the others
// glass; the ⋯ is there when the day has options. Today's planned card and a logged one show a
// stack of pictures, a later week's day the list of what is in it (T2.14).
function DayCard({ card: c, onIntent, onDayMenu }) {
  const button = (it, solid) => ({ label: it.label, icon: INTENT_ICON[it.intent], solid, onClick: () => onIntent(it) })
  const thumbs = c.thumbs || (c.kind === 'planned' ? c.exercises?.map(e => e.image) : null)
  return (
    <StageTrainCard
      eyebrow={c.since ? <>{c.eyebrow} · <Elapsed start={c.since} /></> : c.eyebrow}
      chip={c.chip}
      title={c.title}
      meta={c.sub}
      progress={c.progress ?? undefined}
      thumbs={thumbs}
      exercises={c.kind === 'future' ? c.exercises.map(e => ({ name: e.name, sub: e.line, image: e.image })) : undefined}
      actions={[c.primary && button(c.primary, true), ...c.secondary.map(it => button(it, false))].filter(Boolean)}
      onMenu={c.menu.length ? () => onDayMenu(c) : undefined}
    />
  )
}

// The first routines, each opening its editor, with ▶ to start it (or to add exercises to an
// empty one); then Freestyle, which starts at a tap.
function tilesOf(routines, onRoutine, onRoutineStart) {
  const own = routines.filter(r => !r.freestyle).slice(0, ROUTINES)
  const free = routines.find(r => r.freestyle)
  return [
    ...own.map(r => ({
      key: r.id, title: r.name, sub: r.sub, thumbs: r.thumbs, onClick: () => onRoutine(r),
      play: { label: r.empty ? `${t('Add exercise')}, ${r.name}` : t('Start {0}', r.name), onClick: () => onRoutineStart(r) },
    })),
    ...(free ? [{ key: 'freestyle', title: free.name, sub: free.sub, icon: 'dumbbell', outline: true, onClick: () => onRoutine(free) }] : []),
  ]
}

// T2.9, training not set up: the week's other activities when there are any, then the invitation
// with its three ways in. A plan file is picked here and read by the app's own import.
function Setup({ activities, onPlans, onRoutine, onImport }) {
  const file = useRef(null)
  return <>
    {activities.length > 0 && <>
      <StageSection title={t('Activity this week')} />
      <div className="train-gut">
        <GlassList items={activities.map(a => ({ icon: a.icon || 'figureRun', title: a.title, sub: a.sub }))} />
      </div>
    </>}
    <StageEmpty
      illustration="plan"
      title={t('Add training')}
      body={t('Plan your week, log every set, watch your lifts grow.')}
      action={t('Pick a ready-made plan')}
      onClick={onPlans}
      actions={[
        { label: t('Create a routine'), icon: 'plus', onClick: onRoutine },
        { label: t('Import a plan file'), icon: 'download', onClick: () => file.current?.click() },
      ]}
    />
    <input ref={file} type="file" accept="application/json,.json" hidden
      onChange={e => { const f = e.target.files[0]; e.target.value = ''; if (f) onImport(f) }} />
  </>
}
