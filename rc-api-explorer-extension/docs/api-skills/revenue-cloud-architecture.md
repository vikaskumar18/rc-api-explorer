---
name: revenue-cloud-architecture
description: RC system architecture, module relationships, lifecycle, integration points — from Revenue Cloud Developer Guide PDF (2026-06-13)
metadata:
  type: reference
---

# Revenue Cloud Architecture & Module Overview

## Source
PDF: revenue_lifecycle_management_dev_lates.pdf (2917 pages)
Scanned: 2026-06-13
Guide version: 67.0, Summer '26
Last updated: June 5, 2026

---

## Guide Version & Edition Availability

| Attribute | Value |
|---|---|
| API Version | 67.0 |
| Release | Summer '26 |
| Last Updated | June 5, 2026 |
| UI Requirement | Lightning Experience only |
| Available Editions | Enterprise, Unlimited, Developer |

> Individual modules (e.g., Salesforce Pricing, Advanced Approvals) require the respective feature to be enabled within a qualifying edition.

---

## Core Modules Overview

Revenue Cloud is a suite of business components covering the product-to-cash lifecycle. The eight primary modules are:

| Module | Description |
|---|---|
| **Product Catalog Management (PCM)** | Define and manage the product catalog — products, attributes, bundles, and pricing relationships |
| **Salesforce Pricing** | Price rules, price books, discount schedules, and pricing waterfall logic |
| **Product Configurator** | Guided selling and constraint-based product configuration (bundles, attributes, rules) |
| **Transaction Management** | Quotes, orders, and order lifecycle management |
| **Usage Management** | Capture and process product usage events for consumption-based billing |
| **Rate Management** | Rates, rate plans, and rating waterfall for product resource consumption |
| **Dynamic Revenue Orchestrator (DRO)** | Orchestration engine that coordinates multi-step revenue processes across modules |
| **Billing** | Invoice generation, payment processing, and billing schedules |

### Associated / Complementary Modules

These modules integrate with the core eight but are treated as distinct capabilities:

- **Business Rules Engine** — rule evaluation framework used across modules
- **Context Service** — runtime context resolution for pricing, configuration, and orchestration
- **Salesforce Contracts** — contract lifecycle, amendments, and renewals
- **Advanced Approvals** — parallel/sequential approval chains with audit trails

---

## API-First Architecture Principle

Revenue Cloud is designed as an **extensible, API-first** set of business components for product-to-cash processes. Every capability is exposed through a developer-accessible surface:

| Developer Resource Type | Description |
|---|---|
| **Standard Objects** | Salesforce objects that store Revenue Cloud data (e.g., ProductCatalog, PriceBook2, Order) |
| **Business APIs** | REST/SOAP endpoints for domain-specific operations (e.g., pricing, rating, configuration) |
| **Metadata API Types** | Metadata components for deploying RC configuration (e.g., RevenueManagementSettings) |
| **Tooling API Objects** | Objects accessible via Tooling API for developer/admin introspection |
| **Invocable Actions** | Flow-callable actions for RC operations (e.g., rate usage, submit approvals) |
| **Apex Classes/Interfaces** | Extensibility hooks, service interfaces, and utility classes |
| **Platform Events** | Event-driven integration points within the RC lifecycle |
| **Constraint Modeling Language** | Declarative language for defining product configuration constraints |

---

## Developer Guide Chapter Map

Use this table to navigate the 2,917-page PDF directly to the relevant module:

| Chapter | Topic | Start Page |
|---|---|---|
| Ch 1 | Get Started | p1 |
| Ch 2 | RevenueManagementSettings (Metadata API) | p4 |
| Ch 3 | Revenue Cloud Deployment | p9 |
| Ch 4 | Product Catalog Management | p68 |
| Ch 5 | Salesforce Pricing | p659 |
| Ch 6 | Rate Management | p899 |
| Ch 7 | Product Configurator | p947 |
| Ch 8 | Transaction Management | p1204 |
| Ch 9 | Advanced Approvals | p1767 |
| Ch 10 | Dynamic Revenue Orchestrator | p1787 |
| Ch 11 | Usage Management | p1946 |
| Ch 12 | Billing | p2108 |
| Ch 13 | RC Associated Objects | p2853 |

---

## Module Developer Surface Details

### Salesforce Pricing (Ch 5, p659)

Available in: Lightning Experience, Enterprise / Unlimited / Developer Editions where Salesforce Pricing is enabled.

Ch 5 covers:
- Standard Objects
- Fields on Standard Objects
- Business APIs
- Apex Reference
- Standard Invocable Actions
- Metadata API Types
- Tooling API Objects

### Rate Management (Ch 6, p899)

Provides four developer resource types:

| Resource Type | Purpose |
|---|---|
| Standard Objects & Fields | Manage rates and discounts for product resource consumption |
| Metadata API Types | Rate Management settings |
| Business APIs | Get details of rate plan and persisted rating waterfall |
| Invocable Action | Invoke the rating service to rate usage records |

### Advanced Approvals (Ch 9, p1767)

