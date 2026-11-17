import { useLayoutEffect, useRef, useState } from 'react'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import { t } from '../../../lib/i18n.js'
import QrCanvas from '../../../components/QrCanvas.jsx'
import DangerRow from '../../../ds/DangerRow.jsx'
import GlassList from '../../../ds/GlassList.jsx'
import IconButton from '../../../ds/IconButton.jsx'
import StageEmpty from '../../../ds/StageEmpty.jsx'
import StageNote from '../../../ds/StageNote.jsx'
import StageSection from '../../../ds/StageSection.jsx'
import { moveGymCard, openAddCard, openEditCard } from '../../CheckIn.jsx'
import SettingsPage from '../SettingsPage.jsx'

// Gym check-in (board St1GymPass; route /train/checkin, opened from Training and the + drawer):
// each saved membership code as a QR the turnstile can read, swiped through horizontally, then the
// Card section to add, retype or remove one. The QR is regenerated from the stored value every
// time; the plate behind it is white. The board promises full brightness while the page is open
// and a lock screen widget; neither exists in the app (no brightness plugin, no widget), so the
// note says only what is true.
//
// The rail reopens on the card you used last (lastGymCardId) and remembers the one you settle on,
// so a member with two gyms lands on the right code without swiping. With more than one card each
// carries ◀ ▶ buttons to nudge its position along the rail.
export default function GymPassPage() {
  const cards = useStore(s => s.S.gymCards) || []
  const lastId = useStore(s => s.S.lastGymCardId)
  const update = useStore(s => s.update)
  const toast = useUI(s => s.toast)
  const railRef = useRef(null)
  const [active, setActive] = useState(0)
  const shown = Math.min(active, Math.max(0, cards.length - 1))
  const current = cards[shown]

  // Open on the last-used card. Done once on mount (and whenever the saved id changes from
  // elsewhere) with layout effect so the jump happens before paint — no visible scroll from 0.
  // A stale id (its card was removed) falls back to the first card.
  useLayoutEffect(() => {
    const rail = railRef.current
    if (!rail || !cards.length) return
    const idx = Math.max(0, cards.findIndex(c => c.id === lastId))
    rail.scrollLeft = idx * rail.clientWidth
    setActive(idx)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-seeked on the saved id and the count only
  }, [lastId, cards.length])

  // Which card the horizontal scroll has settled on — drives the dots and gets remembered as the
  // last-used card. Reading it off the scroll position keeps the rail itself the single control.
  const onScroll = () => {
    const rail = railRef.current
    if (!rail) return
    const i = Math.round(rail.scrollLeft / rail.clientWidth)
    if (i === active || !cards[i]) return
    setActive(i)
    if (cards[i].id !== lastId) update(s => { s.lastGymCardId = cards[i].id }, false)
  }

  const move = (index, to) => update(s => { s.gymCards = moveGymCard(s.gymCards, index, to) })

  // No confirm: the card comes back with Undo for 8 seconds (R5), in its old slot and, if it was
  // the remembered one, as the remembered one.
  const remove = () => {
    if (!current) return
    const card = current
    const index = cards.indexOf(card)
    const wasRemembered = lastId === card.id
    update(s => {
      s.gymCards = (s.gymCards || []).filter(c => c.id !== card.id)
      if (s.lastGymCardId === card.id) s.lastGymCardId = (s.gymCards[0]?.id) || null
    })
    toast(t('Card removed'), {
      action: t('Undo'),
      onAction: () => update(s => {
        const list = [...(s.gymCards || [])]
        if (!list.some(c => c.id === card.id)) list.splice(Math.min(index, list.length), 0, card)
        s.gymCards = list
        if (wasRemembered) s.lastGymCardId = card.id
      }),
    })
  }

  const rows = [
    { icon: 'camera', title: t('Scan a new card'), sub: t('Barcode or QR from your gym app'), onClick: () => openAddCard({ scan: true }) },
    { icon: 'pencil', title: t('Type the number'), onClick: () => openAddCard({ typing: true }) },
    ...(current ? [{ icon: 'qr', title: t('Edit name or number'), onClick: () => openEditCard(current) }] : []),
  ]

  return (
    <SettingsPage title={t('Gym check-in')} line={cards.length ? t('Shown at the door, no login needed') : t('Add your gym card')} parent="/train">
      {cards.length === 0
        ? <StageEmpty card={false} illustration="plate" title={t('No gym card yet')}
          body={t('Import a photo of your membership card or scan it with the camera. No extra app needed at the gym, just open this screen.')} />
        : <>
          <div className="ci-rail" ref={railRef} onScroll={onScroll}>
            {cards.map((card, i) => (
              <div key={card.id} className="ci-card">
                <h2 className="ci-label">{card.label}</h2>
                <div className="ci-qr-plate"><QrCanvas value={card.value} size={230} /></div>
                <div className="ci-value">{card.value}</div>
                {cards.length > 1 && <div className="ci-reorder">
                  <IconButton icon="chevronLeft" tone="glass" label={t('Move left')} onClick={() => move(i, i - 1)} disabled={i === 0} />
                  <span className="ci-pos">{i + 1} / {cards.length}</span>
                  <IconButton icon="chevronRight" tone="glass" label={t('Move right')} onClick={() => move(i, i + 1)} disabled={i === cards.length - 1} />
                </div>}
              </div>
            ))}
          </div>
          {cards.length > 1 && <div className="ci-dots">
            {cards.map((c, i) => <span key={c.id} className={'ci-dot' + (i === shown ? ' on' : '')} />)}
          </div>}
          <StageNote>{t('Turn the screen brightness up if the reader struggles to scan the code.')}</StageNote>
        </>}

      <StageSection title={t('Card')} />
      <div className="g-sp-card"><GlassList items={rows} /></div>
      {current && <div className="g-sp-card"><div className="g-glass g-sp-danger">
        <DangerRow title={t('Remove card')} sub={t('Undo for 8 s')} onClick={remove} />
      </div></div>}
    </SettingsPage>
  )
}
