---
name: revenue-cloud-apex-development
description: Revenue Cloud Apex Development Guide — Revenue Cloud Developer Guide PDF (2026-06-13)
metadata:
  type: reference
---
# Revenue Cloud Apex Development Guide

## Source
PDF: revenue_lifecycle_management_dev_lates.pdf (2917 pages)
Pages scanned: 127-180, 526-570, 855-900, 1069-1150, 2489-2540
Scanned: 2026-06-13

---

## Key Namespaces

| Namespace | Purpose |
|---|---|
| `runtime_industries_cpq` | Product Discovery / CPQ — product catalog, qualification, config rules, bulk product details |
| `RevSignaling` | Salesforce Pricing extension points — pricing procedure Apex hooks |
| `ConnectApi` | Connect API classes for CPQ/pricing output representations |
| `InvoiceWriteOff` | Billing — invoice write-off invocable actions |

---

## Product Catalog Management (PCM) — Standard Objects

### Core PCM Objects (pages 127-165)

| Object | Purpose |
|---|---|
| `Product2` | Product record |
| `ProductCatalog` | Top-level catalog container |
| `ProductCategory` | Hierarchical category within a catalog |
| `ProductComponentGroup` | Groups of components within a bundle |
| `ProductRelatedComponent` | Junction between product and component |
| `ProductRelationshipType` | Defines component relationship types |
| `ProductSellingModelOption` | Links product to a Product Selling Model |
| `AttributeDefinition` | Defines product attributes |

### Enterprise Product Catalog (EPC)
EPC is an alternative catalog system activated with `catalogSystems: ["epc"]` (v66.0+). It enables advanced multi-catalog configurations.

---

## runtime_industries_cpq Apex Namespace

### AdditionalContextData
Used to pass custom context data into CPQ operations. Maximum 10 nodes.

```apex
public List<runtime_industries_cpq.ContextDataInput> additionalContextData {get; set;}
```

### ContextDataInput
```apex
public Map<String,ANY> nodeData {get; set;}
public String nodeName {get; set;}
```

### ApiStatusRepresentation
```apex
public List<ConnectApi.CpqMessageOutputRepresentation> messages {get; set;}
public String statusCode {get; set;}
public String statusMessage {get; set;}
```

### BulkProductDetailsRepresentation (key properties)
```apex
public Boolean isQuantityEditable {get; set;}
public Boolean isSoldOnlyWithOtherProds {get; set;}
public String name {get; set;}
public String nodeType {get; set;}
public List<runtime_industries_cpq.ProductPricesOutputRepresentation> prices {get; set;}
public runtime_industries_cpq.ProductClassificationOutputRepresentation productClassification {get; set;}
public String productCode {get; set;}
public List<runtime_industries_cpq.ProductComponentGroupRepresentation> productComponentGroups {get; set;}
public String productType {get; set;}
public runtime_industries_cpq.QualificationContextOutputRepresentation qualificationContext {get; set;}
public String status {get; set;}
public runtime_industries_cpq.UnitOfMeasureOutputRepresentation unitOfMeasure {get; set;}
```

### ConfigRuleResult
```apex
public ConfigRuleResult(
    String transactionContextId,
    List<runtime_industries_cpq.MessageRule> messageRules,
    List<runtime_industries_cpq.ProductRecommendationRule> productRecommendationRules,
    List<runtime_industries_cpq.VisibilityRule> visibilityRules,
    List<String> errors
)
```

### FilterCriteriaInputRepresentation
Used for filtering products in catalog queries.

```apex
// attributeType valid values:
//   ProductStandard, ProductCustom, ProductDynamicAttribute,
//   ProductAttributeStandard, ProductAttributeCustom
public String attributeType {get; set;}

// operator valid values:
//   eq, in, contains, gt, lt, gte, lte
//   (gt/lt/gte/lte only for Number/Date/Datetime, from v63.0)
public String operator {get; set;}
public String property {get; set;}
public String value {get; set;}
```

---

## RevSignaling Namespace — Pricing Extension Points

### THE Pricing Apex Hook: RevSignaling.SignalingApexProcessor

This is the interface you implement to inject custom Apex logic into a Salesforce Pricing Procedure step. It is the RC equivalent of "IPricingProcedureStep."

```apex
public interface RevSignaling.SignalingApexProcessor {
    public RevSignaling.TransactionResponse execute(RevSignaling.TransactionRequest var1);
}
```

