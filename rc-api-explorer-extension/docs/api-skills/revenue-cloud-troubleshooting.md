---
name: revenue-cloud-troubleshooting
description: >
  Comprehensive RC developer troubleshooting reference: error codes, HTTP
  400/500 causes, governor limits, async debugging, pricing failures,
  configuration rule conflicts, billing errors, usage management errors,
  debug logging, known platform limits, and deprecation warnings.
metadata:
  type: reference
  source: Revenue Lifecycle Management Developer Guide v67.0 (Summer 26)
  pages_scanned: 1-30, 127-160, 526-560, 855-890, 1381-1410, 1877-1905, 2040-2065, 2489-2515
  last_updated: 2026-06-13
---

# Source

Revenue Lifecycle Management Developer Guide v67.0 (Summer '26), 2917 pages.
PDF: `/Users/vkumar4/revenue cloud doc/revenue_lifecycle_management_dev_lates.pdf`
Scanned page ranges: 1-30, 127-160, 526-560, 855-890, 1381-1410, 1877-1905, 2040-2065, 2489-2515

---

## RevenueManagementSettings — Feature Flags and Version Constraints

The `RevenueManagementSettings` metadata type controls RC feature activation. Misconfigured flags are a leading cause of "feature not available" errors.

| Field | Default | Available From | Notes / Gotchas |
|---|---|---|---|
| `enableRevenueCloud` | false | — | Master RC switch; must be true before any other flags |
| `enableAdvancedOrderManagement` | false | v57.0 | Required for DRO order orchestration |
| `enableAssetStateManagement` | false | v60.0 | Required for asset amendments/renewals/cancellations |
| `enableUsageManagement` | false | v63.0 | Required for usage entitlements, buckets, summaries |
| `enableBilling` | false | — | Required for all billing invocable actions |
| `enableDisputeManagement` | false | — | Required for Suspend Billing, Update Bill-To-Contact actions |
| `enablePCM` | false | — | Required for all PCM Business API calls |
| `enableProductConfigurator` | false | — | Required for config rule evaluation |
| `enableSalesforcePricing` | false | v63.0 | Required for IndustriesPricingSettings flags |
| `enableCPQ` | false | — | Required for Discovery/CPQ APIs |
| `enableDRO` | false | v64.0 | Required for DRO invocable actions |

**Critical Gotcha:** Many flags have minimum API version requirements. Deploying metadata with a flag set to `true` on an org running an older API version silently ignores the flag — no error is thrown but the feature stays off.

---

## IndustriesPricingSettings — Debug Logging Configuration

| Field | Default | Available From | Purpose |
|---|---|---|---|
| `enableDebugPriceLogs` | false | v63.0 | THE master switch to enable pricing debug logs |
| `enablePricingWaterfall` | false | v63.0 | Logs price breakups per pricing step |
| `enablePricingWaterfallPersistence` | false | v63.0 | Stores process logs for later inspection |

**How to enable RC pricing debug logging:**
1. Deploy `IndustriesPricingSettings` with `enableDebugPriceLogs=true`
2. Optionally enable `enablePricingWaterfall=true` for per-step breakdown
3. Run pricing; logs appear in debug log under `PRICING` category
4. Disable after debugging — persistent waterfall logs grow large quickly

---

## RC-Specific Apex Namespaces and Error Classes

### runtime_industries_cpq Namespace (Product Configurator / CPQ)

| Class | Key Error Properties | Usage |
|---|---|---|
| `ConfigRuleResult` | `errors List<String>` | Contains config rule evaluation error messages |
| `ApiStatusRepresentation` | `statusCode`, `statusMessage`, `messages` | Top-level status from CPQ API calls |
| `BulkProductDetailsRepresentation` | `statusCode`, `statusMessage` on each item | Per-item status in bulk product calls |

**ConfigRuleResult gotcha:** `errors` is non-null but empty on success. Always check `errors.isEmpty()` rather than null-checking before iterating.

### RevSignaling Namespace (Dynamic Revenue Orchestrator)

| Class / Enum | Key Values | Usage |
|---|---|---|
| `RevSignaling.TransactionStatus` | `SUCCESS`, `FAILED` | Check status of async DRO operations |
| `RevSignaling.TransactionRequest` | — | Input to `SignalingApexProcessor` |
| `RevSignaling.TransactionResponse` | `status`, `errorMessage` | Output from processor |
| `RevSignaling.ProcedurePlan` | — | Represents orchestration plan |

**Interface to implement for custom DRO processing:**
```apex
global class MyProcessor implements RevSignaling.SignalingApexProcessor {
    global RevSignaling.TransactionResponse process(RevSignaling.TransactionRequest req) { ... }
}
```

---

## RC-Specific Error Codes

### DRO Invocable Action Error Codes

All DRO standard invocable actions return `submitStatus` and `errorCode` in their output.

| Action | submitStatus Values | Common errorCode Values |
|---|---|---|
| `decomposeSalesTransaction` | `Success`, `Error`, `Submitted`, `Rejected` | `INSUFFICIENT_ACCESS`, `INVALID_ARGUMENT` |
| `freezeSalesTransaction` | via `planState` | See planState table below |
| `orchestrateTransaction` | `Success`, `Error`, `Submitted`, `Rejected` | `INVALID_ARGUMENT`, `NOT_FOUND` |
| `orchestrateSalesTransaction` | `Success`, `Error`, `Submitted`, `Rejected` | `INSUFFICIENT_ACCESS` |
| `submitOrder` | `Success`, `Error`, `Submitted`, `Rejected` | `INVALID_ARGUMENT` |
| `submitSalesTransaction` | `Success`, `Error`, `Submitted`, `Rejected` | `INSUFFICIENT_ACCESS` |

**Freeze Sales Transaction — `planState` values:**

| planState | Meaning |
|---|---|
| `FAILURE` | Plan failed; check `errorCode` |
| `NOTSTARTED` | Plan not yet initiated |
| `PENDING` | Waiting to be processed |
| `COMPLETED` | Successfully completed |
| `FROZEN` | Successfully frozen |
| `INPROGRESS` | Currently processing |

### Transaction Management Platform Event Error Fields

| Event | Error Fields | Notes |
|---|---|---|
| `CreateAssetOrderEvent` | `ErrorCode` (e.g., `INSUFFICIENT_ACCESS`), `ErrorMessage`, `IsSuccess` | Fired during assetization; check `IsSuccess` first |
| `PlaceOrderCompletedEvent` | `IsSuccess`, error detail in payload | **Event Delivery Allocation Enforced = YES** — dropped events are NOT retried automatically |
| `QuoteSaveEvent` | `IsSuccess`, error detail | Fired on quote save completion |
| `QuoteToOrderCompletedEvent` | `QuoteToOrderErrorDetailEvents` list | On failure, iterate `QuoteToOrderErrorDetailEvents` for individual error messages and codes |

**Critical Gotcha for PlaceOrderCompletedEvent:** Because event delivery is enforced, if your platform event trigger or Flow subscriber fails or is inactive, events ARE permanently lost. Monitor delivery failures in Event Manager.

### Usage Management Error Codes

| Error Code | Context | Fix |
|---|---|---|
| `MAX_LIMIT_EXCEEDED` | Usage Product Activation API: more than 1 product per request (v67.0) | Send one product per request |
| `MAX_LIMIT_EXCEEDED` | `activationRequests` list has more than 1 entry | Reduce to exactly 1 entry |
| `MAX_LIMIT_EXCEEDED` | Usage Product Activation: total records (product + child) exceeds 200 | Reduce records per activation request |

**Usage Product Validation API limit:** Maximum 10 `productIds` per request.

### Billing Invocable Action Error Patterns

All billing invocable actions return `isSuccess` (boolean) and `errors` (null on success).

| Action | Key Error Signal | Notes |
|---|---|---|
| `recoverBillingSchedules` | `errors` field in response, `isSuccess=false` | Input billing schedule must be in `Error` or `Processing` status |
| `blngSendDunningEmail` | `isDunningEmailSent=false` | Check `additionalInformation` for detail |
| `blngSvcSuspendBilling` | `isSuccess=false` | Requires Dispute Management enabled |
| `blngSvcUpdateBillToContact` | `isSuccess=false` | Requires Dispute Management enabled |
| `unapplyCredit` | No `isSuccess` — check `recordId` in output | `recordId` in input must be `Applied` status |
| `unapplyPayment` | `errors` field | Input `recordId` must be `Applied` payment line |
| `voidPostedCreditMemo` | `errors: []` on success | Async — check `statusUrl` for operation tracker |
| `writeOffInvoices` | `writeOffInvoiceResponseList` Apex output | Requires Billing Operations User + Credit Memo Operations User perm sets |

---

## Billing Business API Limits

Source: PDF pages 2495-2496.

| API | Limit | Scale Recommendation |
|---|---|---|
| Create Invoices By Using Billing Schedules — billing schedules | 200 | Use Invoice Scheduler (scales to 2000 lines) |
| Create Invoices By Using Billing Schedules — invoice lines | 200 | Use Invoice Scheduler |
| Recover Billing Schedule List | 200 | Follow default limits |
| Apply Credit Memos | 300 invoices | Call recursively for leftover credits after 300 |
| Apply Credit Memo Lines | 300 invoice lines | Call iteratively per 300 lines |
| Create and Apply Credit Memos | 300 invoices | Includes charge + tax line count |
| Create Standalone Credit Memo — Charge lines | 300 | Includes charge + tax line count |
| Convert Negative Invoice Lines to Credits | 300 invoice lines | Excludes associated invoice line taxes |
| Create Billing Schedules for Orders — billing transaction items | 1000 | Supports 1000 order lines as billing schedules |
| Suspend Billing / Resume Billing — reference IDs | 200 | Follow default limits |
| Invoice Draft to Posted Status — invoice lines | 200 | Follow default limits |
| Invoice Ingestion — records | 500 | Includes all invoices, invoice lines, taxes, address groups |
| Invoice Preview — invoice lines or billing schedules | 200 | Follow default limits |
| Void a Posted Invoice — invoice lines | 2000 | Follow default limits |
| Posted Invoice List Write-Off — invoices | 300 | Follow default limits |
| Batch Invoice Scheduler — invoice lines on a single invoice | 2000 | Supports creation or recovery |
| Batch Invoices Draft to Posted Status — invoice lines | 2000 | No limit on number of invoices |
| Tax Calculation — invoices | 1 | One invoice per Tax Calculation call |
| Tax Calculation — invoice lines | 500 | Test TaxEngineAdapter against Apex heap limit |
| Tax Calculation (with Invoice Creation API) — invoice lines | 200 | Test TaxEngineAdapter against Apex heap limit |
| Tax Calculation (with Invoice Batch Run API) — invoice lines | 2000 | Test TaxEngineAdapter against Apex heap limit |
| Payment Line Apply | 1 record | Based on settlement-level preferences |
| Payment Line Unapply | 1 record | Based on settlement-level preferences |

---

## PCM Business API Limits and Common Errors

Source: PDF pages 127-160.

| Constraint | Value | Error if Exceeded |
|---|---|---|
| `pageSize` parameter | 1-100 (required) | HTTP 400 if outside range or omitted |
| `recordIds` list | max 20 IDs | HTTP 400 |
| `catalogSystems` filter | exactly 1 value allowed | HTTP 400 if multiple values passed |
| Product index error endpoint | `GET /connect/pcm/index/error` | Use to inspect index rebuild failures |

**PCM Filtering Operators by Data Type:**

| Operator | Supported Data Types |
|---|---|
| `EQUALS`, `NOT_EQUALS` | String, Boolean, Number, Date |
| `GREATER_THAN`, `LESS_THAN`, `GREATER_OR_EQUAL`, `LESS_OR_EQUAL` | Number, Date |
| `CONTAINS`, `NOT_CONTAINS`, `STARTS_WITH` | String only |
| `IN`, `NOT_IN` | String, Number |

---

## Governor Limits Affecting Revenue Cloud

### Pricing (Salesforce Pricing / Headless Pricing)

| Limit Area | Risk | Mitigation |
|---|---|---|
| CPU time (10s sync / 60s async) | Pricing procedures with complex formulas or large datasets | Use async invocable action via Flow; split large pricing batches |
| Heap size (6MB sync / 12MB async) | `pricingData` payload size | Keep `pricingData` lean; avoid including unused fields |
| SOQL queries (100 sync / 200 async) | Pricing procedures that query rate cards, price books | Run pricing async; use Queueable/Batch context |
| DML statements (150) | Pricing waterfalls that write step results | Disable `enablePricingWaterfallPersistence` in high-volume scenarios |

### Product Configurator

| Limit Area | Risk | Mitigation |
|---|---|---|
| CPU time | Config rules with large sets (hundreds of options) | Profile in sandbox; simplify rule sets |
| SOQL queries | Config rules that query related objects | Pre-load data in rule expressions; avoid SOQL in rule conditions |
| Heap size | BulkProductDetailsRepresentation with large catalogs | Use pagination; limit `pageSize` |

### Transaction Management / DRO

| Limit Area | Risk | Mitigation |
|---|---|---|
| DML (150) | Assetization processing large orders | Use async DRO; monitor `SalesTransactionFulfillReq.Status` |
| CPU time | `orchestrateTransaction` with many order items | Set `orchestrationType` to `Fulfillment` or `Billing` (not Generic) to limit processing scope |
| Platform Event delivery | `PlaceOrderCompletedEvent` dropped | Event Delivery Allocation Enforced = YES — monitor Event Manager |

### Usage Management

| Limit Area | Risk | Mitigation |
|---|---|---|
| DML | `invokeSummaryCreationService` processing many accounts | Call one `usageEntitlementAccountId` per invocation |
| CPU | `processConsumptionOverages` on large ratable summaries | Call action after `SummaryComplete` status is confirmed |
| SOQL | Querying `UsageSummary` with broad filters | Add `StartDateTime`, `EndDateTime`, `Status` filters |

### Billing

| Limit Area | Risk | Mitigation |
|---|---|---|
| Heap size | `TaxEngineAdapter` implementation with 500-line invoice | Test against Apex heap limit; use Invoice Batch Run API (2000-line limit) |
| CPU time | Invoice generation for large orders (1000+ billing schedules) | Use Batch Invoice Scheduler; do not use direct Create Invoices API for large orders |
| Platform Event throughput | `InvoiceBatchRun` processing | Use `invoice-batch-runs/{invoiceBatchRunId}/actions/recover` endpoint for failed runs |

---

## Debugging Async Operations

### DRO Async Debugging Pattern

```
1. Call DRO invocable action (e.g., orchestrateTransaction)
2. Capture requestId from output
3. Query SalesTransactionFulfillReq WHERE Id = requestId
   - Check Status (AssetizationStatus, DecompositionStatus, Status fields)
   - Check for error messages in related fields
4. If status = Error/Failed:
   - Use "Retrieve Sales Transaction API Errors" endpoint:
     GET /services/data/v67.0/connect/revenue/sales-transactions/{salesTransactionId}/errors
   - Errors grouped by correlationId UUID for cross-component tracing
5. Enable debug log for async Apex class (Queueable/Batch context):
   - Set log level FINEST for classes in RevSignaling namespace
```

**SalesTransactionFulfillReq Status Picklists:**

| Field | Values |
|---|---|
| `AssetizationStatus` | `NotStarted`, `InProgress`, `Completed`, `Failed` |
| `DecompositionStatus` | `NotStarted`, `InProgress`, `Completed`, `Failed` |
| `Status` | `NotStarted`, `InProgress`, `Completed`, `Failed`, `PartiallyCompleted` |

### Usage Management Async Debugging

| Action | Failure Scenario | Debug Approach |
|---|---|---|
| `invokeSummaryCreationService` | Returns `isSuccess: true` but summaries not created | Check `UsageSummary` records for `Status = UsageSummaryInProgress`; expired billing period triggers auto-update |
| `processConsumptionOverages` | Overages not calculated | Confirm `UsageSummary.Status = SummaryComplete` before calling |
| `refreshUsageEntitlementBucket` | Bucket not refreshed | Verify `transactionUsageEntitlementId` is valid and active |
| `retriggerEntlCreaProc` | Asset entitlement not created | Use for assets in failed asset-to-entitlement journey; verify asset exists with `assetId` |

**Retrigger Entitlement Creation — when to use:**
- Asset failed during asset-to-entitlement journey
- Asset exists in Salesforce but has no corresponding Usage Management records (no wallet, no entitlement bucket)
- Introduced in v65.0; requires Usage Management Run Time User permission

### Billing Async Debugging

```
1. After billing action completes asynchronously, check:
   - voidPostedCreditMemo returns statusUrl pointing to AsyncOperationTracker
   - Poll: GET /services/data/v67.0/sobjects/AsyncOperationTracker/{trackerId}
   - Check Status field for completion
2. For failed invoice batch runs:
   - BillingSchedule status = Error or Processing
   - Call: POST /commerce/invoicing/billing-schedules/collection/actions/recover
   - Or use recoverBillingSchedules invocable action with billingScheduleId
3. For failed invoice runs (batch):
   - POST /commerce/invoicing/invoice-batch-runs/{invoiceBatchRunId}/actions/recover
   - Required when billing schedules remain in Processing, Void In Progress, or Error status
```

---

## Pricing Failure Diagnosis

### Run Salesforce Headless Pricing — Output Fields for Debugging

| Output Field | Type | Meaning |
|---|---|---|
| `pricingProcessStatus` | String | `Success` or `Failure` |
| `pricingProcessErrors` | String | Error detail when status is `Failure` |
| `pricingResult` | String | JSON pricing output on success |
| `executionId` | String | Unique ID for this pricing execution; use for log correlation |

**Critical Gotcha — pricingData escaping:**
- When calling via REST API: `pricingData` MUST be escaped (double-serialized JSON)
- When used in Flow (as variable): `pricingData` must NOT be escaped
- Mixing these causes silent failures where pricing returns success but output is malformed

### Common Pricing Setup Failures

| Symptom | Likely Cause | Fix |
|---|---|---|
| `pricingProcessStatus = Failure` with no clear error | `PricingRecipe` has `isActive = false` | Set `isActive = true` and redeploy |
| Pricing runs but returns zero prices | `PricingActionParameters.objectName` mismatch | Verify `objectName` matches the actual object: `Opportunity`, `Quote`, `Order`, `Contract`, `Case`, `SalesAgreement`, or `WorkOrder` |
| Pricing procedure not found | `PricingActionParameters.developerName` incorrect | Check exact developer name in Setup > Pricing Procedures |
| Tax not calculated | `TransactionProcessingType.TaxPreference = "Skip"` | Remove Skip or set to `Calculate`; created via POST to `/services/data/v67.0/tooling/sobjects/TransactionProcessingType` |
| Pricing not calculated | `TransactionProcessingType.PricingPreference = "Skip"` | Remove Skip setting |
| Empty `pricingResult` in Flow | `pricingData` incorrectly escaped in Flow context | Use raw JSON variable, not serialized string |
| Waterfall logs not persisting | `enablePricingWaterfallPersistence = false` | Enable in `IndustriesPricingSettings` |
| `ProcedureOutputResolution` formula errors | Encoded formula invalid | Use Setup UI to edit; formula is stored encoded and cannot be manually authored |

### PricingRecipe Metadata Required Fields

```xml
<!-- .pricingRecipe suffix -->
<masterLabel>My Recipe</masterLabel>
<isActive>true</isActive>  <!-- MUST be true or pricing silently skips -->
<pricingRecipeTableMapping>...</pricingRecipeTableMapping>
```

### PricingActionParameters Required Fields

```xml
<!-- .pricingActionParameters suffix -->
<contextDefinition>...</contextDefinition>
<contextMapping>...</contextMapping>
<developerName>MyPricingProcedure</developerName>
<effectiveFrom>2024-01-01</effectiveFrom>
<masterLabel>My Action Parameters</masterLabel>
<objectName>Quote</objectName>  <!-- Must match: Opportunity/Quote/Order/Contract/Case/SalesAgreement/WorkOrder -->
```

---

## Configuration Rule Conflict Debugging

### ConfigRuleResult Error Patterns

```apex
// Evaluating configuration rules:
runtime_industries_cpq.ConfigRuleResult result = configurator.evaluate(context);
if (!result.errors.isEmpty()) {
    for (String err : result.errors) {
        System.debug('Config rule error: ' + err);
    }
}
// result.errors is List<String> — iterate even when checking for conflicts
```

### Common Configuration Rule Failure Causes

| Symptom | Cause | Fix |
|---|---|---|
| Rules not firing at all | Product Configurator feature flag off | Enable `enableProductConfigurator` in `RevenueManagementSettings` |
| Rules fire but produce wrong output | Conflicting include/exclude rules on same attribute | Review rule priority order; later rules override earlier rules |
| `ConfigRuleResult.errors` has "FIELD_NOT_FOUND" | Attribute API name in rule references deleted/renamed field | Update rule to reference current field API name |
| Rule evaluation timeout | Too many nested conditions or SOQL in rule expression | Simplify conditions; pre-compute complex lookups |
| Rules evaluate correctly in sandbox but fail in prod | Decision tables not refreshed post-deployment | Run "Refresh Decision Tables" in Setup after deploying |
| Config rule changes not taking effect | Old cached version | Clear product index: POST to `/connect/pcm/index/configurations`, then GET `/connect/pcm/index/error` to check rebuild status |

---

## Common Setup Issues (Missing Permissions / Metadata)

### Required Permission Sets by Feature

| Feature | Permission Set(s) Required |
|---|---|
| Usage Management (all invocable actions) | `Usage Management Run Time User` |
| Billing (general) | `Billing Operations User` |
| Credit Memo operations | `Credit Memo Operations User` |
| Billing sequence admin (gap reconciliation, sequence assignment) | `Billing Admin` |
| DRO orchestration | `Revenue Cloud User` or custom with DRO API perms |
| PCM APIs | `Revenue Cloud User` + PCM API enabled in connected app |
| Pricing debug | `IndustriesPricingSettings` metadata access (admin only) |
| Dispute Management (Suspend/Resume Billing) | Dispute Management enabled in org + Billing Ops User |
| Dunning email (Send Dunning Email action) | Enterprise/Unlimited/Developer edition, Revenue Cloud enabled |

### Post-Deployment Required Steps

After deploying RC metadata, these steps are MANDATORY or features will silently fail:

1. **Refresh Decision Tables** — required after deploying any decision table or config rule metadata
2. **Sync Pricing Data** — required after deploying `PricingRecipe` or `PricingActionParameters`
3. **Rebuild Product Index** — required after bulk PCM product changes; monitor via `GET /connect/pcm/index/error`
4. **Activate PricingRecipe** — `isActive` defaults to `false`; must be set to `true` post-deploy
5. **Activate Rate Plans** — Rate plans deploy as Draft; must be activated manually or via API
6. **GUID Fields** — Custom objects used with RC must have a `GUID__c` field (Text 255, Unique + External ID); missing GUID fields cause silent record linkage failures

### Missing Metadata Checklist

```
Symptom: "Feature not available" or 404 on RC endpoints
Check:
[ ] RevenueManagementSettings.enableRevenueCloud = true
[ ] Feature-specific flag enabled (e.g., enableUsageManagement)
[ ] Permission set assigned to running user
[ ] Connected app has RC API scopes

Symptom: Pricing returns empty results
Check:
[ ] IndustriesPricingSettings.enableSalesforcePricing = true
[ ] PricingRecipe isActive = true
[ ] PricingActionParameters objectName matches record type
[ ] Post-deploy "Sync Pricing Data" was run

Symptom: Config rules not evaluating
Check:
[ ] RevenueManagementSettings.enableProductConfigurator = true
[ ] Decision tables refreshed post-deploy
[ ] Product index rebuilt

Symptom: Billing schedules stuck in Processing/Error
Check:
[ ] Call recoverBillingSchedules invocable action
[ ] Or POST to /commerce/invoicing/billing-schedules/collection/actions/recover
[ ] Check billing schedule status in SOQL

Symptom: Usage entitlements not created after assetization
Check:
[ ] RevenueManagementSettings.enableUsageManagement = true
[ ] Asset has UsageModelType set on Product2 record
[ ] If asset stuck: call retriggerEntlCreaProc action (v65.0+)
```

---

## RC Debug Log Topics and Recommended Log Levels

### Enabling Pricing Debug Logs via Metadata

```xml
<!-- IndustriesPricingSettings -->
<IndustriesPricingSettings>
    <enableDebugPriceLogs>true</enableDebugPriceLogs>
    <enablePricingWaterfall>true</enablePricingWaterfall>
    <enablePricingWaterfallPersistence>true</enablePricingWaterfallPersistence>
</IndustriesPricingSettings>
```

### Recommended Debug Log Levels by RC Component

| Component | Category | Recommended Level |
|---|---|---|
| Salesforce Pricing | `PRICING` | `FINEST` for procedure step tracing |
| Product Configurator | `APEX_CODE` | `FINEST` for config rule evaluation |
| DRO / RevSignaling | `APEX_CODE` | `FINE` for orchestration flow; `FINEST` for detailed |
| Transaction Management | `CALLOUT` | `INFO` for platform event tracing |
| Usage Management invocable actions | `APEX_CODE` | `FINE` |
| Billing invocable actions | `APEX_CODE` | `FINE` |
| PCM API calls | `CALLOUT` | `INFO` |

### Correlating RC Events Across Components

RC uses a `correlationId` UUID that flows across components:
- Set `correlationId` in request headers for all Connect API calls
- `correlationId` appears in platform event payloads
- Use `correlationId` to join log lines from PCM → Pricing → Config → TM → DRO → Billing

---

## Asset Amendment / Cancellation / Renewal Restrictions

| Scenario | Restriction | Error if Violated |
|---|---|---|
| Asset Amendment with usage products | Cannot use direct-to-order flow | Must use two-step: 1) create Amendment Quote, 2) then Order |
| Asset Cancellation | All assets in request must belong to the same price book | HTTP 400 if mixed price books |
| Asset Renewal | Asset must have `AssetStateManagement` enabled | Feature unavailable error |
| Asset Downgrade/Swap/Upgrade | Requires `enableAssetStateManagement = true` | HTTP 400 or feature unavailable |

