import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { fmtNum } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { nutritionAvailable } from '../lib/nutrition/api.js'
import { ntErrorText } from '../lib/nutrition/error-text.js'
import { energyOf } from '../lib/nutrition/diary.js'
import {
  MACROS, applyPreset, energyFromUnit, goalNotes, hasWearable, macroGrams,
  previewBase, toggleMacroUnit, waterFromUnit, waterToUnit, waterUnitOf, workoutAdjustState,
} from '../lib/nutrition/goals.js'
import { useGoalsForm } from '../lib/nutrition/use-goals-form.js'
import SubHeader from '../components/SubHeader.jsx'
import { Button, Row, Section, Segmented, SelectRow, Stepper, Switch, TextField } from '../components/ui.jsx'
import { confirmSheet, goalSheet } from '../sheets.jsx'

const toast = message => useUI.getState().toast(message)

const modeNote = mode => {
  if (mode === 'adaptive') return t('Learns your real daily burn from 35 days of weight and diary, then sets the target from it. Until there is enough data it uses your fixed target.')
  if (mode === 'dynamic') return t('Uses yesterday’s total burn from your wearable. Falls back to your fixed target when there is no data.')
  return t('The same calorie target every day.')
}
const macroLabel = id => (id === 'proteins' ? t('Protein') : id === 'carbohydrates' ? t('Carbs') : t('Fat'))

const modeOptions = () => [
  { value: 'fixed', label: t('Fixed') },
  { value: 'adaptive', label: t('Adaptive') },
  { value: 'dynamic', label: t('Dynamic') },
]
const factorOptions = () => [
  { value: 0.8, label: t('Lose −20%') },
  { value: 1, label: t('Maintain') },
  { value: 1.2, label: t('Gain +20%') },
]
const presetOptions = () => [
  { value: 'balanced', label: t('Balanced') },
  { value: 'keto', label: t('Keto') },
  { value: 'high-protein', label: t('High-protein') },
]

function noteText(n) {
  if (n.code === 'low') return t('The calorie target is very low ({0} kcal). Most guidelines suggest at least 1,200.', n.kcal.toLocaleString())
  if (n.code === 'high') return t('The calorie target is very high ({0} kcal). Check that this is intended.', n.kcal.toLocaleString())
  return t('The macros add up to {0} kcal, the calorie target is {1} kcal.', n.sum.toLocaleString(), n.kcal.toLocaleString())
}

function Readout({ mode, settings, adaptive, caloriesOut }) {
  const unit = useStore(s => s.S.unit)
  const e = kcal => { const v = energyOf(kcal, settings); return `${v.value.toLocaleString()} ${v.unit}` }
  if (mode === 'dynamic') {
    return <Section title={t('Wearable burn')}>
      <Row icon="flame" iconTint="var(--orange)" title={t('Yesterday’s burn')} value={caloriesOut != null ? e(caloriesOut) : t('No data yet')} />
    </Section>
  }
  if (mode !== 'adaptive') return null
  if (!adaptive) {
    return <Section title={t('Adaptive estimate')}><Row icon="chartLine" iconTint="var(--teal)" title={t('Estimate')} value={t('Not available right now')} /></Section>
  }
  if (!adaptive.ready) {
    return <Section title={t('Adaptive estimate')} footer={t('Log your food and weigh in regularly. The estimate appears once there is enough of both.')}>
      <Row icon="chartLine" iconTint="var(--teal)" title={t('Learning your burn')} value={t('{0} of {1} days', adaptive.daysAvailable ?? 0, adaptive.daysRequired ?? 21)} />
    </Section>
  }
  const trend = adaptive.trendKgPerWeek
  const trendShown = trend == null ? null : Math.round((unit === 'lb' ? trend * 2.20462 : trend) * 10) / 10
  return <Section title={t('Adaptive estimate')}>
    <Row icon="flame" iconTint="var(--orange)" title={t('Estimated daily burn')} value={adaptive.tdee != null ? e(adaptive.tdee) : t('Not available right now')} />
    {trendShown != null && <Row icon="scale" iconTint="var(--teal)" title={t('Weight trend')} value={t('{0} {1} a week', (trendShown > 0 ? '+' : '') + fmtNum(trendShown), unit)} />}
    {adaptive.confidence != null && <Row icon="gauge" iconTint="var(--blue)" title={t('Confidence')} value={`${Math.round(adaptive.confidence * (adaptive.confidence <= 1 ? 100 : 1))}%`} />}
  </Section>
}

