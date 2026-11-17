// @vitest-environment happy-dom
// SettingsPage: the frame of a Settings page. The title is the page's h1, Back goes to the parent.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { back } from '../../lib/use-tab-nav.js'
import SettingsPage from './SettingsPage.jsx'

vi.mock('../../lib/use-tab-nav.js', () => ({ back: vi.fn() }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host, root
beforeEach(() => { back.mockClear(); host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host) })
afterEach(() => { act(() => root.unmount()); host.remove() })

const render = el => act(() => root.render(el))

describe('SettingsPage', () => {
  it('names the page with its one h1, the line under it, and draws the children', () => {
    render(<SettingsPage title="Units" line="Weights and language"><p>body</p></SettingsPage>)
    const h1 = host.querySelectorAll('h1')
    expect(h1).toHaveLength(1)
    expect(h1[0].textContent).toBe('Units')
    expect(host.querySelector('.g-sptitle p').textContent).toBe('Weights and language')
    expect(host.textContent).toContain('body')
  })

  it('Back goes to Settings by default, or to the parent it is given', () => {
    render(<SettingsPage title="Units" />)
    act(() => { host.querySelector('.g-snav-back').click() })
    expect(back).toHaveBeenLastCalledWith('/me/settings')
    render(<SettingsPage title="Delete account" parent="/me/account" />)
    act(() => { host.querySelector('.g-snav-back').click() })
    expect(back).toHaveBeenLastCalledWith('/me/account')
  })

  it('draws the actions in the nav bar', () => {
    const onClick = vi.fn()
    render(<SettingsPage title="Units" actions={[{ icon: 'gear', label: 'Open settings', onClick }]} />)
    act(() => { host.querySelector('button[aria-label="Open settings"]').click() })
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
