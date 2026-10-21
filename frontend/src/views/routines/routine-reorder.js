import { useEffect, useRef, useState } from 'react'
import { exOr } from '../../lib/exercises.js'
import { exerciseNameText } from '../../lib/format.js'
import { cleanupSg, supersetUnits } from '../../lib/history.js'
import { t } from '../../lib/i18n.js'
import { markEntryUndone } from '../../lib/sync-merge.js'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'

// The routine editor's reorder and remove, moved here unchanged from views/RoutineEdit.jsx: the
// long press (or a mouse on the handle) that drags a whole superset, and the remove with Undo.

export const ROUTINE_LONG_PRESS_MS = 380
export const ROUTINE_DRAG_SLOP = 8

const clamp = (value, low, high) => Math.max(low, Math.min(high, value))

// Slots are defined after removing the source unit, so a grouped run can never be split.
export function reorderRoutineUnit(exercises, sourceIndex, targetSlot) {
  if (!Array.isArray(exercises) || !exercises.length) return false
  const units = supersetUnits(exercises)
  const sourcePosition = units.findIndex(unit => unit.includes(sourceIndex))
  if (sourcePosition < 0) return false
  const remaining = units.filter((_, position) => position !== sourcePosition)
  const slot = clamp(Number.isFinite(targetSlot) ? Math.trunc(targetSlot) : sourcePosition, 0, remaining.length)
  if (slot === sourcePosition) return false
  const source = units[sourcePosition]
  const moved = exercises.splice(source[0], source.length)
  const insertAt = remaining.slice(0, slot).reduce((count, unit) => count + unit.length, 0)
  exercises.splice(insertAt, 0, ...moved)
  cleanupSg(exercises)
  return true
}

function unitGeometry(list, exercises) {
  const rows = new Map([...list.querySelectorAll('[data-routine-row]')]
    .map(row => [Number(row.dataset.exIndex), row]))
  const units = supersetUnits(exercises)
  const geometry = units.map((unit, position) => {
    const rects = unit.map(index => rows.get(index)?.getBoundingClientRect()).filter(Boolean)
    if (rects.length !== unit.length) return null
    const top = Math.min(...rects.map(rect => rect.top))
    const bottom = Math.max(...rects.map(rect => rect.bottom))
    return { unit, position, top, bottom, center: top + (bottom - top) / 2 }
  })
  return geometry.every(Boolean) ? geometry : null
}

function scrollHostFor(node) {
  for (let parent = node.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
    const overflowY = window.getComputedStyle(parent).overflowY
    if (/(auto|scroll)/.test(overflowY) && parent.scrollHeight > parent.clientHeight) return parent
  }
  return window
}

function autoScrollStep(host, clientY) {
  const edge = 64
  const maxStep = 14
  let top, bottom, scrollTop, maxScroll
  if (host === window) {
    const root = document.scrollingElement || document.documentElement
    top = window.visualViewport?.offsetTop || 0
    bottom = top + (window.visualViewport?.height || window.innerHeight || root.clientHeight)
    scrollTop = window.scrollY || root.scrollTop || 0
    maxScroll = Math.max(root.scrollHeight, document.body?.scrollHeight || 0) - (bottom - top)
  } else {
    const rect = host.getBoundingClientRect()
    top = rect.top; bottom = rect.bottom
    scrollTop = host.scrollTop; maxScroll = host.scrollHeight - host.clientHeight
  }
  if (clientY < top + edge && scrollTop > 0) return -Math.ceil(maxStep * clamp((top + edge - clientY) / edge, 0, 1))
  if (clientY > bottom - edge && scrollTop < maxScroll) return Math.ceil(maxStep * clamp((clientY - bottom + edge) / edge, 0, 1))
  return 0
}

