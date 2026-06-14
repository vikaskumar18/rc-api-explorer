---
name: revenue-cloud-pricing-developer
description: Revenue Cloud Pricing Developer Guide — Concepts & Patterns — Revenue Cloud Developer Guide PDF (2026-06-13)
metadata:
  type: reference
---

# Revenue Cloud Pricing Developer Guide

Sourced from: Revenue Lifecycle Management Developer Guide PDF, pages 667–840 (Salesforce Pricing sObjects + Business APIs, API v60.0–v67.0).

---

## 1. Core Pricing Data Model Overview

### Pricing Layer Hierarchy

```
PriceBook2 (catalog)
  └── PriceBookEntry (product + selling model + price)
        └── PriceBookEntryDerivedPrice (derived/calculated override)

PriceAdjustmentSchedule (volume/tiered discount rule)
  └── PriceAdjustmentTier (individual tier: range + discount)

AttributeBasedAdjRule + AttributeBasedAdjustment (attribute-driven pricing)
BundleBasedAdjustment (bundle-level pricing)

CostBook + CostBookEntry (cost tracking)
ContractItemPrice (contract-level price override)
```

### Key sObjects Quick Reference

| sObject | API Version | Purpose |
|---|---|---|
| PriceBook2 | Standard | Price catalog container |
| PriceBookEntry | Standard | Product price in a catalog |
| PriceBookEntryDerivedPrice | v61.0+ | Calculated price override for a PBE |
| PriceAdjustmentSchedule | Standard | Volume/tiered discount schedule |
| PriceAdjustmentTier | Standard | Single tier within a schedule |
| AttributeBasedAdjRule | Standard | Rule for attribute-driven adjustments |
| AttributeBasedAdjustment | Standard | Adjustment record tied to attribute rule |
| BundleBasedAdjustment | Standard | Adjustment for bundle products |
| CostBook | Standard | Cost tracking catalog |
| CostBookEntry | Standard | Per-product cost in a cost book |
| ContractItemPrice | Standard | Contract-specific price |
| ProductSellingModel | Standard | Pricing model (OneTime/Evergreen/TermDefined) |
| ProductSellingModelOption | Standard | Junction: Product2 + ProductSellingModel |
| ProrationPolicy | v67.0+ | Proration rules for partial periods |
| PricingTerm / PricingTermUnit | Standard | Subscription term dimensions |
| PriceRevisionPolicy | v65.0+ | CPI/flat price revision rule |
| PricingAdjBatchJob | v62.0+ | Bulk price update job |
| PricingAdjBatchJobLog | v62.0+ | Failed records from batch job |
| PricingAPIExecution | v63.0+ | Pricing resolution record |
| PricingProcedureResolution | v60.0+ | Selects pricing procedure |
| PricingProcessExecution | v63.0+ | Execution log per API call |
| ProductPriceHistoryLog | v62.0+ | Historical pricing data |
| ProductPriceRange | v62.0+ | Price range per product/selling model |
| ProcedurePlanCriterion | v67.0+ | Rule-based criteria for procedure plan options |
| IndexRate | v65.0+ (extended) | Region + UsageType=Pricing fields for price indexing |

---

## 2. PriceBookEntry and PricebookEntryDerivedPrice

### PriceBookEntry — POST body

```json
{
  "ProductSellingModelId": "0jPxx0000000005EAA",
  "Product2Id": "01tLT00000A0YTlYAN",
  "IsActive": true,
  "Pricebook2Id": "01s1W000000SYXNQA4",
  "UnitPrice": "100.00"
}
```

**Key fields:**
- `UnitPrice` — base list price
- `ProductSellingModelId` — links to OneTime / Evergreen / TermDefined model
- `IsActive` — must be true for pricing engine to use the entry

### PriceBookEntryDerivedPrice

Used when a PBE's price is derived from another product (e.g., a bundle component inheriting its price from the parent). Response body includes:
- `productId` — source product
- `pricebookEntryId` — the PBE being overridden
- `effectiveFrom` / `effectiveTo` — date range for the derived price
- `isSuccess` / `error` — success flag and any error details
- `sourceProceductId` — ID of the source product driving the derivation

---

## 3. Price Adjustment Schedules and Tiers

### PriceAdjustmentSchedule Fields

| Field | Values / Notes |
|---|---|
| ScheduleType | `Volume` (default), `Attribute`, `Bundle`, `Custom`, `Term` |
| AdjustmentMethod | `Range` or `Slab` |
| TierType | `AdjustmentAmount`, `AdjustmentPercentage`, `OverrideAmount` |

### AdjustmentMethod Behavior

**Range** — All items in the cart get the discount of the highest tier the total quantity qualifies for.
- Example: Tiers at 1-10 (5%), 11-50 (10%). If quantity=15, all 15 units get 10% off.

**Slab** — Each item gets the discount of the tier it individually falls into.
- Example: Tiers at 1-10 (5%), 11-50 (10%). If quantity=15, first 10 units get 5%, next 5 units get 10%.

### PriceAdjustmentTier — Critical Rules

