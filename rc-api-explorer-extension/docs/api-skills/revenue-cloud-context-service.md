---
name: revenue-cloud-context-service
description: Revenue Cloud Context Service Developer Guide — Revenue Cloud Developer Guide PDF (2026-06-13)
metadata:
  type: reference
---

# Revenue Cloud Context Service Developer Guide

## Source
PDF: revenue_lifecycle_management_dev_lates.pdf (2917 pages)
Pages scanned: 127-200, 526-600, 744-780
Scanned: 2026-06-13

---

## Overview

The Context Service is the mechanism by which Revenue Cloud APIs receive, structure, and hydrate business data before executing pricing, discovery, configuration, or procedure plan logic. Instead of sending raw SObject data directly to each API, callers define a **Context Definition** (schema), a **Context Mapping** (field-to-node translation), and then provide the actual data (a **Context Instance**) at runtime. The APIs use the contextDefinitionId and contextMappingId to know how to interpret the jsonDataString payload and populate the internal context nodes used by pricing procedures, qualification rules, and configurator rules.

---

## Core Concepts: Three Context Artifacts

### 1. ContextDefinition (Schema)
- Defines the **structure** (nodes and fields) of the context — what data slots exist.
- Represented in Salesforce as a metadata record with an ID prefixed `11O` (API version 60.0+).
- Referenced in API calls as `contextDefinitionId` (String, Required for Pricing POST).
- Also referenced in Procedure Plan Definition Versions as `contextDefinition` (developer name string).
- Example ID format: `"contextDefinitionId": "11Oxx0000006PdxEAE"`
- Standard out-of-box definition for Sales transactions: `SalesTransactionContext__stdctx`

### 2. ContextMapping (Field-to-Node Translation)
- Defines how fields from real SObjects map to the context definition nodes.
- Different mappings allow the same context definition to be fed from different source objects (e.g., Quote vs. Order vs. Cart).
- Represented with an ID prefixed `11j` (API version 60.0+).
- Referenced in API calls as `contextMappingId` (String, Required for Pricing POST).
- Also referenced in Procedure Plan Definition Versions as `readContextMapping` and `saveContextMapping`.
- Example ID format: `"contextMappingId": "11jxx0000004LDDAA2"`
- Standard mapping examples: `QuoteEntitiesMapping`
- The keys in `jsonDataString` must align with the context mapping (businessObjectType values must match the sObjects configured in the mapping).

### 3. ContextInstance (Hydrated Runtime Data)
- The actual populated context at runtime, created from the definition + mapping + input data.
- Has a runtime ID (`contextid`) used by the Price Context (POST) endpoint.
- Created by calling the Pricing POST endpoint with `contextDefinitionId` + `contextMappingId` + `jsonDataString`.
- Can be persisted (re-used) via `persistContext: true` in configurationOverrides.
- Can be session-scoped via `useSessionScopedContext: true`.
- Example context ID format: `0U3RM00000000SR0AY`

---

## Hydration Process

Hydration is the process of taking the raw JSON input data and populating the internal context nodes.

**Steps at runtime:**
1. Caller POSTs to `/connect/core-pricing/pricing` with `contextDefinitionId`, `contextMappingId`, and `jsonDataString`.
2. The API looks up the ContextDefinition to understand the node structure.
3. The API looks up the ContextMapping to know which sObject fields map to which context nodes.
4. The `jsonDataString` payload (stringified JSON) is parsed and mapped into context nodes using the contextMapping rules.
5. The hydrated context is used by the pricing procedure to evaluate decision tables, price adjustments, qualification rules, etc.
6. A context instance ID is generated and returned in the response; this can be used for subsequent calls via the Price Context endpoint.

**Important constraint:** The `businessObjectType` value within each node in `jsonDataString` must match the sObject name configured in the context mapping records.

---

## Salesforce Pricing Business APIs — Context-Related Endpoints

Base URL pattern: `https://yourInstance.salesforce.com/services/data/v67.0/`

### Pricing (POST) — Primary hydrate + price endpoint
**Resource:** `/connect/core-pricing/pricing`
**Available version:** 60.0
**HTTP method:** POST
**Requires Chatter:** No

**Purpose:** Create and hydrate a context instance in a single request. Provides final pricing details per line items and related errors.

**Request body properties:**

| Name | Type | Required | Version | Description |
|---|---|---|---|---|
| `contextDefinitionId` | String | Required | 60.0 | ID of the context definition that defines the structure of the input data |
| `contextMappingId` | String | Required | 60.0 | ID of the context mapping that maps the input data to the context instance |
| `jsonDataString` | String | Required | 60.0 | Data to hydrate the context. Must be JSON format passed as String. Use stringify() to convert. Keys must align with contextMappingId. The `businessObjectType` value must match the sObject used in context mappings. |
| `pricingProcedureId` | String | Optional | 60.0 | ID or API Name of the pricing procedure (Expression Set Definition). For Experience Cloud users, specify the name. |
| `configurationOverrides` | Configuration Override Input | Optional | 60.0 | Parameters to override pricing configuration |

