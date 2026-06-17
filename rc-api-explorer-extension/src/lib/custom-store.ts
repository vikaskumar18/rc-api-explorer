import * as fs   from 'fs';
import * as path from 'path';

export interface CustomRequest {
  id:             string;
  name:           string;
  method:         string;
  path:           string;
  headers:        Record<string, string>;
  body:           string;
  savedAt:        string;
  category?:      string;
  description?:   string;
  queryParams?:   Array<{ key: string; value: string; description?: string }>;
  pathVariables?: Array<{ key: string; description?: string }>;
  pinned?:        boolean;
}

function storeFile(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.rc-explorer', 'custom-requests.json');
}

function sanitizePath(p: string): string {
  // Heal double-v paths produced by old Postman import bug: vv67.0 → v67.0
  return p.replace(/\/services\/data\/vv([\d.]+)\//g, '/services/data/v$1/');
}

export function listCustomRequests(workspaceRoot: string): CustomRequest[] {
  const f = storeFile(workspaceRoot);
  if (!fs.existsSync(f)) { return []; }
  try {
    const reqs: CustomRequest[] = JSON.parse(fs.readFileSync(f, 'utf8'));
    return reqs.map(r => ({ ...r, path: sanitizePath(r.path) }));
  } catch { return []; }
}

export function saveCustomRequest(
  workspaceRoot: string,
  req: Omit<CustomRequest, 'id' | 'savedAt'>
): CustomRequest {
  const dir = path.dirname(storeFile(workspaceRoot));
  fs.mkdirSync(dir, { recursive: true });
  const all = listCustomRequests(workspaceRoot);
  const record: CustomRequest = {
    ...req,
    id:      Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    savedAt: new Date().toISOString(),
  };
  all.unshift(record);
  fs.writeFileSync(storeFile(workspaceRoot), JSON.stringify(all, null, 2), 'utf8');
  return record;
}

export function updateCustomRequest(
  workspaceRoot: string,
  id: string,
  updates: Partial<Omit<CustomRequest, 'id' | 'savedAt'>>
): CustomRequest | undefined {
  const all = listCustomRequests(workspaceRoot);
  const idx = all.findIndex(r => r.id === id);
  if (idx < 0) { return undefined; }
  all[idx] = { ...all[idx], ...updates };
  fs.writeFileSync(storeFile(workspaceRoot), JSON.stringify(all, null, 2), 'utf8');
  return all[idx];
}

export function deleteCustomRequest(workspaceRoot: string, id: string): void {
  const all = listCustomRequests(workspaceRoot).filter(r => r.id !== id);
  fs.writeFileSync(storeFile(workspaceRoot), JSON.stringify(all, null, 2), 'utf8');
}

export function deleteAllCustomRequests(workspaceRoot: string): void {
  const dir = path.dirname(storeFile(workspaceRoot));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(storeFile(workspaceRoot), '[]', 'utf8');
}

export function deleteCustomRequestsByCategory(workspaceRoot: string, category: string): void {
  const all = listCustomRequests(workspaceRoot).filter(r => {
    const cat = r.category || 'Custom';
    return cat !== category && !cat.startsWith(category + ' > ');
  });
  fs.writeFileSync(storeFile(workspaceRoot), JSON.stringify(all, null, 2), 'utf8');
}

export function importCustomRequests(workspaceRoot: string, items: Omit<CustomRequest, 'id' | 'savedAt'>[]): void {
  const dir = path.dirname(storeFile(workspaceRoot));
  fs.mkdirSync(dir, { recursive: true });
  const existing = listCustomRequests(workspaceRoot);
  const existingNames = new Set(existing.map(r => r.name));
  const now = new Date().toISOString();
  const toAdd: CustomRequest[] = items
    .filter(item => !existingNames.has(item.name))
    .map(item => ({
      ...item,
      id:      Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      savedAt: now,
    }));
  const merged = [...toAdd, ...existing];
  fs.writeFileSync(storeFile(workspaceRoot), JSON.stringify(merged, null, 2), 'utf8');
}
