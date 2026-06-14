---
name: revenue-cloud-billing-apis
description: Complete API reference for Revenue Cloud Billing — all 46 endpoints (6 existing + 40 new), params, versions from PDF pages 2489-2758, scan date 2026-06-13
metadata:
  type: reference
---

# Revenue Cloud Billing Business APIs

## Source
PDF: revenue_lifecycle_management_dev_lates.pdf (2917 pages)
Section: Pages 2489–2758
Scanned: 2026-06-13

---

## Existing Endpoints (in current extension, with corrected paths)

### Invoice Creation
- Method: POST
- Path: `/commerce/invoicing/invoices/collection/actions/generate`
- **CORRECTED PATH** — extension had `/commerce/invoicing/invoices`
- Version: v62.0 (accountId param: v63.0)
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | action | String | Required | 62.0 | Draft or Posted |
  | invoiceDate | String | Required | 62.0 | Invoice stamping date (ISO 8601) |
  | targetDate | String | Required | 62.0 | Date to decide billing periods (ISO 8601) |
  | accountId | String | Required if others not specified | 63.0 | Account record ID |
  | billingScheduleIds | String[] | Required if others not specified | 62.0 | Billing schedule IDs (max 200) |
  | billingTransactionId | String | Required if others not specified | 63.0 | Billing transaction (Order) record ID |
  | correlationId | String | Optional | 62.0 | Tagged on InvoiceProcessedEvent |
- Response: Revenue Async Response

---

### Batch Invoice Scheduler
- Method: POST, PUT
- Path: `/commerce/invoicing/invoice-schedulers`
- Path with ID (PUT): `/commerce/invoicing/invoice-schedulers/{billingBatchSchedulerId}`
- Version: v62.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | schedulerName | String | Required | 62.0 | Unique scheduler name in org |
  | startDate | String | Required | 62.0 | Start date |
  | status | String | Required | 62.0 | Draft, Active, Inactive |
  | preferredTime | String | Required | 62.0 | Preferred run time |
  | invoiceStatus | String | Required | 62.0 | Draft or Posted |
  | frequencyCadence | String | Required | 62.0 | Once, Daily, Weekly, Monthly |
  | frequencyCadenceOptions | Frequency Cadence Options | Required | 62.0 | Frequency options |
  | invoiceDate | String | Required if Once | 62.0 | Date shown on invoice |
  | invoiceDateOffset | Integer | Required if Daily/Weekly/Monthly | 62.0 | Offset applied to target date |
  | targetDate | String | Required if Once | 62.0 | Target date of batch run |
  | targetDateOffset | Integer | Required if Daily/Weekly/Monthly | 62.0 | Target date offset |
  | isInvoiceDateFromRunDate | Boolean | Optional | 63.0 | Invoice date from run date |
  | timezone | String | Optional | 62.0 | Time zone for scheduler |
  | endDate | String | Optional | 63.0 | End date of scheduler |
  | filterCriteria | Batch Invoice Filter Criteria Input[] | Optional | 62.0 | Filter criteria for line items |
- Response: Batch Invoice Scheduler response

---

### Billing Arrangement
- Method: GET
- Path: `/revenue/billing/billing-arrangement/{billingArrangementId}`
- Version: v66.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | billingArrangementId | String | Required | 66.0 | Path param — billing arrangement ID |
- Response: Billing Arrangement — split percentages, remainder allocation, adjustments

---

### Billing Schedule Recovery List
- Method: POST
- Path: `/commerce/invoicing/billing-schedules/collection/actions/recover`
- Version: v62.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | billingScheduleIds | String[] | Required | 62.0 | IDs to recover invoices for. One per API request |
- Response: Billing Schedule Recovery List

---

### Create Billing Schedules for Orders
- Method: POST
- Path: `/commerce/invoicing/billing-schedules/actions/create`
- Version: v62.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | billingTransactionIds | String[] | Required | 62.0 | Billing transaction IDs (Order IDs) |
- Response: Context-Aware Billing Schedule response

---

### Apply Credit Memo
- Method: POST
- Path: `/commerce/invoicing/credit-memos/{creditMemoId}/actions/apply`
- Version: v62.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | creditMemoId | String | Required | 62.0 | Path param — credit memo ID |
  | applications | Credit Memo Apply Application Input[] | Required | 62.0 | Applications to apply the credit memo |
