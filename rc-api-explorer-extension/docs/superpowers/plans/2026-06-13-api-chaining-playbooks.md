# API Chaining & Playbooks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Playbooks tab to the RC API Explorer that lets users chain Revenue Cloud APIs in pre-wired sequences with auto-extracted values, three execution modes, three engine modes, and persistent file-based run history.

**Architecture:** A TypeScript chain engine (`chain-engine.ts`) reads playbook definitions (`playbooks.ts`), manages per-step state with manual override support, and writes run snapshots to `.rc-explorer/runs/`. The existing `apiExplorerPanel.ts` gets new message handlers that delegate to the engine. The webview (`media/panel.js`) gains a Playbooks tab with a step timeline and run history panel.

**Tech Stack:** TypeScript, VS Code Extension API, Node.js `fs` module, inline JSONPath resolver (no external lib — esbuild external list must not grow), esbuild bundler.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/chain-config.ts` | Create | Global defaults: defaultMode, defaultExecution |
| `src/lib/playbooks.ts` | Create | 3 playbook definitions with step + extract config |
| `src/lib/chain-engine.ts` | Create | Session state, JSONPath extractor, 3 engine modes |
| `src/lib/run-store.ts` | Create | Read/write `.rc-explorer/runs/*.json` |
| `src/apiExplorerPanel.ts` | Modify | Add chain message handlers (chainStart, chainStep, chainRunAll, chainLoadRun) |
| `media/panel.js` | Modify | Add Playbooks tab: playbook picker, step timeline, mode switchers, run history |

---

## Task 1: chain-config.ts — Global Defaults

**Files:**
- Create: `src/lib/chain-config.ts`

- [ ] **Step 1: Create the file**

```typescript
export type EngineMode = 'playbook' | 'dynamic' | 'composite';
export type ExecMode   = 'step' | 'auto' | 'hybrid';

export interface ChainConfig {
  defaultMode:      EngineMode;
  defaultExecution: ExecMode;
}

export const CHAIN_CONFIG: ChainConfig = {
  defaultMode:      'playbook',
  defaultExecution: 'hybrid',
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/vkumar4/revenue cloud doc/rc-api-explorer-extension"
npx tsc --noEmit 2>&1
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/chain-config.ts
git commit -m "feat: add chain-config global defaults"
```

---

## Task 2: playbooks.ts — Playbook Definitions

**Files:**
- Create: `src/lib/playbooks.ts`

- [ ] **Step 1: Create the file with all three playbooks**

```typescript
import type { EngineMode, ExecMode } from './chain-config';

export interface ExtractRule {
  from: string;   // JSONPath e.g. "$.catalogs[0].id"
  into: string;   // "next.body.catalogId" | "next.path.productId"
}

export interface PlaybookStep {
  id:          string;
  endpointId:  string;
  label:       string;
  seedFields?: string[];   // fields user must fill for step 1 (no prior output)
  extract?:    ExtractRule[];
}

export interface Playbook {
  id:          string;
  name:        string;
  description: string;
  mode?:       EngineMode;      // overrides CHAIN_CONFIG.defaultMode
  execution?:  ExecMode;        // overrides CHAIN_CONFIG.defaultExecution
  steps:       PlaybookStep[];
}

export const PLAYBOOKS: Playbook[] = [
  {
    id:          'catalog-discovery',
    name:        'Catalog Discovery Flow',
    description: 'Catalogs → Categories → Products List → Product Details',
    mode:        'playbook',
    execution:   'hybrid',
    steps: [
      {
        id:         'get-catalogs',
        endpointId: 'disc-2',
        label:      'Step 1 — Get Catalogs',
        seedFields: [],
        extract: [
          { from: '$.catalogs[0].id', into: 'next.body.catalogId' },
        ],
      },
      {
        id:         'get-categories',
        endpointId: 'disc-3',
        label:      'Step 2 — Get Categories',
        extract: [
          { from: '$.categories[0].id', into: 'next.body.categoryId' },
        ],
      },
      {
        id:         'get-products',
        endpointId: 'disc-6',
        label:      'Step 3 — Products List (CPQ)',
        extract: [
          { from: '$.products[0].id', into: 'next.path.productId' },
        ],
      },
      {
        id:         'get-product-detail',
        endpointId: 'disc-5',
        label:      'Step 4 — Product Details (CPQ)',
      },
    ],
  },

  {
    id:          'cpq-quote-flow',
    name:        'CPQ Quote Flow',
    description: 'Products List → Qualification → Pricing',
    mode:        'playbook',
    execution:   'hybrid',
    steps: [
      {
        id:         'products-list',
        endpointId: 'disc-6',
        label:      'Step 1 — Products List',
        seedFields: ['catalogId'],
        extract: [
          { from: '$.products[0].id', into: 'next.body.productIds[0]' },
        ],
      },
      {
        id:         'qualification',
        endpointId: 'disc-7',
        label:      'Step 2 — Qualification',
        extract: [
          { from: '$.products[0].id', into: 'next.body.lineItems[0].productId' },
        ],
      },
      {
        id:         'pricing',
        endpointId: 'price-1',
        label:      'Step 3 — Pricing',
      },
    ],
  },

  {
    id:          'product-setup',
    name:        'Product Setup Flow',
    description: 'Classification List → Products List → Deep Clone → Related Records',
    mode:        'playbook',
    execution:   'hybrid',
    steps: [
      {
        id:         'classification-list',
        endpointId: 'pcm-8',
        label:      'Step 1 — Product Classification List',
        seedFields: [],
        extract: [
          { from: '$.productClassifications[0].id', into: 'next.body.productClassificationId' },
        ],
      },
      {
        id:         'products-list',
        endpointId: 'pcm-4',
        label:      'Step 2 — Products List',
        extract: [
          { from: '$.products[0].id', into: 'next.body.mainRecordId' },
        ],
      },
      {
        id:         'deep-clone',
        endpointId: 'pcm-6',
        label:      'Step 3 — Deep Clone',
        extract: [
          { from: '$.createdRecordList[0].id', into: 'next.body.recordIds[0]' },
        ],
      },
      {
        id:         'related-records',
        endpointId: 'pcm-9',
        label:      'Step 4 — Product Related Records',
      },
    ],
  },
];
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/vkumar4/revenue cloud doc/rc-api-explorer-extension"
npx tsc --noEmit 2>&1
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/playbooks.ts
git commit -m "feat: add playbook definitions (catalog-discovery, cpq-quote, product-setup)"
```

---

## Task 3: chain-engine.ts — Session State + JSONPath + Execution

**Files:**
- Create: `src/lib/chain-engine.ts`

- [ ] **Step 1: Create the file**

```typescript
import { ENDPOINTS, Endpoint } from './endpoints';
import { PLAYBOOKS, Playbook, PlaybookStep } from './playbooks';
import { CHAIN_CONFIG, EngineMode, ExecMode } from './chain-config';

export type StepStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped';

export interface StepState {
  stepId:          string;
  endpointId:      string;
  label:           string;
  status:          StepStatus;
  resolvedPath:    string;
  resolvedBody:    string;
  response?:       { status: number; body: string; durationMs: number };
  extractedValues: Record<string, string>;
  manualOverrides: Record<string, string>;
}

export interface ChainSession {
  playbookId:  string;
  mode:        EngineMode;
  execution:   ExecMode;
  orgAlias:    string;
  activeStep:  number;
  steps:       StepState[];
  startedAt:   string;
}

// Resolve a simple JSONPath expression against a parsed object.
// Supports: $.field, $.array[N].field, $.array[N].nested.field
export function resolveJsonPath(obj: any, path: string): string | undefined {
  if (!path.startsWith('$')) { return undefined; }
  const parts = path
    .slice(2)                                 // remove "$."
    .replace(/\[(\d+)\]/g, '.$1')            // "arr[0]" → "arr.0"
    .split('.');
  let cur: any = obj;
  for (const part of parts) {
    if (cur == null) { return undefined; }
    cur = cur[part];
  }
  return cur == null ? undefined : String(cur);
}

// Apply extracted values from a previous step into the next step's body/path.
// "next.body.catalogId"  → sets body JSON field catalogId
// "next.path.productId"  → replaces {productId} in URL path
function applyExtraction(
  body:   string,
  path:   string,
  target: string,
  value:  string,
): { body: string; path: string } {
  if (target.startsWith('next.body.')) {
    const field = target.slice('next.body.'.length);
    try {
      const parsed = JSON.parse(body || '{}');
      // Support nested array syntax: "productIds[0]" → parsed.productIds[0]
      const parts = field.replace(/\[(\d+)\]/g, '.$1').split('.');
      let cur: any = parsed;
      for (let i = 0; i < parts.length - 1; i++) {
        if (cur[parts[i]] == null) { cur[parts[i]] = {}; }
        cur = cur[parts[i]];
      }
      cur[parts[parts.length - 1]] = value;
      body = JSON.stringify(parsed, null, 2);
    } catch { /* leave body unchanged if not valid JSON */ }
  } else if (target.startsWith('next.path.')) {
    const param = target.slice('next.path.'.length);
    path = path.replace(`{${param}}`, value);
  }
  return { body, path };
}

