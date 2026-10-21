// The notifications inbox's data (PR07 N1): the feed (feed.js), its read state (read-state.js) and
// this phone's permission (permission.js), for views/shared/Notifications.jsx and the bells.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import { todayISO } from '../format.js'
import { MOBILE, syncReminder } from '../mobile.js'
import { nutritionAvailable } from '../nutrition/api.js'
import { calorieTarget } from '../nutrition/diary.js'
import { diaryIndexDays, useDiaryIndex } from '../nutrition/diary-index.js'
import { useNutrition } from '../nutrition/store.js'
import { tabOf } from '../tab-route.js'
import { feedOf, targetPath } from './feed.js'
import { needsHomeScreen, readPermission, requestPermission } from './permission.js'
import { isUnread, readOf, unreadCount, withAllRead, withRead } from './read-state.js'
import { firedReminders } from './reminder-log.js'

const WEEK_MS = 7 * 86400000

/**
 * Whether a day was on target, for the weekly recap: logged, and no more than the day's calorie
 * target (the app's own "over" is eaten past it). Only a fixed target can be read for a past day
 * on the device, so Adaptive, Dynamic or a target that moves with activity give null, and so does
 * a diary index that has not caught every day up (`ready`). `days` is the diary index's.
 */
export function dayOnTargetOf(settings, days, ready) {
  if (!settings || !ready) return null
  if ((settings.calorieGoalMode || 'fixed') !== 'fixed') return null
  if (settings.diaryShowActivity && settings.calorieAdjustFromActivity) return null
  const kcal = new Map((days || []).map(d => [d.date, d.kcal]))
  return {
    dayOnTarget: iso => {
      const { target } = calorieTarget({ settings, date: iso })
      const had = kcal.get(iso)
      return Number.isFinite(target) && target > 0 ? Number(had) > 0 && had <= target : null
    },
  }
}

/** Today's date, as of when the app last came to the front: the feed's week ends roll over then. */
function useDay() {
  const [day, setDay] = useState(todayISO)
  useEffect(() => {
    const onShow = () => { if (document.visibilityState !== 'hidden') setDay(todayISO()) }
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [])
  return day
}

/** The feed and its read state, recomputed when the profile, the diary index or the day changes. */
function useFeed() {
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const settings = useNutrition(s => s.settings.data)
  const indexReady = useDiaryIndex(s => s.complete && s.synced)
  const indexVersion = useDiaryIndex(s => s.version)
  const day = useDay()
  const food = nutritionAvailable(user)
  // indexVersion: diaryIndexDays() is the same array until the days change.
  const nutrition = useMemo(() => (food ? dayOnTargetOf(settings, diaryIndexDays(), indexReady) : null), [food, settings, indexReady, indexVersion])
  const items = useMemo(() => feedOf(S, { now: Date.now(), nutrition, reminders: MOBILE ? firedReminders() : [] }), [S, nutrition, day])
  return { S, items, read: readOf(S) }
}

/** How many notifications are unread: the bell's dot and its name (StageHeader `unread`). */
export function useUnreadCount() {
  const { items, read } = useFeed()
  return unreadCount(items, read)
}

/**
 * Everything the inbox shows and does:
 *   items        the feed, newest first ({ id, kind, at, title, body, target }, feed.js)
 *   sections     { new, thisWeek, earlier }: New is every unread item; the read ones split at seven
 *                days back
 *   unreadCount
 *   isUnread(item)
 *   markRead(id), markAllRead()
 *   open(item)   reads it and goes to its target under the tab you are on; a target with no page
 *                (none yet) only reads it. Returns the path, or null.
 *   pathOf(item) that path, without going
 *   permission   'on' | 'off' | 'unsupported', or null until this device has answered
 *   turnOn()     asks the system where it can; else, or with the reminder off, opens Me › Reminders
 *   homeScreen   off because this is an iPhone browser tab: Gains has to go on the Home Screen first
 */
export function useNotifications() {
  const { S, items, read } = useFeed()
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
  }, [items, read.at, read.ids.join('\n')])

  const markRead = useCallback(id => {
    update(s => { s.notifRead = withRead(readOf(s), id, items) })
  }, [update, items])
  const markAllRead = useCallback(() => {
    update(s => { s.notifRead = withAllRead(Date.now()) })
  }, [update])

  const pathOf = useCallback(item => targetPath(item?.target, tab), [tab])
  const open = useCallback(item => {
    if (isUnread(item, read)) markRead(item.id)
    const path = pathOf(item)
    // A target that is gone opens its day, which says what changed (PR07Edges): the Day page reads
    // it from the location's state.
    if (path) nav(path, item.target?.changed ? { state: { changed: item.target.changed } } : undefined)
    return path
  }, [read, markRead, pathOf, nav])

  const turnOn = useCallback(async () => {
    const ok = await requestPermission()
    setPermission(await readPermission())
    if (!ok || !S.reminder?.on) { nav('/me/reminders'); return }
    if (MOBILE) await syncReminder(S)
  }, [S, nav])

  return {
    items, sections, unreadCount: sections.new.length,
    isUnread: item => isUnread(item, read),
    markRead, markAllRead, open, pathOf, permission, turnOn,
    homeScreen: permission === 'off' && needsHomeScreen(),
  }
}
