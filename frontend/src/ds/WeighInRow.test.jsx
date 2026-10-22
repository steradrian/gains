// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import WeighInRow from './WeighInRow.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()

describe('WeighInRow', () => {
  it('shows the weight, the day and the change tag, and opens on tap', () => {
    const onClick = vi.fn()
    view.render(<WeighInRow weight="81.4 kg" date="Sun 18 Oct · today" change="−0.3 kg" onClick={onClick} />)
    const row = view.host.querySelector('button.g-grow')
    expect(row.querySelector('b').textContent).toBe('81.4 kg')
    expect(row.querySelector('.g-grow-k').textContent).toBe('Sun 18 Oct · today')
    expect([...row.querySelectorAll('.g-tag')].map(t => t.textContent)).toEqual(['−0.3 kg'])
    click(row)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('adds a second tag, with an icon, for a weigh-in waiting to sync', () => {
    view.render(<WeighInRow weight="81.7 kg" date="Sun 11 Oct" change="−0.4 kg" waiting="Waiting to sync" onClick={() => {}} />)
    const tags = [...view.host.querySelectorAll('.g-wir-tags .g-tag')]
    expect(tags.map(t => t.textContent)).toEqual(['−0.4 kg', 'Waiting to sync'])
    expect(tags[1].querySelector('svg')).not.toBeNull()
  })

  it('draws no tags for the first weigh-in', () => {
    view.render(<WeighInRow weight="83.6 kg" date="Sun 6 Sep" onClick={() => {}} />)
    expect(view.host.querySelector('.g-wir-tags')).toBeNull()
  })
})
