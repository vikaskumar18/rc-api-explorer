---
name: revenue-cloud-cpq-developer
description: Revenue Cloud CPQ & Discovery Developer Guide — Revenue Cloud Developer Guide PDF (2026-06-13)
metadata:
  type: reference
---

# Revenue Cloud CPQ & Discovery Developer Guide

Source: Revenue Lifecycle Management Developer Guide PDF, pages 285–406 (scanned 2026-06-13).

---

## 1. Product Discovery Business APIs — Overview

All Product Discovery Business APIs use **POST** method. They are composite APIs that combine product lookup, pricing, and qualification in a single call.

### Base Paths

| API | Base Path |
|-----|-----------|
| Catalog List | `/services/data/vXX.X/revenue/product-discovery/catalogs` |
| Catalog Details | `/services/data/vXX.X/revenue/product-discovery/catalogs/{catalogId}` |
| Category List | `/services/data/vXX.X/revenue/product-discovery/catalogs/{catalogId}/categories` |
| Category Details | `/services/data/vXX.X/revenue/product-discovery/catalogs/{catalogId}/categories/{categoryId}` |
| Products List | `/services/data/vXX.X/revenue/product-discovery/catalogs/{catalogId}/products` |
| Product Details | `/services/data/vXX.X/revenue/product-discovery/catalogs/{catalogId}/products/{productId}` |
| Product Bulk Details | `/services/data/vXX.X/revenue/product-discovery/products/bulk` |
| Global Search | `/services/data/vXX.X/revenue/product-discovery/products/search` |
| Guided Selection | `/services/data/vXX.X/revenue/product-discovery/products/guided-selection` |
| Product Qualification | `/services/data/vXX.X/revenue/product-discovery/products/qualification` |
| **Product Recommendations** | `/services/data/vXX.X/revenue/product-discovery/products/recommendations` |

**Critical:** Product Recommendations uses a different base path from all other Discovery APIs. It does NOT use the `/catalogs/` path segment.

---

## 2. Qualification Rules — Setup and Evaluation

### 2.1 Setup Toggle vs API Property

- **Setup toggle** ("Enable Qualification Procedure" in Product Discovery Settings) acts as the **org-level override**.
- When the Setup toggle is **OFF**, `enableQualification: true` in the API request body is **ignored** — qualification never runs.
- When the Setup toggle is **ON**, you can still suppress qualification per-call by sending `enableQualification: false`.
- Same pattern applies for pricing: Setup toggle ("Enable Pricing Procedure") overrides `enablePricing`.

### 2.2 Qualification Procedure Selection

Two ways to specify which qualification procedure runs:

1. **Default org procedure**: configured in Setup — used when `qualificationProcedure` is absent in the request.
2. **Per-call override**: pass `qualificationProcedure: "ProcedureName"` in the request body to use a specific named procedure.

```json
{
  "enableQualification": true,
  "qualificationProcedure": "ProductQualification"
}
```

### 2.3 Where qualificationContext Appears in Responses

Every product and category in the response carries a `qualificationContext` block:

```json
"qualificationContext": {
  "isQualified": true
}
```

- `isQualified: true` — product/category passed all qualification rules for the given account/contact context.
- `isQualified: false` — product/category exists in the catalog but does NOT pass qualification (e.g., not eligible for this account segment, territory, or contract).
- Categories also carry `qualificationContext` — a category can be unqualified even if individual products within it would pass.

### 2.4 Qualification on Product Qualification Endpoint

The `/products/qualification` endpoint runs qualification procedure against a supplied list of product IDs. Response contains one result per product:

```json
{
  "result": [
    { "productId": "01txx0000006i7PAAQ", "qualificationContext": { "isQualified": true } },
    { "productId": "01txx0000006i7QAAQ", "qualificationContext": { "isQualified": true } }
  ]
}
```

This endpoint requires `contextId` (session context ID) in the response — set via `userContext.contextId` in the request.

### 2.5 Common Qualification Rule Pitfalls

- Sending `enableQualification: true` when the Setup toggle is OFF silently skips qualification — products appear without filtering.
- Omitting `accountId` from `userContext` causes qualification rules that reference account fields (segment, industry, territory) to evaluate against a null account — most rules will return `false` or throw.
- The `contextDefinition` and `contextMapping` fields feed the qualification expression set with named context nodes. If a qualification rule references a context node not present in `contextDefinition`/`contextMapping`, the rule will fail to evaluate.
- `additionalContextData` supplements context but is capped at **10 nodes** across all endpoints. Exceeding 10 nodes causes an API error.
- Using `ProductAttributeDefinition` in `additionalFields` — if the fields requested are not available for `ProductClassificationAttr`, the entire API call fails.

---

## 3. Guided Selection — Mechanics and Response Chaining

