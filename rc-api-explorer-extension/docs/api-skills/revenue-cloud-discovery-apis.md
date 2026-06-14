---
name: revenue-cloud-discovery-apis
description: Complete API reference for Revenue Cloud Product Discovery (CPQ) — all 11 endpoints, params, versions from PDF pages 285-406, scan date 2026-06-13
metadata:
  type: reference
---

# Revenue Cloud Product Discovery (CPQ) Business APIs

## Source
PDF: revenue_lifecycle_management_dev_lates.pdf (2917 pages)
Section: Pages 285–406
Scanned: 2026-06-13

---

## Endpoints

### Global Search (Products Search)
- Method: POST
- Path: `/connect/cpq/products/search`
- Version: v60.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | query | Map<String,Object> | **Required** | 60.0 | Query to search products — THIS IS REQUIRED |
  | additionalContextData | Context Data Input[] | Optional | 60.0 | Extra context nodes. Max 10 |
  | additionalFields | Map<String,Additional Fields Input> | Optional | 61.0 | Extra Product2 fields in response |
  | catalogId | String | Optional | 60.0 | Filter by catalog |
  | categoryId | String | Optional | 60.0 | Filter by category |
  | contextDefinition | String | Optional | 60.0 | Custom context definition API name |
  | contextMapping | String | Optional | 60.0 | Context mapping — API validates it belongs to contextDefinition |
  | correlationId | String | Optional | 60.0 | Tracking token |
  | currencyCode | String | Optional | 60.0 | Currency for pricing/filtering |
  | cursor | String | Optional | 60.0 | Position ID for pagination |
  | enablePricing | Boolean | Optional | 60.0 | Enable pricing. Default: true. Overridden by Pricing Procedure toggle |
  | enableQualification | Boolean | Optional | 60.0 | Enable qualification. Default: true. Overridden by Qualification Procedure toggle |
  | executeConfigurationRules | Boolean | Optional | 67.0 | Execute configuration rules |
  | filter | Filter Input | Optional | 60.0 | Operators: eq, in, contains (not with indexed), gt, lt, gte, lte. Multiple combined with AND |
  | includeCatalogDetails | Boolean | Optional | 61.0 | Include catalog details in response |
  | limit | Integer | Optional | 60.0 | Items to return. Default: 10 |
  | offset | Integer | Optional | 60.0 | Reserved for internal use |
  | orderBy | String[] | Optional | 60.0 | Sort: asc/desc. With indexed: name only |
  | priceBookId | String | Optional | 60.0 | Price book ID. Default: standard price book |
  | pricingProcedure | String | Optional | 60.0 | Custom pricing procedure API name |
  | productClassificationId | String | Optional | 60.0 | Filter by product classification |
  | qualificationProcedure | String | Optional | 60.0 | Custom qualification procedure API name |
  | relatedObjectFilter | Related Object Filter Input[] | Optional | 60.0 | Filter on ProductSpecificationRecType.IsCommercial (singular, not plural) |
  | searchTerm | String | Optional | 62.0 | Products where name contains this term |
  | transactionContextId | String | Optional | 66.0 | Sales transaction context instance ID |
  | transactionId | String | Optional | 66.0 | Quote or order ID |
  | usePromotions | Boolean | Optional | 66.0 | Fetch GPM promotions. Default: true if feature enabled |
  | userContext | User Context Input | Optional | 60.0 | accountId, contactId |
- Response: CPQ Base List — products matching query with faceted results

---

### Catalog List (CPQ)
- Method: POST
- Path: `/connect/cpq/catalogs`
- Version: v60.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | correlationId | String | Optional | 60.0 | Tracking token |
  | limit | Integer | Optional | 60.0 | Items to include |
  | offset | Integer | Optional | 60.0 | Offset for pagination |
  | orderBy | String[] | Optional | 60.0 | Sort order |
  | userContext | User Context Input | Optional | 60.0 | accountId, contactId |
- Response: CPQ Base List — catalog list

---

### Catalog Details (CPQ)
- Method: POST
- Path: `/connect/cpq/catalogs/{catalogId}`
- Version: v60.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | catalogId | String | Required | 60.0 | Path param — catalog ID |
  | correlationId | String | Optional | 60.0 | Tracking token |
  | userContext | User Context Input | Optional | 60.0 | accountId, contactId |