### Full Implementation Example

```apex
public class SignalingApexProcessorImpl implements RevSignaling.SignalingApexProcessor {
    public RevSignaling.TransactionResponse execute(RevSignaling.TransactionRequest request) {
        System.debug('Executing SampleValidClass...');
        System.debug('Procedure Plan: ' + request.procedurePlanInstance);
        System.debug('Context Instance: ' + request.ctxInstanceId);

        // Access previous step output (data passed from prior pricing step)
        Map<String,Object> prevOutput = request.procedurePlanInstance.prevStepOutput;

        // Add your custom logic here...

        RevSignaling.TransactionResponse response = new RevSignaling.TransactionResponse();
        response.status = RevSignaling.TransactionStatus.SUCCESS;
        response.message = 'Apex method was successfully executed!';
        return response;
    }
}
```

### RevSignaling.TransactionRequest
```apex
public TransactionRequest(RevSignaling.ProcedurePlan procedurePlan, String ctxInstanceId)
public String ctxInstanceId {get; set;}
public RevSignaling.ProcedurePlan procedurePlanInstance {get; set;}
```

### RevSignaling.ProcedurePlan
```apex
// Key property for inter-step data passing:
public Map<String,ANY> prevStepOutput {get; set;}
```

### RevSignaling.TransactionResponse
```apex
public String message {get; set;}
public RevSignaling.TransactionStatus status {get; set;}  // FAILED | SUCCESS
```

### RevSignaling.TransactionStatus (enum)
- `RevSignaling.TransactionStatus.SUCCESS`
- `RevSignaling.TransactionStatus.FAILED`

---

## Invocable Actions Callable from Apex

### runSalesforceHeadlessPricing (v60.0+)
Triggers Salesforce Pricing from REST or Flow. Available in Enterprise/Unlimited/Developer orgs where Salesforce Pricing is enabled.

```
URI: /services/data/v67.0/actions/standard/runSalesforceHeadlessPricing
HTTP: POST
Required inputs:
  - contextDefinitionId (string)
  - contextMappingId (string)
  - pricingData (JSON string, escaped)
  - pricingProcedureId (string)
Optional inputs:
  - discoveryProcedure
  - displayContext
  - effectiveDate
  - isHighVolumeLineItems (boolean, use for >100 line items)
  - isSkipWaterfall (boolean)
  - persistContext (boolean)
  - skipDiscovery (boolean)
  - taggedData
  - useSessionScopedContext (boolean)
Outputs:
  - contextDetails
  - executionId
  - pricingProcessErrors
  - pricingProcessStatus
  - pricingResult
```

### runSalesforcePricing
Available in Flow only (not REST). Use `runSalesforceHeadlessPricing` for REST/Apex.

### runConfigRules (v65.0+)
Runs Product Configurator constraint rules against a transaction context.

```
URI: /services/data/v67.0/actions/standard/runConfigRules
HTTP: POST
Inputs:
  - transactionContextId (string, optional)
  - transactionId (string, Required)
Output configRuleResult: runtime_industries_cpq.ConfigRuleResult containing:
  - visibilityRules: [{stiId, prcId, attributeId, attributePicklistValueId, target, scope, type}]
  - productRecommendationRules: [{referenceId, productIds[], recordType, message}]
  - messageRules: [{stiId, severity, messages[]}]
  - errors: []
```

### Calling runConfigRules from Apex

```apex
Invocable.Action action = Invocable.Action.createStandardAction('runConfigRules');
String contextId = '008d27d7-e004-4906-a949-ee7d7c323c77';
action.setInvocationParameter('transactionContextId', contextId);
List<Invocable.Action.Result> results = action.invoke();
```

---

## ConnectApi Classes for Revenue Cloud

| Class | Purpose |
|---|---|
| `ConnectApi.CPQProductDetailsOutputRepresentation` | Product details in CPQ context |
| `ConnectApi.CpqMessageOutputRepresentation` | Messages returned from CPQ operations |

---

## Metadata Types

