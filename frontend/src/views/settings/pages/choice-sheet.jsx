import { useState } from 'react'
import { t } from '../../../lib/i18n.js'
import { useUI } from '../../../store/useUI.js'
import BottomSheet from '../../../ds/BottomSheet.jsx'
import RadioRow from '../../../ds/RadioRow.jsx'
import TextField from '../../../ds/TextField.jsx'

// One value out of a longer list, on a drawer (the Open Food Facts search language and country).
// Choosing applies at once and closes. `searchLabel` adds a field pinned over the list that filters
// it by label; without it the list is short enough to read.
export function ChoiceSheet({ title, options, value, onPick, searchLabel, close }) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const shown = q ? options.filter(o => o.label.toLowerCase().includes(q)) : options
  const pick = v => { close(); onPick(v) }
  return (
    <BottomSheet title={title} type={searchLabel ? 'half' : 'auto'}
      head={searchLabel ? <TextField label={searchLabel} value="" onChange={setQuery} wide /> : undefined}>
      <div role="radiogroup" aria-label={title}>
        {shown.map(o => (
          <RadioRow key={o.value} title={o.label} selected={o.value === value} onClick={() => pick(o.value)} />
        ))}
        {shown.length === 0 && <p className="set-sheet-none">{t('No match')}</p>}
      </div>
    </BottomSheet>
  )
}

export const openChoiceSheet = props => useUI.getState().openSheet(close => <ChoiceSheet {...props} close={close} />, { variant: 'ds' })
