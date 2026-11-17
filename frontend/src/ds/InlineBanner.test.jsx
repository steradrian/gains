// @vitest-environment happy-dom
// InlineBanner: a notice with a title and a line under it; an alert for what just went wrong.
import { describe, expect, it, vi } from 'vitest'
import InlineBanner from './InlineBanner.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const banner = () => view.host.firstElementChild

describe('InlineBanner', () => {
  it('is a status notice by default and takes no focus', () => {
    view.render(<InlineBanner title="Rest day" body="Back on Thursday" />)
    expect(banner().getAttribute('role')).toBe('status')
    expect(banner().hasAttribute('tabindex')).toBe(false)
    expect(document.activeElement).not.toBe(banner())
    expect(banner().textContent).toBe('Rest dayBack on Thursday')
  })

  it('as an alert it is focused as it mounts, so it is read out', () => {
    view.render(<InlineBanner role="alert" tone="warning" title="Wrong name, e-mail or password." />)
    expect(banner().getAttribute('role')).toBe('alert')
    expect(document.activeElement).toBe(banner())
    expect(banner().classList.contains('g-ibanner-warning')).toBe(true)
  })

  it('a title alone has no line under it', () => {
    view.render(<InlineBanner title="This account has been disabled." />)
    expect(banner().querySelector('.g-ibanner-body span')).toBeNull()
  })

  it('on the stage its buttons are glass, except the solid one', () => {
    view.render(<InlineBanner stage title="Offline" actions={[{ label: 'Retry', onClick: () => {} }, { label: 'Sign in', solid: true, onClick: () => {} }]} />)
    const [retry, solid] = [...view.host.querySelectorAll('.g-ibanner-btn')]
    expect(retry.classList.contains('g-glass')).toBe(true)
    expect(solid.classList.contains('g-glass')).toBe(false)
    view.render(<InlineBanner title="Offline" actions={[{ label: 'Retry', onClick: () => {} }]} />)
    expect(view.host.querySelector('.g-ibanner-btn').classList.contains('g-glass')).toBe(false)
  })

  it('on the stage it is glass, not a tone', () => {
    view.render(<InlineBanner stage title="That code didn’t work" />)
    expect(banner().classList.contains('g-glass')).toBe(true)
    expect(banner().className).not.toMatch(/g-ibanner-accent/)
  })

  it('has actions only when given them', () => {
    const onClick = vi.fn()
    view.render(<InlineBanner title="Plan ready" />)
    expect(banner().querySelector('button')).toBeNull()
    view.render(<InlineBanner title="Plan ready" actions={[{ label: 'Review', solid: true, onClick }]} />)
    click(banner().querySelector('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('on the stage it holds a solid button and a link side by side (notifications off, Sh3PermOff)', () => {
    const turnOn = vi.fn()
    view.render(
      <InlineBanner stage icon="bellSlash" title="Notifications are off on this phone" body="They still land here, but your phone won’t buzz."
        actions={[{ label: 'Turn on', solid: true, onClick: turnOn }, { label: 'Reminders', href: '#/me/reminders' }]} />,
    )
    const [on, reminders] = [...banner().querySelectorAll('.g-ibanner-btn')]
    expect([on.tagName, on.classList.contains('g-ibanner-solid')]).toEqual(['BUTTON', true])
    expect([reminders.tagName, reminders.getAttribute('href'), reminders.classList.contains('g-ibanner-solid')]).toEqual(['A', '#/me/reminders', false])
    click(on)
    expect(turnOn).toHaveBeenCalledTimes(1)
  })

  it('refuses a tone the design system does not have, in development', () => {
    expect(() => view.render(<InlineBanner tone="loud" title="x" />)).toThrow(/tone="loud"/)
  })
})
