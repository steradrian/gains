// The UI guards: a ratchet on the markup and styling the UI kit replaces (components/layout.jsx,
// blocks.jsx, sheet-layout.jsx, ui-kit.css; see components/README-ui-kit.md). Like
// page-width.test.js they read the sources. Each file's count must equal its entry in
// src/ui-guards.baseline.json: above it is a regression (a file the baseline lacks starts at 0),
// below it is a migration that lowers its entry in the same PR with
// `node scripts/ui-guards-baseline.mjs`. Never regenerate the baseline to turn a rise green.
import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  BASELINE, EMPTY_PROPS, HEADER_FILES, LEGACY_CSS, LOWER, PAGE_EXEMPT, PRIMITIVE_FILES, cssColours, cssFiles, emptyStates, handBuilt,
  jsColours, measure, newCssViolations, pageChrome, ratchet, routeViewsWithoutPage, sheetsImporters, staticStyles,
} from '../scripts/ui-guards-baseline.mjs'

const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'))
const now = measure()

describe('UI guards (ratchet)', () => {
  it('G1: no file changes its literal inline style properties; use Stack, Inline, Spacer, mb-N, .ink-*', () => {
    expect(ratchet(now.G1, baseline.G1)).toEqual([])
  })

  it('G2: no legacy stylesheet changes its colours outside the theme :root rules', () => {
    expect(ratchet(now.G2css, baseline.G2css)).toEqual([])
  })

  it('G2: no source file changes its colour literals; use a token', () => {
    expect(ratchet(now.G2js, baseline.G2js)).toEqual([])
  })

  it('G3: no file changes its hand-built .card/.item/.tile(s)/.empty/.lrow/.tag/.chip(s)/.big/.row/h4.sec/h3 markup; use the primitive', () => {
    expect(ratchet(now.G3, baseline.G3)).toEqual([])
  })

  it('G4: every routed view renders <Page>, other than the baselined ones and the full-screen views', () => {
    expect(ratchet(now.G4, baseline.G4)).toEqual([])
  })

  it('G6: nothing outside sheets.jsx and src/sheets/ imports src/sheets/* (the vi.mock facade)', () => {
    expect(sheetsImporters()).toEqual([])
  })

  it('G7: a new stylesheet holds no colour (outside a theme file\'s :root) and no page width', () => {
    const fresh = cssFiles().filter(f => !LEGACY_CSS.includes(f.file))
    expect(fresh.map(f => f.file)).toEqual(expect.arrayContaining(['ui-kit.css', 'tab-kit.css', 'nutrition.css']))
    expect(fresh.filter(f => newCssViolations(f.text, f.file) > 0).map(f => f.file)).toEqual([])
  })

  it('G8: no page chooses its own header: no header component past <Page>, no hand-built header, no own <header> or <h1> in a view, no class, style or spread on <Page>', () => {
    expect(pageChrome()).toEqual([])
  })

  it('G9: no call site gives EmptyState a class, children or an unregistered illustration, wraps it in a Card, builds its classes or provides its surface; the legacy calls are baselined', () => {
    expect(ratchet(now.G9, baseline.G9)).toEqual([])
  })
})

