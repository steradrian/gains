import { useState } from 'react'
import { t } from '../../lib/i18n.js'
import { SheetHeader } from '../sheet-layout.jsx'
import ChoiceCards from './ChoiceCards.jsx'

// The Summary's two changes, each one answer the hub takes and the target is worked out from
// again: Adjust (the goal) and the activity chip (what a day is mostly). A tap picks and closes;
// arrow keys choose without closing.
const OPTIONS = {
  goal: () => [
    { value: 'lose', icon: 'trendingDown', title: t('Lose weight'), sub: t('Eat a little under what you burn') },
    { value: 'keep', icon: 'scaleBalance', title: t('Keep my weight'), sub: t('Hold steady and get stronger') },
    { value: 'build', icon: 'trendingUp', title: t('Build muscle'), sub: t('A small surplus to grow on') },
  ],
  activity: () => [
    { value: 'sitting', icon: 'person', title: t('Mostly sitting') },
    { value: 'on_feet', icon: 'steps', title: t('On your feet') },
    { value: 'physical', icon: 'wrench', title: t('Physical work') },
  ],
}

export default function SummarySheet({ which, answers, onPick, close }) {
  const [value, setValue] = useState(which === 'goal' ? (answers.goal === 'unsure' ? 'keep' : answers.goal) : answers.activity?.value)
  const pick = (v, { viaKey }) => {
    setValue(v)
    onPick(v)
    if (!viaKey) close()
  }
  return <>
    <SheetHeader title={which === 'goal' ? t('Adjust your target') : t('Your day is mostly')} />
    <div id="ob-sum-sheet-t" className="sr-only">{which === 'goal' ? t('Your goal') : t('Your day is mostly')}</div>
    <ChoiceCards labelledBy="ob-sum-sheet-t" options={OPTIONS[which]()} value={value} onPick={pick} />
  </>
}
