import Icon from '../../components/Icon.jsx'
import { legendRows, ringLabel, ringSegments, streakLine, targetsLine, weekUnit } from '../../lib/friends/group-copy.js'
import { t } from '../../lib/i18n.js'
import MemberAvatar from '../../ds/MemberAvatar.jsx'
import MemberRing from '../../ds/MemberRing.jsx'

// The group's week (boards Fr2Group, Fr2NoActivity): one ring with a segment per member in join
// order, the totals in its centre, the targets and streak lines when the data has them, and a
// legend of who did how much of their own plan. Nobody is first or last; a member with no plan
// reads "No plan", never a warning. Every line is left out when the group has nothing to say.
export default function GroupWeek({ group }) {
  const { week, quiet } = group
  const targets = targetsLine(group)
  const streak = streakLine(group)
  return (
    <>
      <div className="g-gweek">
        <MemberRing size={216} stroke={16} label={ringLabel(group)} segments={ringSegments(group)}>
          <span className="g-gweek-cap">{quiet ? t('New week') : t('This week')}</span>
          <b className="g-gweek-num">{week.planned > 0 ? t('{0} / {1}', week.done, week.planned) : t('No plan')}</b>
          {week.planned > 0 && <span className="g-gweek-unit">{weekUnit(group)}</span>}
        </MemberRing>
        {(targets || streak) && (
          <div className="g-gweek-lines">
            {targets && <span className="g-gline"><Icon name="check" className="g-icon" />{targets}</span>}
            {streak && <span className="g-gline"><Icon name="trophy" className="g-icon" />{streak}</span>}
          </div>
        )}
      </div>
      <ul className="g-glegend">
        {legendRows(group).map(r => (
          <li key={r.uid}>
            <MemberAvatar initial={r.initial} tone={r.tone} size="sm" />
            <span className="g-glegend-name">{r.name}</span>
            <span className="g-glegend-n">{r.text}</span>
          </li>
        ))}
      </ul>
    </>
  )
}
