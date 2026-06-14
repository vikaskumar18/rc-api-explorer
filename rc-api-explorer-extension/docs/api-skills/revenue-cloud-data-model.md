---
name: revenue-cloud-data-model
description: Revenue Cloud Data Model — all sObjects, fields, relationships, constraints — Revenue Cloud Developer Guide PDF (2026-06-13)
metadata:
  type: reference
---

# Revenue Cloud Data Model — sObjects, Fields & Relationships

## Source
PDF: revenue_lifecycle_management_dev_lates.pdf (2917 pages)
Scanned: 2026-06-13
Pages covered: 113–200 (PCM Standard Objects + PCM Fields on Standard Objects + PCM Business APIs)

---

## PCM Objects

### ProductSpecificationRecType
Represents the relationship between industry-specific product specifications and the product record type. Available in API version 60.0 and later.

Supported Calls: `create(), delete(), describeSObjects(), query(), retrieve(), update(), upsert()`

Special Access: Product Catalog Management must be enabled.

| Field | Type | Req | Notes |
|---|---|---|---|
| DeveloperName | string | Optional | Unique API name; max 40 chars, alphanumeric + underscores, must start with letter, no consecutive underscores |
| IsCommercial | boolean | Optional | Indicates whether the product is sold commercially (true) or not (false) |
| Language | picklist | Optional | ISO language/locale code. Values: `da`, `de`, `en_US`, `es`, `es_MX`, `fi`, `fr`, `it`, `ja`, `ko`, `nl_NL`, `no`, `pt_BR`, `ru`, `sv`, `th`, `zh_CN`, `zh_TW` |
| MasterLabel | string | Optional | Display label (internal, not translated) |
| NamespacePrefix | string | Optional | Namespace prefix for managed packages. Max 15 chars |
| ProductSpecificationType | picklist | Optional | The product specification type associated with the record type |
| RecordTypeId | reference | Optional | ID of the associated RecordType. Relationship: `RecordType` (Lookup) → `RecordType` |

Associated Objects: `ProductRelComponentOverrideFeed`, `ProductRelComponentOverrideHistory`, `ProductRelComponentOverrideShare`

---

### ProductSpecificationType
Represents the type of product specification provided by the user to make product terminology unique to an industry. Available in API version 60.0 and later.

Supported Calls: `create(), delete(), describeSObjects(), query(), retrieve(), update(), upsert()`

Special Access: Product Catalog Management must be enabled.

| Field | Type | Req | Notes |
|---|---|---|---|
| Description | textarea | Optional | Description of the Product Specification Type |
| DeveloperName | string | Optional | Unique API name; max 40 chars, alphanumeric + underscores, must start with letter |
| Language | picklist | Optional | ISO language/locale code. Same values as ProductSpecificationRecType.Language |
| MasterLabel | string | Optional | Display label (internal, not translated) |
| NamespacePrefix | string | Optional | Namespace prefix for managed packages. Max 15 chars |

---

## PCM Fields on Standard Objects

PCM adds standard and custom fields to existing Salesforce objects. Available only in orgs where PCM is enabled. API version 60.0 and later unless noted.

### AttributeDefinition (PCM-added fields)

| Field | Type | Req | Notes |
|---|---|---|---|
| DataType | picklist | Optional | Data type of the attribute definition. Values: `Checkbox`, `Currency` (v61+), `Date`, `Datetime`, `Number`, `Percent` (v61+), `Picklist`, `Text` |

---

### Product2 (PCM-added fields)

| Field | Type | Req | Notes |
|---|---|---|---|
| BasedOn | reference | Optional | ID of the product classification from which this product inherits. Relationship: `BasedOn` (Lookup) → `ProductClassification` |
| Help Text | textarea | Optional | Help text at runtime for the product. Max 32,000 alphanumeric characters |
| Availability Date | dateTime | Optional | The date when the product is available |
| CanRamp | boolean | Optional | Whether the product's terms, volumes, and other commitments can be ramped at run time. Default: `false` |
| Discontinued Date | dateTime | Optional | The date when the product is discontinued |
| End Of Life Date | dateTime | Optional | The date/time after which a product isn't supported, ordered, or maintained |
| Specification Type | string | Optional | The type of product specification being created |
| DecompositionScope | picklist | Optional | Number of fulfillment order line items that must be generated. Available v61+. Values: `Account`, `Bundle`, `Order`, `OrderLineItem` |
| FulfillmentQtyCalcMethod | picklist | Optional | Whether quantity of fulfillment order line items must always be 1 or aggregated from source lines. Available v61+. Values: `Aggregate`, `AlwaysOne` |
| UsageModelType | picklist | Optional | Type of usage model. Anchor = main subscription product, Pack = add-on granting additional usage resources. Available v62+. Values: `Anchor`, `Pack` |

---

### ProductCatalog (PCM-added fields)
Available in API version 60.0 and later.

| Field | Type | Req | Notes |
|---|---|---|---|
| Code | string | Optional | Unique ID associated with the catalog. Max 80 alphanumeric characters |
| Description | textarea | Optional | Description of the catalog used during design time. Max 255 alphanumeric characters |
| EffectiveEndDate | dateTime | Optional | Date after which the product catalog is unavailable to end users |
| EffectiveStartDate | dateTime | Optional | Date on which the product catalog is available to end users |
| CatalogType | picklist | Optional | Category of an entry in the catalog. Values: `Sales` (default), `ServiceProcess` |

---

### ProductCategory (PCM-added fields)

