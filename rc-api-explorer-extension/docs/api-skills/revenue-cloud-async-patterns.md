# Revenue Cloud Async Patterns

Covers: AsyncOperationTracker polling, platform events (names/payloads), DRO invocable actions, billing async actions, Usage Management invocable actions, error handling, retry strategies, governor limits, monitoring patterns.

---

## 1. AsyncOperationTracker — sObject Fields and Polling

`AsyncOperationTracker` is the standard sObject used by Revenue Cloud to surface the status of long-running async operations. The `statusUrl` output field on several billing and DRO invocable actions returns a path in the form:

```
/services/data/v67.0/sobjects/AsyncOperationTracker/<recordId>
```

**Example from Void Posted Credit Memo action response:**
```json
{
  "outputValues": {
    "debitMemoId": "4DmSG000001YcIP0A0",
    "statusUrl": "/services/data/v67.0/sobjects/AsyncOperationTracker/16PSG000001qlyL2AQ"
  }
}
```

**Polling pattern:**
1. Call the invocable action (e.g. `voidPostedCreditMemo`, `decomposeSalesTransaction`).
2. Extract `statusUrl` or `requestId` from the response.
3. GET `{instanceUrl}{statusUrl}` with `Authorization: Bearer {token}` on an interval.
4. Check the `Status` field until it reaches a terminal value (`Completed`, `Failed`, `Error`).
5. On `Failed`/`Error`, read the `Error` or `ErrorMessage` field for the failure reason.

**Key fields to query on AsyncOperationTracker:**
- `Id` — record identifier
- `Status` — current processing status (terminal: `Completed`, `Failed`, `Error`)
- `RequestId` — correlation ID linking to the originating action call
- `StatusURL` — self-referential URL for polling
- `Error` / `ErrorMessage` — failure details on non-success terminal states

**Timeout handling guidance:**
- Set a maximum polling duration (recommended: 5–10 minutes for billing operations, 30 minutes for DRO fulfillment).
- Use exponential backoff: start at 2s, double to 4s, 8s, cap at 30s.
- After timeout, query `SalesTransactionFulfillReq` (for DRO) or `BillingSchedule` (for billing) directly to assess state.

---

## 2. Platform Events Fired by Revenue Cloud

All RC platform events use CometD / Streaming API subscription. Subscribe via `/event/<EventName>`. Use `ReplayId` for event replay and recovery after connection drops.

### 2.1 CreateAssetOrderEvent (v55.0+)

**Channel:** `/event/CreateAssetOrderEvent`

| Field | Type | Notes |
|---|---|---|
| AssetDetails | CreateAssetOrderDtlEvent[] | Array of per-asset detail sub-events |
| CorrelationIdentifier | string | Caller-supplied correlation ID |
| EventUuid | string | Unique event identifier |
| IsLastEvent | boolean (default false) | v62.0+; signals final event in a batch |
| OrderIdentifier | string | v64.0+; ID of the order record |
| ReplayId | string | For replay/recovery |
| RequestIdentifier | string | Unique ID from the originating request |

### 2.2 CreateAssetOrderDtlEvent (v55.0+)

**Channel:** `/event/CreateAssetOrderDtlEvent`
**Note:** Cannot be subscribed to directly. Delivered as the `AssetDetails` array inside `CreateAssetOrderEvent`.

| Field | Type | Notes |
|---|---|---|
| AssetId | reference (Asset) | |
| ErrorCode | string | Set on failure |
| ErrorMessage | string | Set on failure |
| EventUuid | string | |
| IsSuccess | boolean (default false) | v61.0+; true if asset creation succeeded |
| OrderItemId | reference (OrderItem) | |
| ReplayId | string | |

### 2.3 PlaceOrderCompletedEvent (v63.0+)

**Channel:** `/event/PlaceOrderCompletedEvent`
**Event delivery allocation ENFORCED:** Yes

| Field | Type | Notes |
|---|---|---|
| AppUsageTypes | string | RC value: `"RevenueLifecycleManagement"` |
| CorrelationIdentifier | string | |
| EventUuid | string | |
| HasErrors | boolean (default false) | True if order placement had errors |
| OrderId | reference (Order) | |
| ReplayId | string | |
| RequestIdentifier | string | Unique ID from the Place Sales Transaction response |

### 2.4 QuoteSaveEvent (v60.0+)

**Channel:** `/event/QuoteSaveEvent`
Available in orgs with Subscription Management or Revenue Cloud.

| Field | Type | Notes |
|---|---|---|
| CorrelationIdentifier | string | |
| EventUuid | string | |
| HasErrors | boolean (default false) | |
| QuoteId | reference | |
| ReplayId | string | |
| RequestIdentifier | string | |

### 2.5 QuoteToOrderCompletedEvent (v56.0+)

**Channel:** `/event/QuoteToOrderCompletedEvent`
**Event delivery allocation:** No (not enforced)

