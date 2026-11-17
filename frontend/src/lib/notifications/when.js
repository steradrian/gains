// A notification's meta line (board Sh3Notifications): what kind it is and when, "New best · Mon 12
// Oct, 19:24", "Streak · Sun 11 Oct". Something from the last day says how long ago, in the UI
// language (fmtAgo). A week's streak and recap are dated by the week's last day, never its last
// second, so they always show the date; a new best keeps its time of day, as the board draws it.
import { dateLocale, t } from '../i18n.js'
import { fmtAgo, fmtDate, isoOf } from '../format.js'

const DAY_MS = 86400000
const WEEK_KINDS = ['streak', 'recap']

function kindLabel(kind) {
  switch (kind) {
    case 'coach': return t('Coach')
    case 'best': return t('New best')
    case 'streak': return t('Streak')
    case 'recap': return t('Weekly recap')
    case 'milestone': return t('Milestone')
    case 'cheer': return t('Cheer')
    case 'invite': return t('Invite')
    default: return t('Reminder you set')
  }
}

/** The meta line of `item` ({ kind, at }) as of `now`. */
export function whenOf(item, now = Date.now()) {
  const d = new Date(item.at)
  let when
  if (!WEEK_KINDS.includes(item.kind) && now - item.at < DAY_MS) when = fmtAgo(item.at, now)
  else if (item.kind === 'best') when = t('{0}, {1}', fmtDate(isoOf(d), true), d.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' }))
  else when = fmtDate(isoOf(d), true)
  return kindLabel(item.kind) + ' · ' + when
}
