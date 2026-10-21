/* PUSH_SCHEDULER=external, the cutover's second switch: og-api's own day-reminder tick, missed-workout
   nudge tick and Coach proposal push go quiet (no send, and none of the state they would have
   written: lastReminder, lastNudge), and everything else stays. Unset, `local` or empty: all three
   work as ever. Real server.js in a child, REMINDER_TICK_MS shortened, so the evening nudge and the
   due reminder are set up the way server-nudge.test.js and server-reminder.test.js set them up. A
   send shows in the log whatever happens to it afterwards (the test endpoint is never contacted). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort, sampleState } from './helpers.mjs';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SECRET = crypto.randomBytes(32).toString('hex');
const ORIGIN = 'http://localhost:8080';
const UID = 'u_psch_1';
const cookie = (() => {
  const payload = `${UID}:${Date.now() + 86400000}:0`;
  return `gymsid=${payload}.${crypto.createHmac('sha256', SECRET).update(payload).digest('base64url')}`;
})();
const SUB = { userId: UID, endpoint: 'https://localhost/x', keys: { p256dh: 'p', auth: 'a' }, deviceId: 'dev_psch0001', created: '2026-01-01T00:00:00.000Z' };

// `coach` is the base URL of the Coach's provider, when the test wants the Coach on.
async function startServer(t, env = {}, { coach = '' } = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-psch-'));
  fs.writeFileSync(path.join(dataDir, 'secret'), SECRET, { mode: 0o600 });
  fs.writeFileSync(path.join(dataDir, 'db.json'), JSON.stringify({
    users: [{ id: UID, name: 'One', created: new Date().toISOString() }], creds: [], invites: [], subs: [SUB]
  }));
  if (coach) {
    fs.writeFileSync(path.join(dataDir, 'coach.json'), JSON.stringify({
      enabled: true, provider: 'compatible', models: { compatible: 'model-a' }, providerOptions: { compatible: { baseUrl: coach } }
    }));
  }
  const child = spawn(process.execPath, ['server.js'], {
    cwd: API, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN, RP_ID: 'localhost', AUDIT_LOG: '0', REMINDER_TICK_MS: '200', PUSH_SCHEDULER: '', PUSH_SUBS_READONLY: '', ...env }
  });
  const h = { dataDir, log: '' };
  child.stdout.on('data', d => h.log += d);
  child.stderr.on('data', d => h.log += d);
  t.after(() => { child.kill('SIGKILL'); fs.rmSync(dataDir, { recursive: true, force: true }); });
  h.api = `http://127.0.0.1:${await boundPort(child, () => h.log)}`;
  h.write = state => fs.writeFileSync(path.join(dataDir, `state-${UID}.json`), JSON.stringify(state));
  h.user = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'db.json'), 'utf8')).users[0];
  h.call = (method, p, body) => fetch(h.api + p, {
    method, headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: cookie }, ...(body ? { body: JSON.stringify(body) } : {})
  });
  return h;
}

const wait = ms => new Promise(r => setTimeout(r, ms));
async function until(pred, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end && !pred()) await wait(100);
}
const sent = log => /push (endpoint refused|send failed) u_psch_1/.test(log);
const reminderFirings = log => (log.match(/reminder firing u_psch_1 r1/g) || []).length;
const nudgeFirings = log => (log.match(/nudge firing u_psch_1 r1/g) || []).length;
const EXTERNAL_LINE = /PUSH_SCHEDULER=external/;

// An Etc/GMT zone whose local hour is `hour` right now (POSIX sign: Etc/GMT-5 is UTC+5).
function zoneAt(hour) {
  let off = (hour - new Date().getUTCHours() + 48) % 24;
  if (off > 14) off -= 24;
  return off === 0 ? 'UTC' : off > 0 ? `Etc/GMT-${off}` : `Etc/GMT+${-off}`;
}
const dateIn = (tz, ms = Date.now()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const routines = [{ id: 'r1', name: 'Push Day', emoji: '💪', ex: [] }];
const everyDay = { 0: 'r1', 1: 'r1', 2: 'r1', 3: 'r1', 4: 'r1', 5: 'r1', 6: 'r1' };

// Yesterday trained, today planned and not logged, 20:xx there: a nudge is owed, the 08:00 reminder is long past.
const missedToday = tz => ({
  reminder: { on: true, time: '08:00', tz, nudge: true, tone: 'drill' },
  routines, week: everyDay, workouts: [{ id: 'w1', d: dateIn(tz, Date.now() - 86400000), routineId: 'r1' }]
});
// A reminder whose minute passed 3 minutes ago, UTC, nothing logged today, nudge off.
function dueReminder() {
  const d = new Date(Date.now() - 3 * 60000);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', hour12: false, hour: '2-digit', minute: '2-digit' }).formatToParts(d);
  const g = type => parts.find(p => p.type === type)?.value;
  if (d.getUTCDate() !== new Date().getUTCDate()) return null;
  return { reminder: { on: true, time: `${g('hour')}:${g('minute')}`, tz: 'UTC' }, routines, week: everyDay, workouts: [] };
}

for (const env of [{ PUSH_SCHEDULER: 'external' }, { PUSH_SCHEDULER: ' External ' }]) {
  test(`PUSH_SCHEDULER=${JSON.stringify(env.PUSH_SCHEDULER)}: a due day reminder is not sent and lastReminder is not stamped`, async t => {
    const state = dueReminder();
    if (!state) return t.skip('just after midnight UTC: a same-day window cannot be set up');
    const h = await startServer(t, env);
    h.write(state);
    await wait(1500);  // seven ticks, far more than a local tick needs
    assert.equal(reminderFirings(h.log), 0, h.log);
    assert.equal(sent(h.log), false, h.log);
    assert.equal(h.user().lastReminder, undefined);
  });
}

test('PUSH_SCHEDULER=external: a due missed-workout nudge is not sent and lastNudge is not stamped', async t => {
  const tz = zoneAt(20);
  const h = await startServer(t, { PUSH_SCHEDULER: 'external' });
  h.write(missedToday(tz));
  await wait(1500);
  assert.equal(nudgeFirings(h.log), 0, h.log);
  assert.equal(sent(h.log), false, h.log);
  assert.equal(h.user().lastNudge, undefined);
});

test('PUSH_SCHEDULER=external: one boot line says so; local says nothing', async t => {
  const ext = await startServer(t, { PUSH_SCHEDULER: 'external' });
  assert.equal((ext.log.match(new RegExp(EXTERNAL_LINE, 'g')) || []).length, 1, ext.log);
  const local = await startServer(t, { PUSH_SCHEDULER: 'local' });
  assert.doesNotMatch(local.log, EXTERNAL_LINE);
});

for (const [name, env] of [['unset', {}], ['empty', { PUSH_SCHEDULER: '' }], ['local', { PUSH_SCHEDULER: 'local' }]]) {
  test(`PUSH_SCHEDULER ${name}: the day reminder and the nudge fire once, and are stamped, as ever`, async t => {
    const tz = zoneAt(20);
    const h = await startServer(t, env);
    h.write(missedToday(tz));
    await until(() => h.user().lastNudge);
    assert.equal(nudgeFirings(h.log), 1, h.log);
    assert.equal(h.user().lastNudge, dateIn(tz));
    const state = dueReminder();
    if (!state) return;
    h.write(state);
    await until(() => h.user().lastReminder);
    assert.equal(reminderFirings(h.log), 1, h.log);
    assert.ok(h.user().lastReminder);
  });
}

test('PUSH_SCHEDULER=wat: refuses to start rather than guess which side sends', async t => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-psch-'));
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dataDir, 'secret'), SECRET, { mode: 0o600 });
  const child = spawn(process.execPath, ['server.js'], {
    cwd: API, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN, RP_ID: 'localhost', PUSH_SCHEDULER: 'wat' }
  });
  let log = '';
  child.stdout.on('data', d => log += d);
  child.stderr.on('data', d => log += d);
  const giveUp = setTimeout(() => child.kill('SIGKILL'), 10000);
  const code = await new Promise(res => child.once('exit', res));
  clearTimeout(giveUp);
  assert.equal(code, 1, log);
  assert.match(log, /PUSH_SCHEDULER/);
});

/* The Coach proposal push. A review over a state with history finishes `ready` (a proposal is
   pending); local, the hook sends the "your Coach has been reading" push.

   The provider is an OpenAI-compatible endpoint on localhost, answering with one change, not the
   fixture CLI: a provider that spawns a process is refused on Linux unless the server is root with a
   `coach` user (spawn.js canDropPrivileges), which a CI runner is not, so the fixture passes on a
   laptop and answers 503 `unprivileged` there. An HTTP provider spawns nothing and is not asked. */
