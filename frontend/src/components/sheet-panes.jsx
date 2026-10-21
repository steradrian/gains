import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { dsAccentFor } from '../lib/ds-accent.js'
import { t } from '../lib/i18n.js'
import { EASE, PANEL_MS, PRESETS, play } from '../lib/motion.js'
import { useStore } from '../store/useStore.js'
import Icon from './Icon.jsx'
import { Presence, leavingProps, useEnterExit, usePresence } from './presence.jsx'
import { SheetPaneContext } from './sheet-frame.js'

// A drawer's sub-panels. An action in an open drawer that would open another drawer pushes its
// content here instead (store/useUI.js openSheet): it slides in from the right inside the same
// drawer, the panel under it moves back 30%, and the drawer's height follows the active panel.
// Back (the chevron, Escape, the browser's or Android's back) slides the top panel out; the ×, the
// backdrop and a swipe down close the whole drawer (Modals.jsx).
//
// The drawer's own content is the first pane and stays in the flow while it is the active one, so
// a drawer with no panel is laid out exactly as it was. `kind` says how a pane is built: 'ds' for
// a ds/BottomSheet (head, pin, body and foot, the body scrolls) and 'legacy' for an older sheet's
// bare content (the pane scrolls, and a bar with the back chevron sits on top of it).

const HEADING = 'h1, h2, h3, [role="heading"]'
let titles = 0

// How tall a pane wants to be, with room for all of it: the sum of its parts, the body counted by
// its content rather than by the room it was given. A legacy pane scrolls itself.
const naturalHeight = pane => {
  if (pane.classList.contains('g-bs-pane-legacy')) return pane.scrollHeight
  let height = 0
  for (const part of pane.children) height += part.classList.contains('g-bs-body') ? part.scrollHeight : part.offsetHeight
  return height
}
// Only a drawer as tall as its content changes height with the panel; half and full ones are not.
const hugsContent = panes => !!panes.parentElement?.matches('.sheet, .g-bs-auto')
const livePanes = panes => [...panes.children].filter(n => n.classList.contains('g-bs-pane') && !n.hasAttribute('data-leaving'))

function Pane({ panel, active, closeFn, back, dismiss, hostLocked }) {
  const { present } = usePresence()
  const accent = useStore(s => dsAccentFor(s.S))
  const ref = useRef(null)
  const ds = panel.variant === 'ds'
  // What had the focus when the panel was drawn: the control that opened it, which gets the focus
  // back when the panel slides out.
  const [opener] = useState(() => (typeof document === 'undefined' ? null : document.activeElement))
  useEnterExit(() => [[ref.current, PRESETS.panelSlide]])

  // Focus moves to the panel's heading, and the drawer is named by it while it is up.
  useLayoutEffect(() => {
    const pane = ref.current
    if (!pane || !present) return
    const heading = pane.querySelector(HEADING)
    const target = heading || pane
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
    target.focus?.({ preventScroll: true })
    const dialog = pane.closest('[role="dialog"]')
    if (!dialog || !heading) return
    if (!heading.id) heading.id = `sheet-pane-title-${++titles}`
    const was = dialog.getAttribute('aria-labelledby')
    dialog.setAttribute('aria-labelledby', heading.id)
    return () => {
      if (was) dialog.setAttribute('aria-labelledby', was)
      else dialog.removeAttribute('aria-labelledby')
    }
  }, [present])
  // Out again: back on the control that opened it, which is live again in this same commit.
  useLayoutEffect(() => {
    if (present) return
    if (opener?.isConnected && !opener.closest('[inert]')) opener.focus?.({ preventScroll: true })
  }, [present])

  const ctx = useMemo(() => ({ back: panel.locked ? null : back, dismiss, hostLocked }), [panel.locked, back, dismiss, hostLocked])
  const dead = !present || !active
  return (
    <div ref={ref} data-accent={ds ? accent : undefined}
      className={'g-bs-pane g-bs-pane-sub ' + (ds ? 'g-root g-bs-pane-ds' : 'g-bs-pane-legacy')}
      data-pos={!present ? 'leaving' : active ? 'active' : 'under'}
      {...leavingProps(present)} {...(dead ? { inert: true, 'aria-hidden': true } : null)}>
      <SheetPaneContext.Provider value={ctx}>
        {!ds && ctx.back && (
          <div className="g-bs-bar">
            <button type="button" className="g-bs-back" onClick={ctx.back} aria-label={t('Back')}><Icon name="chevronLeft" className="g-icon" /></button>
          </div>
        )}
        {panel.render(closeFn)}
      </SheetPaneContext.Provider>
    </div>
  )
}

