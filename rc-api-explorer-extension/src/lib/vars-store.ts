import * as fs   from 'fs';
import * as path from 'path';

export interface OrgVars {
  [name: string]: string;
}

function varsFile(workspaceRoot: string, orgAlias: string): string {
  const dir = path.join(workspaceRoot, '.rc-explorer');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `vars_${orgAlias.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`);
}

export function loadVars(workspaceRoot: string, orgAlias: string): OrgVars {
  const file = varsFile(workspaceRoot, orgAlias);
  if (!fs.existsSync(file)) { return {}; }
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}

export function saveVars(workspaceRoot: string, orgAlias: string, vars: OrgVars): void {
  const file = varsFile(workspaceRoot, orgAlias);
  fs.writeFileSync(file, JSON.stringify(vars, null, 2), 'utf8');
}

export function setVar(workspaceRoot: string, orgAlias: string, name: string, value: string): OrgVars {
  const vars = loadVars(workspaceRoot, orgAlias);
  vars[name] = value;
  saveVars(workspaceRoot, orgAlias, vars);
  return vars;
}

export function deleteVar(workspaceRoot: string, orgAlias: string, name: string): OrgVars {
  const vars = loadVars(workspaceRoot, orgAlias);
  delete vars[name];
  saveVars(workspaceRoot, orgAlias, vars);
  return vars;
}

// Replace {{VAR_NAME}} tokens in a string with values from vars map
export function substituteVars(text: string, vars: OrgVars): string {
  return text.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, name) => vars[name] ?? match);
}

// ── Environments ──────────────────────────────────────────────────────────────

export interface Environment {
  name:     string;
  orgAlias: string;
  vars:     OrgVars;
}

interface EnvStore {
  active: string;
  envs:   Environment[];
}

// Environments are stored in global extension storage (fixed path, workspace-independent).
// globalStorageRoot is context.globalStorageUri.fsPath passed from the panel.
function envFile(globalStorageRoot: string): string {
  return path.join(globalStorageRoot, 'environments.json');
}

// Migrate legacy workspace-relative environments.json → global storage (runs once).
export function migrateEnvs(globalStorageRoot: string, workspaceRoot: string): void {
  const globalFile = envFile(globalStorageRoot);
  if (fs.existsSync(globalFile)) { return; }
  const legacyFile = path.join(workspaceRoot, '.rc-explorer', 'environments.json');
  if (!fs.existsSync(legacyFile)) { return; }
  try {
    fs.mkdirSync(globalStorageRoot, { recursive: true });
    fs.copyFileSync(legacyFile, globalFile);
  } catch { /* ignore migration errors */ }
}

function readEnvStore(globalStorageRoot: string): EnvStore {
  const f = envFile(globalStorageRoot);
  if (!fs.existsSync(f)) { return { active: '', envs: [] }; }
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return { active: '', envs: [] }; }
}

function writeEnvStore(globalStorageRoot: string, store: EnvStore): void {
  fs.mkdirSync(globalStorageRoot, { recursive: true });
  fs.writeFileSync(envFile(globalStorageRoot), JSON.stringify(store, null, 2), 'utf8');
}

export function listEnvs(workspaceRoot: string): Environment[] {
  return readEnvStore(workspaceRoot).envs;
}

export function getActiveEnvName(workspaceRoot: string): string {
  return readEnvStore(workspaceRoot).active;
}

export function getActiveEnv(workspaceRoot: string): Environment | undefined {
  const store = readEnvStore(workspaceRoot);
  return store.envs.find(e => e.name === store.active);
}

export function createEnv(workspaceRoot: string, name: string, orgAlias: string): Environment {
  const store = readEnvStore(workspaceRoot);
  const existing = store.envs.find(e => e.name === name);
  if (existing) { return existing; }
  const env: Environment = { name, orgAlias, vars: {} };
  store.envs.push(env);
  if (!store.active) { store.active = name; }
  writeEnvStore(workspaceRoot, store);
  return env;
}

export function deleteEnv(workspaceRoot: string, name: string): void {
  const store = readEnvStore(workspaceRoot);
  store.envs = store.envs.filter(e => e.name !== name);
  if (store.active === name) { store.active = store.envs[0]?.name ?? ''; }
  writeEnvStore(workspaceRoot, store);
}

export function setActiveEnv(workspaceRoot: string, name: string): void {
  const store = readEnvStore(workspaceRoot);
  store.active = name;
  writeEnvStore(workspaceRoot, store);
}

export function setEnvVar(workspaceRoot: string, envName: string, varName: string, value: string): Environment | undefined {
  const store = readEnvStore(workspaceRoot);
  const env = store.envs.find(e => e.name === envName);
  if (!env) { return undefined; }
  env.vars[varName] = value;
  writeEnvStore(workspaceRoot, store);
  return env;
}

export function deleteEnvVar(workspaceRoot: string, envName: string, varName: string): Environment | undefined {
  const store = readEnvStore(workspaceRoot);
  const env = store.envs.find(e => e.name === envName);
  if (!env) { return undefined; }
  delete env.vars[varName];
  writeEnvStore(workspaceRoot, store);
  return env;
}

export function updateEnvOrg(workspaceRoot: string, envName: string, orgAlias: string): void {
  const store = readEnvStore(workspaceRoot);
  const env = store.envs.find(e => e.name === envName);
  if (env) { env.orgAlias = orgAlias; writeEnvStore(workspaceRoot, store); }
}