| Field | Type | Req | Notes |
|---|---|---|---|
| Code | string | Optional | Unique ID associated with the category. Max 80 alphanumeric characters |
| IsNavigational | boolean | Optional | Whether the category or subcategory is shown in the menu as a navigational breadcrumb. Available v62+. Default: `false` |

---

### ProductComponentGroup (PCM-added fields)

| Field | Type | Req | Notes |
|---|---|---|---|
| ParentGroupId | reference | Optional | Parent product component group in a nested group hierarchy. Available v62+. Relationship: `ParentGroup` (Lookup) → `ProductComponentGroup` |

---

### ProductRelatedComponent (PCM-added fields)

| Field | Type | Req | Notes |
|---|---|---|---|
| ChildProductClassificationId | reference | Optional | The child product classification associated with a product. Relationship: `ChildProductClassification` (Lookup) → `ProductClassification` |
| QuoteVisibility | picklist | Optional | Specifies the product-related component to display as a quote line item in Transaction Line Editor and quote document. Default: `Always`. Values: `Always`, `Transaction Line Editor Only`, `Quote Document Only`, `Never` |

---

### ProductRelationshipType (PCM-added fields)

| Field | Type | Req | Notes |
|---|---|---|---|
| AssociatedProductRoleCat | picklist | Optional | The role that the associated component plays in the relationship. Values: `BundleComponent` (product is part of a bundle), `ClassificationComponent` (product is a product classification; v61+) |

---

### ProductSellingModelOption (PCM-added fields)
Available in API version 60.0 and later.

| Field | Type | Req | Notes |
|---|---|---|---|
| IsDefault | boolean | Optional | Whether this is the default product selling model for a product. Only one default allowed per product. Default: `false` |

---

## PCM Business APIs

Base path: `/services/data/v{version}/`

### Endpoint Summary

| Resource | Method | Description | Available Version |
|---|---|---|---|
| `/connect/pcm/catalogs` | POST | Retrieve, search, filter, or sort catalog records | 60.0 |
| `/connect/pcm/catalogs/{catalogId}` | GET | Retrieve details of catalog records by catalog ID | 60.0 |
| `/connect/pcm/catalogs/{catalogId}/categories` | GET | Retrieve root-level or subcategories of a catalog | 60.0 |
| `/connect/pcm/categories/{categoryId}` | GET | Retrieve details of individual category records | 60.0 |
| `/connect/pcm/products` | POST | Retrieve products; search, filter, or sort | 60.0 |
| `/connect/pcm/products/{productId}` | GET | Retrieve details of individual product or bundle | 60.0 |
| `/connect/pcm/products/bulk` | POST | Retrieve details for multiple products | 61.0 |
| `/connect/pcm/relatedRecords/{entityName}` | POST | Retrieve related ProductRampSegment or ProductUsageGrant records for Product2 | 62.0 |
| `/connect/pcm/index/configurations` | GET, PUT | Retrieve/persist saved index configurations | 62.0 |
| `/connect/pcm/index/snapshots` | GET | Retrieve created snapshots and snapshot indexes | 62.0 |
| `/connect/pcm/index/deploy` | POST | Create indexes for a snapshot | 62.0 |
| `/connect/pcm/index/setting` | GET, PATCH | Fetch and update settings related to indexing and search | 63.0 |
| `/connect/pcm/index/error` | GET | Get count and details of indexing errors | 63.0 |
| `/connect/pcm/deep-clone` | POST | Copy related records of an object along with the main product record | 63.0 |
| `/connect/pcm/unit-of-measure/info` | GET | Get details about unit of measure for a specific set of records | 63.0 |
| `/connect/pcm/unit-of-measure/rounded-data` | POST | Round off and scale decimal data for a specific set of fields | 63.0 |
| `/revenue/product-catalog-management/product-classifications/details` | POST | Retrieve details for a list of product classification records | 66.0 |
| `/revenue/product-catalog-management/product-classifications/list` | POST | Retrieve/search/filter/sort a list of product classification records | 67.0 |
| `/revenue/product-discovery/products/recommendations` | POST | Get a list of recommended products based on business rules | — |
| `/revenue/product-configurator/rules/actions/execute` | POST | Disable rules, get product recommendations, get message rules | — |

---

### Catalog List (POST) — `/connect/pcm/catalogs`
Request body properties:

| Name | Type | Req | Notes |
|---|---|---|---|
| correlationId | String | Optional | UUID token for tracking. Auto-generated if not specified |
| filter | Filter | Optional | Criteria applicable to ProductCatalog fields. Supported operators: `eq`, `in`, `contains`. Supported properties: `name`, `catalogType` |
| language | String | Optional | Custom language for translated fields. Available v64+ |
| offset | Integer | Optional | Records to skip. Default: 0 |
| pageSize | Integer | Optional | Records per page. Values: 1–100. Default: 100 |
| sort | Sort | Optional | Sort order. Operators: `asc`, `desc` |

---

### Catalog By ID (GET) — `/connect/pcm/catalogs/{catalogId}`
Request parameters:

| Name | Type | Req | Notes |
|---|---|---|---|
| correlationId | String | Optional | UUID tracking token |
| fields | String[] | Optional | For internal use only |
| language | String | Optional | Language for translated fields. Available v64+ |

---

### Categories List (GET) — `/connect/pcm/catalogs/{catalogId}/categories`
Request parameters:

| Name | Type | Req | Notes |
|---|---|---|---|
| correlationId | String | Optional | UUID tracking token |
| depth | Integer | Optional | Number of levels in category hierarchy to return. Default: 1 |
| fields | String[] | Optional | For internal use only |
| language | String | Optional | Language for translated fields. Available v64+ |
| parentCategoryId | String | Optional | ID of category to fetch subcategories for. If unspecified, root-level categories returned |

