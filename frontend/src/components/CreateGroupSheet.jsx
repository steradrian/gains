import { useState } from 'react'
import { t } from '../lib/i18n.js'
import { createGroup, friendsErrorText } from '../lib/friends/api.js'
import { refreshFriends } from '../lib/friends/store.js'
import { closeThen, nav } from '../lib/nav.js'
import { useUI } from '../store/useUI.js'
import BigStepper from '../ds/BigStepper.jsx'
import BottomSheet from '../ds/BottomSheet.jsx'
import Button from '../ds/Button.jsx'
import RadioRow from '../ds/RadioRow.jsx'
import TextField from '../ds/TextField.jsx'
import { inviteSheet } from './InviteSheet.jsx'

export const NAME_MAX = 40
export const GOAL_MIN = 1
export const GOAL_MAX = 200
const DEFAULT_NUMBER = 10

// The goal kinds in the order of the board (Fr1Create). `number` reveals a stepper.
const goalKinds = () => [
  { kind: 'planned', title: t("Everyone's planned sessions") },
  { kind: 'number', title: t('A number we pick') },
  { kind: 'targets', title: t('Targets hit') },
]

/** The POST /groups body's goal for what the form holds. `n` goes only with `number`. */
export const goalOf = (kind, n) => (kind === 'number' ? { kind, n } : { kind })

function CreateGroupSheet({ close }) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState('planned')
  const [n, setN] = useState(DEFAULT_NUMBER)
  const [busy, setBusy] = useState(false)
  const [missing, setMissing] = useState(false)

  const submit = async e => {
    e.preventDefault()
    if (busy) return
    const trimmed = name.trim()
    if (!trimmed) { setMissing(true); return }
    setBusy(true)
    let group
    try {
      group = await createGroup({ name: trimmed.slice(0, NAME_MAX), goal: goalOf(kind, n) })
    } catch (err) {
      setBusy(false)
      useUI.getState().toast(friendsErrorText(err))
      return
    }
    refreshFriends().catch(() => {})
    // The drawer takes its history entry with it before the page moves (checklist 7); Invite then
    // opens as a drawer of its own over the new group.
    closeThen(close, replace => {
      nav('/me/groups/' + encodeURIComponent(group.id), replace ? { replace: true } : undefined)
      inviteSheet(group.id, group.name)
    })
  }

  return (
    <BottomSheet title={t('New group')} type="auto">
      <form onSubmit={submit} className="g-jsheet" noValidate>
        <TextField
          tone="light"
          wide
          label={t('Group name')}
          placeholder={t('Iron Sunday')}
          value={name}
          hint={missing ? t('Give the group a name') : undefined}
          onChange={v => { setName(v); setMissing(false) }}
          inputProps={{ maxLength: NAME_MAX, autoCapitalize: 'words', enterKeyHint: 'done', 'aria-invalid': missing || undefined }}
        />
        <div role="radiogroup" aria-label={t('Weekly goal')}>
          {goalKinds().map(g => (
            <RadioRow key={g.kind} title={g.title} selected={kind === g.kind} onClick={() => setKind(g.kind)} />
          ))}
        </div>
        {kind === 'number' && (
          <BigStepper
            label={t('Sessions a week')}
            value={n}
            min={GOAL_MIN}
            max={GOAL_MAX}
            onChange={setN}
            lessLabel={t('Fewer sessions a week')}
            moreLabel={t('More sessions a week')}
          />
        )}
        {kind === 'planned' && <p className="g-jsheet-note">{t('The goal adds up what each of you planned this week. It changes when plans change.')}</p>}
        <Button type="submit" block haptic busy={busy}>{t('Create and invite')}</Button>
      </form>
    </BottomSheet>
  )
}

/** Opens the New group drawer (board Fr1Create) as a plain `openSheet`. */
export const createGroupSheet = () => useUI.getState().openSheet(close => <CreateGroupSheet close={close} />, { variant: 'ds' })