export function useRoutineReorder(routineIdentity, exercises, onDrop) {
  const listRef = useRef(null)
  const gestureRef = useRef(null)
  const exercisesRef = useRef(exercises)
  const routineIdentityRef = useRef(routineIdentity)
  const onDropRef = useRef(onDrop)
  const suppressClickRef = useRef(false)
  const suppressTimerRef = useRef(null)
  const [drag, setDrag] = useState(null)
  exercisesRef.current = exercises
  routineIdentityRef.current = routineIdentity
  onDropRef.current = onDrop
  const hasRows = exercises.length > 0

  useEffect(() => () => {
    suppressClickRef.current = false
    window.clearTimeout(suppressTimerRef.current)
  }, [])

  useEffect(() => {
    const list = listRef.current
    if (!list) return undefined
    let frame = null
    setDrag(current => current ? null : current)

    const clearFrame = () => {
      if (frame != null) window.cancelAnimationFrame(frame)
      frame = null
    }
    const clearTimer = gesture => {
      if (gesture?.timer != null) window.clearTimeout(gesture.timer)
      if (gesture) gesture.timer = null
    }
    const matchesSnapshot = gesture => routineIdentityRef.current === gesture.routineIdentity
      && exercisesRef.current === gesture.listIdentity
      && JSON.stringify(exercisesRef.current) === gesture.snapshot
    const releaseCapture = gesture => {
      const target = gesture?.captureTarget
      if (!target?.releasePointerCapture) return
      try { target.releasePointerCapture(gesture.pointerId) } catch { /* already released */ }
    }
    const finish = (gesture, commit, x = gesture?.lastX, y = gesture?.lastY) => {
      if (!gesture || gestureRef.current !== gesture) return
      clearTimer(gesture)
      clearFrame()
      gestureRef.current = null
      if (!gesture.active) return
      releaseCapture(gesture)
      suppressClickRef.current = true
      window.clearTimeout(suppressTimerRef.current)
      // The compatibility click lands synchronously after pointerup; anything
      // later is a real tap, so the guard only needs to outlive that one event.
      suppressTimerRef.current = window.setTimeout(() => { suppressClickRef.current = false }, 150)
      setDrag(null)
      const rect = list.getBoundingClientRect()
      const inside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
      const geometry = unitGeometry(list, exercisesRef.current)
      if (commit && inside && geometry && matchesSnapshot(gesture) && gesture.targetSlot !== gesture.sourcePosition) {
        onDropRef.current(gesture.sourceIndex, gesture.targetSlot)
      }
    }
    const indicatorTop = (geometry, gesture, slot, listRect) => {
      if (slot === gesture.sourcePosition) return clamp(gesture.sourceTop - listRect.top, 0, listRect.height)
      const remaining = geometry.filter(unit => unit.position !== gesture.sourcePosition)
      let top
      if (slot <= 0) top = remaining[0]?.top ?? gesture.sourceTop
      else if (slot >= remaining.length) top = remaining.at(-1)?.bottom ?? gesture.sourceBottom
      else top = (remaining[slot - 1].bottom + remaining[slot].top) / 2
      return clamp(top - listRect.top, 0, listRect.height)
    }
    const updateDrag = (gesture, x, y, schedule = true) => {
      if (gestureRef.current !== gesture || !gesture.active || !matchesSnapshot(gesture)) {
        if (gestureRef.current === gesture) finish(gesture, false)
        return
      }
      const geometry = unitGeometry(list, exercisesRef.current)
      if (!geometry) { finish(gesture, false); return }
      const listRect = list.getBoundingClientRect()
      const remaining = geometry.filter(unit => unit.position !== gesture.sourcePosition)
      const probeY = clamp(y, listRect.top, listRect.bottom)
      const moved = Math.hypot(x - gesture.startX, y - gesture.startY) > ROUTINE_DRAG_SLOP
      const slot = moved ? remaining.reduce((count, unit) => count + (probeY > unit.center ? 1 : 0), 0) : gesture.sourcePosition
      const rawDelta = y - gesture.grabOffset - gesture.sourceTop
      const deltaY = clamp(rawDelta, listRect.top - gesture.sourceTop, listRect.bottom - gesture.sourceBottom)
      gesture.lastX = x; gesture.lastY = y; gesture.targetSlot = slot
      setDrag({ first: gesture.sourceUnit[0], last: gesture.sourceUnit.at(-1), deltaY, indicatorTop: indicatorTop(geometry, gesture, slot, listRect) })
      if (schedule && frame == null) frame = window.requestAnimationFrame(runAutoScroll)
    }
    function runAutoScroll() {
      frame = null
      const gesture = gestureRef.current
      if (!gesture?.active) return
      const step = autoScrollStep(gesture.scrollHost, gesture.lastY)
      if (!step) return
      if (gesture.scrollHost === window) window.scrollBy(0, step)
      else gesture.scrollHost.scrollTop += step
      updateDrag(gesture, gesture.lastX, gesture.lastY, false)
      if (gestureRef.current === gesture) frame = window.requestAnimationFrame(runAutoScroll)
    }
    const lift = gesture => {
      if (gestureRef.current !== gesture) return
      if (!matchesSnapshot(gesture)) { finish(gesture, false); return }
      const geometry = unitGeometry(list, exercisesRef.current)
      const source = geometry?.find(unit => unit.unit.includes(gesture.sourceIndex))
      if (!source) { finish(gesture, false); return }
      gesture.active = true; gesture.timer = null
      gesture.sourcePosition = source.position; gesture.sourceUnit = source.unit
      gesture.sourceTop = source.top; gesture.sourceBottom = source.bottom
      gesture.grabOffset = gesture.lastY - source.top; gesture.targetSlot = source.position
      gesture.scrollHost = scrollHostFor(list)
      gesture.captureTarget = gesture.downTarget
      try { gesture.captureTarget.setPointerCapture?.(gesture.pointerId) } catch { /* unsupported */ }
      suppressClickRef.current = true
      window.clearTimeout(suppressTimerRef.current)
      updateDrag(gesture, gesture.lastX, gesture.lastY)
    }
    const onPointerDown = event => {
      // a new touch is intentional — never let the post-drop guard eat its click
      suppressClickRef.current = false
      window.clearTimeout(suppressTimerRef.current)
      const current = gestureRef.current
      if (current) {
        if (event.pointerId !== current.pointerId) finish(current, false)
        return
      }
      if (event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0)) return
      const target = event.target
      if (!target?.closest || target.closest('button:not([data-row-open]),a,input,textarea,select,[data-nodrag]')) return
      const row = target.closest('[data-routine-row]')
      if (!row || !list.contains(row)) return
      const sourceIndex = Number(row.dataset.exIndex)
      if (!Number.isInteger(sourceIndex)) return
      const gesture = {
        pointerId: event.pointerId, sourceIndex, downTarget: target,
        startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY,
        routineIdentity: routineIdentityRef.current,
        listIdentity: exercisesRef.current,
        snapshot: JSON.stringify(exercisesRef.current), active: false, timer: null,
      }
      gestureRef.current = gesture
      // The grip, pressed with a mouse, picks the row up at once (#277): the hold exists so a
      // finger can still scroll the list, and a mouse scrolls with its wheel. preventDefault
      // keeps the press from starting a text selection or the row's swipe-to-delete, which
      // listen to the mouse events a pointerdown would otherwise go on to fire.
      if (event.pointerType === 'mouse' && target.closest('[data-drag-handle]')) {
        event.preventDefault()
        lift(gesture)
        return
      }
      gesture.timer = window.setTimeout(() => lift(gesture), ROUTINE_LONG_PRESS_MS)
    }
    const onPointerMove = event => {
      const gesture = gestureRef.current
      if (!gesture || event.pointerId !== gesture.pointerId) return
      if (!gesture.active) {
        if (Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > ROUTINE_DRAG_SLOP) {
          clearTimer(gesture); gestureRef.current = null
        } else { gesture.lastX = event.clientX; gesture.lastY = event.clientY }
        return
      }
      event.preventDefault()
      updateDrag(gesture, event.clientX, event.clientY)
    }
    const onPointerUp = event => {
      const gesture = gestureRef.current
      if (!gesture || event.pointerId !== gesture.pointerId) return
      if (gesture.active) event.preventDefault()
      finish(gesture, gesture.active, event.clientX, event.clientY)
    }
    const onPointerCancel = event => {
      const gesture = gestureRef.current
      if (gesture && event.pointerId === gesture.pointerId) finish(gesture, false)
    }
    const onLostCapture = event => {
      const gesture = gestureRef.current
      if (gesture && event.pointerId === gesture.pointerId) finish(gesture, false)
    }
    const cancelActive = () => finish(gestureRef.current, false)
    const onKeyDown = event => {
      if (event.key !== 'Escape' || !gestureRef.current) return
      event.preventDefault(); cancelActive()
    }
    const onVisibility = () => { if (document.visibilityState === 'hidden') cancelActive() }
    const onContextMenu = event => { if (gestureRef.current?.active && event.target.closest?.('[data-routine-row]')) event.preventDefault() }
    const onDragStart = event => { if (event.target.closest?.('[data-routine-row]')) event.preventDefault() }

    // Touch: the rows keep `touch-action: pan-y` so the list still scrolls with a finger, but once
    // a long-press has lifted a row the browser must not claim the vertical drag as a pan — it
    // would fire pointercancel and scroll instead. preventDefault on a pointer event cannot stop
    // that; only a non-passive touchmove listener can, and only while a drag is actually active.
    const onTouchMove = event => { if (gestureRef.current?.active) event.preventDefault() }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('pointermove', onPointerMove, { passive: false })
    document.addEventListener('pointerup', onPointerUp, { passive: false })
    document.addEventListener('pointercancel', onPointerCancel)
    document.addEventListener('lostpointercapture', onLostCapture)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('visibilitychange', onVisibility)
    list.addEventListener('contextmenu', onContextMenu)
    list.addEventListener('dragstart', onDragStart)
    window.addEventListener('blur', cancelActive)
    return () => {
      const gesture = gestureRef.current
      clearTimer(gesture); clearFrame(); gestureRef.current = null
      releaseCapture(gesture)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
      document.removeEventListener('pointercancel', onPointerCancel)
      document.removeEventListener('lostpointercapture', onLostCapture)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('visibilitychange', onVisibility)
      list.removeEventListener('contextmenu', onContextMenu)
      list.removeEventListener('dragstart', onDragStart)
      window.removeEventListener('blur', cancelActive)
    }
  }, [hasRows, routineIdentity, exercises])

  const onClickCapture = event => {
    if (!suppressClickRef.current) return
    suppressClickRef.current = false
    window.clearTimeout(suppressTimerRef.current)
    event.preventDefault(); event.stopPropagation()
  }
  // Whether a long press has picked a row up: the row's swipe stays out of the way while it has.
  const lifted = () => !!gestureRef.current?.active
  return { listRef, drag, onClickCapture, lifted }
}

