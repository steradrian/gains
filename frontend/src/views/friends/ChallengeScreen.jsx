import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { friendsErrorText, sendCheer, undoCheer } from '../../lib/friends/api.js'
import {
  countsLine, datesLine, endPhrase, joinCaption, plannedToday, startCaption, toReach,
} from '../../lib/friends/challenge-copy.js'
import { useChallenge } from '../../lib/friends/use-challenge.js'
import { useGroup } from '../../lib/friends/use-group.js'
import { todayISO } from '../../lib/format.js'
import { t } from '../../lib/i18n.js'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { readyOrStart } from '../../sheets.jsx'
import { newChallengeSheet } from '../../components/NewChallengeSheet.jsx'
import Button from '../../ds/Button.jsx'
import InlineBanner from '../../ds/InlineBanner.jsx'
import StageEmpty from '../../ds/StageEmpty.jsx'
import StagePage from '../../ds/StagePage.jsx'
import ChallengeDone from './ChallengeDone.jsx'
import ChallengeProgress from './ChallengeProgress.jsx'
import ChallengeWho from './ChallengeWho.jsx'
import { GROUPS_PATH } from './me-rows.js'

const toast = (msg, opts) => useUI.getState().toast(msg, opts)

/**
 * /me/groups/:id/challenge/:cid (boards Fr3Join, Fr3Challenge, Fr3Done): one shared bar the group
 * fills together. Not joined: Count me in. Joined: the bar, Start <today's workout> when one is
 * planned, and a quiet Leave challenge that leaves at once with an Undo (Undo joins again; leaving
 * takes off only that person's count). Done: You did it, together. Missed: how far the group got,
 * never who fell short. Nobody is ranked and nothing is red. It draws lib/friends/use-challenge
 * (refetched on mount, focus and every 60 s); a 404 means the person is no longer in the group, so
 * the page goes up to the group, which then leaves for Groups.
 */
export default function ChallengeScreen() {
  const { id, cid } = useParams()
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const { group } = useGroup(id)
  const { challenge: ch, status, stale, joinChallenge, leaveChallenge } = useChallenge(id, cid)
  const [joining, setJoining] = useState(false)
  const [cheered, setCheered] = useState(false)
  const groupPath = GROUPS_PATH + '/' + encodeURIComponent(id)

  useEffect(() => {
    if (status === 'gone') nav(groupPath, { replace: true })
  }, [status, nav, groupPath])

  if (!ch) {
    return (
      <StagePage parent={groupPath}>
        {status === 'error' && (
          <StageEmpty illustration="search" card={false} title={t("Can't load this challenge")} body={t('Check your connection, then open it again.')} />
        )}
      </StagePage>
    )
  }

  const today = todayISO()
  const me = group?.members.find(m => m.you)?.uid ?? user?.id
  const state = ch.state || 'active'
  const running = state === 'active'
  const joined = !!ch.you?.in
  const pick = () => newChallengeSheet(id)
  const fail = err => toast(friendsErrorText(err))

  const countMeIn = async () => {
    if (joining) return
    setJoining(true)
    try { await joinChallenge() } catch (err) { fail(err) }
    setJoining(false)
  }
  // Leaving is immediate (no confirm): the toast's Undo is the way back, and it joins again.
  const rejoin = async () => {
    try { await joinChallenge() } catch (err) { fail(err) }
  }
  const leave = async () => {
    try { await leaveChallenge() } catch (err) { fail(err); return }
    toast(t('Left the challenge'), { action: t('Undo'), onAction: rejoin })
  }

  const takeBack = async () => {
    setCheered(false)
    try { await undoCheer({ group: id, kind: 'challenge', ref: cid }) } catch (err) { setCheered(true); fail(err) }
  }
  const cheerAll = async () => {
    setCheered(true)
    toast(t('Cheered everyone'), { action: t('Undo'), onAction: takeBack })
    try { await sendCheer({ group: id, kind: 'challenge', ref: cid }) } catch (err) { setCheered(false); fail(err) }
  }

  const plan = joined && ch.template === 'workouts' ? plannedToday(S, today) : null
  const reach = toReach(ch, me)
  const counts = ch.template !== 'workouts' ? ch.detail || countsLine(ch.template) : null

  return (
    <StagePage parent={groupPath} largeTitle={ch.title} sub={datesLine(ch, me)}>
      {stale && (
        <div className="g-sp-card">
          <InlineBanner stage tone="muted" icon="wifiOff" title={t("Can't reach the server, showing the last update")} />
        </div>
      )}

      {state === 'done' ? (
        <ChallengeDone challenge={ch} group={group} cheered={cheered} onCheer={cheerAll} onPick={pick} />
      ) : (
        <>
          <ChallengeProgress challenge={ch} group={group} phrase={running ? endPhrase(ch.end, today) : t('Ended')} />

          {running && !joined && (
            <div className="g-sp-card g-fgroups">
              <Button block haptic busy={joining} onClick={countMeIn}>{t('Count me in')}</Button>
              <p className="g-cnote">{joinCaption(ch)}</p>
            </div>
          )}

          {running && joined && (plan || counts) && (
            <div className="g-sp-card g-fgroups">
              {plan && <Button block onClick={() => readyOrStart(plan.ids)}>{t('Start {0}', plan.name)}</Button>}
              {plan && reach && <p className="g-cnote">{startCaption(reach)}</p>}
              {counts && <p className="g-cnote">{counts}</p>}
            </div>
          )}

          {state === 'missed' && (
            <div className="g-sp-card">
              <Button block onClick={pick}>{t("Pick next week's challenge")}</Button>
            </div>
          )}
        </>
      )}

      <ChallengeWho challenge={ch} group={group} me={me} />

      {running && joined && (
        <div className="g-sp-card">
          <Button block variant="glass" haptic onClick={leave}>{t('Leave challenge')}</Button>
        </div>
      )}
    </StagePage>
  )
}
