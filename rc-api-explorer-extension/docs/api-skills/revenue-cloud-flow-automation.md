---
name: revenue-cloud-flow-automation
description: >
  Comprehensive reference for Revenue Cloud standard invocable actions usable in Salesforce Flow,
  covering Dynamic Revenue Orchestrator (DRO), Usage Management, Billing, exact API names,
  input/output variable types, flow patterns, error handling, and governor limits.
metadata:
  source: revenue_lifecycle_management_dev_lates.pdf pages 1877-1913, 2040-2070, 2489-2520
  scanned: 2026-06-13
  api_versions: v61.0 – v67.0
---

## Overview

Revenue Cloud exposes standard invocable actions callable from Flow (auto-launched or screen) via
`/services/data/vXX.X/actions/standard/<actionName>`. All actions use the standard Salesforce
invocable action envelope:

```json
{ "inputs": [{ "<param>": "<value>" }] }
```

Response envelope:
```json
{
  "actionName": "<actionName>",
  "isSuccess": true | false,
  "errors": null | [{ "statusCode": "...", "message": "...", "fields": [] }],
  "outputValues": { ... }
}
```

---

## DRO Standard Invocable Actions

All DRO actions live under `/services/data/vXX.X/actions/standard/`. They are callable from
Flow using the **Action** element (type = Invocable Action).

### Action Index

| Action Label | API Name (actionName) | Min Version |
|---|---|---|
| Decompose Sales Transaction | `decomposeSalesTransaction` | 61.0 |
| Freeze Sales Transaction | `freezeSalesTransaction` | 61.0 |
| Get Point Of No Return | `getPointOfNoReturn` | 61.0 |
| Orchestrate Sales Transaction | `orchestrateSalesTransaction` | 61.0 |
| Orchestrate Transaction | `orchestrateTransaction` | 61.0 |
| Submit Order | `submitOrder` | 61.0 |
| Submit Sales Transaction | `submitSalesTransaction` | 61.0 |
| Unfreeze Sales Transaction | `unfreezeSalesTransaction` | 61.0 |

---

### decomposeSalesTransaction

Decomposes a sales transaction into fulfillment order line items (FOLIs). Invokes the DRO
decomposition engine.

**Inputs**

| Input Variable | Type | Required | Description |
|---|---|---|---|
| `fulfillmentAdapter` | String | Yes | Adapter type. Values: `StandardOrder`, `GenericAdapter` |
| `intakeRequestType` | String | Yes | Execution mode. Values: `Synchronous`, `Asynchronous` |
| `salesTransactionId` | String | Yes | ID of the SalesTransaction record |
| `fulfillmentPriority` | String | No | Priority queue. Values: `High`, `Bulk`, `Default` |
| `priorityLimitAction` | String | No | What to do if priority limit exceeded. Values: `Reject`, `Downgrade` |

**Outputs**

| Output Variable | Type | Description |
|---|---|---|
| `requestId` | String | UUID of the DRO request |
| `submitStatus` | String | `SUCCESS` or `FAILURE` |
| `requestedFulfillmentPriority` | String | Priority that was requested |
| `resolvedFulfillmentPriority` | String | Priority actually used after limit checks |
| `usedContextId` | String | Context ID used for decomposition |

**Request example:**
```json
{
  "inputs": [{
    "fulfillmentAdapter": "StandardOrder",
    "intakeRequestType": "Synchronous",
    "salesTransactionId": "801xx000003GYexAAG"
  }]
}
```

**Response example (success):**
```json
{
  "actionName": "decomposeSalesTransaction",
  "isSuccess": true,
  "outputValues": {
    "requestId": "ee3ded2e-fe43-401b-a54d-9124d48a0b72",
    "requestedFulfillmentPriority": "Default",
    "submitStatus": "SUCCESS",
    "usedContextId": "0000000s21to18g00091764127969531",
    "resolvedFulfillmentPriority": "Default"
  }
}
```

---

### freezeSalesTransaction

Freezes a sales transaction to prevent modifications before fulfillment processing.

**Inputs**

| Input Variable | Type | Required | Description |
|---|---|---|---|
| `salesTransactionId` | String | Yes | ID of the SalesTransaction record to freeze |

**Outputs**

| Output Variable | Type | Description |
|---|---|---|
| `isSuccess` | Boolean | Whether freeze succeeded |
| `salesTransactionId` | String | ID of the frozen transaction |

---

### getPointOfNoReturn

Checks whether a sales transaction has passed the point-of-no-return milestone in DRO. After
this milestone, the transaction cannot be cancelled or reversed.

**Inputs**

| Input Variable | Type | Required | Description |
|---|---|---|---|
| `salesTransactionId` | String | Yes | ID of the SalesTransaction |

**Outputs**

| Output Variable | Type | Description |
|---|---|---|
| `isPastPointOfNoReturn` | Boolean | `true` if the transaction has passed the milestone |
| `pointOfNoReturnMilestone` | String | Name of the milestone record |

---

### orchestrateSalesTransaction

Triggers the full DRO orchestration plan for a decomposed sales transaction. Executes
fulfillment steps in the plan.

**Inputs**

| Input Variable | Type | Required | Description |
|---|---|---|---|
| `salesTransactionId` | String | Yes | ID of the SalesTransaction |
| `fulfillmentAdapter` | String | Yes | `StandardOrder` or `GenericAdapter` |
| `intakeRequestType` | String | Yes | `Synchronous` or `Asynchronous` |

**Outputs**

| Output Variable | Type | Description |
|---|---|---|
| `requestId` | String | UUID of the orchestration request |
| `submitStatus` | String | `SUCCESS` or `FAILURE` |
| `fulfillmentPlanId` | String | ID of the created FulfillmentPlan record |

