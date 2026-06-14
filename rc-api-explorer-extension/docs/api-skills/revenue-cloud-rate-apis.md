---
name: revenue-cloud-rate-apis
description: Complete API reference for Revenue Cloud Rate Management — all 3 endpoints with corrected params from PDF pages 937-946, scan date 2026-06-13
metadata:
  type: reference
---

# Revenue Cloud Rate Management Business APIs

## Source
PDF: revenue_lifecycle_management_dev_lates.pdf (2917 pages)
Section: Pages 937–946
Scanned: 2026-06-13

---

## Endpoints

### Get Rate Plan
- Method: GET
- Path: `/connect/core-rating/rate-plan`
- Version: v62.0
- Special Access: Requires "Rate Management: Run Time User" permission set and default usage rating discovery procedure
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | contextId | String | Required | 62.0 | ID of the context to specify as input to the procedure |
  | procedureApiName | String | Required | 62.0 | API name of the procedure to execute |
- Example: `?contextId=858a3ad3e5a0e5c319652a6ab92f6fdb&procedureApiName=SampleProcedure`
- Response: Rate plan with rate cards, rate card entries, and related adjustments based on filter criteria

---

### Rating Waterfall
- Method: GET
- Path: `/connect/core-pricing/waterfall/{lineItemId}/{executionId}`
- Version: v62.0
- **NOTE: Path uses `/connect/core-PRICING/waterfall/` — NOT `/connect/core-rating/waterfall/`**
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | lineItemId | String | Required | 62.0 | Path param — line item identifier (e.g. "Gold") |
  | executionId | String | Required | 62.0 | Path param — execution ID |
  | tagsToFilter | String | Optional | 62.0 | Comma-separated tags to filter waterfall records |
  | usageType | String | Optional | 62.0 | Waterfall log usage type. Valid values: Rating, Pricing. Default: Pricing |
- Example: `?tagsToFilter=UnitPrice&usageType=Rating`
- Response: Persisted rating waterfall with process logs and insights into internal rating process

---

### Invoke Rating Service (Invocable Action)
- Method: POST
- Path: `/services/data/v67.0/actions/standard/invokeRatingService`
- Version: v62.0
- Body structure: `{ "inputs": [{ ...params }] }`
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | recordID | Reference | Required | 62.0 | ID of usage ratable summary record to rate |
  | contextDefinitionId | String | Required | 62.0 | ID of context definition to create context instance |
  | contextMappingID | String | Optional | 62.0 | ID of context mapping |
  | procedureName | String | Optional | 62.0 | Name of rating procedure to calculate rates |
  | baseRateCardID | String | Optional | 62.0 | ID of base rate card for resource being rated |
  | tierRateCardID | String | Optional | 62.0 | ID of rate card for tier adjustments |
  | attributeRateCardID | String | Optional | 62.0 | ID of rate card for attribute-based adjustments |
  | isSkipWaterfall | Boolean | Optional | 62.0 | Skip generation of price waterfall data. Default: false |
- Outputs: None (triggers async rating process)
- Response: No direct response; acts as connector between batch management and rating service

---

## Notes
- Rating Waterfall shares the same path as Pricing Waterfall (`/connect/core-pricing/waterfall/`) — differentiated by `usageType=Rating` query param
- Invoke Rating Service rates usage records in `usageRatableSummary` records with `SummaryComplete` status
- contextDefinitionId is Required for Invoke Rating Service (extension currently only has recordId — needs fix)
