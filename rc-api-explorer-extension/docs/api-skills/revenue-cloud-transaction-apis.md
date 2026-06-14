---
name: revenue-cloud-transaction-apis
description: Complete API reference for Revenue Cloud Transaction Management — all 15 endpoints (7 existing + 8 new), params, versions from PDF pages 1381-1540, scan date 2026-06-13
metadata:
  type: reference
---

# Revenue Cloud Transaction Management Business APIs

## Source
PDF: revenue_lifecycle_management_dev_lates.pdf (2917 pages)
Section: Pages 1381–1540
Scanned: 2026-06-13

## Important: AsyncOperationTracker Pattern

Most Transaction Management APIs use the AsyncOperationTracker sObject endpoint:
```
POST /services/data/v67.0/sobjects/AsyncOperationTracker
```
The body wraps the actual payload in `inputs`: `{ "inputs": [{ ...params }] }`
Response includes: `requestId`, `statusURL`, `success`, plus result-specific fields.

---

## Endpoints

### Place Quote (Create/Update Quote)
- Method: POST
- Path: `/services/data/v67.0/sobjects/AsyncOperationTracker`
- Version: v60.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | graph | Object | Required | 60.0 | sObject graph of quote structure |
  | pricingPref | String | Optional | 60.0 | Force, Skip, System |
  | configurationInput | String | Optional | 60.0 | RunAndAllowErrors, RunAndBlockErrors, Skip |
  | configurationOptions | Object | Optional | 60.0 | Config options during ingestion |
  | catalogRatesPreference | String | Optional | 62.0 | Fetch, Skip |
- Response: Place Quote — quoteId, requestIdentifier, statusURL, success

---

### Asset Amendment
- Method: POST
- Path: `/connect/revenue-management/assets/actions/amend`
- Version: v60.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | assetIds | String[] | Required | 60.0 | Asset IDs to amend |
  | amendmentStartDate | String | Required | 60.0 | Amendment effective date |
  | outputRecordType | String | Required | 60.0 | Quote or Order |
  | opportunityId | String | Optional | 60.0 | Opportunity to link |
- Response: Amendment result with salesTransactionId

---

### Asset Cancellation
- Method: POST
- Path: `/connect/revenue-management/assets/actions/cancel`
- Version: v60.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | assetIds | String[] | Required | 60.0 | Asset IDs to cancel |
  | cancellationDate | String | Required | 60.0 | Cancellation effective date |
  | outputRecordType | String | Required | 60.0 | Quote or Order |
- Response: Cancellation result with salesTransactionId

---

### Asset Renewal
- Method: POST
- Path: `/services/data/v67.0/sobjects/AsyncOperationTracker`
- Version: v62.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | assetIds | String[] | Required | 62.0 | Asset IDs to renew |
  | outputRecordType | String | Required | 62.0 | Type of renewal record: Quote or Order |
  | contractId | String | Optional | 62.0 | Contract to sync renewal |
  | opportunityId | String | Optional | 62.0 | Opportunity to sync renewal quote |
  | outputRecordId | String | Optional | 62.0 | Existing quote/order to renew into |
  | renewalEndDate | String | Optional | 62.0 | End date of renewal |
  | renewalStartDate | String | Optional | 62.0 | Start date of renewal |
- Response: Renewal record details

---

### Initiate Downgrade
- Method: POST
- Path: `/revenue/transaction-management/assets/actions/downgrade`
- Version: v66.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | outputRecordType | String | Required | 66.0 | Record type for downgrade output |
  | swapStartDate | String | Required | 66.0 | Amendment start date |
  | swapGroups | Object[] | Required | 66.0 | Groups with asset details for downgrade |
  | contractId | String | Optional | 66.0 | Contract to downgrade |
  | opportunityId | String | Optional | 66.0 | Opportunity to downgrade |
- Response: Initiate Downgrade Response — salesTransactionId

---

### Initiate Upgrade
- Method: POST
- Path: `/revenue/transaction-management/assets/actions/upgrade`
- Version: v66.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | outputRecordType | String | Required | 66.0 | Record type for upgrade output |
  | swapStartDate | String | Required | 66.0 | Amendment start date |
  | swapGroups | Object[] | Required | 66.0 | Groups with asset details for upgrade |
  | contractId | String | Optional | 66.0 | Contract to upgrade |
  | opportunityId | String | Optional | 66.0 | Opportunity to upgrade |
- Response: Initiate Upgrade Response — salesTransactionId

---

### Get Eligible Promotions
- Method: POST
- Path: `/revenue/transaction-management/sales-transactions/actions/get-eligible-promotions`
- Version: v66.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | salesTransactionId | String | Required | 66.0 | Sales transaction ID for evaluation |
  | lineItemIds | String[] | Required | 66.0 | Line item IDs to evaluate |
- Response: Eligible Promotions Response — promotions, coupons, eligibility rules

---

## New Endpoints (Add to Extension)

### Place Order
- Method: POST
- Path: `/services/data/v67.0/sobjects/AsyncOperationTracker`
- Version: v60.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | graph | Object | Required | 60.0 | sObject graph of order structure |
  | pricingPref | String | Optional | 60.0 | Force, Skip, System |
  | configurationInput | String | Optional | 60.0 | RunAndAllowErrors, RunAndBlockErrors, Skip |
  | configurationOptions | Object | Optional | 60.0 | Config options during ingestion |
  | catalogRatesPreference | String | Optional | 62.0 | Fetch, Skip |