export function createSession(
  playbookId: string,
  orgAlias:   string,
  modeOverride?:      EngineMode,
  executionOverride?: ExecMode,
): ChainSession {
  const playbook = PLAYBOOKS.find(p => p.id === playbookId);
  if (!playbook) { throw new Error(`Playbook "${playbookId}" not found`); }

  const mode      = modeOverride      ?? playbook.mode      ?? CHAIN_CONFIG.defaultMode;
  const execution = executionOverride ?? playbook.execution ?? CHAIN_CONFIG.defaultExecution;

  const steps: StepState[] = playbook.steps.map(step => {
    const ep = ENDPOINTS.find(e => e.id === step.endpointId);
    return {
      stepId:          step.id,
      endpointId:      step.endpointId,
      label:           step.label,
      status:          'pending' as StepStatus,
      resolvedPath:    ep ? `/services/data/v67.0${ep.path}` : '',
      resolvedBody:    ep ? ep.request : '{}',
      extractedValues: {},
      manualOverrides: {},
    };
  });

  return { playbookId, mode, execution, orgAlias, activeStep: 0, steps, startedAt: new Date().toISOString() };
}

// Called after a step response arrives. Extracts values and pre-fills next step.
export function applyStepResult(
  session:  ChainSession,
  stepIdx:  number,
  result:   { status: number; body: string; durationMs: number },
): ChainSession {
  const updated = { ...session, steps: session.steps.map(s => ({ ...s })) };
  const stepState = updated.steps[stepIdx];
  stepState.status   = result.status >= 200 && result.status < 300 ? 'done' : 'error';
  stepState.response = result;

  const playbook = PLAYBOOKS.find(p => p.id === session.playbookId)!;
  const pbStep: PlaybookStep = playbook.steps[stepIdx];

  let parsedBody: any = {};
  try { parsedBody = JSON.parse(result.body); } catch { /* ignore */ }

  const extracted: Record<string, string> = {};
  if (pbStep.extract) {
    for (const rule of pbStep.extract) {
      const val = resolveJsonPath(parsedBody, rule.from);
      if (val !== undefined) { extracted[rule.into] = val; }
    }
  }
  stepState.extractedValues = extracted;

  // Pre-fill NEXT step (if exists) unless manual override already set
  const nextIdx = stepIdx + 1;
  if (nextIdx < updated.steps.length) {
    const nextState = updated.steps[nextIdx];
    for (const [target, value] of Object.entries(extracted)) {
      if (nextState.manualOverrides[target] !== undefined) { continue; }
      const { body, path } = applyExtraction(nextState.resolvedBody, nextState.resolvedPath, target, value);
      nextState.resolvedBody = body;
      nextState.resolvedPath = path;
    }
    updated.activeStep = nextIdx;
  }

  return updated;
}

