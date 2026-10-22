import { cx } from '../../lib/ui-kit.js'
import { inCount, whoRows } from '../../lib/friends/challenge-copy.js'
import { t } from '../../lib/i18n.js'
import MemberAvatar from '../../ds/MemberAvatar.jsx'
import StageSection from '../../ds/StageSection.jsx'

// Who's in (boards Fr3Join, Fr3Challenge, Fr3Done): the people who joined, in join order, each with
// their own count, then the people invited who have not joined, dimmed and marked Invited. The
// header says how many of the group are in. It is a list of people, never a ranking.
export default function ChallengeWho({ challenge: ch, group, me }) {
  const rows = whoRows(ch, group, me)
  const { joined, all } = inCount(ch, group)
  return (
    <>
      <StageSection title={t("Who's in")} action={t('{0} of {1}', joined, all)} />
      <ul className="g-mlist g-glass">
        {rows.map(r => (
          <li key={r.uid} className={cx('g-mrow', r.invited && 'g-mrow-dim')}>
            <MemberAvatar initial={r.initial} tone={r.tone} />
            <div className="g-mrow-body">
              <b>{r.name}</b>
              {r.you && <span className="g-mrow-sub">{t('You')}</span>}
            </div>
            <span className="g-mrow-end g-cend">{r.end}</span>
          </li>
        ))}
      </ul>
    </>
  )
}
