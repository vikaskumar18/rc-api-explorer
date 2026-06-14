---
title: Revenue Cloud PCM Developer Reference
area: revenue-cloud
tags: [pcm, product-catalog, attributes, bundles, selling-models, indexing, classifications]
source: revenue_lifecycle_management_dev_lates.pdf pp.127-284
scanned: 2026-06-13
---

# Revenue Cloud PCM Developer Reference

## 1. Catalog Hierarchy and Setup

### 1.1 Core Objects

The PCM catalog hierarchy uses these sObjects (all available v60+ unless noted):

| sObject | Purpose |
|---|---|
| `ProductCatalog` | Top-level catalog container |
| `ProductCategory` | Hierarchical grouping within a catalog |
| `Product2` | Individual sellable product |
| `ProductClassification` | Taxonomy node for classifying products |
| `ProductComponentGroup` | Groups child products within a bundle |
| `ProductRelatedComponent` | Parent-child relationship between products |
| `ProductRelationshipType` | Defines the type of product relationship |
| `ProductSellingModelOption` | Links a product to a selling model |
| `AttributeDefinition` | Definition of an attribute |
| `ProductSpecificationType` | Defines specification types (v60+) |
| `ProductSpecificationRecType` | Record type for product specifications (v60+) |

### 1.2 ProductCatalog Fields (PCM-extended)

| Field | Type | Notes |
|---|---|---|
| `Code` | String (max 80) | Unique code for the catalog |
| `Description` | String (max 255) | Description |
| `EffectiveStartDate` | Date | When catalog becomes effective |
| `EffectiveEndDate` | Date | When catalog expires |
| `CatalogType` | Picklist | `Sales` (default) or `ServiceProcess` |

### 1.3 ProductCategory Fields

| Field | Notes |
|---|---|
| `catalogId` | Parent catalog |
| `code` | Unique category code |
| `description` | Translated if data translation enabled |
| `hasSubCategories` | Boolean |
| `isNavigational` | Boolean (v62+) |
| `name` | Translated if data translation enabled |
| `numberOfProducts` | Count |
| `parentCategoryId` | Parent category for nested hierarchy |
| `sortOrder` | Display ordering |
| `subCategories` | Array returned only from Categories List GET |

### 1.4 Catalog Systems

PCM supports two catalog systems:
- `pcm` — Product Catalog Management (default for most APIs)
- `epc` — Enterprise Product Catalog (legacy)

When calling Product Classification APIs, the `catalogSystem` parameter controls which system is queried. Default is `pcm`.

---

## 2. Product Classification Taxonomy

### 2.1 ProductClassification sObject (v60+)

| Field | Type | Version | Notes |
|---|---|---|---|
| `id` | String | 60 | Record ID |
| `name` | String | 61 | Translated if data translation set up |
| `code` | String | 61 | Classification code |
| `status` | String | 61 | `Active` or inactive |
| `parentProductClassificationId` | String | 65 | Parent in hierarchy |

Classifications form a tree. Products are linked to classifications via `Product2.BasedOn`.

### 2.2 Product Classification Details (v66+)

The `/revenue/product-catalog-management/product-classifications/details` endpoint (POST, v66) returns:

```json
{
  "productClassifications": [
    {
      "id": "...",
      "name": "Mobile Devices",
      "code": "MOB_DEV",
      "attributeCategories": [...],   // v66
      "attributes": [...]             // v66
    }
  ],
  "success": true,
  "errors": []
}
```

Key fields on `productClassification` output:
- `attributeCategories` — `Product Classification Attribute Category[]` (v66)
- `attributes` — `Product Classification Attribute Definition[]` (v66)

### 2.3 Product Classification List (v67+)

POST to `/revenue/product-catalog-management/product-classifications/list`

Request parameters:
- `catalogSystem` — `pcm` or `epc`, default `pcm`
- `filter` — supports operators `eq`, `in`, `contains` on `name`
- `pageSize` — valid values: `5`, `10`, `25`, `50`, `100`
- `searchTerm` — free text search
- `sort` — sort orders array

Response includes `parentProductClassificationId` (v65) when available.

### 2.4 Product2.BasedOn

Setting `Product2.BasedOn` to a `ProductClassification` ID links a product to the taxonomy. The classification controls which attributes are inherited. Products in API responses include `productClassification: { id, name, code, status }`.

---

## 3. Attribute System

### 3.1 AttributeDefinition.DataType Picklist

Valid values (v60+, with version notes):
- `Checkbox`
- `Currency` (v61+)
- `Date`
- `Datetime`
- `Number`
- `Percent` (v61+)
- `Picklist`
- `Text`

### 3.2 Attribute Display Types

The `displayType` field on AttributeDefinition controls UI rendering:
- `Radio Button`
- `Checkbox`
- `Toggle`
- `Input`
- `Date`
- `DateTime`
- `Currency Symbol`
- `Currency Code`
- `Currency Name`
- `Percentage`
- `Text`
- `Combobox`
- `MultiSelect`
- `MultiSelectCheckboxes`

### 3.3 Attribute Definition Output Fields (complete)

