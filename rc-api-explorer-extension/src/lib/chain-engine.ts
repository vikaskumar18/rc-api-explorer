import { ENDPOINTS } from './endpoints';
import { PLAYBOOKS, Playbook, PlaybookStep } from './playbooks';
import { CHAIN_CONFIG, EngineMode, ExecMode } from './chain-config';

export type StepStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped';

export interface StepState {
  stepId:             string;
  endpointId:         string;
  label:              string;
  status:             StepStatus;
  resolvedPath:       string;
  resolvedBody:       string;
  response?:          { status: number; body: string; durationMs: number };
  extractedValues:    Record<string, string>;
  extractionWarnings: string[];
  manualOverrides:    Record<string, string>;
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

export function resolveJsonPath(obj: any, path: string): string | undefined {
  if (!path.startsWith('$')) { return undefined; }
  const parts = path
    .slice(2)
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.');
  let cur: any = obj;
  for (const part of parts) {
    if (cur == null) { return undefined; }
    cur = cur[part];
  }
  return cur == null ? undefined : String(cur);
}

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
      const parts = field.replace(/\[(\d+)\]/g, '.$1').split('.');
      let cur: any = parsed;
      for (let i = 0; i < parts.length - 1; i++) {
        if (cur[parts[i]] == null) {
          // Create array when the next key is a numeric index
          cur[parts[i]] = isNaN(Number(parts[i + 1])) ? {} : [];
        }
        cur = cur[parts[i]];
      }
      const lastKey = parts[parts.length - 1];
      cur[isNaN(Number(lastKey)) ? lastKey : Number(lastKey)] = value;
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
  extraPlaybooks:     Playbook[] = [],
  apiVersion?:        string,
): ChainSession {
  const playbook = [...PLAYBOOKS, ...extraPlaybooks].find(p => p.id === playbookId);
  if (!playbook) { throw new Error(`Playbook "${playbookId}" not found`); }

  const mode      = modeOverride      ?? playbook.mode      ?? CHAIN_CONFIG.defaultMode;
  const execution = executionOverride ?? playbook.execution ?? CHAIN_CONFIG.defaultExecution;
  const ver       = apiVersion || 'v66.0';

  const steps: StepState[] = playbook.steps.map(step => {
    const ep = ENDPOINTS.find(e => e.id === step.endpointId);
    const isBodyMethod = ep && ['POST','PUT','PATCH'].includes(ep.methods[0]);
    const defaultBody = isBodyMethod ? (step.initialBody ?? ep!.request) : '';
    return {
      stepId:             step.id,
      endpointId:         step.endpointId,
      label:              step.label,
      status:             'pending' as StepStatus,
      resolvedPath:       ep ? `/services/data/${ver}${ep.path}` : '',
      resolvedBody:       defaultBody,
      extractedValues:    {},
      extractionWarnings: [],
      manualOverrides:    {},
    };
  });

  return { playbookId, mode, execution, orgAlias, activeStep: 0, steps, startedAt: new Date().toISOString() };
}

export function applyStepResult(
  session:  ChainSession,
  stepIdx:  number,
  result:   { status: number; body: string; durationMs: number },
  extraPlaybooks: Playbook[] = [],
): ChainSession {
  const updated = { ...session, steps: session.steps.map(s => ({ ...s })) };
  const stepState = updated.steps[stepIdx];
  stepState.status   = result.status >= 200 && result.status < 300 ? 'done' : 'error';
  stepState.response = result;

  const playbook = [...PLAYBOOKS, ...extraPlaybooks].find(p => p.id === session.playbookId)!;
  const pbStep: PlaybookStep = playbook.steps[stepIdx];

  let parsedBody: any = {};
  try { parsedBody = JSON.parse(result.body); } catch { /* ignore */ }

  const extracted: Record<string, string> = {};
  const extractionWarnings: string[] = [];
  if (pbStep.extract) {
    for (const rule of pbStep.extract) {
      const val = resolveJsonPath(parsedBody, rule.from);
      if (val !== undefined) { extracted[rule.into] = val; }
      else { extractionWarnings.push(`${rule.from} → ${rule.into}`); }
    }
  }
  stepState.extractedValues    = extracted;
  stepState.extractionWarnings = extractionWarnings;

  const nextIdx = stepIdx + 1;
  if (nextIdx < updated.steps.length) {
    // Apply extractions to ALL remaining pending steps (not just the next one)
    // so values like catalogId propagate through the whole chain
    for (let j = nextIdx; j < updated.steps.length; j++) {
      const futureState = updated.steps[j];
      if (futureState.status !== 'pending') { continue; }
      for (const [target, value] of Object.entries(extracted)) {
        if (futureState.manualOverrides[target] !== undefined) { continue; }
        const { body, path } = applyExtraction(futureState.resolvedBody, futureState.resolvedPath, target, value);
        futureState.resolvedBody = body;
        futureState.resolvedPath = path;
      }
    }
    updated.activeStep = nextIdx;
  }

  return updated;
}

