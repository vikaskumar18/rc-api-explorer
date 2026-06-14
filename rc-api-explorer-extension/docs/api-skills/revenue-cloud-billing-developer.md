---
name: revenue-cloud-billing-developer
description: Revenue Cloud Billing Developer Guide — concepts, lifecycle, patterns, sObjects — PDF (2026-06-13)
metadata:
  type: reference
---

# Revenue Cloud Billing Developer Guide

## Source
PDF: revenue_lifecycle_management_dev_lates.pdf (2917 pages)
Pages: 2489–2600
Scanned: 2026-06-13

---

## 1. Billing Actions (Connect REST)

All actions are POST unless noted. Base path: `/connect/commerce/billing/`

### 1.1 RecoverBillingSchedules
- **URI:** `/connect/commerce/billing/billing-schedules/recover`
- **Purpose:** Recovers billing schedules stuck in Processing or Error states.
- **Input:** `billingScheduleIds[]` — list of billing schedule record IDs to recover.
- **Output:** List of recovered schedule IDs and new statuses.
- **Note:** Use when automated billing run leaves schedules in Error; safe to retry.

### 1.2 SendDunningEmail (`blngSendDunningEmail`)
- **URI:** `/connect/commerce/billing/dunning/send-email`
- **Purpose:** Triggers dunning email for past-due invoices as part of collection plan.
- **Input:** `invoiceId`, optional `collectionPlanId`.
- **Output:** Email send confirmation and log entry ID.
- **Note:** Dunning is configured via Collection Plans on the Billing Account. Emails are sent based on escalation rules defined per plan.

### 1.3 SuspendBilling
- **URI:** `/connect/commerce/billing/billing-schedules/suspend`
- **Input:** `SuspendBillingInput` — accountId or billingScheduleGroupId + effectiveDate(s).
- **Output:** Suspended schedule IDs.
- **Use case:** Dispute management — stops billing without cancelling subscriptions.

### 1.4 ResumeBilling
- **URI:** `/connect/commerce/billing/billing-schedules/resume`
- **Input:** `ResumeBillingInput` — accountId or billingScheduleGroupId + effectiveDate.
- **Output:** Resumed schedule IDs.
- **Note:** Billing resumes from the effectiveDate; missed invoices during suspension period are NOT auto-generated unless backfill is configured.

### 1.5 UpdateBillToContact
- **URI:** `/connect/commerce/billing/billing-schedules/{billingScheduleId}/bill-to-contact`
- **Method:** PATCH
- **Purpose:** Updates the bill-to contact on an existing billing schedule.

### 1.6 UnapplyCredit
- **URI:** `/connect/commerce/billing/credit-memos/unapply`
- **Input:** `CreditMemoUnapplyInput` — creditMemoId, invoiceId.
- **Effect:** Reverses the credit memo application at the header level. Credit memo returns to unapplied balance. Invoice balance is restored.
- **Critical distinction:** UnapplyCredit != Void. Unapply is reversible; Void permanently closes the memo.

### 1.7 UnapplyPayment
- **URI:** `/connect/commerce/billing/payments/unapply`
- **Input:** `PaymentLineUnapplyInput` — paymentId, invoiceId, optional invoiceLineId.
- **Effect:** Reverts payment application. Payment line status returns to pre-application state. Invoice/line balance restored.

### 1.8 VoidPostedCreditMemo
- **URI:** `/connect/commerce/billing/credit-memos/void`
- **Input:** `VoidPostedCreditMemoInput` — creditMemoId.
- **Precondition:** Credit memo must be in Posted status.
- **Effect:** Sets credit memo to Voided. Unapplies any existing applications first (system does this automatically).
- **Output:** Voided credit memo ID and final status.

### 1.9 WriteOffInvoices
- **URI:** `/connect/commerce/billing/invoices/write-off`
- **Input:** `PostedInvoiceListWriteOffInput` — list of invoice write-off details including invoiceId + reason.
- **Effect:** Creates a credit memo with total charge = invoice balance as write-off amount. Applies credit memo to invoice. Invoice is closed (balance = 0). Credit memo type = Write-off.
- **Use case:** Bad debt, uncollectable balances.

---

## 2. Invoice Lifecycle

```
Draft -> Posted -> Void In Progress -> Voided
```