| Field | Type | Description |
|---|---|---|
| `additionalFields` | Map | Custom/standard additional fields |
| `attributeNameOverride` | String | Override name (e.g., custom field API name) |
| `code` | String | Unique attribute code |
| `dataType` | String | See DataType values above |
| `defaultValue` | String | Default value |
| `description` | String | Description |
| `displayType` | String | UI rendering type |
| `helpText` | String | Help tooltip text |
| `id` | String | Record ID |
| `isConfigurable` | Boolean | Whether configurable at runtime |
| `isHidden` | Boolean | Whether hidden in UI |
| `isPriceImpacting` | Boolean | Whether affects pricing |
| `isReadOnly` | Boolean | Whether read-only |
| `isRequired` | Boolean | Whether required |
| `isValueCloneable` | Boolean | Whether value copies in deep clone |
| `label` | String | Display label |
| `maximumCharacterCount` | Integer | Max chars for Text type |
| `maximumValue` | String | Max value for Number/Currency |
| `minimumCharacterCount` | Integer | Min chars for Text type |
| `minimumValue` | String | Min value for Number/Currency |
| `name` | String | API name |
| `picklist` | Object | Picklist definition (for Picklist type) |
| `sequence` | Integer | Display order |
| `status` | String | `Active`, `Draft`, or `Inactive` |
| `stepValue` | String | Increment for Number type |
| `valueDecoder` | String | Value decoder info |
| `valueDescription` | String | Description of current value |

### 3.4 Attribute Picklist Structure

```json
{
  "picklist": {
    "dataType": "Text",
    "description": "APV Description",
    "id": "...",
    "name": "Color",
    "values": [
      {
        "abbreviation": "Blue Abb",
        "code": "APV03",
        "displayValue": "Blue DV",
        "id": "...",
        "name": "Blue",
        "sequence": "3",
        "value": "Blue b",
        "status": "Active"   // v62+
      }
    ]
  }
}
```

Picklist `dataType` values: `Boolean`, `Date`, `Datetime`, `Number`, `Text`, `Currency`, `Percent`.

### 3.5 Attribute Categories

Attributes can be grouped into Attribute Categories. The `attributeCategory` array in product responses contains:
- `attributes` — `AttributeDefinition[]` within this category
- `code` — category code
- `id` — record ID
- `name` — display name

Products also have a top-level `attributes` array for uncategorized attributes.

### 3.6 DRO-specific Attribute Additional Fields

When DRO (Dynamic Revenue Orchestrator) permission is enabled, `AttributeDefinition` supports extra `additionalFields`:
- `OptOutAssetization` — Boolean
- `OptOutDecompositionAction` — Boolean
- `OptOutSupplementalAction` — Boolean

These appear in product responses with `epc` catalog system data.

---

## 4. Product2 Extended Fields (PCM)

### 4.1 PCM-extended fields on Product2

| Field | Type | Version | Notes |
|---|---|---|---|
| `BasedOn` | Lookup(ProductClassification) | 60 | Links product to classification taxonomy |
| `HelpText` | LongTextArea (32000) | 60 | Special chars allowed: `@!-<>*?+=%)#()/\&'£€$"` |
| `AvailabilityDate` | DateTime | 60 | When product becomes available for sale |
| `CanRamp` | Boolean (default false) | 60 | Whether product supports ramp pricing |
| `DiscontinuedDate` | DateTime | 60 | When product can no longer be used |
| `EndOfLifeDate` | DateTime | 60 | When product no longer supported/ordered |
| `SpecificationType` | String | 60 | Type of product specification |
| `DecompositionScope` | Picklist | 61 | `Account`, `Bundle`, `Order`, `OrderLineItem` |
| `FulfillmentQtyCalcMethod` | Picklist | 61 | `Aggregate` or `AlwaysOne` |
| `UsageModelType` | Picklist | 62 | `Anchor` or `Pack` |

### 4.2 Product API Response Fields (complete)

| Field | Type | Notes |
|---|---|---|
| `additionalFields` | Map | Custom field key-value pairs (v61+) |
| `attributeCategory` | AttributeCategory[] | Categorized attributes |
| `attributes` | AttributeDefinition[] | Uncategorized attributes |
| `availabilityDate` | String | ISO datetime |
| `catalogs` | Catalog[] | Associated catalogs (Product List POST only; empty in Product By ID GET) |
| `categories` | Category[] | Associated categories (Product List POST only; empty in Product By ID GET) |
| `childProducts` | Product[] | Hierarchy of child products |
| `configureDuringSale` | String | `Allowed` or `NotAllowed` |
| `description` | String | Translated if data translation enabled |
| `discontinuedDate` | String | ISO datetime |
| `displayUrl` | String | Product image URL |
| `endOfLifeDate` | String | ISO datetime |
| `id` | String | Record ID |
| `isActive` | Boolean | Whether product is active |
| `isAssetizable` | Boolean | Whether becomes customer asset after purchase |
| `isSoldOnlyWithOtherProds` | Boolean | Whether can only be sold in a bundle |
| `name` | String | Translated if data translation enabled |
| `nodeType` | String | `simpleProduct`, `bundleProduct`, or `productClass` |
| `productClassification` | ProductClassification | Classification details (id, name, code, status) |
| `productCode` | String | Universal product code (SKU) |
| `productComponentGroups` | ProductComponentGroup[] | Bundle group hierarchy |
| `productRelatedComponent` | ProductRelatedComponent | Component relationship data |
| `productSellingModelOptions` | ProductSellingModelOption[] | Selling models linked to product |
| `productSpecificationType` | ProductSpecificationType | Specification type |
| `quantityScaleMethod` | String | `Constant` or `Proportional` |

