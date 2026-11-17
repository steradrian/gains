import { t } from '../../lib/i18n.js'
import { useDsAccent } from '../../lib/use-ds-accent.js'
import GlassActions from '../../ds/GlassActions.jsx'
import GlassList from '../../ds/GlassList.jsx'
import GlassRow from '../../ds/GlassRow.jsx'
import InlineBanner from '../../ds/InlineBanner.jsx'
import MusclesCard from '../../ds/MusclesCard.jsx'
import RingCarousel from '../../ds/RingCarousel.jsx'
import StageHeader from '../../ds/StageHeader.jsx'
import StageScreen from '../../ds/StageScreen.jsx'
import StageSection from '../../ds/StageSection.jsx'
import Tag from '../../ds/Tag.jsx'
import './me.css'

// Profile, the Me tab's root (boards M1.0 to M1.2): the pinned header, the ring carousel (Weight,
// Days on target, Streak), the quick actions, My goal, the You group and Your muscles this week.
// It draws what useMe() gives it and keeps nothing. `goal` is me-data.js goalCardOf's answer;
// `muscles` is null until a workout is logged. The glass is the kit's.
export default function MeScreen({ header, rings, onRing, actions, onAction, goal, onGoal, onKeep, rows, onRow, muscles, onMuscles }) {
  const accent = useDsAccent()
  return (
    <StageScreen accent={accent}>
      <div className="me">
        <StageHeader pinned title={t('Me')} {...header} />
        <RingCarousel slides={rings} onOpen={onRing} label={t('You at a glance')} />
        <GlassActions items={actions.map(a => ({ icon: a.icon, label: a.label, onClick: () => onAction(a.key) }))} />
        <StageSection title={t('My goal')} />
        <div className="me-gut">
          {goal.loading
            ? <i className="g-skel me-goal-sk" aria-hidden="true" />
            : <GlassRow title={goal.title} sub={goal.lines.length ? goal.lines.map((l, i) => <span key={i} className="me-line">{l}</span>) : null} onClick={onGoal} trailing="chev" />}
          {goal.keep && (
            <InlineBanner stage icon="target" title={t('Target reached')} body={t('Nothing changes until you choose.')}
              actions={[{ label: t('Keep my weight'), solid: true, onClick: onKeep }]} />
          )}
        </div>
        <StageSection title={t('You')} />
        <div className="me-gut">
          <GlassList items={rows.map(row => ({
            icon: row.icon,
            title: row.title,
            sub: row.tag ? <><Tag tone="glass">{row.tag}</Tag> {row.sub}</> : row.sub,
            onClick: () => onRow(row),
          }))} />
        </div>
        {muscles && (
          <div className="me-gut">
            <MusclesCard title={t('Your muscles this week')} period={muscles.title} levels={muscles.levels}
              note={muscles.note} action={t('Trends')} onClick={onMuscles} />
          </div>
        )}
        <p className="me-foot">{t('Settings, reminders and your account are behind your avatar.')}</p>
      </div>
    </StageScreen>
  )
}
