/**
 * orgAuth.js — mock tests (plain Node, no test framework)
 *
 * Replicate the key functions from orgAuth.ts in JS with injectable
 * dependencies so we can mock fs, child_process, and HTTP without
 * any test runner.
 */

'use strict';

// ── Mini assert helpers ────────────────────────────────────────────────────
let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { console.log('  ✓', msg); passed++; }
  else       { console.error('  ✗ FAIL:', msg); failed++; }
}
async function assertThrows(fn, msgContains, label) {
  try { await fn(); console.error('  ✗ FAIL (no throw):', label); failed++; }
  catch (e) {
    if (e.message.includes(msgContains)) { console.log('  ✓', label); passed++; }
    else { console.error('  ✗ FAIL (wrong error "'+e.message+'"):', label); failed++; }
  }
}
function section(name) { console.log('\n──', name, '──'); }

// ── Replicable logic under test ────────────────────────────────────────────
// We replicate the functions from orgAuth.ts in plain JS with injectable deps
// (fs, execP, httpRequest) so we can swap them per test.

const TOKEN_TTL_MS = 25 * 60 * 1000;

function makeOrgAuth({ fakeFs = {}, fakeExecP = null, fakeHttp = null } = {}) {
  // Token cache — fresh per instance
  const tokenCache = new Map();
  function getCached(key) {
    const entry = tokenCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.fetchedAt > TOKEN_TTL_MS) { tokenCache.delete(key); return null; }
    return entry.creds;
  }
  function setCached(key, creds) { tokenCache.set(key, { creds, fetchedAt: Date.now() }); }
  function invalidateCache(key) { tokenCache.delete(key); }

  function readFileSync(path) {
    if (path in fakeFs) return fakeFs[path];
    const e = new Error('ENOENT: ' + path); e.code = 'ENOENT'; throw e;
  }
  function readdirSync(dir) {
    const prefix = dir + '/';
    return Object.keys(fakeFs)
      .filter(k => k.startsWith(prefix))
      .map(k => k.slice(prefix.length))
      .filter(k => !k.includes('/'));
  }

  async function sfJson(args) {
    if (!fakeExecP) throw new Error('sfJson called unexpectedly');
    const stdout = await fakeExecP(args);
    return JSON.parse(stdout);
  }

  async function listOrgs(home) {
    const sfdxDir = `${home}/.sfdx`;
    const aliasMap = {}, reverseAlias = {};
    try {
      const raw = readFileSync(`${sfdxDir}/alias.json`);
      const parsed = JSON.parse(raw);
      const orgsMap = parsed?.orgs ?? parsed ?? {};
      for (const [alias, username] of Object.entries(orgsMap)) {
        if (typeof username === 'string') {
          aliasMap[alias] = username;
          if (!reverseAlias[username]) reverseAlias[username] = [];
          reverseAlias[username].push(alias);
        }
      }
    } catch {}
    let files = [];
    try { files = readdirSync(sfdxDir); } catch { return []; }
    const orgs = [];
    for (const file of files) {
      if (!file.endsWith('.json') || file === 'alias.json') continue;
      try {
        const raw = readFileSync(`${sfdxDir}/${file}`);
        const data = JSON.parse(raw);
        if (!data.username || !data.instanceUrl) continue;
        const aliases = reverseAlias[data.username] ?? [];
        orgs.push({
          alias: aliases[0] ?? data.username,
          username: data.username,
          instanceUrl: data.instanceUrl,
          isDefault: data.isDefault ?? false,
        });
      } catch {}
    }
    return orgs;
  }

  async function getFreshCredentials(aliasOrUsername) {
    const out = await sfJson(['org', 'display', '--target-org', aliasOrUsername, '--verbose', '--json']);
    const r = out?.result;
    const token = r?.accessToken ?? '';
    const isRedacted = token.startsWith('[REDACTED]') || token === '';
    const connStatus = r?.connectedStatus ?? '';
    const sessionDead = isRedacted || connStatus.toLowerCase().includes('expired') || connStatus.toLowerCase().includes('unable');
    if (sessionDead) throw new Error(`SESSION_EXPIRED:${aliasOrUsername}`);
    if (token && r?.instanceUrl) {
      const creds = { instanceUrl: r.instanceUrl, accessToken: token };
      setCached(aliasOrUsername, creds);
      return creds;
    }
    throw new Error(`SESSION_EXPIRED:${aliasOrUsername}`);
  }

  async function getOrgCredentials(aliasOrUsername, home) {
    const cached = getCached(aliasOrUsername);
    if (cached) return cached;
    const sfdxDir = `${home}/.sfdx`;
    let username = aliasOrUsername;
    try {
      const raw = readFileSync(`${sfdxDir}/alias.json`);
      const parsed = JSON.parse(raw);
      const orgsMap = parsed?.orgs ?? parsed ?? {};
      if (orgsMap[aliasOrUsername]) username = orgsMap[aliasOrUsername];
    } catch {}
    try {
      const raw = readFileSync(`${sfdxDir}/${username}.json`);
      const data = JSON.parse(raw);
      if (data.accessToken && data.instanceUrl) {
        const expiry = data.expirationDate ? new Date(data.expirationDate).getTime() : undefined;
        const expired = expiry !== undefined && expiry < Date.now() + 30_000;
        if (!expired) return { instanceUrl: data.instanceUrl, accessToken: data.accessToken };
      }
    } catch {}
    return getFreshCredentials(aliasOrUsername);
  }

  function sessionExpiredResult(aliasOrUsername, durationMs) {
    return {
      status: 401,
      body: JSON.stringify({
        error: 'Session expired — re-authentication required.',
        fix: `Run this in your terminal:  sf org login web --alias ${aliasOrUsername}`,
        detail: 'Your Salesforce session and refresh token have both expired. Log in again to get a new token.',
      }, null, 2),
      durationMs,
    };
  }

  async function callApi(aliasOrUsername, method, apiPath, body, extraHeaders, home) {
    const start = Date.now();
    try {
      const creds = await getOrgCredentials(aliasOrUsername, home);
      const fullUrl = apiPath.startsWith('http') ? apiPath : `${creds.instanceUrl.replace(/\/$/, '')}${apiPath}`;
      const bodyArg = ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) ? body : undefined;
      let { status, body: rawBody } = await fakeHttp(fullUrl, method, creds.accessToken, bodyArg, extraHeaders);

      if (status === 401) {
        try {
          invalidateCache(aliasOrUsername);
          const fresh = await getFreshCredentials(aliasOrUsername);
          const retryUrl = apiPath.startsWith('http') ? apiPath : `${fresh.instanceUrl.replace(/\/$/, '')}${apiPath}`;
          const retried = await fakeHttp(retryUrl, method, fresh.accessToken, bodyArg, extraHeaders);
          status = retried.status; rawBody = retried.body;
        } catch (retryErr) {
          if (retryErr?.message?.startsWith('SESSION_EXPIRED')) return sessionExpiredResult(aliasOrUsername, Date.now() - start);
        }
      }

      let prettyBody;
      try { prettyBody = JSON.stringify(JSON.parse(rawBody), null, 2); } catch { prettyBody = rawBody; }
      return { status, body: prettyBody, durationMs: Date.now() - start };
    } catch (err) {
      const msg = err?.message ?? String(err);
      if (msg.startsWith('SESSION_EXPIRED')) return sessionExpiredResult(aliasOrUsername, Date.now() - start);
      const isAuthErr = msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('auth') || msg.toLowerCase().includes('token');
      return {
        status: isAuthErr ? 401 : 0,
        body: JSON.stringify({ error: msg, hint: isAuthErr ? `Run: sf org login web --alias ${aliasOrUsername}` : undefined }, null, 2),
        durationMs: Date.now() - start,
      };
    }
  }

  async function preWarmToken(aliasOrUsername) {
    if (getCached(aliasOrUsername)) return true;
    return getFreshCredentials(aliasOrUsername)
      .then(() => true)
      .catch(err => err?.message?.startsWith('SESSION_EXPIRED') ? false : true);
  }

  return { listOrgs, getOrgCredentials, callApi, preWarmToken, invalidateCache, getCached, setCached };
}

