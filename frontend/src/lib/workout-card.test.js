import { describe, expect, it } from 'vitest'
import { workoutCardModel, layoutWorkoutCard, wrapText, parseColor, mixColor, mapColors, viewAspect, gradientLine, MAX_RECORDS, CARD_WIDTH } from './workout-card.js'
import { fmtDate } from './format.js'

// #453, board T8.3: a finished workout shared as a picture. A fake measure stands in for the
// canvas — every character is half its font size wide — so the layout can be checked without one.
const measure = (text, weight, size) => String(text).length * size * 0.5

describe('workoutCardModel', () => {
  const names = { bench: 'barbell bench press', curl: 'dumbbell curl', lunge: 'dumbbell lunge' }
  const nameOf = e => names[e.id] || e.id
  const w = {
    id: 'w1', d: '2026-09-03', start: 0, end: 58 * 60000, name: 'Push', vol: 1790,
    prs: ['curl', 'bench', 'curl'],
    entries: [
      { id: 'bench', target: { mode: 'reps' }, sets: [
        { w: 40, r: 8, done: true, phase: 'warmup' },
        { w: 60, r: 8, done: true },
        { w: 60, r: 6, done: true },
        { w: 70, r: 8, done: false },
      ] },
      { id: 'curl', target: { mode: 'reps' }, sets: [{ w: 12, r: 10, done: true }] },
      { id: 'lunge', target: { mode: 'reps', side: true }, sets: [
        { w: 10, r: 16, done: true, sides: { L: { w: 10, r: 8, done: true }, R: { w: 10, r: 8, done: true } } },
      ] },
    ],
  }

  it('says the name, the day as the board writes it, and one line: duration, work sets and volume', () => {
    const m = workoutCardModel(w, { unit: 'kg', nameOf })
    expect(m.title).toBe('Push')
    expect(m.date).toBe(fmtDate('2026-09-03', true))
    // 2 bench work sets (the warm-up and the unticked set are not counted), 1 curl, and the
    // per-side lunge set once per side.
    expect(m.line).toBe('58 min · 5 sets · 1,790 kg')
  })

  it('lists each new best once, in the order the workout lists the exercises, title-cased, with its best set', () => {
    expect(workoutCardModel(w, { unit: 'kg', nameOf }).records).toEqual(['Barbell Bench Press 60 × 8', 'Dumbbell Curl 12 × 10'])
  })

  it('leaves out a duration it does not know and works the volume out when none was saved', () => {
    const imported = { ...w, start: undefined, end: undefined, vol: undefined, prs: undefined }
    const m = workoutCardModel(imported, { unit: 'lb', nameOf })
    // 60×8 + 60×6 bench, 12×10 curl, 10×8 a side on the lunge; the warm-up adds nothing.
    expect(m.line).toBe('5 sets · 1,120 lb')
    expect(m.records).toEqual([])
  })

  it('writes a big volume in tonnes, as Train does', () => {
    expect(workoutCardModel({ ...w, vol: 12400 }, { unit: 'kg', nameOf }).line).toBe('58 min · 5 sets · 12.4 t')
  })

  it('carries the session\'s muscle map, shaded against its own hardest-worked muscle', () => {
    const bench = { ...w, entries: [{ id: '0025', target: { mode: 'reps' }, sets: [
      { w: 40, r: 8, done: true, phase: 'warmup' }, { w: 60, r: 8, done: true }, { w: 60, r: 8, done: false },
    ] }] }
    const { levels } = workoutCardModel(bench, { unit: 'kg', nameOf })
    expect(levels.chest).toBe(4)
    expect(levels.triceps).toBeGreaterThan(0)
    expect(levels.quadriceps).toBe(0)
  })

  it('has no muscle map when no set reached a muscle the map shows', () => {
    expect(workoutCardModel(w, { unit: 'kg', nameOf }).levels).toBeNull()
  })
})

describe('wrapText', () => {
  const width = 100
  const m = s => s.length * 10

  it('keeps a line that fits as it is', () => {
    expect(wrapText('Leg day', width, m, 2)).toEqual(['Leg day'])
  })

  it('wraps at words and cuts the last line with an ellipsis when it runs out of lines', () => {
    const lines = wrapText('upper body strength and conditioning', width, m, 2)
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe('upper body')
    expect(lines[1].endsWith('…')).toBe(true)
    for (const line of lines) expect(m(line)).toBeLessThanOrEqual(width)
  })

  it('cuts a single word wider than the line instead of overflowing', () => {
    const [line] = wrapText('Oberkörpertrainingseinheit', width, m, 1)
    expect(line.endsWith('…')).toBe(true)
    expect(m(line)).toBeLessThanOrEqual(width)
  })
})