| Field | Type | Notes |
|---|---|---|
| CorrelationIdentifier | string | |
| EventUuid | string | |
| HasErrors | boolean | |
| OrderId | string | |
| OrderNumber | string | |
| QuoteToOrderErrorDetailEvents | QuoteToOrderErrDtlEvent[] | Nested error detail array |
| ReplayId | string | |
| RequestIdentifier | string | Unique ID from `createOrderFromQuote` response |

### 2.6 SalesTrxnDeleteEvent (v64.0+)

Used internally to trigger deletion of fulfillment request records.

| Field | Notes |
|---|---|
| ReferenceObjectIdentifier | ID of the sales transaction being deleted |

**Supported operations:** `create()`, `describeSObjects()`

---

## 3. DRO (Dynamic Revenue Orchestrator) Standard Invocable Actions

All actions POST to `/services/data/v{version}/actions/standard/{actionName}` with body `{"inputs": [{...}]}`.

### 3.1 Decompose Sales Transaction (v67.0+)

**URI:** `/services/data/v66.0/actions/standard/decomposeSalesTransaction`

Runs all three DRO phases: decomposition, plan composition, and orchestration.

**Inputs:**

| Input | Type | Required | Notes |
|---|---|---|---|
| salesTransactionId | string | Yes | ID of the sales transaction (Order or Quote) |
| fulfillmentAdapter | string | Yes | `StandardOrder` or `GenericAdapter` |
| intakeRequestType | string | No | `Synchronous` or `Asynchronous` (default: Asynchronous) |
| fulfillmentPriority | string | No | `High`, `Bulk`, or `Default` |
| priorityLimitAction | string | No | `Reject` or `Downgrade`; requires fulfillmentPriority |
| allowOverrideOfPointOfNoReturn | boolean | No | Default: false |
| hydratedContextId | string | No | |

**Outputs:**

| Output | Notes |
|---|---|
| submitStatus | `SUCCESS`, `Error`, `Submitted`, `Rejected` |
| requestId | Correlation ID for tracking |
| errorCode | Set on failure |
| requestedFulfillmentPriority | What was requested |
| resolvedFulfillmentPriority | What was actually assigned |
| usedContextId | Context ID used for decomposition |

**Minimal example request:**
```json
{
  "inputs": [{
    "fulfillmentAdapter": "StandardOrder",
    "intakeRequestType": "Synchronous",
    "salesTransactionId": "801xx000003GYexAAG"
  }]
}
```
**Successful response:** `submitStatus: "SUCCESS"`

### 3.2 Orchestrate Sales Transaction (v67.0+)

**URI:** `/services/data/v67.0/actions/standard/orchestrateSalesTransaction`

Executes plan composition and orchestration phases ONLY (no decomposition). Use after decomposition has already been done.

**Inputs:** Same as Decompose Sales Transaction.

**Outputs:**

| Output | Notes |
|---|---|
| submitStatus | `SUCCESS`, `ERROR`, `SUBMITTED`, `REJECTED` |
| fulfillmentPlanId | ID of the created FulfillmentPlan |
| requestId | |
| errorCode | |
| requestedFulfillmentPriority | |
| resolvedFulfillmentPriority | |
| usedContextId | |

### 3.3 Freeze Sales Transaction (v64.0+)

**URI:** `/services/data/v67.0/actions/standard/freezeSalesTransaction`

Freezes a sales transaction to prevent changes before orchestration.

**Inputs:**

| Input | Type | Required |
|---|---|---|
| salesTransactionId | string | Yes |

**Outputs:**

| Output | Notes |
|---|---|
| orchestrationPlanId | ID of the OrchestrationPlan created |
| planState | `FAILURE`, `NOTSTARTED`, `PENDING`, `COMPLETED`, `FROZEN`, `INPROGRESS` |
| pointOfNoReturnDetailForLineItemsList | List of line item PONR details |
| requestId | |
| salesTransactionId | |
| errorCode | |

### 3.4 Get Point Of No Return (v64.0+)

**URI:** `/services/data/v67.0/actions/standard/getPointOfNoReturn`

Retrieves the Point of No Return status for each line item in a sales transaction.

**Inputs:**

| Input | Type | Required |
|---|---|---|
| salesTransactionId | string | Yes |

**Outputs:**

| Output | Notes |
|---|---|
| lineItemsPointOfNoReturnInfo | Per-line PONR details |
| planId | ID of the FulfillmentPlan |
| planState | Current state of the plan |
| requestId | |
| salesTransactionId | |
| errorCode | |

### 3.5 Orchestrate Transaction (v66.0+)

**URI:** `/services/data/v67.0/actions/standard/orchestrateTransaction`

Generic orchestration for non-sales-transaction objects (e.g. Collection Plan ID).

**Inputs:**

| Input | Type | Required | Notes |
|---|---|---|---|
| transactionId | string | Yes | e.g. Collection Plan ID |
| orchestrationType | string | Yes | `Generic`, `Fulfillment`, or `Billing` |

**Outputs:**

