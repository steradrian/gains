import { useEffect, useRef, useState } from 'react'
import { useUI } from '../store/useUI.js'
import { isoOf, todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { againDrafts, againItems, againKcal } from '../lib/nutrition/again.js'
import { energyOf } from '../lib/nutrition/diary.js'
import { foodErrorText } from '../lib/nutrition/foods.js'
import { mealLabels } from '../lib/nutrition/meal-name.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { Tag } from './blocks.jsx'
import { Button, Row, Section } from './ui.jsx'

const toast = (m, opts) => useUI.getState().toast(m, opts)

const yesterdayISO = () => {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return isoOf(d)
}

// "Yesterday's lunch [Log again]": the same meal logged to today, in one tap, when yesterday's
// meal is there and every entry in it can be logged again (lib/nutrition/again.js). The drafts
// are built once per meal and sent again on a retry, so a write whose answer was lost does not
// log an entry twice.
export default function YesterdayMealRow({ settings, meal }) {
  const today = todayISO()
  const yesterday = yesterdayISO()
  const entry = useNutrition(s => s.days[yesterday]?.entry)
  const [busy, setBusy] = useState(false)
  const [doneFor, setDoneFor] = useState('')
  const drafts = useRef({ sig: '', list: null })

  useEffect(() => { useNutrition.getState().loadDay(yesterday) }, [yesterday])

  const items = againItems(entry, meal)
  if (!items) return null
  const names = mealLabels(settings)
  const label = names[meal] ?? names[0]
  const kcal = energyOf(againKcal(items), settings)
  const sig = `${today}|${meal}|${yesterday}`

  async function again() {
    if (busy) return
    setBusy(true)
    const n = useNutrition.getState()
    try {
      if (drafts.current.sig !== sig) drafts.current = { sig, list: againDrafts(items, meal, n) }
      const logged = []
      for (const d of drafts.current.list) logged.push(d.food ? await n.logFood(today, d.food) : await n.logQuick(today, d.quick))
      setDoneFor(sig)
      toast(t('Logged to {0}', label), {
        action: t('Undo'),
        onAction: async () => {
          try { for (const item of logged) await useNutrition.getState().removeItem(today, item.uuid) } catch (e) { toast(foodErrorText(e, { write: true })) }
        },
      })
    } catch (e) {
      toast(foodErrorText(e, { write: true }))
    } finally {
      setBusy(false)
    }
  }

  return <Section>
    <Row icon="history" iconTint="var(--indigo)" title={t('Yesterday’s {0}', label)} subtitle={`${items.map(i => i.name).join(', ')} · ${kcal.value} ${kcal.unit}`}>
      {doneFor === sig
        ? <Tag tone="acc">{t('Logged')}</Tag>
        : <Button size="sm" variant="tinted" onClick={again} disabled={busy}>{t('Log again')}</Button>}
    </Row>
  </Section>
}
