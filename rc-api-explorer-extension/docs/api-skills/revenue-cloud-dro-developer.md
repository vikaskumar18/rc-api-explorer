---
name: revenue-cloud-dro-developer
description: Comprehensive DRO developer reference — fulfillment plan structure, orchestration steps/step types, point-of-no-return, freeze/unfreeze, fulfillment adapters, priority levels, invocable actions, decompose vs orchestrate pattern, standard objects with all field picklist values
topic: Dynamic Revenue Orchestrator (DRO) — beyond APIs
source: revenue_lifecycle_management_dev_lates.pdf
pages: 1787-1913
created: 2026-06-13
---

# Revenue Cloud DRO Developer Reference

Source: Chapter 10, Dynamic Revenue Orchestrator — PDF pages 1787–1913

---

## Overview

Dynamic Revenue Orchestrator (DRO) orchestrates fulfillment of sales transactions (quotes, orders, order summaries) through:
1. **Intake** — validates and registers the transaction
2. **Decomposition** — breaks the commercial order into sub-orders (fulfillment order lines) using ProductFulfillmentDecompRule
3. **Plan Composition** — builds the FulfillmentPlan with FulfillmentStep records based on ProductFulfillmentScenario
4. **Orchestration** — executes the steps in order, tracking state

**v66 vs v67 split actions:**
- v66 and earlier: `submitSalesTransaction` does decomposition + orchestration in one call
- v67+: separate `decomposeSalesTransaction` (decompose only) + `orchestrateSalesTransaction` (orchestrate only). This allows inserting custom logic between decompose and orchestrate.

---

## Fulfillment Adapters

`fulfillmentAdapter` is a **required** input on all invocable actions:

| Value | Description |
|-------|-------------|
| `StandardOrder` | Standard Salesforce order-based fulfillment |
| `GenericAdapter` | Available API v64.0+; for custom/external fulfillment patterns not tied to standard orders |

---

## Fulfillment Priority Levels

`fulfillmentPriority` controls queue prioritization:

| Value | Use Case |
|-------|----------|
| `High` | Urgent/high-value orders |
| `Bulk` | Batch/large-volume imports |
| `Default` | Standard processing |

`priorityLimitAction` — what to do when the priority limit is reached:
- `Reject` — reject the transaction
- `Downgrade` — downgrade priority and continue

This parameter is only applicable when `fulfillmentPriority` is specified.

---

## SalesTransactionFulfillReq — Overall Fulfillment Statuses

`SalesTransactionType` (fulfillment adapter type per record):
- `StandardOrder`
- `GenericAdapter` (v64.0+)

`Status` (overall fulfillment status):
- `Created`
- `Freezing`
- `Frozen`
- `Fulfilled`
- `Fulfilling`
- `Rejected`
- `Superseded`

`PlanExecutionStatus`:
- `InProgress`
- `Frozen`
- `Freezing`

`AssetizationStatus` / `DecompositionStatus` / `PlanCompositionStatus`:
- `Completed`, `Failed`, `InProgress`, `NotStarted`, `Rejected`, `NotApplicable` (v64.0+)

`OrchestrationGroupKey` (v63.0+) — identifier of the group of sales transactions that require synchronization before processing.

---

## FulfillmentPlan Object

Represents the set of steps needed to fulfill an order.

| Field | Type | Values / Notes |
|-------|------|----------------|
| `Priority` | picklist (v63.0+) | `Default`, `High`, `Bulk` |
| `State` | picklist | `Completed`, `InProgress`, `NotStarted` |
| `UsageType` | picklist | `IntegrationOrchestrator`, `Generic`, `StageManagement` |

---

## FulfillmentStep Object

Represents one task in a fulfillment plan.

### State picklist
- `Completed`
- `Failed`
- `FatallyFailed`
- `InProgress`
- `Pending`
- `Ready`
- `Scheduled`
- `Skipped`

### StepType picklist
- `AutoTask` — automated flow-based step
- `Callout` — external integration callout
- `ManualTask` — human task assignment
- `Milestone` — checkpoint; no execution
- `Pause` — pauses plan execution
- `StagedAssetize` (v63.0+) — staged assetization step

### TaskAllocationType (v63.0+)
How a manual task is assigned:
- `ContextBased`
- `LeastLoaded`
- `RoundRobin`

