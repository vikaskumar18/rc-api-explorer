---
name: revenue-cloud-usage-developer
description: Revenue Cloud Usage Management Developer Guide — entitlements, buckets, summaries, rating, overages — PDF (2026-06-13)
metadata:
  type: reference
---

# Revenue Cloud Usage Management Developer Guide

## Source
PDF: revenue_lifecycle_management_dev_lates.pdf (2917 pages)
Pages: 2040–2105
Scanned: 2026-06-13

---

## Usage Entitlement Structure

Usage Management organizes entitlements in a hierarchy:

- **UsageEntitlementAccount** — the account-level container that holds all usage entitlement state for a billing period. The `invokeSummaryCreationService` action takes `usageEntitlementAccountId` as its only input.
- **TransactionUsageEntitlement** — the runtime record created when an asset is assetized; links the asset to product-level grants and drives bucket creation. `grantDetail.id` in grant detail responses points to the TransactionUsageEntitlement record.
- **UsageEntitlementBucket** — the per-resource, per-period container tracking how much of a granted quantity has been consumed. One bucket per resource per validity period.
- **ProductUsageGrant / LineItemUsageResourceGrant** — design-time records defining quantity, unit of measure, refresh policy, and rollover policy for a resource at the product or order-line level. Grant type value: `Grant`.
- **UsageResource** — the sellable unit of usage (e.g., "SF Credits", "API Calls", "GB"). Linked to a `Product2` whose `UsageModelType` identifies the usage model.

Key relationship fields on `UsageSummary`:
- `UsageEntitlementAccountId` — account holding the entitlement
- `UsageEntitlementBucketId` — bucket being summarized
- `AssetId` — asset associated with the entitlement
- `AccountId` — account associated with the sellable product
- `GrantBindingTargetId` — polymorphic; the object the grant is bound to (Account, Asset, BindingObjectCustomExt, Contract). Available API v64.0+.
- `ParentUsageSummaryId` — parent summary (hierarchical summaries, API v65.0+)
- `RatableSummaryId` — links to `UsageRatableSummary` for rating
- `LiableSummaryId` — links to `UsageBillingPeriodItem` for billing

---

## Bucket Types & Fill Logic

### Bucket Creation
Buckets are created automatically during the **asset-to-entitlement journey** when an asset is assetized. The `RetriggerEntitlementCreationProcess` action (`/actions/standard/retriggerEntlCreaProc`) re-runs this for failed or unprocessed assets. Use it to:
- Process failed assets in the asset-to-entitlement journey
- Assetize or create wallets for assets without corresponding Usage Management records

### Bucket Refresh
The **Refresh Usage Entitlement Bucket** action (`/actions/standard/refreshUsageEntitlementBucket`) refreshes entitlements by:
1. Evaluating current `UsageEntitlementBucket` records
2. Creating a new `UsageEntitlementEntry`

Input: `transactionUsageEntitlementId` — ID of the `TransactionUsageEntitlement` associated with the buckets to refresh.

### Bucket Policies
Each bucket is governed by policies configured on `ProductUsageResource` or overridden at the binding-object level:
- **UsageRefreshPolicy** — controls when/how the bucket quantity resets (e.g., monthly)
- **UsageRolloverPolicy** — controls whether unused balance rolls into the next period
- **ValidityPeriodTerm + ValidityPeriodUnit** — define the duration of a single bucket (e.g., 1 Month)
- **DrawdownOrder** — controls which buckets are consumed first (e.g., `ExpiringFirst`)

### Binding Instance Types
Rate card entries carry `bindingInstanceType`:
- `Self` — the resource is consumed by the same asset that owns the grant
- `Target` — the resource is consumed by a bound target asset/account/contract

---

## Summary Creation Flow

### Three Summary Types
The **Invoke Summary Creation** action (`/actions/standard/invokeSummaryCreationService`) creates up to three linked summary records per entitlement-per-period:

