import * as fs from 'fs';
import * as path from 'path';
import type { Playbook } from './playbooks';

function storeFile(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.rc-explorer', 'custom-playbooks.json');
}

export function listCustomPlaybooks(workspaceRoot: string): Playbook[] {
  try { return JSON.parse(fs.readFileSync(storeFile(workspaceRoot), 'utf8')); } catch { return []; }
}

export function saveCustomPlaybook(workspaceRoot: string, pb: Playbook): void {
  const all = listCustomPlaybooks(workspaceRoot);
  const idx = all.findIndex(p => p.id === pb.id);
  if (idx >= 0) { all[idx] = pb; } else { all.push(pb); }
  fs.mkdirSync(path.dirname(storeFile(workspaceRoot)), { recursive: true });
  fs.writeFileSync(storeFile(workspaceRoot), JSON.stringify(all, null, 2));
}

export function deleteCustomPlaybook(workspaceRoot: string, id: string): void {
  const all = listCustomPlaybooks(workspaceRoot).filter(p => p.id !== id);
  fs.mkdirSync(path.dirname(storeFile(workspaceRoot)), { recursive: true });
  fs.writeFileSync(storeFile(workspaceRoot), JSON.stringify(all, null, 2));
}
