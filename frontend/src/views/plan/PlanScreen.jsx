import { useState } from 'react'
import { t } from '../../lib/i18n.js'
import { usePlanDayParam } from '../../sheets.jsx'
import Button from '../../ds/Button.jsx'
import GlassList from '../../ds/GlassList.jsx'
import GlassValueRow from '../../ds/GlassValueRow.jsx'
import InlineBanner from '../../ds/InlineBanner.jsx'
import LoopStrip from '../../ds/LoopStrip.jsx'
import PlanWeekGrid from '../../ds/PlanWeekGrid.jsx'
import StageEmpty from '../../ds/StageEmpty.jsx'
import StagePage from '../../ds/StagePage.jsx'
import StageSection from '../../ds/StageSection.jsx'
import StageSegmented from '../../ds/StageSegmented.jsx'
import Tag from '../../ds/Tag.jsx'
import VolumeBars from '../../ds/VolumeBars.jsx'
import LoopEditor from './LoopEditor.jsx'
import { usePlan } from './use-plan.js'
import './plan.css'

// Plan (board Tr3Plan, app route /train/schedule), a pushed page on the stage: the large title and
// its line, Loop / Fixed week (owner question 1), the Coach banner (T3.2), the loop card with its
// editor and its buttons (or the fixed week's card), the two-week grid, "Also on fixed days" and
// the weekly muscle volume; with nothing planned, the empty state (T3.3). It draws what usePlan()
// gives it; props given to it replace those fields (the screens gallery's Coach banner). The only
// state it keeps is whether the loop's editor is open.
export default function PlanScreen(over) {
  const plan = { ...usePlan(), ...over }
  const [editing, setEditing] = useState(false)
  usePlanDayParam()
  const { loop } = plan
  const loopMode = plan.mode === 'rotation'
  const editable = loopMode && plan.editable
  const edit = editing && editable && loop.items.length > 0

  return (
    <StagePage largeTitle={plan.title} sub={plan.sub} parent="/train"
      actions={[{ icon: 'more', label: t('Plan menu'), onClick: plan.openMenu }]}>
      <div className="plan-page">
        {/* Someone else's pass is not this app's to switch off: the tag below says so instead. */}
        {!plan.external && (
          <StageSegmented label={t('How you train')} value={plan.mode} onChange={plan.setMode}
            options={[{ value: 'rotation', label: t('Loop') }, { value: 'week', label: t('Fixed week') }]} />
        )}

        {plan.coach && (
          <InlineBanner stage icon="chat" title={plan.coach.title} body={plan.coach.body}
            actions={[{ label: t('Review'), solid: true, onClick: plan.coach.onReview }, { label: t('Dismiss'), onClick: plan.coach.onDismiss }]} />
        )}

        {/* A pass that arrived unreadable: a fix-up, shown whichever way you train. */}
        {plan.recovery && (
          <InlineBanner stage role="alert" icon="warning" title={t('This rotation couldn’t be read. Another device may have written it.')}
            actions={[{ label: t('Discard it'), solid: true, onClick: plan.discardBroken }]} />
        )}

        {plan.empty
          ? (
            <StageEmpty illustration="calendar" title={loopMode ? t('No rotation yet') : t('No fixed days yet')}
              body={loopMode ? t('Add routines to your Plan and they repeat in a loop, one per training day.') : t('Tap a day below to plan it, or add routines first.')}
              action={t('Add routines')} onClick={plan.addRoutines} actions={[{ label: t('Pick a ready-made plan'), onClick: plan.pickPlan }]} />
          )
          : loopMode
            ? (
              <div className="plan-loop">
                <LoopStrip title={t('Your loop')} line={loop.line} items={loop.items} empty={t('No rotation yet')} note={plan.footer}
                  action={!editable ? null
                    : loop.items.length
                      ? { label: edit ? t('Done') : t('Edit'), pressed: edit, onClick: () => setEditing(!edit) }
                      : { label: t('Add'), ariaLabel: t('Add routine to the rotation'), onClick: plan.addToLoop }} />
                {edit && <LoopEditor items={loop.items} onReorder={plan.reorder} onRemove={plan.takeOut} onAdd={plan.addToLoop} canAdd={plan.canAdd} swipe={plan.swipe} />}
                {(plan.round || edit) && (
                  <p className="plan-line">{[plan.round, edit && t('Drag to reorder. Tap the minus to take one out.')].filter(Boolean).join(' ')}</p>
                )}
                <LoopButtons plan={plan} />
              </div>
            )
            : <LoopStrip title={t('Your week')} items={plan.weekRoutines} numbered={false} empty={t('Nothing planned this week')} note={plan.footer} />}

        <PlanWeekGrid weeks={plan.weeks} dows={plan.weeks[0].days.map(d => d.dow)} onPick={plan.openDay} />

        {plan.alsoFixed.length > 0 && (
          <section className="plan-also">
            <StageSection title={t('Also on fixed days')} />
            <GlassList items={plan.alsoFixed.map(d => ({ icon: 'calendar', title: d.title, sub: d.sub, onClick: () => plan.openDay(d.iso) }))} />
            <p className="plan-line">{t('These count on top of the loop. Tap a day to change or clear it.')}</p>
          </section>
        )}

        {plan.volume && (
          <section className="plan-volume">
            <StageSection title={t('Weekly muscle volume')} action={t('Planned sets')} />
            <VolumeBars rows={plan.volume.rows} target={plan.volume.target}
              note={t('Planned sets per week, from your plan. The line is a common target of {0} to {1}.', ...plan.volume.target)} />
            <div className="g-glist g-glass">
              <GlassValueRow icon="chartLine" title={t('See in Training load')} onClick={plan.openVolume} />
            </div>
          </section>
        )}
      </div>
    </StagePage>
  )
}

// Under the loop card: adopt someone else's pass, start the saved loop over, or start it when no
// round is running; and the tag that says a pass is someone else's.
function LoopButtons({ plan }) {
  const { external, running, recovery, loop } = plan
  const start = !running && !recovery && loop.items.length > 0
  if (!external && !running && !start) return null
  return (
    <div className="plan-acts">
      {external && <Tag tone="glass">{t('Externally managed')}</Tag>}
      {external && <Button variant="glass" size="sm" onClick={plan.adopt}>{t('Use this rotation')}</Button>}
      {running && !external && <Button variant="glass" size="sm" icon="reset" haptic onClick={plan.startNewPass}>{t('Start the loop over')}</Button>}
      {start && <Button variant="glass" size="sm" icon="play" haptic onClick={plan.startPass}>{t('Start the loop')}</Button>}
    </div>
  )
}