---

## Known Platform Limitations

| Limitation | Details | Workaround |
|---|---|---|
| Usage Product Activation — 1 product per request (v67.0+) | `activationRequests` list accepts only 1 entry | Loop calls, one per product |
| Usage Product Activation — max 200 records total | Product + all child records (grants, policies, UOM, rate cards) must be ≤ 200 | Split large products across multiple activations |
| Usage Product Validation — max 10 productIds | Validation API accepts max 10 IDs per call | Batch in groups of 10 |
| Binding Object Usage Details — available from v65.0 | API unavailable before v65.0 | Use Asset Usage Details API (v63.0) instead for asset-bound objects |
| Asset Usage Details — does NOT return binding target rates | API only returns asset rates | Use Binding Object Usage Details API for binding target rates |
| PCM catalogSystems filter — single value only | Passing multiple values causes HTTP 400 | Issue separate requests per catalog system |
| PricingData in Flow — must NOT be escaped | Flow variable auto-handles serialization | Do not JSON.serialize pricingData before passing to Flow |
| TaxEngineAdapter heap usage | 500 invoice lines (Tax Calc API), 200 lines (Invoice Creation API) | Test adapter against heap limit; use batch run APIs for large invoices |
| DRO Freeze Sales Transaction — v64.0+ minimum | Not available pre-v64.0 | N/A |
| DRO Orchestrate Sales Transaction — v67.0+ minimum | Not available pre-v67.0 | Use orchestrateTransaction (v66.0+) |
| DRO Get Point Of No Return — v64.0+ minimum | Not available pre-v64.0 | N/A |
| Billing Suspend/Resume — requires Dispute Management | Feature flag check at runtime | Enable Dispute Management in RevenueManagementSettings |
| Invoice sequence gaps — cannot self-heal | Missing sequence values require explicit reconciliation | POST to `/connect/sequences/gap-reconciliation` with `sequencePolicyIds` OR `targetObjects` (not both) |
| Void Posted Credit Memo — asynchronous | Returns `statusUrl` immediately; credit memo voiding happens async | Poll `AsyncOperationTracker` using `statusUrl` |

