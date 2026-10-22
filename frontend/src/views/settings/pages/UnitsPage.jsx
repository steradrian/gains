import { useNavigate } from 'react-router-dom'
import { useStore } from '../../../store/useStore.js'
import { t, LANGS, baseLang } from '../../../lib/i18n.js'
import { effectiveLang } from '../../../lib/default-lang.js'
import { speedUnitOf } from '../../../lib/speed.js'
import { formulaOf } from '../../../lib/onerm.js'
import { menuSheet } from '../../../sheets.jsx'
import GlassValueRow from '../../../ds/GlassValueRow.jsx'
import StageNote from '../../../ds/StageNote.jsx'
import StageSection from '../../../ds/StageSection.jsx'
import { useSettingsCtx } from '../use-settings-ctx.js'
import SettingsPage from '../SettingsPage.jsx'
import { PAGES } from '../../settings-pages.js'
import { settingsPath } from '../paths.js'
import { Card, SegmentedRow, SwitchRow } from './prefs-rows.jsx'
import { formulaName, formulaSheet, languageSheet } from './units-sheets.jsx'

const WEIGHT_OPTIONS = [{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]
const SPEED_OPTIONS = [{ value: 'kmh', label: 'km/h' }, { value: 'mph', label: 'mph' }]

// Units and language (board St1Units; drawers in units-sheets.jsx). Display only: a unit switch
// offers to convert the stored numbers, and the other rows change what is shown, never what is
// logged.
export default function UnitsPage() {
  const S = useStore(s => s.S)
  const config = useStore(s => s.config)
  const update = useStore(s => s.update)
  const setUnit = useStore(s => s.setUnit)
  const ctx = useSettingsCtx()
  const nav = useNavigate()
  // What the app is showing, which for a profile that never picked a language is worked out on
  // this device rather than stored (#303).
  const lang = effectiveLang(S, config)
  const speed = speedUnitOf(S)

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

  return (
    <SettingsPage title={t(PAGES.units.title)} line={`${S.unit} · ${speed === 'mph' ? 'mph' : 'km/h'} · ${LANGS[lang]}`}>
      <Card>
        <GlassValueRow icon="globe" title={t('Language')} value={LANGS[lang]} onClick={languageSheet} />
        {ctx.nameLang && <>
          <SwitchRow icon="globe" title={t('English exercise names')}
            sub={t('Show the English name in parentheses next to the translated one.')}
            checked={S.enParens?.[baseLang(lang)] ?? true} disabled={S.enOnly?.[baseLang(lang)] === true}
            onChange={v => update(s => { s.enParens = { ...(s.enParens || {}), [baseLang(lang)]: v } })} />
          <SwitchRow icon="globe" title={t('English names only')}
            sub={t('Replace the translated names with the original English ones.')}
            checked={S.enOnly?.[baseLang(lang)] === true}
            onChange={v => update(s => { s.enOnly = { ...(s.enOnly || {}), [baseLang(lang)]: v } })} />
        </>}
      </Card>

      <StageSection title={t('Weights')} />
      <Card>
        <SegmentedRow icon="scale" title={t('Weight unit')} sub={t('Sets, weigh-ins, plates')}
          options={WEIGHT_OPTIONS} value={S.unit} onChange={switchUnit} />
        {/* Display only: one decimal reads fine for plate-loadable numbers, two for anyone whose
            per-side figure lands on .25 or .75, or who loads microplates (issue #139); None shows
            whole numbers. Nothing is stored or rounded differently; lib/format.js fmtNum just
            prints what is already there. */}
        <SegmentedRow icon="ruler" title={t('Weight decimals')} sub={t('For microplates: 1.25 kg steps need two')}
          options={[{ value: 0, label: t('None') }, { value: 1, label: '1' }, { value: 2, label: '2' }]}
          value={S.wdec === 2 ? 2 : S.wdec === 0 ? 0 : 1} onChange={v => update(s => { s.wdec = v })} />
        {/* Which formula turns a set into an estimated 1RM (Discord, #155): the exercise page,
            the 1RM chart and records all follow it. */}
        <GlassValueRow icon="chart" title={t('1RM formula')} sub={t('How a new best is estimated')}
          value={formulaName(formulaOf(S))} onClick={formulaSheet} />
      </Card>

      <StageSection title={t('Distance and speed')} />
      <Card>
        {/* Cardio speed (Discord "miles per hour"). Unlike the weight unit this converts nothing:
            speeds stay stored in km/h and only what is shown and typed follows it (lib/speed.js).
            Until chosen it follows the weight unit, so a profile in pounds already reads mph. */}
        <SegmentedRow icon="figureRun" title={t('Speed unit')} sub={t('Cardio and Log activity')}
          options={SPEED_OPTIONS} value={speed} onChange={v => update(s => { s.speedUnit = v })} />
        {ctx.nutrition && <GlassValueRow icon="droplet" title={t('Water unit')} sub={t('Water has its own unit')}
          onClick={() => nav(settingsPath('water'))} />}
      </Card>

      <StageNote>{t('Changing a unit converts what you see; nothing you logged changes.')}</StageNote>
    </SettingsPage>
  )
}
