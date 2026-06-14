# PDF vs endpoints.ts Gap Audit

**Source:** Revenue Lifecycle Management Developer Guide v67.0  
**Date:** 2026-06-13  
**Scope:** PCM (pages 130–200) and Discovery (pages 284–363)

---

## Summary Table

| Endpoint ID | Name | Status | Missing Params | Notes |
|---|---|---|---|---|
| pcm-3 | Catalog By ID | 🟡 Incomplete | 3 | correlationId, language, fields |
| pcm-5 | Product Details (PCM) | 🟡 Incomplete | 2 | fields, catalogSystems version |
| pcm-11 | Snapshot Deployment | 🟡 Incomplete | 0 params, 1 desc fix | buildType INCREMENTAL version note |
| disc-1 | Global Search | 🔴 Severely incomplete | 25 | query (Required!) missing entirely |
| disc-2 | Catalog List (CPQ) | 🟡 Incomplete | 5 | limit, offset, orderBy, correlationId, userContext |
| disc-3 | Categories List (CPQ) | 🟡 Incomplete | 10 | 9 missing + catalogId wrongly marked Required |
| disc-4 | Guided Selection | 🔴 Severely incomplete | 25 | current params entirely wrong |
| disc-5 | Product Details (CPQ) | 🟡 Incomplete | 6 | priceBookId wrongly optional |
| disc-6 | Products List (CPQ) | 🟡 Incomplete | 13 | |
| disc-7 | Qualification (CPQ) | 🟡 Incomplete | 3 | |
| disc-8 | Product Recommendations | 🟡 Incomplete | 8 | |
| pcm-new-1 | Categories List (PCM) | 🔴 Missing entirely | — | GET /connect/pcm/catalogs/{catalogId}/categories |
| pcm-new-2 | Category By ID (PCM) | 🔴 Missing entirely | — | GET /connect/pcm/categories/{categoryId} |
| pcm-new-3 | Index Configuration Collection | 🔴 Missing entirely | — | GET/PUT /connect/pcm/index/configurations |
| pcm-new-4 | Index Setting | 🔴 Missing entirely | — | GET/PATCH /connect/pcm/index/setting |
| disc-new-1 | Catalog Details (CPQ) | 🔴 Missing entirely | — | POST /connect/cpq/catalogs/{catalogId} |
| disc-new-2 | Category Details (CPQ) | 🔴 Missing entirely | — | POST /connect/cpq/categories/{categoryId} |
| disc-new-3 | Bulk Product Details (CPQ) | 🔴 Missing entirely | — | POST /connect/cpq/products/bulk |

---

## Per-Endpoint Detail

### pcm-3 — Catalog By ID

**Current params:** catalogId  
**Missing:**

| Name | Type | Req | Location | Version | Description |
|---|---|---|---|---|---|
| correlationId | String | Optional | query | v60.0 | Unique token to track related events |
| language | String | Optional | query | v64.0 | Custom language for translated fields |
| fields | String[] | Optional | query | v60.0 | For internal use only |

---

### pcm-5 — Product Details (PCM)

**Current params:** productId, correlationId, language, catalogSystems  
**Missing / Fix:**

| Name | Type | Req | Location | Version | Description |
|---|---|---|---|---|---|
| fields | String[] | Optional | query | v60.0 | For internal use only |
| catalogSystems | — | — | — | — | Fix: add version v66.0 to description |

---

### pcm-11 — Snapshot Deployment

**Current params:** buildType, snapshot — all present  
**Fix needed:**  
`buildType` description should note: "INCREMENTAL available from API version 63.0 and later"

---

### disc-1 — Global Search

**Current params (3):** searchTerm, contextId, pageSize  
**Full param list per PDF (28 params):**

