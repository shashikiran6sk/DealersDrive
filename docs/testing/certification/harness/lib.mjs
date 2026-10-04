// Certification harness — shared helpers.
//
// Auth provenance is recorded on every result:
//   FAKE-OTP     real server sign-in route, PHONE_OTP_DRIVER=fake (MSG91 simulated)
//   SIM-GOOGLE   an oauth_identities row inserted directly (Google unreachable)
//   SIM-SESSION  an ADMIN session row inserted directly (admin sign-in is Google-only)
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..', '..', '..', '..');
const requireApi = createRequire(resolve(ROOT, 'apps/api/package.json'));
const pg = requireApi('pg');

export const CERT = resolve(here, '..');
export const API = process.env.CERT_API ?? 'http://localhost:4000';
export const API_RL = process.env.CERT_API_RL ?? 'http://localhost:4001';
export const DB_URL =
  process.env.CERT_DB ?? 'postgresql://dealersdrive:dealersdrive@localhost:5432/dealersdrive_cert';
export const OTP = '123456';

export const pool = new pg.Pool({ connectionString: DB_URL, max: 8 });
export async function q(sql, params = []) {
  return (await pool.query(sql, params)).rows;
}
export async function one(sql, params = []) {
  return (await q(sql, params))[0];
}

let seq = Number(process.env.CERT_SEQ ?? Date.now() % 1_000_000);
export function nonce() {
  seq += 1;
  return `${seq}${randomBytes(3).toString('hex')}`;
}
let phoneSeq = Number(String(Date.now()).slice(-6));
/** A synthetic Indian mobile: 9 + 9 digits, unique per run. */
export function phone() {
  phoneSeq += 1;
  return `+9196${String(phoneSeq % 100_000_000).padStart(8, '0')}`;
}
export function regNo() {
  const letters = 'ABCDEFGHJKLMNPRSTUVWXYZ';
  const pick = () => letters[Math.floor(Math.random() * letters.length)];
  return `TN${String(10 + Math.floor(Math.random() * 89))}${pick()}${pick()}${String(1000 + Math.floor(Math.random() * 8999))}`;
}
export function otpToken(e164, code = OTP) {
  return `dev-otp:${e164.replace(/^\+/, '')}:${code}:${nonce()}`;
}