| Output | Notes |
|---|---|
| submitStatus | `Success` or `Error` |
| fulfillmentPlanId | |
| requestId | |
| errorCode | |

### 3.6 Submit Order (v61.0+)

**URI:** `/services/data/v67.0/actions/standard/submitOrder`

**Inputs:**

| Input | Type | Required | Notes |
|---|---|---|---|
| orderId | string | Yes | |
| callType | string | No | `Synchronous` or `Asynchronous` (default: `Asynchronous`) |
| contextId | string | No | |

**Outputs:**

| Output | Notes |
|---|---|
| submitStatus | `SUCCESS`, `ERROR`, `SUBMITTED`, `REJECTED` |
| fulfillmentPlanId | Returned for synchronous calls only |
| requestId | |
| usedContextId | |
| errorCode | |

**Error example:**
```json
{
  "statusCode": "UNKNOWN_EXCEPTION",
  "errorCode": "DRO_INTERNAL_ERROR"
}
```

### 3.7 Explainability Action Logs

GET `/services/data/v{version}/actions/standard/{actionName}` with query parameters to retrieve action logs for DRO operations.

**Response structure:**
```json
{
  "actionLogs": [{
    "actionContextCode": "...",
    "actionLog": {
      "OrderIntakeStatus": "...",
      "OrderIntakeStatusMessage": "...",
      "OrderId": "...",
      "SubmitMode": "..."
    }
  }]
}
```

---

## 4. SalesTransactionFulfillReq — Fulfillment Status Tracking

**Available from:** v62.0+
**Supported operations:** `describeLayout()`, `describeSObjects()`, `getDeleted()`, `getUpdated()`, `query()`, `retrieve()`

This sObject is the primary record for tracking DRO fulfillment progress. Query it to monitor and debug async fulfillment.

### Key Fields

| Field | Values / Notes |
|---|---|
| Status | `Created`, `Freezing`, `Frozen`, `Fulfilled`, `Fulfilling`, `Rejected`, `Superseded` |
| AssetizationStatus | `Completed`, `Failed`, `InProgress`, `NotStarted`, `Rejected`, `NotApplicable` (v64.0+) |
| DecompositionStatus | `Completed`, `Failed`, `InProgress`, `NotStarted`, `Rejected`, `NotApplicable` (v64.0+) |
| PlanCompositionStatus | Same values; internal use only |
| PlanExecutionStatus | `InProgress`, `Frozen`, `Freezing` |
| PlanId | Reference to FulfillmentPlan |
| PreviousRequestId | Reference to previous SalesTransactionFulfillReq (for superseded records) |
| SalesTransactionType | `StandardOrder`, `GenericAdapter` (v64.0+) |
| OrchestrationGroupKey | v63.0+; identifier for a group of sales transactions requiring synchronization before processing |
| ReferenceObjectIdentifier | v64.0+; ID of the sales transaction record |

### Polling SalesTransactionFulfillReq

```soql
SELECT Id, Status, AssetizationStatus, DecompositionStatus, PlanExecutionStatus, PlanId
FROM SalesTransactionFulfillReq
WHERE ReferenceObjectIdentifier = '801xx000003GYexAAG'
ORDER BY CreatedDate DESC
LIMIT 1
```

**Terminal states for Status:**
- `Fulfilled` — success
- `Rejected` — rejected at intake (check priority limits or validation)
- `Superseded` — a newer request replaced this one

**Debugging stuck operations:**
1. Query `SalesTransactionFulfillReq` WHERE `Status = 'Fulfilling'` AND `LastModifiedDate < LAST_N_HOURS:2`
2. Check `DecompositionStatus`, `PlanCompositionStatus` fields to find which phase is stuck
3. Review DRO Explainability logs (action logs endpoint)
4. Check `FulfillmentPlan` records linked via `PlanId`
5. If `PlanExecutionStatus = 'Frozen'`, call `freezeSalesTransaction` to inspect PONR details

---

## 5. Fulfillment Priority and Queues

Three priority tiers for DRO intake:

| Priority | Use Case |
|---|---|
| `High` | Urgent/real-time order processing |
| `Default` | Standard business-hours processing |
| `Bulk` | Large-volume batch processing |

**`priorityLimitAction`** controls what happens when priority queue is full:
- `Reject` — returns `submitStatus: "REJECTED"` immediately
- `Downgrade` — falls back to next lower priority tier

**`OrchestrationGroupKey`** — when set, all sales transactions in the same group must be synchronized before any can proceed to orchestration. Useful for multi-order scenarios that must be treated atomically.

---

## 6. Transaction Management Business APIs (Async-Relevant)

All POST-based; some have async responses tracked via platform events.