**Important**: `catalogs` and `categories` arrays in product responses return only `name` and `id` values. Full catalog/category data is not returned inline.

---

## 5. Bundle Structure

### 5.1 Bundle Hierarchy Overview

A bundle in PCM is a product tree:
```
Parent Product (nodeType: bundleProduct)
  └── ProductComponentGroup (PCG) — groups of child products
        ├── components[] — actual child products
        │     ├── childProduct (nodeType: bundleProduct or simpleProduct)
        │     └── productRelatedComponent — relationship metadata
        └── childGroups[] — nested PCGs (v62+)
```

### 5.2 ProductComponentGroup Fields

| Field | Type | Version | Description |
|---|---|---|---|
| `code` | String | 60 | Unique code (design-time only) |
| `components` | Product[] | 60 | List of child product details |
| `childGroups` | ProductComponentGroup[] | 62 | Nested component groups |
| `description` | String | 60 | Group description |
| `id` | String | 60 | Record ID |
| `isExcluded` | Boolean | 60 | Whether excluded from bundle at runtime |
| `maxBundleComponents` | Integer | 60 | Maximum components selectable |
| `minBundleComponents` | Integer | 60 | Minimum components selectable |
| `name` | String | 60 | Translated if data translation enabled |
| `parentGroupId` | String | 62 | ID of parent group record |
| `parentProductId` | String | 60 | ID of parent product record |
| `sequence` | Integer | 60 | Order in bundle display |

### 5.3 ProductRelatedComponent Fields

| Field | Type | Version | Description |
|---|---|---|---|
| `childProductId` | String | 60 | Lookup to child product |
| `childSellingModelId` | String | 60 | ID of child product selling model |
| `doesBundlePriceIncludeChild` | Boolean | 60 | Whether bundle price includes child price |
| `id` | String | 60 | Record ID |
| `isComponentRequired` | Boolean | 60 | Whether component is required |
| `isDefaultComponent` | Boolean | 60 | Whether selected by default in group |
| `isExcluded` | Boolean | 60 | Whether excluded in bundle group |
| `isQuantityEditable` | Boolean | 60 | Whether quantity changeable |
| `maxQuantity` | Double | 60 | Max quantity on opportunity/quote/order |
| `minQuantity` | Double | 60 | Min quantity on opportunity/quote/order |
| `parentProductId` | String | 60 | Lookup to parent product |
| `parentSellingModelId` | String | 60 | ID of parent product selling model |
| `productClassificationId` | String | 60 | Classification of this component |
| `productInstanceReuse` | String | 62 | Reserved for future use |
| `productRelationshipTypeId` | String | 60 | Relationship type record ID |
| `quantity` | Double | 60 | Default quantity |
| `quantityScaleMethod` | String | 60 | `Constant` or `Proportional` |
| `quoteVisibility` | String | 64 | `Always`, `Transaction Line Editor Only`, `Quote Document Only`, `Never` — only returned when CoreCPQ permission available |
| `sequence` | Integer | 60 | Display order |

### 5.4 quoteVisibility Rules

`quoteVisibility` determines where a bundle component line item appears:
- `Always` — shown on both transaction editor and quote document
- `Transaction Line Editor Only` — shows on quote editor only
- `Quote Document Only` — shows on quote proposal only
- `Never` — never shown

This field is only returned when the `CoreCPQ` permission set is available.

### 5.5 Bundle JSON Example

A complete bundle response looks like:

```json
{
  "id": "01tT1000000F0afIAC",
  "name": "Bundle Product",
  "nodeType": "bundleProduct",
  "isSoldOnlyWithOtherProds": true,
  "productCode": "P001",
  "productClassification": { "id": "...", "name": "class", "code": "code", "status": "Active" },
  "productComponentGroups": [
    {
      "code": "PCG001",
      "id": "0y7T10000004C9DIAU",
      "name": "PCG001",
      "maxBundleComponents": 5,
      "minBundleComponents": 1,
      "sequence": 1,
      "isExcluded": false,
      "parentProductId": "01tT1000000F0afIAC",
      "components": [
        {
          "id": "01tT1000000F0YyIAK",
          "name": "Child1 - Bundle with PCG",
          "nodeType": "bundleProduct",
          "productRelatedComponent": {
            "childProductId": "01tT1000000F0YyIAK",
            "doesBundlePriceIncludeChild": true,
            "isComponentRequired": false,
            "isDefaultComponent": false,
            "isQuantityEditable": true,
            "maxQuantity": 3,
            "minQuantity": 1,
            "quantity": 1,
            "quantityScaleMethod": "Proportional",
            "sequence": 1
          }
        }
      ]
    }
  ]
}
```

---

## 6. Product Selling Models

### 6.1 Selling Model Types

`sellingModelType` valid values:
- `OneTime` — single purchase, no recurring billing
- `TermDefined` — subscription with a fixed term (pricingTerm + pricingTermUnit define duration)
- `Evergreen` — subscription that auto-renews indefinitely

