import { fmtAgo, fmtDate, isoOf } from '../format.js'
import { t } from '../i18n.js'
import { memberTone } from '../../ds/MemberAvatar.jsx'

// The rows of Cheers for you (board Fr8Cheers) from this week's cheers (use-cheers.js) and the
// person's groups. Every line is built here from the data and left out when the data cannot back
// it: a week that everyone cheered is one row, and its streak line appears only when the cheer
// carries a streak.

const DAY_MS = 86400000
const text = v => (typeof v === 'string' ? v : '')

/** One GET /cheers row, cleaned: a row with no sender or no time is not shown (null). `at` becomes ms. */
export function cheerOf(raw) {
  const at = Date.parse(raw?.at)
  const name = text(raw?.from?.name)
  if (!raw || !name || !Number.isFinite(at)) return null
  const group = raw.group && typeof raw.group === 'object' ? raw.group : { id: text(raw.group) }
  return {
    id: text(raw.id) || `${raw.kind}:${raw.ref}:${raw.from?.uid}`,
    uid: text(raw.from?.uid),
    name,
    groupId: text(group.id),
    groupName: text(group.name),
    kind: ['moment', 'week', 'challenge'].includes(raw.kind) ? raw.kind : 'moment',
    moment: text(raw.moment),
    ref: text(raw.ref),
    label: text(raw.label),
    detail: text(raw.detail),
    streak: Number.isFinite(raw.streak) ? raw.streak : 0,
    at,
  }
}

/** "2 h ago" within a day, else the short date, in the UI language. */
export function cheerWhen(at, now = Date.now()) {
  return now - at < DAY_MS ? fmtAgo(at, now) : fmtDate(isoOf(new Date(at)), true)
}

// Streak 1 is a goal hit with nothing to run yet; 2+ is a run.
const weekDetail = streak => {
  if (streak >= 2) return t('Goal hit · {0} weeks in a row', streak)
  return streak === 1 ? t('Goal hit') : ''
}

function momentText(c) {
  if (c.moment === 'best') return c.label ? t('{0} cheered your new best {1}', c.name, c.label) : t('{0} cheered your new best', c.name)
  return c.label ? t('{0} cheered your {1}', c.name, c.label) : t('{0} cheered you', c.name)
}

function textOf(c) {
  if (c.kind === 'week') return t('{0} cheered your week', c.name)
  if (c.kind === 'challenge') return c.label ? t('{0} cheered you on in {1}', c.name, c.label) : t('{0} cheered you on', c.name)
  return momentText(c)
}

/**
 * The rows, newest first: `{ key, initial, tone, text, detail, at }`. `groups` are GroupSummaries
 * (member colours, who "everyone" is); with more than one group each row also names its group.
 */
export function cheerRows(cheers, groups = []) {
  const byId = new Map(groups.map(g => [g.id, g]))
  const several = groups.length > 1
  const toneOf = (c, g) => {
    const i = g?.members?.findIndex(m => m.uid === c.uid) ?? -1
    return memberTone(i < 0 ? 0 : i)
  }
  const withGroup = (c, detail) => [several ? c.groupName || byId.get(c.groupId)?.name : '', detail].filter(Boolean).join(' · ')

  const weeks = new Map()
  const rows = []
  for (const c of cheers) {
    const g = byId.get(c.groupId)
    if (c.kind === 'week') {
      const key = c.groupId + '|' + c.ref
      weeks.set(key, [...(weeks.get(key) || []), c])
      continue
    }
    rows.push({ key: c.id, initial: c.name, tone: toneOf(c, g), text: textOf(c), detail: withGroup(c, c.detail), at: c.at })
  }
  for (const [key, list] of weeks) {
    const g = byId.get(list[0].groupId)
    const others = (g?.memberCount || 0) - 1
    const senders = new Set(list.map(c => c.uid || c.name))
    const streak = Math.max(...list.map(c => c.streak))
    const at = Math.max(...list.map(c => c.at))
    if (others >= 2 && senders.size >= others) {
      rows.push({
        key: 'week:' + key, initial: g.name, tone: 'glass', text: t('Everyone cheered the week'),
        detail: withGroup(list[0], weekDetail(streak)), at,
      })
    } else {
      for (const c of list) rows.push({ key: c.id, initial: c.name, tone: toneOf(c, g), text: textOf(c), detail: withGroup(c, c.detail), at: c.at })
    }
  }
  return rows.sort((a, b) => b.at - a.at || (a.key < b.key ? -1 : 1))
}
