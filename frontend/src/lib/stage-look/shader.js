// The look engine's constants and GLSL: one fragment shader draws every look as luminance on top of
// the exact stage gradient. Ported as is from the Background Lab (themes-v2.html); do not tune it here.

export const LOOK_INDEX = { silk: 0, bloom: 1, linen: 4, lines: 7, plain: 9, florals: 12 }

// Geometry of Today (390 x 844 CSS px), from the design.
export const GEOM = { w: 390, h: 844, header: 36, heroText: 150, hero: 196, label: 484, content: 604 }
export const CALM = { keep: 0.10, inner: 0.83, radius: 135 }   // calm under the whole ring (r <= 112), easing out over the next 23 px
export const FADE = { headerFrom: 0.02, headerTo: 0.14, headerKeep: 0.06, from: 0.36, to: 0.68, keep: 0.06 }   // 'from'/'to' are along the stage gradient
export const REST = { top: 0.68, end: 0.34, darkMid: 0.18 }
export const PLAIN = { glow1: [370, 60, 210.43, 0.5], glow2: [30, 640, 203.65, 0.28], rings: [360, 170], intensity: 0.45 }

export const VERT = `attribute vec2 aPos; varying vec2 vUv;
void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.0,1.0); }`

export const FRAG = `precision highp float;
varying vec2 vUv;
uniform vec2 uRes;        // device px
uniform float uDpr;       // device px per CSS px
uniform float uPhase;     // 0..1, loops seamlessly
uniform float uComp;      // look index, see LOOK_INDEX
uniform float uSeed;
uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; // art stops, linear light
uniform vec3 uTop; uniform vec3 uEnd; uniform vec3 uGlow;   // sRGB: the design's stage
uniform float uCalm;
uniform vec4 uZone;       // calm zone: xy centre, zw radii (0..1 of the canvas, y from the top)
uniform float uGrain;
uniform float uProgress;  // Plate: 0..1 on its first ring
uniform vec3 uAccent;     // linear light
uniform float uIntensity; // 0..1
uniform float uHub;       // Plate hub radius (screen height = 2 units)
uniform float uFade;      // 1 = quiet under the header and below the hero
uniform float uInkDir;    // Florals: 1 draws lighter lines (dark stage), -1 deeper ones (light stage)
uniform float uDecor;     // Plain's rings, strength multiplier (light stages need more)
uniform vec3 uDecorC;     // Plain's ring color, sRGB (white except on some light stages)
#define TAU 6.28318530718
#define A0 0.75398   // resting angle: the still frame every look is designed around
#define REST_TOP ${REST.top.toFixed(3)}
#define REST_END ${REST.end.toFixed(3)}
#define DARK_MID ${REST.darkMid.toFixed(3)}

// ---- shared noise ----
float hash21(vec2 p){ p = fract(p*vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x*p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*f*(f*(f*6.0 - 15.0) + 10.0);
  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0)), c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p){
  float s = 0.0, w = 0.5;
  for (int i = 0; i < 4; i++){ s += w*vnoise(p); p = mat2(1.6, 1.2, -1.2, 1.6)*p + 3.1; w *= 0.5; }
  return s;
}

// Signed distance (approx.) to a wavy edge; > 0 is the sheet's side.
float edgeDist(vec2 p, vec2 dir, float off, float bend, float freq, float ph){
  vec2 n = normalize(dir);
  vec2 t = vec2(-n.y, n.x);
  return dot(p, n) - off - bend*sin(dot(p, t)*freq + ph);
}

// Silk: fabric sheets laid back to front. Each sheet has a rolled lip and casts a soft shadow on the one behind.
float silk(vec2 p, float a){
  float lum = 0.05 + 0.10*smoothstep(-1.2, 1.4, p.y - 0.4*p.x);
  for (int i = 0; i < 3; i++){
    float fi = float(i);
    vec2 dir = i == 0 ? vec2(0.62, 1.0) : (i == 1 ? vec2(-0.95, 0.6) : vec2(0.35, -1.0));
    float off = i == 0 ? -0.55 : (i == 1 ? 0.05 : 0.62);
    float s = edgeDist(p, dir, off + 0.06*sin(A0 + fi*2.0) + 0.018*sin(a + fi*2.0), 0.30 - 0.05*fi, 1.5 + 0.35*fi,
                       0.7 + fi*1.9 + uSeed + 0.45*sin(A0 + fi) + 0.12*sin(a + fi));
    float m = smoothstep(-0.006, 0.006, s);
    float ss = smoothstep(-0.46, 0.0, s) * step(s, 0.0);
    lum *= 1.0 - 0.62*ss*ss;
    float curl = exp(-s*s*90.0);
    float base = i == 1 ? 0.22 : (i == 0 ? 0.15 : 0.09);
    float body = base + 0.38*smoothstep(0.0, 0.40, s) - 0.16*smoothstep(0.40, 1.5, s);
    lum = mix(lum, body + 0.20*curl + 0.06*exp(-s*s*14.0), m);
  }
  return lum;
}

// Bloom: soft blobs merged with a smooth union, inflated with a rounded bevel so they read as volume.
float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5*(b - a)/k, 0.0, 1.0); return mix(b, a, h) - k*h*(1.0 - h); }
float blobSD(vec2 p, float a){
  float d = 10.0;
  for (int i = 0; i < 5; i++){
    float fi = float(i);
    vec2 c = vec2(0.50*sin(A0 + fi*2.3 + uSeed) * (0.55 + 0.12*fi),
                  0.78*cos(A0 + fi*2.9 + 0.6*uSeed) * (0.50 + 0.11*fi) - 0.10)
           + 0.035*vec2(sin(a + fi*1.3), cos(a + fi*0.7));
    float r = 0.20 + 0.09*mod(fi*1.618, 1.0) + 0.02*sin(A0 + fi) + 0.006*sin(a + fi);
    d = smin(d, length((p - c)*vec2(1.0, 0.86)) - r, 0.30);
  }
  return d;
}
float bloomH(vec2 p, float a){
  float D = max(-blobSD(p, a), 0.0);
  float x = min(D, 0.30)/0.30;
  return sqrt(x*(2.0 - x));
}
float bloom(vec2 p, float a){
  float e = 0.018;
  float sd = blobSD(p, a);
  float h  = bloomH(p, a);
  float hx = bloomH(p + vec2(e, 0.0), a);
  float hy = bloomH(p + vec2(0.0, e), a);
  vec3 n = normalize(vec3(-(hx - h)/e*0.34, -(hy - h)/e*0.34, 1.0));
  vec3 L = normalize(vec3(-0.45, 0.75, 0.50));
  float diff = clamp(dot(n, L), 0.0, 1.0);
  float spec = pow(clamp(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 10.0);
  float rim  = pow(1.0 - n.z, 1.3);
  float back = clamp(dot(normalize(n.xy + 1e-4), normalize(-L.xy))*0.5 + 0.5, 0.0, 1.0);
  float inside = 0.08 + 0.42*diff*diff + 0.22*spec + 0.60*rim*mix(0.25, 1.0, back);
  float bg = 0.04 + 0.05*smoothstep(1.2, -1.0, p.y) + 0.14*exp(-max(sd, 0.0)*7.0);
  return mix(bg, inside, smoothstep(0.004, -0.004, sd));
}

// Linen: irregular threads running both ways, with one soft drape across the cloth.
// The threads are a material, so they cover the whole stage evenly (see main); only the drape is quieted.
float linenThreads(vec2 p){
  float F = uRes.y / (uDpr * 3.8);                      // a thread every ~1.9 CSS px
  vec2 u = p*F;
  float th = 0.46*vnoise(vec2(u.x*0.05 + uSeed*13.0, u.y)) + 0.40*vnoise(vec2(u.x, u.y*0.05) + 17.0) + 0.14*vnoise(u*2.1 + 5.0);
  return smoothstep(1.6, 3.2, uRes.y*0.5/F) * (th - 0.5);  // threads only where pixels are dense enough (2x screens and up)
}
float linen(vec2 p, float a){
  float s = edgeDist(p, vec2(0.6, 1.0), -0.1 + 0.05*sin(A0) + 0.015*sin(a), 0.35, 1.3, 0.8 + uSeed + 0.3*sin(A0) + 0.08*sin(a));
  float drape = smoothstep(-0.9, 0.9, s), fold = exp(-s*s*6.0);
  float light = smoothstep(-1.2, 1.2, p.y*0.8 - p.x*0.4);
  return 0.06 + 0.08*light + 0.16*drape + 0.24*fold;
}

// Lines: thin parallel strands on a gently bent flow, heavier and brighter toward the light.
float flowF(vec2 p, float a){
  vec2 o = 0.035*vec2(cos(a), sin(a));
  return dot(p, vec2(0.447, 0.894))
       + 0.20*sin(1.15*p.x + 1.7 + uSeed + o.x*4.0)
       + 0.13*sin(1.8*p.y - 0.7*p.x + 0.6 + o.y*4.0)
       + 0.12*(fbm(p*0.55 + vec2(uSeed*1.9, 0.3) + o) - 0.5);
}
float lines(vec2 p, float a){
  float e = 0.002;
  float f = flowF(p, a);
  float gl = max(length(vec2(flowF(p + vec2(e, 0.0), a) - f, flowF(p + vec2(0.0, e), a) - f)/e), 1e-4);
  float D = 8.0 * 2.0 / (uRes.y / uDpr);                  // a strand every 8 CSS px
  float k = floor(f/D + 0.5);
  float dpx = abs(f/D - k) * D / gl * uRes.y * 0.5;
  float light = smoothstep(-1.0, 1.3, p.y*0.9 - p.x*0.5 + 0.25*sin(A0 + 0.2*sin(a)));
  float w = max(mix(0.55, 1.35, light)*uDpr, 0.7);
  float line = (1.0 - smoothstep(w*0.5 - 0.5, w*0.5 + 0.5, dpx)) * smoothstep(0.6, 2.0, uDpr*8.0/2.0);
  return 0.07 + 0.06*light + line*(0.12 + 0.34*light);
}

// Florals: line-art flowers, buds and leaf sprigs, like an engraved print. Sized in CSS px; each motif sways a few degrees.
// On a light stage the lines go deeper than the stage (a printed pattern); on a dark one, lighter (embroidery).
mat2 rot2(float t){ float c = cos(t), s = sin(t); return mat2(c, -s, s, c); }
float sdVesica(vec2 p, float r, float d){
  p = abs(p); float b = sqrt(r*r - d*d);
  return ((p.y - b)*d > p.x*b) ? length(p - vec2(0.0, b)) : length(p - vec2(-d, 0.0)) - r;
}
float sdEllipseA(vec2 p, vec2 r){ float k0 = length(p/r), k1 = length(p/(r*r)); return k0*(k0 - 1.0)/max(k1, 1e-4); }   // first-order distance, fine for thin lines
float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; return length(pa - ba*clamp(dot(pa, ba)/dot(ba, ba), 0.0, 1.0)); }
float flowerD(vec2 q, float R, float n, out float vein){
  float sec = TAU / n;
  float th = atan(q.y, q.x);
  float tf = mod(th + sec*0.5, sec) - sec*0.5;
  vec2 f = length(q) * vec2(cos(tf), sin(tf));
  float petal = sdEllipseA(f - vec2(R*0.56, 0.0), vec2(R*0.46, R*0.25));
  vein = sdSeg(f, vec2(R*0.26, 0.0), vec2(R*0.66, 0.0));
  float core = abs(length(q) - R*0.15);
  return min(abs(petal), core);
}
float leafD(vec2 q, float L){ return abs(sdVesica(q, L*0.62, L*0.42)); }
float florals(vec2 p, float a){
  vec2 css = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
  css += 7.0*vec2(sin(a), cos(a)*0.6);                 // the whole print drifts a few px around its rest
  float cell = 78.0;
  float w = 0.62, aa = 0.65/uDpr;                      // line half-width in CSS px
  float ink = 0.0, soft = 0.0;
  vec2 base = floor(css/cell) - 1.0;
  for (int j = 0; j < 9; j++){
    vec2 id = base + vec2(float(j - (j/3)*3), float(j/3));
    vec2 hs = id + uSeed*5.3;
    float r = hash21(hs);
    vec2 cp = (id + 0.5)*cell + (vec2(hash21(hs + 3.1), hash21(hs + 7.7)) - 0.5)*cell*0.62;
    float sway = 0.06*sin(a + TAU*hash21(hs + 9.4));
    vec2 q = rot2(TAU*hash21(hs + 1.9) + sway) * (css - cp);
    float d = 1e3, dv = 1e3;
    if (r < 0.58){                                       // open flower, 5 or 6 petals
      float R = mix(16.0, 28.0, hash21(hs + 2.2));
      float n = hash21(hs + 4.4) < 0.6 ? 5.0 : 6.0;
      float v; d = flowerD(q, R, n, v); dv = v;
      vec2 sq = q - vec2(0.0, R*0.95);                   // a short stem and one leaf
      d = min(d, sdSeg(q, vec2(0.0, R*0.18), vec2(R*0.08, R*1.9)) + (length(q) < R*0.98 ? 1e3 : 0.0));
      d = min(d, leafD(rot2(0.7) * (sq - vec2(R*0.38, R*0.45)), R*0.62));
    } else if (r < 0.72){                                // bud
      float R = mix(7.0, 11.0, hash21(hs + 2.2));
      d = min(abs(sdVesica(q, R, R*0.55)), sdSeg(q, vec2(0.0, R*0.8), vec2(R*0.2, R*2.6)));
      d = min(d, leafD(rot2(-0.6) * (q - vec2(-R*0.55, R*1.9)), R*0.9));
    } else if (r < 0.92){                                // leaf sprig: a curved stem with leaves along it
      float L = mix(10.0, 14.0, hash21(hs + 2.2));
      float bend = 0.010;
      vec2 sq = vec2(q.x - bend*q.y*q.y, q.y);
      d = sdSeg(sq, vec2(0.0, -L*1.75), vec2(0.0, L*1.6));
      for (int k = 0; k < 3; k++){
        float yy = (float(k) - 1.0) * L*1.2;
        float sd = (k == 1) ? -1.0 : 1.0;
        d = min(d, leafD(rot2(sd*0.75) * (sq - vec2(sd*L*0.55, yy)), L));
      }
    } else {                                             // a few seeds
      d = length(q) - 1.1;
      d = min(d, length(q - vec2(5.0, 3.0)) - 0.9);
    }
    ink = max(ink, 1.0 - smoothstep(w - aa, w + aa, d));
    ink = max(ink, 0.55*(1.0 - smoothstep(w*0.8 - aa, w*0.8 + aa, dv)));
  }
  soft = fbm(p*0.9 + vec2(0.06*sin(a), 0.04*cos(a)) + uSeed);
  return 0.16 + 0.05*soft + ink*0.62;
}

vec3 ramp(float x){
  vec3 c = mix(uC0, uC1, smoothstep(0.0, 0.34, x));
  c = mix(c, uC2, smoothstep(0.34, 0.68, x));
  c = mix(c, uC3, smoothstep(0.68, 1.0, x));
  return c;
}
float hash(vec2 p){ p = fract(p*vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y)*p.x); }
vec3 toSrgb(vec3 c){ return mix(12.92*c, 1.055*pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }

void main(){
  float a = TAU * uPhase;
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);                     // y from the top, like CSS
  vec2 size = uRes / uDpr;                                  // CSS px
  vec2 css = uv * size;
  vec2 p = (vUv - 0.5) * vec2(uRes.x/uRes.y, 1.0) * 2.0;

  // The design's stage: linear-gradient(170deg, stage 0px, stage-end 900px), mixed in sRGB.
  float gl = size.x*0.173648 + size.y*0.984808;
  float g = clamp(((css.x - size.x*0.5)*0.173648 + (css.y - size.y*0.5)*0.984808 + gl*0.5) / 900.0, 0.0, 1.0);
  vec3 col = mix(uTop, uEnd, g);

  if (uComp > 8.5 && uComp < 9.5) {
    // Plain: the design's two accent glows and plate rings, exactly as drawn. 45% intensity = the design.
    float k = clamp(uIntensity / ${PLAIN.intensity.toFixed(2)}, 0.0, 2.0);
    float a1 = ${PLAIN.glow1[3]}*k*clamp(1.0 - length(css - vec2(${PLAIN.glow1[0]}.0, ${PLAIN.glow1[1]}.0))/${PLAIN.glow1[2]}, 0.0, 1.0);
    col = mix(col, uGlow, a1);
    float a2 = ${PLAIN.glow2[3]}*k*clamp(1.0 - length(css - vec2(${PLAIN.glow2[0]}.0, ${PLAIN.glow2[1]}.0))/${PLAIN.glow2[2]}, 0.0, 1.0);
    col = mix(col, uGlow, a2);
    float dr = length(css - vec2(${PLAIN.rings[0]}.0, ${PLAIN.rings[1]}.0));
    float aa = 0.5/uDpr;
    float clip = step(${PLAIN.rings[0] - 320}.0, css.x) * step(css.y, ${PLAIN.rings[1] + 320}.0);   // the rings' SVG box clips them
    col = mix(col, uDecorC, clip*0.07*uDecor*k*(1.0 - smoothstep(28.0 - aa, 28.0 + aa, abs(dr - 300.0))));
    col = mix(col, uDecorC, clip*0.12*uDecor*k*(1.0 - smoothstep(0.75 - aa, 0.75 + aa, abs(dr - 256.0))));
    gl_FragColor = vec4(col, 1.0);
    return;
  }

  float lum;
  if (uComp < 0.5) lum = silk(p, a);
  else if (uComp < 1.5) lum = bloom(p, a);
  else if (uComp < 4.5) lum = linen(p, a);
  else if (uComp < 7.5) lum = lines(p, a);
  else lum = florals(p, a);
  lum = clamp(lum, 0.0, 1.0);

  // How much of the look shows here: quiet under the header and below the hero, calm behind the hero.
  float I = uIntensity;
  I *= 1.0 - (1.0 - ${FADE.keep.toFixed(3)})*uFade*smoothstep(${FADE.from.toFixed(3)}, ${FADE.to.toFixed(3)}, g * 900.0 / size.y);   // follows the 170deg gradient
  I *= 1.0 - (1.0 - ${FADE.headerKeep.toFixed(3)})*uFade*(1.0 - smoothstep(${FADE.headerFrom.toFixed(3)}, ${FADE.headerTo.toFixed(3)}, uv.y));
  float zd = length((uv - uZone.xy) / uZone.zw);
  I *= mix(1.0, ${CALM.keep.toFixed(3)}, (1.0 - smoothstep(${CALM.inner.toFixed(3)}, 1.0, zd)) * uCalm);

  // The look moves the stage away from rest along the ramp; the difference is added to the exact gradient.
  float L0 = mix(REST_TOP, REST_END, g);
  float dev = (lum - DARK_MID) * uInkDir;
  vec3 lin1 = ramp(clamp(L0 + dev*I, 0.0, 1.0));
  col = clamp(col + toSrgb(lin1) - toSrgb(ramp(L0)), 0.0, 1.0);
  if (uComp > 3.5 && uComp < 4.5) col += linenThreads(p) * 0.045 * clamp(uIntensity / 0.45, 0.0, 2.0);
  col += (hash(gl_FragCoord.xy) - 0.5) * uGrain / 255.0;
  gl_FragColor = vec4(col, 1.0);
}`
