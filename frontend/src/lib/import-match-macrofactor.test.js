import { describe, it, expect } from 'vitest'
import { matchMacrofactorName, bpFromName, matchExercise } from './import-csv.js'
import { EXIDX } from './exercises.js'

// A real MacroFactor export: 21 names. null = no genuine catalogue twin, imports as custom.
const NAMES = {
  'Goblet Squat': '1760',
  'Chin-Up': null, // resolved by the generic matcher, asserted below
  'Smith Machine Overhead Press': null,
  'Kneeling Cable Crunch': null,
  'High-To-Low Cable Fly': null,
  '45° Incline Barbell Press': '0047',
  'Accentuated Eccentric Pin-Loaded Machine Leg Extension': '0585',
  'Bent-Over Overhand Grip Barbell Row': '0027',
  'Cable Rope Straight Arm Lat Pulldown': '0237',
  'Incline Chest-Supported Dumbbell Rear Delt Fly': '2500',
  'Low Incline Dumbbell Press': '0314',
  'Lying Pin-Loaded Machine Hamstring Curl': '0586',
  'Overhand Grip Cable Lat Pulldown': '2330',
  'Overhand Grip Cable Reverse Fly': '11254',
  'Overhand Grip Machine Fly': '0596',
  'Pin-Loaded Machine Leg Extension': '0585',
  'Plate-Loaded Machine Hip Thrust (Starting From The Bottom)': '7384',
  'Seated Dumbbell Overhead Press': '0405',
  'Underhand Close Grip Cable Lat Pulldown': '0245',
  'Underhand Grip Yates Row': '0118',
  // No machine glute kickback in the catalogue; cable/bodyweight kickbacks are different lifts.
  'Standing Pin-Loaded Machine Glute Kickback': null,
}

describe('MacroFactor name matching', () => {
  for (const [name, id] of Object.entries(NAMES)) {
    if (id === null && !/Kickback/.test(name)) continue
    it(`${name} -> ${id ?? 'custom'}`, () => {
      const got = matchMacrofactorName(name)
      expect(got).toBe(id)
      if (id) expect(EXIDX[id]).toBeTruthy()
    })
  }

  it('keeps the five names the generic matcher already resolved', () => {
    for (const n of ['Goblet Squat', 'Chin-Up', 'Smith Machine Overhead Press', 'Kneeling Cable Crunch', 'High-To-Low Cable Fly']) {
      expect(matchMacrofactorName(n)).toBeTruthy()
      expect(matchMacrofactorName(n)).toBe(matchExercise(n))
    }
  })

  it('files custom fallbacks under sensible body parts', () => {
    expect(bpFromName('45° incline barbell press')).toBe('chest')
    expect(bpFromName('low incline dumbbell press')).toBe('chest')
    expect(bpFromName('overhand grip machine fly')).toBe('chest')
    expect(bpFromName('incline chest-supported dumbbell rear delt fly')).toBe('shoulders')
    expect(bpFromName('bent-over overhand grip barbell row')).toBe('back')
    expect(bpFromName('standing pin-loaded machine glute kickback')).toBe('upper legs')
    expect(bpFromName('seated dumbbell overhead press')).toBe('shoulders')
    expect(bpFromName('leg press')).toBe('upper legs')
  })
})
