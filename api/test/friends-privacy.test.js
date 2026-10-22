/* Friends api m2: the share projection is the privacy boundary. Bea's state holds everything that
   must never leave the server: set weights and reps, body weight, a weight target, foods with
   their calories and protein, photos, notes on the workout and on an exercise, a custom exercise,
   a workout marked "Don't share this one", and extra keys inside targetsReached. For every
   combination of her four switches, with her per-workout `share` flags in place, Ana reads the
   group, Bea's member page, the group list and her own /me, and every answer is walked: no key
   outside the allow-list, no string or number from a forbidden field, and each switch gates
   exactly what it names. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, state, workout, walk, ALL, TODAY } from './friends-server.mjs';

const SECRET_STRINGS = ['SECRET', 'Pistachio', 'gelato', 'Hidden Session', 'custom-ex', 'IMG_', 'Europe/'];
const SECRET_NUMBERS = [142.5, 23, 81.7, 79.3, 2345, 187, 99991, 61.25, 1200];
const ALLOWED_KEYS = new Set([
  // GroupSummary, GroupBrief, Group
  'id', 'name', 'since', 'memberCount', 'members', 'uid', 'initial', 'week', 'done', 'planned', 'noPlan', 'streak',
  'goalLine', 'kind', 'n', 'goal', 'creator', 'isCreator', 'targets', 'hit', 'of', 'weekDays', 'date', 'workouts',
  'muted', 'you', 'challenges', 'moments', 'who', 'title', 'detail', 'minutes', 'exercises', 'exercise', 'target',
  'days', 'at', 'label', 'cheered', 'mine', 'cheersForMe', 'quiet', 'muteNotifications', 'togetherOff',
  // Member
  'recent', 'consistency', 'share', 'reached', 'bests', 'shares', 'training',
  // FriendsMe
  'on', 'groups', 'invitations', 'newCount', 'code', 'from',
  // Friends api m3: ids, names and titles only (me-extras.js, challenge-data.js, cheers.js)
  'challengeInvites', 'cid', 'newest', 'names', 'perPerson', 'state', 'invited', 'count', 'total', 'start', 'end',
  'template', 'span', 'startedBy', 'ref', 'moment', 'group'
]);

// Bea's whole life, of which only the shared parts may leave.
const BEA = state({
  unit: 'kg', targetW: 79.3,
  bodyweight: [{ d: '2026-10-12', w: 81.7 }],
  customEx: [{ id: 'custom-ex-1', name: 'SECRET custom lift' }],
  photos: [{ id: 'IMG_SECRET', d: '2026-10-12' }],
  diary: { '2026-10-13': { items: [{ name: 'Pistachio gelato', kcal: 2345, protein: 187 }] } },
  nutrition: { kcalTarget: 2345, proteinTarget: 187 },
  reminder: { on: true, time: '07:00', tz: 'Europe/Bucharest' },
  routines: [{ id: 'r1', name: 'Push A', ex: [{ id: '0085', weight: 142.5, reps: 23 }] }, { id: 'r2', name: 'Legs', ex: [] }],
  targetsReached: {
    '2026-10-12': { all: true, protein: true, kcal: 2345 },
    '2026-10-13': { all: false, protein: true, food: 'Pistachio gelato' },
    '2026-10-14': { all: true, protein: true, note: 'SECRET' }
  },
  workouts: [
    workout({
      id: 'b1', d: '2026-10-12', name: 'Push A', min: 52, prs: ['0085'], bw: 81.7, vol: 99991, notes: 'SECRET workout note',
      media: [{ hash: 'SECRETMEDIA', kind: 'photo' }],
      entries: [
        { id: '0085', note: 'SECRET entry note', topW: 142.5, sets: [{ w: 142.5, r: 23, done: true, rpe: 9 }] },
        { id: 'custom-ex-1', sets: [{ w: 81.7, r: 23, done: true }] }
      ]
    }),
    workout({
      id: 'b2', d: '2026-10-13', name: 'Hidden Session', routineId: 'r9', min: 47, prs: ['0032'], share: { off: true }, notes: 'SECRET hidden',
      entries: [{ id: '0032', sets: [{ w: 142.5, r: 23, done: true }] }]
    }),
    workout({
      id: 'b3', d: '2026-10-14', name: 'Legs', routineId: 'r2', min: 38, prs: ['0001', 'custom-ex-1'], share: { best: ['0001', 'custom-ex-1'] },
      entries: [{ id: '0001', sets: [{ w: 61.25, r: 23, done: true }] }, { id: 'custom-ex-1', sets: [{ w: 1200, r: 23, done: true }] }]
    }),
    workout({ id: 'b0', d: '2026-09-30', name: 'Push A', min: 40 })
  ]
});
// Ana trains Push A the same Monday: a Trained together with Bea, when Bea shares training.
const ANA = state({ workouts: [workout({ id: 'a1', d: '2026-10-12', name: 'Push A', min: 45 })] });

function assertClean(label, body) {
  walk(body,
    key => assert.ok(ALLOWED_KEYS.has(key), `${label}: key "${key}" is not on the allow-list`),
    (v, at) => {
      if (typeof v === 'string') for (const s of SECRET_STRINGS) assert.ok(!v.includes(s), `${label}: "${s}" at ${at}`);
      if (typeof v === 'number') assert.ok(!SECRET_NUMBERS.includes(v), `${label}: ${v} at ${at}`);
    });
}

const combos = () => {
  const out = [];
  for (let i = 0; i < 16; i++) out.push({ training: !!(i & 1), consistency: !!(i & 2), targets: !!(i & 4), bests: !!(i & 8) });
  return out;
};

test('every combination of the four switches: nothing forbidden leaves, and each switch gates what it names', async t => {
  const h = await startServer(t, { states: { u_ana: ANA, u_bea: BEA } });
  const gid = await h.crew(['u_ana', 'u_bea']);
  for (const share of combos()) {
    const tag = JSON.stringify(share);
    await h.share('u_bea', share);

    const group = await h.view('u_ana', gid);
    assertClean(`group ${tag}`, group);
    const memberR = await h.member('u_ana', gid, 'u_bea');
    assert.equal(memberR.status, 200, memberR.text);
    const member = memberR.body;
    assertClean(`member ${tag}`, member);
    const list = await h.req('GET', `/api/friends/groups?date=${TODAY}`, { as: 'u_ana' });
    assertClean(`list ${tag}`, list.body);
    const me = await h.req('GET', `/api/friends/me?date=${TODAY}`, { as: 'u_ana' });
    assertClean(`me ${tag}`, me.body);

    // The ring always counts her sessions, the one she did not share included.
    const row = group.members.find(m => m.uid === 'u_bea');
    assert.deepEqual([row.done, row.planned], [3, 3], tag);
    assert.deepEqual([member.week.done, member.week.planned], [3, 3], tag);
    assert.deepEqual(member.shares, share, tag);

    // training: which workout, when, how long; never the one marked off.
    const beaMoments = group.moments.filter(m => m.who.includes('u_bea'));
    const kinds = new Set(beaMoments.map(m => m.kind));
    assert.equal('recent' in member, share.training, `recent ${tag}`);
    assert.equal('days' in member.week, share.training, `days ${tag}`);
    assert.equal(kinds.has('workout'), share.training, `workout moments ${tag}`);
    assert.equal(kinds.has('together'), share.training, `together ${tag}`);
    if (share.training) {
      assert.deepEqual(member.recent.map(r => [r.title, r.date, r.minutes]), [['Legs', '2026-10-14', 38], ['Push A', '2026-10-12', 52], ['Push A', '2026-09-30', 40]]);
      assert.deepEqual(member.week.days, [true, false, true, false, false, false, false], 'the day she did not share shows no dot');
      assert.deepEqual(group.weekDays.map(d => d.workouts), [2, 0, 1, 0, 0, 0, 0]);
      const legs = beaMoments.find(m => m.kind === 'workout' && m.title === 'Legs');
      assert.deepEqual(legs.detail, { minutes: 38, exercises: 2 });
      assert.deepEqual(legs.label, { title: 'Legs' });
    } else {
      assert.deepEqual(group.weekDays.map(d => d.workouts), [1, 0, 0, 0, 0, 0, 0], 'only Ana');
      assert.ok(!JSON.stringify(group).includes('Legs'), tag);
    }

    // consistency: 8 weeks, a share of planned done.
    assert.equal('consistency' in member, share.consistency, `consistency ${tag}`);
    if (share.consistency) assert.equal(member.consistency.length, 8);

    // targets: yes or no per day, nothing else of the day.
    assert.equal('targets' in member, share.targets, `targets ${tag}`);
    // Both joined on Wednesday, so each needs 4 of their 5 days (week.js targetsWeek); Ana shares
    // targets with no day reached, Bea's Monday is before she joined.
    assert.deepEqual(group.targets, share.targets ? { hit: 1, of: 8 } : { hit: 0, of: 4 }, `group targets ${tag}`);
    if (share.targets) assert.deepEqual(member.targets, { reached: 2, of: 3, days: [true, false, true, null, null, null, null] });

    // bests: the catalogue exercise and the date. Her per-workout share of 0001 holds with the switch
    // off; the best in the workout marked off never shows, nor a custom exercise.
    const bestIds = (member.bests || []).map(b => b.id).sort();
    assert.deepEqual(bestIds, share.bests ? ['0001', '0085'] : ['0001'], `bests ${tag}`);
    assert.deepEqual(beaMoments.filter(m => m.kind === 'best').map(m => m.detail.exercise).sort(), share.bests ? ['0001', '0085'] : ['0001'], tag);
    assert.ok(!JSON.stringify([group, member]).includes('0032'), `a best of the unshared workout ${tag}`);
  }
});

test('a member with every switch off shows the ring numbers and nothing else', async t => {
  const h = await startServer(t, { states: { u_ana: ANA, u_bea: BEA } });
  const gid = await h.crew(['u_ana', 'u_bea']);
  await h.share('u_bea', { training: false, consistency: false, targets: false, bests: false });
  const STRIPPED = state({ workouts: BEA.workouts.map(w => ({ ...w, share: undefined })), targetsReached: BEA.targetsReached });
  await h.state('u_bea', STRIPPED);
  const member = (await h.member('u_ana', gid, 'u_bea')).body;
  assert.deepEqual(Object.keys(member).sort(), ['cheered', 'name', 'shares', 'since', 'uid', 'week']);
  assert.deepEqual(member.week, { done: 3, planned: 3 });
  const group = await h.view('u_ana', gid);
  assert.deepEqual(group.moments.filter(m => m.who.includes('u_bea')), []);
  assertClean('stripped group', group);
});

test('what Bea sees of herself is still only her projection', async t => {
  const h = await startServer(t, { states: { u_ana: ANA, u_bea: BEA } });
  const gid = await h.crew(['u_ana', 'u_bea'], { share: ALL });
  const self = await h.member('u_bea', gid, 'u_bea');
  assert.equal(self.status, 200, self.text);
  assertClean('self', self.body);
  assertClean('own group', await h.view('u_bea', gid));
});
