import * as fs   from 'fs';
import * as path from 'path';

export interface HistoryEntry {
  id:           string;
  timestamp:    string;
  method:       string;
  path:         string;
  orgAlias:     string;
  status:       number;
  durationMs:   number;
  requestBody:  string;
  responseBody: string;
  endpointId?:  string;
  endpointName?: string;
}

const MAX_ENTRIES = 200;

function historyFile(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.rc-explorer', 'history.json');
}

export function listHistory(workspaceRoot: string): HistoryEntry[] {
  const f = historyFile(workspaceRoot);
  if (!fs.existsSync(f)) { return []; }
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return []; }
}

export function appendHistory(
  workspaceRoot: string,
  entry: Omit<HistoryEntry, 'id'>
): void {
  const dir = path.dirname(historyFile(workspaceRoot));
  fs.mkdirSync(dir, { recursive: true });
  const all = listHistory(workspaceRoot);
  const record: HistoryEntry = {
    ...entry,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
  };
  all.unshift(record);
  if (all.length > MAX_ENTRIES) { all.length = MAX_ENTRIES; }
  fs.writeFileSync(historyFile(workspaceRoot), JSON.stringify(all, null, 2), 'utf8');
}

export function clearHistory(workspaceRoot: string): void {
  const f = historyFile(workspaceRoot);
  if (fs.existsSync(f)) { fs.writeFileSync(f, '[]', 'utf8'); }
}