export default function SheetPanes({ kind, panels, closeOf, back, dismiss, hostLocked, children }) {
  const panesRef = useRef(null)
  const depth = panels.length
  const depthNow = useRef(depth)
  depthNow.current = depth
  const prevDepth = useRef(0)
  const lastHeight = useRef(0)
  const running = useRef(null)

  // The height the panes had before this commit, which a push or a pop animates from. Kept by an
  // observer rather than read here: by the time a layout effect runs, the first pane has left the
  // flow and the panes have nothing in them to measure.
  useLayoutEffect(() => {
    const panes = panesRef.current
    if (!panes) return
    lastHeight.current = panes.offsetHeight
    if (typeof ResizeObserver !== 'function') return
    const watch = new ResizeObserver(() => { if (!running.current) lastHeight.current = panes.offsetHeight })
    watch.observe(panes)
    return () => watch.disconnect()
  }, [])

  // A panel pushed or popped: the pane under it moves 30% (or comes back) and the drawer's height
  // goes from what it was to what the active pane needs, over the same 260 ms.
  useLayoutEffect(() => {
    const was = prevDepth.current
    prevDepth.current = depth
    const panes = panesRef.current
    if (was === depth || !panes) return
    const nodes = livePanes(panes)
    const under = nodes[depth > was ? was : depth]
    if (under) play(under, depth > was ? PRESETS.panelDeepen : PRESETS.panelSurface, 'enter')

    const active = nodes[depth]
    if (!active || !hugsContent(panes)) return
    const from = lastHeight.current
    const to = naturalHeight(active)
    running.current?.cancel()
    running.current = null
    // Nothing laid out (no real layout engine): leave the height to the flow.
    if (!from || !to) { panes.style.height = ''; return }
    panes.style.height = `${to}px`
    const anim = from === to ? null : play(panes, { enter: { keyframes: [{ height: `${from}px` }, { height: `${to}px` }], ms: PANEL_MS, easing: EASE.ease }, rm: null }, 'enter')
    const settle = () => {
      if (running.current !== anim) return
      running.current = null
      lastHeight.current = panes.offsetHeight
      if (!depthNow.current) panes.style.height = ''
    }
    running.current = anim
    if (anim) anim.finished.then(settle, settle)
    else if (!depth) panes.style.height = ''
  }, [depth])

  // A panel whose content grows (a list that finishes loading) takes the drawer with it.
  const topId = panels[depth - 1]?.id
  useLayoutEffect(() => {
    const panes = panesRef.current
    if (!depth || !panes || typeof ResizeObserver !== 'function' || !hugsContent(panes)) return
    const active = livePanes(panes)[depth]
    if (!active) return
    const watch = new ResizeObserver(() => {
      if (running.current) return
      const to = naturalHeight(active)
      if (to && Math.abs(to - panes.offsetHeight) > 1) panes.style.height = `${to}px`
    })
    for (const part of active.children) watch.observe(part)
    for (const part of active.querySelector('.g-bs-body')?.children || []) watch.observe(part)
    return () => watch.disconnect()
  }, [topId])

  return (
    <div className="g-bs-panes" ref={panesRef} data-deep={depth ? '' : undefined}>
      <div className={`g-bs-pane g-bs-pane-root g-bs-pane-${kind}`} data-pos={depth ? 'under' : 'active'}
        {...(depth ? { inert: true, 'aria-hidden': true } : null)}>
        {children}
      </div>
      <Presence>
        {panels.map((panel, i) => (
          <Pane key={panel.id} panel={panel} active={i === depth - 1} closeFn={closeOf(panel)}
            back={back} dismiss={dismiss} hostLocked={hostLocked} />
        ))}
      </Presence>
    </div>
  )
}
