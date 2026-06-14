---
title: Revenue Cloud Product Configurator — Developer Deep Dive
scope: revenue-cloud configurator rules attributes bundles context lifecycle
api_version_min: "60.0"
api_version_current: "67.0"
source_pages: "947-1068 of revenue_lifecycle_management_dev_lates.pdf"
last_updated: "2026-06-13"
sobjects:
  - ExpressionSetConstraintObj
  - ProductConfigurationFlow
  - ProductConfigurationRule
  - SalesTransactionItemAttribute
  - SalesTrxnItemRelationship
  - ProductRelatedComponent
---

# Revenue Cloud Product Configurator — Developer Deep Dive

## Chapter Overview

Chapter 7 of the RLM Developer Guide covers the Product Configurator. The Configurator is **stateless** — it does not recall prior actions between API calls. Every call must supply the full context needed. This is the critical architectural difference from session-based configurators.

---

## Standard Objects

### ExpressionSetConstraintObj (v63.0+)

Links a Product (Product2) to constraint model tags used in the Constraint Modeling Language.

**Key fields:**

| Field | Type | Description |
|---|---|---|
| `ConstraintModelTag` | Picklist | Tag type. Valid values: `Port`, `Type` |
| `Name` | String | Name of the constraint object |
| `ProductId` | Lookup(Product2) | The product linked to this constraint |
| `Sequence` | Integer | Order of evaluation |

**Usage:** Used to associate products with constraint model ports/types so CML rules can reference them.

### ProductConfigurationFlow (v60.0+)

Defines configuration flows for products.

**Key fields:**

| Field | Type | Description |
|---|---|---|
| `FlowApiName` | String | API name of the Flow |
| `IsActive` | Boolean | Whether the flow is active |
| `Name` | String | Name of the configuration flow |
| `ProductId` | Lookup(Product2) | The product this flow applies to |
| `Sequence` | Integer | Execution order |
| `Type` | Picklist | Type of flow |

### ProductConfigurationRule (v61.0+)

The central object for defining configuration rules. Every rule has a definition, scope, and execution sequence.

**Key fields:**

| Field | Type | Description |
|---|---|---|
| `ConfigurationRuleDefinition` | LongTextArea | The criteria (conditions) and actions of the rule, encoded as a JSON/expression definition |
| `IsActive` | Boolean | Whether the rule is active |
| `Name` | String | Name of the rule |
| `ProcessScope` | Picklist | Valid values: `Bundle`, `Product` |
| `RuleSubType` | Picklist | Valid values: `BundleProduct`, `BundleProductClassification`, `Product`, `ProductClassification` |
| `RuleType` | Picklist | Valid values: `Configurator`, `Promotions` |
| `Sequence` | Integer | Execution order — **lower numbers execute first** |

**ProcessScope — Bundle vs Product:**
- `Bundle` — rule runs in the context of the entire bundle (parent + all child components)
- `Product` — rule runs on a single standalone product

**RuleSubType meanings:**
- `BundleProduct` — rule targets specific products within a bundle
- `BundleProductClassification` — rule targets product classifications within a bundle
- `Product` — rule targets a standalone product
- `ProductClassification` — rule targets a standalone product by its classification

---

## Business APIs

The Configurator exposes REST APIs under the base path `/services/data/vXX.X/connect/` (Salesforce Connect API).

All Configurator Business APIs are **stateless** — they do not remember prior invocations.

### API Endpoints Summary

| Method | Path | Version | Description |
|---|---|---|---|
| POST | `/revenue/product-configurator/configurations` | v60.0 | Configure (load-instance + full configure) |
| GET | `/revenue/product-configurator/configurations/instances/{contextId}` | v60.0 | Get instance |
| POST | `/revenue/product-configurator/configurations/instances` | v60.0 | Load instance |
| DELETE | `/revenue/product-configurator/configurations/instances/{contextId}` | v60.0 | Save instance (delete context) |
| POST | `/revenue/product-configurator/configurations/instances/{contextId}/nodes` | v60.0 | Add nodes |
| PATCH | `/revenue/product-configurator/configurations/instances/{contextId}/nodes` | v60.0 | Update nodes |
| DELETE | `/revenue/product-configurator/configurations/instances/{contextId}/nodes` | v60.0 | Delete nodes |
| POST | `/revenue/product-configurator/configurations/instances/{contextId}/quantity` | v60.0 | Set product quantity |
| POST | `/revenue/product-configurator/rules/actions/execute` | v67.0 | Execute config rules (standalone) |
| POST | `/revenue/product-configurator/configurations/saved` | v63.0 | Save named configuration |
| GET | `/revenue/product-configurator/configurations/saved` | v63.0 | List saved configurations |
| GET | `/revenue/product-configurator/configurations/saved/{savedConfigId}` | v63.0 | Get saved configuration |
| PUT | `/revenue/product-configurator/configurations/saved/{savedConfigId}` | v63.0 | Update saved configuration |
| DELETE | `/revenue/product-configurator/configurations/saved/{savedConfigId}` | v63.0 | Delete saved configuration |

---

## Configuration Instance Lifecycle