1. **UsageSummary** (status: `New` → progression through states) — aggregates transaction journal entries for a usage entitlement for a specified period. Available API v63.0+.
2. **UsageRatableSummary** — the intermediate record used during the rating phase. `RatableSummaryId` on `UsageSummary` links here.
3. **UsageBillingPeriodItem** (the "liable summary") — the billing-facing record. `LiableSummaryId` on `UsageSummary` references `UsageBillingPeriodItem`.

### Trigger
Call `POST /services/data/v67.0/actions/standard/invokeSummaryCreationService` with:
```json
{
  "inputs": [{ "usageEntitlementAccountId": "<ID>" }]
}
```
The service also checks and updates the billing period of the usage entitlement account if the billing period is expired. Summaries are created even when the usage amount is zero.

### Accumulation Method & Period
`UsageSummary` carries:
- `UsageAccumulationMethod` — `Peak` or `Sum`
- `UsageAccumulationPeriod` — `Daily` or `Monthly`

---

## Liable Summary & Billing Integration

### What Is the Liable Summary?
The **liable summary** is the `UsageBillingPeriodItem` record that billing consumes to generate overage charges. It is linked from `UsageSummary.LiableSummaryId` (relationship name: `LiableSummary`, refers to `UsageBillingPeriodItem`).

### Overage Flow Into Billing
1. Summaries reach `UsageSummaryComplete` status.
2. `Process Consumption Overages` action is called (`POST /services/data/v67.0/actions/standard/processConsumptionOverages`) with `usageRatableSummaryId`.
3. This action uses the entitlement service to calculate overages and create `UsageEntitlementEntry` records.
4. The liable summary captures `OverageUnits` and `DebitedUnits` that billing picks up to generate invoice line items.

### Consumption Traceability for Billing
The Consumption Traceabilities API (`POST /revenue/usage-management/consumption/actions/trace`) provides a complete breakdown of overage charges and resource drawdown per invoice line. Input: array of `liableSummaryIds`. Full response shape:
```json
{
  "success": true,
  "data": {
    "assets": [{
      "assetId": "ASSET1",
      "usageEntitlementAccountId": "1EA000000000001",
      "grantBindingTargetId": "1GB000000000001",
      "billingPeriods": [{
        "startDate": "2025-01-01",
        "endDate": "2025-01-31",
        "resources": [{
          "liableSummaryId": "1HG000000000001",
          "usageResourceId": "1BX000000000004",
          "usageResourceName": "SF Credits",
          "usageResourceUomUnitCode": "CREDIT",
          "resourceTotalOverageQuantity": 333.33,
          "resourceTotalOverageAmount": 333.33,
          "resourceTotalConsumption": 1500,
          "rateAndConsumptionSources": [{
            "startDate": "2025-01-01",
            "endDate": "2025-01-31",
            "ratableSummaryId": "URS3",
            "ratingExecutionId": "1RE000000000001",
            "overageQuantity": 333.33,
            "overageAmount": 333.33,
            "totalConsumption": 1500,
            "netUnitRate": 1,
            "consumptionSources": [
              {"consumptionSourceId": "1AE000000000001", "consumptionUnit": 500},
              {"consumptionSourceId": "1CO000000000001", "consumptionUnit": 375,
               "commitRate": 1.5, "targetRate": 2, "cmtAssetRatableSummaryId": "URSCARID1"}
            ]
          }]
        }]
      }]
    }]
  },
  "error": null
}
```

---

## Usage Product Activation

### What Activation Does
The **Usage Product Activation** API (`POST /revenue/usage-management/usage-products/actions/activate`, available v67.0) activates a usage product and all its related design-time records in a single atomic request:
- Usage resources
- Product usage grants
- Usage policies (refresh, rollover, overage, commitment, aggregation, rating frequency)
- Units of measure and unit of measure classes
- Rate card entries

### Key Constraints
- Each request activates exactly **one product** (one entry in `activationRequests`). More than one returns `MAX_LIMIT_EXCEEDED`.
- Maximum **200 records** total per request (product + all child records). Exceeding this returns `MAX_LIMIT_EXCEEDED`.
- Records stay in `Draft` status until activation runs. If any record fails, **all activations for that product are rolled back**.
- Records activate in dependency order — a child never activates before its parent.
- `shouldValidateProductSetup` (Boolean, default `true`) — run validation before activation.

