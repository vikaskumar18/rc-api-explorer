---
name: revenue-cloud-transaction-developer
description: Revenue Cloud Transaction Management Developer Guide — lifecycle, patterns, async, amendments — PDF (2026-06-13)
metadata:
  type: reference
---

# Revenue Cloud Transaction Management — Developer Reference

## Source Info

- PDF: Revenue Lifecycle Management Developer Guide (2026-06-13), 2917 pages
- Chapter 8: Transaction Management (PDF pages 1204–1381)
- API versions referenced: v55.0 through v67.0

---

## 1. Transaction Management Overview

Transaction Management tracks and manages the lifecycle of assets sold to customers. It records what was sold (asset state periods), what changed (asset actions), and ties every change back to a source transaction (asset action sources).

**License required:** "Access Customer Asset Lifecycle Management APIs" permission set for CALM APIs. Revenue Cloud Advanced license for standard object field visibility (Order, OrderItem, Quote, QuoteLineItem, etc.).

**Core concept:** When `HasLifecycleManagement = true` on an Asset, Revenue Cloud owns that asset's lifecycle — every amendment, cancellation, renewal, and transfer creates structured audit trail records.

---

## 2. Standard Objects in Chapter 8

### 2.1 Asset

The root object for a customer's entitlement.

Key fields:
- `HasLifecycleManagement` (boolean) — flag that enables RC to manage this asset's lifecycle. Must be true for amendments/cancellations/renewals to work.
- `Status` — picklist: `Purchased`, `Shipped`, `Installed`, `Registered`, `Obsolete`
- `LifecycleStartDate` / `LifecycleEndDate` — the effective dates of the subscription/entitlement
- `CurrentLifecycleEndDate` — the current (possibly amended) end date
- `AssetLevel` — integer depth in the asset hierarchy (1 = root)
- `CurrentMrr` — current monthly recurring revenue
- `CurrentQuantity` — current active quantity
- `TotalLifecycleAmount` — total value over the entire lifecycle
- `PricingSource` — picklist: `LastTransaction` (use price from most recent order) or `PriceBookListPrice` (use pricebook)
- `RenewalPricingType` — picklist: `LastNegotiatedPrice` or `ListPrice`
- `QuantityIncreasePricingType` — picklist: `LastNegotiatedPrice` or `ListPrice`
- `RenewalTerm` (int) + `RenewalTermUnit` (`Annual` / `Months`) — default renewal duration

### 2.2 AssetAction

Records a business event against an asset (amendment, cancellation, renewal, etc.).

Key fields:
- `ActionDate` — date the action takes effect (distinct from AssetStatePeriod start date)
- `CategoryEnum` — business category picklist:
  - `Cancellations`, `Cross-Sells`, `Downgrades`, `Downsells`, `Initial Sale`, `Other`, `Renewals`, `Swaps`, `Terms and Conditions Changes`, `Transfers`, `Upgrades`, `Upsells`
- `Type` — REST API source picklist: `Cancel`, `Change`, `Convert`, `Generate`
- `Subtype` — (API v65+) picklist: `DowngradeFrom`, `DowngradeTo`, `FieldAmendment`, `Rollback`, `StartDateAdjustment`, `SwapIn`, `SwapOut`, `TransferFrom`, `TransferTo`, `UpgradeFrom`, `UpgradeTo`
- `CanRollBack` (boolean, API v65+) — whether this action can be rolled back
- `RolledbackAssetAction` — reference to the action that was rolled back
- `MrrChange` — MRR delta from this action
- `QuantityChange` — quantity delta
- `TotalAmount` — total value of the action

### 2.3 AssetActionSource

Traceability record linking an order item (or work order line item) to an AssetAction.

Key fields:
- `BillingReference` — reference to the originating OrderItem or OrderItemDetail
- `OriginalLineNumber` — line number on the originating transaction (critical for amend/renew/cancel to correlate lines)
- `PeriodBoundary` — picklist: `AlignToCalendar`, `Anniversary`, `DayOfPeriod`, `LastDayOfPeriod`
- `ProductSellingModelId` — the selling model used
- `ProrationPolicyId` — proration policy applied
- `SegmentIdentifier` — identifies which ramp segment this source belongs to
- `StartDate` / `EndDate` — service period dates

### 2.4 AssetActionSrcPriceAdjustment

Junction between asset and a calculated price adjustment.

Key fields:
- `PriceAdjustmentCauseId` — points to Promotion
- `PriceAdjustmentSource` — picklist: `Discretionary`, `Promotion`, `Rule`, `System`

### 2.5 AssetStatePeriod

Represents a time span during which an asset has a constant quantity, amount, and MRR.

Key fields:
- `Amount` — total value during this period
- `BillingFrequency` — (API v65+) picklist: `Annual`, `Monthly`, `Quarterly`, `Semi-Annual`
- `BindingInstanceTargetId` — for usage binding
- `RampIdentifier` — groups all segments of a ramp deal together
- `SegmentIdentifier` — identifies the specific ramp segment
- `SegmentName` — display name of the segment
- `SegmentType` — picklist: `Custom`, `Free Trial`, `Yearly` (default: `Yearly`)
- `UnitPrice` — price per unit for this period
- `UnitPriceUplift` — uplift percentage applied to unit price

### 2.6 AssetStatePeriodAttribute

Virtual object — stores attribute values for asset state periods. Editable via API only (no UI). Does not support custom fields, validation rules, or triggers. In SOQL, can filter by `Id` and `AttributeDefinition` but NOT by `AttributeValue` in WHERE clause.

