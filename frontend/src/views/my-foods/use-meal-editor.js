import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUI } from '../../store/useUI.js'
import { t } from '../../lib/i18n.js'
import { todayISO } from '../../lib/format.js'
import { newUuid } from '../../lib/nutrition/diary.js'
import { deleteWithUndo } from '../../lib/nutrition/delete-undo.js'
import { MEALS_LIST, mealEditorPath } from '../../lib/nutrition/editor-routes.js'
import { writeErrorText } from '../../lib/nutrition/log-feedback.js'
import { formOf, mealOf, problemText, totalOf, withItems } from '../../lib/nutrition/meals.js'
import { useNutrition } from '../../lib/nutrition/store.js'
import { leaveTo } from '../../lib/use-tab-nav.js'
import { dayTargetsOf } from '../shared/food-target.js'
import { useAutosave } from './use-autosave.js'

const RECIPE = false

/**
 * The saved meal editor's state (boards Ea5Meal, Ea5MealDeleted). `meal` is the saved meal being
 * edited, or null for a new one; `prefill` ({ name, items }, editor-routes.js) starts a new one.
 *
 * Saves as you type, like the food editor. A hub meal needs at least one food, so a new meal is
 * created the first time it has a name and a food, not on the name alone; a saved meal whose last
 * food is taken out says so and keeps the foods it had until another is added. The ingredients
 * of an edit are sent only when they changed (meals.js mealOf).
 */
export function useMealEditor({ meal, prefill }) {
  const nav = useNavigate()
  const [form, setForm] = useState(() => formOf(meal || prefill || null, { recipe: RECIPE }))
  const formRef = useRef(form)
  const saved = useRef(typeof meal?.id === 'number' ? meal : null)
  const [recordId, setRecordId] = useState(saved.current?.id ?? null)
  const [problem, setProblem] = useState('')
  const key = useRef(newUuid())
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  async function write(snapshot) {
    const made = mealOf(snapshot, { recipe: RECIPE, clientKey: saved.current ? null : key.current, original: saved.current })
    if (made.error) {
      // A new meal that is not complete yet is not an error: it simply is not a meal.
      setProblem(!saved.current ? '' : problemText(made.error))
      return false
    }
    setProblem('')
    const creating = !saved.current
    if (!creating && Object.keys(made.meal).length === 0) return true
    const record = await useNutrition.getState().saveMeal(creating ? made.meal : { ...made.meal, id: saved.current.id })
    saved.current = record
    formRef.current = { ...formRef.current, baseItems: snapshot.items }
    if (creating && alive.current) {
      setRecordId(record.id)
      nav(mealEditorPath(record.id), { replace: true })
    }
    return true
  }

  const autosave = useAutosave(write, {
    initial: saved.current ? 'saved' : 'idle',
    onError: e => useUI.getState().toast(writeErrorText(e)),
  })

  const change = patch => {
    const next = { ...formRef.current, ...patch }
    formRef.current = next
    setForm(next)
    autosave.schedule(next)
  }
  const setItems = update => change(withItems(formRef.current, update(formRef.current.items), { recipe: RECIPE }))
  // Adds a food and says where it went, so the drawer goes on editing that one.
  const addFood = ingredient => {
    const at = formRef.current.items.length
    setItems(items => [...items, ingredient])
    return at
  }
  const changeFood = (i, ingredient) => setItems(items => items.map((x, j) => (j === i ? ingredient : x)))
  const removeFood = i => {
    const gone = formRef.current.items[i]
    setItems(items => items.filter((_, j) => j !== i))
    useUI.getState().toast(t('Removed {0}', gone.name), {
      action: t('Undo'),
      onAction: () => setItems(items => [...items.slice(0, i), gone, ...items.slice(i)]),
    })
  }

  // Deletes the meal; the days that logged it keep their entries.
  async function remove() {
    if (!saved.current) return
    await autosave.flush()
    autosave.cancel()
    const record = saved.current
    deleteWithUndo({ kind: 'meal', record, message: t('Deleted {0}. Meals you logged with it stay', record.name) })
    leaveTo(MEALS_LIST)
  }

  return {
    form, change, addFood, changeFood, removeFood, problem, recordId, remove,
    total: totalOf(form.items), state: autosave.state, retry: autosave.retry, flush: autosave.flush,
  }
}

/**
 * Today's targets for the meal's share line: food-target.js dayTargetsOf for today, loaded the way
 * the Day page loads them. `ready` is false until everything the target depends on is in, so the
 * line never shows a stand-in; `kcal` and `macro(id)` are null without a goal.
 */
export function useTodayTargets(settings) {
  const date = todayISO()
  const goalInputs = useNutrition(s => s.goalInputs)
  const activity = useNutrition(s => s.activity[date]) || null
  const [tried, setTried] = useState(false)
  const mode = settings?.calorieGoalMode
  const policy = settings?.manualActivityPolicy
  const showActivity = !!settings?.diaryShowActivity
  const loaded = !!settings

  useEffect(() => {
    if (!loaded) return undefined
    let live = true
    const n = useNutrition.getState()
    n.loadGoalInputs(date, mode).then(() => { if (live) setTried(true) })
    if (showActivity) n.loadActivity(date, policy)
    return () => { live = false }
  }, [loaded, date, mode, policy, showActivity])

  return dayTargetsOf({ settings, date, goalInputs, activity, tried })
}