### Request Body
```json
{
  "shouldValidateProductSetup": false,
  "activationRequests": [{
    "productId": "01txx000000006i2gAAA",
    "usageResourceIds": ["0hUxx000000001", "0hUxx000000002"]
  }]
}
```
`usageResourceIds` is optional — if omitted, all usage records for the product are activated. Activation extends to all design-time records linked to these resources: product usage grants, usage policies, units of measure, units of measure classes, and rate card entries.

### Validation (Pre-Activation Check)
`POST /revenue/usage-management/usage-products/actions/validate` (v66.0) validates cross-object relationships and business rules for up to 10 product IDs, with optional date range filters (`startDate`, `endDate`).

### Activation Error Shape (`UsageActivationError`)
```json
{
  "productUsageResourceId": "0iUxx0000000678",
  "usageResourceId": "0hUxx000000004",
  "message": "Related Unit of measure records is inactive, activate it first.",
  "objectApiName": "ProductUsageGrant",
  "fieldName": "DefaultUnitofMeasure",
  "recordId": "1BXSM00000404f4AA",
  "recordName": "PUG-000000001"
}
```

---

## Consumption Tracing

### Consumption Source Detail
Each unit of consumption is traced back to a `consumptionSourceId` (the object on which consumption was recorded) and a `consumptionUnit` (recorded quantity).

For commitment products, additional fields appear:
- `commitRate` — net unit rate at which drawdown is done for commitment products
- `targetRate` — input unit rate used for commitment products
- `cmtAssetRatableSummaryId` — ID for querying the rating waterfall (links to commitment ratable summary)

### Trace API
`POST /revenue/usage-management/consumption/actions/trace`
- Input: `liableSummaryIds: String[]` (required)
- Response: `ConsumptionTraceabilities` — full breakdown by asset, billing period, resource, rate segment, and individual consumption source

### Resource Detail Fields (in trace response)
- `liableSummaryId` / `liableSummaryStatus`
- `usageResourceId`, `usageResourceName`, `usageResourceUomId`, `usageResourceUomUnitCode`
- `resourceTotalConsumption`, `resourceTotalOverageQuantity`, `resourceTotalOverageAmount`
- `rateAndConsumptionSources[]` — breakdown per rate segment

---

## Overage Calculation Logic

### Where Overage Is Computed
The **Process Consumption Overages** action (`processConsumptionOverages`) operates on `UsageRatableSummary` records with `SummaryComplete` status. It:
1. Reads the `UsageRatableSummary` identified by `usageRatableSummaryId`
2. Uses the entitlement service to compute how much consumption exceeds granted quantity
3. Creates `UsageEntitlementEntry` records reflecting the drawdown
4. Populates `OverageUnits` on the `UsageSummary`

### OverageUnits on UsageSummary
`OverageUnits` (Double) — the quantity that was overused by the usage entitlement bucket. This field is the authoritative overage figure for billing.

### Rate and Consumption Source Detail
Per rate segment in the traceability response:
- `overageQty` — quantity of consumption rated as overage
- `overageAmt` — amount for the overage quantity
- `totalConsumption` — total consumption for this rate period
- `netUnitRate` — the effective unit rate applied
- `ratableSummaryId` — the `UsageRatableSummary` driving this segment
- `ratableSummaryStatus` — status of the ratable summary
- `ratingExecutionId` — execution ID of the rating run

### chargeForOverages Flag
Rate card entries expose `chargeForOverages` (String): `Yes`, `No`, `NA`. This controls whether overage charges are generated for a given resource at all.

---

## Wallet Concept

### What Is a Wallet?
A **wallet** is the prepaid entitlement model in Usage Management. When a customer purchases a commitment product (Monetary Commitment, Quantity Commitment, or Token Commitment), a wallet record is created to hold the prepaid balance.

- `UsageModelType` values indicating wallet/commitment products on `Product2`:
  - `Monetary Commitment` — customer commits to spend a minimum monetary amount (API v65.0+)
  - `Quantity Commitment` — customer commits to use a minimum quantity (API v65.0+)
  - `Token Commitment` — customer commits to use a minimum token quantity (API v65.0+)
  - `Anchor` — main subscription product; can have Pack add-ons (API v62.0+)
  - `Pack` — add-on that grants additional usage resources (API v62.0+)

