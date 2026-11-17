import { describe, expect, it } from 'vitest'
import { compareFacts, compareLine, defaultPair, orderPair, pairFor, waistOn } from './photo-compare.js'

const photo = (d, weight = null) => ({ key: 'own:' + d, d, weight })
// Newest first, as allPhotos gives them.
const six = [photo('2026-10-18', 81.4), photo('2026-10-04', 82.1), photo('2026-09-20', 83), photo('2026-09-06', 83.6), photo('2026-08-23', 84.3), photo('2026-08-02', 85)]

describe('pairs', () => {
  it('starts on the oldest and the newest', () => {
    expect(defaultPair(six).map(p => p.d)).toEqual(['2026-08-02', '2026-10-18'])
    expect(defaultPair([six[0]])).toBeNull()
    expect(defaultPair(undefined)).toBeNull()
  })

  it('puts the earlier photo first whichever way they come', () => {
    expect(orderPair(six[0], six[5]).map(p => p.d)).toEqual(['2026-08-02', '2026-10-18'])
    expect(orderPair(six[5], six[0]).map(p => p.d)).toEqual(['2026-08-02', '2026-10-18'])
  })

  it('opens a photo against the nearest older one, and the oldest against the nearest newer', () => {
    expect(pairFor(six, six[1]).map(p => p.d)).toEqual(['2026-09-20', '2026-10-04'])
    expect(pairFor(six, six[5]).map(p => p.d)).toEqual(['2026-08-02', '2026-08-23'])
    expect(pairFor([six[0]], six[0])).toBeNull()
    expect(pairFor(six, photo('2000-01-01'))).toBeNull()
  })
})

describe('waistOn', () => {
  const S = { measurements: [{ d: '2026-08-01', waist: 92 }, { d: '2026-09-01', chest: 100 }, { d: '2026-10-10', waist: 88.4 }] }

  it('is the latest reading on or before the day, skipping entries without a waist', () => {
    expect(waistOn(S, '2026-08-02')).toBe(92)
    expect(waistOn(S, '2026-09-15')).toBe(92)
    expect(waistOn(S, '2026-10-10')).toBe(88.4)
    expect(waistOn(S, '2026-10-18')).toBe(88.4)
  })

  it('is null before the first reading and with none', () => {
    expect(waistOn(S, '2026-07-01')).toBeNull()
    expect(waistOn({}, '2026-10-18')).toBeNull()
  })
})

describe('compareFacts and compareLine', () => {
  const S = { unit: 'kg', measurements: [{ d: '2026-08-01', waist: 92 }, { d: '2026-10-10', waist: 88 }] }

  it('reads days, the weight change and the waist change between the two dates', () => {
    const facts = compareFacts(S, six[5], six[0])
    expect(facts).toMatchObject({ days: 77, weight: -3.6, waist: -4, unit: 'kg', lengthUnit: 'cm' })
    expect(compareLine(facts)).toBe('77 days apart · -3.6 kg · waist -4 cm')
  })

  it('leaves a part out when either side has no reading', () => {
    expect(compareFacts(S, photo('2026-08-02'), six[0]).weight).toBeNull()
    expect(compareLine(compareFacts(S, photo('2026-08-02'), six[0]))).toBe('77 days apart · waist -4 cm')
    expect(compareFacts({ unit: 'kg' }, six[5], six[0]).waist).toBeNull()
    expect(compareLine(compareFacts({ unit: 'kg' }, six[5], six[0]))).toBe('77 days apart · -3.6 kg')
  })

  it('says the sign of a gain, uses the unit of the profile and calls the same day the same day', () => {
    const lb = compareFacts({ unit: 'lb', measurements: [{ d: '2026-08-01', waist: 91.44 }, { d: '2026-10-10', waist: 93.98 }] }, photo('2026-08-02', 180), photo('2026-10-18', 183.5))
    expect(lb).toMatchObject({ weight: 3.5, waist: 1, lengthUnit: 'in' })
    expect(compareLine(lb)).toBe('77 days apart · +3.5 lb · waist +1 in')
    expect(compareLine(compareFacts({ unit: 'kg' }, photo('2026-10-18'), photo('2026-10-18')))).toBe('Same day')
    expect(compareLine({ days: 1, weight: 0, waist: null, unit: 'kg' })).toBe('1 day apart · 0 kg')
  })
})
