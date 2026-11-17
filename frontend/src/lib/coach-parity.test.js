/* The server's copies of three tiny reading rules, pinned against the frontend's originals.
 *
 * api/coach/payload.js re-implements modeOf, isBw and isPerSide because the api container has
 * no build step in common with the frontend and does not copy frontend/ into its image. That
 * trade-off is fine; what is not fine is the copy drifting, which is exactly what happened
 * when v1.2.4 taught the app about bodyweight work and per-side reps: the server kept reading
 * every set as a loaded rep set, so a push-up progression that was working would have looked
 * like a stalled bench press with the weight left at zero.
 *
 * This test only runs under vitest, which can load both runtimes. It compares behaviour over a
 * table of configs rather than comparing source, so the two are free to be written differently
 * as long as they answer the same.
 */
import { describe, it, expect } from 'vitest'
import { modeOf as uiModeOf, isBw as uiIsBw, isPerSide as uiIsPerSide } from './history.js'
import { modeOf as srvModeOf, isBw as srvIsBw, isPerSide as srvIsPerSide } from '../../../api/coach/core/payload.js'
import { exOr } from './exercises.js'

// Real ids from the catalogue, so `eq`/`bp` are whatever the dataset actually says rather than
// whatever this test assumed. 0001 is a bodyweight sit-up; the others are looked up the same way.
const IDS = ['0001', '0025', '0043', 'no-such-exercise']

const CONFIGS = [
  {},
  { mode: 'reps' },
  { mode: 'time' },
  { mode: 'cardio' },
  { mode: 'nonsense' },
  { mode: '' },
  { bodyweight: true },
  { bodyweight: false },
  { bodyweight: true, mode: 'time' },
  { side: true },
  { side: false },
  { side: true, bodyweight: true, mode: 'reps' },
  { reps: 8, sets: 3 },
  { repsMax: 20, reps: 12 }
]

describe('server/client reading rules agree', () => {
  for (const id of IDS) {
    const ex = exOr(id)
    for (const base of CONFIGS) {
      const cfg = { ...base, id }
      const label = `${id} ${JSON.stringify(base)}`

      it(`modeOf — ${label}`, () => {
        expect(srvModeOf(cfg, ex)).toBe(uiModeOf(cfg))
      })

      it(`isBw — ${label}`, () => {
        expect(srvIsBw(cfg, ex)).toBe(uiIsBw(cfg))
      })

      it(`isPerSide — ${label}`, () => {
        expect(srvIsPerSide(cfg)).toBe(uiIsPerSide(cfg))
      })
    }
  }

  it('an explicit flag beats the catalogue, on both sides', () => {
    const bodyweightEx = exOr('0001')
    expect(uiIsBw({ id: '0001' })).toBe(true)
    expect(srvIsBw({ id: '0001' }, bodyweightEx)).toBe(true)
    // A dip done with a belt turns it off; the server must agree, or it keeps reading the
    // added load as no load.
    expect(uiIsBw({ id: '0001', bodyweight: false })).toBe(false)
    expect(srvIsBw({ id: '0001', bodyweight: false }, bodyweightEx)).toBe(false)
  })
})

// #311: the validator keeps a routine glyph only when it is one a routine can hold (or a legacy
// emoji), and the payload sends the plan's icons through the same filter. A glyph the app shows
// and the server does not know would be reset by every plan.
import { GLYPHS, KNOWN_GLYPHS, glyphOf } from './glyphs.js'
import { ICON_NAMES } from '../components/Icon.jsx'
import { ROUTINE_GLYPHS, LEGACY_ROUTINE_GLYPHS, glyphStr } from '../../../api/coach/core/glyphs.js'

describe('routine glyphs', () => {
  it('the server offers exactly the glyphs the picker offers, each a real icon', () => {
    expect([...ROUTINE_GLYPHS].sort()).toEqual([...GLYPHS].sort())
    ROUTINE_GLYPHS.forEach(g => expect(ICON_NAMES).toContain(g))
  })
  it('the server keeps every icon key a routine can hold, and the app shows each as itself', () => {
    expect([...ROUTINE_GLYPHS, ...LEGACY_ROUTINE_GLYPHS].sort()).toEqual([...KNOWN_GLYPHS].sort())
    KNOWN_GLYPHS.forEach(g => {
      expect(glyphStr(g)).toBe(g)
      expect(glyphOf(g)).toBe(g)
    })
  })
})

// Train coach: the weekly check-in. The app files it (coach-checkin.js) and sends it with the
// next review; the server route validates it (validCheckIn) and the payload carries it
// (cleanCheckIn). The words and the note's length are written out on both sides, so they are
// pinned here, and what the app sends must reach the model the same on both paths: the server
// path (JSON over the wire, validated, cleaned at enqueue) and the phone's own key (straight in).
import { CHECKIN_FEEL, CHECKIN_SLEEP, CHECKIN_NOTE_MAX, pendingCheckIn, saveCheckIn } from './coach-checkin.js'
import {
  CHECKIN_FEEL as SRV_FEEL, CHECKIN_SLEEP as SRV_SLEEP, CHECKIN_NOTE_MAX as SRV_NOTE_MAX,
  validCheckIn, cleanCheckIn, build
} from '../../../api/coach/core/payload.js'

describe('the weekly check-in', () => {
  const state = () => ({ unit: 'kg', lang: 'en', weekStart: 1, routines: [], week: {}, dayPlan: {}, workouts: [], bodyweight: [], customEx: [], coach: { lastReview: null }, coachCheckIns: {} })
  const review = (S, checkIn) => build(S, { handle: 'h'.repeat(16), kind: 'review', checkIn })

  it('the app and the server know the same words and the same note length', () => {
    expect(CHECKIN_FEEL).toEqual(SRV_FEEL)
    expect(CHECKIN_SLEEP).toEqual(SRV_SLEEP)
    expect(CHECKIN_NOTE_MAX).toBe(SRV_NOTE_MAX)
  })

  for (const value of [
    { feel: 'much', sleep: 'poor', note: 'Shoulder a bit tight' },
    { sleep: 'good' },
    { note: '  only a note  ' },
    { feel: 'hard', note: 'x'.repeat(CHECKIN_NOTE_MAX + 40) },
  ]) {
    it(`reaches the model the same on the server and the phone — ${JSON.stringify(value).slice(0, 60)}`, () => {
      const S = state()
      saveCheckIn(S, '2026-10-12', value, 100)
      const sent = pendingCheckIn(S)
      const wire = JSON.parse(JSON.stringify(sent))
      expect(validCheckIn(wire)).toBe(true)                       // the route accepts it
      const server = review(S, cleanCheckIn(wire)).checkIn       // jobs.enqueue cleans, build carries
      const phone = review(S, sent).checkIn                        // coach-local hands it straight in
      expect(server).toEqual(phone)
      expect(server.week).toBe('2026-10-12')
    })
  }

  it('a review without a check-in carries none, on either path', () => {
    const S = state()
    expect(pendingCheckIn(S)).toBeNull()
    expect('checkIn' in review(S, null)).toBe(false)
    expect('checkIn' in review(S, cleanCheckIn(undefined))).toBe(false)
  })

  it('only a review carries it', () => {
    const S = state()
    const checkIn = { week: '2026-10-12', feel: 'hard' }
    expect('checkIn' in build(S, { handle: 'h'.repeat(16), kind: 'create', checkIn })).toBe(false)
  })
})