### Wallet Creation
The `RetriggerEntitlementCreationProcess` action creates wallet records for assets that do not yet have corresponding Usage Management records (in addition to processing failed assetization).

### Commitment Rate Fields in Traceability
When consumption draws from a commitment wallet, `consumptionSources` entries include:
- `commitRate` — the net drawdown rate for commitment products
- `targetRate` — the input unit rate for commitment products
- `cmtAssetRatableSummaryId` — links back to the ratable summary for the commitment tranche

### isOptional Field
`isOptional` (Boolean, v65.0+) on rate card entries indicates whether the product usage resource is optional when the associated product is one of the commitment usage model types.

---

## Binding Object vs Asset

### Binding Object
A **binding object** is the record to which usage grants are bound and against which consumption is tracked. Supported types:
- `Account`
- `Asset`
- `BindingObjectCustomExt` (custom extension)
- `Contract`

The `GrantBindingTargetId` field on `UsageSummary` (API v64.0+) is a polymorphic reference to Account, Asset, BindingObjectCustomExt, or Contract.

### Binding Object Usage Details API
`GET /revenue/usage-management/binding-objects/{bindingObjectId}/actions/usage-details` (v65.0) returns grants, resources, rates, and configured policies for a binding object. Supported binding objects: Account, Contract, BindingObjectCustomExt, or Anchor Asset not bound to a target.

Use this API during the selling journey to display details for a binding object, and after assetization to display details on selected binding objects. Query parameter `effectiveDate` (yyyy-MM-dd) is required.

### Binding Instance Type
Rate card entries carry `bindingInstanceType`:
- `Self` — the resource and grant are on the same object
- `Target` — the grant is on a parent/container; the target object draws it down

`bindingInstanceTargetType` — type of the target object (e.g., `Product`, `Account`).

### Key Distinction from Asset
- An **Asset** is a Salesforce standard object representing a purchased product instance.
- A **binding object** is the logical consumption anchor — it can be an asset, an account, a contract, or a custom extension object.
- Asset Usage Details API does NOT return binding target rates. Use Binding Object Usage Details API for pool-level rates.

---

## Usage Rating Waterfall

### Rating Flow Overview
1. Consumption events are ingested and recorded against a usage entitlement.
2. The `UsageSummary` is created (status: `New`) by `invokeSummaryCreationService`.
3. The summary progresses to `UsageSummaryInProgress`, then `RatableSummaryComplete` when the ratable summary is ready.
4. Rating executes against the `UsageRatableSummary`. The `ratingExecutionId` tracks each rating run.
5. Upon completion the summary moves to `Rated`, then `DrawdownComplete`, then `LiableSummaryComplete`, then `UsageSummaryComplete`.

### Rate and Consumption Source Detail Fields
Key fields per rate segment:
- `startDate` / `endDate` — the rate period window
- `ratableSummaryId` — `UsageRatableSummary` driving this segment
- `ratingExecutionId` — execution ID of the rating
- `netUnitRate` — effective unit rate (after adjustments)
- `rateUomId` / `rateUomName` — currency UOM (e.g., USD)
- `sourceUsageResourceId` / `sourceUsageResourceName` — source resource
- `totalConsumption` — total consumption for this segment
- `overageQty` / `overageAmt` — overage quantity and amount
- `consumptionSources[]` — per-source breakdown (id + units)

### Rate Card Entry Fields (in Usage Details responses)
- `rate` — base overage rate
- `negotiatedRate` — user-overridden overage rate
- `negotiatedRateAdjustments[]` — tier adjustments (lowerBound, upperBound, type, value)
- `rateCardEntryId` — base + tier rate card entry IDs (comma-separated)
- `rateUnitOfMeasureName` — rate currency
- `unitOfMeasure` — grant UOM (e.g., GB)
- `chargeForOverages` — Yes / No / NA
- `bindingInstanceTargetType` — target object type
- `bindingInstanceType` — Self / Target