The configurator operates on a **context** (also called an instance or session):

```
1. load-instance  (POST /configurations/instances)
        ↓
2. configure / add-nodes / update-nodes / delete-nodes / set-quantity
        ↓  (repeat as needed — all stateless, pass contextId each time)
3. save-instance  (DELETE /configurations/instances/{contextId})
```

- **load-instance** creates the context from a transactionId (quote or order). Returns a `contextId` (UUID).
- **configure** (POST /configurations) is an all-in-one call that loads context AND applies changes in one request. It accepts `addedNodes`, `updatedNodes`, `deletedNodes` in a single payload.
- Every intermediate call requires passing the `transactionContextId` (the UUID returned from load-instance).
- **save-instance** (DELETE) commits the context back to the transaction and releases it.

**GOTCHA:** The `contextId` returned from load-instance is a UUID string (e.g. `"008d27d7-e004-4906-a949-ee7d7c323c77"`), not a Salesforce record ID. Do not confuse it with `transactionId` (the quote/order record ID).

---

## configuratorOptions — Full Reference

All boolean flags, all default to `false` if not specified:

```json
{
  "configuratorOptions": {
    "addDefaultConfiguration": true,
    "executeConfigurationRules": true,
    "executePricing": true,
    "explainabilityEnabled": true,
    "pricingProcedure": "MyPricingProcedureName",
    "qualifyAllProductsInTransaction": true,
    "returnProductCatalogData": true,
    "validateAmendRenewCancel": true,
    "validateProductCatalog": true
  }
}
```

| Option | Type | Version | Description |
|---|---|---|---|
| `addDefaultConfiguration` | Boolean | 60.0 | Adds default configurations for products. Set `true` on first load to pre-populate required components. |
| `executeConfigurationRules` | Boolean | 60.0 | Runs configuration rules (ProductConfigurationRule records). |
| `executePricing` | Boolean | 60.0 | Calls Salesforce Pricing Management to compute prices. |
| `explainabilityEnabled` | Boolean | 66.0 | Collects metadata about how the solver achieved the solution. Use Action Logs API to retrieve. Set up via Troubleshoot Product Configurations. |
| `pricingProcedure` | String | 60.0 | Name of the pricing procedure to use during API calls. |
| `qualifyAllProductsInTransaction` | Boolean | 60.0 | Runs qualification rules on ALL products in the context (`true`). If `false`, only qualifies the product being configured. |
| `returnProductCatalogData` | Boolean | 60.0 | Returns `catalogProducts` in the response. **Set `false` or omit when using the API without the Product Configurator UI** to avoid bloated payloads. |
| `validateAmendRenewCancel` | Boolean | 60.0 | Runs amend/renew/cancel-specific validations. |
| `validateProductCatalog` | Boolean | 60.0 | Runs validations against the product catalog. |

**Performance tip:** When building a backend integration (not driving a UI), set `returnProductCatalogData: false` and `executePricing: false` until you need prices. Each enabled option adds latency.

---

## contextResponseType — Critical for Large Transactions

Available from v65.0. **Required** for large sales transactions with more than 1000 line items and less than 15,000 line items.

| Value | Behavior |
|---|---|
| `Delta` | Returns only the sales transaction items that were **added or updated** in this call. Best performance for large transactions. |
| `Full` | Returns **all** sales transaction items in the transaction. Use for small transactions or when the caller needs the complete picture. |
| `None` | Returns an **empty** transaction context response. Use when you only need success/failure and don't need the line items back. |
| `Product` | Returns only the sales transaction items related to **the product being configured** in this call. |

**Performance rule:**
- Transactions < 1000 line items: `Full` is fine
- Transactions 1000–15000 line items: **must** use `Delta`, `None`, or `Product`
- `Delta` is the recommended default for integrations at scale

**GOTCHA:** Omitting `contextResponseType` on a large transaction will cause the API to return all line items by default, which can time out or exhaust memory.

---

## qualificationContext — Driving Qualification Rules

```json
{
  "qualificationContext": {
    "accountId": "001xx0000000001AAA",
    "contactId": "003xx00000000D7AAI",
    "contextId": "optional-session-context-id"
  }
}
```

| Field | Version | Description |
|---|---|---|
| `accountId` | 60.0 | ID of the account — used by qualification rules to restrict which products are available |
| `contactId` | 60.0 | ID of the contact — used by qualification rules |
| `contextId` | 60.0 | ID of the context representing the created session |

Setting `qualifyAllProductsInTransaction: true` with `qualificationContext` populated runs qualification rules against ALL products in the quote/order. This is needed when the qualification rules are account-specific (e.g., only show products for certain account segments).

---

## Node Path Semantics

Nodes in the configuration context are addressed by **path arrays** (arrays of Salesforce record IDs).

| businessObjectType | Path length | Path content |
|---|---|---|
| `QuoteLineItem` | 2 | `[quoteId, quoteLineItemId]` |
| `OrderItem` | 2 | `[orderId, orderItemId]` |
| `QuoteLineItemRelationship` | 3 | `[quoteId, quoteLineItemId, quoteLineItemRelationshipId]` |
| `OrderItemRelationship` | 3 | `[orderId, orderItemId, orderItemRelationshipId]` |

