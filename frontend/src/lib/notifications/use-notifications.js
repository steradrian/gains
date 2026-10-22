// The notifications inbox's data (PR07 N1): the feed (feed.js), its read state (read-state.js) and
// this phone's permission (permission.js), for views/shared/Notifications.jsx and the bells.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import { MOBILE, syncReminder } from '../mobile.js'
import { useFoodOn } from '../nutrition/food-on.js'
import { resolveGoalFor } from '../nutrition/diary.js'
import { diaryIndexDays, useDiaryIndex } from '../nutrition/diary-index.js'
import { useNutrition } from '../nutrition/store.js'
import { tabOf } from '../tab-route.js'
import { feedKey, feedOf, targetPath } from './feed.js'
import { needsHomeScreen, readPermission, requestPermission } from './permission.js'
import { isUnread, readOf, unreadCount, withAllRead, withRead } from './read-state.js'
import { firedReminders, reminderLogRaw } from './reminder-log.js'

const WEEK_MS = 7 * 86400000

/**
 * Whether a day was on target, for the weekly recap: logged, and no more than that day's own
 * calorie goal (a weekday split resolves to its weekday, resolveGoalFor; the app's own "over" is
 * eaten past it). A day with nothing logged is not known, not off target. Only a fixed goal the
 * person set can be read back for a past day on the device, so Adaptive, Dynamic, a goal that
 * moves with activity, no goal at all (the diary's 2000 kcal stand-in), or a diary index that has
 * not caught every day up (`ready`) give null. `days` is the diary index's.
 */
export function dayOnTargetOf(settings, days, ready) {
  if (!settings || !ready) return null
  if ((settings.calorieGoalMode || 'fixed') !== 'fixed') return null
  if (settings.diaryShowActivity && settings.calorieAdjustFromActivity) return null
  const kcal = new Map((days || []).map(d => [d.date, d.kcal]))
  return {
    dayOnTarget: iso => {
      const target = Number(resolveGoalFor(settings.goals?.calories, iso))
      const had = Number(kcal.get(iso))
      if (!(target > 0) || !(had > 0)) return null
      return had <= target
    },
  }
}

/** Bumps each time the app comes back to the front: the week ends roll over, and reminders that
 *  went off while it was away are read in. */
function useShown() {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const onShow = () => { if (document.visibilityState !== 'hidden') setShown(n => n + 1) }
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [])
  return shown
}

/**
 * The feed and its read state. The feed is worked out again only when what it reads changes
 * (feedKey: workouts, plan, queue, routines, weigh-ins, …; the read state is held apart), the diary
 * index or this phone's reminder log changes, or the app comes back to the front; not on every
 * change to the profile. A profile from before the inbox (no `notifRead`) has everything up to its
 * first look read, once, so an upgrade does not open on thirty days of "new".
 */
function useFeed() {
  const key = useStore(s => feedKey(s.S))
  // As a string: the store clones the profile on every change, so the object is never the same.
  const readRaw = useStore(s => JSON.stringify(s.S?.notifRead ?? null))
  const ready = useStore(s => s.ready)
  const update = useStore(s => s.update)
  const settings = useNutrition(s => s.settings.data)
  const indexReady = useDiaryIndex(s => s.complete && s.synced)
  const indexVersion = useDiaryIndex(s => s.version)
  const shown = useShown()
  const food = useFoodOn()
  const log = MOBILE ? reminderLogRaw() : ''

  useEffect(() => {
    if (ready && useStore.getState().S.notifRead == null) update(s => { if (s.notifRead == null) s.notifRead = withAllRead(Date.now()) })
  }, [ready, readRaw, update])

  // indexVersion: diaryIndexDays() is the same array until the days change.
  const nutrition = useMemo(() => (food ? dayOnTargetOf(settings, diaryIndexDays(), indexReady) : null), [food, settings, indexReady, indexVersion])
  const items = useMemo(
    () => feedOf(useStore.getState().S, { now: Date.now(), nutrition, reminders: MOBILE ? firedReminders() : [] }),
    [key, nutrition, log, shown],
  )
  const read = useMemo(() => readOf({ notifRead: JSON.parse(readRaw) }), [readRaw])
  return { items, read }
}

