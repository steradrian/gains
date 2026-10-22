import { t, tn, LANGS, dateLocale } from '../../lib/i18n.js'
import { COACH_COMING_SOON } from '../../lib/coach-availability.js'
import { defaultBarWeight } from '../../lib/bar.js'
import { fmtAgo } from '../../lib/format.js'
import { effortOf } from '../../lib/history.js'
import { fmtRest } from '../../lib/duration.js'
import { draftOf } from '../../lib/nutrition/goals.js'
import { settingOf } from '../../lib/nutrition/use-nt-settings.js'
import { accentLabel } from '../../lib/themes.js'
import { BRAND } from '../../brand.js'
import { scheduleModeOf } from '../../lib/rotation.js'
import { featuresFor, SEARCH } from '../settings-pages.js'
import { groupsRowValue } from '../friends/me-rows.js'

// What each row of the Settings root says about its page, so most questions are answered without
// opening it (boards St1Settings, A1.0). Pure: `S`, the device's `ctx` (use-settings-ctx.js) and a few
// store slices in, strings out. A row with nothing to say has no entry; a value that cannot be
// read yet (the nutrition settings still loading) is null, never a guess.

const EFFORT_LABEL = { rir: 'RIR', rpe: 'RPE' }
const MEAL_SLOTS_DEFAULT = 4
const QUICK_WATER_ML = 250

const kcal = n => t('{0} kcal', Number(n).toLocaleString(dateLocale()))

// The reminder switches that are on: the ones the Reminders page lists as `feature` rows.
const remindersOn = (S, ctx) => SEARCH.filter(e => e.page === 'reminders' && e.feature && e.feature(S, ctx) === true).length

// Features: Fasting is the one headline switch (it has no other home); without nutrition, how many
// of the off-by-default switches are on.
function featuresValue(S, ctx) {
  if (ctx.nutrition) return ctx.ntSettings ? (ctx.fastingOn ? t('Fasting on') : t('Fasting off')) : null
  const on = featuresFor(ctx).filter(e => e.feature(S, ctx) === true).length
  return on ? t('{0} on', on) : null
}

function equipmentValue(S) {
  const active = (S.equipProfiles || []).find(p => p.id === S.activeEquipId)
  if (S.equipFilterOn && active) return active.name
  const unit = S.unit === 'lb' ? 'lb' : 'kg'
  return t('{0} {1} bar', defaultBarWeight('barbell', unit), unit)
}

function goals(ctx) {
  const nt = ctx.ntSettings
  if (!nt) return { value: null, sub: null }
  const d = draftOf(nt)
  const mode = { adaptive: t('Adaptive'), dynamic: t('Dynamic') }[d.mode] || t('My goal')
  return { value: d.kcal ? kcal(d.kcal) : null, sub: mode }
}

function waterValue(ctx) {
  const nt = ctx.ntSettings
  if (!nt) return null
  const n = (settingOf(nt, 'waterContainers') || []).length
  return n ? tn('{0} container', '{0} containers', n) : t('{0} ml', QUICK_WATER_ML)
}

const countOf = (ctx, key) => (ctx.ntSettings ? String((settingOf(ctx.ntSettings, key) || []).length) : null)

/**
 * The value (and, where it is data rather than fixed copy, the line under the title) of every
 * root row, by page id: `{ [id]: { value, sub? } }`. `lang` is the app's language code,
 * `coachLocal` the phone's Coach setup, `host` the server's address and `synced` the Sync row's
 * word (syncRowWord below); both are null off an account that syncs.
 */
