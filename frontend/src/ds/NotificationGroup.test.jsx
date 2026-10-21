// @vitest-environment happy-dom
// NotificationGroup: a small heading over rows in one glass card.
import { describe, expect, it } from 'vitest'
import NotificationGroup from './NotificationGroup.jsx'
import NotificationRow from './NotificationRow.jsx'
import { useView } from './render.test-util.js'

const view = useView()

describe('NotificationGroup', () => {
  it('puts the title as a heading over the rows, in one glass card', () => {
    view.render(
      <NotificationGroup title="This week">
        <NotificationRow kind="streak" title="6 weeks on plan" />
        <NotificationRow kind="recap" title="Your week" />
      </NotificationGroup>,
    )
    expect(view.host.querySelector('h2').textContent).toBe('This week')
    expect(view.host.querySelector('.g-ssec').classList.contains('g-ssec-label')).toBe(true)
    const card = view.host.querySelector('.g-ngroup-card')
    expect(card.classList.contains('g-glass')).toBe(true)
    expect(card.querySelectorAll('.g-nrow')).toHaveLength(2)
  })
})
