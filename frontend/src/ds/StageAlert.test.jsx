// @vitest-environment happy-dom
// StageAlert: one glass line of bad news that is read out and focused when it appears.
import { describe, expect, it, vi } from 'vitest'
import StageAlert from './StageAlert.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const alert = () => view.host.querySelector('[role="alert"]')

describe('StageAlert', () => {
  it('is an alert holding the message, and takes focus as it mounts', () => {
    view.render(<StageAlert>Your passkey could not be confirmed.</StageAlert>)
    expect(alert().textContent).toBe('Your passkey could not be confirmed.')
    expect(document.activeElement).toBe(alert())
  })

  it('has an action chip only when given one, and it does what it says', () => {
    const onAction = vi.fn()
    view.render(<StageAlert>Nope</StageAlert>)
    expect(alert().querySelector('button')).toBeNull()
    view.render(<StageAlert action="Having trouble?" onAction={onAction}>Nope</StageAlert>)
    click(alert().querySelector('button'))
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(alert().querySelector('button').textContent).toBe('Having trouble?')
  })

  it('is a link when the action has somewhere to go', () => {
    view.render(<StageAlert action="Help" actionHref="#/help">Nope</StageAlert>)
    expect(alert().querySelector('a').getAttribute('href')).toBe('#/help')
  })

  it('a second failure, keyed anew, is a new element and takes focus again', () => {
    view.render(<StageAlert key={1}>First</StageAlert>)
    const first = alert()
    document.activeElement.blur()
    view.render(<StageAlert key={2}>Second</StageAlert>)
    expect(alert()).not.toBe(first)
    expect(document.activeElement).toBe(alert())
  })
})
