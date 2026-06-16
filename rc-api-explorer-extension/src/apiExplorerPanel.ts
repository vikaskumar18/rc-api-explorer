import * as vscode from 'vscode';
import { listOrgs, callApi, preWarmToken, OrgInfo } from './lib/orgAuth';
import { ENDPOINTS } from './lib/endpoints';
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
import { saveRun, saveSingleRun, listRuns, loadRun, clearRuns } from './lib/run-store';
import {
  loadVars, setVar, deleteVar,
  listEnvs, getActiveEnvName, getActiveEnv, createEnv, deleteEnv, setActiveEnv,
  setEnvVar, deleteEnvVar, updateEnvOrg, Environment,
} from './lib/vars-store';
import { listCustomRequests, saveCustomRequest, updateCustomRequest, deleteCustomRequest, importCustomRequests } from './lib/custom-store';
import { listCustomPlaybooks, saveCustomPlaybook, deleteCustomPlaybook } from './lib/custom-playbooks-store';
import { appendHistory, listHistory, clearHistory } from './lib/history-store';
import * as os from 'os';

export class ApiExplorerPanel {
  private panel: vscode.WebviewPanel;
  private orgs: OrgInfo[] = [];
  private chainSession: ChainSession | null = null;
  private outputChannel: vscode.OutputChannel;
  _onRunSaved: (() => void) | undefined;

  constructor(
    private context: vscode.ExtensionContext,
    private onDispose: () => void
  ) {
    this.outputChannel = vscode.window.createOutputChannel('RC API Explorer');

    this.panel = vscode.window.createWebviewPanel(
      'rcApiExplorer',
      'Revenue Cloud API Explorer',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
      }
    );

    // Register listener BEFORE setting html so no 'ready' message is missed
    this.panel.webview.onDidReceiveMessage(
      (msg) => this.handleMessage(msg),
      undefined,
      context.subscriptions
    );

    this.panel.onDidDispose(() => {
      this.outputChannel.dispose();
      this.onDispose();
    });

