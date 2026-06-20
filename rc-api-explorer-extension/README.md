# Revenue Cloud API Explorer

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/vikas-builds.rc-api-explorer?label=VS%20Code%20Marketplace&logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=vikas-builds.rc-api-explorer)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/vikas-builds.rc-api-explorer)](https://marketplace.visualstudio.com/items?itemName=vikas-builds.rc-api-explorer)

A VS Code extension for exploring, testing, and chaining Salesforce Revenue Cloud REST APIs directly from your editor — no Postman, no manual cURL, no token juggling.

---

## What's New in v1.2.0

- **⚙ Configurator Session Builder** — visual tool to manage the stateful configurator lifecycle (load-instance → add/update/delete nodes → run rules → save-instance); `contextId` auto-saved to `CFG_CONTEXT_ID` env var for use across tabs
- **13 Configurator endpoints** fully documented (cfg-1 through cfg-12) with corrected request/response bodies, all 9 `configuratorOptions` fields, and clickable examples
- **Configurator Session Flow playbook** — 4-step built-in playbook in the Playbooks rail
- **Amber lifecycle banner** on all stateful configurator endpoints linking directly to the builder
- **cfg-12** — new endpoint: Run Config Rules invocable action (`POST /actions/standard/runConfigRules`, v65.0+)

---

## What's New in v1.1.0

- **Postman Import** — import any Postman Collection v2.1 from a local file, a URL, or the built-in catalog
- **☁ Salesforce Platform APIs** — 250+ requests (REST, Bulk, Composite, Connect, CPQ, Einstein, GraphQL, Loyalty) available with one click via the collection catalog
- **Postman Environment Import** — import `.postman_environment.json` files to sync variables into the extension
- **★ Pin / Unpin** — pin saved requests to a dedicated section at the top of the list
- **📋 Clone** — duplicate any saved request or RC API catalog endpoint
- **Collection Runner** — run all requests in a category with a visible progress modal
- **Theme toggle** — switch between light and dark mode
- **Resizable sidebar** — drag to adjust panel widths
- **Auth fallback chain** — resolves 401 errors across all SF CLI versions automatically

---

## Features

- **147 endpoints** across 9 Revenue Cloud modules, with pre-filled request bodies and parameter docs
- **Postman Collection Import** — one-click import from file, URL, or the built-in GitHub catalog
- **Multi-step playbooks** — run chained API flows (CPQ quote, asset amendment, DRO orchestration, billing) with a single click
- **Live org execution** — reads your `sf` CLI auth automatically, no copy-pasting tokens
- **PST Builder** — visual tool to build Place Sales Transaction payloads via the RC connect API; load an existing quote to see its full QLI/QLR/attribute tree, add/patch/delete line items and attributes, and execute directly
- **Product Browser** — browse products, bundles, and pricebook entries from your org; launch a configurator flow and build PST payloads from the results
- **Swap Builder** — multi-asset swap payload builder with cURL / Apex / JS copy
- **Run History** — every execution saved locally; replay or inspect any previous run
- **Environment variables** — define named variable sets per org and reuse across requests
- **Custom requests** — save, pin, clone, and categorize your own endpoints alongside the built-in ones
- **Custom playbooks** — build and persist your own multi-step API chains

---

## Requirements

- **VS Code** 1.85+
- **Salesforce CLI** (`sf`) installed and authenticated: `sf org login web --alias myorg`

---

## Installation

**Option A — VS Code Marketplace (recommended)**

Search **"Revenue Cloud API Explorer"** in the VS Code Extensions panel, or install via command line:
```bash
code --install-extension vikas-builds.rc-api-explorer
```
Or open directly: [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=vikas-builds.rc-api-explorer)

**Option B — VSIX file**

Download the latest `.vsix` from [Releases](https://github.com/vikaskumar18/rc-api-explorer/releases/latest), then:

```bash
code --install-extension rc-api-explorer-1.1.0.vsix
```

Or via VS Code UI (no terminal needed):
1. Open VS Code
2. Go to the **Extensions** view (`Cmd+Shift+X` on Mac / `Ctrl+Shift+X` on Windows)
3. Click the **`...`** menu (top-right of the Extensions panel)
4. Select **Install from VSIX…**
5. Browse to and select the downloaded `rc-api-explorer-1.1.0.vsix` file
6. Click **Install**

After installing, reload VS Code when prompted. The extension activates automatically on startup.

---

## Opening the Panel

Three ways:

| Method | Action |
|--------|--------|
| **Keyboard** | `Cmd+Shift+R` (Mac) / `Ctrl+Shift+R` (Windows/Linux) |
| **Command Palette** | `Revenue Cloud: Open API Explorer` |
| **Activity Bar** | Click the ⚡ icon in the left sidebar |

---

## Layout

```
┌──────────────────────┬─────────────────────────────────────────────┐
│  SIDEBAR             │  MAIN PANEL (tabs)                          │
│                      │                                             │
│  Org selector        │  Endpoint detail / Try It / Response        │
│  API version         │  PST Builder                                │
│  Search endpoints    │  Swap Builder                               │
│  Category filters    │  Global Search tab                          │
│  Endpoint list       │                                             │
│                      │                                             │
│  [Rail buttons]      │                                             │
│  Endpoints           │                                             │
│  Playbooks           │                                             │
│  Environments        │                                             │
│  History             │                                             │
└──────────────────────┴─────────────────────────────────────────────┘
```

---

## Selecting an Org

1. The **org dropdown** in the top-left populates automatically from your `sf` CLI auth (~/.sfdx).
2. Select the org you want to execute against.
3. The status line shows the resolved username and session state.
4. If you see **⚠ Session expired**, re-authenticate: `sf org login web --alias <your-alias>`
5. Click **⟳** to refresh the org list after logging in.

> **Tip:** The extension pre-warms your token as soon as you select an org, so the first Execute is fast.

---

## Default API Version

The **`API ver`** input (next to the Refresh button in the sidebar) sets the default version for every endpoint. Default is `v66.0`.

- Change it once → all open tabs and newly opened tabs update
- Each tab's version badge is independently editable if one specific endpoint needs a different version
- Most RC endpoints work on `v66.0`; use `v67.0` for the newest features (DRO, swap, recommendations)

---

## Exploring Endpoints

### Search
Type in the search box to filter endpoints by name, path, or keyword.

### Category Filters
Click the filter chips to narrow by module:

| Filter | Module |
|--------|--------|
| PCM | Product Catalog Management (18 endpoints) |
| Discovery | CPQ / Product Discovery (11 endpoints) |
| Pricing | Salesforce Pricing (20 endpoints) |
| Rate | Rate Management (3 endpoints) |
| Config | Product Configurator (13 endpoints) |
| TXN | Transaction Management (16 endpoints) |
| Usage | Usage Management (11 endpoints) |
| Billing | Billing (48 endpoints) |
| DRO | Dynamic Revenue Orchestrator (8 endpoints) |

### Collapse / Expand
Use **⊖ Collapse All** / **⊕ Expand All** to manage the list.

---

## Executing an Endpoint

1. Click an endpoint to open it in a tab
2. Switch to the **▶ Try It** sub-tab
3. Select your org from the dropdown
4. Edit the **Method**, **API version**, or **Path** if needed
5. Fill in **Path Parameters** and **Query Parameters** (if any)
6. Edit the **Request Body** (JSON) — pre-filled with a working example
7. Press **▶ Execute** or `Cmd+Enter` / `Ctrl+Enter`

The response appears below with:
- HTTP status code and duration
- Pretty-printed JSON
- **Search** to filter response lines
- **Copy Full** button if the response is large
- **Save** buttons to capture IDs as environment variables

---

## Path Parameters

Endpoints with `{paramName}` in the path show a **Path Parameters** section. Fill them in manually or click **⊕** to browse your org's records and pick an ID.

---

## Environment Variables

Variables let you store IDs and values and inject them automatically into request bodies and paths.

### Creating an Environment
1. Click the 🌐 (Environments) rail button
2. Click **+ New Environment**
3. Give it a name and select an org
4. Add key/value pairs (e.g. `ACCOUNT_ID` → `001XXXXXXXXXXXX`)

### Using Variables
Reference variables in request bodies as `{{VARIABLE_NAME}}`:
```json
{
  "accountId": "{{ACCOUNT_ID}}",
  "quoteId": "{{QUOTE_ID}}"
}
```

Variables from the active environment are substituted automatically before execution.

### Quick Variable Fill
If an endpoint body contains `{{VARIABLE}}` placeholders, a **Quick Variable Fill** panel appears above the body editor — fill them in without editing the JSON directly.

---

## Playbooks (Multi-step API Flows)

Playbooks chain multiple API calls together, passing outputs from one step as inputs to the next.

### Built-in Playbooks

| Playbook | Steps | Purpose |
|----------|-------|---------|
| **Catalog Discovery Flow** | 4 | Fetch catalogs → categories → products → product detail |
| **CPQ Quote Flow** | 4 | Fetch CPQ catalogs → categories → products → qualification |
| **Product Setup Flow** | 4 | Classification list → products list → deep clone → related records |
| **Asset Amendment Flow** | 3 | Amend asset → submit to DRO → decompose |
| **Order Fulfillment Flow** | 3 | Place order → orchestrate → get point of no return |
| **Invoice Billing Flow** | 3 | Create billing schedules → generate invoices → post invoices |
| **Usage Summary Flow** | 3 | Get asset usage → invoke summary creation → process overages |

### Running a Playbook
1. Click the 🎯 (Playbooks) rail button
2. Select a playbook
3. Select your org
4. Click **▶ Run All** to execute all steps in sequence
5. Or click **▶ Run from Step N** to resume from a specific step

Each step shows its status (pending / running / done / error) in a timeline. IDs extracted from earlier steps are automatically injected into later ones.

### Custom Playbooks
1. In the Playbooks rail, click **+ New Playbook**
2. Add steps: pick an endpoint, set the body, define extraction rules (which field from the response to carry forward)
3. Save — stored in `.rc-explorer/custom-playbooks.json` in your workspace
4. Run exactly like built-in playbooks

---

## PST Builder (Place Sales Transaction)

Builds payloads for the RC connect API (`POST /connect/rev/sales-transaction/actions/place`) visually.

**Load an existing quote:**
1. Enter a Quote ID and click **Load Quote**
2. The full QLI/QLR/attribute tree renders — each line item shows its op badge (PATCH/DELETE/UNCHANGED), qty, billing frequency, and existing attributes with human-readable labels
3. Attributes are fetched with `AttributeDefinition.Label` so you see "Term" instead of a raw ID

**Make changes:**
- **Patch** an existing QLI: change qty or billing frequency inline
- **Delete** a QLI: click 🗑 — the node turns red and is included as DELETE in the payload
- **Add a new QLI**: click **+ Flat Insert** or **+ Child QLI** on a parent; fill Product2Id, PBE, qty, and optionally add attributes
- **Add attributes** to a new insert: click **+ Attr**, set the AttributeDefinitionId, choose Picklist or Text, and fill the value

**Execute:**
- Click **▶ Execute** to POST directly to your org
- Or copy as **Apex / cURL / JS**
- The **Payload Preview** tab shows the full graph (Section 1: complete structure, Section 2: delta changes only)

---

## Swap Builder

Builds multi-asset swap payloads for `POST /revenue/transaction-management/assets/actions/swap`.

1. Click **⇆ Open Swap Builder** from a Transaction endpoint
2. Add assets to swap using the **+ Asset** tab
3. Fill in `assetId`, `newProductId`, and other required fields
4. **Execute**, or copy as cURL / Apex / JS

---

## Run History

Every execution is saved automatically in `.rc-explorer/runs/` in your workspace.

- Click the 🕒 (History) rail button to browse past runs
- Click **👁 Inspect** to load a run's response back into view
- Click **▶ Replay** to re-execute with the same parameters
- Click **🗑 Delete** to remove a run

The Run History tree view in the VS Code sidebar (left panel) also shows recent runs with quick-access buttons.

---

## Postman Collection Import

Import any Postman Collection v2.1 into the Saved Requests panel.

### One-click catalog
1. Go to the **Saved Requests** rail (bookmark icon)
2. Under **Collections**, click **☁ Salesforce Platform APIs** — 250+ requests load instantly
3. More collections can be added to the catalog without updating the extension

### From a local file
1. Click **+ Import Collection** → **File** tab
2. Select your `.postman_collection.json`
3. Browse the folder tree and select which requests to import

### From a URL
1. Click **+ Import Collection** → **URL** tab
2. Paste a direct link to a Postman Collection JSON
3. Browse and import

### Import Postman Environments
1. Click **+ Import Collection** → **Environments** tab
2. Select your `.postman_environment.json`
3. Variables are merged into the extension's environment store

---

## Custom Requests

Save your own API calls alongside the built-in endpoints.

1. Click **+ Custom Request** in the Saved Requests panel
2. Enter a name, method, path, headers, and body
3. Optionally assign a **category** (e.g. `My Org > Accounts`) to organise requests into folders
4. Save — appears in the list under its category
5. Execute exactly like built-in endpoints

### Pin requests
Click **☆** on any saved request to pin it — pinned requests appear in a dedicated **★ Pinned** section at the top.

### Clone requests
Hover over a saved request row and click **📋** to duplicate it.

### Collection Runner
Click **▶** on any category header to run all requests in that category in sequence, with a live progress modal showing status and duration per request.

---

## cURL / Apex / JS Export

On any endpoint's Try It tab, after filling in the parameters:

- **cURL** — copies a ready-to-run `curl` command with your org's token
- **Apex** — copies an `HttpRequest` snippet for use in anonymous Apex
- **JS** — copies a `fetch()` snippet

These are available before execution — you don't need to run the request first.

---

## Diff / Baseline

1. Click **⬛ Baseline** to capture the current response as a reference
2. Make changes (different body, different org, different version)
3. Click **Diff** to see what changed between the baseline and new response

---

## Validate

Click **✓ Validate** to check your request body JSON for syntax errors before executing.

---

## Org Record Picker

On any parameter input, click the **⊕** button to open a record browser:
1. The picker searches your org for matching records
2. Filter by name or ID
3. Click a record to paste its ID into the field

---

## Troubleshooting

### "Session expired" error
```
sf org login web --alias <your-alias>
```
Then click **⟳ Refresh orgs** in the extension.

### Org list is empty
- Confirm `sf org list` works in your terminal
- Click **⟳ Refresh orgs**
- Check **Log** button in the sidebar for error details

### HTTP 400 on an endpoint
- Check the **API version** — some endpoints only exist from a specific version (e.g. `v66.0`)
- Verify required fields are filled in the request body
- Check that the org has the relevant RC feature enabled and permissions assigned

### HTTP 403 / insufficient privileges
Some endpoints require specific permission sets. Common ones:

| Feature | Permission Set |
|---------|---------------|
| Asset amendment/renewal | `RevLifecycleManagementInitiateAmendmentApi` |
| DRO orchestration | `RevLifecycleManagementOrchestrationApi` |
| Usage management | `RevLifecycleManagementUsageApi` |

---

## Local Storage

All extension data is stored in your workspace under `.rc-explorer/`:

```
.rc-explorer/
  runs/              # execution history (one JSON per run)
  custom-playbooks.json  # your custom playbook definitions
```

Environment variable sets are stored in VS Code's extension storage (persisted across workspaces).

---

## Building from Source

```bash
cd rc-api-explorer-extension
npm install
npm run package        # builds + packages → rc-api-explorer-1.1.0.vsix
code --install-extension rc-api-explorer-1.1.0.vsix
```

For development with live rebuild:
```bash
npm run watch
```

---

## API Reference

Full API documentation is in `rc-api-explorer-extension/docs/api-skills/`:

| File | Coverage |
|------|----------|
| `revenue-cloud-pcm-apis.md` | Product Catalog Management |
| `revenue-cloud-discovery-apis.md` | CPQ / Discovery |
| `revenue-cloud-pricing-apis.md` | Salesforce Pricing |
| `revenue-cloud-transaction-apis.md` | Transaction Management |
| `revenue-cloud-dro-apis.md` | DRO / Fulfillment |
| `revenue-cloud-usage-apis.md` | Usage Management |
| `revenue-cloud-billing-apis.md` | Billing |
| `revenue-cloud-rate-apis.md` | Rate Management |
| `revenue-cloud-configurator-apis.md` | Product Configurator |

---

## Feedback

Found a bug, missing endpoint, or want a new playbook?

- **Feedback form** → https://docs.google.com/forms/d/1ClrwfvNd4MJ4oF0zdUPAnsBRogZ5V9D7X9sk6bUwGIM/viewform
- **GitHub Issues** → https://github.com/vikaskumar18/rc-api-explorer/issues
