import { useStore } from '../../../store/useStore.js'
import { t, LANGS, INSTR_LANGS, baseLang } from '../../../lib/i18n.js'
import { effectiveLang } from '../../../lib/default-lang.js'
import { speedUnitOf } from '../../../lib/speed.js'
import { formulaOf, FORMULA_NAMES } from '../../../lib/onerm.js'
import { menuSheet } from '../../../sheets.jsx'
import { Section, Row, SelectRow, Switch, Segmented } from '../../../components/ui.jsx'
import { useSettingsCtx } from '../use-settings-ctx.js'

export default function UnitsPage() {
  const S = useStore(s => s.S)
  const config = useStore(s => s.config)
  const update = useStore(s => s.update)
  const setUnit = useStore(s => s.setUnit)
  const ctx = useSettingsCtx()
  // What the app is showing, which for a profile that never picked a language is worked out on
  // this device rather than stored (#303).
  const lang = effectiveLang(S, config)

  // Two honest choices on a unit switch (issue #22): convert the numbers, or keep them and only
  // change the label — the old behaviour, still right for someone who logged in lb all along
  // under a kg label. Closing the sheet leaves the unit as it was.
  const switchUnit = v => {
    if (v === S.unit) return
    menuSheet({
      title: t('Convert to {0}?', v),
      subtitle: t('Every stored weight (logged sets, working weights, routine targets, body weight, bar weights) is in {0}. Convert the numbers, or keep them and only change the label?', S.unit),
      items: [
        { icon: 'calculator', label: t('Convert the numbers'), onClick: () => setUnit(v) },
        { icon: 'pencil', label: t('Keep the numbers, change the label'), onClick: () => setUnit(v, { convert: false }) },
      ],
    })
  }

  return <>
    <Section>
      <SelectRow
        icon="globe" iconTint="var(--blue)" title={t('Language')}
        value={lang} onChange={v => update(s => { s.lang = v; s.langAuto = false })}
        options={Object.entries(LANGS).map(([k, name]) => ({
          value: k, label: name,
          subtitle: INSTR_LANGS.includes(k) ? null : t("Exercise instructions aren't translated into this language yet, so they stay in English."),
        }))}
      />
      {ctx.nameLang && <>
        <Row icon="globe" iconTint="var(--purple)" title={t('English exercise names')}
          subtitle={t('Show the English name in parentheses next to the translated one.')}>
          <Switch checked={S.enParens?.[baseLang(lang)] ?? true}
            disabled={S.enOnly?.[baseLang(lang)] === true}
            onChange={v => update(s => { s.enParens = { ...(s.enParens || {}), [baseLang(lang)]: v } })} />
        </Row>
        <Row icon="globe" iconTint="var(--purple)" title={t('English names only')}
          subtitle={t('Replace the translated names with the original English ones.')}>
          <Switch checked={S.enOnly?.[baseLang(lang)] === true}
            onChange={v => update(s => { s.enOnly = { ...(s.enOnly || {}), [baseLang(lang)]: v } })} />
        </Row>
      </>}
    </Section>
    <Section footer={t('Switching the unit offers to convert every stored weight.')}>
      <Row icon="scale" iconTint="var(--teal)" title={t('Weight unit')}>
        <Segmented className="seg-inline"
          options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]}
          value={S.unit} onChange={v => switchUnit(v)} />
      </Row>
      {/* Display only: one decimal reads fine for plate-loadable numbers, two for anyone whose
          per-side figure lands on .25 or .75, or who loads microplates (issue #139). Nothing is
          stored or rounded differently; lib/format.js fmtNum just prints what is already there. */}
      <Row icon="ruler" iconTint="var(--teal)" title={t('Weight decimals')} subtitle={t('How precisely weights are shown.')}>
        <Segmented className="seg-inline"
          options={[{ value: 1, label: t('0.5') }, { value: 2, label: t('0.25') }]}
          value={S.wdec === 2 ? 2 : 1} onChange={v => update(s => { s.wdec = v })} />
      </Row>
      {/* Cardio speed (Discord "miles per hour"). Unlike the weight unit this converts nothing:
          speeds stay stored in km/h and only what is shown and typed follows it (lib/speed.js).
          Until chosen it follows the weight unit, so a profile in pounds already reads mph. */}
      <Row icon="figureRun" iconTint="var(--teal)" title={t('Speed unit')}>
        <Segmented className="seg-inline"
          options={[{ value: 'kmh', label: 'km/h' }, { value: 'mph', label: 'mph' }]}
          value={speedUnitOf(S)} onChange={v => update(s => { s.speedUnit = v })} />
      </Row>
      {/* Which formula turns a set into an estimated 1RM (Discord, #155): the exercise page,
          the 1RM chart and records all follow it. Formula names are people, not words. */}
      <SelectRow icon="chart" iconTint="var(--teal)" title={t('1RM formula')}
        value={formulaOf(S)} onChange={v => update(s => { s.oneRmFormula = v })}
        options={[
          { value: 'epley', label: 'Epley', subtitle: t('The common one. A bit generous at higher reps.') },
          { value: 'brzycki', label: 'Brzycki', subtitle: t('More conservative above five reps.') },
          { value: 'lombardi', label: 'Lombardi', subtitle: t('Generous, especially at high reps.') },
          { value: 'oconner', label: FORMULA_NAMES.oconner, subtitle: t('The most conservative of the classics.') },
          { value: 'mayhew', label: 'Mayhew' },
          { value: 'wathan', label: 'Wathan' },
          { value: 'lander', label: 'Lander' },
          { value: 'weighted', label: t('Blend of all'), subtitle: t('Averages seven formulas and reads your RIR when you log it.') },
        ]} />
    </Section>
  </>
}
