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
    inviteRequestTitle: 'Someone asked for an invite',
    inviteRequestBody: 'Answer it from Invite a friend.',
    inviteReadyTitle: 'Your invite is ready',
    inviteReadyBody: 'An admin made the invite you asked for.',
  },
  'pt-BR': {
    restTitle: 'Descanso terminado 💪',
    restBody: 'Hora da próxima série.',
    testBody: 'Notificação de teste ✅ É assim que os alertas aparecem.',
    dayFallbackTitle: 'Treino planejado para hoje',
    dayRoutineSuffix: 'hoje',
    dayBody: 'Está no seu plano. Bora treinar 💪',
    inviteRequestTitle: 'Alguém pediu um convite',
    inviteRequestBody: 'Responda em Convidar um amigo.',
    inviteReadyTitle: 'Seu convite está pronto',
    inviteReadyBody: 'Um admin criou o convite que você pediu.',
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
  invite: '#/me/invite',
};

export function restTimerPush(lang) {
  const copy = copyFor(lang);
  return { title: copy.restTitle, body: copy.restBody, tag: 'rest-timer', url: PUSH_URL.rest };
}

export function testPush(lang) {
  return { title: 'Gains', body: copyFor(lang).testBody, tag: 'test' };
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

// Invite requests (invites.js). Both are seen on a lock screen, so neither names anyone nor carries
// the note or a code: the admins' says only that someone asked, the asker's only that it is done.
// A tap opens the Invite page (/me/invite): the admins' list of asks, or the asker's own.
export function inviteRequestPush(lang) {
  const copy = copyFor(lang);
  return { title: copy.inviteRequestTitle, body: copy.inviteRequestBody, tag: 'invite-request', url: PUSH_URL.invite };
}

export function inviteReadyPush(lang) {
  const copy = copyFor(lang);
  return { title: copy.inviteReadyTitle, body: copy.inviteReadyBody, tag: 'invite-ready', url: PUSH_URL.invite };
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
