---
name: revenue-cloud-pcm-apis
description: Complete API reference for Revenue Cloud Product Catalog Management (PCM) — all 18 endpoints, params, versions from PDF pages 127-284, scan date 2026-06-13
metadata:
  type: reference
---

# Revenue Cloud PCM Business APIs

## Source
PDF: revenue_lifecycle_management_dev_lates.pdf (2917 pages)
Section: Pages 127–284
Scanned: 2026-06-13

---

## Endpoints

### Bulk Product Details
- Method: POST
- Path: `/connect/pcm/products/bulk`
- Version: v61.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | productIds | String[] | Required | 61.0 | List of product IDs. Invalid/not-found IDs are skipped |
  | additionalFields | Map<String,AdditionalFieldsInput> | Optional | 61.0 | Extra fields for Product2, ProductAttributeDefinition, OptOutAssetization, OptOutDecompositionAction, OptOutSupplementalAction |
  | catalogSystems | String[] | Optional | 66.0 | Valid values: epc, pcm. Default: pcm |
  | correlationId | String | Optional | 61.0 | Tracking token; UUID generated if unspecified |
  | language | String | Optional | 64.0 | Language for translated field data |
  | uptoLevel | Integer | Optional | 61.0 | Bundle hierarchy depth (max 1). Default: full hierarchy |
- Response: Products Output — full product details including attributes and bundle hierarchy

---

### Catalog List
- Method: POST
- Path: `/connect/pcm/catalogs`
- Version: v60.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | correlationId | String | Optional | 60.0 | Tracking token |
  | filter | Filter | Optional | 60.0 | Filter on ProductCatalog fields. Operators: eq, in, contains. Properties: name, catalogType |
  | language | String | Optional | 64.0 | Language for translated data |
  | offset | Integer | Optional | 60.0 | Records to skip. Default: 0 |
  | pageSize | Integer | Optional | 60.0 | Records per page. Range: 1-100. Default: 100 |
  | sort | Sort | Optional | 60.0 | Sort order for catalog records. Operators: asc, desc |
- Response: Catalogs Output — paginated list of ProductCatalog records

---

### Catalog By ID
- Method: GET
- Path: `/connect/pcm/catalogs/{catalogId}`
- Version: v60.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | catalogId | String | Required | 60.0 | Path param — catalog record ID |
  | correlationId | String | Optional | 60.0 | Tracking token |
  | fields | String[] | Optional | 60.0 | For internal use only |
  | language | String | Optional | 64.0 | Language for translated data |
- Response: Catalogs Output — single catalog record

---

### Categories List (PCM)
- Method: GET
- Path: `/connect/pcm/catalogs/{catalogId}/categories`
- Version: v60.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | catalogId | String | Required | 60.0 | Path param — catalog ID |
  | correlationId | String | Optional | 60.0 | Tracking token |
  | depth | Integer | Optional | 60.0 | Hierarchy levels to return. Default: 1 |
  | fields | String[] | Optional | 60.0 | For internal use only |
  | language | String | Optional | 64.0 | Language for translated data |
  | parentCategoryId | String | Optional | 60.0 | Returns subcategories of specified category. Default: root-level categories |
- Response: Categories Output — hierarchical category tree

---

### Category By ID (PCM)
- Method: GET
- Path: `/connect/pcm/categories/{categoryId}`
- Version: v60.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | categoryId | String | Required | 60.0 | Path param — category ID |
  | correlationId | String | Optional | 60.0 | Tracking token |
  | fields | String[] | Optional | 60.0 | For internal use only |
  | language | String | Optional | 64.0 | Language for translated data |
- Response: Categories Output — single category record

---

### Products List
- Method: POST
- Path: `/connect/pcm/products`
- Version: v60.0
- Query Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | productClassificationId | String | Optional | 60.0 | Filter by product classification. Specify this OR categoryIds OR catalogIds |
- Body Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | additionalFields | Map<String,AdditionalFieldsInput> | Optional | 61.0 | Extra Product2 fields |
  | catalogIds | List<String> | Optional | 60.0 | Filter by catalog IDs. Specify this OR categoryIds OR productClassificationId |
  | categoryIds | List<String> | Optional | 60.0 | Filter by category IDs. Default: all products in at least one category |
  | correlationId | String | Optional | 60.0 | Tracking token |
  | filter | Criteria Input | Optional | 60.0 | Filter on Product2 fields. Operators: eq, in, contains (not with indexed), gt, lt, gte, lte. Props: name, description, isActive. Only name when indexed |
  | language | String | Optional | 64.0 | Language for translated data |
  | offset | Integer | Optional | 60.0 | Records to skip. Default: 0 |
  | pageSize | Integer | Optional | 60.0 | Records per page. Range: 1-200. Default: 100 |
  | relatedObjectFilters | Related Object Filter[] | Optional | 60.0 | Filter on ProductSpecificationRecType.IsCommercial (eq, true/false) |
  | searchTerm | String | Optional | 62.0 | Product name contains search term |
  | sort | Sort | Optional | 60.0 | Sort by name only when indexed |
- Response: Products Output — paginated product list

---

### Product Details
- Method: GET
- Path: `/connect/pcm/products/{productId}`
- Version: v60.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | productId | String | Required | 60.0 | Path param — product ID |
  | catalogSystems | String[] | Optional | 66.0 | epc or pcm. Although accepts list, pass only one value. Default: pcm |
  | correlationId | String | Optional | 60.0 | Tracking token |
  | fields | String[] | Optional | 60.0 | For internal use only |
  | language | String | Optional | 64.0 | Language for translated data |
