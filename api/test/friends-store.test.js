/* friends.json (friends/store.js): a missing or damaged file starts empty and never stops the
   boot, a damaged one is kept aside first, keys this version does not know survive a rewrite, and
   a change that throws, or a write that fails, leaves memory and disk exactly as they were. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tempData } from './helpers.mjs';

const dir = tempData();
const { createFriendsStore, emptyFriends, normalizeFriends, FRIENDS_FILE } = await import('../friends/store.js');

const fresh = name => path.join(dir, name);

test('the server store lives in DATA as friends.json', () => {
  assert.equal(FRIENDS_FILE, path.join(dir, 'friends.json'));
});

test('a missing file starts empty and is not created by reading', () => {
  const file = fresh('missing.json');
  const store = createFriendsStore(file);
  assert.deepEqual(store.read(), emptyFriends());
  assert.equal(fs.existsSync(file), false);
});

test('a damaged file starts empty, is kept aside, and is only replaced by the next change', () => {
  for (const [i, text] of ['{"people": {', '[]', 'null', '"text"', ''].entries()) {
    const file = fresh(`damaged-${i}.json`);
    fs.writeFileSync(file, text);
    const store = createFriendsStore(file);
    assert.deepEqual(store.read(), emptyFriends(), JSON.stringify(text));
    const aside = fs.readdirSync(dir).filter(n => n.startsWith(`damaged-${i}.json.unreadable-`));
    assert.equal(aside.length, 1, 'kept aside');
    assert.equal(fs.readFileSync(path.join(dir, aside[0]), 'utf8'), text);
    assert.equal(fs.readFileSync(file, 'utf8'), text, 'untouched until something changes');
    store.mutate(d => { d.people.u1 = { on: true }; });
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')).people, { u1: { on: true } });
  }
});

test('a change is written at once, mode 0600, and a change that changes nothing writes nothing', () => {
  const file = fresh('write.json');
  const store = createFriendsStore(file);
  const out = store.mutate(d => { d.groups.g1 = { id: 'g1', members: [] }; return 'done'; });
  assert.equal(out, 'done');
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')).groups, { g1: { id: 'g1', members: [] } });
  fs.utimesSync(file, new Date(0), new Date(0));
  store.mutate(() => {});
  store.mutate(d => { d.groups.g1.members = []; });
  assert.equal(fs.statSync(file).mtimeMs, 0, 'not rewritten');
});

test('keys this version does not know are kept on rewrite', () => {
  const file = fresh('future.json');
  fs.writeFileSync(file, JSON.stringify({ ...emptyFriends(), digest: { u1: '2026-10-20' }, groups: { g1: { id: 'g1', members: [], banner: 'x' } } }));
  const store = createFriendsStore(file);
  store.mutate(d => { d.people.u2 = { on: false }; });
  const back = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(back.digest, { u1: '2026-10-20' });
  assert.equal(back.groups.g1.banner, 'x');
});

test('a top-level key of the wrong type is replaced by an empty one of the right type', () => {
  const d = normalizeFriends({ people: [], groups: 'x', invites: null, invitations: {}, challenges: 3, cheers: 'y', other: 1 });
  assert.deepEqual(d, { ...emptyFriends(), other: 1 });
});

test('a change that throws leaves memory and disk as they were', () => {
  const file = fresh('throws.json');
  const store = createFriendsStore(file);
  store.mutate(d => { d.people.u1 = { on: true }; });
  const disk = fs.readFileSync(file, 'utf8');
  assert.throws(() => store.mutate(d => { d.people.u1.on = false; d.people.u2 = { on: true }; throw new Error('refused'); }), /refused/);
  assert.deepEqual(store.read().people, { u1: { on: true } });
  assert.equal(fs.readFileSync(file, 'utf8'), disk);
});

test('a write that fails leaves memory as it was', () => {
  const store = createFriendsStore(path.join(dir, 'no-such-dir', 'friends.json'));
  assert.throws(() => store.mutate(d => { d.people.u1 = { on: true }; }));
  assert.deepEqual(store.read(), emptyFriends());
});