### UsageType
- `Fulfillment`
- `InsuranceRuleAction`
- `IntegrationOrchestrator`
- `OrderFulfillment`

### Key Fields

| Field | Type | Notes |
|-------|------|-------|
| `ForceplanFreezeDuringExecution` | picklist (v63.0+) | `Never` (default) or `YesButWaitForStepCompletion` — controls plan freeze while step is in progress |
| `PointOfNoReturn` | multipicklist (v62.0+) | `Changes Denied` — type of source change applied to the line item |
| `ResumeOnRuleId` | reference | ExpressionSet; step completes only when expression set returns `isExecuteStep = true` |
| `RetryAttempts` | int | Number of retry attempts per FalloutQualificationRule |
| `RunAsUserId` | reference | Overrides user context for automated step; default is AutomatedProc user |
| `IsSkipBranch` | boolean (v62.0+) | Skips remaining steps in group when ExecuteOn rule condition is true; default `false` |
| `CompensatedStepId` | reference (v62.0+) | Alternative step executed on amend/cancel |
| `CustomConfigParameter` | string | Custom configuration context from FSD record; passed during execution for flow reusability |
| `JeopardyStatus` | string (calculated) | Computed jeopardy status |
| `JeopardyThreshold` | int | Value after which step is in jeopardy |
| `JeopardyThresholdUnit` | picklist | `Days`, `Hours`, `Minutes` (default), `Seconds` |
| `NextEarliestRunTime` | dateTime (v62.0+) | Earliest time to retry |
| `PlannedStartDate` | dateTime | Planned start |
| `PlannedCompletionDate` | dateTime | Planned completion |
| `RequestedStartDate` | dateTime | Requested start |
| `RequestedCompletionDate` | dateTime | Requested completion |
| `TaskId` | reference (v63.0+) | ID of task assigned to user/queue |
| `ExecuteOn` | picklist | `PreviousStepExecutionDate`, `SourceLineStartDate` |

---

## FulfillmentStepDefinition Object

Represents the definition (template) of a step; available v61.0+.

### Key Fields

| Field | Type | Notes |
|-------|------|-------|
| `AmendGroupId` | reference (v62.0+) | FulfillmentStepDefinitionGroup added when step is amended |
| `CancelledGroupId` | reference (v62.0+) | FulfillmentStepDefinitionGroup added when step is canceled |
| `CustomBaseExecutionDate` | string (v65.0+) | Context tag with custom date for future-dated step execution |
| `CustomConfigParameter` | string | Custom config context; passed to steps for flow reusability |
| `CustomFulfillmentScope` | string (v65.0+) | Custom scope during order fulfillment |
| `DelayOf` | int (v63.0+) | Value of delay |
| `DelayUnit` | picklist (v63.0+) | `Days`, `Hours`, `Minutes` |
| `ExecuteOn` | picklist (v63.0+) | `PreviousStepsStartDate`, `SourceLineStartDate` |
| `ExecuteOnConditionData` | textarea (v66.0+) | Condition as JSON rule set |
| `ExecuteOnRuleId` | reference | ExpressionSet; step executes only when expression set = true |
| `FlowDefinitionName` | string | Name of the associated flow |
| `ForceplanFreezeDuringExecution` | picklist (v63.0+) | `Never` (default) or `YesButForcefullyCompleteStep` |
| `IntegrationDefinitionNameId` | reference | IntegrationProviderDef for external endpoint communication |
| `IsSkipBranch` | boolean (v62.0+) | Skip remaining steps when ExecuteOn rule is met; default `false` |
| `OmniscriptName` | string | For internal use only |
| `PointOfNoReturn` | multipicklist (v62.0+) | `Changes Denied` |
| `ResumeOnConditionData` | textarea (v66.0+) | Condition for resuming paused step; JSON rule set |
| `ResumeOnRuleId` | reference | ExpressionSet; step completes when expression set = true |
| `RunAsUserId` | reference | User context override for automated step |
| `Scope` | picklist | `Bundle`, `CrossPlan`, `LineItem`, `Plan` (default) |
| `StepDefinitionGroupId` | reference | Master-detail to FulfillmentStepDefinitionGroup |
| `StepType` | picklist | `AutoTask`, `Callout`, `ManualTask`, `Milestone`, `Pause`, `StagedAssetize` |
| `TaskAllocationType` | picklist (v62.0+) | `RoundRobin`, `LeastLoaded` (on FSD); v63.0+ adds `ContextBased` |
| `UsageType` | picklist | `IntegrationOrchestrator`, `OrderFulfillment` |

