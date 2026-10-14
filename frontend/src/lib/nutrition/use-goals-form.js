import { useCallback, useEffect, useMemo, useState } from 'react'
import { todayISO } from '../format.js'
import { NtApi } from './api.js'
import { applyTemplate, draftOf, makeTemplate, goalsAfter, writesFor } from './goals.js'
import { useNutrition } from './store.js'

// The Goals page's state: NutriTrace's settings, an editable draft of them, and a save that
// writes only what changed. A failed save keeps the draft and says why; nothing is lost.
//
// `figures` are the server's own numbers behind Adaptive and Dynamic. They are shown when the
// server has them and left out when it has not: the page works without them.

const idle = { state: 'idle', error: null }

export function useGoalsForm() {
  const settings = useNutrition(s => s.settings)
  const [draft, setDraft] = useState(null)
  const [figures, setFigures] = useState({ adaptive: null, caloriesOut: null })
  const [save, setSave] = useState(idle)

  const load = useCallback(() => useNutrition.getState().loadSettings({ force: true }), [])
  useEffect(() => { useNutrition.getState().loadSettings() }, [])
  useEffect(() => {
    let live = true
    NtApi.getAdaptiveTdee().then(adaptive => { if (live) setFigures(f => ({ ...f, adaptive })) }, () => {})
    NtApi.getCaloriesOut(todayISO()).then(r => { if (live) setFigures(f => ({ ...f, caloriesOut: r.calories_out ?? null })) }, () => {})
    return () => { live = false }
  }, [])

  // The draft starts from the first settings that arrive and is the person's from then on.
  if (draft == null && settings.status === 'ready' && settings.data) setDraft(draftOf(settings.data))

  const patch = useCallback(changes => {
    setSave(s => (s.state === 'error' ? idle : s))
    setDraft(d => ({ ...d, ...(typeof changes === 'function' ? changes(d) : changes) }))
  }, [])

  const writes = useMemo(() => (draft && settings.data ? writesFor(settings.data, draft) : []), [draft, settings.data])

  // One attempt at a list of writes, in order; the first failure stops it. What was written stays
  // written (the cache follows each one), so a retry sends only the rest.
  const run = useCallback(async list => {
    setSave({ state: 'saving', error: null })
    try {
      for (const [key, value] of list) await useNutrition.getState().saveSetting(key, value)
      setSave(idle)
      return true
    } catch (error) {
      setSave({ state: 'error', error })
      return false
    }
  }, [])

  const submit = useCallback(async () => {
    if (!draft) return false
    setSave({ state: 'saving', error: null })
    // Goals is one setting holding every nutrient: merge into what the server has now.
    const fresh = await load()
    if (useNutrition.getState().settings.status === 'error' || !fresh) {
      setSave({ state: 'error', error: useNutrition.getState().settings.error })
      return false
    }
    const ok = await run(writesFor(fresh, draft))
    if (ok) setDraft(d => ({ ...d, baseGoals: null }))
    return ok
  }, [draft, load, run])

  const saveTemplate = useCallback(async name => {
    const fresh = useNutrition.getState().settings.data || {}
    const goals = goalsAfter(draft.baseGoals || fresh.goals || {}, draft)
    const tpl = makeTemplate(name, goals, draft.waterMl)
    return run([['goalTemplates', [...(fresh.goalTemplates || []), tpl]]])
  }, [draft, run])

  const deleteTemplate = useCallback(id => {
    const list = useNutrition.getState().settings.data?.goalTemplates || []
    return run([['goalTemplates', list.filter(tpl => tpl.id !== id)]])
  }, [run])

  const pickTemplate = useCallback(tpl => patch(d => applyTemplate(d, tpl)), [patch])

  return {
    status: settings.status, loadError: settings.error, settings: settings.data, reload: load,
    draft, patch, dirty: writes.length > 0, save, submit,
    figures, saveTemplate, deleteTemplate, pickTemplate,
  }
}