### 3.1 Request Input Options

The Guided Selection API accepts either `guidedSelectionResponseId` OR `searchTerms` — they are mutually exclusive in terms of outcome:

- `guidedSelectionResponseId`: ID of a prior guided selection response. Use this to **continue or refine** a previous session.
- `searchTerms`: array of `{ term, tags[] }` objects representing the current search intent.

**Precedence rule**: If BOTH `guidedSelectionResponseId` and `searchTerms` are provided, **`searchTerms` wins** — the response ID is ignored.

### 3.2 searchTerms Format

```json
"searchTerms": [
  { "term": "IPhone", "tags": ["deviceType", "mobile"] },
  { "term": "4GB",    "tags": ["RAM"] },
  { "term": "64GB",   "tags": ["Storage"] }
]
```

- `term`: the text search term.
- `tags`: optional array of attribute/dimension tags that narrow the context for the term.

### 3.3 Response Chaining via guidedSelectionResponseId

The Guided Selection response returns:
- `cursor`: pagination cursor for the current result set.
- `searchTerms[]`: the terms that were resolved (echoed back in the response).
- `result[]`: matching products.

To chain: take the `guidedSelectionResponseId` from a previous call's response (if the API returns one) and supply it in the next call to refine results from that context without re-sending full `searchTerms`.

**Practical flow:**
```
Call 1: searchTerms=[{term:"IPhone"}] → get products + guidedSelectionResponseId
Call 2: guidedSelectionResponseId=<from call 1>, searchTerms=[{term:"4GB"}] → searchTerms override wins
Call 2 (no searchTerms): guidedSelectionResponseId=<from call 1> → continues from prior context
```

### 3.4 Guided Selection Response Structure

```json
{
  "apiStatus": { "statusCode": "FETCHED_DETAILS_SUCCESSFULLY" },
  "correlationId": "corrId",
  "cursor": "MTAwMDAwMDAwNg==",
  "searchTerms": [
    { "term": "IPhone", "tags": ["deviceType","mobile"] },
    { "term": "4GB",    "tags": ["RAM"] }
  ],
  "result": [ /* product objects with qualificationContext, prices, etc. */ ]
}
```

The `searchTerms` in the **response** echo back the terms with their resolved tags — useful for confirming which terms drove which results.

### 3.5 Guided Selection vs Product Recommendations

| Dimension | Guided Selection | Product Recommendations |
|-----------|-----------------|------------------------|
| Base path | `.../products/guided-selection` | `.../products/recommendations` |
| Input driver | searchTerms / guidedSelectionResponseId | transactionId / filter criteria |
| userContext type | Single `UserContextInput` object | Array `UserContextInput[]` |
| catalogId required | Yes | No |
| priceBookId | Optional | Optional |
| Primary use case | Guided selling questionnaire flow | Cross-sell / upsell from existing transaction |
| enableQualification | Supported | Supported |
| enablePricing | Supported | Supported |
| Facets in response | No (not in guided selection) | No |
| Returns searchTerms | Yes (echoed back) | No |

---

## 4. Product Recommendations API

### 4.1 Endpoint and Method

```
POST /services/data/vXX.X/revenue/product-discovery/products/recommendations
```

### 4.2 Request Body

```json
{
  "currencyCode": "USD",
  "enablePricing": true,
  "enableQualification": true,
  "filter": {
    "criteria": [
      { "property": "isActive",    "operator": "eq", "value": true },
      { "property": "isQualified", "operator": "eq", "value": true }
    ]
  },
  "limit": 12,
  "priceBookId": "01sSG0000DQCjhYAH",
  "transactionId": "0Q0SG0000014Ui5OAE",
  "userContext": [
    {
      "accountId": "001xx0000000001AAA",
      "contactId": "003xx00000000D7AAI",
      "contextId": "e055bb18-d4e8-41c3-881e-0132b9561708"
    }
  ]
}
```

**Key differences from other Discovery APIs:**
- `userContext` is an **array** (`UserContextInput[]`), not a single object.
- `transactionId` links recommendations to an existing quote/order.
- No `catalogId` — recommendations are cross-catalog by design.
- `usePromotions` field (v66.0+): default `true` if Promotion feature enabled, `false` if not.

---

## 5. Filter Operators and Indexed Data Behavior

### 5.1 Standard Filter Operators

| Operator | Applicable Types | Available From |
|----------|-----------------|----------------|
| `eq`       | All types       | v60.0          |
| `in`       | All types       | v60.0          |
| `contains` | String          | v60.0 (NOT when indexed data enabled) |
| `gt`       | Number, Date, Datetime | v63.0   |
| `lt`       | Number, Date, Datetime | v63.0   |
| `gte`      | Number, Date, Datetime | v63.0   |
| `lte`      | Number, Date, Datetime | v63.0   |