**Example paths:**
```json
"path": ["0Q0DE000000ISHJs81", "0QLDE000000IBXw4AO"]
"path": ["0Q0DE000000ISHJs81", "ref_sti2_id", "ref_stir1_id"]
```

Ref IDs (e.g. `"ref_sti2_id"`) are used for newly added nodes that don't yet have Salesforce record IDs.

---

## Configurator Add Nodes Input

When adding a new line item (QuoteLineItem):

```json
{
  "addedNodes": [
    {
      "path": ["0Q0DE000000ISHJs81", "sti2_id"],
      "addedObject": {
        "id": "ref_sti2_id",
        "SalesTransactionSource": "sti2_id",
        "PricebookEntry": "01uxx0000000001AAA",
        "ProductSellingModel": "0jPxx0000000001AAA",
        "businessObjectType": "QuoteLineItem",
        "Quantity": 10,
        "UnitPrice": 2.0,
        "Product": "01txx0000000001AAA"
      }
    },
    {
      "path": ["0Q0DE000000ISHJs81", "ref_sti2_id", "ref_stir1_id"],
      "addedObject": {
        "id": "ref_stir1_id",
        "businessObjectType": "QuoteLineItemRelationship",
        "MainItem": "0QLDE000000IBXw4AO",
        "AssociatedItem": "ref_sti2_id",
        "ProductRelatedComponent": "0dSxx0000000001AAA",
        "ProductRelationshipType": "0yoxx0000000001AAA",
        "AssociatedItemPricing": "IncludedInBundlePrice"
      }
    }
  ]
}
```

**AssociatedItemPricing values:**
- `IncludedInBundlePrice` — component price is rolled up into the bundle price
- `NotIncludedInBundlePrice` — component is priced separately

**AssociatedQuantScaleMethod values:**
- `Proportional` — child quantity scales proportionally with parent quantity

---

## Configurator Update Nodes Input

```json
{
  "updatedNodes": [
    {
      "path": ["0Q0DE000000ISHJs81", "0QLDE000000IBXw4AO"],
      "updatedAttributes": {
        "Quantity": 5
      }
    }
  ]
}
```

The `updatedAttributes` map supports any fields from the Sales Transaction context definition, including custom fields in an extended context definition.

---

## Configurator Delete Nodes Input

```json
{
  "deletedNodes": [
    {
      "path": ["0Q0DE000000ISHJs81", "0QLDE000000IBXw4AO"]
    }
  ]
}
```

---

## Full Configurator Input (POST /configurations)

This is the all-in-one configure endpoint. It initiates a new context or modifies an existing one:

```json
{
  "transactionLineId": "0QLDE000000IBXw4AO",
  "transactionId": "0Q0DU0000000001GAA",
  "correlationId": "c95246d4-102c-4ecd-a263-f74ac525d1e5",
  "configuratorOptions": {
    "executePricing": true,
    "returnProductCatalogData": true,
    "qualifyAllProductsInTransaction": true,
    "validateProductCatalog": true,
    "validateAmendRenewCancel": true,
    "executeConfigurationRules": true,
    "addDefaultConfiguration": true
  },
  "contextResponseType": "Full",
  "qualificationContext": {
    "accountId": "001xx0000000001AAA",
    "contactId": "003xx00000000D7AAI"
  },
  "transactionContextId": "008d27d7-e004-4906-a949-ee7d7c323c77",
  "addedNodes": [...],
  "updatedNodes": [...],
  "deletedNodes": [...]
}
```

**Required fields:** `transactionId` is required.
**Optional but common:** `transactionContextId` (if continuing an existing context), `contextResponseType` (required for 1000+ line items).

---

## Configuration Rule Input (POST /rules/actions/execute) — v67.0

Execute configuration rules independently of the full configure flow:

```json
{
  "transactionContextId": "008d27d7-e004-4906-a949-ee7d7c323c77",
  "transactionId": "0Q0DU0000005tJh0AI",
  "ruleOptions": {
    "isUpdateContextRequired": false
  }
}
```

**Fields:**

| Field | Required | Description |
|---|---|---|
| `transactionContextId` | Required if `transactionId` not given | ID of the existing context instance |
| `transactionId` | Required if `transactionContextId` not given | ID of the quote or order |
| `ruleOptions.isUpdateContextRequired` | Optional (v67.0) | Whether context update is required (auto add/delete capability). Set `false` when Place Sales Transaction API is invoked with configuration enabled — avoids redundant context logic execution. |

---

## Saved Configurations (Named Configurations) — v63.0

### Save a configuration

```json
POST /revenue/product-configurator/configurations/saved
{
  "data": "<JSON string of the sales transaction>",
  "description": "This configuration is saved for reuse.",
  "name": "Favorite Configuration",
  "referenceRecordId": "01txx00000006iCFAAY"
}
```

The `data` field is the full sales transaction JSON serialized as a **string**. The `referenceRecordId` is the product record the configuration is associated with.

### List saved configurations

```
GET /revenue/product-configurator/configurations/saved?referenceRecordId=01txx00000006iCFAAY
```

