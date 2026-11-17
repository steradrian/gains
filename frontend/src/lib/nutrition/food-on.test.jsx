// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useStore } from '../../store/useStore.js'
import { foodOn, foodOnNow, useFoodOn } from './food-on.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

/* One answer for "does Food show": the hub reachable (web app, signed in) and the Features switch
   not off. Turning it off hides every surface that reads it and deletes nothing; turning it back
   on restores them with the same data. */
const USER = { id: 'u1', name: 'Ana' }
let host, root, seen
function Probe() { seen.push(useFoodOn()); return null }
const lastSeen = () => seen.at(-1)

beforeEach(() => {
  seen = []
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('foodOn', () => {
  it('needs a signed-in web app and the switch not off; a profile saved before the switch reads as on', () => {
    expect(foodOn(USER, {})).toBe(true)
    expect(foodOn(USER, { trackFood: true })).toBe(true)
    expect(foodOn(USER, { trackFood: false })).toBe(false)
    expect(foodOn(null, { trackFood: true })).toBe(false)
  })

  it('the switch follows the store: off hides at once, on brings it back, and the data is not touched', () => {
    const workouts = [{ id: 'w1' }]
    const diary = { meals: ['kept'] }
    useStore.setState({ user: USER, S: { ...useStore.getState().S, trackFood: true, workouts, diary } })
    act(() => root.render(<Probe />))
    expect(lastSeen()).toBe(true)
    expect(foodOnNow()).toBe(true)

    act(() => useStore.setState({ S: { ...useStore.getState().S, trackFood: false } }))
    expect(lastSeen()).toBe(false)
    expect(foodOnNow()).toBe(false)
    expect(useStore.getState().S.diary).toBe(diary)
    expect(useStore.getState().S.workouts).toBe(workouts)

    act(() => useStore.setState({ S: { ...useStore.getState().S, trackFood: true } }))
    expect(lastSeen()).toBe(true)
    expect(useStore.getState().S.diary).toBe(diary)
  })
})