---

## Deprecation Warnings

| Deprecated / Restricted | Replacement / Notes |
|---|---|
| `orchestrateTransaction` (generic type) in some flows | Prefer `orchestrateSalesTransaction` (v67.0+) for sales flows |
| Manual SOQL on `UsageSummary` without status filter | Always filter by `Status` — `Inactive` added in v65.0, old queries miss deactivated summaries |
| Direct DML on RC managed objects (UsageEntitlementBucket, etc.) | Use invocable actions (`refreshUsageEntitlementBucket`) instead of direct DML |
| Old billing recovery pattern (manual BillingSchedule DML) | Use `recoverBillingSchedules` invocable action or Connect REST API recovery endpoint |

---

## Important Notes and Gotchas

1. **Feature flag deployment order matters.** If you deploy `RevenueManagementSettings` with `enableBilling=true` but `Billing` app is not provisioned in the org, the flag is accepted but ignored silently. Always verify feature availability in Setup before relying on flags.

2. **`pricingData` escaping is the #1 pricing integration bug.** REST callers must escape; Flow variables must NOT be escaped. A single escaped JSON string inside a Flow produces a blank `pricingResult` with no error.

3. **PCM `pageSize` is required, not optional.** Omitting `pageSize` from PCM list APIs returns HTTP 400. This differs from most Salesforce APIs where pagination is optional.