### IndustriesPricingSettings
```xml
<IndustriesPricingSettings xmlns="http://soap.sforce.com/2006/04/metadata">
  <enableDebugPriceLogs>true</enableDebugPriceLogs>          <!-- v63.0+, diagnose pricing -->
  <enableHighAvailability>true</enableHighAvailability>
  <enableHighestPriceCompliance>true</enableHighestPriceCompliance> <!-- v64.0+, max price 30 days -->
  <enableLowestPriceCompliance>true</enableLowestPriceCompliance>  <!-- v62.0+, min price 30 days -->
  <enablePricingProcParallelization>true</enablePricingProcParallelization> <!-- v64.0+ -->
  <enablePricingWaterfall>true</enablePricingWaterfall>
  <enablePricingWaterfallPersistence>true</enablePricingWaterfallPersistence>
  <enableSalesforcePricing>true</enableSalesforcePricing>
</IndustriesPricingSettings>
```

### PricingActionParameters
Links a pricing procedure to a specific object context. Developer name identifies the configuration.

```xml
<PricingActionParameters xmlns="http://soap.sforce.com/2006/04/metadata">
  <developerName>CMEDefaultActionParameters</developerName>
  <!-- objectName valid values: Case/Contract/Opportunity/Order/Quote/SalesAgreement/WorkOrder -->
  <objectName>ORDER</objectName>
  <pricingProcedure>PP</pricingProcedure>
  <effectiveFrom>2024-04-08T07:32:00.000Z</effectiveFrom>
  <effectiveTo>2024-04-11T07:32:00.000Z</effectiveTo>
  <contextDefinition>SalesTransactionContext__stdctx</contextDefinition>
  <contextMapping>SalesAgreementEntitiesMapping</contextMapping>
  <masterLabel>PAP_test</masterLabel>
</PricingActionParameters>
```

### Other Pricing/Configurator Metadata Types
- `PricingRecipe` — defines the full pricing recipe including procedure chain
- `ProcedureOutputResolution` — resolves output of pricing procedure steps
- `ProductConfiguratorSettings` — configurator enable/disable settings

### Tooling API Objects (v62.0+)
- `PricingActionParameters` — manages pricing action parameter records
- `PricingProcedureOutputMap` — maps procedure output fields
- `PricingRecipe` — pricing recipe CRUD
- `PricingRecipeTableMapping` — maps price tables in recipes
- `ProcedureOutputResolution` — procedure output resolution rules
- `ProcedurePlanCriterion` (v62.0+) — criteria for procedure plan branching
- `ProcedurePlanDefinition` (v62.0+) — full procedure plan definition

---

## Product Configurator — Constraint Modeling Language (CML)

### CML Fundamentals

CML is a declarative language used to define product configuration rules. It runs in the constraint engine — not in Apex directly.

**Core constructs:**
- **types** — product component definitions with attributes (variables)
- **relations** — define how types relate (parent→child, cardinality)
- **constraints** — logical rules that must hold
- **rules** — action rules (hide, disable, recommend, require, setdefault, exclude)

### Data Types in CML
| CML Type | Notes |
|---|---|
| `int` | Integer |
| `decimal(n)` | Decimal with n decimal places |
| `boolean` | true/false |
| `string` | String, domain defined as array literal |
| `date` | Date (range domain as `["YYYY-MM-DD".."YYYY-MM-DD"]`) |
| `extern` | External variable — value injected by Salesforce context |

### Type Definition

```cml
type GeneratorSet {
  int requiredKW = [101..10000];
  string Voltage = ["220/380", "240/416", "255/440"];
  decimal(2) surgeLoadKW = requiredKW * 1.25;
}

// Type hierarchy (single inheritance only)
type StarterMotor_Advanced : StarterMotor;

// Virtual type (no product, container only)
@(virtual = true)
type Quote { ... }
```

### Type Annotations

| Annotation | Purpose |
|---|---|
| `@(virtual = true)` | Type has no product association; acts as container |
| `@(groupBy = AttributeName)` | Creates one virtual group instance per unique attribute value |
| `@(maxInstanceQty = N)` | Maximum instances allowed |
| `@(minInstanceQty = N)` | Minimum instances required |
| `@(split = true)` | Engine processes instances in parallel (performance) |
| `@(sharingcount = N)` | Engine can reuse a single instance up to N times |
| `@(configurable = false)` | Attribute not shown/editable in UI |

### Variable (Attribute) Annotations