### State Transitions
| From | To | Trigger |
|------|----|---------|
| Draft | Posted | POST `/invoices/draft-to-posted` or Batch Invoice Scheduler with `invoiceStatus: Posted` |
| Posted | Void In Progress | POST `/invoices/void` (async — sets intermediate state) |
| Void In Progress | Voided | System async completion of void process |

### Key Rules
- A **Draft** invoice can be edited (line items, amounts).
- A **Posted** invoice is locked; modifications require credit memo or void.
- **Voiding** a Posted invoice: (1) unapplies all payments/credits, (2) creates reversal entries, (3) sets status Voided. This is the full void flow — irreversible.
- Invoice Date is used for tax calculation date.
- `isInvoiceDateFromRunDate: true` sets invoice date = batch run date (useful for daily schedulers).

---

## 3. Credit Memo Lifecycle

```
Draft -> Posted -> Voided
```

### Credit Memo Types
| Type | Description |
|------|-------------|
| Credit | Standard credit issued to customer |
| Write-off | Created by WriteOffInvoices action; closes invoice |
| Standalone | Created independently of an invoice (not order-driven) |
| Negative Invoice Line Conversion | Created when invoice has negative lines |

### Tax Strategies for Credit Memos
When creating a credit memo from an invoice line, choose one of:

| Strategy | Behavior |
|----------|---------|
| `Ignore` | No tax on credit memo; tax lines omitted |
| `ManualOverride` | Developer supplies explicit tax amount in request body |
| `CopyFromInvoiceLine` | Tax copied exactly from source invoice line |
| `Calculate` | System calls tax provider to recalculate tax for credit |

### Credit Memo Application
- Apply credit memo to invoice: `POST /credit-memos/apply` with `CreditMemoApplyInput`
- Apply credit memo line to invoice line: `POST /credit-memos/lines/apply` with `CreditMemoLineApplyInput`
- Unapply credit memo: `POST /credit-memos/unapply`
- Unapply credit memo line: `POST /credit-memos/lines/unapply`
- Post draft credit memo: `POST /credit-memos/draft-to-posted` with `CreditMemoDraftToPostedInput`

### Standalone Credit Memo
Created without reference to an order or billing schedule. Uses `StandaloneCreditMemoInput`:
- `creditMemoDate` — date shown on memo
- `billToAccountId` — billing account
- `chargeLines[]` — array of `StandaloneCreditMemoChargeInput` with amount, description, product
- `taxInput` — optional `StandaloneCreditMemoTaxInput`

---

## 4. Billing Schedule Lifecycle

### Statuses
| Status | Meaning |
|--------|---------|
| Active | Normal billing in progress |
| Error | Billing run encountered error; use RecoverBillingSchedules |
| Processing | Currently being processed by invoice run |
| Void In Progress | Voiding in progress (async) |
| Suspended | Billing paused via SuspendBilling action |

### Standalone Billing Schedules (Context Service)
Created without an order via `StandaloneBillingContext`:
- Used for custom monetization flows not originating from CPQ/order management.
- Request body includes `contextType: StandaloneBillingContext` and full billing schedule properties.
- Supports all billing term units: OneTime, Recurring (Daily/Weekly/Monthly/Quarterly/Annual).

---

## 5. Batch Invoice Scheduler

### URI
`POST /connect/commerce/billing/invoice-schedulers`

### Key Properties
| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `schedulerName` | String | Required | Must be unique per org |
| `startDate` | String | Required | Scheduler start date |
| `endDate` | String | Optional (v63.0+) | Scheduler end date |
| `invoiceStatus` | String | Required | `Draft` or `Posted` |
| `preferredTime` | String | Required | Time to run (HH:MM) |
| `frequencyCadence` | String | Required | `Once`, `Daily`, `Weekly`, `Monthly` |
| `frequencyCadenceOptions` | Object | Required | Cadence-specific options |
| `filterCriteria` | Array | Optional | Batch Invoice Filter Criteria |
| `timezone` | String | Required | IANA timezone (e.g. `Asia/Kolkata`) |
| `status` | String | Required | `Active`, `Draft`, `Inactive`, `Canceled` |
| `targetDate` | String | Required if Once | Target billing date |
| `invoiceDate` | String | Required if Once | Date on invoice |
| `targetDateOffset` | Integer | Required if Daily/Weekly/Monthly | Days offset from run date |
| `invoiceDateOffset` | Integer | Required if Daily/Weekly/Monthly | Days offset for invoice date |
| `isInvoiceDateFromRunDate` | Boolean | Optional (v63.0+) | Invoice date = run date |

