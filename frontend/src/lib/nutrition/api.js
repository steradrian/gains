// NutriTrace (nutrition) and the hub's sync routes, as the browser reaches them: same origin, the
// openGym session cookie, through the hub at /nt/api/* and /hub/api/sync/*. The hub checks the
// session and the request's origin itself (Sec-Fetch-Site), so there is no token to send, and it
// forwards only the routes in fitness-hub src/nt-routes.ts: a call to anything else is a 404.
// Every shape here is NutriTrace's own (server/routes/*.js, src/lib/api.js, src/stores/diary.js).
import { appBase } from '../app-base.js'
import { MOBILE } from '../mobile.js'
import { offSearchUrl } from './off.js'

/**
 * Per-serving nutrients keyed by NutriTrace nutrient id: calories (kcal), proteins,
 * carbohydrates, fat, fiber, sugars, salt (g); sodium, potassium, cholesterol (mg); ...
 * (src/lib/nutrition.js NUTRIMENTS).
 * @typedef {Record<string, number>} Nutrition
 */
/**
 * One logged entry of a day. `meal` is the slot index into the meal names; `quantity` is the
 * number of servings; `portion` + `unit` the serving; `nutrition` per serving, already scaled
 * to that portion. `type: 'quick_calories'` rows carry only `name` and `nutrition`.
 * @typedef {{ uuid: string, meal: number, addedAt: string, updatedAt?: string, type?: 'quick_calories',
 *   id?: number, food_server_id?: number|null, is_recipe?: boolean, name: string, brand?: string,
 *   portion?: number, unit?: string, quantity?: number, nutrition: Nutrition, notes?: string,
 *   imgUrl?: string, source?: string, _splitItems?: DiaryItem[] }} DiaryItem
 */
/** @typedef {{ uuid: string, amount: number, time: string }} WaterLog  amount in ml */
/**
 * GET/PUT /api/diary/:date. A day with nothing logged answers this shape with empty lists.
 * @typedef {{ date: string, items: DiaryItem[], water: WaterLog[], body_stats: Record<string, number>,
 *   notes: string, completed_at: string|null, completed_meals: number[],
 *   tombstones?: { kind: 'item'|'water', uuid: string, deleted_at: string }[] }} DiaryDay
 */
/**
 * PUT /api/diary/:date body. The server merges per uuid: entries named are added or updated,
 * uuids in deleted_uuids removed, everything else kept (lib/nutrition/diary.js addPayload).
 * @typedef {{ items: DiaryItem[], water: WaterLog[], deleted_uuids: { items: string[], water: string[] } }} DiaryWrite
 */
/**
 * A food (GET/POST /api/foods). Nutrition is per `portion` `unit` (100 g for most). The client
 * maps `img_url` to `imgUrl` (lib/nutrition/store.js), as NutriTrace's client does.
 * @typedef {{ id: number, name: string, brand?: string, portion: number, unit: string, nutrition: Nutrition,
 *   barcode?: string, nutrition_basis?: 'g'|'ml'|null, alt_units?: { abbr: string, grams: number }[]|null,
 *   density_g_ml?: number|null, imgUrl?: string, usage_count?: number, last_used_at?: string|null }} Food
 */
/**
 * GET /api/activity/:date rows. `source: 'opengym'` rows are the hub's workout entries;
 * `covered_by` names the wearable whose active kcal count instead that day (else null).
 * @typedef {{ id: number, date: string, name: string, kcal: number, duration_min: number|null,
 *   source: string, external_id?: string|null, covered_by: string|null }} ActivityRow
 */
/** @typedef {{ date: string, manual: number, wearable: number, effective: number, covered_by: string|null, policy: string }} ActivitySum */
/**
 * GET /api/settings: the user's settings by key. The diary reads mealNames, goals,
 * calorieGoalMode ('fixed'|'dynamic'|'adaptive'), calorieGoalFactor, waterGoalMl,
 * diaryShowActivity, calorieAdjustFromActivity, manualActivityPolicy, notifMealTimes,
 * offSearchLanguage, timeFormat. Any may be absent (NutriTrace's defaults then apply).
 * @typedef {Record<string, unknown>} NtSettings
 */
/**
 * GET /hub/api/sync/status (fitness-hub src/sync/engine.ts).
 * @typedef {{ state: 'ok'|'syncing'|'retrying'|'needs_confirmation'|'error'|'suspended', pending: number,
 *   held: number, last_synced_at: number|null, next_retry_at: number|null, suspended: string|null,
 *   problems: unknown[] }} SyncStatus
 */