- Response: Credit Memo Apply List

---

### Sequence Gap Reconciliation
- Method: POST
- Path: `/connect/sequences/gap-reconciliation`
- Version: v65.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | sequencePolicyIds | String[] | Required if no targetObjects | 65.0 | Sequence policy IDs |
  | targetObjects | String[] | Required if no sequencePolicyIds | 65.0 | Objects: Invoice, CreditMemo (v66.0+) |
- Response: Sequence Gap Reconciliation response

---

### Tax Calculation
- Method: POST
- Path: `/commerce/taxes/actions/calculate`
- **CORRECTED PATH** — extension had `/commerce/invoicing/invoices/actions/calculate-tax`
- Version: v62.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | lineItems | Line Item Input[] | Required | 62.0 | Line items for tax calculation |
  | taxEngineId | String | Required | 62.0 | Tax engine ID |
  | taxType | String | Required | 62.0 | Actual or Estimated |
  | transactionDate | String | Required | 62.0 | Transaction date |
  | addresses | Addresses | Optional | 62.0 | Address details |
  | currencyIsoCode | String | Optional | 62.0 | Currency ISO code |
  | customerDetails | Customer Details | Optional | 62.0 | Customer details for tax determination |
  | description | String | Optional | 62.0 | Tax transaction description |
  | documentCode | String | Optional | 62.0 | Unique identifier for tax document |
  | effectiveDate | String | Optional | 62.0 | Date when tax rules apply |
  | isCommit | Boolean | Optional | 62.0 | Submit to tax engine for reporting |
  | referenceDocumentCode | String | Optional | 62.0 | Reference code for subsequent transactions |
  | referenceEntityId | String | Optional | 62.0 | Related quote/invoice/transaction ID |
  | sellerDetails | Seller Details Input | Optional | 62.0 | Seller info for tax calculation |
  | shouldVoidTax | Boolean | Optional | 65.0 | Void the tax transaction |
  | taxTransactionType | String | Optional | 62.0 | Debit, Credit, or Void |
- Response: Tax Calculation response

---

## New Endpoints (Add to Extension)

### Invoice Draft to Posted
- Method: POST
- Path: `/commerce/invoicing/invoices/collection/actions/post`
- Version: v62.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | invoiceIds | String[] | Required | 62.0 | Draft invoice IDs to post (one per request) |
  | correlationId | String | Optional | 62.0 | Splunk correlation ID |
- Response: Revenue Async Response

---

### Invoice Ingestion
- Method: POST
- Path: `/commerce/invoicing/invoices/collection/actions/ingest`
- Version: v63.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | invoices | Invoice Ingestion Input[] | Required | 63.0 | List of invoices to generate/ingest |
- Response: Invoice Ingestion response

---

### Invoice Estimated Tax Calculation
- Method: POST
- Path: `/commerce/invoicing/invoices/collection/actions/calculate-estimated-tax`
- Version: v63.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | invoiceIds | String[] | Required | 63.0 | Invoice IDs for estimated tax (one per request) |
  | correlationId | String | Optional | 63.0 | Splunk correlation ID |
- Response: Revenue Async Response

---

### Invoice Preview
- Method: POST
- Path: `/commerce/invoicing/invoices/collection/actions/preview`
- Version: v63.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | billingTransactionId | String | Required | 63.0 | Record ID to generate preview invoices for |
  | numberOfBillingPeriods | Integer | Optional | 64.0 | Billing periods to generate. Default: 2 |
  | previewDate | String | Optional | 63.0 | Date on which preview invoice is generated |
- Response: Invoice Preview response

---

### Invoice Run Recovery
- Method: POST
- Path: `/commerce/invoicing/invoice-batch-runs/{invoiceBatchRunId}/actions/recover`
- Version: v62.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | invoiceBatchRunId | String | Required | 62.0 | Path param — failed invoice batch run ID |
- Response: Invoice Batch Run Recovery response

---