**Note on ForceplanFreezeDuringExecution difference between FulfillmentStep and FulfillmentStepDefinition:**
- FulfillmentStep: `Never` | `YesButWaitForStepCompletion`
- FulfillmentStepDefinition: `Never` | `YesButForcefullyCompleteStep`

---

## FulfillmentStepDefinitionGroup Object

Represents a set of FulfillmentStepDefinitions; available v61.0+.

| Field | Notes |
|-------|-------|
| `Name` | Name of the group |
| `UsageType` | `IntegrationOrchestrator`, `Generic`, `InsuranceRuleAction` |

---

## FulfillmentStepDependency Object

Represents a dependency between two tasks; available v61.0+.

| Field | Notes |
|-------|-------|
| `DependencyDefinitionId` | Reference to FulfillmentStepDependencyDef |
| `DependentStepId` | Master-detail to FulfillmentStep; the step that depends |
| `DependsOnStepId` | The step that must execute before this one |

---

## FulfillmentStepDependencyDef Object

Represents a dependency definition between two step records; available v62.0+.

| Field | Type | Notes |
|-------|------|-------|
| `DependencyScope` | picklist | `Bundle`, `LineItem`, `Plan` (default), `CrossPlan`, `Custom` |
| `DependsOnStepDefinitionId` | reference | FulfillmentStepDefinition that must execute first |
| `FulfillmentStepDefinitionId` | reference | Master-detail to FulfillmentStepDefinition (master) |
| `IsCompensateInReverse` | boolean (v63.0+) | Reverses order of compensated group steps on cancel; default `false` |
| `PropagateStateToDependentStep` | picklist (v63.0+) | `Amended`, `Both`, `Canceled`, `None` — state propagated on amend/cancel |

---

## FulfillmentStepJeopardyRule Object

Duration and tolerance tracking for jeopardy detection; available v61.0+.

| Field | Type | Notes |
|-------|------|-------|
| `EstimatedDuration` | int | Estimated completion time |
| `EstimatedDurationUnit` | picklist | `Days`, `Hours`, `Minutes` (default), `Seconds` |
| `FlowDefinition` | string | Flow for AutoTask step type |
| `IntegrationDefinitionId` | reference | IntegrationProviderDef for Callout step type |
| `JeopardyThreshold` | int | Threshold after which step is in jeopardy |
| `JeopardyThresholdUnit` | picklist | `Days`, `Hours`, `Minutes` (default), `Seconds` |
| `StepType` | picklist | `AutoTask`, `Callout`, `ManualTask`, `Milestone`, `Pause` |

---

## FulfillmentStepSource Object

Link between a fulfillment step and order lines; available v61.0+.

| Field | Notes |
|-------|-------|
| `SourceIdentifier` | ID of the source order line item (OrderItem or FulfillmentOrderLineItem) |
| `SourceLineItemId` | Polymorphic reference; FulfillmentOrderLineItem or OrderItem |
| `StepId` | Master-detail to FulfillmentStep (master) |
| `VersionGroupIdentifier` (v64.0+) | ID of the version group assigned to the step source item |

---

## FulfillmentTaskAssignmentRule Object

Set of actions that assign a task to a user or queue; available v63.0+.

| Field | Notes |
|-------|-------|
| `ConditionData` (v66.0+) | Condition as JSON rule set |
| `ConditionId` | ExpressionSet for determining assignment |
| `DestinationId` | Queue or User (destination of assignment) |
| `Name` | Condition-based name |
| `Priority` | int — rule execution priority |
| `SourceId` | Group — source of assignment |
| `TaskAllocationType` | `ContextBased`, `LeastLoaded`, `RoundRobin` |
| `UsageType` | `Fulfillment` (default), `Generic`, `InsuranceRuleAction`, `IntegrationOrchestrator` |

---

## FulfillmentFalloutRule Object

Retry policy for failed steps.