**Response:**
```json
{
  "errors": [],
  "savedConfigurations": [
    {
      "data": "<serialized transaction JSON>",
      "description": "This configuration is saved for reuse.",
      "id": "1Nyxx0000004CFUCA2",
      "name": "Favorite Configuration",
      "referenceRecordId": "01txx00000006iCFAAY"
    }
  ],
  "success": true
}
```

### Save response

```json
{
  "errors": [],
  "id": "1Nyxx0000004CNYCA2"
}
```

Error case:
```json
{
  "errors": [{
    "code": "INTERNAL_SERVER_ERROR",
    "message": "INVALID_REFERENCEOBJECTID"
  }]
}
```

---

## Response Bodies — Complete Reference

### Configuration Details (POST /configurations response)

Top-level structure:

```json
{
  "catalogProducts": { ... },
  "errors": [],
  "messages": { "<productId>": [ ... ] },
  "productRecommendations": [ ... ],
  "success": true,
  "transactionContext": { "SalesTransaction": [ ... ] },
  "transactionContextId": "cda87acd-45ed-4913-903e-9dd33cec85a6",
  "transactionContextMappingId": "11jxx0000004LwOAAU",
  "transactionQualification": { "<productId>": { ... } },
  "uiTreatments": [ ... ]
}
```

| Property | Type | Version | Description |
|---|---|---|---|
| `catalogProducts` | ConfiguratorProductCatalog[] | 61.0 | Product catalog structure |
| `errors` | ConnectApiErrorResponse[] | 60.0 | List of errors with message and error code |
| `messages` | Map<String, ConfiguratorMessage>> | 60.0 | Messages from validation, BRE, or Pricing calls. Keyed by product ID. |
| `productRecommendations` | ConfiguratorProductRecommendations[] | 65.0 | List of product recommendations |
| `success` | Boolean | 60.0 | Whether the request was successful |
| `transactionContext` | Map<String, Object> | 60.0 | Serialized JSON of the transaction |
| `transactionContextId` | String | 60.0 | ID of the transaction context |
| `transactionContextMappingId` | String | 60.0 | ID of the context mapping |
| `transactionQualification` | Map<String, ConfiguratorQualificationContext> | 60.0 | Map of product IDs to qualification context |
| `uiTreatments` | ConfiguratorUITreatment[] | 62.0 | UI treatment overrides from configuration rules |

### ConfiguratorMessage

Messages from validation, Business Rules Engine (BRE), or Salesforce Pricing. Returned in the `messages` map keyed by product ID.

```json
{
  "messages": {
    "0Q0xx0000004CDsCAM": [
      {
        "message": "This is a quote with warranty",
        "messageType": "Info",
        "category": "ConfigurationRules",
        "primaryRecordId": "0Q0xx0000004CDsCAM"
      },
      {
        "message": "It is a group 1C9xx0000004CCGCA2",
        "messageType": "Warning",
        "category": "ConfigurationRules",
        "primaryRecordId": "0Q0xx0000004CDsCAM",
        "groupByValue": "1C9xx0000004CCGCA2"
      }
    ]
  }
}
```

**ConfiguratorMessage properties:**

| Property | Type | Version | Description |
|---|---|---|---|
| `category` | String | 60.0 | Category of the message. Valid values: `ArcResolutionService`, `ArcValidationService`, `BundleValidation`, `ConfigurationRules`, `Pricing` |
| `groupByValue` | String | 67.0 | Value from Constraint Modeling Language rule action details (used for CML group messages) |
| `message` | String | 60.0 | The message text |
| `messageType` | String | 60.0 | Valid values: `Error`, `Info`, `Warning` |
| `primaryRecordId` | String | 60.0 | Primary record ID that contains the error |
| `relatedRecordId` | String | 60.0 | Related record ID for the error, if any |

**GOTCHA:** The `messages` object is keyed by product ID at the top level, and each value is an array of ConfiguratorMessage. A single product can generate multiple messages from different categories.

### ConfiguratorUITreatment

UI treatments from configuration rule actions that override the disable or hide behavior in the UI for product options, product attributes, and attribute picklist values.

```json
{
  "uiTreatments": [
    {
      "details": {
        "attributeId": "0tjxx0000000007AAA",
        "prcId": "0dSxx0000000007EAA",
        "stiId": "0QLxx0000004CU0GAM",
        "attributePicklistValueId": "0v6xx0000000005AAA"
      },
      "uiTreatmentScope": "Bundle",
      "uiTreatmentTarget": "Attribute_Picklist_Value",
      "uiTreatmentType": "Hide"
    },
    {
      "details": {
        "stiId": "ref_f0f2da7b_c431_482d_bf4b_599052f3a2e1"
      },
      "uiTreatmentScope": "Product",
      "uiTreatmentTarget": "Component",
      "uiTreatmentType": "Disable"
    }
  ]
}
```

**uiTreatmentScope values:** `Bundle`, `Product`
**uiTreatmentTarget values:** `Attribute_Picklist_Value`, `Component`, and others
**uiTreatmentType values:** `Hide`, `Disable`

### ConfiguratorProductRecommendations (v65.0)

