/* Friends api m3, cheers over HTTP against the real server.js (clock pinned by fake-clock.mjs):
   idempotent per (from, kind, ref), Undo removes only that record, a cheer for yourself is refused,
   a non-member gets 404, bad bodies are refused field by field, the label of a new best carries
   only the viewer's own set, the list is this week's and newest first, `seen` moves only with
   ?seen=1, muted senders are silent, a left or removed group's cheers vanish, a disabled account
   is hidden in both directions without anything being purged, and a purge takes the cheers with it. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, state, workout, ALL, TODAY, MONDAY, NOT_FOUND } from './friends-server.mjs';

const cheers = '/api/friends/cheers';
const dated = `${cheers}?date=${TODAY}`;
const moment = (view, kind, uid) => view.moments.find(m => m.kind === kind && m.who.includes(uid));

// Ana: Push A on Monday with a new best at 100 kg. Bea: Legs on Monday with a new best at 60 kg.
async function setup(t, extra = {}) {
  const h = await startServer(t, { states: {
    u_ana: state({ workouts: [workout({ id: 'a1', d: MONDAY, name: 'Push A', prs: ['0085'], entries: [{ id: '0085', sets: [{ w: 100, r: 5, done: true }] }] })] }),
    u_bea: state({ workouts: [workout({ id: 'b1', d: MONDAY, name: 'Legs', routineId: 'r2', prs: ['0085'], entries: [{ id: '0085', sets: [{ w: 60, r: 8, done: true }] }] })] }),
    u_cy: state(),
    ...extra
  } });
  const gid = await h.crew(['u_ana', 'u_bea', 'u_cy']);
  const view = await h.view('u_ana', gid);
  return { h, gid, view };
}
const cheer = (h, as, body, method = 'POST') => h.req(method, dated, { as, body });
const mine = (h, as, query = '') => h.req('GET', `${dated}${query}`, { as });

test('a cheer is idempotent per (from, kind, ref); Undo removes exactly that one', async t => {
  const { h, gid, view } = await setup(t);
  const work = moment(view, 'workout', 'u_bea'), best = moment(view, 'best', 'u_bea');
  const a = { group: gid, kind: 'moment', ref: work.id }, b = { group: gid, kind: 'moment', ref: best.id };
  assert.deepEqual((await cheer(h, 'u_ana', a)).body, { ok: true });
  assert.equal((await cheer(h, 'u_ana', a)).status, 200);
  assert.equal(h.friends().cheers.length, 1, 'twice is once');
  assert.equal((await cheer(h, 'u_ana', b)).status, 200);
  assert.equal(h.friends().cheers.length, 2);

  let v = await h.view('u_ana', gid);
  assert.deepEqual([moment(v, 'workout', 'u_bea').cheered, moment(v, 'best', 'u_bea').cheered], [true, true]);
  assert.equal((await cheer(h, 'u_ana', a, 'DELETE')).status, 200);
  assert.deepEqual(h.friends().cheers.map(c => c.ref), [best.id], 'only the Undone record went');
  assert.equal((await cheer(h, 'u_ana', a, 'DELETE')).status, 200, 'a second Undo is harmless');
  v = await h.view('u_ana', gid);
  assert.deepEqual([moment(v, 'workout', 'u_bea').cheered, moment(v, 'best', 'u_bea').cheered], [false, true]);
  assert.deepEqual(h.friends().cheers[0], { from: 'u_ana', to: 'u_bea', group: gid, kind: 'moment', ref: best.id, week: MONDAY, at: h.friends().cheers[0].at });
});

test('you cannot cheer yourself, a week or a moment', async t => {
  const { h, gid, view } = await setup(t);
  const own = moment(view, 'workout', 'u_ana');
  for (const body of [
    { group: gid, kind: 'moment', ref: own.id },
    { group: gid, kind: 'week', ref: `u_ana:${MONDAY}` }
  ]) {
    const r = await cheer(h, 'u_ana', body);
    assert.deepEqual([r.status, r.body.code], [400, 'self'], JSON.stringify(body));
  }
  assert.equal(h.friends().cheers.length, 0);
});

test('a non-member gets 404 for a group, never 403; so does a moment or week that is not there', async t => {
  const { h, gid, view } = await setup(t);
  await h.on('u_dan');
  const ref = moment(view, 'workout', 'u_bea').id;
  assert.deepEqual((await cheer(h, 'u_dan', { group: gid, kind: 'moment', ref })).body, NOT_FOUND);
  assert.equal((await cheer(h, 'u_dan', { group: gid, kind: 'moment', ref }, 'DELETE')).status, 404);
  assert.equal((await cheer(h, 'u_dan', { group: 'nope', kind: 'week', ref: `u_bea:${MONDAY}` })).status, 404);
  assert.equal((await cheer(h, 'u_ana', { group: gid, kind: 'moment', ref: `workout:${MONDAY}:u_bea:zzzzzzzz` })).status, 404, 'no such moment');
  assert.equal((await cheer(h, 'u_ana', { group: gid, kind: 'week', ref: `u_dan:${MONDAY}` })).status, 404, 'not in the group');
  assert.equal((await cheer(h, 'u_ana', { group: gid, kind: 'challenge', ref: 'nochallenge' })).status, 404);
  assert.equal(h.friends().cheers.length, 0);
});

test('every body field is validated', async t => {
  const { h, gid } = await setup(t);
  const code = async body => (await cheer(h, 'u_ana', body)).body.code;
  assert.equal(await code({ group: gid, kind: 'week', ref: `u_bea:${MONDAY}`, extra: 1 }), 'bad-body');
  assert.equal(await code({ group: 'a b', kind: 'week', ref: `u_bea:${MONDAY}` }), 'bad-group');
  assert.equal(await code({ kind: 'week', ref: `u_bea:${MONDAY}` }), 'bad-group');
  assert.equal(await code({ group: gid, kind: 'nope', ref: 'x' }), 'bad-kind');
  assert.equal(await code({ group: gid, kind: 'week', ref: '' }), 'bad-ref');
  assert.equal(await code({ group: gid, kind: 'week', ref: 7 }), 'bad-ref');
  assert.equal(await code({ group: gid, kind: 'week', ref: 'x'.repeat(401) }), 'bad-ref');
  assert.equal(await code({ group: gid, kind: 'week', ref: `u_bea:2026-10-14` }), 'bad-ref', 'not a Monday');
  assert.equal(await code({ group: gid, kind: 'week', ref: 'u_bea' }), 'bad-ref');
  assert.equal(await code({ group: gid, kind: 'moment', ref: 'not a moment' }), 'bad-ref');
  assert.equal((await h.req('POST', `${cheers}?date=nope`, { as: 'u_ana', body: { group: gid, kind: 'week', ref: `u_bea:${MONDAY}` } })).body.code, 'bad-date');
  assert.equal((await h.req('GET', cheers, { as: 'u_ana' })).body.code, 'bad-date');
  assert.equal((await mine(h, 'u_ana', '&seen=2')).body.code, 'bad-seen');
});

test('GET /cheers: this week, newest first, labels from the viewer’s own data only', async t => {
  const { h, gid, view } = await setup(t);
  // Bea cheers Ana's best, Ana cheers Bea's workout, then her best, then her week.
  const bea = (await cheer(h, 'u_bea', { group: gid, kind: 'moment', ref: moment(view, 'best', 'u_ana').id })).status;
  assert.equal(bea, 200);
  await h.at(h.now + 1000);
  await cheer(h, 'u_ana', { group: gid, kind: 'moment', ref: moment(view, 'workout', 'u_bea').id });
  await h.at(h.now + 1000);
  await cheer(h, 'u_ana', { group: gid, kind: 'moment', ref: moment(view, 'best', 'u_bea').id });
  await h.at(h.now + 1000);
  await cheer(h, 'u_ana', { group: gid, kind: 'week', ref: `u_bea:${MONDAY}` });

  const forBea = await mine(h, 'u_bea');
  assert.equal(forBea.status, 200);
  assert.deepEqual(forBea.body.map(c => [c.kind, c.moment, c.label.kind]), [['week', undefined, 'week'], ['moment', 'best', 'best'], ['moment', 'workout', 'workout']]);
  const [week, best, work] = forBea.body;
  assert.deepEqual(best.label, { kind: 'best', title: best.label.title, detail: '60 kg x 8' });
  assert.ok(best.label.title.length > 0);
  assert.deepEqual(work.label, { kind: 'workout', title: 'Legs', detail: '50 min' });
  assert.deepEqual(week.from, { uid: 'u_ana', name: 'Ana' });
  assert.deepEqual(week.group, { id: gid, name: 'Iron Sunday' });
  assert.ok(!forBea.text.includes('100 kg'),"Ana's weight never reaches Bea: " + forBea.text);
  assert.ok(!JSON.stringify(forBea.body).includes('u_cy'));

  const forAna = await mine(h, 'u_ana');
  assert.equal(forAna.body.length, 1);
  assert.equal(forAna.body[0].label.detail, '100 kg x 5');
  assert.ok(!forAna.text.includes('60 kg'), "Bea's weight never reaches Ana: " + forAna.text);

  assert.deepEqual((await h.req('GET', `${cheers}?date=2026-10-21`, { as: 'u_bea' })).body, [], 'next week starts empty');
  assert.deepEqual((await mine(h, 'u_cy')).body, []);
});

test('only ?seen=1 moves the marker: the background poll marks nothing', async t => {
  const { h, gid, view } = await setup(t);
  await cheer(h, 'u_ana', { group: gid, kind: 'moment', ref: moment(view, 'workout', 'u_bea').id });
  await h.at(h.now + 1000);
  const me = async () => (await h.req('GET', `/api/friends/me?date=${TODAY}`, { as: 'u_bea' })).body;

  let m = await me();
  assert.equal(m.newCount, 3, 'one cheer and Ana’s two moments');
  assert.deepEqual([m.newest.group, m.newest.moments.length <= 2, m.newest.moments.every(x => x.names.includes('Ana'))], [gid, true, true]);
  await mine(h, 'u_bea');
  await mine(h, 'u_bea', '&seen=0');
  assert.equal((await me()).newCount, 3, 'a poll without seen=1 changes nothing');
  assert.equal(h.friends().people.u_bea.seen, undefined);

  assert.equal((await mine(h, 'u_bea', '&seen=1')).body.length, 1, 'the answer still lists them');
  m = await me();
  assert.equal(m.newCount, 0);
  assert.equal(m.newest, undefined);
  assert.equal(typeof h.friends().people.u_bea.seen, 'string');
});

test('a muted sender is silent: stored and listed, not counted as new', async t => {
  const { h, gid } = await setup(t);
  await h.req('PUT', `/api/friends/groups/${gid}/mutes`, { as: 'u_bea', body: { uid: 'u_ana', muted: true } });
  assert.equal((await cheer(h, 'u_ana', { group: gid, kind: 'week', ref: `u_bea:${MONDAY}` })).status, 200);
  assert.equal((await mine(h, 'u_bea')).body.length, 1);
  assert.equal((await h.req('GET', `/api/friends/me?date=${TODAY}`, { as: 'u_bea' })).body.newCount, 0);
});

test('a group left or removed from takes its cheers out of the list', async t => {
  const { h, gid } = await setup(t);
  await cheer(h, 'u_cy', { group: gid, kind: 'week', ref: `u_bea:${MONDAY}` });
  await cheer(h, 'u_ana', { group: gid, kind: 'week', ref: `u_bea:${MONDAY}` });
  assert.equal((await mine(h, 'u_bea')).body.length, 2);
  const out = await h.req('POST', `/api/friends/groups/${gid}/members/u_cy/remove`, { as: 'u_ana', body: {} });
  assert.equal(out.status, 200, out.text);
  assert.deepEqual((await mine(h, 'u_bea')).body.map(c => c.from.uid), ['u_ana'], 'removed: her cheers go');
  assert.equal((await cheer(h, 'u_cy', { group: gid, kind: 'week', ref: `u_bea:${MONDAY}` })).status, 404);
  assert.equal((await h.req('POST', `/api/friends/groups/${gid}/leave`, { as: 'u_ana', body: {} })).status, 200);
  assert.deepEqual((await mine(h, 'u_bea')).body, [], 'left: hers go too');
  assert.ok(!h.friends().cheers.some(c => c.from === 'u_ana' || c.from === 'u_cy'));
});

test('a disabled account is hidden in both directions and nothing is purged; enable brings it back', async t => {
  const { h, gid } = await setup(t);
  await cheer(h, 'u_ana', { group: gid, kind: 'week', ref: `u_bea:${MONDAY}` });
  await cheer(h, 'u_bea', { group: gid, kind: 'week', ref: `u_ana:${MONDAY}` });
  const snapshot = JSON.stringify(h.friends().cheers);
  const disable = disabled => h.req('POST', '/api/admin/user/disable', { as: 'u_root', body: { id: 'u_ana', disabled } });

  assert.equal((await disable(true)).status, 200);
  assert.deepEqual((await mine(h, 'u_bea')).body, [], 'her cheer is not listed');
  assert.equal((await h.view('u_bea', gid)).cheersForMe, 0, 'nor counted');
  assert.equal((await cheer(h, 'u_cy', { group: gid, kind: 'week', ref: `u_ana:${MONDAY}` })).status, 404, 'a disabled target cannot be cheered');
  assert.equal(JSON.stringify(h.friends().cheers), snapshot, 'records untouched');

  assert.equal((await disable(false)).status, 200);
  assert.equal((await mine(h, 'u_bea')).body.length, 1);
  assert.equal((await h.view('u_bea', gid)).cheersForMe, 1);
});

test('the admin’s delete removes the cheers the person sent and got', async t => {
  const { h, gid } = await setup(t);
  await cheer(h, 'u_ana', { group: gid, kind: 'week', ref: `u_bea:${MONDAY}` });
  await cheer(h, 'u_bea', { group: gid, kind: 'week', ref: `u_cy:${MONDAY}` });
  await cheer(h, 'u_cy', { group: gid, kind: 'week', ref: `u_ana:${MONDAY}` });
  const r = await h.req('POST', '/api/admin/user/delete', { as: 'u_root', body: { id: 'u_bea' } });
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(h.friends().cheers.map(c => [c.from, c.to]), [['u_cy', 'u_ana']]);
});

test('cheers older than 14 days are dropped on the next write', async t => {
  const { h, gid } = await setup(t);
  await cheer(h, 'u_ana', { group: gid, kind: 'week', ref: `u_bea:${MONDAY}` });
  await h.at(h.now + 15 * 86400000);
  await cheer(h, 'u_cy', { group: gid, kind: 'week', ref: `u_bea:${MONDAY}` });
  assert.deepEqual(h.friends().cheers.map(c => c.from), ['u_cy']);
});