**configurationOverrides (Configuration Override Input) fields:**

| Name | Type | Description |
|---|---|---|
| `skipWaterfall` | Boolean | Skip waterfall details in response |
| `useSessionScopedContext` | Boolean | Use a session-scoped context instance |
| `persistContext` | Boolean | Persist the context instance for reuse |
| `referenceKey` | String | Reference key for the context instance |
| `displayContext` | Boolean | Include context data in the response |
| `taggedData` | Boolean | Return tagged data |
| `isHighVolumeLineItems` | Boolean | Optimize for high volume line items |

**Full JSON example (Pricing POST):**
```json
{
  "contextDefinitionId": "11Oxx0000006PdxEAE",
  "contextMappingId": "11jxx0000004LDDAA2",
  "jsonDataString": {
    "Cart": [
      {
        "id": "cart_1001",
        "cart_id": "cart_1001",
        "PriceBookId": "PriceBookId_1001",
        "businessObjectType": "Cart",
        "CartItem": [
          {
            "id": "lineItem_1001",
            "line_item_id": "lineItem_1001",
            "Quantity": 7,
            "PriceType": "OneTime",
            "Frequency": "",
            "UOM": "",
            "businessObjectType": "CartItem",
            "product_id": "01txx0000006i44AAA",
            "UnitPrice": 6.8,
            "NetUnitPrice": 0,
            "Attribute": [
              {
                "name": "Color",
                "code": "RED",
                "isPriceImpacting": true,
                "businessObjectType": "Attribute",
                "id": "Attribute_1001",
                "attribute_id": "Attribute_1001"
              },
              {
                "name": "Size",
                "code": "10INCH",
                "isPriceImpacting": true,
                "businessObjectType": "Attribute",
                "id": "Attribute_1002",
                "attribute_id": "Attribute_1002"
              }
            ]
          },
          {
            "id": "lineItem_1002",
            "line_item_id": "lineItem_1002",
            "quantity": 3,
            "PriceType": "OneTime",
            "Frequency": "",
            "UOM": "",
            "businessObjectType": "CartItem",
            "product_id": "01txx0000006i2SAAQ",
            "unitprice": 6,
            "NetUnitPrice": 0,
            "Attribute": [
              {
                "name": "Color",
                "code": "BLUE",
                "isPriceImpacting": true,
                "businessObjectType": "Attribute",
                "id": "Attribute_1003",
                "attribute_id": "Attribute_1003"
              }
            ]
          }
        ]
      }
    ]
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

**Response body:** Pricing Output

---

### Price Context (POST) — Execute pricing using existing context instance
**Resource:** `/connect/core-pricing/price-contexts/{contextid}`
**Available version:** 60.0
**HTTP method:** POST

**Purpose:** Perform a pricing request using the instance ID of an already-hydrated context. Skips the hydration step.

**Path parameter:**
| Name | Type | Required | Description |
|---|---|---|---|
| `contextid` | String | Required | The runtime context instance ID (e.g., `0U3RM00000000SR0AY`) |

**Request body properties:**

| Name | Type | Required | Version | Description |
|---|---|---|---|---|
| `configurationOverrides` | Configuration Override Input | Optional | 60.0 | Parameters to override pricing configuration |
| `procedureName` | String | Optional | 60.0 | Name of the pricing procedure |

**JSON example:**
```json
{
  "configurationOverrides": {
    "skipWaterfall": true,
    "useSessionScopedContext": true,
    "persistContext": true,
    "taggedData": false
  },
  "procedureName": "ES1"
}
```

**Response body:** Pricing Response

**Note:** If price waterfall is disabled from Salesforce Pricing Setup, this API does not return waterfall details. Use the Price Waterfall API to retrieve waterfall details if price waterfall persistence is enabled.

---

### Pricing Data Sync (GET) — Sync lookup tables
**Resource:** `/connect/core-pricing/sync/{pricingSyncOrigin}`
**Available version:** 60.0
**HTTP method:** GET

Sync pricing data to ensure lookup tables contain the latest pricing data. To partially synchronize, use the Decision Table Refresh Action in a Flow.

**Query parameter:**
| Name | Type | Required | Version | Description |
|---|---|---|---|---|
| `pricingRecipeId` | String | Optional | 67.0 | ID of the pricing recipe whose decision tables to sync. If not specified, the default pricing recipe is used. |

**Response body:** Pricing Generic Response

---

### API Execution Logs (GET)
**Resource:** `/connect/core-pricing/apiexecutionlogs/{executionId}`
**Available version:** 63.0
**HTTP method:** GET

**Path parameter:**
| Name | Type | Required | Description |
|---|---|---|---|
| `executionId` | String | Required | ID of the pricing process execution record |

**Response body:** Pricing Execution Waterfall Response

---

### Pricing Process Execution (GET)
**Resource:** `/connect/core-pricing/pricing-process-execution/{executionId}`
**Available version:** 63.0
**HTTP method:** GET

**Path parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| `executionId` | String | Required | ID generated each time a pricing process is executed |

**Query parameters (executionType):**
| Value | Description |
|---|---|
| `API_Execution` | API execution type |
| `Discovery` | Discovery procedure |
| `Discovery_Line` | Discovery procedure for line items |
| `Pricing` | Pricing procedure |
| `Pricing_Line` | Pricing procedure for line items |

If executionType is not specified, all execution types for the given executionId are returned.

---

### Pricing Process Execution for Line Items (GET)
**Resource:** `/connect/core-pricing/pricing-process-execution/lineitems/{executionId}/{executionType}`
**Available version:** 63.0
**HTTP method:** GET

**Valid executionType values:**
- `Pricing_Line`
- `Discovery_Line`

---

## Procedure Plan Definitions — Context Integration

Procedure Plan Definitions link business processes to specific context definitions and context mappings. This is the configuration layer that ties the context service to the underlying pricing/DRO/billing procedures.

### Procedure Plan Definitions API

**Resource:** `/connect/procedure-plan-definitions`
**Available version:** 62.0
**HTTP methods:** GET, POST

**GET query parameter:**
| Name | Type | Required | Description |
|---|---|---|---|
| `isTemplate` | Boolean | Optional (v62.0) | `true` = return file-based definitions; `false` (default) = database-based definitions |

**POST request body properties:**

| Name | Type | Required | Version | Description |
|---|---|---|---|---|
| `description` | String | Optional | 62.0 | Description of the procedure plan definition |
| `developerName` | String | Required (POST) | 62.0 | Developer name of the procedure plan definition |
| `name` | String | Optional | 62.0 | Name of the procedure plan definition |
| `primaryObject` | String | Required (POST, rule-based) | 62.0 | Source sObject for rule-based criteria. Must be unique in ProcedurePlanDefinition. |
| `procedurePlanDefinitionVersions` | Procedure Plan Definition Version Input[] | Required | 62.0 | List of versions |
| `processType` | String | Required | 63.0 | Valid values: `Billing`, `DRO`, `DeepClone`, `ProductDiscovery`, `Revenue Cloud`. Default: `Default` if unspecified. |
| `recordId` | String | Required (PATCH) | 62.0 | ID of the procedure plan definition record |

**processType valid values:**
- `Billing`
- `DRO`
- `DeepClone`
- `ProductDiscovery`
- `Revenue Cloud`
- `Default` (default when unspecified)

**POST JSON example:**
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

**Key context fields in Procedure Plan Definition Version:**

| Field | Description |
|---|---|
| `contextDefinition` | Developer name string of the ContextDefinition to use (e.g., `SalesTransactionContext__stdctx`) |
| `readContextMapping` | Developer name of the ContextMapping used to read data INTO the context |
| `saveContextMapping` | Developer name of the ContextMapping used to write/save data FROM the context |
| `active` | Boolean — whether this version is active |
| `effectiveFrom` | ISO datetime when this version becomes effective |
| `developerName` | Developer name of the version |
| `rank` | Integer rank for priority ordering |

---

### Procedure Plan Definition By ID (GET, PATCH, DELETE)
**Resource:** `/connect/procedure-plan-definitions/{procedurePlanDefinitionId}`
**Available version:** 62.0

The `procedurePlanDefinitionId` can be either the record ID or the developer name.

**Note:** You can delete a procedure plan definition only if it does not include any active procedure plan version.

**PATCH note:** Properties not specified in the PATCH input are deleted from the record.

**PATCH JSON example:**
```json
{
  "description": "Default definition patch update",
  "developerName": "Quote_Definition",
  "name": "Quote_Definition",
  "primaryObject": "Quote",
  "recordId": "1FNxx0000004EsOGAU"
}
```

---

### Procedure Plan Evaluation By Object (POST)
**Resource:** `/connect/procedure-plan-definitions/evaluate`
**Available version:** 62.0

Evaluate a procedure plan definition based on a primary object to check for prerequisites such as usage type and context mapping details.

**POST JSON example:**
```json
{
  "idList": ["a01DU000000By1cYAC"],
  "evaluationDate": "2024-07-08T10:15:30.000Z",
  "processType": "Default",
  "sectionType": ["PricingProcedure"],
  "subSectionType": ["Revenue"]
}
```

**Properties:**
| Name | Type | Required | Description |
|---|---|---|---|
| `evaluationDate` | String | Required | Date when evaluation is applicable. Must be within the effective date range. |
| `idList` | String[] | Required (Evaluate By Object) | List of record IDs of procedure plan definitions to evaluate |
| `processType` | String | Optional (v63.0) | Valid values: `Billing`, `DRO`, `DeepClone`, `ProductDiscovery`, `Revenue Cloud`, `Default` |
| `sectionType` | String[] | Optional | e.g., `["PricingProcedure"]` |
| `subSectionType` | String[] | Optional | e.g., `["Revenue"]` |

---

### Procedure Plan Evaluation By Definition Name (POST)
**Resource:** `/connect/procedure-plan-definitions/evaluate/{procedurePlanDefinitionName}`
**Available version:** 62.0

Evaluate a procedure plan definition by the name of the definition to check for prerequisites such as usage type and context mapping details.

---

### Procedure Plan Version (POST)
**Resource:** `/connect/procedure-plan-definitions/{procedurePlanDefinitionId}/version`
**Available version:** 62.0

Create records of a procedure plan version with details.

---

### Procedure Plan Version Details (GET, PATCH, DELETE)
**Resource:** `/connect/procedure-plan-definitions/versions/{procedurePlanVersionId}`
**Available version:** 62.0

---

## Pricing Waterfall — Context Relationship

### Pricing Waterfall (GET)
**Resource:** `/connect/core-pricing/waterfall/{lineItemId}/{executionId}`
**Available version:** 60.0

Get the persisted price waterfall that stores process logs. Price waterfall provides insights into every step of the pricing process.

**Advanced Price Logs:** You can set up advanced price logs to capture exception details for complex pricing elements. The API response captures input and output values to trace exceptions. Refer to diagnostic data to identify and fix performance issues.

**Query parameters:**
| Name | Type | Required | Version | Description |
|---|---|---|---|---|
| `tagsToFilter` | String | Optional | 61.0 | Comma-separated tags to filter |
| `usageType` | String | Optional | 62.0 | Valid values: `Pricing` (default), `Discovery`, `Rating` |

**Response body:** Line Item Waterfall Response

---

### Pricing Waterfall (POST)
**Resource:** `/connect/core-pricing/waterfall`
**Available version:** 60.0

Create a log of price waterfall.

**Waterfall POST body properties:**
| Name | Type | Required | Version | Description |
|---|---|---|---|---|
| `contextDefinitionVersionId` | String | Optional | 60.0 | Context definition version ID of the pricing procedure |
| `contextMappingId` | String | Optional | 60.0 | Context mapping ID of the pricing procedure |
| `currencyCode` | String | Optional | 60.0 | Currency code such as USD or INR |
| `executionEndTimestamp` | String | Optional | 60.0 | End timestamp of procedure execution |
| `executionId` | String | Required | 60.0 | Execution ID for a particular execution of a pricing procedure |
| `executionStartTimestamp` | String | Optional | 60.0 | Start timestamp of procedure execution |
| `lineItemId` | String | Required | 60.0 | Line item ID for which the price is being calculated |
| `output` | Map<String, Object> | Optional | 60.0 | Output of the pricing procedure |
| `waterfall` | Pricing Waterfall Input[] | Required | 60.0 | Details of the pricing waterfall |

**Waterfall POST JSON example:**
```json
{
  "currencyCode": "USD",
  "executionEndTimestamp": "2023-07-31T20:11:29.625Z",
  "executionId": "executionId1",
  "executionStartTimestamp": null,
  "lineItemId": "item1",
  "output": {
    "Subtotal": 38.25,
    "ListPrice": 10,
    "NetUnitPrice": 7.65
  },
  "waterfall": [
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
        "Product2Id": "01txx0000006i44AAA",
        "Pricebook2Id": "01sxx0000005q9xAAA",
        "Quantity": 5,
        "LineItemId": "item1"
      },
      "outputParameters": {
        "Subtotal": 50,
        "ListPrice": 10
      },
      "pricingElement": {
        "adjustments": [
          {
            "AdjustmentValue": "95.00",
            "AdjustmentType": "Amount"
          }
        ],
        "description": null,
        "elementType": "ListPrice",
        "name": "List Price"
      },
      "sequence": 1
    }
  ]
}
```

---

## Additional Pricing Business APIs (Complete Reference)

### All Salesforce Pricing Business API Resources

| Resource | Method | Description | Version |
|---|---|---|---|
| `/connect/core-pricing/price-contexts/{contextid}` | POST | Perform pricing using existing context instance ID | 60.0 |
| `/connect/core-pricing/pricing` | POST | Hydrate context and price in single request | 60.0 |
| `/connect/core-pricing/sync/{pricingSyncOrigin}` | GET | Sync pricing data / lookup tables | 60.0 |
| `/connect/core-pricing/recipe` | GET | Get mapping details of pricing recipes | 60.0 |
| `/connect/core-pricing/recipe/mapping` | POST | Create mapping between pricing recipe and Decision Tables | 60.0 |
| `/connect/core-pricing/versioned-revise-details` | POST | Create revisions of pricing request for adjustment entities | 60.0 |
| `/connect/core-pricing/waterfall/{lineItemId}/{executionId}` | GET | Get persisted price waterfall (process logs) | 60.0 |
| `/connect/core-pricing/waterfall` | POST | Create a log of price waterfall | 60.0 |
| `/connect/core-pricing/pbeDerivedPricSourceProduct` | POST | Get source product for PBE derived pricing | 61.0 |
| `/connect/core-pricing/apiexecutionlogs/{executionId}` | GET | Get log details of pricing API execution | 63.0 |
| `/connect/core-pricing/pricing-process-execution/{executionId}` | GET | Get execution details of pricing process | 63.0 |
| `/connect/core-pricing/pricing-process-execution/lineitems/{executionId}/{executionType}` | GET | Get pricing execution details for line items | 63.0 |
| `/connect/core-pricing/simulationInputVariablesWithData` | GET | Get pricing simulation input variables with data | — |
| `/connect/procedure-plan-definitions` | GET, POST | Get or create procedure plan definitions | 62.0 |
| `/connect/procedure-plan-definitions/{procedurePlanDefinitionId}` | GET, PATCH, DELETE | Get, update, delete procedure plan definition | 62.0 |
| `/connect/procedure-plan-definitions/evaluate` | POST | Evaluate procedure plan by primary object | 62.0 |
| `/connect/procedure-plan-definitions/evaluate/{procedurePlanDefinitionName}` | POST | Evaluate procedure plan by definition name | 62.0 |
| `/connect/procedure-plan-definitions/{procedurePlanDefinitionId}/version` | POST | Create procedure plan version | 62.0 |
| `/connect/procedure-plan-definitions/versions/{procedurePlanVersionId}` | GET, PATCH, DELETE | Manage procedure plan version | 62.0 |

---

## PBE Derived Pricing (POST) — Context-Adjacent

**Resource:** `/connect/core-pricing/pbeDerivedPricingSourceProduct`
**Available version:** 61.0
**HTTP method:** POST

Get the source product for the Price Book Entry (PBE) derived pricing.

**Request body properties:**

| Name | Type | Required | Version | Description |
|---|---|---|---|---|
| `effectiveFrom` | String | Required | 61.0 | Date from when the price book entry is effective |
| `effectiveTo` | String | Required | 61.0 | Date until when the price book entry is effective |
| `pricebookEntryId` | String | Required | 61.0 | ID of the price book entry |
| `productId` | String | Required | 61.0 | ID of the price book |

**JSON example:**
```json
{
  "productId": "01txx000000612SAAQ",
  "pricebookEntryId": "01uxx0000008yYcAAI",
  "effectiveFrom": "2020-01-01T22:53:20.000Z",
  "effectiveTo": "2021-01-01T22:53:20.000Z"
}
```

---

## Pricing Versioned Revision Details (POST)

**Resource:** `/connect/core-pricing/versioned-revise-details`
**Available version:** 60.0

Create revisions of a pricing request with versions for adjustment entities.

**Attribute-based adjustment example:**
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

**Bundle-based adjustment example:**
```json
{
  "entityName": "BundleBasedAdjustment",
  "id": "entityId",
  "priceAdjustmentScheduleId": "priceAdjustmentScheduleId",
  "productId": "ProductId",
  "productSellingModelId": "PsmId",
  "adjustmentType": "AdjustmentType",
  "adjustmentValue": "AdjustmentValue(Numeric)",
  "effectiveFrom": "EffectiveFrom date",
  "effectiveTo": "EffectiveTo Date",
  "additionalFieldsToValueMap": {
    "rootBundleId": "RootBundleId",
    "parentProductId": "ParentProductId"
  }
}
```

**Properties:**

| Name | Type | Required | Version | Description |
|---|---|---|---|---|
| `additionalFieldsToValueMap` | Map<String, String> | Optional | 60.0 | Additional fields specific to the entity |
| `adjustmentType` | String | Required | 60.0 | Adjustment type: percentage, amount, or override |
| `adjustmentValue` | String | Required | 60.0 | Value for the adjustment |
| `effectiveFrom` | String | Required | 60.0 | Date from when adjustment is effective |
| `effectiveTo` | String | Optional | 60.0 | Date until when adjustment is effective |
| `entityName` | String | Required | 60.0 | Name: `AttributeBasedAdjustment` or `BundleBasedAdjustment` |
| `id` | String | Required | 60.0 | ID of the record |
| `priceAdjustmentScheduleId` | String | Required | 60.0 | ID of the price adjustment schedule record |
| `productId` | String | Required | 60.0 | Product ID of the record |
| `productSellingModelId` | String | Optional | 60.0 | Product selling model ID associated to the record |

---

## Pricing Recipe APIs

### Pricing Recipe (GET)
**Resource:** `/connect/core-pricing/recipe`
**Available version:** 60.0
**Response body:** Pricing Recipe Response

### Pricing Recipe Mapping (POST)
**Resource:** `/connect/core-pricing/recipe/mapping`
**Available version:** 60.0

Create a mapping between the pricing recipe and Decision Tables. Post recipes with lookup tables or procedures.

**JSON example:**
```json
{
  "recipeId": "12Gxx0000005J9MEAU",
  "pricingRecipeLookUpTableInputRepresentations": [
    {
      "lookupId": "12Gxx0000005J9MEAU",
      "pricingComponentType": "CustomDiscount"
    }
  ],
  "pricingRecipeProcedureInputRepresentation": {
    "procedureId": "9QLxx0000004C92GAE"
  }
}
```

**Properties:**
| Name | Type | Required | Description |
|---|---|---|---|
| `pricingRecipeLookUpTableInputRepresentations` | Pricing Recipe LookUp Table Input[] | Required | Input representation of recipe mapping |
| `pricingRecipeProcedureInputRepresentation` | Pricing Recipe Procedure Input | Required | Input representation of procedure used in the recipe |
| `recipeId` | String | Required | ID of the pricing recipe |

---

## Apex Class: ContextDataInput

Found in the Product Discovery Apex Reference (pages ~545):

**Class:** `ContextDataInput`
**Namespace:** (Revenue Cloud / Product Discovery)

**Properties:**

| Property | Type | Description |
|---|---|---|
| `nodeData` | Map<String, ANY> | Key-value pairs of context node data |
| `nodeName` | String | Name of the context node to populate |

This Apex class is used programmatically to build context data inputs before passing them to the discovery/pricing APIs via Apex.

---

## sObject: ProcedurePlanCriterion

**Available:** API version 67.0 and later

The procedure plan option associated with the procedure plan criterion record.

**Supported Calls:** `create()`, `delete()`, `describeSObjects()`, `query()`, `retrieve()`, `update()`, `upsert()`

**Fields:**

| Field | Type | Properties | Description |
|---|---|---|---|
| `ActualValue` | string | Create, Filter, Group, Nillable, Sort, Update | User-defined value compared to SObject field value |
| `DataType` | picklist | Create, Filter, Group, Restricted picklist, Sort, Update | Data type of the field from the selected object |
| `FieldPath` | string | Create, Filter, Group, Sort, Update | Path of field used in procedure relative to object |
| `ObjectField` | string | Create, Filter, Group, Sort, Update | Object field value used to resolve the procedure plan option |
| `Operator` | picklist | Create, Filter, Group, Restricted picklist, Sort, Update | Operator for the criterion |
| `ProcedurePlanOptionId` | reference | Create, Filter, Group, Sort | Master-detail to ProcedurePlanOption |
| `Sequence` | int | Create, Filter, Group, Sort | Processing sequence for criteria |

**Operator picklist values:**
- `Equals`
- `GreaterThan`
- `GreaterThanOrEquals`
- `In`
- `IsNotNull`
- `IsNull`
- `LessThan`
- `LessThanOrEquals`
- `NotEquals`
- `NotIn`

---

## sObject: ProrationPolicy

**Available:** API version 67.0 and later

Represents the proration policy associated with a Product Selling Model Option that determines how a product's price is calculated based on subscription duration or billing periods.

**Supported Calls:** `create()`, `describeLayout()`, `describeSObjects()`, `getDeleted()`, `getUpdated()`, `query()`, `retrieve()`, `search()`

**Fields:**

| Field | Type | Properties | Description |
|---|---|---|---|
| `ArePartialPeriodsAllowed` | boolean | Create, Defaulted on create, Filter, Group, Sort | Whether partial periods are allowed for standard time periods. Default: false |
| `LastReferencedDate` | dateTime | Filter, Nillable, Sort | Date proration policy was last referenced |
| `LastViewedDate` | dateTime | Filter, Nillable, Sort | Date proration policy was last viewed |
| `Name` | string | Create, Filter, Group, idLookup, Sort | Name of the proration policy |
| `ProrationPolicyType` | picklist | Create, Filter, Group, Restricted picklist, Sort | Type of proration policy. Values: `StandardTimePeriods` |
| `RemainderStrategy` | picklist | Create, Filter, Group, Restricted picklist, Sort | Type of remainder strategy |

---

## sObject: ProductSellingModelOption

**Available:** API version 60.0 and later

A junction object between Product Selling Model and Product2.

**Supported Calls:** `create()`, `delete()`, `describeLayout()`, `describeSObjects()`, `getDeleted()`, `getUpdated()`, `query()`, `retrieve()`, `search()`, `undelete()`, `update()`, `upsert()`

**Fields:**

| Field | Type | Properties | Description |
|---|---|---|---|
| `Description` | textarea | Create, Nillable, Update | Description of the product selling model option |
| `DisplayName` | string | Autonumber, Defaulted on create, Filter, idLookup, Sort | Name displayed to customers |
| `Increment` | int | Create, Filter, Group, Nillable, Sort, Update | Number of pricing term units to increase subscription term |
| `IsDefault` | boolean | Create, Defaulted on create, Filter, Group, Sort, Update | Default product selling model for product. Only one default allowed. Default: false. Requires Industries EPC. |
| `LastReferencedDate` | dateTime | Filter, Nillable, Sort | Timestamp last accessed |
| `LastViewedDate` | dateTime | Filter, Nillable, Sort | Timestamp last viewed |
| `Maximum` | int | Create, Filter, Group, Nillable, Sort, Update | Max pricing term units for subscription term |
| `Minimum` | int | Create, Filter, Group, Nillable, Sort, Update | Min pricing term units for subscription term |
| `Name` | string | Autonumber, Defaulted on create, Filter, idLookup, Sort | Name of the product selling model option |
| `Product2Id` | reference | Create, Filter, Group, Sort | Lookup to Product2 |
| `ProductSellingModelId` | reference | Create, Filter, Group, Sort | Lookup to ProductSellingModel |
| `ProrationPolicyId` | reference | Create, Filter, Group, Nillable, Sort | Lookup to ProrationPolicy |

---

## sObject: ProductSellingModelDataTranslation

**Available:** API version 61.0 and later

Represents the translated values of data stored in ProductSellingModel record fields.

**Supported Calls:** `create()`, `delete()`, `describeSObjects()`, `getDeleted()`, `getUpdated()`, `query()`, `retrieve()`, `undelete()`, `update()`, `upsert()`

**Special Access Rules:**
- Organization must use Enterprise, Unlimited, or Developer edition
- Translation Workbench and data translation must be enabled
- Must have "View Setup and Configuration" permission

**Fields:**

| Field | Type | Description |
|---|---|---|
| `IsOutOfDate` | boolean | Whether translation is out-of-date (true) or current (false). Out-of-date if parent Product2 updated after last translation. Defaulted on create. |
| `Language` | picklist | Create, Filter, Group, Restricted picklist, Sort — language for translated values |
| `Name` | string | Create, Filter, Group, idLookup, Sort, Update — translated value for ProductSellingModel name. Required to translate other fields. |
| `ParentId` | reference | Create, Filter, Group, Sort, Update — relationship field to ProductSellingModel (Lookup) |

---

## Salesforce Pricing Fields on Standard Objects

### IndexRate (API version 65.0 and later)

Standard fields extend the IndexRate object for use in Salesforce Pricing.

**Fields:**

| Field | Type | Properties | Description |
|---|---|---|---|
| `Region` | picklist | Create, Filter, Group, Nillable, Sort, Update | Region associated with the given rate |
| `UsageType` | picklist | Create, Filter, Group, Nillable, Restricted picklist, Sort, Update | Usage type. Possible value: `Pricing` |

---

## Pattern: Two-Step vs. One-Step Context Usage

### One-Step (Hydrate + Price together)
Use the **Pricing (POST)** endpoint. Send `contextDefinitionId`, `contextMappingId`, and `jsonDataString` together. Context is hydrated and pricing runs in one call.

```
POST /connect/core-pricing/pricing
{
  "contextDefinitionId": "11Oxx...",
  "contextMappingId": "11jxx...",
  "jsonDataString": "{...}",
  "pricingProcedureId": "9QMxx...",
  "configurationOverrides": { ... }
}
```

### Two-Step (Persist then Reuse)
1. **Hydrate:** POST to `/connect/core-pricing/pricing` with `persistContext: true` → get back a context instance ID.
2. **Reuse:** POST to `/connect/core-pricing/price-contexts/{contextid}` using only the persisted context ID.

This pattern is useful when the same context needs to be priced multiple times (e.g., simulation, what-if scenarios) without re-sending the full data payload.

---

## Pattern: jsonDataString Structure Rules

The `jsonDataString` field in the Pricing POST request:
1. Must be in **JSON format passed as a String** (use `JSON.stringify()` in JavaScript or `JSON.serialize()` in Apex).
2. The **top-level keys** are the parent sObject node names defined in the ContextMapping (e.g., `"Cart"`, `"Quote"`).
3. Each object within those arrays must include a **`businessObjectType`** field set to the sObject API name configured in the context mappings (e.g., `"businessObjectType": "Cart"`, `"businessObjectType": "CartItem"`).
4. Nested child objects follow the same pattern recursively.
5. The keys must align with the `contextMappingId` sent in the request — mismatch causes hydration failure.

---

## Pattern: Procedure Plan Definition Versioning with Context

When creating a Procedure Plan Definition Version, the version links to context artifacts by **developer name** (not record ID):

```json
{
  "active": false,
  "contextDefinition": "SalesTransactionContext__stdctx",
  "readContextMapping": "QuoteEntitiesMapping",
  "saveContextMapping": "QuoteEntitiesMapping",
  "effectiveFrom": "2024-07-15T10:15:30.000Z",
  "developerName": "Quote_Definition_V1",
  "rank": 1
}
```

- `contextDefinition`: developer name of the ContextDefinition sObject record
- `readContextMapping`: developer name of the ContextMapping used to load data into context
- `saveContextMapping`: developer name of the ContextMapping used to write results back

---

## Pattern: Procedure Plan Evaluation for Context Validation

Use Procedure Plan Evaluation By Object (POST) to pre-check that:
- The context mapping is compatible with the primary object
- Usage type prerequisites are met
- The procedure plan definition is active and within its effective date range

```
POST /connect/procedure-plan-definitions/evaluate
{
  "idList": ["<procedurePlanDefinitionRecordId>"],
  "evaluationDate": "2024-07-08T10:15:30.000Z",
  "processType": "Default",
  "sectionType": ["PricingProcedure"],
  "subSectionType": ["Revenue"]
}
```

---

## Important Notes and Gotchas

### Version Constraints
- Context-related Pricing APIs available from **API version 60.0** onwards.
- Pricing Waterfall `usageType` parameter available from **62.0**.
- API Execution Logs endpoint available from **63.0**.
- Pricing Process Execution endpoints available from **63.0**.
- ProrationPolicy sObject available from **67.0**.
- ProcedurePlanCriterion sObject available from **67.0**.
- processType on ProcedurePlanDefinition available from **63.0**.
- PBE Derived Pricing endpoint available from **61.0**.

### Critical Rules for jsonDataString
- You MUST stringify the JSON object before assigning it to `jsonDataString`. It is typed as `String` even though the content is JSON.
- The `businessObjectType` value in every node must match the sObject name in the ContextMapping — if it does not match, the hydration will silently fail or produce incorrect pricing.
- Keys in the outer payload (e.g., `"Cart"`, `"CartItem"`) must match the node names defined in the ContextMapping for the given `contextMappingId`.

### Context Instance Lifecycle
- Context instances created with `persistContext: false` are transient and cannot be reused.
- Context instances created with `persistContext: true` can be referenced by their ID in subsequent Price Context (POST) calls.
- Context instances with `useSessionScopedContext: true` are scoped to the current user session.

### Waterfall Behavior
- If price waterfall is **disabled** in Salesforce Pricing Setup, neither the Pricing (POST) nor the Price Context (POST) endpoints return waterfall details in their response.
- To get waterfall details when disabled from the response, use the separate Pricing Waterfall (GET) API if price waterfall persistence is enabled.
- The Pricing Waterfall (GET) returns `usageType: Pricing` by default; pass `usageType: Discovery` or `usageType: Rating` for those contexts.

### Procedure Plan Definitions — PATCH destroys unspecified properties
- When using PATCH on `/connect/procedure-plan-definitions/{id}`, any properties NOT included in the request body are **deleted** from the record. Always include all required fields even if unchanged.

### Delete Constraint on Procedure Plan Definitions
- A Procedure Plan Definition can only be deleted if it has **no active procedure plan versions**. Deactivate all versions first.

### processType Default
- If `processType` is unspecified in Procedure Plan Definition POST/PATCH, the value defaults to `Default`. License availability determines which values are valid in a given org.

### pricingProcedureId for Experience Cloud
- For Experience Cloud users, the `pricingProcedureId` must be the **name** (not ID) of the pricing procedure.
- For non-Experience Cloud, either the ID or API name can be used.

### Context Definition Developer Names vs. IDs
- In API calls like Pricing POST, `contextDefinitionId` takes the **Salesforce record ID** (e.g., `11Oxx...`).
- In Procedure Plan Definition Version creation, `contextDefinition` takes the **developer name string** (e.g., `SalesTransactionContext__stdctx`).
- These are different fields expecting different value types — do not confuse them.

### Pricing Sync
- If `pricingRecipeId` is omitted from Pricing Data Sync (GET), the **default pricing recipe** is synced.
- For partial sync, use the Decision Table Refresh Action in a Flow instead.

### High Volume Line Items
- Set `isHighVolumeLineItems: true` in configurationOverrides when processing large numbers of line items to enable optimized processing.

### Execution Type Enumeration
When calling Pricing Process Execution for Line Items, only `Pricing_Line` and `Discovery_Line` are valid for the `executionType` path parameter. The full-execution endpoint supports additional values: `API_Execution`, `Discovery`, `Discovery_Line`, `Pricing`, `Pricing_Line`.
