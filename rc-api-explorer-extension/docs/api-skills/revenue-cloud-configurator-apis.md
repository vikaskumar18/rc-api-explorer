---
name: revenue-cloud-configurator-apis
description: Complete API reference for Revenue Cloud Product Configurator — all 13 endpoints (4 existing + 9 new), params, versions from PDF pages 955-1068, scan date 2026-06-13
metadata:
  type: reference
---

# Revenue Cloud Product Configurator Business APIs

## Source
PDF: revenue_lifecycle_management_dev_lates.pdf (2917 pages)
Section: Pages 955–1068
Scanned: 2026-06-13

---

## Existing Endpoints (in current extension)

### Configuration (Load)
- Method: POST
- Path (old/extension): `/connect/cpq/configurator/actions/configure`
- Path (PDF canonical): `/services/data/v67.0/commerce/configurations/load`
- Version: v60.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | transactionId | String | Required | 60.0 | ID of sales transaction being configured |
  | correlationId | String | Optional | 60.0 | ID for traceability |
  | contextResponseType | String | Required for large | 65.0 | Response type: Delta, Full, None, Product |
  | qualificationContext | User Context Input | Optional | 60.0 | Context for qualification rules |
- Response: Configuration Load Instance — context/session details

---

### Saved Configuration (Get/Post)
- Method: GET, POST
- Path (old/extension): `/connect/cpq/configurator/saved-configuration`
- Path (PDF canonical GET): `/services/data/v67.0/commerce/configurations/{id}`
- Path (PDF canonical POST): `/services/data/v67.0/commerce/configurations/save-instance`
- Version: v60.0 (GET), v63.0 (named save POST)
- GET Params: `referenceRecordId` (query, Required v63.0) — filter saved configurations
- POST Params: `contextId` (Required) — transaction context ID to save
- Response: Configuration instance details

---

### Configurator Add Nodes
- Method: POST
- Path (old/extension): `/connect/cpq/configurator/actions/add-nodes`
- Path (PDF canonical): `/services/data/v67.0/commerce/configurations/add-nodes`
- Version: v60.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | contextId | String | Required | 60.0 | ID of context object |
  | addedNodes | Configurator Added Node Input[] | Required | 60.0 | List of nodes to add |
  | configuratorOptions | Configurator Options Input | Optional | 60.0 | Configuration execution options |
  | qualificationContext | User Context Input | Optional | 60.0 | Qualification context |
- Response: Configurator Add Nodes output

---

### Config Rules Execute
- Method: POST
- Path: `/revenue/product-configurator/rules/actions/execute`
- Version: v60.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | contextId | String | Required | 60.0 | Context ID |
  | ruleIds | String[] | Optional | 60.0 | Specific rule IDs to execute |
- Response: Rule execution results

---

## New Endpoints (PDF only, add to extension)

### Configuration Set Instance
- Method: POST
- Path: `/services/data/v67.0/commerce/configurations/set`
- Version: v60.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | contextMappingId | String | Required | 60.0 | ID of context mapping record |
  | configuratorOptions | Configurator Options Input | Optional | 60.0 | Options to pass to configurator |
  | qualificationContext | User Context Input | Optional | 60.0 | Context for qualification |
  | transaction | String | Optional | 60.0 | Transaction JSON payload as string |
- Response: Configuration Set Instance

---

### Configurator Delete Nodes
- Method: POST
- Path: `/services/data/v67.0/commerce/configurations/delete-nodes`
- Version: v60.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | contextId | String | Required | 60.0 | ID of context object |
  | deletedNodes | Configurator Deleted Node Input[] | Required | 60.0 | Nodes to delete |
  | configuratorOptions | Configurator Options Input | Optional | 60.0 | Execution options |
  | qualificationContext | User Context Input | Optional | 60.0 | Qualification context |
- Response: Configurator Delete Nodes output

---

### Configurator Update Nodes
- Method: POST
- Path: `/services/data/v67.0/commerce/configurations/update-nodes`
- Version: v60.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | contextId | String | Required | 60.0 | ID of context object |
  | updatedNodes | Configurator Updated Node Input[] | Required | 60.0 | Nodes to update |
  | configuratorOptions | Configurator Options Input | Optional | 60.0 | Execution options |
  | qualificationContext | User Context Input | Optional | 60.0 | Qualification context |
- Response: Configurator Update Nodes output

---

### Configuration Save (Named)
- Method: POST
- Path: `/services/data/v67.0/commerce/configurations/save`
- Version: v63.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | referenceRecordId | String | Required | 63.0 | ID of record to save configuration for |
  | data | String | Optional | 63.0 | JSON sales transaction as string |
  | description | String | Optional | 63.0 | Description of saved config |
  | name | String | Optional | 63.0 | Name of saved config |
- Response: Configuration Save Details

---

### Configuration Save Instance
- Method: POST
- Path: `/services/data/v67.0/commerce/configurations/save-instance`
- Version: v60.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | contextId | String | Required | 60.0 | Transaction context ID to save |
- Response: Configuration Save Instance

---

### Configuration List
- Method: GET
- Path: `/services/data/v67.0/commerce/configurations`
- Version: v63.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | referenceRecordId | String | Required | 63.0 | Query param — filter by record ID |
- Response: Configuration List — saved configurations for the record

---

### Configuration Get Instance
- Method: GET
- Path: `/services/data/v67.0/commerce/configurations/{configId}`
- Version: v60.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | configId | String | Required | 60.0 | Path param — configuration ID |
- Response: Configuration Get Instance details

---

### Product Quantity Set
- Method: POST
- Path: `/services/data/v67.0/commerce/configurations/set-quantity`
- Version: v60.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | contextId | String | Required | 60.0 | Context object ID |
  | quantity | Integer | Required | 60.0 | Product quantity value |
  | transactionLinePath | String[] | Required | 60.0 | Path to line item to update |
  | configuratorOptions | Configurator Options Input | Optional | 60.0 | Execution options |
  | qualificationContext | User Context Input | Optional | 60.0 | Qualification context |
- Response: Product Quantity Set Configurator output

---

## Notes
- Old extension paths (v1): `/connect/cpq/configurator/actions/*` — these may be v59.0/pre-GA paths
- New canonical paths (PDF v60.0+): `/services/data/v67.0/commerce/configurations/*`
- Both path sets may work; canonical paths should be preferred
- `contextResponseType` (v65.0) is important for large sales transactions to avoid timeout — values: Delta, Full, None, Product