- `UpperBound` is **NOT inclusive** — set it 1 higher than the desired max value.
  - Tier covering 1–10 units: set `LowerBound=1`, `UpperBound=11`
- The last tier's `UpperBound` is optional (open-ended).
- **No gaps allowed** between tiers — tier ranges must be contiguous.
- **No overlaps allowed** between tiers.

### Tier Example (Volume Discount)

```
Tier 1: LowerBound=1,  UpperBound=6,   AdjustmentPercentage=5
Tier 2: LowerBound=6,  UpperBound=11,  AdjustmentPercentage=10
Tier 3: LowerBound=11, UpperBound=null, AdjustmentPercentage=15
```

---

## 4. Attribute-Based and Bundle-Based Adjustments

### AttributeBasedAdjRule / AttributeBasedAdjustment

- `AttributeBasedAdjRule` defines WHICH attributes trigger a price adjustment (e.g., Color=RED → 10% surcharge).
- `AttributeBasedAdjustment` is the actual adjustment record linked to the rule.
- Used in pricing waterfall as `AttributeBasedDiscount` pricingComponentType.

### BundleBasedAdjustment

- Applies discounts at the bundle level.
- `ParentProductId` — immediate parent bundle product.
- `RootBundleId` — root of the bundle hierarchy (top-level structural root).
- Used in pricing waterfall as `BundleBasedDiscount` pricingComponentType.

---

## 5. ProductSellingModel and Proration

### ProductSellingModel

| Field | Values |
|---|---|
| PricingModelType | `Evergreen`, `OneTime`, `TermDefined` |
| Status | `Active`, `Draft` (default), `Inactive` |

### ProductSellingModelOption

Junction object linking `Product2` to `ProductSellingModel`:
- `Increment` / `Minimum` / `Maximum` — term unit constraints
- `IsDefault` — marks the default selling model for the product
- `ProrationPolicyId` — links to proration rule (v67.0+)

### ProrationPolicy (v67.0+)

| Field | Values / Notes |
|---|---|
| ArePartialPeriodsAllowed | Boolean |
| ProrationPolicyType | `StandardTimePeriods` |
| RemainderStrategy | How fractional periods are handled |

### PricingTerm / PricingTermUnit

Used on subscription line items to define the term:
- `PricingTerm` — integer (e.g., 12)
- `PricingTermUnit` — `Months`, `Quarterly`, `Semi-Annual`, `Annual`

---

## 6. Pricing Procedure (ExpressionSet)

A **Pricing Procedure** is stored internally as an **ExpressionSet**. This is the core pricing logic engine that executes a sequence of pricing steps.

### How It Works

1. Pricing API receives a request with `pricingProcedureId` (which is an ExpressionSet record ID).
2. The procedure evaluates each step in sequence — each step can read context variables, apply adjustments, and write output variables.
3. The output of each step feeds into the next.
4. Final output includes `NetUnitPrice`, `Subtotal`, and any custom output tags defined in the Context Definition.

### Pricing Procedure Resolution

`PricingProcedureResolution` (v60.0+) selects WHICH pricing procedure to run from the available list. The `PricingProcedureId` field references the ExpressionSet. Resolution happens before execution.

---

## 7. Procedure Plan Definitions

Procedure Plans orchestrate WHICH expression sets run for which business processes (pricing, discovery, billing, etc.).

### Procedure Plan Definition

```json
{
  "description": "Definition for Quote",
  "developerName": "Quote_Definition_Sample",
  "name": "Quote_Definition_Sample",
  "processType": "Default",
  "primaryObject": "BusinessHours",
  "procedurePlanDefinitionVersions": [
    {
      "active": false,
      "contextDefinition": "SalesTransactionContext__stdctx",
      "readContextMapping": "QuoteEntitiesMapping",
      "saveContextMapping": "QuoteEntitiesMapping",
      "effectiveFrom": "2024-07-15T10:15:30.000Z",
      "developerName": "Quote_Definition_V1",
      "rank": 1
    }
  ]
}
```

**processType values** (v63.0+):
- `Billing`
- `DRO`
- `DeepClone`
- `ProductDiscovery`
- `Revenue Cloud`
- Default: `Default`

### Procedure Plan Version

A version of the plan definition. Once `active=true`, the version becomes **immutable** — you cannot edit or delete it.

**Key fields:**
- `active` — Boolean; true = immutable, live version
- `contextDefinition` — context definition developer name
- `effectiveFrom` / `effectiveTo` — date range when version is effective
- `rank` — execution sequence (lower rank runs first)
- `readContextMapping` — reads data from mapped object into context
- `saveContextMapping` — writes context data back to mapped object
- `procedurePlanSections` — array of sections (see below)

### Procedure Plan Sections

Each section maps a `sectionType` to a procedure (expression set):

**sectionType values:**
- `PricingProcedure`
- `ProductDiscoveryProcedure`
- `ProductQualificationProcedure`
- `PricingDiscoveryProcedure`
- `DiscountSpreadServiceProcedure`
- `RatingProcedure`
- `Custom`
- `RatingDiscoveryProcedure`

**Section constraints:**
- The combination of `sectionType` + `subSectionType` must be unique per procedure plan version.
- `sequence` must be greater than 0 and unique within a version.
- Can edit/delete a section only if NOT associated with an active version.