### 6.2 ProductSellingModel Fields

| Field | Type | Description |
|---|---|---|
| `id` | String | Record ID |
| `name` | String | Display name |
| `pricingTerm` | Integer | Duration of the selling model |
| `pricingTermUnit` | String | Units (e.g., `Months`) |
| `sellingModelType` | String | `OneTime`, `TermDefined`, or `Evergreen` |
| `status` | String | `Active` or inactive |

### 6.3 ProductSellingModelOption Fields

| Field | Type | Description |
|---|---|---|
| `id` | String | Record ID |
| `isDefault` | Boolean | Whether this is the default option for the product |
| `productId` | String | ID of the product |
| `productSellingModel` | ProductSellingModel | Master-detail to selling model |

### 6.4 Linking Products to Selling Models

A product can have multiple `productSellingModelOptions`. Each option links to a `ProductSellingModel`. The `isDefault: true` option is used when no specific model is selected.

Example JSON in product response:
```json
"productSellingModelOptions": [
  {
    "id": "0iOT10000004CMrMAM",
    "productId": "01tT1000000F0YyIAK",
    "isDefault": false,
    "productSellingModel": {
      "id": "0jPT10000004CAfMAM",
      "name": "OneTimePSM",
      "sellingModelType": "OneTime",
      "status": "Active"
    }
  }
]
```

### 6.5 Product Ramp Segments (Related Objects)

Products can have related `ProductRampSegment` records accessible via the Related Records API:

```json
{
  "SegmentType": "Yearly",
  "DurationType": "Months",
  "TrialDuration": null,
  "ProductSellingModelId": "0jPxx000000001dEAA",
  "ProductId": "01txx0000006i44AAA",
  "Id": "1FTxx0000004CDtGAM",
  "Name": "PPRS-000000005"
}
```

Segment types include: `Yearly`, `FreeTrial`, `Custom`.

### 6.6 Product Usage Grants (Related Objects)

Products can have related `ProductUsageGrant` records:

```json
{
  "UsageMetricId": "1BRxx0000004CAeGAM",
  "UsageMetricName": "Test Usage Metric 2",
  "UsageDefinitionProductId": null,
  "Label": "PUG-103",
  "Quantity": 100,
  "Id": "1BXxx0000004CCGGA2"
}
```

---

## 7. Product Specification Types

### 7.1 ProductSpecificationType sObject (v60+)

| Field | Type | Notes |
|---|---|---|
| `Description` | String | |
| `DeveloperName` | String | Max 40 chars, alphanumeric+underscores, must begin with letter, no spaces, no trailing underscore, no consecutive underscores |
| `Language` | Picklist | `da`, `de`, `en_US`, `es`, `es_MX`, `fi`, `fr`, `it`, `ja`, `ko`, `nl_NL`, `no`, `pt_BR`, `ru`, `sv`, `th`, `zh_CN`, `zh_TW` |
| `MasterLabel` | String | |
| `NamespacePrefix` | String | |

### 7.2 ProductSpecificationRecType sObject (v60+)

| Field | Type | Notes |
|---|---|---|
| `DeveloperName` | String | Same rules as ProductSpecificationType |
| `IsCommercial` | Boolean | Whether commercial type |
| `Language` | Picklist | Same language options |
| `MasterLabel` | String | |
| `NamespacePrefix` | String | |
| `ProductSpecificationType` | Lookup | |
| `RecordTypeId` | ID | |

### 7.3 ProductSpecificationType in Product Responses

Products include a `productSpecificationType` object:
```json
"productSpecificationType": {
  "name": "NonCommercialSpecType",
  "productSpecificationRecordType": null
}
```
When no spec type is set: `"name": "None"`.

### 7.4 relatedObjectFilters for Spec Types

The Product List API supports filtering by `IsCommercial`:
```json
"relatedObjectFilters": {
  "objectName": "ProductSpecificationRecType",
  "criteria": [
    { "property": "IsCommercial", "operator": "eq", "value": "true" }
  ]
}
```
Only `ProductSpecificationRecType` is supported as `objectName`.

---

## 8. Product Catalog APIs

### 8.1 Catalog List API

**POST** `/connect/pcm/catalogs`

This API uses POST for retrieval (not creation). Request body (`CatalogInput`):

| Parameter | Type | Notes |
|---|---|---|
| `filter` | Criteria | Filter on `name` or `catalogType`, operators: `eq`, `in`, `contains` |
| `pageSize` | Integer | Range 1-100 |
| `offset` | Integer | Default 0 |
| `sort` | SortInput | `orders[]` with `direction` + `property` |
| `language` | String | v64+, language locale |

Response (`CatalogsOutput`):
- `catalogs[]` — list of catalog records
- `correlationId` — tracking UUID
- `count` — total matching records
- `status` — request status

### 8.2 Catalog By ID API

**GET** `/connect/pcm/catalogs/{catalogId}`

Optional query param: `language` (e.g., `?language=spanish`)

### 8.3 Categories APIs

**GET** `/connect/pcm/catalogs/{catalogId}/categories`

Query params:
- `depth` — default 1, controls hierarchy depth
- `parentCategoryId` — filter to subcategories of a specific parent

