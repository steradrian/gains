import BottomSheet from '../../../ds/BottomSheet.jsx'
import RadioRow from '../../../ds/RadioRow.jsx'
import { useUI } from '../../../store/useUI.js'

function ChoiceDrawer({ title, label, options, value, onPick, close }) {
  return (
    <BottomSheet title={title}>
      <div className="g-xc" role="radiogroup" aria-label={label}>
        {options.map(o => (
          <RadioRow key={o.value} title={o.title} sub={o.sub} selected={o.value === value} onClick={() => { close(); onPick(o.value) }} />
        ))}
      </div>
    </BottomSheet>
  )
}

/**
 * A light drawer with one choice to make (the Exercises filters: Equipment, Type). `options` are
 * `{ value, title, sub? }`; choosing one applies it and closes the drawer, whose history entry is
 * walked off by the sheet frame, so nothing is left behind. `label` names the group.
 */
export const choiceSheet = ({ title, label, options, value, onPick }) =>
  useUI.getState().openSheet(close => <ChoiceDrawer title={title} label={label || title} options={options} value={value} onPick={onPick} close={close} />, { variant: 'ds' })