export function applyManualOverride(
  session: ChainSession,
  stepIdx: number,
  target:  string,
  value:   string,
): ChainSession {
  const updated = { ...session, steps: session.steps.map(s => ({ ...s })) };
  const stepState = updated.steps[stepIdx];
  if (target === 'path.__raw__') {
    stepState.resolvedPath = value;
    return updated;
  }
  if (target === 'body.__raw__') {
    stepState.resolvedBody = value;
    return updated;
  }
  stepState.manualOverrides[target] = value;
  const { body, path } = applyExtraction(stepState.resolvedBody, stepState.resolvedPath, target, value);
  stepState.resolvedBody = body;
  stepState.resolvedPath = path;
  return updated;
}

export function resetStep(session: ChainSession, stepIdx: number, extraPlaybooks: Playbook[] = [], apiVersion?: string): ChainSession {
  const updated = { ...session, steps: session.steps.map(s => ({ ...s })) };
  const stepState = updated.steps[stepIdx];
  const ep = ENDPOINTS.find(e => e.id === stepState.endpointId);
  const playbook = [...PLAYBOOKS, ...extraPlaybooks].find(p => p.id === session.playbookId);
  const pbStep = playbook?.steps[stepIdx];
  const isBodyMethod = ep && ['POST','PUT','PATCH'].includes(ep.methods[0]);
  const ver = apiVersion || session.steps[stepIdx].resolvedPath.match(/\/services\/data\/(v\d+\.\d+)\//)?.[1] || 'v66.0';
  stepState.status             = 'pending';
  stepState.response           = undefined;
  stepState.resolvedPath       = ep ? `/services/data/${ver}${ep.path}` : stepState.resolvedPath;
  stepState.resolvedBody       = isBodyMethod ? (pbStep?.initialBody ?? ep!.request) : '';
  stepState.extractedValues    = {};
  stepState.extractionWarnings = [];
  // Re-apply auto-extractions from the previous step before manual overrides
  if (stepIdx > 0) {
    const prevExtracted = updated.steps[stepIdx - 1].extractedValues;
    for (const [target, value] of Object.entries(prevExtracted)) {
      const { body, path } = applyExtraction(stepState.resolvedBody, stepState.resolvedPath, target, value);
      stepState.resolvedBody = body;
      stepState.resolvedPath = path;
    }
  }
  for (const [target, value] of Object.entries(stepState.manualOverrides)) {
    const { body, path } = applyExtraction(stepState.resolvedBody, stepState.resolvedPath, target, value);
    stepState.resolvedBody = body;
    stepState.resolvedPath = path;
  }
  updated.activeStep = stepIdx;
  return updated;
}

export function buildCompositeBody(session: ChainSession): object {
  const compositeRequest = session.steps.map((stepState, i) => {
    const ep = ENDPOINTS.find(e => e.id === stepState.endpointId);
    const method = ep?.methods[0] ?? 'GET';
    const hasBody = ['POST', 'PUT', 'PATCH'].includes(method);
    const entry: any = {
      method,
      url:         stepState.resolvedPath.replace(/\/services\/data\/v\d+\.\d+/, ''),
      referenceId: `step${i}_${stepState.stepId.replace(/-/g, '_')}`,
    };
    if (hasBody) {
      try { entry.body = JSON.parse(stepState.resolvedBody); } catch { entry.body = {}; }
    }
    return entry;
  });
  return { compositeRequest, allOrNone: false };
}