---

### orchestrateTransaction

Alternative orchestration action for non-SalesTransaction-based transactions (generic adapter).

**Inputs**

| Input Variable | Type | Required | Description |
|---|---|---|---|
| `transactionId` | String | Yes | ID of the source transaction record |
| `fulfillmentAdapter` | String | Yes | Adapter type |
| `intakeRequestType` | String | Yes | `Synchronous` or `Asynchronous` |

**Outputs**

| Output Variable | Type | Description |
|---|---|---|
| `requestId` | String | UUID of the orchestration request |
| `submitStatus` | String | `SUCCESS` or `FAILURE` |
| `fulfillmentPlanId` | String | ID of the FulfillmentPlan |

---

### submitOrder

Submits an order to DRO for processing. Combines decomposition + orchestration in a single call.
This is the primary action for order-to-fulfillment flows.

**Inputs**

| Input Variable | Type | Required | Description |
|---|---|---|---|
| `orderId` | String | Yes | ID of the Order record |
| `callType` | String | Yes | `Synchronous` or `Asynchronous` |
| `fulfillmentPriority` | String | No | `High`, `Bulk`, or `Default` |
| `priorityLimitAction` | String | No | `Reject` or `Downgrade` |

**Outputs**

| Output Variable | Type | Description |
|---|---|---|
| `requestId` | String | UUID of the DRO request |
| `submitStatus` | String | `SUCCESS` or `FAILURE` |
| `fulfillmentPlanId` | String | ID of the created FulfillmentPlan |
| `usedContextId` | String | Context ID used for submission |
| `errorCode` | String | DRO error code on failure (e.g., `DRO_INTERNAL_ERROR`) |

**Request example (synchronous):**
```json
{
  "inputs": [{
    "orderId": "801RM0000007yGaYAI",
    "callType": "Synchronous"
  }]
}
```

**Response example (success):**
```json
{
  "actionName": "submitOrder",
  "isSuccess": true,
  "outputValues": {
    "requestId": "a161cfda-868c-41d2-b589-7c7d7ff2d4c1",
    "submitStatus": "SUCCESS",
    "usedContextId": "e275e930923106ee7e39cbfa232e38252bd4d63f4ea2dd956b7301e243554134",
    "fulfillmentPlanId": "13VZM00000000062AA"
  }
}
```

**Response example (validation error):**
```json
{
  "actionName": "submitOrder",
  "errors": [{"statusCode": "UNKNOWN_EXCEPTION", "message": "Missing required input parameter: orderId", "fields": []}],
  "isSuccess": false,
  "outputValues": {
    "requestId": "4c7d8ebb-6b0b-4852-a8a0-b67e0d36a73e",
    "errorCode": "DRO_INTERNAL_ERROR"
  }
}
```

---

### submitSalesTransaction

Submits a SalesTransaction record to DRO. Similar to `submitOrder` but operates on a
SalesTransaction sObject rather than an Order.

**Inputs**

| Input Variable | Type | Required | Description |
|---|---|---|---|
| `salesTransactionId` | String | Yes | ID of the SalesTransaction record |
| `callType` | String | Yes | `Synchronous` or `Asynchronous` |
| `fulfillmentAdapter` | String | Yes | `StandardOrder` or `GenericAdapter` |
| `fulfillmentPriority` | String | No | `High`, `Bulk`, or `Default` |
| `priorityLimitAction` | String | No | `Reject` or `Downgrade` |

**Outputs**

| Output Variable | Type | Description |
|---|---|---|
| `requestId` | String | UUID of the DRO request |
| `submitStatus` | String | `SUCCESS` or `FAILURE` |
| `fulfillmentPlanId` | String | ID of FulfillmentPlan |
| `usedContextId` | String | Context ID used |
| `errorCode` | String | Error code on failure |

---

### unfreezeSalesTransaction

Unfreezes a previously frozen sales transaction, allowing modifications to resume.

**Inputs**

| Input Variable | Type | Required | Description |
|---|---|---|---|
| `salesTransactionId` | String | Yes | ID of the frozen SalesTransaction |

**Outputs**

| Output Variable | Type | Description |
|---|---|---|
| `isSuccess` | Boolean | Whether unfreeze succeeded |
| `salesTransactionId` | String | ID of the unfrozen transaction |

---

## DRO Explainability Action Logs

After DRO processing, query `ProductFulfillmentScenario` or the explainability log sObject
to debug decomposition decisions. The log payload contains:

**Decomposition scope response fields:**

| Field | Type | Description |
|---|---|---|
| `CandidateDecompositionRules[]` | Array | All rules evaluated: `decompRuleId`, `SourceProductId`, `AssociatedOlis[]`, `DestinationProductId`, `DestinationProductScope`, `ConfiguredContextRuleId` |
| `SelectedDecompositionRules[]` | Array | Rules actually selected: `OliId`, `DecompositionRuleIds[]` |
| `OliScopeDetails[]` | Array | OLI hierarchy: `OliId`, `ParentOliId`, `BundleRootOli` |
| `FoliComputationDetails[]` | Array | FOLI results: `FoliId`, `ComputedAction`, `ComputedQuantity` |

**DRO sObject model:**

| sObject | Key Fields | Purpose |
|---|---|---|
| `ProductFulfillmentScenario` | `Name`, `FulfillmentAdapter`, `IsActive` | Maps products to fulfillment adapters |
| `SalesTransactionFulfillReq` | `SalesTransactionId`, `Status`, `FulfillmentPlanId` | Tracks fulfillment requests |
| `ValTfrm` | `Name`, `TransformationType` | Value transformation rules |
| `ValTfrmGrp` | `Name`, `ValTfrmId` | Groups of value transformations |
| `SalesTrxnDeleteEvent` | `SalesTransactionId` | Platform event fired on deletion |
| `ProductFulfillmentDecompRule` | `ProductId`, `FulfillmentAdapter`, `DecompositionRuleId` | Decomposition rule assignments |

