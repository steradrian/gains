// @vitest-environment happy-dom
// The New challenge drawer (Fr3New): the Everyone-trains template and This week are chosen, the
// body carries the picked template and length, Start closes the drawer's history entry before the
// new challenge's page opens, three running challenges say why and cannot start a fourth, and the
// server's own refusal is toasted.
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { click, useView } from '../ds/render.test-util.js'
import { FriendsError } from '../lib/friends/api.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({
  openSheet: vi.fn(), toast: vi.fn(), createChallenge: vi.fn(), closeThen: vi.fn(), nav: vi.fn(), group: { current: null },
}))
vi.mock('../store/useUI.js', () => ({ useUI: { getState: () => ({ openSheet: mocks.openSheet, toast: mocks.toast }) } }))
vi.mock('../lib/friends/api.js', async importActual => ({ ...(await importActual()), createChallenge: (...a) => mocks.createChallenge(...a) }))
vi.mock('../lib/friends/use-group.js', () => ({ useGroupSnapshot: () => ({ group: mocks.group.current }) }))
vi.mock('../lib/nav.js', () => ({ closeThen: (...a) => mocks.closeThen(...a), nav: (...a) => mocks.nav(...a) }))

import { newChallengeSheet } from './NewChallengeSheet.jsx'

const view = useView()
const close = vi.fn()
const radio = text => [...view.host.querySelectorAll('[role="radio"]')].find(r => r.textContent.startsWith(text))
const pressed = text => [...view.host.querySelectorAll('.g-seg button')].find(b => b.textContent === text)
const startButton = () => [...view.host.querySelectorAll('button')].find(b => b.textContent === 'Start challenge')
const start = async () => { await act(async () => { startButton().click() }) }
const open = group => {
  mocks.group.current = group
  newChallengeSheet('g1')
  view.render(mocks.openSheet.mock.calls.at(-1)[0](close))
}
const running = n => Array.from({ length: n }, (_, i) => ({ id: 'c' + i, state: 'active' }))

beforeEach(() => {
  for (const f of [mocks.openSheet, mocks.toast, mocks.createChallenge, mocks.closeThen, mocks.nav, close]) f.mockReset()
  mocks.closeThen.mockImplementation((c, go) => go(true))
})

describe('the New challenge drawer', () => {
  it('is a plain ds sheet with the four templates, what each counts, and the explanation', () => {
    open({ challenges: [] })
    expect(mocks.openSheet.mock.calls[0][1]).toEqual({ variant: 'ds' })
    expect([...view.host.querySelectorAll('[role="radio"]')].map(r => r.textContent)).toEqual([
      'Everyone trains 3× this weekCounts finished workouts',
      'Protein target 5 of 7 daysCounts days each of you reached it',
      'Weekend movingAn activity or a workout on Saturday and Sunday',
      'Each of us beats one bestAny new best set, shared or not',
    ])
    expect(view.host.textContent).toContain('Everyone gets an invite to join. Nobody is added without saying yes, and there are no winners: you all fill one bar.')
  })

  it('starts on Everyone trains and This week, and a tap moves the choice', () => {
    open({ challenges: [] })
    expect(radio('Everyone trains').getAttribute('aria-checked')).toBe('true')
    expect(pressed('This week').getAttribute('aria-pressed')).toBe('true')
    click(radio('Weekend moving'))
    expect(radio('Weekend moving').getAttribute('aria-checked')).toBe('true')
    expect(radio('Everyone trains').getAttribute('aria-checked')).toBe('false')
    click(pressed('This month'))
    expect(pressed('This month').getAttribute('aria-pressed')).toBe('true')
  })

  it('sends the template and the span, defaults included', async () => {
    mocks.createChallenge.mockResolvedValue({ id: 'c9' })
    open({ challenges: [] })
    await start()
    expect(mocks.createChallenge).toHaveBeenCalledWith('g1', { template: 'workouts', span: 'week' })
  })

  it('sends what was picked', async () => {
    mocks.createChallenge.mockResolvedValue({ id: 'c9' })
    open({ challenges: [] })
    click(radio('Protein target'))
    click(pressed('2 weeks'))
    await start()
    expect(mocks.createChallenge).toHaveBeenCalledWith('g1', { template: 'protein', span: 'twoWeeks' })
  })

  it('closes its history entry first and then opens the new challenge', async () => {
    mocks.createChallenge.mockResolvedValue({ id: 'c9' })
    open({ challenges: [] })
    await start()
    expect(mocks.closeThen).toHaveBeenCalledWith(close, expect.any(Function))
    expect(mocks.nav).toHaveBeenCalledWith('/me/groups/g1/challenge/c9', { replace: true })
    expect(mocks.closeThen.mock.invocationCallOrder[0]).toBeLessThan(mocks.nav.mock.invocationCallOrder[0])
  })

  it('with three running says why in one line and starts nothing', async () => {
    open({ challenges: running(3) })
    expect(view.host.textContent).toContain('This group already has 3 challenges running. Wait for one to finish.')
    expect(startButton().disabled).toBe(true)
    await start()
    expect(mocks.createChallenge).not.toHaveBeenCalled()
  })

  it('counts only the running ones: a finished challenge leaves room', () => {
    open({ challenges: [...running(2), { id: 'old', state: 'done' }, { id: 'older', state: 'missed' }] })
    expect(view.host.textContent).not.toContain('already has 3 challenges')
    expect(startButton().disabled).toBe(false)
  })

  it('toasts the server\'s challenge-limit when the page was out of date, and stays', async () => {
    mocks.createChallenge.mockRejectedValue(new FriendsError('x', { code: 'challenge-limit', status: 409 }))
    open({ challenges: [] })
    await start()
    expect(mocks.toast).toHaveBeenCalledWith('This group already has 3 challenges running. Wait for one to finish.')
    expect(mocks.closeThen).not.toHaveBeenCalled()
    expect(startButton().disabled).toBe(false)
  })

  it('opens before the group is known: nothing counted, Start is on', () => {
    open(null)
    expect(startButton().disabled).toBe(false)
  })
})