function Templates({ form }) {
  const [name, setName] = useState('')
  const list = form.settings?.goalTemplates || []
  const add = async () => {
    if (!name.trim()) return
    if (await form.saveTemplate(name.trim())) { setName(''); toast(t('Template saved')) }
  }
  const remove = tpl => confirmSheet({
    title: t('Delete “{0}”?', tpl.name), message: t('The goals you have now are not changed.'), confirmText: t('Delete'), danger: true,
    onConfirm: () => form.deleteTemplate(tpl.id),
  })
  return <Section title={t('Templates')} footer={t('A template keeps your calorie, macro and water goals so you can switch back to them. Applying one fills the page; nothing changes until you save.')}>
    {list.map(tpl => (
      <Row key={tpl.id} icon="clipboard" iconTint="var(--green)" title={tpl.name}>
        <Button size="sm" onClick={() => form.pickTemplate(tpl)}>{t('Apply')}</Button>
        <Button size="sm" variant="danger" aria-label={t('Delete')} icon="trash" onClick={() => remove(tpl)} />
      </Row>
    ))}
    <Row>
      <TextField value={name} onChange={e => setName(e.target.value)} placeholder={t('Template name')} maxLength={40}
        onKeyDown={e => { if (e.key === 'Enter') add() }} />
      <Button size="sm" disabled={!name.trim() || form.save.state === 'saving'} onClick={add}>{t('Save template')}</Button>
    </Row>
  </Section>
}