### FrequencyCadence Examples

**Once (run immediately):**
```json
{
  "schedulerName": "InvoiceScheduler",
  "status": "Draft",
  "invoiceStatus": "Posted",
  "frequencyCadenceOptions": { "shouldStartRunImmediately": true },
  "frequencyCadence": "Once",
  "targetDate": "2024-08-28",
  "invoiceDate": "2024-08-28"
}
```

**Daily:**
```json
{
  "frequencyCadence": "Daily",
  "frequencyCadenceOptions": {},
  "targetDateOffset": 0,
  "invoiceDateOffset": 0,
  "isInvoiceDateFromRunDate": true
}
```

**Weekly:**
```json
{
  "frequencyCadence": "Weekly",
  "frequencyCadenceOptions": { "recursOnDay": "Sunday" },
  "targetDateOffset": 0,
  "invoiceDateOffset": 0,
  "isInvoiceDateFromRunDate": false
}
```

**Monthly (specific date):**
```json
{
  "frequencyCadence": "Monthly",
  "frequencyCadenceOptions": {
    "recurringSubType": "SpecificDate",
    "recursOnDate": "L-1",
    "shouldExcludeWkendAndHldy": true
  }
}
```

### Batch Invoice Filter Criteria
Filters billing schedules included in a batch run:

```json
"filterCriteria": [
  { "operation": "InList", "value": "Batch 2,Batch 3", "criteriaSequence": 1,
    "objectName": "BillingSchedule", "fieldName": "InvoiceRunMatchingValue" },
  { "operation": "Equals", "value": "001xx000003GZG5AAO", "criteriaSequence": 2,
    "objectName": "BillingSchedule", "fieldName": "BillingAccount" },
  { "operation": "Equals", "value": "0fwxx0000000001AAA", "criteriaSequence": 3,
    "objectName": "BillingScheduleGroup", "fieldName": "LegalEntity" },
  { "operation": "InList", "value": "OneTime,Recurring", "criteriaSequence": 4,
    "objectName": "BillingSchedule", "fieldName": "BillingTermUnit" },
  { "operation": "Equals", "value": "USD", "criteriaSequence": 5,
    "objectName": "BillingSchedule", "fieldName": "Currency_Iso_code" }
]
```

**Filter fieldName valid values:** `Currency_Iso_code`, `InvoiceRunMatchingValue`, `BillingAccount`, `LegalEntity`, `BillingTermUnit`
**Filter objectName valid values:** `BillingSchedule`, `BillingScheduleGroup`
**Filter operation valid values:** `Equals`, `InList` (for InvoiceRunMatchingValue/BillingTermUnit at v62; CurrencyIsoCode at v63+), `NotEquals`

---

## 6. Sequence Policies

### Two Modes
| Mode | Behavior |
|------|---------|
| `Basic` | Sequential numbers assigned; gaps possible if records deleted/voided |
| `Gapless` | Strict gap reconciliation; required for compliance/audit trails |

### Create Sequence Policy
`POST /connect/commerce/billing/sequence-policies`

Key properties:
| Property | Required | Notes |
|----------|----------|-------|
| `name` | Required | Unique identifier |
| `sequenceType` | Required | `Basic` or `Gapless` |
| `prefix` | Optional | Static prefix for sequence numbers |
| `suffix` | Optional | Static suffix |
| `startingNumber` | Required | Initial sequence value |
| `minimumDigits` | Optional | Zero-pad to this length |
| `selectionConditions` | Optional | Criteria for auto-selection |

**Immutable after creation:** `sequenceType`, `startingNumber`. You cannot change these after the policy is saved.

### Update Sequence Policy
`PATCH /connect/commerce/billing/sequence-policies/{policyId}`
- Can update: `name`, `prefix`, `suffix`, `minimumDigits`, `selectionConditions`.
- Cannot update: `sequenceType`, `startingNumber`.

### Sequence Gap Reconciliation
`POST /connect/commerce/billing/sequence-policies/gap-reconciliation`
- Input: `SequenceGapReconciliationInput` — policyId or targetObjectId.
- Used only with `Gapless` policies. Identifies and fills gaps caused by voided/deleted records.

### Sequence Assignment
`POST /connect/commerce/billing/sequences/assign`
- Input: `SequencesAssignmentInput` — list of target object IDs.
- Manually assigns sequence values to objects using the applicable policy.

---