**Fulfillment lifecycle stages:**
1. Intake — request received, priority assigned
2. Decomposition — order lines mapped to FOLIs via decomposition rules
3. Plan Composition — fulfillment plan built from FOLIs
4. Orchestration — plan steps sequenced
5. Execution — fulfillment steps executed by adapters

---

## Usage Management Standard Invocable Actions

### Action Index

| Action Label | API Name | Min Version |
|---|---|---|
| Invoke Summary Creation | `invokeSummaryCreation` | 61.0 |
| Retrigger Entitlement Creation Process | `retrigerEntitlementCreationProcess` | 61.0 |
| Update Usage Entitlement | `updateUsageEntitlement` | 61.0 |
| Void Usage Summary | `voidUsageSummary` | 61.0 |

---

### invokeSummaryCreation

Triggers creation of usage summaries for an entitlement account. Used at the end of a billing
period to generate UsageSummary records.

**Inputs**

| Input Variable | Type | Required | Description |
|---|---|---|---|
| `usageEntitlementAccountId` | String | Yes | ID of the usage entitlement account |

**Request example:**
```json
{
  "inputs": [{"usageEntitlementAccountId": "3ttDU00000000iZYAQ"}]
}
```

---

### retrigerEntitlementCreationProcess

Retriggers the entitlement creation process for an asset, used when initial entitlement
creation failed or requires refresh.

**Inputs**

| Input Variable | Type | Required | Description |
|---|---|---|---|
| `assetId` | String | Yes | ID of the Asset record |

**Request example:**
```json
{
  "inputs": [{"assetId": "02iSB000000JzZFYA0"}]
}
```

---

### updateUsageEntitlement

Updates an existing usage entitlement record with new quantities or dates.

**Inputs**

| Input Variable | Type | Required | Description |
|---|---|---|---|
| `usageEntitlementId` | String | Yes | ID of the usage entitlement to update |
| `quantity` | Number | No | New entitlement quantity |
| `effectiveStartDate` | Date | No | New effective start date |
| `effectiveEndDate` | Date | No | New effective end date |

---

### voidUsageSummary

Voids a usage summary record, reversing the consumption aggregation.

**Inputs**

| Input Variable | Type | Required | Description |
|---|---|---|---|
| `usageSummaryId` | String | Yes | ID of the UsageSummary record to void |

---

## Usage Management Business APIs (Connect REST)

These are Connect REST APIs callable from Apex, Flow (via HTTP Callout or Apex action), or
external integrations.

### Usage Details (GET)

Retrieve usage details for a quote, order, or asset.

| Endpoint | Version | Description |
|---|---|---|
| `/revenue/usage-management/...` | 66.0+ | Get usage details including resources, grants, billing periods |

Response body type: `Usage Details` — contains assets with billing periods, resources,
consumption sources, rate adjustments.

**Asset Detail response key fields:**

| Field | Type | Description |
|---|---|---|
| `assetId` | String | ID of the asset |
| `usageEntitlementAccountId` | String | Account holding entitlement |
| `grantBindingTargetId` | String | Binding target for grants |
| `billingPeriods[]` | Array | List of `Billing Period` objects |

**Billing Period object:**

| Field | Type | Description |
|---|---|---|
| `startDate` | String | Period start (YYYY-MM-DD) |
| `endDate` | String | Period end (YYYY-MM-DD) |
| `resources[]` | Array | `Resource Detail` objects |

**Resource Detail key fields:**

| Field | Type | Description |
|---|---|---|
| `liableSummaryId` | String | UsageSummary ID |
| `usageResourceId` | String | Usage resource ID |
| `usageResourceName` | String | Resource display name |
| `usageResourceUomId` | String | Unit of measure ID |
| `usageResourceUomUnitCode` | String | UOM code (e.g., `CREDIT`) |
| `resourceTotalOverageQuantity` | Number | Total overage quantity |
| `resourceTotalOverageAmount` | Number | Total overage charge |
| `resourceTotalConsumption` | Number | Total units consumed |
| `rateAndConsumptionSources[]` | Array | Rate/consumption breakdown |

---

### Usage Product Activation (POST)

Activates a usage product and all its related records (resources, grants, policies, rate card
entries) atomically.

**Resource:** `/revenue/usage-management/usage-products/actions/activate`
**Version:** 67.0
**HTTP Method:** POST

**Key constraints:**
- Each request activates exactly ONE product (`MAX_LIMIT_EXCEEDED` if more than one)
- Max 200 records per request (product + all child records combined)
- All records stay in Draft until activation runs — rollback on any failure
- Records activate in dependency order (parent before child)

**Request body properties:**

| Property | Type | Required | Description |
|---|---|---|---|
| `activationRequests` | `UsageActivationRequestInput[]` | Yes | List with exactly one entry |
| `shouldValidateProductSetup` | Boolean | No | Run setup validation before activation (default: `true`) |

**UsageActivationRequestInput properties:**

| Property | Type | Required | Description |
|---|---|---|---|
| `productId` | String | Yes | ID of the Product2 record |
| `usageResourceIds` | String[] | No | Specific usage resource IDs to activate; if omitted, all resources activated |

**Request example:**
```json
{
  "shouldValidateProductSetup": false,
  "activationRequests": [{
    "productId": "01txx000006i2gAAA",
    "usageResourceIds": ["0hUxx000000001", "0hUxx000000002"]
  }]
}
```

---