Available in: Lightning Experience, Enterprise / Unlimited / Developer Editions where Advanced Approvals is enabled.

Automates and manages parallel or sequential approval chains with detailed audit trails.

**Fields on Standard Objects:**

| Object | Start Page |
|---|---|
| ApprovalSubmission | p1768 |
| Approval Work Item | p1772 |

**Invocable Actions provided:**

| Action | Description |
|---|---|
| Cancel Approval Submission Action | Cancels an in-flight approval submission |
| Get Previous Related Record Details Action | Retrieves details from prior related records in the approval chain |
| Override Approval Work Item Action | Allows admin override of a work item |
| Reassign Approval Work Item Action | Reassigns a work item to a different approver |
| Recall Approval Submission Action | Recalls a submitted approval |
| Review Approval Work Item Action | Approves or rejects a specific work item |

**Metadata API Types:**
- Flow for Advanced Approvals (p1785)

---

## RC Associated Objects (Ch 13, p2853)

Chapter 13 documents objects that are automatically associated with standard Revenue Cloud objects. These follow the standard Salesforce associated-object pattern.

| Associated Object Pattern | Start Page | Description |
|---|---|---|
| StandardObjectNameChangeEvent | p2854 | Change Data Capture events for the parent object |
| StandardObjectNameFeed | p2856 | Chatter feed items on the parent object |
| StandardObjectNameHistory | p2863 | Field history tracking records |
| StandardObjectNameOwnerSharingRule | p2865 | Owner-based sharing rules |
| StandardObjectNameShare | p2867 | Manual and criteria-based sharing records |
| Event | p2868 | Activity events linked to the parent object |
| Task | p2889 | Activity tasks linked to the parent object |

> To get complete field lists for associated objects: use the describe API call, inspect the WSDL, or use the schema viewer in Setup.

---

## Deployment Architecture

### Deployment Workflow Patterns

Revenue Cloud supports three standard deployment workflow patterns. There is **no built-in RC-specific deployment tool** — use standard Salesforce or third-party tools (e.g., Salesforce CLI, Copado, Gearset).

| Pattern | Environment Chain |
|---|---|
| **Simple** | DEV1 → PROD |
| **Multi-Step** | DEV1 → SIT1 → UAT1 → PROD |
| **Complex** | DEV1 / DEV2 / DEV3 → SIT1 / SIT2 / SIT3 → UAT1 → Pre-PROD → PROD |

### Full vs. Incremental Deployment

| Type | When to Use | What Is Migrated |
|---|---|---|
| **Full Deployment** | Initial setup, major releases, or new/non-synced environments | Entire set of metadata (objects, fields, classes, triggers) **and** data from source org |
| **Incremental Deployment** | Ongoing development cycles | Only metadata components and data records created, modified, or deleted since the last successful deployment |

> Incremental deployments **require a version control system** to track the delta between environments.

---

## Important Notes & Gotchas

1. **Lightning Experience only** — Revenue Cloud has no Classic UI. All development, configuration, and end-user interaction requires Lightning Experience. Embedding RC components in Classic is unsupported.

2. **Edition-gated features** — The core platform requires Enterprise, Unlimited, or Developer Edition. Individual modules (Salesforce Pricing, Advanced Approvals, etc.) require their respective feature flags to be enabled — verify org feature availability before starting development.

3. **API version alignment** — This guide covers version 67.0 (Summer '26). Always confirm the API version your org is running matches the guide version you are referencing. Metadata API types and business API signatures can differ across versions.

4. **No RC-specific deployment tool** — Do not expect a dedicated RC migration utility. Use Salesforce CLI (`sf project deploy start`), Metadata API, or a third-party tool. Follow the incremental deployment pattern for day-to-day releases to avoid overwriting unrelated org changes.

5. **Incremental deployments need VCS** — Without a version control system, there is no reliable way to compute the delta for incremental deployments. Establish Git-based source control before the first deployment to any environment.

6. **Associated objects — always use describe for field lists** — Chapter 13 associated object pages do not enumerate every field. Use `sObject.describe()`, WSDL inspection, or the Schema Viewer to get the full field list for any StandardObjectNameHistory, StandardObjectNameShare, etc.

7. **Context Service is cross-cutting** — Context Service is not a standalone module but underpins runtime resolution for Pricing, Configurator, and DRO. Changes to Context Service configuration can have cascading effects across modules.

8. **DRO orchestrates across module boundaries** — Dynamic Revenue Orchestrator coordinates processes that span multiple RC modules. When debugging DRO failures, check the state of each upstream module (PCM, Pricing, Transaction Management) before assuming the issue is in the orchestration layer itself.

9. **Business Rules Engine is shared infrastructure** — Like Context Service, the Business Rules Engine is shared across modules. Rule evaluation errors may surface in multiple modules simultaneously if the underlying rule definition is malformed.

10. **Rate Management rating service is invocable** — The rating service can be triggered directly via its invocable action, enabling custom Flow-based usage rating outside of the standard billing run. Use this for testing rate plans in isolation.