describe('layoutWorkoutCard', () => {
  const model = {
    title: 'Push', date: 'Thu 3 Sep', line: '58 min · 5 sets · 1,790 kg',
    records: ['Barbell Bench Press 60 × 8'],
    levels: { chest: 4 },
  }
  const texts = layout => layout.items.filter(i => i.kind === 'text').map(i => i.text)
  const kinds = (layout, kind) => layout.items.filter(i => i.kind === kind)
  const text = (layout, s) => layout.items.find(i => i.text === s)
  const firstLine = layout => layout.items.find(i => i.kind === 'text' && i.text.startsWith('58 min'))
  const map = { aspect: 1280 / 727 }

  it('puts the name and the date on one line, then the line, the new bests, and the wordmark at the foot', () => {
    const layout = layoutWorkoutCard(model, { measure })
    expect(layout.width).toBe(CARD_WIDTH)
    expect(texts(layout)).toEqual(['Push', 'Thu 3 Sep', '58 min · 5 sets · 1,790 kg', 'New bests', 'Barbell Bench Press 60 × 8'])
    expect(text(layout, 'Thu 3 Sep').y).toBe(text(layout, 'Push').y)
    expect(text(layout, 'Thu 3 Sep')).toMatchObject({ align: 'end', x: CARD_WIDTH - 72 })
    const ys = ['Push', '58 min · 5 sets · 1,790 kg', 'New bests', 'Barbell Bench Press 60 × 8'].map(s => text(layout, s).y)
    expect([...ys].sort((a, b) => a - b)).toEqual(ys)
    const [mark] = kinds(layout, 'wordmark')
    expect(mark.y).toBeGreaterThan(ys.at(-1))
    expect(mark.y + mark.h).toBe(layout.height - 72)
    expect(mark.w / mark.h).toBeCloseTo(2303.6 / 958.8)
  })

  it('keeps every line inside the card, the date too', () => {
    const long = { ...model, title: 'A very long routine name that will never fit on one line of the card at all', records: ['an exercise with a name far too long to fit on one line of the card'] }
    const layout = layoutWorkoutCard(long, { measure, map })
    for (const item of layout.items.filter(i => i.kind === 'text')) {
      const w = measure(item.text, item.weight, item.size)
      const left = item.align === 'end' ? item.x - w : item.x
      expect(left, item.text).toBeGreaterThanOrEqual(0)
      expect(left + w, item.text).toBeLessThanOrEqual(layout.width)
    }
    // the name leaves room for the date beside it
    const title = layout.items.find(i => i.kind === 'text' && i.weight === 700)
    expect(title.x + measure(title.text, 700, 72)).toBeLessThan(text(layout, 'Thu 3 Sep').x - measure('Thu 3 Sep', 600, 40))
  })

  it('sets the front and back of the body beside the line, on the reading side, when asked', () => {
    const without = layoutWorkoutCard(model, { measure })
    const layout = layoutWorkoutCard(model, { measure, map })
    expect(kinds(without, 'map')).toHaveLength(0)
    const [front, back] = kinds(layout, 'map')
    expect([front.view, back.view]).toEqual(['front', 'back'])
    expect(front.h / front.w).toBeCloseTo(map.aspect)
    expect(back.x).toBeGreaterThan(front.x + front.w)
    // Beside the map the column is narrow and the line wraps: its first line is what is placed.
    const line = firstLine(layout)
    expect(line.x).toBeGreaterThan(back.x + back.w)
    expect(line.y).toBeGreaterThan(front.y)
    expect(line.y).toBeLessThan(front.y + front.h)
    expect(layout.height).toBeGreaterThan(without.height)
  })

  it('leaves the map out of a card whose workout has none, even when asked, and the line takes the width', () => {
    const layout = layoutWorkoutCard({ ...model, levels: null }, { measure, map })
    expect(kinds(layout, 'map')).toHaveLength(0)
    expect(text(layout, '58 min · 5 sets · 1,790 kg').x).toBe(text(layout, 'Push').x)
  })

  it('counts the new bests past the limit instead of growing without end', () => {
    const many = { ...model, records: Array.from({ length: 9 }, (_, i) => 'lift ' + i) }
    const layout = layoutWorkoutCard(many, { measure })
    expect(texts(layout).filter(s => s.startsWith('lift '))).toHaveLength(MAX_RECORDS - 1)
    expect(texts(layout)).toContain('and 4 more')
  })

  it('leaves the new bests out when there are none, and is never shorter than its minimum', () => {
    const layout = layoutWorkoutCard({ ...model, records: [] }, { measure })
    expect(texts(layout)).not.toContain('New bests')
    expect(layout.height).toBeGreaterThanOrEqual(640)
  })

  it('mirrors for a right-to-left language: the name at the right edge, the date and the wordmark mirrored', () => {
    const ltr = layoutWorkoutCard(model, { measure, map })
    const rtl = layoutWorkoutCard(model, { measure, map, rtl: true })
    expect(rtl.rtl).toBe(true)
    expect(text(rtl, 'Push').x).toBe(rtl.width - text(ltr, 'Push').x)
    expect(text(rtl, 'Thu 3 Sep').x).toBe(72)
    const front = l => kinds(l, 'map')[0]
    expect(front(rtl).x + front(rtl).w).toBeCloseTo(rtl.width - front(ltr).x)
    const mark = l => kinds(l, 'wordmark')[0]
    expect(mark(rtl).x + mark(rtl).w).toBeCloseTo(rtl.width - mark(ltr).x)
    expect(firstLine(rtl).x).toBeLessThan(front(rtl).x)
  })
})

