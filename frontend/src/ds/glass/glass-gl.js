import { applyLookUniforms, UNIFORMS } from '../../lib/stage-look/renderer.js'
import { LOOK_GLSL } from '../../lib/stage-look/shader.js'
import { STRENGTH } from './glass-kinds.js'

// Liquid glass, the WebGL half (presenter-fixed.js drives it, one renderer per canvas). Every glass
// shape is a quad whose fragments shade a rounded-rect SDF that looks through a thick convex slab at
// what is behind it, all in one draw call. WebGL cannot read the DOM, so what is behind is the stage
// itself: the look shader's own lookColor() (lib/stage-look/shader.js), evaluated at the bent
// coordinate with the stage's uniforms, so Classic and every look match the real ground at any
// accent. For the chrome canvas the silhouettes of the glass panes under it (`panes`) are drawn in too,
// so a card scrolling under the tab bar bends at the bar's rim.
//
// The optics: the flat middle passes what is behind it straight through (it is drawn as the material's
// lift alone, so the real pixels show); a bezel band 10-14px wide at the rim bends light in from around
// the glass, like the edge of a water drop. Each pixel there looks D * (1 - x)^2 outward (x from 0 at the
// rim to 1 where the top goes flat; D 6-12px), so the rim shows what lies just outside, compressed up to
// ~3x, and a line crossing the rim stays crisp and kinks inward by up to D. It never folds. Red, green and
// blue shift by slightly different amounts (dispersion). The rim takes a thin specular from one light
// direction, strongest on the lit arc and weaker on the opposite one; a soft contact shadow sits under it.

const FLOATS = 20 // per vertex: pos 2, rect 4, shape 4, touch 4, extra 2, clip 4
const MAX_PANES = 12
const NO_CLIP = [0, 0, 1e5, 1e5]

/** The material's defaults: the approved prototype's white lift, rim and specular, and its shadow tint. */
export const DEFAULT_MATERIAL = Object.freeze({
  lift: [1, 1, 1, 0.018],
  rim: [1, 1, 1],
  spec: [1, 1, 1],
  shade: [0.02, 0.04, 0.16, 1],
  tint: [0.2, 0.34, 0.78],
})

// A GLSL expression that picks one number per kind from the strength table.
const num = n => Number(n).toFixed(3)
const byKind = field => {
  const rows = Object.values(STRENGTH).sort((a, b) => a.id - b.id)
  return rows.slice(0, -1).reduceRight((acc, k) => `(kind < ${k.id}.5 ? ${num(Number(k[field]))} : ${acc})`, num(Number(rows.at(-1)[field])))
}

const VERT = `
attribute vec2 a_pos;
attribute vec4 a_rect;
attribute vec4 a_shape;
attribute vec4 a_touch;
attribute vec2 a_extra;
attribute vec4 a_clip;
uniform vec2 u_view;    // canvas size, CSS px
uniform vec2 u_origin;  // the canvas's top-left in viewport px
varying vec2 v_p;
varying vec4 v_rect;
varying vec4 v_shape;
varying vec4 v_touch;
varying vec2 v_extra;
varying vec4 v_clip;
void main() {
  v_p = a_pos; v_rect = a_rect; v_shape = a_shape; v_touch = a_touch; v_extra = a_extra; v_clip = a_clip;
  vec2 ndc = (a_pos - u_origin) / u_view * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
}`