## 7. Payment Application

### Two Application Models
Controlled by org setting "Apply Payments to Invoices":

| Setting | Record Created | Level |
|---------|----------------|-------|
| Enabled | `PaymentLineInvoice` | Invoice header |
| Disabled | `PaymentLineInvoiceLine` | Individual invoice line |

### Apply Payment Line
`POST /connect/commerce/billing/payment-lines/apply`
Input (`PaymentLineApplyInput`):
- `paymentId` — payment record ID
- `invoiceId` — target invoice
- `invoiceLineId` — optional, for line-level application
- `amount` — amount to apply
- `accountId` — optional, associated account
- `effectiveDate` — optional, effective date for application

### Unapply Payment Line
`POST /connect/commerce/billing/payment-lines/unapply`
Input (`PaymentLineUnapplyInput`):
- `paymentId`, `invoiceId`, optional `invoiceLineId`
- Reverts application; payment returns to available balance.

### Payment Scheduler Update
`PATCH /connect/commerce/billing/payment-schedulers/{schedulerId}`
- Updates status of payment scheduler.
- Valid status values: `Active`, `Canceled`, `Draft`, `Inactive`.

---

## 8. Rules Application (Automated Settlement)

`POST /connect/commerce/billing/rules/apply`
Input: `RulesApplicationInput`
- Automatically applies available payments and credit memos to outstanding invoices based on configured rules.
- Rules determine: matching criteria, application priority, partial vs full application.
- Used for bulk settlement automation — replaces manual apply loops.

---

## 9. Invoice Ingestion (Graph API)

Used to ingest externally-generated invoices into Salesforce Billing.

### URI
`POST /connect/commerce/billing/invoices/ingest`

### Structure
`InvoiceIngestionInput` uses a Graph API structure:
- `graphId` — unique identifier for the graph
- `records` — array of `GraphRecord` objects

Each `GraphRecord`:
- `attributes.type` — sObject type
- `attributes.referenceId` — local ID for cross-referencing within graph
- Fields and relationship references

### Three Variants

**1. With Tax Callout (isCommit: true)**
```json
{
  "taxProcessingStatus": "Pending",
  "isExternalTaxCalloutEnabled": true,
  "invoice": { "taxType": "Actual", "isCommit": true }
}
```

**2. Without Tax Callout**
```json
{
  "taxProcessingStatus": "Complete",
  "isExternalTaxCalloutEnabled": false,
  "invoice": { "taxType": "Actual" }
}
```

**3. From Debit Memo**
```json
{
  "sourceDocumentType": "DebitMemo",
  "sourceDocumentId": "..."
}
```

### Graph Record Reference Nodes
The graph can include references to: `Invoice`, `InvoiceLine`, `InvoiceLineTax`, `TaxLine`, `BillingSchedule`, `BillingScheduleGroup`, `Account`, `Product2`, `PricebookEntry`.

---

## 10. Invoice Operations

### Create Invoice (from Billing Schedule)
`POST /connect/commerce/billing/invoices`
Input: `InvoiceInput` — billingScheduleId, invoiceDate, dueDate.

### Invoice Draft to Posted
`POST /connect/commerce/billing/invoices/draft-to-posted`
Input: `InvoiceDraftToPostedInput` — invoiceId(s).
- Validates invoice has lines.
- Posts the invoice; triggers tax commit if `isCommit: true`.

### Invoice Preview
`POST /connect/commerce/billing/invoices/preview`
Input: `InvoicePreviewInput` — billing schedule or transaction details.
- Returns preview invoice without persisting.
- Uses same tax calculation as actual invoice.

### Invoice Estimated Tax Calculation
`POST /connect/commerce/billing/invoices/estimated-tax`
Input: `InvoiceEstimatedTaxCalculationInput` — invoice details.
- Returns estimated tax without creating records.
- `taxType: Estimated` — non-committed calculation.

### Invoice Run Recovery
`POST /connect/commerce/billing/invoice-runs/recover`
- Recovers failed invoice runs.
- Input: `invoiceRunId`.

### Negative Invoice Lines to Credit Conversion
`POST /connect/commerce/billing/invoices/negative-lines-to-credit`
- Converts negative invoice lines to credit memo lines.
- Creates credit memo automatically.

### Send Emails for Posted Invoices
`POST /connect/commerce/billing/invoices/send-emails`
Input: `SendEmailInput` — invoiceId(s) or batch run reference.
- Triggers email delivery for posted invoices.