### Usage Product Validation (POST)

Validates cross-object relationships and business rules for usage-based products before
activation.

**Resource:** `/revenue/usage-management/usage-products/actions/validate`
**Version:** 66.0
**HTTP Method:** POST

**Request body properties:**

| Property | Type | Required | Description |
|---|---|---|---|
| `productIds` | String[] | Yes | List of Product2 IDs (max 10) |
| `startDate` | String | No | Start of date range for active record validation |
| `endDate` | String | No | End of date range for active record validation |

**Request example:**
```json
{
  "productIds": ["01txx0000006i2gAAA", "01txx0000006j2gAAA"],
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-12-31T23:59:59Z"
}
```

Response type: `Usage Product Validation` — returns validation results with errors and warnings
grouped by rule name.

---

### Consumption Traceabilities (POST)

Traces overage and resource drawdown details for liable summary IDs.

**Request body:**
```json
{
  "liableSummaryIds": ["1HG00000000001"]
}
```

Response type: `Consumption Traceabilities` — overage and resource drawdown details.

---

### Usage Management Response Body Types

| Type | Description |
|---|---|
| `Asset Detail` | Details of a specific asset with billing periods |
| `Billing Period` | Billing period with resources and consumption |
| `Binding Object Detail` | Records with binding target details (rate + grants) |
| `Binding Object Grant Detail` | Usage resource grants for a binding object |
| `Binding Object Rate Adjustments` | Binding target rate adjustments |
| `Consumption Traceabilities` | Overage and resource drawdown details |
| `Usage Details` | Usage details of a quote, order, or asset |
| `Usage Product Activation` | Activation outcome response |
| `Usage Product Validation` | Validation results |
| `Usage Activation Result` | Groups activation + validation outcomes per product |
| `Usage Activation Error` | Single error during usage product activation |
| `Product Activation Result` | Activation outcome for a single product |
| `Product Validation Result` | Validation result for a specific product |
| `Validation Error` | Validation errors grouped by rule name |
| `Validation Warning` | Validation warnings grouped by rule name |

---

## Billing Standard Invocable Actions

Billing invocable actions follow the same pattern as DRO actions.

### Action Index

| Action Label | API Name | Min Version | Description |
|---|---|---|---|
| Recover Billing Schedules | `recoverBillingSchedules` | 61.0 | Recover billing schedules in Error/Processing status |
| Send Dunning Email | `blngSendDunningEmail` | 67.0 | Send dunning process emails for collection plans |
| Suspend Billing | `blngSvcSuspendBilling` | 66.0 | Suspend/resume billing for dispute handling |
| Update Bill To Contact | `blngSvcUpdateBillToContact` | 66.0 | Update Bill to Contact on an invoice |
| Unapply Credit | `unapplyCredit` | 62.0 | Unapply a credit memo from an invoice |
| Unapply Payment | `unapplyPayment` | 64.0 | Unapply a payment from an invoice/invoice line |
| Void Posted Credit Memo | `voidPostedCreditMemo` | 66.0 | Void a credit memo in posted state |
| Write Off Invoices | `writeOffInvoices` | 64.0 | Write off unpaid/partially-paid invoices |

---

### recoverBillingSchedules

Recovers the latest invoice associated with billing schedules stuck in Error or Processing status.

**URI:** `/services/data/v67.0/actions/standard/recoverBillingSchedules`

**Inputs**

| Input | Type | Required | Description |
|---|---|---|---|
| `billingScheduleId` | String | Yes | ID of billing schedule in Error or Processing status |

**Outputs**

| Output | Type | Description |
|---|---|---|
| `successBillingScheduleIds` | String | Comma-separated IDs of recovered child billing schedules |

**Request example:**
```json
{
  "inputs": [{"billingScheduleId": "801xx000003JztvAAC"}]
}
```

**Response example:**
```json
{
  "actionName": "recoverBillingSchedules",
  "errors": null,
  "isSuccess": true,
  "outputValues": {
    "successBillingScheduleIds": ["4sFDU00000000652AA", "16Pxx0000004NhAEAU"]
  }
}
```

---

### blngSendDunningEmail

Sends dunning process emails for collection plans. Triggers orchestration based on configured
dunning timeline.

**URI:** `/services/data/v67.0/actions/standard/blngSendDunningEmail`
**Available:** Enterprise, Unlimited, Developer Editions of Revenue Cloud

**Inputs**

| Input | Type | Required | Description |
|---|---|---|---|
| `collectionPlanId` | String | Yes | ID of the collection plan record |
| `emailTemplateNameOrId` | String | No | Email template name or ID; uses default if omitted |

**Outputs**

| Output | Type | Description |
|---|---|---|
| `isDunningEmailSent` | Boolean | Whether the dunning email was sent |
| `additionalInformation` | String | Additional response info |

**Request example:**
```json
{
  "inputs": [{
    "collectionPlanId": "0PLxxxxxxxxxxxxxxx",
    "emailTemplateNameOrId": "Dunning_Reminder_Template"
  }]
}
```

**Response example:**
```json
[{
  "actionName": "blngSendDunningEmail",
  "errors": null,
  "isSuccess": true,
  "outputValues": {
    "isDunningEmailSent": true,
    "additionalInformation": null
  }
}]
```

---

### blngSvcSuspendBilling

Suspends or resumes billing for an account to handle billing disputes.

**URI:** `/services/data/v67.0/actions/standard/blngSvcSuspendBilling`
**Available:** Enterprise, Developer, Unlimited with Dispute Management enabled in Billing

**Inputs**

| Input | Type | Required | Description |
|---|---|---|---|
| `accountId` | String | Yes | ID of the account to suspend billing for |
| `suspensionDate` | Date | Yes | Date when billing is suspended |
| `resumptionDate` | Date | No | Date when billing resumes |

