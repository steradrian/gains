// @vitest-environment happy-dom
// The Background page's tiles share one WebGL context (review 10), lost when the last tile goes.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useView } from './render.test-util.js'

const renderer = { draw: vi.fn(), dispose: vi.fn() }
vi.mock('../lib/stage-look/renderer.js', () => ({ createRenderer: vi.fn(() => renderer) }))

const { default: LookTile } = await import('./LookTile.jsx')
const { createRenderer } = await import('../lib/stage-look/renderer.js')
const view = useView()

afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks() })

describe('LookTile shared context', () => {
  it('five tiles make one renderer, and it is disposed after the last one unmounts', async () => {
    const loseContext = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(type => (
      type === '2d' ? { drawImage: vi.fn() } : { getExtension: () => ({ loseContext }) }
    ))
    const looks = ['aurora', 'bloom', 'silk', 'lines', 'linen']
    await view.render(<div>{looks.map(l => <LookTile key={l} look={l} accent="cobalt" label={l} onSelect={() => {}} />)}</div>)
    expect(createRenderer).toHaveBeenCalledTimes(1)
    expect(renderer.draw).toHaveBeenCalledTimes(5)
    expect(renderer.dispose).not.toHaveBeenCalled()
    await view.render(<div />)
    expect(renderer.dispose).toHaveBeenCalledTimes(1)
    expect(loseContext).toHaveBeenCalledTimes(1)
  })
})