### Void a Posted Invoice
`POST /connect/commerce/billing/invoices/void`
Input: `VoidPostedInvoiceInput` — invoiceId, optional reason.
Full async lifecycle:
1. Invoice status -> Void In Progress
2. System unapplies all payment/credit applications
3. Reversal entries created
4. Invoice status -> Voided

---

## 11. Tax Calculation API

### URI
`POST /connect/commerce/billing/tax/calculate`

### Input (`TaxCalculationInput`) Key Properties
| Property | Type | Description |
|----------|------|-------------|
| `taxType` | String | `Actual` (commits to tax system) or `Estimated` (preview only) |
| `taxTransactionType` | String | Type of transaction (Invoice, CreditMemo, etc.) |
| `shouldVoidTax` | Boolean | Whether to void existing tax records |
| `isCommit` | Boolean | `true` = commit to tax provider (only valid for Posted records) |
| `addresses` | AddressesInput | billTo, shipTo (Required), shipFrom, soldTo |
| `lineItems` | LineItemInput[] | Line-level tax detail |
| `customerDetails` | CustomerDetailsInput | Customer tax profile |
| `sellerDetails` | SellerDetailsInput | Seller tax profile |

### Address Input Properties
| Property | Type | Required |
|----------|------|----------|
| `street` | String | Optional |
| `city` | String | Optional |
| `state` | String | Optional |
| `country` | String | Optional |
| `postalCode` | String | Optional |
| `locationCode` | String | Optional |
| `latitude` | Double | Optional |
| `longitude` | Double | Optional |

### Addresses Input (for Tax)
Contains four address nodes: `billTo`, `shipTo` (Required), `shipFrom`, `soldTo` — each is an `AddressInput`.

### Critical Tax Rules
- `taxType: Actual` + `isCommit: true` -> commits tax to provider; only valid after invoice is Posted.
- `taxType: Estimated` -> never commits; safe to call on Draft invoices for preview.
- Tax calculation for credit memos uses the `taxStrategy` field to determine source of tax amounts.

---

## 12. Billing Arrangement API

### URI
`GET /connect/commerce/billing/billing-arrangements/{arrangementId}`

### Purpose
Returns the billing arrangement for an account including all billing schedule groups, billing schedules, and their current statuses.

### Key Response Fields
- `billingScheduleGroups[]` — grouped schedules by billing frequency
- `suspensionStatus` — current suspension state
- `nextInvoiceDate` — projected next billing date

---

## 13. Account Statement API

### URI
`POST /connect/commerce/billing/account-statements`
Input: `AccountStatementInput`

### Purpose
Generates comprehensive account statement with:
- All invoices (posted, voided)
- Credit memos applied
- Payments applied
- Outstanding balance
- Transaction history

### Use Cases
- Customer-facing account summary
- Reconciliation reports
- Audit trail

---

## 14. On-Demand Document Generation

### Batch Invoice DocGen
`POST /connect/commerce/billing/invoice-runs/doc-gen`
- Generates PDF/document for invoices in a batch run.
- Input: `invoiceRunId`, `templateId`.

### On-Demand Single Invoice DocGen
`POST /connect/commerce/billing/invoices/{invoiceId}/doc-gen`
Input: `OnDemandDocumentGenerationInput`
- Generates invoice document on demand.
- Supports custom templates.

---

## 15. Billing Schedule Creation from Orders

### URI
`POST /connect/commerce/billing/billing-schedules`

### Purpose
Creates billing schedules from order records. Called after order activation.

### Input includes
- `orderId` — source order
- `billingScheduleGroupId` — optional grouping
- `effectiveDate` — schedule start

---

## 16. Billing Schedule Recovery List

### URI
`GET /connect/commerce/billing/billing-schedules/recovery-list`

### Purpose
Returns list of billing schedules eligible for recovery (stuck in Error or Processing).

### Use Pattern
```
GET /recovery-list -> get IDs -> POST /recover with those IDs
```

---

## 17. Refund Line Apply

### URI
`POST /connect/commerce/billing/refund-lines/apply`
Input: `RefundLineApplyInput`
- `refundAmount` — amount to refund
- `paymentId` or `creditMemoId` — source of refund
- Outlines properties of a refund including refund amount and ID of payment or credit memo record.

---

## 18. Suspend / Resume Billing