**Outputs**

| Output | Type | Description |
|---|---|---|
| `isSuccess` | Boolean | Whether billing was suspended (default `false`) |
| `additionalInformation` | String | Additional status info |

**Request example:**
```json
{
  "inputs": [{
    "accountId": "001xx000003GYexAAG",
    "suspensionDate": "2025-03-01",
    "resumptionDate": "2025-03-15"
  }]
}
```

**Response example:**
```json
[{
  "actionName": "blngSvcSuspendBilling",
  "isSuccess": true,
  "outputValues": {
    "isSuccess": true,
    "additionalInformation": "{\"status\":\"Billing suspended successfully\"}"
  }
}]
```

---

### blngSvcUpdateBillToContact

Updates the Bill to Contact detail on an invoice for accurate billing routing.

**URI:** `/services/data/v67.0/actions/standard/blngSvcUpdateBillToContact`
**Available:** Enterprise, Developer, Unlimited with Dispute Management enabled

**Inputs**

| Input | Type | Required | Description |
|---|---|---|---|
| `invoiceId` | String | Yes | ID of the invoice to update |
| `newBillToContactId` | String | Yes | ID of the new Bill to Contact record |
| `setAsDefault` | Boolean | No | Set as default for future invoices (default `false`) |

**Outputs**

| Output | Type | Description |
|---|---|---|
| `isSuccess` | Boolean | Whether the contact was updated |
| `additionalInformation` | String | Additional response info |

**Request example:**
```json
{
  "inputs": [{
    "invoiceID": "3ttxx0000000001AAA",
    "newBillToContactId": "003xx000004XYZPAA4",
    "setAsDefault": true
  }]
}
```

---

### unapplyCredit

Unapplies a credit memo (or credit memo line) from an invoice (or invoice line). Credits the
applied amount back to the credit memo.

**URI:** `/services/data/v67.0/actions/standard/unapplyCredit`
**Available:** Enterprise, Developer, Unlimited with Billing enabled. Requires Credit Memo
Operations User permission set.

**Inputs**

| Input | Type | Required | Description |
|---|---|---|---|
| `recordId` | String | Yes | ID of the CreditMemoInvoiceApplication or CreditMemoLineInvoiceLine record of type Applied |
| `description` | String | No | Additional details about the operation |
| `effectiveDate` | String | No | Date when credit is unapplied |

**Outputs**

| Output | Type | Description |
|---|---|---|
| `recordId` | String | ID of the Unapplied record created by the action |

**Request example:**
```json
{
  "inputs": [{
    "recordId": "4sFDU000000005g2AA",
    "description": "Unapplied credit memo from an invoice",
    "effectiveDate": "2024-08-27"
  }]
}
```

---

### unapplyPayment

Unapplies a payment that has been applied to an invoice or invoice line. Depending on the
"Apply Payments to Invoices" setting, operates on `PaymentLineInvoice` or
`PaymentLineInvoiceLine` records of type `Applied`.

**URI:** `/services/data/v67.0/actions/standard/unapplyPayment`
**Available:** Enterprise, Unlimited, Developer with Billing. Requires Payment Ops permission set.

**Inputs**

| Input | Type | Required | Description |
|---|---|---|---|
| `recordId` | id | Yes | ID of PaymentLineInvoice or PaymentLineInvoiceLine record of type Applied |
| `effectiveDateTime` | datetime | No | Date/time to use for unapplying |
| `description` | String | No | Additional details |

**Outputs**

| Output | Type | Description |
|---|---|---|
| `recordId` | id | ID of the Unapplied record created |
| `unappliedDateTime` | datetime | Date/time when payment was unapplied |

**Request example:**
```json
{
  "inputs": [{
    "description": "Unapply payment",
    "effectiveDateTime": "2024-08-11T07:53:15.000Z",
    "recordId": "1PLR000000000dDOAQ"
  }]
}
```

**Response example:**
```json
{
  "actionName": "unapplyPayment",
  "isSuccess": true,
  "outputValues": {
    "recordId": "1PLR000000000dDOAQ",
    "unappliedDateTime": "2024-08-11T08:09:01.000Z"
  }
}
```

---

### voidPostedCreditMemo

Voids a credit memo in posted state by providing the credit memo ID.

**URI:** `/services/data/v67.0/actions/standard/voidPostedCreditMemo`
**Available:** 66.0+

**Inputs**

| Input | Type | Required | Description |
|---|---|---|---|
| `creditMemoId` | String | Yes | ID of the credit memo record in posted status to void |

**Outputs**

| Output | Type | Description |
|---|---|---|
| `debitMemoId` | String | ID of the created debit memo record |
| `statusUrl` | String | URL to check async operation status |

**Request example:**
```json
{
  "inputs": [{"creditMemoId": "50gSG0000001y5NYAQ"}]
}
```

**Response example:**
```json
[{
  "actionName": "voidPostedCreditMemo",
  "errors": [],
  "isSuccess": true,
  "outputValues": {
    "debitMemoId": "4DmSG000001YcIP0AO",
    "statusUrl": "/services/data/v67.0/sobjects/AsyncOperationTracker/16PSG000001qlyL2AQ"
  }
}]
```

---

### writeOffInvoices

Writes off partially paid or unpaid invoices. Creates credit memos with the total charge
amount as the write-off amount and closes the invoice. Calls the Posted Invoice List Write-Off API.

**URI:** `/services/data/v67.0/actions/standard/writeOffInvoices`
**HTTP Method:** GET (unusual — passes inputs as Apex-defined collection)
**Available:** Enterprise, Developer, Unlimited with Billing. Requires Billing Operations User
and Credit Memo Operations User permission sets.