### 2.7 AssetRateAdjustment

Negotiated rate adjustment for an asset.

Key fields:
- `AdjustmentType` — picklist: `Amount`, `Override`, `Percentage`
- `AdjustmentValue`
- `LowerBound` / `UpperBound` — quantity range for applicability

### 2.8 AssetRateCardEntry

Catalog and negotiated rates for a usage metric associated with an asset.

Key fields:
- `BindingObjectId` — the binding target
- `BindingObjectRateOrder` — order for drawdown
- `NegotiatedRate` — base negotiated rate for overage consumption
- `RateCardEntryId` — catalog rate card entry
- `IsChosenRate` (boolean, API v64+) — whether this is the chosen rate for the binding target

### 2.9 AssetRelationship

Tracks relationships between assets (e.g., upgrade from old to new).

Key fields:
- `RelationshipType` — picklist: `Crossgrade`, `Replacement`, `Upgrade`
- `GroupingKey` — identifies the bundle group (all assets in the same bundle share this key)
- `RelatedAssetRole` — picklist: `Add-on`, `Bundle`, `Set`, `Simple`, `Variation Parent`

### 2.10 AssetContractRelationship

Links an asset to a contract.

### 2.11 AssetTag / AssetWarranty / AssetDowntimePeriod / AssetShare

Supporting objects for asset management metadata.

### 2.12 BindingObjUsageRsrcPlcy

Policy governing how usage entitlement buckets are drawn down.

Key fields:
- `DrawdownOrder` — picklist: `ExpiringFirst`, `GrantedFirst`, `GrantedLast`
- `RatingFrequencyPolicyId`
- `UsageAggregationPolicyId`
- `UsageCommitmentPolicyId`
- `UsageOveragePolicyId`

### 2.13 ContractItemPrice

Negotiated price for a contract line item.

Key fields:
- `SellingModelType` — picklist: `Evergreen`, `OneTime`, `TermDefined`
- `AdjustmentMethod` — picklist: `Range`, `Slab`
- `DiscountType` — picklist: `AdjustmentAmount`, `AdjustmentPercentage`
- `ItemId` — polymorphic reference to `Product2` or `ProductCategory`

### 2.14 ContractItemPriceAdjTier / ContractItemPriceHistory

Tiered adjustments and audit history for contract item prices.

---

## 3. Order-Side Objects

### 3.1 OrderDeliveryMethod

Delivery method customizations for commerce orders. Requires Salesforce Order Management license.

Key fields:
- `Carrier` (picklist — admin must add values)
- `ClassOfService` (picklist — admin must add values)
- `IsActive` (boolean) — controls assignment to delivery groups
- `ProductId` — optional product representing a delivery charge
- `ShippingCarrierMethod` — specific service level

### 3.2 OrderItemAttribute

Virtual object storing an attribute for an order item. Available API v60+.

Key fields:
- `AttributeDefinitionId` — reference to AttributeDefinition
- `AttributeValue` (string) — actual value; use `AttributePicklistValueId` for picklist types; cannot filter picklist types by this field
- `IsPriceImpacting` (boolean, default false)
- `OrderItemId` — parent order item (master-detail)
- `ExternalId` — ID in an external system (e.g., HBase)

### 3.3 OrderItemDetail

Breakdown details of an order product. Generated by RC to capture pricing/quantity changes (negative quantity reductions, early renewals, derived pricing, repricing during amendment, bundle/attribute reconfigurations). Read-only (describeLayout, getDeleted, getUpdated, query, retrieve only). Available API v60+.

Key fields:
- `BillingReference` — reference to original order item for amend/cancel records
- `EffectiveFrom` / `EffectiveTo` — transaction effectivity window
- `LineNumber` — line number of the detail record
- `NetUnitPrice` — unit price after discounts, before tax
- `OrderItemId` — parent order item
- `PriceWaterfallIdentifier` — Salesforce Pricing waterfall ID
- `Quantity`
- `ReferenceDate` — e.g., subscription start date
- `ReferenceNumber` — e.g., the order number
- `TotalLineAmount` — net total before price adjustments, inclusive of qty and term
- `TotalPrice` — calculated using qty, net unit price, and pricing terms
- `UnitPrice` — before discounts

### 3.4 OrderItemRateAdjustment

Negotiated rate adjustment for an order item. Available API v62+. Requires Revenue Cloud.

Key fields:
- `AdjustmentType` — picklist: `Amount`, `Override`, `Percentage`
- `AdjustmentValue`
- `LowerBound` / `UpperBound` — quantity range
- `OrderItemRateCardEntryId` — parent rate card entry (master-detail)

### 3.5 OrderItemRateCardEntry

Catalog and negotiated rates of a usage metric for an order item (overage consumption). Available API v62+.

Key fields:
- `IsChosenRate` (boolean, API v64+) — whether this is the chosen rate for the binding target and usage resource
- `NegotiatedRate` — base negotiated rate for overage
- `OrderItemId` — parent order item (master-detail)
- `RateCardEntryId` — catalog rate card entry
- `RateCardId` — the rate card
- `RateUnitOfMeasureId` — unit of measure for the negotiated rate
- `UsageResourceId` — the usage resource

### 3.6 OrderItemUsageRsrcGrant

Negotiated grants for usage resources on an order item's usage product. Available API v65+.