const FRAG = `precision highp float;
${LOOK_GLSL}
uniform vec2 u_stage;   // the stage's size, CSS px (the viewport)
uniform float u_dpr;
uniform vec4 u_lift;    // body colour and alpha over a clear middle
uniform vec3 u_rim;     // bezel light
uniform vec3 u_spec;    // lit-arc specular
uniform vec4 u_shade;   // contact shadow colour, alpha scale
uniform vec3 u_tint;
uniform vec4 u_panes[${MAX_PANES}]; // centre.xy, half size
uniform float u_paneR[${MAX_PANES}];
uniform int u_paneN;
varying vec2 v_p;
varying vec4 v_rect;   // centre.xy, half size
varying vec4 v_shape;  // radius, press, kind, centre alpha
varying vec4 v_touch;  // touch.xy (viewport px), has touch, unused
varying vec2 v_extra;  // opacity, unused
varying vec4 v_clip;   // left, top, right, bottom (viewport px)

float sdBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

// The stage with the panes under this canvas drawn in as they look (a faint lift and a lit edge), by
// weight w: only the bezel draws them, since the bar's clear middle shows the real ones through the
// frost layer, and drawing them there too would double their outlines.
vec3 scene(vec2 p, float w) {
  vec3 col = lookColor(p, u_stage, p * u_dpr);
  if (w <= 0.0) return col;
  for (int i = 0; i < ${MAX_PANES}; i++) {
    if (i >= u_paneN) break;
    vec4 pn = u_panes[i];
    float d = sdBox(p - pn.xy, pn.zw, u_paneR[i]);
    col = mix(col, vec3(1.0), w * 0.05 * clamp(0.5 - d * u_dpr, 0.0, 1.0));
    col = mix(col, vec3(1.0), w * 0.3 * (1.0 - smoothstep(0.0, 1.3, abs(d + 0.7))));
  }
  return col;
}

void main() {
  if (v_p.x < v_clip.x || v_p.y < v_clip.y || v_p.x > v_clip.z || v_p.y > v_clip.w) discard;
  vec2 c = v_rect.xy;
  vec2 hs = v_rect.zw;
  float rad = v_shape.x;
  float press = v_shape.y;
  float kind = v_shape.z;
  float centreA = v_shape.w;
  vec2 lp = v_p - c;
  float d = sdBox(lp, hs, rad);
  float px = 1.0 / u_dpr;
  bool isBar = kind > 0.5 && kind < 1.5;
  bool isLens = kind > 1.5 && kind < 2.5;
  bool isTint = kind > 2.5 && kind < 3.5;
  bool isCard = kind > 3.5;
  float minSide = min(hs.x, hs.y);

  // Contact shadow: soft and low, outside the shape only. The lens casts none.
  float shOff = isBar ? 7.0 : (isCard ? 5.0 : 3.0 + 2.0 * press);
  float shBlur = isBar ? 22.0 : (isCard ? 18.0 : 9.0 + minSide * 0.25);
  float shA = ${byKind('shadow')} * u_shade.a;
  float ds = sdBox(lp - vec2(0.0, shOff), hs - vec2(2.0), max(rad - 2.0, 0.0));
  float sh = shA * (1.0 - smoothstep(-shBlur * 0.6, shBlur, ds));
  float cov = clamp(0.5 - d / px, 0.0, 1.0);
  vec4 shadow = vec4(u_shade.rgb * sh, sh) * (1.0 - cov);
  if (cov <= 0.0) { gl_FragColor = shadow * v_extra.x; return; }

  // Outward normal from the SDF's gradient.
  float eps = 0.5;
  vec2 n = vec2(sdBox(lp + vec2(eps, 0.0), hs, rad) - sdBox(lp - vec2(eps, 0.0), hs, rad),
                sdBox(lp + vec2(0.0, eps), hs, rad) - sdBox(lp - vec2(0.0, eps), hs, rad));
  n = length(n) > 1e-5 ? normalize(n) : vec2(0.0, -1.0);

  // The bezel: a band of fixed width at the rim that draws in what lies just outside, compressed.
  float e = max(-d, 0.0);
  float bezel = min(${byKind('bezel')}, minSide * 0.9);
  float x = clamp(e / bezel, 0.0, 1.0);
  float rim = 1.0 - x;

  // Specular: thin, following the curve, bright on the arc facing the light and fainter opposite.
  vec2 L = normalize(vec2(-0.55, -0.83));
  if (v_touch.z > 0.5) {
    vec2 toward = v_touch.xy - c;
    if (length(toward) > 1.0) L = normalize(mix(L, normalize(toward), 0.55 * press));
  }
  float facing = max(dot(n, L), 0.0);
  float away = max(dot(n, -L), 0.0);
  float lobe = pow(facing, 3.0) + 0.45 * pow(away, 4.0);
  float hair = 1.0 - smoothstep(0.0, 1.2 + px, e);
  float soft = 1.0 - smoothstep(0.0, bezel * 0.6, e);
  float k = ${byKind('rim')};
  float spec = clamp((hair * (0.03 + 0.9 * lobe) + soft * 0.3 * lobe) * k * (1.0 + 0.6 * press), 0.0, 1.0);

  // Pressing lights the glass from inside, starting under the finger.
  float glow = 0.0;
  if (v_touch.z > 0.5 && press > 0.001) {
    glow = 0.16 * press * exp(-length(v_p - v_touch.xy) / max(minSide * 1.4, 18.0));
  }

  float liftA = isLens ? mix(0.1, 0.03, press) : (isTint ? 0.0 : u_lift.a);
  vec3 tintCol = u_tint * mix(1.1, 0.9, (lp.y / hs.y) * 0.5 + 0.5);

  // Flat top: nothing is bent, so draw only the material (lift or tint) and the specular, and let the
  // real stage and content show through. The look is sampled only in the bezel.
  if (x >= 1.0) {
    vec4 body = isTint ? vec4(tintCol * 0.78, 0.78) : vec4(u_lift.rgb * liftA, liftA);
    float sa = 1.0 - (1.0 - spec) * (1.0 - glow);
    vec4 res = body * (1.0 - sa) + vec4(u_spec * sa, sa);
    float a = cov * res.a;
    gl_FragColor = (vec4(res.rgb * cov, a) + shadow * (1.0 - a)) * v_extra.x;
    return;
  }

  float D = ${byKind('D')} * mix(1.0, 1.0 + 0.2 * press, ${byKind('pressD')});
  float dg = -D * (1.0 - x) * (1.0 - x);
  float dr = dg * 0.88;
  float db = dg * 1.12;
  vec2 inward = -n;
  float pw = isCard || kind < 0.5 ? 1.0 : 1.0 - smoothstep(0.35, 1.0, x);
  vec3 col = vec3(scene(v_p + inward * dr, pw).r, scene(v_p + inward * dg, pw).g, scene(v_p + inward * db, pw).b);

  col = mix(col, u_lift.rgb, liftA);
  if (isTint) col = mix(col, tintCol, 0.78 - 0.3 * rim * rim);
  // Light gathers in the curved bezel, more on the lit side: a lift, not a ring.
  col = mix(col, u_rim, 0.12 * rim * rim * (0.35 + lobe) * k);
  col = mix(col, u_spec, spec);
  col = mix(col, u_spec, glow);

  // The bar's middle lets the content under it through (a frost layer under the canvas softens it); its
  // bezel is solid, since it shows the bent scene, and fades out to the clear middle at the top.
  float bodyA = isBar || isLens ? mix(centreA, 1.0, 1.0 - smoothstep(0.35, 1.0, x)) * (1.0 - smoothstep(0.8, 1.0, x)) : 1.0;
  bodyA = max(bodyA, spec);
  float a = cov * bodyA;
  gl_FragColor = (vec4(col * a, a) + shadow * (1.0 - a)) * v_extra.x;
}`