**Inputs**

| Input | Type | Required | Description |
|---|---|---|---|
| `writeOffInvoiceInputList` | Apex-defined | Yes | Collection of WriteOffInvoiceInputList records (see InvoiceWriteOff namespace) |

**Outputs**

| Output | Type | Description |
|---|---|---|
| `writeOffInvoiceResponseList` | Apex-defined | Collection of WriteOffInvoiceResponseList records |

---

## Billing Business APIs (Connect REST)

These are Connect REST APIs for billing scenarios, callable via HTTP Callout or Apex.

### Credits

| Resource | Method | Description |
|---|---|---|
| `/commerce/invoicing/credit-memos/{creditMemoId}/actions/apply` | POST | Apply existing credit memo to an invoice |
| `/commerce/invoicing/credit-memo-inv-applications/{creditMemoInvApplicationId}/actions/unapply` | POST | Unapply credit memo from invoice |
| `/commerce/invoicing/credit-memo-lines/{creditMemoLineId}/actions/apply` | POST | Apply credit memo line to invoice line |
| `/commerce/invoicing/credit-memo-line-invoice-line/{creditMemoLineInvoiceLineId}/actions/unapply` | POST | Unapply credit memo line from invoice line |
| `/commerce/invoicing/credit-memos/actions/generate` | POST | Create standalone credit memo without applying |
| `/commerce/invoicing/invoices/{invoiceId}/actions/void` | POST | Void a posted invoice |
| `/commerce/invoicing/invoices/{invoiceId}/actions/convert-to-credit` | POST | Convert negative invoice lines to posted credit memo |
| `/commerce/invoicing/invoices/{invoiceId}/actions/credit` | POST | Create and apply credit memo to invoice |
| `/commerce/invoicing/credit/collection/actions/post` | POST | Post a draft credit memo for review |
| `/commerce/billing/credit-memos/{creditMemoId}/actions/void` | POST | Void a posted credit memo |

### Billing Schedules

| Resource | Method | Description |
|---|---|---|
| `/commerce/invoicing/billing-schedules/actions/create` | POST | Generate billing schedules for orders via context service |
| `/commerce/invoicing/standalone/billing-schedules/actions/create` | POST | Generate billing schedules from any transaction |
| `/commerce/invoicing/billing-schedules/collection/actions/recover` | POST | Recover latest invoice from Error/Processing billing schedules |
| `/commerce/invoicing/actions/suspend-billing` | POST | Suspend billing for schedule groups or an account |
| `/commerce/invoicing/actions/resume-billing` | POST | Resume billing for schedule groups or account on hold |

### Invoices

| Resource | Method | Description |
|---|---|---|
| `/commerce/invoicing/invoices/collection/actions/post` | POST | Update invoice status from Draft to Posted |
| `/commerce/invoicing/invoice-batch-runs/{invoiceBatchRunId}/actions/draft-to-posted` | POST | Update batch of invoices Draft to Posted |
| `/commerce/invoicing/invoices/collection/actions/preview` | POST | Generate preview invoices with estimated tax |
| `/commerce/invoicing/invoices/collection/actions/ingest` | POST | Ingest or generate invoice from billing transaction data |
| `/commerce/billing/invoices/invoice-batch-docgen/{invoiceBatchRunId}/actions/{actionName}` | POST | Async generate PDF documents for Draft/Posted invoices |
| `/commerce/invoicing/invoices/actions/write-off` | POST | Write off invoices and close them |
| `/commerce/invoicing/invoice-batch-runs/actions/send-email` | POST | Send emails for posted invoices in a batch run |
| `/commerce/invoicing/invoices/collection/actions/generate` | POST | Create invoice for account, order, or billing schedule list |
| `/revenue/billing/transactions/actions/apply` | POST | Apply payments and credits based on Billing Settings rules |
| `/revenue/billing/document/actions/generate` | POST | Generate invoice document and update junction records |

### Invoice Scheduler

| Resource | Method | Description |
|---|---|---|
| `/commerce/invoicing/invoice-schedulers` | POST/PUT | Create or update invoice scheduler with filter criteria |
| `/commerce/invoicing/invoice-batch-runs/{invoiceBatchRunId}/actions/recover` | POST | Recover records from a failed invoice run |

**Batch Invoice Scheduler request body key fields:**

| Field | Type | Description |
|---|---|---|
| `schedulerName` | String | Name of the scheduler |
| `startDate` | String | Scheduler start date |
| `endDate` | String | Scheduler end date |
| `invoiceStatus` | String | `POSTED` or `DRAFT` |
| `preferredTime` | String | Time to run (HH:MM) |
| `frequencyCadence` | String | `Once`, `Daily`, `Weekly`, `Monthly` |
| `frequencyCadenceOptions` | Object | Cadence-specific options (e.g., `{"recursOnDay": "Sunday"}` for Weekly) |
| `timezone` | String | Timezone (e.g., `Asia/Kolkata`) |
| `status` | String | `Active`, `Inactive`, `Draft`, `Canceled` |
| `filterCriteria[]` | Array | Filter objects with `operation`, `value`, `criteriaSequence`, `objectName`, `fieldName` |
| `targetDate` / `targetDateOffset` | String / Int | Invoice target date configuration |
| `invoiceDate` / `invoiceDateOffset` | String / Int | Invoice date configuration |
| `isInvoiceDateFromRunDate` | Boolean | Whether invoice date is derived from run date |

### Invoice Sequencing

