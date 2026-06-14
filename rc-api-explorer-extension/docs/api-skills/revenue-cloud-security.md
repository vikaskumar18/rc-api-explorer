---
name: revenue-cloud-security
description: Revenue Cloud Security & Permissions Guide — Revenue Cloud Developer Guide PDF (2026-06-13)
metadata:
  type: reference
---

# Revenue Cloud Security & Permissions Guide

## Source
PDF: revenue_lifecycle_management_dev_lates.pdf (2917 pages)
Version: 67.0, Summer '26 (Last updated June 5, 2026)
Pages scanned: 1-60
Scanned: 2026-06-13

---

## Edition & Availability Constraints

- Revenue Cloud is available in: **Lightning Experience only**
- Available in: **Enterprise**, **Unlimited**, and **Developer** Editions
- NOT available in Professional Edition or Classic
- The `RevenueManagementSettings` metadata type requires **API version 60.0 and later**
- `enableCoreCPQ` field must be `true` to enable read/write access to Revenue Cloud features and objects

---

## RevenueManagementSettings — The Master Security Toggle

File location: `settings/revenagement.settings` (`.settings` files are unique — one per component)

Package manifest reference:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>RevenueManagement</members>
        <name>Settings</name>
    </types>
    <version>67.0</version>
</Package>
```

### Critical Setting: enableCoreCPQ

| Field | Type | Default | API Version | Effect |
|-------|------|---------|-------------|--------|
| `enableCoreCPQ` | boolean | false | 60.0+ | Enables read/write access to ALL Revenue Cloud features and objects. This is the master toggle. |

**Without `enableCoreCPQ=true`, Revenue Cloud objects are inaccessible regardless of permission sets.**

### Full RevenueManagementSettings Field Reference

| Field | Type | Default | API Version | Notes |
|-------|------|---------|-------------|-------|
| `enableCoreCPQ` | boolean | — | 60.0+ | Master RC toggle; enables object read/write |
| `enableAdvancedDetailLinePricing` | boolean | false | 65.0+ | Advanced pricing for quote/order detail line items |
| `enableAdvCreateOrdersFromQuote` | boolean | — | 65.0+ | Multiple orders from single quote |
| `enableAsIsRenewals` | boolean | false | 64.0+ | As-is renewals for existing assets |
| `enableAutoAddDerivedAsset` | boolean | — | 62.0+ | Auto-add derived-price assets to quote/order |
| `enableDeltaPricing` | boolean | false | 63.0+ | Delta-only repricing (faster) |
| `enableGroupRamp` | boolean | — | — | Reserved for internal use |
| `enableGroupRampPref` | boolean | false | 65.0+ | Group ramp deals; requires `groupsEnabled=true` AND `enableTransactionCloning=true` first |
| `enableRampDeal` | boolean | — | 62.0+ | Ramp deals for individual line items |
| `enableRevUnifiedSetup` | boolean | — | — | Procedure plan for price calculation; required before `skipOrgSttPricing` |
| `enableTransactionCloning` | boolean | — | 64.0+ | Clone quotes/orders with line items and groups |
| `enableTransactionProcessor` | boolean | — | 63.0+ | Transaction types for quotes/orders; CANNOT be turned off once enabled |
| `groupsEnabled` | boolean | — | 62.0+ | Group line items in quotes/orders |
| `hidePriceRefreshNtfcn` | boolean | false | 65.0+ | Hide stale-price notification; WARNING: can cause incorrect pricing |
| `relaxUniqueCipValidation` | boolean | — | 64.0+ | Allow custom contract item price extensions (ignores record validations) |
| `skipOrgSttPricing` | boolean | — | — | Skip default pricing procedure for quote/order type; requires `enableRevUnifiedSetup=true` |

**Critical warning**: `enableTransactionProcessor` cannot be turned off after activation. Once set to `true`, you must maintain a default transaction type permanently.

---

## Permission Sets — Complete Reference by Feature Domain

All permission sets are assigned via: **Setup > Users > Permission Sets**

### Product Catalog Management (PCM) Permission Sets

| Permission Set Label | Notes |
|---------------------|-------|
| Product Catalog Management Customer Community User | For community/portal users |
| Product Catalog Management Partner Community User | For partner portal users |
| Product Catalog Management Cache | For catalog caching feature |
| Product Discovery Admin | Admin-level product discovery access |
| Product Discovery User | Standard product discovery access |
| ProductImport API | For product import via API |
| DecimalQuantityDesigntime | Design-time decimal quantity support |
| DecimalQuantityRuntime | Runtime decimal quantity support |
| Advanced CSV Data Import | Includes Data Processing Engine (DPE); Data Cloud must be licensed separately |
| Basic CSV Data Import | Basic CSV import capability |
| Context Service Admin | Admin access to Context Service |
| Context Service Runtime | Runtime access to Context Service |
| Fulfillment Designer | Design fulfillment flows |
| Omnistudio Admin | OmniStudio administration |
| Omnistudio User | OmniStudio runtime access |

### Salesforce Pricing Permission Sets

| Permission Set Label | Notes |
|---------------------|-------|
| Salesforce Pricing Admin | Full admin access to pricing configuration |
| Salesforce Pricing Design Time User | Design-time pricing setup |
| Salesforce Pricing Manager | Pricing management |
| Salesforce Pricing Run Time User | Runtime pricing execution |

### Product Configurator Permission Sets

| Permission Set Label | Prerequisite / Notes |
|---------------------|---------------------|
| Product Configurator | Base configurator access |
| Product Configuration Rules Designer | Prerequisite for Business Rules Engine Configurator |
| Product Configuration Constraints Designer | Prerequisite for Constraint Builder |

### Dynamic Revenue Orchestrator (DRO) Permission Sets

| Permission Set Label | Notes |
|---------------------|-------|
| DRO Admin User | Full DRO administration |
| Submit Transactions and Fulfillment User | Submit transactions and fulfill |
| Fulfillment Designer | Design fulfillment plans |
| Fulfillment Manager/Operator | Manage and operate fulfillment |

### DRO User Permission

| User Permission | Effect |
|----------------|--------|
| Submit Transactions and Orchestrate User | Enables user to submit and orchestrate transactions for any object using Dynamic Revenue Orchestrator |

### Usage Management / Rate Management Permission Sets

| Permission Set Label | Domain | Notes |
|---------------------|--------|-------|
| Rate Management: Admin | Rate Management | Full admin |
| Rate Management: Design Time User | Rate Management | Design-time configuration |
| Rate Management: Manager | Rate Management | Management access |
| Rate Management Run Time User | Rate Management | Runtime execution |

### Billing Permission Sets

| Permission Set Label | Notes |
|---------------------|-------|
| Billing Admin | Full billing administration |
| BillingAdvancedPaymentAdministrator | Advanced payment administration |
| RevenueLifecycleManagementBillingCustomerService | Customer service billing operations |
| BillingAdvancedPaymentOperations | Advanced payment operations |
| RevenueLifecycleManagementBillingCreditMemoOperations | Credit memo operations |
| Context Service Admin | Required for billing context |
| Data Pipeline User | For analytics/data pipeline |
| Tableau Next Admin | For Analytics Dashboard enabling |
| Data Cloud Admin | For Analytics Dashboard enabling |

---

## Metadata Setup Paths — Security-Relevant Configuration

### Core Revenue Cloud Enable

| Setup Path | What It Does |
|-----------|-------------|
| Setup > Revenue Cloud > Revenue Settings | Enable RevenueManagement, IncludeEstTaxInQuoteCPQ, LargeQuotesAndOrdersForRlm, User UI Preference |
| Setup > Feature Settings > Revenue Cloud > Revenue Settings | Configure Products at Runtime, Business Rules Engine, Constraints Engine, Transaction Processing |

### Context Service (Cross-Feature Prerequisite)

Context Service is a **prerequisite** for:
- Salesforce Pricing (must be enabled before Salesforce Pricing settings)
- Product Configurator
- Usage Management
- Billing
- Dynamic Revenue Orchestrator (Context Definition Settings)

Setup path: **Context Service > Context Service Settings** (Enable)

### Salesforce Pricing Setup Security

| Setup Path | Action |
|-----------|--------|
| Setup > Salesforce Pricing > Salesforce Pricing Settings | Enable Salesforce Pricing |
| Setup > Salesforce Pricing > Pricing Recipes | Configure pricing recipes |
| Setup > Salesforce Pricing > Salesforce Pricing Setup | Configure procedure plan, pricing recipe, sync pricing data |

**Important**: For Procedure Plan Definitions using Apex, the Apex class must be migrated separately. Packaging is not supported in Winter '26.

### Dynamic Revenue Orchestrator — Fulfillment User Field

The DRO settings require configuring a **Fulfillment User** field:
- Setup path: Setup > Feature Settings > Dynamic Revenue Orchestrator > Dynamic Revenue Orchestrator Settings
- This user context runs fulfillment operations

DRO Context Definition paths (all under Setup > Feature Settings > Dynamic Revenue Orchestrator > Context Definition Settings):
- Sales Transaction Context Definition: Header, Item, Item Relationship, Item Attribute nodes
- Fulfillment Asset Context Definition: Asset, Asset Attribute nodes
- Orchestration Group Key (optional)

### Billing Security Setup

| Setup Path | Notes |
|-----------|-------|
| Setup > Feature Settings > Billing > Billing Settings | Enable Billing, Document Generation, Transaction Journals, Payment Schedules |
| Setup > Feature Settings > Billing > Billing Settings | Share Payment Accounts, Credit/Payment Application Level |
| Setup > Feature Settings > Analytics > Data Pipeline | Required for billing analytics |

Billing deployment sequence requires Profile and User deployment FIRST (sequence 1 and 2 in Billing Objects table).

---

## Object Deployment Security Sequence — Billing (Critical)

The Billing Objects deployment table shows security-relevant objects must be deployed in this order:

| Seq | Object Name | Object API | Security Relevance |
|-----|-------------|-----------|-------------------|
| 1 | Profile | Profile | User profiles must exist first |
| 2 | User | User | Users must exist before billing config |
| 3 | User Role | UserRole | Role hierarchy for sharing |
| 4 | Legal Entity | LegalEntity | Billing entity boundary |
| 5 | Billing Policy | BillingPolicy | Controls billing behavior |
| 6 | Billing Treatment | BillingTreatment | Lookup: LegalEntity, BillingPolicy |
| 7 | Billing Treatment Item | BillingTreatmentItem | Lookup: BillingTreatment |
| 8 | Tax Engine Provider | TaxEngineProvider | Lookup: ApexAdapter |
| 9 | Tax Engine | TaxEngine | Lookup: NamedCredential, TaxEngineProvider |
| 10 | Tax Policy | TaxPolicy | |
| 11 | Tax Treatment | TaxTreatment | Lookup: TaxEngine, TaxPolicy |

**Key security observation**: Tax Engine uses a **Named Credential** as a foreign key. Named credentials must be pre-configured before Tax Engine records can be deployed.

---

## Named Credentials in Revenue Cloud

Named credentials appear as lookup fields in:
- **TaxEngine** (Object API: `TaxEngine`) — lookup field to `Named Credential` and `Tax Engine Provider`
- Tax Engine deployment sequence: 9 (after TaxEngineProvider at 8)

To configure Tax Engine integrations:
1. Create Named Credential in Setup > Security > Named Credentials
2. Deploy TaxEngineProvider record (references ApexAdapter)
3. Deploy TaxEngine record (references Named Credential + TaxEngineProvider)
4. Deploy TaxTreatment (references TaxEngine + TaxPolicy)

---

## Product Catalog Management — Object Security (Full Deployment Sequence)

All PCM objects use User, User Group as common lookup fields for access control.

| Seq | Object API Name | Key Lookup/Security Fields |
|-----|----------------|---------------------------|
| 1 | ProductSpecificationType | User |
| 2 | ProductSpecification Record Type | Product Specification Type |
| 3 | AttributePicklist | User, User Group, Unit of Measure |
| 4 | AttributePicklistValue | User, Attribute Picklist (Master-Detail) |
| 5 | UnitOfMeasureClass | User, Unit of Measure |
| 6 | UnitOfMeasure | User Group, Unit of Measure Class |
| 7 | AttributeDefinition | User, Attribute Picklist, Unit of Measure |
| 8 | AttributeCategory | User Group |
| 9 | AttributeCategoryAttribute | User Group, Attribute Category, Attribute Definition |
| 10 | ProductClassification | User, User Group, Product Classification |
| 11 | ProductClassificationAttr | Attribute Definition, User, User Group, Unit of Measure |
| 12 | TaxPolicy | User, Tax Treatment |
| 13 | Product2 | Product Classification, Billing Policy, User, External Data Source, Tax Policy, Unit of Measure |
| 14 | TaxEngine | Named Credential, Tax Engine Provider |
| 15 | TaxTreatment | Legal Entity, Product, Tax Policy, Tax Engine |
| 16 | ProductAttributeDefinition | Attribute Definition, Attribute Category, User, Product Classification Attribute, Unit of Measure |
| 17 | AttrPicklistExcludedValue | Product Classification Attribute, Product Attribute Definition (polymorphic), Attribute Picklist Value |
| 18 | ProdtAttrScope | User, User Group |
| 19 | ProdtAttrMappedScope | Product Classification Attribute, Product Attribute Definition (polymorphic) |
| 20 | ProductSellingModel | User |
| 21 | ProductSellingModelOption | User, Product Selling Model, Proration Policy |
| 22 | ProductRampSegment | User, Product Selling Model, Product |
| 23 | ProductRelationshipType | User |
| 24 | ProductComponentGroup | User, User Group, Product Component Group |
| 25 | ProductRelatedComponent | User, Product, Product Classification, Product Selling Model, Product Component Group, Product Relationship Type, Unit of Measure |
| 26 | ProductComponentGrpOverride | User, User Group, Product, Product Component Group |
| 27 | ProductRelComponentOverride | UserGroup, Product, Product Related Component, Unit of Measure |
| 28 | ProductCatalog | User, User Group |
| 29 | ProductCategory | User, Catalog (Master-Detail) |
| 30 | ProductCategoryProduct | Product, Category (Master-Detail) |
| 31 | ProductQualification | User, User Group, Product |
| 32 | ProductDisqualification | User, User Group, Product |
| 33 | ProductCategoryQualification | User, User Group, Category |
| 34 | ProductCategoryDisqual | User, User Group, Category |
| 37 | AssessmentQuestion | Assessment Question Version, User, User Group |
| 38 | AssessmentQuestionVersion | Assessment Question (Master-Detail) |
| 39 | Assessment | Account, Contact, User, User Group, Omni Process, Assessment |
| 40 | AssessmentQuestionResponse | Assessment Question Version, Assessment (Master-Detail), User, User Group |
| 41 | OmniProcess | User, User Group |
| 42 | OmniProcessElement | Omni Process (Master-Detail), Omni Process Element |
| 44 | AssessmentQuestionSet | User, User Group |
| 45 | AssessmentQuestionAssignment | Assessment Question Set, User, User Group |

**Translation tables** (sequences 46-53) mirror their parent objects' security model.

**Internal objects** (sequences 35, 36): `RuntimeCatalogIndexSetting`, `WebStoreSearchAttrSettings` — not accessible externally.

---

## Salesforce Pricing Objects — Security Sequence

| Seq | Object API | Key Lookup/Security Fields |
|-----|-----------|---------------------------|
| 1 | ProductSellingModel | (no security lookups) |
| 2 | ProductSellingModelOption | ProductSellingModel (Master-Detail), Product2 (Foreign key), ProrationPolicy (Foreign key) |
| 3 | Pricebook2 | Pricebook2 (Foreign Key) |
| 4 | CostBook | (none) |
| 5 | PriceBookEntry | Pricebook2, Product2, ProductSellingModel (all Foreign Keys) |
| 6 | CostBookEntry | CostBook (Master-Detail), Product (Foreign Key) |
| 7 | PriceAdjustmentSchedule | Pricebook2 (Foreign Key), Contract (Foreign Key) |
| 8 | PriceAdjustmentTier | PriceAdjustmentSchedule (Master-Detail), ProductSellingModel, Product2 |
| 9 | PriceBookEntryDerivedPrice | Product2, PricebookEntry, Pricebook2, ProductSellingModel |
| 10 | BundleBasedAdjustment | PriceAdjustmentSchedule (Master-Detail), Product2, ProductSellingModel |
| 11 | AttributeBasedAdjRule | (none — standalone) |
| 12 | AttributeAdjustmentCondition | AttributeBasedAdjRule (Master-Detail), AttributeDefinition, Product2 |
| 13 | AttributeBasedAdjustment | PriceAdjustmentSchedule (Master-Detail), ProductSellingModel, AttributeBasedAdjRule, Product2 |
| 30 | IndexRate | (extended from Financial Services Cloud) |
| 40 | PricingProcedureResolution | ExpressionSet (Foreign Key) |
| 50 | PricingRecipe | ExpressionSetDefinition (Foreign Key) |
| 50 | ProrationPolicy | (none) |
| 90 | ProductPriceRange | Pricebook2 (Foreign Key) |

**Internal pricing objects** (not accessible externally): PriceBookPriceGuidance, PricingRecipeTableMapping, ProductPriceHistoryLog, PricingAdjBatchJob, PricingAdjBatchJobLog, ProcedurePlanDefinition, ProcedurePlanDefinitionVersion, ProcedurePlanCriterion, ProcedurePlanOption, ProcedurePlanVariable, ProcedurePlanSection.

---

## Product Configurator — Security Setup

### Required Custom Fields (Constraint Builder prerequisite)

Three custom fields must be created before using Constraint Builder:

| Field | Type | Object | Prerequisite For |
|-------|------|--------|-----------------|
| `ConstraintEngineNodeStatus` | Text Area (Long), length 5000 | Quote Line Item | Constraint Builder |
| `ConstraintEngineNodeStatus` | Text Area (Long), length 5000 | Order Product | Constraint Builder |
| `ConstraintEngineNodeStatus` | Text Area (Long), length 5000 | Asset Action Source | Constraint Builder |

After creating these fields, map all three via Context Mapping:
- Path: Setup > Feature Settings > Context Definitions > [Context]
- Map with the `ConstraintEngineNodeStatus` tag

### Configurator Setup Paths

| Setup | Path | Notes |
|-------|------|-------|
| Configure Products at Runtime | Setup > Feature Settings > Revenue Cloud > Revenue Settings | |
| Business Rules Engine | Setup > Feature Settings > Revenue Cloud > Revenue Settings | Prerequisite: Create Rule Library Version |
| Constraints Engine | Setup > Feature Settings > Revenue Cloud > Revenue Settings | |
| Asset Context for Product Configurator | Setup > Feature Settings > Revenue Cloud > Revenue Settings | |
| Transaction processing for quotes/orders | Setup > Feature Settings > Revenue Cloud > Revenue Settings | If BOTH Business Rules Engine AND Constraint Builder enabled — exception: Transaction Processing Type overrides |

### Configurator Permission Sets

| Permission Set | Prerequisite For |
|---------------|-----------------|
| Product Configurator | Base configurator |
| Product Configuration Rules Designer | Business Rules Engine Configurator |
| Product Configuration Constraints Designer | Constraint Builder |

---

## Transaction Management — Security Metadata

### Setup Configuration

| Label | Setup Path |
|-------|-----------|
| App Usage Type | (metadata only) |
| Transaction Processing Type | (metadata only) |
| RevenueManagement | Setup > Revenue Cloud > Revenue Settings |
| IncludeEstTaxInQuoteCPQ | Setup > Revenue Cloud > Revenue Settings |
| Quote | Setup > Feature Settings > Sales > Quotes > Quote Settings |
| Order | Setup > Feature Settings > Sales > Order Settings |
| LargeQuotesAndOrdersForRlm | Setup > Revenue Cloud > Revenue Settings |
| User UI Preference | (metadata only) |

### Transaction Management Objects — Deployment Sequence

| Seq | Object API | Security Notes |
|-----|-----------|---------------|
| 1 | AppUsageAssignment | Lookup: Order, Quote, Contract, Asset |
| 1 | SalesTransactionType | Lookup: PricingProcedure |
| 1 | QuoteTemplateRichTextData | Lookup: None |
| 1 | TransactionProcessingType | Lookup: None |

---

## Dynamic Revenue Orchestrator — Security Configuration

### Key Security Fields

| Field Type | Label | Setup Path |
|-----------|-------|-----------|
| Field | Fulfillment User | Setup > Feature Settings > DRO > DRO Settings |
| Flag | Dynamic Revenue Orchestrator (enable) | Setup > Feature Settings > DRO > DRO Settings |
| Flag | In-flight Amendments | Setup > Feature Settings > DRO > DRO Settings |
| Flag | Future Dated Steps | Setup > Feature Settings > DRO > DRO Settings |
| Flag | Link Task to Step Source | Setup > Feature Settings > DRO > DRO Settings |
| Flag | Fallout | Setup > Feature Settings > DRO > Fallout and SLA Settings |
| Flag | Service Level Agreement | Setup > Feature Settings > DRO > Fallout and SLA Settings |

### DRO Object Deployment Sequence

| Seq | Object API | Key Lookups |
|-----|-----------|------------|
| 1 | FulfillmentStepDefinitionGroup | None |
| 2 | FulfillmentStepDefinition | Ruleset, ExpressionSet, FulfillmentStepDefinitionGroup, IntegrationProviderDef, User, Queue |
| 3 | FulfillmentStepDependencyDef | FulfillmentStepDefinition |
| 4 | ProductFulfillmentScenario | FulfillmentStepDefinitionGroup, Ruleset, Product2, ProductClassification, FlowDefinition, StageDefinition, FlowRecord, FlowOrchestration |
| 5 | FulfillmentWorkspace | None |
| 6 | FulfillmentWorkspaceItem | FulfillmentWorkspace, FulfillmentStepDefinitionGroup |
| 7 | FulfillmentFalloutRule | IntegrationProviderDef, Group |
| 8 | FulfillmentStepJeopardyRule | IntegrationProviderDef |
| 9 | FulfillmentTaskAssignmentRule | Ruleset, ExpressionSet, User, Queue |
| 1 | ProductFulfillmentDecompRule | Ruleset, Product2, ProductClassification |
| 2 | ValTfrmGrp | None |
| 3 | ValTfrm | ValTfrmGrp, AttributePicklistValue |
| 4 | ProductDecompEnrichmentRule | ProductFulfillmentDecompRule, ExpressionSet, AttributeDefinition, ValTfrmGrp, DecisionMatrixDefinition |
| 5 | ProdtDecompEnrchVarMap | ProductDecompEnrichmentRule, AttributeDefinition |

**Security note**: `FulfillmentFalloutRule` uses Group as a lookup — ensure public groups exist before deploying fallout rules. `FulfillmentTaskAssignmentRule` uses Queue as a lookup — queues must exist.

---

## Usage Management — Object Deployment Sequence

| Seq | Object API | Key Security Lookups |
|-----|-----------|---------------------|
| 1 | UsageResourceBillingPolicy | None |
| 2 | UsageGrantRolloverPolicy | None |
| 3 | UsageGrantRenewalPolicy | None |
| 4 | UsageOveragePolicy | None |
| 5 | UsageCommitmentPolicy | None |
| 6 | RateCard | None |
| 7 | UsageResource | UnitOfMeasure, UnitOfMeasureClass, Product2, UsageResourceBillingPolicy |
| 8 | PriceBookRateCard | PriceBook2, RateCard |
| 9 | RatingFrequencyPolicy | Product2, UsageResource |
| 10 | ProductUsageResource | Product2, UsageResource |
| 11 | RateCardEntry | RateCard, UnitOfMeasure, UnitOfMeasureClass, UsageResource, Product2, ProductSellingModel |
| 12 | UsageResourcePolicy | UsageResource, UsageOveragePolicy, RatingFrequencyPolicy, UsageResourceBillingPolicy, UsageCommitmentPolicy |
| 13 | ProductUsageGrant | ProductUsageResource, UnitOfMeasure, UnitOfMeasureClass, UsageGrantRolloverPolicy, UsageGrantRenewalPolicy, Product2, ProductSellingModel |
| 14 | ProductUsageResourcePolicy | ProductUsageResource, UsageOveragePolicy, RatingFrequencyPolicy, UsageResourceBillingPolicy, UsageCommitmentPolicy, ProductSellingModel |
| 15 | RateAdjustmentByTier | RateCardEntry |
| 16 | RateAdjustmentByAttribute | RateCardEntry, AttributeBasedAdjRule |

---

## Billing Objects — Full Security-Relevant Deployment Sequence

| Seq | Object API | Key Security Lookups |
|-----|-----------|---------------------|
| 1 | Profile | None |
| 2 | User | None |
| 3 | UserRole | None |
| 4 | LegalEntity | None |
| 5 | BillingPolicy | None |
| 6 | BillingTreatment | LegalEntity, BillingPolicy |
| 7 | BillingTreatmentItem | BillingTreatment |
| 8 | TaxEngineProvider | ApexAdapter |
| 9 | TaxEngine | **NamedCredential**, TaxEngineProvider |
| 10 | TaxPolicy | None |
| 11 | TaxTreatment | TaxEngine, TaxPolicy |
| 12 | TaxTreatmentItem | Product2 |
| 13 | PaymentTerm | None |
| 14 | PaymentTermItem | PaymentTerm |
| 15 | AccountingPeriod | None |
| 16 | LegalEntityAccountingPeriod | LegalEntity, AccountingPeriod |
| 17 | GeneralLedgerAccount | LegalEntity |
| 18 | GeneralLedgerAcctAsgntRule | LegalEntity, GeneralLedgerAccount |
| 19 | PaymentSchedulePolicy | None |
| 20 | PaymentScheduleTreatment | PaymentSchedulePolicy |
| 21 | PaymentScheduleTreatmentDtl | PaymentScheduleTreatment, PymtSchdDistributionMethod |
| 22 | PymtSchdDistributionMethod | None |
| 23 | BillingMilestonePlan | BillingTreatment |
| 24 | BillingMilestonePlanItem | BillingMilestonePlan |
| 25 | GeneralLedgerJrnlEntryRule | GeneralLedgerAccount, GeneralLedgerAcctAsgntRule |
| 26 | PaymentRetryRule | PaymentGateway |
| 27 | PaymentRetryRuleSet | None |
| 28 | BillingArrangement | None |
| 29 | BillingArrangementLine | Account, BillingAccount |

**Critical**: PaymentRetryRule has a lookup to **PaymentGateway** — payment gateway configuration must precede payment retry rules.

---

## Salesforce Contracts — Object Deployment Sequence

| Seq | Object API | Key Lookups |
|-----|-----------|------------|
| 1 | ClauseCatgConfiguration | None |
| 2 | DocumentClauseSet | ClauseCatgConfiguration |
| 3 | DocumentClause | DocumentClauseSet, ContentDocument |

---

## Industries Common Components — DPE Security Requirements

Data Processing Engine (DPE) has specific permission requirements:

| DPE Component | Permission Required |
|--------------|-------------------|
| datasources -> sourceName (creator) | Read permission on `BatchCalcJobDefinition` tooling object for the user creating the DPE |
| datasources -> sourceName (analytics) | Read permission on `BatchCalcJobDefinition` for Analytics Integration User |
| writebacks -> targetObjectName | Create/Update/Delete permission on targetObjectName based on `operationType` value |
| writebacks -> writebackUser | Delete this value if it exists (security cleanup) |

Tooling API path: `v()/tooling/sobjects/BatchCalcJobDefinition`

---

## Product Catalog Management — Feature Flags and Security

### OmniStudio Prerequisites

| Requirement | Details |
|------------|---------|
| Omnistudio Managed Package | Must be installed (Setup > Apps > Packaging > Installed Packages) |
| Managed Package Runtime | Disable (Setup > Feature Settings > Omni interaction > Omnistudio Settings) |
| Define Custom LWC in Standard Runtime | Enable (Setup > Feature Settings > Omni interaction > Omnistudio Settings) |

### Discovery Framework

| Type | Label | Setup Path | Details |
|------|-------|-----------|---------|
| Setup | Discovery Framework | Setup > Discovery Framework | Prerequisite: Enable guided product selection first |
| Flag | Discovery Framework | Setup > Discovery Framework > General Settings | Enable |
| Flag | Import & Export | Setup > Discovery Framework > General Settings | Enable |
| Flag | Sample Templates | Setup > Discovery Framework > General Settings | Click Discovery Framework Sample Template page link, then Deploy if not deployed |

### Product Discovery Flags

All at path: Setup > Product Discovery > Product Discovery Settings

- Product Field Search (Flag)
- Use Indexed Data for Product Listing and Search (Flag)
- Dynamic Product Facets (Flag)
- Semantic Search (Flag)
- Guided Product Selection (Flag)
- Generate Product Descriptions with Einstein AI (Flag)
- Product Catalog Management Cache (Flag)

---

## Decision Tables — Security-Relevant Definitions

Decision Tables must be deployed **before** Pricing Recipes (metadata). This is a hard dependency.

### PCM Decision Tables

| Decision Table Name | Defined At |
|--------------------|-----------|
| ProductQualificationDT | Setup > Decision Table |
| ProductDisqualificationQualificationDT | Setup > Decision Table |
| ProductCategoryQualificationDT | Setup > Decision Table |
| ProductCategoryDisqualificationQualificationDT | Setup > Decision Table |

### Pricing Decision Tables

| Decision Table Name | Notes |
|--------------------|-------|
| Asset Action Source Entries | |
| Asset Action Source Entries V2 | |
| Attribute Discount Entries | |
| Bundle Based Adjustment Entries | |
| Contract Pricing Adjustment Tiers | |
| Contract Pricing Entries | |
| Contract Pricing Volume Tiers | |
| Contract Pricing Volume Tiers V2 | |
| Derived Pricing Entries | |
| Index Rate | |
| Price Book Entries | |
| Price Book Entries V2 | |
| Pricebook Rate Card Entries | |
| Product Price Range Entries | |
| Product Price Range Entries V2 | |
| Tiered Adjustment Entries | |
| Volume Discount Entries | |

### Usage Management / Rate Management Decision Tables

| Decision Table Name |
|--------------------|
| Binding Object Rate Adjustment Resolution Entries |
| Binding Object Rate Card Entry Resolution Entries |
| Rate Card Entry Resolution Entries 2 |
| Rate Adjustment by Attribute Resolution Entries |
| Rate Adjustment by Tier Resolution Entries |
| Pricebook Rate Card Entries |
| Binding Object Volume-based Rate Adjustment |
| Binding Object Rate |
| Binding Object Tier-based Rate Adjustment |
| Binding Object Rate Card Entry |
| Asset Volume-based Rate Adjustment |
| Asset Rate |
| Asset Rate Card Entry |
| Asset Tier-based Rate Adjustment |
| Attribute-based Rate Adjustment by Rate Card Entry ID |
| Volume-based Rate Adjustment by Rate Card Entry ID |
| Tier-based Rate Adjustment by Rate Card Entry ID |
| Rate Adjustment by Attribute Entries 2 |
| Rate Adjustment by Tier Entries 2 |
| Rate Adjustment by Volume Entries 2 |
| Rate Card Entries 2 |

---

## GUID Field Setup — Security & DevOps Practice

All objects deployed across orgs should have a GUID (Global Unique ID) field for cross-environment record tracking.

### Steps to Create a GUID Field

1. Setup > Object Manager > select object
2. Click Fields & Relationships > New
3. Data type: **Text**
4. Enter label and field name
5. Length: **255** (recommended to avoid ID length errors)
6. Select **Unique** and **External ID** (CRITICAL — ensures every record gets a unique ID for upsert operations)
7. Set profile field access
8. Repeat for all RC objects in deployment plan

### GUID Field Requirements

Good GUID characteristics:
- Immutable
- Unique globally
- Non-translatable
- Single key
- Generated programmatically (not manually)

Poor GUID designs (avoid):
- Record Name field (mutable)
- Combination of mutable attributes (Name + Version + Sequence)
- Concatenated keys
- Conditional keys (Pricebook + Product OR Pricebook + Product + ISO Code)

### Non-Extensible Objects

Some Revenue Cloud objects are **protected and non-extensible** — you cannot add a GUID field to them. For these, create an external reference table to store the GUID and use it for tracking.

---

## Component State Management — Security Implications

RC components have Active/Inactive/Draft states that affect security and access:

### Deployment Security Rules

| State | Action Required |
|-------|----------------|
| Deploy a New Component | Deploy along with its versions from source to target org |
| Deploy Component Updates | Deactivate the version in target org first; if you try to deploy to an active version, the deployment FAILS |
| Deploy Components with Dependencies | All dependencies must move in the proper sequence |

### Objects with Active State Requirements

- Decision tables, expression sets, and context definitions must be deployed considering their state
- Some objects use an **Active checkbox** to determine runtime usage
- Qualification rules using decision tables/expression sets/context definitions: the definitions in the target org must be DEACTIVATED before deploying changes

### Post-Deployment Security Verification Steps

Required after every deployment:
1. Refresh decision tables
2. Sync pricing data
3. Rebuild the product index
4. Manually create elements that cannot be deployed through API
5. Create or activate user accounts for testing and validation

---

## Flows — Security-Relevant Flows by Domain

### Product Catalog Management Flows
- **Discover Products** (Setup > Flow) — supports Flow version, activation, and deactivation
- **ProductGuidedSelectionIntegration** (OmniScript via All Apps > Omnistudio)

### Product Configurator Flows
- **Default Product Configurator Flow** (Setup > Flow) — supports version, activation, deactivation; other flows can be created

### Usage Management Flows
- Call Rating Service
- Call Entitlement Refresh Service
- Create Summary
- Generate Liable Summary
- Generate Usage Rateable Summary
- Generate Usage Summary
- Orchestrate Usage Management

### Billing Flows
- Default Credit Memo Flow (Setup > Feature Settings > Billing > Billing Settings)
- Default Invoice Template setup required

---

## Key Security Dependencies and Deployment Rules

### Dependency Chains That Affect Security

1. **Product Specification Record Type** must be deployed before any Product records
2. **Attribute Based Adjustment Rule** must be deployed before Attribute Based Adjustment records
3. **Decision Tables** (metadata records) must be deployed before **Pricing Recipes** (metadata records)
4. **Parent record** must exist before child record in any master-detail relationship
5. **Context Service** must be enabled before: Salesforce Pricing, Product Configurator, Usage Management, Billing, DRO
6. **enableCoreCPQ=true** must be set before any RC object is accessible

### Circular Dependency Handling

When circular dependencies exist (Object A depends on B, B depends on A):
1. Deploy A first
2. Deploy B
3. Redeploy A to populate the circular reference

---

## Important Notes & Gotchas

### Version Constraints
- `RevenueManagementSettings` requires API version 60.0+
- `enableAdvancedDetailLinePricing` requires API version 65.0+
- `enableAdvCreateOrdersFromQuote` requires API version 65.0+
- `enableAsIsRenewals` requires API version 64.0+
- `enableAutoAddDerivedAsset` requires API version 62.0+
- `enableDeltaPricing` requires API version 63.0+
- `enableGroupRampPref` requires API version 65.0+ and also requires `groupsEnabled=true` AND `enableTransactionCloning=true`
- `enableRampDeal` requires API version 62.0+
- `enableTransactionCloning` requires API version 64.0+
- `enableTransactionProcessor` requires API version 63.0+; IRREVERSIBLE once enabled

### One-Way Security Flags (Cannot Be Undone)
- `enableTransactionProcessor`: Once set to true, cannot be turned off. Must permanently maintain a default transaction type.

### Hidden Security Risk: hidePriceRefreshNtfcn
- Setting `hidePriceRefreshNtfcn=true` hides the notification when quote/order prices are outdated
- Default is `false`
- WARNING from docs: "Hiding this notification may affect saving quotes and creating orders because you could be using outdated prices"

### relaxUniqueCipValidation Risk
- Setting `relaxUniqueCipValidation=true` ignores record validations for contract item prices
- Use only when fully customizable extensions to contract item prices are needed

### Wildcard in package.xml
- The wildcard `*` in package.xml does NOT apply to metadata settings types like `RevenueManagementSettings`
- Wildcard applies only when retrieving ALL settings, not for an individual setting

### Internal Objects Are Not Accessible
- Objects marked "(Internal)" in the deployment tables are NOT accessible via standard API
- Examples: RuntimeCatalogIndexSetting, WebStoreSearchAttrSettings, PriceBookPriceGuidance, PricingRecipeTableMapping, ProductPriceHistoryLog, PricingAdjBatchJob, PricingAdjBatchJobLog, ProcedurePlanDefinition (and variants), ProcedurePlanCriterion, ProcedurePlanOption, ProcedurePlanVariable, ProcedurePlanSection

### Procedure Plan Packaging Limitation (Winter '26)
- If Apex is selected in Procedure Plan Definitions, the Apex class must be migrated separately
- Packaging is NOT supported in Winter '26 for Apex-based Procedure Plans

### Advanced CSV Data Import Permission Set
- Includes Data Processing Engine (DPE)
- Data Cloud is licensed and deployed separately (not included in base RC license)

### Billing Deployment Always Starts with Profile/User/Role
- Billing Objects deployment sequence starts with Profile (1), User (2), UserRole (3)
- Never attempt to deploy billing configuration objects before user security objects exist

### Product Discovery Indexing Security
- Full Index Rebuild required when enabling indexed product feature for the first time or changing index settings
- If indexing is enabled in source but NOT in target, the Full Indexing must be run on the target org before enabling the feature flag
- Partial Index Rebuild updates recent changes to products and categories

### Product Data Must Be Active
- All product data (product, class, product attributes, attributes, picklist, catalog, categories) must be active to appear in sales channels
- Exception for qualification rules: definitions in target org must be DEACTIVATED before deploying updates
- Migrating price book entries requires Decision Table refresh for Product Discovery to show list price
- Migrating qualification rules requires refreshing Qualification Rules Decision Table definitions

### DPE writebackUser
- The `writebackUser` field in DPE writebacks definition should be DELETED if it exists (security cleanup step per documentation)