Key fields:
- `GrantQuantity` — granted/negotiated quantity
- `GrantType` — picklist: `Commit`, `Grant` (default: `Grant`)
- `OrderItemId` — parent order item (master-detail)
- `ProductUsageGrantId`
- `TokenResourceId` — Token-category usage resource
- `UsageGrantRefreshPolicyId`
- `UsageGrantRolloverPolicyId`
- `UsageResourceId`
- `ValidityPeriodTerm` (int) + `ValidityPeriodUnit` — picklist: `Month`, `None`, `Year`

### 3.7 OrderItemUsageRsrcPlcy

Policies for usage resources on an order item's usage product. Available API v65+.

Key fields:
- `DrawdownOrder` — picklist: `ExpiringFirst`, `GrantedFirst`, `GrantedLast`
- `ProductUsageResourcePolicyId`
- `RatingFrequencyPolicyId`
- `UsageAggregationPolicyId`
- `UsageCommitmentPolicyId`
- `UsageOveragePolicyId`
- `UsageResourceId`

---

## 4. Quote-Side Objects

### 4.1 SalesTransactionType

Represents the type of a sales transaction. Available API v61+.

Key fields:
- `Name` — the sales transaction type name

### 4.2 QuoteAction

Indicates the type of sales transaction being quoted (e.g., renewal sale). Available API v59+.

**Critical rule:** If a quote does not have a QuoteAction, Salesforce treats it as an `Add` type. When such a quote is used to create an order, Salesforce automatically creates an OrderAction of the `Add` type.

Key fields:
- `CurrencyIsoCode` — (API v66+) ISO 4217 currency code; must be unique within org; default USD
- `QuoteId` — the related quote (lookup to Quote)
- `SourceAssetId` — the asset changed by this transaction (e.g., for quantity amendment, the amended asset)
- `Subtype` — (API v64+, Revenue Cloud) picklist:
  - `DowngradeFrom`, `DowngradeTo` — (v66+)
  - `FieldAmendment`
  - `Rollback`
  - `StartDateAdjustment`
  - `SwapIn`, `SwapOut` — (v66+)
  - `TransferFrom`, `TransferTo`
  - `UpgradeFrom`, `UpgradeTo` — (v66+)
- `Type` — picklist: `Add`, `Amend`, `Association` (v66+), `Cancel`, `No Change`, `Renew`, `Transfer` (v65+)

### 4.3 QuoteItemTaxItem

Tax applied to a quote line item. Available API v55+. Available if Subscription Management enabled or Revenue Cloud (Enterprise/Unlimited/Developer editions).

Key fields:
- `Amount` — tax amount
- `CurrencyIsoCode` — multicurrency ISO code
- `Description` — e.g., state sales tax or VAT
- `Name` — name of the tax
- `QuoteLineItemId`
- `Rate` — percentage (null if fixed amount)
- `TaxEffectiveDate` — date used to calculate tax rate
- `Type` — picklist: `Actual`, `Estimated`

### 4.4 QuoteLineDetail

Breakdown details for a quote line item. Generated by RC to capture pricing/quantity changes. Read-only. Available API v60+.

Key fields:
- `BillingReference` — reference to original order item for amend/cancel
- `EffectiveFrom` / `EffectiveTo`
- `LineNumber`
- `NetUnitPrice` — unit price after discounts, before tax
- `PriceWaterfallIdentifier`
- `Quantity`
- `QuoteLineItemId`
- `ReferenceDate` — e.g., subscription start date
- `ReferenceNumber` — e.g., order number
- `TotalLineAmount`
- `TotalPrice`
- `UnitPrice` — before discounts

### 4.5 QuoteLineGroup

Stores group information for line items in a quote, including aggregated subtotal data. Parent-child relationship to quote. Available API v61+.

Key fields:
- `Description`, `Discount`, `DiscountAmount`
- `EndDate` — end date of the group ramp segment; if `IsRamped=true`, TM sets this as end date of all lines with Term-Defined selling model
- `IsRamped` (boolean) — whether this is a group ramp segment with specific prices/volumes (default false; requires "Ramp Deals for Groups in Quotes and Orders" setting)
- `Margin`, `MarginAmount`
- `Name`
- `ParentQuoteLineGroupId` — for nested groups
- `QuoteId` — master quote (master-detail)
- `SegmentType` — picklist: `Custom`, `Yearly`
- `SortOrder`
- `StartDate` — start date of the ramp segment; if `IsRamped=true`, TM sets this as start date of all lines in the group
- `SummarySubtotal` — aggregated subtotal of nested group lines
- `SummaryTotalAmount` — total before discounts
- `TotalAdjustment` = (SummaryTotalAmount - SummarySubtotal) / SummaryTotalAmount
- `TotalAdjustmentAmount` = SummaryTotalAmount - SummarySubtotal
- `TotalCost`, `TotalMargin`, `TotalMarginAmount`
- `Type` — picklist: `AssetDowngrade`, `AssetSwap`, `AssetUpgrade`, `CPQQuoteGroup` (default), `RampScheduleGroup`

### 4.6 QuoteLineItemAttribute

Virtual object for quote line item attributes. Available API v59+. Does not support custom fields, validation rules, or triggers. Cannot use `AttributeValue` in WHERE clause of SOQL.

Key fields:
- `AttributeDefinitionId`, `AttributeName`, `AttributePicklistValueId`, `AttributeValue`
- `ExternalId`
- `IsPriceImpacting` (boolean, default false)
- `QuoteLineItemId` — master-detail parent

### 4.7 QuotLineItmUseRsrcGrant

