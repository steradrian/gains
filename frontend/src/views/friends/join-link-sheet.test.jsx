// @vitest-environment happy-dom
// The paste-link sheet on Groups: a full link or a bare code opens the join page; junk says so and
// goes nowhere. Opened with a plain openSheet.
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type, useView } from '../../ds/render.test-util.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({ openSheet: vi.fn(), closeThenNav: vi.fn() }))
vi.mock('../../store/useUI.js', () => ({ useUI: { getState: () => ({ openSheet: mocks.openSheet }) } }))
vi.mock('../../lib/nav.js', () => ({ closeThenNav: (...a) => mocks.closeThenNav(...a) }))

import { joinLinkSheet } from './join-link-sheet.jsx'

const view = useView()
const close = vi.fn()
const field = () => view.host.querySelector('input')
const form = () => view.host.querySelector('form')
const submit = () => act(() => { form().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })

beforeEach(() => {
  mocks.openSheet.mockReset()
  mocks.closeThenNav.mockReset()
  close.mockReset()
  joinLinkSheet()
  view.render(mocks.openSheet.mock.calls[0][0](close))
})

describe('the paste-link sheet', () => {
  it('is a plain ds sheet', () => {
    expect(mocks.openSheet.mock.calls[0][1]).toEqual({ variant: 'ds' })
    expect(view.host.querySelector('h2').textContent).toBe('Join with an invite link')
    expect(form().querySelector('button[type="submit"]').disabled).toBe(true)
  })

  it('a full group link opens the join page for its code, taking the drawer with it', () => {
    type(field(), 'https://gains.example.com/g/k7Qp9x2Lm')
    submit()
    expect(mocks.closeThenNav).toHaveBeenCalledWith(close, '/me/groups/join/k7Qp9x2Lm')
  })

  it('a bare code does the same', () => {
    type(field(), '  k7Qp9x2Lm ')
    submit()
    expect(mocks.closeThenNav).toHaveBeenCalledWith(close, '/me/groups/join/k7Qp9x2Lm')
  })

  it('junk says so and goes nowhere; typing again clears the message', () => {
    type(field(), 'not a link')
    submit()
    expect(mocks.closeThenNav).not.toHaveBeenCalled()
    expect(view.host.textContent).toContain("That doesn't look like a group link")
    expect(field().getAttribute('aria-invalid')).toBe('true')
    type(field(), 'k7Qp9x2Lm')
    expect(view.host.textContent).not.toContain("That doesn't look like a group link")
  })
})