function GoalsForm({ form }) {
  const S = useStore(s => s.S)
  const { draft, settings, patch, figures, save } = form
  const unit = energyOf(0, settings).unit
  const waterUnit = waterUnitOf(settings)
  const wearable = hasWearable(settings)
  const preview = previewBase(settings, draft, { caloriesOut: figures.caloriesOut, adaptive: figures.adaptive })
  const grams = Object.fromEntries(MACROS.map(id => [id, macroGrams(draft.macros[id], id, preview.kcal)]))
  const notes = goalNotes(preview.kcal, grams)
  const workout = workoutAdjustState(draft.mode, figures.adaptive)
  const kcalShown = draft.kcal == null ? null : energyOf(draft.kcal, settings).value
  const setMacro = (id, next) => patch(d => ({ macros: { ...d.macros, [id]: { ...d.macros[id], ...next } } }))
  const pickMode = mode => { if (mode !== 'dynamic' || wearable) patch({ mode }) }

  return <>
    <Section title={t('Calories')} footer={<>
      {modeNote(draft.mode)}
      {!wearable && draft.mode !== 'dynamic' && <> {t('Dynamic needs a connected wearable.')}</>}
    </>}>
      <Row icon="flame" iconTint="var(--orange)" title={t('Calorie goal')}>
        <Segmented className="seg-inline" options={modeOptions()} value={draft.mode} onChange={pickMode} />
      </Row>
      {draft.kcalPerWeekday
        ? <Row icon="target" iconTint="var(--red)" title={draft.mode === 'fixed' ? t('Daily target') : t('Fallback target')}
            subtitle={t('Change it in NutriTrace.')} value={t('Varies by weekday')} />
        : <Row icon="target" iconTint="var(--red)" title={draft.mode === 'fixed' ? t('Daily target') : t('Fallback target')}>
            <Stepper value={kcalShown} step={unit === 'kJ' ? 100 : 50} decimal={false} unit={unit} ariaLabel={t('Daily target')}
              onChange={v => patch({ kcal: energyFromUnit(v, settings) || null })} />
          </Row>}
      {draft.mode !== 'fixed' && (
        <Row icon="slider" iconTint="var(--purple)" title={t('Goal factor')}>
          <Segmented className="seg-inline" options={factorOptions()} value={draft.factor} onChange={factor => patch({ factor })} />
        </Row>
      )}
      <Row icon="flag" iconTint="var(--green)" title={t('Target today')} value={`${energyOf(preview.kcal, settings).value.toLocaleString()} ${unit}`} />
    </Section>

    <Readout mode={draft.mode} settings={settings} adaptive={figures.adaptive} caloriesOut={figures.caloriesOut} />

    {(workout === 'optin' || draft.adjust) && (
      <Section title={t('Workouts')} footer={workout === 'optin'
        ? t('Adds the estimated calories of each workout to the day’s target. Turn it off and workouts only appear in your diary.')
        : t('Your target already includes training.')}>
        <Row icon="dumbbell" iconTint="var(--blue)" title={t('Count workouts toward the target')}>
          <Switch aria-label={t('Count workouts toward the target')} checked={draft.adjust && workout === 'optin'} disabled={workout !== 'optin'}
            onChange={adjust => patch({ adjust })} />
        </Row>
      </Section>
    )}

    <Section title={t('Macros')} footer={notes.length ? notes.map(n => <span key={n.code}>{noteText(n)} </span>) : undefined}>
      <SelectRow icon="chart" iconTint="var(--indigo)" title={t('Macro split')} value={null} options={presetOptions()}
        onChange={name => { const macros = applyPreset(name, preview.kcal); if (macros) patch({ macros }) }} />
      {MACROS.map(id => {
        const m = draft.macros[id]
        if (m.perWeekday) return <Row key={id} title={macroLabel(id)} subtitle={t('Change it in NutriTrace.')} value={t('Varies by weekday')} />
        return <Row key={id} title={macroLabel(id)}>
          <Stepper value={m.value} step={m.percent ? 1 : 5} max={m.percent ? 100 : Infinity} decimal={false} unit={m.percent ? '%' : 'g'}
            ariaLabel={macroLabel(id)} onChange={v => setMacro(id, { value: v || null })} />
          <Segmented className="seg-inline" options={[{ value: 'g', label: 'g' }, { value: '%', label: '%' }]} value={m.percent ? '%' : 'g'}
            onChange={() => setMacro(id, toggleMacroUnit(m, id, preview.kcal))} />
        </Row>
      })}
    </Section>

    <Section title={t('Water')}>
      <Row icon="droplet" iconTint="var(--blue)" title={t('Daily water goal')}>
        <Stepper value={waterToUnit(draft.waterMl, waterUnit)} step={waterUnit === 'ml' ? 250 : waterUnit === 'oz' ? 8 : 0.25}
          decimal={waterUnit !== 'ml'} unit={waterUnit === 'oz' ? 'fl oz' : waterUnit} ariaLabel={t('Daily water goal')}
          onChange={v => patch({ waterMl: waterFromUnit(v, waterUnit) })} />
      </Row>
    </Section>

    <Section title={t('Body')}>
      <Row icon="scale" iconTint="var(--teal)" title={t('Target weight')} accessory="chevron" onClick={goalSheet}
        value={S.targetW ? `${fmtNum(S.targetW)} ${S.unit}` : t('Not set')} />
    </Section>

    <Templates form={form} />

    <Button variant="primary" disabled={!form.dirty || save.state === 'saving'}
      onClick={async () => { if (await form.submit()) toast(t('Goals saved')) }}>
      {save.state === 'saving' ? t('Saving…') : t('Save goals')}
    </Button>
    {save.state === 'error' && <p className="sect-f" role="alert">{ntErrorText(save.error)} {t('Your changes are still here.')}</p>}
  </>
}

// Nutrition › Goals (B24–B27): the calorie goal and how it is worked out, macros, water, target
// weight, templates. Everything but target weight is a NutriTrace setting; target weight is
// openGym's own and the same one Body edits.
export default function NutritionGoals() {
  const user = useStore(s => s.user)
  if (nutritionAvailable(user)) return <GoalsPage />
  return <div>
    <SubHeader title={t('Goals')} />
    <div className="empty small">{t('Nutrition needs an account on the web app.')}</div>
  </div>
}

function GoalsPage() {
  const form = useGoalsForm()
  return <div>
    <SubHeader title={t('Goals')} />
    {form.draft
      ? <GoalsForm form={form} />
      : form.status === 'error'
        ? <div className="empty small" role="alert">
            <div>{ntErrorText(form.loadError)}</div>
            <Button size="sm" onClick={form.reload}>{t('Try again')}</Button>
          </div>
        : <div className="empty small">{t('Loading…')}</div>}
  </div>
}
