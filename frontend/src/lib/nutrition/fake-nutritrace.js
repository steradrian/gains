// A fake of NutriTrace and the hub's sync routes at the fetch boundary, for tests. It answers
// what the hub forwards (fitness-hub src/nt-routes.ts) with NutriTrace's real shapes and merge
// rules (server/routes/diary.js, foods.js, activity.js, server/lib/diary-merge.js); any other
// path is a 404, as the hub answers it.
//
//   const nt = createFakeNutriTrace({ days: { '2026-10-14': fixtureDay() } })
//   vi.stubGlobal('fetch', nt.fetch)
//   ...
//   expect(nt.requests.at(-1)).toMatchObject({ method: 'PUT', path: '/nt/api/diary/2026-10-14' })
//   nt.failNext('PUT', '/nt/api/diary/', { status: 500 })   // or 'offline'
//
// Not imported by the app.

/* ------------------------------------------------------------------ fixtures ----------------- */

export const emptyDay = date => ({ date, items: [], body_stats: {}, water: [], notes: '', completed_at: null, completed_meals: [], tombstones: [] })

/** A diary row as GET /api/diary/:date answers it (server/routes/diary.js parse). */
export function fixtureDay(date = '2026-10-14') {
  return {
    id: 7, user_id: 3, date,
    items: [
      { uuid: 'it-oats', meal: 0, addedAt: `${date}T07:42:10.000Z`, id: 11, food_server_id: 11, name: 'Rolled oats', brand: '', portion: 60, unit: 'g', quantity: 1, nutrition: { calories: 228, proteins: 8.1, carbohydrates: 36, fat: 4.2, fiber: 6 }, imgUrl: '' },
      { uuid: 'it-quick', meal: 1, addedAt: `${date}T12:05:00.000Z`, type: 'quick_calories', name: 'Quick Calories', nutrition: { calories: 450 }, food_server_id: null },
    ],
    body_stats: {},
    water: [{ uuid: 'w-1', amount: 250, time: '8:15 AM' }],
    notes: '',
    notes_updated_at: null,
    completed_at: null,
    completed_meals: [],
    updated_at: `${date} 12:05:00`,
    deleted_at: null,
    tombstones: [],
  }
}

/** GET /api/settings for a user who set a few things (keys as src/stores/settings.js names them). */
export const fixtureSettings = () => ({
  mealNames: ['Breakfast', 'Lunch', 'Dinner', 'Snacks'],
  goals: { calories: { min: 2200, max: 2200, sharedGoal: true }, proteins: { max: 160 }, carbohydrates: { max: 30, isPercent: true }, fat: { max: 70 } },
  calorieGoalMode: 'fixed',
  calorieGoalFactor: 1,
  waterGoalMl: 2500,
  diaryShowActivity: true,
  calorieAdjustFromActivity: false,
  manualActivityPolicy: 'wearable_wins',
  notifMealTimes: ['08:00', '12:00', '18:00'],
  timeFormat: '24h',
})

/** GET /api/foods rows (server/routes/foods.js parse: nutrition and alt_units parsed). */
export const fixtureFoods = () => [
  { id: 11, user_id: 3, name: 'Rolled oats', brand: '', portion: 100, unit: 'g', nutrition: { calories: 380, proteins: 13.5, carbohydrates: 60, fat: 7, fiber: 10 }, img_url: null, barcode: null, nutrition_basis: 'g', alt_units: null, density_g_ml: null, usage_count: 9, last_used_at: '2026-10-13', visibility: 'private', created_at: '2026-09-01 10:00:00', updated_at: '2026-10-13 07:40:00', deleted_at: null },
  { id: 12, user_id: 3, name: 'Wholemeal bread', brand: 'Baker', portion: 100, unit: 'g', nutrition: { calories: 247, proteins: 13, carbohydrates: 41, fat: 3.4 }, img_url: '/uploads/1700000000000-abcdef12.jpg', barcode: '5000000000001', nutrition_basis: 'g', alt_units: [{ abbr: 'slice', grams: 36 }], density_g_ml: null, usage_count: 3, last_used_at: '2026-10-10', visibility: 'private', created_at: '2026-09-02 10:00:00', updated_at: '2026-10-10 08:00:00', deleted_at: null },
  { id: 13, user_id: 3, name: 'Crème fraîche', brand: '', portion: 100, unit: 'g', nutrition: { calories: 292, proteins: 2.4, carbohydrates: 2.8, fat: 30 }, img_url: null, barcode: null, nutrition_basis: 'g', alt_units: null, density_g_ml: null, usage_count: 0, last_used_at: null, visibility: 'private', created_at: '2026-09-03 10:00:00', updated_at: '2026-09-03 10:00:00', deleted_at: null },
]