| Annotation | Purpose |
|---|---|
| `@(configurable = true/false)` | Whether user can edit this attribute |
| `@(defaultValue = X)` | Default value |
| `@(domainComputation = "...")` | Computed domain expression |
| `@(Peelable = true)` | Attribute can be peeled from bundle |
| `@(relatedAttributes = [a, b])` | Related attributes for UI grouping |
| `@(sequence = N)` | Display sequence order |
| `@(strategy = "...")` | Solver strategy hint |
| `@(tagName = "ContextTagName")` | Links to Salesforce Context Definition tag |
| `@(contextPath = "SalesTransaction.FieldName")` | Maps extern variable to Sales Transaction header field |
| `@(sourceContextNode = "SalesTransaction.SalesTransactionItem")` | For virtual type relations — maps to line item context path |

### Relations and Cardinality

```cml
// Relation syntax
relation RelationName : ChildType[min..max];

// Cardinality examples
relation GeneralModels : GeneralModel[1..1];    // exactly 1 (required)
relation TemperatureSensors : TemperatureSensor[0..5]; // 0-5 optional
relation Testing : Test[1..99];                 // at least 1 required

// cardinality() proxy variable — reads size of a relation
int InstancesofHeater = cardinality(Heater, Heaters);  // count in specific port
int AllHeaterInstances = cardinality(Heater);           // count across all relations

// count() aggregate function — filters within instances
constraint(totalByCount == items.count(isPresent == true));
```

**cardinality() vs count():**
- `cardinality()` — proxy variable, returns headcount of a relation (how many instances exist). Does NOT look at attribute values.
- `count()` — aggregate function, filters instances based on a logical condition before returning count.

**Best practice:** Specify the smallest required cardinality range (e.g., `[1..1]` or `[0..5]`) to prevent performance degradation in the constraint engine.

### Proxy Variables

**cardinality(typeName, relationName)**
```cml
// Full syntax — count in specific relation
int InstancesofHeater = cardinality(Heater, Heaters);
// Partial syntax — count across all relations
int AllHeaterInstances = cardinality(Heater);
```

**parent(attributeName, level?)**
```cml
// Reference attribute in immediate parent (level 0 implicit)
int parentRequiredKW = parent(requiredKW);

// Reference attribute 1 level up from immediate parent (grandparent)
int grandParentValue = parent(requiredKW, 1);
```

Key characteristics of `parent()`:
- Data flows unidirectionally — child reads from parent, not vice versa
- CML follows single inheritance — a type can only extend one other type
- Reusing the same variable name between parent and child is a standard pattern for cascading values

**this.quantity**
```cml
// Reads the quantity of the current product line item instance
int LineItemQuantity = this.quantity;
```
- Scope: only the current instance quantity
- Can only be used inside a calculation rule
- Read-only — do not use to drive component creation (use cardinality for that)

### Constraints and Rules

**constraint() — logical constraint (must hold)**
```cml
constraint(logicalExpression, "Error message");
constraint(surgeLoadKW == requiredKW * 1.25);
constraint(standardsAndCompliance == "Listing-UL 2200" -> Voltage3 <= 600,
    "The UL 2200 standard covers stationary engine generator assemblies rated at 600 volts or less.");
```

**message() — display message to user**
```cml
// Severities: Info (default), Warning, Error
// Error in Transaction Line Editor does NOT block save
message(requiredKW > 2500, "The required kW is above what the current options can support. Please adjust to 2500 kW or select a new generator set.", "Warning");
message(logical expression, string literal | string variable, argument, .., argument, severity);
```

**preference() — soft constraint (try to satisfy, Info on failure)**
```cml
preference(dBMax == 90, "90 preferred for dbMax");
preference(requiredKW == 500, "500 preferred for requiredKW");
```

**require() — force product presence when condition met**
```cml
require(condition, relationship[type]{var=value,...}==N, "Explanation message");
// Example: if engineers > 0, add installation
require(engineers[engineer] > 0, installation[install], "Installation is required if engineers are present");
// Conditional fixed quantity
require(requiredKW > 5000, Accessories[Accessory] == 5, "High capacity generators require exactly 5 specialized accessory kits.");
```
Note: For virtual bundle require rules, set one Product Selling Model Option to Default on the required product.

**setdefault() — apply default when condition changes**
```cml
setdefault(condition, expression, message);
// Example
setdefault(requiredKW > 2000, Accessories[Accessory] == 2,
    "2 specialized accessory kits are recommended for power levels above 2000 kW");
```
Key difference from require(): setdefault only tries to satisfy when a condition changes. require() always tries when condition is true.

