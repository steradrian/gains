import Icon from '../../components/Icon.jsx'
import { t } from '../../lib/i18n.js'
import { useDsAccent } from '../../lib/use-ds-accent.js'
import GlassActions from '../../ds/GlassActions.jsx'
import GlassList from '../../ds/GlassList.jsx'
import GlassRow from '../../ds/GlassRow.jsx'
import RingCarousel from '../../ds/RingCarousel.jsx'
import StageDayRail from '../../ds/StageDayRail.jsx'
import StageEmpty from '../../ds/StageEmpty.jsx'
import StageHeader from '../../ds/StageHeader.jsx'
import StageScreen from '../../ds/StageScreen.jsx'
import StageSection from '../../ds/StageSection.jsx'
import './eat.css'

// Every empty state is a scene, never a bare icon (owner rule); the plate is Eat's.
const SCENE = 'plate'
const SKELETON_SLIDES = [{}, {}, {}]
const SKELETON_ACTIONS = [{}, {}, {}, {}]

// Eat on the stage (boards Ea1Eat, Ea1Again, Ea1Water, Ea1Off): the header, the calendar rail with
// a ring a day, the week's ring carousel, the four actions, Yesterday's lunch, and "Your food".
// It draws what useEat() gives it (use-eat.js) and keeps nothing; the rail's page is useEat's, so
// the days it shows are the days it loads. `status` 'off' is the invitation, 'unavailable' the
// build with no nutrition behind it, 'loading' the skeleton of the ring and the actions.
export default function EatScreen({ header, status, rail, hero, actions, again, library, setup }) {
  const accent = useDsAccent()
  return (
    <StageScreen accent={accent}>
      <div className="eat">
        <StageHeader pinned title={t('Eat')} {...header} />
        {status === 'unavailable' && (
          <StageEmpty illustration={SCENE} title={t('Nutrition lives in the web app')} body={t('Sign in on the web app to log food and see your day here.')} />
        )}
        {status === 'off' && (
          <StageEmpty
            illustration={SCENE}
            title={t('Add food tracking')}
            body={t('Log meals in a few taps, see calories and protein left, and keep your favourite foods one tap away.')}
            action={t('Set up food tracking')}
            onClick={setup.onSetup}
          />
        )}
        {status === 'loading' && <>
          <RingCarousel loading slides={SKELETON_SLIDES} label={t('Food this week')} />
          <GlassActions loading items={SKELETON_ACTIONS} />
        </>}
        {status === 'ready' && <>
          <Rail rail={rail} />
          <RingCarousel slides={hero.slides} onOpen={hero.onOpen} label={t('Food this week')} />
          <GlassActions items={actions} />
          {again && <>
            <StageSection title={t('Again')} />
            <GlassRow
              title={again.title}
              sub={again.sub}
              trailing={again.done
                ? <span className="eat-logged g-glass"><Icon name="check" className="g-icon" />{t('Logged')}</span>
                : <button type="button" className="g-trail-pill" onClick={again.onLog} disabled={again.disabled} aria-label={again.logLabel}>{t('Log again')}</button>}
            />
          </>}
          <StageSection title={t('Your food')} />
          <div className="eat-gut">
            <GlassList items={library} />
          </div>
        </>}
      </div>
    </StageScreen>
  )
}

// The rail: this week at the end, earlier weeks a swipe back. A past day opens its diary and today
// opens Today (useEat's onDay); a day to come is dim and cannot be tapped. The Month link goes on.
function Rail({ rail }) {
  const { weeks, week, home, onWeek, onDay, onMonth } = rail
  return (
    <StageDayRail
      weeks={weeks.map(w => w.days)}
      week={week}
      home={home}
      onWeek={onWeek}
      title={weeks[week].title}
      action={t('Month')}
      onAction={onMonth}
      onSelect={onDay}
      backLabel={weeks[week - 1]?.title}
      forwardLabel={weeks[week + 1]?.title}
    />
  )
}