### Batch Invoices Draft to Posted
- Method: POST
- Path: `/commerce/invoicing/invoice-batch-runs/{invoiceBatchRunId}/actions/draft-to-posted`
- Version: v62.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | invoiceBatchRunId | String | Required | 62.0 | Path param — invoice batch run record ID |
  | invoiceIds | String[] | Required | 62.0 | Draft invoice IDs to post |
- Response: Invoice Batch Draft To Posted response

---

### Batch Invoice Document Generation
- Method: POST
- Path: `/commerce/billing/invoices/invoice-batch-docgen/{invoiceBatchRunId}/actions/{actionName}`
- Version: v63.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | invoiceBatchRunId | String | Required | 63.0 | Path param — invoice batch run ID |
  | actionName | String | Required | 63.0 | Path param — action to perform on batch run |
- Response: Batch Invoice Document Generation response

---

### Send Emails for Posted Invoices
- Method: POST
- Path: `/commerce/invoicing/invoice-batch-runs/actions/send-email`
- Version: v65.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | invoiceBatchRunId | String | Required | 65.0 | Invoice batch run ID to send emails for |
- Response: Send Email Response

---

### Negative Invoice Lines to Credit
- Method: POST
- Path: `/commerce/invoicing/invoices/{invoiceId}/actions/convert-to-credit`
- Version: v62.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | invoiceId | String | Required | 62.0 | Path param — invoice with negative lines |
  | effectiveDate | String | Required | 62.0 | Date stamped on created credit memo |
  | description | String | Optional | 62.0 | Description for the credit memo |
  | invoiceLines | String[] | Optional | 62.0 | Negative invoice lines with associated taxes |
- Response: Convert Negative Invoice Lines response

---

### Create and Apply Credit Memo
- Method: POST
- Path: `/commerce/invoicing/invoices/{invoiceId}/actions/credit`
- Version: v62.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | invoiceId | String | Required | 62.0 | Path param — invoice ID |
  | invoiceLines | Credit Invoice Line Input[] | Required | 62.0 | Invoice lines to credit |
  | taxStrategy | String | Required | 62.0 | Ignore, ManualOverride, CopyFromInvoiceLine, Calculate |
  | description | String | Optional | 62.0 | Credit memo description |
  | effectiveDate | String | Optional | 62.0 | Effective date |
  | taxEffectiveDate | String | Optional | 62.0 | Tax effective date |
  | type | String | Optional | 62.0 | Posted or Draft |
- Response: Revenue Async Line Level response

---

### Unapply Credit Memo
- Method: POST
- Path: `/commerce/invoicing/credit-memo-inv-applications/{creditMemoInvApplicationId}/actions/unapply`
- Version: v62.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | creditMemoInvApplicationId | String | Required | 62.0 | Path param |
  | description | String | Optional | 62.0 | Reason for unapplying |
  | effectiveDate | String | Optional | 62.0 | Effective date |
- Response: Credit Memo Unapply response

---

### Apply Credit Memo Line
- Method: POST
- Path: `/commerce/invoicing/credit-memo-lines/{creditMemoLineId}/actions/apply`
- Version: v62.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | creditMemoLineId | String | Required | 62.0 | Path param |
  | applyCreditDetails | Credit Memo Line Application Input[] | Required | 62.0 | Applications to apply |
- Response: Credit Memo Line Applied response

---

### Unapply Credit Memo Line
- Method: POST
- Path: `/commerce/invoicing/credit-memo-line-invoice-line/{creditMemoLineInvoiceLineId}/actions/unapply`
- Version: v62.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | creditMemoLineInvoiceLineId | String | Required | 62.0 | Path param |
  | description | String | Optional | 62.0 | Reason for unapplying |
  | effectiveDate | String | Optional | 62.0 | Effective date |
- Response: Credit Memo Line Unapplied response

---

### Standalone Credit Memo
- Method: POST
- Path: `/commerce/invoicing/credit-memos/actions/generate`
- Version: v62.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | billingAccountId | String | Required | 62.0 | Account credit is issued to |
  | charges | Standalone Credit Memo Charge Input[] | Required | 62.0 | Charge lines (min 1) |
  | taxStrategy | String | Required | 62.0 | Ignore, Manual Override, Calculate |
  | billToContactId | String | Optional | 62.0 | Bill-to contact |
  | currencyIsoCode | String | Optional | 62.0 | Currency ISO code |
  | description | String | Optional | 62.0 | Credit description |
  | effectiveDate | String | Optional | 62.0 | Effective date |
  | externalReference | String | Optional | 62.0 | External reference ID |
  | externalReferenceDataSource | String | Optional | 62.0 | External reference source |
  | taxEffectiveDate | String | Optional | 62.0 | Tax effective date |
  | type | String | Optional | 62.0 | Posted or Draft |