- Response: CPQ Base List — single catalog details

---

### Categories List (CPQ)
- Method: POST
- Path: `/connect/cpq/categories`
- Version: v60.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | catalogId | String | Optional | 60.0 | Filter by catalog |
  | correlationId | String | Optional | 60.0 | Tracking token |
  | userContext | User Context Input | Optional | 60.0 | accountId, contactId |
  | usePromotions | Boolean | Optional | 66.0 | Fetch GPM promotions. Default: true if feature enabled |
- Response: CPQ Base List — category list

---

### Category Details (CPQ)
- Method: POST
- Path: `/connect/cpq/categories/{categoryId}`
- Version: v60.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | categoryId | String | Required | 60.0 | Path param — category ID |
  | additionalContextData | Context Data Input | Optional | 60.0 | Extra context nodes. Max 10 |
  | catalogId | String | Optional | 60.0 | Catalog ID for pricing context |
  | contextDefinition | String | Optional | 60.0 | Custom context definition API name |
  | contextMapping | String | Optional | 60.0 | Context mapping API name |
  | customFields | String[] | Optional | 60.0 | Category fields to retrieve |
  | correlationId | String | Optional | 60.0 | Tracking token |
  | enableQualification | Boolean | Optional | 60.0 | Default: true |
  | filter | Filter Input | Optional | 60.0 | Filter on name. Operators: eq, in, contains, gt, lt, gte, lte |
  | qualificationProcedure | String | Optional | 60.0 | Custom qualification procedure |
  | userContext | User Context Input | Optional | 60.0 | accountId, contactId |
  | usePromotions | Boolean | Optional | 66.0 | Fetch GPM promotions |
- Response: CPQ Base List — category details with products

---

### Products List (CPQ)
- Method: POST
- Path: `/connect/cpq/products`
- Version: v60.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | priceBookId | String | **Required** | 60.0 | Price book ID. Default: standard price book if unspecified |
  | additionalContextData | Context Data Input[] | Optional | 60.0 | Extra context nodes. Max 10 |
  | additionalFields | Map<String,Additional Fields Input> | Optional | 61.0 | Extra Product2 fields |
  | catalogId | String | Optional | 60.0 | Filter by catalog |
  | categoryId | String | Optional | 60.0 | Filter by category |
  | contextDefinition | String | Optional | 60.0 | Custom context definition |
  | contextMapping | String | Optional | 60.0 | Context mapping |
  | correlationId | String | Optional | 60.0 | Tracking token |
  | currencyCode | String | Optional | 60.0 | Currency for pricing. Required if multi-currency enabled |
  | cursor | String | Optional | 60.0 | Pagination position ID |
  | enablePricing | Boolean | Optional | 60.0 | Default: true |
  | enableQualification | Boolean | Optional | 60.0 | Default: true |
  | executeConfigurationRules | Boolean | Optional | 67.0 | Execute config rules |
  | filter | Filter Input | Optional | 60.0 | Operators: eq, in, contains (not with indexed) |
  | includeCatalogDetails | Boolean | Optional | 61.0 | Include catalog details |
  | limit | Integer | Optional | 60.0 | Items to return. Default: 10 |
  | offset | Integer | Optional | 60.0 | Reserved for internal use |
  | orderBy | String[] | Optional | 60.0 | Sort: asc/desc. With indexed: name only |
  | pricingProcedure | String | Optional | 60.0 | Custom pricing procedure |
  | productClassificationId | String | Optional | 60.0 | Filter by classification |
  | qualificationProcedure | String | Optional | 60.0 | Custom qualification procedure |
  | relatedObjectFilters | Related Object Filter Input[] | Optional | 60.0 | Filter on ProductSpecificationRecType.IsCommercial |
  | transactionContextId | String | Optional | 67.0 | Transaction context instance ID |
  | transactionId | String | Optional | 67.0 | Quote or order ID |
  | usePromotions | Boolean | Optional | 66.0 | Fetch GPM promotions. Default: true if enabled |
  | userContext | User Context Input | Optional | 60.0 | accountId, contactId |
- Response: CPQ Base List — product list with pricing/qualification

---