### Procedure Plan Option Input

```json
{
  "saveContextMapping": "AssetToSalesTransactionMapping",
  "expressionSetDefinition": "9QAZ60000004EC0OA2",
  "expressionSetLabel": "Revenue_Default_Pricing_Procedure",
  "expressionSetApiName": "Revenue Default Pricing Procedure",
  "logic": "1 AND 2 AND 3",
  "priority": 1,
  "procedurePlanCriterion": [
    {
      "conditionSequence": 1,
      "fieldObject": "BillingCountry",
      "fieldPath": "BillingCountry",
      "literalValue": "test",
      "operator": "Equals",
      "dataType": "Text"
    },
    {
      "conditionSequence": 2,
      "fieldObject": "BillingPostalCode",
      "fieldPath": "BillingPostalCode",
      "literalValue": "sample",
      "operator": "Equals",
      "dataType": "Text"
    }
  ],
  "resolutionType": "RuleBased",
  "sectionType": "PricingProcedure",
  "sequence": 1,
  "subSectionType": "PricingProcedure"
}
```

### ProcedurePlanCriterion (v62.0+, sObject also v67.0+)

Rule-based criteria for selecting a procedure plan option:

| Field | Required | Notes |
|---|---|---|
| `conditionSequence` | Required | Must be unique within the option |
| `dataType` | Required | Data type of the field (Text, Date, etc.) |
| `fieldObject` | Required | sObject field; max 2 levels up in hierarchy from primary object |
| `fieldPath` | Required | Path ending with the criterion field |
| `literalValue` | Optional | Value to compare against |
| `operator` | Required | `Equals`, `GreaterThan`, `GreaterThanOrEquals`, `In`, `IsNotNull`, `IsNull`, `LessThan`, `LessThanOrEquals`, `NotEquals`, `NotIn` |
| `recordId` | Required | ID of the criterion record |

### Procedure Plan Evaluation

To evaluate which procedure plan definitions apply:

```json
{
  "idList": ["a01DU000000BylcYAC"],
  "evaluationDate": "2024-07-08T10:15:30.000Z",
  "processType": "Default",
  "sectionType": ["PricingProcedure"],
  "subSectionType": ["Revenue"]
}
```

Or by definition name (without `idList`):
```json
{
  "evaluationDate": "2024-07-08T10:15:30.000Z",
  "processType": "Default",
  "sectionType": ["PricingProcedure"],
  "subSectionType": ["Revenue"]
}
```

---

## 8. Pricing Recipe

A Pricing Recipe maps decision tables (lookup tables) to a pricing procedure. It tells the pricing engine WHICH data tables to use for which pricing components.

### Recipe Structure

```json
{
  "recipeId": "12Gxx0000005J9MEAU",
  "pricingRecipeLookUpTableInputRepresentations": [
    {"lookupId": "12Gxx0000005J9MEAU", "pricingComponentType": "CustomDiscount"},
    {"lookupId": "...", "pricingComponentType": "VolumeDiscount"},
    {"lookupId": "...", "pricingComponentType": "ListPrice"}
  ],
  "pricingRecipeProcedureInputRepresentation": {"procedureId": "9QLxx0000004C92GAE"}
}
```

### pricingComponentType Values

- `ListPrice` — base list price table (isInternal=true)
- `VolumeDiscount` — volume-based discount table (isInternal=true)
- `AttributeBasedDiscount` — attribute-driven discount table
- `BundleBasedDiscount` — bundle discount table
- `CustomDiscount` — custom discount table (isInternal=false)

### Recipe Response

```json
{
  "recipes": [{
    "active": false,
    "createdBy": "autoproc@00dxx0000006gmjea2",
    "createdOn": "2023-07-15T13:12:38.000Z",
    "decisionTables": [
      {"id": "01Dxx00000000T3EAI", "isInternal": true, "pricingComponentType": "ListPrice"},
      {"id": "01Dxx00000000T4EAI", "isInternal": true, "pricingComponentType": "VolumeDiscount"},
      {"id": "01Dxx00000000H1EAI", "isInternal": false, "pricingComponentType": "CustomDiscount"}
    ],
    "developerName": "NGPDefaultRecipe",
    "id": "12Gxx0000005Ka4EAE",
    "name": "NGPDefaultRecipe",
    "procedureId": "",
    "procedureName": ""
  }]
}
```

**API endpoint:** `POST /connect/core-pricing/recipe/mapping`

---

## 9. Context Definition and Mapping

Every pricing API call requires a Context Definition and Context Mapping. These tell the pricing engine how to map your request data to the internal pricing tags.

### Required Fields in Pricing Request

```json
{
  "contextDefinitionId": "11Oxx0000006PdxEAE",
  "contextMappingId": "11jxx0000004LDDAA2",
  "jsonDataString": { ... },
  "pricingProcedureId": "9QMxx0000004CKKGA2"
}
```

### jsonDataString Structure

The `jsonDataString.businessObjectType` must match the sObjects configured in context mappings:

```json
{
  "Cart": [{
    "id": "cart_1001",
    "PriceBookId": "PriceBookId_1001",
    "businessObjectType": "Cart",
    "CartItem": [{
      "id": "lineItem_1001",
      "Quantity": 7,
      "PriceType": "OneTime",
      "product_id": "01txx0000006i44AAA",
      "UnitPrice": 6.8,
      "NetUnitPrice": 0,
      "Attribute": [{"name": "Color", "code": "RED", "isPriceImpacting": true}]
    }]
  }]
}
```

### dataPath in Responses

The response uses `dataPath` to identify which element each result belongs to:
- If `jsonDataString` has `Cart[id=Cart1]` with `CartItem[id=CartItem1]`, then the data route is `["Cart1", "CartItem1"]`.
- This is the path from the root node through nested objects.

---

## 10. configurationOverrides Flags

All flags are optional. Pass in the `configurationOverrides` object:

| Flag | Type | Default | Description |
|---|---|---|---|
| `skipWaterfall` | Boolean | false | Skip waterfall log generation (improves performance) |
| `useSessionScopedContext` | Boolean | false | Use session-scoped context (reuse across calls) |
| `persistContext` | Boolean | false | Persist context data after execution |
| `referenceKey` | String | null | Custom key for searching logs in Pricing Operations Console |
| `displayContext` | Boolean | false | Include context data in response |
| `taggedData` | Boolean | false | Include tagged data in response |
| `isHighVolumeLineItems` | Boolean | false | Enable for 100+ line items (parallel execution) |
| `skipDiscovery` | Boolean | false | Skip discovery phase |

```json
{
  "configurationOverrides": {
    "skipWaterfall": true,
    "useSessionScopedContext": true,
    "persistContext": true,
    "referenceKey": "referenceKey-12345",
    "displayContext": false,
    "taggedData": false,
    "isHighVolumeLineItems": false
  }
}
```

---

## 11. Pricing Waterfall

The pricing waterfall is the step-by-step record of everything the pricing engine did to calculate a price. Each step captures inputs, outputs, the pricing element that ran, and its sequence.

### Waterfall Structure

Each waterfall entry:

```json
{
  "fieldToTagNameMapping": {
    "Product2Id": "ItemProduct",
    "Subtotal": "Subtotal",
    "Pricebook2Id": "Pricebook",
    "Quantity": "ItemQuantity",
    "LineItemId": "SalesTransactionSource",
    "ListPrice": "ItemListPrice"
  },
  "inputParameters": {
    "Product2Id": "01txx0000006144AAA",
    "Pricebook2Id": "01sxx0000005g9xAAA",
    "Quantity": 5,
    "LineItemId": "item1",
    "InputUnitPrice": 10
  },
  "outputParameters": {
    "Subtotal": 50,
    "ListPrice": 10
  },
  "pricingElement": {
    "adjustments": [
      {"AdjustmentValue": "95.00", "AdjustmentType": "Amount"}
    ],
    "elementType": "ListPrice",
    "name": "List Price",
    "description": null
  },
  "sequence": 1
}
```

### Waterfall Element Types

Common `elementType` values seen in waterfall:
- `ListPrice` — base price from PriceBookEntry
- `VolumeDiscount` — volume tier discount
- `DerivedPricing` — price derived from another product
- `AttributeBasedDiscount` — attribute-driven adjustment
- `BundleBasedDiscount` — bundle pricing adjustment
- `CustomDiscount` — custom discount step

### Waterfall with Advanced Logging

When Advanced Logging is enabled (Setup > Salesforce Pricing), the waterfall response includes `diagnosticData`:

```json
{
  "output": {
    "NetUnitPrice": 20,
    "TotalSubscriptionPrice": 40,
    "Subtotal": 40,
    "diagnosticData": {
      "lineItemId": "0QLSG0000001OXv84AG",
      "exceptionDetails": {},
      "inputParams": {
        "ContributingNetUnitPrice": [100],
        "DerivedFormula": ["PERCENTAGE(ListPrice,10)", "PERCENTAGE(ListPrice,10)"],
        "Subtotal": 40,
        "Quantity": 2,
        "ContributingScope": ["NonTransactional", "Transactional"],
        "isDerivedProcessed": true,
        "IsDerived": true,
        "NetUnitPrice": 20
      },
      "contributorCount": 2,
      "contributingLines": [
        {
          "ContributingNetUnitPrice": 100,
          "DerivedFormula": "PERCENTAGE(ListPrice,10)",
          "ContributingSubTotal": 100,
          "ContributingScope": "NonTransactional",
          "isSkipped": false,
          "Non-TransactionalListPrice": 100,
          "TransactionalListPrice": 0,
          "hasError": false
        }
      ]
    }
  },
  "waterfall": [
    {
      "fieldToTagNameMapping": { ... },
      "pricingElement": {
        "adjustments": [
          {"NetUnitPrice": 10, "ContributingScope": "NonTransactional"},
          {"NetUnitPrice": 10, "ContributingScope": "Transactional"}
        ],
        "elementType": "DerivedPricing",
        "name": "Derived Price"
      },
      "tasksInfo": [
        {
          "taskName": "DerivedPrice-DerivedCalculate",
          "executionStartTimestamp": "2026-02-17T10:43:45.637283237Z",
          "executionEndTimestamp": "2026-02-17T10:43:46.037719198Z"
        },
        {
          "taskName": "DerivedPrice-UpdateCalculationPayload",
          "executionStartTimestamp": "2026-02-17T10:43:45.657283237Z",
          "executionEndTimestamp": "2026-02-17T10:43:46.057762503Z"
        }
      ],
      "sequence": 3
    }
  ],
  "isParallelExecution": true,
  "SubscriptionNetUnitPrice": 20
}
```

