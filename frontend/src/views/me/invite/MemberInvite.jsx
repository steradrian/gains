import { t } from '../../../lib/i18n.js'
import { useDsAccent } from '../../../lib/use-ds-accent.js'
import { REQUEST_NOTE_MAX } from '../../../lib/me/invite-requests.js'
import { INVITE_TTL_DAYS } from '../../../lib/me/invites.js'
import { mePath } from '../../../lib/tab-route.js'
import { back } from '../../../lib/use-tab-nav.js'
import { useUI } from '../../../store/useUI.js'
import Button from '../../../ds/Button.jsx'
import GlassRow from '../../../ds/GlassRow.jsx'
import InlineBanner from '../../../ds/InlineBanner.jsx'
import InviteRow from '../../../ds/InviteRow.jsx'
import StageNavBar from '../../../ds/StageNavBar.jsx'
import StagePageTitle from '../../../ds/StagePageTitle.jsx'
import StageScreen from '../../../ds/StageScreen.jsx'
import StageSection from '../../../ds/StageSection.jsx'
import TextField from '../../../ds/TextField.jsx'
import { ME_ROW_SLOTS } from '../root-rows.js'
import { askFailureText, askedLine, askedTitle, atOpenCap, openCapLine } from './ask-data.js'
import { REAL_BACKEND, useAsk } from './use-ask.js'
import './invite.css'

const toast = (msg, opts) => useUI.getState().toast(msg, opts)

// Me > Invite a friend, the member's view (boards M5.4 Me5AskAdmin, M5.5 Me5Asked): members do not
// make invites, they ask. The copy names no admin; any of them may answer. A member who opens
// /me/invite from a push gets this page too. `backend` is for the screens gallery; `groupsOn`
// shows the Groups row, which exists once Friends fills the You slot (root-rows.js ME_ROW_SLOTS).
export default function MemberInvite({ backend = REAL_BACKEND, groupsOn = ME_ROW_SLOTS.you.some(r => r.id === 'groups' && (!r.visible || r.visible({}))) }) {
  const accent = useDsAccent()
  const ask = useAsk(backend)
  const capped = atOpenCap(ask.requests)
  const failure = ask.failure

  // Undo withdraws the ask just made. If the server cannot be reached the ask stays, and the
  // toast says so rather than pretending it is gone.
  const withdraw = async id => {
    try { await ask.withdraw(id) } catch (e) { toast(e.message) }
  }

  const submit = async e => {
    e.preventDefault()
    if (capped) return
    const made = await ask.send()
    if (made) toast(t('Asked an admin. You’ll hear when the invite is sent.'), { action: t('Undo'), onAction: () => withdraw(made.id) })
  }

  return (
    <StageScreen accent={accent}>
      <div className="inv">
        <StageNavBar onBack={() => back()} />
        <StagePageTitle title={t('Invite a friend')} line={t('Admins send the invites')} />
        <form className="inv-card" onSubmit={submit} noValidate>
          <GlassRow title={t('Only admins invite people to Gains')}
            sub={t('Ask an admin and they get a request with your note. They send them a link that works once, for {0} days.', INVITE_TTL_DAYS)} />
          <div className="inv-field">
            <TextField tone="stage" wide key={ask.fieldKey} label={t('Your note')} hint={t('Who they are, so the admin knows')}
              inputProps={{ maxLength: REQUEST_NOTE_MAX, autoComplete: 'off' }} onChange={ask.edit} />
          </div>
          {failure && (
            <div className="inv-field">
              <InlineBanner stage role="alert" key={failure.kind + ask.sending} title={askFailureText(failure)}
                actions={failure.kind === 'offline' ? [{ label: t('Try again'), onClick: submit }] : undefined} />
            </div>
          )}
          {capped && !failure && (
            <div className="inv-field"><InlineBanner stage title={openCapLine()} /></div>
          )}
          <Button block type="submit" busy={ask.sending} disabled={!ask.note.trim() || capped}>{t('Ask an admin')}</Button>
        </form>

        {ask.requests.length > 0 && (
          <section className="inv-group">
            <StageSection variant="label" title={t('Your open asks')} />
            <div className="inv-list">
              {ask.requests.map(r => (
                <InviteRow key={r.id} title={askedTitle(r)} line={askedLine(r)}
                  trailing={<Button size="sm" variant="glass" aria-label={t('{0}: {1}', t('Withdraw'), askedTitle(r))} onClick={() => withdraw(r.id)}>{t('Withdraw')}</Button>} />
              ))}
            </div>
          </section>
        )}

        {groupsOn && (
          <section className="inv-group">
            <div className="inv-list">
              <GlassRow title={t('Groups')} sub={t('Already on Gains? Add them to a group from Friends instead; group links only work for people who are in.')}
                trailing="chev" href={'#' + mePath('groups')} />
            </div>
          </section>
        )}
      </div>
    </StageScreen>
  )
}
