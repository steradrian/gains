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

  it('the page being left keeps every layout rule #app gave it, so its content does not move', () => {
    const read = f => readFileSync(join(src, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    for (const file of ['index.css', 'tab-shell.css']) {
      for (const r of rules(read(file))) {
        if (!/padding|max-width|margin/.test(r.body)) continue
        for (const s of r.selectors) {
          if (/(^|[\s>])#app(?![\w-])/.test(s.replace(/:is\(#app,\.app-out\)/g, '')) && !/\.vfade/.test(s) && !r.selectors.some(o => o.includes('.app-out'))) {
            throw new Error(file + ': ' + s + ' lays out #app but not the page being left')
          }
        }
      }
    }
  })

  it('both layers are fixed to the same box from the first frame, and the incoming one fades in linearly', () => {
    const layer = ruleFor('.g-route[data-slide]')
    expect(layer).toMatch(/position:\s*fixed/)
    expect(layer).toMatch(/inset:\s*0/)
    expect(ruleFor('.g-route[data-slide] > div')).toMatch(/margin-top:\s*calc\(-1 \* var\(--route-y, 0px\)\)/)
    expect(ruleFor('.g-route[data-slide="push"][data-route="in"]')).toMatch(/g-route-fade-in var\(--route-ms\) linear/)
  })

  it('the shared stage shows: the body\'s ground steps aside, and the stage carries the art', () => {
    expect(ds).toMatch(/body:has\(\.g-route\[data-shared\] \.g-stage\) \{ background: transparent; \}/)
    expect(ruleFor('.g-app-stage')).toMatch(/position:\s*fixed/)
    expect(ruleFor('.g-app-stage')).toMatch(/z-index:\s*-1/)
  })

  it('reduced motion is an opacity cross-fade and nothing else', () => {
    const a = ruleFor(':root .g-route[data-slide="fade"][data-route="in"]')
    const b = ruleFor(':root .g-route[data-slide="fade"][data-route="out"]')
    expect(a).toMatch(/g-route-fade-in/)
    expect(b).toMatch(/g-route-fade-out/)
    expect(a + b).not.toMatch(/g-route-(enter|under|leave|back)/)
  })
})