describe('G8 finds a page choosing its own chrome', () => {
  it('an import of a header component, a header class, a class or style on <Page>; not the exempt views', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ui-guards-'))
    try {
      for (const d of ['views', 'components']) mkdirSync(join(dir, d))
      writeFileSync(join(dir, 'views', 'A.jsx'), `import SubHeader from '../components/SubHeader.jsx'\nexport default () => <SubHeader title="A" />`)
      writeFileSync(join(dir, 'views', 'B.jsx'), `export default () => <div className={cx('hdr', on && 'x')}><h1>B</h1></div>`)
      writeFileSync(join(dir, 'views', 'C.jsx'), `export default () => <Page title="C" className="wide">x</Page>`)
      writeFileSync(join(dir, 'views', 'D.jsx'), `export default () => <Page title={t('D')} action={<i style={{ x: 1 }} className="y" />}>x</Page>`)
      writeFileSync(join(dir, 'views', 'WorkoutRoute.jsx'), `export default () => <div className="hdr whdr-bar" />`)
      writeFileSync(join(dir, 'components', 'layout.jsx'), `import RootHeader from './RootHeader.jsx'`)
      expect(pageChrome(dir)).toEqual(['views/A.jsx: imports SubHeader.jsx', 'views/B.jsx: builds .hdr', 'views/B.jsx: renders its own <h1>', 'views/C.jsx: styles <Page>'])
      expect(HEADER_FILES).toEqual(['components/layout.jsx', 'components/RootHeader.jsx', 'components/SubHeader.jsx', 'dev/screens/states/shared-search.jsx'])
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })

  // One fixture per way past the guard; each must be caught on its own.
  const caught = (source, file = 'views/X.jsx') => {
    const dir = mkdtempSync(join(tmpdir(), 'ui-guards-'))
    try {
      for (const d of ['views', 'components']) mkdirSync(join(dir, d))
      writeFileSync(join(dir, file), source)
      return pageChrome(dir)
    } finally { rmSync(dir, { recursive: true, force: true }) }
  }

  it('an import without the .jsx extension', () => {
    expect(caught(`import SubHeader from '../components/SubHeader'\nexport default () => <Page title="X" />`)).toEqual(['views/X.jsx: imports SubHeader.jsx'])
  })

  it('a lazy or dynamic import', () => {
    expect(caught(`const H = lazy(() => import('../components/RootHeader'))\nexport default () => <Page title="X" />`)).toEqual(['views/X.jsx: imports RootHeader.jsx'])
    expect(caught(`const load = () => import('../components/SubHeader.jsx')\nexport default () => <Page title="X" />`)).toEqual(['views/X.jsx: imports SubHeader.jsx'])
  })

  it('a className held in a variable on <Page>', () => {
    expect(caught(`export default () => <Page title="X" className={c}>x</Page>`)).toEqual(['views/X.jsx: styles <Page>'])
  })

  it('a spread on <Page>, of an object literal or of props', () => {
    expect(caught(`export default () => <Page title="X" {...{ className }}>x</Page>`)).toEqual(['views/X.jsx: styles <Page>'])
    expect(caught(`export default props => <Page title="X" {...props}>x</Page>`)).toEqual(['views/X.jsx: styles <Page>'])
    expect(caught(`export default () => <Page title="X" action={<a {...p} />}>x</Page>`)).toEqual([])
  })

  it('a view that renders its own <header> or <h1>, but not a component', () => {
    expect(caught(`export default () => <Page title="X"><header>x</header></Page>`)).toEqual(['views/X.jsx: renders its own <header>'])
    expect(caught(`export default () => <Page title="X"><h1>x</h1></Page>`)).toEqual(['views/X.jsx: renders its own <h1>'])
    expect(caught(`export default () => <h1>x</h1>`, 'components/Card.jsx')).toEqual([])
    expect(caught(`export default () => <h1>x</h1>`, 'views/Login.jsx')).toEqual([])
  })
})