**exclude() — remove a type from relation when condition met**
```cml
exclude(logic expression, relationship[type], "Explanation message");
// Only leaf types (no children) can be excluded
exclude(Voltage3 >= 4160, Heaters[Heater_120]);
```
Note: exclude overrides user input to satisfy the constraint (unlike constraint() which just displays an error).

**constraint() vs require():**
| Feature | constraint() | require() |
|---|---|---|
| Primary goal | Validates logical consistency (LHS must match RHS) | Forces a product to be physically present |
| Engine action | Resolves constraint or displays error | Adds required product to the quote |

**rule() — action rule (hide, disable, recommend)**
```cml
// Hide or Disable syntax
rule(logic expression, action, actionScope, actionTarget)
rule(logic expression, action, actionScope, actionTarget, actionClassification, actionValueTarget)

// action: "hide" or "disable"
// actionScope: "attribute" or "relation"
// actionTarget: CML name of attribute or relation
// actionClassification: "type" or "value"
// actionValueTarget: specific type or value to hide/disable

// Examples:
// Disable a component type in a relation
rule(requiredKW <= 500, "disable", "relation", "StarterMotors", "type", "StarterMotor_Advanced");
// Hide an attribute
rule(specialApplication == "Motor Starting", "hide", "attribute", "Voltage");
// Hide a specific attribute value
rule(requiredKW < 2000, "hide", "attribute", "Voltage", "value", "7976/13800");

// Recommendation rule
rule(Voltage == "7976/13800", "recommend", "type", "EngineerSpecialist");
rule(Enclosures[Enclosure_SA3] == 1, "recommend", "relation", "Accessories");
```

Note: In Visual Builder, for attribute values, only the hide rule is enabled. Recommendations are NOT auto-applied — they require `runConfigRules` action to surface them.

### External Variables (contextPath)

External variables pull values from the Salesforce Sales Transaction header into the CML model.

```cml
@(contextPath = "SalesTransaction.ShippingCountry")
extern string ShippingCountry = "International"; // default value if not set

@(contextPath = "SalesTransaction.ProjectUrgency", tagName = "Priority_Level")
extern string ProjectUrgency = "Standard";
```

Usage example:
```cml
message(ShippingCountry == "US", "Regional Notice: Generator must comply with US-specific UL 2200 standards.");
```

Important: Rules using external variables only re-evaluate when a Line Item change occurs (e.g., updating `requiredKW`), not when the header field alone changes.

### CML Math Functions
```cml
// Standard arithmetic
decimal(2) surgeLoadKW = requiredKW * 1.25;

// Aggregate functions on relations
decimal(2) systemTotalKW = voltageGroups.sum(groupTotalSurgeKW);
int allHeaterCount = items.count(isPresent == true);
```

### CML String Functions (complete list)
```cml
strlen(inputString)                                      // string length as integer
substr(inputString, startIndex)                          // substring from index (0-indexed)
substr(inputString, startIndex, endIndex)                // substring range
strconcat(separator, stringArgsToConcatenate)            // concatenate with separator
join(name)                                               // aggregate: concat string values across related components
trim(strToTrim)                                          // remove leading/trailing spaces
strsplit(stringToSplit, separator)                       // split string into array
strcontain(inputString, searchString)                    // boolean, true if contains
strshare(string1, string2, delimiter)                    // true if resulting lists share any elements
strformat("%d person", quantity)                         // formatted string (%d=int, %s=string, %.2f=decimal, %b=boolean)
strtoint(inputString, defaultValue)                      // convert to integer
strtofloat(inputString, defaultValue)                    // convert to decimal
regexpreplace(InputString, RegexPattern, ReplacementGroup) // replace with regex captured group
get(index, array)                                        // retrieve element at index from array/list
```

### Global Constants in CML
```cml
// Define a global constant (string)
define VOLTAGE_REGEX "^([11-19]+)/([11-19]+)$"
define PSM_EVERGREEN_ID "a00Tx000000Qz1g"

// Use in constraints
int Voltage3 = strtoint(regexpreplace(Voltage, VOLTAGE_REGEX, "$2"), 0);
```

