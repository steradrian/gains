// The WebGL renderer for the look shader: one full-screen triangle, one draw per frame.
import { CALM, FRAG, GEOM, LOOK_INDEX, VERT } from './shader.js'

export const UNIFORMS = ['uRes', 'uDpr', 'uPhase', 'uComp', 'uSeed', 'uC0', 'uC1', 'uC2', 'uC3', 'uTop', 'uEnd', 'uGlow', 'uCalm',
  'uZone', 'uGrain', 'uProgress', 'uAccent', 'uIntensity', 'uHub', 'uFade', 'uInkDir', 'uDecor', 'uDecorC']

/**
 * The look's uniform values for one draw, as plain data. `o` is `draw`'s options plus `w`, `h`: the size
 * in device px of the stage the look is drawn for (the canvas for the look, the viewport for the glass).
 */
export function lookUniformValues(o) {
  const th = o.theme
  const comp = typeof o.look === 'number' ? o.look : (LOOK_INDEX[o.look] == null ? LOOK_INDEX.plain : LOOK_INDEX[o.look])
  return {
    res: [o.w, o.h],
    dpr: o.dpr || o.h / 844,
    phase: o.phase || 0,
    comp,
    seed: o.seed == null ? 0.7 : o.seed,
    art: th.art.map(s => s.lin),
    top: th.stageTop.rgb,
    end: th.stageEnd.rgb,
    glow: th.glow.rgb,
    calm: o.calm === false ? 0 : 1,
    zone: o.zone || [0.5, GEOM.hero / GEOM.h, CALM.radius / GEOM.w, CALM.radius / GEOM.h],
    grain: comp === LOOK_INDEX.plain ? 0 : (o.grain == null ? 3 : o.grain),
    progress: o.progress == null ? 0 : o.progress,
    accent: th.accentLin,
    intensity: th.intensity == null ? 0.45 : th.intensity,
    hub: o.hub || 120 / 422,
    fade: o.fade === false ? 0 : 1,
    inkDir: th.tokens && th.tokens.light ? -1 : 1,
    decor: th.tokens && th.tokens.decor ? th.tokens.decor.k : 1,
    decorC: th.tokens && th.tokens.decor ? th.tokens.decor.c.rgb : [1, 1, 1],
  }
}

/** Writes `lookUniformValues` into a program that holds LOOK_GLSL. `U` maps UNIFORMS names to locations. */
export function applyLookUniforms(gl, U, v) {
  gl.uniform2f(U.uRes, v.res[0], v.res[1])
  gl.uniform1f(U.uDpr, v.dpr)
  gl.uniform1f(U.uPhase, v.phase)
  gl.uniform1f(U.uComp, v.comp)
  gl.uniform1f(U.uSeed, v.seed)
  v.art.forEach((lin, i) => gl.uniform3fv(U['uC' + i], lin))
  gl.uniform3fv(U.uTop, v.top)
  gl.uniform3fv(U.uEnd, v.end)
  gl.uniform3fv(U.uGlow, v.glow)
  gl.uniform1f(U.uCalm, v.calm)
  gl.uniform4f(U.uZone, v.zone[0], v.zone[1], v.zone[2], v.zone[3])
  gl.uniform1f(U.uGrain, v.grain)
  gl.uniform1f(U.uProgress, v.progress)
  gl.uniform3fv(U.uAccent, v.accent)
  gl.uniform1f(U.uIntensity, v.intensity)
  gl.uniform1f(U.uHub, v.hub)
  gl.uniform1f(U.uFade, v.fade)
  gl.uniform1f(U.uInkDir, v.inkDir)
  gl.uniform1f(U.uDecor, v.decor)
  gl.uniform3fv(U.uDecorC, v.decorC)
}

/**
 * A renderer for `canvas`, or null when the browser gives no WebGL context. Throws when the shader
 * does not compile or link (the caller treats that as no WebGL too).
 * `draw({ look, theme, phase, calm, fade, dpr, zone, grain, seed })`: `theme` is color.js deriveTheme.
 */
export function createRenderer(canvas) {
  const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false })
    || canvas.getContext('experimental-webgl')
  if (!gl) return null
  const compile = (type, src) => {
    const s = gl.createShader(type)
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s))
    return s
  }
  const vert = compile(gl.VERTEX_SHADER, VERT)
  const frag = compile(gl.FRAGMENT_SHADER, FRAG)
  const prog = gl.createProgram()
  gl.attachShader(prog, vert)
  gl.attachShader(prog, frag)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog))
  gl.useProgram(prog)
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(prog, 'aPos')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
  const U = {}
  UNIFORMS.forEach(n => { U[n] = gl.getUniformLocation(prog, n) })

  return {
    dispose() {
      gl.deleteBuffer(buf)
      gl.deleteProgram(prog)
    },
    draw(o) {
      const w = canvas.width, h = canvas.height
      gl.viewport(0, 0, w, h)
      applyLookUniforms(gl, U, lookUniformValues({ ...o, w, h }))
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },
  }
}