/** How many notifications are unread: the bell's dot and its name (StageHeader `unread`). */
export function useUnreadCount() {
  const { items, read } = useFeed()
  return useMemo(() => unreadCount(items, read), [items, read])
}

/**
 * Everything the inbox shows and does:
 *   items        the feed, newest first ({ id, kind, at, title, body, target }, feed.js)
 *   sections     { new, thisWeek, earlier }: New is every unread item; the read ones split at seven
 *                days back
 *   unreadCount
 *   isUnread(item)
 *   markRead(item), markAllRead()
 *   open(item)   marks it read, then goes to targetPath(item.target, the tab you are on), with the
 *                target's "what changed" line in the location's state when it is gone. A target
 *                with no page only marks it read. Returns the path, or null.
 *   pathOf(item) that path, without going
 *   permission   'on' | 'off' | 'unsupported', or null until this device has answered
 *   turnOn()     asks the system where it can; else, or with the reminder off, opens Me › Reminders
 *   homeScreen   off because this is an iPhone browser tab: Gains has to go on the Home Screen first
 *   hasReminders whether reminders can land here at all: only the phone app logs the ones that go
 *                off (reminder-log.js); the web's are server pushes the inbox never sees
 */
export function useNotifications() {
  const { items, read } = useFeed()
  const update = useStore(s => s.update)
  const nav = useNavigate()
  const { pathname } = useLocation()
  const tab = tabOf(pathname) || 'home'
  const [permission, setPermission] = useState(null)

  useEffect(() => {
    let live = true
    const check = () => readPermission().then(p => { if (live) setPermission(p) })
    check()
    // Back from the system's settings, the answer may have changed.
    const onShow = () => { if (document.visibilityState !== 'hidden') check() }
    document.addEventListener('visibilitychange', onShow)
    return () => { live = false; document.removeEventListener('visibilitychange', onShow) }
  }, [])

  const sections = useMemo(() => {
    const weekAgo = Date.now() - WEEK_MS
    const out = { new: [], thisWeek: [], earlier: [] }
    for (const item of items) {
      if (isUnread(item, read)) out.new.push(item)
      else if (item.at >= weekAgo) out.thisWeek.push(item)
      else out.earlier.push(item)
    }
    return out
  }, [items, read])

  const markRead = useCallback(item => {
    update(s => { s.notifRead = withRead(readOf(s), item, Date.now()) })
  }, [update])
  const markAllRead = useCallback(() => {
    update(s => { s.notifRead = withAllRead(Date.now()) })
  }, [update])

  const pathOf = useCallback(item => targetPath(item?.target, tab), [tab])
  const open = useCallback(item => {
    if (isUnread(item, read)) markRead(item)
    const path = pathOf(item)
    // A target that is gone opens its day, which says what changed (PR07Edges): the Day page reads
    // it from the location's state.
    if (path) nav(path, item.target?.changed ? { state: { changed: item.target.changed } } : undefined)
    return path
  }, [read, markRead, pathOf, nav])

  const turnOn = useCallback(async () => {
    const ok = await requestPermission()
    setPermission(await readPermission())
    const S = useStore.getState().S
    if (!ok || !S.reminder?.on) { nav('/me/reminders'); return }
    if (MOBILE) await syncReminder(S)
  }, [nav])

  return {
    items, sections, unreadCount: sections.new.length,
    isUnread: item => isUnread(item, read),
    markRead, markAllRead, open, pathOf, permission, turnOn,
    homeScreen: permission === 'off' && needsHomeScreen(),
    hasReminders: MOBILE,
  }
}
