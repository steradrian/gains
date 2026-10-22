// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GROUPS_ROW, GOAL_READY, S_NEW, S_REACHED, meProps } from '../../dev/screens/states/me-fixture.js'
import { ME_ROW_SLOTS } from './root-rows.js'
import MeScreen from './MeScreen.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host, root
const draw = async props => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => { root.render(<MeScreen {...meProps(props)} {...(props?.over || {})} />) })
  return host
}
afterEach(() => { act(() => root?.unmount()); host?.remove() })

describe('MeScreen', () => {
  it('draws the rings, the four actions, My goal, You and the muscles card', async () => {
    const h = await draw()
    expect([...h.querySelectorAll('.g-gact')].map(b => b.textContent)).toEqual(['Log weight', 'Measure', 'Photo', 'Invite'])
    expect(h.querySelectorAll('.g-rc-slide')).toHaveLength(3)
    expect(h.textContent).toContain('Lose weight · about 0.4 kg a week')
    expect(h.textContent).toContain('2 joined · 1 waiting')
    expect(h.querySelector('.g-mcard')).not.toBeNull()
    expect(h.querySelector('.me-foot').textContent).toBe('Settings, reminders and your account are behind your avatar.')
  })

  it('hides the muscles card until a workout is logged and shows the new-account lines', async () => {
    const h = await draw({ S: S_NEW, days: null, invites: null, changeCount: 0, muscles: null, bodyLogged: false })
    expect(h.querySelector('.g-mcard')).toBeNull()
    expect(h.textContent).toContain('Log your first weigh-in')
    expect(h.textContent).toContain('Set your target weight')
    expect(h.textContent).toContain('Nothing in the last 7 days')
  })

  it('puts a slot row last in You with its New tag', async () => {
    const h = await draw({ slots: { you: [GROUPS_ROW] } })
    const rows = [...h.querySelectorAll('.g-glist-row')]
    expect(rows.at(-1).querySelector('b').textContent).toBe('Groups')
    expect(rows.at(-1).querySelector('.g-tag').textContent).toBe('New')
    expect(ME_ROW_SLOTS.you.map(r => r.id)).toEqual(['groups'])
  })

  it('offers Keep my weight when the target is reached, and runs it', async () => {
    const onKeep = vi.fn()
    const h = await draw({ S: S_REACHED, goal: GOAL_READY, over: { onKeep } })
    expect(h.textContent).toContain('Target reached')
    const keep = [...h.querySelectorAll('button')].find(b => b.textContent === 'Keep my weight')
    await act(async () => { keep.click() })
    expect(onKeep).toHaveBeenCalledOnce()
  })

  it('opens a row, the goal card and an action', async () => {
    const onRow = vi.fn(), onGoal = vi.fn(), onAction = vi.fn()
    const h = await draw({ over: { onRow, onGoal, onAction } })
    await act(async () => { [...h.querySelectorAll('.g-glist-row')][0].click() })
    expect(onRow).toHaveBeenCalledWith(expect.objectContaining({ id: 'body' }))
    await act(async () => { h.querySelector('.g-gact').click() })
    expect(onAction).toHaveBeenCalledWith('weight')
    await act(async () => { [...h.querySelectorAll('.g-grow')].find(r => r.textContent.includes('Lose weight')).click() })
    expect(onGoal).toHaveBeenCalled()
  })

  it('shows a skeleton for My goal while NutriTrace loads', async () => {
    const h = await draw({ goal: { status: 'loading', profile: {} } })
    expect(h.querySelector('.me-goal-sk')).not.toBeNull()
  })
})