describe('card colours', () => {
  it('reads hex and rgb colours, and nothing else', () => {
    expect(parseColor('#fff')).toEqual([255, 255, 255, 1])
    expect(parseColor('#30d158')).toEqual([48, 209, 88, 1])
    expect(parseColor('rgba(235,235,245,.6)')).toEqual([235, 235, 245, 0.6])
    expect(parseColor('rgb(10 20 30 / 50%)')).toEqual([10, 20, 30, 0.5])
    expect(parseColor('var(--acc)')).toBeNull()
  })

  it('mixes the way CSS color-mix(in srgb) does', () => {
    expect(mixColor('#ffffff', '#000000', 0.5)).toBe('rgb(128, 128, 128)')
    expect(mixColor('#30d158', '#1c1c1e', 1)).toBe('rgb(48, 209, 88)')
    // An unreadable colour falls back to the other one rather than to black.
    expect(mixColor('nonsense', '#1c1c1e', 0.5)).toBe('#1c1c1e')
  })

  it('shades the map from the surface towards the accent, five steps', () => {
    const { sil, levels } = mapColors({ label: '#ffffff', surface: '#000000', acc: '#ff0000' })
    expect(sil).toBe('rgb(46, 46, 46)')
    expect(levels[0]).toBe('rgb(28, 28, 28)')
    expect(levels[4]).toBe('#ff0000')
    const reds = levels.slice(0, 4).map(c => parseColor(c)[0])
    expect([...reds].sort((a, b) => a - b)).toEqual(reds)
  })

  it('flattens a see-through label onto the surface first', () => {
    const { levels } = mapColors({ label: 'rgba(0,0,0,.5)', surface: '#ffffff', acc: '#0000ff' })
    // Half-black over white is mid-grey; 11 % of that over white.
    expect(levels[0]).toBe('rgb(241, 241, 241)')
  })

  it('runs the stage gradient the way CSS draws linear-gradient(170deg)', () => {
    const [x0, y0, x1, y1] = gradientLine(100, 200, 180)
    expect([x0, y0, x1, y1].map(v => Math.round(v))).toEqual([50, 0, 50, 200])
    const [a, b, c, d] = gradientLine(1080, 1200, 170)
    expect(d).toBeGreaterThan(b)   // top to bottom
    expect(c).toBeGreaterThan(a)   // and a little to the right
  })

  it('reads a body view\'s height over its width from its viewBox', () => {
    expect(viewAspect({ vb: '0 95 727 1280' })).toBeCloseTo(1280 / 727)
    expect(viewAspect({})).toBeGreaterThan(1)
  })
})
