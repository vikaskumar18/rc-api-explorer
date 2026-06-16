import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { ApiExplorerPanel } from './apiExplorerPanel';
import { ProductBrowserPanel } from './productBrowserPanel';
import { RunsTreeProvider, RunItem } from './lib/runs-tree-provider';
import { deleteRun, clearRuns } from './lib/run-store';

let panel: ApiExplorerPanel | undefined;
let treeProvider: RunsTreeProvider | undefined;

function workspaceRoot(): string {
  const folders = vscode.workspace.workspaceFolders;
  return folders?.[0]?.uri?.fsPath ?? os.homedir();
}

function ensurePanel(context: vscode.ExtensionContext): ApiExplorerPanel {
  if (!panel) {
    panel = new ApiExplorerPanel(context, () => { panel = undefined; });
    panel._onRunSaved = () => treeProvider?.reload();
  }
  return panel;
}

export function activate(context: vscode.ExtensionContext): void {
  const root = workspaceRoot();

  // ── Tree provider ────────────────────────────────────────────────────────
  treeProvider = new RunsTreeProvider(root);
  const treeView = vscode.window.createTreeView('rcApiExplorer.runsView', { treeDataProvider: treeProvider });
  context.subscriptions.push(treeView);
  // Auto-open the webview panel when the user clicks the activity bar icon
  treeView.onDidChangeVisibility(e => {
    if (e.visible) { ensurePanel(context).reveal(); }
  });

  // Update tree root when workspace changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      treeProvider?.setWorkspaceRoot(workspaceRoot());
    })
  );

  // ── File watcher — auto-refresh tree when runs dir changes ───────────────
  const runsGlob = new vscode.RelativePattern(root, '.rc-explorer/runs/*.json');
  const watcher  = vscode.workspace.createFileSystemWatcher(runsGlob);
  watcher.onDidCreate(() => treeProvider?.reload());
  watcher.onDidDelete(() => treeProvider?.reload());
  watcher.onDidChange(() => treeProvider?.reload());
  context.subscriptions.push(watcher);

  // ── Commands ─────────────────────────────────────────────────────────────
  context.subscriptions.push(

    vscode.commands.registerCommand('rcApiExplorer.openPanel', () => {
      ensurePanel(context).reveal();
    }),

    vscode.commands.registerCommand('rcApiExplorer.refreshOrgs', async () => {
      if (panel) {
        await panel.refreshOrgs();
      } else {
        vscode.window.showInformationMessage('Open the API Explorer first (Cmd+Shift+R).');
      }
    }),

    vscode.commands.registerCommand('rcApiExplorer.refreshRuns', () => {
      treeProvider?.reload();
    }),

    vscode.commands.registerCommand('rcApiExplorer.inspectRun', (item: RunItem) => {
      ensurePanel(context).loadRunInPanel(item.run.id);
    }),

    vscode.commands.registerCommand('rcApiExplorer.relaunchRun', (item: RunItem) => {
      ensurePanel(context).relaunchRunInPanel(item.run.id);
    }),

    vscode.commands.registerCommand('rcApiExplorer.clearAllRuns', async () => {
      const count = treeProvider?.getRunCount() ?? 0;
      if (count === 0) { vscode.window.showInformationMessage('No runs to delete.'); return; }
      const answer = await vscode.window.showWarningMessage(
        `Delete all ${count} run${count !== 1 ? 's' : ''}?`,
        { modal: true },
        'Delete All'
      );
      if (answer === 'Delete All') {
        clearRuns(workspaceRoot());
        treeProvider?.reload();
      }
    }),

    vscode.commands.registerCommand('rcApiExplorer.openProductBrowser', () => {
      ProductBrowserPanel.createOrShow(context);
    }),

    vscode.commands.registerCommand('rcApiExplorer.deleteRun', async (item: RunItem) => {
      const answer = await vscode.window.showWarningMessage(
        `Delete run "${item.run.playbookName}"?`,
        { modal: true },
        'Delete'
      );
      if (answer === 'Delete') {
        deleteRun(workspaceRoot(), item.run.id);
        treeProvider?.reload();
      }
    }),
  );
}

export function deactivate(): void {
  panel = undefined;
}