export function rowValues({ S, ctx, lang, coachLocal = null, host = null, synced = null }) {
  const nt = ctx.ntSettings
  const effort = EFFORT_LABEL[effortOf(S)]
  const g = goals(ctx)
  const reminders = remindersOn(S, ctx)
  const meals = nt ? (nt.mealNames?.length ?? MEAL_SLOTS_DEFAULT) : null
  return {
    appearance: { value: accentLabel(S) },
    units: { value: (S.unit || 'kg') + ' · ' + (LANGS[lang] || lang) },
    reminders: { value: reminders ? t('{0} on', reminders) : t('Off') },
    features: { value: featuresValue(S, ctx) },
    workout: { value: [effort, S.restSec > 0 ? t('{0} rest', fmtRest(S.restSec)) : t('No rest timer')].filter(Boolean).join(' · ') },
    schedule: { value: scheduleModeOf(S) === 'rotation' ? t('Rotation') : t('Fixed Week') },
    equipment: { value: equipmentValue(S) },
    coach: { value: COACH_COMING_SOON ? t('Coming soon') : coachLocal?.mode === 'server' ? t('Your server') : coachLocal?.mode === 'byok' ? t('Your API key') : t('Off') },
    goals: g,
    diary: { value: meals == null ? null : tn('{0} meal', '{0} meals', meals) },
    water: { value: waterValue(ctx) },
    sources: { value: nt ? (settingOf(nt, 'offEnabled') ? t('On') : t('Off')) : null },
    categories: { value: countOf(ctx, 'foodCategories') },
    customUnits: { value: countOf(ctx, 'customUnits') },
    backup: { value: synced, sub: host },
    about: { sub: t('Version {0}, licences', BRAND.version) },
    // Friends core m1
    groups: groupsRowValue(),
  }
}

/**
 * The sync pill under the account card (A1.0, A3.3, PR06Edges "offline"): null where nothing
 * syncs (a guest, the demo, a phone kept local). `view` is connectionView(sync, { online });
 * `waiting` the changes this device holds for the server (the store's unsyncedChanges count);
 * `deletion` is `user.deletion`. States: 'ok' "All synced · 2 min ago", 'waiting' "3 changes
 * waiting", 'paused' "Sync paused · deletion scheduled", 'problem' with the view's own line.
 */
export function syncPill({ view, lastSynced = null, waiting = 0, deletion = null, now = Date.now() }) {
  if (deletion) return { state: 'paused', label: t('Sync paused'), trail: t('deletion scheduled') }
  if (!view || view.tone === 'quiet') return null
  if (view.tone === 'ok') return { state: 'ok', label: view.line, trail: lastSynced ? fmtAgo(lastSynced, now) : null }
  if (waiting > 0 && (view.tone === 'off' || view.tone === 'wait')) {
    return { state: 'waiting', label: tn('{0} change waiting', '{0} changes waiting', waiting), trail: null }
  }
  return { state: view.tone === 'bad' ? 'problem' : 'waiting', label: view.line, trail: null }
}

/** The word on the Sync and backup row: how the server stands, in one word. */
export function syncRowWord(pill) {
  if (!pill) return null
  return { ok: t('Synced'), waiting: t('Waiting'), paused: t('Paused'), problem: t('Needs a look') }[pill.state]
}

/** "Owner · 2 passkeys · this iPhone": who the account card says this is. */
export function accountLine({ user, demo, mobile, passkeys = null, device }) {
  if (demo) return t('Example data, only in this browser.')
  if (!user) return mobile ? t('All data stays on this phone') : t('Your data lives on this device. Sign in to sync.')
  const parts = [user.admin ? t('Admin') : t('Member')]
  if (passkeys > 0) parts.push(tn('1 passkey', '{0} passkeys', passkeys))
  parts.push(device)
  return parts.join(' · ')
}

/** The device the account card names, from the browser's user agent. */
export function deviceWord(ua = '') {
  if (/iPhone/.test(ua)) return t('this iPhone')
  if (/iPad/.test(ua)) return t('this iPad')
  if (/Android/.test(ua)) return t('this phone')
  return t('this device')
}

/** The line under Sign out: it leaves this device only. */
export function deviceOnly(ua = '') {
  if (/iPhone/.test(ua)) return t('This iPhone only')
  if (/iPad/.test(ua)) return t('This iPad only')
  if (/Android/.test(ua)) return t('This phone only')
  return t('This device only')
}

/** The day a scheduled deletion happens, "Sun 25 Oct", in the app's language. */
export function deletionDate(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  try { return new Intl.DateTimeFormat(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' }).format(d) } catch { return d.toDateString() }
}