/** GET /api/activity/:date: a hub workout row (source 'opengym', server/lib/active-calories.js). */
export const fixtureActivity = (date = '2026-10-14', coveredBy = null) => [
  { id: 41, user_id: 3, date, name: 'Push A', kcal: 190, duration_min: 55, distance: null, source: 'opengym', met: null, is_template: 0, external_id: 'og:w:abc123', user_edited_at: null, created_at: `${date} 18:30:00`, updated_at: `${date} 18:30:00`, deleted_at: null, covered_by: coveredBy },
]
export const fixtureActivitySum = (date = '2026-10-14', coveredBy = null) => ({ date, manual: 190, wearable: coveredBy ? 420 : 0, effective: coveredBy ? 420 : 190, covered_by: coveredBy, policy: 'wearable_wins' })

/** The proxy's answer for a public Open Food Facts search (the `products` envelope). */
export const fixtureOffSearch = () => ({
  count: 2, page: 1, page_size: 20,
  products: [
    { code: '3017620422003', product_name: 'Nutella', brands: 'Ferrero', lang: 'fr', nutrition_data_per: '100g', serving_size: '15 g', serving_quantity: 15, image_front_small_url: 'https://images.openfoodfacts.org/images/products/301/762/042/2003/front_fr.200.jpg', nutriments: { 'energy-kcal_100g': 539, energy_100g: 2255, proteins_100g: 6.3, carbohydrates_100g: 57.5, sugars_100g: 56.3, fat_100g: 30.9, 'saturated-fat_100g': 10.6, salt_100g: 0.107, fiber_100g: 0 } },
    { code: '0000000000000', product_name: '', brands: '', nutriments: {} },
  ],
})

/** GET /hub/api/sync/status when all is well. */
export const fixtureSyncStatus = (state = 'ok') => ({ state, pending: 0, held: 0, last_synced_at: 1760464800000, next_retry_at: null, suspended: null, problems: [] })

/* ------------------------------------------------------------------ the fake ----------------- */

const DATE = /^\d{4}-\d{2}-\d{2}$/
const ID = /^[A-Za-z0-9_-]{1,64}$/

// server/lib/diary-merge.js, minus legacy echo matching: per uuid, later addedAt/updatedAt wins,
// tombstones (old or new) drop an entry, unmentioned server entries stay.
function merge(server, client, deleted, tombstones) {
  for (const u of deleted) tombstones.add(u)
  const ts = e => String(e?.updatedAt || e?.addedAt || '')
  const out = new Map()
  for (const e of [...server, ...client]) {
    if (!e || typeof e !== 'object' || tombstones.has(e.uuid)) continue
    const cur = out.get(e.uuid)
    if (!cur || ts(e) >= ts(cur)) out.set(e.uuid, e)
  }
  return [...out.values()]
}

