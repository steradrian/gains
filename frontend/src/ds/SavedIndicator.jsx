import Icon from '../components/Icon.jsx'
import { t, tn } from '../lib/i18n.js'
import { cx, oneOf } from '../lib/ui-kit.js'

const STAGE_ICON = { saved: 'check', offline: 'cloudSlash', error: 'warning' }

function label(state, waiting) {
  if (state === 'saved') return t('Saved')
  if (state === 'syncing') return t('Syncing')
  if (state === 'error') return t('Not saved · Retry')
  return waiting > 0 ? tn('Offline · {0} change waiting', 'Offline · {0} changes waiting', waiting) : t('Offline')
}

// Whether a change has reached the server (bundle.js `SavedIndicator`): idle shows nothing (its
// live region stays, so the next state is announced), saved is positive, syncing pulses, offline
// counts the changes waiting and error asks for a retry. `tone="light"` is the small tag beside
// the date in a light header; `tone="stage"` is the glass pill under the stage header (board
// T1.14), with an icon where the light one has a dot. A state with `onClick` is a button (it
// opens the waiting list); without one it is only said.
export default function SavedIndicator({ state = 'idle', waiting = 0, tone = 'light', onClick }) {
  oneOf('SavedIndicator', 'state', state, ['idle', 'saved', 'syncing', 'offline', 'error'])
  oneOf('SavedIndicator', 'tone', tone, ['light', 'stage'])
  const stage = tone === 'stage'
  let pill = null
  if (state !== 'idle') {
    const icon = stage && STAGE_ICON[state]
    const kids = (
      <>
        {icon ? <Icon name={icon} className="g-icon" /> : <i />}
        {label(state, waiting)}
      </>
    )
    const className = cx('g-saved', 'g-saved-' + state, stage && 'g-saved-stage g-glass')
    pill = onClick
      ? <button type="button" className={className} onClick={onClick}>{kids}</button>
      : <span className={className}>{kids}</span>
  }
  return <span className={stage ? 'g-savedbar' : 'g-saved-live'} aria-live="polite">{pill}</span>
}
