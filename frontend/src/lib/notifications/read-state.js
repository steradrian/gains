// Which notifications have been read (PR07 decision 1): one small synced field,
//
//   S.notifRead = { at, ids }
//
// Mark all read sets `at` to now and empties `ids`; reading one item adds its id. An item is
// unread when it is newer than `at` and its id is not in `ids`. The feed's ids are stable (kind +
// source key, lib/notifications/feed.js), so a read survives every recompute. Each write keeps
// only the ids still in the feed, which holds 30 days, so the list never grows past that.

export const EMPTY_READ = { at: 0, ids: [] }

/** S.notifRead, cleaned: a missing or hand-edited field reads as nothing read. */
export function readOf(S) {
  const r = S?.notifRead
  return {
    at: Number.isFinite(r?.at) ? r.at : 0,
    ids: Array.isArray(r?.ids) ? r.ids.filter(id => typeof id === 'string') : [],
  }
}

export const isUnread = (item, read = EMPTY_READ) => item.at > (read.at || 0) && !read.ids.includes(item.id)

/** The read state with item `id` read; ids no longer in `items` (past 30 days, or gone) dropped. */
export function withRead(read, id, items) {
  const live = new Set(items.filter(i => isUnread(i, { at: read.at, ids: [] })).map(i => i.id))
  if (!live.has(id)) return read
  return { at: read.at, ids: [...new Set([...read.ids.filter(x => live.has(x)), id])] }
}

/** Everything up to `now` read. */
export const withAllRead = now => ({ at: now, ids: [] })

/** How many of `items` are unread. */
export const unreadCount = (items, read) => items.reduce((n, i) => n + (isUnread(i, read) ? 1 : 0), 0)
