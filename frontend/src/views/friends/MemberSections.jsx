import { fmtDate } from '../../lib/format.js'
import { t } from '../../lib/i18n.js'
import { consistencyBars, footerLine, serverWeekKey, sharesAnything, weekCells } from '../../lib/friends/member-view.js'
import BarChart from '../../ds/BarChart.jsx'
import GlassList from '../../ds/GlassList.jsx'
import StageEmpty from '../../ds/StageEmpty.jsx'
import StageNote from '../../ds/StageNote.jsx'
import StageSection from '../../ds/StageSection.jsx'
import StageWeekCells from '../../ds/StageWeekCells.jsx'

const finite = Number.isFinite
const card = node => <div className="g-sp-card">{node}</div>

/**
 * Everything under the header of the Member page (boards Fr2Member, Fr2Gap). The payload is what
 * that person shares and nothing else, so each section is drawn only when the payload carries it;
 * nothing is filled in, guessed or shown as zero. A person with every switch off gets one line
 * saying so. The footer says what they do not share, from their switches plus the three items that
 * are never shared.
 */
export default function MemberSections({ member }) {
  const { name, week, recent, consistency, targets, bests, shares } = member
  const footer = <StageNote>{footerLine(name, shares)}</StageNote>

  if (!sharesAnything(shares)) {
    return (
      <>
        <StageEmpty illustration="chart" card={false} title={t("{0} hasn't shared anything yet", name)} />
        {footer}
      </>
    )
  }

  const monday = serverWeekKey()
  const hasWeek = week && !week.noPlan && finite(week.done) && finite(week.planned)
  const bars = Array.isArray(consistency) && consistency.length > 0 ? consistencyBars(consistency) : null
  const hasTargets = targets && finite(targets.reached) && finite(targets.of)

  return (
    <>
      {week?.noPlan && (
        <StageEmpty illustration="calendar" card={false} title={t('No plan this week')}
          body={t("{0} took the week off. It doesn't count against the group goal.", name)} />
      )}

      {hasWeek && (
        <>
          <StageSection title={t('This week')} action={week.planned > 0 ? t('{0} of {1}', week.done, week.planned) : t('{0} done', week.done)} />
          {Array.isArray(week.days) && card(
            <StageWeekCells days={weekCells(monday, week.days, (day, on) => (on ? t('{0}, workout done', day) : t('{0}, no workout', day)))}
              food={false} legend={false} label={t('This week')} />,
          )}
        </>
      )}

      {Array.isArray(recent) && recent.length > 0 && (
        <>
          <StageSection title={t('Recent workouts')} />
          {card(<GlassList items={recent.map((w, i) => ({
            key: i,
            icon: 'dumbbell',
            title: w.title,
            sub: [fmtDate(w.date, true), finite(w.minutes) && w.minutes > 0 ? t('{0} min', w.minutes) : null].filter(Boolean).join(' · '),
          }))} />)}
        </>
      )}

      {bars && (
        <>
          <StageSection title={t('Consistency')} action={t('last {0} weeks', bars.values.length)} />
          {card(<BarChart tone="stage" height={96} values={bars.values} labels={bars.labels} highlight={bars.highlight}
            label={t('Share of planned workouts done each week')} barLabels={bars.barLabels} />)}
          <StageNote>{t('Share of planned workouts done each week. A week off shows empty, never red.')}</StageNote>
        </>
      )}

      {hasTargets && (
        <>
          <StageSection title={t('Food targets')} action={t('reached {0} of {1}', targets.reached, targets.of)} />
          {Array.isArray(targets.days) && card(
            <StageWeekCells days={weekCells(monday, targets.days, (day, on) => (on ? t('{0}, target reached', day) : t('{0}, target not reached', day)))}
              food={false} legend={false} label={t('Food targets')} />,
          )}
          <StageNote>{t("Only whether a day's target was reached. Never foods, amounts or weight.")}</StageNote>
        </>
      )}

      {Array.isArray(bests) && bests.length > 0 && (
        <>
          <StageSection title={t('New bests')} action={t('shared by {0}', name)} />
          {card(<GlassList items={bests.map((b, i) => ({
            key: i,
            icon: 'trophy',
            title: b.exercise,
            sub: [fmtDate(b.date, true), t('new best set')].join(' · '),
          }))} />)}
        </>
      )}

      {footer}
    </>
  )
}