- Response: Revenue Async Response

---

### Post a Draft Memo
- Method: POST
- Path: `/commerce/invoicing/credit/collection/actions/post`
- Version: v65.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | creditMemoIds | String[] | Required | 65.0 | Draft credit memo IDs to post (one per request) |
  | correlationId | String | Optional | 65.0 | Splunk correlation ID |
- Response: Credit Memo Post response

---

### Void Posted Credit Memo
- Method: POST
- Path: `/commerce/billing/credit-memos/{creditMemoId}/actions/void`
- Version: v66.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | creditMemoId | String | Required | 66.0 | Path param — posted credit memo ID to void |
- Response: Void Posted Credit Memo response

---

### Void a Posted Invoice
- Method: POST
- Path: `/commerce/invoicing/invoices/{invoiceId}/actions/void`
- Version: v62.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | invoiceId | String | Required | 62.0 | Path param — posted invoice ID |
- Response: Revenue Async Response

---

### Posted Invoice List Write-Off
- Method: POST
- Path: `/commerce/invoicing/invoices/actions/write-off`
- Version: v64.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | invoices | Posted Invoice Write-Off Input[] | Required | 64.0 | Invoice details to write off |
- Response: Posted Invoice List Write-Off response

---

### Payment Line Apply
- Method: POST
- Path: `/commerce/billing/payments/{paymentId}/actions/apply`
- Version: v64.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | paymentId | String | Required | 64.0 | Path param — payment ID |
  | amount | Double | Required | 64.0 | Amount to apply |
  | appliedToId | String | Required | 64.0 | Invoice or invoice line ID |
  | associatedAccountId | String | Optional | 64.0 | Associated account ID |
  | comments | String | Optional | 64.0 | Comments |
  | effectiveDate | String | Optional | 64.0 | Effective date |
- Response: Payment Line Apply response

---

### Payment Line Unapply
- Method: POST
- Path: `/commerce/billing/payments/{paymentId}/paymentlines/{paymentLineId}/actions/unapply`
- Version: v64.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | paymentId | String | Required | 64.0 | Path param |
  | paymentLineId | String | Required | 64.0 | Path param |
  | comments | String | Optional | 64.0 | Comments for reversal |
  | effectiveDate | String | Optional | 64.0 | Effective date of reversal |
- Response: Payment Line Unapply response

---

### Refund Line Apply
- Method: POST
- Path: `/commerce/billing/refunds/{refundId}/actions/apply`
- Version: v64.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | refundId | String | Required | 64.0 | Path param |
  | amount | Double | Required | 64.0 | Refund amount |
  | appliedToId | String | Required | 64.0 | Payment or credit memo record ID |
  | comments | String | Optional | 64.0 | Refund details |
  | effectiveDate | String | Optional | 64.0 | Effective from date |
- Response: Refund Line Apply response

---

### Batch Payment Scheduler
- Method: POST
- Path: `/commerce/payments/payment-schedulers/`
- Version: v64.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | schedulerName | String | Required | 64.0 | Scheduler name |
  | startDate | String | Required | 64.0 | Start date |
  | status | String | Required | 64.0 | Active, Canceled, Draft, Inactive |
  | frequencyCadence | String | Required | 64.0 | Once, Daily, Weekly, Monthly |
  | preferredTime | String | Required | 64.0 | Preferred run time |
  | criteriaMatchType | String | Required if Monthly | 64.0 | Match Any, Match None |
  | filterCriteria | PaymentRunBatch Filter Criteria Input | Required if Monthly | 64.0 | Filter criteria |
  | recurseEveryMonthOnDay | String | Required if Monthly | 64.0 | Day of month to recur |
  | endDate | String | Required if Monthly | 64.0 | End date |
- Response: Batch Payments Scheduler response

---