---

### Products List (POST) — `/connect/pcm/products`
Query parameters:

| Name | Type | Req | Notes |
|---|---|---|---|
| productClassificationId | String | Optional | ID of the product classification template. Specify either this, categoryIds, or catalogIds |

Request body properties:

| Name | Type | Req | Notes |
|---|---|---|---|
| additionalFields | Map<String, AdditionalFieldsInput> | Optional | Additional standard/custom fields to query. Supported object: Product2. Available v61+ |
| catalogIds | List<String> | Optional | List of catalog IDs to return associated products |
| categoryIds | List<String> | Optional | List of category IDs to return associated products |
| correlationId | String | Optional | UUID tracking token |
| filter | CriteriaInput | Optional | Filter applicable to Product2 fields. Operators: `eq`, `in`, `contains`, `gt`, `lt`, `gte`, `lte` (v63+ for gt/lt/gte/lte). Properties: `name`, `description`, `isActive` |
| language | String | Optional | Language for translated fields. Available v64+ |
| offset | Integer | Optional | Records to skip. Default: 0 |
| pageSize | Integer | Optional | Records per page. Values: 1–200. Default: 100 |
| relatedObjectFilters | RelatedObjectFilter[] | Optional | Filter by related object. Supported: `ProductSpecificationRecType` (property: `IsCommercial`) |
| searchTerm | String | Optional | Product name search string. Available v62+ |
| sort | Sort | Optional | Sort order for products |

---

### Bulk Product Details (POST) — `/connect/pcm/products/bulk`
Request body properties:

| Name | Type | Req | Notes |
|---|---|---|---|
| additionalFields | Map<String, AdditionalFieldsInput> | Optional | Supported objects: `Product2`, `ProductAttributeDefinition`. If DRO enabled, also supports `AttributeDefinition` keys: `OptOutAssetization`, `OptOutDecompositionAction`, `OptOutSupplementalAction`. Available v61+ |
| catalogSystems | String[] | Optional | Name of catalog system: `epc` (Enterprise Product Catalog), `pcm` (Product Catalog Management). Default: `pcm`. Available v66+ |
| correlationId | String | Optional | UUID tracking token |
| language | String | Optional | Language for translated fields. Available v64+ |
| productIds | String[] | Required | List of product IDs to retrieve details for |
| uptoLevel | Integer | Optional | Hierarchy level for bundle child components (max 1). Default: full hierarchy |

---

### Product Related Records List (POST) — `/connect/pcm/relatedRecords/{entityName}`
Supported entity: `product2`

Request body properties:

| Name | Type | Req | Notes |
|---|---|---|---|
| correlationId | String | Optional | UUID tracking token |
| recordIds | String[] | Required | List of record IDs. Max 20 |
| relatedObjectNodes | RelatedObjectNodeInput[] | Required | List of related object nodes. Max 2. Supported: `ProductRampSegment`, `ProductUsageGrant` |

RelatedObjectNodeInput filter supported properties (for `ProductUsageGrant`): `StartDate`, `EndDate`, `Status`. Operators: `eq`, `gte`, `lte`.

---

### Deep Clone (POST) — `/connect/pcm/deep-clone`
Request body properties:

| Name | Type | Req | Notes |
|---|---|---|---|
| mainObjectApiName | String | Required | API name of the object. Supported: `Product2` |
| mainRecordFieldValues | Map<String, String> | Optional | Field values to set on the created clone record. Only `Name` field supported |
| mainRecordId | String | Required | ID of the record to clone |

---

### Index Configuration Collection (GET, PUT) — `/connect/pcm/index/configurations`
GET parameters:

| Name | Type | Req | Notes |
|---|---|---|---|
| correlationId | String | Optional | UUID tracking token |
| fieldTypes | String[] | Optional | Filter by index configuration type: `STANDARD`, `CUSTOM`, `ProductDynamicAttribute`, `ProductAttributeDefinitionStandard`, `ProductAttributeDefinitionCustom` |
| includeMetadata | Boolean | Optional | Whether to include metadata (true/false) |

PUT body:

| Name | Type | Req | Notes |
|---|---|---|---|
| correlationId | String | Optional | UUID tracking token |
| indexConfigurations | IndexConfigurationInput[] | Required | List of index configurations |

IndexConfigurationInput properties:

| Name | Type | Req | Notes |
|---|---|---|---|
| attributeDefinitionId | String | Cond. Required | ID of the attribute definition. Required if attributeFieldId not specified |
| attributeFieldId | String | Cond. Required | ID of the attribute field. Required if attributeDefinitionId not specified |
| facetDisplayRank | Integer | Optional | Sort order for displaying facets at run time |
| isFacetable | Boolean | Optional | Whether the field is facetable |
| isSearchable | Boolean | Optional | Whether the index-configured field is searchable |
| name | String | Required | Name of the index-configured field |
| type | String | Required | Type of the index-configured field |

---

### Snapshot Deployment (POST) — `/connect/pcm/index/deploy`
Request body:

| Name | Type | Req | Notes |
|---|---|---|---|
| buildType | String | Required | `FULL` (full index build) or `INCREMENTAL` (v63+) |
| snapshot | RunTimeCatalogSnapshotInput[] | Required | Snapshot to deploy |

RunTimeCatalogSnapshotInput properties:

| Name | Type | Req | Notes |
|---|---|---|---|
| activationDate | String | Optional | Activation date of the snapshot |
| activationType | String | Required | `IMMEDIATE` — activated immediately after successful build |
| id | String | Required | ID of the snapshot |

---

### Product Classification Details (POST) — `/revenue/product-catalog-management/product-classifications/details`
Available v66+

Request body:

| Name | Type | Req | Notes |
|---|---|---|---|
| catalogSystems | String[] | Optional | Catalog system name. Valid value: `epc` |
| productClassificationIds | String[] | Required | List of product classification IDs. In `epc` catalog, these are Product2 record IDs |

---

### Product Classification List (POST) — `/revenue/product-catalog-management/product-classifications/list`
Available v67+

Request body:

| Name | Type | Req | Notes |
|---|---|---|---|
| catalogSystem | String | Optional | `pcm` (default) or `epc` |
| filter | CriteriaInput | Optional | Filter by `name`. Operators: `eq`, `in`, `contains` |
| offset | Integer | Optional | Records to skip. Default: 0 |
| pageSize | Integer | Optional | Records per page. Values: 5, 10, 25, 50, 100. Default: 100 |
| searchTerm | String | Optional | Search product classifications by name containing the search term |
| sort | OrderInput | Optional | Sort order. Default: name ascending |

---

## API Response Body Types (PCM)

| Response Body | Description |
|---|---|
| AttributeCategory | Output of attribute category |
| AttributeDefinition | Output of attribute definition |
| AttributePicklist | Output of attribute picklist |
| AttributePicklistValue | Output of attribute picklist value |
| Bulk Unit Of Measure Info | Details of unit of measure records with error details |
| Catalog Output | Output of the catalog definition |
| Catalogs Output | Output of retrieved catalog result |
| Categories Output | Output of retrieved categories result |
| Category Output | Output of the category definition |
| Deep Clone Response | Output of details of the cloned record |
| Product | Output of the product definition |
| Product Classification | Output of product classification details |
| Product Classification Details | Single product classification details including attributes and categories |
| Product Classification Details Collection | Collection of product classification details with processing errors |
| Product Classification List Collection | Collection of product classification records with processing errors |
| Product Component Group | Output of the product component group |
| Product Related Component | Output of the product-related component |
| Product Selling Model | Output of the definition of the product selling model |
| Product Selling Model Option | Output of the definition of the product selling model option |
| Product Specification Type | Output of the product specification type |
| Products Output | Output of the list of retrieved products |
| Related Records List | Output of the list of related records |
| Search Facet | Output of the details of the faceted search |

---

## AttributeDefinition Response — Key Properties

From the `/connect/pcm/products` and `/connect/pcm/products/bulk` response bodies, the `AttributeDefinition` output object includes:

| Property | Type | Notes |
|---|---|---|
| additionalFields | Map<String, AdditionalFieldsInput> | Key-value pair of additional fields |
| attributeNameOverride | String | Name to display for the attribute, overriding the attribute name |
| code | String | Unique code of the attribute definition |
| dataType | String | Data type of the attribute definition value |
| defaultValue | String | Default value of the attribute |
| description | String | Description of the attribute |
| displayType | String | Display type. Values: `Radio Button`, `Checkbox`, `Toggle`, `Input Date`, `DateTime`, `Currency Symbol`, `Currency Code`, `Currency Name`, `Percentage`, `Text`, `Combobox`, `MultiSelect`, `MultiSelectCheckboxes` |
| helpText | String | Help text at run time for the attribute |
| id | String | ID of the attribute definition |
| isHidden | Boolean | Whether attribute is hidden |
| isPriceImpacting | Boolean | Whether attribute affects pricing |
| isReadOnly | Boolean | Whether attribute is read-only |
| isRequired | Boolean | Whether attribute is required |
| label | String | Label of the attribute definition |
| maximumCharacterCount | String | Maximum character count |
| maximumValue | String | Maximum value |
| minimumCharacterCount | String | Minimum character count |
| minimumValue | String | Minimum value |
| name | String | Name of the attribute |
| sequence | Integer | Display sequence order |
| status | String | Status of the attribute (e.g., `Active`) |
| valueDescription | String | Description of the attribute value |

---

## Criteria Input — Filter Operators

| Operator | Notes |
|---|---|
| `eq` | Equals |
| `in` | In a list of values |
| `contains` | Contains substring (not applicable when Indexed Data toggle is enabled) |
| `gt` | Greater than — v63+, Number/Date/Datetime only |
| `lt` | Less than — v63+, Number/Date/Datetime only |
| `gte` | Greater than or equal — v63+, Number/Date/Datetime only |
| `lte` | Less than or equal — v63+, Number/Date/Datetime only |
| `CustomWhereCondition` | Raw SOQL-style condition string via `criteriaType` property |

Criteria attributeType values (for faceted/indexed search): `ProductStandard`, `ProductCustom`, `ProductDynamicAttribute`, `ProductAttributeStandard`, `ProductAttributeCustom`

---

## Key Relationships Summary

| Object/Field | Relationship | Target Object |
|---|---|---|
| Product2.BasedOn | Lookup | ProductClassification |
| ProductSpecificationRecType.RecordTypeId | Lookup | RecordType |
| ProductRelatedComponent.ChildProductClassificationId | Lookup | ProductClassification |
| ProductComponentGroup.ParentGroupId | Lookup (self) | ProductComponentGroup |
| ProductRelatedComponent → ProductRampSegment | Related via `/connect/pcm/relatedRecords/product2` | ProductRampSegment |
| ProductRelatedComponent → ProductUsageGrant | Related via `/connect/pcm/relatedRecords/product2` | ProductUsageGrant |
| ProductSpecificationRecType ↔ Product2 | Filtered via `relatedObjectFilters` on `/connect/pcm/products` | ProductSpecificationRecType |
| ProductClassification → ProductClassificationAttr | Via `additionalFields.ProductAttributeDefinition` | ProductClassificationAttr |