### Pricing Waterfall Log Input (POST to create log)

```json
{
  "currencyCode": "USD",
  "executionEndTimestamp": "2023-07-31T20:11:29.625Z",
  "executionId": "executionId1",
  "executionStartTimestamp": null,
  "lineItemId": "item1",
  "output": {"Subtotal": 38.25, "ListPrice": 10, "NetUnitPrice": 7.65},
  "waterfall": [...]
}
```

Required fields: `executionId`, `lineItemId`, `waterfall`.

---

## 12. Pricing API Request and Response

### Pricing Request (POST /connect/core-pricing/pricing)

Full request body:

```json
{
  "contextDefinitionId": "11Oxx0000006PdxEAE",
  "contextMappingId": "11jxx0000004LDDAA2",
  "jsonDataString": {
    "Cart": [{
      "id": "cart_1001",
      "PriceBookId": "PriceBookId_1001",
      "businessObjectType": "Cart",
      "CartItem": [{
        "id": "lineItem_1001",
        "Quantity": 7,
        "PriceType": "OneTime",
        "product_id": "01txx0000006i44AAA",
        "UnitPrice": 6.8,
        "NetUnitPrice": 0,
        "Attribute": [{"name": "Color", "code": "RED", "isPriceImpacting": true}]
      }]
    }]
  },
  "pricingProcedureId": "9QMxx0000004CKKGA2",
  "configurationOverrides": {
    "skipWaterfall": true,
    "useSessionScopedContext": true,
    "persistContext": true,
    "referenceKey": "referenceKey-12345",
    "displayContext": false,
    "taggedData": false,
    "isHighVolumeLineItems": false
  }
}
```

### Pricing Response (initial async)

```json
{
  "success": true,
  "executionId": "zu8lo5hBCrFzyd5LWZk"
}
```

The `executionId` is an auto-generated alphanumeric string used for correlation to extract async waterfall and context persistence status.

### Pricing Output (GET with executionId)

```json
{
  "apiExecutionId": "6122280387143152",
  "pricingExecutionId": "612229738898095",
  "pricingResult": {
    "subtotal": [
      {"dataPath": ["cart_1001", "lineItem_1002"], "value": 300.0, "errors": [], "isSuccess": true},
      {"dataPath": ["cart_1001", "lineItem_1001"], "value": 400.0, "errors": [], "isSuccess": true}
    ],
    "netunitprice": [
      {"dataPath": ["cart_1001", "lineItem_1002"], "value": "xx", "errors": [], "isSuccess": true}
    ]
  },
  "pricingResultErrors": [],
  "status": "Completed"
}
```

**status values:** `Completed`, `Partially Completed`, `Failed`

### Pricing Result — dataPath Explained

The `pricingResult` object contains one entry per output tag (e.g., `subtotal`, `netunitprice`). Each entry has:
- `dataPath` — array tracing from root node to the specific line item (e.g., `["cart_1001", "lineItem_1001"]`)
- `value` — the computed value
- `errors` — any element-level errors
- `isSuccess` — success for this specific element

**Important:** The `pricingResult` uses the ORIGINAL attribute name from the Context Definition, not the tag name. If Context Definition attribute is `Subtotal` but the tag is `Total Price`, the response shows `Subtotal`.

---

## 13. Pricing Process Execution and Debugging

### PricingAPIExecution (v63.0+)

Created each time the pricing API is called. Key fields:
- `ApiType`: `NGP`
- `ExecutionKey`: correlation key
- `ReferenceKey`: the `referenceKey` from `configurationOverrides` — used to search in Pricing Operations Console
- `Status`: `Success`, `Partial_Success`, `Failure`

### PricingProcessExecution (v63.0+)

Execution log per API call. `ExecutionType` values:
- `Api_Execution` — top-level API execution log
- `Discovery` — product discovery phase
- `Discovery_Line` — per-line discovery
- `Pricing` — pricing phase (default)
- `Pricing_Line` — per-line pricing

### Pricing Execution Waterfall Response

The execution-level waterfall response (returned when `skipWaterfall=false`):

```json
{
  "apiEndpoint": "/connect/core-pricing/pricing",
  "apiExecutionId": "263369316770986",
  "apiExecutionLogRepresentationList": [
    {
      "message": ["The Pricing API execution was successful."]
    }
  ],
  "currencyCode": "USD",
  "executionId": "263369316895959",
  "id": "263369316895960",
  "lineItemId": null,
  "referenceKey": "referenceKey-ABCD",
  "success": false,
  "usageType": "Api_Execution"
}
```