| API | Version | URI | Notes |
|---|---|---|---|
| Asset Amendment | v62.0 | `/connect/revenue-management/assets/actions/amend` | Requires `InitiateAmend` permission set |
| Asset Cancellation | v62.0 | `/connect/revenue-management/assets/actions/cancel` | Requires `InitiateCancellation` permission |
| Asset Renewal | v62.0 | `/connect/revenue-management/assets/actions/renew` | Requires `InitiateRenewal` permission |
| Clone Sales Transaction | v64.0 | `/connect/rev/sales-transaction/actions/clone` | Supports Quote/Order/Line items |
| Initiate Downgrade | v66.0 | `/revenue/transaction-management/assets/actions/downgrade` | |
| Initiate Swap | v66.0 | `/revenue/transaction-management/assets/actions/swap` | |
| Initiate Upgrade | v66.0 | `/revenue/transaction-management/assets/actions/upgrade` | |
| Place Order (DEPRECATED) | v60.0 | `/commerce/sales-orders/actions/place` | Deprecated v63.0+; use Place Sales Transaction |
| Place Order max line items | — | — | 300 transaction line items maximum |

**Asset Amendment example body:**
```json
{
  "assetIds": ["02iSG0000003NMhYAM", "02iSG0000006DvSYAU"],
  "amendmentStartDate": "2023-10-04T00:00:00",
  "outputRecordType": "Quote",
  "quantityChange": 5
}
```

---

## 7. Billing Invocable Actions (Async-Relevant)

All actions: POST to `/services/data/v67.0/actions/standard/{actionName}`.

### 7.1 Recover Billing Schedules

**URI:** `/services/data/v67.0/actions/standard/recoverBillingSchedules`

Recovers the latest generated invoice associated with billing schedules in `Error` or `Processing` status.

**Input:** `billingScheduleId` (string, Required) — ID of the billing schedule in `Error` or `Processing` status.

**Output:** `successBillingScheduleIds` (string) — Comma-separated list of successfully recovered billing schedule IDs.

**Example request:**
```json
{"inputs": [{"billingScheduleId": "801xx000003JztvAAC"}]}
```
**Example response:**
```json
{
  "outputValues": {
    "successBillingScheduleIds": ["4sFDU00000000652AA", "16Pxx0000004NhAEAU"]
  }
}
```

### 7.2 Send Dunning Email

**URI:** `/services/data/v67.0/actions/standard/blngSendDunningEmail` (v67.0+)

Triggers orchestration to send dunning process emails for collection plans.

**Inputs:**

| Input | Required | Notes |
|---|---|---|
| collectionPlanId | Yes | ID of the collection plan |
| emailTemplateNameOrId | No | Email template name or ID; uses default if not specified |

**Outputs:**

| Output | Notes |
|---|---|
| isDunningEmailSent | boolean; true if sent |
| additionalInformation | Additional response info |

### 7.3 Suspend Billing

**URI:** `/services/data/v67.0/actions/standard/blngSvcSuspendBilling` (v66.0+)

Available where Dispute Management is enabled in Billing.

**Inputs:**

| Input | Type | Notes |
|---|---|---|
| accountId | string | ID of the account to suspend billing for |
| suspensionDate | date | Date when billing must be suspended |
| resumptionDate | date | Optional; date when billing resumes |

**Outputs:** `isSuccess` (boolean, default false), `additionalInformation` (string)

**Example response:** `additionalInformation: "{\"status\":\"Billing suspended successfully\"}"`

### 7.4 Update Bill To Contact

**URI:** `/services/data/v67.0/actions/standard/blngSvcUpdateBillToContact` (v66.0+)

**Inputs:**

| Input | Type | Notes |
|---|---|---|
| invoiceId | string | ID of the invoice |
| newBillToContactId | string | ID of the new Bill To Contact record |
| setAsDefault | boolean (default false) | Set as default for future invoices |

**Outputs:** `isSuccess` (boolean), `additionalInformation` (string)

**Example additionalInformation:** `"{\"status\":\"Success\",\"notes\":\"Default billing contact updated.\"}"`

### 7.5 Unapply Credit

**URI:** `/services/data/v67.0/actions/standard/unapplyCredit` (v62.0+)

Requires Credit Memo Operations User permission set.

**Inputs:**

| Input | Required | Notes |
|---|---|---|
| recordId | Yes | ID of the credit memo invoice application record of type `Applied` |
| effectiveDate | No | Date when credit is unapplied |
| description | No | Additional details |

**Output:** `recordId` — ID of the created record of type `Unapplied`

### 7.6 Unapply Payment

**URI:** `/services/data/v67.0/actions/standard/unapplyPayment` (v64.0+)

Requires Payment Ops permission set.

**Inputs:**

| Input | Type | Required | Notes |
|---|---|---|---|
| recordId | id | Yes | ID of the PaymentLineInvoice or PaymentLineInvoiceLine record of type `Applied` |
| effectiveDatetime | datetime | No | |
| description | string | No | |

**Outputs:**

| Output | Type | Notes |
|---|---|---|
| recordId | id | ID of the created `Unapplied` record |
| unappliedDateTime | datetime | When payment was unapplied |

### 7.7 Void Posted Credit Memo