| Field | Values |
|-------|--------|
| `StepType` | `AutoTask`, `Callout`, `ManualTask`, `Milestone`, `Pause` |
| `RetryPolicy` | `Immediate`, `Monotonous`, `Staggered` |
| `RetriesAllowed` | int |
| `RetryIntervals` | int |
| `ErrorCode` | string |
| `FalloutQueueId` | reference to Queue |

---

## FulfillmentWorkspace Object

Visual designer for fulfillment plans with multiple step groups and dependencies; available v61.0+.

| Field | Notes |
|-------|-------|
| `Name` | Name of the workspace |
| `Description` | Description |

---

## FulfillmentWorkspaceItem Object

Attributes used in a fulfillment step group definition; available v61.0+.

| Field | Notes |
|-------|-------|
| `FulfillmentStepDefinitionGroupId` | Master-detail to FulfillmentStepDefinitionGroup |
| `FulfillmentWorkspaceId` | Master-detail to FulfillmentWorkspace (master) |
| `ShowOrder` | int — display sequence |

---

## Point-of-No-Return (PONR)

A line item reaches a point-of-no-return milestone when it can no longer accept modifications.

- Configured on `FulfillmentStep.PointOfNoReturn` and `FulfillmentStepDefinition.PointOfNoReturn`
- Valid value: `Changes Denied`
- Use `Get Point Of No Return Action` to query per-line PONR status
- Use `Freeze Sales Transaction Action` to freeze a transaction (disable line item modification)
- Use `Unfreeze Sales Transaction Action` to re-enable modification

**PONR response structure per line item:**
```json
"lineItemsPointOfNoReturnInfo": {
  "802SG000007D0B4YAK": {
    "namendAllowed": false,
    "nanyChangesAllowed": true,
    "ncancelAllowed": false
  }
}
```

`allowOverrideOfPointOfNoReturn` (boolean, default `false`) — input parameter on Decompose/Orchestrate actions to bypass PONR for a fulfillment step.

---

## FulfillmentLineSourceRel Object

| Field | Version | Values |
|-------|---------|--------|
| `Action` | v66.0+ | `Add`, `Cancel`, `NoChange` — action on asset fulfillment decomp record |
| `SupplementalAction` | v62.0+ | `Add`, `Amend`, `Cancel`, `NoChange` — run-time changes to original fulfillment request |

---

## FulfillmentLineRel Object

Tracks relationships between fulfillment order lines.

---

## AssetFulfillmentDecomp Object (v62.0+)

Relationship between ordered asset and fulfillment asset.

| Field | Notes |
|-------|-------|
| `IsUsedForFulfmtAssetActivation` | Controls whether internal job activates the asset |

---

## FulfillmentAsset Object

Tracks asset configuration for fulfillment.

| Field | Notes |
|-------|-------|
| `IsTimeAware` (v67.0+) | Time-aware vs time-agnostic configuration tracking |

---

## FulfillmentAssetStatePeriod Object (v67.0+)

Period during which a fulfillment asset configuration is applicable.

| Field | Notes |
|-------|-------|
| `IsSuperseded` | Whether this period has been superseded |

---

## ProductFulfillmentDecompRule Object

How an order is broken into sub-orders; available v61.0+.

| Field | Notes |
|-------|-------|
| `ConditionData` (v66.0+) | JSON condition for executing decomposition |
| `DestinationProductId` | Destination Product2 for decomposition |
| `DestinationIdentifier` (v65.0+) | Salesforce product ID or external ID |
| `Priority` | int — decomposition rules executed in priority order |
| `SourceProductId` | Source Product2 |
| `SourceProductClassificationId` (v62.0+) | Classification for decomposition |
| `SourceClassIdentifier` (v65.0+) | Salesforce product ID or external ID |
| `SourceIdentifier` (v65.0+) | Source entity; Salesforce product ID or external identifier |

---

## ProductDecompEnrichmentRule Object

Mappings between fields/attributes for data propagation to fulfillment order lines; available v61.0+.

