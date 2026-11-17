import StageChoiceCard from '../../ds/StageChoiceCard.jsx'
import { useRadioGroup } from '../../lib/onboarding/use-radio-group.js'

// An onboarding question's answers (goal, sex, plan): the kit's StageChoiceCard as one radio
// group, with a roving focus. Pressing previews the answer in the scene (onPreview), letting go
// commits it, sliding off puts the committed one back. `slim`: the sex step's shorter cards.
export default function ChoiceCards({ labelledBy, options, value, onPick, onPreview, slim = false }) {
  const values = options.map(o => o.value)
  const { tabIndexOf, onKeyDown } = useRadioGroup(values, value, onPick)
  const revert = () => onPreview?.(value)
  return (
    <div className="ob-ccs" role="radiogroup" aria-labelledby={labelledBy} onKeyDown={onKeyDown}>
      {options.map(o => (
        <StageChoiceCard key={o.value} radio slim={slim} icon={o.icon} title={o.title} sub={o.sub}
          selected={value === o.value} tabIndex={tabIndexOf(o.value)}
          onClick={() => onPick(o.value, { viaKey: false })}
          onPointerDown={() => onPreview?.(o.value)} onPointerLeave={revert} onPointerCancel={revert} />
      ))}
    </div>
  )
}
