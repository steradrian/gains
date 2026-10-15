import { useCallback, useState } from 'react'
import { useUI } from '../../store/useUI.js'
import { writeErrorText } from './log-feedback.js'
import { useNutrition } from './store.js'

// What NutriTrace reads when a key was never saved (src/stores/settings.js). The pages show these
// and the search and Features read them, so a person who never touched a switch sees the state
// NutriTrace itself shows.
export const NT_DEFAULTS = {
  diaryShowBrands: true,
  diaryShowTimestamps: false,
  diaryShowMacroSummary: true,
  diaryPromptQuantity: true,
  diaryDefaultField: 'servings',
  showQuickCalories: true,
  quickCaloriesDisplay: 'summed',
  diaryShowActivity: false,
  calorieAdjustFromActivity: false,
  manualActivityPolicy: 'wearable_wins',
  waterUnit: 'ml',
  waterShowInDiary: true,
  waterShowInStats: true,
  waterContainers: [
    { id: '1', name: 'Small Bottle', volumeMl: 250 },
    { id: '2', name: 'Standard Bottle', volumeMl: 500 },
  ],
  foodsShowCategories: true,
  foodsShowLabels: true,
  foodsShowNotes: true,
  foodsDefaultSource: 'local',
  foodsSort: 'alpha',
  mealsSort: 'alpha',
  recipesSort: 'alpha',
  barcodeBeep: false,
  offEnabled: true,
  offSearchLanguage: 'en',
  offSearchCountry: 'World',
  usdaEnabled: false,
  foodCategories: [],
  customUnits: [],
}

/** A setting as NutriTrace would read it: the saved value, or its default. */
export const settingOf = (data, key) => (data?.[key] != null ? data[key] : NT_DEFAULTS[key])

/**
 * NutriTrace's settings and one way to write them: `save(key, value)` resolves true once the hub
 * has the value, and false after a toast with the reason (the value on screen is the saved one
 * until then, so what was typed stays where it was). `busy[key]` is set while that key saves.
 */
export function useNtSettings() {
  const data = useNutrition(s => s.settings.data)
  const [busy, setBusy] = useState({})
  const save = useCallback(async (key, value) => {
    setBusy(b => ({ ...b, [key]: true }))
    try {
      await useNutrition.getState().saveSetting(key, value)
      return true
    } catch (e) {
      useUI.getState().toast(writeErrorText(e))
      return false
    } finally {
      setBusy(b => ({ ...b, [key]: false }))
    }
  }, [])
  return { data, busy, save }
}

/**
 * The save behind a sheet that edits a list setting. `submit(key, build, errorOf)` builds the new
 * list from the settings as they are now (`build` answers `{ list }` or `{ error }`), writes it,
 * and closes the sheet. A refused or failed save leaves the sheet open with its fields and says why.
 */
export function useSheetSave(close) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const submit = async (key, build, errorOf) => {
    if (busy) return
    const built = build(useNutrition.getState().settings.data)
    if (built.error) { setError(errorOf(built.error)); return }
    setBusy(true)
    setError(null)
    try {
      await useNutrition.getState().saveSetting(key, built.list)
      close()
    } catch (e) {
      setError(writeErrorText(e))
      setBusy(false)
    }
  }
  return { busy, error, submit }
}
