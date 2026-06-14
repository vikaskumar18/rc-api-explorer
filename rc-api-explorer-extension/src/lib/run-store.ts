import * as fs   from 'fs';
import * as path from 'path';
import { ChainSession } from './chain-engine';
import { ENDPOINTS } from './endpoints';

export interface RunRecord {
  id:            string;
  type:          'playbook' | 'single';
  playbookId:    string;
  playbookName:  string;
  endpointId?:   string;
  endpointName?: string;
  org:           string;
  mode:          string;
  execution:     string;
  startedAt:     string;
  completedAt:   string;
  status:        'completed' | 'partial' | 'failed';
  steps: Array<{
    id:              string;
    label:           string;
    endpointId:      string;
    method:          string;
    path:            string;
    requestBody:     string;
    responseStatus:  number;
    responseBody:    string;
    durationMs:      number;
    extractedValues: Record<string, string>;
    manualOverrides: Record<string, string>;
  }>;
}

function runsDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.rc-explorer', 'runs');
}

export function saveRun(workspaceRoot: string, session: ChainSession, playbookName: string): string {
  const dir = runsDir(workspaceRoot);
  fs.mkdirSync(dir, { recursive: true });

  const completedAt = new Date().toISOString();
  const doneSteps   = session.steps.filter(s => s.status === 'done').length;
  const status: RunRecord['status'] =
    doneSteps === session.steps.length ? 'completed' :
    doneSteps > 0                      ? 'partial'   : 'failed';

  const record: RunRecord = {
    id:           session.startedAt.replace(/[:.]/g, '-').replace('T', '_').slice(0, 19),
    type:         'playbook',
    playbookId:   session.playbookId,
    playbookName,
    org:          session.orgAlias,
    mode:         session.mode,
    execution:    session.execution,
    startedAt:    session.startedAt,
    completedAt,
    status,
    steps: session.steps.map(s => {
      const ep = ENDPOINTS.find(e => e.id === s.endpointId);
      const method = ep?.methods[0] ?? 'GET';
      return {
        id:              s.stepId,
        label:           s.label,
        endpointId:      s.endpointId,
        method,
        path:            s.resolvedPath,
        requestBody:     s.resolvedBody,
        responseStatus:  s.response?.status ?? 0,
        responseBody:    s.response?.body   ?? '',
        durationMs:      s.response?.durationMs ?? 0,
        extractedValues: s.extractedValues,
        manualOverrides: s.manualOverrides,
      };
    }),
  };

  const filename = `${record.id}_${session.playbookId}_${session.orgAlias}.json`;
  fs.writeFileSync(path.join(dir, filename), JSON.stringify(record, null, 2), 'utf8');
  return filename;
}

export function listRuns(workspaceRoot: string): RunRecord[] {
  const dir = runsDir(workspaceRoot);
  if (!fs.existsSync(dir)) { return []; }
  return fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse()
    .slice(0, 50)
    .map(f => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as RunRecord;
      } catch {
        return null;
      }
    })
    .filter((r): r is RunRecord => r !== null);
}

export function clearRuns(workspaceRoot: string): void {
  const dir = runsDir(workspaceRoot);
  if (!fs.existsSync(dir)) { return; }
  fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .forEach(f => fs.unlinkSync(path.join(dir, f)));
}

export function loadRun(workspaceRoot: string, runId: string): RunRecord | undefined {
  const dir = runsDir(workspaceRoot);
  if (!fs.existsSync(dir)) { return undefined; }
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f.startsWith(runId));
  if (!files.length) { return undefined; }
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, files[0]), 'utf8')) as RunRecord;
  } catch {
    return undefined;
  }
}

export function deleteRun(workspaceRoot: string, runId: string): void {
  const dir = runsDir(workspaceRoot);
  if (!fs.existsSync(dir)) { return; }
  fs.readdirSync(dir)
    .filter(f => f.endsWith('.json') && f.startsWith(runId))
    .forEach(f => fs.unlinkSync(path.join(dir, f)));
}

export function saveSingleRun(
  workspaceRoot: string,
  opts: {
    endpointId:   string;
    endpointName: string;
    org:          string;
    method:       string;
    path:         string;
    requestBody:  string;
    status:       number;
    responseBody: string;
    durationMs:   number;
  }
): string {
  const dir = runsDir(workspaceRoot);
  fs.mkdirSync(dir, { recursive: true });

  const now = new Date().toISOString();
  const id  = now.replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const record: RunRecord = {
    id,
    type:        'single',
    playbookId:  opts.endpointId,
    playbookName: opts.endpointName,
    endpointId:  opts.endpointId,
    endpointName: opts.endpointName,
    org:         opts.org,
    mode:        'single',
    execution:   'auto',
    startedAt:   now,
    completedAt: now,
    status:      opts.status >= 200 && opts.status < 300 ? 'completed' : 'failed',
    steps: [{
      id:              'step-0',
      label:           opts.endpointName,
      endpointId:      opts.endpointId,
      method:          opts.method,
      path:            opts.path,
      requestBody:     opts.requestBody,
      responseStatus:  opts.status,
      responseBody:    opts.responseBody,
      durationMs:      opts.durationMs,
      extractedValues: {},
      manualOverrides: {},
    }],
  };

  const filename = `${id}_${opts.endpointId}_${opts.org}.json`;
  fs.writeFileSync(path.join(dir, filename), JSON.stringify(record, null, 2), 'utf8');
  return id;
}
