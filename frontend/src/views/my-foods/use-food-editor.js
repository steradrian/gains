import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUI } from '../../store/useUI.js'
import { t } from '../../lib/i18n.js'
import { newUuid } from '../../lib/nutrition/diary.js'
import { deleteWithUndo } from '../../lib/nutrition/delete-undo.js'
import { FOODS_LIST, foodEditorPath } from '../../lib/nutrition/editor-routes.js'
import { editorEnergyUnit, foodErrorText, foodOf, foodProblemText, formOf } from '../../lib/nutrition/foods.js'
import { useNutrition } from '../../lib/nutrition/store.js'
import { leaveTo } from '../../lib/use-tab-nav.js'
import { useAutosave } from './use-autosave.js'

/**
 * The food editor's state (boards Ea5Food, Ea5Deleted). `food` is the saved food being edited, or
 * null for a new one; `prefill` (editor-routes.js) starts a new one's fields.
 *
 * Every change writes through, debounced (use-autosave.js). A new food is created on the first
 * write that has a name, after which the address is replaced by the real id; until then, and for
 * an editor that was only opened, nothing is sent. The energy field is in the person's unit, taken
 * when the editor opens so it does not change under what was typed; it is stored as kcal. A form
 * that cannot be saved (no name on a saved food, a serving of 0, a nutrient that is not a number)
 * writes nothing and says why under the form.
 */
export function useFoodEditor({ food, prefill, settings }) {
  const nav = useNavigate()
  const [energyUnit] = useState(() => editorEnergyUnit(settings))
  const [form, setForm] = useState(() => formOf(food || prefill || null, { energyUnit }))
  const formRef = useRef(form)
  // The food as last saved: what the next write is measured against. Null until a new one exists.
  const saved = useRef(typeof food?.id === 'number' ? food : null)
  const [recordId, setRecordId] = useState(saved.current?.id ?? null)
  const [problem, setProblem] = useState('')
  const key = useRef(newUuid())
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  async function write(snapshot) {
    const made = foodOf(snapshot, { food: saved.current, clientKey: key.current, energyUnit })
    if (made.error) {
      // A new food without a name is not an error yet: it simply is not a food.
      setProblem(!saved.current && made.error === 'name' ? '' : foodProblemText(made.error))
      return false
    }
    setProblem('')
    const creating = !saved.current
    const store = useNutrition.getState()
    saved.current = await store.saveFood(made.food)
    if (!creating) return true
    // Favourite is not part of a new food's body: send it once the food has an id.
    if (snapshot.favorite) {
      const again = foodOf(snapshot, { food: saved.current, energyUnit })
      if (!again.error) saved.current = await store.saveFood(again.food)
    }
    if (alive.current) {
      setRecordId(saved.current.id)
      nav(foodEditorPath(saved.current.id), { replace: true })
    }
    return true
  }

  const autosave = useAutosave(write, {
    initial: saved.current ? 'saved' : 'idle',
    onError: e => useUI.getState().toast(foodErrorText(e, { write: true })),
  })

  const change = patch => {
    const next = { ...formRef.current, ...patch }
    formRef.current = next
    setForm(next)
    autosave.schedule(next)
  }
  const setNutrient = (id, value) => change({ nutrients: { ...formRef.current.nutrients, [id]: value } })

  // Deletes the food from My foods only; the entries already logged with it keep their numbers.
  async function remove() {
    if (!saved.current) return
    await autosave.flush()
    autosave.cancel()
    const record = saved.current
    deleteWithUndo({ kind: 'food', record, message: t('Deleted {0} from My foods', record.name) })
    leaveTo(FOODS_LIST)
  }

  return { form, change, setNutrient, energyUnit, problem, recordId, state: autosave.state, retry: autosave.retry, remove }
}