### 5.2 Indexed Data Toggle Effects

The "Use Indexed Data For Product Listing and Search" org setting changes filter behavior:

| Behavior | Indexed OFF | Indexed ON |
|----------|-------------|------------|
| `contains` operator | Supported | **NOT supported** — causes error |
| `orderBy` options | Any indexed field | **Only `name` field allowed** |
| Performance | Standard SOQL | Faster index scan |

**When indexed data is ON:**
- Never use `contains` — replace with `eq` or `in`.
- `orderBy` must be `["name:asc"]` or `["name:desc"]`.

### 5.3 FilterCriteriaInput Structure

```json
{
  "criteria": [
    {
      "attributeType": "ProductStandard",
      "property": "name",
      "operator": "eq",
      "value": "iPhone"
    }
  ]
}
```

**`attributeType` valid values** (v63.0+):
- `ProductStandard` — standard Product2 fields
- `ProductCustom` — custom Product2 fields
- `ProductDynamicAttribute` — dynamic attributes (ProductAttribute object)
- `ProductAttributeStandard` — standard ProductAttributeDefinition fields
- `ProductAttributeCustom` — custom ProductAttributeDefinition fields

### 5.4 relatedObjectFilters

Used on Products List and Global Search to filter by `ProductSpecificationRecType`:

```json
"relatedObjectFilters": [
  {
    "objectName": "ProductSpecificationRecType",
    "criteria": [
      { "property": "IsCommercial", "operator": "eq", "value": true }
    ]
  }
]
```

`IsCommercial` is the key property — filters products to only those with a commercial product specification record type.

---

## 6. contextDefinition, contextMapping, and additionalContextData

### 6.1 When contextDefinition Is Required

| Endpoint | contextDefinition requirement |
|----------|------------------------------|
| Products List | Optional (used to route to correct expression set) |
| Product Details | Optional |
| Global Search | Optional |
| Guided Selection | Optional |
| Product Recommendations | Not used |
| Catalog/Category endpoints | Not used |

If your qualification or pricing procedure relies on a named context definition (e.g., `BrowseContextDefinitionExt`), you must supply it — otherwise the procedure runs against the default context.

### 6.2 contextMapping

Works alongside `contextDefinition`. Specifies the mapping name that maps request data to context nodes consumed by the expression set. Example:

```json
{
  "contextDefinition": "BrowseContextDefinitionExt",
  "contextMapping": "ProductDiscoveryMapping"
}
```

### 6.3 additionalContextData

Provides extra named data nodes for expression sets. Max 10 nodes across all endpoints.

```json
"additionalContextData": [
  { "nodeName": "Account", "nodeData": { "id": "001DU000001o2UzYAI", "name": "Cloud Kicks" } },
  { "nodeName": "Contract", "nodeData": { "id": "xxxxx231", "name": "Contract1" } }
]
```

- `nodeName` maps to a context node name defined in the Context Definition.
- `nodeData` is a `Map<String, Object>` — any key-value pairs the expression set expects.
- Exceeding 10 nodes causes an API error.

---

## 7. priceBookId — Effects on Discovery

### 7.1 Role of priceBookId in Discovery APIs

`priceBookId` tells the API which price book to use when resolving prices for returned products. Without it:
- Products are returned but `prices[]` array may be empty or contain only standard/default price book entries.
- If multi-currency is enabled and `currencyCode` is provided, prices are filtered to the specified currency within the resolved price book.

### 7.2 priceBookId Across Endpoints

| Endpoint | priceBookId behavior |
|----------|---------------------|
| Catalog List | Not used |
| Catalog Details | Not used |
| Category List | Not used |
| Category Details | Not used |
| Products List | Optional — filters prices to this book |
| Product Details | Optional — filters prices to this book |
| Product Bulk Details | Optional |
| Global Search | Optional |
| Guided Selection | Optional |
| Product Recommendations | Optional |
| Product Qualification | Not used |

### 7.3 Catalog vs Price Book Relationship

- A **Catalog** (`ProductCatalog`) organizes products into categories for browsing. It has no direct link to a price book.
- A **Price Book** (`Pricebook2`) stores price entries (`PricebookEntry`) for products.
- The relationship is many-to-many: one product can be in multiple catalogs and multiple price books.
- When you pass `catalogId` + `priceBookId` together, the API returns products that exist in that catalog AND have entries in that price book.
- When `priceBookId` is omitted, all price book entries for the product are returned in `prices[]`.

### 7.4 Price Response Structure

