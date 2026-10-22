import { useRef, useState } from 'react'
import { createChallenge, friendsErrorText } from '../lib/friends/api.js'
import { activeCount, CHALLENGE_LIMIT, DEFAULT_SPAN, DEFAULT_TEMPLATE, spans, templates } from '../lib/friends/challenge-copy.js'
import { useGroupSnapshot } from '../lib/friends/use-group.js'
import { t } from '../lib/i18n.js'
import { closeThen, nav } from '../lib/nav.js'
import { useUI } from '../store/useUI.js'
import BottomSheet from '../ds/BottomSheet.jsx'
import Button from '../ds/Button.jsx'
import RadioRow from '../ds/RadioRow.jsx'
import SegmentedControl from '../ds/SegmentedControl.jsx'
import { GROUPS_PATH } from '../views/friends/me-rows.js'

// New challenge (board Fr3New): four templates with what each counts, how long, and Start
// challenge. Everyone in the group is invited and nobody is added without saying yes. A template
// that counts something a person does not share still starts: their count shows only as a number.
// Start creates it, takes the drawer's history entry with it (checklist 7) and opens the new
// challenge's page. A group already running three says why in one line and cannot start a fourth;
// the server's `challenge-limit` is toasted the same way if the page was out of date.
function NewChallenge({ groupId, close }) {
  const group = useGroupSnapshot(groupId).group
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE)
  const [span, setSpan] = useState(DEFAULT_SPAN)
  const [busy, setBusy] = useState(false)
  const sending = useRef(false)
  const full = activeCount(group) >= CHALLENGE_LIMIT

  const start = async () => {
    if (sending.current || full) return
    sending.current = true
    setBusy(true)
    let made
    try {
      made = await createChallenge(groupId, { template, span })
    } catch (err) {
      sending.current = false
      setBusy(false)
      useUI.getState().toast(friendsErrorText(err))
      return
    }
    closeThen(close, replace => nav(GROUPS_PATH + '/' + encodeURIComponent(groupId) + '/challenge/' + encodeURIComponent(made.id), replace ? { replace: true } : undefined))
  }

  const footer = (
    <>
      {full && <p className="g-jsheet-note" role="status">{t('This group already has 3 challenges running. Wait for one to finish.')}</p>}
      <Button block haptic busy={busy} disabled={full} onClick={start}>{t('Start challenge')}</Button>
    </>
  )

  return (
    <BottomSheet title={t('New challenge')} type="full" footer={footer}>
      <div className="g-jsheet">
        <div role="radiogroup" aria-label={t('Challenge')}>
          {templates().map(x => (
            <RadioRow key={x.id} title={x.title} sub={x.counts} selected={template === x.id} onClick={() => setTemplate(x.id)} />
          ))}
        </div>
        <p role="heading" aria-level={3} className="g-jsheet-h">{t('How long')}</p>
        <SegmentedControl label={t('How long')} options={spans()} value={span} onChange={setSpan} />
        <p className="g-jsheet-note">{t('Everyone gets an invite to join. Nobody is added without saying yes, and there are no winners: you all fill one bar.')}</p>
      </div>
    </BottomSheet>
  )
}

/** Opens the New challenge drawer for group `groupId` (board Fr3New) as a plain `openSheet`. */
export const newChallengeSheet = groupId => useUI.getState().openSheet(close => <NewChallenge groupId={groupId} close={close} />, { variant: 'ds' })