Key fields:
- `apiEndpoint` — which pricing endpoint ran
- `apiExecutionId` — unique per pricing API execution
- `referenceKey` — matches the `configurationOverrides.referenceKey` for Operations Console search
- `usageType` — `Api_Execution`, `Pricing`, `Discovery`, etc.

### Line Item Waterfall Response

Per-line waterfall (returned by GET /connect/core-pricing/waterfall/{executionId}/{lineItemId}):

```json
{
  "currencyCode": "USD",
  "error": null,
  "executionEndTimestamp": "2023-07-31T20:11:29.625Z",
  "executionId": "gdLVwn2xluats2xWMAjV",
  "executionStartTimestamp": null,
  "lineItemId": "item1",
  "success": true,
  "usageType": "Pricing",
  "output": {
    "quantity": "10",
    "netUnitPrice": "10",
    "subtotal": "100"
  },
  "waterfall": [...]
}
```

### API Execution Log Response

```json
{
  "message": "{The Pricing API execution was successful.}",
  "pricingElement": {
    "adjustments": [{"adjustmentType": null, "adjustmentValue": null}],
    "name": "List Price",
    "elementType": "ListPrice"
  }
}
```

Fields: `message` (String[]), `pricingElement` (Adjustment Details).

---

## 14. Pricing Error Handling

### Pricing Error Response

| Field | Description |
|---|---|
| `errorCode` | Code identifying the error |
| `message` | Human-readable reason for the error |

### PricingResultError

Element-level errors in the pricing result:

```json
{
  "pricingResultErrors": {
    "Aggregateprice": [{
      "dataPath": ["cart_1001"],
      "errors": [{"errorCode": "Dummy", "message": "..."}]
    }]
  }
}
```

- `dataPath` — route to the element that failed
- `errors` — array of `{errorCode, message}` objects

### Common Error Patterns

- Pricing procedure not found → check `pricingProcedureId` references a valid ExpressionSet
- Context mapping mismatch → `businessObjectType` in `jsonDataString` must match context mapping sObjects
- `Partially Completed` status → some line items priced successfully; check per-item `isSuccess` and `errors`
- `INVALID_AUTH_HEADER` → use `sf org auth show-access-token` rather than standard auth commands

---

## 15. Bulk Price Updates (PricingAdjBatchJob)

### PricingAdjBatchJob (v62.0+)

Performs bulk price updates across many records at once.

**TargetObject values (exactly these four):**
- `AttributeBasedAdjustment`
- `BundleBasedAdjustment`
- `PriceAdjustmentTier`
- `PricebookEntry`

**Status values:** `New`, `InProgress`, `Completed`, `Failed`, `PartiallyCompleted`, `Rerun`

**UpdateType values:** `Amount`, `Override`, `Percentage`

### PricingAdjBatchJobLog (v62.0+)

Failed records from a batch job run:
- `ErrorCode` — what went wrong
- `ErrorMessage` — detailed message
- `AdjustedValue` — the value that was attempted
- `TargetRecord` — which record failed

---

## 16. Versioned Revision Details

Used to create time-boxed versions of adjustment records. Allows you to have different prices active at different dates.

### AttributeBasedAdjustment Revision

```json
{
  "entityName": "AttributeBasedAdjustment",
  "id": "entityId",
  "priceAdjustmentId": "priceAdjustmentScheduleId",
  "productId": "ProductId",
  "productSellingModelId": "PsmId",
  "adjustmentType": "AdjustmentType",
  "adjustmentValue": "AdjustmentValue(Numeric)",
  "effectiveFrom": "EffectiveFrom date",
  "effectiveTo": "EffectiveTo Date",
  "additionalFieldsToValueMap": {
    "attributeBasedAdjRuleId": "AttributeBasedAdjRuleId"
  }
}
```

### BundleBasedAdjustment Revision

```json
{
  "entityName": "BundleBasedAdjustment",
  "id": "entityId",
  "priceAdjustmentId": "priceAdjustmentScheduleId",
  "productId": "ProductId",
  "productSellingModelId": "PsmId",
  "adjustmentType": "AdjustmentType",
  "adjustmentValue": "AdjustmentValue(Numeric)",
  "effectiveFrom": "EffectiveFrom date",
  "effectiveTo": "EffectiveTo Date",
  "additionalFieldsToValueMap": {
    "parentProductId": "ParentProductId",
    "rootBundleId": "RootBundleId"
  }
}
```

**API endpoint:** `POST /connect/core-pricing/versioned-revision-details`

---

## 17. Price Revision Policy (PriceRevisionPolicy, v65.0+)

Used to revise prices over time using an index (CPI, regional index) or a flat adjustment.

| Field | Values / Notes |
|---|---|
| PolicyType | `Flat` or `PriceIndex` |
| Formula | Formula expression for the revision calculation |
| Region | Geographic region for the policy |

The `IndexRate` sObject (extended standard object, v65.0+) adds `Region` and `UsageType=Pricing` fields specifically for price indexing use cases.

---

## 18. Pricing Simulation

**GET /connect/core-pricing/simulation/input-variables** (v64.0+)

