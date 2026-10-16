// @vitest-environment happy-dom
// The cascade: every ui-kit.css utility must win on every element the primitives emit, against
// the real index.css. A utility written as one class lost to `h4.sec`, `.sheet h3`, `.card h2`,
// `.item .ss`, `.tag.acc`, `.chip.on` and `.chips.wchips`, and the page silently kept index.css's
// value. Both stylesheets load into happy-dom in the app's order; each utility's computed value
// on each element must equal its value on a bare div.
import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const src = resolve(process.cwd(), 'src')
const read = f => readFileSync(join(src, f), 'utf8')

// Every rule whose selector is one class, however often repeated: `.mb-4.mb-4.mb-4{margin-bottom:…}`
// → { cls: 'mb-4', decls: ['margin-bottom'] }. A new utility written once is caught too.
const utilities = [...read('ui-kit.css').replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(([, selector, body]) => [/^\.((?:\\.|[\w-])+)(?:\.\1)*$/.exec(selector.trim()), body])
  .filter(([m]) => m)
  .map(([m, body]) => ({
    cls: m[1].replace(/\\(.)/g, '$1'),
    decls: body.split(';').map(d => d.split(':')[0].trim()).filter(Boolean),
  }))

const LONGHANDS = { margin: ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'] }
const props = decls => decls.flatMap(d => LONGHANDS[d] || [d])

// The primitives' elements in the context they render in; `T` marks the element under test.
const FIXTURES = {
  'Card': '<div class="card" T></div>',
  'Card h2': '<div class="card"><h2 T>a</h2></div>',
  'Card title row h2': '<div class="card"><div class="row between"><h2 class="m-0" T>a</h2></div></div>',
  'Card title row': '<div class="card"><div class="row between" T><h2 class="m-0">a</h2></div></div>',
  'Card tone': '<div class="card card-danger" T></div>',
  'ItemRow': '<div class="list"><div class="item" T></div></div>',
  'ItemRow .tt': '<div class="item"><div class="grow"><div class="tt" T>a</div></div></div>',
  'ItemRow .ss': '<div class="item"><div class="grow"><div class="ss" T>a</div></div></div>',
  'Tiles': '<div class="tiles" T></div>',
  'StatTile': '<div class="tiles"><div class="tile" T></div></div>',
  'StatTile .l': '<div class="tile"><div class="l" T>a</div></div>',
  'StatTile .v': '<div class="tile"><div class="v" T>1</div></div>',
  'Stat': '<div class="card"><div class="big" T>1</div></div>',
  'Stat unit': '<div class="card"><div class="big">1 <span class="muted stat-unit" T>kg</span></div></div>',
  'EmptyState': '<div class="card"><div class="empty" T></div></div>',
  'EmptyState .ico': '<div class="empty"><div class="ico" T></div></div>',
  'SectionTitle': '<h4 class="sec" T>a</h4>',
  'Tag': '<span class="tag" T>a</span>',
  'Tag acc': '<span class="tag acc" T>a</span>',
  'Tag dim': '<span class="tag dim" T>a</span>',
  'ChipRow': '<div class="chips" T></div>',
  'ChipRow wchips': '<div class="chips wchips" T></div>',
  'Chip': '<div class="chips"><button class="chip" T>a</button></div>',
  'Chip on': '<div class="chips"><button class="chip on" T>a</button></div>',
  'Chip on in wchips': '<div class="chips wchips"><button class="chip nocap on" T>a</button></div>',
  'SheetHeader h3': '<div class="sheet"><h3 T>a</h3></div>',
  'SheetHeader row h3': '<div class="sheet"><div class="row between mb-7"><h3 class="m-0" T>a</h3></div></div>',
  'SheetHeader sub': '<div class="sheet"><div class="muted small" T>a</div></div>',
  'Inline': '<div class="row" T></div>',
  'Inline between': '<div class="card"><div class="row between" T></div></div>',
  'Stack': '<div class="stack" T></div>',
}

beforeAll(() => {
  for (const f of ['index.css', 'ui-kit.css']) {
    const style = document.createElement('style')
    style.textContent = read(f)
    document.head.appendChild(style)
  }
})

// Letter spacing is written in em, so its computed px depends on the font size around it, which
// differs per fixture (happy-dom resolves em against the parent's). Compare it back in em, or a
// utility reads as lost where it won.
const value = (style, parent, p) => {
  const v = style.getPropertyValue(p)
  if (p !== 'letter-spacing' || !v.endsWith('px')) return v
  return `${(parseFloat(v) / parseFloat(parent.fontSize)).toFixed(3)}em`
}

// getComputedStyle is the cost of this file: happy-dom matches every rule of index.css against the
// element on each call (about 25 ms, and one call per utility per fixture is 111 x 32 x 2 calls,
// minutes under load, past the 5 s test timeout). Utilities that set different properties do not
// compete with each other, so they share one element: the utilities are packed into groups with no
// property in common, and each element carries a whole group, on the fixture and on the bare-div
// control alike. That is a dozen calls per fixture, and a utility is still compared with its own
// value on a bare div, with every class on the element that is not the one under test the same on
// both sides.
const overlaps = (a, b) => a === b || a.startsWith(`${b}-`) || b.startsWith(`${a}-`) ||
  (a === 'gap' && b.endsWith('-gap')) || (b === 'gap' && a.endsWith('-gap'))

const groups = []
for (const u of utilities) {
  const ps = props(u.decls)
  const group = groups.find(g => !g.props.some(q => ps.some(p => overlaps(p, q))))
  if (group) { group.utilities.push(u); group.props.push(...ps) } else groups.push({ utilities: [u], props: ps })
}

const computed = (html, group) => {
  const host = document.createElement('div')
  host.innerHTML = html.replace(' T', ' data-t')
  document.body.appendChild(host)
  const el = host.querySelector('[data-t]')
  for (const { cls } of group.utilities) el.classList.add(cls)
  const style = getComputedStyle(el), parent = getComputedStyle(el.parentElement)
  const result = Object.fromEntries(group.utilities.flatMap(({ cls, decls }) =>
    props(decls).map(p => [`${cls} ${p}`, value(style, parent, p)])))
  host.remove()
  return result
}

const controls = new Map()
const control = group => {
  if (!controls.has(group)) controls.set(group, computed('<div T></div>', group))
  return controls.get(group)
}

describe('ui-kit utilities win the cascade', () => {
  it('reads the utilities from ui-kit.css', () => {
    expect(utilities.map(u => u.cls)).toEqual(expect.arrayContaining(['mb-4', 'mt-2.5', 'm-0', 'g-0', 'sp-7', 'ink-danger', 'fs-caption', 'fw-bold', 'ta-center', 'stack', 'ls-12', 'ls-14', 'lh-145', 'lh-150', 'lh-160', 'wrap-anywhere']))
    expect(utilities.length).toBeGreaterThan(70)
  })

  for (const [name, html] of Object.entries(FIXTURES)) {
    it(`on ${name}`, () => {
      const lost = []
      for (const group of groups) {
        const target = computed(html, group)
        for (const [key, want] of Object.entries(control(group))) {
          if (!want) lost.push(`${key}: no computed value on a bare div`)
          else if (target[key] !== want) lost.push(`${key}: ${target[key]} (wants ${want})`)
        }
      }
      expect(lost).toEqual([])
    })
  }
})
