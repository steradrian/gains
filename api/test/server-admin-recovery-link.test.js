/* POST /api/admin/user/recovery-link: the way back in for someone who lost their only passkey.
   The admin's link signs the old device out first, then is redeemed once through the ordinary
   device-link routes. Real server.js in a child, the same harness as server-passkeys.test.js; the
   new device's authenticator is a software P-256 key that makes "none" attestations. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createDeviceLink } from '../device-link.js';
import { MAX_PASSKEYS } from '../passkeys-store.js';
import { boundPort } from './helpers.mjs';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SECRET = crypto.randomBytes(32).toString('hex');
const ORIGIN = 'http://localhost:8080';
const b64u = b => Buffer.from(b).toString('base64url');
const sha = b => crypto.createHash('sha256').update(b).digest();
const session = (uid, sv = 0) => {
  const payload = `${uid}:${Date.now() + 86400000}:${sv}`;
  return 'gymsid=' + payload + '.' + crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
};

// Just enough CBOR for an attestation object: a map of text keys to text, bytes or an empty map.
const cborHead = (major, n) => n < 24 ? Buffer.from([(major << 5) | n])
  : n < 256 ? Buffer.from([(major << 5) | 24, n]) : Buffer.from([(major << 5) | 25, n >> 8, n & 255]);
const cborText = s => Buffer.concat([cborHead(3, Buffer.byteLength(s)), Buffer.from(s)]);
const cborBytes = b => Buffer.concat([cborHead(2, b.length), b]);
// A new device's passkey, as navigator.credentials.create() would hand it back.
function newDevice() {
  const { publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = publicKey.export({ format: 'jwk' });
  const cose = Buffer.concat([
    Buffer.from([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20]), Buffer.from(jwk.x, 'base64url'),
    Buffer.from([0x22, 0x58, 0x20]), Buffer.from(jwk.y, 'base64url')
  ]);
  const raw = crypto.randomBytes(16);
  const id = b64u(raw);
  return {
    id,
    attestation(challenge) {
      const clientDataJSON = Buffer.from(JSON.stringify({ type: 'webauthn.create', challenge, origin: ORIGIN, crossOrigin: false }));
      const len = Buffer.from([raw.length >> 8, raw.length & 255]);
      const authData = Buffer.concat([sha('localhost'), Buffer.from([0x45]), Buffer.alloc(4), Buffer.alloc(16), len, raw, cose]);
      const attestationObject = Buffer.concat([
        Buffer.from([0xa3]), cborText('fmt'), cborText('none'), cborText('attStmt'), Buffer.from([0xa0]),
        cborText('authData'), cborBytes(authData)
      ]);
      return {
        id, rawId: id, type: 'public-key', clientExtensionResults: {}, authenticatorAttachment: 'platform',
        response: { clientDataJSON: b64u(clientDataJSON), attestationObject: b64u(attestationObject), transports: ['internal'] }
      };
    }
  };
}

const user = (id, name, extra = {}) => ({ id, name, created: new Date().toISOString(), ...extra });
const lost = { id: 'lost-passkey', userId: 'f1', publicKey: 'x', counter: 0 };

async function startServer(t, { users, creds = [lost], deviceLinks = [] }) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-recover-'));
  fs.writeFileSync(path.join(dataDir, 'secret'), SECRET, { mode: 0o600 });
  fs.writeFileSync(path.join(dataDir, 'db.json'), JSON.stringify({ users, creds, subs: [], invites: [], deviceLinks }));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: API, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN, RP_ID: 'localhost', ADMIN_UIDS: 'a2', AUDIT_LOG: '1', TRUST_PROXY: '1', PASSWORD_LOGIN: '' }
  });
  const h = { log: '', dataDir };
  child.stdout.on('data', d => h.log += d);
  child.stderr.on('data', d => h.log += d);
  t.after(() => { child.kill('SIGKILL'); fs.rmSync(dataDir, { recursive: true, force: true }); });
  h.api = `http://127.0.0.1:${await boundPort(child, () => h.log)}`;
  h.req = async (method, p, { body, cookie, ip = '198.51.100.7' } = {}) => {
    const r = await fetch(h.api + p, {
      method,
      headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin', 'X-Forwarded-For': ip, ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const set = r.headers.getSetCookie().find(c => c.startsWith('gymsid=') && !c.startsWith('gymsid=;'));
    return { status: r.status, body: await r.json(), cookie: set ? set.split(';')[0] : null };
  };
  h.recover = (id, as = 'a1') => h.req('POST', '/api/admin/user/recovery-link', { body: { id }, cookie: session(as) });
  h.db = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'db.json'), 'utf8'));
  h.audit = () => { try { return fs.readFileSync(path.join(dataDir, 'audit.log'), 'utf8').trim().split('\n').map(l => JSON.parse(l)); } catch { return []; } };
  return h;
}
// Redeemed as the new device would: options, then the passkey it makes.
async function redeem(h, code, device, ip = '198.51.100.8') {
  const opt = await h.req('POST', '/api/device-link/options', { body: { code }, ip });
  if (opt.status !== 200) return opt;
  return h.req('POST', '/api/device-link/verify', { body: { code, cid: opt.body.cid, credential: device.attestation(opt.body.options.challenge), name: 'New phone' }, ip });
}

const ADMIN = user('a1', 'Root', { admin: true });

test('only an admin can make one, never for an admin, a disabled or a full profile', async t => {
  const full = Array.from({ length: MAX_PASSKEYS }, (_, i) => ({ id: 'k' + i, userId: 'f3', publicKey: 'x', counter: 0 }));
  const h = await startServer(t, {
    users: [ADMIN, user('a2', 'Other admin'), user('f1', 'Fia'), user('f2', 'Gus', { disabled: true }), user('f3', 'Hal')],
    creds: [lost, ...full]
  });
  const before = h.db();
  assert.equal((await h.req('POST', '/api/admin/user/recovery-link', { body: { id: 'f1' } })).status, 401);
  assert.equal((await h.recover('f1', 'f3')).status, 403);
  assert.deepEqual(await h.recover('a2'), { status: 400, body: { error: 'an admin adds their own passkeys in Settings' }, cookie: null });
  assert.equal((await h.recover('a1')).status, 400, 'nor for themselves');
  assert.equal((await h.recover('nobody')).status, 404);
  assert.equal((await h.recover('f2')).body.code, 'disabled');
  assert.equal((await h.recover('f3')).body.code, 'passkey-limit');
  // A refusal changes nothing: no session version bumped, no link made.
  assert.deepEqual(h.db(), before);
});

test('signs the profile out everywhere first, then the code adds one passkey on a new device, once', async t => {
  // A device link the lost phone made before it went missing: it must not survive the recovery.
  const seed = { deviceLinks: [] };
  const stale = createDeviceLink(seed, 'f1');
  const h = await startServer(t, { users: [ADMIN, user('f1', 'Fia')], deviceLinks: seed.deviceLinks });

  const oldCookie = session('f1');
  assert.equal((await h.req('GET', '/api/me', { cookie: oldCookie })).status, 200);
  const pair = await h.req('POST', '/api/pair/create', { cookie: oldCookie });
  assert.equal(pair.status, 200);

  const made = await h.recover('f1');
  assert.equal(made.status, 200, JSON.stringify(made.body));
  const { code, link, expires, name } = made.body;
  assert.equal(name, 'Fia');
  assert.match(code, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  assert.equal(link, `${ORIGIN}/?link=${encodeURIComponent(code)}`);
  assert.ok(expires > Date.now() + 9 * 60000 && expires <= Date.now() + 10 * 60000);
  assert.doesNotMatch(fs.readFileSync(path.join(h.dataDir, 'db.json'), 'utf8'), new RegExp(code));

  // Whoever has the old phone is out: its session, its pairing code and its device link.
  assert.equal(h.db().users.find(u => u.id === 'f1').sv, 1);
  assert.equal((await h.req('GET', '/api/me', { cookie: oldCookie })).status, 401);
  assert.equal((await h.req('POST', '/api/pair/redeem', { body: { code: pair.body.code } })).status, 400);
  assert.equal((await h.req('POST', '/api/device-link/options', { body: { code: stale.code } })).body.code, 'link-invalid');
  assert.ok(h.audit().some(e => e.ev === 'admin.recovery.link' && e.uid === 'a1' && e.tgt === 'f1'));

  // The new phone redeems it and is signed in as Fia, under the new session version.
  const phone = newDevice();
  const done = await redeem(h, code, phone);
  assert.equal(done.status, 200, JSON.stringify(done.body));
  assert.deepEqual(done.body.user, { id: 'f1', name: 'Fia', admin: false });
  assert.equal((await h.req('GET', '/api/me', { cookie: done.cookie })).body.user.id, 'f1');
  assert.deepEqual(h.db().creds.filter(c => c.userId === 'f1').map(c => c.id).sort(), [lost.id, phone.id].sort());
  assert.ok(h.audit().some(e => e.ev === 'auth.link.ok' && e.uid === 'f1'));

  // Once only.
  const again = await redeem(h, code, newDevice());
  assert.equal(again.status, 400);
  assert.equal(again.body.code, 'link-invalid');
  assert.equal(h.db().creds.filter(c => c.userId === 'f1').length, 2);
});