### Suspend
`POST /connect/commerce/billing/billing-schedules/suspend`
Input: `SuspendBillingInput`:
- `suspendBillingObjects[]` — array of `SuspendBillingObjectInput`
  - `accountId` or `billingScheduleGroupId`
  - `effectiveStartDate`
  - `effectiveEndDate` (optional — for time-bounded suspension)

### Resume
`POST /connect/commerce/billing/billing-schedules/resume`
Input: `ResumeBillingInput`:
- `resumeBillingObjects[]` — array of `ResumeBillingObjectInput`
  - `accountId` or `billingScheduleGroupId`
  - `effectiveDate`

### Use Cases
- Dispute resolution: suspend while investigating, resume when resolved.
- Seasonal pause: suspend with end date for auto-resume.
- Manual hold: no end date, resume explicitly.

---

## 19. API Limits

| API Category | Limit |
|---|---|
| Billing Actions | 200 per hour per user |
| Invoice Operations | 300 per hour |
| Batch Scheduler | 500 per hour |
| Credit Memo Operations | 1000 per hour |
| Tax Calculation | 2000 per hour |

---

## 20. Request Body Catalog (Complete)

All input types available in the Billing API:

| Input Type | Purpose |
|---|---|
| `AddressInput` | Single address (city, country, lat, lng, locationCode, postalCode, state, street) |
| `AddressesInput` | Tax addresses container (billTo, shipFrom, shipTo[Required], soldTo) |
| `AccountStatementInput` | Generate comprehensive account statement |
| `BatchInvoiceFilterCriteriaInput` | Filter criteria for invoice batch run |
| `BatchInvoiceSchedulerInput` | Create invoice scheduler |
| `CreditInvoiceLineTaxInput` | Manual tax lines for credit invoice line |
| `CreditMemoAddressesInput` | Billing/shipping addresses for credit memo |
| `CreditMemoApplyInput` | Apply credit memo to invoice |
| `CreditMemoApplyApplicationInput` | Multiple applications for credit memo |
| `CreditMemoDraftToPostedInput` | Post a draft credit memo |
| `CreditMemoUnapplyInput` | Unapply credit memo from invoice |
| `CreditMemoLineApplyInput` | Apply credit memo line to invoice line |
| `CreditMemoLineApplicationInput` | Multiple line-level applications |
| `CreditMemoLineUnapplyInput` | Unapply credit memo line |
| `CustomerDetailsInput` | Customer details for tax calculation |
| `FrequencyCadenceOptions` | Cadence options for invoice scheduler |
| `GraphRecordForInvoiceIngestion` | Graph record with fields and relationships |
| `InvoiceDraftToPostedInput` | Post draft invoice |
| `InvoiceEstimatedTaxCalculationInput` | Estimated tax calculation |
| `InvoiceIngestionInput` | Full invoice ingestion (tax status, user prefs, graph) |
| `InvoiceInputForIngestion` | Invoice details for ingestion |
| `InvoiceInput` | Billing schedule invoice details |
| `InvoicePreviewInput` | Preview invoice without persisting |
| `LineItemInput` | Line item for tax calculation |
| `OnDemandDocumentGenerationInput` | On-demand document for record types |
| `PaymentLineApplyInput` | Allocation of payment to invoice/line |
| `PaymentLineUnapplyInput` | Revert payment line application |
| `PaymentRunBatchFilterCriteriaInput` | Filter criteria for payment batch run |
| `PaymentBatchSchedulerInput` | Create payment scheduler |
| `PaymentSchedulerUpdateInput` | Update payment scheduler status |
| `PostedInvoiceListWriteOffInput` | Write off list of posted invoices |
| `PostedInvoiceWriteOffInput` | Write off single invoice (ID + reason) |
| `RefundLineApplyInput` | Refund details (amount + source record) |
| `ResumeBillingInput` | Resume billing for account/group |
| `ResumeBillingObjectInput` | Account/group ID + effective date |
| `RulesApplicationInput` | Apply payments/credits via rules |
| `SelectionConditionInput` | Criteria for sequencing policy selection |
| `SellerDetailsInput` | Seller details for tax calculation |
| `SendEmailInput` | Send emails for invoice batch run |
| `SequencePolicyInput` | Create sequence policy |
| `SequenceGapReconciliationInput` | Identify/reconcile sequence gaps |
| `SequencesAssignmentInput` | Assign sequence values to objects |
| `StandaloneCreditMemoChargeInput` | Charge lines for standalone credit memo |
| `StandaloneCreditMemoInput` | Create standalone credit memo |
| `StandaloneCreditMemoTaxInput` | Tax details for standalone credit memo |
| `SuspendBillingInput` | Suspend billing for account/group |
| `SuspendBillingObjectInput` | Account/group ID + effective dates |
| `TaxCalculationInput` | Tax calculation request |
| `VoidPostedCreditMemoInput` | Void a posted credit memo |
| `VoidPostedInvoiceInput` | Void a posted invoice |