describe('G9 finds an empty state a page shapes itself', () => {
  const LINE_ART = `export const ILLUSTRATIONS = {\n  scale: { scene: 'scale', state: { kg: null } },\n  'routine': { scene: 'routine', state: {} },\n}`
  // One fixture per way past the guard; each must be caught on its own.
  const caught = (source, file = 'views/X.jsx') => {
    const dir = mkdtempSync(join(tmpdir(), 'ui-guards-'))
    try {
      for (const d of ['views', 'components', 'components/search']) mkdirSync(join(dir, d))
      writeFileSync(join(dir, 'components', 'line-art.jsx'), LINE_ART)
      writeFileSync(join(dir, file), source)
      return emptyStates(dir)
    } finally { rmSync(dir, { recursive: true, force: true }) }
  }

  it('takes exactly illustration, title, body, action and secondary', () => {
    expect(EMPTY_PROPS).toEqual(['illustration', 'title', 'body', 'action', 'secondary'])
    expect(caught(`export default () => <EmptyState illustration="scale" title={t('a')} body={t('b')} action={{ label: 'x', onClick: go }} secondary={{ label: 'y', onClick: go }} />`)).toEqual([])
  })

  it('a className, held in a variable too, and an icon or art', () => {
    expect(caught(`export default () => <EmptyState illustration="scale" title="a" className="small" />`)).toEqual(['views/X.jsx: takes className'])
    expect(caught(`export default () => <EmptyState illustration="scale" title="a" className={cls} />`)).toEqual(['views/X.jsx: takes className'])
    expect(caught(`export default () => <EmptyState illustration="scale" title="a" icon="clipboard" art={<i />} />`)).toEqual(['views/X.jsx: takes art', 'views/X.jsx: takes icon'])
  })

  it('a spread', () => {
    expect(caught(`export default props => <EmptyState illustration="scale" title="a" {...props} />`)).toEqual(['views/X.jsx: takes a spread'])
  })

  it('children, as an open and close pair', () => {
    expect(caught(`export default () => <EmptyState illustration="scale" title="a">text</EmptyState>`)).toEqual(['views/X.jsx: has children'])
    expect(caught(`export default () => <EmptyState illustration="scale" title={a > b ? 'x' : 'y'}>\n  <Button />\n</EmptyState>`)).toEqual(['views/X.jsx: has children'])
  })

  it('a call with no illustration, which is the legacy one', () => {
    expect(caught(`export default () => <EmptyState title="a" action={{ label: 'x', onClick: go }} />`)).toEqual(['views/X.jsx: has no illustration'])
    expect(caught(`export default () => <EmptyState icon="history">No workouts yet.</EmptyState>`)).toEqual(['views/X.jsx: has children', 'views/X.jsx: has no illustration', 'views/X.jsx: takes icon'])
  })

  it('an illustration that is not registered, or not a literal, or a ternary with one bad branch', () => {
    expect(caught(`export default () => <EmptyState illustration="sofa" title="a" />`)).toEqual(['views/X.jsx: illustration "sofa" not registered'])
    expect(caught(`export default () => <EmptyState illustration={'sofa'} title="a" />`)).toEqual(['views/X.jsx: illustration "sofa" not registered'])
    expect(caught(`export default () => <EmptyState illustration={name} title="a" />`)).toEqual(['views/X.jsx: illustration is not a string literal'])
    expect(caught(`export default () => <EmptyState illustration={on ? 'scale' : name} title="a" />`)).toEqual(['views/X.jsx: illustration is not a string literal'])
    expect(caught(`export default () => <EmptyState illustration={on ? 'scale' : 'sofa'} title="a" />`)).toEqual(['views/X.jsx: illustration "sofa" not registered'])
    expect(caught(`export default () => <EmptyState illustration={on ? 'scale' : 'routine'} title="a" />`)).toEqual([])
  })

  it('a Card, with whitespace, a comment or a Stack before the empty state, but not a titled one', () => {
    const wrapped = ['views/X.jsx: wraps EmptyState in Card']
    expect(caught(`export default () => <Card><EmptyState illustration="scale" title="a" /></Card>`)).toEqual(wrapped)
    expect(caught(`export default () => <Card tone="accent">\n  {/* nothing yet */}\n  <EmptyState illustration="scale" title="a" />\n</Card>`)).toEqual(wrapped)
    expect(caught(`export default () => <Card>\n  <Stack gap={4}>\n    <EmptyState illustration="scale" title="a" />\n    <Button />\n  </Stack>\n</Card>`)).toEqual(wrapped)
    expect(caught(`export default () => <Card title="Range"><EmptyState illustration="scale" title="a" /></Card>`)).toEqual([])
    expect(caught(`export default () => <Card><p>x</p><EmptyState illustration="scale" title="a" /></Card>`)).toEqual([])
  })

  it('a class the component owns, built by hand in any way, but not in blocks.jsx or as is-empty', () => {
    expect(caught(`export default () => <div className="chat-empty">x</div>`)).toEqual(['views/X.jsx: builds .chat-empty'])
    expect(caught(`export default () => <div className={cx('row', on && 'adm-empty')}>x</div>`)).toEqual(['views/X.jsx: builds .adm-empty'])
    expect(caught(`const c = cx('plan-empty', 'mt-6')\nexport default () => <div className={c}>x</div>`)).toEqual(['views/X.jsx: builds .plan-empty'])
    expect(caught(`export default () => <div className={on ? 'empty small' : 'is-empty'}>x</div>`)).toEqual(['views/X.jsx: builds .empty'])
    expect(caught(`export default () => <div className="is-empty">x</div>`)).toEqual([])
    expect(caught(`export default () => <div className="empty empty-x"><div className="empty-art" /></div>`, 'components/blocks.jsx')).toEqual([])
  })

  it('a rule in a stylesheet for a class the component owns', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ui-guards-'))
    try {
      mkdirSync(join(dir, 'components'))
      writeFileSync(join(dir, 'components', 'line-art.jsx'), LINE_ART)
      writeFileSync(join(dir, 'coach.css'), '.chat-empty{padding:14px 4px}\n.chat-empty-x{margin:0}')
      writeFileSync(join(dir, 'tab-kit.css'), '.empty[data-surface]{padding:0}\n.empty-acts{gap:8px}')
      expect(emptyStates(dir)).toEqual(['coach.css: styles .chat-empty'])
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })

  it('a page stylesheet\'s rule for the component\'s own classes, once per mention, but not the kit\'s', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ui-guards-'))
    try {
      mkdirSync(join(dir, 'components'))
      writeFileSync(join(dir, 'components', 'line-art.jsx'), LINE_ART)
      writeFileSync(join(dir, 'index.css'), '.x .empty[data-surface]{padding:0}\n.empty .ico{font-size:34px}\n/* .empty-art{} */\n.y .empty-acts{gap:0}\n.is-empty{x:1}')
      writeFileSync(join(dir, 'tab-shell.css'), '.empty strong{display:block}')
      writeFileSync(join(dir, 'tab-kit.css'), '.empty[data-surface]{padding:0}\n.empty-acts{gap:8px}\n.empty .empty-art{x:1}')
      expect(emptyStates(dir)).toEqual(['index.css: styles .empty (x2)', 'index.css: styles .empty-acts', 'tab-shell.css: styles .empty'])
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })

  it('a second legacy call in a file is a new finding, not the one already listed', () => {
    const legacy = `<EmptyState title="a" />`
    expect(caught(`export default () => <>${legacy}</>`)).toEqual(['views/X.jsx: has no illustration'])
    expect(caught(`export default () => <>${legacy}${legacy}</>`)).toEqual(['views/X.jsx: has no illustration (x2)'])
    expect(ratchet(caught(`export default () => <>${legacy}${legacy}</>`), ['views/X.jsx: has no illustration'])).toEqual([
      'views/X.jsx: has no illustration (x2): new, not allowed',
      `views/X.jsx: has no illustration: fixed, ${LOWER}`,
    ])
    expect(caught(`export default () => <><div className="chat-empty" /><div className="chat-empty" /></>`)).toEqual(['views/X.jsx: builds .chat-empty (x2)'])
  })

  it('EmptyState under another name', () => {
    expect(caught(`import { Card, EmptyState as Empty } from '../components/blocks.jsx'\nexport default () => <Empty illustration="sofa" title="a" icon="x">hi</Empty>`))
      .toEqual(['views/X.jsx: has children', 'views/X.jsx: illustration "sofa" not registered', 'views/X.jsx: takes icon'])
    expect(caught(`import { EmptyState as E2 } from '../components/blocks.jsx'\nexport default () => <E2 title="a" />`)).toEqual(['views/X.jsx: has no illustration'])
    expect(caught(`import { EmptyState as Empty } from '../components/blocks.jsx'\nexport default () => <Card><Empty illustration="scale" title="a" /></Card>`)).toEqual(['views/X.jsx: wraps EmptyState in Card'])
    expect(caught(`import { Foo as Empty } from './x'\nexport default () => <Empty title="a" icon="x" />`)).toEqual([])
  })

  it('a Card whose title is null, empty or false is not a titled one', () => {
    const wrapped = ['views/X.jsx: wraps EmptyState in Card']
    for (const title of ['{null}', '{undefined}', '{false}', '""', '{""}', '{\'\'}']) {
      expect(caught(`export default () => <Card title=${title}><EmptyState illustration="scale" title="a" /></Card>`), title).toEqual(wrapped)
    }
    expect(caught(`export default () => <Card title={name}><EmptyState illustration="scale" title="a" /></Card>`)).toEqual([])
    expect(caught(`export default () => <Card title={on ? t('A') : null}><EmptyState illustration="scale" title="a" /></Card>`)).toEqual([])
  })

  it('the surface context, imported, imported lazily or by a path without the extension, outside its four files', () => {
    const provided = ['views/X.jsx: provides an empty-state surface']
    expect(caught(`import { EmptySurface } from '../components/blocks.jsx'\nexport default () => <EmptySurface value="sheet" />`)).toEqual(provided)
    expect(caught(`import { Card, EmptySurface as Surface } from '../components/blocks'\nexport default () => <Surface value="card" />`)).toEqual(provided)
    expect(caught(`const load = () => import('../components/blocks.jsx').then(m => m.EmptySurface)`)).toEqual(provided)
    for (const file of ['components/Modals.jsx', 'components/LineChart.jsx', 'components/search/SearchOverlay.jsx', 'components/blocks.jsx']) {
      expect(caught(`import { EmptySurface } from './blocks.jsx'\nexport default () => <EmptySurface value="sheet" />`, file)).toEqual([])
    }
  })
})

