import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { workoutRunning } from '../lib/mode-route.js'
import Icon from './Icon.jsx'
import { useConnectionTrouble } from './SyncBanner.jsx'

// The header of a mode's root screens: the Training | Nutrition switch and the avatar that opens
// Me. Pushed pages show their own back + title instead. The switch is labelled, not iconic, and
// carries no accent: the mode shows in the bar's contents, never in a colour.
export default function ModeHeader({ mode, onSwitch }) {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  // The banner switched off and the sync stuck: a dot on the avatar, the way into Settings.
  const trouble = useConnectionTrouble()
  const live = workoutRunning(S)
  const options = [
    { value: 'train', label: t('Training'), name: live ? t('Training, workout in progress') : undefined },
    { value: 'food', label: t('Nutrition') },
  ]
  const i = mode === 'food' ? 1 : 0
  const initial = (user?.name || '').trim().slice(0, 1).toUpperCase()

  return (
    <div className="mode-hdr">
      <span className="mode-hdr-side" aria-hidden="true" />
      <div className="seg seg-mode" role="group" aria-label={t('Training or Nutrition')} style={{ '--n': 2, '--i': i }}>
        <span className="seg-sel" aria-hidden="true" />
        {options.map(o => (
          <button key={o.value} className={o.value === mode ? 'on' : ''} aria-pressed={o.value === mode}
            aria-label={o.name} onClick={() => { if (o.value !== mode) onSwitch(o.value) }}>
            {o.value === 'train' && live && <span className="live-dot" aria-hidden="true" />}
            <span>{o.label}</span>
          </button>
        ))}
      </div>
      <button className="mode-avatar" onClick={() => nav('/me')}
        aria-label={trouble ? t('Me') + ', ' + t('Connection problem') : t('Me')}>
        <span className="mode-avatar-c">{initial || <Icon name="person" />}</span>
        {trouble && <span className="tab-dot" aria-hidden="true" />}
      </button>
    </div>
  )
}