// Apply a manual override for a step field before execution.
export function applyManualOverride(
  session: ChainSession,
  stepIdx: number,
  target:  string,
  value:   string,
): ChainSession {
  const updated = { ...session, steps: session.steps.map(s => ({ ...s })) };
  const stepState = updated.steps[stepIdx];
  stepState.manualOverrides[target] = value;
  const { body, path } = applyExtraction(stepState.resolvedBody, stepState.resolvedPath, target, value);
  stepState.resolvedBody = body;
  stepState.resolvedPath = path;
  return updated;
}

// Reset a step back to pending (for re-run), preserving manualOverrides.
export function resetStep(session: ChainSession, stepIdx: number): ChainSession {
  const updated = { ...session, steps: session.steps.map(s => ({ ...s })) };
  const stepState = updated.steps[stepIdx];
  const ep = ENDPOINTS.find(e => e.id === stepState.endpointId);
  stepState.status   = 'pending';
  stepState.response = undefined;
  stepState.resolvedPath = ep ? `/services/data/v67.0${ep.path}` : stepState.resolvedPath;
  stepState.resolvedBody = ep ? ep.request : '{}';
  stepState.extractedValues = {};
  // Re-apply manual overrides so user edits survive reset
  for (const [target, value] of Object.entries(stepState.manualOverrides)) {
    const { body, path } = applyExtraction(stepState.resolvedBody, stepState.resolvedPath, target, value);
    stepState.resolvedBody = body;
    stepState.resolvedPath = path;
  }
  updated.activeStep = stepIdx;
  return updated;
}

