// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import CompareView from './CompareView.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()

const side = (date, caption, over = {}) => ({ image: <img src="x" alt={date} />, date, caption, changeLabel: 'Change', onChange: () => {}, ...over })

describe('CompareView', () => {
  it('shows two captioned pictures, left to right whatever the language, and the change line', () => {
    view.render(<CompareView before={side('Sun 2 Aug', '85 kg')} after={side('Sun 18 Oct', '81.4 kg')} line="77 days apart · -3.6 kg" />)
    expect(view.host.querySelector('.g-cmp-pair').getAttribute('dir')).toBe('ltr')
    const sides = [...view.host.querySelectorAll('figure')]
    expect(sides.map(f => f.querySelector('figcaption').textContent)).toEqual(['Sun 2 Aug85 kg', 'Sun 18 Oct81.4 kg'])
    expect(sides.map(f => f.querySelector('img').alt)).toEqual(['Sun 2 Aug', 'Sun 18 Oct'])
    expect(view.host.querySelector('.g-cmp-line').textContent).toBe('77 days apart · -3.6 kg')
  })

  it('leaves out a missing weight and a missing line', () => {
    view.render(<CompareView before={side('Sun 2 Aug')} after={side('Sun 18 Oct')} />)
    expect(view.host.querySelectorAll('figcaption span')).toHaveLength(0)
    expect(view.host.querySelector('.g-cmp-line')).toBeNull()
  })

  it('gives each side its own change button', () => {
    const onBefore = vi.fn(), onAfter = vi.fn()
    view.render(<CompareView before={side('a', null, { changeLabel: 'Change before', onChange: onBefore })} after={side('b', null, { changeLabel: 'Change after', onChange: onAfter })} />)
    const buttons = [...view.host.querySelectorAll('figure button')]
    expect(buttons.map(b => b.textContent)).toEqual(['Change before', 'Change after'])
    click(buttons[1])
    expect(onAfter).toHaveBeenCalledTimes(1)
    expect(onBefore).not.toHaveBeenCalled()
  })
})