---

## Notes

- All PCM objects require **Product Catalog Management** to be enabled in the org.
- The `epc` catalog system (Enterprise Product Catalog) uses Product2 record IDs as product classification IDs.
- The `pcm` catalog system is the default for all PCM Business APIs.
- When `Use Indexed Data For Product Listing and Search` toggle is enabled (Product Discovery Settings), `contains` operator is not applicable, and only `name` is supported as a filter property.
- `DecompositionScope` and `FulfillmentQtyCalcMethod` on Product2 are available from API version 61.0 and later.
- `UsageModelType` on Product2 is available from API version 62.0 and later.
- `IsNavigational` on ProductCategory is available from API version 62.0 and later.
- `ParentGroupId` on ProductComponentGroup is available from API version 62.0 and later.
- `ClassificationComponent` value in `AssociatedProductRoleCat` on ProductRelationshipType is available from API version 61.0 and later.
- ProductSellingModelOption `IsDefault` field: a product can only have one default product selling model.
- `DataType` on AttributeDefinition: `Currency` and `Percent` values require API version 61.0 and later.
- Snapshot `INCREMENTAL` buildType requires API version 63.0 and later.
- `productClassificationIds` in Product Classification List input: in `epc` catalog these are Product2 record IDs.

---

## Transaction Objects

Pages covered: 1367–1406 (Transaction Management — sObjects, Platform Events, Business APIs)

---

### TransactionProcessingType

Tooling API object. Create transaction type records to specify the rule engine, save behavior, and steps to skip for each sales transaction.

Tooling API resource: `/services/data/v67.0/tooling/sobjects/TransactionProcessingType`

| Field | Type | Req | Notes |
|---|---|---|---|
| Description | string | Optional | Description of the transaction processing type |
| DeveloperName | string | Optional | Unique API name |
| MasterLabel | string | Optional | Display label |
| PricingPreference | picklist | Optional | Whether to execute or skip the pricing step. Valid value: `Skip` |
| RatingPreference | picklist | Optional | Whether to execute or skip the rating step. Valid values: `Fetch`, `Skip` |
| RuleEngine | picklist | Optional | The rule engine to use for processing rules. Values: `AdvancedConfigurator`, `StandardConfigurator`. Properties: Create, Filter, Group, Nillable, Restricted picklist, Sort |
| SaveType | picklist | Required | How transaction results are processed when saved. Values: `Standard`, `Large` (reserved for future use). Properties: Create, Filter, Group, Restricted picklist, Sort, Update |
| TaxPreference | picklist | Optional | Whether to execute or skip the tax calculation step. Valid value: `Skip`. Available v65+. Properties: Create, Filter, Group, Nillable, Restricted picklist, Sort, Update |

Usage: Create via POST to `/services/data/v67.0/tooling/sobjects/TransactionProcessingType`

---

### CreateAssetOrderEvent (Platform Event)

Notifies subscribers that the process started by `/actions/standard/createOrUpdateAssetFromOrder` or `/actions/standard/createOrUpdateAssetFromOrderItem` is complete. Available in API version 55.0 and later.

Supported Calls: `describeSObjects()`

Subscription Channel: `/event/CreateAssetOrderEvent`

Special Access: Subscription Management or Revenue Cloud must be enabled. Users must have Read access.

| Field | Type | Req | Notes |
|---|---|---|---|
| AssetDetails | CreateAssetOrderDtlEvent[] | Optional | Nillable. List of AssetDetail records from a successful request. Each contains OrderItemId, AssetId, IsSuccess flag, and optionally ErrorCode/ErrorMessage |
| CorrelationIdentifier | string | Optional | Nillable. Reserved for future use |
| EventUuid | string | Optional | Nillable. UUID identifying the platform event message |
| IsLastEvent | boolean | Optional | Defaulted on create. Whether this is the final event in the request. Default: `false`. Available v62+ |
| OrderIdentifier | string | Optional | Nillable. ID of the order associated with this event. Available with Revenue Cloud v64+ |
| ReplayId | string | Optional | Nillable. Position of the event in the event stream for resubscription |
| RequestIdentifier | string | Optional | Nillable. ID of the request that triggered the event |

---

### CreateAssetOrderDtlEvent (Platform Event — detail, not directly subscribable)

Contains information about an attempt to create or update an asset as a result of `/actions/standard/createOrUpdateAssetFromOrder`. Included in a `CreateAssetOrderEvent` message. Cannot be subscribed to directly. Available in API version 55.0 and later.

Subscription Channel: `/event/CreateAssetOrderDtlEvent`

Special Access: Revenue Cloud must be installed. Users must have Read access.

| Field | Type | Req | Notes |
|---|---|---|---|
| AssetId | reference | Optional | Nillable. ID of the asset created or updated. Relationship: `Asset` (Lookup) → `Asset` |
| ErrorCode | string | Optional | Nillable. Reference code for the type of error that occurred |
| ErrorMessage | string | Optional | Nillable. Information about the error after the request was made |
| EventUuid | string | Optional | Nillable. UUID identifying the platform event message |
| IsSuccess | boolean | Optional | Defaulted on create. Whether asset creation for the order item was successful. Default: `false`. Available v61+ |
| OrderItemId | reference | Optional | ID of the order item used in the request. Available v61+. Relationship: `OrderItem` (Lookup) → `OrderItem` |
| ReplayId | string | Optional | Nillable. Position of the event in the event stream |

