import { useRef } from 'react'
import { t } from '../../../lib/i18n.js'
import { importPlanFile } from '../../../sheets.jsx'
import GlassValueRow from '../../../ds/GlassValueRow.jsx'
import StagePage from '../../../ds/StagePage.jsx'
import StageSection from '../../../ds/StageSection.jsx'
import '../coach-pages.css'
import { usePlans } from './use-plans.js'

// Ready-made plans (T10.0, /train/plans): the starters, then the other two ways to get a plan.
// Opening a plan shows what it does (PlanPreview); nothing here changes the Plan. A plan's session
// minutes are not shown: nothing estimates them from a prescription (lib/starter.js).
export default function PlansScreen() {
  const { plans, coach, openPlan, askCoach } = usePlans()
  const file = useRef(null)
  const pick = ev => {
    const f = ev.target.files[0]
    ev.target.value = ''
    importPlanFile(f)
  }
  return (
    <StagePage largeTitle={t('Ready-made plans')} sub={t('Starters you can edit afterwards')}>
      <div className="tcp">
        <div className="g-glist g-glass">
          {plans.map(p => (
            <GlassValueRow key={p.id} icon="clipboard" title={p.name} sub={<>{p.about}<br />{t('{0} days per week', p.days)}</>} onClick={() => openPlan(p.id)} />
          ))}
        </div>
        <div className="tcp-block">
          <StageSection title={t('Got a plan from a friend?')} />
          <div className="g-glist g-glass">
            <GlassValueRow icon="download" title={t('Import a plan file')} sub={t('Adds its routines to yours')} onClick={() => file.current?.click()} />
            {coach && <GlassValueRow icon="chat" title={t('Ask Coach to design one')} sub={t('From your own training and your goal')} onClick={askCoach} />}
          </div>
        </div>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={pick} />
      </div>
    </StagePage>
  )
}