### Set Product Selling Model in CML Constraint
```cml
// Use productSellingModel tagName to set PSM for a type
// tagName must match the Context Definition tag
@(tagName = "ProductSellingModel")
string productSellingModel;

// Set PSM based on an attribute value
constraint(DutyRating == 'Continuous Power (COP)' -> productSellingModel == PSM_EVERGREEN_ID);
```

Note: CML constraints can only update PSM for NEW line items, not existing quote lines.

### CML Best Practices (pages 1129-1148)

**Cardinality:**
- Always specify the smallest required cardinality range to prevent performance degradation
- `[1..1]` for exactly-one; `[0..5]` for optional-up-to-5
- Use full cardinality syntax when you need to count within a specific named port

**Calculated attributes:**
- Always define explicit domains for calculated decimal attributes: `decimal(2) surgeLoadKW = [126.25..12500.00];`
- Prevents NullPointer or initialization errors during solving

**External variables:**
- Rules depending on external variables only re-evaluate on Line Item change, not header field change alone
- Always provide default values: `extern string ShippingCountry = "International";`

**Annotations:**
- Use `@(split = true)` on types with many instances for parallel solving
- Use `@(sharingCount = N)` + `@(sharing = true)` on both type and relation to allow instance reuse
- For `groupBy`, use `@(sourceContextNode = "SalesTransaction.SalesTransactionItem")` on the virtual group's relation

**Type hierarchy:**
- CML is single-inheritance only — one parent type maximum
- Use `parent()` proxy with same variable name for cascading values down hierarchy

---

## Billing Invocable Actions

### Key Billing Actions Callable from Apex/REST

**Write Off Invoices**
```
URI: /services/data/v67.0/actions/standard/writeOffInvoices (GET/POST)
Namespace: InvoiceWriteOff
Input: writeOffInvoiceInputList (InvoiceWriteOff__WriteOffInvoiceInputList)
Output: writeOffInvoiceResponseList
```

**Unapply Payment**
```
URI: /services/data/v67.0/actions/standard/unapplyPayment (POST)
Required inputs: recordId (Applied PaymentLineInvoice or PaymentLineInvoiceLine id)
Optional inputs: description, effectiveDateTime
Output: recordId (Unapplied record), unappliedDateTime
```

**Unapply Credit**
```
URI: /services/data/v67.0/actions/standard/unapplyCredit (POST)
Required inputs: recordId (Applied credit memo invoice application)
Optional inputs: description, effectiveDate
Output: recordId (Unapplied record)
```

**Void Posted Credit Memo**
```
URI: /services/data/v67.0/actions/standard/voidPostedCreditMemo (POST)
Required inputs: creditMemoId
Outputs: debitMemoId, statusUrl
```

---

## Billing Business API Limits

These are hard limits — exceeding them causes errors. Know them before writing Apex that calls billing APIs.

| API | Limit |
|---|---|
| Create Invoices By Using Billing Schedules | 200 billing schedules |
| Create Invoices | 200 invoice lines |
| Recover Billing Schedule List | 200 billing schedules |
| Apply Credit Memos | 300 invoices |
| Apply Credit Memo Lines | 300 invoice lines |
| Create and Apply Credit Memos | 300 invoices |
| Create Standalone Credit Memo | 300 credit memo lines |
| Create Billing Schedules for Orders | 1000 billing transaction items |
| Suspend/Resume Billing | 200 records |
| Invoice Draft to Posted Status | 200 invoice lines |
| Invoice Ingestion | 500 records |
| Invoice Preview | 200 invoice lines |
| Void Posted Invoice | 2000 invoice lines |
| Posted Invoice List Write-Off | 300 invoices |
| Batch Invoice Scheduler | 2000 invoice lines |
| Tax Calculation (single invoice) | 1 invoice |
| Tax Calculation (lines) | 500 invoice lines |
| Tax Calculation + Invoice Creation | 200 invoice lines |
| Tax Calculation + Invoice Batch Run | 2000 invoice lines |
| Payment Line Apply/Unapply | 1 record |

---

## Billing Connect REST API Endpoints

### Credit Memo Operations
```
POST /commerce/invoicing/credit-memos/{creditMemoId}/actions/apply                                 v62.0
POST /commerce/invoicing/credit-memo-inv-applications/{creditMemoInvApplicationId}/actions/unapply v62.0
POST /commerce/invoicing/credit-memo-lines/{creditMemoLineId}/actions/apply                        v62.0
POST /commerce/invoicing/invoices/{invoiceId}/actions/credit                                        v62.0
```

