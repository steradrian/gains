import { useEffect, useRef, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { cx, oneOf } from '../lib/ui-kit.js'
import Act from './Act.jsx'
import Button from './Button.jsx'
import MapRow from './MapRow.jsx'

const TONES = ['warm', 'main', 'cool']
// How close to the list's top or bottom edge a held row starts to scroll it, in px.
const EDGE = 64

// The workout map (bundle.js `MapDrawer`; boards W1.37, W1.23, W1.45): every exercise in its
// phase, where the person jumps around and reorders. The content of a full `BottomSheet` (which
// owns the title, the clock and the ×). The `hint` line and the foot stay pinned to the sheet's
// body while the list scrolls under them; nothing else scrolls.
//
// `sections`: [{ key?, title, tone?: warm | main | cool, action?, onAction?, actionHref?, rows }],
// one per phase. `action` is the phase's own button ("Skip cool-down"). `rows` are MapRow props
// plus `id` (the React key: give every row one, so focus follows a row that moves). The phase dot
// in the title and on the rows comes from `tone`.
//
// Reordering stays inside a phase and never across: with `onReorder(sectionKey, from, to)` every
// row gets a handle (`handle: false` on a row leaves it out). A pointer press on the handle lifts
// the row, which follows the finger while the others open a gap; the list scrolls when the row
// nears its edge; releasing calls `onReorder` once, Escape or a cancelled touch calls nothing.
// With the keyboard the handle moves the row one place with Arrow Up and Down. `sectionKey` is the
// section's `key`, else its index; `from` and `to` are indexes in that section's `rows`.
// `movedLabel(name, place, count)` is what a screen reader hears after a move ("Bench press, 2 of 6").
//
// The foot: `addLabel` with `onAdd` / `addHref`, `supersetLabel` with `onSuperset` / `supersetHref`
// (a button appears only with its label), and `footer` under them for the "Workout options" row.
// Every string comes from the caller.
export default function MapDrawer({
  sections = [], hint, onReorder, movedLabel,
  addLabel, onAdd, addHref, supersetLabel, onSuperset, supersetHref, footer,
}) {
  // { si, from, to, dy, h, top }: the held row, where it would land, how far it is dragged, its
  // height, and the top of the gap it would drop into (all in px, from the section's list).
  const [drag, setDrag] = useState(null)
  const [said, setSaid] = useState('')
  const run = useRef(null)
  const lists = useRef([])
  const items = useRef([])
  const latest = useRef(null)
  latest.current = { sections, onReorder, movedLabel }
  const holding = !!drag

  const reorder = (si, from, to) => {
    const { sections: all, onReorder: commit, movedLabel: say } = latest.current
    const section = all[si]
    if (!section || !commit || to < 0 || to >= section.rows.length || to === from) return
    commit(section.key ?? si, from, to)
    if (say) setSaid(say(section.rows[from].name, to + 1, section.rows.length))
  }

  const update = () => {
    const r = run.current
    if (!r) return
    const first = r.rects[0]
    const last = r.rects[r.rects.length - 1]
    const me = r.rects[r.from]
    const scrolled = r.scroller ? r.scroller.scrollTop - r.scroll0 : 0
    const raw = r.lastY - r.startY + scrolled
    // The row can't leave its phase: its travel stops at the first and last slot.
    const dy = Math.min(last.top + last.h - (me.top + me.h), Math.max(first.top - me.top, raw))
    // It lands past a row once its leading edge has crossed that row's middle, so the first and
    // the last place are both reachable at the end of its travel.
    const edgeTop = me.top + dy
    const edgeBottom = edgeTop + me.h
    let to = r.from
    r.rects.forEach((q, j) => {
      const mid = q.top + q.h / 2
      if (j > r.from && edgeBottom > mid) to = Math.max(to, j)
      if (j < r.from && edgeTop < mid) to = Math.min(to, j)
    })
    r.to = to
    const top = to < r.from ? r.rects[to].top : to > r.from ? r.rects[to].top + r.rects[to].h - me.h : me.top
    setDrag(d => (!d || (d.dy === dy && d.to === to) ? d : { si: r.si, from: r.from, to, dy, h: me.h, top }))
  }

  const begin = (si, from, e) => {
    if (run.current) return
    const box = lists.current[si]
    const count = latest.current.sections[si].rows.length
    const els = (items.current[si] || []).slice(0, count).filter(Boolean)
    if (!box || els.length < 2 || els.length !== count) return
    const scroller = box.closest('.g-bs-body')
    const base = box.getBoundingClientRect().top
    const rects = els.map(el => { const q = el.getBoundingClientRect(); return { top: q.top - base, h: q.height } })
    // Capture only keeps the stream on the handle; the window listeners carry the drag without it.
    try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch { /* a pointer that is not active */ }
    run.current = { si, from, to: from, rects, startY: e.clientY, lastY: e.clientY, scroller, scroll0: scroller ? scroller.scrollTop : 0, raf: 0 }
    setDrag({ si, from, to: from, dy: 0, h: rects[from].h, top: rects[from].top })
  }

  useEffect(() => {
    if (!holding) return undefined
    const finish = commit => {
      const r = run.current
      if (!r) return
      cancelAnimationFrame(r.raf)
      run.current = null
      setDrag(null)
      if (commit) reorder(r.si, r.from, r.to)
    }
    const move = e => { if (run.current) { run.current.lastY = e.clientY; update() } }
    const up = () => finish(true)
    const stop = () => finish(false)
    const esc = e => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      finish(false)
    }
    const tick = () => {
      const r = run.current
      if (!r) return
      if (r.scroller) {
        const b = r.scroller.getBoundingClientRect()
        const over = r.lastY < b.top + EDGE ? r.lastY - (b.top + EDGE) : r.lastY > b.bottom - EDGE ? r.lastY - (b.bottom - EDGE) : 0
        if (over) { r.scroller.scrollTop += over / 6; update() }
      }
      r.raf = requestAnimationFrame(tick)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', stop)
    window.addEventListener('keydown', esc, true)
    if (run.current) run.current.raf = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', stop)
      window.removeEventListener('keydown', esc, true)
      if (run.current) cancelAnimationFrame(run.current.raf)
      run.current = null
    }
    // update and reorder read refs and state setters only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holding])

  const hasFoot = !!(addLabel || supersetLabel)
  return (
    <div className="g-md">
      <div className="g-sr" role="status">{said}</div>
      {hint && <p className="g-md-hint"><Icon name="grip" className="g-icon" />{hint}</p>}
      {sections.map((s, si) => {
        oneOf('MapDrawer', 'tone', s.tone, TONES)
        const mine = drag && drag.si === si ? drag : null
        return (
          <section key={s.key ?? si} className="g-md-sec">
            <div className="g-md-h">
              <span className="g-md-t" role="heading" aria-level={3}>{s.tone && s.tone !== 'main' && <i className={cx('g-md-dot', 'g-md-dot-' + s.tone)} aria-hidden="true" />}{s.title}</span>
              {s.action && <Act href={s.actionHref} onClick={s.onAction} className="g-md-a">{s.action}</Act>}
            </div>
            <div className={cx('g-md-rows', mine && 'g-md-hold')} ref={el => { lists.current[si] = el }}>
              {mine && <span className="g-md-slot" style={{ insetBlockStart: mine.top, height: mine.h }} aria-hidden="true" />}
              {s.rows.map((r, j) => {
                const { id, ...row } = r
                const lifted = !!mine && mine.from === j
                let shift = 0
                if (mine && !lifted) {
                  if (mine.from < mine.to && j > mine.from && j <= mine.to) shift = -mine.h
                  else if (mine.to < mine.from && j >= mine.to && j < mine.from) shift = mine.h
                }
                const y = lifted ? mine.dy : shift
                return (
                  <div key={id ?? j} className={cx('g-md-item', lifted && 'g-md-held')} style={y ? { transform: `translateY(${y}px)` } : undefined}
                    ref={el => { (items.current[si] ||= [])[j] = el }}>
                    <MapRow {...row} tone={row.tone ?? s.tone} lifted={lifted} handle={row.handle ?? !!onReorder}
                      onMove={dir => reorder(si, j, j + dir)} onDragStart={e => begin(si, j, e)} />
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
      {(hasFoot || footer) && (
        <div className="g-md-pin">
          {hasFoot && (
            <div className="g-md-foot">
              {addLabel && <Button variant="secondary" icon="plus" href={addHref} onClick={onAdd}>{addLabel}</Button>}
              {supersetLabel && <Button variant="secondary" icon="link" href={supersetHref} onClick={onSuperset}>{supersetLabel}</Button>}
            </div>
          )}
          {footer && <div className="g-md-more">{footer}</div>}
        </div>
      )}
    </div>
  )
}
