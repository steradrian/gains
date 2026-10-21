// A finished workout as a picture, for "Share as image" (#453, board T8.3): plain text loses its
// layout in most chat apps, a card keeps it. The card is the board's: the stage's gradient in the
// person's accent, the name and the date, "52 min · 18 sets · 9,600 kg", the new bests, the muscle
// map beside them and the wordmark. Three steps, so the part that decides what the card says and
// where it goes is testable without a canvas:
//   workoutCardModel  — what the card says: name, date, the line, new bests and how hard each
//                       muscle was worked
//   layoutWorkoutCard — where everything goes, given a way to measure text
//   drawWorkoutCard   — paints a layout onto a 2D canvas context
// Nothing here stores anything; the workout is read, never written.
import { sessionSections, workoutVolume, workoutDuration, workoutDay, doneUnits } from './history.js'
import { EXIDX } from './exercises.js'
import { isWarmupRow } from './workout-model.js'
import { MUSCLES, INERT, levelsOf, loadOfWorkouts } from './muscles.js'
import { bestSetOf } from './onerm.js'
import { volumeText } from './train-stats.js'
import { fmtDate, durPart, fmtNum, capWords } from './format.js'
import { t, tn, exerciseNameClass } from './i18n-core.js'
import { WORDMARK } from '../ds/wordmark.js'

export const CARD_WIDTH = 1080
const PAD = 72
const MIN_HEIGHT = 640
// More than this many new bests and the rest are counted instead of listed: a card that grows
// past a phone screen is not glanceable any more.
export const MAX_RECORDS = 6
const TITLE_LINES = 2
const LINE_LINES = 3
const VIEW_W = 200
const VIEW_GAP = 28
const COL_GAP = 48
const MAP_MAX_HEIGHT = 420
const MARK_H = 44
const [, , MARK_VW, MARK_VH] = WORDMARK.viewBox.split(/\s+/).map(Number)

/**
 * What the card says. `unit` is the profile's, `nameOf(entry)` the exercise's display name — the
 * same pair "Copy as text" takes (workoutText). Sets are work sets, as the volume is: warm-ups are
 * left out of both, the way they are left out of records and progression everywhere else. A
 * per-side set counts once per side, as the workout screen counts it. `line` is the board's
 * "52 min · 18 sets · 9,600 kg", the volume by Train's rule (tonnes from 10 000 kg). `records`
 * are the new bests, each with its best set where it has one ("Bench press 82.5 × 6"). `levels`
 * is the finish summary's muscle map for this one session (levelsOf over loadOfWorkouts), null
 * when no set reached a muscle the map can show — a card of only cardio has nothing to shade.
 */
export function workoutCardModel(w, { unit, nameOf }) {
  const entries = w.entries || []
  const sets = entries.reduce((n, e) => n + (e.sets || []).reduce((m, s) => m + (isWarmupRow(s) ? 0 : doneUnits(s)), 0), 0)
  // New bests in the order the sheet lists the exercises, each named once — a combined session
  // can hold the same lift twice.
  const prs = new Set(w.prs || [])
  const records = []
  for (const i of sessionSections(entries).flatMap(section => section.units).flat()) {
    const entry = entries[i]
    if (!entry || !prs.has(entry.id) || records.some(r => r.id === entry.id)) continue
    const name = nameOf(entry)
    const best = bestSetOf(entry)
    const shown = exerciseNameClass(EXIDX[entry.id]) ? capWords(name) : name
    records.push({ id: entry.id, text: best ? shown + ' ' + fmtNum(best.w) + ' × ' + best.r : shown })
  }
  const day = workoutDay(w)
  const levels = levelsOf(loadOfWorkouts([w]))
  // Imported history has no clock: an unknown duration is left out rather than shown as 0.
  const line = [
    ...durPart(workoutDuration(w)),
    tn('{0} set', '{0} sets', sets),
    volumeText(w.vol ?? workoutVolume(w), unit),
  ].join(' · ')
  return {
    title: w.name || '',
    date: day ? fmtDate(day, true) : '',
    line,
    records: records.map(r => r.text),
    levels: MUSCLES.some(m => levels[m] > 0) ? levels : null,
  }
}

// Greedy word wrap to `max` lines; the last line that does not fit is cut with an ellipsis.
// A word wider than the line on its own (a long German compound) is cut too, never overflowed.
export function wrapText(text, width, measure, max) {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (let i = 0; i < words.length; i++) {
    const next = line ? line + ' ' + words[i] : words[i]
    if (measure(next) <= width) { line = next; continue }
    if (line) lines.push(line)
    line = words[i]
    if (lines.length === max) break
  }
  if (line && lines.length < max) lines.push(line)
  const rest = lines.join(' ').length < words.join(' ').length
  return lines.map((l, i) => (i === lines.length - 1 && (rest || measure(l) > width) ? ellipsize(l, width, measure) : l))
}
function ellipsize(text, width, measure) {
  let s = text
  while (s && measure(s + '…') > width) s = s.slice(0, -1)
  return s.trimEnd() + '…'
}