async function coachProvider(t) {
  const day = sampleState().workouts[0].d;
  const answer = {
    coach_contract: 1,
    summary: 'Top sets at RPE 10 on the dumbbell press; one set less.',
    evidence: { from: day, to: day, sessions: 1 },
    changes: [{ id: 'c1', type: 'sets', target: { routineId: 'r1', exId: '0001' }, before: 3, after: 2, why: 'stalls ≥ 2 and every top set at RPE 10' }],
    notes: []
  };
  const server = http.createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(answer) }, finish_reason: 'stop' }] }));
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => { server.closeAllConnections(); server.close(); });
  return `http://127.0.0.1:${server.address().port}`;
}

async function coachReview(t, env) {
  const h = await startServer(t, env, { coach: await coachProvider(t) });
  h.write({ ...sampleState(), reminder: { on: false } });
  const r = await h.call('POST', '/api/coach/review', {});
  assert.equal(r.status, 202, await r.text());
  const end = Date.now() + 20000;
  let pending = null;
  while (Date.now() < end && !pending) {
    pending = (await (await h.call('GET', '/api/coach/status')).json()).pending;
    if (!pending) await wait(100);
  }
  assert.ok(pending?.changes?.length, 'the review finished with a proposal:\n' + h.log);
  return h;
}

