import { useEffect, useState } from 'react'
import { t } from '../lib/i18n.js'
import { fmtMonth } from '../lib/format.js'
import { copyText } from '../lib/clipboard.js'
import { canShareLink, shareLink } from '../lib/invite-link.js'
import { createInvite, findPeople, friendsErrorText, inviteUser } from '../lib/friends/api.js'
import { groupLink } from '../lib/friends/group-link.js'
import { getFriends } from '../lib/friends/store.js'
import { useUI } from '../store/useUI.js'
import BottomSheet from '../ds/BottomSheet.jsx'
import Button from '../ds/Button.jsx'
import MemberAvatar, { memberTone } from '../ds/MemberAvatar.jsx'
import StageEmpty from '../ds/StageEmpty.jsx'
import TextField from '../ds/TextField.jsx'

const SEARCH_DELAY_MS = 250

const toast = msg => useUI.getState().toast(msg)

// `since` is YYYY-MM (GET /people).
const joinedLine = since => (/^\d{4}-\d{2}$/.test(since || '') ? t('Joined Gains in {0}', fmtMonth(since + '-01', true)) : null)

function PersonRow({ person, index, invited, busy, onInvite }) {
  const sub = joinedLine(person.since)
  return (
    <li className="g-ipeople-row">
      <MemberAvatar initial={person.name} tone={memberTone(index)} />
      <span className="g-ipeople-body"><b>{person.name}</b>{sub && <span>{sub}</span>}</span>
      {invited
        ? <span className="g-ipeople-done">{t('Invited')}</span>
        : <Button size="sm" variant="secondary" haptic busy={busy} onClick={onInvite}>{t('Invite')}</Button>}
    </li>
  )
}

function InviteSheet({ groupId, groupName }) {
  const name = groupName || getFriends().groups?.find(g => g.id === groupId)?.name
  const [link, setLink] = useState(null)
  const [minting, setMinting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [query, setQuery] = useState('')
  const [people, setPeople] = useState(null)
  const [invited, setInvited] = useState(() => new Set())
  const [inviting, setInviting] = useState(null)

  useEffect(() => {
    let gone = false
    const timer = setTimeout(() => {
      findPeople(query.trim(), groupId)
        .then(list => { if (!gone) setPeople(Array.isArray(list) ? list : []) })
        .catch(() => { if (!gone) setPeople(prev => prev ?? []) })
    }, query ? SEARCH_DELAY_MS : 0)
    return () => { gone = true; clearTimeout(timer) }
  }, [query, groupId])

  // One link per drawer: copying and then sharing hands out the same single-use link.
  const mint = async () => {
    if (link) return link
    setMinting(true)
    try {
      const made = await createInvite(groupId)
      const url = groupLink(made.code)
      setLink(url)
      return url
    } catch (e) {
      toast(friendsErrorText(e))
      return null
    } finally {
      setMinting(false)
    }
  }

  const copy = async () => {
    const url = await mint()
    if (!url) return
    if (await copyText(url)) setCopied(true)
    else toast(t('Could not copy the link'))
  }

  const share = async () => {
    const url = await mint()
    if (!url) return
    try { await shareLink(url, name ? t('Join {0} on Gains', name) : t('Join my group on Gains')) } catch { toast(t('Could not copy the link')) }
  }

  const invite = async person => {
    setInviting(person.uid)
    try {
      await inviteUser(groupId, person.uid)
      setInvited(prev => new Set(prev).add(person.uid))
    } catch (e) {
      toast(friendsErrorText(e))
    } finally {
      setInviting(null)
    }
  }

  const empty = people && people.length === 0
  return (
    <BottomSheet title={name ? t('Invite to {0}', name) : t('Invite to the group')} type="auto">
      <div className="g-jsheet">
        <Button block icon={copied ? 'check' : 'link'} haptic busy={minting} onClick={copy}>{copied ? t('Link copied') : t('Copy invite link')}</Button>
        <p className="g-jsheet-note">{t('Works once · 7 days')}</p>
        {canShareLink() && <Button block variant="secondary" icon="share" onClick={share}>{t('Share link')}</Button>}

        <p role="heading" aria-level={3} className="g-ipeople-h">{t('Already on Gains')}</p>
        <TextField tone="light" wide label={t('Search people')} placeholder={t('Search by name')} value={query} onChange={setQuery}
          inputProps={{ type: 'search', autoCapitalize: 'off', autoCorrect: 'off', spellCheck: false }} />
        {empty
          ? <StageEmpty illustration="search" tone="light" card={false} title={query.trim() ? t('Nobody found') : t('No one to invite yet')}
            body={query.trim() ? t('Try another name, or send the link.') : t('People who turned on Friends show up here.')} />
          : people && (
            <ul className="g-ipeople">
              {people.map((p, i) => (
                <PersonRow key={p.uid} person={p} index={i + 1} invited={invited.has(p.uid)} busy={inviting === p.uid} onInvite={() => invite(p)} />
              ))}
            </ul>
          )}
        <p className="g-jsheet-note">{t('Group links only work for people already on Gains. Someone new needs an app invite from an admin first. They see a preview of what the group shares before they say yes.')}</p>
      </div>
    </BottomSheet>
  )
}

/** Opens the Invite drawer (board Fr4Add) for a group as a plain `openSheet` (a sub-panel from inside a drawer). */
export const inviteSheet = (groupId, groupName) => useUI.getState().openSheet(() => <InviteSheet groupId={groupId} groupName={groupName} />, { variant: 'ds' })