### Payment Scheduler Update
- Method: PATCH
- Path: `/commerce/payments/payment-schedulers/{billingBatchSchedulerId}`
- Version: v64.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | billingBatchSchedulerId | String | Required | 64.0 | Path param |
  | status | String | Required | 64.0 | Active, Canceled, Draft, Inactive |
- Response: Payments Scheduler Update response

---

### Rules Application
- Method: POST
- Path: `/revenue/billing/transactions/actions/apply`
- Version: v66.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | accountId | String | Required | 66.0 | Account for payment/credit settlement |
  | targetDate | String | Optional | 66.0 | Selects invoices/lines posted on or after this date |
- Response: Rules Application response

---

### Suspend Billing (API)
- Method: POST
- Path: `/commerce/invoicing/actions/suspend-billing`
- Version: v63.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | referenceIds | Suspend Billing Object Input[] | Required | 63.0 | Account or billing schedule group IDs to suspend |
- Response: Suspend Resume Billing response

---

### Resume Billing
- Method: POST
- Path: `/commerce/invoicing/actions/resume-billing`
- Version: v63.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | referenceIds | Resume Billing Object Input[] | Required | 63.0 | Account or billing schedule group IDs to resume |
- Response: Suspend Resume Billing response

---

### Generate On-Demand Invoice Document
- Method: POST
- Path: `/revenue/billing/document/actions/generate`
- Version: v66.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | recordId | String | Required | 66.0 | Invoice record ID |
  | documentTemplateId | String | Optional | 66.0 | Template ID for PDF generation |
  | documentTitle | String | Optional | 66.0 | Custom document title |
  | shouldForceRegenerate | Boolean | Optional | 66.0 | Regenerate even if exists. Default: false |
  | tokenData | String | Optional | 66.0 | Token data for generation |
- Response: On-Demand Document Generation Response

---

### Generate Account Statement
- Method: POST
- Path: `/revenue/billing/accounts/{accountId}/statement`
- Version: v66.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | accountId | String | Required | 66.0 | Path param — account ID |
  | startDate | String | Required | 66.0 | Transaction history start date (YYYY-MM-DD) |
  | associatedAccountIds | String[] | Optional | 66.0 | Hierarchy account IDs to include (max 50) |
  | correlationId | String | Optional | 66.0 | Tracking ID |
  | customFields | String | Optional | 67.0 | JSON string of custom fields |
  | documentTemplateId | String | Optional | 66.0 | Template ID for PDF |
  | shouldShowOpenBalancesOnly | Boolean | Optional | 66.0 | Show only open balances |
  | sortBy | String | Optional | 66.0 | Sort criteria. Default: Date |
  | sortingOrder | String | Optional | 66.0 | Ascending or Descending. Default: Descending |
  | transactionTypes | String[] | Optional | 66.0 | All, CreditMemo, DebitMemo, Invoice, Payment, Refund |
- Response: Account Statement Response

---

### Create Sequence Policy
- Method: POST
- Path: `/connect/sequences/policy`
- Version: v65.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | name | String | Required | 65.0 | Policy name |
  | targetObject | String | Required | 65.0 | Invoice or CreditMemo |
  | sequenceMode | String | Required | 65.0 | Basic or Gapless |
  | sequencePattern | String | Required | 65.0 | Pattern structure for sequence |
  | sequenceStartNumber | Integer | Required | 65.0 | Starting sequence number |
  | incrementNumber | Integer | Required | 65.0 | Increment value |
  | isActive | Boolean | Required | 65.0 | Active (true) or not |
  | effectiveFromDateTime | String | Required | 65.0 | Policy effective date/time |
  | filterCriteria | String | Required | 65.0 | Filter criteria for target objects |
  | dateStampFormat | String | Required | 65.0 | Format of stamp date appended to number |
  | description | String | Optional | 65.0 | Policy description |
  | expirationDateTime | String | Optional | 65.0 | Policy expiration |
  | maximumSequenceNumber | Integer | Optional | 65.0 | Maximum sequence number |
  | minimumSequenceNumberWidth | Integer | Optional | 65.0 | Min digits in sequence number |
  | selectionCondition | Selection Condition Input[] | Optional | 65.0 | Criteria for which policy applies |
  | selectionLogic | String | Optional | 65.0 | Logic for policy applicability |
  | timezone | String | Optional | 65.0 | Time zone for policy |