```json
"prices": [
  {
    "currencyIsoCode": "USD",
    "isDefault": false,
    "isSelected": true,
    "price": 100,
    "priceBookEntryId": "01luxx0000008zUkAAI",
    "priceBookId": "01sxx0000005qxxAAA",
    "pricingModel": {
      "id": "0jPxx000000009hEAA",
      "name": "OneTime",
      "pricingModelType": "OneTime"
    }
  },
  {
    "currencyIsoCode": "USD",
    "isDefault": true,
    "isSelected": false,
    "price": 15,
    "priceBookEntryId": "01luxx0000008zUmAAI",
    "priceBookId": "01sxx0000005qxxAAA",
    "pricingModel": {
      "frequency": "Months",
      "id": "0jPxx000000009iEAA",
      "name": "Monthly",
      "occurrence": 1,
      "pricingModelType": "TermDefined"
    }
  }
]
```

- `isSelected: true` — the price selected based on `priceBookId` + `productSellingModelId` context.
- `isDefault: true` — the default price book entry for the product.
- `pricingModelType` values: `OneTime`, `TermDefined`, `Recurring`.

---

## 8. Promotion Eligibility

### 8.1 usePromotions Flag

- Added in **v66.0**.
- Default: `true` if Promotions feature is enabled for the org; `false` if not.
- Passing `usePromotions: false` explicitly disables promotion eligibility evaluation for the call.

### 8.2 eligiblePromotions in Responses

Category and product responses include `eligiblePromotions[]` when promotions are active:

```json
"eligiblePromotions": [
  {
    "id": "0ZPxx0000000001AAA",
    "name": "Summer_Sale_2025",
    "displayName": "Summer Electronics Sale",
    "description": "Get 20% off on all Samsung devices",
    "priority": 100,
    "startDateTime": "2025-06-01T00:00:00Z",
    "endDateTime": "2025-08-31T23:59:59Z",
    "isAutomatic": true,
    "isCategoryPromo": true,
    "isProductPromo": false,
    "couponCode": null,
    "termsAndConditions": "Valid on all Samsung products. Cannot be combined with other offers."
  },
  {
    "id": "0ZPxx0000000002AAA",
    "name": "Electronics_Bundle",
    "displayName": "Bundle & Save",
    "description": "Save 15% when you buy 2 or more items",
    "priority": 90,
    "startDateTime": "2025-05-15T00:00:00Z",
    "endDateTime": "2025-12-31T23:59:59Z",
    "isAutomatic": false,
    "isCategoryPromo": false,
    "isProductPromo": true,
    "couponCode": "BUNDLE15",
    "termsAndConditions": "Minimum 2 items required."
  }
]
```

### 8.3 Promotion Fields Reference

| Field | Type | Description |
|-------|------|-------------|
| `isAutomatic` | Boolean | If `true`, promotion applies automatically — no coupon required |
| `isCategoryPromo` | Boolean | Promotion is defined at category level |
| `isProductPromo` | Boolean | Promotion is defined at product level |
| `couponCode` | String/null | Coupon code required (null if automatic) |
| `priority` | Integer | Higher number = higher priority in stacking/exclusion evaluation |
| `startDateTime` / `endDateTime` | ISO 8601 | Active date window |

### 8.4 Promotion Evaluation Scope

- Category-level promotions (`isCategoryPromo: true`) appear in category details responses.
- Product-level promotions (`isProductPromo: true`) appear in product list / product details responses.
- A product response from Guided Selection also returns `eligiblePromotions[]` per product.

---

## 9. userContext Fields and Timing

### 9.1 Standard UserContext (Single Object)

Used by: Catalog Details, Category endpoints, Products List, Product Details, Global Search, Guided Selection, Product Qualification.