| Field | Notes |
|-------|-------|
| `CalculationMethod` | `Ad-verbatim` (As Is), `Static-Lookup` (List Lookup), `Expression-Set` (v64.0+) |
| `CalculationDefinitionId` | DecisionMatrixDefinition or ExpressionSet |
| `DestinationType` | `Attribute`, `Field` |
| `SourceType` | `Attribute`, `Field` |
| `RuleEnforcement` (v63.0+) | `AllFulfillmentRequests`, `InitialFulfillmentRequest` |
| `DestinationAttributeIdentifier` (v65.0+) | Salesforce AttributeDefinition ID or external identifier |
| `SourceAttributeIdentifier` (v65.0+) | Source entity attribute; Salesforce ID or external identifier |

---

## ProdtDecompEnrchVarMap Object (v64.0+)

Maps a field context tag or attribute to an expression set variable.

| Field | Notes |
|-------|-------|
| `ExpressionSetVarName` | Variable name in the expression set |
| `FieldContextTagName` | Field context tag mapped to expression set variable |
| `ProductAttributeIdentifier` (v65.0+) | Product attribute from internal/external catalog; used by DRO to copy data during enrichment |
| `VariableType` | `Input` (default), `Output` |

---

## ProductFulfillmentScenario Object

Link between a product and the fulfillment step group; available v61.0+.

| Field | Notes |
|-------|-------|
| `Action` | `Add`, `Amend`, `Cancel`, `NoChange`, `Renew` — internal use only |
| `ConditionData` (v66.0+) | JSON condition for executing the scenario |
| `FulfillmentStepDefnGroupId` | FulfillmentStepDefinitionGroup associated with the scenario |
| `ProductClassificationId` | ProductClassification for the scenario |
| `ProductId` (v64.0+) | Product2 associated with the scenario |
| `SourceClassIdentifier` (v65.0+) | Salesforce Product Class ID or external identifier |
| `SourceIdentifier` (v65.0+) | Salesforce product ID or external identifier |
| `UsageType` (v66.0+) | `Fulfillment` (default), `Generic`, `InsuranceRuleAction`, `IntegrationOrchestrator`, `StageManagement` |

---

## SalesTrxnDeleteEvent Object (v64.0+)

Platform event that triggers deletion of sales transaction fulfillment request records when reference records are deleted.

| Field | Notes |
|-------|-------|
| `ReferenceObjectIdentifier` | Object identifier for the sales transaction fulfillment request to delete |

---

## ValTfrm Object (v61.0+)

Mappings between fields and attributes; enrichment rules for fulfillment order lines.

| Field | Notes |
|-------|-------|
| `InputDate`, `InputDatetime`, `InputNumber`, `InputString`, `InputPicklistValueId` | Input value fields |
| `OutputDate`, `OutputDatetime`, `OutputNumber`, `OutputString`, `OutputPicklistValueId` | Output value fields |
| `IsInputBoolean` | Whether a value was entered |
| `IsOutputBoolean` | Whether there was an output value |
| `ValueTransformGroupId` | Master-detail to ValTfrmGrp (master) |

---

## ValTfrmGrp Object (v61.0+)

Rule that determines how an order is broken into sub-orders with technical details.

| Field | Notes |
|-------|-------|
| `DestinationPrimitiveType` | `Boolean`, `Currency`, `Date`, `Datetime`, `Number`, `Percent`, `Text` |
| `SourcePrimitiveType` | `Boolean`, `Currency`, `Date`, `Datetime`, `Number`, `Percent`, `Text` |
| `IsDestinationEnumerated` | Whether output is a list of values |
| `IsSourceEnumerated` | Whether input is a list of values |
| `UsageType` | `DFOListMapping` only |

---

## DRO Standard Invocable Actions

Base URI pattern: `/services/data/v{version}/actions/standard/{actionName}`

### 1. Submit Sales Transaction Action (`submitSalesTransaction`)

Initiates the full fulfillment process (decompose + orchestrate) for any sales transaction.

**URI:** `/services/data/v66.0/actions/standard/submitSalesTransaction`

**Inputs:**

| Input | Type | Required | Notes |
|-------|------|----------|-------|
| `salesTransactionId` | id | Yes | ID of the sales transaction |
| `fulfillmentAdapter` | string | Yes | `StandardOrder` or `GenericAdapter` |
| `fulfillmentPriority` | string | No | `High`, `Bulk`, `Default` |
| `hydratedContextId` | string | No | ID of the hydrated context |
| `intakeRequestType` | string | No | `Synchronous` or `Asynchronous` |
| `priorityLimitAction` | string | No | `Reject` or `Downgrade` — only with `fulfillmentPriority` |
| `allowOverrideOfPointOfNoReturn` | boolean | No | Default `false` |