**URI:** `/services/data/v67.0/actions/standard/voidPostedCreditMemo` (v66.0+)

**Input:** `creditMemoId` (string, Required) — ID of the credit memo in posted status.

**Outputs:**
- `debitMemoId` (string) — ID of the created debit memo record
- `statusUrl` (string) — URL to poll AsyncOperationTracker: `/services/data/v67.0/sobjects/AsyncOperationTracker/{id}`

This is the canonical example of an RC billing action that uses `statusUrl` for async polling.

### 7.8 Write Off Invoices

**URI:** `/services/data/v67.0/actions/standard/writeOffInvoices` (v64.0+)

HTTP method: GET (unusual — retrieves Apex class metadata for the action).

Requires Billing Operations User AND Credit Memo Operations User permission sets.

**Input:** `writeOffInvoiceInputList` (Apex-defined: `InvoiceWriteOff__WriteOffInvoiceInputList`)
**Output:** `writeOffInvoiceResponseList` (Apex-defined: `InvoiceWriteOff__WriteOffInvoiceResponseList`)

---

## 8. Usage Management Invocable Actions

All v63.0+, POST to `/services/data/v67.0/actions/standard/{actionName}`.

| Action | URI Suffix | Required Input | Notes |
|---|---|---|---|
| Invoke Summary Creation | `invokeSummaryCreationService` | `usageEntitlementAccountId` | Triggers usage summary creation for an entitlement account; no outputs |
| Process Consumption Overages | `processConsumptionOverages` | `usageRatableSummaryId` | Processes overages for a ratable summary; no outputs |
| Refresh Usage Entitlement Bucket | `refreshUsageEntitlementBucket` | `transactionUsageEntitlementId` | Refreshes bucket state; no outputs |
| Retrigger Entitlement Creation | `retriggerEntlCreaProc` (v65.0+) | `assetId` | Retriggers the entitlement creation process for an asset; no outputs |

---

## 9. Usage Management Business APIs

| API | Version | Method | URI | Notes |
|---|---|---|---|---|
| Asset Usage Details | v63.0 | GET | `/asset-management/assets/{assetId}/usage-details` | Params: `effectiveDate` (Required), `optionalFields` (AssetRateCardEntry/AssetRateAdjustment) |
| Binding Object Usage Details | v65.0 | GET | `/revenue/usage-management/binding-objects/{bindingObjectId}/actions/usage-details` | Params: `effectiveDate` (Required, yyyy-MM-dd) |
| Consumption Traceabilities | v66.0 | POST | `/revenue/usage-management/consumption/actions/trace` | Body: `liableSummaryIds` (String[], Required) |
| Order Item Usage Details | v63.0 | GET | `/commerce/sales-orders/line-items/{orderItemId}/usage-details` | Params: `effectiveDate` (optional), `optionalFields` |
| Quote Line Item Usage Details | v62.0 | GET | `/commerce/quotes/line-items/{quoteLineItemId}/usage-details` | Params: `effectiveDate` (optional), `optionalFields` |
| Usage Product Validation | v66.0+ | POST | `/revenue/usage-management/usage-products/actions/validate` | |

---

## 10. UsageSummary sObject — Status Lifecycle

`UsageSummary` (v63.0+) tracks async consumption processing state:

| Status | Notes |
|---|---|
| `New` | Just created |
| `UsageSummaryInProgress` | Processing in progress |
| `RatableSummaryComplete` | Ratable summary built |
| `Rated` | Rating complete |
| `LiableSummaryComplete` | Liable summary complete |
| `DrawdownComplete` | Drawdown processed |
| `UsageSummaryComplete` | Fully processed |
| `Inactive` | v65.0+; deactivated |

**Key relationship fields:**
- `UsageEntitlementBucketId` → UsageEntitlementBucket
- `UsageEntitlementAccountId` → UsageEntitlementAccount
- `RatableSummaryId` → UsageRatableSummary
- `LiableSummaryId` → UsageBillingPeriodItem
- `GrantBindingTargetId` → v64.0+; Account/Asset/BindingObjectCustomExt/Contract

---

## 11. Billing Business API Categories and Key Endpoints

### Credits
- `POST /commerce/invoicing/credit-memos/{creditMemoId}/actions/apply` — Apply credit memo to invoice
- `POST /commerce/invoicing/credit-memo-inv-applications/{creditMemoInvApplicationId}/actions/unapply` — Unapply
- `POST /commerce/invoicing/credit-memos/actions/generate` — Create standalone credit memo
- `POST /commerce/invoicing/invoices/{invoiceId}/actions/void` — Void posted invoice
- `POST /commerce/invoicing/invoices/{invoiceId}/actions/convert-to-credit` (p.2549) — Convert negative invoice lines to credit memo
- `POST /commerce/invoicing/invoices/{invoiceId}/actions/credit` (p.2520) — Create and apply credit memo
- `POST /commerce/invoicing/credit/collection/actions/post` (p.2553) — Post draft credit memo
- `POST /commerce/billing/credit-memos/{creditMemoId}/actions/void` (p.2573) — Void credit memo