---

### PlaceOrderCompletedEvent (Platform Event)

Notifies subscribers of an order being created or updated by invoking the Place Order API or the Place Sales Transaction API. Available in API version 63.0 and later.

Supported Calls: `describeSObjects()`

Subscription Channel: `/event/PlaceOrderCompletedEvent`

Event Delivery Allocation Enforced: Yes

| Field | Type | Req | Notes |
|---|---|---|---|
| AppUsageTypes | string | Optional | Nillable. Tag representing the application using the order and how it is processed. Revenue Cloud value: `RevenueLifecycleManagement` |
| CorrelationIdentifier | string | Optional | Nillable. Reserved for future use |
| EventUuid | string | Optional | Nillable. UUID identifying the platform event message |
| HasErrors | boolean | Optional | Defaulted on create. Whether errors occurred when creating or updating the order. Default: `false` |
| OrderId | reference | Optional | Nillable. ID of the order record. Relationship: `Order` (Lookup) → `Order` |
| ReplayId | string | Optional | Nillable. Position of the event in the event stream |
| RequestIdentifier | string | Optional | Nillable. ID of the request that triggered the event |

---

### QuoteSaveEvent (Platform Event)

Notifies subscribers that the process started by the Place Quote or Place Sales Transaction API request is complete. Available in API version 60.0 and later.

Supported Calls: `describeSObjects()`

Subscription Channel: `/event/QuoteSaveEvent`

Special Access: Subscription Management or Revenue Cloud must be enabled.

| Field | Type | Req | Notes |
|---|---|---|---|
| CorrelationIdentifier | string | Optional | Nillable. Reserved for future use |
| EventUuid | string | Optional | Nillable. UUID identifying the platform event message |
| HasErrors | boolean | Optional | Defaulted on create. Whether errors occurred. Default: `false`. Values: `false`, `true` |
| QuoteId | reference | Optional | Nillable. ID of the quote associated with this event. Relationship field |
| ReplayId | string | Optional | Nillable. Position of the event in the event stream |
| RequestIdentifier | string | Optional | Nillable. ID of the request that triggered the event |

---

### QuoteToOrderCompletedEvent (Platform Event)

Notifies subscribers when the `/actions/standard/createOrderFromQuote` REST request is complete. Available in API version 56.0 and later.

Supported Calls: `describeSObjects()`

Subscription Channel: `/event/QuoteToOrderCompletedEvent`

Event Delivery Allocation Enforced: No

Special Access: Revenue Cloud must be enabled.

| Field | Type | Req | Notes |
|---|---|---|---|
| CorrelationIdentifier | string | Optional | Nillable. Reserved for future use |
| EventUuid | string | Optional | Nillable. UUID identifying the platform event message |
| HasErrors | boolean | Optional | Defaulted on create. Contains `true` if errors occurred; otherwise `false`. Default: `false` |
| OrderId | string | Optional | Nillable. ID of the order created from the quote. Null if process failed |
| OrderNumber | string | Optional | Nillable. User-friendly unique number assigned to the order created from the quote |
| QuoteToOrderErrorDetailEvents | QuoteToOrderErrDtlEvent[] | Optional | Nillable. List of error messages and error codes if the request failed |
| ReplayId | string | Optional | Nillable. Position of the event in the event stream |
| RequestIdentifier | string | Optional | Nillable. Unique ID returned in the `actions/standard/createOrderFromQuote` response |

---

## Transaction Management Business APIs

Base paths vary; see individual resources below.

### Resource Summary

| Resource | Method | Description | Available Version |
|---|---|---|---|
| `/connect/revenue-management/assets/actions/amend` | POST | Initiate and execute amendment of a quote or order | 62.0 |
| `/connect/revenue-management/assets/actions/cancel` | POST | Initiate and execute cancellation of an asset | 62.0 |
| `/connect/revenue-management/assets/actions/renew` | POST | Initiate and execute renewal of an asset | 62.0 |
| `/industries/cpq/quotes/actions/get-instant-price` | POST | Fetch instant pricing data on quote or order line data grid | 60.0 |
| `/commerce/sales-orders/actions/place` | POST | Place orders with integrated pricing, config, validation (deprecated v63+) | 60.0 |
| `/commerce/quotes/actions/place` | POST | Create a quote; insert/update/delete quote line items | — |
| `/connect/revenue-management/sales-transaction-contexts/{resourceId}/actions/ramp-deal-create` | POST | Create a ramp deal for a customer on a product | — |
| `/connect/revenue-management/sales-transaction-contexts/{resourceId}/actions/ramp-deal-update` | POST | Modify a ramp deal (quantity, discount, date change) | — |
| `/connect/revenue-management/sales-transaction-contexts/{resourceId}/actions/ramp-deal-view` | GET | View a ramp deal related to a quote line item or order item | — |
| `/connect/revenue-management/sales-transaction-contexts/{resourceId}/actions/ramp-deal-delete` | POST | Delete a ramp deal to convert to single line item | — |
| `/connect/rev/sales-transaction/actions/place` | POST | Create/update a sales transaction (order or quote) with integrated pricing and configuration | — |
| `/connect/rev/sales-transaction/actions/clone` | POST | Clone a sales transaction (quote, order, line items) | 64.0 |
| `/connect/rev/sales-transaction/actions/place-supplemental-transaction` | POST | Create supplemental order or change orders after submission | — |
| `/connect/revenue/transaction-management/sales-transactions/actions/read` | POST | Retrieve sales transaction data from initialized or hydrated context | — |
| `/connect/advanced-approvals/approval-submission/preview` | POST | Preview approval levels, chains, approvers, and conditions | — |
| `/global-promotions-management/promotions` | GET, POST, PUT | Get/create/update promotions based on product selling model template | 66.0 |
| `/revenue/transaction-management/sales-transactions/actions/get-eligible-promotions` | POST | Get eligible promotions for line items within a quote or order | 66.0 |
| `/revenue/transaction-management/assets/actions/swap` | POST | Exchange one product for another (swap) | 66.0 |
| `/revenue/transaction-management/assets/actions/upgrade` | POST | Move a lower-tier product to a higher-tier product | 66.0 |
| `/revenue/transaction-management/assets/actions/downgrade` | POST | Move to a lower-tier or lower-value product | 66.0 |

