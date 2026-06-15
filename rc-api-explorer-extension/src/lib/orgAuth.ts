import { AuthInfo } from '@salesforce/core';
import * as https from 'https';
import * as http from 'http';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileP = promisify(execFile);

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

// Fetch a live access token via `sf org auth show-access-token`.
// AuthInfo.getFields() returns the stored (possibly stale) token from disk.
// The CLI command triggers an actual OAuth token refresh and always returns a live token.
async function fetchLiveToken(aliasOrUsername: string): Promise<OrgCredentials> {
  // Resolve instance URL from AuthInfo (doesn't need a live token)
  const auths = await AuthInfo.listAllAuthorizations();
  const match = auths.find(a => a.aliases?.includes(aliasOrUsername) || a.username === aliasOrUsername);
  const instanceUrl = match?.instanceUrl ?? '';

  const sfBin = process.platform === 'win32' ? 'sf.cmd' : 'sf';
  let stdout: string;
  try {
    const result = await execFileP(sfBin, ['org', 'auth', 'show-access-token', '--target-org', aliasOrUsername, '--json'], {
      env: { ...process.env },
      timeout: 15_000,
    });
    stdout = result.stdout;
  } catch (e: any) {
    // execFile rejects on non-zero exit; stdout may still have the JSON
    stdout = e.stdout ?? '';
    if (!stdout) { throw new Error(`SESSION_EXPIRED:${aliasOrUsername}`); }
  }

  let parsed: any;
  try { parsed = JSON.parse(stdout); } catch { throw new Error(`SESSION_EXPIRED:${aliasOrUsername}`); }

  const accessToken: string = parsed?.result?.accessToken ?? '';
  if (!accessToken || accessToken.startsWith('[REDACTED]')) {
    throw new Error(`SESSION_EXPIRED:${aliasOrUsername}`);
  }

  const resolvedUrl = parsed?.result?.instanceUrl ?? instanceUrl;
  return { instanceUrl: resolvedUrl, accessToken };
}

export async function getOrgCredentials(aliasOrUsername: string, forceRefresh = false): Promise<OrgCredentials> {
  // In-memory cache — bypass on force-refresh (post-401 retry or pre-warm)
  if (!forceRefresh) {
    const cached = getCached(aliasOrUsername);
    if (cached) { return cached; }
  }

  const creds = await fetchLiveToken(aliasOrUsername);
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

    // On 401, force-refresh token (bypasses cache, always calls refreshAuth) and retry once
    if (status === 401) {
      try {
        invalidateCache(aliasOrUsername);
        const fresh = await getOrgCredentials(aliasOrUsername, true);
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
  // Always force-refresh on org select — ensures stale web-login tokens are
  // replaced before the user hits Execute.
  return getOrgCredentials(aliasOrUsername, true)
    .then(() => true)
    .catch((err: any) => {
      if (err?.message?.startsWith('SESSION_EXPIRED')) { return false; }
      return true;
    });
}
