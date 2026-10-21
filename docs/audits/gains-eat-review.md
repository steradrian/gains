# PR-04 Eat: lean review (feat/eat)

Scope: verified red/yellow findings on risky logic only. Diffed `origin/main...HEAD` (247 files), read the risky hunks, traced each path. Paths are relative to `frontend/src/`. Items the state doc already lists as queued fixes are not repeated.

Counts: 1 red, 6 yellow.

## Red

### R1. The new-to-id URL replace remounts the food, meal and recipe editors (the no-remount design does not hold)

- File: `App.jsx:249` (`routeKey: inFlow ? 'onboarding' : shown.pathname`), `lib/use-route-transition.js:57,90-91`, `views/my-foods/use-food-editor.js:52-55`, `use-meal-editor.js:47-50`, `use-recipe-editor.js:70-74`, comment in `views/my-foods/FoodEditor.jsx:16-19`.
- Trigger: open `/food/my-foods/foods/new` (also `meals/new`, `recipes/new`), type a name, pause 400 ms. The first autosave creates the record and runs `nav(foodEditorPath(id), { replace: true })`.
- What goes wrong:
  - The editors rely on `new` being the `:id` of the same `<Route>` so the form does not remount. The App layer is keyed `` `${routeKey}#${gen}` `` and `routeKey` is the full pathname. A pathname change (`.../foods/new` to `.../foods/12`) bumps `gen` and gives a new React key, so the whole page subtree remounts, whatever the transition kind.
  - The name field is a new element, so focus and the keyboard are lost mid-typing. This is the exact thing the design was written to avoid. A remounted new editor has no `autoFocus` (`isNew` is false by then).
  - The new instance rebuilds its form and `saved` ref from the store's list entry, i.e. the snapshot at creation. Keystrokes typed during the create round trip are still sent by the old instance's unmount flush, but the screen shows the older values. The new instance later writes against a stale `original`/`baseItems`. For foods, `foodOf` sends the whole form, so a later edit can overwrite the newer server name with the stale one.
  - Meals and recipes create on the first ingredient, usually while the Ingredient drawer is open. The drawer keeps `onAdd`/`onChange`/`onRemove` closures of the unmounted instance. Amount edits made right after adding the first ingredient go to a dead `formRef` and `autosave`. The page behind shows stale amounts and the next write from the new instance can send the stale items.
  - The tests mount in a MemoryRouter without the layer keying, so they pass.
- Fix:
  - Make the layer key stable across that one replace. In `App.jsx`, derive `routeKey` from the pathname with the editor id collapsed: `shown.pathname.replace(/^(\/food\/my-foods\/(?:foods|meals|recipes))\/[^/]+$/, '$1/:id')`. The three editor routes are single-id pages, so nothing else relies on the id changing the key.
  - Add an App-level test that replaces `/new` with `/12` and asserts the input element survives.
  - Update the `FoodEditor.jsx` comment.

## Yellow

### Y1. Log again offers the meal a second time after an Undo of Remove

- File: `components/DiaryItemSheet.jsx:76-78` (restore under `newUuid()`), `lib/nutrition/again.js:46-57` (`againAttempt`, `againLogged`), `views/eat/use-again.js:58`.
- Trigger: tap Log again on "Yesterday's lunch" (entries get `againUuid(..., attempt 0)`). Open one logged entry, Remove it, tap Undo in the toast. The entry returns under a fresh uuid.
- What goes wrong:
  - Removing tombstoned the attempt-0 uuid, so `againAttempt` is now 1. `againLogged` checks attempt-1 uuids, finds none, and `done` flips back to false.
  - The row shows "Log again" although the meal is on the day. Tapping it adds a full second copy (attempt 1) next to the restored entry.
- Fix: for an entry whose uuid came from `againUuid`, restore it under its original uuid so the tombstone is cleared. If NutriTrace keeps tombstoned uuids out for good (as the code comment says), instead compute `done` from the day's items by matching `(food_server_id, meal, quantity)` against the source items, not by uuid.

### Y2. Fasting Undo of End can leave a running fast and the ended one both on the server

- File: `lib/nutrition/use-fasting.js:105-116`.
- Trigger: End a fast, tap Undo, and lose the connection (or kill the app) after `startFast` succeeds but before `deleteFast(ended.id)` succeeds.
- What goes wrong:
  - The catch runs `deleteFast(next.id).catch(() => {})`. Offline, that fails too, so the server holds the new running fast and the old ended fast with the same start. The error toast says Undo failed.
  - The store never sets `active: next`. The page shows idle until a reload. Then it shows a running fast plus a duplicate history row, which double-counts that period in streak and average.
  - A successful delete whose response is lost also deletes the new fast in the rollback, losing the fast entirely.
- Fix: if the rollback delete fails, do `await get().load({ force: true })` so the page shows the truth. Treat 404 on `deleteFast(ended.id)` as success. If the hub can PATCH `end_at: null`, use that single call instead of start-then-delete.

### Y3. Editor Delete does not wait for an in-flight autosave, and a late save resurrects the record in the list