| Name | Type | Req | Version | Description |
|---|---|---|---|---|
| query | Map<String,Object> | **Required** | v60.0 | Query to search products |
| additionalContextData | Context Data Input[] | Optional | v60.0 | Custom context nodes (max 10) |
| additionalFields | Map<String,Additional Fields Input> | Optional | v61.0 | Additional Product2 fields |
| catalogId | String | Optional | v60.0 | Catalog ID with pricing details |
| categoryId | String | Optional | v60.0 | Category ID for matching |
| contextDefinition | String | Optional | v60.0 | Custom context definition API name |
| contextMapping | String | Optional | v60.0 | Context mapping for hydration |
| correlationId | String | Optional | v60.0 | Unique request identifier |
| currencyCode | String | Optional | v60.0 | Currency code for pricing/filtering |
| cursor | String | Optional | v60.0 | Unique ID for product position |
| enablePricing | Boolean | Optional | v60.0 | Enable pricing (default: true) |
| enableQualification | Boolean | Optional | v60.0 | Enable qualification (default: true) |
| executeConfigurationRules | Boolean | Optional | v67.0 | Execute configuration rules |
| filter | Filter Input | Optional | v60.0 | Filter by criteria (eq, in, contains, gt, lt, gte, lte) |
| includeCatalogDetails | Boolean | Optional | v61.0 | Include catalog details (default: false) |
| limit | Integer | Optional | v60.0 | Items in response (default: 10) |
| offset | Integer | Optional | v60.0 | Reserved for internal use |
| orderBy | String[] | Optional | v60.0 | Sort order (asc/desc, default: asc) |
| priceBookId | String | Optional | v60.0 | Price book ID for prices |
| pricingProcedure | String | Optional | v60.0 | Custom pricing procedure |
| productClassificationId | String | Optional | v60.0 | Product classification ID |
| qualificationProcedure | String | Optional | v60.0 | Custom qualification procedure |
| relatedObjectFilters | Related Object Filter Input[] | Optional | v60.0 | Filter by related object criteria |
| searchTerm | String | Optional | v62.0 | Product name search term |
| transactionContextId | String | Optional | v66.0 | Transaction context ID |
| transactionId | String | Optional | v66.0 | Transaction ID |
| usePromotions | Boolean | Optional | v66.0 | Fetch eligible promotions |
| userContext | User Context Input | Optional | v60.0 | User context details |

---

### disc-2 — Catalog List (CPQ)

**Current params (1):** contextId  
**Missing:**

| Name | Type | Req | Version | Description |
|---|---|---|---|---|
| correlationId | String | Optional | v60.0 | Unique request identifier |
| limit | Integer | Optional | v60.0 | Number of items to include |
| offset | Integer | Optional | v60.0 | Offset size for catalog count |
| orderBy | String[] | Optional | v60.0 | Sort order for catalogs |
| userContext | User Context Input | Optional | v60.0 | User context details |

---

### disc-3 — Categories List (CPQ)

**Current params (2):** catalogId (Required — WRONG), contextId  
**Fix:** catalogId → Optional  
**Missing:**

| Name | Type | Req | Version | Description |
|---|---|---|---|---|
| additionalContextData | Context Data Input[] | Optional | v60.0 | Additional custom context nodes (max 10) |
| contextDefinition | String | Optional | v60.0 | Custom context definition API name |
| contextMapping | String | Optional | v60.0 | Context mapping for hydration |
| customFields | String[] | Optional | v60.0 | Category fields to retrieve |
| correlationId | String | Optional | v60.0 | Unique request identifier |
| enableQualification | Boolean | Optional | v60.0 | Enable qualification rules (default: true) |
| filter | Filter Input | Optional | v60.0 | Filter records by criteria |
| qualificationProcedure | String | Optional | v60.0 | Custom qualification procedure |
| usePromotions | Boolean | Optional | v66.0 | Fetch eligible promotions from GPM |
| userContext | User Context Input | Optional | v60.0 | User context details |

---

### disc-4 — Guided Selection

**Current params (2):** contextId, answers — ENTIRELY WRONG  
**Full param list per PDF (26 params):**

| Name | Type | Req | Version | Description |
|---|---|---|---|---|
| catalogId | String | **Required** | v62.0 | Catalog ID |
| priceBookId | String | **Required** | v62.0 | Price book ID |
| guidedSelectionResponseId | String | Required (if searchTerms not set) | v62.0 | Response identifier |
| searchTerms | Guided Selection Search Term Input[] | Required (if guidedSelectionResponseId not set) | v62.0 | Search terms |
| additionalContextData | Context Data Input[] | Optional | v62.0 | Custom context nodes (max 10) |
| additionalFields | Map<String,Additional Fields Input> | Optional | v62.0 | Additional Product2 fields |
| categoryId | String | Optional | v62.0 | Category ID |
| contextDefinition | String | Optional | v62.0 | Custom context definition API name |
| contextMapping | String | Optional | v62.0 | Context mapping for hydration |
| correlationId | String | Optional | v62.0 | Unique request identifier |
| currencyCode | String | Optional | v62.0 | Currency code |
| cursor | String | Optional | v62.0 | Unique ID for product position |
| enablePricing | Boolean | Optional | v62.0 | Enable pricing (default: true) |
| enableQualification | Boolean | Optional | v62.0 | Enable qualification (default: true) |
| executeConfigurationRules | Boolean | Optional | v67.0 | Execute configuration rules |
| filter | Filter Input | Optional | v62.0 | Filter by criteria (eq, in, contains) |
| includeCatalogDetails | Boolean | Optional | v62.0 | Include catalog details (default: false) |
| limit | Integer | Optional | v62.0 | Items in response (default: 10) |
| orderBy | String[] | Optional | v62.0 | Sort order (asc/desc, default: asc) |
| pricingProcedure | String | Optional | v62.0 | Custom pricing procedure |
| productClassificationId | String | Optional | v62.0 | Product classification ID |
| qualificationProcedure | String | Optional | v62.0 | Custom qualification procedure |
| transactionContextId | String | Optional | v67.0 | Transaction context ID |
| transactionId | String | Optional | v67.0 | Transaction ID |
| usePromotions | Boolean | Optional | v66.0 | Fetch eligible promotions |
| userContext | User Context Input | Optional | v62.0 | User context details |