### Billing Schedules
- `POST /commerce/invoicing/billing-schedules/actions/create` — Create billing schedules for orders
- `POST /commerce/invoicing/standalone/billing-schedules/actions/create` — Standalone billing schedules
- `POST /commerce/invoicing/billing-schedules/collection/actions/recover` — Recover invoices for Error/Processing billing schedules
- `POST /commerce/invoicing/actions/suspend-billing` — Suspend billing
- `POST /commerce/invoicing/actions/resume-billing` — Resume billing

### Invoices
- `POST /commerce/invoicing/invoices/collection/actions/post` — Draft to Posted
- `POST /commerce/invoicing/invoice-batch-runs/{invoiceBatchRunId}/actions/draft-to-posted` — Batch draft to posted
- `POST /commerce/invoicing/invoices/collection/actions/preview` — Preview invoices with estimated tax
- `POST /commerce/invoicing/invoices/collection/actions/ingest` — Ingest invoice from external data
- `POST /commerce/billing/invoices/invoice-batch-docgen/{invoiceBatchRunId}/actions/{actionName}` — Async PDF generation
- `POST /commerce/invoicing/invoices/actions/write-off` — Write-off invoices
- `POST /commerce/invoicing/invoice-batch-runs/actions/send-email` — Send emails for posted invoices
- `POST /commerce/invoicing/invoices/collection/actions/generate` — Generate invoice for account/order/billing schedules
- `POST /revenue/billing/transactions/actions/apply` — Apply payments and credits by rules
- `POST /revenue/billing/document/actions/generate` — Generate invoice document on-demand

### Invoice Scheduler
- `POST/PUT /commerce/invoicing/invoice-schedulers` — Create/update invoice scheduler
- `POST /commerce/invoicing/invoice-batch-runs/{invoiceBatchRunId}/actions/recover` — Recover failed invoice run

### Invoice Sequencing
- `POST /connect/sequences/policy` — Create sequence policy
- `PATCH /connect/sequences/policy/{sequencePolicyId}` — Update sequence policy
- `POST /connect/sequences/actions/assign` — Assign sequence values to records
- `POST /connect/sequences/gap-reconciliation` — Restore missing sequence value (v65.0+)

### Payments
- `POST /commerce/billing/payments/{paymentId}/actions/apply` — Apply payment to invoice
- `POST /commerce/billing/payments/{paymentId}/paymentlines/{paymentLineId}/actions/unapply` — Unapply payment
- `POST /commerce/billing/refunds/{refundId}/actions/apply` — Refund transaction

### Salesforce Commerce Payments API
- `POST /commerce/payments/payment-methods` — Tokenize payment method
- `POST /commerce/payments/sales` — Make payment sale
- `POST /commerce/payments/payments/{paymentId}/refunds` — Create refund
- `POST /commerce/payments/authorizations` — Authorize payment
- `POST /commerce/payments/authorizations/{authorizationId}/reversals` — Reverse authorization
- `POST /commerce/payments/authorizations/{authorizationId}/captures` — Capture payment

### Account Statement
- `POST /revenue/billing/accounts/{accountId}/statement` — Generate account statement with transaction history

---

## 12. Billing Business API Limits

| Operation | Limit | Scale Recommendation |
|---|---|---|
| Billing schedules per Create Invoices By Using Billing Schedules API | 200 | Use Invoice Scheduler to scale to 2000 invoice lines |
| Invoice lines per Create Invoices By Using Billing Schedules API | 200 | Use Invoice Scheduler |
| Billing schedules per Recover Billing Schedule List API | 200 | Follow default limits |
| Invoices per Apply Credit Memos API | 300 | Use API recursively for left-over credits |
| Invoice lines per Apply Credit Memo Lines API | 300 | Use iteratively for every 300 lines |
| Invoices per Create and Apply Credit Memos API | 300 | |
| Credit memo lines (Charge type) per Create Standalone Credit Memo | 300 | |
| Invoice lines per Convert Negative Invoice Lines to Credits API | 300 | Excludes associated tax lines |
| Billing transaction items per Create Billing Schedules for Orders API | 1000 | Supports 1000 order lines as billing schedules |
| Reference IDs per Suspend/Resume Billing API | 200 | |
| Invoice lines per Invoice Draft to Posted Status API | 200 | |
| Records per Invoice Ingestion API | 500 | Includes invoices, lines, taxes, address groups |
| Invoice lines/billing schedules per Invoice Preview API | 200 | |
| Invoice lines per Void a Posted Invoice API | 2000 | |
| Invoices per Posted Invoice List Write-Off API | 300 | |
| Invoice lines per Batch Invoice Scheduler (POST) | 2000 | Supports creation/recovery of up to 2000 lines per invoice |
| Invoice lines per Batch Invoices Draft to Posted Status | 2000 | No limit on number of supported invoices |
| Invoices per Tax Calculation API | 1 | |
| Invoice lines per Tax Calculation API | 500 | Test TaxEngineAdapter against Apex heap size limit |
| Invoice lines per Tax Calculation API with Invoice Creation API | 200 | |
| Invoice lines per Tax Calculation API with Invoice Batch Run API | 2000 | |
| Records per Payment Line Apply API | 1 | Invoice or InvoiceLine based on settlement-level preferences |
| Records per Payment Line Unapply API | 1 | |

