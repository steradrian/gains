import { useEffect } from 'react'
import { useNutrition } from '../../../lib/nutrition/store.js'

/**
 * NutriTrace's settings cached from an earlier visit may have been changed in NutriTrace since,
 * so a page asks again each time it opens (as NtSettingsGate does). With nothing cached yet the
 * gate the page draws in its place asks, so this does not ask twice.
 */
export function useFreshNtSettings() {
  useEffect(() => {
    const nt = useNutrition.getState()
    if (nt.settings.data) nt.loadSettings({ force: true })
  }, [])
}