---

### disc-5 — Product Details (CPQ)

**Current params (9):** productId, catalogId, priceBookId (Optional — WRONG), productSellingModelId, enablePricing, enableQualification, correlationId, userContext, additionalFields  
**Fix:** priceBookId → Required  
**Missing:**

| Name | Type | Req | Version | Description |
|---|---|---|---|---|
| additionalContextData | Context Data Input[] | Optional | v60.0 | Custom context nodes (max 10) |
| contextDefinition | String | Optional | v60.0 | Custom context definition API name |
| contextMapping | String | Optional | v60.0 | Context mapping for hydration |
| currencyCode | String | Optional | v60.0 | Currency code for pricing |
| pricingProcedure | String | Optional | v60.0 | Custom pricing procedure |
| qualificationProcedure | String | Optional | v60.0 | Custom qualification procedure |

---

### disc-6 — Products List (CPQ)

**Current params (13):** catalogId, categoryId, priceBookId, productClassificationId, enablePricing, enableQualification, executeConfigurationRules, limit, orderBy, filter, currencyCode, userContext, additionalFields  
**Missing:**

| Name | Type | Req | Version | Description |
|---|---|---|---|---|
| additionalContextData | Context Data Input[] | Optional | v60.0 | Custom context nodes (max 10) |
| contextDefinition | String | Optional | v60.0 | Custom context definition API name |
| contextMapping | String | Optional | v60.0 | Context mapping for hydration |
| correlationId | String | Optional | v60.0 | Unique request identifier |
| cursor | String | Optional | v60.0 | Unique ID for product position |
| includeCatalogDetails | Boolean | Optional | v61.0 | Include catalog details (default: false) |
| offset | Integer | Optional | v60.0 | Reserved for internal use |
| pricingProcedure | String | Optional | v60.0 | Custom pricing procedure |
| qualificationProcedure | String | Optional | v60.0 | Custom qualification procedure |
| relatedObjectFilters | Related Object Filter Input[] | Optional | v60.0 | Filter by related object criteria |
| transactionContextId | String | Optional | v67.0 | Transaction context ID |
| transactionId | String | Optional | v67.0 | Transaction ID |
| usePromotions | Boolean | Optional | v66.0 | Fetch eligible promotions |

---

### disc-7 — Qualification (CPQ)

**Current params (6):** productIds, catalogId, categoryId, qualificationProcedure, correlationId, userContext  
**Missing:**

| Name | Type | Req | Version | Description |
|---|---|---|---|---|
| additionalContextData | Context Data Input[] | Optional | v60.0 | Custom context nodes (max 10) |
| contextDefinition | String | Optional | v60.0 | Custom context definition API name |
| contextMapping | String | Optional | v60.0 | Context mapping for hydration |

---

### disc-8 — Product Recommendations

**Current params (10):** catalogId, transactionId, transactionContextId, enablePricing, enableQualification, limit, currencyCode, priceBookId, filter, userContext  
**Missing:**

| Name | Type | Req | Version | Description |
|---|---|---|---|---|
| additionalContextData | Context Data Input[] | Optional | v67.0 | Custom context nodes (max 10) |
| additionalFields | Map<String,Additional Fields Input> | Optional | v67.0 | Additional Product2 fields |
| contextDefinition | String | Optional | v67.0 | Custom context definition API name |
| contextMapping | String | Optional | v67.0 | Context mapping for hydration |
| cursor | String | Optional | v67.0 | Unique ID for product position |
| pricingProcedure | String | Optional | v67.0 | Custom pricing procedure |
| qualificationProcedure | String | Optional | v67.0 | Custom qualification procedure |
| usePromotions | Boolean | Optional | v67.0 | Fetch eligible promotions (default: false) |

---

## Missing Endpoints — Full Param Specs

### pcm-new-1: Categories List (PCM)
**GET** `/connect/pcm/catalogs/{catalogId}/categories` v60.0

| Name | Type | Req | Location | Version | Description |
|---|---|---|---|---|---|
| catalogId | String | Required | path | v60.0 | ID of the catalog |
| correlationId | String | Optional | query | v60.0 | Unique token to track related events |
| depth | Integer | Optional | query | v60.0 | Number of category hierarchy levels to return. Default: 1 |
| language | String | Optional | query | v64.0 | Custom language for translated fields |
| parentCategoryId | String | Optional | query | v60.0 | ID of category to fetch subcategories. If unspecified, root-level categories are returned |

