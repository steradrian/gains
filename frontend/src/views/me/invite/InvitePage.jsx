import { t } from '../../../lib/i18n.js'
import { useDsAccent } from '../../../lib/use-ds-accent.js'
import { INVITE_TTL_DAYS } from '../../../lib/me/invites.js'
import Button from '../../../ds/Button.jsx'
import GlassRow from '../../../ds/GlassRow.jsx'
import InviteRow from '../../../ds/InviteRow.jsx'
import StageEmpty from '../../../ds/StageEmpty.jsx'
import StageNavBar from '../../../ds/StageNavBar.jsx'
import StagePageTitle from '../../../ds/StagePageTitle.jsx'
import StageScreen from '../../../ds/StageScreen.jsx'
import StageSection from '../../../ds/StageSection.jsx'
import Tag from '../../../ds/Tag.jsx'
import { askLine, askTitle, expiredLine, inviteTitle, joinedLine, joinedTitle, waitingLine } from './invite-data.js'
import './invite.css'

// Me > Invite a friend, the admin's page (boards M5.0 Me5Invite, M5.3 Me5Error): a card with the
// way in, then the groups. It draws what useInvite() gives it and holds nothing.
//
//   status       'loading' | 'ready' | 'error'
//   groups       { waiting, joined, expired } of the server's invites; requests the members' open asks
//   inviteOnly   false when the server lets anyone sign up, which changes the card's line
//   fresh        code -> how the link went, for the invites made in this visit
//   onCreate     Create an invite link; onAnswer(request) a New invite for an ask; onMenu(invite) a
//                Waiting row; onRenew(invite) New link on an expired one; onRetry Try again
export default function InvitePage({ status, groups, requests, inviteOnly, fresh, onBack, onCreate, onAnswer, onMenu, onRenew, onRetry }) {
  const accent = useDsAccent()
  const { waiting, joined, expired } = groups
  const ready = status === 'ready'

  return (
    <StageScreen accent={accent}>
      <div className="inv">
        <StageNavBar onBack={onBack} />
        <StagePageTitle title={t('Invite a friend')} line={t('Admins can invite · links that work once')} />
        <div className="inv-card">
          <GlassRow title={t('Bring a friend in')}
            sub={inviteOnly
              ? t('Gains is invite-only, and admins send the invites. Each link works once and lasts {0} days.', INVITE_TTL_DAYS)
              : t('Sign-up is open, so invites are optional here. They only record who invited whom.')} />
          <Button block icon="plus" onClick={onCreate}>{t('Create an invite link')}</Button>
        </div>

        {status === 'loading' && (
          <div className="inv-skeleton" role="status" aria-label={t('Loading…')}>
            {[0, 1, 2].map(i => <i key={i} className="g-skel inv-sk" />)}
          </div>
        )}

        {status === 'error' && (
          <StageEmpty card={false} illustration="search" title={t('Couldn’t load invites')}
            body={t('Check your connection. Links you already sent still work.')}
            action={t('Try again')} onClick={onRetry} />
        )}

        {ready && (
          <>
            {requests.length > 0 && (
              <Group title={t('Asked')}>
                {requests.map(r => (
                  <InviteRow key={r.id} title={askTitle(r)} line={askLine(r)}
                    trailing={<Button size="sm" variant="glass" aria-label={t('{0}: {1}', t('New invite'), askTitle(r))} onClick={() => onAnswer(r)}>{t('New invite')}</Button>} />
                ))}
              </Group>
            )}
            {waiting.length > 0 && (
              <Group title={t('Waiting')}>
                {waiting.map(i => (
                  <InviteRow key={i.code} title={inviteTitle(i)} line={waitingLine(i, fresh[i.code])}
                    trailing={fresh[i.code] ? <Tag tone="glass">{t('New')}</Tag> : undefined}
                    onClick={() => onMenu(i)} />
                ))}
              </Group>
            )}
            {joined.length > 0 && (
              <Group title={t('Joined')} action={String(joined.length)}>
                {joined.map(i => <InviteRow key={i.code} title={joinedTitle(i)} line={joinedLine(i)} />)}
              </Group>
            )}
            {expired.length > 0 && (
              <Group title={t('Expired')}>
                {expired.map(i => (
                  <InviteRow key={i.code} title={inviteTitle(i)} line={expiredLine(i)}
                    trailing={<Button size="sm" variant="glass" aria-label={t('{0}: {1}', t('New link'), inviteTitle(i))} onClick={() => onRenew(i)}>{t('New link')}</Button>} />
                ))}
              </Group>
            )}
          </>
        )}
      </div>
    </StageScreen>
  )
}

function Group({ title, action, children }) {
  return (
    <section className="inv-group">
      <StageSection variant="label" title={title} action={action} />
      <div className="inv-list">{children}</div>
    </section>
  )
}