**GET** `/connect/pcm/categories/{categoryId}`

Returns single category with `subCategories[]` array.

### 8.4 Product List API

**POST** `/connect/pcm/products`

Full `ProductInput` parameters:

| Parameter | Type | Notes |
|---|---|---|
| `additionalFields` | Map | Additional fields to return |
| `catalogIds` | String[] | Filter by catalog membership |
| `categoryIds` | String[] | Filter by category membership |
| `correlationId` | String | Tracking token |
| `filter` | Criteria | Filter operators: `eq`, `in`, `contains`, `gt`, `lt`, `gte` (v63+), `lte` (v63+) for Number/Date/Datetime; properties: `name`, `description`, `isActive`; with indexed data, only `name` |
| `language` | String | v64+ |
| `offset` | Integer | |
| `pageSize` | Integer | 1-200, default 100 |
| `relatedObjectFilters` | RelatedObjectFilters | Filter by ProductSpecificationRecType |
| `searchTerm` | String | v62+ free text search |
| `sort` | SortInput | With indexed data, only `name` sortable |

### 8.5 Product By ID API

**GET** `/connect/pcm/products/{productId}`

Returns single product. Note: `catalogs` and `categories` arrays are empty in the response for this endpoint; use Product List POST to get catalog/category associations.

### 8.6 Bulk Product Details API

**POST** `/connect/pcm/products/bulk`

`BulkProductDetailsInput`:

| Parameter | Type | Notes |
|---|---|---|
| `productIds` | String[] | IDs to retrieve |
| `uptoLevel` | Integer | Max 1; if unspecified, returns full hierarchy |
| `language` | String | Language locale |
| `additionalFields` | Map | Extra fields |
| `catalogSystems` | String[] | `pcm` or `epc` |

### 8.7 Related Records API

**POST** `/connect/pcm/products/related-records` (v62+)

Retrieves related `ProductRampSegment` or `ProductUsageGrant` records for up to 20 product IDs.

`RelatedRecordsInput`:
- `recordIds[]` — max 20 product IDs
- `relatedObjectNodes[]` — max 2 nodes, each with:
  - `relatedObjectAPIName` — `ProductRampSegment` or `ProductUsageGrant`
  - `pageSize` — pagination
  - `offSet` — offset
  - `filter` — filter on `StartDate`, `EndDate`, `Status` with `eq`, `gte`, `lte`

Response (`RelatedRecordsList`):
- `correlationId`
- `relatedRecords[]` — per record ID
- `status`

### 8.8 Deep Clone API (v63+)

**POST** `/connect/pcm/deep-clone`

Clones a product and all associated records.

Request:
```json
{
  "mainObjectApiName": "Product2",
  "mainRecordId": "...",
  "mainRecordFieldValues": { "Name": "Cloned Product Name" }
}
```

- `mainObjectApiName` — only `Product2` is supported
- `mainRecordId` — required
- `mainRecordFieldValues` — optional, only `Name` field can be passed

Response (`DeepCloneResponse`):
- `createdRecordList[]` — each with `createdRecordId`, `entityApiName`, `entityLabel`
- `createdRootRecordId` — ID of cloned root product
- `errorList[]` — `DeepCloneError[]` with `errorCode` and `errorMessage`
- `errorMessage` — top-level error message
- `isSuccessful` — Boolean

---

## 9. Product Classification APIs

### 9.1 Product Classification Details (v66+)

**POST** `/revenue/product-catalog-management/product-classifications/details`

Request:
```json
{
  "productClassificationIds": ["id1", "id2"],
  "catalogSystems": ["epc"]
}
```
- `catalogSystems` — only `epc` supported for this endpoint

Response: `ProductClassificationDetailsCollection`
- `success` — Boolean
- `errors` — `ProductCatalogManagementError[]`
- `productClassifications` — `ProductClassificationDetails[]`

Each `ProductClassificationDetails` includes `attributeCategories` and `attributes` (v66+).

### 9.2 Product Classification List (v67+)

**POST** `/revenue/product-catalog-management/product-classifications/list`

```json
{
  "catalogSystem": "pcm",
  "filter": { "criteria": [{ "operator": "contains", "property": "name", "value": "Mobile" }] },
  "pageSize": 25,
  "searchTerm": "device",
  "sort": { "orders": [{ "direction": "asc", "property": "name" }] }
}
```

`pageSize` valid values: `5`, `10`, `25`, `50`, `100` (not arbitrary integers).

---

## 10. Indexing and Search

### 10.1 Index Architecture

PCM uses a snapshot-based indexing system for product search. The flow is:

```
Products/Attributes → Index Build → Snapshot → Activate → Live Search
```

When "Use Indexed Data For Product Listing and Search" toggle is enabled in Setup (Product Discovery Settings), the search and listing APIs use the index.

### 10.2 Index Configuration API

**GET** `/connect/pcm/index/configurations` (v62+)

Query params:
- `fieldTypes` — filter: `STANDARD`, `CUSTOM`, `ProductDynamicAttribute`, `ProductAttributeDefinitionStandard`, `ProductAttributeDefinitionCustom`
- `includeMetadata` — Boolean

**PUT** `/connect/pcm/index/configurations` (v62+)