function compile(gl, type, src) {
  const sh = gl.createShader(type)
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh)
    gl.deleteShader(sh)
    throw new Error(`liquid glass shader: ${log}`)
  }
  return sh
}

/**
 * createGlassGL(canvas) -> { draw(frame), destroy() } or null when WebGL is unavailable, slow (a software
 * renderer) or has no highp in fragment shaders.
 * frame: { width, height, dpr, origin?, stage?, look, material?, shapes, panes? }
 *   width, height: the canvas's CSS size; origin: its top-left in viewport px ([0, 0]); stage: the
 *   viewport's CSS size, which the look is drawn for (the canvas's size);
 *   look: lib/stage-look/renderer.js lookUniformValues(...) for that stage;
 *   material: DEFAULT_MATERIAL's shape;
 *   shapes: [{ x, y, hw, hh, radius, press, kind, centreA, opacity, touch: [x, y] | null,
 *              clip: [left, top, right, bottom] | null }];
 *   panes: [{ x, y, hw, hh, radius }] (glass under this canvas, drawn into what it bends).
 * Sizes are CSS px in viewport coordinates.
 */
export function createGlassGL(canvas) {
  const gl = canvas.getContext('webgl', {
    alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false,
    preserveDrawingBuffer: false, failIfMajorPerformanceCaveat: true,
  })
  if (!gl) return null
  const precision = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)
  if (!precision || precision.precision === 0) return null
  let prog
  try {
    prog = gl.createProgram()
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || 'link failed')
  } catch (err) {
    console.warn(err)
    return null
  }
  gl.useProgram(prog)
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  const stride = FLOATS * 4
  const attrs = [['a_pos', 2, 0], ['a_rect', 4, 2], ['a_shape', 4, 6], ['a_touch', 4, 10], ['a_extra', 2, 14], ['a_clip', 4, 16]]
  for (const [name, size, off] of attrs) {
    const loc = gl.getAttribLocation(prog, name)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, off * 4)
  }
  const u = name => gl.getUniformLocation(prog, name)
  const U = {
    view: u('u_view'), origin: u('u_origin'), stage: u('u_stage'), dpr: u('u_dpr'), lift: u('u_lift'), rim: u('u_rim'),
    spec: u('u_spec'), shade: u('u_shade'), tint: u('u_tint'), panes: u('u_panes'), paneR: u('u_paneR'), paneN: u('u_paneN'),
  }
  const LU = {}
  UNIFORMS.forEach(n => { LU[n] = u(n) })
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  let data = new Float32Array(0)
  const paneRect = new Float32Array(MAX_PANES * 4)
  const paneR = new Float32Array(MAX_PANES)

  function draw({ width, height, dpr, origin = [0, 0], stage = [width, height], look, material = DEFAULT_MATERIAL, shapes, panes = [] }) {
    const w = Math.round(width * dpr)
    const h = Math.round(height * dpr)
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
    gl.viewport(0, 0, w, h)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    if (!shapes.length) return
    gl.uniform2f(U.view, width, height)
    gl.uniform2f(U.origin, origin[0], origin[1])
    gl.uniform2f(U.stage, stage[0], stage[1])
    gl.uniform1f(U.dpr, dpr)
    gl.uniform4fv(U.lift, material.lift)
    gl.uniform3fv(U.rim, material.rim)
    gl.uniform3fv(U.spec, material.spec)
    gl.uniform4fv(U.shade, material.shade)
    gl.uniform3fv(U.tint, material.tint)
    applyLookUniforms(gl, LU, look)
    const np = Math.min(panes.length, MAX_PANES)
    for (let i = 0; i < np; i++) {
      const p = panes[i]
      paneRect.set([p.x, p.y, p.hw, p.hh], i * 4)
      paneR[i] = p.radius
    }
    gl.uniform4fv(U.panes, paneRect)
    gl.uniform1fv(U.paneR, paneR)
    gl.uniform1i(U.paneN, np)
    const need = shapes.length * 6 * FLOATS
    if (data.length < need) data = new Float32Array(need)
    let o = 0
    for (const s of shapes) {
      const m = 34 // room for the shadow and the press swell
      const x0 = s.x - s.hw - m, x1 = s.x + s.hw + m, y0 = s.y - s.hh - m, y1 = s.y + s.hh + m + 8
      const t = s.touch
      const clip = s.clip || NO_CLIP
      for (const [px, py] of [[x0, y0], [x1, y0], [x0, y1], [x0, y1], [x1, y0], [x1, y1]]) {
        data[o++] = px; data[o++] = py
        data[o++] = s.x; data[o++] = s.y; data[o++] = s.hw; data[o++] = s.hh
        data[o++] = s.radius; data[o++] = s.press; data[o++] = STRENGTH[s.kind]?.id ?? 0; data[o++] = s.centreA
        data[o++] = t ? t[0] : 0; data[o++] = t ? t[1] : 0; data[o++] = t ? 1 : 0; data[o++] = 0
        data[o++] = s.opacity; data[o++] = 0
        data[o++] = clip[0]; data[o++] = clip[1]; data[o++] = clip[2]; data[o++] = clip[3]
      }
    }
    gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, o), gl.DYNAMIC_DRAW)
    gl.drawArrays(gl.TRIANGLES, 0, shapes.length * 6)
  }

  // No loseContext(): the canvas hands the same context back to the next mount (StrictMode mounts
  // twice), and a lost one would fail every compile after it.
  function destroy() {
    gl.deleteBuffer(buf)
    gl.deleteProgram(prog)
  }

  return { draw, destroy }
}