| Resource | Method | Description |
|---|---|---|
| `/connect/sequences/policy` | POST | Create sequence policy for sequential invoice/credit memo numbering |
| `/connect/sequences/policy/{sequencePolicyId}` | PATCH | Update sequence policy settings |
| `/connect/sequences/actions/assign` | POST | Assign sequence pattern values to objects |
| `/connect/sequences/gap-reconciliation` | POST | Restore missing sequence value in gapless sequences |

**Sequence Gap Reconciliation request body:**

| Property | Type | Required | Notes |
|---|---|---|---|
| `sequencePolicyIds` | String[] | Required if `targetObjects` not specified | List of sequence policy IDs |
| `targetObjects` | String[] | Required if `sequencePolicyIds` not specified | Valid values: `Invoice`, `CreditMemo` (66.0+) |

**Sequence Assignment request body:**

| Property | Type | Required | Description |
|---|---|---|---|
| `targetObjectIds` | String[] | Yes | Records to assign sequence values to |
| `sequencePolicyId` | String | No | ID of the sequence policy |
| `shouldPublishPlatformEvent` | Boolean | No | Publish platform event on assignment |

### Account Statement

| Resource | Method | Description |
|---|---|---|
| `/revenue/billing/accounts/{accountId}/statement` | POST | Generate comprehensive account statement with transaction history |

### Payments

| Resource | Method | Description |
|---|---|---|
| `/commerce/billing/payments/{paymentId}/actions/apply` | POST | Allocate payment balance to reduce invoice balance |
| `/commerce/billing/payments/{paymentId}/paymentlines/{paymentLineId}/actions/unapply` | POST | Revert payment line application |
| `/commerce/billing/refunds/{refundId}/actions/apply` | POST | Make refund transaction against a payment |

### Tax Calculation

| Resource | Method | Description |
|---|---|---|
| `/commerce/taxes/actions/calculate` | POST | Calculate tax for a transaction |
| `/commerce/invoicing/invoices/collection/actions/calculate-estimated-tax` | POST | Calculate estimated tax for pending/estimated invoice lines |

### Salesforce Commerce Payments API

| Resource | Method | Description |
|---|---|---|
| `/commerce/payments/payment-methods` | POST | Tokenize a payment method |
| `/commerce/payments/sales` | POST | Make a payment sale |
| `/commerce/payments/payments/{paymentId}/refunds` | POST | Create a refund for a payment |
| `/commerce/payments/authorizations` | POST | Authorize a payment |
| `/commerce/payments/authorizations/{authorizationId}/reversals` | POST | Reverse an authorized payment |
| `/commerce/payments/authorizations/{authorizationId}/captures` | POST | Capture an authorized payment |

---

## Billing Business API Limits

| Operation | Limit | Scale Recommendation |
|---|---|---|
| Billing schedules per Create Billing Schedules API call | 200 | Use Invoice Scheduler to scale to 2000 invoice lines |
| Invoice lines per Create Billing Schedules API call | 200 | Use Invoice Scheduler or Batch Invoice Scheduler |
| Billing schedules per Recover Billing Schedule List API | 200 | Follow default API limits |
| Invoices per Apply Credit Memos API | 300 | Call API recursively for left-over credits |
| Invoice lines per Apply Credit Memo Lines API | 300 | Call iteratively per 300 invoice lines |
| Invoices per Create and Apply Credit Memos API | 300 | Includes charge and tax line counts |
| Credit memo lines (Charge type) per Standalone Credit Memo | 300 | Includes charge and tax line counts |
| Invoice lines per Convert Negative Invoice Lines to Credits | 300 | Invoice charge lines only |
| Billing transaction items per Create Billing Schedules for Orders | 1000 | Supports 1000 order lines as billing schedules |
| Reference IDs per Suspend/Resume Billing API | 200 | Follow default limits |
| Invoice lines per Invoice Draft to Posted Status API | 200 | Follow default limits |
| Records per Invoice Ingestion API | 500 | All invoices, invoice lines, taxes, address groups |
| Invoice lines per Invoice Preview API | 200 | Follow default limits |
| Invoice lines per Void a Posted Invoice API | 2000 | Follow default limits |
| Invoices per Posted Invoice List Write-Off API | 300 | Follow default limits |
| Invoice lines per Batch Invoice Scheduler | 2000 | Supports creation/recovery of 2000 lines per invoice |
| Invoice lines per Batch Invoices Draft to Posted | 2000 | No limit on number of invoices |
| Invoices per Tax Calculation API | 1 | Per request |
| Invoice lines per Tax Calculation API | 500 | Test TaxEngineAdapter for Apex heap limits |
| Invoice lines per Tax Calculation (Invoice Creation API) | 200 | Test TaxEngineAdapter for Apex heap limits |
| Invoice lines per Tax Calculation (Invoice Batch Run API) | 2000 | Test TaxEngineAdapter for Apex heap limits |
| Records per Payment Line Apply API | 1 | Applies to Invoice or InvoiceLine per settlement preference |
| Records per Payment Line Unapply API | 1 | PaymentLineInvoice or PaymentLineInvoiceLine per preference |

---

## Flow Patterns for Revenue Cloud

### Pattern 1: Order-to-Fulfillment Auto-Launched Flow

Trigger: Record-triggered on Order (when Status changes to Activated)

```
Trigger: Order.Status = "Activated"
  → Action: submitOrder
      inputs:
        orderId = {!Order.Id}
        callType = "Synchronous"
  → Decision: {!submitOrder.isSuccess}
      YES → Update Order (set custom status field to "Submitted to DRO")
      NO  → Create Case (error: {!submitOrder.outputValues.errorCode})
```

### Pattern 2: Chaining DRO Actions (Decompose then Orchestrate)

For flows requiring separate decompose + orchestrate control:

