// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import MenuList from './MenuList.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const items = () => [...view.host.querySelectorAll('.g-menuitem')]

describe('MenuList', () => {
  it('is a named menu of items: glyph, label, detail and value', () => {
    const onKcal = vi.fn()
    view.render(<MenuList label="More" items={[
      { icon: 'bolt', label: 'Quick kcal', onClick: onKcal },
      { icon: 'timer', label: 'Fast', detail: 'Your last plan', value: '16 h', ariaLabel: 'Start a 16 hour fast' },
      { icon: 'trash', label: 'Delete', tone: 'danger' },
    ]} />)
    const menu = view.host.querySelector('.g-menulist')
    expect(menu.getAttribute('role')).toBe('menu')
    expect(menu.getAttribute('aria-label')).toBe('More')
    expect(items().map(b => b.getAttribute('role'))).toEqual(['menuitem', 'menuitem', 'menuitem'])
    expect(items()[0].querySelector('b').textContent).toBe('Quick kcal')
    expect(items()[1].querySelector('.g-menuitem-body span').textContent).toBe('Your last plan')
    expect(items()[1].querySelector('.g-menuitem-value').textContent).toBe('16 h')
    expect(items()[1].getAttribute('aria-label')).toBe('Start a 16 hour fast')
    expect(items()[2].classList.contains('g-menuitem-danger')).toBe(true)
    click(items()[0])
    expect(onKcal).toHaveBeenCalledOnce()
  })

  it('a busy item takes no tap', () => {
    const onClick = vi.fn()
    view.render(<MenuList items={[{ label: 'Water', value: '500 ml', onClick, disabled: true }]} />)
    click(items()[0])
    expect(onClick).not.toHaveBeenCalled()
  })
})