---

## 13. Batch Invoice Scheduler Configuration

For high-volume async invoice generation. Request body key fields:

```json
{
  "schedulerName": "InvoiceScheduler",
  "startDate": "2024-05-06",
  "endDate": "2026-05-06",
  "invoiceStatus": "POSTED",
  "preferredTime": "00:45",
  "frequencyCadence": "Daily|Weekly|Once|Monthly",
  "frequencyCadenceOptions": {},
  "timezone": "Asia/Kolkata",
  "status": "Active",
  "filterCriteria": [
    {"operation": "InList", "value": "Batch 2,Batch 3", "criteriaSequence": 1,
     "objectName": "BillingSchedule", "fieldName": "InvoiceRunMatchingValue"},
    {"operation": "Equals", "value": "001xx000003GZG5AAO", "criteriaSequence": 2,
     "objectName": "BillingSchedule", "fieldName": "BillingAccount"}
  ]
}
```

For weekly cadence: `"frequencyCadenceOptions": {"recursOnDay": "Sunday"}`

**PUT** supported in v63.0+ for schedulers with `Draft` or `Inactive` status.

---

## 14. Error Handling for Async RC Operations

### Common Error Patterns

**DRO errors:**
- `DRO_INTERNAL_ERROR` — internal failure; check DRO Explainability logs
- `submitStatus: "REJECTED"` — priority queue full; use `priorityLimitAction: "Downgrade"` or retry later
- `planState: "FAILURE"` — orchestration plan failed; query FulfillmentPlan for step-level errors

**Billing async errors:**
- Billing schedules stuck in `Processing` or `Error` → use Recover Billing Schedules action or `POST /commerce/invoicing/billing-schedules/collection/actions/recover`
- Invoice run in `Processing`, `Void In Progress`, or `Error` → use Invoice Run Recovery: `POST /commerce/invoicing/invoice-batch-runs/{invoiceBatchRunId}/actions/recover`

**Platform event errors:**
- Subscribe to events with `ReplayId: -2` to replay from the earliest retained event
- Use `ReplayId: -1` to receive only new events from subscription time
- Retain the last received `ReplayId` in durable storage to recover from connection drops
- `HasErrors: true` on PlaceOrderCompletedEvent or QuoteToOrderCompletedEvent — inspect nested error detail arrays

### Retry Strategies

1. **Idempotency:** RC invocable actions are generally not idempotent. Check `SalesTransactionFulfillReq` before retrying `decomposeSalesTransaction` to avoid duplicate fulfillment plans.
2. **Exponential backoff for polling:** 2s → 4s → 8s → 16s → 30s (cap)
3. **DRO stuck in Fulfilling:** After 30 minutes, call `getPointOfNoReturn` to check PONR, then contact Salesforce support if the plan remains stuck.
4. **Priority rejection:** If `submitStatus: "REJECTED"`, wait for queue drain or use `fulfillmentPriority: "Bulk"` with `priorityLimitAction: "Downgrade"`.

---

## 15. DRO Configuration sObjects

### ProductFulfillmentScenario (v61.0+)

Maps products to fulfillment step definition groups for DRO routing.

| Field | Notes |
|---|---|
| Action | Multipicklist: `Add`, `Amend`, `Cancel`, `NoChange`, `Renew` |
| ConditionData | textarea JSON for conditional routing (v66.0+) |
| FulfillmentStepDefnGroupId | Reference to the step definition group |
| ProductClassificationId | Product classification reference |
| ProductId | v64.0+, nillable |
| SourceClassIdentifier | v65.0+ |
| SourceIdentifier | v65.0+ |
| UsageType | Picklist: `Fulfillment` (default), `Generic`, `InsuranceRuleAction`, `IntegrationOrchestrator`, `StageManagement` (v66.0+) |

### ValTfrmGrp (Value Transform Group, v61.0+)

Defines mapping rules for value transformation in DRO steps.

| Field | Notes |
|---|---|
| DestinationPrimitiveType | `Boolean`, `Currency`, `Date`, `Datetime`, `Number`, `Percent`, `Text` |
| IsDestinationEnumerated | boolean |
| IsSourceEnumerated | boolean |
| SourcePrimitiveType | Same values as Destination |
| UsageType | `DFOListMapping` only |

### ValTfrm (Value Transform entry, v61.0+)

Individual row in a ValTfrmGrp mapping table.