// Build a Salesforce Composite API request body from the session.
export function buildCompositeBody(session: ChainSession): object {
  const playbook = PLAYBOOKS.find(p => p.id === session.playbookId)!;
  const compositeRequest = session.steps.map((stepState, i) => {
    const ep = ENDPOINTS.find(e => e.id === stepState.endpointId);
    const method = ep?.methods[0] ?? 'GET';
    const hasBody = ['POST', 'PUT', 'PATCH'].includes(method);
    const entry: any = {
      method,
      url:         stepState.resolvedPath.replace('/services/data/v67.0', ''),
      referenceId: `step_${i}_${stepState.stepId}`,
    };
    if (hasBody) {
      try { entry.body = JSON.parse(stepState.resolvedBody); } catch { entry.body = {}; }
    }
    return entry;
  });
  return { compositeRequest, allOrNone: false };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/vkumar4/revenue cloud doc/rc-api-explorer-extension"
npx tsc --noEmit 2>&1
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/chain-engine.ts
git commit -m "feat: add chain-engine (session state, JSONPath extractor, composite builder)"
```

---

## Task 4: run-store.ts — File-Based Run History

**Files:**
- Create: `src/lib/run-store.ts`

- [ ] **Step 1: Create the file**

```typescript
import * as fs   from 'fs';
import * as path from 'path';
import { ChainSession } from './chain-engine';

export interface RunRecord {
  id:            string;
  playbookId:    string;
  playbookName:  string;
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
    playbookId:   session.playbookId,
    playbookName,
    org:          session.orgAlias,
    mode:         session.mode,
    execution:    session.execution,
    startedAt:    session.startedAt,
    completedAt,
    status,
    steps: session.steps.map(s => {
      const ep = { methods: ['GET'] }; // fallback
      return {
        id:              s.stepId,
        label:           s.label,
        endpointId:      s.endpointId,
        method:          s.response ? (s.resolvedPath.includes('{') ? 'GET' : 'POST') : 'GET',
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
    .slice(0, 50)              // cap at 50 most recent
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/vkumar4/revenue cloud doc/rc-api-explorer-extension"
npx tsc --noEmit 2>&1
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/run-store.ts
git commit -m "feat: add run-store (file-based run history in .rc-explorer/runs/)"
```

---

## Task 5: apiExplorerPanel.ts — Chain Message Handlers

**Files:**
- Modify: `src/apiExplorerPanel.ts`

- [ ] **Step 1: Add imports at the top of the file (after existing imports)**

Add these lines after the existing import block:

```typescript
import { PLAYBOOKS } from './lib/playbooks';
import { CHAIN_CONFIG } from './lib/chain-config';
import {
  ChainSession,
  createSession,
  applyStepResult,
  applyManualOverride,
  resetStep,
  buildCompositeBody,
} from './lib/chain-engine';
import { saveRun, listRuns, clearRuns, RunRecord } from './lib/run-store';
import * as path from 'path';
```

- [ ] **Step 2: Add chainSession field to the class (after `private orgs: OrgInfo[] = [];`)**

```typescript
private chainSession: ChainSession | null = null;
```

- [ ] **Step 3: Add workspaceRoot helper method to the class (before `private postMsg`)**

```typescript
private workspaceRoot(): string {
  const folders = require('vscode').workspace.workspaceFolders;
  return folders?.[0]?.uri?.fsPath ?? require('os').homedir();
}
```

- [ ] **Step 4: Extend loadInitialData to also send playbooks and run history**

Inside `loadInitialData`, change the final `this.postMsg` call to:

```typescript
this.postMsg({
  type:      'init',
  orgs:      this.orgs,
  endpoints: ENDPOINTS,
  apiVersion: 'v67.0',
  playbooks:  PLAYBOOKS,
  chainConfig: CHAIN_CONFIG,
  runs:       listRuns(this.workspaceRoot()),
});
```

- [ ] **Step 5: Add chain message handlers inside the switch in handleMessage**

Add these cases before the closing `}` of the switch:

```typescript
case 'chainStart': {
  const { playbookId, orgAlias, mode, execution } = msg;
  try {
    this.chainSession = createSession(playbookId, orgAlias, mode, execution);
    this.postMsg({ type: 'chainStarted', session: this.chainSession });
  } catch (err: any) {
    this.postMsg({ type: 'chainError', error: err.message });
  }
  break;
}

case 'chainStep': {
  const { stepIdx } = msg;
  if (!this.chainSession) { break; }
  const stepState = this.chainSession.steps[stepIdx];
  const ep = ENDPOINTS.find(e => e.id === stepState.endpointId);
  const method = ep?.methods[0] ?? 'GET';

  this.chainSession.steps[stepIdx].status = 'running';
  this.postMsg({ type: 'chainStepStarted', stepIdx });

  const result = await callApi(
    this.chainSession.orgAlias,
    method,
    stepState.resolvedPath,
    ['POST','PUT','PATCH'].includes(method) ? stepState.resolvedBody : undefined,
  );
  this.chainSession = applyStepResult(this.chainSession, stepIdx, result);
  this.postMsg({ type: 'chainStepDone', stepIdx, session: this.chainSession, result });
  break;
}

case 'chainRunAll': {
  if (!this.chainSession) { break; }
  for (let i = 0; i < this.chainSession.steps.length; i++) {
    const stepState = this.chainSession.steps[i];
    if (stepState.status === 'done') { continue; }
    const ep = ENDPOINTS.find(e => e.id === stepState.endpointId);
    const method = ep?.methods[0] ?? 'GET';
    this.chainSession.steps[i].status = 'running';
    this.postMsg({ type: 'chainStepStarted', stepIdx: i });
    const result = await callApi(
      this.chainSession.orgAlias,
      method,
      stepState.resolvedPath,
      ['POST','PUT','PATCH'].includes(method) ? stepState.resolvedBody : undefined,
    );
    this.chainSession = applyStepResult(this.chainSession, i, result);
    this.postMsg({ type: 'chainStepDone', stepIdx: i, session: this.chainSession, result });
    if (this.chainSession.steps[i].status === 'error') { break; }
  }
  // Save run
  const pb = PLAYBOOKS.find(p => p.id === this.chainSession!.playbookId);
  saveRun(this.workspaceRoot(), this.chainSession, pb?.name ?? this.chainSession.playbookId);
  this.postMsg({ type: 'runsRefreshed', runs: listRuns(this.workspaceRoot()) });
  break;
}

case 'chainRunFrom': {
  const { fromStepIdx } = msg;
  if (!this.chainSession) { break; }
  for (let i = fromStepIdx; i < this.chainSession.steps.length; i++) {
    const stepState = this.chainSession.steps[i];
    const ep = ENDPOINTS.find(e => e.id === stepState.endpointId);
    const method = ep?.methods[0] ?? 'GET';
    this.chainSession.steps[i].status = 'running';
    this.postMsg({ type: 'chainStepStarted', stepIdx: i });
    const result = await callApi(
      this.chainSession.orgAlias,
      method,
      stepState.resolvedPath,
      ['POST','PUT','PATCH'].includes(method) ? stepState.resolvedBody : undefined,
    );
    this.chainSession = applyStepResult(this.chainSession, i, result);
    this.postMsg({ type: 'chainStepDone', stepIdx: i, session: this.chainSession, result });
    if (this.chainSession.steps[i].status === 'error') { break; }
  }
  const pb2 = PLAYBOOKS.find(p => p.id === this.chainSession!.playbookId);
  saveRun(this.workspaceRoot(), this.chainSession, pb2?.name ?? this.chainSession.playbookId);
  this.postMsg({ type: 'runsRefreshed', runs: listRuns(this.workspaceRoot()) });
  break;
}

case 'chainOverride': {
  const { stepIdx, target, value } = msg;
  if (!this.chainSession) { break; }
  this.chainSession = applyManualOverride(this.chainSession, stepIdx, target, value);
  this.postMsg({ type: 'chainSessionUpdated', session: this.chainSession });
  break;
}

case 'chainResetStep': {
  const { stepIdx } = msg;
  if (!this.chainSession) { break; }
  this.chainSession = resetStep(this.chainSession, stepIdx);
  this.postMsg({ type: 'chainSessionUpdated', session: this.chainSession });
  break;
}

case 'chainComposite': {
  if (!this.chainSession) { break; }
  const compositeBody = buildCompositeBody(this.chainSession);
  const result = await callApi(
    this.chainSession.orgAlias,
    'POST',
    '/services/data/v67.0/composite',
    JSON.stringify(compositeBody),
  );
  this.postMsg({ type: 'chainCompositeResult', result });
  break;
}

case 'chainLoadRun': {
  const { runId } = msg;
  const runs = listRuns(this.workspaceRoot());
  const run  = runs.find(r => r.id === runId);
  if (run) { this.postMsg({ type: 'chainRunLoaded', run }); }
  break;
}

case 'chainClearRuns': {
  clearRuns(this.workspaceRoot());
  this.postMsg({ type: 'runsRefreshed', runs: [] });
  break;
}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd "/Users/vkumar4/revenue cloud doc/rc-api-explorer-extension"
npx tsc --noEmit 2>&1
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/apiExplorerPanel.ts
git commit -m "feat: add chain message handlers to apiExplorerPanel"
```

---

## Task 6: media/panel.js — Playbooks Tab UI

**Files:**
- Modify: `media/panel.js`

This is the largest change. Add all chain-related variables, the Playbooks tab renderer, step timeline, run history panel, and new message handlers. Apply changes in sub-steps below.

- [ ] **Step 1: Add chain state variables after existing globals (after `const pendingReqs = {};`)**

```javascript
// Chain / Playbook state
let playbooks = [];
let chainConfig = { defaultMode: 'playbook', defaultExecution: 'hybrid' };
let chainSession = null;
let runs = [];
let chainMode = 'playbook';    // current UI selection
let chainExec = 'hybrid';
let selPlaybook = null;
```

- [ ] **Step 2: Extend the `window.addEventListener('message', ...)` handler**

Inside the existing handler, add these new `else if` branches after the `execResult` branch:

```javascript
} else if(m.type === 'chainStarted'){
  chainSession = m.session;
  renderChainTimeline();
} else if(m.type === 'chainSessionUpdated'){
  chainSession = m.session;
  renderChainTimeline();
} else if(m.type === 'chainStepStarted'){
  if(chainSession){ chainSession.steps[m.stepIdx].status = 'running'; }
  renderChainTimeline();
} else if(m.type === 'chainStepDone'){
  chainSession = m.session;
  renderChainTimeline();
} else if(m.type === 'chainCompositeResult'){
  document.getElementById('chain-composite-resp').textContent =
    JSON.stringify(JSON.parse(m.result.body), null, 2);
} else if(m.type === 'chainRunLoaded'){
  renderLoadedRun(m.run);
} else if(m.type === 'runsRefreshed'){
  runs = m.runs || [];
  renderRunHistory();
}
```

- [ ] **Step 3: Extend the `init` message handler to capture playbooks, chainConfig, and runs**

In the existing `if(m.type === 'init')` block, add after `render();`:

```javascript
    playbooks   = m.playbooks   || [];
    chainConfig = m.chainConfig || chainConfig;
    runs        = m.runs        || [];
    chainMode   = chainConfig.defaultMode;
    chainExec   = chainConfig.defaultExecution;
    renderPlaybooksTab();
    renderRunHistory();
```

- [ ] **Step 4: Add the filter button for Playbooks in the HTML sidebar**

In `buildHtml()` in `apiExplorerPanel.ts`, add a Playbooks filter button in the filter bar div (this is in the TypeScript HTML template string, not panel.js — skip if already present). 

Actually, since the filter bar is in the TypeScript HTML template, add a "Playbooks" section as a separate `div` below `#ep-list`:

In `apiExplorerPanel.ts`, inside `buildHtml()`, add before `</div><!-- #sidebar -->`:

```html
<div id="playbooks-panel" style="display:none;flex-direction:column;overflow:hidden;flex:1">
  <div id="pb-list-view">
    <div style="padding:8px 14px 4px;font-size:10px;font-weight:700;color:var(--fg3);text-transform:uppercase;letter-spacing:.08em">Playbooks</div>
    <div style="padding:4px 14px 8px;display:flex;gap:6px;flex-wrap:wrap">
      <select id="chain-mode-sel" style="flex:1;padding:4px 6px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--fg);font-size:11px" onchange="chainMode=this.value">
        <option value="playbook">Playbook</option>
        <option value="dynamic">Dynamic</option>
        <option value="composite">Composite</option>
      </select>
      <select id="chain-exec-sel" style="flex:1;padding:4px 6px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--fg);font-size:11px" onchange="chainExec=this.value">
        <option value="hybrid">Hybrid</option>
        <option value="step">Step-by-step</option>
        <option value="auto">Auto</option>
      </select>
    </div>
    <div id="pb-cards"></div>
    <div style="padding:8px 14px 4px;font-size:10px;font-weight:700;color:var(--fg3);text-transform:uppercase;letter-spacing:.08em;margin-top:8px">Run History <button class="icon-btn" style="float:right;padding:1px 6px;font-size:10px" onclick="vscMsg({type:'chainClearRuns'})">Clear</button></div>
    <div id="run-history-list"></div>
  </div>
</div>
```

Also add a toggle button in `#sidebar-top` after the filter bar:

```html
<div style="margin-top:6px">
  <button class="fb" id="pb-tab-btn" onclick="togglePlaybooksPanel(this)" style="width:100%;text-align:center">⛓ Playbooks</button>
</div>
```

- [ ] **Step 5: Add all panel.js functions for playbooks**

Append these functions to `media/panel.js` before the final `vscMsg({type:'ready'});` line:

```javascript
function togglePlaybooksPanel(btn){
  const panel = document.getElementById('playbooks-panel');
  const epList = document.getElementById('ep-list');
  const sideTop = document.getElementById('sidebar-top');
  const showing = panel.style.display === 'flex';
  panel.style.display = showing ? 'none' : 'flex';
  epList.style.display = showing ? 'block' : 'none';
  btn.classList.toggle('on', !showing);
  if(!showing){ renderPlaybooksTab(); }
}

function renderPlaybooksTab(){
  const cards = document.getElementById('pb-cards');
  if(!cards) return;
  if(!playbooks.length){ cards.innerHTML = '<div style="padding:14px;color:var(--fg3);font-size:12px">No playbooks loaded.</div>'; return; }
  cards.innerHTML = playbooks.map(pb =>
    '<div style="margin:4px 10px;padding:10px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;cursor:pointer" onclick="startPlaybook(\''+esc(pb.id)+'\')">' +
    '<div style="font-size:12px;font-weight:600;color:var(--fg);margin-bottom:2px">'+esc(pb.name)+'</div>' +
    '<div style="font-size:11px;color:var(--fg2);margin-bottom:6px">'+esc(pb.description)+'</div>' +
    '<button class="btn btn-pri" style="font-size:11px;padding:3px 10px" onclick="event.stopPropagation();startPlaybook(\''+esc(pb.id)+'\')">&#9654; Start</button>' +
    '</div>'
  ).join('');
}

function startPlaybook(pbId){
  const orgAlias = document.getElementById('org-select').value;
  if(!orgAlias){ alert('Select an org first.'); return; }
  selPlaybook = pbId;
  vscMsg({ type:'chainStart', playbookId:pbId, orgAlias, mode:chainMode, execution:chainExec });
  showChainDetail(pbId);
}

function showChainDetail(pbId){
  document.getElementById('d-empty').style.display = 'none';
  document.getElementById('d-content').style.display = 'none';
  let det = document.getElementById('chain-detail');
  if(!det){
    det = document.createElement('div');
    det.id = 'chain-detail';
    det.style.cssText = 'flex:1;padding:0;overflow-y:auto';
    document.getElementById('detail').appendChild(det);
  }
  det.style.display = 'block';
  det.innerHTML =
    '<div style="padding:18px 24px 8px;font-size:16px;font-weight:700;color:var(--fg)">Chain Runner</div>' +
    '<div style="padding:0 24px 10px;display:flex;gap:8px;flex-wrap:wrap">' +
    '<button class="btn btn-pri" onclick="runAllSteps()">&#9654; Run All</button>' +
    '<button class="btn btn-sec" onclick="pauseChain()">&#9646;&#9646; Pause</button>' +
    '<button class="btn btn-sec" onclick="runComposite()" title="Run as Salesforce Composite API">&#9728; Composite</button>' +
    '</div>' +
    '<div id="chain-timeline" style="padding:0 24px 16px"></div>' +
    '<div id="chain-composite-wrap" style="display:none;padding:0 24px 16px">' +
    '<div style="font-size:11px;font-weight:700;color:var(--fg3);text-transform:uppercase;margin-bottom:6px">Composite Response</div>' +
    '<pre id="chain-composite-resp" style="background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:12px;font-size:11px;max-height:300px;overflow-y:auto"></pre>' +
    '</div>';
  renderChainTimeline();
}

let chainPaused = false;
function pauseChain(){ chainPaused = true; }

function runAllSteps(){
  chainPaused = false;
  if(chainMode === 'composite'){ runComposite(); return; }
  vscMsg({ type:'chainRunAll' });
}

function runComposite(){
  document.getElementById('chain-composite-wrap').style.display = 'block';
  vscMsg({ type:'chainComposite' });
}

function renderChainTimeline(){
  const tl = document.getElementById('chain-timeline');
  if(!tl || !chainSession) return;
  tl.innerHTML = chainSession.steps.map((step, i) => {
    const icon = step.status==='done' ? '&#10003;' : step.status==='error' ? '&#10007;' :
                 step.status==='running' ? '<span class="spin">&#9696;</span>' : '○';
    const color = step.status==='done'?'var(--green)': step.status==='error'?'var(--red)':
                  step.status==='running'?'var(--yellow)':'var(--fg3)';
    const dur = step.response ? ' <span style="color:var(--fg3);font-size:10px">'+step.response.durationMs+'ms</span>' : '';
    const httpBadge = step.response ?
      '<span style="font-size:10px;padding:1px 6px;border-radius:3px;margin-left:6px;background:'+(step.response.status<300?'#0d3b2e':'#3b2d0d')+';color:'+(step.response.status<300?'var(--green)':'var(--yellow)')+'">HTTP '+step.response.status+'</span>' : '';

    const extracted = Object.entries(step.extractedValues).map(([k,v]) =>
      '<div style="font-size:10px;color:var(--cyan);margin-top:2px">&#8627; extracted '+esc(k.split('.').pop())+': <b>'+esc(v)+'</b></div>'
    ).join('');

    const isActive = chainSession.activeStep === i && step.status === 'pending';
    const bodyArea = isActive ?
      '<textarea id="chain-body-'+i+'" style="width:100%;min-height:80px;padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:4px;color:var(--fg);font-size:11px;font-family:monospace;resize:vertical;margin-top:6px">'+esc(step.resolvedBody)+'</textarea>' +
      '<div style="margin-top:4px;display:flex;gap:6px">' +
      '<button class="btn btn-pri" style="font-size:11px;padding:3px 10px" onclick="runStep('+i+')">&#9654; Run Step</button>' +
      '<button class="btn btn-sec" style="font-size:11px;padding:3px 10px" onclick="saveBodyOverride('+i+')">Save Edit</button>' +
      '<button class="btn btn-sec" style="font-size:11px;padding:3px 10px" onclick="runFrom('+i+')">Run from here &#8594;</button>' +
      '</div>' : '';

    const rerunBtn = (step.status==='done'||step.status==='error') ?
      '<button class="btn btn-sec" style="font-size:10px;padding:2px 8px;margin-left:6px" onclick="resetAndEdit('+i+')">Re-run</button>' : '';

    return '<div style="margin-bottom:10px;padding:10px 12px;background:var(--bg2);border:1px solid '+(isActive?'var(--acc)':'var(--border)')+';border-radius:6px">' +
      '<div style="display:flex;align-items:center;gap:8px">' +
      '<span style="color:'+color+';font-size:14px">'+icon+'</span>' +
      '<span style="font-size:12px;font-weight:600;color:var(--fg)">'+esc(step.label)+'</span>' +
      dur + httpBadge + rerunBtn +
      '</div>' +
      '<div style="font-size:10px;color:var(--fg3);margin-top:2px;font-family:monospace">'+esc(step.resolvedPath)+'</div>' +
      extracted +
      bodyArea +
      (step.response && step.status==='done' ?
        '<details style="margin-top:6px"><summary style="font-size:10px;color:var(--fg3);cursor:pointer">Response</summary>' +
        '<pre style="font-size:10px;max-height:150px;overflow-y:auto;margin-top:4px;padding:6px;background:var(--bg);border-radius:4px">'+esc(step.response.body.slice(0,2000))+'</pre></details>' : '') +
      '</div>';
  }).join('');
}

function runStep(i){
  const bodyEl = document.getElementById('chain-body-'+i);
  if(bodyEl && chainSession){ chainSession.steps[i].resolvedBody = bodyEl.value; }
  vscMsg({ type:'chainStep', stepIdx:i });
}

function runFrom(i){
  const bodyEl = document.getElementById('chain-body-'+i);
  if(bodyEl && chainSession){ chainSession.steps[i].resolvedBody = bodyEl.value; }
  vscMsg({ type:'chainRunFrom', fromStepIdx:i });
}

function saveBodyOverride(i){
  const bodyEl = document.getElementById('chain-body-'+i);
  if(!bodyEl || !chainSession) return;
  vscMsg({ type:'chainOverride', stepIdx:i, target:'next.body.__raw__', value:bodyEl.value });
}

function resetAndEdit(i){
  vscMsg({ type:'chainResetStep', stepIdx:i });
}

function renderRunHistory(){
  const el = document.getElementById('run-history-list');
  if(!el) return;
  if(!runs.length){ el.innerHTML = '<div style="padding:8px 14px;font-size:11px;color:var(--fg3)">No runs yet.</div>'; return; }
  el.innerHTML = runs.map(r => {
    const icon = r.status==='completed'?'&#10003;':r.status==='partial'?'&#9888;':'&#10007;';
    const color = r.status==='completed'?'var(--green)':r.status==='partial'?'var(--yellow)':'var(--red)';
    const date = r.startedAt.slice(0,16).replace('T',' ');
    return '<div style="margin:4px 10px;padding:8px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:5px">' +
      '<div style="display:flex;align-items:center;gap:6px">' +
      '<span style="color:'+color+'">'+icon+'</span>' +
      '<span style="font-size:11px;font-weight:600;color:var(--fg)">'+esc(r.playbookName)+'</span>' +
      '<span style="font-size:10px;color:var(--fg3)">'+esc(r.org)+'</span>' +
      '</div>' +
      '<div style="font-size:10px;color:var(--fg3);margin-top:2px">'+date+' · '+r.steps.length+' steps</div>' +
      '<div style="margin-top:5px;display:flex;gap:5px">' +
      '<button class="btn btn-sec" style="font-size:10px;padding:2px 8px" onclick="loadRun(\''+esc(r.id)+'\')">Load</button>' +
      '<button class="btn btn-sec" style="font-size:10px;padding:2px 8px" onclick="rerunFromHistory(\''+esc(r.playbookId)+'\')">Re-run</button>' +
      '</div></div>';
  }).join('');
}

function loadRun(runId){
  vscMsg({ type:'chainLoadRun', runId });
}

function rerunFromHistory(pbId){
  startPlaybook(pbId);
}

function renderLoadedRun(run){
  document.getElementById('d-empty').style.display = 'none';
  document.getElementById('d-content').style.display = 'none';
  let det = document.getElementById('chain-detail');
  if(!det){
    det = document.createElement('div');
    det.id = 'chain-detail';
    det.style.cssText = 'flex:1;padding:0;overflow-y:auto';
    document.getElementById('detail').appendChild(det);
  }
  det.style.display = 'block';
  det.innerHTML =
    '<div style="padding:18px 24px 8px;font-size:16px;font-weight:700;color:var(--fg)">&#128196; '+esc(run.playbookName)+'</div>' +
    '<div style="padding:0 24px 12px;font-size:11px;color:var(--fg3)">'+esc(run.org)+' · '+esc(run.startedAt.slice(0,16).replace('T',' '))+' · '+run.mode+' / '+run.execution+'</div>' +
    '<div style="padding:0 24px">' +
    run.steps.map(s => {
      const ok = s.responseStatus >= 200 && s.responseStatus < 300;
      return '<div style="margin-bottom:10px;padding:10px 12px;background:var(--bg2);border:1px solid var(--border);border-radius:6px">' +
        '<div style="display:flex;align-items:center;gap:8px">' +
        '<span style="color:'+(ok?'var(--green)':'var(--red)')+'">'+( ok?'&#10003;':'&#10007;')+'</span>' +
        '<span style="font-size:12px;font-weight:600">'+esc(s.label)+'</span>' +
        '<span style="font-size:10px;padding:1px 6px;border-radius:3px;background:'+(ok?'#0d3b2e':'#3b2d0d')+';color:'+(ok?'var(--green)':'var(--red)')+'">HTTP '+s.responseStatus+'</span>' +
        '<span style="font-size:10px;color:var(--fg3)">'+s.durationMs+'ms</span>' +
        '</div>' +
        '<div style="font-size:10px;color:var(--fg3);font-family:monospace;margin-top:3px">'+esc(s.path)+'</div>' +
        '<details style="margin-top:6px"><summary style="font-size:10px;color:var(--fg3);cursor:pointer">Request / Response</summary>' +
        '<div style="font-size:10px;color:var(--fg2);margin-top:4px">Request:</div>' +
        '<pre style="font-size:10px;max-height:120px;overflow-y:auto;padding:6px;background:var(--bg);border-radius:4px">'+esc(s.requestBody)+'</pre>' +
        '<div style="font-size:10px;color:var(--fg2);margin-top:4px">Response:</div>' +
        '<pre style="font-size:10px;max-height:120px;overflow-y:auto;padding:6px;background:var(--bg);border-radius:4px">'+esc(s.responseBody.slice(0,1500))+'</pre>' +
        '</details></div>';
    }).join('') +
    '</div>';
}
```

- [ ] **Step 6: Verify the panel.js has no syntax errors**

```bash
node --check "/Users/vkumar4/revenue cloud doc/rc-api-explorer-extension/media/panel.js" 2>&1
```
Expected: no output (means no syntax errors).

- [ ] **Step 7: Commit**

```bash
git add media/panel.js src/apiExplorerPanel.ts
git commit -m "feat: add Playbooks tab UI with chain timeline, run history, and mode switchers"
```

---

## Task 7: Build, Package, Install

- [ ] **Step 1: Run TypeScript check**

```bash
cd "/Users/vkumar4/revenue cloud doc/rc-api-explorer-extension"
npx tsc --noEmit 2>&1
```
Expected: no errors.

- [ ] **Step 2: Build with esbuild**

```bash
cd "/Users/vkumar4/revenue cloud doc/rc-api-explorer-extension"
node esbuild.js 2>&1
```
Expected: `[esbuild] build complete`

- [ ] **Step 3: Package**

```bash
cd "/Users/vkumar4/revenue cloud doc/rc-api-explorer-extension"
npx @vscode/vsce package --allow-missing-repository 2>&1
```
Expected: `Packaged: ...rc-api-explorer-1.0.0.vsix`

- [ ] **Step 4: Install**

```bash
code --install-extension "/Users/vkumar4/revenue cloud doc/rc-api-explorer-extension/rc-api-explorer-1.0.0.vsix" 2>&1
```
Expected: `Extension 'rc-api-explorer-1.0.0.vsix' was successfully installed.`

- [ ] **Step 5: Reload VS Code and smoke test**

1. `Cmd+Shift+P` → "Developer: Reload Window"
2. `Cmd+Shift+R` → Open API Explorer
3. Click "⛓ Playbooks" button in sidebar
4. Verify 3 playbook cards appear
5. Select org → click Start on "Catalog Discovery Flow"
6. Verify step timeline appears in detail panel
7. Click "▶ Run Step" on Step 1 — verify HTTP response shows and extracted catalogId populates Step 2 body
8. Click "Run All" — verify all 4 steps fire in sequence
9. Verify run appears in Run History

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: ship API chaining playbooks v1 — 3 flows, 3 engine modes, run history"
```