```json
"userContext": {
  "accountId": "001xx0000000001AAA",
  "contactId": "003xx00000000D7AAI",
  "contextId": "e055bb18-d4e8-41c3-881e-0132b9561708"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `accountId` | Recommended | Salesforce Account ID — drives account-specific qualification rules and pricing |
| `contactId` | Optional | Salesforce Contact ID — used for contact-specific rules |
| `contextId` | Optional | Session context ID for stateful scenarios (e.g., product configurator sessions) |

### 9.2 Product Recommendations UserContext (Array)

```json
"userContext": [
  {
    "accountId": "001xx0000000001AAA",
    "contactId": "003xx00000000D7AAI",
    "contextId": "e055bb18-d4e8-41c3-881e-0132b9561708"
  }
]
```

The array form allows passing multiple user contexts for batch recommendations — one recommendation set per context entry.

### 9.3 When accountId Is Critical

- Qualification rules that check account fields (Account.Industry, Account.Type, Account.BillingCountry) require `accountId`.
- Without `accountId`, expression set nodes that depend on Account data will evaluate against null values.
- If `accountId: null` is explicitly passed (see visibility rules example below), qualification runs in anonymous mode — rules must handle null account gracefully.

```json
"userContext": { "accountId": null }
```

### 9.4 contextId Usage

- `contextId` represents a previously established session (e.g., from a prior Product Configurator call).
- Used to maintain state across chained calls — the backend can retrieve context data stored in that session.
- Not the same as the `contextId` returned in the response (which is the ID of the API execution context).

---

## 10. Version-Gated Features Quick Reference

| Feature / Field | Available From | Endpoint(s) |
|-----------------|---------------|-------------|
| `facets` in response | v63.0 | Global Search, Products List |
| `gt`, `lt`, `gte`, `lte` operators | v63.0 | All filter-supporting endpoints |
| `attributeType` in FilterCriteriaInput | v63.0 | All filter-supporting endpoints |
| `usePromotions` | v66.0 | Products List, Global Search, Guided Selection, Product Details |
| `transactionId` | v66.0 | Products List, Global Search, Guided Selection, Product Recommendations |
| `transactionContextId` | v67.0 | Products List, Global Search, Guided Selection |
| `executeConfigurationRules` | v67.0 | Products List, Global Search, Guided Selection |
| Catalog response fields (catalogCode, catalogType, description, effectiveEndDate, effectiveStartDate, status) | v67.0 | Catalog List, Catalog Details |
| Category response fields (name, parentCategoryId, qualificationContext, sortOrder in list) | v67.0 | Category List |
| ProductCatalogManagementSettings metadata type | v64.0 | Metadata API |
| ProductSpecificationType Tooling API object | v60.0 | Tooling API |
| ProductSpecificationRecType Tooling API object | v60.0 | Tooling API |

---

## 11. executeConfigurationRules

Added in v67.0. Available on Products List, Global Search, Guided Selection.

```json
{
  "executeConfigurationRules": true
}
```

When `true`, configuration rules are evaluated for each product and returned in `configurationRules[]`:

```json
"configurationRules": [
  {
    "details": [
      { "message": "32GB RDIMM disables 128GB LRDIMM" }
    ],
    "type": "disable"
  }
]
```

- `type` values: `disable`, `require`, `recommend`, `exclude`.
- `details[].message`: human-readable explanation of the rule effect.
- `childVariationIds[]`: variation IDs affected by the rule.

---

## 12. additionalFields

### 12.1 Purpose

Request extra fields beyond the default response payload for specified objects.

### 12.2 Products List / Global Search

```json
"additionalFields": {
  "Product2": {
    "fields": ["CanRamp", "DecompositionScope", "ProductCode"]
  }
}
```

### 12.3 Product Details (Extended)

```json
"additionalFields": {
  "ProductSellingModelOption": {
    "additionalFields": {
      "ProrationPolicy": {
        "fields": ["ArePartialPeriodsAllowed", "ProrationPolicyType"]
      }
    }
  },
  "Product2": { "fields": ["field1", "field2"] },
  "ProductAttributeDefinition": { "fields": ["field3", "field4"] }
}
```

**Warning**: If `ProductAttributeDefinition` fields are requested but are not available for `ProductClassificationAttr`, the entire API call fails — not just the field. Validate field availability before including.

### 12.4 Response additionalFields Structure

In the response, `additionalFields` is a flat map keyed by API name:

```json
"additionalFields": {
  "DecompositionScope": "OrderLineItem",
  "ProductCode": "LPB001",
  "CanRamp": false
}
```

---

## 13. Response Type Reference

### 13.1 CPQ Base List (for list endpoints)

```json
{
  "apiStatus": { "messages": [], "statusCode": "FetchedDetailsSuccessfully" },
  "correlationId": "...",
  "cursor": "MTAwMDAwMDAwNg==",
  "facets": [],
  "limit": 10,
  "offSet": 0,
  "query": {},
  "result": [],
  "total": 4,
  "userContext": {}
}
```

| Field | Type | Description |
|-------|------|-------------|
| `cursor` | String | Base64 position cursor for pagination (use in next request's `cursor` param) |
| `facets` | SearchProductsFacet[] | Faceted attribute aggregations (v63.0+) |
| `offSet` | Integer | Offset used in this response |
| `query` | Map | Echo of query parameters used |
| `total` | Integer | Total matching records count |

### 13.2 CPQ Base Details (for single-entity endpoints)

```json
{
  "apiStatus": { "messages": [], "statusCode": "FetchedDetailsSuccessfully" },
  "contextId": "...",
  "correlationId": "...",
  "result": {},
  "userContext": {}
}
```

### 13.3 Bulk Product Details Response

```json
{
  "apiStatus": { "statusCode": "FetchedDetailsSuccessfully" },
  "contextId": "...",
  "correlationId": "...",
  "result": [
    {
      "additionalFields": {},
      "attributeCategories": [],
      "attributes": [],
      "catalogs": [],
      "childProducts": [],
      "id": "01txx0000006ivJAAQ",
      "isActive": true,
      "isAssetizable": true,
      "isSoldOnlyWithOtherProds": false,
      "name": "iPhone12",
      "nodeType": "simpleProduct",
      "prices": [],
      "productClassification": {},
      "productCode": "iPhone12",
      "productComponentGroups": [],
      "productSellingModelOptions": [],
      "productSpecificationType": {
        "name": "ProdSpecRecType1",
        "productSpecificationRecordType": {}
      },
      "qualificationContext": { "isQualified": true }
    }
  ]
}
```

### 13.4 CPQ Base List for Guided Selection

```json
{
  "apiStatus": { "statusCode": "FETCHED_DETAILS_SUCCESSFULLY" },
  "correlationId": "corrId",
  "cursor": "MTAwMDAwMDAwNg==",
  "searchTerms": [],
  "result": []
}
```

### 13.5 Guided Selection Search Term (output type)

```json
{
  "searchTerms": [
    { "term": "IPhone", "tags": ["deviceType", "mobile"] },
    { "term": "4GB",    "tags": ["RAM"] },
    { "term": "64GB",   "tags": ["Storage"] }
  ]
}
```

Fields: `displayName` (String, v63.0+), `nameOrId` (String, v63.0+).

### 13.6 Search Products Facet (v63.0+)

```json
{
  "facets": [
    {
      "attributeType": "ProductStandard",
      "displayName": "Product Type",
      "displayRank": 2,
      "nameOrId": "Type",
      "values": [
        { "displayName": "Bundle", "nameOrId": "Bundle" }
      ]
    },
    {
      "attributeType": "ProductDynamicAttribute",
      "displayName": "Display",
      "displayRank": 3,
      "nameOrId": "0tjDU0000003K5BYAU",
      "values": [
        { "displayName": "1080p Built-in Display", "nameOrId": "1080p Built-in Display" },
        { "displayName": "2k Built-in Display",    "nameOrId": "2k Built-in Display" }
      ]
    }
  ]
}
```

- Facet `nameOrId`: for `ProductStandard` it's the field API name; for `ProductDynamicAttribute` it's the attribute record ID.
- `displayRank`: controls UI sort order.

### 13.7 CPQ Message (error/warning type)

| Field | Valid Values |
|-------|-------------|
| `code` | `CartValidationError` |
| `severity` | `Error`, `Info`, `Warning` |
| `message` | Text of the API message |
| `detail` | Additional required details |

---

## 14. Product Object Fields Reference

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Product2 ID |
| `name` | String | Product name |
| `nodeType` | String | `simpleProduct` or `bundleProduct` |
| `productType` | String | `Bundle` or `Simple` (v67.0+) |
| `productClass` | String | `Simple` etc. |
| `productCode` | String | Product code |
| `isActive` | Boolean | Whether product is active |
| `isAssetizable` | Boolean | Whether product can be assetized |
| `isSoldOnlyWithOtherProds` | Boolean | Cannot be sold standalone |
| `configureDuringSale` | String | `Allowed` or `Required` |
| `description` | String | Product description |
| `displayUrl` | String | Image URL for the product |
| `catalogs[]` | Array | Catalogs containing this product |
| `categories[]` | Array | Categories the product belongs to |
| `childProducts[]` | Array | Child products (for bundles) |
| `childVariationIds[]` | Array | Variation IDs for configurable products (v67.0+) |
| `productComponentGroups[]` | Array | Component group structure for bundles |
| `productSellingModelOptions[]` | Array | Available selling models |
| `prices[]` | Array | Price entries (filtered by priceBookId if provided) |
| `productClassification` | Object | Classification data |
| `productSpecificationType` | Object | Spec type with name and productSpecificationRecordType |
| `attributeCategories[]` | Array | Attribute category groupings |
| `attributes[]` | Array | Product attributes |
| `qualificationContext` | Object | `{ isQualified: true/false }` |
| `eligiblePromotions[]` | Array | Eligible promotions (when usePromotions=true) |
| `configurationRules[]` | Array | Config rules (when executeConfigurationRules=true, v67.0+) |
| `productUnitOfMeasures[]` | Array | Unit of measure options |
| `additionalFields` | Object | Extra fields from additionalFields request param |

---

## 15. ProductSellingModelOption Fields

```json
{
  "id": "0iOxx00000000EfEAI",
  "productId": "01txx0000006ivJAAQ",
  "productSellingModelId": "0jPxx000000009iEAA",
  "isDefault": true,
  "productSellingModel": {
    "id": "0jPxx000000009iEAA",
    "name": "Monthly",
    "pricingTerm": 1,
    "pricingTermUnit": "Months",
    "sellingModelType": "TermDefined",
    "status": "Active",
    "doesAutoRenewByDefault": false
  }
}
```

`sellingModelType` values: `OneTime`, `TermDefined`, `Evergreen`.

---

## 16. Catalog Details Response (v67.0+ fields)

```json
{
  "result": {
    "catalogCode": "Mobiles",
    "catalogType": "Sales",
    "description": "Catalog for mobile phones",
    "effectiveEndDate": "2028-04-01T19:00Z",
    "effectiveStartDate": "2024-04-01T19:00Z",
    "id": "0ZSxx0000000001GAA",
    "name": "Mobiles",
    "numberOfCategories": 3
  }
}
```

Fields `catalogCode`, `catalogType`, `description`, `effectiveEndDate`, `effectiveStartDate`, `status` were added in v67.0.

---

## 17. Category Details Response

```json
{
  "result": {
    "catalogId": "0ZSxx0000000001GAA",
    "childCategories": [],
    "description": "Category for Samsung phones",
    "id": "0ZGxx000000004rGAA",
    "name": "Samsung",
    "isNavigational": true,
    "sortOrder": 2,
    "qualificationContext": { "isQualified": true },
    "eligiblePromotions": []
  }
}
```

Category List (v67.0+) adds: `name`, `parentCategoryId`, `qualificationContext`, `sortOrder`.

---

## 18. Comprehensive Request Examples

### 18.1 Products List (Full)

```json
{
  "catalogId": "0ZSDU00000002Og74AE",
  "categoryId": "0ZGDU0000002P0H4AU",
  "priceBookId": "01sDU000000JVsVYAW",
  "productClassificationId": "11BDU0000002TCC2A2",
  "currencyCode": "USD",
  "userContext": { "accountId": "001DU000001o2UzYAI" },
  "enableQualification": true,
  "enablePricing": true,
  "qualificationProcedure": "ProductQualification",
  "pricingProcedure": "pricingProcedure",
  "contextDefinition": "BrowseContextDefinitionExt",
  "contextMapping": "ProductDiscoveryMapping",
  "filter": {
    "criteria": [
      { "property": "name", "operator": "eq", "value": "Laptop Pro Bundle" }
    ]
  },
  "relatedObjectFilters": [
    {
      "objectName": "ProductSpecificationRecType",
      "criteria": [
        { "property": "IsCommercial", "operator": "eq", "value": true }
      ]
    }
  ],
  "additionalContextData": [
    { "nodeName": "Account", "nodeData": { "id": "001DU000001o2UzYAI", "name": "Cloud Kicks" } }
  ],
  "additionalFields": {
    "Product2": { "fields": ["CanRamp", "DecompositionScope", "ProductCode"] }
  },
  "limit": 20,
  "offset": 0,
  "orderBy": ["name:asc"],
  "executeConfigurationRules": true,
  "usePromotions": true,
  "transactionId": "0Q0DU000001190f0AA",
  "includeCatalogDetails": true
}
```

### 18.2 Visibility Rules Request (Products List / Global Search / Guided Selection)

```json
{
  "enableQualification": true,
  "enablePricing": true,
  "includeCatalogDetails": true,
  "catalogId": "0ZSVW000000AhdC4AS",
  "limit": 12,
  "offset": 0,
  "userContext": { "accountId": null },
  "priceBookId": "01sVW0000024PZ1YAM",
  "currencyCode": "USD",
  "transactionId": "0Q0VW000001190f0AA",
  "filter": {
    "criteria": [
      { "property": "isActive",  "operator": "eq", "value": true },
      { "property": "UsedFor",   "operator": "eq", "value": "" }
    ]
  },
  "orderBy": ["name:asc"],
  "executeConfigurationRules": true
}
```

### 18.3 Product Details (Full)

```json
{
  "correlationId": "9cbb9650-48c5-11ed-96d1-0afcf185843b",
  "catalogId": "0ZSxx0000000001GAA",
  "priceBookId": "01s260000022T71AAG",
  "productSellingModelId": "0jP1Q000000CaVFUA0",
  "userContext": { "accountId": "001xx0000000001AAA", "contactId": "003xx00000000D7AAI" },
  "enablePricing": true,
  "enableQualification": true,
  "qualificationProcedure": "QualificationProcedure",
  "pricingProcedure": "Preview",
  "contextDefinition": "TestDefinition",
  "contextMapping": "TestDefinitionNode",
  "additionalFields": {
    "ProductSellingModelOption": {
      "additionalFields": {
        "ProrationPolicy": { "fields": ["ArePartialPeriodsAllowed", "ProrationPolicyType"] }
      }
    },
    "Product2": { "fields": ["field1", "field2"] },
    "ProductAttributeDefinition": { "fields": ["field3", "field4"] }
  },
  "additionalContextData": [
    { "nodeName": "Contract", "nodeData": { "id": "xxxxx231", "name": "Contract1" } },
    { "nodeName": "Lead",     "nodeData": { "id": "111111131", "name": "Lead1" } }
  ]
}
```

### 18.4 Guided Selection (Full)

```json
{
  "correlationId": "corrId",
  "catalogId": "0ZSxx0000000001GAA",
  "priceBookId": "pricebookId",
  "limit": 10,
  "cursor": "MTAwMDAwMDAwNg==",
  "userContext": { "accountId": "accId" },
  "guidedSelectionResponseId": "ABCxx0000000001GAA",
  "searchTerms": [
    { "term": "IPhone", "tags": ["deviceType", "mobile"] },
    { "term": "4GB",    "tags": ["RAM"] },
    { "term": "64GB",   "tags": ["Storage"] }
  ],
  "enableQualification": true,
  "enablePricing": true,
  "includeCatalogDetails": false
}
```

### 18.5 Catalog Details Request

```json
{
  "correlationId": "9cbb9650-48c5-11ed-96d1-0afcf185843b",
  "userContext": {
    "accountId": "001xx0000000001AAA",
    "contactId": "003xx00000000D7AAI"
  }
}
```

---

## 19. Metadata Types

### 19.1 ProductCatalogManagementSettings (v64.0+)

```xml
<ProductCatalogManagementSettings xmlns="http://soap.sforce.com/2006/04/metadata">
  <productDeepCloneContextDefOrgValue>ProductDeepCloneContextDefinition</productDeepCloneContextDefOrgValue>
  <productDeepCloneExpressionSetOrgValue>ProductDeepCloneExpressionSet</productDeepCloneExpressionSetOrgValue>