Negotiated grants for usage resources on a quote line item's usage product. Available API v65+.

Key fields:
- `GrantQuantity`, `GrantType` (Commit/Grant, default Grant)
- `ProductUsageGrantId`
- `QuoteLineItemId` (master-detail)
- `TokenResourceId`
- `UsageGrantRefreshPolicyId`, `UsageGrantRolloverPolicyId`
- `UsageResourceId`
- `ValidityPeriodTerm` + `ValidityPeriodUnit` (Month/None/Year)

### 4.8 QuotLineItmUsageRsrcPlcy

Policies for usage resources on a quote line item. Available API v65+.

Key fields:
- `DrawdownOrder` (ExpiringFirst/GrantedFirst/GrantedLast)
- `ProductUsageResourcePolicyId`
- `RatingFrequencyPolicyId`
- `UsageAggregationPolicyId`, `UsageCommitmentPolicyId`, `UsageOveragePolicyId`
- `UsageResourceId`
- `QuoteLineItemId` (master-detail)

### 4.9 QuoteLineRateAdjustment

Negotiated rate adjustment for a quote line item. Available API v62+.

Key fields:
- `AdjustmentType` (Amount/Override/Percentage)
- `AdjustmentValue`
- `LowerBound`, `UpperBound` — quantity range
- `QuoteLineRateCardEntryId` — master-detail parent

### 4.10 QuoteLineRateCardEntry

Catalog and negotiated rates of a usage metric for a quote line item (overage). Available API v62+.

Key fields:
- `IsChosenRate` (boolean, API v64+)
- `NegotiatedRate`
- `QuoteLineItemId` (master-detail)
- `RateCardEntryId`, `RateCardId`, `RateUnitOfMeasureId`, `UsageResourceId`

---

## 5. Transaction Management Fields on Standard Objects

These are RC-specific fields added to core Salesforce objects. Require Revenue Cloud Advanced license.

### 5.1 Fields on Object State Definition (API v60+)

- `AppUsageType` (string) — indicates which AppUsageType the transition applies to; ObjectStateDefinitions with "Revenue Lifecycle Management" AppUsageType apply to quotes, assets, or orders associated with Revenue Lifecycle Management

### 5.2 Fields on Object State Transition (API v60+)

- `CustomPermissionId` — the custom permission required to make this transition

### 5.3 Fields on Object State Value (API v60+)

- `CustomPermissionId` — the custom permission associated with this state value

### 5.4 Transaction Management Fields on Order

Requires Revenue Cloud Advanced license.

- `AdjustmentDistributionLogic` — (API v65+) picklist: `Equal` (equal distribution among all order items with prices), `Proportionate` (proportional to ListPriceTotal). Controls how `AppliedDiscountAmount` or difference between `TotalAmount` and `TotalAmountOverride` distributes.
- `AppliedDiscount` (percent, API v65+) — percent discount distributed among all order items with prices
- `AppliedDiscountAmount` (currency, API v65+) — discount amount distributed based on `AdjustmentDistributionLogic`
- `CalculationStatus` (read-only, API v61+) — picklist tracking pricing/tax calculation state:
  - `CompletedWithPricing` — pricing done, tax next
  - `CompletedWithTax` — both complete
  - `CompletedWithoutPricing` — skipped (UI shows "Unknown")
  - `ConfigurationFailed` — (v62+)
  - `ConfigurationInProgress` — (v62+)
  - `GroupRampConfigurationFailed` — (v65+) group ramp checks failed
  - `OrderRequestFailed` — (v62+) changes not saved
  - `OrderRequestPartiallySaved` — (v62+)
  - `PriceCalculationFailed`
  - `ReconciliationFailed` — (v62+) data arrangement failed
  - `ReconciliationInProgress` — (v62+) (UI shows "Saving")
  - `SaveFailedOrIncomplete` — (UI shows "Some Records Weren't Saved")
  - `TaxCalculationFailed`
  - `TaxCalculationWaiting`
- `DiscountPercent` (percent, API v60+) — calculated as ((TotalRoundedLineAmount - TotalAmount) / TotalRoundedLineAmount) * 100
- `FulfillmentPlanId` — (API v60+, DRO only) reference to FulfillmentPlan
- `LastPricedDate` (dateTime, API v60+) — when order price was last calculated
- `OrchestrationSbmsStatus` (read-only, API v61+, DRO only) — picklist: `Completed`, `Rejected`, `Submitted`
- `OriginalActionType` — (API v61+) picklist: `Amend`, `Cancel`, `Renew`, `Transfer` — specifies the action that created the order
- `SalesTransactionTypeId` — (API v61+) FK to SalesTransactionType
- `TotalAmountOverride` — (API v65+) currency; the override total; TM calculates discount as TotalAmount - TotalAmountOverride and distributes per AdjustmentDistributionLogic
- `TotalRoundedLineAmount` — (API v60+) total of all line items without pricing adjustments/discounts/tax
- `TransactionType` — (API v61+) picklist: `AdvancedConfigurator` — order must be processed using Constraint Rules Engine
- `ValidationResult` — (API v61+) picklist: `MissingContributor` (derived product without pricing source), `TransactionInComplete` (not configured and priced) — orders can only be activated after configured and priced

### 5.5 Transaction Management Fields on Order Item

Requires Revenue Cloud Advanced license.