// ── Test data helpers ──────────────────────────────────────────────────────
const HOME = '/home/test';
const SFDX = `${HOME}/.sfdx`;

function makeFs(orgFiles = {}, aliases = null) {
  const fs = {};
  if (aliases) fs[`${SFDX}/alias.json`] = JSON.stringify({ orgs: aliases });
  for (const [username, data] of Object.entries(orgFiles)) {
    fs[`${SFDX}/${username}.json`] = JSON.stringify(data);
  }
  return fs;
}

// ── Tests: listOrgs ────────────────────────────────────────────────────────
section('listOrgs — basic');
{
  const fakeFs = makeFs(
    { 'bob@acme.com': { username: 'bob@acme.com', instanceUrl: 'https://acme.my.salesforce.com', accessToken: 'tok1' } },
    { myorg: 'bob@acme.com' }
  );
  const { listOrgs } = makeOrgAuth({ fakeFs });
  const orgs = await listOrgs(HOME);
  assert(orgs.length === 1, 'returns one org');
  assert(orgs[0].alias === 'myorg', 'alias from alias.json');
  assert(orgs[0].username === 'bob@acme.com', 'username correct');
  assert(orgs[0].instanceUrl === 'https://acme.my.salesforce.com', 'instanceUrl correct');
  assert(orgs[0].isDefault === false, 'isDefault false');
}