**Outputs:**

| Output | Notes |
|--------|-------|
| `requestId` | Request ID |
| `requestedFulfillmentPriority` | Priority requested |
| `resolvedFulfillmentPriority` | Actual priority used |
| `submitStatus` | `Success`, `Error`, `Submitted`, `Rejected` |
| `usedContextId` | Context ID used |
| `errorCode` | Error code if failed |

---

### 2. Decompose Sales Transaction Action (`decomposeSalesTransaction`) — v67.0+

Decompose only — stops before orchestration. Enables custom logic insertion between decompose and orchestrate.

**URI:** `/services/data/v66.0/actions/standard/decomposeSalesTransaction`

**Inputs:**

| Input | Type | Required | Notes |
|-------|------|----------|-------|
| `salesTransactionId` | id | Yes | |
| `fulfillmentAdapter` | string | Yes | `StandardOrder` or `GenericAdapter` |
| `fulfillmentPriority` | string | No | `High`, `Bulk`, `Default` |
| `intakeRequestType` | string | No | `Synchronous` or `Asynchronous` |
| `hydratedContextId` | string | No | |
| `priorityLimitAction` | string | No | `Reject` or `Downgrade` |
| `allowOverrideOfPointOfNoReturn` | boolean | No | Default `false` |

**Example Request:**
```json
{
  "inputs": [{
    "fulfillmentAdapter": "StandardOrder",
    "intakeRequestType": "Synchronous",
    "salesTransactionId": "801xx000003GYexAAG"
  }]
}
```

**Example Response:**
```json
{
  "outputValues": {
    "requestId": "ee3ded2e-fe43-401b-a54d-9124d48a0b72",
    "requestedFulfillmentPriority": "Default",
    "submitStatus": "SUCCESS",
    "usedContextId": "0000000s21to18g00091764...",
    "resolvedFulfillmentPriority": "Default"
  }
}
```

---

### 3. Orchestrate Sales Transaction Action (`orchestrateSalesTransaction`) — v67.0+

Orchestrate only — executes plan composition + orchestration phases, without decomposition. Use when transaction was already decomposed (by `decomposeSalesTransaction` or custom logic).

**URI:** `/services/data/v67.0/actions/standard/orchestrateSalesTransaction`

**Inputs:**

| Input | Type | Required | Notes |
|-------|------|----------|-------|
| `salesTransactionId` | id | Yes | |
| `fulfillmentAdapter` | string | Yes | `StandardOrder` or `GenericAdapter` |
| `fulfillmentPriority` | string | No | `High`, `Bulk`, `Default` |
| `intakeRequestType` | string | No | `Synchronous` or `Asynchronous` |
| `hydratedContextId` | string | No | |
| `priorityLimitAction` | string | No | `Reject` or `Downgrade` |
| `allowOverrideOfPointOfNoReturn` | boolean | No | Default `false` |

**Outputs:** `errorCode`, `fulfillmentPlanId`, `requestedFulfillmentPriority`, `requestId`, `resolvedFulfillmentPriority`, `submitStatus` (SUCCESS/ERROR/SUBMITTED/REJECTED), `usedContextId`

---

### 4. Orchestrate Transaction Action (`orchestrateTransaction`) — v66.0+

Orchestrates any domain-specific object (e.g., Collection Plan for Revenue Billing). Performs composition + execution.

**URI:** `/services/data/v67.0/actions/standard/orchestrateTransaction`

**Inputs:**

| Input | Type | Required | Notes |
|-------|------|----------|-------|
| `transactionId` | string | Yes | ID of the business/domain object (e.g., Collection Plan ID) |
| `orchestrationType` | string | Yes | `Generic`, `Fulfillment`, or `Billing` |

**Outputs:** `requestId`, `errorCode`, `fulfillmentPlanId`, `submitStatus` (Success/Error)

---

### 5. Submit Order Action (`submitOrder`) — v61.0+

Submit a Salesforce order to DRO for fulfillment. Performs:
- Order decomposition
- Fulfillment orchestration via message queues
- Dynamic plan composition based on incoming order