- `CustomProductName` (string, max 80 chars, API v61+) — overrides product name display
- `Discount` (percent, API v60+) — manual discount percentage
- `DiscountAmount` (currency, API v60+) — manual discount amount
- `EffectiveGrantDate` (date) — date resources associated with the item are granted
- `EndDatetime` (dateTime, API v65+) — calculated from EndDate + EndTime + ServiceEndTimeZone; defaults: EndTime=23:59:59, ServiceEndTimeZone=GMT
- `EndQuantity` (double, read-only, API v60+) — revised quantity after adjustments; calculated as StartQuantity + Quantity
- `EndTime` (time, API v65+) — end time of the order item
- `Margin` (percent, API v65+) — optional margin percentage
- `MarginAmount` (currency, API v65+) — optional margin amount
- `NetTotalPrice` (currency, API v60+) — total price after all price adjustments
- `OrderItemGroupId` — reference to OrderItemGroup
- `PartnerDiscountPercent` (percent, API v60+) — partner discount percentage
- `PartnerUnitPrice` (currency, API v60+) — unit price after partner discount
- `PriceWaterfallIdentifier` (string, API v60+) — Salesforce Pricing waterfall ID
- `SegmentType` — (API v65+, requires "Ramp Deals for Groups in Quotes and Orders" setting) picklist: `Custom` (v65+), `Prorated` (v67+), `Trial` (v67+), `Yearly` (v65+, default)
- `ServiceDateTime` (dateTime, API v65+) — start date and time from ServiceDate + ServiceTime + ServiceEndTimeZone
- `ServiceEndTimeZone` (picklist, API v65+) — timezone for start and end dates/times
- `ServiceTime` (time, API v65+) — start time
- `StartQuantity` (double, API v60+) — quantity at start date
- `Status` — status of the order item (API v60+)
- `SubscriptionTerm` (int, API v61+) — number of subscription terms; unit stored in OrderItem.ProductSellingModel.PricingTermUnit
- `TotalAdjustment` (percent, API v65+) = (Total Line Amount - Net Total Price) / Total Line Amount
- `TotalCost` (currency, API v65+) = Quantity * UnitCost
- `TotalMargin` (percent, API v65+) = (Net Total Price - Total Cost) / Net Total Price
- `TotalMarginAmount` (currency, API v65+) = Net Total Price - Total Cost
- `UnitCost` (currency, API v65+) — unit cost of product in the order
- `ValidationResult` — picklist: `Warning` (item not configured and priced; API v60+)

### 5.6 Transaction Management Fields on Order Item Group

- `Discount`, `DiscountAmount` (API v65+) — group-level discount
- `EndDate` — end date of the group; if `IsRamped=true`, TM sets as end date for all Term-Defined lines in group (API v65+)
- `IsRamped` (boolean, default false, API v65+) — whether this is a group ramp segment; requires "Ramp Deals for Groups in Quotes and Orders" setting
- `Margin`, `MarginAmount` (API v65+)
- `ParentOrderItemGroupId` — for nested groups (API v65+)
- `SegmentType` — picklist: `Custom` (v65+), `Prorated` (v67+), `Trial` (v67+), `Yearly` (v65+)
- `StartDate` — if `IsRamped=true`, TM sets as start date for all lines in group (API v65+)
- `SummaryTotalAmount` — aggregated total before discounts (API v65+)
- `TotalAdjustment`, `TotalAdjustmentAmount`, `TotalCost`, `TotalMargin`, `TotalMarginAmount` (API v65+)

### 5.7 Transaction Management Fields on Order Action (API v55+)

- `Type` — picklist: `Add`, `Amend`, `Cancel`, `No Change` (child product added to bundle but top-level unchanged), `Renew`

### 5.8 Transaction Management Fields on Order Item Relationship (API v58+)

- `ProductRelatedComponentId` — the product included in a bundle, set, or add-on

### 5.9 Transaction Management Fields on Quote (API v60+)

Requires Revenue Cloud Advanced license.

- `AdjustmentDistributionLogic` — (API v65+) `Equal` or `Proportionate` (by ListPriceTotal); distributes `AppliedDiscountAmount` or TotalPrice - TotalPriceOverride difference
- `AppliedDiscount`, `AppliedDiscountAmount` (API v65+)
- `LastPricedDate` (dateTime) — when quote was last priced
- `OriginalActionType` — (API v61+) picklist: `Amend`, `Cancel`, `Renew`, `Transfer` — specifies the action that created the quote
- `PartnerAccountId` — ID of partner account
- `TotalPriceOverride` — (API v65+) the target total; TM distributes (TotalPrice - TotalPriceOverride) per AdjustmentDistributionLogic
- `TotalPriceWithTax` — (API v64+) sum of TotalPrice and TotalTaxAmount; only when "Add Estimated Tax to Quotes and Orders" is enabled
- `TotalTaxAmount` — (API v64+) total tax; calculated field; only when tax estimation enabled
- `TransactionType` — (API v62+) picklist: `AdvancedConfigurator`
- `ValidationResult` — (API v61+) staleness indicator picklist:
  - blank/null — pricing current and valid
  - `MissingContributor` — derived product without its pricing source
  - `TransactionIncomplete` — not configured and priced (occurs when modified outside standard pricing flow, e.g., directly via DML instead of Place Quote or Place Sales Transaction API)

### 5.10 Transaction Management Fields on Quote Line Group (API v65+)

