// @vitest-environment happy-dom
import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import StagePageTitle from './StagePageTitle.jsx'
import { useView } from './render.test-util.js'

const view = useView()

describe('StagePageTitle', () => {
  it('is the page\'s h1, focusable from code, with its line under it', () => {
    const ref = createRef()
    view.render(<StagePageTitle ref={ref} title="Notifications" line="Streaks and new bests" />)
    const h1 = view.host.querySelector('.g-sptitle h1')
    expect(h1.textContent).toBe('Notifications')
    expect(h1.getAttribute('tabindex')).toBe('-1')
    expect(ref.current).toBe(h1)
    expect(view.host.querySelector('.g-sptitle p').textContent).toBe('Streaks and new bests')
  })

  it('draws no line without one', () => {
    view.render(<StagePageTitle title="Notifications" />)
    expect(view.host.querySelector('.g-sptitle p')).toBeNull()
  })
})