    this.panel.webview.html = this.buildHtml();
  }

  reveal(): void {
    this.panel.reveal();
  }

  loadRunInPanel(runId: string): void {
    this.panel.reveal();
    const run = loadRun(this.workspaceRoot(), runId);
    if (run) { this.postMsg({ type: 'chainRunLoaded', run }); }
  }

  relaunchRunInPanel(runId: string): void {
    this.panel.reveal();
    const run = loadRun(this.workspaceRoot(), runId);
    if (run) { this.postMsg({ type: 'relaunchRun', run }); }
  }

  async refreshOrgs(): Promise<void> {
    try {
      this.orgs = await listOrgs();
      this.postMsg({ type: 'orgsRefreshed', orgs: this.orgs });
      vscode.window.showInformationMessage(`Found ${this.orgs.length} authenticated org(s).`);
    } catch (err: any) {
      this.postMsg({ type: 'orgsError', error: err.message });
    }
  }

  private async loadInitialData(): Promise<void> {
    this.outputChannel.appendLine('[RC] loadInitialData called');
    this.postMsg({ type: 'loading', message: 'Loading authenticated orgs…' });
    try {
      this.orgs = await listOrgs();
      this.outputChannel.appendLine(`[RC] listOrgs returned ${this.orgs.length} orgs`);
    } catch (err: any) {
      this.orgs = [];
      const msg = String(err?.message ?? err);
      this.outputChannel.appendLine(`[RC] listOrgs error: ${msg}`);
      this.postMsg({ type: 'orgsError', error: msg });
    }
    this.outputChannel.appendLine(`[RC] sending init with ${ENDPOINTS.length} endpoints`);
    const defaultOrg = this.orgs.find(o => o.isDefault)?.alias ?? this.orgs[0]?.alias ?? '';
    // Load vars for legacy compat
    const vars = defaultOrg ? loadVars(this.workspaceRoot(), defaultOrg) : {};
    // Environments
    const envs = listEnvs(this.workspaceRoot());
    const activeEnvName = getActiveEnvName(this.workspaceRoot());
    const activeEnv = getActiveEnv(this.workspaceRoot());
    this.postMsg({
      type:           'init',
      orgs:           this.orgs,
      endpoints:      ENDPOINTS,
      apiVersion:     'v67.0',
      playbooks:      PLAYBOOKS,
      customPlaybooks: listCustomPlaybooks(this.workspaceRoot()),
      chainConfig:    CHAIN_CONFIG,
      runs:           listRuns(this.workspaceRoot()),
      vars,
      varsOrg:        defaultOrg,
      customRequests: listCustomRequests(this.workspaceRoot()),
      envs,
      activeEnvName,
      activeEnvVars:  activeEnv?.vars ?? {},
      history:        listHistory(this.workspaceRoot()),
    });
  }

  private async handleMessage(msg: any): Promise<void> {
    this.outputChannel.appendLine(`[RC] handleMessage: ${msg.type}`);
    switch (msg.type) {

      case 'ready':
        await this.loadInitialData();
        break;

      case 'refreshOrgs':
        await this.refreshOrgs();
        break;

      case 'preWarmToken':
        if (msg.orgAlias) {
          preWarmToken(msg.orgAlias).then(alive => {
            this.outputChannel.appendLine(`[preWarmToken] ${msg.orgAlias} → alive=${alive}`);
            if (!alive) {
              this.postMsg({ type: 'sessionExpired', orgAlias: msg.orgAlias });
            }
          }).catch(e => {
            this.outputChannel.appendLine(`[preWarmToken] ${msg.orgAlias} → error: ${e?.message}`);
          });
        }
        break;

      case 'executeApi': {
        const { requestId, orgAlias, method, path, body, apiVersion, endpointId, endpointName } = msg;
        this.postMsg({ type: 'execStarted', requestId });
        this.outputChannel.appendLine(`\n[${new Date().toISOString()}] ${method} ${path} → ${orgAlias}`);
        const ver = apiVersion || 'v67.0';
        const fullPath = path.startsWith('/services/data/')
          ? path.replace(/\/services\/data\/v[\d.]+\//, `/services/data/${ver}/`)
          : `/services/data/${ver}${path}`;
        const result = await callApi(orgAlias, method, fullPath, body || undefined);
        this.outputChannel.appendLine(`HTTP ${result.status} (${result.durationMs}ms)`);
        this.outputChannel.appendLine(result.body.slice(0, 2000));
        this.postMsg({ type: 'execResult', requestId, ...result });
        // Save every single API execution to run history
        if (endpointId && orgAlias) {
          saveSingleRun(this.workspaceRoot(), {
            endpointId:   endpointId,
            endpointName: endpointName ?? endpointId,
            org:          orgAlias,
            method,
            path:         fullPath,
            requestBody:  body ?? '',
            status:       result.status,
            responseBody: result.body,
            durationMs:   result.durationMs,
          });
          this.postMsg({ type: 'runsRefreshed', runs: listRuns(this.workspaceRoot()) });
          this._onRunSaved?.();
        }
        // Always append to execution history
        appendHistory(this.workspaceRoot(), {
          timestamp: new Date().toISOString(), method, path: fullPath, orgAlias,
          status: result.status, durationMs: result.durationMs,
          requestBody: body ?? '', responseBody: result.body,
          endpointId, endpointName,
        });
        this.postMsg({ type: 'historyUpdated', history: listHistory(this.workspaceRoot()) });
        break;
      }

      case 'openOutputChannel':
        this.outputChannel.show();
        break;

      case 'chainStart': {
        const { playbookId, orgAlias, mode, execution } = msg;
        try {
          this.chainSession = createSession(playbookId, orgAlias, mode, execution, listCustomPlaybooks(this.workspaceRoot()));
          this.postMsg({ type: 'chainStarted', session: this.chainSession });
        } catch (err: any) {
          this.postMsg({ type: 'chainError', error: err.message });
        }
        break;
      }

      case 'chainStep': {
        const { stepIdx } = msg;
        if (!this.chainSession) { break; }
        if (msg.body != null) { this.chainSession.steps[stepIdx].resolvedBody = msg.body; }
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
        this.chainSession = applyStepResult(this.chainSession, stepIdx, result, listCustomPlaybooks(this.workspaceRoot()));
        this.postMsg({ type: 'chainStepDone', stepIdx, session: this.chainSession, result });
        break;
      }

      case 'chainRunAll': {
        if (!this.chainSession) { break; }
        const isHybrid = this.chainSession.execution === 'hybrid';
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
          this.chainSession = applyStepResult(this.chainSession, i, result, listCustomPlaybooks(this.workspaceRoot()));
          this.postMsg({ type: 'chainStepDone', stepIdx: i, session: this.chainSession, result });
          if (this.chainSession.steps[i].status === 'error') { break; }
          // In hybrid mode, pause after each step so user can review extracted vars
          if (isHybrid && i < this.chainSession.steps.length - 1) { break; }
        }
        const allDone = this.chainSession.steps.every(s => s.status === 'done');
        if (allDone) {
          const custPbs = listCustomPlaybooks(this.workspaceRoot());
          const pb = [...PLAYBOOKS, ...custPbs].find(p => p.id === this.chainSession!.playbookId);
          saveRun(this.workspaceRoot(), this.chainSession, pb?.name ?? this.chainSession.playbookId);
          this.postMsg({ type: 'runsRefreshed', runs: listRuns(this.workspaceRoot()) });
        }
        break;
      }

      case 'chainRunFrom': {
        const { fromStepIdx } = msg;
        if (!this.chainSession) { break; }
        if (msg.body != null) { this.chainSession.steps[fromStepIdx].resolvedBody = msg.body; }
        const isHybrid2 = this.chainSession.execution === 'hybrid';
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
          this.chainSession = applyStepResult(this.chainSession, i, result, listCustomPlaybooks(this.workspaceRoot()));
          this.postMsg({ type: 'chainStepDone', stepIdx: i, session: this.chainSession, result });
          if (this.chainSession.steps[i].status === 'error') { break; }
          if (isHybrid2 && i < this.chainSession.steps.length - 1) { break; }
        }
        const allDone2 = this.chainSession.steps.every(s => s.status === 'done');
        if (allDone2) {
          const custPbs2 = listCustomPlaybooks(this.workspaceRoot());
          const pb2 = [...PLAYBOOKS, ...custPbs2].find(p => p.id === this.chainSession!.playbookId);
          saveRun(this.workspaceRoot(), this.chainSession, pb2?.name ?? this.chainSession.playbookId);
          this.postMsg({ type: 'runsRefreshed', runs: listRuns(this.workspaceRoot()) });
        }
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
        this.chainSession = resetStep(this.chainSession, stepIdx, listCustomPlaybooks(this.workspaceRoot()));
        this.postMsg({ type: 'chainSessionUpdated', session: this.chainSession });
        break;
      }

      case 'orgQuery': {
        const orgAlias = this.chainSession?.orgAlias ?? msg.orgAlias;
        if (!orgAlias) { this.postMsg({ type: 'orgQueryResult', requestId: msg.requestId, records: [], error: 'No org selected' }); break; }
        try {
          const encoded = encodeURIComponent(msg.soql);
          const result = await callApi(orgAlias, 'GET', `/services/data/v67.0/query?q=${encoded}`);
          let records: any[] = [];
          try { records = JSON.parse(result.body).records ?? []; } catch { /* ignore */ }
          const error = result.status >= 400 ? result.body : undefined;
          this.postMsg({ type: 'orgQueryResult', requestId: msg.requestId, records, error });
        } catch (err: any) {
          this.postMsg({ type: 'orgQueryResult', requestId: msg.requestId, records: [], error: String(err?.message ?? err) });
        }
        break;
      }

      case 'assignPermSets': {
        const { pbId, permApiNames, orgAlias } = msg;
        const org = orgAlias ?? this.chainSession?.orgAlias;
        if (!org) { this.postMsg({ type: 'permAssignResult', pbId, error: 'No org selected', results: [] }); break; }
        try {
          const meResult = await callApi(org, 'GET', '/services/data/v67.0/chatter/users/me');
          const userId = JSON.parse(meResult.body)?.id;
          if (!userId) { throw new Error('Could not get current user ID'); }
          const results: { apiName: string; ok: boolean; error?: string }[] = [];
          for (const apiName of (permApiNames as string[])) {
            try {
              const psResult = await callApi(org, 'GET',
                `/services/data/v67.0/query?q=${encodeURIComponent(`SELECT Id FROM PermissionSet WHERE Name='${apiName}' LIMIT 1`)}`);
              const psRecords = JSON.parse(psResult.body)?.records ?? [];
              if (!psRecords.length) { results.push({ apiName, ok: false, error: 'Not found in org' }); continue; }
              const psId = psRecords[0].Id;
              const checkResult = await callApi(org, 'GET',
                `/services/data/v67.0/query?q=${encodeURIComponent(`SELECT Id FROM PermissionSetAssignment WHERE AssigneeId='${userId}' AND PermissionSetId='${psId}' LIMIT 1`)}`);
              if ((JSON.parse(checkResult.body)?.records ?? []).length) { results.push({ apiName, ok: true }); continue; }
              const assignResult = await callApi(org, 'POST', '/services/data/v67.0/sobjects/PermissionSetAssignment',
                JSON.stringify({ AssigneeId: userId, PermissionSetId: psId }));
              const assignBody = JSON.parse(assignResult.body);
              if (assignResult.status === 201 || assignBody.success || assignBody.id) {
                results.push({ apiName, ok: true });
              } else {
                results.push({ apiName, ok: false, error: (Array.isArray(assignBody) ? assignBody[0]?.message : assignBody.message) ?? 'Assignment failed' });
              }
            } catch (e: any) {
              results.push({ apiName, ok: false, error: e.message ?? String(e) });
            }
          }
          this.postMsg({ type: 'permAssignResult', pbId, results });
        } catch (err: any) {
          this.postMsg({ type: 'permAssignResult', pbId, error: err.message ?? String(err), results: [] });
        }
        break;
      }

      case 'chainCompositePreview': {
        if (!this.chainSession) { break; }
        const compositeBody = buildCompositeBody(this.chainSession);
        this.postMsg({ type: 'chainCompositePayload', payload: compositeBody });
        break;
      }

      case 'chainComposite': {
        if (!this.chainSession) { break; }
        const rawBody = msg.body ?? JSON.stringify(buildCompositeBody(this.chainSession));
        const result = await callApi(
          this.chainSession.orgAlias,
          'POST',
          '/services/data/v67.0/composite',
          rawBody,
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

      case 'loadVars': {
        const { orgAlias } = msg;
        const vars = loadVars(this.workspaceRoot(), orgAlias);
        this.postMsg({ type: 'varsLoaded', vars, orgAlias });
        break;
      }

      case 'setVar': {
        const { orgAlias, name, value } = msg;
        const vars = setVar(this.workspaceRoot(), orgAlias, name, value);
        this.postMsg({ type: 'varsLoaded', vars, orgAlias });
        break;
      }

      case 'deleteVar': {
        const { orgAlias, name } = msg;
        const vars = deleteVar(this.workspaceRoot(), orgAlias, name);
        this.postMsg({ type: 'varsLoaded', vars, orgAlias });
        break;
      }

      case 'executeCustom': {
        const { requestId, orgAlias, method, path, headers, body, apiVersion } = msg;
        this.postMsg({ type: 'execStarted', requestId });
        const ver = apiVersion || 'v67.0';
        const fullPath = path.startsWith('/services/data/')
          ? path.replace(/\/services\/data\/v[\d.]+\//, `/services/data/${ver}/`)
          : `/services/data/${ver}${path}`;
        const result = await callApi(orgAlias, method, fullPath, body || undefined, headers || undefined);
        appendHistory(this.workspaceRoot(), {
          timestamp: new Date().toISOString(), method, path: fullPath, orgAlias,
          status: result.status, durationMs: result.durationMs,
          requestBody: body ?? '', responseBody: result.body,
        });
        this.postMsg({ type: 'execResult', requestId, ...result });
        this.postMsg({ type: 'historyUpdated', history: listHistory(this.workspaceRoot()) });
        break;
      }

      case 'saveCustomRequest': {
        const { name, method, path, headers, body } = msg;
        const saved = saveCustomRequest(this.workspaceRoot(), { name, method, path, headers: headers ?? {}, body: body ?? '' });
        this.postMsg({ type: 'customRequestsUpdated', customRequests: listCustomRequests(this.workspaceRoot()), savedId: saved.id });
        break;
      }

      case 'updateCustomRequest': {
        const { id, name, method, path, headers, body } = msg;
        updateCustomRequest(this.workspaceRoot(), id, { name, method, path, headers: headers ?? {}, body: body ?? '' });
        this.postMsg({ type: 'customRequestsUpdated', customRequests: listCustomRequests(this.workspaceRoot()) });
        break;
      }

      case 'deleteCustomRequest': {
        const { id } = msg;
        deleteCustomRequest(this.workspaceRoot(), id);
        this.postMsg({ type: 'customRequestsUpdated', customRequests: listCustomRequests(this.workspaceRoot()) });
        break;
      }

      // ── Environments ──────────────────────────────────────────────────────
      case 'createEnv': {
        const { name, orgAlias } = msg;
        createEnv(this.workspaceRoot(), name, orgAlias);
        const envs = listEnvs(this.workspaceRoot());
        this.postMsg({ type: 'envsUpdated', envs, activeEnvName: getActiveEnvName(this.workspaceRoot()), activeEnvVars: getActiveEnv(this.workspaceRoot())?.vars ?? {} });
        break;
      }
      case 'deleteEnv': {
        const { name } = msg;
        deleteEnv(this.workspaceRoot(), name);
        const envs = listEnvs(this.workspaceRoot());
        this.postMsg({ type: 'envsUpdated', envs, activeEnvName: getActiveEnvName(this.workspaceRoot()), activeEnvVars: getActiveEnv(this.workspaceRoot())?.vars ?? {} });
        break;
      }
      case 'switchEnv': {
        const { name } = msg;
        setActiveEnv(this.workspaceRoot(), name);
        const env = getActiveEnv(this.workspaceRoot());
        this.postMsg({ type: 'envsUpdated', envs: listEnvs(this.workspaceRoot()), activeEnvName: name, activeEnvVars: env?.vars ?? {} });
        break;
      }
      case 'setEnvVar': {
        const { envName, varName, value } = msg;
        setEnvVar(this.workspaceRoot(), envName, varName, value);
        const env = getActiveEnv(this.workspaceRoot());
        this.postMsg({ type: 'envsUpdated', envs: listEnvs(this.workspaceRoot()), activeEnvName: getActiveEnvName(this.workspaceRoot()), activeEnvVars: env?.vars ?? {} });
        break;
      }
      case 'deleteEnvVar': {
        const { envName, varName } = msg;
        deleteEnvVar(this.workspaceRoot(), envName, varName);
        const env = getActiveEnv(this.workspaceRoot());
        this.postMsg({ type: 'envsUpdated', envs: listEnvs(this.workspaceRoot()), activeEnvName: getActiveEnvName(this.workspaceRoot()), activeEnvVars: env?.vars ?? {} });
        break;
      }
      case 'updateEnvOrg': {
        const { envName, orgAlias } = msg;
        updateEnvOrg(this.workspaceRoot(), envName, orgAlias);
        this.postMsg({ type: 'envsUpdated', envs: listEnvs(this.workspaceRoot()), activeEnvName: getActiveEnvName(this.workspaceRoot()), activeEnvVars: getActiveEnv(this.workspaceRoot())?.vars ?? {} });
        break;
      }

      // ── History ───────────────────────────────────────────────────────────
      case 'clearHistory': {
        clearHistory(this.workspaceRoot());
        this.postMsg({ type: 'historyUpdated', history: [] });
        break;
      }

      // ── Export / Import ───────────────────────────────────────────────────
      case 'exportCollection': {
        const vscodeApi = require('vscode');
        const uri = await vscodeApi.window.showSaveDialog({
          defaultUri: vscodeApi.Uri.file('rc-collection.json'),
          filters: { 'JSON': ['json'] },
          title: 'Export RC API Collection',
        });
        if (uri) {
          const data = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            customRequests: listCustomRequests(this.workspaceRoot()),
            environments: listEnvs(this.workspaceRoot()),
          };
          require('fs').writeFileSync(uri.fsPath, JSON.stringify(data, null, 2), 'utf8');
          vscodeApi.window.showInformationMessage(`Exported to ${uri.fsPath}`);
        }
        break;
      }
      case 'saveCustomPlaybook': {
        saveCustomPlaybook(this.workspaceRoot(), msg.playbook);
        this.postMsg({ type: 'customPlaybooksList', playbooks: listCustomPlaybooks(this.workspaceRoot()) });
        break;
      }
      case 'deleteCustomPlaybook': {
        deleteCustomPlaybook(this.workspaceRoot(), msg.id);
        this.postMsg({ type: 'customPlaybooksList', playbooks: listCustomPlaybooks(this.workspaceRoot()) });
        break;
      }
      case 'listCustomPlaybooks': {
        this.postMsg({ type: 'customPlaybooksList', playbooks: listCustomPlaybooks(this.workspaceRoot()) });
        break;
      }
      case 'importCollection': {
        const vscodeApi = require('vscode');
        const uris = await vscodeApi.window.showOpenDialog({
          canSelectMany: false, filters: { 'JSON': ['json'] }, title: 'Import Collection',
        });
        if (uris && uris[0]) {
          try {
            const raw = require('fs').readFileSync(uris[0].fsPath, 'utf8');
            const data = JSON.parse(raw);
            // Support RC collection format
            if (Array.isArray(data.customRequests)) {
              importCustomRequests(this.workspaceRoot(), data.customRequests);
            }
            // Support Postman Collection v2.1 format
            if (Array.isArray(data.item)) {
              const mapped = data.item
                .filter((item: any) => item.request)
                .map((item: any) => ({
                  name:    item.name ?? 'Imported',
                  method:  item.request.method ?? 'GET',
                  path:    typeof item.request.url === 'string'
                    ? new URL(item.request.url.replace('{{baseUrl}}', 'https://x')).pathname
                    : (item.request.url?.path ?? []).join('/').replace(/^([^/])/, '/$1'),
                  headers: Object.fromEntries(
                    (item.request.header ?? []).map((h: any) => [h.key, h.value])
                  ),
                  body: item.request.body?.raw ?? '',
                }));
              importCustomRequests(this.workspaceRoot(), mapped);
            }
            this.postMsg({ type: 'customRequestsUpdated', customRequests: listCustomRequests(this.workspaceRoot()) });
            vscodeApi.window.showInformationMessage('Collection imported successfully.');
          } catch (e: any) {
            vscodeApi.window.showErrorMessage('Import failed: ' + e.message);
          }
        }
        break;
      }
      default:
        console.warn(`[RC Explorer] Unhandled message type: ${(msg as any).type}`);
        break;
    }
  }

  private workspaceRoot(): string {
    const vscode = require('vscode');
    const folders = vscode.workspace.workspaceFolders;
    return folders?.[0]?.uri?.fsPath ?? os.homedir();
  }

  private postMsg(msg: any): void {
    try { this.panel.webview.postMessage(msg); } catch { /* disposed */ }
  }

  private buildHtml(): string {
    const scriptUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'panel.js')
    );
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Revenue Cloud API Explorer</title>
<style>
:root{
  --bg: var(--vscode-editor-background,#0f1117);
  --bg2: var(--vscode-sideBar-background,#1a1d27);
  --bg3: var(--vscode-input-background,#22263a);
  --fg: var(--vscode-editor-foreground,#e2e8f0);
  --fg2: var(--vscode-descriptionForeground,#94a3b8);
  --fg3: var(--vscode-disabledForeground,#4a5278);
  --border: var(--vscode-panel-border,#2d3148);
  --acc: #7c85f5; --acc2: #6671e8;
  --green:#34d399;--blue:#60a5fa;--yellow:#fbbf24;--purple:#c084fc;--red:#f87171;--cyan:#7dd3fc;
}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--vscode-font-family,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif);
  background:var(--bg);color:var(--fg);display:flex;height:100vh;overflow:hidden;font-size:13px}

/* NAV RAIL */
#rail{width:48px;background:var(--bg2);border-right:1px solid var(--border);
  display:flex;flex-direction:column;align-items:center;padding:8px 0;gap:4px;flex-shrink:0}
.rail-btn{width:36px;height:36px;border-radius:7px;border:none;background:transparent;
  color:var(--fg3);font-size:17px;cursor:pointer;display:flex;align-items:center;
  justify-content:center;transition:all .12s;position:relative}
.rail-btn:hover{background:var(--bg3);color:var(--fg)}
.rail-btn.on{background:var(--acc);color:#fff}
.rail-btn[title]:hover::after{content:attr(title);position:absolute;left:44px;top:50%;
  transform:translateY(-50%);background:#1a1d27;border:1px solid var(--border);
  border-radius:5px;padding:4px 10px;font-size:11px;color:var(--fg);white-space:nowrap;
  z-index:100;pointer-events:none}

/* SIDEBAR */
#sidebar{width:280px;min-width:200px;background:var(--bg2);border-right:1px solid var(--border);
  display:flex;flex-direction:column;overflow:hidden;flex-shrink:0}
#sidebar-top{padding:10px 12px 8px;border-bottom:1px solid var(--border)}
#sidebar-top h1{font-size:10px;font-weight:700;color:var(--acc);letter-spacing:.07em;
  text-transform:uppercase;margin-bottom:8px}

/* Org row */
.org-row{display:flex;gap:5px;align-items:center;margin-bottom:4px}
.org-btn-row{display:flex;gap:5px;align-items:center;margin-bottom:6px;flex-wrap:wrap}
#org-select{flex:1;padding:5px 7px;background:var(--bg3);border:1px solid var(--border);
  border-radius:5px;color:var(--fg);font-size:11px;outline:none;cursor:pointer}
#org-select:focus{border-color:var(--acc)}
#env-badge{padding:3px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:12px;
  font-size:10px;color:var(--acc);cursor:pointer;white-space:nowrap;max-width:80px;
  overflow:hidden;text-overflow:ellipsis}
#env-badge:hover{border-color:var(--acc)}
.icon-btn{padding:4px 7px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;
  color:var(--fg2);cursor:pointer;font-size:11px;white-space:nowrap}
.icon-btn:hover{border-color:var(--acc);color:var(--acc)}
.org-status{font-size:10px;color:var(--fg3);margin-bottom:6px;min-height:13px}
.org-status.ok{color:var(--green)}.org-status.err{color:var(--red)}

/* Search + filter */
#search{width:100%;padding:6px 9px;background:var(--bg3);border:1px solid var(--border);
  border-radius:5px;color:var(--fg);font-size:12px;outline:none;margin-bottom:6px}
