import { useRef, useState } from 'react'
import { useUI } from '../../../store/useUI.js'
import { t } from '../../../lib/i18n.js'
import { HEVY_DEV_SETTINGS } from '../../../lib/import-hevy.js'
import BottomSheet from '../../../ds/BottomSheet.jsx'
import Button from '../../../ds/Button.jsx'
import TextField from '../../../ds/TextField.jsx'

/**
 * Import from Hevy, the key (board St1ImportHevy). The key is held in a ref for as long as the
 * drawer is open and handed to `onSubmit` once, then wiped from the field and the ref: it is never
 * in the store, in localStorage or on the server, and the drawer is gone before the fetch starts.
 */
export function HevyKeySheet({ close, onSubmit }) {
  const key = useRef('')
  const field = useRef(null)
  const [filled, setFilled] = useState(false)
  const submit = () => {
    const value = key.current.trim()
    if (!value) return
    key.current = ''
    if (field.current) field.current.value = ''
    close()
    onSubmit(value)
  }
  return (
    <BottomSheet title={t('Hevy')} onClose={close}>
      <div className="g-imp-sheet">
        <TextField label={t('API key')} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" inputRef={field}
          hint={t('Gains reads the key once and forgets it. It needs a Hevy Pro account.')}
          inputProps={{
            type: 'password', autoComplete: 'off', spellCheck: false, autoCapitalize: 'off',
            onKeyDown: e => { if (e.key === 'Enter') submit() },
          }}
          onChange={v => { key.current = v; setFilled(!!v.trim()) }} />
        <Button variant="secondary" href={HEVY_DEV_SETTINGS} target="_blank" rel="noopener noreferrer" icon="key">{t('Get your API key')}</Button>
        <Button disabled={!filled} onClick={submit}>{t('Import from Hevy')}</Button>
      </div>
    </BottomSheet>
  )
}

/** Opens the key drawer; `onSubmit(key)` runs once, after the drawer has closed. */
export const openHevyKeySheet = onSubmit => useUI.getState().openSheet(close => <HevyKeySheet close={close} onSubmit={onSubmit} />, { variant: 'ds' })
