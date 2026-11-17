import { useState } from 'react'
import { t } from '../../lib/i18n.js'
import { parseGroupLink } from '../../lib/friends/group-link.js'
import { closeThenNav } from '../../lib/nav.js'
import { useUI } from '../../store/useUI.js'
import BottomSheet from '../../ds/BottomSheet.jsx'
import Button from '../../ds/Button.jsx'
import TextField from '../../ds/TextField.jsx'

// Join with an invite link (board Fr1Groups): a paste field in a half drawer. It takes the whole
// link a friend sent or just its code and opens the join page, which shows who invited you and
// exactly what they will see (core-m2's page, /me/groups/join/<code>). Nothing is sent from here,
// so there is no haptic: the commit is Join, on that page.
function JoinLinkSheet({ close }) {
  const [text, setText] = useState('')
  const [bad, setBad] = useState(false)

  const submit = e => {
    e.preventDefault()
    const code = parseGroupLink(text)
    if (!code) { setBad(true); return }
    closeThenNav(close, '/me/groups/join/' + encodeURIComponent(code))
  }

  return (
    <BottomSheet title={t('Join with an invite link')} type="half">
      <form onSubmit={submit} className="g-jsheet">
        <TextField
          tone="light"
          wide
          label={t('Invite link or code')}
          placeholder={t('Paste the link here')}
          hint={bad ? t("That doesn't look like a group link. Check it with the person who sent it.") : t('Paste or open the link a friend sent')}
          onChange={v => { setText(v); setBad(false) }}
          inputProps={{ autoCapitalize: 'off', autoCorrect: 'off', spellCheck: false, enterKeyHint: 'go', 'aria-invalid': bad || undefined }}
        />
        <Button type="submit" block disabled={!text.trim()}>{t('See who invited you')}</Button>
      </form>
    </BottomSheet>
  )
}

/** Opens the paste-link sheet as a plain `openSheet` (a sub-panel when opened from inside a drawer). */
export const joinLinkSheet = () => useUI.getState().openSheet(close => <JoinLinkSheet close={close} />, { variant: 'ds' })