- Response: Products — single product with full attribute and bundle details

---

### Deep Clone
- Method: POST
- Path: `/connect/pcm/deep-clone`
- Version: v63.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | mainObjectApiName | String | Required | 63.0 | API name of object to clone. Supported: Product2 |
  | mainRecordId | String | Required | 63.0 | ID of the record to clone |
  | mainRecordFieldValues | Map<String,String> | Optional | 63.0 | Field overrides for cloned record. Only Name field supported |
- Response: Deep Clone Response — ID of new cloned record

---

### Product Classification Details
- Method: POST
- Path: `/revenue/product-catalog-management/product-classifications/details`
- Version: v66.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | productClassificationIds | String[] | Required | 66.0 | IDs to retrieve. In epc catalog: these are Product2 record IDs |
  | catalogSystems | String[] | Optional | 66.0 | Valid value: epc (Enterprise Product Catalog) |
- Response: Product Classification Details Collection

---

### Product Classification List
- Method: POST
- Path: `/revenue/product-catalog-management/product-classifications/list`
- Version: v67.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | catalogSystem | String | Optional | 67.0 | pcm or epc. Default: pcm |
  | filter | Criteria Input | Optional | 67.0 | Filter on name. Operators: eq, in, contains |
  | offset | Integer | Optional | 67.0 | Records to skip. Default: 0 |
  | pageSize | Integer | Optional | 67.0 | Valid values: 5, 10, 25, 50, 100. Default: 100 |
  | searchTerm | String | Optional | 67.0 | Search by product classification name |
  | sort | Order Input | Optional | 67.0 | Default: name ascending |
- Response: Product Classification List Collection

---

### Product Related Records List
- Method: POST
- Path: `/connect/pcm/relatedRecords/{entityName}`
- Version: v62.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | entityName | String | Required | 62.0 | Path param — entity name |
  | correlationId | String | Optional | 62.0 | Tracking token |
  | recordIds | String[] | Required | 62.0 | Record IDs to get related objects for. Max: 20 |
  | relatedObjectNodes | Related Object Node Input[] | Required | 62.0 | List of related object nodes. Max: 2 |
- Response: Related Records List

---

### Snapshot Collection
- Method: GET
- Path: `/connect/pcm/index/snapshots`
- Version: v62.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | numberOfIndexLogs | Integer | Optional | 63.0 | Index logs to include. Range: 0-100. Default: 25 |
- Response: Snapshot Collection — list of index snapshots

---

### Snapshot Deployment
- Method: POST
- Path: `/connect/pcm/index/deploy`
- Version: v62.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | buildType | String | Required | 62.0 | FULL or INCREMENTAL (INCREMENTAL available from v63.0+) |
  | snapshot | Run-time Catalog Snapshot Input[] | Required | 62.0 | Snapshot to deploy |
- Response: Snapshot Deployment result

---

### Snapshot Index Error
- Method: GET
- Path: `/connect/pcm/index/error`
- Version: v63.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | indexId | String | Required | 63.0 | ID of the index |
  | snapshotIndexId | String | Required | 63.0 | ID of the snapshot index |
- Response: Snapshot Index Error details

---

### Index Configuration Collection
- Method: GET, PUT
- Path: `/connect/pcm/index/configurations`
- Version: v62.0
- GET Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | correlationId | String | Optional | 62.0 | Tracking token |
  | fieldTypes | String[] | Optional | 62.0 | Filter by type: STANDARD, CUSTOM, ProductDynamicAttribute, ProductAttributeDefinitionStandard, ProductAttributeDefinitionCustom |
  | includeMetadata | Boolean | Optional | 62.0 | Include metadata (true) or not (false) |
- PUT Body Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | correlationId | String | Optional | 62.0 | Tracking token |
  | indexConfigurations | IndexConfigurationInput[] | Required | 62.0 | List of index configurations to update |
- Response GET: Index Configuration Collection
- Response PUT: Index Configurations Update result

---

### Index Setting
- Method: GET, PATCH
- Path: `/connect/pcm/index/setting`
- Version: v63.0
- GET Params: None
- PATCH Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | settingId | String | Required | 63.0 | ID of the setting to update |
  | setting | SettingInput[] | Required (body) | 63.0 | Object with setting details |
- Response GET: Index Setting Results
- Response PATCH: Index Setting Update result

---

### Unit of Measure Info
- Method: GET
- Path: `/connect/pcm/unit-of-measure/info`
- Version: v63.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | correlationId | String | Optional | 63.0 | Tracking token |
  | ids | String | Optional | 63.0 | IDs of unit of measure records |
- Response: Bulk Unit Of Measure Info

---

### Unit of Measure Rounded Data
- Method: POST
- Path: `/connect/pcm/unit-of-measure/rounded-data`
- Version: v63.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | correlationId | String | Optional | 63.0 | Tracking token |
  | dataRowInputs | Data Row Input[] | Required | 63.0 | List of row inputs for rounding |
- Response: Data Rounding result

---

## Notes
- All paths prefixed with `/services/data/v67.0` in actual requests
- `language` param (v64.0+) enables translated field data for objects with translation enabled
- `fields` param marked "internal use only" in all endpoints — avoid using in production
- `uptoLevel` in Bulk Product Details: max value is 1 (one level of bundle children)
- PCM Products List: must specify exactly one of catalogIds, categoryIds, or productClassificationId
