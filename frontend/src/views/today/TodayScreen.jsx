import { t } from '../../lib/i18n.js'
import { useDsAccent } from '../../lib/use-ds-accent.js'
import Collapse from '../../components/Collapse.jsx'
import Elapsed from '../../components/Elapsed.jsx'
import { Presence } from '../../components/presence.jsx'
import AwayCard from '../../ds/AwayCard.jsx'
import FirstSteps from '../../ds/FirstSteps.jsx'
import GlassActions from '../../ds/GlassActions.jsx'
import GlassRow from '../../ds/GlassRow.jsx'
import MealTiles from '../../ds/MealTiles.jsx'
import RingCarousel from '../../ds/RingCarousel.jsx'
import SavedIndicator from '../../ds/SavedIndicator.jsx'
import StageHeader from '../../ds/StageHeader.jsx'
import StageScreen from '../../ds/StageScreen.jsx'
import StageEmpty from '../../ds/StageEmpty.jsx'
import StageSection from '../../ds/StageSection.jsx'
import StageWeekMarks from '../../ds/StageWeekMarks.jsx'
import WaterGlasses from '../../ds/WaterGlasses.jsx'
import FriendsCard from './FriendsCard.jsx'
import './today.css'

// Today on the stage (boards T10Today to T115Over, T1EFood, T1ETraining): the header, the offline
// pill, the welcome back, the rings, the four actions, the Friends card (T1.16, only when
// `friends` is given: something is new), Up next (or First steps on a first day),
// Food and Water, or the week for the training profile. It draws what useToday() gives it and
// holds nothing; the floating tab bar is the app's (#tabbar). `ring` is the page the rings open on
// (T12Protein opens on Protein). The header is pinned to the top and is the search's field while
// it is open (components/use-root-header.js). `status` 'pending' (the day loading) draws the
// skeleton; 'failed' draws only the error scene with Try again on the stage, never a skeleton
// under it (that read as still loading) and never what looks like an empty day.
export default function TodayScreen({
  status = 'known', error, header, saved, away, firstSteps, nextPending, rings, onRing, actions, friends, upNext, meals, onMeal, onSeeDay, water, week, ring = 0,
}) {
  const accent = useDsAccent()
  const known = status === 'known'
  return (
    <StageScreen accent={accent}>
      <div className="today">
        <StageHeader pinned title={t('Today')} {...header} />
        <SavedIndicator tone="stage" state={saved?.state} waiting={saved?.waiting} />
        <Presence>{away && <Collapse key="away"><AwayCard {...away} /></Collapse>}</Presence>
        {status === 'failed' ? (
          <div className="today-failed" role="alert">
            <StageEmpty card={false} illustration="plate" title={error?.text} action={t('Try again')} onClick={error?.retry} />
          </div>
        ) : <>
          <RingCarousel slides={rings} start={ring} loading={!known} onOpen={onRing} />
          <GlassActions items={actions} loading={!known} />
        </>}
        {status === 'failed' ? null : !known ? <Skeleton food={!!meals} /> : <>
          {friends && <FriendsCard {...friends} />}
          {nextPending && <i className="g-skel today-sk-row" aria-hidden="true" />}
          {firstSteps && <><StageSection title={t('First steps')} action={firstSteps.label} /><FirstSteps steps={firstSteps.steps} /></>}
          {upNext && <><StageSection title={t('Up next')} /><UpNext {...upNext} /></>}
          {meals && <><StageSection title={t('Food')} action={t('See day')} onAction={onSeeDay} /><MealTiles meals={meals} onPick={onMeal} /></>}
          {water && <><StageSection title={t('Water')} action={water.label} /><WaterGlasses value={water.value} target={water.target} step={water.step} onAdd={water.onAdd} label={water.ariaLabel} addLabel={water.addLabel} /></>}
          {week && <><StageSection title={t('This week')} action={week.label} onAction={week.onOpen} /><StageWeekMarks days={week.days} /></>}
        </>}
      </div>
    </StageScreen>
  )
}

// A running session's eyebrow carries its clock (T111Running: "Workout running · 24:18").
function UpNext({ since, eyebrow, ...row }) {
  return <GlassRow {...row} eyebrow={since ? <>{eyebrow} · <Elapsed start={since} /></> : eyebrow} />
}

// T11Loading: Up next as one glass block, then the meal tiles.
function Skeleton({ food }) {
  return (
    <div className="today-sk" aria-hidden="true">
      <i className="g-skel today-sk-row" />
      {food && <div className="today-sk-tiles"><i className="g-skel" /><i className="g-skel" /><i className="g-skel" /></div>}
    </div>
  )
}
