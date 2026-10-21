import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { activeProfile } from '../lib/equipment.js'
import { t } from '../lib/i18n.js'
import { starterPlanOptions } from '../lib/starter.js'
import { loadStarterPlanWithUndo } from '../lib/starter-load.js'
import Icon from '../components/Icon.jsx'
import { Chip, ChipRow, ItemRow } from '../components/blocks.jsx'
import { SheetHeader } from '../components/sheet-layout.jsx'
import { ui } from './shared.js'

/* ============================ starter plan ============================ */
// Plan names and blurbs live here, not in lib/starter.js: check-source-strings.mjs only finds
// string literals written inside a t() call, so copy parked in the catalog and passed in as a
// variable is invisible to it — it would quietly stay English in every language.
const PLAN_COPY = {
  ppl: () => ({ name: t('Push / Pull / Legs'), about: t('Push, pull and legs each get their own day.') }),
  'upper-lower': () => ({ name: t('Upper / Lower'), about: t('Upper body twice, lower body twice.') }),
  'full-body': () => ({ name: t('Full Body'), about: t('Three sessions, the whole body each time.') }),
  '5x5': () => ({ name: t('5×5'), about: t('Five sets of five on the main barbell lifts.') })
}

/** A chooser plan's name and blurb, or null for a plan the chooser has no copy for. */
export const planCopy = id => PLAN_COPY[id]?.() ?? null

/** The toast after a load: the plan's name, and with a profile what fitting it swapped and dropped. */
export function loadedText(planId, profile, fit) {
  const name = planCopy(planId)?.name ?? planId
  return fit && profile
    ? t('{0} loaded, fitted to "{1}": {2} swapped, {3} dropped', name, profile.name, fit.swapped, fit.dropped)
    : t('{0} loaded', name)
}

// Loads the plan over the whole weekly plan (lib/starter-load.js) and offers Undo in the toast
// instead of asking first. An id with no plan behind it changes nothing at all. planId is
// deliberately required — a default invites `onClick={loadStarterPlan}`, which hands the click
// event in as the plan and silently loads nothing.
export function loadStarterPlan(planId, profile) {
  const res = loadStarterPlanWithUndo(planId, { fit: profile || null })
  if (!res) return false
  ui().toast(loadedText(planId, profile, res.fit), { action: t('Undo'), onAction: res.undo })
  return true
}

function StarterPlanChooser({ close }) {
  const profiles = useStore(s => s.S.equipProfiles) || []
  // Fitting starts on for the profile you already filter by; '' leaves the plan as written.
  const [fitId, setFitId] = useState(() => activeProfile(useStore.getState().S)?.id || '')
  const fit = profiles.find(p => p.id === fitId) || null
  const choose = id => { close(); loadStarterPlan(id, fit) }
  return <>
    <SheetHeader title={t('Choose starter plan')} />
    {profiles.length > 0
      ? <ChipRow className="mb-5">
          <div className="small dim" style={{ width: '100%' }}>{t('Fit to my equipment')}</div>
          <Chip nocap on={!fit} onClick={() => setFitId('')}>{t('As written')}</Chip>
          {profiles.map(p => <Chip key={p.id} nocap on={fit?.id === p.id} onClick={() => setFitId(p.id)}>{p.name}</Chip>)}
        </ChipRow>
      : <div className="small dim mb-5">{t('Add an equipment profile in Settings to fit a plan to what you own.')}</div>}
    <div className="list">
      {starterPlanOptions().map(({ id, days }) => {
        const { name, about } = PLAN_COPY[id]()
        return <ItemRow key={id}
          lead={<span className="lrow-i" style={{ background: 'var(--surface-3)' }}><Icon name="clipboard" /></span>}
          title={name}
          subtitle={<>{t('{0} days per week', days)} · {about}</>}
          chevron
          onClick={() => choose(id)} />
      })}
    </div>
  </>
}

export const starterPlanSheet = () => ui().openSheet(close => <StarterPlanChooser close={close} />)
