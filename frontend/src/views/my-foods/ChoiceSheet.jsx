import { useUI } from '../../store/useUI.js'
import BottomSheet from '../../ds/BottomSheet.jsx'
import Button from '../../ds/Button.jsx'
import RadioRow from '../../ds/RadioRow.jsx'

// One choice out of a short list, in a drawer (the food editor's Unit name and Category). Choosing
// applies and closes at once; `footer` is an optional button under the list, { label, onClick(close) }.
// `options` are { value, label }; the caller's strings are already translated.
export default function ChoiceSheet({ title, label, options, value, onPick, footer, close }) {
  return (
    <BottomSheet title={title}
      footer={footer && <Button variant="secondary" onClick={() => footer.onClick(close)}>{footer.label}</Button>}>
      <div role="radiogroup" aria-label={label || title}>
        {options.map(o => (
          <RadioRow key={o.value} title={o.label} selected={o.value === value}
            onClick={() => { onPick(o.value); close() }} />
        ))}
      </div>
    </BottomSheet>
  )
}

/** Opens the list over the editor. */
export function choiceSheet(props) {
  useUI.getState().openSheet(close => <ChoiceSheet {...props} close={close} />, { variant: 'ds' })
}