test('PUSH_SCHEDULER=external: a ready Coach proposal sends no push', async t => {
  const h = await coachReview(t, { PUSH_SCHEDULER: 'external' });
  await wait(800);
  assert.equal(sent(h.log), false, h.log);
});

test('PUSH_SCHEDULER local: a ready Coach proposal sends its push, as ever', async t => {
  const h = await coachReview(t, {});
  await until(() => sent(h.log), 5000);
  assert.equal(sent(h.log), true, h.log);
});

test('PUSH_SCHEDULER=external leaves the rest alone: subscribe, unsubscribe, test push and rest-timer all work', async t => {
  const h = await startServer(t, { PUSH_SCHEDULER: 'external' });
  const sub = { endpoint: 'https://push.example.test/new', keys: { p256dh: 'p', auth: 'a' } };
  assert.equal((await h.call('POST', '/api/push/subscribe', { subscription: sub, deviceId: 'dev_psch0002' })).status, 200);
  assert.equal((await h.call('POST', '/api/push/rest-timer', { seconds: 60, deviceId: 'dev_psch0002' })).status, 200);
  assert.equal((await h.call('POST', '/api/push/rest-timer/cancel', { deviceId: 'dev_psch0002' })).status, 200);
  assert.equal((await h.call('POST', '/api/push/test', {})).status, 200);
  await until(() => sent(h.log), 5000);
  assert.equal(sent(h.log), true, 'the test push is a send like any other: ' + h.log);
  assert.equal((await h.call('POST', '/api/push/unsubscribe', { endpoint: sub.endpoint })).status, 200);
});