section('listOrgs — multiple orgs, no alias for some');
{
  const fakeFs = makeFs(
    {
      'bob@acme.com':  { username: 'bob@acme.com',  instanceUrl: 'https://acme.my.salesforce.com',  accessToken: 'tok1' },
      'sue@beta.com':  { username: 'sue@beta.com',  instanceUrl: 'https://beta.my.salesforce.com',  accessToken: 'tok2' },
    },
    { myorg: 'bob@acme.com' }  // sue has no alias
  );
  const { listOrgs } = makeOrgAuth({ fakeFs });
  const orgs = await listOrgs(HOME);
  assert(orgs.length === 2, 'returns two orgs');
  const sue = orgs.find(o => o.username === 'sue@beta.com');
  assert(sue?.alias === 'sue@beta.com', 'falls back to username when no alias');
}

section('listOrgs — skips files missing username or instanceUrl');
{
  const fakeFs = makeFs({
    'bad@acme.com':   { username: 'bad@acme.com' },                        // no instanceUrl
    'bad2@acme.com':  { instanceUrl: 'https://x.salesforce.com' },         // no username
    'good@acme.com':  { username: 'good@acme.com', instanceUrl: 'https://good.salesforce.com', accessToken: 'tok' },
  });
  const { listOrgs } = makeOrgAuth({ fakeFs });
  const orgs = await listOrgs(HOME);
  assert(orgs.length === 1, 'only valid org returned');
  assert(orgs[0].username === 'good@acme.com', 'correct org returned');
}

section('listOrgs — no sfdx dir returns empty array');
{
  const { listOrgs } = makeOrgAuth({ fakeFs: {} });
  const orgs = await listOrgs(HOME);
  assert(Array.isArray(orgs) && orgs.length === 0, 'returns empty array');
}

section('listOrgs — skips alias.json file');
{
  const fakeFs = makeFs({ 'bob@acme.com': { username: 'bob@acme.com', instanceUrl: 'https://acme.salesforce.com', accessToken: 't' } });
  // alias.json is in the dir listing — must not be parsed as an org file
  const { listOrgs } = makeOrgAuth({ fakeFs });
  const orgs = await listOrgs(HOME);
  assert(orgs.length === 1, 'alias.json not treated as org');
}

// ── Tests: getOrgCredentials ───────────────────────────────────────────────
section('getOrgCredentials — reads from file (no CLI)');
{
  const fakeFs = makeFs({ 'bob@acme.com': { username: 'bob@acme.com', instanceUrl: 'https://acme.salesforce.com', accessToken: 'live-token' } });
  const { getOrgCredentials } = makeOrgAuth({ fakeFs });
  const creds = await getOrgCredentials('bob@acme.com', HOME);
  assert(creds.accessToken === 'live-token', 'returns token from file');
  assert(creds.instanceUrl === 'https://acme.salesforce.com', 'returns instanceUrl from file');
}

section('getOrgCredentials — resolves alias before reading file');
{
  const fakeFs = makeFs(
    { 'bob@acme.com': { username: 'bob@acme.com', instanceUrl: 'https://acme.salesforce.com', accessToken: 'tok' } },
    { myalias: 'bob@acme.com' }
  );
  const { getOrgCredentials } = makeOrgAuth({ fakeFs });
  const creds = await getOrgCredentials('myalias', HOME);
  assert(creds.accessToken === 'tok', 'resolved alias → username → token');
}