### Rate Derivation Rule
In Usage Details API responses:
- If `negotiable` property is blank → data is derived from **Product Catalog Management**
- If `negotiable` is not blank (`Negotiable` or `Non-Negotiable`) → data is derived from **Rate Management**

---

## Summary States & Transitions

`UsageSummary.Status` picklist (all values):

| Status | Description |
|---|---|
| `New` | Summary just created; no processing started |
| `UsageSummaryInProgress` | Summary processing has begun |
| `RatableSummaryComplete` | Ratable summary has been generated and is ready for rating |
| `Rated` | Rating has completed |
| `DrawdownComplete` | Entitlement bucket drawdown has been applied |
| `LiableSummaryComplete` | Liable summary (billing period item) has been finalized |
| `UsageSummaryComplete` | Full processing complete; summary is ready for billing |
| `Inactive` | Summary is inactive (API v65.0+) |

### Overage Processing Trigger
`processConsumptionOverages` operates only on ratable summaries with `SummaryComplete` status. Calling it on summaries in any other state has no effect.

---

## Common Activation Failures

### Error Code: EFFECTIVITY_MISMATCH
```
"PUR and RCE effective date ranges must have overlap for proper rating functionality"
```
Cause: The ProductUsageRule (PUR) effective dates do not overlap with the Rate Card Entry (RCE) effective dates. Fix: align date ranges so they share at least one overlapping day.

### Error: Unit of Measure Inactive
```
"Related Unit of measure records is inactive, activate it first."
objectApiName: "ProductUsageGrant"
fieldName: "DefaultUnitofMeasure"
```
Cause: The UOM referenced by the grant is in Draft/Inactive status. Fix: activate the UOM record before activating the product.

### Error: Usage Resource Not Found
```
"Usage Resource not found for product"
objectApiName: "ProductUsageResource"
fieldName: "UsageResourceId"
```
Cause: The `usageResourceIds` specified in the activation request do not match any `ProductUsageResource` linked to the product. Fix: verify the IDs or omit `usageResourceIds` to activate all.

### Error: VALIDATION_FAILED
```
"Product validation completed with cross-entity errors"
errorCode: "VALIDATION_FAILED"
```
Returned when `shouldValidateProductSetup: true` and cross-object validation finds errors. The `products[]` array in the response contains per-product `validationErrors` and `validationWarnings`.

### Error: MAX_LIMIT_EXCEEDED
Returned when:
- More than one product is included in `activationRequests`
- The total record count (product + all child records) exceeds 200

### Error: INVALID_API_INPUT
```json
{
  "errorCode": "INVALID_API_INPUT",
  "message": "Liable summary IDs cannot be null or empty."
}
```
Returned by the Consumption Traceabilities API when `liableSummaryIds` is empty or null.

---

## sObject Reference

### UsageResourceBillingPolicy
- `Code` (string) — unique user-defined code
- `Name` (string) — policy name
- `Status` (picklist) — `Active`, `Draft`, `Inactive`
- `UsageAccumulationMethod` (picklist) — `Peak` or `Sum`
- `UsageAccumulationPeriod` (picklist) — `Daily` or `Monthly`
- Associated objects: `UsageResourceBillingPolicyFeed`, `UsageResourceBillingPolicyHistory`

### UsageSummary
Represents the aggregation of transaction journal entries for a usage entitlement for a specified period. Available API v63.0+.

Supported Calls: `create()`, `delete()`, `describeLayout()`, `describeSObjects()`, `getDeleted()`, `getUpdated()`, `query()`, `retrieve()`, `search()`, `undelete()`, `update()`, `upsert()`

Key fields:

