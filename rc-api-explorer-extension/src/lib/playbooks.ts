import type { EngineMode, ExecMode } from './chain-config';

export interface ExtractRule {
  from: string;   // JSONPath e.g. "$.catalogs[0].id"
  into: string;   // "next.body.catalogId" | "next.path.productId"
}

export interface PlaybookPermission {
  name: string;     // display label, e.g. "DRO Orchestrate Transaction User"
  apiName: string;  // PermissionSet.Name used in SOQL query
}

export interface PlaybookStep {
  id:           string;
  endpointId:   string;
  label:        string;
  seedFields?:  string[];
  initialBody?: string;  // override endpoint default request body for this step
  extract?:     ExtractRule[];
}

export interface Playbook {
  id:                   string;
  name:                 string;
  description:          string;
  mode?:                EngineMode;
  execution?:           ExecMode;
  steps:                PlaybookStep[];
  requiredPermissions?: PlaybookPermission[];
  notes?:               string;
}

export const PLAYBOOKS: Playbook[] = [
  // ─── PCM / Catalog ───────────────────────────────────────────────────────────
  {
    id:          'catalog-discovery',
    name:        'Catalog Discovery Flow',
    description: 'PCM Catalogs → Categories → Products → Product Details',
    mode:        'playbook',
    execution:   'hybrid',
    steps: [
      {
        id:         'get-catalogs',
        endpointId: 'pcm-2',
        label:      'Step 1 — Get Catalogs (PCM)',
        seedFields: [],
        extract: [
          { from: '$.catalogs[0].id', into: 'next.path.catalogId' },   // pcm-15 path param
          { from: '$.catalogs[0].id', into: 'next.body.catalogIds[0]' }, // pcm-4 body
        ],
      },
      {
        id:         'get-categories',
        endpointId: 'pcm-15',
        label:      'Step 2 — Get Categories (PCM)',
        extract: [
          { from: '$.categories[0].id', into: 'next.body.categoryIds[0]' },
        ],
      },
      {
        id:          'get-products',
        endpointId:  'pcm-4',
        label:       'Step 3 — Products List (PCM)',
        initialBody: '{\n  "correlationId": "catalog-discovery-step3",\n  "categoryIds": [],\n  "pageSize": 10,\n  "offset": 0,\n  "additionalFields": {\n    "Product2": { "fields": ["ProductCode", "Description"] }\n  }\n}',
        extract: [
          { from: '$.products[0].id', into: 'next.body.productIds[0]' },
        ],
      },
      {
        id:          'get-product-detail',
        endpointId:  'pcm-1',
        label:       'Step 4 — Bulk Product Details (PCM)',
        initialBody: '{\n  "correlationId": "catalog-discovery-step4",\n  "productIds": [],\n  "uptoLevel": 1,\n  "catalogSystems": ["pcm"],\n  "additionalFields": {\n    "Product2": { "fields": ["ProductCode", "Description"] }\n  }\n}',
      },
    ],
  },

  // ─── CPQ Quote Flow ───────────────────────────────────────────────────────────
  {
    id:          'cpq-quote-flow',
    name:        'CPQ Quote Flow',
    description: 'CPQ Catalogs → Categories → Products List → Qualification. Requires EPC-enabled catalog — CPQ catalogs differ from PCM catalogs.',
    notes:       'Requires an EPC/CPQ-enabled org with at least one CPQ catalog. PCM-only orgs will get empty results on Steps 1-2.',
    mode:        'playbook',
    execution:   'hybrid',
    steps: [
      {
        id:          'cpq-catalogs',
        endpointId:  'disc-2',
        label:       'Step 1 — Get Catalogs (CPQ)',
        initialBody: '{\n  "limit": 10,\n  "offset": 0\n}',
        extract: [
          { from: '$.catalogs[0].id', into: 'next.body.catalogId' },
        ],
      },
      {
        id:          'cpq-categories',
        endpointId:  'disc-3',
        label:       'Step 2 — Get Categories (CPQ)',
        initialBody: '{\n  "catalogId": ""\n}',
        extract: [
          { from: '$.categories[0].id', into: 'next.body.categoryId' },
        ],
      },
      {
        id:          'products-list',
        endpointId:  'disc-6',
        label:       'Step 3 — Products List (CPQ)',
        initialBody: '{\n  "catalogId": "",\n  "categoryId": "",\n  "priceBookId": "{{PRICE_BOOK_ID}}",\n  "limit": 20,\n  "enableQualification": true,\n  "enablePricing": true\n}',
        extract: [
          { from: '$.products[0].id', into: 'next.body.productIds[0]' },
        ],
      },
      {
        id:          'qualification',
        endpointId:  'disc-7',
        label:       'Step 4 — Qualification (CPQ)',
        initialBody: '{\n  "catalogId": "",\n  "productIds": []\n}',
      },
    ],
  },

  // ─── Product Setup (PCM Admin) ────────────────────────────────────────────────
  {
    id:          'product-setup',
    name:        'Product Setup Flow',
    description: 'Classification List → Products List → Deep Clone → Related Records',
    mode:        'playbook',
    execution:   'hybrid',
    steps: [
      {
        id:         'classification-list',
        endpointId: 'pcm-8',
        label:      'Step 1 — Product Classification List',
        seedFields: [],
        extract: [],
      },
      {
        id:          'products-list',
        endpointId:  'pcm-4',
        label:       'Step 2 — Products List',
        initialBody: '{\n  "correlationId": "product-setup-step2",\n  "pageSize": 10,\n  "offset": 0\n}',
        extract: [
          { from: '$.products[0].id', into: 'next.body.mainRecordId' },
        ],
      },
      {
        id:          'deep-clone',
        endpointId:  'pcm-6',
        label:       'Step 3 — Deep Clone',
        initialBody: '{\n  "mainObjectApiName": "Product2",\n  "mainRecordId": "",\n  "mainRecordFieldValues": {\n    "Name": "Cloned Product"\n  }\n}',
        extract: [
          { from: '$.createdRecordList[0].id', into: 'next.body.recordIds[0]' },
        ],
      },
      {
        id:          'related-records',
        endpointId:  'pcm-9',
        label:       'Step 4 — Product Related Records',
        initialBody: '{\n  "recordIds": [],\n  "relatedObjectNodes": [\n    {\n      "relatedObjectAPIName": "ProductRampSegment",\n      "pageSize": 20,\n      "offSet": 0\n    },\n    {\n      "relatedObjectAPIName": "ProductUsageGrant",\n      "pageSize": 10,\n      "offSet": 0\n    }\n  ]\n}',
      },
    ],
  },

  // ─── Asset Amendment Flow ─────────────────────────────────────────────────────
  {
    id:          'asset-amendment-flow',
    name:        'Asset Amendment Flow',
    description: 'Amend Asset → Submit to DRO → Decompose Sales Transaction',
    requiredPermissions: [
      { name: 'Initiate Amendment API', apiName: 'RevLifecycleManagementInitiateAmendmentApi' },
    ],
    notes: 'amendmentStartDate must fall within the asset lifecycle window. Use Browse Org → Asset to pick an active asset ID.',
    mode:        'playbook',
    execution:   'hybrid',
    steps: [
      {
        id:          'amend-asset',
        endpointId:  'txn-1',
        label:       'Step 1 — Asset Amendment',
        initialBody: '{\n  "assetIds": ["02iWs00000MtkLoIAJ"],\n  "amendmentStartDate": "2026-06-16T00:00:00",\n  "outputRecordType": "Quote",\n  "quantityChange": 1\n}',
        extract: [
          { from: '$.amendmentRecordId', into: 'next.body.inputs[0].salesTransactionId' },
        ],
      },
      {
        id:          'submit-to-dro',
        endpointId:  'dro-7',
        label:       'Step 2 — Submit to DRO',
        initialBody: '{\n  "inputs": [{\n    "salesTransactionId": "",\n    "fulfillmentAdapter": "StandardOrder"\n  }]\n}',
        extract: [
          { from: '$.compositeResponse[0].outputValues.requestId', into: 'next.body.inputs[0].salesTransactionId' },
          { from: '$.outputValues.requestId',                      into: 'next.body.inputs[0].salesTransactionId' },
        ],
      },
      {
        id:          'decompose',
        endpointId:  'dro-1',
        label:       'Step 3 — Decompose Sales Transaction',
        initialBody: '{\n  "inputs": [{\n    "salesTransactionId": "",\n    "fulfillmentAdapter": "StandardOrder"\n  }]\n}',
      },
    ],
  },

  // ─── Order Fulfillment (DRO) ──────────────────────────────────────────────────
  {
    id:          'order-fulfillment-flow',
    name:        'Order Fulfillment Flow',
    description: 'Submit Activated Order to DRO (submitSalesTransaction handles decompose + orchestrate). Use Browse Org → Order to pick an Activated Order ID.',
    requiredPermissions: [
      { name: 'DRO Orchestrate Transaction User',  apiName: 'DROOrchestrateTransactionUser' },
      { name: 'DRO Order Submit Initiate User',     apiName: 'DROOrderSubmitInitiateUser' },
      { name: 'DRO Callout Permission Set',         apiName: 'DRO_CallOut_Permission_Set' },
      { name: 'Orchestration Process Manager',      apiName: 'OrchestrationProcessManagerPermissionSet' },
      { name: 'Order Submit User',                  apiName: 'OrderSubmitUser' },
    ],
    notes: 'Requires an Activated Order (not Quote). submitSalesTransaction runs decompose + orchestrate atomically.',
    mode:        'playbook',
    execution:   'hybrid',
    steps: [
      {
        id:          'submit-to-dro',
        endpointId:  'dro-7',
        label:       'Step 1 — Submit to DRO (submitSalesTransaction)',
        initialBody: '{\n  "inputs": [{\n    "salesTransactionId": "801Ws00005nZc3fIAC",\n    "fulfillmentAdapter": "StandardOrder"\n  }]\n}',
        extract: [
          { from: '$.outputValues.requestId', into: 'next.body.inputs[0].salesTransactionId' },
        ],
      },
      {
        id:          'decompose',
        endpointId:  'dro-1',
        label:       'Step 2 — Decompose Sales Transaction',
        initialBody: '{\n  "inputs": [{\n    "salesTransactionId": "",\n    "fulfillmentAdapter": "StandardOrder"\n  }]\n}',
      },
    ],
  },

  // ─── Invoice Billing Flow ─────────────────────────────────────────────────────
  {
    id:          'invoice-billing-flow',
    name:        'Invoice Billing Flow',
    description: 'Generate Invoice (Draft) → Estimated Tax → Post Invoice. Step 1 response has no invoiceId — use Browse Org → Invoice after Step 1 to inject the ID into Steps 2 & 3.',
    requiredPermissions: [
      { name: 'Billing Admin',            apiName: 'RevenueLifecycleManagementBillingAdmin' },
      { name: 'Billing Operations',       apiName: 'RevenueLifecycleManagementBillingOperations' },
      { name: 'Calculate Taxes API',      apiName: 'RevLifecycleManagementCalculateTaxesApi' },
    ],
    notes: 'bill-1 returns {success:true, requestIdentifier:"..."} only — no invoiceId in response. After Step 1 completes, use Browse Org → Invoice to find the new draft invoice and inject its ID into Steps 2 & 3.',
    mode:        'playbook',
    execution:   'hybrid',
    steps: [
      {
        id:          'generate-invoice-draft',
        endpointId:  'bill-1',
        label:       'Step 1 — Generate Invoice (Draft)',
        initialBody: '{\n  "action": "Draft",\n  "invoiceDate": "2026-06-14",\n  "targetDate": "2026-06-14",\n  "accountId": "001Ws00005hj62oIAA"\n}',
      },
      {
        id:          'calculate-tax',
        endpointId:  'bill-est-tax',
        label:       'Step 2 — Estimated Tax Calculation',
        initialBody: '{\n  "invoiceIds": []\n}',
      },
      {
        id:          'post-invoice',
        endpointId:  'bill-9',
        label:       'Step 3 — Invoice Draft to Posted',
        initialBody: '{\n  "invoiceIds": []\n}',
      },
    ],
  },

  // ─── Configurator Flow ───────────────────────────────────────────────────────
  {
    id:          'configurator-flow',
    name:        'Configurator Flow',
    description: 'Place Sales Transaction (Quote + Line Item) → Load Instance → Add Nodes → Update Nodes → Get Instance → Save Instance',
    requiredPermissions: [
      { name: 'Product Configurator',              apiName: 'IndustriesConfiguratorPlatformApi' },
      { name: 'Product Configurator API User',     apiName: 'Product_Configurator_API_User' },
      { name: 'Advanced Configurator Designer',    apiName: 'AdvancedConfiguratorDesigner' },
    ],
    notes: 'Configurator endpoints use v60.0. contextId is ephemeral — it is assigned by load-instance and only lives in memory until save-instance persists it back to the Quote. Config Rules Execute (cfg-4) requires a separate org feature (FUNCTIONALITY_NOT_ENABLED on most orgs). Composite API does not support /connect/cpq/ endpoints — steps must be sequential.',
    mode:        'playbook',
    execution:   'hybrid',
    steps: [
      {
        id:          'create-quote',
        endpointId:  'txn-9',
        label:       'Step 1 — Place Sales Transaction (Quote + Line Item)',
        initialBody: '{\n  "graph": {\n    "graphId": "createQuoteWithLine",\n    "records": [\n      {\n        "referenceId": "refQuote",\n        "record": {\n          "attributes": { "type": "Quote", "method": "POST" },\n          "OpportunityId": "{{OPPORTUNITY_ID}}",\n          "Pricebook2Id": "{{PRICEBOOK_ID}}",\n          "Name": "Configurator POC"\n        }\n      },\n      {\n        "referenceId": "refQLI",\n        "record": {\n          "attributes": { "type": "QuoteLineItem", "method": "POST" },\n          "QuoteId": "@{refQuote.id}",\n          "PricebookEntryId": "{{PRICEBOOK_ENTRY_ID}}",\n          "Product2Id": "{{PRODUCT_ID}}",\n          "Quantity": 5,\n          "UnitPrice": 4.70\n        }\n      }\n    ]\n  }\n}',
        extract: [
          { from: '$.salesTransactionId', into: 'next.body.transactionId' },
        ],
      },
      {
        id:          'load-instance',
        endpointId:  'cfg-5',
        label:       'Step 2 — Load Instance → contextId',
        initialBody: '{\n  "transactionId": "",\n  "configuratorOptions": {\n    "addDefaultConfiguration": true,\n    "executeConfigurationRules": true,\n    "executePricing": true,\n    "qualifyAllProductsInTransaction": true,\n    "validateAmendRenewCancel": false,\n    "validateProductCatalog": true,\n    "returnProductCatalogData": false\n  },\n  "qualificationContext": {}\n}',
        extract: [
          { from: '$.contextId', into: 'next.body.contextId' },
        ],
      },
      {
        id:          'add-nodes',
        endpointId:  'cfg-3',
        label:       'Step 3 — Add Nodes',
        initialBody: '{\n  "contextId": "",\n  "configuratorOptions": {\n    "executePricing": true,\n    "returnProductCatalogData": false,\n    "qualifyAllProductsInTransaction": true,\n    "validateProductCatalog": true,\n    "validateAmendRenewCancel": false,\n    "executeConfigurationRules": true,\n    "addDefaultConfiguration": false\n  },\n  "qualificationContext": {},\n  "addedNodes": [\n    {\n      "path": ["{{QUOTE_ID}}", "{{REF_NODE_ID}}"],\n      "addedObject": {\n        "id": "{{REF_NODE_ID}}",\n        "SalesTransactionItemSource": "{{REF_NODE_ID}}",\n        "SalesTransactionItemParent": "{{QUOTE_ID}}",\n        "PricebookEntry": "{{PRICEBOOK_ENTRY_ID}}",\n        "Product": "{{PRODUCT_ID}}",\n        "Quantity": 1,\n        "UnitPrice": 4.70,\n        "businessObjectType": "QuoteLineItem"\n      }\n    }\n  ]\n}',
        extract: [
          { from: '$.contextId', into: 'next.body.contextId' },
        ],
      },
      {
        id:          'update-nodes',
        endpointId:  'cfg-8',
        label:       'Step 4 — Update Nodes (Quantity)',
        initialBody: '{\n  "contextId": "",\n  "configuratorOptions": {\n    "executePricing": true,\n    "returnProductCatalogData": false,\n    "executeConfigurationRules": true\n  },\n  "qualificationContext": {},\n  "updatedNodes": [\n    {\n      "path": ["{{QUOTE_ID}}", "{{REF_NODE_ID}}"],\n      "updatedAttributes": { "Quantity": 10 }\n    }\n  ]\n}',
        extract: [
          { from: '$.contextId', into: 'next.body.contextId' },
        ],
      },
      {
        id:          'get-instance',
        endpointId:  'cfg-10',
        label:       'Step 5 — Get Instance (read final state)',
        initialBody: '{\n  "contextId": ""\n}',
        extract: [
          { from: '$.contextId', into: 'next.body.contextId' },
        ],
      },
      {
        id:          'save-instance',
        endpointId:  'cfg-9',
        label:       'Step 6 — Save Instance (persist to Quote)',
        initialBody: '{\n  "contextId": ""\n}',
      },
    ],
  },

  // ─── Usage Summary Flow ───────────────────────────────────────────────────────
  {
    id:          'usage-summary-flow',
    name:        'Usage Summary Flow',
    description: 'Asset Usage Details → Invoke Summary Creation → Process Overages → Invoke Rating. Requires usage entitlements configured in org.',
    notes: 'Steps 2-4 require usage entitlement objects (UsageRatableSummary etc.) to exist in org. This flow may not work on orgs without usage entitlement setup.',
    mode:        'playbook',
    execution:   'hybrid',
    steps: [
      {
        id:          'asset-usage',
        endpointId:  'usage-1',
        label:       'Step 1 — Asset Usage Details',
        initialBody: '{\n  "assetId": "02iWs00000MtkLpIAJ"\n}',
        extract: [
          { from: '$.grants[0].id', into: 'next.body.inputs[0].usageEntitlementAccountId' },
        ],
      },
      {
        id:          'invoke-summary',
        endpointId:  'usage-8',
        label:       'Step 2 — Invoke Summary Creation',
        initialBody: '{\n  "inputs": [{\n    "usageEntitlementAccountId": ""\n  }]\n}',
        extract: [
          { from: '$.compositeResponse[0].outputValues.usageRatableSummaryId', into: 'next.body.inputs[0].usageRatableSummaryId' },
          { from: '$.outputValues.usageRatableSummaryId',                      into: 'next.body.inputs[0].usageRatableSummaryId' },
        ],
      },
      {
        id:          'process-overages',
        endpointId:  'usage-9',
        label:       'Step 3 — Process Consumption Overages',
        initialBody: '{\n  "inputs": [{\n    "usageRatableSummaryId": ""\n  }]\n}',
        extract: [
          { from: '$.compositeResponse[0].outputValues.usageRatableSummaryId', into: 'next.body.inputs[0].usageRatableSummaryId' },
        ],
      },
      {
        id:          'invoke-rating',
        endpointId:  'rate-3',
        label:       'Step 4 — Invoke Rating Service',
        initialBody: '{\n  "inputs": [{\n    "contextDefinitionId": "",\n    "recordId": ""\n  }]\n}',
      },
    ],
  },

  // ─── Configurator Session Flow ─────────────────────────────────────────────
  {
    id:          'cfg-session-flow-v1',
    name:        'Configurator Session Flow',
    description: 'Load configurator session → add product nodes → run config rules → save instance.',
    mode:        'playbook',
    execution:   'step',
    steps: [
      {
        id:          's1',
        endpointId:  'cfg-5',
        label:       'Step 1 — Load Instance (get contextId)',
        initialBody: '{\n  "transactionId": "{{QUOTE_ID}}",\n  "qualificationContext": { "accountId": "{{ACCOUNT_ID}}" },\n  "configuratorOptions": {\n    "executePricing": true,\n    "executeConfigurationRules": true,\n    "addDefaultConfiguration": true,\n    "validateProductCatalog": true\n  }\n}',
        extract: [
          { from: '$.contextId', into: 'next.body.contextId' },
        ],
      },
      {
        id:          's2',
        endpointId:  'cfg-3',
        label:       'Step 2 — Add Nodes',
        initialBody: '{\n  "contextId": "{{CFG_CONTEXT_ID}}",\n  "configuratorOptions": {\n    "executePricing": true,\n    "executeConfigurationRules": true\n  },\n  "addedNodes": []\n}',
        extract: [],
      },
      {
        id:          's3',
        endpointId:  'cfg-4',
        label:       'Step 3 — Run Config Rules',
        initialBody: '{\n  "transactionId": "{{QUOTE_ID}}",\n  "transactionContextId": "{{CFG_CONTEXT_ID}}",\n  "ruleOptions": { "isUpdateContextRequired": false }\n}',
        extract: [],
      },
      {
        id:          's4',
        endpointId:  'cfg-9',
        label:       'Step 4 — Save Instance',
        initialBody: '{\n  "contextId": "{{CFG_CONTEXT_ID}}"\n}',
        extract: [],
      },
    ],
  },
];
