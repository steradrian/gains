// The page slide as CSS: a layer is transparent and only its content moves over the app's shared
// stage; the outgoing content is gone by 60% of the slide, the incoming one fades over all of it;
// reduced motion is an opacity cross-fade alone.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SLIDE_MS } from './lib/route-transition.js'

const src = resolve(process.cwd(), 'src')
const ds = readFileSync(join(src, 'ds/ds.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const rules = css => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({ selectors: selector.split(',').map(s => s.trim()), body }))
const ruleFor = sel => rules(ds).filter(r => r.selectors.includes(sel)).map(r => r.body).join(';')
const frames = name => ds.match(new RegExp('@keyframes ' + name + '\\s*\\{(.*)\\}\\s*(?=@keyframes|\\.|:|$)', 'm'))?.[0] ?? ''

describe('page slide CSS', () => {
  it('lasts as long as the script waits for it, on the iOS sheet curve', () => {
    expect(SLIDE_MS).toBe(400)
    expect(ruleFor('.g-route')).toMatch(/--route-ms:\s*400ms/)
    expect(ruleFor('.g-route')).toMatch(/cubic-bezier\(\.32, \.72, 0, 1\)/)
  })

  it('a sliding layer paints no ground: the stage under it is the shared one', () => {
    const layer = ruleFor('.g-route[data-slide]')
    expect(layer).not.toMatch(/background/)
    expect(layer).not.toMatch(/box-shadow|backdrop-filter/)
    expect(ds).not.toMatch(/\.g-route[^{]*::after/)
    expect(ruleFor('.g-route[data-shared] .g-stage')).toMatch(/background:\s*transparent/)
    expect(ruleFor('.g-route[data-shared] .g-stage-art')).toMatch(/display:\s*none/)
  })

  it('the outgoing content fades out in 60% of the slide, the incoming one fades in over all of it', () => {
    expect(ruleFor('.g-route[data-slide="push"][data-route="out"]')).toMatch(/g-route-fade-out calc\(var\(--route-ms\) \* \.6\)/)
    expect(ruleFor('.g-route[data-slide="pop"][data-route="out"]')).toMatch(/g-route-fade-out calc\(var\(--route-ms\) \* \.6\)/)
    expect(ruleFor('.g-route[data-slide="push"][data-route="in"]')).toMatch(/g-route-fade-in var\(--route-ms\)/)
    expect(ruleFor('.g-route[data-slide="pop"][data-route="in"]')).toMatch(/g-route-fade-in var\(--route-ms\)/)
    expect(frames('g-route-under')).toMatch(/-30%/)
  })

  it('reduced motion is an opacity cross-fade and nothing else', () => {
    const a = ruleFor(':root .g-route[data-slide="fade"][data-route="in"]')
    const b = ruleFor(':root .g-route[data-slide="fade"][data-route="out"]')
    expect(a).toMatch(/g-route-fade-in/)
    expect(b).toMatch(/g-route-fade-out/)
    expect(a + b).not.toMatch(/g-route-(enter|under|leave|back)/)
  })
})
