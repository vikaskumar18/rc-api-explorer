import { AuthInfo } from '@salesforce/core';
import * as https from 'https';
import * as http from 'http';

export interface OrgInfo {
  alias: string;
  username: string;
  instanceUrl: string;
  isDefault: boolean;
}

export interface OrgCredentials {
  instanceUrl: string;
  accessToken: string;
}

// In-memory token cache — avoids repeated AuthInfo.create() calls within a session
const tokenCache = new Map<string, { creds: OrgCredentials; fetchedAt: number }>();
const TOKEN_TTL_MS = 25 * 60 * 1000; // 25 minutes

function getCached(key: string): OrgCredentials | null {
  const entry = tokenCache.get(key);
  if (!entry) { return null; }
  if (Date.now() - entry.fetchedAt > TOKEN_TTL_MS) { tokenCache.delete(key); return null; }
  return entry.creds;
}

function setCached(key: string, creds: OrgCredentials): void {
  tokenCache.set(key, { creds, fetchedAt: Date.now() });
}

export function invalidateCache(aliasOrUsername: string): void {
  tokenCache.delete(aliasOrUsername);
}

export async function listOrgs(): Promise<OrgInfo[]> {
  const auths = await AuthInfo.listAllAuthorizations();
  return auths.map(a => ({
    alias: a.aliases?.[0] ?? a.username,
    username: a.username,
    instanceUrl: a.instanceUrl ?? '',
    isDefault: (a as any).isDefaultUsername ?? false,
  }));
}

export async function getOrgCredentials(aliasOrUsername: string): Promise<OrgCredentials> {
  // 1. In-memory cache
  const cached = getCached(aliasOrUsername);
  if (cached) { return cached; }

  // 2. Resolve alias → username
  const auths = await AuthInfo.listAllAuthorizations();
  const match = auths.find(a => a.aliases?.includes(aliasOrUsername) || a.username === aliasOrUsername);
  const username = match?.username ?? aliasOrUsername;

  // 3. Create AuthInfo — handles crypto/decrypt of stored credentials
  const authInfo = await AuthInfo.create({ username });
  const fields = authInfo.getFields(true); // true = decrypt access token

  // Refresh if token is missing or about to expire
  const expiresAt: number | undefined = (fields as any).expirationDate
    ? new Date((fields as any).expirationDate).getTime()
    : undefined;
  const tokenMissing = !fields.accessToken;
  const tokenExpired = expiresAt !== undefined && expiresAt < Date.now() + 30_000;
  if (tokenMissing || tokenExpired) {
    try { await (authInfo as any).refreshAuth(); } catch { /* JWT orgs have no refresh token */ }
  }

  const refreshed = authInfo.getFields(true);
  if (!refreshed.instanceUrl || !refreshed.accessToken) {
    throw new Error(`SESSION_EXPIRED:${aliasOrUsername}`);
  }

  const creds = { instanceUrl: refreshed.instanceUrl, accessToken: refreshed.accessToken };
  setCached(aliasOrUsername, creds);
  return creds;
}

function httpRequest(reqUrl: string, method: string, accessToken: string, body?: string, extraHeaders?: Record<string,string>): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(reqUrl);
    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;
    const safe: Record<string,string> = {};
    for (const [k, v] of Object.entries(extraHeaders ?? {})) {
      const lower = k.toLowerCase();
      if (lower !== 'authorization' && lower !== 'content-type' && lower !== 'content-length') {
        safe[k] = v;
      }
    }
    const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', ...safe };
    if (body) { headers['Content-Length'] = Buffer.byteLength(body).toString(); }
    const req = lib.request({
      hostname: parsed.hostname, port: parsed.port ? parseInt(parsed.port) : (isHttps ? 443 : 80),
      path: (parsed.pathname + parsed.search) || '/', method: method.toUpperCase(), headers,
    }, (res) => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
    });
    req.on('error', reject);
    if (body) { req.write(body); }
    req.end();
  });
}

export async function callApi(aliasOrUsername: string, method: string, apiPath: string, body?: string, extraHeaders?: Record<string,string>): Promise<{ status: number; body: string; durationMs: number }> {
  const start = Date.now();
  try {
    const creds = await getOrgCredentials(aliasOrUsername);
    const fullUrl = apiPath.startsWith('http') ? apiPath : `${creds.instanceUrl.replace(/\/$/, '')}${apiPath}`;
    const bodyArg = ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) ? body : undefined;
    let { status, body: rawBody } = await httpRequest(fullUrl, method, creds.accessToken, bodyArg, extraHeaders);

    // On 401, invalidate cache and retry once with a freshly-fetched token
    if (status === 401) {
      try {
        invalidateCache(aliasOrUsername);
        const fresh = await getOrgCredentials(aliasOrUsername);
        const retryUrl = apiPath.startsWith('http') ? apiPath : `${fresh.instanceUrl.replace(/\/$/, '')}${apiPath}`;
        const retried = await httpRequest(retryUrl, method, fresh.accessToken, bodyArg, extraHeaders);
        status  = retried.status;
        rawBody = retried.body;
      } catch (retryErr: any) {
        if (retryErr?.message?.startsWith('SESSION_EXPIRED')) {
          return sessionExpiredResult(aliasOrUsername, Date.now() - start);
        }
        // keep original 401 result
      }
    }

    let prettyBody: string;
    try { prettyBody = JSON.stringify(JSON.parse(rawBody), null, 2); } catch { prettyBody = rawBody; }
    return { status, body: prettyBody, durationMs: Date.now() - start };
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    if (msg.startsWith('SESSION_EXPIRED')) {
      return sessionExpiredResult(aliasOrUsername, Date.now() - start);
    }
    const isAuthErr = msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('auth') || msg.toLowerCase().includes('token');
    return {
      status: isAuthErr ? 401 : 0,
      body: JSON.stringify({ error: msg, hint: isAuthErr ? `Run: sf org login web --alias ${aliasOrUsername}` : undefined }, null, 2),
      durationMs: Date.now() - start,
    };
  }
}

function sessionExpiredResult(aliasOrUsername: string, durationMs: number): { status: number; body: string; durationMs: number } {
  return {
    status: 401,
    body: JSON.stringify({
      error: 'Session expired — re-authentication required.',
      fix: `Run this in your terminal:  sf org login web --alias ${aliasOrUsername}`,
      detail: 'Your Salesforce session has expired. Log in again to get a new token.',
    }, null, 2),
    durationMs,
  };
}

// Fires token fetch in background on org select so it's cached by the time Execute is hit.
// Returns false if session is confirmed expired, true otherwise.
export function preWarmToken(aliasOrUsername: string): Promise<boolean> {
  if (getCached(aliasOrUsername)) { return Promise.resolve(true); }
  return getOrgCredentials(aliasOrUsername)
    .then(() => true)
    .catch((err: any) => {
      if (err?.message?.startsWith('SESSION_EXPIRED')) { return false; }
      return true;
    });
}