/** Minimal HTTP client with a cookie jar per actor. */
export async function call(method, path, { body, cookie, headers = {}, base = API, raw } = {}) {
  const started = Date.now();
  const init = { method, headers: { ...headers }, redirect: 'manual' };
  if (cookie) init.headers.cookie = cookie;
  if (raw !== undefined) init.body = raw;
  else if (body !== undefined) {
    init.headers['content-type'] = 'application/json';
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const res = await fetch(base + path, init);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return {
    status: res.status,
    json,
    text,
    headers: Object.fromEntries(res.headers.entries()),
    setCookie: res.headers.getSetCookie?.() ?? [],
    ms: Date.now() - started,
    method,
    path,
  };
}
export function sessionCookieOf(res) {
  const c = res.setCookie.find((x) => x.startsWith('dd_session='));
  return c ? c.split(';')[0] : null;
}

export function actor(name, cookie, extra = {}) {
  const a = {
    name,
    cookie,
    ...extra,
    get: (p, o = {}) => call('GET', p, { ...o, cookie: a.cookie }),
    post: (p, body, o = {}) => call('POST', p, { ...o, body, cookie: a.cookie }),
    put: (p, body, o = {}) => call('PUT', p, { ...o, body, cookie: a.cookie }),
    patch: (p, body, o = {}) => call('PATCH', p, { ...o, body, cookie: a.cookie }),
    del: (p, o = {}) => call('DELETE', p, { ...o, cookie: a.cookie }),
  };
  return a;
}
export const anon = actor('anonymous', null);

/** Customer sign-in through the real routes (FAKE-OTP). Signs up on first use. */
export async function customer(name, e164 = phone(), base = API) {
  const r = await call('POST', '/v1/auth/sign-in/phone/customer', {
    base,
    body: { phone: e164, accessToken: otpToken(e164) },
  });
  if (r.status !== 200) throw new Error(`customer sign-in ${r.status} ${r.text}`);
  let cookie = sessionCookieOf(r);
  if (r.json?.status === 'NAME_REQUIRED') {
    const s = await call('POST', '/v1/auth/sign-up/customer', {
      base,
      body: { signUpToken: r.json.signUpToken, fullName: name },
    });
    if (s.status !== 200 && s.status !== 201) throw new Error(`sign-up ${s.status} ${s.text}`);
    cookie = sessionCookieOf(s);
  }
  const user = await one('SELECT id FROM users WHERE phone = $1', [e164]);
  return actor(name, cookie, { phone: e164, userId: user?.id, auth: 'FAKE-OTP' });
}

/** Dealer phone sign-in through the real route (FAKE-OTP). */
export async function dealerPhone(name, e164 = phone()) {
  const r = await call('POST', '/v1/auth/sign-in/phone/dealer', {
    body: { phone: e164, accessToken: otpToken(e164) },
  });
  if (r.status !== 200) throw new Error(`dealer sign-in ${r.status} ${r.text}`);
  const user = await one('SELECT id FROM users WHERE phone = $1', [e164]);
  return actor(name, sessionCookieOf(r), { phone: e164, userId: user.id, auth: 'FAKE-OTP' });
}

/** Link a Google identity directly (SIM-GOOGLE). */
export async function simulateGoogleLink(userId, email) {
  await q(
    `INSERT INTO oauth_identities (id, "userId", provider, "providerSubject", email, "emailVerified", "updatedAt")
     VALUES ($1, $2, 'GOOGLE', $3, $4, true, now())`,
    [randomUUID(), userId, `sim-${nonce()}`, email],
  );
  await q(`UPDATE users SET email = COALESCE(email, $2), "emailVerifiedAt" = now() WHERE id = $1`, [
    userId,
    email,
  ]);
}

/** Mint a session row exactly as SessionService.issue() would (SIM-SESSION). */
export async function mintSession(userId, scope, ttlSeconds = scope === 'ADMIN' ? 43200 : 2592000) {
  const token = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(token).digest('hex');
  await q(
    `INSERT INTO sessions (id, "userId", "tokenHash", scope, "expiresAt") VALUES ($1,$2,$3,$4, now() + ($5 || ' seconds')::interval)`,
    [randomUUID(), userId, hash, scope, String(ttlSeconds)],
  );
  return `dd_session=${token}`;
}
export async function admin(email = process.env.CERT_ADMIN_EMAIL) {
  const u = await one('SELECT id FROM users WHERE email = $1', [email]);
  return actor(`admin<${email}>`, await mintSession(u.id, 'ADMIN'), {
    userId: u.id,
    auth: 'SIM-SESSION',
  });
}

// ─── results ────────────────────────────────────────────────────────────────
const RESULTS_DIR = process.env.CERT_RESULTS_DIR
  ? resolve(process.env.CERT_RESULTS_DIR)
  : resolve(CERT, 'registry', 'results');
mkdirSync(RESULTS_DIR, { recursive: true });

export function recorder(area) {
  const file = resolve(RESULTS_DIR, `${area}.json`);
  const store = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  const evidence = [];
  const api = {
    /** status: PASS | FAIL | BLOCKED | NOT_APPLICABLE */
    rec(id, status, { layers = ['API'], note = '', ev = [], bug = null, auth = null } = {}) {
      store[id] = {
        status,
        layers,
        note,
        evidence: ev.map(compact),
        bug,
        auth,
        area,
        at: new Date().toISOString(),
      };
      const mark = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '·';
      console.log(`${mark} ${id.padEnd(20)} ${status.padEnd(15)} ${note}`.slice(0, 220));
    },
    ev(...items) {
      evidence.push(...items.map(compact));
    },
    save() {
      writeFileSync(file, `${JSON.stringify(store, null, 2)}\n`);
      if (evidence.length) {
        const dir = process.env.CERT_RESULTS_DIR
          ? resolve(process.env.CERT_RESULTS_DIR, 'evidence', area)
          : resolve(CERT, 'evidence', area);
        mkdirSync(dir, { recursive: true });
        writeFileSync(resolve(dir, 'api-log.json'), `${JSON.stringify(evidence, null, 2)}\n`);
      }
    },
  };
  return api;
}

const SECRET_KEYS = /token|cookie|signature|accessToken|signUpToken|uploadUrl|url/i;
/** Evidence is sanitised: no tokens, cookies, signatures or signed URLs. */
export function compact(x) {
  if (!x || typeof x !== 'object' || !('status' in x) || !('path' in x)) return scrub(x);
  return {
    req: `${x.method} ${x.path.replace(/signature=[^&]+/g, 'signature=<redacted>')}`,
    status: x.status,
    body: scrub(x.json ?? (x.text ? x.text.slice(0, 300) : null)),
  };
}
function scrub(v, depth = 0) {
  if (v === null || typeof v !== 'object') return v;
  if (depth > 4) return '…';
  if (Array.isArray(v)) return v.slice(0, 5).map((x) => scrub(x, depth + 1));
  const out = {};
  for (const [k, val] of Object.entries(v)) {
    if (SECRET_KEYS.test(k) && typeof val === 'string') out[k] = '<redacted>';
    else if (k === 'phone' && typeof val === 'string') out[k] = val.replace(/\d(?=\d{4})/g, '•');
    else out[k] = scrub(val, depth + 1);
  }
  return out;
}

export function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/** Run a check; a thrown error becomes a FAIL with the message, never a silent skip. */
export async function check(r, id, fn, opts = {}) {
  try {
    const out = await fn();
    const status = out?.status ?? 'PASS';
    r.rec(id, status, { ...opts, ...(out ?? {}) });
    return out;
  } catch (error) {
    r.rec(id, 'FAIL', { ...opts, note: `harness assertion: ${error.message}`.slice(0, 600) });
    return null;
  }
}