| Field | Type | Description |
|---|---|---|
| `AccountId` | reference → Account | Account associated with the sellable product |
| `AssetId` | reference → Asset | Asset associated with the entitlement |
| `ConsumptionUnits` | double | Quantity used by the entitlement bucket |
| `DebitedUnits` | double | Units debited from the associated bucket |
| `EndDateTime` | dateTime | End date/time of the summary period |
| `GrantBindingTargetId` | reference (polymorphic) | Bound record: Account, Asset, BindingObjectCustomExt, Contract (v64.0+) |
| `LiableSummaryId` | reference → UsageBillingPeriodItem | Billing period item for this summary |
| `Name` | string (autonumber) | Auto-generated identifier |
| `OverageUnits` | double | Quantity overused by the bucket |
| `OwnerId` | reference → Group, User | Owner (polymorphic) |
| `ParentUsageSummaryId` | reference → UsageSummary | Parent summary (v65.0+) |
| `RatableSummaryId` | reference → UsageRatableSummary | Ratable summary for rating |
| `StartDateTime` | dateTime | Start date/time of the summary period |
| `Status` | picklist | See Summary States table above |
| `UomId` | reference → UnitOfMeasure | UOM override for the usage resource (overrides default in associated UOM class) |
| `UsageAccumulationMethod` | picklist | `Peak` or `Sum` (defaulted on create) |
| `UsageAccumulationPeriod` | picklist | `Daily` or `Monthly` (nullable) |
| `UsageEntitlementAccountId` | reference → UsageEntitlementAccount | Account holding the entitlement |
| `UsageEntitlementBucketId` | reference → UsageEntitlementBucket | Bucket being summarized |
| `UsageResourceId` | reference → UsageResource | Source usage resource |

Associated objects: `UsageSummaryHistory`, `UsageSummaryOwnerSharingRule`, `UsageSummaryShare`

### Usage Management Fields on Product2

`UsageModelType` (picklist, restricted, nillable):
- `Anchor` — main subscription product (API v62.0+)
- `Pack` — add-on granting additional usage resources (API v62.0+)
- `Monetary Commitment` — minimum spend commitment (API v65.0+)
- `Quantity Commitment` — minimum quantity commitment (API v65.0+)
- `Token Commitment` — minimum token commitment (API v65.0+)

---

## Standard Invocable Actions Reference

All actions require **Usage Management Run Time User** permission. Available in Enterprise, Developer, and Unlimited Editions where Usage Management is enabled.

| Action | URI | Input | Description | Version |
|---|---|---|---|---|
| Invoke Summary Creation | `POST /actions/standard/invokeSummaryCreationService` | `usageEntitlementAccountId` | Creates usage, ratable, and liable summaries; updates expired billing periods | 63.0 |
| Process Consumption Overages | `POST /actions/standard/processConsumptionOverages` | `usageRatableSummaryId` | Processes overages for SummaryComplete ratable summaries; creates entitlement entries | 63.0 |
| Refresh Usage Entitlement Bucket | `POST /actions/standard/refreshUsageEntitlementBucket` | `transactionUsageEntitlementId` | Evaluates bucket records, creates new entitlement entry | 63.0 |
| Retrigger Entitlement Creation | `POST /actions/standard/retriggerEntlCreaProc` | `assetId` | Re-runs asset-to-entitlement for failed/unprocessed assets; creates wallets | 65.0 |

---

## Business API Resources Reference

| Resource | HTTP | Description | Version |
|---|---|---|---|
| `/asset-management/assets/{assetId}/usage-details` | GET | Usage details (grants, resources, rates) for an asset | 63.0 |
| `/commerce/sales-orders/line-items/{orderItemId}/usage-details` | GET | Usage details for an order item | 63.0 |
| `/commerce/quotes/line-items/{quoteLineItemId}/usage-details` | GET | Usage details for a quote line item | 62.0 |
| `/revenue/usage-management/binding-objects/{bindingObjectId}/actions/usage-details` | GET | Usage details (grants, resources, rates, policies) for a binding object | 65.0 |
| `/revenue/usage-management/consumption/actions/trace` | POST | Consumption traceability breakdown for liable summaries | 66.0 |
| `/revenue/usage-management/usage-products/actions/activate` | POST | Activate a usage product and all related records | 67.0 |
| `/revenue/usage-management/usage-products/actions/validate` | POST | Validate cross-object relationships and business rules | 66.0 |

