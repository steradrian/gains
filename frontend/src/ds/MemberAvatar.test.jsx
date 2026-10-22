// @vitest-environment happy-dom
// MemberAvatar: an initial in a circle; decoration unless it is named.
import { describe, expect, it } from 'vitest'
import MemberAvatar, { MEMBER_TONES, memberTone } from './MemberAvatar.jsx'
import { useView } from './render.test-util.js'

const view = useView()
const el = () => view.host.querySelector('.g-mavatar')

describe('MemberAvatar', () => {
  it('shows the first letter, upper case, and hides from a screen reader without a label', () => {
    view.render(<MemberAvatar initial="mara" />)
    expect(el().textContent).toBe('M')
    expect(el().getAttribute('aria-hidden')).toBe('true')
    expect(el().getAttribute('role')).toBeNull()
  })

  it('with a label it is an image named by it', () => {
    view.render(<MemberAvatar initial="M" label="Mara" />)
    expect(el().getAttribute('role')).toBe('img')
    expect(el().getAttribute('aria-label')).toBe('Mara')
    expect(el().getAttribute('aria-hidden')).toBeNull()
  })

  it('takes a size and a tone as classes', () => {
    view.render(<MemberAvatar initial="R" size="lg" tone="purple" />)
    expect(el().classList.contains('g-mavatar-lg')).toBe(true)
    expect(el().classList.contains('g-mtone-purple')).toBe(true)
  })

  it('has no red among its tones, and gives each joined position the same colour every time', () => {
    expect(MEMBER_TONES.some(tone => /red|pink|danger/.test(tone))).toBe(false)
    expect([0, 1, 2, 3, 4, 5].map(memberTone)).toEqual(['mint', 'blue', 'purple', 'orange', 'green', 'mint'])
    expect(memberTone(2)).toBe(memberTone(2))
  })

  it('refuses a tone it has no class for in development', () => {
    expect(() => view.render(<MemberAvatar initial="A" tone="red" />)).toThrow(/tone/)
  })
})
