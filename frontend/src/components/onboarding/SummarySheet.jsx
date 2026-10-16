import { useRef, useState } from 'react'
import { t } from '../../lib/i18n.js'
import { useSheetClosed } from '../presence.jsx'
import { SheetHeader } from '../sheet-layout.jsx'
import ChoiceCards from './ChoiceCards.jsx'

// The Summary's two changes, each one answer the hub takes and the target is worked out from
// again: Adjust (the goal) and the activity chip (what a day is mostly). A tap picks and closes;
// arrow keys choose without closing. Each choice shows in the Summary at once (`onPick`), the hub
// is told once, when the sheet goes (`onDone`, and only if something was picked).
const OPTIONS = {
  goal: () => [
    { value: 'lose', icon: 'trendingDown', title: t('Lose weight'), sub: t('Eat a little under what you burn') },
    { value: 'keep', icon: 'scaleBalance', title: t('Keep my weight'), sub: t('Hold steady and get stronger') },
    { value: 'build', icon: 'trendingUp', title: t('Build muscle'), sub: t('A small surplus to grow on') },
  ],
  activity: () => [
    { value: 'sitting', icon: 'armchair', title: t('Mostly sitting') },
    { value: 'on_feet', icon: 'footprints', title: t('On your feet') },
    { value: 'physical', icon: 'hammer', title: t('Physical work') },
  ],
}

export default function SummarySheet({ which, answers, onPick, onDone, close }) {
  const [value, setValue] = useState(which === 'goal' ? (answers.goal === 'unsure' ? 'keep' : answers.goal) : answers.activity?.value)
  const picked = useRef(false)
  // The Summary's `onDone` only calls the flow's stable save, so the first one is the one to keep.
  const done = useRef(onDone)
  useSheetClosed(() => { if (picked.current) done.current() })
  const pick = (v, { viaKey }) => {
    picked.current = true
    setValue(v)
    onPick(v)
    if (!viaKey) close()
  }
  const title = which === 'goal' ? t('Your goal') : t('Your day is mostly')
  return <>
    <SheetHeader title={title} />
    <div id="ob-sum-sheet-t" className="sr-only">{title}</div>
    <ChoiceCards labelledBy="ob-sum-sheet-t" options={OPTIONS[which]()} value={value} onPick={pick} />
  </>
}