| Field | Notes |
|---|---|
| InputDate / InputDatetime / InputNumber / InputString | Source value fields |
| InputPicklistValueId | Reference to picklist value |
| IsInputBoolean / IsOutputBoolean | boolean flags |
| OutputDate / OutputDatetime / OutputNumber / OutputString | Target value fields |
| OutputPicklistValueId | |
| ValueTransformGroupId | master-detail → ValTfrmGrp |
| Name | autonumber |

---

## 16. Invoice Sequencing — Async-Relevant APIs

### Sequence Assignment (POST, v65.0+)

**URI:** `/connect/sequences/actions/assign`

Assigns sequence pattern values to objects. Can optionally publish a platform event when a sequence is assigned.

**Request body:**
```json
{
  "targetObjectIds": ["3ttxx00000005nhAAA", "3ttxx00000006bhAAA"],
  "sequencePolicyId": "1Vdxx0000004CFU",
  "shouldPublishPlatformEvent": true
}
```

**Properties:**
- `targetObjectIds` (String[], Required) — Records to assign sequence values to
- `sequencePolicyId` (String, Optional) — Sequence policy to use
- `shouldPublishPlatformEvent` (Boolean, Optional) — Whether to fire a platform event on assignment

### Sequence Gap Reconciliation (POST, v65.0+)

**URI:** `/connect/sequences/gap-reconciliation`

Requires Billing Admin permission set.

**Request body options:**
```json
{"sequencePolicyIds": ["1vdxx0000000abc", "1vdxx0000000def"]}
```
OR:
```json
{"targetObjects": ["Invoice"]}
```
(`targetObjects` valid values: `"Invoice"`, `"CreditMemo"` — CreditMemo available v66.0+)

---

## 17. Monitoring Tools and Governor Limits

### Monitoring

| Tool | Use |
|---|---|
| `SalesTransactionFulfillReq` SOQL | Primary DRO status monitoring; query by ReferenceObjectIdentifier |
| `AsyncOperationTracker` GET | Billing async operation status (via statusUrl) |
| DRO Explainability Action Logs | Step-level DRO diagnosis; GET action log endpoint |
| Platform Event Subscriber | CometD subscription for real-time completion notifications |
| FulfillmentPlan sObject | Query for orchestration plan details and step results |
| Setup > Monitoring > Streaming API Events | Replay and delivery monitoring for platform events |

### Governor Limits for Async RC Operations

| Concern | Limit / Guidance |
|---|---|
| Place Order max line items | 300 transaction line items per call |
| Billing Schedules per Create Invoice API | 200; scale via Invoice Scheduler |
| Invoice lines per Batch Scheduler | 2000 per invoice batch run |
| Tax Calculation API (Invoice Creation) | 200 invoice lines; test TaxEngineAdapter against Apex heap |
| Tax Calculation API (Batch Run) | 2000 invoice lines |
| Apply Credit Memos API | 300 invoices; recurse for remainders |
| Platform event delivery window | Default 72 hours replay retention |
| Synchronous DRO decomposition | Subject to Apex CPU time limit (10s); prefer `Asynchronous` for large orders |
| DRO queue depth | Use `fulfillmentPriority: "Bulk"` for batch workloads; avoids contention with real-time `High` queue |

---

## 18. Integration Patterns

### Webhook / External Callout Pattern for RC Async Completion

RC does not have a native webhook push. The standard pattern:

1. **Subscribe** to the relevant platform event channel via CometD before initiating the action:
   - DRO order completion: subscribe to `PlaceOrderCompletedEvent`
   - Quote-to-order: subscribe to `QuoteToOrderCompletedEvent`
   - Asset creation: subscribe to `CreateAssetOrderEvent`
2. **Initiate** the async action (e.g., `decomposeSalesTransaction`, place order API).
3. **Correlate** using `RequestIdentifier` / `CorrelationIdentifier` from both the action response and the event payload.
4. **On event receipt**, check `HasErrors`/`IsSuccess`; if errors, inspect nested detail arrays.
5. **For external systems**: use Salesforce Outbound Messaging, Flow-triggered actions, or Apex triggers on the relevant sObjects to push completion status to external webhooks.

### CometD Subscription Code Pattern (Apex / JavaScript)

```javascript
// Subscribe with ReplayId for recovery
client.subscribe('/event/PlaceOrderCompletedEvent', function(message) {
  var payload = message.data.payload;
  var correlationId = payload.CorrelationIdentifier;
  var hasErrors = payload.HasErrors;
  var orderId = payload.OrderId;
  // Store ReplayId for recovery
  localStorage.setItem('lastReplayId', message.data.event.replayId);
});

// On reconnect, replay from last known position
client.subscribe('/event/PlaceOrderCompletedEvent',
  { replayFrom: parseInt(localStorage.getItem('lastReplayId')) || -2 },
  callback
);
```

### Instant Pricing (Synchronous)

For synchronous price retrieval without async patterns:

**URI:** `POST /industries/cpq/quotes/actions/get-instant-price` (v60.0+)

Uses `contextId` for pricing context. Returns pricing immediately — no polling required.