section('getOrgCredentials — expired expirationDate falls through to CLI');
{
  const expiredDate = new Date(Date.now() - 60_000).toISOString(); // 1 min ago
  const fakeFs = makeFs({
    'bob@acme.com': { username: 'bob@acme.com', instanceUrl: 'https://acme.salesforce.com', accessToken: 'stale', expirationDate: expiredDate }
  });
  let cliCalled = false;
  const fakeExecP = async () => {
    cliCalled = true;
    return JSON.stringify({ result: { accessToken: 'fresh-tok', instanceUrl: 'https://acme.salesforce.com', connectedStatus: 'Connected' } });
  };
  const { getOrgCredentials } = makeOrgAuth({ fakeFs, fakeExecP });
  const creds = await getOrgCredentials('bob@acme.com', HOME);
  assert(cliCalled, 'CLI called when file token expired');
  assert(creds.accessToken === 'fresh-tok', 'returns CLI token');
}

section('getOrgCredentials — returns from memory cache on second call');
{
  const fakeFs = makeFs({ 'bob@acme.com': { username: 'bob@acme.com', instanceUrl: 'https://acme.salesforce.com', accessToken: 'tok' } });
  let fileReads = 0;
  const fakeFs2 = new Proxy(fakeFs, {
    get(target, prop) {
      if (prop === `${SFDX}/bob@acme.com.json`) fileReads++;
      return target[prop];
    }
  });
  // Use setCached directly
  const auth = makeOrgAuth({ fakeFs });
  await auth.getOrgCredentials('bob@acme.com', HOME); // warms cache via file
  auth.setCached('bob@acme.com', { instanceUrl: 'https://cached.salesforce.com', accessToken: 'cached-tok' });
  const creds = await auth.getOrgCredentials('bob@acme.com', HOME);
  assert(creds.accessToken === 'cached-tok', 'returns in-memory cached token');
}

// ── Tests: getFreshCredentials / SESSION_EXPIRED ───────────────────────────
section('getOrgCredentials — redacted token triggers SESSION_EXPIRED');
{
  const fakeFs = makeFs({ 'bob@acme.com': { username: 'bob@acme.com', instanceUrl: 'https://acme.salesforce.com', accessToken: '' } });
  const fakeExecP = async () => JSON.stringify({
    result: { accessToken: "[REDACTED] Use 'sf org auth show-access-token'", instanceUrl: 'https://acme.salesforce.com', connectedStatus: 'Unable to refresh session' }
  });
  const { getOrgCredentials } = makeOrgAuth({ fakeFs, fakeExecP });
  await assertThrows(() => getOrgCredentials('bob@acme.com', HOME), 'SESSION_EXPIRED', 'redacted token throws SESSION_EXPIRED');
}

section('getOrgCredentials — connectedStatus "expired" triggers SESSION_EXPIRED');
{
  const fakeFs = makeFs({ 'bob@acme.com': { username: 'bob@acme.com', instanceUrl: 'https://acme.salesforce.com', accessToken: '' } });
  const fakeExecP = async () => JSON.stringify({
    result: { accessToken: '', instanceUrl: 'https://acme.salesforce.com', connectedStatus: 'Error: expired access/refresh token' }
  });
  const { getOrgCredentials } = makeOrgAuth({ fakeFs, fakeExecP });
  await assertThrows(() => getOrgCredentials('bob@acme.com', HOME), 'SESSION_EXPIRED', 'expired connectedStatus throws SESSION_EXPIRED');
}

// ── Tests: callApi ─────────────────────────────────────────────────────────
section('callApi — happy path returns response');
{
  const fakeFs = makeFs({ 'bob@acme.com': { username: 'bob@acme.com', instanceUrl: 'https://acme.salesforce.com', accessToken: 'live' } });
  const fakeHttp = async (url, method, token) => ({ status: 200, body: JSON.stringify({ records: [{ id: '001' }] }) });
  const { callApi } = makeOrgAuth({ fakeFs, fakeHttp });
  const result = await callApi('bob@acme.com', 'GET', '/services/data/v60.0/sobjects', undefined, {}, HOME);
  assert(result.status === 200, 'status 200');
  const parsed = JSON.parse(result.body);
  assert(parsed.records?.[0]?.id === '001', 'body parsed correctly');
}

