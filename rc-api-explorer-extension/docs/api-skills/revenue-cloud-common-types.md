---
name: revenue-cloud-common-types
description: Shared input/output types used across all Revenue Cloud Business APIs — Filter, Sort, UserContext, ContextDataInput, AdditionalFields, ProductData, etc. from PDF scan 2026-06-13
metadata:
  type: reference
---

# Revenue Cloud Common Input/Output Types

## Source
PDF: revenue_lifecycle_management_dev_lates.pdf (2917 pages)
Scanned: 2026-06-13

---

## Filter Input
Used by: PCM Products List, Discovery Products List, Discovery Search, Categories List, Recommendations, etc.

```json
{
  "field": "name",
  "operator": "contains",
  "value": "Cloud"
}
```

| Property | Type | Description |
|---|---|---|
| field | String | Field name to filter on (e.g. name, isActive, description) |
| operator | String | Operator: eq, in, contains, gt, lt, gte, lte |
| value | String/Array | Value to match |

**PCM supported operators:** eq, in, contains (for ProductCatalog: name, catalogType)
**Discovery supported operators:** eq, in, contains, gt, lt, gte, lte
**Note:** `contains` not applicable when "Use Indexed Data For Product Listing and Search" toggle is enabled

---

## Criteria Input (PCM Product Classification List)
```json
{
  "field": "name",
  "operator": "eq",
  "value": "Fiber Products"
}
```
Same structure as Filter Input. Supported property: `name`. Operators: eq, in, contains.

---

## Sort Input (PCM)
```json
{
  "order": [
    { "field": "name", "direction": "asc" }
  ]
}
```

| Property | Type | Description |
|---|---|---|
| order | Order[] | Array of sort criteria |
| order[].field | String | Field to sort by |
| order[].direction | String | asc or desc |

---

## Order Input (PCM Product Classification)
```json
{ "field": "name", "direction": "asc" }
```

---

## UserContext Input
Used by most Discovery/CPQ endpoints.

```json
{
  "accountId": "001XXXXXXXXXXXXXXXXX",
  "contactId": "003XXXXXXXXXXXXXXXXX"
}
```

| Property | Type | Description |
|---|---|---|
| accountId | String | Account record ID |
| contactId | String | Contact record ID |

---

## Context Data Input (additionalContextData)
Used by Discovery endpoints for custom context enrichment.

```json
[
  {
    "contextDefinition": "MyContextDef",
    "data": { "key": "value" }
  }
]
```

Maximum 10 nodes. Appended to context input for hydration and qualification.

| Property | Type | Description |
|---|---|---|
| contextDefinition | String | API name of the context definition node |
| data | Object | Data map for the context node |

---

## Additional Fields Input (additionalFields)
Used to request extra Product2 fields or related object fields in response.

```json
{
  "Product2": ["CustomField__c", "AnotherField__c"],
  "ProductAttributeDefinition": ["SomeAttrField__c"]
}
```

Map of `objectApiName` → `String[]` of field API names.

**Supported objects (PCM Bulk):** Product2, ProductAttributeDefinition, OptOutAssetization, OptOutDecompositionAction, OptOutSupplementalAction
**Note:** If fields for ProductAttributeDefinition aren't available for ProductClassificationAttr, API request fails.

---

## Product Data Input (Bulk CPQ — disc-11)
Required for `/connect/cpq/products/bulk`

```json
{
  "productData": [
    {
      "productId": "01tXXXXXXXXXXXXXXX",
      "productSellingModelId": "0jPXXXXXXXXXXXXXXX"
    }
  ]
}
```

| Property | Type | Required | Description |
|---|---|---|---|
| productId | String | Required | Product2 record ID |
| productSellingModelId | String | Optional | Selling model ID for this product |

---

## Guided Selection Search Term Input
Used by `/connect/cpq/guided-selection`

```json
{
  "searchTerms": [
    {
      "attributeName": "Color",
      "attributeValue": "Blue"
    }
  ]
}
```

Required when `guidedSelectionResponseId` is not specified.

---

## Configurator Options Input
Used by Configurator endpoints (Configuration Load, Add/Delete/Update Nodes, etc.)

```json
{
  "runQualification": true,
  "runPricing": true
}
```

| Property | Type | Description |
|---|---|---|
| runQualification | Boolean | Whether to run qualification rules |
| runPricing | Boolean | Whether to run pricing calculations |

---

## Related Object Filter Input
Used by Discovery Products List and PCM Products List.

```json
{
  "relatedObjectFilters": [
    {
      "objectName": "ProductSpecificationRecType",
      "field": "IsCommercial",
      "operator": "eq",
      "value": "true"
    }
  ]
}
```

Supported object: `ProductSpecificationRecType`
Supported property: `IsCommercial` (values: true, false)
Supported operator: `eq`

---

## Credit Invoice Line Input (Billing)
Used by Create and Apply Credit Memo endpoint.

```json
{
  "invoiceLines": [
    {
      "invoiceLineId": "0bsXXXXXXXXXXXXXXX",
      "creditAmount": 100.00,
      "taxAmount": 8.00
    }
  ]
}
```

---

## Credit Memo Apply Application Input
Used by Apply Credit Memo endpoint.

```json
{
  "applications": [
    {
      "invoiceId": "0blXXXXXXXXXXXXXXX",
      "amount": 100.00,
      "effectiveDate": "2025-01-01"
    }
  ]
}
```

---

## Standalone Credit Memo Charge Input
Used by Standalone Credit Memo endpoint.

```json
{
  "charges": [
    {
      "description": "Credit for service outage",
      "amount": 250.00,
      "taxCode": "TAX_CODE",
      "productId": "01tXXXXXXXXXXXXXXX"
    }
  ]
}
```

---

## Batch Invoice Filter Criteria Input
Used by Batch Invoice Scheduler endpoint.

```json
{
  "filterCriteria": [
    {
      "fieldName": "BillingFrequency",
      "operator": "eq",
      "value": "Monthly"
    }
  ]
}
```

---

## Selection Condition Input (Sequence Policy)
```json
{
  "selectionCondition": [
    {
      "field": "CurrencyIsoCode",
      "operator": "eq",
      "value": "USD"
    }
  ]
}
```

---

## Common URL Base Pattern

All Revenue Cloud REST APIs use:
```
https://{instanceUrl}/services/data/v67.0/{path}
```

Exception — AsyncOperationTracker (Transaction Management):
```
https://{instanceUrl}/services/data/v67.0/sobjects/AsyncOperationTracker
```
The `inputs` body key wraps the actual payload.

Exception — Invocable Actions:
```
https://{instanceUrl}/services/data/v67.0/actions/standard/{actionName}
```
Body structure: `{ "inputs": [{ ...params }] }`

---

## Authentication
All endpoints require: `Authorization: Bearer {access_token}`
Content-Type: `application/json`