- Response: Sequence Policy response

---

### Update Sequence Policy
- Method: PATCH
- Path: `/connect/sequences/policy/{sequencePolicyId}`
- Version: v65.0
- Params: Same as Create Sequence Policy, all optional for update
- Response: Sequence Policy response

---

### Sequence Assignment
- Method: POST
- Path: `/connect/sequences/actions/assign`
- Version: v65.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | targetObjectIds | String[] | Required | 65.0 | Records to assign sequence values to |
  | sequencePolicyId | String | Optional | 65.0 | Sequence policy ID |
  | shouldPublishPlatformEvent | Boolean | Optional | 65.0 | Publish platform event when sequence assigned |
- Response: Sequences Assignment response

---

### Create Standalone Billing Schedules
- Method: POST
- Path: `/commerce/invoicing/standalone/billing-schedules/actions/create`
- Version: v64.0
- Params:
  | name | type | req | version | description |
  |---|---|---|---|---|
  | transactionContextDetails | Standalone Billing Schedule Metadata Input[] | Required | 64.0 | Context definition and mapping details |
  | transactionDetails | String | Required | 64.0 | Input JSON data with transaction record ID |
- Response: Context-Aware Billing Schedule response

---

## Billing Invocable Actions (Add as Billing category)

### Recover Billing Schedules
- Path: `/services/data/v67.0/actions/standard/recoverBillingSchedules`
- Version: v67.0
- Params: `billingScheduleId` (String, Required) — billing schedule in Error or Processing status
- Response: Comma-separated IDs of associated parent billing schedule records

### Send Dunning Email
- Path: `/services/data/v67.0/actions/standard/bingSendDunningEmail`
- Version: v67.0
- Params: `collectionPlanId` (Required), `emailTemplateNameOrId` (Optional)
- Response: Boolean (sent/not), info string

### Suspend Billing Action
- Path: `/services/data/v67.0/actions/standard/bingSvcSuspendBilling`
- Version: v67.0 (params available v66.0)
- Params: `accountId` (Required, v66.0), `suspensionDate` (Date, Required), `resumptionDate` (Date, Optional)
- Response: Boolean (suspended/not), info string

### Update Bill To Contact
- Path: `/services/data/v67.0/actions/standard/bingSvcUpdateBillToContact`
- Version: v67.0 (params available v66.0)
- Params: `invoiceId` (Required), `newBillToContactId` (Required), `setAsDefault` (Boolean, Optional, default false)
- Response: Boolean (updated/not), info string

### Unapply Credit
- Path: `/services/data/v67.0/actions/standard/unapplyCredit`
- Version: v67.0 (params available v62.0)
- Params: `recordId` (Required, v62.0), `effectiveDate` (Required), `description` (Optional)
- Response: ID of the Unapplied credit memo invoice application record

### Unapply Payment
- Path: `/services/data/v67.0/actions/standard/unapplyPayment`
- Version: v67.0 (params available v64.0)
- Params: `recordId` (Id, Required), `effectiveDateTime` (Optional), `description` (Optional)
- Response: ID of Unapplied payment line record; unappliedDateTime

### Void Posted Credit Memo Action
- Path: `/services/data/v67.0/actions/standard/voidPostedCreditMemo`
- Version: v66.0
- Params: `creditMemoId` (String, Required) — posted credit memo to void
- Response: debitMemoId; statusUrl

### Write Off Invoices
- Path: `/services/data/v67.0/actions/standard/writeOffInvoices`
- Version: v64.0
- Params: `writeOffInvoiceInputList` (Apex-defined, Required) — InvoiceWriteOff namespace input records
- Response: Collection of InvoiceWriteOff namespace output records

---

## Critical Path Fixes
- `bill-1 Invoice Creation`: Correct path is `/commerce/invoicing/invoices/collection/actions/generate`
- `bill-8 Tax Calculation`: Correct path is `/commerce/taxes/actions/calculate`
- `bill-6 Apply Credit Memo`: Path should be `/commerce/invoicing/credit-memos/{creditMemoId}/actions/apply` (with path param)