### Product Details (CPQ)
- Method: POST
- Path: `/connect/cpq/products/{productId}`
- Version: v60.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | productId | String | Required | 60.0 | Path param — product ID |
  | additionalContextData | Context Data Input[] | Optional | 60.0 | Extra context nodes |
  | additionalFields | Map<String,Additional Fields Input> | Optional | 61.0 | Extra Product2 fields |
  | catalogId | String | Optional | 60.0 | Catalog context |
  | contextDefinition | String | Optional | 60.0 | Custom context definition |
  | contextMapping | String | Optional | 60.0 | Context mapping |
  | correlationId | String | Optional | 60.0 | Tracking token |
  | currencyCode | String | Optional | 60.0 | Currency for pricing |
  | enablePricing | Boolean | Optional | 60.0 | Default: true |
  | enableQualification | Boolean | Optional | 60.0 | Default: true |
  | priceBookId | String | **Required** | 60.0 | Required per PDF |
  | pricingProcedure | String | Optional | 60.0 | Custom pricing procedure |
  | productSellingModelId | String | Optional | 60.0 | Selling model context |
  | qualificationProcedure | String | Optional | 60.0 | Custom qualification procedure |
  | userContext | User Context Input | Optional | 60.0 | accountId, contactId |
- Response: CPQ Base List — single product with pricing/qualification

---

### Bulk Product Details (CPQ)
- Method: POST
- Path: `/connect/cpq/products/bulk`
- Version: v61.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | productData | Product Data Input[] | **Required** | 61.0 | List of {productId, productSellingModelId} pairs |
  | additionalContextData | Context Data Input[] | Optional | 61.0 | Extra context nodes. Max 10 |
  | additionalFields | Map<String,Additional Fields Input> | Optional | 61.0 | Extra Product2 fields. In v66.0+: proration policy via productSellingModelOption |
  | contextDefinition | String | Optional | 61.0 | Custom context definition |
  | contextMapping | String | Optional | 61.0 | Context mapping |
  | correlationId | String | Optional | 61.0 | Tracking token |
  | currencyCode | String | Optional | 61.0 | Currency for pricing |
  | enablePricing | Boolean | Optional | 61.0 | Default: true |
  | enableQualification | Boolean | Optional | 61.0 | Default: true |
  | priceBookId | String | Optional | 61.0 | Price book ID |
  | pricingProcedure | String | Optional | 61.0 | Custom pricing procedure |
  | qualificationProcedure | String | Optional | 61.0 | Custom qualification procedure |
  | userContext | User Context Input[] | Optional | 61.0 | accountId, contactId |
- Response: CPQ Base List — bulk product details with pricing/qualification

---

### Guided Selection
- Method: POST
- Path: `/connect/cpq/guided-selection`
- Version: v62.0
- **IMPORTANT: Path is /connect/cpq/guided-selection NOT /connect/cpq/products/guided-selection**
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | catalogId | String | **Required** | 62.0 | ID of catalog |
  | priceBookId | String | **Required** | 62.0 | Price book ID |
  | guidedSelectionResponseId | String | Required if searchTerms not specified | 62.0 | Response identifier from previous guided selection |
  | searchTerms | Guided Selection Search Term Input[] | Required if guidedSelectionResponseId not specified | 62.0 | Search terms for guided selection |
  | additionalContextData | Context Data Input[] | Optional | 62.0 | Extra context nodes. Max 10 |
  | additionalFields | Map<String,Additional Fields Input> | Optional | 62.0 | Extra Product2 fields |
  | categoryId | String | Optional | 62.0 | Filter by category |
  | contextDefinition | String | Optional | 62.0 | Custom context definition |
  | contextMapping | String | Optional | 62.0 | Context mapping |
  | correlationId | String | Optional | 62.0 | Tracking token |
  | currencyCode | String | Optional | 62.0 | Currency for pricing |
  | cursor | String | Optional | 62.0 | Pagination position ID |
  | enablePricing | Boolean | Optional | 62.0 | Default: true |
  | enableQualification | Boolean | Optional | 62.0 | Default: true |
  | executeConfigurationRules | Boolean | Optional | 67.0 | Execute config rules |
  | filter | Filter Input | Optional | 62.0 | Operators: eq, in, contains |
  | includeCatalogDetails | Boolean | Optional | 62.0 | Include catalog details |
  | limit | Integer | Optional | 62.0 | Items to return. Default: 10 |
  | orderBy | String[] | Optional | 62.0 | Sort: asc/desc |
  | pricingProcedure | String | Optional | 62.0 | Custom pricing procedure |
  | productClassificationId | String | Optional | 62.0 | Filter by classification |
  | qualificationProcedure | String | Optional | 62.0 | Custom qualification procedure |
  | transactionContextId | String | Optional | 67.0 | Transaction context ID |
  | transactionId | String | Optional | 67.0 | Quote or order ID |
  | usePromotions | Boolean | Optional | 66.0 | Fetch GPM promotions |
  | userContext | User Context Input | Optional | 62.0 | accountId, contactId |
