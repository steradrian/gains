import { useEffect, useRef, useState } from 'react'
import { t, tn } from '../../lib/i18n.js'
import { EQUIPMENT_OPTIONS, EXPERIENCE_OPTIONS } from '../../lib/onboarding/labels.js'
import { SheetActions, SheetHeader } from '../sheet-layout.jsx'
import { Button } from '../ui.jsx'
import ChoiceChips from './ChoiceChips.jsx'

// 5b: the AI coach (§3b; never "Coach" without "AI" and a description). What it reads, where the
// answers go, and the one tap that sends them: the consent. Experience is optional, equipment
// defaults to a full gym. Build → onBuild({ experience, equipment }); Not now (or closing) → back
// on the Plan choice with nothing picked.
export default function CoachSheet({ days, experience, equipment, onBuild, onDismiss, close }) {
  const [exp, setExp] = useState(experience)
  const [eq, setEq] = useState(equipment || 'gym')
  // However it closes without building (Not now, the scrim, Escape, a swipe), the choice is undone.
  const built = useRef(false)
  const dismiss = useRef(onDismiss)
  useEffect(() => () => { if (!built.current) dismiss.current?.() }, [])
  const build = () => { built.current = true; onBuild({ experience: exp ?? null, equipment: eq }) }
  return <>
    <SheetHeader title={t('Have the AI coach build your plan')} />
    <p className="ob-sheet-p">{tn('An AI model reads your goal, your body details and your {0} training day, then drafts a plan. You review it before anything goes on your week.',
      'An AI model reads your goal, your body details and your {0} training days, then drafts a plan. You review it before anything goes on your week.', days)}</p>
    <p className="ob-fine">{t('These answers go to the AI service this Gains server uses. Your food log and your friends are not sent. Tapping Build my plan sends them once.')}</p>
    <ChoiceChips label={t('Your experience (optional)')} options={EXPERIENCE_OPTIONS()} value={exp} onPick={setExp} />
    <ChoiceChips label={t('What you can use')} options={EQUIPMENT_OPTIONS()} value={eq} onPick={setEq} />
    <SheetActions>
      <Button variant="primary" onClick={build}>{t('Build my plan')}</Button>
      <Button onClick={close}>{t('Not now')}</Button>
    </SheetActions>
  </>
}