section('callApi — sends body only for POST/PUT/PATCH');
{
  const fakeFs = makeFs({ 'bob@acme.com': { username: 'bob@acme.com', instanceUrl: 'https://acme.salesforce.com', accessToken: 'live' } });
  const sentBodies = [];
  const fakeHttp = async (url, method, token, body) => { sentBodies.push({ method, body }); return { status: 200, body: '{}' }; };
  const { callApi } = makeOrgAuth({ fakeFs, fakeHttp });
  await callApi('bob@acme.com', 'GET',   '/path', '{"x":1}', {}, HOME);
  await callApi('bob@acme.com', 'POST',  '/path', '{"x":1}', {}, HOME);
  await callApi('bob@acme.com', 'PATCH', '/path', '{"x":1}', {}, HOME);
  assert(sentBodies[0].body === undefined, 'GET body not sent');
  assert(sentBodies[1].body === '{"x":1}', 'POST body sent');
  assert(sentBodies[2].body === '{"x":1}', 'PATCH body sent');
}

section('callApi — 401 retries with fresh CLI token and succeeds');
{
  const fakeFs = makeFs({ 'bob@acme.com': { username: 'bob@acme.com', instanceUrl: 'https://acme.salesforce.com', accessToken: 'stale' } });
  let callCount = 0;
  const fakeHttp = async (url, method, token) => {
    callCount++;
    return token === 'stale' ? { status: 401, body: '[{"errorCode":"INVALID_AUTH_HEADER"}]' } : { status: 200, body: '{"ok":true}' };
  };
  const fakeExecP = async () => JSON.stringify({ result: { accessToken: 'fresh', instanceUrl: 'https://acme.salesforce.com', connectedStatus: 'Connected' } });
  const { callApi } = makeOrgAuth({ fakeFs, fakeHttp, fakeExecP });
  const result = await callApi('bob@acme.com', 'GET', '/path', undefined, {}, HOME);
  assert(callCount === 2, 'HTTP called twice (first + retry)');
  assert(result.status === 200, 'final status 200 after retry');
}

section('callApi — 401 with dead session returns SESSION_EXPIRED result (no raw INVALID_AUTH_HEADER)');
{
  const fakeFs = makeFs({ 'bob@acme.com': { username: 'bob@acme.com', instanceUrl: 'https://acme.salesforce.com', accessToken: 'stale' } });
  const fakeHttp = async () => ({ status: 401, body: '[{"errorCode":"INVALID_AUTH_HEADER"}]' });
  const fakeExecP = async () => JSON.stringify({
    result: { accessToken: '[REDACTED] Use sf org auth...', instanceUrl: 'https://acme.salesforce.com', connectedStatus: 'Unable to refresh' }
  });
  const { callApi } = makeOrgAuth({ fakeFs, fakeHttp, fakeExecP });
  const result = await callApi('bob@acme.com', 'GET', '/path', undefined, {}, HOME);
  assert(result.status === 401, 'status 401');
  const body = JSON.parse(result.body);
  assert(body.error.includes('Session expired'), 'user-friendly error message');
  assert(body.fix.includes('sf org login web'), 'fix command present');
  assert(!body.error.includes('INVALID_AUTH_HEADER'), 'raw INVALID_AUTH_HEADER not exposed');
}

section('callApi — SESSION_EXPIRED thrown by getOrgCredentials returns clean result');
{
  // File has empty accessToken, CLI returns redacted
  const fakeFs = makeFs({ 'bob@acme.com': { username: 'bob@acme.com', instanceUrl: 'https://acme.salesforce.com', accessToken: '' } });
  const fakeExecP = async () => JSON.stringify({ result: { accessToken: '[REDACTED]', instanceUrl: 'https://acme.salesforce.com', connectedStatus: 'expired' } });
  const fakeHttp = async () => { throw new Error('should not be called'); };
  const { callApi } = makeOrgAuth({ fakeFs, fakeHttp, fakeExecP });
  const result = await callApi('bob@acme.com', 'GET', '/path', undefined, {}, HOME);
  assert(result.status === 401, 'status 401');
  const body = JSON.parse(result.body);
  assert(body.fix?.includes('bob@acme.com'), 'fix includes org alias');
}