export function createFakeNutriTrace({
  days = {}, settings = fixtureSettings(), foods = fixtureFoods(), activity = {}, activitySum = {},
  caloriesOut = {}, adaptiveTdee = { ready: false }, offSearch = fixtureOffSearch(),
  syncStatus = fixtureSyncStatus(), workouts = {},
} = {}) {
  const state = {
    days: structuredClone(days), settings: structuredClone(settings), foods: structuredClone(foods),
    activity, activitySum, caloriesOut, adaptiveTdee, offSearch, syncStatus, workouts,
    tombstones: {},
  }
  const requests = []
  const failures = []
  let nextFoodId = Math.max(100, ...state.foods.map(f => f.id + 1))

  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
  const notFound = () => json({ error: 'not found' }, 404)
  const dayOf = date => state.days[date] || emptyDay(date)

  function route(method, path, query, body) {
    const seg = path.split('/').filter(Boolean)
    if (seg[0] === 'hub') {
      const sub = seg.slice(3).join('/')
      if (method === 'POST' && sub === 'now') return json(state.syncStatus)
      if (method === 'GET' && sub === 'status') return json(state.syncStatus)
      if (method === 'GET' && seg[3] === 'workouts' && seg.length === 5) return state.workouts[decodeURIComponent(seg[4])] ? json(state.workouts[decodeURIComponent(seg[4])]) : notFound()
      return notFound()
    }
    if (seg[0] !== 'nt' || seg[1] !== 'api') return notFound()
    const [, , res, a, b] = seg
    const n = seg.length
    if (res === 'diary') {
      if (method === 'GET' && n === 3) return json(Object.values(state.days))
      if (n !== 4 || !DATE.test(a)) return notFound()
      if (method === 'GET') return json({ ...dayOf(a), tombstones: [] })
      if (method === 'PUT') {
        const cur = dayOf(a)
        const tomb = (state.tombstones[a] ||= { item: new Set(), water: new Set() })
        const next = {
          ...cur,
          items: merge(cur.items, body?.items || [], body?.deleted_uuids?.items || [], tomb.item),
          water: merge(cur.water, body?.water || [], body?.deleted_uuids?.water || [], tomb.water),
          notes: body && 'notes' in body ? body.notes : cur.notes,
        }
        state.days[a] = next
        return json({ ...next, tombstones: [] })
      }
      return notFound()
    }
    if (res === 'settings' && method === 'GET' && n === 3) return json(state.settings)
    if (res === 'foods') {
      if (method === 'GET' && n === 3) return json(state.foods)
      if (method === 'POST' && n === 3) {
        if (!body?.name) return json({ error: 'Name required' }, 400)
        const made = state.foods.find(f => (body.client_key && f.client_key === body.client_key) || (body.barcode && f.barcode === body.barcode))
        if (made) return json(made, 200)
        const food = { usage_count: 0, last_used_at: null, alt_units: null, nutrition_basis: null, density_g_ml: null, ...body, id: nextFoodId++, user_id: 3 }
        state.foods.push(food)
        return json(food, 201)
      }
      if (method === 'POST' && n === 5 && ID.test(a) && b === 'used') {
        const food = state.foods.find(f => String(f.id) === a)
        if (!food) return json({ error: 'Not found' }, 404)
        food.usage_count = (food.usage_count || 0) + 1
        food.last_used_at = body?.date || food.last_used_at
        return json({ ok: true })
      }
      return notFound()
    }
    if (res === 'activity' && method === 'GET') {
      if (n === 4 && DATE.test(a)) return json(state.activity[a] || [])
      if (n === 5 && a === 'sum' && DATE.test(b)) return json(state.activitySum[b] || { date: b, manual: 0, wearable: 0, effective: 0, covered_by: null, policy: query.get('policy') || 'wearable_wins' })
      return notFound()
    }
    if (res === 'wellness' && a === 'calories-out' && method === 'GET') return json({ calories_out: state.caloriesOut[query.get('date')] ?? null })
    if (res === 'goals' && a === 'adaptive-tdee' && method === 'GET') return json(state.adaptiveTdee)
    if (res === 'proxy' && method === 'GET' && n === 3) {
      const url = query.get('url') || ''
      if (!url.startsWith('https://search.openfoodfacts.org/search?')) return json({ error: 'forbidden' }, 403)
      return json(state.offSearch)
    }
    return notFound()
  }

  async function fakeFetch(input, init = {}) {
    const url = new URL(typeof input === 'string' ? input : input.url, 'http://gains.test')
    const method = (init.method || 'GET').toUpperCase()
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined
    requests.push({ method, path: url.pathname, query: Object.fromEntries(url.searchParams), body })
    const i = failures.findIndex(f => f.method === method && url.pathname.startsWith(f.prefix))
    if (i >= 0) {
      const [f] = failures.splice(i, 1)
      if (f.how === 'offline') throw new TypeError('Failed to fetch')
      return json({ error: f.how.error || 'upstream_error' }, f.how.status || 500)
    }
    return route(method, url.pathname, url.searchParams, body)
  }

  return {
    fetch: fakeFetch,
    requests,
    state,
    /** The next matching request fails: 'offline', or { status, error } as the hub would answer. */
    failNext(method, prefix, how = { status: 500 }) { failures.push({ method, prefix, how }) },
    writes: () => requests.filter(r => r.method !== 'GET'),
  }
}
