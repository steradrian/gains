import { useEffect, useState } from 'react'
import BottomSheet from '../../../ds/BottomSheet.jsx'
import Button from '../../../ds/Button.jsx'
import Tag from '../../../ds/Tag.jsx'
import { t } from '../../../lib/i18n.js'
import { NtApi } from '../../../lib/nutrition/api.js'
import { useNutrition } from '../../../lib/nutrition/store.js'
import { useUnits } from '../../../lib/nutrition/use-units.js'
import { useUI } from '../../../store/useUI.js'
import { bodyDetailsSheet } from './goal-drawers.jsx'
import { howViewOf } from './how-data.js'
import { openTargets } from './TargetsDrawer.jsx'
import { useGoal } from './use-goal.js'
import './goal.css'

// How this is worked out (board Me3How), a half drawer: your burn, the goal factor and the target,
// then the explanation in the person's own numbers (how-data.js). Edit daily targets and Body
// details open as sub-panels of this drawer; Back returns here.

// Adaptive's estimate, fetched only in Adaptive mode. `status` says whether it is in, so the
// workouts sentence can wait for it.
function useAdaptive(enabled) {
  const [state, setState] = useState({ adaptive: null, status: 'loading' })
  useEffect(() => {
    if (!enabled) return undefined
    let live = true
    NtApi.getAdaptiveTdee().then(
      adaptive => { if (live) setState({ adaptive, status: 'ready' }) },
      () => { if (live) setState({ adaptive: null, status: 'failed' }) },
    )
    return () => { live = false }
  }, [enabled])
  return state
}

function AdaptiveBlock({ block }) {
  return (
    <section className="mg-adapt" aria-label={block.title}>
      <p className="mg-adapt-head">
        <b>{block.title}</b>
        {block.value && <span>{block.value}</span>}
        {block.early && <Tag tone="warning">{t('Early')}</Tag>}
      </p>
      {block.confidence && <p className="mg-foot">{t('Confidence {0}', block.confidence)}</p>}
      {block.firmsUp && <p className="mg-foot">{block.firmsUp}</p>}
    </section>
  )
}

function HowDrawer() {
  const g = useGoal()
  const units = useUnits()
  const settings = useNutrition(s => s.settings.data)
  const { adaptive, status } = useAdaptive(g.profile.mode === 'adaptive')

  if (!settings && g.status === 'loading') return <BottomSheet title={t('How this is worked out')} type="half"><i className="g-skel mg-sk" /></BottomSheet>
  if (!settings) return <BottomSheet title={t('How this is worked out')} type="half"><p className="mg-error" role="alert">{t('Goals did not load.')}</p></BottomSheet>

  const view = howViewOf({ profile: g.profile, targets: g.targets, settings, adaptive, adaptiveStatus: status, fmt: { energy: units.energy } })
  return (
    <BottomSheet title={t('How this is worked out')} type="half"
      footer={<Button block variant="secondary" onClick={() => openTargets()}>{t('Edit daily targets')}</Button>}>
      {view.figures
        ? <dl className="mg-figs">
          {view.figures.map(f => (
            <div key={f.id}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
              {f.sub && <dd className="mg-figs-sub">{f.sub}</dd>}
            </div>
          ))}
        </dl>
        : <div className="mg-need">
          <p className="mg-foot">{t('Your burn estimate needs your body details and a weigh-in.')}</p>
          <Button variant="secondary" onClick={() => bodyDetailsSheet()}>{t('Body details')}</Button>
        </div>}
      {view.paragraphs.map(text => <p key={text} className="mg-para">{text}</p>)}
      {view.adaptive && <AdaptiveBlock block={view.adaptive} />}
    </BottomSheet>
  )
}

export const openHow = () => useUI.getState().openSheet(() => <HowDrawer />, { variant: 'ds' })
