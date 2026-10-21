import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUI } from '../../store/useUI.js'
import { t } from '../../lib/i18n.js'
import { newUuid } from '../../lib/nutrition/diary.js'
import { deleteWithUndo } from '../../lib/nutrition/delete-undo.js'
import { RECIPES_LIST, recipeEditorPath } from '../../lib/nutrition/editor-routes.js'
import { writeErrorText } from '../../lib/nutrition/log-feedback.js'
import { mealOf, problemText, totalOf } from '../../lib/nutrition/meals.js'
import { editRecipe, extrasOfForm, perServingOf, recipeFormOf } from '../../lib/nutrition/recipe-form.js'
import { extrasOf, saveExtras } from '../../lib/nutrition/recipe-extras.js'
import { useNutrition } from '../../lib/nutrition/store.js'
import { leaveTo } from '../../lib/use-tab-nav.js'
import { useAutosave } from './use-autosave.js'

// What the hub keeps of a recipe. A change to anything else (the steps, the photo) is kept on this
// device at once (recipe-extras.js) and does not start a save.
const HUB_FIELDS = ['name', 'notes', 'items', 'amount', 'servings', 'serving']
// The numbers that follow from the others: when one changes without being typed in, its field is
// shown again from the form (the kit's field is uncontrolled), which `rev` keys.
const DERIVED = ['amount', 'servings', 'serving']

/**
 * The recipe editor's state (boards Ea5Recipe, Ea5Ingredient, Ea5RecipeDeleted). `recipe` is the
 * saved recipe being edited, or null for a new one; `prefill` ({ name, items, notes, servings },
 * editor-routes.js) starts a new one.
 *
 * The same pattern as the saved meal editor (use-meal-editor.js): saves as you type through
 * useAutosave, a new recipe is created the first time it has a name and an ingredient (the hub
 * refuses a recipe without ingredients), a saved recipe whose last ingredient is taken out says so
 * and keeps the ones it had. Makes, Servings and One serving are kept in step by recipe-form.js.
 * The steps and the photo are the device's own (recipe-extras.js).
 */
export function useRecipeEditor({ recipe, prefill }) {
  const nav = useNavigate()
  const [form, setForm] = useState(() => recipeFormOf(recipe, { prefill, extras: recipe ? extrasOf(recipe.id) : null }))
  const formRef = useRef(form)
  const saved = useRef(typeof recipe?.id === 'number' ? recipe : null)
  const [recordId, setRecordId] = useState(saved.current?.id ?? null)
  const [problem, setProblem] = useState('')
  const [rev, setRev] = useState({ amount: 0, servings: 0, serving: 0 })
  const [focusStep, setFocusStep] = useState(null)
  const key = useRef(newUuid())
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  async function write(snapshot) {
    const made = mealOf(snapshot, { recipe: true, clientKey: saved.current ? null : key.current, original: saved.current })
    if (made.error) {
      // A new recipe that is not complete yet is not an error: it simply is not a recipe.
      setProblem(!saved.current ? '' : problemText(made.error))
      return false
    }
    setProblem('')
    const creating = !saved.current
    if (!creating && Object.keys(made.meal).length === 0) return true
    const record = await useNutrition.getState().saveMeal(creating ? made.meal : { ...made.meal, id: saved.current.id })
    saved.current = record
    formRef.current = { ...formRef.current, baseItems: snapshot.items }
    if (creating) {
      // The steps and the photo typed before there was a recipe to hang them on.
      saveExtras(record.id, extrasOfForm(formRef.current))
      if (alive.current) {
        setRecordId(record.id)
        nav(recipeEditorPath(record.id), { replace: true })
      }
    }
    return true
  }

  const autosave = useAutosave(write, {
    initial: saved.current ? 'saved' : 'idle',
    onError: e => useUI.getState().toast(writeErrorText(e)),
  })

  const change = patch => {
    const before = formRef.current
    const next = editRecipe(before, patch)
    formRef.current = next
    setForm(next)
    setRev(r => {
      const bumped = { ...r }
      // Typed in and kept as typed needs no redraw; typed in and replaced (a cleared Makes) does.
      for (const k of DERIVED) if (k in patch ? next[k] !== patch[k] : before[k] !== next[k]) bumped[k] = r[k] + 1
      return bumped
    })
    if (saved.current) saveExtras(saved.current.id, extrasOfForm(next))
    if (HUB_FIELDS.some(k => k in patch)) autosave.schedule(next)
  }

  const ingredients = () => formRef.current.items
  // Adds an ingredient and says where it went, so the drawer goes on editing that one.
  const addIngredient = ingredient => {
    const at = ingredients().length
    change({ items: [...ingredients(), ingredient] })
    return at
  }
  const changeIngredient = (i, ingredient) => change({ items: ingredients().map((x, j) => (j === i ? ingredient : x)) })
  const takeOut = i => {
    const gone = ingredients()[i]
    if (!gone) return
    change({ items: ingredients().filter((_, j) => j !== i) })
    useUI.getState().toast(t('Removed {0}', gone.name), {
      action: t('Undo'),
      onAction: () => change({ items: [...ingredients().slice(0, i), gone, ...ingredients().slice(i)] }),
    })
  }

  const steps = () => formRef.current.steps
  const addStep = () => {
    const step = { id: newUuid(), text: '' }
    change({ steps: [...steps(), step] })
    setFocusStep(step.id)
  }
  const editStep = (id, text) => change({ steps: steps().map(s => (s.id === id ? { ...s, text } : s)) })
  const removeStep = id => {
    const i = steps().findIndex(s => s.id === id)
    if (i < 0) return
    const gone = steps()[i]
    change({ steps: steps().filter(s => s.id !== id) })
    // A step with nothing in it needs no Undo.
    if (!gone.text.trim()) return
    useUI.getState().toast(t('Removed {0}', t('Step {0}', i + 1)), {
      action: t('Undo'),
      onAction: () => change({ steps: [...steps().slice(0, i), gone, ...steps().slice(i)] }),
    })
  }
  // `from` to the place `slot` is among the others (the drag's drop slot, routine-reorder.js).
  const moveStep = (from, slot) => {
    const next = steps().slice()
    const [moved] = next.splice(from, 1)
    if (!moved) return
    next.splice(slot, 0, moved)
    change({ steps: next })
  }
  // One place up or down; the new place, or null at an end.
  const shiftStep = (i, dir) => {
    const to = i + dir
    if (to < 0 || to >= steps().length) return null
    moveStep(i, to)
    return to
  }

  const setPhoto = photo => change({ photo })

  // Deletes the recipe; the days that logged it keep their entries.
  async function remove() {
    if (!saved.current) return
    await autosave.flush()
    autosave.cancel()
    const record = saved.current
    deleteWithUndo({ kind: 'meal', record, message: t('Deleted {0}. Days you logged it stay', record.name) })
    leaveTo(RECIPES_LIST)
  }

  return {
    form, rev, change, problem, recordId, remove, focusStep,
    addIngredient, changeIngredient, takeOut,
    addStep, editStep, removeStep, moveStep, shiftStep, setPhoto,
    total: totalOf(form.items), perServing: perServingOf(form),
    state: autosave.state, retry: autosave.retry, flush: autosave.flush,
  }
}