---

### pcm-new-2: Category By ID (PCM)
**GET** `/connect/pcm/categories/{categoryId}` v60.0

| Name | Type | Req | Location | Version | Description |
|---|---|---|---|---|---|
| categoryId | String | Required | path | v60.0 | ID of the category |
| correlationId | String | Optional | query | v60.0 | Unique token to track related events |
| language | String | Optional | query | v64.0 | Custom language for translated fields |

---

### pcm-new-3: Index Configuration Collection
**GET/PUT** `/connect/pcm/index/configurations` v62.0

GET query params:
| Name | Type | Req | Version | Description |
|---|---|---|---|---|
| correlationId | String | Optional | v62.0 | Unique token to track related events |
| fieldTypes | String[] | Optional | v62.0 | Filter by index config type: STANDARD, CUSTOM, ProductDynamicAttribute, ProductAttributeDefinitionStandard, ProductAttributeDefinitionCustom |
| includeMetadata | Boolean | Optional | v62.0 | Include metadata (true) or not (false) |

PUT body params:
| Name | Type | Req | Version | Description |
|---|---|---|---|---|
| correlationId | String | Optional | v62.0 | Unique token to track related events |
| indexConfigurations | Index Configuration Input[] | Required | v62.0 | List of index configurations |

---

### pcm-new-4: Index Setting
**GET/PATCH** `/connect/pcm/index/setting` v63.0

PATCH query/body params:
| Name | Type | Req | Location | Version | Description |
|---|---|---|---|---|---|
| settingId | String | Required | query | v63.0 | ID of the setting to update |
| setting | Setting Input[] | Required | body | v63.0 | Object containing setting details |

---

### disc-new-1: Catalog Details (CPQ)
**POST** `/connect/cpq/catalogs/{catalogId}` v60.0

| Name | Type | Req | Location | Version | Description |
|---|---|---|---|---|---|
| catalogId | String | Required | path | v60.0 | Catalog ID |
| correlationId | String | Optional | body | v60.0 | Unique identifier for request tracking |
| userContext | User Context Input | Optional | body | v60.0 | User context details (accountId, contactId) |

---

### disc-new-2: Category Details (CPQ)
**POST** `/connect/cpq/categories/{categoryId}` v60.0

| Name | Type | Req | Location | Version | Description |
|---|---|---|---|---|---|
| categoryId | String | Required | path | v60.0 | Category ID |
| additionalContextData | Context Data Input[] | Optional | body | v60.0 | Custom context nodes (max 10) |
| catalogId | String | Optional | body | v60.0 | Catalog ID for pricing details |
| contextDefinition | String | Optional | body | v60.0 | Custom context definition API name |
| contextMapping | String | Optional | body | v60.0 | Default context mapping for hydration |
| customFields | String[] | Optional | body | v60.0 | Category fields to retrieve |
| correlationId | String | Optional | body | v60.0 | Unique request identifier |
| enableQualification | Boolean | Optional | body | v60.0 | Enable qualification rules (default: true) |
| filter | Filter Input | Optional | body | v60.0 | Filter records by criteria |
| qualificationProcedure | String | Optional | body | v60.0 | Custom qualification procedure |
| userContext | User Context Input | Optional | body | v60.0 | User context details |
| usePromotions | Boolean | Optional | body | v66.0 | Fetch eligible promotions from GPM |

---

### disc-new-3: Bulk Product Details (CPQ)
**POST** `/connect/cpq/products/bulk` v61.0

| Name | Type | Req | Location | Version | Description |
|---|---|---|---|---|---|
| productData | Product Data Input[] | Required | body | v61.0 | List of product IDs and selling model IDs to retrieve details for |
| additionalContextData | Context Data Input[] | Optional | body | v61.0 | Custom/default context nodes (max 10) |
| additionalFields | Map<String,Additional Fields Input> | Optional | body | v61.0 | Additional Product2 fields |
| contextDefinition | String | Optional | body | v61.0 | Custom context definition API name |
| contextMapping | String | Optional | body | v61.0 | Context mapping for hydration |
| correlationId | String | Optional | body | v61.0 | Unique token for tracking |
| currencyCode | String | Optional | body | v61.0 | Currency code for pricing |
| enablePricing | Boolean | Optional | body | v61.0 | Enable pricing (default: true) |
| enableQualification | Boolean | Optional | body | v61.0 | Enable qualification rules (default: true) |
| priceBookId | String | Optional | body | v61.0 | Price book ID for prices |
| pricingProcedure | String | Optional | body | v61.0 | Custom pricing procedure |
| qualificationProcedure | String | Optional | body | v61.0 | Custom qualification procedure |
| userContext | User Context Input[] | Optional | body | v61.0 | User context details |