**URI:** `/services/data/v67.0/actions/standard/submitOrder`

**Inputs:**

| Input | Type | Required | Notes |
|-------|------|----------|-------|
| `orderId` | string | Yes | ID of the order to submit to DRO |
| `callType` | string | No | `Synchronous` or `Asynchronous` (default: `Asynchronous`) |
| `contextId` | string | No | ID of the hydrated context (see Context Service) |

**Outputs:**

| Output | Notes |
|--------|-------|
| `errorCode` | Error code if failed |
| `fulfillmentPlanId` | Returned only if `callType = Synchronous` |
| `requestId` | Unique ID of the invocation request |
| `submitStatus` | `SUCCESS`, `ERROR`, `SUBMITTED`, `REJECTED` |
| `usedContextId` | Hydrated context ID used (may differ from `contextId` input) |

**Example (Synchronous):**
```json
{
  "inputs": [{"orderId": "801RM0000007yGaYAI", "callType": "Synchronous"}]
}
```

**Response:**
```json
{
  "requestId": "a161cfda-868c-41d2-b589-7c7d7ff2d4c1",
  "submitStatus": "SUCCESS",
  "usedContextId": "e275e930923106ee7e39cbfa...",
  "fulfillmentPlanId": "13VZM00000000062AA"
}
```

**Error response example:**
```json
{
  "statusCode": "UNKNOWN_EXCEPTION",
  "message": "Missing required input parameter: orderId",
  "errorCode": "DRO_INTERNAL_ERROR"
}
```

---

### 6. Freeze Sales Transaction Action (`freezeSalesTransaction`) — v64.0+

Freezes a sales transaction to disable line item modification. Called when a transaction has reached a point-of-no-return milestone.

**URI:** `/services/data/v67.0/actions/standard/freezeSalesTransaction`

**Inputs:** `salesTransactionId` (required)

**Outputs:**

| Output | Notes |
|--------|-------|
| `errorCode` | Error code |
| `orchestrationPlanId` | ID of the created orchestration plan |
| `planState` | `FAILURE`, `NOTSTARTED`, `PENDING`, `COMPLETED`, `FROZEN`, `INPROGRESS` |
| `pointOfNoReturnDetailForLineItemsList` | Collection of line items + boolean indicating PONR reached |
| `requestId` | Request ID |
| `salesTransactionId` | Submitted transaction ID |

---

### 7. Get Point Of No Return Action (`getPointOfNoReturn`) — v64.0+

Get details about the PONR milestone for each line item.

**URI:** `/services/data/v67.0/actions/standard/getPointOfNoReturn`

**Inputs:** `salesTransactionId` (required)

**Outputs:**

| Output | Notes |
|--------|-------|
| `errorCode` | Error type |
| `lineItemsPointOfNoReturnInfo` | Line items with PONR details (namendAllowed, nanyChangesAllowed, ncancelAllowed per line) |
| `planId` | ID of the composed fulfillment plan |
| `planState` | State of the fulfillment plan |
| `requestId` | Request ID |
| `salesTransactionId` | Submitted transaction ID |

**Example Response:**
```json
{
  "planId": "13VSG00000229Z72AI",
  "lineItemsPointOfNoReturnInfo": {
    "802SG000007D0B4YAK": {"namendAllowed": false, "nanyChangesAllowed": true, "ncancelAllowed": false},
    "n802SG000007D0B3YAK": {"namendAllowed": false, "nanyChangesAllowed": true, "ncancelAllowed": false}
  },
  "salesTransactionId": "801SG00000jQO1ZYAW",
  "planState": "InProgress"
}
```

---

### 8. Unfreeze Sales Transaction Action (`unfreezeSalesTransaction`) — v64.0+

Re-enables modification of a sales transaction's line items.

**URI:** `/services/data/v67.0/actions/standard/unfreezeSalesTransaction`

---

## Decompose vs Orchestrate vs Submit — Decision Guide

| Scenario | Action |
|----------|--------|
| Full fulfillment in one call (v66 or earlier) | `submitSalesTransaction` |
| Full order fulfillment (legacy, OrderId based) | `submitOrder` |
| Decompose only, custom logic, then orchestrate (v67+) | `decomposeSalesTransaction` then `orchestrateSalesTransaction` |
| Non-order domain orchestration (Billing, Generic) | `orchestrateTransaction` |
| Check what line items can still be modified | `getPointOfNoReturn` |
| Lock order from further changes | `freezeSalesTransaction` |
| Unlock order for modification | `unfreezeSalesTransaction` |