### Usage Details Query Parameters
- `effectiveDate` (String) — required for asset/order/quote GET; date used to find applicable rate card entries
- `optionalFields` (String[], optional) — custom fields from rate adjustment objects (e.g., `AssetRateCardEntry`, `AssetRateAdjustment`, `OrderItemRateCardEntry`, `QuoteLineRateCardEntry`, `QuoteLineRateAdjustment`)

Note: Asset/order/quote usage-details APIs do NOT return binding target rates. Use the Binding Object Usage Details API for binding-target-level rates.

---

## Key API Version History

| Feature | API Version |
|---|---|
| UsageSummary, base invocable actions (create summaries, process overages, refresh bucket) | 63.0 |
| Quote Line Item Usage Details GET | 62.0 |
| Asset / Order Item Usage Details GET | 63.0 |
| GrantBindingTargetId on UsageSummary | 64.0 |
| Retrigger Entitlement Creation Process, Binding Object Usage Details GET, ParentUsageSummaryId, Inactive status, Commitment UsageModelTypes, isOptional | 65.0 |
| Consumption Traceabilities POST, Usage Product Validation | 66.0 |
| Usage Product Activation | 67.0 |

---

## Important Notes & Gotchas

1. **One product per activation call (v67.0).** The `activationRequests` array accepts exactly one entry. Multiple entries return `MAX_LIMIT_EXCEEDED` immediately. Design orchestration to loop one product at a time.

2. **200-record ceiling per activation.** Count all records in the activation graph: product + all ProductUsageResources + all ProductUsageGrants + all UsagePolicies + all UOMs + all RateCardEntries. If total exceeds 200, split into multiple products or reduce scope via `usageResourceIds`.

3. **Atomic rollback on any activation failure.** If any child record fails, all records for that product are rolled back. Use `shouldValidateProductSetup: true` (default) to catch errors pre-activation. Check `UsageActivationError.message` — common cause is an inactive related UOM.

4. **LiableSummaryId vs RatableSummaryId are different objects.** `RatableSummaryId` → `UsageRatableSummary` (used during rating). `LiableSummaryId` → `UsageBillingPeriodItem` (used by billing). `processConsumptionOverages` takes `usageRatableSummaryId`; `consumption/actions/trace` takes `liableSummaryIds`.

5. **processConsumptionOverages only works on SummaryComplete ratable summaries.** The action silently does nothing if the ratable summary status is not `SummaryComplete`. Always check status before calling.

6. **GrantBindingTargetId is polymorphic and v64.0+.** It can point to Account, Asset, BindingObjectCustomExt, or Contract. API versions below 64.0 return null.

7. **Asset Usage Details API does not return binding target rates.** Use Binding Object Usage Details API for pool/binding-target-level rates. The two APIs serve different scopes.

8. **`negotiable` field drives rate derivation.** Blank → rates from Product Catalog Management. Not blank (`Negotiable`/`Non-Negotiable`) → rates from Rate Management.

9. **ParentUsageSummaryId is v65.0+.** Hierarchical summary structures only available from v65.0.

10. **Retrigger action creates wallets too.** `retriggerEntlCreaProc` is not only for failed assetizations — it also creates wallet records for commitment products that have no corresponding Usage Management record yet.

11. **invokeSummaryCreationService creates zero-amount summaries.** The action creates summaries even when usage amount is zero. This is intentional so billing periods advance correctly in months with no consumption.

12. **UomId on UsageSummary overrides the class default.** The `UomId` field overrides the default unit of measure defined in the associated unit of measure class.

13. **cmtAssetRatableSummaryId is the rating waterfall key.** Each commitment consumption chunk may reference a different ratable summary (different tier/rate card). Use this ID to trace which ratable summary was applied per consumption tranche.

14. **EFFECTIVITY_MISMATCH** means PUR and RCE effective date ranges do not overlap. Both must share at least one overlapping day for rating to function. This is the most common validation error in usage product setup.

15. **drawdownOrder: "ExpiringFirst"** is the most common drawdown policy — buckets expiring soonest are consumed first. Set at `BindingObjectResourcePolicy.drawdownOrder`.

16. **invokeSummaryCreationService is safe to run on expired billing periods.** It detects and updates expired billing periods on the usage entitlement account as part of the same call — no need to pre-update the billing period.
