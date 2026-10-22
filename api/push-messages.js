import { NUDGE_COPY } from './nudge-copy.js';
import { lineIndex } from './nudge.js';

const COPY = {
  en: {
    restTitle: 'Rest over 💪',
    restBody: 'Time for your next set.',
    testBody: 'Test notification ✅ This is what alerts look like.',
    dayFallbackTitle: 'Workout planned today',
    dayRoutineSuffix: 'today',
    dayBody: "It's on your plan. Let's go 💪",
    // Friends api m3: the evening cheer digest
    cheerOne: '{0} cheered you',
    cheerOther: '{0} and {1} other cheered you',
    cheerOthers: '{0} and {1} others cheered you',
  },
  'pt-BR': {
    restTitle: 'Descanso terminado 💪',
    restBody: 'Hora da próxima série.',
    testBody: 'Notificação de teste ✅ É assim que os alertas aparecem.',
    dayFallbackTitle: 'Treino planejado para hoje',
    dayRoutineSuffix: 'hoje',
    dayBody: 'Está no seu plano. Bora treinar 💪',
    cheerOne: '{0} torceu por você',
    cheerOther: '{0} e mais {1} pessoa torceram por você',
    cheerOthers: '{0} e mais {1} pessoas torceram por você',
  },
};

const copyFor = lang => COPY[lang] || COPY.en;

// Where a tap on each notification goes: a hash route of the app (frontend lib/tab-route.js), which
// the service worker accepts only as such (public/sw.js notificationTarget). The rest-timer alert
// is about the workout under way, the day reminder is Home's plan for today, and the missed-workout
// nudge opens the week's schedule where the skipped session sits.
export const PUSH_URL = {
  rest: '#/train/workout',
  day: '#/home',
  nudge: '#/train/schedule',
  // Friends api m3: Cheers for you
  cheers: '#/me/groups/cheers',
};

export function restTimerPush(lang) {
  const copy = copyFor(lang);
  return { title: copy.restTitle, body: copy.restBody, tag: 'rest-timer', url: PUSH_URL.rest };
}

export function testPush(lang) {
  return { title: 'Gains', body: copyFor(lang).testBody, tag: 'test' };
}

// Friends api m3: "Mara cheered you", "Mara and 1 other cheered you", "Mara and 2 others cheered you".
// `first` is the newest cheerer's name, `others` how many more people cheered.
export function cheerPush(lang, first, others) {
  const copy = copyFor(lang);
  const line = others <= 0 ? copy.cheerOne : others === 1 ? copy.cheerOther : copy.cheerOthers;
  return { title: 'Gains', body: line.replace('{1}', () => String(others)).replace('{0}', () => first), tag: 'cheer', url: PUSH_URL.cheers };
}

export function dayReminderPush(lang, routine) {
  const copy = copyFor(lang);
  return {
    title: routine
      ? `${routine.emoji || '🏋️'} ${routine.name} ${copy.dayRoutineSuffix}`
      : copy.dayFallbackTitle,
    body: copy.dayBody,
    tag: 'day-reminder',
    url: PUSH_URL.day,
  };
}

// The missed-workout nudge (nudge.js). Its copy is translated in the frontend packs and generated
// into nudge-copy.js, so every language the app speaks has it — unlike the strings above, which
// predate that and fall back to English. de-CH is de with ß written ss, as in the frontend
// (lib/i18n-core.js DERIVED_LOCALES).
const nudgeCopyFor = lang => {
  if (lang === 'de-CH') {
    const ch = s => s.replace(/ß/g, 'ss');
    return Object.fromEntries(Object.entries(NUDGE_COPY.de).map(([k, c]) => [k, { title: ch(c.title), lines: c.lines.map(ch) }]));
  }
  return NUDGE_COPY[lang] || NUDGE_COPY.en;
};
export function nudgePush(lang, tone, routine, iso) {
  const copy = nudgeCopyFor(lang)[NUDGE_COPY.en[tone] ? tone : 'friendly'];
  const line = copy.lines[lineIndex(iso, copy.lines.length)];
  const name = routine?.name || 'Gains';
  return { title: copy.title, body: line.replace('{0}', () => name), tag: 'nudge', url: PUSH_URL.nudge };
}