Updates which fields are indexed and/or facetable.

Response (`IndexConfigurationCollection`):
```json
{
  "correlationId": "...",
  "errors": [],
  "indexConfigurations": [
    {
      "attributeDefinitionId": "...",
      "attributeFieldId": "...",
      "facetDisplayRank": 1,      // v63+
      "isFacetable": true,        // v63+
      "isSearchable": true,
      "name": "ProductName",
      "type": "STANDARD"
    }
  ],
  "metadata": [...],
  "statusCode": "200"
}
```

### 10.3 Index Setting API (v63+)

**GET** `/connect/pcm/index/setting`

**PATCH** `/connect/pcm/index/setting`

Setting body:
```json
{
  "defaultLanguage": "en_US",
  "supportedLanguages": ["en_US", "ja", "es", "nl_NL"],
  "productsGrouping": "..."
}
```
Both `defaultLanguage` and `supportedLanguages` are required.

Setting output:
- `defaultLanguage` — String
- `id` — String
- `supportedLanguages` — String[]
- `activeLanguages` (metadata) — String[] — currently active languages in the org

### 10.4 Snapshot Management

#### Snapshot Collection GET

**GET** `/connect/pcm/index/snapshots` (v62+)

Query param: `numberOfIndexLogs` — 0-100, default 25.

Response includes `Snapshot[]`, each with:
- `activationDate` — when activated
- `activationStatus` — `NONE`, `ACTIVE`, `EXPIRED`
- `activationType` — `IMMEDIATE`
- `id` — snapshot ID
- `snapshotIndexes` — `SnapshotIndex[]`

#### Snapshot Deployment POST

**POST** `/connect/pcm/index/deploy` (v62+)

```json
{
  "buildType": "FULL",
  "snapshot": [
    {
      "activationType": "IMMEDIATE",
      "id": "existing-snapshot-id"
    }
  ]
}
```

- `buildType` — `FULL` or `INCREMENTAL` (v63+)
- `activationType` — only `IMMEDIATE` is supported
- `id` — pass the ID of an active snapshot to rebuild it; omit to create a new snapshot

#### Snapshot Deployment Response

```json
{
  "errors": [],
  "snapshot": {
    "activationStatus": "NONE",
    "activationType": "IMMEDIATE",
    "id": "1Avxx0000004CFU",
    "snapshotIndexes": [
      {
        "createdDate": "...",
        "id": "...",
        "indexBuildType": "FULL",
        "indexType": "PRODUCT",
        "lastBuildStatus": "IN_PROGRESS"
      }
    ]
  },
  "statusCode": "200"
}
```

#### Snapshot Index Error GET (v63+)

**GET** `/connect/pcm/index/error`

Required query params: `indexId` + `snapshotIndexId`

Response (`SnapshotIndexError`):
- `errorFileId` — ID of error file
- `indexCreatedDate`
- `indexErrorsCount`
- `indexLastUpdatedDate`
- `itemLevelErrorsCount`

### 10.5 SnapshotIndex Fields

| Field | Type | Description |
|---|---|---|
| `completedDate` | String | When build completed |
| `createdDate` | String | When build started |
| `id` | String | Index ID |
| `indexBuildType` | String | `FULL` or `INCREMENTAL` (v63+) |
| `indexInfos` | IndexInfo[] | v63+ — info records |
| `indexLogs` | IndexLogs[] | v63+ — build log entries |
| `indexType` | String | `PRODUCT` |
| `lastBuildStatus` | String | `IN_PROGRESS`, `FAILED`, `COMPLETED` |
| `numberOfRecords` | Integer | Count of indexed records |
| `venueId` | String | v63+ |

### 10.6 IndexInfo Fields (v63+)

| Field | Description |
|---|---|
| `buildType` | `FULL` or `INCREMENTAL` |
| `id` | Record ID |
| `isIncrementable` | Whether partial build enabled |
| `usageType` | `LIVE` or `OUT_OF_USE` |

### 10.7 IndexLog Fields (v63+)

| Field | Description |
|---|---|
| `catalogSnapshotTime` | Timestamp of catalog snapshot |
| `completionTime` | When build completed |
| `createdById` | User who triggered build |
| `indexBuildStatus` | `COMPLETED`, `COMPLETED_WITH_ERRORS`, `IN_PROGRESS` |
| `indexBuildType` | `FULL` or `INCREMENTAL` |
| `indexId` | Index ID |
| `message` | Status message (e.g., "Warning: Product errors found.") |
| `numberOfChanges` | Number of records changed in build |

### 10.8 Faceted Search

When indexed data is enabled, the Product List API returns `facets[]` in the response:

```json
{
  "facets": [
    {
      "attributeType": "ProductStandard",
      "displayName": "Product Type",
      "displayRank": 1,
      "displayType": "MultiSelect",
      "nameOrId": "Type",
      "values": [
        { "displayName": "Simple", "nameOrId": "Simple", "productCount": 9 }
      ]
    }
  ]
}
```

`SearchFacet` fields:
- `attributeType` — search attribute type
- `displayName` — display name
- `displayRank` — sort order
- `displayType` — display type
- `nameOrId` — reserved for internal use
- `values` — `FacetValue[]` sorted by displayName alphabetically