describe('the ratchet', () => {
  it('fails a rise, a new file above 0, and a fall that did not lower the baseline', () => {
    expect(ratchet({ 'a.jsx': 3, 'b.jsx': 1, 'c.jsx': 1 }, { 'a.jsx': 2, 'c.jsx': 2, 'd.jsx': 4 })).toEqual([
      'a.jsx: 3 (baseline 2)',
      'b.jsx: 1 (baseline 0)',
      `c.jsx: 1 (baseline 2), ${LOWER}`,
      `d.jsx: 0 (baseline 4), ${LOWER}`,
    ])
    expect(ratchet({ 'a.jsx': 2 }, { 'a.jsx': 2 })).toEqual([])
  })

  it('compares a list an entry at a time', () => {
    expect(ratchet(['Home', 'Plan'], ['Plan', 'Stats'])).toEqual(['Home: new, not allowed', `Stats: fixed, ${LOWER}`])
  })
})

// The measurements themselves, so a guard cannot pass by miscounting.
describe('G1 counts every literal style property, wherever it hides', () => {
  const n = src => staticStyles(src)
  it('in an inline object, each literal one, beside dynamic siblings and custom properties', () => {
    expect(n(`<div style={{ height: 8, marginTop: '4px', color: 'var(--red-ink)' }} />`)).toBe(3)
    expect(n(`<div style={{ width: pct + '%', marginTop: 8, '--tint': 'var(--blue)', '--x': 3 }} />`)).toBe(1)
    expect(n(`<div style={{ width: w }} /><div style={{ '--tint': tint }} />`)).toBe(0)
  })

  it('with spaces around the =', () => {
    expect(n(`<div style = {{ marginTop: 8 }} />`)).toBe(1)
  })

  it('in a ternary, a logical and a nullish branch', () => {
    expect(n(`<i style={on ? { opacity: .5 } : { opacity: 1, marginTop: 2 }} />`)).toBe(3)
    expect(n(`<i style={on && { marginTop: 2 }} /><i style={s || { marginTop: 2 }} />`)).toBe(3)
    expect(n(`<i style={on ? { width: w } : null} />`)).toBe(0)
  })

  it('a template literal with nothing in it is a literal; one with ${} is not', () => {
    expect(n('<i style={{ margin: `0 4px`, width: `${w}px` }} />')).toBe(1)
  })

  it('a constant used as a value', () => {
    expect(n(`const GAP = 8\nconst W = props.w\nfunction A() { return <i style={{ gap: GAP, width: W }} /> }`)).toBe(1)
  })

  it('in a spread, of an object constant or inline', () => {
    expect(n(`const base = { marginTop: 8, fontSize: 13 }\n<i style={{ ...base, width: w }} />`)).toBe(2)
    expect(n(`<i style={{ ...{ marginTop: 8 }, ...(on ? { opacity: 1 } : {}) }} />`)).toBe(2)
  })

  it('in a module or function constant passed whole, and its members', () => {
    expect(n(`const S = { marginTop: 8 }\nfunction A() { return <i style={S} /> }`)).toBe(1)
    expect(n(`function A() {\n  const box = on ? { padding: 4 } : { padding: 6 }\n  return <i style={box} />\n}`)).toBe(2)
    expect(n(`const css = { row: { gap: 6, alignItems: 'center' } }\n<i style={css.row} />`)).toBe(2)
  })

  it('returned by a local helper', () => {
    expect(n(`function pill(c) { return { color: c, padding: '3px 7px' } }\n<i style={pill(x)} />`)).toBe(1)
    expect(n(`const box = on => ({ marginTop: on ? 8 : 4, height: 2 })\n<i style={box(true)} />`)).toBe(1)
    expect(n(`const bar = pct => ({ width: pct + '%' })\n<i style={bar(3)} />`)).toBe(0)
  })

  it('counts a style it cannot follow as one, but not a style passed through', () => {
    expect(n(`<i style={theme.card} /><i style={makeStyle()} /><i style={s} />`)).toBe(3)
    expect(n(`function A({ style }) { return <i style={style} /> }\n<i style={props.style} />`)).toBe(0)
  })

  it('skips comments', () => {
    expect(n(`{/* <div style={{ height: 2 }} /> */}\n// <i style={{ height: 2 }} />`)).toBe(0)
  })
})

