#!/usr/bin/env node
// The UI guards' measurements (src/ui-guards.test.js) and the baseline they ratchet against.
//
//   node scripts/ui-guards-baseline.mjs   # rewrite src/ui-guards.baseline.json from the sources
//
// A guard fails only when a file's count rises above its baseline, or a file missing from the
// baseline counts above 0. Regenerate only to tighten, after a migration has merged: running it
// to make a red guard green just records the regression as the new normal.

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
export const BASELINE = join(SRC, 'ui-guards.baseline.json')

// The CSS that predates the kit. Every other stylesheet is new and held to G7.
export const LEGACY_CSS = ['admin.css', 'coach.css', 'index.css', 'tab-shell.css', 'views/FocusView.css']
// Where the hand-built markup G3 looks for is allowed: the primitives themselves.
export const PRIMITIVE_FILES = ['components/blocks.jsx', 'components/layout.jsx', 'components/sheet-layout.jsx', 'components/ui.jsx']
// Routed views that draw their own chrome and never render <Page> (G4).
export const PAGE_EXEMPT = ['FocusView', 'Login', 'MobileOnboarding', 'Workout']

const SKIP_DIRS = new Set(['locales', 'instr', 'exercise-desc', 'exercise-names', 'node_modules'])

function walk(dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) { if (!SKIP_DIRS.has(name)) walk(p, out) } else out.push(p)
  }
  return out
}
const rel = p => relative(SRC, p).split(sep).join('/')
const read = p => ({ file: rel(p), path: p, text: readFileSync(p, 'utf8') })

// Every source file: .jsx and .js, tests included (G6 reads tests; the counts skip them).
export const sources = (src = SRC) => walk(src).filter(p => /\.(jsx?|mjs)$/.test(p)).map(read)
export const isTest = file => /\.test\.[mc]?jsx?$/.test(file)
export const jsxFiles = (src = SRC) => sources(src).filter(s => s.file.endsWith('.jsx') && !isTest(s.file))
export const cssFiles = (src = SRC) => walk(src).filter(p => p.endsWith('.css')).map(read)

// Comments out, so a hex or a style in prose is not counted. A comment opens only after a space,
// a brace or a paren: `accept="image/*"` and `https://` are not comments.
export const stripJs = text => text
  .replace(/(^|[\s{(])\/\*[\s\S]*?\*\//g, '$1')
  .replace(/(^|[\s;{}(),])\/\/.*$/gm, '$1')
export const stripCss = text => text.replace(/\/\*[\s\S]*?\*\//g, '')

const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g
const count = (text, re) => (text.match(re) || []).length

// The text from the `{` at `open` to its matching `}`, strings skipped.
function balanced(text, open) {
  let depth = 0, quote = null
  for (let i = open; i < text.length; i++) {
    const c = text[i]
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue }
    if (c === '"' || c === "'" || c === '`') quote = c
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) return text.slice(open + 1, i)
  }
  return text.slice(open + 1)
}

// Top-level comma split of an object literal's body.
function members(body) {
  const out = []
  let depth = 0, quote = null, start = 0
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue }
    if (c === '"' || c === "'" || c === '`') quote = c
    else if ('([{'.includes(c)) depth++
    else if (')]}'.includes(c)) depth--
    else if (c === ',' && depth === 0) { out.push(body.slice(start, i)); start = i + 1 }
  }
  out.push(body.slice(start))
  return out.map(m => m.trim()).filter(Boolean)
}