---

### Asset Amendment — Request Body Properties

Resource: `/connect/revenue-management/assets/actions/amend` (POST, v62+)

Special Access: Requires `InitiateAmend` API permission set.

| Name | Type | Req | Description |
|---|---|---|---|
| assetIds | String[] | Required | IDs of assets to add to the amendment record |
| amendmentStartDate | String | Required | Start date of the amendment |
| contractId | String | Optional | ID of the Contract record to sync with the amendment quote |
| opportunityId | String | Optional | ID of the Opportunity record to sync with the amendment quote |
| outputRecordId | String | Optional | ID of the quote or order record to add the assets to |
| outputRecordType | String | Required | Type of amendment record to create. For usage products, set to `Quote` |
| quantityChange | Double | Required | Quantity to add to or reduce from the asset's existing quantity |

Response body: `Amendment`

---

### Asset Cancellation — Request Body Properties

Resource: `/connect/revenue-management/assets/actions/cancel` (POST, v62+)

Special Access: Requires `InitiateCancellation` API permission set.

| Name | Type | Req | Description |
|---|---|---|---|
| assetIds | String[] | Required | IDs of assets to cancel. All assets must belong to the same price book |
| cancellationDate | String | Required | Effective date of the cancellation |
| contractId | String | Optional | ID of the Contract record to sync with the cancellation quote |
| opportunityId | String | Optional | ID of the Opportunity record to sync with the cancellation quote |
| outputRecordId | String | Optional | ID of the quote or order to cancel |
| outputRecordType | String | Required | Type of cancellation record to create |

Response body: `Cancellation`

---

### Asset Renewal — Request Body Properties

Resource: `/connect/revenue-management/assets/actions/renew` (POST, v62+)

Special Access: Requires `InitiateRenewal` API permission set.

| Name | Type | Req | Description |
|---|---|---|---|
| assetIds | String[] | Required | IDs of assets to renew |
| contractId | String | Optional | ID of the Contract record to sync with the renewal |
| opportunityId | String | Optional | ID of the Opportunity record to sync with the renewal quote |
| outputRecordId | String | Optional | ID of the Quote or Order record to renew |
| outputRecordType | String | Required | Type of renewal record to create |
| renewalEndDate | String | Optional | End date of the renewal process for the assets |
| renewalStartDate | String | Optional | Start date of the renewal process. Required for early asset renewals and renewing expired assets |

Response body: `Renewal`

---

### Clone Sales Transaction — Request Body Properties

Resource: `/connect/rev/sales-transaction/actions/clone` (POST, v64+)

Clones: `Quote`, `QuoteLineItem`, `OrderItem`, `QuoteLineGroup`, `Order`, `OrderItemGroup`

| Name | Type | Req | Description |
|---|---|---|---|
| recordIds | String[] | Required | ID of the record to be cloned (single record ID only) |
| salesTransactionId | String | Required | ID of the sales transaction related to the record IDs to clone |
| options | Clone Options Input | Optional | Specifies options to clone a ramp segment within a sales transaction (last ramp segment only). Available v65+ |

Response body: `Clone Sales Transaction`

---

### Get Eligible Promotions — Request Body Properties

Resource: `/revenue/transaction-management/sales-transactions/actions/get-eligible-promotions` (POST, v66+)

| Name | Type | Req | Description |
|---|---|---|---|
| lineItemIds | String[] | Required | List of line item IDs to evaluate for promotions. Object type auto-determined from salesTransactionId |
| salesTransactionId | String | Required | The sales transaction ID (order ID or quote ID) for the promotion evaluation |

Response body: `Get Eligible Promotions`

---

### Initiate Downgrade — Request Body Properties

Resource: `/revenue/transaction-management/assets/actions/downgrade` (POST, v66+)

| Name | Type | Req | Description |
|---|---|---|---|
| contractId | String | Optional | ID of the contract record to downgrade |
| opportunityId | String | Optional | ID of the opportunity record to downgrade |
| outputRecordType | String | Required | Record type of the output for the downgrade |
| swapGroups | Swap Group[] | Required | Groups that contain the asset details for the downgrade |
| swapStartDate | String | Required | Amendment start date for the downgrade action |

Response body: `Initiate Downgrade Response`

---

### Initiate Swap — Request Body Properties

Resource: `/revenue/transaction-management/assets/actions/swap` (POST, v66+)

