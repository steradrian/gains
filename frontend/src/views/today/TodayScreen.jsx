import { t } from '../../lib/i18n.js'
import { useDsAccent } from '../../lib/use-ds-accent.js'
import { Page } from '../../components/layout.jsx'
import GlassActions from '../../ds/GlassActions.jsx'
import GlassRow from '../../ds/GlassRow.jsx'
import InlineBanner from '../../ds/InlineBanner.jsx'
import MealTiles from '../../ds/MealTiles.jsx'
import RingCarousel from '../../ds/RingCarousel.jsx'
import StageHeader from '../../ds/StageHeader.jsx'
import StageScreen from '../../ds/StageScreen.jsx'
import StageSection from '../../ds/StageSection.jsx'
import StageWeekMarks from '../../ds/StageWeekMarks.jsx'
import WaterGlasses from '../../ds/WaterGlasses.jsx'
import './today.css'

// Today on the stage (boards T10Today, T11Loading, T12Protein, T1EFood, T1ETraining): the header,
// the rings, the four actions, Up next, Food and Water, or the week for the training profile. It
// draws what useToday() gives it and holds nothing; the floating tab bar is the app's (#tabbar).
// `ring` is the page the rings open on (T12Protein opens on Protein). While the search is open the
// tab root's own header (<Page root>) stands in, since the app's search types into its input.
export default function TodayScreen({ loading, error, header, searching, rings, onRing, actions, upNext, meals, onMeal, onSeeDay, water, week, ring = 0 }) {
  const accent = useDsAccent()
  return (
    <StageScreen accent={accent}>
      <div className="today">
        {searching ? <Page root title={t('Today')} /> : <StageHeader {...header} />}
        {error && <div className="today-alert"><InlineBanner stage role="alert" icon="warning" title={error.text} actions={[{ label: t('Try again'), onClick: error.retry, solid: true }]} /></div>}
        <RingCarousel slides={rings} start={ring} loading={loading || !!error} onOpen={onRing} />
        <GlassActions items={actions} loading={loading} />
        {loading ? <Skeleton food={!!meals} /> : <>
          {upNext && <><StageSection title={t('Up next')} /><GlassRow {...upNext} /></>}
          {meals && <><StageSection title={t('Food')} action={t('See day')} onAction={onSeeDay} /><MealTiles meals={meals} onPick={onMeal} /></>}
          {water && <><StageSection title={t('Water')} action={water.label} /><WaterGlasses value={water.value} target={water.target} step={water.step} onAdd={water.onAdd} /></>}
          {week && <><StageSection title={t('This week')} action={week.label} /><StageWeekMarks days={week.days} /></>}
        </>}
      </div>
    </StageScreen>
  )
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