- File: `views/my-foods/use-food-editor.js:79-87`, `use-meal-editor.js:91-98`, `use-recipe-editor.js:151-158`, `views/my-foods/use-autosave.js:42-44` (`run` returns at once when a write is out), `lib/nutrition/store.js:129,242,351` (`saveFood`/`saveMeal` ignore `held`).
- Trigger: edit a saved food, meal or recipe, wait 400 ms so a write goes out, and tap Delete before it answers (slow network).
- What goes wrong:
  - `await autosave.flush()` resolves immediately because `running` is true, so it does not wait. `cancel()` then clears only the queue.
  - `record = saved.current` is the pre-write version, and `holdOut` removes the item from the lists.
  - When the in-flight save answers, `saveFood`/`saveMeal` re-insert the record into the list although it is held. The deleted item reappears for the length of the Undo window.
  - Undo (`bringBack`) restores the stale record.
- Fix: make `flush` return the in-flight promise (store the run promise in a ref and return it when `running`). Make `saveFood`/`saveMeal` skip the list insert when the id is in `held`.

### Y4. Burned silently undercounts when a day's activity read failed

- File: `views/eat/burned-data.js:60` (`failed` is computed and never read), `views/eat/use-burned.js:56-62`, `views/eat/BurnedScreen.jsx:29`, `views/eat/use-eat.js:~195` (the root's `burned` sum).
- Trigger: open Burned (or the Eat root) while one day's `getActivity` or `getActivitySum` fails (offline, 5xx). `loadActivity` stores `{status:'error', rows:[]}`.
- What goes wrong:
  - `loaded` is true, so the page shows "ready" with that day contributing 0.
  - If every day failed, the screen says "Nothing burned logged this week" with a Log activity button, which reads as fact.
  - The weekly total and the root row figure are too low with no hint.
- Fix: carry `failed` through `useBurned` into the screen. Show an error state with Retry, or an inline note, when any day failed. Do not show the empty state or a total from a partial week.

### Y5. Native-app rule violations: `StageEmpty` without `card={false}`

All of these use the default card. The rule says `card={false}`.

- `views/eat/EatScreen.jsx:32`, `:35`
- `views/eat/BurnedScreen.jsx:27`, `:29`
- `views/eat/MonthScreen.jsx:61`
- `views/eat/TrendsScreen.jsx:152` (the one at `:123` is correct)
- `views/fasting/FastOffCard.jsx:12`
- `views/fasting/FastingScreen.jsx:30`
- `views/my-foods/CatalogTab.jsx:37`, `:40`, `:57`
- `views/my-foods/FoodsYours.jsx:28`, `:35`
- `views/my-foods/FoodsOnline.jsx:31`, `:33`
- `views/MyFoods.jsx:44`
- `views/my-foods/FoodEditor.jsx:43`, `:55`
- `views/my-foods/MealEditor.jsx:40`, `:52`

Fix: add `card={false}` to each. `RecipeEditor.jsx` and the editor forms already do.

### Y6. Native-app rule violations: inline text link, and status rows with no text

- `components/log-food/LogAmountStep.jsx:78`: `<button className="g-la-link">see it in full</button>` inline in a sentence (`ds/ds.css:529`, an underlined text link). Replace it with a `Button` or a `DetailRow` that opens the full step.
- `views/eat/use-eat.js:183-202`: the "Your food" rows `foods`, `meals`, `recipes` (empty lists), `trends` (no goal or no logged day), `burned` (0) and `goals` (no target) render with `sub: null` and say nothing. Give each a fallback line, e.g. "Nothing saved yet", "Needs a few logged days", "Nothing burned yet", "Not set".
- Minor, same family: `components/IngredientDrawer.jsx:~222` says "To swap it, search or scan another food above". The search only exists after tapping Swap food, so the line points at nothing.

## Checked, no finding

- coach-m1 sync:
  - `mergeStates` unions `planChanges` by id with revert tombstones that win from either side. `out` is a clone, so no input is mutated.
  - The 30-day prune is local (`addPlanChanges`) and the cap of 100 keeps the newest. A pruned stamp coming back from a stale device is older than the feed's 30-day window, so it is invisible.
  - `prefer` keeps the preferred side's list, consistent with the file header.
  - Stamps are written once, after the whole loop in `applyChangeSet` and after the plan applies in `applyCreatedPlan`. Re-applying the same proposal is a no-op by id.
- Maths:
  - Trends and Month judge each day against its own `dayTargetsOf(date)`.
  - Today is excluded from averages and counts in `foodTrendsOf`, `monthOf` and `heroFrom`.
  - Per-week bars at 30 and 90 days are runs of 7 counted back from today. The oldest run is partial, 2 days at 30 and 6 at 90, but each bar's value is a true mean.
  - No 2000 fallback in the new paths: `food-target.js` is used throughout, and the remaining `2000` in `trends.js:166` is the old macro goal helper.
  - Recipe Makes, Servings and One serving stay in step in `recipe-form.js`.
  - Ingredient scaling rescales from the original item each time, so it does not compound.
- Routing:
  - `FoodRedirect` keeps the query.
  - `parentOf` handles the editor routes including `/new`.
  - `/food/burned` redirects only once settings are known.
  - Sheet-to-page navigation goes through `closeThen`, except `openNewFood`, which has no live sub-panel callers.
  - The `prefill` contract is read: `barcode` and `name` go through `formOf`.
- Autosave: create is idempotent through `client_key`, writes are serialized, and the unmount flush does not navigate.
- OFF country: the default comes from the device region and World stays when none matches. The fallback World query appends under the marker, and the request params are unchanged because the country rides inside `q`.
- Deleted files: no import of any deleted file remains.
- `dev/screens/states/eat-root-fixture.js` (the root-m1 python edit): content is valid UTF-8 with no tabs or encoding damage.
