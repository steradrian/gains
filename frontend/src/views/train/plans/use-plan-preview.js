import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { activeProfile } from '../../../lib/equipment.js'
import { exOr } from '../../../lib/exercises.js'
import { dateLocale, t } from '../../../lib/i18n.js'
import { exerciseNameText, fmtDate } from '../../../lib/format.js'
import { previewStarterPlan } from '../../../lib/starter.js'
import { loadStarterPlanWithUndo } from '../../../lib/starter-load.js'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import { planCopy } from './plan-copy.js'

/** A weekday (0 is Sunday) in the app's language: `narrow` ("M"), `short` ("Mon") or `long`. */
export const weekdayName = (day, style) => new Date(2024, 0, 7 + day).toLocaleDateString(dateLocale(), { weekday: style })

/**
 * The fit line under the control, and the changes it stands for, for a fitted preview
 * (previewStarterPlan's `fit`): `{ summary, changes }`. Nothing to say as written (null).
 */
export function fitText(fit) {
  if (!fit) return null
  const name = exerciseNameText
  const changes = [
    ...fit.swaps.map(s => t('{0} becomes {1}', name(exOr(s.from.id)), name(exOr(s.to.id)))),
    ...fit.drops.map(d => t('{0} is left out', name(exOr(d.id))))
  ]
  return {
    summary: changes.length
      ? t('Fitted to "{0}": {1} swapped, {2} dropped. The rest stays as written.', fit.profile.name, fit.swaps.length, fit.drops.length)
      : t('Fitted to "{0}": everything in this plan fits.', fit.profile.name),
    changes
  }
}

/**
 * Everything the preview of one ready-made plan (T10.1) shows, and its Load.
 *
 *   { plan, copy, profiles, profile, fitting, setFitting, setProfile, load }
 *
 * `plan` is previewStarterPlan's answer for the current choice, or null for an unknown id (the
 * page redirects). Fitting starts on for the profile you already filter the library by; with no
 * profile at all it cannot be on (`profile` is then null and the page says why). `load()` loads the
 * plan over the whole week with Undo, goes to the Plan (replacing this page, so back does not
 * return to a preview of what is already loaded) and says so in the 8 s toast.
 */
export function usePlanPreview(id) {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const profiles = S.equipProfiles || []
  const [fitting, setFitting] = useState(() => !!activeProfile(S))
  const [profileId, setProfile] = useState(() => (activeProfile(S) || profiles.find(p => p.id === S.activeEquipId) || profiles[0])?.id ?? '')
  const profile = profiles.find(p => p.id === profileId) || profiles[0] || null
  const fit = fitting ? profile : null
  const plan = useMemo(() => previewStarterPlan(S, id, { fit }), [S, id, fit])
  const copy = planCopy(id)

  const load = () => {
    const res = loadStarterPlanWithUndo(id, { fit })
    if (!res || !copy) return
    nav('/train/schedule', { replace: true })
    useUI.getState().toast(
      res.startsOn ? t('Loaded {0}. Your week starts {1}', copy.name, fmtDate(res.startsOn, true)) : t('Loaded {0}', copy.name),
      { action: t('Undo'), onAction: res.undo }
    )
  }

  return { plan, copy, profiles, profile, fitting: !!fit, setFitting, setProfile, load }
}