#search:focus{border-color:var(--acc)}
#filter-bar{display:flex;flex-wrap:wrap;gap:3px}
.fb{padding:2px 7px;border-radius:10px;border:1px solid var(--border);background:transparent;
  color:var(--fg2);font-size:10px;cursor:pointer;transition:all .12s}
.fb:hover{border-color:var(--acc);color:var(--acc)}
.fb.on{background:var(--acc);border-color:var(--acc);color:#fff}

/* Sidebar panels */
.sb-panel{display:none;flex-direction:column;overflow:hidden;flex:1}
.sb-panel.on{display:flex}
.sb-panel-hdr{padding:8px 12px 4px;font-size:10px;font-weight:700;color:var(--fg3);
  text-transform:uppercase;letter-spacing:.08em;display:flex;justify-content:space-between;
  align-items:center;flex-shrink:0}

/* Endpoint list */
#ep-list{overflow-y:auto;flex:1}
.sec-hdr{padding:6px 12px 2px;font-size:10px;font-weight:700;color:var(--fg3);
  text-transform:uppercase;letter-spacing:.08em;position:sticky;top:0;background:var(--bg2);z-index:1;
  display:flex;align-items:center;gap:5px;cursor:pointer;user-select:none}
.sec-hdr:hover{color:var(--fg2)}
.sec-hdr .chevron{font-size:8px;transition:transform .15s}
.sec-hdr.collapsed .chevron{transform:rotate(-90deg)}
.ep{padding:8px 12px;cursor:pointer;border-left:3px solid transparent;transition:all .1s;display:flex;align-items:flex-start}
.ep:hover{background:var(--bg3);border-left-color:var(--fg3)}
.ep.sel{background:var(--bg3);border-left-color:var(--acc)}
.ep.pinned-item .ep-name::before{content:"\\2605 ";color:var(--yellow);font-size:9px}
.ep-body{flex:1;min-width:0}
.ep-top{display:flex;align-items:center;gap:6px;margin-bottom:2px}
.mb{font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;min-width:40px;
  text-align:center;flex-shrink:0}
.GET{background:#0d3b2e;color:var(--green)}.POST{background:#1e3a5f;color:var(--blue)}
.PUT{background:#3b2d0d;color:var(--yellow)}.PATCH{background:#2d1a3b;color:var(--purple)}
.DELETE{background:#3b0d0d;color:var(--red)}.MULTI{background:#1a2d3b;color:var(--cyan)}
.ep-name{font-size:11px;font-weight:500;color:var(--fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ep-path{font-size:10px;color:var(--fg3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  font-family:var(--vscode-editor-font-family,monospace)}
.ep-pin{background:none;border:none;cursor:pointer;color:var(--fg3);font-size:12px;padding:2px 4px;
  flex-shrink:0;opacity:0;transition:opacity .1s;margin-top:1px}
.ep:hover .ep-pin{opacity:1}
.ep-pin.pinned{opacity:1;color:var(--yellow)}

/* TAB BAR */
#main-area{flex:1;display:flex;flex-direction:column;overflow:hidden}
#tab-bar{display:flex;align-items:center;background:var(--bg2);border-bottom:1px solid var(--border);
  height:36px;flex-shrink:0}
#tab-scroll{display:flex;align-items:stretch;flex:1;overflow-x:auto;scrollbar-width:none}
#tab-scroll::-webkit-scrollbar{display:none}
.tab-item{display:flex;align-items:center;gap:5px;padding:0 12px;cursor:pointer;
  font-size:11px;color:var(--fg3);border-right:1px solid var(--border);
  white-space:nowrap;height:36px;transition:all .1s;position:relative;max-width:180px;min-width:80px}
.tab-item:hover{background:var(--bg3);color:var(--fg2)}
.tab-item.on{background:var(--bg);color:var(--fg);border-bottom:2px solid var(--acc);margin-bottom:-1px}
.tab-item .tab-label{overflow:hidden;text-overflow:ellipsis;flex:1}
.tab-item .tab-mb{font-size:8px;padding:1px 4px;border-radius:2px;flex-shrink:0}
.tab-close{color:var(--fg3);font-size:14px;line-height:1;padding:0 2px;flex-shrink:0;
  background:none;border:none;cursor:pointer}
.tab-close:hover{color:var(--red)}
#tab-new-btn{padding:0 10px;height:36px;background:none;border:none;color:var(--fg3);
  font-size:18px;cursor:pointer;flex-shrink:0;border-left:1px solid var(--border)}
#tab-new-btn:hover{color:var(--acc)}

/* DETAIL */
#detail{flex:1;overflow-y:auto;background:var(--bg)}
.tab-panel{display:none;padding:20px 24px;max-width:900px}
.tab-panel.on{display:block}
#tab-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;
  height:100%;color:var(--fg3);text-align:center;gap:12px}
#tab-empty svg{width:48px;height:48px;opacity:.25}

.d-title{font-size:18px;font-weight:700;color:var(--fg);margin-bottom:8px}
.d-meta{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px}
.d-ver{font-size:10px;color:var(--acc);background:var(--bg2);padding:2px 8px;border-radius:10px;border:1px solid var(--border)}
.d-desc{color:var(--fg2);font-size:12px;line-height:1.6;margin-bottom:14px}
.d-path{background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:9px 13px;
  margin-bottom:5px;font-family:monospace;font-size:11px;color:var(--cyan);word-break:break-all}
.d-src{font-size:10px;color:var(--fg3);margin-bottom:18px}

/* Sub-tabs */
.tabs{display:flex;border-bottom:1px solid var(--border);margin-bottom:16px}
.tab{padding:8px 16px;cursor:pointer;font-size:12px;color:var(--fg3);
  border-bottom:2px solid transparent;margin-bottom:-1px;transition:all .12s}
.tab:hover{color:var(--fg2)}
.tab.on{color:var(--acc);border-bottom-color:var(--acc)}
.tp{display:none}.tp.on{display:block}

table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px}
th{text-align:left;padding:7px 10px;background:var(--bg2);color:var(--fg2);font-weight:600;
  font-size:10px;text-transform:uppercase;letter-spacing:.05em}
td{padding:7px 10px;border-bottom:1px solid var(--bg2);color:var(--fg);vertical-align:top}
tr:hover td{background:var(--bg2)}
.pn{font-family:monospace;color:var(--cyan);font-size:11px}
.preq{color:var(--red);font-size:10px}.popt{color:var(--fg3);font-size:10px}
pre{background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:13px;
  overflow-x:auto;font-family:monospace;font-size:11px;line-height:1.6;color:var(--fg);
  white-space:pre-wrap;word-break:break-all}
.no-p{color:var(--fg3);font-style:italic;font-size:12px;padding:6px 0}

/* TRY IT */
.try-lbl{font-size:10px;font-weight:700;color:var(--fg3);text-transform:uppercase;
  letter-spacing:.07em;margin-bottom:5px}
.try-sec{margin-bottom:14px}
.try-row{display:flex;gap:7px;align-items:center;margin-bottom:7px;flex-wrap:wrap}
.try-inp{flex:1;min-width:100px;padding:6px 9px;background:var(--bg3);border:1px solid var(--border);
  border-radius:5px;color:var(--fg);font-size:12px;outline:none}
.try-inp:focus{border-color:var(--acc)}
.try-sel{padding:6px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;
  color:var(--fg);font-size:12px;outline:none;cursor:pointer}
.try-body{width:100%;min-height:110px;padding:9px;background:var(--bg2);border:1px solid var(--border);
  border-radius:5px;color:var(--fg);font-size:11px;font-family:monospace;line-height:1.5;
  resize:vertical;outline:none}
.try-body:focus{border-color:var(--acc)}
.btn-row{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px;align-items:center}
.btn{padding:5px 13px;border-radius:5px;border:none;font-size:11px;font-weight:600;cursor:pointer;transition:all .12s}
.btn-pri{background:var(--acc);color:#fff}.btn-pri:hover{background:var(--acc2)}
.btn-pri:disabled{opacity:.5;cursor:not-allowed}
.btn-sec{background:var(--bg3);color:var(--fg2);border:1px solid var(--border)}
.btn-sec:hover{background:var(--bg2);color:var(--fg)}
.btn-sec:disabled{opacity:.4;cursor:not-allowed}
.resp-box{background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:13px;
  font-family:monospace;font-size:11px;line-height:1.6;color:var(--fg);white-space:pre-wrap;
  word-break:break-all;min-height:56px;max-height:400px;overflow-y:auto;overflow-x:auto;resize:vertical}
.status-pill{display:inline-block;padding:2px 9px;border-radius:4px;font-size:11px;font-weight:700;margin-bottom:7px}
.s2xx{background:#0d3b2e;color:var(--green)}.s4xx{background:#3b2d0d;color:var(--yellow)}
.s5xx{background:#3b0d0d;color:var(--red)}.serr{background:#3b0d0d;color:var(--red)}
.try-tip{font-size:11px;color:var(--fg3);margin-bottom:12px;line-height:1.5}
.spin{display:inline-block;animation:spin .8s linear infinite;margin-right:4px}
@keyframes spin{to{transform:rotate(360deg)}}

/* Status bar */
#status-bar{height:22px;background:var(--bg2);border-top:1px solid var(--border);
  display:flex;align-items:center;padding:0 14px;font-size:10px;color:var(--fg3);
  flex-shrink:0;gap:10px;overflow:hidden}

/* Inline var quick-fill */
.var-quick-fill{background:var(--bg2);border:1px solid var(--border);border-radius:5px;
  padding:8px 10px;margin-bottom:10px}
.var-quick-fill .vqf-title{font-size:10px;font-weight:700;color:var(--yellow);
  text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
.var-quick-row{display:flex;align-items:center;gap:6px;margin-bottom:4px}
.var-quick-row label{font-family:monospace;font-size:10px;color:var(--acc);min-width:120px;flex-shrink:0}

/* Diff modal */
#diff-modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:1000;
  flex-direction:column;padding:20px}
#diff-modal.on{display:flex}
#diff-inner{background:var(--bg2);border:1px solid var(--border);border-radius:8px;
  display:flex;flex-direction:column;flex:1;overflow:hidden}
#diff-header{padding:10px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border)}
#diff-header h3{font-size:13px;font-weight:700;flex:1}
#diff-panes{display:flex;flex:1;overflow:hidden;gap:1px;background:var(--border)}
.diff-pane{flex:1;overflow-y:auto;padding:12px 14px;background:var(--bg);font-family:monospace;font-size:11px;line-height:1.7}
.diff-add{background:#0d2e1a;color:var(--green)}.diff-del{background:#2e0d0d;color:var(--red)}
.diff-chg{background:#2e2200;color:var(--yellow)}

/* Environments panel */
.env-card{padding:8px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;margin-bottom:6px;cursor:pointer}
.env-card.active{border-color:var(--acc)}
.env-card .env-name{font-size:12px;font-weight:600;color:var(--fg)}
.env-card .env-org{font-size:10px;color:var(--fg3)}

/* History entries */
.hist-group{padding:5px 12px 2px;font-size:10px;font-weight:700;color:var(--fg3);text-transform:uppercase;letter-spacing:.06em}
.hist-entry{padding:7px 12px;cursor:pointer;border-left:3px solid transparent;transition:all .1s}
.hist-entry:hover{background:var(--bg3);border-left-color:var(--acc)}
.hist-entry-top{display:flex;align-items:center;gap:6px}
.hist-path{font-size:10px;color:var(--fg3);font-family:monospace;margin-top:2px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hist-time{font-size:10px;color:var(--fg3);margin-left:auto;white-space:nowrap}

::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:var(--bg)}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
</style>
</head>
<body>

<!-- NAV RAIL -->
<div id="rail">
  <button class="rail-btn on"  onclick="switchRail('endpoints')" title="Endpoints" data-panel="endpoints">&#9889;</button>
  <button class="rail-btn" onclick="switchRail('requests')"  title="Saved Requests" data-panel="requests">&#128196;</button>
  <button class="rail-btn" onclick="switchRail('playbooks')" title="Playbooks" data-panel="playbooks">&#9935;</button>
  <button class="rail-btn" onclick="switchRail('envs')"      title="Environments" data-panel="envs">&#127758;</button>
  <button class="rail-btn" onclick="switchRail('history')"   title="History" data-panel="history">&#128336;</button>
  <button class="rail-btn" onclick="openPstBuilderTab()"     title="PST Builder (Quote)" style="font-size:14px">&#9889;</button>
  <button class="rail-btn" onclick="openOrderBuilderTab()"   title="Order Builder" style="font-size:14px">&#128220;</button>
</div>

<!-- SIDEBAR -->
<div id="sidebar">
  <div id="sidebar-top">
    <h1>&#9889; Revenue Cloud APIs</h1>
    <div class="org-row">
      <select id="org-select" onchange="onOrgChange()"><option value="">Loading orgs&#8230;</option></select>
      <button class="icon-btn" id="org-clear-btn" onclick="clearOrg()" title="Clear selected org" style="display:none;padding:2px 6px;font-size:12px;color:var(--red,#f44)">&#10005;</button>
    </div>
    <div class="org-btn-row">
      <span id="env-badge" onclick="switchRail('envs')" title="Active environment">&#8212;</span>
      <button class="icon-btn" onclick="refreshOrgs()" title="Refresh orgs">&#8635;</button>
      <button class="icon-btn" onclick="vscMsg({type:'openOutputChannel'})" title="Open log">Log</button>
      <label style="display:flex;align-items:center;gap:4px;margin-left:auto;font-size:10px;color:var(--fg3)">
        API ver
        <input id="global-api-ver" class="try-ver" value="v66.0" title="Default API version for all endpoints (edit to override)" oninput="setGlobalVersion(this.value)" style="width:52px;font-family:monospace;font-size:11px;text-align:center">
      </label>
    </div>
    <div class="org-status" id="org-status">Connecting to SF CLI&#8230;</div>
  </div>

  <!-- ENDPOINTS panel -->
  <div id="sb-endpoints" class="sb-panel on" style="overflow:hidden">
    <div style="padding:6px 12px 5px">
      <input id="search" type="text" placeholder="&#128269; Search endpoints&#8230;" oninput="render()">
      <div id="filter-bar">
        <button class="fb on" onclick="setF('all',this)">All</button>
        <button class="fb" onclick="setF('PCM',this)">PCM</button>
        <button class="fb" onclick="setF('Discovery',this)">Discovery</button>
        <button class="fb" onclick="setF('Pricing',this)">Pricing</button>
        <button class="fb" onclick="setF('Rate',this)">Rate</button>
        <button class="fb" onclick="setF('Configurator',this)">Config</button>
        <button class="fb" onclick="setF('Transaction',this)">TXN</button>
        <button class="fb" onclick="setF('Usage',this)">Usage</button>
        <button class="fb" onclick="setF('Billing',this)">Billing</button>
        <button class="fb" onclick="setF('DRO',this)">DRO</button>
      </div>
    </div>
    <div style="display:flex;gap:4px;padding:3px 8px 4px">
      <button class="icon-btn" onclick="collapseAll()" style="font-size:10px;padding:1px 8px;flex:1">&#8854; Collapse All</button>
      <button class="icon-btn" onclick="expandAll()" style="font-size:10px;padding:1px 8px;flex:1">&#8853; Expand All</button>
    </div>
    <div id="ep-list"></div>
  </div>

  <!-- REQUESTS panel -->
  <div id="sb-requests" class="sb-panel" style="overflow-y:auto">
    <div class="sb-panel-hdr">
      Saved Requests
      <div style="display:flex;gap:4px">
        <button class="icon-btn" onclick="vscMsg({type:'exportCollection'})" title="Export collection">&#11015;</button>
        <button class="icon-btn" onclick="vscMsg({type:'importCollection'})" title="Import collection">&#11014;</button>
      </div>
    </div>
    <div style="padding:0 12px 8px;display:flex;flex-direction:column;gap:4px">
      <button class="btn btn-pri" onclick="openNewRequestTab()" style="width:100%;font-size:11px">+ New Request</button>
      <button class="btn btn-sec" onclick="openPstBuilderTab()" style="width:100%;font-size:11px">&#9889; PST Builder</button>
      <button class="btn btn-sec" onclick="openSwapBuilderTab()" style="width:100%;font-size:11px;margin-top:4px">&#8646; Swap Builder</button>
    </div>
    <div id="custom-req-list" style="padding:0 12px"></div>
  </div>

  <!-- PLAYBOOKS panel -->
  <div id="sb-playbooks" class="sb-panel">
    <div class="sb-panel-hdr">Playbooks</div>
    <div style="padding:4px 12px 8px;display:flex;gap:5px;flex-wrap:wrap">
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
    <div id="pb-cards" style="overflow-y:auto;flex:1"></div>
    <div class="sb-panel-hdr" style="margin-top:4px">
      Playbook Runs
      <button class="icon-btn" style="padding:1px 6px;font-size:10px" onclick="vscMsg({type:'chainClearRuns'})">Clear</button>
    </div>
    <div id="run-history-list" style="overflow-y:auto;max-height:200px"></div>
  </div>

  <!-- ENVIRONMENTS panel -->
  <div id="sb-envs" class="sb-panel" style="overflow-y:auto">
    <div class="sb-panel-hdr">Environments</div>
    <div style="padding:0 12px 8px">
      <div style="font-size:11px;color:var(--fg3);margin-bottom:8px">Each environment has its own variables. Use <code style="background:var(--bg3);padding:1px 4px;border-radius:3px">{{VAR_NAME}}</code> in requests.</div>
      <div id="env-list" style="margin-bottom:10px"></div>
      <div style="display:flex;gap:4px;margin-bottom:4px">
        <input id="new-env-name" class="try-inp" placeholder="Environment name" style="flex:1;font-size:11px">
        <button class="btn btn-pri" style="font-size:11px" onclick="createNewEnv()">+ Create</button>
      </div>
      <div id="env-vars-section"></div>
    </div>
  </div>

  <!-- HISTORY panel -->
  <div id="sb-history" class="sb-panel" style="overflow:hidden">
    <div class="sb-panel-hdr">
      Request History
      <button class="icon-btn" style="padding:1px 6px;font-size:10px" onclick="vscMsg({type:'clearHistory'})">Clear</button>
    </div>
    <div style="padding:0 12px 6px">
      <input id="hist-search" class="try-inp" placeholder="&#128269; Filter history&#8230;" oninput="_histPage=0;renderHistory()" style="width:100%;font-size:11px;padding:5px 8px">
    </div>
    <div id="history-list" style="overflow-y:auto;flex:1"></div>
  </div>
</div>

<!-- MAIN AREA -->
<div id="main-area">
  <!-- TAB BAR -->
  <div id="tab-bar">
    <div id="tab-scroll"></div>
    <button id="tab-new-btn" onclick="openNewRequestTab()" title="New request">+</button>
  </div>

  <!-- DETAIL -->
  <div id="detail">
    <div id="tab-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
      </svg>
      <p>Open an endpoint or create a new request</p>
      <button class="btn btn-sec" onclick="openNewRequestTab()">+ New Request</button>
    </div>
    <!-- Tab panels injected here by JS -->
  </div>

  <!-- STATUS BAR -->
  <div id="status-bar">
    <span id="sb-env-label" style="color:var(--acc)">No environment</span>
    <span id="sb-last-req" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></span>
    <span id="sb-last-status"></span>
  </div>
</div>

<!-- DIFF MODAL -->
<div id="diff-modal">
  <div id="diff-inner">
    <div id="diff-header">
      <h3>Response Diff</h3>
      <select id="diff-baseline-select" style="font-size:11px;background:var(--bg2);border:1px solid var(--border);color:var(--fg);border-radius:4px;padding:2px 6px;max-width:220px" title="Select baseline to compare against"></select>
      <button class="btn btn-sec" onclick="closeDiff()" style="margin-left:auto">&#10005; Close</button>
    </div>
    <div id="diff-panes">
      <div class="diff-pane" id="diff-left"></div>
      <div class="diff-pane" id="diff-right"></div>
    </div>
  </div>
</div>

<script src="${scriptUri}"></script>
</body>
</html>`;
  }
}