- Response: Place Order — orderId, requestId, statusURL, success

---

### Place Sales Transaction
- Method: POST
- Path: `/services/data/v67.0/sobjects/AsyncOperationTracker`
- Version: v60.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | graph | Object | Required | 60.0 | sObject graph of sales transaction |
  | pricingPref | String | Optional | 60.0 | Force, Skip, System |
  | catalogRatesPreference | String | Optional | 63.0 | Fetch, Skip |
  | configurationInput | String | Optional | 60.0 | RunAndAllowErrors, RunAndBlockErrors, Skip |
  | configurationOptions | Object | Optional | 60.0 | Config options during ingestion |
  | taxPref | String | Optional | 65.0 | Tax calculation preference. Value: Skip |
  | contextDetails | Object | Optional | 63.0 | Context details for sales transaction |
  | groupRampAction | String | Optional | 65.0 | AddProducts, DeleteProducts, EditGroup, EditRampSchedule, DeleteSegment, ConvertToNonRampedGroup |
- Response: Place Sales Transaction result — requestId, orderId/quoteId, statusURL, success

---

### Clone Sales Transaction
- Method: POST
- Path: `/services/data/v67.0/sobjects/AsyncOperationTracker`
- Version: v64.0
- Params: Sales transaction payload to clone
- Response: Clone Sales Transaction — requestId, salesTransactionId, errors, success

---

### Read Sales Transaction
- Method: POST
- Path: `/services/data/v67.0/sobjects/AsyncOperationTracker`
- Version: v65.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | contextId | String | Required | 65.0 | Context ID to retrieve records |
  | queryTags | String[] | Optional | 65.0 | Objects to retrieve: Quote, QuoteLineItem, Product |
  | sObjectFieldMap | Map<String,List<String>> | Optional | 67.0 | sObject field name mapping |
  | filters | Object[] | Optional | 67.0 | Filter conditions to query context data |
- Response: Read Sales Transaction — context records

---

### Preview Approval
- Method: POST
- Path: `/services/data/v67.0/sobjects/AsyncOperationTracker`
- Version: v65.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | flowApiName | String | Required | 65.0 | API name of auto-launched flow |
  | objectApiName | String | Required | 65.0 | API name of object to preview |
  | recordId | String | Required | 65.0 | Record ID to preview approvals for |
  | inputParameters | Map<String,Object> | Optional | 67.0 | Input parameters |
- Response: Preview Approval — approval chain items, error details, status

---

### Initiate Swap
- Method: POST
- Path: `/services/data/v67.0/sobjects/AsyncOperationTracker`
- Version: v66.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | outputRecordType | String | Required | 66.0 | Record type for swap output |
  | swapStartDate | String | Required | 66.0 | Amendment start date |
  | swapGroups | Object[] | Required | 66.0 | Groups with asset details |
  | contractId | String | Optional | 66.0 | Contract to swap |
  | opportunityId | String | Optional | 66.0 | Opportunity to swap |
- Response: Initiate Swap Response — salesTransactionId

---

### Create Ramp Deal
- Method: POST
- Path: `/services/data/v67.0/sobjects/AsyncOperationTracker`
- Version: v63.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | contextDetails | Object | Required if no graph | 63.0 | Context details for sales transaction |
  | graph | Object | Required if no contextDetails | 63.0 | sObject graph of sales transaction |
  | groupRampAction | String | Optional | 65.0 | AddProducts, DeleteProducts, EditGroup, EditRampSchedule, DeleteSegment, ConvertToNonRampedGroup |
  | pricingPref | String | Optional | 63.0 | Force, Skip, System |
- Response: Sales transaction ID with context reference

---

### Update Ramp Deal
- Method: POST
- Path: `/services/data/v67.0/sobjects/AsyncOperationTracker`
- Version: v62.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | addedNodes | Object[] | Required | 62.0 | Context nodes to add |
  | deletedNodes | Object[] | Required | 62.0 | Context nodes to delete |
  | updatedNodes | Object[] | Required | 62.0 | Context nodes to update |
  | executionSettings | Object | Optional | 62.0 | Settings for pricing or configuration execution |
- Response: Ramp Deal Service response — created/updated/deleted details

---

### Create Supplemental Transaction
- Method: POST
- Path: `/services/data/v67.0/sobjects/AsyncOperationTracker`
- Version: v64.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | relatedSalesTransactionId | String | Required | 64.0 | Original sales transaction ID |
  | pricingPref | String | Optional | 64.0 | Force, Skip, System |
  | supplementalGraph | Object | Optional | 64.0 | sObject graph with additional changes |
- Response: Supplemental transaction details — ID and success status

---

## Notes
- `pricingPref` valid values: Force (always run pricing), Skip (never run), System (use org default)
- `configurationInput` valid values: RunAndAllowErrors, RunAndBlockErrors, Skip
- `groupRampAction` valid values: AddProducts, DeleteProducts, EditGroup, EditRampSchedule, DeleteSegment, ConvertToNonRampedGroup
- AsyncOperationTracker responses are asynchronous — use `statusURL` to poll for completion
- Multiple transaction types (Place Quote, Place Order, Place Sales Transaction) share the same path, differentiated by the action type in the payload