</ProductCatalogManagementSettings>
```

### 19.2 ProductSpecificationRecType (Tooling API, v60.0)

```xml
<ProductSpecificationRecType xmlns="http://soap.sforce.com/2006/04/metadata">
  <masterLabel>sample</masterLabel>
  <recordType>Product2.Offer</recordType>
  <productSpecificationType>Placeholder</productSpecificationType>
  <isCommercial>true</isCommercial>
</ProductSpecificationRecType>
```

- `isCommercial`: controls whether the ProductSpecificationRecType appears in `relatedObjectFilters` results.
- `productSpecificationType`: references a `ProductSpecificationType` Tooling API record (v60.0).

---

## 20. Multi-Currency Behavior

- `currencyCode` is **Required** when multiple currencies are enabled for the org.
- When `currencyCode` is provided, `prices[]` is filtered to entries matching that currency.
- Without multi-currency enabled, `currencyCode` is ignored.
- `currencyIsoCode` in each price entry reflects the actual currency of that price book entry.

---

## 21. Pagination

### cursor-based (preferred, v60.0+)

```json
{ "cursor": "MTAwMDAwMDAwNg==" }
```

Pass `cursor` from the previous response's `cursor` field. More stable than offset for large catalogs.

### offset-based (v60.0+)

```json
{ "limit": 10, "offset": 20 }
```

Standard skip-take pagination. `offSet` (capital S) is the response field name — note the inconsistent casing.

---

## 22. includeCatalogDetails

When `includeCatalogDetails: true`, the product list response includes the parent catalog and category information in each product's `catalogs[]` and `categories[]` arrays, including `qualificationContext` per category.

---

## 23. API Status Codes

| statusCode | Meaning |
|------------|---------|
| `FetchedDetailsSuccessfully` | Standard success (most endpoints) |
| `FETCHED_DETAILS_SUCCESSFULLY` | Guided Selection success (uppercase variant) |
| `CartValidationError` | Validation error in CPQ Message |

---

## 24. Key Developer Rules Summary

1. All Product Discovery Business APIs use **POST**.
2. Setup toggles override API `enableQualification`/`enablePricing` flags — check org settings first.
3. `contains` operator is **blocked** when "Use Indexed Data" org setting is ON.
4. When indexed data is ON, `orderBy` can only use the `name` field.
5. `searchTerms` always wins over `guidedSelectionResponseId` when both are present.
6. Product Recommendations `userContext` is an **array** — not a single object.
7. `additionalContextData` max is **10 nodes** — exceeding causes API failure.
8. `ProductAttributeDefinition` in `additionalFields` — field availability must be validated against `ProductClassificationAttr` or the call fails.
9. `priceBookId` scopes the `prices[]` array but does not filter which products are returned.
10. `eligiblePromotions[]` appears in response only when `usePromotions` is `true` (default when feature enabled).
11. `configurationRules[]` appears only when `executeConfigurationRules: true` (v67.0+).
12. Category `qualificationContext.isQualified` can be `false` even when individual products in it would qualify.
13. `currencyCode` becomes Required when multi-currency is enabled.
14. Facets in response require v63.0+ and appear on list/search endpoints only.