const LITERAL = /^(?:-?\d*\.?\d+|'[^'\\]*'|"[^"\\]*")$/
// A style object is static when every value is a literal. One holding an expression (a computed
// width, a theme colour picked at runtime) or setting a custom property (--tint) is dynamic and
// may stay inline.
export function isStaticStyle(body) {
  return members(body).every(m => {
    const kv = /^(['"]?)([\w-]+)\1\s*:\s*([\s\S]+)$/.exec(m)
    return kv && !kv[2].startsWith('--') && LITERAL.test(kv[3].trim())
  })
}

// G1: static inline style objects, `style={{ … }}`.
export function staticStyles(text) {
  const code = stripJs(text)
  let n = 0
  for (const m of code.matchAll(/\bstyle=\{\s*\{/g)) {
    if (isStaticStyle(balanced(code, m.index + m[0].length - 1))) n++
  }
  return n
}

// G2/G7: hex in a stylesheet outside its :root theme rules (`:root`, `:root[data-theme=…]`).
const THEME_RULE = /^:root(?:\[[^\]]*\])*$/
export function cssHex(text) {
  let n = 0
  for (const [, selector, decls] of stripCss(text).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (selector.split(',').every(s => THEME_RULE.test(s.trim()))) continue
    n += count(decls, HEX)
  }
  return n
}
export const jsxHex = text => count(stripJs(text), HEX)

// G3: markup built by hand that a primitive renders: a className starting with one of the
// primitives' classes, and h4.sec.
const HAND_BUILT = /className=\{?\s*['"`](?:card|item|tiles?|empty|lrow|tag|chips?)(?=[\s'"`])/g
const HAND_SEC = /<h4\s+className=\{?\s*['"`][^'"`]*\bsec\b/g
export const handBuilt = text => { const code = stripJs(text); return count(code, HAND_BUILT) + count(code, HAND_SEC) }

// G4: the views App.jsx routes to that do not render <Page>, by component name.
export function routeViewsWithoutPage(src = SRC) {
  const app = readFileSync(join(src, 'App.jsx'), 'utf8')
  const from = {}
  for (const [, what, path] of app.matchAll(/^import\s+(.+?)\s+from\s+'(\.\/views\/[^']+)'/gm)) {
    for (const name of what.replace(/[{}]/g, ' ').split(/[\s,]+/).filter(Boolean)) from[name] = path
  }
  const names = new Set()
  const code = stripJs(app)
  for (const m of code.matchAll(/\belement=\{/g)) {
    for (const [, name] of balanced(code, m.index + m[0].length - 1).matchAll(/<([A-Z]\w*)/g)) if (from[name]) names.add(name)
  }
  return [...names].filter(name => !/<Page\b/.test(stripJs(readFileSync(join(src, from[name]), 'utf8')))).sort()
}

// G6: who imports a module under src/sheets/, other than sheets.jsx and src/sheets/ itself.
export function sheetsImporters(src = SRC) {
  const dir = join(src, 'sheets') + sep
  const out = []
  for (const s of sources(src)) {
    if (s.file === 'sheets.jsx' || s.file.startsWith('sheets/')) continue
    const specs = [...s.text.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bvi\.mock\(\s*|^\s*import\s+)['"](\.[^'"]+)['"]/gm)].map(m => m[1])
    if (specs.some(spec => resolve(dirname(s.path), spec).startsWith(dir))) out.push(s.file)
  }
  return out
}

// G7: what a new stylesheet may not hold.
export const newCssViolations = text => cssHex(text) + count(stripCss(text), /\bmax-width\s*:/g)

const perFile = (files, measure) => Object.fromEntries(files.map(f => [f.file, measure(f.text)]).filter(([, n]) => n > 0))

export function measure(src = SRC) {
  const jsx = jsxFiles(src)
  return {
    G1: perFile(jsx, staticStyles),
    G2css: perFile(cssFiles(src).filter(f => LEGACY_CSS.includes(f.file)), cssHex),
    G2jsx: perFile(jsx, jsxHex),
    G3: perFile(jsx.filter(f => !PRIMITIVE_FILES.includes(f.file)), handBuilt),
    G4: routeViewsWithoutPage(src).filter(name => !PAGE_EXEMPT.includes(name)),
  }
}

// The files whose count rose: above the baseline, or above 0 for a file the baseline lacks.
export const rises = (now, base = {}) => Object.entries(now)
  .filter(([file, n]) => n > (base[file] ?? 0))
  .map(([file, n]) => `${file}: ${n} (baseline ${base[file] ?? 0})`)

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const m = measure()
  writeFileSync(BASELINE, JSON.stringify(m, null, 2) + '\n')
  const total = o => Object.values(o).reduce((a, b) => a + b, 0)
  console.log(`ui-guards baseline: G1 ${total(m.G1)} static styles, G2 ${total(m.G2css)} CSS hex / ${total(m.G2jsx)} JSX hex, G3 ${total(m.G3)} hand-built, G4 ${m.G4.length} views without <Page>`)
}
