import { t, tn, dateLocale } from '../../lib/i18n.js'

const pad = n => String(n).padStart(2, '0')

/** 14:20:05, the way a stopwatch reads. */
export function clockText(ms) {
  const s = Math.floor(Math.max(0, ms) / 1000)
  return `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`
}

/** The clock as it is spoken: "14 hours 20 minutes". Seconds are left out, they would be read
 *  out every tick. */
export function clockSpoken(ms) {
  const m = Math.floor(Math.max(0, ms) / 60000)
  return t('{0}, {1}',tn('{0} hour', '{0} hours', Math.floor(m / 60)), tn('{0} minute', '{0} minutes', m % 60))
}

/** A moment as a time of day. */
export const timeText = (ms, hour12) => new Date(ms).toLocaleTimeString(dateLocale(), { hour: 'numeric', minute: '2-digit', hour12 })

/** A moment as the weekday and time, "Mon, 12:00". */
export const dayTimeText = (ms, hour12) => new Date(ms).toLocaleString(dateLocale(), { weekday: 'short', hour: 'numeric', minute: '2-digit', hour12 })

/** A moment as the weekday, day, month and time, "Sun 18 Oct, 20:00". */
export const fullWhenText = (ms, hour12) => new Date(ms).toLocaleString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12 })

/** A moment as the weekday, day and month, "Wed 14 Oct". */
export const dateText = ms => new Date(ms).toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' })

/** A datetime-local field's value ("2026-10-14T21:30") is the person's own clock. */
export const localInputValue = ms => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
