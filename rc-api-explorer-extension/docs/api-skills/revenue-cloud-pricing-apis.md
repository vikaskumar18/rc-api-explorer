rein---
name: revenue-cloud-pricing-apis
description: Complete API reference for Revenue Cloud Salesforce Pricing — all 20 endpoints, params, versions from PDF pages 744-840, scan date 2026-06-13
metadata:
  type: reference
---

# Revenue Cloud Salesforce Pricing Business APIs

## Source
PDF: revenue_lifecycle_management_dev_lates.pdf (2917 pages)
Section: Pages 744–840
Scanned: 2026-06-13

---

## Endpoints

### Pricing
- Method: POST
- Path: `/connect/core-pricing/pricing`
- Version: v60.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | contextDefinitionId | String | Required | 60.0 | ID of context definition for input data structure |
  | contextMappingId | String | Required | 60.0 | ID of context mapping to map input to context instance |
  | jsonDataString | String | Required | 60.0 | Data to hydrate context, in JSON format passed as String |
  | configurationOverrides | Configuration Override Input | Optional | 60.0 | Override pricing configuration parameters |
  | pricingProcedureId | String | Optional | 60.0 | ID or API name of pricing procedure |
- Response: Pricing Output — comprehensive pricing details per line items

---

### API Execution Logs
- Method: GET
- Path: `/connect/core-pricing/apiexecutionlogs/{executionId}`
- Version: v63.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | executionId | String | Required | 63.0 | Path param — pricing process execution record ID |
- Response: Pricing Execution Waterfall Response

---

### Pricing Waterfall (GET)
- Method: GET
- Path: `/connect/core-pricing/waterfall/{lineItemId}/{executionId}`
- Version: v60.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | lineItemId | String | Required | 60.0 | Path param — line item ID |
  | executionId | String | Required | 60.0 | Path param — execution ID |
  | tagsToFilter | String | Optional | 61.0 | Comma-separated tags to filter |
  | usageType | String | Optional | 62.0 | Waterfall log type: Pricing, Discovery, Rating. Default: Pricing |
- Response: Line Item Waterfall Response — pricing process steps

---

### Pricing Waterfall (POST)
- Method: POST
- Path: `/connect/core-pricing/waterfall`
- Version: v60.0
- Params: Waterfall input details in body
- Response: Pricing Generic Response

---

### Procedure Plan Definitions
- Method: GET, POST
- Path: `/connect/procedure-plan-definitions`
- Version: v62.0
- GET Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | isTemplate | Boolean | Optional | 62.0 | true = file-based definitions, false = database-based |
- POST Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | developerName | String | Required | 62.0 | Developer name of the definition |
  | primaryObject | String | Required | 62.0 | Source object for rule-based criteria |
  | procedurePlanDefinitionVersions | Procedure Plan Definition Version Input[] | Required | 62.0 | List of versions |
  | processType | String | Required | 63.0 | Valid values: Billing, DRO, DeepClone, ProductDiscovery, Revenue_Cloud |
  | description | String | Optional | 62.0 | Description |
  | name | String | Optional | 62.0 | Display name |
- Response: Procedure Plan Definitions list or Procedure Plan Generic

---

### Procedure Plan Definition By ID
- Method: GET, PATCH, DELETE
- Path: `/connect/procedure-plan-definitions/{procedurePlanDefinitionId}`
- Version: v62.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | procedurePlanDefinitionId | String | Required | 62.0 | Path param — ID or name of definition |
- Response: Procedure Plan Definition or Procedure Plan Generic

---

### Procedure Plan Version (POST)
- Method: POST
- Path: `/connect/procedure-plan-definitions/{procedurePlanDefinitionId}/version`
- Version: v62.0
- Params: Procedure plan version input in body
- Response: Procedure Plan Generic

---

### Procedure Plan Version Details
- Method: GET, PATCH, DELETE
- Path: `/connect/procedure-plan-definitions/versions/{procedurePlanVersionId}`
- Version: v62.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | procedurePlanVersionId | String | Required | 62.0 | Path param — ID or name of version |
- Response: Procedure Plan Generic

---

### Procedure Plan Evaluation By Object
- Method: POST
- Path: `/connect/procedure-plan-definitions/evaluate`
- Version: v62.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | evaluationDate | String | Required | 62.0 | Date when evaluation applies |
  | idList | String[] | Required | 62.0 | Record IDs of procedure plan definitions |
  | processType | String | Optional | 63.0 | Business process type |
  | sectionType | String[] | Optional | 62.0 | Section names to evaluate |
  | subSectionType | String[] | Optional | 62.0 | Subsection names to evaluate |
- Response: Procedure Plan Evaluation Response

---

### Procedure Plan Evaluation By Name
- Method: POST
- Path: `/connect/procedure-plan-definitions/evaluate/{procedurePlanDefinitionName}`
- Version: v62.0
- Params: Same as Procedure Plan Evaluation By Object
- Response: Procedure Plan Evaluation Response

---

