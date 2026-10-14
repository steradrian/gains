# lib/nutrition: NutriTrace from the Gains frontend

Every call goes through the hub, same origin: `/nt/api/*` (NutriTrace, allow-listed in
fitness-hub `src/nt-routes.ts`; anything else is a 404) and `/hub/api/sync/*`. No tokens.
Gate UI on `nutritionAvailable(user)` (web build and signed in; phones and guests have none).

- `api.js`: `NtApi.*` (diary, settings, foods, activity, goal inputs, Open Food Facts search)
  and `HubSync.*`. JSDoc typedefs at the top are NutriTrace's real shapes (`DiaryDay`,
  `DiaryItem`, `Food`, `ActivityRow`, `SyncStatus`, ...). Errors: `NtError` with
  `status` (0 = no answer) and `code` `'offline' | 'timeout' | 'http' | 'bad-response'`.
  A route you need that is not allow-listed needs a hub PR first.
- `store.js`: `useNutrition`, the cached server state per date (`days[date]`, `settings`,
  `activity[date]`, `foods`, `logged`) with `load*` and the writes `logFood`, `logQuick`,
  `logWater`, `removeItem`, `removeWater`. Writes are not optimistic: they throw, the caller
  keeps the input and shows the error. A diary PUT names only what it adds or removes
  (`diary.js addPayload/removePayload`); NutriTrace merges per uuid and keeps the rest.
- `diary.js`: pure ports of NutriTrace's arithmetic: `nutritionOf`, `totalsOf`, units and
  `scaleFactor`/`atPortion`, `calorieTarget` (decision-workout-kcal.md §1), `macroTarget`,
  `defaultMeal`, `mealNamesOf` (English defaults; translate at display), `recentFoods`,
  `matchesFood`. Nutrition is per serving; `quantity` is servings.
- `off.js`: Open Food Facts search URL and hit → unsaved food (per 100 g). `logFood` saves an
  unsaved food (no numeric `id`) as yours first, idempotent via `client_key`.
- `selection.js`: `useDiarySelection`, the one date and meal everything logs to. `day()` is
  the date (null state = today), `setDate(iso)`, `mealFor(settings)` (a hand-picked meal via
  `setMeal(slot)` holds 30 min, else the time of day), `reset()`.
- `sync.js`: `syncNow()` (pushes openGym, then `POST /hub/api/sync/now`; never throws),
  `refreshHubStatus()`, `useHubSync`/`useHubTrouble` for the avatar dot, `workoutSyncRow(id)`.

## Tests

`fake-nutritrace.js` fakes NutriTrace and the hub at the fetch boundary with real shapes and
the server's per-uuid merge:

```js
import { createFakeNutriTrace, fixtureDay } from '../lib/nutrition/fake-nutritrace.js'
const nt = createFakeNutriTrace({ days: { '2026-10-14': fixtureDay('2026-10-14') } })
vi.stubGlobal('fetch', nt.fetch)
nt.failNext('PUT', '/nt/api/diary/', { status: 500 })   // or 'offline'
expect(nt.writes().at(-1).body.items).toHaveLength(1)    // nt.state holds the server side
```

Set `useStore.setState({ user: {...}, pushState: vi.fn() })` and call
`useNutrition.getState().reset()` in `beforeEach`. Examples: `nutrition-core.test.js`.
