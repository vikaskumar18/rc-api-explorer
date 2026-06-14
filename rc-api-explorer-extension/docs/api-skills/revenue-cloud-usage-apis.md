---
name: revenue-cloud-usage-apis
description: Complete API reference for Revenue Cloud Usage Management — all 11 endpoints (5 existing + 6 new), params, versions from PDF pages 2040-2105, scan date 2026-06-13
metadata:
  type: reference
---

# Revenue Cloud Usage Management Business APIs

## Source
PDF: revenue_lifecycle_management_dev_lates.pdf (2917 pages)
Section: Pages 2040–2105
Scanned: 2026-06-13

---

## Existing Endpoints (in current extension)

### Asset Usage Details
- Method: GET
- Path: `/asset-management/assets/{assetId}/usage-details`
- Version: v63.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | assetId | String | Required | 63.0 | Path param — asset ID |
  | effectiveDate | String | Required | 63.0 | Date to search for applicable rate card entries |
  | optionalFields | String[] | Optional | 63.0 | Custom fields: AssetRateCardEntry, AssetRateAdjustment |
- Response: Usage Details — grants, resources, configured rates for the product

---

### Binding Object Usage Details
- Method: GET
- Path: `/revenue/usage-management/binding-objects/{bindingObjectId}/actions/usage-details`
- Version: v65.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | bindingObjectId | String | Required | 65.0 | Path param — binding object ID |
  | effectiveDate | String | Required | 65.0 | Date filter (yyyy-MM-dd) for grants, rates, policies |
- Response: Binding Object Usage Detail — grants, resources, rates, policies

---

### Consumption Traceabilities
- Method: POST
- Path: `/revenue/usage-management/consumption/actions/trace`
- Version: v66.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | liableSummaryIds | String[] | Required | 66.0 | Liable summary IDs to trace |
- Response: Consumption Traceabilities — overage charges and resource drawdown breakdown

---

### Usage Product Activation
- Method: POST
- Path: `/revenue/usage-management/usage-products/actions/activate`
- Version: v67.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | activationRequests | Usage Activation Request Input[] | Required | 67.0 | Activation requests. Accepts only 1 entry; MAX_LIMIT_EXCEEDED if more |
  | shouldValidateProductSetup | Boolean | Optional | 67.0 | Run product setup validation before activation. Default: true |
- Response: Usage Product Activation — activation outcome per product

---

### Usage Product Validation
- Method: POST
- Path: `/revenue/usage-management/usage-products/actions/validate`
- Version: v66.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | productIds | String[] | Required | 66.0 | Product IDs to validate. Max: 10 |
  | startDate | String | Optional | 66.0 | Start of date range for active records |
  | endDate | String | Optional | 66.0 | End of date range for active records |
- Response: Usage Product Validation — validation results, errors, warnings

---

## New Endpoints (Add to Extension)

### Order Item Usage Details
- Method: GET
- Path: `/commerce/sales-orders/line-items/{orderItemId}/usage-details`
- Version: v63.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | orderItemId | String | Required | 63.0 | Path param — order item ID |
  | effectiveDate | String | Optional | 63.0 | Date to search for applicable rate card entries |
  | optionalFields | String[] | Optional | 63.0 | Custom fields: OrderItemRateCardEntry, OrderItemRateAdjustment |
- Response: Usage Details — grants, resources, configured rates for order item

---

### Quote Line Item Usage Details
- Method: GET
- Path: `/commerce/quotes/line-items/{quoteLineItemId}/usage-details`
- Version: v62.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | quoteLineItemId | String | Required | 62.0 | Path param — quote line item ID |
  | effectiveDate | String | Optional | 62.0 | Date to search for applicable rate card entries |
  | optionalFields | String[] | Optional | 62.0 | Custom fields: QuoteLineRateCardEntry, QuoteLineRateAdjustment |
- Response: Usage Details — grants, resources, configured rates for quote line item

---

### Invoke Summary Creation (Invocable Action)
- Method: POST
- Path: `/services/data/v67.0/actions/standard/invokeSummaryCreationService`
- Version: v63.0
- Body: `{ "inputs": [{ "usageEntitlementAccountId": "..." }] }`
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | usageEntitlementAccountId | String | Required | 63.0 | Usage entitlement account record ID |
- Response: No direct response — creates usage, ratable, and liable summaries asynchronously

---

### Process Consumption Overages (Invocable Action)
- Method: POST
- Path: `/services/data/v67.0/actions/standard/processConsumptionOverages`
- Version: v63.0
- Body: `{ "inputs": [{ "usageRatableSummaryId": "..." }] }`
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | usageRatableSummaryId | String | Required | 63.0 | Usage ratable summary ID for overage calculation |
- Response: No direct response — processes overages for SummaryComplete records

---

### Refresh Usage Entitlement Bucket (Invocable Action)
- Method: POST
- Path: `/services/data/v67.0/actions/standard/refreshUsageEntitlementBucket`
- Version: v63.0
- Body: `{ "inputs": [{ "transactionUsageEntitlementId": "..." }] }`
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | transactionUsageEntitlementId | String | Required | 63.0 | Transaction usage entitlement record with buckets to refresh |
- Response: No direct response — refreshes entitlements by evaluating usage entitlement bucket records

---

### Retrigger Entitlement Creation Process (Invocable Action)
- Method: POST
- Path: `/services/data/v67.0/actions/standard/retriggerEntlCreatProc`
- Version: v65.0
- Body: `{ "inputs": [{ "assetId": "..." }] }`
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | assetId | String | Required | 65.0 | Asset ID to retrigger entitlement creation |
- Response: No direct response — triggers entitlement creation for failed/unprocessed assets or creates wallets

---

## Notes
- `optionalFields` for Asset Usage Details: AssetRateCardEntry, AssetRateAdjustment
- `optionalFields` for Order Item Usage Details: OrderItemRateCardEntry, OrderItemRateAdjustment
- `optionalFields` for Quote Line Item Usage Details: QuoteLineRateCardEntry, QuoteLineRateAdjustment
- `activationRequests` in Usage Product Activation only accepts one entry — multiple entries cause MAX_LIMIT_EXCEEDED error
- `shouldValidateProductSetup` in Usage Product Activation (v67.0): if false, skips pre-activation validation checks
- invokeSummaryCreationService is the entry point for usage billing cycle — creates usage summaries, ratable summaries, and liable summaries