describe('G2 counts colours', () => {
  it('in a stylesheet: hex, rgb()/hsl() and names, outside a theme file\'s :root rules', () => {
    const css = `:root{--a:#fff;--b:rgba(0,0,0,.3)} :root[data-theme="light"]{--a:#000}
      .x{color:#123456;background:rgb(1 2 3)} /* #abc red */ .y{border:1px solid white;color:var(--red)}
      :root[data-theme="light"] .z{color:hsl(0 0% 0%)}`
    expect(cssColours(css, true)).toBe(4)
    expect(cssColours(css, false)).toBe(7)
  })

  it('in code: hex, rgb()/hsl() and a quoted colour name given as a value', () => {
    expect(jsColours(`// #fff\nconst c = '#30d158'; const s = 'https://x/#top'\nconst k = { color: 'white', bg: 'rgba(0,0,0,.5)' }`)).toBe(3)
    expect(jsColours(`if (accent === 'green') t('Red')`)).toBe(0)
  })
})

describe('G3 counts hand-built primitive markup', () => {
  it('however the className is built', () => {
    expect(handBuilt(`<div className="card"><div className={'chip' + on}><span className={\`tag \${x}\`}>`)).toBe(3)
    expect(handBuilt(`<div className={cx('card', on && 'on')}><div className={on ? 'item on' : 'item'}>`)).toBe(2)
    expect(handBuilt(`<div className={['hub', 'card'].join(' ')}><div className = "row between"><div className="big">`)).toBe(3)
    expect(handBuilt(`const cls = cx('tiles', wide && 'wide')\nel.className = "empty"`)).toBe(2)
  })

  it('h4.sec and a sheet title h3', () => {
    expect(handBuilt(`<h4 className="sec">a</h4><h3>Title</h3><h3 style={{ marginBottom: 2 }}>T</h3><div className="sec">`)).toBe(3)
  })

  it('not a class that only starts like one', () => {
    expect(handBuilt(`<div className="card-x"><div className="hub-card"><div className="items"><div className="rows">`)).toBe(0)
  })

  it('not in the primitives, the redesign\'s included', () => {
    expect(PRIMITIVE_FILES).toEqual(expect.arrayContaining(['components/date-nav.jsx', 'components/line-art.jsx', 'components/tab-kit.jsx']))
    expect(Object.keys(now.G3).filter(f => PRIMITIVE_FILES.includes(f))).toEqual([])
  })
})

