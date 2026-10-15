import { useEffect } from 'react'
import { t } from '../lib/i18n.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { Button } from './ui.jsx'
import { EmptyState } from './blocks.jsx'

// What a NutriTrace settings page shows until NutriTrace's settings are here: a loading line, or
// the failure with a way to ask again. Once they are, the page itself, which reads them with
// useNtSettings.
export default function NtSettingsGate({ children }) {
  const settings = useNutrition(s => s.settings)
  useEffect(() => { useNutrition.getState().loadSettings() }, [])

  if (settings.data) return children
  if (settings.status === 'error') {
    return <EmptyState className="small">
      <div role="alert">{t('Your settings did not load.')}</div>
      <Button size="sm" onClick={() => useNutrition.getState().loadSettings({ force: true })}>{t('Try again')}</Button>
    </EmptyState>
  }
  return <EmptyState className="small">{t('Loading…')}</EmptyState>
}