/**
 * Where everything goes. `measure(text, weight, size)` returns a width in pixels — the canvas's
 * measureText in the app, a fake in the tests. `rtl` mirrors the card for Arabic: text anchors
 * at the right edge, the date goes to the left and the map to the right. `map` is `{ aspect }`,
 * one body view's height over its width, to include the muscle map, or null to leave it out; a
 * model without levels has none either way. Returns the canvas size and a flat list of items for
 * drawWorkoutCard; a text item carries its size and weight (and `align: 'end'` for the date), the
 * font family is the drawer's.
 */
export function layoutWorkoutCard(model, { measure, rtl = false, width = CARD_WIDTH, map = null }) {
  const items = []
  const inner = width - PAD * 2
  const start = rtl ? width - PAD : PAD
  const end = rtl ? PAD : width - PAD
  const dir = rtl ? -1 : 1
  let y = PAD

  // The head: the name, and the date at the other end of its first line.
  const dateW = model.date ? measure(model.date, 600, 40) : 0
  const titleLines = wrapText(model.title, inner - (dateW ? dateW + 40 : 0), s => measure(s, 700, 72), TITLE_LINES)
  const head = titleLines.length ? titleLines : ['']
  head.forEach((line, i) => {
    if (line) items.push({ kind: 'text', text: line, x: start, y: y + 72, size: 72, weight: 700, color: 'label' })
    if (i === 0 && model.date) items.push({ kind: 'text', text: model.date, x: end, y: y + 72, size: 40, weight: 600, color: 'label2', align: 'end' })
    y += 94
  })

  // The body: the map on the reading side, the line and the new bests beside it, both centred
  // on the taller of the two.
  y += 36
  const withMap = !!(map && model.levels)
  let viewW = 0, viewH = 0
  if (withMap) {
    viewW = VIEW_W
    viewH = viewW * map.aspect
    if (viewH > MAP_MAX_HEIGHT) { viewH = MAP_MAX_HEIGHT; viewW = viewH / map.aspect }
  }
  const mapW = withMap ? viewW * 2 + VIEW_GAP : 0
  const colX = withMap ? start + (mapW + COL_GAP) * dir : start
  const colW = withMap ? inner - mapW - COL_GAP : inner
  const col = []
  let cy = 0
  const add = (text, size, weight, color) => { col.push({ text, size, weight, color, y: cy + size }); cy += Math.round(size * 1.35) }
  for (const l of wrapText(model.line, colW, s => measure(s, 600, 46), LINE_LINES)) add(l, 46, 600, 'label')
  if (model.records.length) {
    cy += 18
    add(t('New bests'), 40, 600, 'label2')
    const shown = model.records.length > MAX_RECORDS ? model.records.slice(0, MAX_RECORDS - 1) : model.records
    for (const r of shown) add(wrapText(r, colW, s => measure(s, 600, 44), 1)[0], 44, 600, 'label')
    if (shown.length < model.records.length) add(t('and {0} more', model.records.length - shown.length), 40, 500, 'label2')
  }
  const blockH = Math.max(viewH, cy)
  if (withMap) {
    const top = y + (blockH - viewH) / 2
    items.push({ kind: 'map', view: 'front', x: rtl ? start - viewW : start, y: top, w: viewW, h: viewH })
    items.push({ kind: 'map', view: 'back', x: rtl ? start - mapW : start + viewW + VIEW_GAP, y: top, w: viewW, h: viewH })
  }
  const colTop = y + (blockH - cy) / 2
  for (const c of col) items.push({ kind: 'text', text: c.text, x: colX, y: colTop + c.y, size: c.size, weight: c.weight, color: c.color })
  y += blockH + 56

  // The wordmark at the foot, on the reading side.
  const height = Math.max(MIN_HEIGHT, Math.round(y + MARK_H + PAD))
  const markW = MARK_H * MARK_VW / MARK_VH
  items.push({ kind: 'wordmark', x: rtl ? start - markW : start, y: height - PAD - MARK_H, w: markW, h: MARK_H })
  return { width, height, rtl, items }
}

/* ---------- colours ---------- */

// "#rgb", "#rrggbb", "rgb(…)" or "rgba(…)" as [r, g, b, a]; null for anything else.
export function parseColor(value) {
  const s = String(value || '').trim()
  let m = s.match(/^#([0-9a-f]{3,8})$/i)
  if (m) {
    let h = m[1]
    if (h.length === 3 || h.length === 4) h = [...h].map(c => c + c).join('')
    if (h.length !== 6 && h.length !== 8) return null
    const n = i => parseInt(h.slice(i, i + 2), 16)
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1]
  }
  m = s.match(/^rgba?\(([^)]+)\)$/i)
  if (!m) return null
  const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(p => (p.endsWith('%') ? parseFloat(p) / 100 : parseFloat(p)))
  if (parts.length < 3 || parts.some(Number.isNaN)) return null
  return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1]
}
// CSS color-mix(in srgb, a p%, b): p of `a` over the rest of `b`, as an rgb() string. A canvas
// is handed plain rgb, so the card does not depend on how a WebView parses color-mix().
export function mixColor(a, b, p) {
  const x = parseColor(a)
  const y = parseColor(b)
  if (!x || !y) return x ? a : b
  const ch = i => Math.round(x[i] * p + y[i] * (1 - p))
  return `rgb(${ch(0)}, ${ch(1)}, ${ch(2)})`
}
/**
 * The muscle map's fills: the silhouette and an untouched muscle as a little label over the
 * surface, levels 1–4 as more and more accent over that. A semi-transparent label is flattened
 * onto the surface first. On the card the surface is the stage and the accent is white, as the
 * design system's BodyMap shades on the stage.
 */
