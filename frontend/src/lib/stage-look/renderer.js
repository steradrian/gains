// The WebGL renderer for the look shader: one full-screen triangle, one draw per frame.
import { CALM, FRAG, GEOM, LOOK_INDEX, VERT } from './shader.js'

const UNIFORMS = ['uRes', 'uDpr', 'uPhase', 'uComp', 'uSeed', 'uC0', 'uC1', 'uC2', 'uC3', 'uTop', 'uEnd', 'uGlow', 'uCalm',
  'uZone', 'uGrain', 'uProgress', 'uAccent', 'uIntensity', 'uHub', 'uFade', 'uInkDir', 'uDecor', 'uDecorC']

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
      const w = canvas.width, h = canvas.height, th = o.theme
      const comp = typeof o.look === 'number' ? o.look : (LOOK_INDEX[o.look] == null ? LOOK_INDEX.plain : LOOK_INDEX[o.look])
      gl.viewport(0, 0, w, h)
      gl.uniform2f(U.uRes, w, h)
      gl.uniform1f(U.uDpr, o.dpr || h / 844)
      gl.uniform1f(U.uPhase, o.phase || 0)
      gl.uniform1f(U.uComp, comp)
      gl.uniform1f(U.uSeed, o.seed == null ? 0.7 : o.seed)
      th.art.forEach((s, i) => gl.uniform3fv(U['uC' + i], s.lin))
      gl.uniform3fv(U.uTop, th.stageTop.rgb)
      gl.uniform3fv(U.uEnd, th.stageEnd.rgb)
      gl.uniform3fv(U.uGlow, th.glow.rgb)
      gl.uniform1f(U.uCalm, o.calm === false ? 0 : 1)
      const z = o.zone || [0.5, GEOM.hero / GEOM.h, CALM.radius / GEOM.w, CALM.radius / GEOM.h]
      gl.uniform4f(U.uZone, z[0], z[1], z[2], z[3])
      gl.uniform1f(U.uGrain, comp === LOOK_INDEX.plain ? 0 : (o.grain == null ? 3 : o.grain))
      gl.uniform1f(U.uProgress, o.progress == null ? 0 : o.progress)
      gl.uniform3fv(U.uAccent, th.accentLin)
      gl.uniform1f(U.uIntensity, th.intensity == null ? 0.45 : th.intensity)
      gl.uniform1f(U.uHub, o.hub || 120 / 422)
      gl.uniform1f(U.uFade, o.fade === false ? 0 : 1)
      gl.uniform1f(U.uInkDir, th.tokens && th.tokens.light ? -1 : 1)
      gl.uniform1f(U.uDecor, th.tokens && th.tokens.decor ? th.tokens.decor.k : 1)
      gl.uniform3fv(U.uDecorC, th.tokens && th.tokens.decor ? th.tokens.decor.c.rgb : [1, 1, 1])
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },
  }
}