```json
{
  "productRecommendations": [
    {
      "referenceId": "CORE_BUNDLE_001",
      "productIds": [
        "01t000000001234",
        "01t000000005678"
      ]
    }
  ]
}
```

| Property | Version | Description |
|---|---|---|
| `referenceId` | 65.0 | Reference ID for the recommendation set |
| `productIds` | 65.0 | List of recommended product IDs |

---

## Configurator Attribute Structure

Attributes are organized hierarchically: **Attribute Categories** contain **Attributes**, which may have **Attribute Picklists** with **Picklist Values**.

### Attribute Category (ConfiguratorAttributeCategory)

```json
{
  "attributeCategories": [
    {
      "attributes": [ ... ],
      "code": "SPEC",
      "description": "Server Rack Specifications",
      "id": "0v3xx0000000001AAA",
      "name": "Server Rack Specifications",
      "status": "Active",
      "totalSize": 3,
      "usageType": "..."
    }
  ]
}
```

| Property | Type | Version | Description |
|---|---|---|---|
| `attributes` | ConfiguratorAttribute[] | 60.0 | Attributes in this category |
| `code` | String | 60.0 | Code of the attribute category |
| `description` | String | 60.0 | Description |
| `id` | String | 60.0 | ID of the attribute category |
| `name` | String | 60.0 | Name |
| `status` | String | 60.0 | Status |
| `totalSize` | Integer | 60.0 | Total number of attributes |
| `usageType` | String | 60.0 | Usage type |

### Attribute (ConfiguratorAttribute)

Full attribute structure returned in response:

```json
{
  "attributeCategoryId": "0v3xx0000000001AAA",
  "attributeNameOverride": "Load Capacity",
  "code": "CAP",
  "dataType": "NUMBER",
  "defaultValue": "1500",
  "description": "Server racks support 500 kg to 1500 kg",
  "id": "0tjxx00000001DpAAI",
  "isCloneable": false,
  "isConfigurable": true,
  "isEncrypted": false,
  "isHidden": false,
  "isPriceImpacting": false,
  "isReadOnly": false,
  "isRequired": false,
  "label": "Load Capacity",
  "maximumValue": "...",
  "minimumValue": "...",
  "name": "Load Capacity",
  "sequence": 0,
  "status": "Active",
  "stepValue": "...",
  "unitOfMeasure": [ ... ],
  "userValue": "...",
  "valueDecoder": "...",
  "valueDescription": "..."
}
```

**Key boolean flags on attributes:**

| Flag | Meaning |
|---|---|
| `isConfigurable` | Whether the attribute can be configured by the user |
| `isHidden` | Whether the attribute is hidden in the UI (can be overridden by uiTreatments) |
| `isPriceImpacting` | Whether changing this attribute affects pricing |
| `isReadOnly` | Whether the attribute is read-only |
| `isRequired` | Whether the attribute must have a value |
| `isCloneable` | Whether the attribute can be cloned |
| `isEncrypted` | Whether the attribute value is encrypted |

**dataType valid values** (observed in PDF): `NUMBER`, `MULTIPICKLIST`, and standard Salesforce data types.

**unitOfMeasure** property (v63.0): `ConfiguratorUnitOfMeasure[]` — details about the unit of measure associated with the attribute.

### Attribute Picklist (ConfiguratorAttributePicklist)

When `dataType` is `MULTIPICKLIST` (or other picklist types), the attribute contains an `attributePicklist`:

```json
{
  "attributePicklist": {
    "id": "0v5xx0000000001AAA",
    "description": "...",
    "name": "...",
    "status": "Active",
    "values": [
      {
        "code": "MEM",
        "displayValue": "25",
        "id": "0v6xx0000000001AAA",
        "isBooleanValue": false,
        "label": "...",
        "name": "25Mem",
        "sequence": 0,
        "status": "...",
        "textValue": "25"
      }
    ]
  }
}
```

**ConfiguratorAttributePicklistValue properties:**

| Property | Type | Version | Description |
|---|---|---|---|
| `code` | String | 60.0 | Code of the attribute value |
| `description` | String | 60.0 | Description |
| `displayValue` | String | 60.0 | Display value shown in UI |
| `id` | String | 60.0 | ID of the attribute value |
| `isBooleanValue` | Boolean | 60.0 | Whether this is a boolean value |
| `label` | String | 60.0 | Label |
| `name` | String | 60.0 | Name |
| `sequence` | Integer | 60.0 | Sequence (sort order) |
| `status` | String | 60.0 | Status |
| `textValue` | String | 60.0 | Text representation of the value |

**GOTCHA on picklist visibility:** UI treatments can `Hide` specific picklist values for specific line items. This is how visibility rules manifest — the value exists in the catalog but is hidden for a particular product/bundle context.

---

## SalesTransactionItemAttribute — How Attribute Values Are Stored

When a line item has attribute values set, they appear in `SalesTransactionItemAttribute` records in the `transactionContext`:

