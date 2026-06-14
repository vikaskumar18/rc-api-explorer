# API Chaining & Playbooks — Design Spec
Date: 2026-06-13

## Overview

Add a Playbooks system to the RC API Explorer VS Code extension that lets users chain Revenue Cloud APIs in pre-wired sequences, with auto-extracted values between steps, full manual override capability, three execution modes (step-by-step, auto, hybrid), three engine modes (static playbook, dynamic, Salesforce Composite), and persistent file-based run history.

---

## Architecture

Three new layers added to the existing extension:

```
src/lib/playbooks.ts        — static config: flows, steps, JSONPath wiring
src/lib/chain-config.ts     — global defaults (mode, execution)
src/lib/chain-engine.ts     — runtime: executes chains in any mode
media/panel.js              — Playbooks tab added to existing UI
.rc-explorer/runs/          — file-based run history (JSON files)
```

The existing `endpoints.ts`, `orgAuth.ts`, and `apiExplorerPanel.ts` are unchanged except `apiExplorerPanel.ts` gets new message handlers for chain actions.

---

## Config Schema

### chain-config.ts (global defaults)
```typescript
export const CHAIN_CONFIG = {
  defaultMode: 'playbook',      // 'playbook' | 'dynamic' | 'composite'
  defaultExecution: 'hybrid',   // 'step' | 'auto' | 'hybrid'
};
```

### playbooks.ts (step definitions)
```typescript
{
  id: 'catalog-discovery',
  name: 'Catalog Discovery Flow',
  description: 'Catalogs → Categories → Products → Product Details',
  mode: 'playbook',           // overrides global default
  execution: 'hybrid',        // overrides global default
  steps: [
    {
      id: 'get-catalogs',
      endpointId: 'disc-2',
      label: 'Step 1 — Get Catalogs',
      seedFields: ['catalogId'],   // user must provide at step 1
      extract: [
        { from: '$.catalogs[0].id', into: 'next.body.catalogId' }
      ],
    },
    ...
  ]
}
```

`extract.from` — JSONPath expression over the response body
`extract.into` — target: `next.body.<field>` or `next.path.<param>`
`seedFields` — fields with no prior step to extract from (user fills manually)

---

## Initial Playbooks (3)

| Playbook | Steps |
|---|---|
| Catalog Discovery | disc-2 → disc-3 → disc-6 → disc-5 |
| CPQ Quote Flow | disc-6 → disc-7 → price-1 |
| Product Setup | pcm-8 → pcm-4 → pcm-6 → pcm-9 |

---

## Chain Session State

```typescript
interface StepState {
  status: 'pending' | 'running' | 'done' | 'error' | 'skipped';
  resolvedPath: string;
  resolvedBody: string;
  response?: { status: number; body: string; durationMs: number };
  extractedValues: Record<string, string>;
  manualOverrides: Record<string, string>;  // user edits — survive re-runs
}

interface ChainSession {
  playbookId: string;
  mode: 'playbook' | 'dynamic' | 'composite';
  execution: 'step' | 'auto' | 'hybrid';
  steps: StepState[];
  activeStep: number;
  orgAlias: string;
}
```

`manualOverrides` takes priority over auto-extracted values. User edits survive cascade re-runs.

---

## User Actions

| Action | Behavior |
|---|---|
| Run single step | Execute step N only, update state, re-extract values |
| Re-run step | Reset step N status, keep manualOverrides, re-execute |
| Run from step N | Execute N then cascade N+1, N+2... (pausing in step mode) |
| Jump to any step | Click step in timeline → becomes activeStep, body/path editable |
| Edit body before run | Saved to manualOverrides → survives future cascades |
| Manual mid-chain API | Switch to endpoint list, run anything, return — session preserved |
| Run All | Fire all steps sequentially, show live timeline |
| Pause | Stop after current step completes (hybrid mode only) |

---

## Execution Modes

| Mode key | Behavior |
|---|---|
| `step` | Runs one step, stops, waits for "Next" click |
| `auto` | Runs all steps sequentially without stopping |
| `hybrid` | "Run All" button + "Pause" button + manual step control |

Switchable via dropdown in the Playbooks tab. Config-driven default.

---

## Engine Modes

| Mode key | Behavior |
|---|---|
| `playbook` | Pre-wired JSONPath extraction, editable per step |
| `dynamic` | Any response field injectable into any endpoint via "Use →" buttons |
| `composite` | Entire chain sent as one POST to `/services/data/v67.0/composite` |

Switchable via dropdown. Per-playbook override in config.

---

## Run Storage

**Location:** `.rc-explorer/runs/` in the workspace root (add to `.gitignore` optionally)

**Filename:** `YYYY-MM-DD_HHmmss_<playbookId>_<orgAlias>.json`

**File structure:**
```json
{
  "id": "2026-06-13_143022",
  "playbookId": "catalog-discovery",
  "playbookName": "Catalog Discovery Flow",
  "org": "sundev",
  "mode": "playbook",
  "execution": "hybrid",
  "startedAt": "2026-06-13T14:30:22Z",
  "completedAt": "2026-06-13T14:30:28Z",
  "status": "completed",
  "steps": [
    {
      "id": "get-catalogs",
      "label": "Step 1 — Get Catalogs",
      "endpointId": "disc-2",
      "method": "POST",
      "path": "/services/data/v67.0/connect/cpq/catalogs",
      "requestBody": "{}",
      "responseStatus": 200,
      "responseBody": "{...}",
      "durationMs": 312,
      "extractedValues": { "catalogId": "0ZSAU000000ANZd4AO" },
      "manualOverrides": {}
    }
  ]
}
```

---

## UI — Playbooks Tab

Added as a new sidebar section alongside "All / PCM / Discovery / ..." filter bar.

**Tab layout:**
```
[All] [PCM] [Discovery] ... [Playbooks]   ← new tab

Playbooks tab:
  Org: [sundev ▼]  Mode: [playbook ▼]  Exec: [hybrid ▼]

  [Catalog Discovery Flow      ▶ Run All]
  [CPQ Quote Flow              ▶ Run All]
  [Product Setup Flow          ▶ Run All]

  ── Active Run ──────────────────────────
  ✅ Step 1 — Get Catalogs      312ms  200
     catalogId extracted: 0ZSAU000000ANZd4AO
  ▶ Step 2 — Get Categories    [Run] [Edit]
     body: { "catalogId": "0ZSAU..." }  ← editable
  ○  Step 3 — Products List    pending
  ○  Step 4 — Product Details  pending

  ── Run History ─────────────────────────
  ✅ Catalog Discovery · sundev · Jun 13 14:30  [Load] [Re-run]
  ⚠️  CPQ Quote Flow   · sundev · Jun 13 15:10  [Load] [Re-run]
```

---

## Files to Create / Modify

| File | Action |
|---|---|
| `src/lib/chain-config.ts` | Create — global defaults |
| `src/lib/playbooks.ts` | Create — 3 playbook definitions |
| `src/lib/chain-engine.ts` | Create — session state + execution logic |
| `src/lib/run-store.ts` | Create — read/write `.rc-explorer/runs/` |
| `src/apiExplorerPanel.ts` | Modify — add chain message handlers |
| `media/panel.js` | Modify — add Playbooks tab UI |

No changes to `endpoints.ts` or `orgAuth.ts`.

---

## Out of Scope (this iteration)

- Branching / conditional steps (if step 2 returns empty, skip step 3)
- Cross-playbook chaining
- Cloud sync of run history
- Visual graph editor for playbooks
