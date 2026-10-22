import { useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'
import { dateLocale, t } from '../i18n.js'
import { memberTone } from '../../ds/MemberAvatar.jsx'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { friendsCardMenuSheet } from '../../components/FriendsCardMenuSheet.jsx'
import { friendsErrorText, sendCheer, undoCheer } from './api.js'
import { markCardSeen, readCardSeen, subscribeCardSeen } from './card-seen.js'
import { useFriendsMe, useGroups } from './use-friends.js'

// The Today Friends card (boards T1FFriends, T1FFriendsMenu): a section that exists only while
// something is new in the person's group. It is never an empty card: Friends off, no group,
// nothing newer than the last Hide or open, a first load, or no answer and nothing cached all give
// `null`, and Today draws nothing (no flash, no change to its height).

const MAX_MOMENTS = 2

/** "Mara and Radu" in the UI language. */
export function joinNames(names) {
  const list = names.filter(Boolean)
  try { return new Intl.ListFormat(dateLocale(), { style: 'long', type: 'conjunction' }).format(list) } catch { return list.join(', ') }
}

/** One moment as a sentence: "Mara finished Legs", "Radu set a new best". */
export function momentLine(m) {
  const who = joinNames(m.names || [])
  if (!who) return null
  switch (m.kind) {
    case 'workout': return m.title ? t('{0} finished {1}', who, m.title) : t('{0} finished a workout', who)
    case 'together': return t('{0} trained together', who)
    case 'best': return t('{0} set a new best', who)
    case 'target': return t('{0} reached their targets', who)
    default: return null
  }
}

/**
 * What the card shows, or null: the group the newest moments are in (it must still be one of the
 * person's groups), up to two of them, and when the newest happened. Only a moment newer than
 * `seenAt` counts, and `newCount` must agree there is something.
 */
export function cardOf(me, groups, seenAt = 0) {
  if (!me?.on || !Array.isArray(groups) || !groups.length) return null
  const newest = me.newest
  if (!(me.newCount > 0) || !newest || !Array.isArray(newest.moments)) return null
  const at = Date.parse(newest.at)
  if (!Number.isFinite(at) || at <= seenAt) return null
  const group = groups.find(g => g.id === newest.group)
  const moments = newest.moments.filter(m => m && m.id && momentLine(m)).slice(0, MAX_MOMENTS)
  if (!group || !moments.length) return null
  return { group, at, moments }
}

/** The line under it: "Iron Sunday · 17 of 22 this week", the numbers from the group's own payload and left out when the week has no plan. */
export function groupLineOf(group) {
  return [group.name, group.week?.planned > 0 ? t('{0} of {1} this week', group.week.done, group.week.planned) : null].filter(Boolean).join(' · ')
}

// The people the line is about, as avatars in the colour they have in the group.
function avatarsOf(card) {
  const people = []
  for (const m of card.moments) {
    for (const name of m.names || []) if (name && !people.includes(name)) people.push(name)
  }
  return people.slice(0, 2).map(name => {
    const i = card.group.members?.findIndex(x => x.name === name) ?? -1
    return { initial: name, tone: memberTone(i < 0 ? people.indexOf(name) : i) }
  })
}

const toast = (msg, opts) => useUI.getState().toast(msg, opts)

/**
 * What TodayScreen's `friends` prop takes, or null: { avatars, line, groupLine, cheered, labels,
 * onCheer, onOpen, onMenu }. Cheer cheers the newest moment, optimistic with an 8 s Undo (the
 * same pattern as the group page); a failed write puts the pill back and says so.
 */
export function useTodayCard() {
  const nav = useNavigate()
  const { me } = useFriendsMe()
  const { groups } = useGroups()
  const uid = useStore(s => String(s.user?.id ?? s.user?.name ?? ''))
  const seenAt = useSyncExternalStore(subscribeCardSeen, () => readCardSeen(uid), () => 0)
  const [cheeredIds, setCheeredIds] = useState(() => new Set())
  const sending = useRef(new Map())
  const card = useMemo(() => cardOf(me, groups, seenAt), [me, groups, seenAt])
  if (!card) return null

  const [first] = card.moments
  const cheered = !!first.cheered || cheeredIds.has(first.id)
  const mark = (id, on) => setCheeredIds(prev => {
    const next = new Set(prev)
    if (on) next.add(id); else next.delete(id)
    return next
  })

  const cheer = () => {
    const body = { group: card.group.id, kind: 'moment', ref: first.id }
    const who = joinNames(first.names || [])
    mark(first.id, true)
    const sent = sendCheer(body)
    sending.current.set(first.id, sent)
    sent.catch(e => {
      mark(first.id, false)
      toast(friendsErrorText(e))
    })
    toast(t('Cheered {0}', who), {
      action: t('Undo'),
      onAction: async () => {
        mark(first.id, false)
        // A cheer that never went was already put right above: nothing to take back.
        const went = await sending.current.get(first.id).then(() => true, () => false)
        if (!went) return
        try {
          await undoCheer(body)
        } catch (e) {
          // The server could not take it back, so the cheer stands.
          mark(first.id, true)
          toast(friendsErrorText(e))
        }
      },
    })
  }

  return {
    avatars: avatarsOf(card),
    line: card.moments.map(momentLine).join(' · '),
    groupLine: groupLineOf(card.group),
    cheered,
    labels: { cheer: t('Cheer'), cheered: t('Cheered'), menu: t('Friends card options') },
    onCheer: cheer,
    onOpen: () => {
      markCardSeen(uid, Math.max(Date.now(), card.at))
      nav('/me/groups/' + encodeURIComponent(card.group.id))
    },
    onMenu: () => friendsCardMenuSheet(card.group, { uid, at: card.at }),
  }
}