export function mapColors({ label, surface, acc }) {
  const lab = parseColor(label)
  const flat = lab && lab[3] < 1 ? mixColor(`rgb(${lab[0]}, ${lab[1]}, ${lab[2]})`, surface, lab[3]) : label
  const base = mixColor(flat, surface, 0.11)
  return {
    sil: mixColor(flat, surface, 0.18),
    levels: [base, mixColor(acc, base, 0.32), mixColor(acc, base, 0.56), mixColor(acc, base, 0.78), acc],
  }
}

/**
 * The two ends of a CSS `linear-gradient(<deg>, …)` over a `width` × `height` box, as canvas
 * coordinates: 0deg runs bottom to top, 90deg left to right, 170deg (the stage's) down and a
 * little to the right.
 */
export function gradientLine(width, height, deg) {
  const a = deg * Math.PI / 180
  const vx = Math.sin(a), vy = -Math.cos(a)
  const half = (Math.abs(width * vx) + Math.abs(height * vy)) / 2
  const cx = width / 2, cy = height / 2
  return [cx - vx * half, cy - vy * half, cx + vx * half, cy + vy * half]
}

/* ---------- drawing ---------- */

export const CARD_FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,system-ui,sans-serif"

/** One body view's height over its width, from its `vb` ("minX minY width height"). */
export const viewAspect = view => {
  const [, , w, h] = String(view?.vb || '').split(/\s+/).map(Number)
  return w > 0 && h > 0 ? h / w : 1.76
}

/**
 * Paint a layout. `colors` holds stage and stageEnd (the accent's stage gradient), label and
 * label2 (the text on it) as CSS colours, read off the drawer by the caller. `map`, when the
 * layout has a map in it, is `{ body, levels }`: body-paths.js geometry for the profile's body
 * ({ front, back }) and the model's levels.
 */
export function drawWorkoutCard(ctx, layout, colors, map = null, family = CARD_FONT) {
  const { width, height, rtl, items } = layout
  const shades = mapColors({ label: colors.label, surface: colors.stage, acc: colors.label })
  const fill = ctx.createLinearGradient(...gradientLine(width, height, 170))
  fill.addColorStop(0, colors.stage)
  fill.addColorStop(1, colors.stageEnd)
  ctx.fillStyle = fill
  ctx.fillRect(0, 0, width, height)
  ctx.textBaseline = 'alphabetic'
  for (const item of items) {
    if (item.kind === 'map') {
      const view = map?.body?.[item.view]
      if (view) drawView(ctx, view, item, map.levels, shades)
    } else if (item.kind === 'wordmark') {
      drawWordmark(ctx, item, colors.label2)
    } else {
      ctx.direction = rtl ? 'rtl' : 'ltr'
      ctx.textAlign = item.align === 'end' ? 'end' : 'start'
      ctx.fillStyle = colors[item.color] || colors.label
      ctx.font = `${item.weight} ${item.size}px ${family}`
      ctx.fillText(item.text, item.x, item.y)
    }
  }
}
function drawView(ctx, view, box, levels, shades) {
  const [minX, minY, vw, vh] = String(view.vb).split(/\s+/).map(Number)
  ctx.save()
  ctx.translate(box.x, box.y)
  ctx.scale(box.w / vw, box.h / vh)
  ctx.translate(-minX, -minY)
  ctx.fillStyle = shades.sil
  for (const slug of INERT) for (const d of view.p[slug] || []) ctx.fill(new Path2D(d))
  for (const slug of MUSCLES) {
    ctx.fillStyle = shades.levels[levels?.[slug] || 0]
    for (const d of view.p[slug] || []) ctx.fill(new Path2D(d))
  }
  ctx.restore()
}
// ds/wordmark.js, letter by letter: each path carries its own "translate(x,y) scale(1,-1)".
function drawWordmark(ctx, box, color) {
  ctx.save()
  ctx.translate(box.x, box.y)
  ctx.scale(box.w / MARK_VW, box.h / MARK_VH)
  ctx.fillStyle = color
  for (const p of WORDMARK.paths) {
    const [tx, ty] = (p.t.match(/translate\(([-\d.]+),([-\d.]+)\)/) || [0, 0, 0]).slice(1).map(Number)
    ctx.save()
    ctx.translate(tx, ty)
    ctx.scale(1, -1)
    ctx.fill(new Path2D(p.d))
    ctx.restore()
  }
  ctx.restore()
}