Parameters:
- `contextDefinitionId` — context definition version ID
- `contextMappingId` — context mapping ID
- `entityId` — entity being simulated
- `expressionSetVersionId` — the pricing procedure (expression set) version to simulate

Use this to preview what inputs a pricing procedure expects before executing it. Useful for testing and debugging pricing configurations.

---

## 19. ProductPriceRange and ProductPriceHistoryLog

### ProductPriceRange (v62.0+)

Stores the price range for a product/selling model combination in a price book:
- `RecordedPrice` — the price captured for the range
- Links product + selling model + price book

### ProductPriceHistoryLog (v62.0+)

Historical pricing data record. Master-detail to `ProductPriceRange`. Tracks price changes over time for auditing and analysis.

---

## 20. PBE Derived Pricing

When a PriceBookEntry's price is derived from another product:

**Response:**
```json
{
  "productId": "01txx0000006i2SAAQ",
  "pricebookEntryId": "01uxx0000008yYcAAI",
  "effectiveFrom": "2020-01-01T22:53:20.000Z",
  "effectiveTo": "2021-01-01T22:53:20.000Z"
}
```

Properties: `error` (PricingErrorResponse[]), `isSuccess`, `sourceProceductId`.

**API endpoint:** `GET /connect/core-pricing/pbe-derived-pricing`

---

## 21. Common Pricing Procedure Patterns

### Pattern 1: Standard Volume Discount Flow

```
Step 1 (sequence=0): ListPrice — reads PriceBookEntry, outputs ListPrice
Step 2 (sequence=1): VolumeDiscount — reads quantity + schedule, outputs NetUnitPrice
Step 3 (sequence=2): Subtotal — computes Quantity × NetUnitPrice
```

Waterfall shows ListPrice step with `elementType=ListPrice` and VolumeDiscount step with `elementType=VolumeDiscount`, `adjustmentType=Percentage`.

### Pattern 2: Attribute-Based Pricing

```
Step 1: ListPrice — base price from PriceBookEntry
Step 2: AttributeBasedDiscount — reads product attributes (Color, Size, etc.)
         → adjustments may be surcharges (+) or discounts (-)
Step 3: FinalPrice computation
```

Requires `Attribute[]` array in `jsonDataString.CartItem` with `isPriceImpacting=true`.

### Pattern 3: Bundle Pricing

```
Step 1: ListPrice for each component
Step 2: BundleBasedDiscount — reads ParentProductId and RootBundleId
         → applies discount to bundle components
Step 3: Aggregate bundle total
```

### Pattern 4: Derived Pricing (Subscription)

Used when subscription line prices are derived from parent or sibling products:
- `isDerivedProcessed=true` in diagnosticData
- `contributingLines[]` shows which products contributed to the derived price
- `ContributingScope` values: `NonTransactional`, `Transactional`
- Formula: `PERCENTAGE(ListPrice, 10)` — 10% of list price

### Pattern 5: High-Volume Line Items

For 100+ line items, set `isHighVolumeLineItems=true`. The response includes `isParallelExecution=true` and section-level outputs (`section-0-output`, `section-1-output`).

---

## 22. Manual vs. Automatic Discounts

**Automatic discounts** are applied by the pricing procedure based on:
- Volume/tier schedule (PriceAdjustmentSchedule + PriceAdjustmentTier)
- Attribute rules (AttributeBasedAdjRule)
- Bundle rules (BundleBasedAdjustment)
- Decision table lookup (pricing recipe)

**Manual discounts** are applied by a user directly:
- Set `UnitPrice` or `Discount` fields directly on the line item in `jsonDataString`
- The pricing procedure may or may not honor manual overrides depending on ExpressionSet configuration
- Use `OverrideAmount` TierType on a PriceAdjustmentTier to force an exact price rather than a percentage

---

## 23. Tax Integration

Tax calculation integrates with the pricing waterfall as a separate pricing element step. The pricing procedure can include a tax calculation step that:
- Reads `NetUnitPrice` and `Subtotal` from earlier steps
- Applies tax rules (typically via a decision table or external call)
- Outputs `TaxAmount` and `TotalPrice`

The tax step appears in the waterfall with its own `elementType` (typically `Tax` or custom name), `inputParameters` showing pre-tax amounts, and `outputParameters` showing tax amounts.

---

## 24. Response Bodies Reference

### Adjustment Details

```json
{
  "pricingElement": {
    "adjustments": [{"adjustmentType": null, "adjustmentValue": null}],
    "name": "List Price",
    "elementType": "ListPrice"
  }
}
```

Fields: `adjustments` (Map<String,Object>[]), `description`, `elementType`, `name`. All v60.0+, filter group Small.

### Pricing Waterfall Response

```json
{
  "inputParameters": {"productId": "01txx...", "pricebookId": "01sxx...", "pricingModelType": "OneTime"},
  "fieldToTagNameMapping": {"Product2Id": "ItemProduct", "Subtotal": "Subtotal", ...},
  "sequence": 0,
  "outputParameters": {"listPrice": "10"},
  "pricingElement": {
    "adjustments": [{"adjustmentType": null, "adjustmentValue": null}],
    "name": "List Price"
  }
}
```