---

## Context Service Integration

The `contextId` / `hydratedContextId` input parameter accepts a pre-hydrated context ID.

- `usedContextId` in the response indicates the actual context used (may differ from input if the system resolved a different context)
- Context service is used to pass enrichment/configuration data to DRO steps
- Referenced in `SubmitOrder` documentation as: "Optional. ID of the hydrated context. See Context Service."

---

## Explainability Action Logs

To troubleshoot DRO errors, retrieve action logs via the Action Logs endpoint.

**Get logs for order intake:**
```
GET /services/data/v67.0/connect/decision-engine/action-logs?applicationSKType=DroSubmit&applicationType=7&primaryFilter={orderId}
```

Response contains `actionLog.OrderIntakeStatus`, `OrderIntakeStatusMessage`, `OrderId`, `SubmitMode`, `UniqueRequestId`, `ContextId`, `ContextDefinition`.

**Get logs for decomposition scope:**
```
GET /services/data/v67.0/connect/decision-engine/action-logs?applicationSKType=DrxDecomp&applicationType=7&processType=DrxDecomp&primaryFilter={orderId}
```

Response contains `CandidateDecompositionRules` and `SelectedDecompositionRules` arrays, plus `OliScopeDetails` (ParentOliId, BundleRootOli) and `FoliComputationDetails` (ComputedAction: AMEND/ADD/CANCEL, ComputedQuantity).

---

## DRO Object Relationship Summary

```
SalesTransactionFulfillReq
  └── FulfillmentPlan
        └── FulfillmentStep (multiple, per sub-order line)
              ├── FulfillmentStepSource (links to OrderItem/FulfillmentOrderLineItem)
              ├── FulfillmentStepDependency (step ordering constraints)
              └── FulfillmentFalloutRule (retry policy)

FulfillmentWorkspace
  └── FulfillmentWorkspaceItem
        └── FulfillmentStepDefinitionGroup
              └── FulfillmentStepDefinition (step template)
                    └── FulfillmentStepDependencyDef

ProductFulfillmentScenario → FulfillmentStepDefinitionGroup
ProductFulfillmentDecompRule → Product2 (source → destination)
  └── ProductDecompEnrichmentRule (field/attribute mappings)
        └── ProdtDecompEnrchVarMap (expression set variable mappings, v64.0+)
```

---

## Common Fulfillment Failure Patterns

| errorCode | Meaning | Recovery |
|-----------|---------|----------|
| `DRO_INTERNAL_ERROR` | System error during DRO processing | Check action logs; retry |
| PONR violation (implicit) | Attempting to modify a frozen line item | Call `getPointOfNoReturn` first; check `namendAllowed` |
| `SUBMITTED` status | Async submission accepted; plan not yet created | Poll `SalesTransactionFulfillReq.Status` |
| `REJECTED` status | Priority limit exceeded | Change `priorityLimitAction` to `Downgrade` or reduce `fulfillmentPriority` |
| `FatallyFailed` step state | Step exhausted all retry attempts | Manual intervention; check `FulfillmentFalloutRule.ErrorCode` |

---

## API Version Compatibility Matrix

| Feature | Min API Version |
|---------|----------------|
| FulfillmentStepDefinition, FulfillmentWorkspace | v61.0 |
| AssetFulfillmentDecomp, FulfillmentStepDependencyDef | v62.0 |
| FulfillmentPlan.Priority, FulfillmentStep.ForceplanFreezeDuringExecution | v63.0 |
| SalesTrxnDeleteEvent, GenericAdapter, Freeze/Unfreeze/GetPONR actions | v64.0 |
| CustomBaseExecutionDate, CustomFulfillmentScope on FSD | v65.0 |
| FulfillmentLineSourceRel.Action, ConditionData on rules | v66.0 |
| FulfillmentAsset.IsTimeAware, FulfillmentAssetStatePeriod | v67.0 |
| decomposeSalesTransaction, orchestrateSalesTransaction actions | v67.0 |
