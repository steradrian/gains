// @vitest-environment happy-dom
// The look engine's pure parts: colour maths against the Background Lab's values, the looks and
// their labels, the mode-dependent default, the sanitizers, and a renderer that gives up cleanly.
import { describe, expect, it } from 'vitest'
import { THEMES } from '../themes.js'
import { mergeStates } from '../sync-merge.js'
import { deriveTheme, rampAt, rgbToHex } from './color.js'
import { DEFAULT_INTENSITY, defaultLook, isLook, LOOKS, lookLabel, resolveIntensity, resolveLook, sanitizeStageLook } from './index.js'
import { createRenderer, lookUniformValues, UNIFORMS } from './renderer.js'
import { FRAG, LOOK_GLSL, LOOK_INDEX } from './shader.js'

const preset = id => THEMES.find(p => p.id === id)
const ramp = (id, xs) => {
  const theme = deriveTheme(preset(id), 0.45)
  return xs.map(x => rgbToHex(rampAt(theme.art, x)))
}

describe('deriveTheme and rampAt', () => {
  // The values the lab's own deriveTheme gives for these presets (themes-v2.html, run in node).
  it('builds cobalt\'s art ramp from its stage: dark end, the stage, a pale glow', () => {
    const theme = deriveTheme(preset('cobalt'), 0.45)
    expect(theme.art.map(a => a.hex)).toEqual(['#0C1A66', '#1A2F86', '#3A62D6', '#B6C7FF'])
    expect(theme.tokens.light).toBe(false)
    expect(theme.tokens.decor.k).toBe(1)
    expect(ramp('cobalt', [0, 0.5, 0.8])).toEqual(['#0C1A66', '#2C4BB0', '#748DE4'])
  })

  it('treats blossom as a light stage with its own ink art and print strength', () => {
    const theme = deriveTheme(preset('blossom'), 0.5)
    expect(theme.art.map(a => a.hex)).toEqual(['#D989A3', '#FA9EBC', '#FFC2D1', '#FFF1F5'])
    expect(theme.tokens.light).toBe(true)
    expect(theme.tokens.decor.k).toBe(1.6)
    expect(theme.intensity).toBe(0.5)
    expect(ramp('blossom', [0, 0.5, 0.8])).toEqual(['#D989A3', '#FCB0C6', '#FFD2DD'])
  })

  it('marks exactly the six light stages as light', () => {
    const light = THEMES.filter(p => deriveTheme(p).tokens.light).map(p => p.id)
    expect(light.sort()).toEqual(['blossom', 'cream', 'mist', 'peach', 'snow', 'watermelon'])
  })
})

describe('looks', () => {
  it('has the six looks with Classic first, each known to the shader', () => {
    expect(LOOKS).toEqual(['plain', 'linen', 'lines', 'florals', 'silk', 'bloom'])
    for (const look of LOOKS) expect(LOOK_INDEX[look]).toBeTypeOf('number')
  })

  it('calls plain "Classic" and the rest by name', () => {
    expect(lookLabel('plain')).toBe('Classic')
    expect(LOOKS.slice(1).map(lookLabel)).toEqual(['Linen', 'Lines', 'Florals', 'Silk', 'Bloom'])
  })

  it('ports the v2 shader: the ink direction alone sets the deviation, and the source is ASCII', () => {
    expect(FRAG).toContain('float dev = (lum - DARK_MID) * uInkDir;')
    expect(FRAG).not.toContain('11.5')
    expect(/^[\x00-\x7f]*$/.test(FRAG)).toBe(true)
  })

  // Liquid glass: the glass shader prepends LOOK_GLSL, so the stage it refracts is this code.
  it('builds FRAG from LOOK_GLSL, defines lookColor once, and keeps gl_FragCoord out of the shared part', () => {
    expect(FRAG).toContain(LOOK_GLSL)
    expect(FRAG.split('vec3 lookColor(vec2 css, vec2 size, vec2 grainPx)').length - 1).toBe(1)
    expect(LOOK_GLSL).not.toContain('gl_FragCoord')
    expect(LOOK_GLSL).not.toContain('gl_FragColor')
    expect(LOOK_GLSL).not.toContain('varying')
    expect(FRAG).toContain('lookColor(css, size, gl_FragCoord.xy)')
  })

  it('declares every uniform the renderer sets in LOOK_GLSL', () => {
    for (const name of UNIFORMS) expect(LOOK_GLSL).toMatch(new RegExp(`uniform \\w+ ${name}\\b`))
  })
})