Mirrors Order Item Group fields: `Discount`, `DiscountAmount`, `EndDate`, `IsRamped`, `Margin`, `MarginAmount`, `ParentQuoteLineGroupId`, `SegmentType`, `StartDate`, `SummaryTotalAmount`, `TotalAdjustment`, `TotalAdjustmentAmount`, `TotalCost`, `TotalMargin`, `TotalMarginAmount`

### 5.11 Transaction Management Fields on Quote Line Item (API v60+)

Requires Revenue Cloud Advanced license.

- `DiscountAmount` (currency) — fixed amount discount
- `EffectiveGrantDate` (date)
- `EndDateTime` / `StartDateTime` (dateTime, API v65+) — calculated from date + time + timezone fields
- `EndQuantity` (double, read-only) = StartQuantity + Quantity
- `EndTime` / `StartTime` (time, API v65+)
- `Margin`, `MarginAmount` (API v65+)
- `PartnerDiscountPercent`, `PartnerUnitPrice`
- `PriceWaterfallIdentifier`
- `StartEndTimeZone` (picklist, API v65+) — timezone for start and end
- `StartQuantity`
- `TotalAdjustment`, `TotalCost`, `TotalMargin`, `TotalMarginAmount`, `UnitCost` (API v65+)
- `ValidationResult` — picklist: `Warning` (not configured and priced)

### 5.12 Transaction Management Fields on Quote Document (API v61+)

- `DocumentTemplate` (string) — template ID for quote document generation
- `Status` — picklist: `Completed`, `Failed`, `Generating`, `In Progress`, `None` (default), `Queued`

---

## 6. TransactionProcessingType (Tooling API Object)

Configures processing constraints for a request. API v63+. Access via Tooling API (SOAP: `create`, `describeSObjects`, `query`, `retrieve`; REST: GET, HEAD, POST, Query).

**Purpose:** Allows admins/developers to configure per-transaction settings for pricing, tax, rule engine, and save behavior — enabling performance optimizations and behavior overrides.

Key fields:
- `DeveloperName` — required; API name; unique in org; label is "Record Type Name"
- `MasterLabel` — display label
- `PricingPreference` — (API v65+) picklist:
  - `Force` — reprices all lines
  - `System` — delta pricing on unprocessed lines (when Delta Pricing enabled)
  - `Skip` — skips all pricing requests
- `RatingPreference` — (API v66+) picklist value: `Fetch` — retrieves and saves catalog rates for usage resources per sales transaction record. If not specified, catalog rates are NOT saved by default when a quote line item is added.
- `RuleEngine` — picklist: `AdvancedConfigurator`, `StandardConfigurator`
- `SaveType` — picklist: `Standard`, `Large` (reserved for future use)
- `TaxPreference` — (API v65+) picklist: `Skip` — skips tax calculation. If not specified, tax calculation runs by default.

**Usage — create via REST Tooling API:**
```json
POST /services/data/v67.0/tooling/sobjects/TransactionProcessingType
{
  "SaveType": "Standard",
  "Description": "Setup for Transaction Processing Type",
  "DeveloperName": "SkipPricingAndTaxStep",
  "MasterLabel": "SkipPricingAndTaxStep",
  "RuleEngine": "StandardConfigurator",
  "PricingPreference": "Skip",
  "TaxPreference": "Skip"
}
```

---

## 7. Ramp Deal Structure

Ramp deals allow products with varying quantities and prices across time segments (e.g., ramping from 10 seats in Year 1 to 25 in Year 2).

**Key setting:** "Ramp Deals for Groups in Quotes and Orders" must be enabled.

### Segment containers

- On Quote: `QuoteLineGroup` with `IsRamped = true`
- On Order: `OrderItemGroup` with `IsRamped = true`
- On Asset history: `AssetStatePeriod` with `RampIdentifier` / `SegmentIdentifier`

### SegmentType values

| Value | Available |
|-------|-----------|
| `Custom` | API v65+ (Quote/Order); API v67+ equivalent on AssetStatePeriod |
| `Prorated` | API v67+ |
| `Trial` (formerly Free Trial) | API v67+ |
| `Yearly` | Default; API v65+ |

On `AssetStatePeriod`, the documented values are: `Custom`, `Free Trial`, `Yearly`.

### How group ramp works

- When `IsRamped = true` on an OrderItemGroup/QuoteLineGroup, TM automatically sets the `StartDate` of all line items in the group, and `EndDate` for all Term-Defined lines.
- `RampIdentifier` on AssetStatePeriod groups all segments of the same ramp deal together.
- `SegmentIdentifier` on AssetStatePeriod / AssetActionSource identifies the specific segment.

### QuoteLineGroup.Type for ramp

`RampScheduleGroup` — indicates this group is a ramp schedule group.
Other types: `AssetDowngrade`, `AssetSwap`, `AssetUpgrade`, `CPQQuoteGroup` (default).

---

## 8. Amendment Lifecycle

An amendment modifies an existing active asset (quantity, price, dates, attributes).

### QuoteAction.Type flow

1. Create Quote with `QuoteAction.Type = Amend` and `SourceAssetId` pointing to the asset being amended
2. Add QuoteLineItem(s) with the delta (e.g., quantity change = +5)
3. `QuoteLineItem.StartQuantity` captures quantity before the change; `EndQuantity` (read-only) = StartQuantity + Quantity
4. Place Quote via API to price and configure
5. Convert Quote to Order — OrderAction.Type = `Amend` is auto-created
6. Activate Order — creates AssetAction (Type=`Change`) and new AssetStatePeriod

### Key fields for amendment tracing