`FacetValue` fields:
- `displayName`
- `nameOrId` — reserved for internal use
- `productCount`

### 10.9 Indexed Data Restrictions

When "Use Indexed Data For Product Listing and Search" is enabled:
- `filter` — only `name` property supported; `contains` operator NOT available
- `sort` — only `name` property supported
- `attributeType` in Criteria supports additional types: `ProductDynamicAttribute`, `ProductAttributeStandard`, `ProductAttributeCustom`
- `facets` array populated in response (v63+)
- `isFacetableConfigurable` and `isSearchableConfigurable` fields available on Index Configuration Field (v63+)

---

## 11. Criteria and Filter System

### 11.1 Criteria Input

| Field | Description |
|---|---|
| `attributeType` | `ProductStandard`, `ProductCustom`, `ProductDynamicAttribute`, `ProductAttributeStandard`, `ProductAttributeCustom` (last 3 only with indexed data toggle) |
| `criteriaType` | `CustomWhereCondition` |
| `operator` | `eq`, `in`, `contains` (not with indexed), `gt`, `lt`, `gte` (v63+), `lte` (v63+) |
| `property` | Field API name |
| `value` | Filter value |

### 11.2 Sort Input

```json
{
  "sort": {
    "orders": [
      { "direction": "asc", "property": "name" },
      { "direction": "desc", "property": "productCode" }
    ]
  }
}
```

With indexed data, only `name` is sortable.

### 11.3 Filter on Product Input

Properties available for `filter` (without indexed data):
- `name`
- `description`
- `isActive`

With indexed data, only `name` is filterable.

---

## 12. Unit of Measure APIs (v63+)

### 12.1 UoM Info GET

**GET** `/connect/pcm/unit-of-measure/info`

Query param: `ids` — comma-separated UoM IDs.

### 12.2 UoM Rounded Data POST

**POST** `/connect/pcm/unit-of-measure/rounded-data`

Request:
```json
{
  "dataRowInputs": [
    {
      "key": "row1",
      "fieldDataInputs": [
        {
          "fieldApiName": "Quantity",
          "originalValue": "10.75",
          "unitOfMeasureId": "..."
        }
      ]
    }
  ]
}
```

Response (`DataRounding`): Map of key to `DataRowOutput`, each with `fieldApiNameToFieldDataOutput` map. Each `FieldData` output:

| Field | Description |
|---|---|
| `fieldApiName` | API name of the field |
| `originalValue` | Input value |
| `isRoundingApplicable` | Whether rounding was applied |
| `roundedValue` | Rounded result |
| `unitOfMeasureId` | UoM record ID |
| `errorCodeToErrorMap` | Errors if any |

---

## 13. Error Handling

### 13.1 Standard Error Output

All PCM APIs return errors in a consistent format:

| Field | Version | Description |
|---|---|---|
| `errorCode` | 60 | Machine-readable error code |
| `messageDetail` | 60 | Detailed error message |
| `messageTitle` | 60 | Short error title |
| `nodeProductId` | 61 | Product ID where error occurred |
| `recordId` | 60 | Record ID causing error |
| `recordName` | 60 | Record name |
| `relatedObjectNodes` | 62 | `InvalidRelatedObjectNode[]` |
| `source` | 60 | Error source |

### 13.2 Product Catalog Management Error (v66+)

Simplified error format used in newer endpoints:
```json
{
  "errorCode": "INSUFFICIENT_ACCESS",
  "message": "Insufficient access rights on cross-reference ID"
}
```

### 13.3 Deep Clone Error

```json
{
  "errorCode": "...",
  "errorMessage": "..."
}
```

### 13.4 Invalid Related Object Node (v62+)

```json
{
  "errorMessages": ["..."],
  "relatedObjectAPIName": "ProductRampSegment"
}
```

### 13.5 Status Object

All PCM list APIs return a `status` wrapper:
```json
{
  "status": {
    "code": "200",
    "correlationId": "fd158d80-d73c-4a1f-a009-9225db804d70",
    "errors": [],
    "message": "Successfully fetched product records."
  }
}
```

---

## 14. Products Output Container

The `Products` output (response to Product List POST and Bulk Product Details POST) contains:

| Field | Type | Version | Description |
|---|---|---|---|
| `correlationId` | String | 60 | Tracking UUID (auto-generated if not provided) |
| `count` | Integer | 60 | Total products matching query |
| `facets` | SearchFacet[] | 63 | Faceted search data (indexed data only) |
| `products` | Product[] | 60 | Matching product records |
| `status` | Status | 60 | Request status |

---

## 15. Additional Fields System

### 15.1 AdditionalFields Input

Supported objects for `additionalFields`:
- `Product2`
- `ProductAttributeDefinition`
- `AttributeDefinition` (when DRO permission enabled, with fields: `OptOutAssetization`, `OptOutDecompositionAction`, `OptOutSupplementalAction`)

### 15.2 Using additionalFields

Pass custom or standard field API names to include them in responses:
```json
{
  "additionalFields": {
    "Product2": ["code__c", "My_Custom_Field__c"]
  }
}
```

In product response:
```json
"additionalFields": {
  "code__c": "SWX445"
}
```

---

## 16. Common Patterns and Gotchas