describe('G4 and G7', () => {
  it('finds the routed components and exempts the full-screen ones', () => {
    const views = routeViewsWithoutPage()
    expect(views).toContain('WorkoutRoute')
    expect(views).not.toContain('SettingsRoute')
    expect(PAGE_EXEMPT).toEqual(['AddDevice', 'CoachChat', 'CreateExercise', 'DayPage', 'FocusView', 'History', 'Home', 'LoadMuscleScreen', 'Login', 'MobileOnboarding', 'Notifications', 'PlanImportPage', 'PlanPreview', 'PlanScreen', 'PlansScreen', 'RoutineEditor', 'RoutinesScreen', 'TrainHub', 'TrainingLoad', 'WeekPage', 'WorkoutRoute'])
    expect(now.G4).not.toContain('WorkoutRoute')
  })

  it('checks the routed component itself, through double-quoted, named and lazy imports', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ui-guards-'))
    try {
      mkdirSync(join(dir, 'views'))
      writeFileSync(join(dir, 'App.jsx'), [
        `import A from "./views/A.jsx"`,
        `import { BRoute, Other as C } from './views/B.jsx'`,
        `const D = lazy(() => import('./views/D.jsx'))`,
        `const E = React.lazy(() => import("./views/E.jsx").then(m => ({ default: m.ERoute })))`,
        `<Route path="/a" element={<A />} /><Route path="/b" element={<BRoute />} /><Route path="/c" element={ok ? <C /> : <Navigate to="/" />} />`,
        `<Route path="/d" element={<D />} /><Route path="/e" element={<E />} /><Route path="/f" element={<F />} />`,
        `import F from "./views/F.jsx"`,
      ].join('\n'))
      // A pushed page on the stage is built on <StagePage>, which counts as a page.
      writeFileSync(join(dir, 'views', 'F.jsx'), `export default function F() { return <StagePage title="F">x</StagePage> }`)
      writeFileSync(join(dir, 'views', 'A.jsx'), `export default function A() { return <Page title="A">x</Page> }`)
      // The file renders <Page>, but not in the routed component.
      writeFileSync(join(dir, 'views', 'B.jsx'), `export function BRoute() { return <div /> }\nexport function Other() { return <Inner /> }\nfunction Inner() { return <Page title="C" /> }`)
      writeFileSync(join(dir, 'views', 'D.jsx'), `const D = () => <div><Page title="D" /></div>\nexport default D`)
      writeFileSync(join(dir, 'views', 'E.jsx'), `export function ERoute() { return <section /> }\nexport function Unused() { return <Page /> }`)
      expect(routeViewsWithoutPage(dir)).toEqual(['BRoute', 'E'])
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })

  it('flags a page width and a colour in a new stylesheet, :root included unless it is a theme file', () => {
    expect(newCssViolations('.a{max-width:560px}', 'x.css')).toBe(1)
    expect(newCssViolations('.a{max-inline-size:560px}', 'x.css')).toBe(1)
    expect(newCssViolations(':root{--x:#123}', 'x.css')).toBe(1)
    expect(newCssViolations('.a{color:tomato;background:hsl(0 0% 0%)}', 'x.css')).toBe(2)
    expect(newCssViolations(':root{--x:#fff} .a{color:var(--x)}', 'ui-kit.css')).toBe(0)
  })

  it('reads the design system\'s .g-root as its tokens\' root, in its own token file only', () => {
    const tokens = '.g-root{--x:#fff} :root[data-theme="dark"] .g-root{--x:#000}'
    expect(newCssViolations(tokens, 'ds/tokens.css')).toBe(0)
    expect(newCssViolations(tokens, 'ds/ds.css')).toBe(2)
    expect(newCssViolations('.g-root .a{color:#fff} .g-root[data-accent="moss"]{--x:#123}', 'ds/tokens.css')).toBe(2)
  })
})