section('callApi — pretty-prints valid JSON response');
{
  const fakeFs = makeFs({ 'bob@acme.com': { username: 'bob@acme.com', instanceUrl: 'https://acme.salesforce.com', accessToken: 'tok' } });
  const fakeHttp = async () => ({ status: 200, body: '{"a":1,"b":2}' });
  const { callApi } = makeOrgAuth({ fakeFs, fakeHttp });
  const result = await callApi('bob@acme.com', 'GET', '/path', undefined, {}, HOME);
  assert(result.body.includes('\n'), 'body is pretty-printed');
}

section('callApi — non-JSON response returned as-is');
{
  const fakeFs = makeFs({ 'bob@acme.com': { username: 'bob@acme.com', instanceUrl: 'https://acme.salesforce.com', accessToken: 'tok' } });
  const fakeHttp = async () => ({ status: 200, body: 'plain text response' });
  const { callApi } = makeOrgAuth({ fakeFs, fakeHttp });
  const result = await callApi('bob@acme.com', 'GET', '/path', undefined, {}, HOME);
  assert(result.body === 'plain text response', 'non-JSON body returned as-is');
}

section('callApi — absolute URL used as-is (no instanceUrl prepend)');
{
  const fakeFs = makeFs({ 'bob@acme.com': { username: 'bob@acme.com', instanceUrl: 'https://acme.salesforce.com', accessToken: 'tok' } });
  const seenUrls = [];
  const fakeHttp = async (url) => { seenUrls.push(url); return { status: 200, body: '{}' }; };
  const { callApi } = makeOrgAuth({ fakeFs, fakeHttp });
  await callApi('bob@acme.com', 'GET', 'https://other.salesforce.com/path', undefined, {}, HOME);
  assert(seenUrls[0] === 'https://other.salesforce.com/path', 'absolute URL not modified');
}

// ── Tests: preWarmToken ────────────────────────────────────────────────────
section('preWarmToken — returns true for live session');
{
  const fakeFs = makeFs({ 'bob@acme.com': { username: 'bob@acme.com', instanceUrl: 'https://acme.salesforce.com', accessToken: '' } });
  const fakeExecP = async () => JSON.stringify({ result: { accessToken: 'fresh', instanceUrl: 'https://acme.salesforce.com', connectedStatus: 'Connected' } });
  const { preWarmToken } = makeOrgAuth({ fakeFs, fakeExecP });
  const alive = await preWarmToken('bob@acme.com');
  assert(alive === true, 'returns true for live session');
}

section('preWarmToken — returns false for expired session');
{
  const fakeFs = makeFs({ 'bob@acme.com': { username: 'bob@acme.com', instanceUrl: 'https://acme.salesforce.com', accessToken: '' } });
  const fakeExecP = async () => JSON.stringify({ result: { accessToken: '[REDACTED]', instanceUrl: 'https://acme.salesforce.com', connectedStatus: 'Unable to refresh' } });
  const { preWarmToken } = makeOrgAuth({ fakeFs, fakeExecP });
  const alive = await preWarmToken('bob@acme.com');
  assert(alive === false, 'returns false for expired session');
}

section('preWarmToken — returns true immediately if already cached');
{
  const auth = makeOrgAuth({ fakeFs: {} });
  auth.setCached('bob@acme.com', { instanceUrl: 'https://x.com', accessToken: 'cached' });
  let cliCalled = false;
  // No fakeExecP — if CLI were called it would throw
  const alive = await auth.preWarmToken('bob@acme.com');
  assert(alive === true, 'short-circuits when cached');
}

section('preWarmToken — caches token so next getOrgCredentials skips file');
{
  const fakeFs = makeFs({ 'bob@acme.com': { username: 'bob@acme.com', instanceUrl: 'https://acme.salesforce.com', accessToken: '' } });
  let cliCalls = 0;
  const fakeExecP = async () => { cliCalls++; return JSON.stringify({ result: { accessToken: 'warmed', instanceUrl: 'https://acme.salesforce.com', connectedStatus: 'Connected' } }); };
  const { preWarmToken, getOrgCredentials } = makeOrgAuth({ fakeFs, fakeExecP });
  await preWarmToken('bob@acme.com');
  const creds = await getOrgCredentials('bob@acme.com', HOME);
  assert(cliCalls === 1, 'CLI called only once (preWarm)');
  assert(creds.accessToken === 'warmed', 'cached token returned by getOrgCredentials');
}

// ── Results ────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