### 16.1 POST-for-GET Pattern

Several PCM list endpoints use HTTP POST for retrieval operations, not GET. This is because complex filter/sort/pagination bodies cannot be expressed in GET query params:
- **Catalog List** — POST to `/connect/pcm/catalogs`
- **Product List** — POST to `/connect/pcm/products`
- **Bulk Product Details** — POST to `/connect/pcm/products/bulk`
- **Product Classification List** — POST to `/revenue/product-catalog-management/product-classifications/list`
- **Product Classification Details** — POST to `/revenue/product-catalog-management/product-classifications/details`

### 16.2 Catalog/Category Arrays in Product Responses

- Product List POST: `catalogs[]` and `categories[]` are populated (returns `name` and `id` only)
- Product By ID GET: `catalogs[]` and `categories[]` are always empty — do not rely on these for category data when using the GET endpoint

### 16.3 Filter Operators by Type

| Operator | Without Indexed Data | With Indexed Data | Notes |
|---|---|---|---|
| `eq` | Yes | Yes | Exact match |
| `in` | Yes | Yes | Array of values |
| `contains` | Yes | No | Substring match |
| `gt`, `lt`, `gte`, `lte` | v63+ Number/Date/Datetime | No | Numeric/date comparison |

### 16.4 pageSize Constraints

- Catalog List: 1-100
- Product List: 1-200, default 100
- Product Classification List: only specific values allowed: `5`, `10`, `25`, `50`, `100` (not arbitrary integers)
- Related Records: use `pageSize` on `relatedObjectNodes`
- Snapshot Collection: `numberOfIndexLogs` 0-100, default 25

### 16.5 Bundle Depth Control

In Bulk Product Details, `uptoLevel`:
- Max value: `1`
- If unspecified: returns full hierarchy
- Use `uptoLevel: 1` to limit to immediate children only

### 16.6 Deep Clone Limitations

- Only `Product2` is supported as `mainObjectApiName`
- Only `Name` can be passed in `mainRecordFieldValues`
- The `isValueCloneable` attribute flag controls whether attribute values are copied

### 16.7 productUnitOfMeasures in Product Response

Products from EPC catalog system may include `productUnitOfMeasures: []` array in the response.

### 16.8 Indexed Data Toggle Effects

Enabling "Use Indexed Data For Product Listing and Search" in Setup changes behavior:
1. `filter.property` restricted to `name` only
2. `sort.property` restricted to `name` only
3. `contains` operator unavailable in filter
4. `facets[]` populated in response
5. Additional `attributeType` values become available in criteria
6. `gt`/`lt`/`gte`/`lte` operators unavailable

### 16.9 Language Support in APIs

- Catalog List: `language` param available from v64
- Product List: `language` param available from v64
- Catalog By ID: `language` query param available
- If data translation is configured in the org, `name` and `description` fields return translated values

### 16.10 correlationId Behavior

- Optional in requests
- If not provided, a UUID is auto-generated
- Used to track related API calls across a session
- Returned in response `status` block and top-level `correlationId` field

### 16.11 nodeType Values

Products have a `nodeType` field that indicates their role:
- `simpleProduct` — standalone product, no children
- `bundleProduct` — product that is part of or contains a bundle
- `productClass` — product used for classification-based component selection

### 16.12 isSoldOnlyWithOtherProds

When `true`, this product cannot be sold standalone — it must be part of a bundle. Use this flag to prevent direct quoting of components.

### 16.13 isAssetizable

When `true`, purchasing this product creates a customer asset. Critical for subscription and renewal flows.

### 16.14 ProductClassification in Components

`productRelatedComponent` can include `productClassificationId` to indicate that any product of that classification can fulfill the component slot. This enables classification-based bundle composition.

---

## 17. API Version Reference

| API/Feature | Available Since |
|---|---|
| Core PCM APIs (products, catalogs, categories) | v60 |
| `ProductClassification.code`, `name`, `status` | v61 |
| `childGroups` in ProductComponentGroup | v62 |
| Snapshot Collection GET | v62 |
| Snapshot Deployment POST | v62 |
| Related Records POST | v62 |
| `isNavigational` on Category | v62 |
| `productInstanceReuse` on ProductRelatedComponent | v62 |
| Product List `searchTerm` | v62 |
| Index Configuration GET/PUT | v62 |
| `gt`, `lt`, `gte`, `lte` operators | v63 |
| Deep Clone API | v63 |
| INCREMENTAL build type | v63 |
| Index Setting GET/PATCH | v63 |
| UoM Info/Rounded Data | v63 |
| Snapshot Index Error GET | v63 |
| Faceted search (`facets` in response) | v63 |
| `isFacetable`, `facetDisplayRank` on Index Config | v63 |
| `AttributeDefinition.Currency`, `Percent` dataTypes | v61 |
| `language` param on Product List, Catalog List | v64 |
| `quoteVisibility` on ProductRelatedComponent | v64 |
| `parentProductClassificationId` on Classification | v65 |
| Product Classification Details POST | v66 |
| `PCM Error` simplified error format | v66 |
| Product Classification List POST | v67 |
| `Product2.DecompositionScope`, `FulfillmentQtyCalcMethod` | v61 |
| `Product2.UsageModelType` | v62 |
