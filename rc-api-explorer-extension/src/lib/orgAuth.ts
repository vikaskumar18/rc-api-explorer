import { AuthInfo } from '@salesforce/core';
import * as https from 'https';
import * as http from 'http';
import { execSync } from 'child_process';

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

const tokenCache = new Map<string, { creds: OrgCredentials; fetchedAt: number }>();
const TOKEN_TTL_MS = 25 * 60 * 1000;

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

async function resolveAuthInfo(aliasOrUsername: string): Promise<{ authInfo: AuthInfo; instanceUrl: string }> {
  const auths = await AuthInfo.listAllAuthorizations();
  const match = auths.find(a => a.aliases?.includes(aliasOrUsername) || a.username === aliasOrUsername);
  if (!match) { throw new Error(`SESSION_EXPIRED:${aliasOrUsername}`); }
  try {
    const authInfo = await AuthInfo.create({ username: match.username });
    return { authInfo, instanceUrl: match.instanceUrl ?? '' };
  } catch {
    throw new Error(`SESSION_EXPIRED:${aliasOrUsername}`);
  }
}

// Fallback chain to fetch a decrypted access token + instanceUrl.
// Tries three methods in order; first one that returns a non-redacted token wins.
async function fetchStoredToken(aliasOrUsername: string): Promise<OrgCredentials> {
  const target = aliasOrUsername;

  // Method 1: sf org auth show-access-token (purpose-built, newest CLI)
  try {
    const out = execSync(
      `sf org auth show-access-token --target-org ${JSON.stringify(target)} --json`,
      { env: { ...process.env }, timeout: 15000 }
    ).toString();
    const parsed = JSON.parse(out);
    const token: string = parsed?.result?.accessToken ?? '';
    if (token && !token.startsWith('[REDACTED]')) {
      // instanceUrl not in this command — get it from AuthInfo (no decryption needed there)
      const auths = await AuthInfo.listAllAuthorizations();
      const match = auths.find(a => a.aliases?.includes(target) || a.username === target);
      const instanceUrl = match?.instanceUrl ?? '';
      if (instanceUrl) { return { instanceUrl, accessToken: token }; }
    }
  } catch { /* fall through */ }

  // Method 2: SF_TEMP_SHOW_SECRETS=true sf org display (recent CLI workaround)
  try {
    const out = execSync(
      `sf org display --target-org ${JSON.stringify(target)} --json`,
      { env: { ...process.env, SF_TEMP_SHOW_SECRETS: 'true' }, timeout: 15000 }
    ).toString();
    const result = JSON.parse(out)?.result ?? {};
    const token: string = result.accessToken ?? '';
    const instanceUrl: string = result.instanceUrl ?? '';
    if (token && !token.startsWith('[REDACTED]') && instanceUrl) {
      return { instanceUrl, accessToken: token };
    }
  } catch { /* fall through */ }

  // Method 3: @salesforce/core AuthInfo.getFields (older CLI versions)
  try {
    const { authInfo, instanceUrl } = await resolveAuthInfo(target);
    const fields = authInfo.getFields(true);
    const token: string = (fields as any).accessToken ?? '';
    const resolvedUrl: string = (fields as any).instanceUrl ?? instanceUrl;
    if (token && !token.startsWith('[REDACTED]') && resolvedUrl) {
      return { instanceUrl: resolvedUrl, accessToken: token };
    }
  } catch { /* fall through */ }

  throw new Error(`SESSION_EXPIRED:${aliasOrUsername}`);
}

// On 401 — re-fetch from CLI (picks up any token the CLI may have auto-refreshed).
async function refreshAndFetch(aliasOrUsername: string): Promise<OrgCredentials> {
  return fetchStoredToken(aliasOrUsername);
}

export async function getOrgCredentials(aliasOrUsername: string, forceRefresh = false): Promise<OrgCredentials> {
  if (!forceRefresh) {
    const cached = getCached(aliasOrUsername);
    if (cached) { return cached; }
  }
  const creds = await fetchStoredToken(aliasOrUsername);
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

    // On 401: attempt OAuth refresh (one time) and retry
    if (status === 401) {
      try {
        invalidateCache(aliasOrUsername);
        const fresh = await refreshAndFetch(aliasOrUsername);
        setCached(aliasOrUsername, fresh);
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
    return {
      status: 0,
      body: JSON.stringify({ error: msg }, null, 2),
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

// Pre-warms the token cache on org select. Just reads stored token — never attempts refresh.
// Returns false only if the org is completely unknown (not in auth store).
export function preWarmToken(aliasOrUsername: string): Promise<boolean> {
  invalidateCache(aliasOrUsername);
  return getOrgCredentials(aliasOrUsername)
    .then(() => true)
    .catch(() => false);
}