describe('lookUniformValues', () => {
  const theme = deriveTheme(preset('cobalt'), 0.45)

  it('names the look, the size and the dpr the draw is for', () => {
    const v = lookUniformValues({ look: 'bloom', theme, phase: 0.12, w: 780, h: 1688, dpr: 2 })
    expect(v).toMatchObject({ comp: LOOK_INDEX.bloom, res: [780, 1688], dpr: 2, phase: 0.12, calm: 1, fade: 1, grain: 3, seed: 0.7 })
    expect(v.art).toHaveLength(4)
  })

  it('falls back to Classic for an unknown look, derives the dpr from the height and turns calm off', () => {
    const v = lookUniformValues({ look: 'nope', theme, w: 390, h: 844, calm: false })
    expect(v).toMatchObject({ comp: LOOK_INDEX.plain, dpr: 1, calm: 0, grain: 0 })
  })

  it('inverts the ink on a light stage', () => {
    expect(lookUniformValues({ look: 'silk', theme: deriveTheme(preset('blossom')), w: 1, h: 1 }).inkDir).toBe(-1)
    expect(lookUniformValues({ look: 'silk', theme, w: 1, h: 1 }).inkDir).toBe(1)
  })
})

describe('the mode-dependent default', () => {
  it('is bloom in dark and Classic in light', () => {
    expect(defaultLook('dark')).toBe('bloom')
    expect(defaultLook('light')).toBe('plain')
  })

  it('resolves a look nobody chose through the mode, live', () => {
    for (const unset of [null, undefined, '', 'auto', 'nonsense']) {
      expect(resolveLook(unset, 'dark')).toBe('bloom')
      expect(resolveLook(unset, 'light')).toBe('plain')
    }
  })

  it('keeps an explicit pick the same in both modes, Classic included', () => {
    for (const look of LOOKS) {
      expect(resolveLook(look, 'dark')).toBe(look)
      expect(resolveLook(look, 'light')).toBe(look)
    }
  })

  it('knows its looks', () => {
    expect(isLook('silk')).toBe(true)
    expect(isLook('haze')).toBe(false)
  })
})

describe('the sanitizers', () => {
  it('keeps one of the six looks and unsets anything else', () => {
    expect(sanitizeStageLook({ bgLook: 'florals' }).bgLook).toBe('florals')
    expect(sanitizeStageLook({ bgLook: 'plain' }).bgLook).toBe('plain')
    for (const junk of ['haze', 'auto', '', 7, {}, undefined]) expect(sanitizeStageLook({ bgLook: junk }).bgLook).toBeNull()
  })

  it('clamps the intensity to 0 to 1 and falls back to 0.45', () => {
    expect(sanitizeStageLook({ bgIntensity: 0.7 }).bgIntensity).toBe(0.7)
    expect(sanitizeStageLook({ bgIntensity: 3 }).bgIntensity).toBe(1)
    expect(sanitizeStageLook({ bgIntensity: -2 }).bgIntensity).toBe(0)
    for (const junk of ['0.5', NaN, Infinity, null, {}]) expect(sanitizeStageLook({ bgIntensity: junk }).bgIntensity).toBe(DEFAULT_INTENSITY)
    expect(resolveIntensity(undefined)).toBe(0.45)
  })

  it('leaves a copy that never had the keys alone', () => {
    expect(sanitizeStageLook({ unit: 'kg' })).toEqual({ unit: 'kg' })
  })

  it('runs on every merged copy, so a bad value from either side never reaches the renderer', () => {
    const base = over => ({ unit: 'kg', lang: 'en', week: {}, dayPlan: {}, workouts: [], routines: [], bodyweight: [], ...over })
    const bad = mergeStates(base({ _ts: 3, bgLook: 'haze', bgIntensity: 9 }), base({ _ts: 2 }))
    expect(bad.bgLook).toBeNull()
    expect(bad.bgIntensity).toBe(1)
  })
})

describe('createRenderer', () => {
  it('returns null when the canvas gives no WebGL context', () => {
    const canvas = { getContext: () => null }
    expect(createRenderer(canvas)).toBeNull()
  })

  it('throws when a shader does not compile, for the caller to treat as no WebGL', () => {
    const gl = {
      VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3,
      createShader: () => ({}), shaderSource: () => {}, compileShader: () => {},
      getShaderParameter: () => false, getShaderInfoLog: () => 'bad shader',
    }
    expect(() => createRenderer({ getContext: () => gl })).toThrow('bad shader')
  })
})