- `AssetActionSource.OriginalLineNumber` — correlates amend/renew/cancel lines back to the original order line
- `OrderItemDetail.BillingReference` — reference to original order item
- `QuoteLineDetail.BillingReference` — same for quotes
- `AssetAction.Subtype` — `FieldAmendment` for attribute changes; `StartDateAdjustment` for date changes

### Rollback (API v65+)

- `AssetAction.CanRollBack` (boolean) — indicates if the action can be reversed
- `AssetAction.RolledbackAssetAction` — points to the action that was rolled back

---

## 9. Cancellation

- Create Quote/Order with `QuoteAction.Type = Cancel` / `OrderAction.Type = Cancel`
- `SourceAssetId` on QuoteAction points to the asset being cancelled
- `OriginalActionType` on Order/Quote = `Cancel` after conversion
- Activating the order creates AssetAction with `Type = Cancel` and `CategoryEnum = Cancellations`
- `Asset.Status` becomes `Obsolete` after full cancellation

---

## 10. Renewal

- Create Quote/Order with `QuoteAction.Type = Renew` / `OrderAction.Type = Renew`
- `OriginalActionType` on Quote/Order = `Renew`
- Asset renewal defaults sourced from: `Asset.RenewalTerm`, `Asset.RenewalTermUnit`, `Asset.RenewalPricingType`
- After activation: `AssetAction.CategoryEnum = Renewals`; new `AssetStatePeriod` created extending the lifecycle

---

## 11. Transfer

- Available API v65+ on Order; API v66+ on Quote (`QuoteAction.Type = Transfer`)
- `OriginalActionType = Transfer` on Quote and Order
- Creates paired AssetActions: `Subtype = TransferFrom` (old owner) and `TransferTo` (new owner)

---

## 12. Upgrade / Downgrade / Swap

Available API v66+:
- `QuoteAction.Subtype = UpgradeFrom` / `UpgradeTo`
- `QuoteAction.Subtype = DowngradeFrom` / `DowngradeTo`
- `QuoteAction.Subtype = SwapIn` / `SwapOut`
- `QuoteLineGroup.Type = AssetUpgrade`, `AssetDowngrade`, `AssetSwap`

---

## 13. Asset Pricing Preferences

### Asset-level pricing sources

| Field | Effect |
|-------|--------|
| `Asset.PricingSource = LastTransaction` | Use price from most recent transaction when creating renewal/amend |
| `Asset.PricingSource = PriceBookListPrice` | Pull from active pricebook |
| `Asset.RenewalPricingType = LastNegotiatedPrice` | Renewal uses last negotiated price |
| `Asset.RenewalPricingType = ListPrice` | Renewal uses list price |
| `Asset.QuantityIncreasePricingType = LastNegotiatedPrice` | Quantity increases use last negotiated price |
| `Asset.QuantityIncreasePricingType = ListPrice` | Quantity increases use list price |

### TransactionProcessingType pricing control

| PricingPreference | Behavior |
|-------------------|----------|
| `Force` | Reprices ALL lines on every save |
| `System` | Delta pricing — only reprices unprocessed lines (requires Delta Pricing feature) |
| `Skip` | No pricing requests — use for import scenarios or when pricing already calculated externally |

---

## 14. Quote.ValidationResult — Staleness Indicator

`Quote.ValidationResult` is the primary developer signal that a quote's pricing cannot be trusted:

- `null/blank` — pricing is current and valid
- `MissingContributor` — a derived product is present but its pricing source line is missing
- `TransactionIncomplete` — the quote was modified outside the standard pricing flow (e.g., direct DML to QuoteLineItem instead of using Place Quote or Place Sales Transaction API)

**Critical:** Always use the Place Quote / Place Sales Transaction API to modify quote lines, not direct DML. Direct DML sets `ValidationResult = TransactionIncomplete` and the quote cannot be activated.

Same field exists on `Order.ValidationResult`: `MissingContributor` and `TransactionInComplete`.

---

## 15. Order.CalculationStatus — Async Processing Monitor

The `Order.CalculationStatus` field is the primary async status indicator for quote/order processing:

| Value | Meaning | Developer Action |
|-------|---------|-----------------|
| `CompletedWithPricing` | Pricing done; tax pending | Wait for tax |
| `CompletedWithTax` | Fully complete | Safe to proceed |
| `CompletedWithoutPricing` | Pricing skipped | Check if intentional |
| `ConfigurationInProgress` | Config running | Poll/wait |
| `ConfigurationFailed` | Config failed | Check errors |
| `ReconciliationInProgress` | Saving (data arrangement) | Poll/wait |
| `ReconciliationFailed` | Save failed | Investigate |
| `PriceCalculationFailed` | Pricing failed | Check pricing setup |
| `TaxCalculationFailed` | Tax failed | Check tax provider |
| `TaxCalculationWaiting` | Tax request sent, awaiting response | Wait |
| `OrderRequestFailed` | Changes not saved | Retry or investigate |
| `OrderRequestPartiallySaved` | Partial save | Handle partial state |
| `SaveFailedOrIncomplete` | Save incomplete | Retry |
| `GroupRampConfigurationFailed` (v65+) | Ramp checks failed | Fix ramp configuration |

---

## 16. Partner Pricing

Both Order Item and Quote Line Item have partner pricing fields:
- `PartnerDiscountPercent` — discount given to the partner
- `PartnerUnitPrice` — unit price after applying partner discount

These are manual fields set by sales reps and passed through the pricing waterfall.

---

## 17. Overall Discount Distribution (Order/Quote Level)

