import { doneText, streakLine } from '../../lib/friends/challenge-copy.js'
import { t } from '../../lib/i18n.js'
import StageEmpty from '../../ds/StageEmpty.jsx'

// A challenge the group finished (board Fr3Done): the stage's line-art, "You did it, together",
// what was done in the challenge's own words, the weeks-in-a-row line only when the goal was hit
// in a row, then Cheer everyone and Pick next week's challenge. After a cheer the button reads
// Cheered and stands still; taking it back is the toast's Undo.
export default function ChallengeDone({ challenge: ch, group, cheered, onCheer, onPick }) {
  const streak = streakLine(ch, group)
  return (
    <StageEmpty
      illustration="chart"
      card={false}
      title={t('You did it, together')}
      body={<>{doneText(ch)}{streak && <span className="g-cstreak">{streak}</span>}</>}
      actions={[
        cheered
          ? { label: t('Cheered') }
          : { label: t('Cheer everyone'), solid: true, haptic: true, onClick: onCheer },
        { label: t("Pick next week's challenge"), onClick: onPick },
      ]}
    />
  )
}