### Pricing Response

```json
{"success": true, "executionId": "zu8lo5hBCrFzyd5LWZk"}
```

Fields: `error` (PricingErrorResponse), `executionId` (auto-generated for async correlation), `success`.

### Pricing Generic Response

```json
{"success": true}
```

Used for sync operations. Fields: `error`, `success`.

### Pricing Recipe LookUp Table Response

Fields: `id` (recipe table mapping ID), `isInternal` (Boolean — built-in vs custom), `pricingComponentType` (ListPrice/VolumeDiscount/CustomDiscount/etc.).

### Pricing Recipe Response

Fields: `recipes[]` — array of recipe objects, each with `active`, `createdBy`, `createdOn`, `decisionTables[]`, `developerName`, `id`, `name`, `procedureCreatedBy`, `procedureCreatedOn`, `procedureId`, `procedureName`.

### Pricing Recipe Post

```json
{"isSuccess": true}
```

Fields: `error` (PricingErrorResponse), `isSuccess`.

### Pricing Versioned Revision Details

Fields: `error` (PricingErrorResponse), `success`.

### Procedure Plan Definition Response

Fields: `description`, `developerName`, `error`, `name`, `primaryObject`, `procedurePlanDefinitionVersions[]`, `processType`, `recordId`, `success`.

### Procedure Plan Definition Version Response

Fields: `active`, `contextDefinition`, `developerName`, `effectiveFrom`, `effectiveTo`, `error`, `inheritedFrom`, `procedurePlanSections[]`, `processType`, `rank`, `readContextMapping`, `recordId`, `saveContextMapping`, `success`.

---

## 25. Debugging Checklist

When a pricing call fails or returns unexpected results:

1. **Check `success` field and `status`** in the Pricing Output response (`Completed`/`Partially Completed`/`Failed`).
2. **Check `pricingResultErrors`** — element-level errors with `dataPath` pointing to the failing line item.
3. **Enable waterfall** (`skipWaterfall=false`) — inspect each step's `inputParameters` and `outputParameters` to find where the price diverges from expectations.
4. **Use `referenceKey`** in `configurationOverrides` then search the Pricing Operations Console by that key to find `PricingAPIExecution` records.
5. **Enable Advanced Logging** (Setup > Salesforce Pricing) to get `diagnosticData` in waterfall output — shows `contributingLines`, `DerivedFormula`, `exceptionDetails`.
6. **Check `PricingProcessExecution`** records for execution-level logs (filter by `ExecutionType=Pricing_Line` for per-line details).
7. **Check `PricingAdjBatchJobLog`** if bulk updates failed — `ErrorCode` and `ErrorMessage` explain which records were rejected.
8. **Verify context setup**: `contextDefinitionId` + `contextMappingId` must be valid; `businessObjectType` in `jsonDataString` must match context mapping configuration.
9. **Verify procedure plan**: use Procedure Plan Evaluation API to confirm the right procedure is being selected for the given criteria.
10. **Check PriceAdjustmentTier boundaries**: remember `UpperBound` is NOT inclusive; gaps between tiers cause pricing to fail or return unexpected values.

---

## 26. Key API Endpoints Summary

| Endpoint | Method | Purpose |
|---|---|---|
| `/connect/core-pricing/pricing` | POST | Execute pricing |
| `/connect/core-pricing/waterfall/{executionId}` | GET | Get waterfall log |
| `/connect/core-pricing/waterfall/{executionId}/{lineItemId}` | GET | Get per-line waterfall |
| `/connect/core-pricing/waterfall` | POST | Create waterfall log |
| `/connect/core-pricing/recipe` | GET | Get pricing recipe |
| `/connect/core-pricing/recipe/mapping` | POST | Create/update recipe mapping |
| `/connect/core-pricing/pbe-derived-pricing` | GET | Get PBE derived pricing |
| `/connect/core-pricing/simulation/input-variables` | GET | Get simulation variables |
| `/connect/core-pricing/versioned-revision-details` | POST | Create versioned revision |
| `/connect/core-pricing/procedure-plan-definitions` | POST | Create procedure plan definition |
| `/connect/core-pricing/procedure-plan-definitions/{id}` | GET/PATCH | Read/update plan definition |
| `/connect/core-pricing/procedure-plan-versions` | POST | Create plan version |
| `/connect/core-pricing/procedure-plan-versions/{id}` | GET/PATCH | Read/update plan version |
| `/connect/core-pricing/procedure-plan-evaluation` | POST | Evaluate procedure plan |
| `/connect/core-pricing/procedure-plan-evaluation-by-object` | POST | Evaluate by object |
| `/connect/core-pricing/data-sync` | POST | Sync pricing data |

---

## 27. PATCH Warning: Properties Not Specified Are Deleted

When using PATCH on procedure plan definitions or versions:

> **Note from PDF**: "The properties that aren't specified in the input are deleted when updating the record."

Always include ALL required fields when doing a PATCH operation, not just the fields being changed. This applies to:
- Procedure Plan Definition By ID (PATCH)
- Procedure Plan Version By ID (PATCH)
