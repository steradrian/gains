// Which notifications have been read (PR07 decision 1): one small synced field,
//
//   S.notifRead = { at, ids: { [id]: when the item happened } }
//
// Mark all read sets `at` to now and empties `ids`; reading one item adds its id with the item's
// own time. An item is unread when it is newer than `at` and its id is not in `ids`. The feed's ids
// are stable (kind + source key, lib/notifications/feed.js), so a read survives every recompute.
// Each write drops the ids older than KEEP_DAYS, the feed's reach, by their own time, never by
// whether this device's feed still holds them: a phone's read of a reminder only it logged stays
// read when the desktop, which has no such item, reads something else. `null` (never set) is a
// profile from before the inbox, which the hook seeds once (use-notifications.js).

export const KEEP_DAYS = 30
const DAY_MS = 86400000
export const EMPTY_READ = { at: 0, ids: {} }

const isMap = v => !!v && typeof v === 'object' && !Array.isArray(v)

/** S.notifRead, cleaned: a missing or hand-edited field reads as nothing read. */
export function readOf(S) {
  const r = S?.notifRead
  const ids = {}
  if (isMap(r?.ids)) for (const [id, at] of Object.entries(r.ids)) if (Number.isFinite(at)) ids[id] = at
  return { at: Number.isFinite(r?.at) ? r.at : 0, ids }
}

export const isUnread = (item, read = EMPTY_READ) => item.at > (read.at || 0) && !Object.hasOwn(read.ids, item.id)

/** The read state with `item` read, as of `now`; ids past KEEP_DAYS, or that Mark all read covers
 *  since, dropped. An item already read changes nothing. */
export function withRead(read, item, now = Date.now()) {
  if (!item || !isUnread(item, read)) return read
  const from = now - KEEP_DAYS * DAY_MS
  const ids = {}
  for (const [id, at] of Object.entries(read.ids)) if (at > read.at && at >= from) ids[id] = at
  ids[item.id] = item.at
  return { at: read.at, ids }
}

/** Everything up to `now` read. */
export const withAllRead = now => ({ at: now, ids: {} })

/** How many of `items` are unread. */
export const unreadCount = (items, read) => items.reduce((n, i) => n + (isUnread(i, read) ? 1 : 0), 0)