```json
{
  "SalesTransactionItemAttribute": [
    {
      "AttributeKey": "0tjxx00000001H3AAI",
      "AttributeValue": "30.0",
      "AttributePicklistValue": null,
      "IsPriceImpacting": true,
      "businessObjectType": "QuoteLineItemAttribute",
      "AttributeName": "Expansion Slots",
      "AttributeDefinitionCode": "SLOTCAP",
      "id": "0zuxx0000000001AAA",
      "SalesTransactionItemAttrParent": "0QLxx0000004CQmGAM"
    }
  ]
}
```

Key fields: `AttributeKey` (ID of the attribute definition), `AttributeValue` (the current value), `AttributeDefinitionCode` (the attribute's code field), `IsPriceImpacting`, `businessObjectType` (e.g. `QuoteLineItemAttribute`).

---

## SalesTrxnItemRelationship — Bundle Component Relationships

Bundle component relationships appear in `SalesTrxnItemRelationship` within the transactionContext:

```json
{
  "SalesTrxnItemRelationship": [
    {
      "ProductRelationshipType": "0yoxx00000001IfAAI",
      "MainItemRole": "Bundle",
      "AssociatedItem": "0QLxx0000004CQnGAM",
      "ProductRelatedComponent": "0dSxx0000000001EAA",
      "MainItem": "0QLxx0000004CQmGAM",
      "AssociatedQuantScaleMethod": "Proportional",
      "businessObjectType": "QuoteLineRelationship",
      "AssociatedItemRole": "BundleComponent",
      "SalesTrnItemRelationshipParent": "0Q0xx0000004CAeCAM",
      "id": "0yQxx000000001dEAA",
      "AssociatedItemPricing": "NotIncludedInBundlePrice"
    }
  ]
}
```

---

## ProductComponentGroup — Bundle Component Groups

A product component group is a named group within a bundle that organizes related components. Think of it as a "slot" or "category" within the bundle.

**Response structure:**
```json
{
  "productComponentGroups": [
    {
      "classifications": [],
      "code": "SERVICE",
      "components": [ ... ],
      "description": "...",
      "id": "0y7xx000000001dAAA",
      "maxBundleComponents": 1,
      "minBundleComponents": 0,
      "name": "Services",
      "parentProductId": "01txx0000006jkuAAA",
      "sequence": 1
    }
  ]
}
```

| Property | Type | Version | Description |
|---|---|---|---|
| `classifications` | ConfiguratorProductClassification[] | 60.0 | Classifications for the group |
| `code` | String | 60.0 | Code of the component group |
| `components` | ConfiguratorProductCatalog[] | 60.0 | Products within the component group |
| `maxBundleComponents` | Integer | 60.0 | Maximum number of components allowed |
| `minBundleComponents` | Integer | 60.0 | Minimum number of components required |
| `name` | String | 60.0 | Name of the group |
| `parentProductId` | String | 60.0 | ID of the parent bundle product |
| `sequence` | Integer | 60.0 | Order within the bundle |

**Bundle constraint enforced by:** `minBundleComponents` and `maxBundleComponents` constrain how many components from this group can be selected.

---

## ProductRelatedComponent — Component Relationship Details

```json
{
  "productRelatedComponent": {
    "childProductId": "01txx0000006jmWAAQ",
    "childSellingModelId": "0jPxx000000004rEAA",
    "doesBundlePriceIncludeChild": true,
    "id": "0dSxx000000001dEAA",
    "isComponentRequired": false,
    "isDefaultComponent": false,
    "isQuantityEditable": false,
    "maxQuantity": null,
    "minQuantity": null,
    "parentProductId": "01txx0000006jkuAAA",
    "parentSellingModelId": "0jPxx000000004rEAA",
    "productComponentGroupId": "0y7xx000000001dAAA",
    "productRelationshipTypeId": "0yoxx00000001fAAI",
    "quantity": 1,
    "quantityScaleMethod": "Proportional",
    "quoteVisibility": "Quote Document Only",
    "sequence": 0
  }
}
```

**quoteVisibility values** (v64.0):
- `Always` — always shown
- `Transaction Line Editor Only` — shown only in quote line editor
- `Quote Document Only` — shown only in quote proposal document
- `Never` — never shown

Only returned when the `CoreCPQ` permission set is available.

**quantityScaleMethod values:** `Constant`, `Proportional`

---

## Configuration Rule Execution — Rules Execution Order

Configuration rules execute in the order defined by the `Sequence` field on `ProductConfigurationRule`:

1. Rules with **lower Sequence numbers execute first**
2. Within the same Sequence number, order is not guaranteed
3. Rules filtered by `RuleType = Configurator` are the standard configuration rules
4. `ProcessScope = Bundle` rules run against the bundle context (parent + children)
5. `ProcessScope = Product` rules run against a single product

**Best practice:** Use increments of 10 for sequence numbers (10, 20, 30...) to leave room for insertion without renumbering.

---

## Bundle vs Standalone Configuration

### Bundle Configuration
- Parent product has `nodeType: "bundleProduct"` in the catalog response
- `ProductComponentGroups` is non-empty
- Components have `businessObjectType: "QuoteLineItemRelationship"` in the path
- Rules with `ProcessScope = Bundle` apply to the entire bundle tree
- `addedNodes` must include BOTH the line item node AND the relationship node

### Standalone (Simple Product) Configuration
- Product has `nodeType: "simpleProduct"`
- No `productComponentGroups`
- Rules with `ProcessScope = Product` apply
- `addedNodes` only need the line item node (no relationship node)

**GOTCHA:** When adding a bundle component, you must add two nodes in the same request: (1) the child QuoteLineItem with a `ref_` ID, then (2) the QuoteLineItemRelationship referencing that `ref_` ID. Order matters — the relationship node's path must include the ref ID of the product node added in the same request.

---

## UI Treatment Rules — Visibility and Disable

Configuration rules can generate `uiTreatments` that drive UI behavior:

- **`uiTreatmentType: "Hide"`** — hides the target from the UI
- **`uiTreatmentType: "Disable"`** — disables (makes read-only) the target in the UI

**`uiTreatmentTarget` values** (observed):
- `Attribute_Picklist_Value` — hides/disables a specific picklist option
- `Component` — hides/disables a bundle component

**`uiTreatmentScope` values:**
- `Bundle` — the treatment applies at the bundle level
- `Product` — the treatment applies at the product level

These are returned in `configuratorUITreatments` (Load Instance, Set Instance, Add Nodes, Delete Nodes, Update Nodes responses, v62.0).

**GOTCHA:** UI treatments do NOT prevent the user from submitting a value via the API — they are display hints only. Backend validation rules are separate.

---

## Validation Messages — RunAndAllowErrors vs RunAndBlockErrors

While the PDF does not use the explicit terms "RunAndAllowErrors" and "RunAndBlockErrors" for the Configurator (those terms come from Expression Sets), the configurator handles rule execution errors as follows:

- When `executeConfigurationRules: true`, rules run and produce messages in the `messages` map
- Messages with `messageType: "Error"` indicate blocking errors (the configuration is invalid)
- Messages with `messageType: "Warning"` are advisory but don't block the operation
- Messages with `messageType: "Info"` are informational

The `category` field identifies the source:
- `ConfigurationRules` — from ProductConfigurationRule execution
- `BundleValidation` — from bundle structure validation
- `ArcResolutionService` — from the Constraint Modeling Language arc resolution
- `ArcValidationService` — from CML arc validation
- `Pricing` — from Salesforce Pricing calls

The API returns `success: true` even when there are warning messages. Only when there are error-level problems will `success: false` be returned.

---

## explainabilityEnabled — Configuration Action Logs (v66.0)

Setting `explainabilityEnabled: true` in `configuratorOptions` collects metadata about how the solver (rules engine) achieved the solution. Retrieve via the **Action Logs API**. Must set up "Troubleshoot Product Configurations" in org setup first.

Use this for debugging rule execution issues — it shows which rules fired, in what order, and what actions they took.

---

## Constraint Modeling Language (CML) — ExpressionSetConstraintObj Integration

The CML works with `ExpressionSetConstraintObj` records that link products to constraint model tags (`Port` or `Type`).

When CML rules fire, they produce messages with:
- `category: "ArcResolutionService"` or `category: "ArcValidationService"`
- `groupByValue` field (v67.0): Contains the value from CML rule action details — used to correlate messages with specific constraint model groups

The `groupByValue` field was introduced specifically to surface CML group information in the `ConfiguratorMessage` — e.g. `"groupByValue": "1C9xx0000004CCGCA2"` identifies the constraint group that triggered the message.

---

## Performance Tips for Large Bundles

1. **Use `contextResponseType: "Delta"`** for transactions with 1000+ line items. Never use `Full` above this threshold.

2. **Set `returnProductCatalogData: false`** when you don't need the catalog (backend integrations). The catalog response is large and adds significant payload.

3. **Set `explainabilityEnabled: false`** (default) in production. Only enable for debugging.

4. **Set `qualifyAllProductsInTransaction: false`** if you only need to qualify the product being configured — running qualification on all products is expensive.

5. **Batch `addedNodes`**: Add the bundle parent and all its components in a single `addedNodes` array in one API call rather than multiple sequential calls.

6. **Use `isUpdateContextRequired: false`** in `ruleOptions` when calling the Config Rules execute endpoint after Place Sales Transaction — avoids double execution of context logic.

7. **`executeConfigurationRules: false`** for read-only loads: When loading context just to display current state (no user changes yet), disabling rule execution speeds up load-instance.

8. **`executePricing: false`** until final: Run pricing only when needed (e.g., after all attributes are set). Each pricing call is expensive.

9. **Sequence rules carefully**: Keep Sequence gaps between rules (use 10, 20, 30...). Rules with conflicting actions at the same sequence level can produce unpredictable results.

10. **ProcessScope selection**: Use `ProcessScope = Product` rules where possible. Bundle-scoped rules must traverse the entire component tree and are more expensive.

---

## Common Rule Conflict Patterns

1. **Inclusion + Exclusion conflict**: If Rule A (Seq 10) includes component X and Rule B (Seq 20) excludes component X, Rule B wins (last write wins within a transaction, with higher sequence executing later). Design inclusion/exclusion rules to be mutually exclusive by conditions.

2. **Visibility rules vs validation rules**: A `Hide` UI treatment on a required attribute causes UI confusion — the user can't see/set a required attribute. Ensure required attributes are never hidden.

3. **Bundle-scoped rules firing on standalone products**: If `ProcessScope = Bundle` rules have loose criteria, they may fire even when the product has no bundle context. Add explicit bundle-checking conditions.

4. **qualifyAllProductsInTransaction** + large quotes: Enabling this on a 500-line quote re-runs qualification on all 500 products. Only enable when account-based product visibility is critical.

5. **Multiple messages for same product**: Multiple rules can fire and each adds to the messages array for that product. Client code must iterate the full message array, not just check `[0]`.

---

## ExpressionSetConstraintObj — Setup Pattern

To link a product to the CML:

```
1. Create ExpressionSetConstraintObj record
   - ProductId = your Product2 record
   - ConstraintModelTag = "Port" (for connection points) or "Type" (for type classification)
   - Name = descriptive name
   - Sequence = execution order

2. The CML expression set references these tags
3. When configurator runs with executeConfigurationRules: true, CML rules evaluate
4. Results appear in messages[] with category ArcResolutionService/ArcValidationService
5. groupByValue (v67.0) in the message identifies the CML group
```

---

## Saved Configuration Error Codes

| Code | Meaning |
|---|---|
| `INTERNAL_SERVER_ERROR` with message `INVALID_REFERENCEOBJECTID` | The `referenceRecordId` in the save request is not a valid Product2 ID |

---

## Version Constraint Summary

| Feature | Minimum Version |
|---|---|
| Base Configurator APIs (configure, load-instance, add/update/delete nodes) | v60.0 |
| ProductConfigurationRule object | v61.0 |
| catalogProducts in response | v61.0 |
| uiTreatments in responses | v62.0 |
| ExpressionSetConstraintObj | v63.0 |
| Saved configurations (named configurations) | v63.0 |
| quoteVisibility on ProductRelatedComponent | v64.0 |
| contextResponseType (required for large transactions) | v65.0 |
| productRecommendations in response | v65.0 |
| explainabilityEnabled option | v66.0 |
| Config Rules execute endpoint + ruleOptions + groupByValue in messages | v67.0 |

---

## Endpoint Quick Reference

```
# Load instance (create context)
POST /connect/revenue/product-configurator/configurations/instances
Body: { "transactionId": "...", "configuratorOptions": {...}, "qualificationContext": {...} }

# All-in-one configure
POST /connect/revenue/product-configurator/configurations
Body: { "transactionId": "...", "configuratorOptions": {...}, "contextResponseType": "Delta", ... }

# Add nodes
POST /connect/revenue/product-configurator/configurations/instances/{contextId}/nodes
Body: { "configuratorOptions": {...}, "qualificationContext": {...}, "addedNodes": [...] }

# Update nodes
PATCH /connect/revenue/product-configurator/configurations/instances/{contextId}/nodes
Body: { "configuratorOptions": {...}, "contextId": "...", "updatedNodes": [...] }

# Delete nodes
DELETE /connect/revenue/product-configurator/configurations/instances/{contextId}/nodes
Body: { "configuratorOptions": {...}, "contextId": "...", "deletedNodes": [...] }

# Set quantity (convenience endpoint)
POST /connect/revenue/product-configurator/configurations/instances/{contextId}/quantity
Body: { "contextId": "...", "quantity": 20, "transactionLinePath": "Quote.QuoteLineItem.Quantity" }

# Save instance (commit and release context)
DELETE /connect/revenue/product-configurator/configurations/instances/{contextId}

# Execute config rules standalone
POST /connect/revenue/product-configurator/rules/actions/execute
Body: { "transactionContextId": "...", "transactionId": "...", "ruleOptions": { "isUpdateContextRequired": false } }

# Saved configurations
POST   /connect/revenue/product-configurator/configurations/saved
GET    /connect/revenue/product-configurator/configurations/saved?referenceRecordId=...
GET    /connect/revenue/product-configurator/configurations/saved/{id}
PUT    /connect/revenue/product-configurator/configurations/saved/{id}
DELETE /connect/revenue/product-configurator/configurations/saved/{id}
```

---

## Key sObject Reference Summary

| sObject | Key Field | Notes |
|---|---|---|
| `ProductConfigurationRule` | `Sequence`, `ProcessScope`, `RuleType`, `ConfigurationRuleDefinition` | Core rule definition object |
| `ExpressionSetConstraintObj` | `ConstraintModelTag` (Port/Type), `ProductId` | Links product to CML |
| `ProductConfigurationFlow` | `FlowApiName`, `ProductId` | Links Flow to product for config |
| `SalesTransactionItemAttribute` | `AttributeKey`, `AttributeValue`, `AttributeDefinitionCode` | Stores attribute values on line items |
| `SalesTrxnItemRelationship` | `AssociatedItemPricing`, `MainItemRole`, `AssociatedItemRole` | Bundle component relationships |
| `ProductRelatedComponent` | `doesBundlePriceIncludeChild`, `isDefaultComponent`, `quantityScaleMethod` | Catalog component relationship |