---

## 21. Key Developer Patterns

### Pattern 1: Full Invoice Run Flow
```
1. POST /billing-schedules (create from order)
2. POST /invoice-schedulers (schedule batch run)
   OR POST /invoices (create individual invoice)
3. POST /invoices/draft-to-posted (post draft)
4. POST /tax/calculate (with isCommit: true, taxType: Actual)
5. POST /invoices/send-emails (notify customer)
```

### Pattern 2: Dispute Resolution Flow
```
1. POST /billing-schedules/suspend (SuspendBillingInput)
2. [Dispute investigated]
3a. Resolved in customer's favor:
    POST /credit-memos (create credit memo)
    POST /credit-memos/draft-to-posted
    POST /credit-memos/apply
3b. Dispute unfounded:
    POST /billing-schedules/resume
```

### Pattern 3: Write-Off Flow
```
1. POST /invoices/write-off (PostedInvoiceListWriteOffInput)
   -> System creates write-off credit memo
   -> Applies to invoice
   -> Invoice balance = 0
```

### Pattern 4: Payment Settlement via Rules
```
1. Configure settlement rules in org setup
2. POST /rules/apply (RulesApplicationInput)
   -> System matches payments/credits to invoices per rules
   -> Batch settlement without manual per-invoice apply calls
```

### Pattern 5: Void Invoice Full Flow
```
1. POST /invoices/void (sets status -> Void In Progress)
2. [Async] System unapplies all payment/credit applications
3. [Async] Reversal entries created
4. Invoice status -> Voided
5. GET invoice to confirm final status
```

### Pattern 6: Sequence Policy for Compliance (Gapless)
```
1. POST /sequence-policies (sequenceType: Gapless)
2. POST /sequences/assign (assign to target objects)
3. On void/delete: POST /sequence-policies/gap-reconciliation
```

---

## 22. Critical Developer Notes

1. **Void vs Unapply**: Void permanently closes a record (irreversible). Unapply reverses an application (reversible). Always prefer unapply when you need flexibility.

2. **Tax isCommit**: Only set `isCommit: true` when the invoice is Posted. Setting it on Draft invoices will fail. Use `taxType: Estimated` for previews.

3. **Billing Schedule Error Recovery**: When batch run leaves schedules in Error state, call `GET /billing-schedules/recovery-list` first to identify affected schedules, then `POST /billing-schedules/recover`.

4. **Sequence Policy Immutability**: `sequenceType` and `startingNumber` cannot be changed after creation. Plan carefully before creating production policies.

5. **Scheduler uniqueness**: `schedulerName` must be unique per org. Use a naming convention like `{purpose}-{env}-{date}`.

6. **Weekly cadence**: `recursOnDay` in `frequencyCadenceOptions` must be a day name (e.g., "Sunday").

7. **Monthly cadence**: `recursOnDate: "L-1"` means last day minus 1. `shouldExcludeWkendAndHldy: true` shifts to prior business day.

8. **Filter criteria sequence**: `criteriaSequence` is 1-indexed. All criteria are ANDed together.

9. **Multi-currency orgs**: When multi-currency is enabled, `Currency_Iso_code` filter becomes required in batch scheduler filter criteria.

10. **Dunning emails**: Triggered via `blngSendDunningEmail` action, not a standard email alert. Configure collection plans on Billing Account before calling this action.

11. **Standalone credit memos**: Do not require an invoice reference. Use for goodwill credits, adjustments, or corrections outside the normal billing cycle.

12. **Invoice ingestion**: Uses the Graph API pattern — all related records (invoice, lines, tax lines) submitted in a single graph payload for atomic creation.

13. **PaymentScheduler status values**: Valid values are `Active`, `Canceled`, `Draft`, `Inactive` — note `Inactive` (not `Suspended`).

14. **Resume billing**: Does NOT auto-generate invoices for the suspension period. If backfill is needed, manually create invoices for the suspended dates.
