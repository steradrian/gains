import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dayReminderPush, inviteReadyPush, inviteRequestPush, nudgePush, PUSH_URL, restTimerPush, testPush } from '../push-messages.js';

test('the invite pushes are generic: nobody named, no note, no code, in every language', () => {
  assert.deepEqual(inviteRequestPush('en'), {
    title: 'Someone asked for an invite',
    body: 'Answer it from Invite a friend.',
    tag: 'invite-request',
  });
  assert.deepEqual(inviteReadyPush('en'), {
    title: 'Your invite is ready',
    body: 'An admin made the invite you asked for.',
    tag: 'invite-ready',
  });
  assert.equal(inviteRequestPush('pt-BR').title, 'Alguém pediu um convite');
  assert.equal(inviteReadyPush('pt-BR').title, 'Seu convite está pronto');
  for (const lang of ['fr', 'xx', undefined]) {
    assert.deepEqual(inviteRequestPush(lang), inviteRequestPush('en'), String(lang));
    assert.deepEqual(inviteReadyPush(lang), inviteReadyPush('en'), String(lang));
  }
  // A lock screen shows them to whoever holds the phone: only fixed copy, nothing from a request.
  for (const p of [inviteRequestPush('en'), inviteReadyPush('en')]) {
    assert.deepEqual(Object.keys(p).sort(), ['body', 'tag', 'title']);
  }
});

test('localizes every server-generated notification in pt-BR', () => {
  assert.deepEqual(restTimerPush('pt-BR'), {
    title: 'Descanso terminado 💪',
    body: 'Hora da próxima série.',
    tag: 'rest-timer',
    url: '#/train/workout',
  });
  assert.deepEqual(testPush('pt-BR'), {
    title: 'Gains',
    body: 'Notificação de teste ✅ É assim que os alertas aparecem.',
    tag: 'test',
  });
  assert.deepEqual(dayReminderPush('pt-BR', { name: 'Treino A', emoji: '💪' }), {
    title: '💪 Treino A hoje',
    body: 'Está no seu plano. Bora treinar 💪',
    tag: 'day-reminder',
    url: '#/home',
  });
});

test('keeps the existing English copy as the fallback', () => {
  assert.deepEqual(restTimerPush('fr'), restTimerPush('en'));
  assert.equal(dayReminderPush('unknown', null).title, 'Workout planned today');
  assert.equal(testPush(undefined).body, 'Test notification ✅ This is what alerts look like.');
});

test('every push with an obvious target carries its hash route, in every language', () => {
  for (const lang of ['en', 'pt-BR', 'de', 'xx', undefined]) {
    assert.equal(restTimerPush(lang).url, '#/train/workout', lang);
    assert.equal(dayReminderPush(lang, null).url, '#/home', lang);
    for (const tone of ['friendly', 'guilt', 'drill']) {
      assert.equal(nudgePush(lang, tone, { name: 'A' }, '2026-09-04').url, '#/train/schedule', `${lang} ${tone}`);
    }
  }
  // The test alert is about the notification itself: a tap just brings the app up.
  assert.equal('url' in testPush('en'), false);
});

test('the routes the pushes name exist in the app', () => {
  const app = readFileSync(new URL('../../frontend/src/App.jsx', import.meta.url), 'utf8');
  for (const url of Object.values(PUSH_URL)) {
    assert.match(url, /^#\//);
    assert.ok(app.includes(`path="${url.slice(1)}"`), `${url} is not a route in App.jsx`);
  }
});
