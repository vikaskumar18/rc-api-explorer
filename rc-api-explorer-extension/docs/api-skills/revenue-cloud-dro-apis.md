---
name: revenue-cloud-dro-apis
description: Complete API reference for Revenue Cloud Dynamic Revenue Orchestrator (DRO) — all 8 invocable action endpoints from PDF pages 1877-1913, entirely new category, scan date 2026-06-13
metadata:
  type: reference
---

# Revenue Cloud Dynamic Revenue Orchestrator (DRO) Business APIs

## Source
PDF: revenue_lifecycle_management_dev_lates.pdf (2917 pages)
Section: Pages 1877–1913 (DRO Standard Invocable Actions)
Scanned: 2026-06-13

## Important: DRO Is an Entirely New Category
This category does not exist in the current extension (v68 endpoints). All 8 endpoints must be added.

## Invocable Action Pattern
All DRO endpoints are Invocable Actions:
```
POST /services/data/v67.0/actions/standard/{actionName}
Body: { "inputs": [{ ...params }] }
```
Authentication: `Authorization: Bearer {access_token}`
Editions: Enterprise, Unlimited, Developer Editions of Revenue Cloud

---

## Endpoints

### Decompose Sales Transaction
- Method: POST
- Path: `/services/data/v67.0/actions/standard/decomposeSalesTransaction`
- Version: v66.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | salesTransactionId | Id | Required | 66.0 | ID of sales transaction to submit |
  | fulfillmentAdapter | String | Required | 66.0 | StandardOrder or GenericAdapter |
  | allowOverrideOfPointOfNoReturn | Boolean | Optional | 66.0 | Override point-of-no-return setting. Default: false |
  | fulfillmentPriority | String | Optional | 66.0 | High, Bulk, or Default |
  | hydratedContextId | String | Optional | 66.0 | ID of hydrated context |
  | intakeRequestType | String | Optional | 66.0 | Synchronous or Asynchronous |
  | priorityLimitAction | String | Optional | 66.0 | Reject or Downgrade |
- Response:
  - errorCode (String)
  - requestedFulfillmentPriority (String)
  - requestId (String)
  - resolvedFulfillmentPriority (String)
  - submitStatus (String)
  - usedContextId (String)

---

### Freeze Sales Transaction
- Method: POST
- Path: `/services/data/v67.0/actions/standard/freezeSalesTransaction`
- Version: v67.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | salesTransactionId | Id | Required | 67.0 | ID of the submitted sales transaction |
- Response:
  - errorCode (String)
  - orchestrationPlanId (Id)
  - planState (String)
  - pointOfNoReturnDetailForLineItemsList (String)
  - requestId (String)
  - salesTransactionId (String)

---

### Get Point Of No Return
- Method: POST
- Path: `/services/data/v67.0/actions/standard/getPointOfNoReturn`
- Version: v67.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | salesTransactionId | Id | Required | 67.0 | ID of sales transaction to check |
- Response:
  - errorCode (String)
  - lineItemsPointOfNoReturnInfo (String)
  - planId (Id)
  - planState (String)
  - requestId (String)
  - salesTransactionId (String)

---

### Orchestrate Sales Transaction
- Method: POST
- Path: `/services/data/v67.0/actions/standard/orchestrateSalesTransaction`
- Version: v67.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | salesTransactionId | Id | Required | 67.0 | ID of sales transaction to submit |
  | fulfillmentAdapter | String | Required | 67.0 | StandardOrder or GenericAdapter |
  | allowOverrideOfPointOfNoReturn | Boolean | Optional | 67.0 | Override point-of-no-return. Default: false |
  | fulfillmentPriority | String | Optional | 67.0 | High, Bulk, Default |
  | hydratedContextId | String | Optional | 67.0 | ID of hydrated context |
  | intakeRequestType | String | Optional | 67.0 | Synchronous or Asynchronous |
  | priorityLimitAction | String | Optional | 67.0 | Reject or Downgrade |
- Response:
  - errorCode (String)
  - fulfillmentPlanId (Id)
  - requestedFulfillmentPriority (String)
  - requestId (String)
  - resolvedFulfillmentPriority (String)
  - submitStatus (String)
  - usedContextId (String)

---

### Orchestrate Transaction
- Method: POST
- Path: `/services/data/v67.0/actions/standard/orchestrateTransaction`
- Version: v67.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | transactionId | String | Required | 67.0 | ID of business/domain object to orchestrate (e.g. Collection Plan ID) |
  | orchestrationType | String | Required | 67.0 | Generic, Fulfillment, or Billing |
- Response:
  - requestId (String)
  - errorCode (String)
  - fulfillmentPlanId (String)
  - submitStatus (String)

---

### Submit Order
- Method: POST
- Path: `/services/data/v67.0/actions/standard/submitOrder`
- Version: v67.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | orderId | String | Required | 67.0 | ID of order to submit to DRO |
  | callType | String | Optional | 67.0 | Synchronous or Asynchronous. Default: Asynchronous |
  | contextId | String | Optional | 67.0 | ID of hydrated context (see Context Service) |
- Response:
  - errorCode (String)
  - fulfillmentPlanId (String)
  - requestId (String)
  - submitStatus (String)
  - usedContextId (String)

---

### Submit Sales Transaction
- Method: POST
- Path: `/services/data/v67.0/actions/standard/submitSalesTransaction`
- Version: v67.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | salesTransactionId | Id | Required | 67.0 | ID of sales transaction to submit |
  | callType | String | Optional | 67.0 | Synchronous or Asynchronous. Default: Asynchronous |
  | contextId | String | Optional | 67.0 | ID of hydrated context |
  | fulfillmentPriority | String | Optional | 67.0 | High, Bulk, Default |
  | hydratedContextId | String | Optional | 67.0 | ID of hydrated context (same as contextId) |
- Response:
  - errorCode (String)
  - fulfillmentPlanId (String)
  - requestId (String)
  - submitStatus (String)
  - usedContextId (String)

---

### Unfreeze Sales Transaction
- Method: POST
- Path: `/services/data/v67.0/actions/standard/unfreezeSalesTransaction`
- Version: v67.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | salesTransactionId | Id | Required | 67.0 | ID of the submitted sales transaction |
- Response:
  - errorCode (String)

---

## Notes
- Decompose (v66.0) vs Orchestrate (v67.0): Orchestrate is the newer replacement for Decompose
- Submit Order vs Submit Sales Transaction: Use Submit Sales Transaction for quotes/orders that went through Revenue Cloud transaction management; Submit Order for bare orders
- Point of No Return: Once a fulfillment step passes PNR, it cannot be reversed. Use Freeze/Unfreeze/GetPointOfNoReturn to manage this
- `priorityLimitAction`: When priority limit is reached, Reject returns error; Downgrade lowers to next available priority
- `fulfillmentAdapter` values: StandardOrder (for standard Salesforce orders), GenericAdapter (for custom implementations)