Available API v65+. Allows distributing a total-level discount to line items.

**On Order:**
- Set `Order.TotalAmountOverride` to the desired total
- Set `Order.AdjustmentDistributionLogic` to `Equal` or `Proportionate`
- TM calculates discount = TotalAmount - TotalAmountOverride, distributes per logic
- `Order.AppliedDiscountAmount` — the distributed amount; `AppliedDiscount` — the percentage

**On Quote:**
- Set `Quote.TotalPriceOverride` to the desired total
- Set `Quote.AdjustmentDistributionLogic`
- TM distributes TotalPrice - TotalPriceOverride

**Distribution logic:**
- `Equal` — same discount amount to all line items with prices
- `Proportionate` — discount proportional to `ListPriceTotal` of each line item

---

## 18. Margin Tracking

Available at all levels (line item, group, order) in API v65+.

- `Margin` (percent) — manually set by sales rep
- `MarginAmount` (currency) — manually set
- `TotalCost` — calculated from Quantity x UnitCost
- `TotalMargin` = (Net Total Price - Total Cost) / Net Total Price
- `TotalMarginAmount` = Net Total Price - Total Cost

---

## 19. Tax Integration

- `QuoteItemTaxItem` — tax line items on quote lines; supports `Actual` and `Estimated` types
- `Quote.TotalTaxAmount` — aggregate tax; requires "Add Estimated Tax to Quotes and Orders" setting enabled
- `Quote.TotalPriceWithTax` = TotalPrice + TotalTaxAmount (API v64+)
- `TransactionProcessingType.TaxPreference = Skip` — bypass tax calculation in bulk/import scenarios

---

## 20. Important Notes and Gotchas

1. **Never use direct DML on QuoteLineItem/OrderItem** to modify RC-managed transactions. Always use Place Quote API or Place Sales Transaction API. Direct DML sets `ValidationResult = TransactionIncomplete`.

2. **QuoteAction defaults to Add type.** If no QuoteAction record exists for a quote, RC treats it as a new sale (`Add`). The resulting order gets `OrderAction.Type = Add` automatically.

3. **Asset must have `HasLifecycleManagement = true`** for amendment/cancel/renew flows to work. Assets without this flag are not managed by RC lifecycle.

4. **`TransactionProcessingType.PricingPreference = Skip`** is critical for bulk import scenarios — prevents unnecessary repricing calls on every line. Use `Force` when you need to guarantee repricing regardless of change detection.

5. **`RatingPreference = Fetch` must be explicitly set** on TransactionProcessingType to save catalog rates for usage resources. Without it, catalog rates are not saved by default when adding quote line items.

6. **`OriginalLineNumber`** on AssetActionSource (and in the AssetAction graph) is the key field for correlating amendment/renewal/cancellation lines back to the original transaction line. Always populate this in custom integration flows.

7. **`QuoteLineItemAttribute` / `OrderItemAttribute` / `AssetStatePeriodAttribute`** are virtual objects. They do NOT support custom fields, validation rules, or triggers. SOQL filtering: can use `Id` and `AttributeDefinition`; cannot use `AttributeValue` in WHERE clause for Picklist, Checkbox, Currency, Date, Datetime, Multipicklist, Number, or Percent datatypes.

8. **`ValidationResult = MissingContributor`** means a derived product is in the quote/order but its pricing source product is absent. The derived product's price depends on its contributor, so pricing is stale.

9. **Segment type `Trial` / `Prorated`** on ramp deals requires API v67+. Earlier versions only have `Custom` and `Yearly`.

10. **`IsRamped` on group objects** (QuoteLineGroup / OrderItemGroup) triggers automatic propagation of StartDate/EndDate to all line items in the group. Be careful when manually setting dates on individual lines within a ramped group — TM will override them.

11. **`TransactionProcessingType`** is a Tooling API object, not a regular SObject. Create it via `POST /services/data/v67.0/tooling/sobjects/TransactionProcessingType`, not via standard DML.

12. **Order.OriginalActionType** and **Quote.OriginalActionType** tell you the intent of the transaction: `Amend`, `Cancel`, `Renew`, `Transfer`. Use these to drive conditional logic in triggers/flows rather than inspecting QuoteAction records.

13. **Quote.ValidationResult** acts as a staleness flag visible to developers — when it has a non-null value, do not trust the quote's pricing. Re-run Place Quote to clear it.

14. **QuoteLineGroup.Type = `RampScheduleGroup`** identifies a group as a ramp schedule container. Default is `CPQQuoteGroup`. The `AssetDowngrade`, `AssetSwap`, `AssetUpgrade` types mark groups involved in lifecycle transactions.

15. **`AdjustmentDistributionLogic = Proportionate`** distributes based on `ListPriceTotal` values, not on `NetTotalPrice`. This means highly discounted lines receive a smaller share of the overall discount. Use `Equal` when you want even distribution regardless of list price.

16. **`Order.CalculationStatus`** is the async polling field. Poll this after calling Place Order or activating an order. `CompletedWithTax` is the terminal success state. `ReconciliationFailed`, `PriceCalculationFailed`, `ConfigurationFailed`, etc. are error states requiring investigation.

17. **QuoteLineGroup and OrderItemGroup are parallel structures.** QuoteLineGroup has `SortOrder` and `SummarySubtotal`. OrderItemGroup has `SummaryTotalAmount`. Both support nested groups via `ParentQuoteLineGroupId` / `ParentOrderItemGroupId`.
