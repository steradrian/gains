import { useState } from 'react'
import BottomSheet from '../../../ds/BottomSheet.jsx'
import Button from '../../../ds/Button.jsx'
import InlineBanner from '../../../ds/InlineBanner.jsx'
import MenuList from '../../../ds/MenuList.jsx'
import TextField from '../../../ds/TextField.jsx'
import { t } from '../../../lib/i18n.js'
import { INVITE_NAME_MAX } from '../../../lib/me/invites.js'
import { useUI } from '../../../store/useUI.js'
import { confirmDrawer } from '../../settings/confirm-drawer.js'
import { askLine, askTitle } from './invite-data.js'

// The Invite page's drawers: New invite (board M5.1), a Waiting invite's menu and the revoke
// confirm, which opens from the menu as a sub-panel (openSheet inside a drawer).

function NewInvite({ ask, name: first, canShare, onCreate, close }) {
  const [name, setName] = useState(first)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  const submit = async share => {
    if (busy) return
    setBusy(share ? 'share' : 'copy')
    setError(null)
    const failure = await onCreate({ name, requestId: ask?.id, share })
    if (failure) { setError(failure); setBusy(null) } else close()
  }

  return (
    <BottomSheet title={t('New invite')}
      footer={<>
        <Button block busy={busy === 'copy'} disabled={!!busy && busy !== 'copy'} onClick={() => submit(false)}>{t('Create and copy link')}</Button>
        {canShare && <Button block variant="secondary" busy={busy === 'share'} disabled={!!busy && busy !== 'share'} onClick={() => submit(true)}>{t('Create and share')}</Button>}
      </>}>
      {ask && <p className="inv-ask"><b>{askTitle(ask)}</b> {askLine(ask)}</p>}
      <TextField label={t('Their name')} hint={t('Fills in their name when they open the link. They can change it.')}
        value={first} onChange={setName} inputProps={{ maxLength: INVITE_NAME_MAX, autoFocus: true, enterKeyHint: 'done' }} />
      {error && <InlineBanner key={error} role="alert" tone="warning" icon="warning" title={error} />}
    </BottomSheet>
  )
}

/**
 * Board M5.1: New invite. `ask` is the member's request this answers (its id rides along as
 * `requestId`); `name` starts the field (New link on an expired invite). `onCreate({ name,
 * requestId, share })` resolves to null when the invite was made, or the message to show in the
 * drawer, which then stays open.
 */
export const newInviteSheet = ({ ask = null, name = '', canShare, onCreate }) =>
  useUI.getState().openSheet(close => <NewInvite ask={ask} name={name} canShare={canShare} onCreate={onCreate} close={close} />, { variant: 'ds' })

function InviteMenu({ title, line, canShare, onCopy, onShare, onRevoke, close }) {
  const run = fn => () => { close(); fn() }
  const items = [
    { icon: 'copy', label: t('Copy link'), onClick: run(onCopy) },
    ...(canShare ? [{ icon: 'share', label: t('Share link'), onClick: run(onShare) }] : []),
    {
      icon: 'trash', label: t('Revoke'), tone: 'danger',
      onClick: () => confirmDrawer({
        title: t('Revoke this invite?'),
        body: t('Anyone who has it can no longer use it. People who already signed up with it are not affected.'),
        confirmLabel: t('Revoke'),
        onConfirm: () => { close(); onRevoke() },
      }),
    },
  ]
  return (
    <BottomSheet title={title} chip={line} chipIcon="clock">
      <MenuList items={items} label={title} />
    </BottomSheet>
  )
}

/** A Waiting invite's menu: Copy link, Share link (where the system has a share sheet), Revoke. */
export const inviteMenuSheet = props =>
  useUI.getState().openSheet(close => <InviteMenu {...props} close={close} />, { variant: 'ds' })