```
Action 1: decomposeSalesTransaction
  inputs: salesTransactionId, fulfillmentAdapter, intakeRequestType

Decision: {!decompose.isSuccess}
  YES → Action 2: orchestrateSalesTransaction
            inputs: salesTransactionId, fulfillmentAdapter, intakeRequestType
  NO  → Fault path handler
```

### Pattern 3: Billing Dispute Screen Flow

For customer service reps handling billing disputes:

```
Screen 1: Enter Account + Suspension Date
  → Action: blngSvcSuspendBilling
      inputs: accountId, suspensionDate, resumptionDate

Decision: {!suspendBilling.isSuccess}
  YES → Screen 2: Confirmation with additionalInformation
  NO  → Screen 2: Error message
```

### Pattern 4: Usage Summary Invocation Flow

Trigger: Scheduled (end of billing period) or Record-triggered

```
Action: invokeSummaryCreation
  inputs: usageEntitlementAccountId = {!Account.UsageEntitlementAccountId__c}

Decision: {!invokeSummary.isSuccess}
  YES → (log success)
  NO  → Action: retrigerEntitlementCreationProcess
            inputs: assetId = {!Asset.Id}
```

### Pattern 5: Credit Memo Unapply Flow

For dispute resolution requiring credit unapplication:

```
Screen: Select credit memo application record

Action: unapplyCredit
  inputs:
    recordId = {!selectedApplicationId}
    description = {!Screen.description}
    effectiveDate = {!Screen.effectiveDate}

Decision: {!unapplyCredit.isSuccess}
  YES → Screen: Success with new recordId
  NO  → Fault screen
```

---

## Error Handling in Flows for RC Actions

### Standard Error Pattern

All RC invocable actions return `isSuccess: Boolean` in `outputValues`. Always check this
before proceeding:

1. Add a **Decision** element after every RC action
2. Check `{!ActionName.isSuccess}` (or `{!ActionName.outputValues.isSuccess}` depending on how
   the action exposes it)
3. On FALSE path: capture `{!ActionName.errors[0].message}` for logging

### Fault Path vs isSuccess Check

- **Fault path** (red connector): fires only on system-level failures (governor limits, network
  errors, uncaught exceptions). Always wire a fault path.
- **isSuccess = false**: fires for business-logic failures (validation errors, DRO errors).
  These do NOT trigger the fault path automatically.

### DRO Error Codes

| errorCode | Meaning |
|---|---|
| `DRO_INTERNAL_ERROR` | Internal DRO processing error |
| `MISSING_REQUIRED_INPUT` | Required input parameter not provided |
| `INVALID_FULFILLMENT_ADAPTER` | Unknown adapter type specified |
| `PRIORITY_LIMIT_EXCEEDED` | Fulfillment priority capacity exceeded |

---

## Flow Governor Limits for RC Operations

| Limit | Value | Notes |
|---|---|---|
| Invocable action calls per transaction | 100 | Standard Salesforce limit |
| Callout timeout | 120 seconds | For synchronous DRO calls |
| Max CPU time per transaction | 10,000 ms | DRO sync calls count toward this |
| Heap size per transaction | 6 MB | Usage Management response bodies can be large |
| Max SOQL queries | 100 | DRO/Billing actions run SOQL internally |
| Records per Create Billing Schedules | 200 | Use Invoice Scheduler for larger volumes |
| Records per Apply Credit Memo | 300 | Call recursively for larger volumes |

**Async vs Sync guidance:**
- Use `callType: Asynchronous` / `intakeRequestType: Asynchronous` for orders with >50 order
  lines to avoid CPU time limits
- Use `callType: Synchronous` only for real-time confirmation flows (cart checkout, approvals)
- For bulk operations triggered by Flow, prefer Platform Events to decouple and avoid limits

---

## Process Builder to Flow Migration

Revenue Cloud invocable actions that were called from Process Builder must be migrated to Flow.
Key migration notes:

| Process Builder Concept | Flow Equivalent |
|---|---|
| Invoke Action step | Action element (type = Invocable Action) |
| `{!Record.Id}` | `{!$Record.Id}` |
| Immediate vs scheduled actions | Element-level wait / Scheduled Path |
| Process criteria | Entry conditions on Record-Triggered Flow |
| Cross-object field references | Get Records element + variable assignment |

**Post-migration checklist:**
1. Replace all Process Builder processes that call `submitOrder` / `decomposeSalesTransaction`
   with Record-Triggered Flows
2. Ensure the flow runs "After Save" to have committed record IDs
3. Add fault paths on all RC action elements
4. Test async paths separately — async DRO responses arrive via Platform Events, not flow output

---

## Key sObjects for Flow-Based RC Development

| sObject | API Name | Key Fields |
|---|---|---|
| Usage Summary | `UsageSummary` | `AssetId`, `Status`, `UsageEntitlementAccountId`, `BillingPeriodStartDate`, `BillingPeriodEndDate` |
| Usage Resource Billing Policy | `UsageResourceBillingPolicy` | `UsageResourceId`, `BillingPolicyId` |
| Product Fulfillment Scenario | `ProductFulfillmentScenario` | `ProductId`, `FulfillmentAdapter`, `IsActive` |
| Sales Transaction Fulfill Req | `SalesTransactionFulfillReq` | `SalesTransactionId`, `Status`, `FulfillmentPlanId` |
| Billing Schedule | `BillingSchedule` | `OrderId`, `Status`, `BillingAccount`, `BillingTermUnit` |
| Billing Schedule Group | `BillingScheduleGroup` | `LegalEntity`, `Status` |
| Invoice | `Invoice` | `Status`, `BillingAccount`, `TotalAmount` |
| Credit Memo | `CreditMemo` | `Status`, `InvoiceId`, `TotalAmount` |