4. **PlaceOrderCompletedEvent delivery is enforced.** If your subscriber (Flow or Apex trigger) is paused, deactivated, or throws an unhandled exception, the event is permanently lost. Design subscribers to be idempotent and always active.

5. **Asset cancellation: mixed price books.** If you attempt to cancel assets from different price books in a single request, the API returns HTTP 400 with no partial success. Split into separate requests per price book.

6. **Post-deployment steps are not optional.** Decision tables, pricing recipes, and product indexes are not automatically refreshed on metadata deploy. Omitting these steps is the #1 cause of "works in sandbox, fails in prod" bugs.

7. **UsageSummary Status field expanded in v65.0.** The `Inactive` picklist value was added in API v65.0. SOQL queries written before v65.0 that filter `Status NOT IN ('Inactive')` will silently return inactive summaries if the field value wasn't available when the query was written. Add explicit status filters.

8. **Invoice sequence gap reconciliation requires EITHER `sequencePolicyIds` OR `targetObjects`, never both.** Passing both returns an error. This is a common copy-paste mistake.

9. **Usage Product Activation rollback is atomic per product.** If any record for a product fails to activate, ALL records for that product are rolled back. Child records activate in dependency order — child never activates before parent.

10. **`correlationId` is a UUID — generate it fresh per top-level request.** Reusing a correlationId across separate business transactions makes log analysis impossible. Always generate a new UUID for each independent API call chain.

11. **DRO `orchestrationType` scoping.** Setting `orchestrationType = Generic` processes all orchestration steps. Use `Fulfillment` or `Billing` to restrict scope and reduce CPU usage when you only need one phase.

12. **Billing Tax Calculation API is 1 invoice at a time.** Do not attempt to batch multiple invoices in a single Tax Calculation API call — limit is 1 invoice. Use the Invoice Batch Run API for bulk tax calculation.
