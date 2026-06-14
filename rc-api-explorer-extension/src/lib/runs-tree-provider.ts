import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { RunRecord, listRuns, loadRun, deleteRun } from './run-store';

// ─── Tree item types ──────────────────────────────────────────────────────────

export class RunGroupItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly runs: RunRecord[],
  ) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = 'runGroup';
    this.description  = `${runs.length} run${runs.length !== 1 ? 's' : ''}`;
  }
}

export class RunItem extends vscode.TreeItem {
  constructor(public readonly run: RunRecord) {
    super(RunItem.label(run), vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'run';
    this.description  = RunItem.desc(run);
    this.tooltip      = RunItem.tooltip(run);
    this.iconPath     = new vscode.ThemeIcon(RunItem.icon(run), RunItem.iconColor(run));
  }

  private static label(r: RunRecord): string {
    return r.type === 'single'
      ? `${r.endpointName ?? r.endpointId}`
      : r.playbookName;
  }

  private static desc(r: RunRecord): string {
    const d = new Date(r.startedAt);
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const steps = r.steps.length > 1 ? ` · ${r.steps.length} steps` : '';
    return `${time}${steps} · ${r.org}`;
  }

  private static tooltip(r: RunRecord): string {
    const ok  = r.steps.filter(s => s.responseStatus >= 200 && s.responseStatus < 300).length;
    const err = r.steps.filter(s => s.responseStatus >= 400 || s.responseStatus === 0).length;
    return [
      r.playbookName,
      `Org: ${r.org}`,
      `Started: ${new Date(r.startedAt).toLocaleString()}`,
      `Steps: ${r.steps.length} (${ok} ok, ${err} err)`,
      `Status: ${r.status}`,
    ].join('\n');
  }

  private static icon(r: RunRecord): string {
    if (r.status === 'completed') { return 'pass'; }
    if (r.status === 'partial')   { return 'warning'; }
    return 'error';
  }

  private static iconColor(r: RunRecord): vscode.ThemeColor {
    if (r.status === 'completed') { return new vscode.ThemeColor('testing.iconPassed'); }
    if (r.status === 'partial')   { return new vscode.ThemeColor('testing.iconSkipped'); }
    return new vscode.ThemeColor('testing.iconFailed');
  }
}

export class StepItem extends vscode.TreeItem {
  constructor(
    public readonly step: RunRecord['steps'][number],
    public readonly runId: string,
    public readonly stepIdx: number,
  ) {
    super(StepItem.label(step), vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'runStep';
    this.description  = StepItem.desc(step);
    this.tooltip      = StepItem.tooltip(step);
    this.iconPath     = new vscode.ThemeIcon(StepItem.icon(step), StepItem.iconColor(step));
  }

  private static label(s: RunRecord['steps'][number]): string {
    return s.label || s.endpointId;
  }

  private static desc(s: RunRecord['steps'][number]): string {
    const status = s.responseStatus ? `HTTP ${s.responseStatus}` : 'no response';
    const dur    = s.durationMs ? ` · ${s.durationMs}ms` : '';
    return `${status}${dur}`;
  }

  private static tooltip(s: RunRecord['steps'][number]): string {
    return [
      `${s.method} ${s.path}`,
      `Status: ${s.responseStatus || 'N/A'}`,
      `Duration: ${s.durationMs || 0}ms`,
    ].join('\n');
  }

  private static icon(s: RunRecord['steps'][number]): string {
    if (!s.responseStatus)                              { return 'circle-outline'; }
    if (s.responseStatus >= 200 && s.responseStatus < 300) { return 'pass-filled'; }
    if (s.responseStatus >= 400)                        { return 'error'; }
    return 'circle-outline';
  }

  private static iconColor(s: RunRecord['steps'][number]): vscode.ThemeColor {
    if (s.responseStatus >= 200 && s.responseStatus < 300) {
      return new vscode.ThemeColor('testing.iconPassed');
    }
    if (s.responseStatus >= 400) {
      return new vscode.ThemeColor('testing.iconFailed');
    }
    return new vscode.ThemeColor('descriptionForeground');
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────

type TreeNode = RunGroupItem | RunItem | StepItem;

export class RunsTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChange = new vscode.EventEmitter<TreeNode | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  private runs: RunRecord[] = [];
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.reload();
  }

  reload(): void {
    this.runs = listRuns(this.workspaceRoot);
    this._onDidChange.fire();
  }

  setWorkspaceRoot(root: string): void {
    this.workspaceRoot = root;
    this.reload();
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeNode): TreeNode[] {
    // Root level — two groups
    if (!element) {
      const playbook = this.runs.filter(r => r.type !== 'single');
      const single   = this.runs.filter(r => r.type === 'single');
      const groups: RunGroupItem[] = [];
      if (playbook.length) { groups.push(new RunGroupItem('Playbook Runs', playbook)); }
      if (single.length)   { groups.push(new RunGroupItem('API Runs', single)); }
      if (!groups.length) {
        // Return a placeholder item when empty
        const empty = new vscode.TreeItem('No runs yet — execute an endpoint or playbook');
        empty.iconPath = new vscode.ThemeIcon('info');
        return [empty as TreeNode];
      }
      return groups;
    }

    // Group → runs
    if (element instanceof RunGroupItem) {
      return element.runs.map(r => new RunItem(r));
    }

    // Run → steps
    if (element instanceof RunItem) {
      return element.run.steps.map((s, i) => new StepItem(s, element.run.id, i));
    }

    return [];
  }

  deleteRunById(runId: string): void {
    deleteRun(this.workspaceRoot, runId);
    this.reload();
  }
}
