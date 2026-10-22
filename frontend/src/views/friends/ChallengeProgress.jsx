import { barCaption, barSegments, progressText, totalOf } from '../../lib/friends/challenge-copy.js'
import { challengeUnit } from '../../lib/friends/group-copy.js'
import { t } from '../../lib/i18n.js'
import SharedBar from '../../ds/SharedBar.jsx'

// The count and the one shared bar of a challenge (boards Fr3Join, Fr3Challenge): "12 of 15" with
// what it counts and, while it runs, when it ends, then the bar with a colour per person in the
// order they joined and the line that says so. Nobody is ranked: the bar adds everyone up.
export default function ChallengeProgress({ challenge: ch, group, phrase }) {
  const unit = challengeUnit(ch.template)
  return (
    <div className="g-cprog">
      <div className="g-ccount">
        <b>{t('{0} of {1}', totalOf(ch), ch.goal ?? 0)}</b>
        <span>{phrase ? t('{0} · {1}', unit, phrase) : unit}</span>
      </div>
      <SharedBar goal={ch.goal ?? 0} segments={barSegments(ch, group)} label={progressText(ch)} />
      <p className="g-cnote">{barCaption(ch)}</p>
    </div>
  )
}