/** @typedef {{ workout_id: string, date: string, kcal: number, kcal_method: string, weight_kg: number|null,
 *   state: 'pending'|'synced'|'user_edited'|'failed'|'expired'|'deleted' }} WorkoutSyncStatus */
/**
 * Every failure is an Error with `status` (the HTTP status, 0 without an answer) and `code`:
 * 'offline' (no connection), 'timeout', 'http' (a 4xx/5xx; `message` is the server's `error`),
 * 'bad-response' (a 2xx that is not JSON).
 * @typedef {Error & { status: number, code: 'offline'|'timeout'|'http'|'bad-response' }} NtError
 */

const TIMEOUT_GET_MS = 20000
const TIMEOUT_MS = 30000

const failure = (message, status, code) => Object.assign(new Error(message), { status, code })

/** The web app behind the hub has nutrition; a phone build talks to openGym alone, and so does a
 *  guest (no session for the hub to check). */
export function nutritionAvailable(user) {
  return !MOBILE && !!user
}

const urlOf = path => appBase().replace(/\/$/, '') + path

async function call(method, path, body) {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), method === 'GET' ? TIMEOUT_GET_MS : TIMEOUT_MS)
  let res
  try {
    res = await fetch(urlOf(path), {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctl.signal,
    })
  } catch (e) {
    const timedOut = e?.name === 'AbortError'
    throw failure(timedOut ? 'timeout' : 'offline', 0, timedOut ? 'timeout' : 'offline')
  } finally {
    clearTimeout(timer)
  }
  let data = null
  try { data = await res.json() } catch { data = null }
  if (!res.ok) throw failure((data && typeof data.error === 'string' && data.error) || 'HTTP ' + res.status, res.status, 'http')
  if (data === null || typeof data !== 'object') throw failure('bad response', res.status, 'bad-response')
  return data
}

const nt = (method, path, body) => call(method, '/nt' + path, body)

export const NtApi = {
  /** @returns {Promise<DiaryDay>} */
  getDiaryDate: date => nt('GET', `/api/diary/${date}`),
  /** Every day with a row (the calendar's logged marks). @returns {Promise<DiaryDay[]>} */
  getAllDiary: () => nt('GET', '/api/diary'),
  /** @param {DiaryWrite} payload @returns {Promise<DiaryDay>} the day after the merge */
  saveDiaryDate: (date, payload) => nt('PUT', `/api/diary/${date}`, payload),
  /** @returns {Promise<NtSettings>} */
  getSettings: () => nt('GET', '/api/settings'),
  /** Your own foods, by name. @returns {Promise<Food[]>} (img_url, not imgUrl) */
  getFoods: () => nt('GET', '/api/foods'),
  /** `client_key` makes a retry return the food made the first time. @returns {Promise<Food>} */
  createFood: food => nt('POST', '/api/foods', food),
  /** Orders recents (usage_count, last_used_at = the diary date). */
  markFoodUsed: (id, date) => nt('POST', `/api/foods/${encodeURIComponent(id)}/used`, { date }),
  /** @returns {Promise<ActivityRow[]>} */
  getActivity: date => nt('GET', `/api/activity/${date}`),
  /** @returns {Promise<ActivitySum>} */
  getActivitySum: (date, policy) => nt('GET', `/api/activity/sum/${date}?policy=${encodeURIComponent(policy || 'wearable_wins')}`),
  /** Dynamic goal: yesterday's wearable burn for the date. @returns {Promise<{ calories_out: number|null }>} */
  getCaloriesOut: date => nt('GET', `/api/wellness/calories-out?date=${date}`),
  /** @returns {Promise<{ ready: boolean, tdee?: number }>} */
  getAdaptiveTdee: () => nt('GET', '/api/goals/adaptive-tdee'),
  /** Open Food Facts text search through NutriTrace's proxy (the hub lets this one URL shape by).
   *  Raw OFF answer: map it with lib/nutrition/off.js offResults. */
  searchOnline: (query, { page = 1, pageSize = 20, lang = 'en' } = {}) =>
    nt('GET', '/api/proxy?url=' + encodeURIComponent(offSearchUrl(query, { page, pageSize, lang }))),
}

export const HubSync = {
  /** Runs a cycle (waits up to 8 s for it). @returns {Promise<SyncStatus>} */
  now: () => call('POST', '/hub/api/sync/now', {}),
  /** @returns {Promise<SyncStatus>} */
  status: () => call('GET', '/hub/api/sync/status'),
  /** A workout's kcal row as the hub stored it; 404 before the hub has seen it. @returns {Promise<WorkoutSyncStatus>} */
  workout: id => call('GET', `/hub/api/sync/workouts/${encodeURIComponent(id)}`),
}