### Billing Schedules
```
POST /commerce/invoicing/billing-schedules/actions/create                                           v62.0
POST /commerce/invoicing/standalone/billing-schedules/actions/create                               v64.0
POST /commerce/invoicing/billing-schedules/collection/actions/recover                              v62.0
```

### Billing Lifecycle
```
POST /commerce/invoicing/actions/suspend-billing
POST /commerce/invoicing/actions/resume-billing
POST /commerce/invoicing/invoices/collection/actions/post
POST /commerce/invoicing/invoices/collection/actions/generate
POST /commerce/invoicing/invoices/collection/actions/ingest
POST /commerce/invoicing/invoices/actions/write-off
POST /revenue/billing/transactions/actions/apply
```

### Sequence Management (v65.0+)
```
POST /connect/sequences/policy
POST /connect/sequences/actions/assign
POST /connect/sequences/gap-reconciliation
```

### Payment/Refund
```
POST /commerce/billing/payments/{paymentId}/actions/apply
POST /commerce/billing/payments/{paymentId}/paymentlines/{paymentLineId}/actions/unapply
POST /commerce/billing/refunds/{refundId}/actions/apply
```

### Schedulers
```
POST|PUT /commerce/invoicing/invoice-schedulers                                                     v62.0
POST     /commerce/payments/payment-schedulers/                                                     v64.0
```

### Other
```
GET  /revenue/billing/billing-arrangement/{billingArrangementId}                                   v66.0
GET  /revenue/billing/accounts/{accountId}/statement                                               POST
POST /commerce/invoicing/invoices/collection/actions/calculate-estimated-tax
POST /commerce/taxes/actions/calculate
```

---

## Important Notes and Gotchas

### Apex Namespace Gotchas
1. **`runtime_industries_cpq` is the CPQ namespace** — not `cpq` or `industries_cpq`. The prefix is long and must be exact.
2. **`RevSignaling.SignalingApexProcessor` is the ONLY pricing Apex hook** — there is no `IPricingProcedureStep`. If you see that name in old docs, the actual interface is `RevSignaling.SignalingApexProcessor`.
3. **`prevStepOutput` is `Map<String,ANY>`** — the ANY type is a special Apex generic. Cast values when extracting.
4. **`AdditionalContextData` max 10 nodes** — attempting to pass more than 10 context data nodes silently fails or errors.

### CML Gotchas
5. **External variables re-evaluate on Line Item change only** — not on Sales Transaction header changes alone. Do not rely on them for real-time header-driven updates.
6. **`exclude` overrides user input** — unlike `constraint()` which shows an error, `exclude` actively removes the type from the relation.
7. **`this.quantity` is read-only in calculation rules only** — it cannot be used in constraint rules or to drive cardinality.
8. **CML is single inheritance** — a type can only extend one other type. Plan hierarchy accordingly.
9. **Virtual bundles require PSM Default** — when using require() in a virtual bundle, set one Product Selling Model Option to Default on the required product.
10. **Recommendations need runConfigRules** — `rule(..., "recommend", ...)` does NOT auto-apply in the UI. Call `runConfigRules` from Flow to surface them.

### Billing Gotchas
11. **Billing limits are hard stops** — 200/300/1000/2000 limits cause exceptions. Batch your input accordingly.
12. **Write-off uses a separate InvoiceWriteOff Apex namespace** — the `apexClass` input in the invocable action payload must be `"InvoiceWriteOff__WriteOffInvoiceInputList"`.
13. **runSalesforcePricing vs runSalesforceHeadlessPricing** — `runSalesforcePricing` is Flow-only. For REST API or Apex invocable action calls, use `runSalesforceHeadlessPricing` (v60.0+).

### Pricing Metadata Gotchas
14. **`enableDebugPriceLogs`** requires v63.0+. Do not enable in production; it generates large log volumes.
15. **`enablePricingProcParallelization`** requires v64.0+. Steps must be truly independent (no shared mutable state) for safe parallelization.
16. **`PricingActionParameters.objectName`** valid values: Case, Contract, Opportunity, Order, Quote, SalesAgreement, WorkOrder only — not custom objects.

### EPC Gotchas
17. **EPC requires `catalogSystems: ["epc"]`** in API requests (v66.0+). Standard PCM and EPC requests are not interchangeable.
