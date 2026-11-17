// The line-art for empty states (ds/StageEmpty `illustration`): six small scenes in the onboarding's
// own vocabulary (illustration-scenes.js: il, il-d, il-mute, il-floor, il-acc, il-dot), so they
// draw in the same way (Illustration's stroke-dash draw-on) and are white on the stage. Stroke
// only, on a 320-wide viewBox with the floor at y 116. `__ID__` is not used.
export const EMPTY_SCENES = {
  bell: {
    viewBox: '0 0 320 128',
    svg: '<path class="il-floor" d="M16 116 H304"/><path class="il il-d" d="M160 36 V28"/><path class="il" d="M126 90 C134 80 136 70 136 58 a24 24 0 0 1 48 0 C184 70 186 80 194 90 Z"/><path class="il" d="M120 90 H200"/><path class="il" d="M152 100 a8 8 0 0 0 16 0"/><path class="il-acc" d="M208 50 a30 30 0 0 1 8 20"/><path class="il-acc" d="M112 50 a30 30 0 0 0 -8 20"/>',
  },
  dumbbell: {
    viewBox: '0 0 320 128',
    svg: '<path class="il-floor" d="M16 116 H304"/><path class="il" d="M100 88 H220"/><rect class="il" x="84" y="64" width="16" height="48" rx="4"/><rect class="il" x="220" y="64" width="16" height="48" rx="4"/><rect class="il il-d" x="68" y="74" width="12" height="28" rx="4"/><rect class="il il-d" x="240" y="74" width="12" height="28" rx="4"/><path class="il-acc" d="M140 88 H180"/>',
  },
  plate: {
    viewBox: '0 0 320 128',
    svg: '<path class="il-floor" d="M16 116 H304"/><circle class="il" cx="160" cy="72" r="44"/><circle class="il il-d il-mute" cx="160" cy="72" r="30"/><circle class="il" cx="160" cy="72" r="8"/><circle class="il-acc" cx="160" cy="72" r="37" pathLength="1" stroke-dasharray=".25 1" transform="rotate(-90 160 72)"/>',
  },
  calendar: {
    viewBox: '0 0 320 128',
    svg: '<path class="il-floor" d="M16 116 H304"/><rect class="il" x="104" y="28" width="112" height="88" rx="12"/><path class="il" d="M104 54 H216"/><path class="il" d="M132 20 V36 M188 20 V36"/><circle class="il il-d il-mute" cx="132" cy="76" r="3"/><circle class="il il-d il-mute" cx="160" cy="76" r="3"/><circle class="il il-d il-mute" cx="132" cy="96" r="3"/><circle class="il il-d il-mute" cx="160" cy="96" r="3"/><circle class="il il-d il-mute" cx="188" cy="96" r="3"/><circle class="il-dot" cx="188" cy="76" r="3"/>',
  },
  chart: {
    viewBox: '0 0 320 128',
    svg: '<path class="il-floor" d="M16 116 H304"/><rect class="il il-d" x="104" y="80" width="24" height="36" rx="4"/><rect class="il il-d" x="148" y="60" width="24" height="56" rx="4"/><rect class="il-acc" x="192" y="36" width="24" height="80" rx="4"/><path class="il-mute il-d" d="M96 44 H224" stroke-dasharray="6 6"/>',
  },
  search: {
    viewBox: '0 0 320 128',
    svg: '<path class="il-floor" d="M16 116 H304"/><circle class="il" cx="146" cy="62" r="34"/><path class="il" d="M171 87 L200 114"/><path class="il-acc" d="M126 60 a20 20 0 0 1 14 -18"/>',
  },
}

export const EMPTY_SCENE_NAMES = Object.keys(EMPTY_SCENES)
