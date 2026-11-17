import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import { t, LANGS, INSTR_LANGS } from '../../../lib/i18n.js'
import { effectiveLang } from '../../../lib/default-lang.js'
import { estimate1RM, formulaOf, FORMULA_NAMES } from '../../../lib/onerm.js'
import { fmtNum } from '../../../lib/format.js'
import BottomSheet from '../../../ds/BottomSheet.jsx'
import RadioRow from '../../../ds/RadioRow.jsx'

// The drawers of Units and language (boards St1Language, St1Formula). Choosing applies at once and
// closes: there is no Save.

// The load every formula is shown on, so the three numbers on the board read side by side.
const EXAMPLE_LOAD = 100
const EXAMPLE_REPS = 5

// Formulas in the order the drawer lists them; the first three are the board's, the rest were in
// the old picker and stay.
export const FORMULA_ORDER = ['epley', 'brzycki', 'lombardi', 'oconner', 'mayhew', 'wathan', 'lander', 'weighted']

/** Which formula's name to show: the authors' names are not translated; the blend is a word. */
export const formulaName = id => (id === 'weighted' ? t('Blend of all') : FORMULA_NAMES[id])

/** "100 kg × 5 reps ≈ 116.7 kg" for a formula; the blend has no single example. */
export function formulaExample(id, unit) {
  if (id === 'weighted') return t('Averages seven formulas and reads your RIR when you log it.')
  const est = estimate1RM(EXAMPLE_LOAD, EXAMPLE_REPS, id)
  return t('{0} {1} × {2} reps ≈ {3} {1}', EXAMPLE_LOAD, unit, EXAMPLE_REPS, fmtNum(est))
}

function LanguageSheet({ close }) {
  const S = useStore(s => s.S)
  const config = useStore(s => s.config)
  const update = useStore(s => s.update)
  const current = effectiveLang(S, config)
  const pick = lang => {
    update(s => { s.lang = lang; s.langAuto = false })
    close()
  }
  return (
    <BottomSheet title={t('Language')} type="half">
      <div role="radiogroup" aria-label={t('Language')}>
        {Object.entries(LANGS).map(([k, name]) => (
          <RadioRow key={k} title={name} selected={k === current} onClick={() => pick(k)}
            sub={INSTR_LANGS.includes(k) ? undefined : t("Exercise instructions aren't translated into this language yet, so they stay in English.")} />
        ))}
      </div>
    </BottomSheet>
  )
}

function FormulaSheet({ close }) {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const current = formulaOf(S)
  const pick = id => {
    update(s => { s.oneRmFormula = id })
    close()
  }
  return (
    <BottomSheet title={t('1RM formula')} type="auto">
      <div role="radiogroup" aria-label={t('1RM formula')}>
        {FORMULA_ORDER.map(id => (
          <RadioRow key={id} title={formulaName(id)} sub={formulaExample(id, S.unit)} selected={id === current} onClick={() => pick(id)} />
        ))}
      </div>
      <p className="g-bs-note">{t('Only the estimate changes. Your logged sets and real bests stay as they are.')}</p>
    </BottomSheet>
  )
}

export const languageSheet = () => useUI.getState().openSheet(close => <LanguageSheet close={close} />, { variant: 'ds' })
export const formulaSheet = () => useUI.getState().openSheet(close => <FormulaSheet close={close} />, { variant: 'ds' })