| Name | Type | Req | Description |
|---|---|---|---|
| contractId | String | Optional | ID of the contract record to swap |
| opportunityId | String | Optional | ID of the opportunity record to swap |
| outputRecordType | String | Required | Record type of the output for the swap |
| swapGroups | Swap Group[] | Required | Groups that contain the asset details for the swap |
| swapStartDate | String | Required | Amendment start date for the swap action |

Response body: `Initiate Swap Response`

---

### Initiate Upgrade — Request Body Properties

Resource: `/revenue/transaction-management/assets/actions/upgrade` (POST, v66+)

| Name | Type | Req | Description |
|---|---|---|---|
| contractId | String | Optional | ID of the contract record to upgrade |
| opportunityId | String | Optional | ID of the opportunity record to upgrade |
| outputRecordType | String | Required | Record type of the output for the upgrade |
| swapGroups | Swap Group[] | Required | Groups that contain the asset details for the upgrade |
| swapStartDate | String | Required | Amendment start date for the upgrade action |

Response body: `Initiate Upgrade Response`

---

### Instant Pricing — Request Body Properties

Resource: `/industries/cpq/quotes/actions/get-instant-price` (POST, v60+)

| Name | Type | Req | Description |
|---|---|---|---|
| contextId | String | Optional | ID generated by the context service. If not specified, a new context is created |
| correlationId | String | Optional | Client-generated ID for tracking multiple related API requests |
| records | Object with Reference Input[] | Required | List of pricing data to be fetched |

Response body: `Instant Pricing`

---

### Place Order — Request Body Properties (DEPRECATED v63+)

Resource: `/commerce/sales-orders/actions/place` (POST, v60+)

Note: Deprecated as of API version 63.0. Use the Place Sales Transaction API instead.

Special Access: Requires `PlaceOrder` API permission set.

Key request body properties visible in examples: `pricingPref` (e.g., `System`, `system`), `configurationInput` (e.g., `RunAndAllowErrors`), `configurationOptions` (`validateProductCatalog`, `validateAmendRenewCancel`, `executeConfigurationRules`, `addDefaultConfiguration`), `graph` (contains `graphId` and `records` array with `referenceId` and `record` objects typed to `Order`, `OrderItem`, `OrderItemGroup`)

---

### Place Sales Transaction — Key Facts

Resource: `/connect/rev/sales-transaction/actions/place` (POST)

Creates a sales transaction (order or quote) with integrated pricing and configuration. Also updates an order or quote, and inserts/deletes order or quote line items to calculate estimated tax.

---

### Place Supplemental Transaction — Key Facts

Resource: `/connect/rev/sales-transaction/actions/place-supplemental-transaction` (POST)

Creates a supplemental order or change orders after they are submitted for processing, such as during the fulfillment process.

---

### Create Promotions — Key Facts

Resource: `/global-promotions-management/promotions` (GET, POST, PUT, v66+)

Gets rewards based on a product selling model template. Key promotion body properties: `promotionDetails` (with `displayName`, `isAutomatic`, `isEmailActivated`, `name`, `promotionEligibility`, `promotionLimits`, `ruleLibrary`, `startDateTime`), `rules` (with `eventConfiguration`, `journalType`, `priority`, `rewardConfiguration`, `ruleName`, `templateName`).

---

## Key Transaction Relationships Summary

| Object/Field | Relationship | Target Object |
|---|---|---|
| CreateAssetOrderEvent.OrderIdentifier | Identifies | Order |
| CreateAssetOrderDtlEvent.AssetId | Lookup | Asset |
| CreateAssetOrderDtlEvent.OrderItemId | Lookup | OrderItem |
| PlaceOrderCompletedEvent.OrderId | Lookup | Order |
| QuoteSaveEvent.QuoteId | Identifies | Quote |
| TransactionProcessingType | Tooling API via POST | `/tooling/sobjects/TransactionProcessingType` |
| Asset Amendment → Quote/Order | Via `outputRecordType` + `outputRecordId` | Quote or Order |
| Ramp Deal → SalesTransactionContext | Via `/connect/revenue-management/sales-transaction-contexts/{resourceId}/actions/ramp-deal-*` | SalesTransactionContext |
| Swap/Upgrade/Downgrade → SwapGroup | `swapGroups` property | SwapGroup (with outGroup/inGroup) |

---

## Transaction Management Notes

- `Place Order` API (`/commerce/sales-orders/actions/place`) is **deprecated as of v63.0** — use `Place Sales Transaction` (`/connect/rev/sales-transaction/actions/place`) instead.
- `TaxPreference` on TransactionProcessingType is available from API version 65.0 and later.
- `IsLastEvent` on CreateAssetOrderEvent is available from API version 62.0 and later.
- `OrderIdentifier` on CreateAssetOrderEvent is available from API version 64.0 and later.
- `IsSuccess` on CreateAssetOrderDtlEvent is available from API version 61.0 and later.
- `OrderItemId` on CreateAssetOrderDtlEvent is available from API version 61.0 and later.
- PlaceOrderCompletedEvent: `Event Delivery Allocation Enforced = Yes` — quota applies.
- QuoteToOrderCompletedEvent: `Event Delivery Allocation Enforced = No`.
- All Asset lifecycle APIs (amend, cancel, renew, swap, upgrade, downgrade) require specific API permission sets.
- Swap/Upgrade/Downgrade use a `swapGroups` structure with `outGroup` (assets going out) and `inGroup` (new records coming in via graph).
- For usage products, amend must use `outputRecordType = Quote` (direct-to-order not supported).
- Clone Sales Transaction supports: `Quote`, `QuoteLineItem`, `OrderItem`, `QuoteLineGroup`, `Order`, `OrderItemGroup`.