- Response: Guided Selection — product recommendations with guided navigation

---

### Qualification (CPQ)
- Method: POST
- Path: `/connect/cpq/qualification`
- Version: v60.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | productIds | String[] | **Required** | 60.0 | Product IDs to qualify |
  | additionalContextData | Context Data Input[] | Optional | 60.0 | Extra context nodes. Max 10 |
  | catalogId | String | Optional | 60.0 | Catalog context |
  | categoryId | String | Optional | 60.0 | Category context |
  | contextDefinition | String | Optional | 60.0 | Custom context definition |
  | contextMapping | String | Optional | 60.0 | Context mapping |
  | correlationId | String | Optional | 60.0 | Tracking token |
  | qualificationProcedure | String | Optional | 60.0 | Custom qualification procedure |
  | userContext | User Context Input | Optional | 60.0 | accountId, contactId |
- Response: CPQ Base List — qualification results per product

---

### Product Recommendations
- Method: POST
- Path: `/connect/cpq/products/recommendations`
- Version: v67.0
- **IMPORTANT: Path is /connect/cpq/products/recommendations NOT /revenue/product-discovery/products/recommendations**
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | additionalContextData | Context Data Input[] | Optional | 67.0 | Extra context nodes. Max 10 |
  | additionalFields | Map<String,Additional Fields Input> | Optional | 67.0 | Extra Product2 fields |
  | catalogId | String | Optional | 67.0 | Filter by catalog |
  | contextDefinition | String | Optional | 67.0 | Custom context definition |
  | contextMapping | String | Optional | 67.0 | Context mapping |
  | currencyCode | String | Optional | 67.0 | Currency. Required if multi-currency enabled |
  | cursor | String | Optional | 67.0 | Pagination position ID |
  | enablePricing | Boolean | Optional | 67.0 | Default: true |
  | enableQualification | Boolean | Optional | 67.0 | Default: true |
  | filter | Filter Input[] | Optional | 67.0 | Operators: eq, in, contains |
  | limit | Integer | Optional | 67.0 | Items to return. Default: 10 |
  | priceBookId | String | Optional | 67.0 | Price book ID. Default: standard |
  | pricingProcedure | String | Optional | 67.0 | Custom pricing procedure |
  | qualificationProcedure | String | Optional | 67.0 | Custom qualification procedure |
  | transactionContextId | String | Optional | 67.0 | Transaction context instance ID |
  | transactionId | String | Optional | 67.0 | Quote or order ID |
  | usePromotions | Boolean | Optional | 67.0 | Fetch GPM promotions. Default: false |
  | userContext | User Context Input | Optional | 67.0 | accountId, contactId |
- Response: Product Recommendations — recommended products with pricing/qualification

---

## Critical Notes
- **disc-4 Guided Selection path**: `/connect/cpq/guided-selection` (NO `/products/` segment)
- **disc-8 Product Recommendations path**: `/connect/cpq/products/recommendations` (NOT `/revenue/product-discovery/...`)
- `query` field is **Required** for Global Search — missing it causes API failure
- `priceBookId` is **Required** for Products List (CPQ) and Product Details (CPQ)
- `relatedObjectFilter` in Global Search is SINGULAR (not plural) — different from Products List
- `usePromotions` default behavior: true if GPM feature enabled, false if not
- When "Use Indexed Data For Product Listing and Search" toggle is enabled: contains operator disabled, sorting limited to name only