### Instant Pricing
- Method: POST
- Path: `/industries/cpq/quotes/actions/get-instant-price`
- Version: v59.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | contextId | String | Optional | 59.0 | Context ID for pricing |
  | correlationId | String | Optional | 59.0 | Client-generated tracking ID |
  | records | Object[] | Required | 59.0 | List of pricing data records |
- Response: Instant Pricing results — contextId, records, success flag

---

### Pricing Simulation Input Variables
- Method: GET
- Path: `/connect/core-pricing/simulationInputVariablesWithData`
- Version: v64.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | contextDefinitionId | String | Required | 64.0 | ID or developer name of context definition |
  | contextMappingId | String | Required | 64.0 | ID or name of context mapping |
  | entityId | String | Required | 64.0 | ID of quote or order |
  | expressionSetVersionId | String | Required | 64.0 | Expression set version ID (starts with 9QM) |
- Response: Pricing Simulation Input Variables With Data

---

### PBE Derived Pricing
- Method: POST
- Path: `/connect/core-pricing/pbeDerivedPricingSourceProduct`
- Version: v61.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | effectiveFrom | String | Required | 61.0 | Date from when PBE is effective |
  | effectiveTo | String | Required | 61.0 | Date until PBE is effective |
  | pricebookEntryId | String | Required | 61.0 | Price book entry ID |
  | productId | String | Required | 61.0 | Product ID |
- Response: PBE Derived Pricing response with source product details

---

### Price Context
- Method: POST
- Path: `/connect/core-pricing/price-contexts/{contextId}`
- Version: v60.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | contextId | String | Required | 60.0 | Path param — context ID |
  | configurationOverrides | Configuration Override Input | Optional | 60.0 | Override pricing configuration |
  | procedureName | String | Optional | 60.0 | Name of pricing procedure |
- Response: Pricing Response with pricing details per line items

---

### Pricing Data Sync
- Method: GET
- Path: `/connect/core-pricing/sync/{pricingSyncOrigin}`
- Version: v60.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | pricingSyncOrigin | String | Required | 60.0 | Path param — sync origin |
  | pricingRecipeId | String | Optional | 67.0 | ID of pricing recipe whose decision tables to sync |
- Response: Pricing Generic Response

---

### Pricing Recipe
- Method: GET
- Path: `/connect/core-pricing/recipe`
- Version: v60.0
- Params: None
- Response: Pricing Recipe Response with recipe mapping details

---

### Pricing Recipe Mapping
- Method: POST
- Path: `/connect/core-pricing/recipe/mapping`
- Version: v60.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | recipeId | String | Required | 60.0 | ID of the pricing recipe |
  | pricingRecipeLookupTableInputRepresentations | Pricing Recipe LookUp Table Input[] | Required | 60.0 | Input of lookup tables for recipe |
  | pricingRecipeProcedureInputRepresentation | Pricing Recipe Procedure Input | Required | 60.0 | Input of procedure used in recipe |
- Response: Pricing Recipe Post response

---

### Pricing Versioned Revision Details
- Method: POST
- Path: `/connect/core-pricing/versioned-revise-details`
- Version: v60.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | adjustmentType | String | Required | 60.0 | percentage, amount, or override |
  | adjustmentValue | String | Required | 60.0 | Value for the adjustment |
  | effectiveFrom | String | Required | 60.0 | Date adjustment is effective from |
  | entityName | String | Required | 60.0 | AttributeBasedAdjustment or BundleBasedAdjustment |
  | id | String | Required | 60.0 | Record ID |
  | priceAdjustmentScheduleId | String | Required | 60.0 | Price adjustment schedule record ID |
  | productId | String | Required | 60.0 | Product ID |
  | effectiveTo | String | Optional | 60.0 | Date adjustment ends |
  | productSellingModelId | String | Optional | 60.0 | Selling model ID |
  | additionalFieldsToValueMap | Map<String,String> | Optional | 60.0 | Additional entity-specific fields |
- Response: Pricing Versioned Revision Details response

---

### Pricing Process Execution
- Method: GET
- Path: `/connect/core-pricing/pricing-process-execution/{executionId}`
- Version: v63.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | executionId | String | Required | 63.0 | Path param — execution record ID |
  | executionType | String | Optional | 63.0 | API_Execution, Discovery, Discovery_Line, Pricing, Pricing_Line |
- Response: Pricing Process Execution Response

---

### Pricing Process Execution Line Items
- Method: GET
- Path: `/connect/core-pricing/pricing-process-execution/lineitems/{executionId}/{executionType}`
- Version: v63.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | executionId | String | Required | 63.0 | Path param — execution record ID |
  | executionType | String | Required | 63.0 | Path param — Pricing_Line or Discovery_Line |
- Response: Pricing Process Execution Details for Line Items

---

## Notes
- `configurationOverrides` type: override pricing config at runtime (pricing procedure, context, etc.)
- Procedure Plan processType values: Billing, DRO, DeepClone, ProductDiscovery, Revenue_Cloud
- `usageType` in Waterfall GET: Pricing (default), Discovery, Rating — determines waterfall source
- Procedure Plans are shared across Pricing, Billing, DRO, and Discovery