/**
 * Takes exercise `i` out of routine `routineId` with an Undo (v1.3.11: the row's swipe and the
 * exercise sheet's Remove). While the routine's exercises are still what the removal left, Undo
 * puts the list back as it was, superset links included (a partner left alone loses its link,
 * cleanupSg). Once something else changed them, the exercise goes back in at its old place.
 */
export function removeRoutineExercise(routineId, i) {
  const st = useStore.getState()
  const routine = st.S.routines.find(x => x.id === routineId)
  const slot = routine?.ex?.[i]
  if (!slot) return false
  const before = structuredClone(routine.ex)
  const base = Number(routine._f?.ex) || 0
  st.update(s => {
    const ex = s.routines.find(x => x.id === routineId)?.ex
    if (!ex) return
    ex.splice(i, 1); cleanupSg(ex)
  })
  const now = useStore.getState().S.routines.find(x => x.id === routineId)
  const after = JSON.stringify(now?.ex)
  const del = Number(now?._f?.ex) || 0
  useUI.getState().toast(t('“{0}” left the routine.', exerciseNameText(exOr(slot.id))),
    { action: t('Undo'), onAction: () => undoRemoveRoutineExercise({ routineId, i, before, after, base, del }) })
  return true
}
export function undoRemoveRoutineExercise({ routineId, i, before, after, base, del }) {
  if (!useStore.getState().S.routines.some(x => x.id === routineId)) {
    useUI.getState().toast(t('Too late, that one’s gone'))
    return false
  }
  useStore.getState().update(s => {
    const routine = s.routines.find(x => x.id === routineId)
    // Put back exactly, so a change another device made to these exercises before it saw the
    // removal still wins (lib/sync-merge.js, "Undo").
    if (JSON.stringify(routine.ex) === after) { routine.ex = structuredClone(before); if (del) markEntryUndone(routine, 'ex', base, del); return }
    routine.ex.splice(Math.min(i, routine.ex.length), 0, structuredClone(before[i]))
    cleanupSg(routine.ex)
  })
  return true
}
