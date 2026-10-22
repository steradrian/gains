import { t } from '../../lib/i18n.js'
import GlassRow from '../../ds/GlassRow.jsx'
import MemberAvatar, { memberTone } from '../../ds/MemberAvatar.jsx'

// One group on Groups (board Fr1Groups): its name, the week in one line ("17 of 22 sessions this
// week · 4-week streak"), the challenge line only while a challenge runs, and the first five
// members' initials in join order. Every number is left out when the data cannot back it: no
// "of 0", no streak of 0. Nobody is ranked or marked. Tapping opens the group.
export default function GroupCard({ group, onOpen }) {
  const { name, members = [], week, streak, challengeLine } = group
  const progress = [
    week?.planned > 0 ? t('{0} of {1} sessions this week', week.done, week.planned) : null,
    streak > 0 ? t('{0}-week streak', streak) : null,
  ].filter(Boolean).join(' · ')
  const sub = (progress || challengeLine) && (
    <>
      {progress}
      {progress && challengeLine && <br />}
      {challengeLine}
    </>
  )
  return (
    <GlassRow
      title={name}
      sub={sub || null}
      onClick={onOpen}
      trailing={
        <span className="g-mavatars">
          {members.slice(0, 5).map((m, i) => <MemberAvatar key={m.uid} initial={m.initial || m.name} tone={memberTone(i)} />)}
        </span>
      }
    />
  )
}
