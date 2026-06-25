export interface Param {
  name: string;
  type: string;
  req: boolean;
  desc: string;
  location?: 'body' | 'query' | 'path'; // defaults to 'body' for POST, 'query' for GET
}

export interface EndpointExample {
  type: string;
  label: string;
  desc: string;
  steps: string[];
  body: string;
}

export interface Endpoint {
  id: string;
  category: string;
  name: string;
  methods: string[];
  path: string;
  version: string;
  desc: string;
  page: number;
  params: Param[];
  request: string;
  response: string;
  examples?: EndpointExample[];
}

export const ENDPOINTS: Endpoint[] = [
  // PCM
  { id:'pcm-1', category:'PCM', name:'Bulk Product Details', methods:['POST'],
    path:'/connect/pcm/products/bulk', version:'v61.0',
    desc:'Retrieve details for multiple products in one request. Returns attributes, child components, selling models, and additional fields.',
    page:148,
    params:[
      {name:'correlationId',type:'String',req:false,desc:'Unique token to track related events. If unspecified, a UUID is generated.'},
      {name:'productIds',type:'String[]',req:true,desc:'List of product IDs to retrieve details for. Invalid/blank/not-found IDs are skipped.'},
      {name:'uptoLevel',type:'Integer',req:false,desc:'Hierarchy level for bundle child components. Max value is 1. Default is full bundle hierarchy.'},
      {name:'language',type:'String',req:false,desc:'Custom language for translated fields (e.g. "en_US", "french"). Available from v64.0.'},
      {name:'catalogSystems',type:'String[]',req:false,desc:'Catalog system to fetch from: "epc" or "pcm" (default). Pass only one value. Available from v66.0.'},
      {name:'additionalFields',type:'Map<String,Object>',req:false,desc:'Extra fields per object. Supported objects: Product2, ProductAttributeDefinition. Format: { "Product2": { "fields": ["ProductCode"] } }'},
    ],
    request:'{\n  "correlationId": "test-bulk-001",\n  "productIds": [\n    "{{PRODUCT_ID}}"\n  ],\n  "uptoLevel": 1,\n  "catalogSystems": ["pcm"],\n  "additionalFields": {\n    "Product2": {\n      "fields": ["Description", "ProductCode"]\n    }\n  }\n}',
    response:'{\n  "correlationId": "test-bulk-001",\n  "facets": [],\n  "products": [\n    {\n      "id": "01tSa00000AzpIaIAJ",\n      "name": "ADM Offer",\n      "productCode": "BUND-SUB-ADM",\n      "nodeType": "bundleProduct",\n      "isActive": true,\n      "isAssetizable": true,\n      "configureDuringSale": "Allowed",\n      "productSpecificationType": { "name": "Commercial" },\n      "additionalFields": { "ProductCode": "BUND-SUB-ADM" },\n      "attributeCategory": [\n        {\n          "name": "Subscription Details",\n          "attributes": [\n            { "name": "Subscription Term", "dataType": "Picklist", "defaultValue": "36", "isRequired": true, "picklist": { "values": [{"value":"1"},{"value":"12"},{"value":"24"},{"value":"36"},{"value":"48"},{"value":"60"}] } },\n            { "name": "Subscription type", "dataType": "Picklist", "defaultValue": "PURCHASE", "isRequired": true },\n            { "name": "Vehicle Type", "dataType": "Picklist", "isRequired": true, "picklist": { "values": [{"value":"LCVCar"},{"value":"TruckBus"}] } },\n            { "name": "Tariff Type", "dataType": "Picklist", "defaultValue": "ADM", "isRequired": true }\n          ]\n        }\n      ],\n      "productComponentGroups": [\n        {\n          "name": "Features",\n          "maxBundleComponents": 2,\n          "components": [\n            { "name": "Webfleet Vehicle Check", "productCode": "ADDON-SUB-WF-VEHICLE-CHECK" },\n            { "name": "Webfleet Plugin", "productCode": "ADDON-SUB-WF-PLUGIN" },\n            { "name": "WEBFLEET eLogs", "productCode": "ADDON-SUB-WF-ELOGS" }\n          ]\n        }\n      ],\n      "productSellingModelOptions": [\n        { "isDefault": true, "productSellingModel": { "name": "Evergreen - Monthly", "sellingModelType": "Evergreen", "pricingTerm": 1, "pricingTermUnit": "Months" } }\n      ]\n    }\n  ]\n}' },

  { id:'pcm-2', category:'PCM', name:'Catalog List', methods:['POST'],
    path:'/connect/pcm/catalogs', version:'v60.0',
    desc:'Returns a list of catalogs. Empty body returns all catalogs. Filter supports name and catalogType fields.',
    page:132,
    params:[
      {name:'correlationId',type:'String',req:false,desc:'Unique token to track related events. If unspecified, a UUID is generated.'},
      {name:'filter',type:'Filter',req:false,desc:'Criteria to filter ProductCatalog records. Supported operators: eq, in, contains. Supported properties: name, catalogType.'},
      {name:'language',type:'String',req:false,desc:'Custom language for translated fields (e.g. "en_US", "french"). Requires object translation to be enabled. Available from v64.0.'},
      {name:'offset',type:'Integer',req:false,desc:'Number of records to skip. Default 0.'},
      {name:'pageSize',type:'Integer',req:false,desc:'Records per page. Valid values 1–100. Default 100.'},
      {name:'sort',type:'Sort',req:false,desc:'Sort order. Contains "orders" array with objects having "property" (e.g. "name") and "direction" ("asc" or "desc").'},
    ],
    request:'{\n  "correlationId": "test-catalog-001",\n  "pageSize": 10,\n  "offset": 0,\n  "filter": {\n    "criteria": [\n      {\n        "property": "catalogType",\n        "operator": "eq",\n        "value": "Sales"\n      }\n    ]\n  },\n  "sort": {\n    "orders": [\n      {\n        "property": "name",\n        "direction": "desc"\n      }\n    ]\n  }\n}',
    response:'{\n  "catalogs": [{\n    "id": "0ZSAU000000ANZd4AO",\n    "name": "CAR and LCV",\n    "catalogType": "Sales",\n    "numberOfCategories": 2\n  }],\n  "count": 1,\n  "status": {"code": "200","errors": []}\n}' },

  { id:'pcm-3', category:'PCM', name:'Catalog By ID', methods:['GET'],
    path:'/connect/pcm/catalogs/{catalogId}', version:'v60.0',
    desc:'Returns details about a specific catalog.',
    page:154,
    params:[
      {name:'catalogId',type:'String',req:true,location:'path',desc:'ID of the catalog.'},
      {name:'correlationId',type:'String',req:false,location:'query',desc:'(v60.0) Unique token to track related events. If unspecified, a UUID is generated.'},
      {name:'language',type:'String',req:false,location:'query',desc:'(v64.0) Custom language to retrieve translated field data for objects enabled for translation.'},
      {name:'fields',type:'String[]',req:false,location:'query',desc:'(v60.0) For internal use only.'},
    ],
    request:'No request body. Catalog ID is a path param. Add ?correlationId=my-req-001 as needed.',
    response:'{\n  "id": "0ZSAU000000ANZd4AO",\n  "name": "CAR and LCV",\n  "catalogType": "Sales",\n  "isActive": true,\n  "categories": [\n    {"id": "0ZGAU000000BC2h4AG","name": "Configurable"},\n    {"id": "0ZGAU000000BC2k4AG","name": "PreConfigured"}\n  ],\n  "numberOfCategories": 2\n}' },

  { id:'pcm-4', category:'PCM', name:'Products List', methods:['POST'],
    path:'/connect/pcm/products', version:'v60.0',
    desc:'Returns a list of products matching the filter criteria. POST is used to retrieve (not create). Specify at least one of: catalogIds, categoryIds, or productClassificationId.',
    page:147,
    params:[
      {name:'properties',type:'String',req:false,location:'query',desc:'(v60.0) Comma-separated product properties to sort/filter on. Supported values: name, description, isActive. If the "Use Indexed Data For Product Listing and Search" toggle is enabled in Setup, only "name" is supported.'},
      {name:'correlationId',type:'String',req:false,location:'body',desc:'Client-supplied correlation ID echoed back in the response for tracing.'},
      {name:'productClassificationId',type:'String',req:false,location:'body',desc:'(v60.0) ID of the product classification template. Specify either productClassificationId, categoryIds, or catalogIds.'},
      {name:'catalogIds',type:'List<String>',req:false,location:'body',desc:'(v60.0) List of catalog IDs. Specify either catalogIds, categoryIds, or productClassificationId.'},
      {name:'categoryIds',type:'List<String>',req:false,location:'body',desc:'(v60.0) List of category IDs. Specify either categoryIds, catalogIds, or productClassificationId.'},
      {name:'searchTerm',type:'String',req:false,location:'body',desc:'(v62.0) Returns products whose name contains this search term. See Search Considerations When Using Indexed Data.'},
      {name:'filter',type:'Criteria Input',req:false,location:'body',desc:'(v60.0) Filter criteria for Product2 fields. Supported operators: eq, in, contains (not supported when "Use Indexed Data" toggle is enabled), gt/lt/gte/lte (v63.0+, Number/Date/Datetime types only). Multiple criteria are combined with AND. Supported properties: name, description, isActive — only "name" when indexed data is enabled. Format: {"criteria":[{"property":"name","operator":"contains","value":"Bundle"}]}'},
      {name:'additionalFields',type:'Map<String,Additional Fields Input>',req:false,location:'body',desc:'(v61.0) Extra standard/custom Product2 fields to return. Supported object: Product2 only. Format: {"Product2":{"fields":["ProductCode","Description"]}}'},
      {name:'relatedObjectFilters',type:'Related Object Filter[]',req:false,location:'body',desc:'(v60.0) Filter records by related object criteria. Supported object: ProductSpecificationRecType. Supported property: IsCommercial. Supported values: true, false. Supported operator: eq only.'},
      {name:'language',type:'String',req:false,location:'body',desc:'(v64.0) Custom language to retrieve translated field data for objects enabled for translation. Example: "en_US", "spanish". See Translate Product and Product Category Data.'},
      {name:'pageSize',type:'Integer',req:false,location:'body',desc:'(v60.0) Records per page. Valid values: 1–200. Default: 100.'},
      {name:'offset',type:'Integer',req:false,location:'body',desc:'(v60.0) Number of records to skip. Default: 0.'},
      {name:'sort',type:'Sort',req:false,location:'body',desc:'(v60.0) Sort order for products. If the "Use Indexed Data For Product Listing and Search" toggle is enabled in Setup, you can sort by name only. Format: {"orders":[{"property":"name","direction":"asc"}]}'},
    ],
    request:'{\n  "correlationId": "my-request-001",\n  "catalogIds": [\n    "0ZSxx0000000001AAA"\n  ],\n  "pageSize": 10,\n  "offset": 0,\n  "filter": {\n    "criteria": [\n      { "property": "name", "operator": "contains", "value": "Bundle" }\n    ]\n  },\n  "additionalFields": {\n    "Product2": { "fields": ["ProductCode", "Description"] }\n  }\n}',
    response:'{\n  "correlationId": "poc-pcm4-full",\n  "facets": [],\n  "products": [\n    {\n      "additionalFields": { "ProductCode": "BUND-SUB-ADM" },\n      "catalogs": [{ "id": "0ZSAU000000ANZd4AO", "name": "CAR and LCV" }],\n      "categories": [{ "catalogId": "0ZSAU000000ANZd4AO", "id": "0ZGAU000000BC2h4AG", "name": "Configurable" }],\n      "id": "01tSa00000AzpIaIAJ",\n      "isActive": true,\n      "name": "ADM Offer",\n      "nodeType": "bundleProduct",\n      "productCode": "BUND-SUB-ADM",\n      "productSellingModelOptions": [{ "id": "0iOSa00000007SjMAI", "isDefault": true }],\n      "productSpecificationType": { "name": "Commercial" }\n    }\n  ],\n  "status": { "code": "200", "message": "Successfully fetched Product records." }\n}' },

  { id:'pcm-5', category:'PCM', name:'Product Details', methods:['GET'],
    path:'/connect/pcm/products/{productId}', version:'v60.0',
    desc:'Returns details for a specific product by its ID. Use GET only; POST is treated as Products List.',
    page:144,
    params:[
      {name:'productId',type:'String',req:true,location:'path',desc:'ID of the product.'},
      {name:'correlationId',type:'String',req:false,location:'query',desc:'(v60.0) Unique token to track related events. If unspecified, a UUID is generated.'},
      {name:'language',type:'String',req:false,location:'query',desc:'(v64.0) Custom language to retrieve translated field data for objects enabled for translation.'},
      {name:'catalogSystems',type:'String[]',req:false,location:'query',desc:'(v66.0) Catalog system: epc (Enterprise Product Catalog) or pcm (default). Pass only one value.'},
      {name:'fields',type:'String[]',req:false,location:'query',desc:'(v60.0) For internal use only.'},
    ],
    request:'No request body. Product ID is a path param. Add ?language=en_US&catalogSystems=pcm as needed.',
    response:'{\n  "id": "01tSa00000AzpIaIAJ",\n  "name": "ADM Offer",\n  "productCode": "BUND-SUB-ADM",\n  "isActive": true,\n  "isAssetizable": true,\n  "nodeType": "bundleProduct",\n  "configureDuringSale": "Allowed",\n  "displayUrl": "/resource/SUNProductImages/ImageZipFileV1/offers-adm.jpg",\n  "productSpecificationType": {"name": "Commercial"},\n  "productClassification": {"id": "11BAU00000EUCaw2AH"},\n  "catalogs": [{"id": "0ZSAU000000ANZd4AO","name": "CAR and LCV"}],\n  "productSellingModelOptions": [\n    {"id": "0iOSa00000007SjMAI","isDefault": true,"productSellingModel": {"name": "Evergreen - Monthly","sellingModelType": "Evergreen","pricingTerm": 1,"pricingTermUnit": "Months","status": "Active"}}\n  ],\n  "attributeCategory": [],\n  "productComponentGroups": [],\n  "productUnitOfMeasures": []\n}' },

  { id:'pcm-6', category:'PCM', name:'Deep Clone', methods:['POST'],
    path:'/connect/pcm/deep-clone', version:'v63.0',
    desc:'Creates a deep clone of a product and all associated records.',
    page:158,
    params:[
      {name:'mainObjectApiName',type:'String',req:true,desc:'API name of the primary object to clone (e.g. "Product2").'},
      {name:'mainRecordId',type:'String',req:true,desc:'ID of the record to clone.'},
      {name:'mainRecordFieldValues',type:'Map<String,String>',req:false,desc:'Map of field API name to string value on the cloned record. Only the Name field is supported (e.g. {"Name": "Cloned Product"}).'},
    ],
    request:'{\n  "mainObjectApiName": "Product2",\n  "mainRecordId": "{{PRODUCT_ID}}",\n  "mainRecordFieldValues": {\n    "Name": "Cloned Product"\n  }\n}',
    response:'{\n  "createdRecordList": [{"id": "01txx0000000003AAA","objectApiName": "Product2"}],\n  "errorList": [],\n  "isSuccessful": true\n}' },

  { id:'pcm-7', category:'PCM', name:'Product Classification Details', methods:['POST'],
    path:'/revenue/product-catalog-management/product-classifications/details', version:'v66.0',
    desc:'Retrieve details for a list of product classification records (metadata, attributes, attribute categories).',
    page:141,
    params:[
      {name:'productClassificationIds',type:'String[]',req:true,desc:'List of product classification IDs. In epc catalog these are Product2 record IDs.'},
      {name:'catalogSystems',type:'String[]',req:false,desc:'Catalog system filter. Valid value: "epc" (Enterprise Product Catalog) only. Unlike the Bulk Product Details API, "pcm" is not valid here.'},
    ],
    request:'{\n  "productClassificationIds": [\n    "{{PRODUCT_CLASSIFICATION_ID}}"\n  ],\n  "catalogSystems": [\n    "epc"\n  ]\n}',
    response:'{\n  "productClassifications": [\n    {\n      "id": "11BAU00000EUCaw2AH",\n      "name": "Commercial",\n      "catalogSystem": "pcm",\n      "attributeCategories": [\n        {\n          "name": "Subscription Details",\n          "attributes": [\n            {"name": "Subscription Term","dataType": "Picklist","isRequired": true},\n            {"name": "Vehicle Type","dataType": "Picklist","isRequired": true}\n          ]\n        }\n      ]\n    }\n  ],\n  "success": true\n}' },

  { id:'pcm-8', category:'PCM', name:'Product Classification List', methods:['POST'],
    path:'/revenue/product-catalog-management/product-classifications/list', version:'v67.0',
    desc:'[Preview/unverified path] Retrieve a paginated list of product classification records. Can search, filter, and sort. POST is used to retrieve.',
    page:142,
    params:[
      {name:'catalogSystem',type:'String',req:false,desc:'Catalog system: pcm (default) or epc.'},
      {name:'searchTerm',type:'String',req:false,desc:'Search by product classification name.'},
      {name:'filter',type:'Criteria Input',req:false,desc:'Filter by name. Operators: eq, in, contains.'},
      {name:'sort',type:'Order Input',req:false,desc:'Sort order. Default: name ascending.'},
      {name:'pageSize',type:'Integer',req:false,desc:'Records per page: 5, 10, 25, 50, or 100. Default 100.'},
      {name:'offset',type:'Integer',req:false,desc:'Records to skip. Default 0.'},
    ],
    request:'{\n  "catalogSystem": "pcm",\n  "searchTerm": "Mobile",\n  "filter": {\n    "criteria": [\n      {\n        "property": "name",\n        "operator": "contains",\n        "value": "Mobile"\n      }\n    ]\n  },\n  "sort": {\n    "orders": [{"property": "name","direction": "asc"}]\n  },\n  "pageSize": 25,\n  "offset": 0\n}',
    response:'{\n  "productClassifications": [\n    {"id": "11BAU00000EUCaw2AH","name": "Commercial"},\n    {"id": "11BAU00000EUCaw3AH","name": "Industrial"}\n  ],\n  "totalCount": 2,\n  "success": true,\n  "errors": []\n}' },

  { id:'pcm-9', category:'PCM', name:'Product Related Records List', methods:['POST'],
    path:'/connect/pcm/relatedRecords/{entityName}', version:'v62.0',
    desc:'Retrieve related ProductRampSegment or ProductUsageGrant records for a Product2 object. POST is used to retrieve.',
    page:145,
    params:[
      {name:'entityName',type:'String',req:true,location:'path',desc:'Entity name. Path param. Supported value: product2.'},
      {name:'recordIds',type:'String[]',req:true,desc:'List of record IDs (max 20).'},
      {name:'relatedObjectNodes',type:'Related Object Node Input[]',req:true,desc:'List of related object nodes (max 2). Each has relatedObjectAPIName, pageSize, offSet, and optional filter.'},
      {name:'correlationId',type:'String',req:false,desc:'Unique token for tracking.'},
    ],
    request:'{\n  "recordIds": [\n    "{{PRODUCT_ID}}"\n  ],\n  "relatedObjectNodes": [\n    {\n      "relatedObjectAPIName": "ProductRampSegment",\n      "pageSize": 20,\n      "offSet": 0\n    },\n    {\n      "relatedObjectAPIName": "ProductUsageGrant",\n      "pageSize": 10,\n      "offSet": 0,\n      "filter": {\n        "criteria": [\n          {"property": "status","operator": "eq","value": "active"}\n        ]\n      }\n    }\n  ]\n}',
    response:'{\n  "correlationId": "related-001",\n  "relatedRecords": {\n    "01tSa00000AzpIaIAJ": {\n      "ProductRampSegment": {\n        "records": [],\n        "totalCount": 0\n      },\n      "ProductUsageGrant": {\n        "records": [],\n        "totalCount": 0\n      }\n    }\n  },\n  "status": {"code": "200","message": "Success"}\n}' },

  { id:'pcm-10', category:'PCM', name:'Snapshot Collection', methods:['GET'],
    path:'/connect/pcm/index/snapshots', version:'v62.0',
    desc:'Retrieve the created snapshots and snapshot indexes.',
    page:151,
    params:[
      {name:'numberOfIndexLogs',type:'Integer',req:false,desc:'Number of index logs to include in the response (0–100). Default 25. Available from v63.0.'},
    ],
    request:'No request body.',
    response:'{\n  "errors": [],\n  "snapshots": [\n    {\n      "id": "1AvAP000000FHer0AG",\n      "activationType": "IMMEDIATE",\n      "snapshotIndexes": []\n    }\n  ],\n  "statusCode": "200"\n}' },

  { id:'pcm-11', category:'PCM', name:'Snapshot Deployment', methods:['POST'],
    path:'/connect/pcm/index/deploy', version:'v62.0',
    desc:'Create indexes for a snapshot to improve search results and make it easier to find products at run time.',
    page:151,
    params:[
      {name:'buildType',type:'String',req:true,desc:'Index build type: FULL (full index build) or INCREMENTAL (incremental build — available from v63.0 and later).'},
      {name:'snapshot',type:'Run-time Catalog Snapshot Input[]',req:true,desc:'Snapshot to deploy. Contains activationType (IMMEDIATE) and optional id for rebuilding.'},
    ],
    request:'{\n  "snapshot": {\n    "activationType": "IMMEDIATE"\n  },\n  "buildType": "FULL"\n}',
    response:'{\n  "errors": [],\n  "snapshot": {\n    "id": "1AvAP000000FHer0AG",\n    "activationStatus": "NONE",\n    "snapshotIndexes": []\n  },\n  "statusCode": "200"\n}' },

  { id:'pcm-12', category:'PCM', name:'Snapshot Index Error', methods:['GET'],
    path:'/connect/pcm/index/error', version:'v63.0',
    desc:'Get the count and details of errors that occurred during the indexing process.',
    page:152,
    params:[
      {name:'indexId',type:'String',req:true,location:'query',desc:'ID of the index (starts with 0ax).'},
      {name:'snapshotIndexId',type:'String',req:true,location:'query',desc:'ID of the snapshot index (starts with 1D6).'},
    ],
    request:'No request body.',
    response:'{\n  "errorCount": 0,\n  "errors": []\n}' },

  { id:'pcm-13', category:'PCM', name:'Unit of Measure Info', methods:['GET'],
    path:'/connect/pcm/unit-of-measure/info', version:'v63.0',
    desc:'Get details about the unit of measure for a specific set of records.',
    page:153,
    params:[
      {name:'ids',type:'String',req:false,location:'query',desc:'IDs of the unit of measure records (comma-separated).'},
      {name:'correlationId',type:'String',req:false,location:'query',desc:'Unique tracking token.'},
    ],
    request:'No request body.',
    response:'{\n  "correlationId": "uom-info-001",\n  "uomIdToUnitOfMeasureInfo": {\n    "0hExx0000000001EAA": {\n      "id": "0hExx0000000001EAA",\n      "name": "Each",\n      "symbol": "ea",\n      "decimalPlaces": 0,\n      "roundingMode": "HalfUp"\n    }\n  },\n  "status": {"code": "200"}\n}' },

  { id:'pcm-14', category:'PCM', name:'Unit of Measure Rounded Data', methods:['POST'],
    path:'/connect/pcm/unit-of-measure/rounded-data', version:'v63.0',
    desc:'Round off and scale decimal data for a specific set of fields.',
    page:153,
    params:[
      {name:'dataRowInputs',type:'Data Row Input[]',req:true,desc:'List of row inputs for rounding. Each has key and fieldDataInputs (fieldApiName, originalValue, unitOfMeasureId).'},
      {name:'correlationId',type:'String',req:false,desc:'Unique tracking token.'},
    ],
    request:'{\n  "dataRowInputs": [\n    {\n      "key": "PRC1",\n      "fieldDataInputs": [\n        {\n          "fieldApiName": "MaxQuantity",\n          "originalValue": 1234.5678,\n          "unitOfMeasureId": "0hExx0000000001EAA"\n        },\n        {\n          "fieldApiName": "MinQuantity",\n          "originalValue": 98.7463,\n          "unitOfMeasureId": "0hExx0000000001dEAA"\n        }\n      ]\n    }\n  ]\n}',
    response:'{\n  "correlationId": "uom-round-001",\n  "keyToDataRowOutput": {\n    "PRC1": {\n      "key": "PRC1",\n      "fieldDataOutputs": [\n        {"fieldApiName": "MaxQuantity","roundedValue": 1234.57,"unitOfMeasureId": "0hExx0000000001EAA"},\n        {"fieldApiName": "MinQuantity","roundedValue": 98.75,"unitOfMeasureId": "0hExx0000000001dEAA"}\n      ]\n    }\n  },\n  "status": {"code": "200"}\n}' },

  { id:'pcm-15', category:'PCM', name:'Categories List (PCM)', methods:['GET'],
    path:'/connect/pcm/catalogs/{catalogId}/categories', version:'v60.0',
    desc:'Returns a list of categories and subcategories in a catalog.',
    page:155,
    params:[
      {name:'catalogId',type:'String',req:true,location:'path',desc:'ID of the catalog.'},
      {name:'correlationId',type:'String',req:false,location:'query',desc:'(v60.0) Unique token to track related events. If unspecified, a UUID is generated.'},
      {name:'depth',type:'Integer',req:false,location:'query',desc:'(v60.0) Number of levels in the category hierarchy to return. Default: 1.'},
      {name:'fields',type:'String[]',req:false,location:'query',desc:'(v60.0) List of fields to return in each category. If not specified, all fields are returned.'},
      {name:'language',type:'String',req:false,location:'query',desc:'(v64.0) Custom language to retrieve translated field data.'},
      {name:'parentCategoryId',type:'String',req:false,location:'query',desc:'(v60.0) ID of the category to fetch its subcategory hierarchy. If unspecified, root-level categories are returned.'},
    ],
    request:'No request body. Catalog ID is a path param. Add ?depth=2&parentCategoryId=0ZGAU000000BC2h4AG as needed.',
    response:'{\n  "categories": [\n    {\n      "id": "0ZGAU000000BC2h4AG",\n      "name": "Configurable",\n      "isActive": true,\n      "sortOrder": 1,\n      "subCategories": []\n    },\n    {\n      "id": "0ZGAU000000BC2k4AG",\n      "name": "PreConfigured",\n      "isActive": true,\n      "sortOrder": 2,\n      "subCategories": []\n    }\n  ]\n}' },

  { id:'pcm-16', category:'PCM', name:'Category By ID (PCM)', methods:['GET'],
    path:'/connect/pcm/categories/{categoryId}', version:'v60.0',
    desc:'Returns details of a specific category by its ID.',
    page:156,
    params:[
      {name:'categoryId',type:'String',req:true,location:'path',desc:'ID of the category.'},
      {name:'correlationId',type:'String',req:false,location:'query',desc:'(v60.0) Unique token to track related events. If unspecified, a UUID is generated.'},
      {name:'fields',type:'String[]',req:false,location:'query',desc:'(v60.0) List of fields to return. If not specified, all fields are returned.'},
      {name:'language',type:'String',req:false,location:'query',desc:'(v64.0) Custom language to retrieve translated field data.'},
    ],
    request:'No request body. Category ID is a path param.',
    response:'{\n  "id": "0ZGAU000000BC2h4AG",\n  "name": "Configurable",\n  "isActive": true,\n  "sortOrder": 1,\n  "catalogId": "0ZSAU000000ANZd4AO",\n  "parentCategoryId": null,\n  "subCategories": []\n}' },

  { id:'pcm-17', category:'PCM', name:'Index Configuration Collection', methods:['GET','PUT'],
    path:'/connect/pcm/index/configurations', version:'v62.0',
    desc:'GET: Returns persisted index configurations. PUT: Updates index configurations for product search.',
    page:157,
    params:[
      {name:'correlationId',type:'String',req:false,location:'query',desc:'(v62.0) (GET) Unique token to track related events.'},
      {name:'fieldTypes',type:'String[]',req:false,location:'query',desc:'(v62.0) (GET) Filter by index config type. Supported: STANDARD, CUSTOM, ProductDynamicAttribute, ProductAttributeDefinitionStandard, ProductAttributeDefinitionCustom.'},
      {name:'includeMetadata',type:'Boolean',req:false,location:'query',desc:'(v62.0) (GET) Include metadata (true) or not (false).'},
      {name:'indexConfigurations',type:'Index Configuration Input[]',req:true,location:'body',desc:'(v62.0) (PUT) List of index configurations to update. Required for PUT.'},
    ],
    request:'GET: No request body. Use query params fieldTypes=STANDARD,CUSTOM&includeMetadata=true\n\nPUT body:\n{\n  "correlationId": "index-cfg-001",\n  "indexConfigurations": [\n    {\n      "name": "Code",\n      "type": "Standard",\n      "isSearchable": true\n    },\n    {\n      "name": "Family",\n      "type": "Standard",\n      "isSearchable": true,\n      "isFacetable": false,\n      "facetDisplayRank": 1\n    },\n    {\n      "attributeFieldId": "00Nxx000001FwnABII",\n      "name": "Message__c",\n      "type": "Custom",\n      "isSearchable": true\n    },\n    {\n      "attributeDefinitionId": "0tjT1000000002bIAA",\n      "name": "Color",\n      "type": "ProductDynamicAttribute",\n      "isSearchable": true\n    }\n  ]\n}',
    response:'{\n  "correlationId": "index-cfg-001",\n  "indexConfigurations": [\n    {"name": "Code","type": "Standard","isSearchable": true},\n    {"name": "Family","type": "Standard","isSearchable": true,"isFacetable": false,"facetDisplayRank": 1}\n  ],\n  "status": {"code": "200","message": "Index configurations updated successfully."}\n}' },

  { id:'pcm-18', category:'PCM', name:'Index Setting', methods:['GET','PATCH'],
    path:'/connect/pcm/index/setting', version:'v63.0',
    desc:'GET: Returns the current index setting. PATCH: Updates the index setting.',
    page:158,
    params:[
      {name:'settingId',type:'String',req:true,location:'query',desc:'(v63.0) (PATCH only) ID of the setting to update.'},
      {name:'setting',type:'Object',req:true,location:'body',desc:'(v63.0) (PATCH only) Object containing setting details. Fields: supportedLanguages (String[]), defaultLanguage (String), productsGrouping (String — e.g. "GROUPING_VARIATION" or "NO_GROUPING").'},
    ],
    request:'GET: No request body.\n\nPATCH body (with ?settingId=0axxx0000000001AAA query param):\n{\n  "setting": {\n    "supportedLanguages": ["en_US", "ja", "es", "nl_NL"],\n    "defaultLanguage": "en_US",\n    "productsGrouping": "GROUPING_VARIATION"\n  }\n}',
    response:'GET: {\n  "setting": {\n    "supportedLanguages": ["en_US"],\n    "defaultLanguage": "en_US",\n    "productsGrouping": "NO_GROUPING"\n  },\n  "status": {"code": "200"}\n}\n\nPATCH: {\n  "setting": {\n    "supportedLanguages": ["en_US","ja","es","nl_NL"],\n    "defaultLanguage": "en_US",\n    "productsGrouping": "GROUPING_VARIATION"\n  },\n  "status": {"code": "200"}\n}' },

  // Product Discovery
  { id:'disc-1', category:'Discovery', name:'Global Search', methods:['POST'],
    path:'/connect/cpq/products/search', version:'v60.0',
    desc:'Retrieves a list of products based on a search query or search term. Composite API for Product Discovery.',
    page:312,
    params:[
      {name:'query',type:'Map<String,Object>',req:true,location:'body',desc:'(v60.0) Query to search products. Required. Structure: { "textQuery": { "searchPhrase": "Bundle" } }. The textQuery.searchPhrase performs a full-text product name search.'},
      {name:'additionalContextData',type:'Context Data Input[]',req:false,location:'body',desc:'(v60.0) Additional custom context nodes. Maximum supported is 10.'},
      {name:'additionalFields',type:'Map<String,Additional Fields Input>',req:false,location:'body',desc:'(v61.0) Additional Product2 fields to return.'},
      {name:'catalogId',type:'String',req:false,location:'body',desc:'(v60.0) Catalog ID with pricing details.'},
      {name:'categoryId',type:'String',req:false,location:'body',desc:'(v60.0) Category ID for matching query offers.'},
      {name:'contextDefinition',type:'String',req:false,location:'body',desc:'(v60.0) Custom context definition API name.'},
      {name:'contextMapping',type:'String',req:false,location:'body',desc:'(v60.0) Context mapping for hydration.'},
      {name:'correlationId',type:'String',req:false,location:'body',desc:'(v60.0) Unique request identifier.'},
      {name:'currencyCode',type:'String',req:false,location:'body',desc:'(v60.0) Currency code for pricing and filtering.'},
      {name:'cursor',type:'String',req:false,location:'body',desc:'(v60.0) Unique ID for product position.'},
      {name:'enablePricing',type:'Boolean',req:false,location:'body',desc:'(v60.0) Enable pricing. Default: true.'},
      {name:'enableQualification',type:'Boolean',req:false,location:'body',desc:'(v60.0) Enable qualification rules. Default: true.'},
      {name:'executeConfigurationRules',type:'Boolean',req:false,location:'body',desc:'(v67.0) Execute configuration rules.'},
      {name:'filter',type:'Filter Input',req:false,location:'body',desc:'(v60.0) Filter by criteria. Operators: eq, in, contains, gt, lt, gte, lte.'},
      {name:'includeCatalogDetails',type:'Boolean',req:false,location:'body',desc:'(v61.0) Include catalog details. Default: false.'},
      {name:'limit',type:'Integer',req:false,location:'body',desc:'(v60.0) Number of items in response. Default: 10.'},
      {name:'offset',type:'Integer',req:false,location:'body',desc:'(v60.0) Reserved for internal use.'},
      {name:'orderBy',type:'String[]',req:false,location:'body',desc:'(v60.0) Sort order. Default: asc.'},
      {name:'priceBookId',type:'String',req:false,location:'body',desc:'(v60.0) Price book ID.'},
      {name:'pricingProcedure',type:'String',req:false,location:'body',desc:'(v60.0) Custom pricing procedure API name.'},
      {name:'productClassificationId',type:'String',req:false,location:'body',desc:'(v60.0) Product classification ID.'},
      {name:'qualificationProcedure',type:'String',req:false,location:'body',desc:'(v60.0) Custom qualification procedure API name.'},
      {name:'relatedObjectFilters',type:'Related Object Filter Input[]',req:false,location:'body',desc:'(v60.0) Filter by related object criteria.'},
      {name:'searchTerm',type:'String',req:false,location:'body',desc:'(v62.0) Product name search term.'},
      {name:'transactionContextId',type:'String',req:false,location:'body',desc:'(v66.0) Transaction context ID.'},
      {name:'transactionId',type:'String',req:false,location:'body',desc:'(v66.0) Transaction ID.'},
      {name:'usePromotions',type:'Boolean',req:false,location:'body',desc:'(v66.0) Fetch eligible promotions.'},
      {name:'userContext',type:'User Context Input',req:false,location:'body',desc:'(v60.0) User context details for qualification rules: accountId (String), contactId (String), contextId (String — ID of an existing session context).'},
    ],
    request:'{\n  "query": {\n    "textQuery": {\n      "searchPhrase": "Bundle"\n    }\n  },\n  "catalogId": "{{CATALOG_ID}}",\n  "priceBookId": "{{PRICE_BOOK_ID}}",\n  "currencyCode": "USD",\n  "limit": 20,\n  "enablePricing": true,\n  "enableQualification": true,\n  "userContext": {\n    "accountId": "{{ACCOUNT_ID}}"\n  },\n  "additionalFields": {\n    "Product2": {\n      "fields": ["ProductCode","Description"]\n    }\n  }\n}',
    response:'{\n  "correlationId": "search-001",\n  "facets": [],\n  "products": [\n    {\n      "id": "01tSa00000AzpIaIAJ",\n      "name": "ADM Offer",\n      "productCode": "BUND-SUB-ADM",\n      "isActive": true,\n      "nodeType": "bundleProduct",\n      "catalogs": [{"id": "0ZSAU000000ANZd4AO","name": "CAR and LCV"}],\n      "categories": [{"id": "0ZGAU000000BC2h4AG","name": "Configurable"}],\n      "prices": [{"priceType": "Standard","unitPrice": 50.00,"currencyCode": "USD"}],\n      "productSellingModelOptions": [{"id": "0iOSa00000007SjMAI","isDefault": true,"productSellingModel": {"name": "Evergreen - Monthly","sellingModelType": "Evergreen"}}]\n    }\n  ],\n  "status": {"code": "200","message": "Successfully fetched Product records."}\n}',
    examples:[
      {
        type:'text-search',
        label:'1 — Text search by keyword',
        desc:'Full-text search using query.textQuery.searchPhrase. Returns products whose name contains the phrase. Add priceBookId and enablePricing to get prices.',
        steps:[
          'Set query.textQuery.searchPhrase to a product name keyword',
          'Add catalogId to scope to a specific catalog',
          'Set enablePricing:true and priceBookId to include prices in the response'
        ],
        body:'{"query":{"textQuery":{"searchPhrase":"Bundle"}},"catalogId":"{{CATALOG_ID}}","priceBookId":"{{PRICE_BOOK_ID}}","currencyCode":"USD","limit":20,"enablePricing":true,"enableQualification":true}'
      },
      {
        type:'search-term',
        label:'2 — searchTerm shorthand (v62.0+)',
        desc:'Alternative to query.textQuery: use the top-level searchTerm field (available from v62.0). Equivalent to textQuery but simpler to construct.',
        steps:[
          'Use searchTerm (String) as a top-level field instead of query.textQuery.searchPhrase',
          'Both fields achieve a name-contains search on products'
        ],
        body:'{"searchTerm":"Bundle","catalogId":"{{CATALOG_ID}}","priceBookId":"{{PRICE_BOOK_ID}}","currencyCode":"USD","limit":20,"enablePricing":true,"enableQualification":true,"userContext":{"accountId":"{{ACCOUNT_ID}}"}}'
      },
      {
        type:'filtered-search',
        label:'3 — Search with account context + filter + additionalFields',
        desc:'Search with a user account context so qualification rules run per-account, filter by isActive, and return extra Product2 fields.',
        steps:[
          'Replace ACCOUNT_ID in userContext with your Account ID',
          'Adjust filter.criteria to narrow results further',
          'additionalFields.Product2.fields lists extra standard/custom fields to return'
        ],
        body:'{"query":{"textQuery":{"searchPhrase":"Router"}},"catalogId":"{{CATALOG_ID}}","priceBookId":"{{PRICE_BOOK_ID}}","currencyCode":"USD","limit":20,"enablePricing":true,"enableQualification":true,"userContext":{"accountId":"{{ACCOUNT_ID}}"},"filter":{"criteria":[{"property":"isActive","operator":"eq","value":true}]},"additionalFields":{"Product2":{"fields":["ProductCode","Description"]}}}'
      }
    ] },

  { id:'disc-2', category:'Discovery', name:'Catalog List (CPQ)', methods:['POST'],
    path:'/connect/cpq/catalogs', version:'v60.0',
    desc:'Returns a paginated list of catalogs for the CPQ product discovery context.',
    page:304,
    params:[
      {name:'correlationId',type:'String',req:false,location:'body',desc:'(v60.0) Unique request identifier.'},
      {name:'limit',type:'Integer',req:false,location:'body',desc:'(v60.0) Number of items to include in response.'},
      {name:'offset',type:'Integer',req:false,location:'body',desc:'(v60.0) Offset size for catalog count.'},
      {name:'orderBy',type:'String[]',req:false,location:'body',desc:'(v60.0) Sort order for catalogs.'},
      {name:'userContext',type:'User Context Input',req:false,location:'body',desc:'(v60.0) User context details for qualification rules: accountId (String), contactId (String), contextId (String — ID of an existing session context).'},
    ],
    request:'{\n  "limit": 20,\n  "offset": 0,\n  "orderBy": ["name:asc"],\n  "userContext": {\n    "accountId": "{{ACCOUNT_ID}}"\n  }\n}',
    response:'{\n  "catalogs": [\n    {\n      "id": "0ZSAU000000ANZd4AO",\n      "name": "CAR and LCV",\n      "catalogType": "Sales",\n      "isActive": true\n    }\n  ],\n  "totalCount": 1,\n  "correlationId": "catalog-list-001"\n}' },

  { id:'disc-3', category:'Discovery', name:'Categories List (CPQ)', methods:['POST'],
    path:'/connect/cpq/categories', version:'v60.0',
    desc:'Returns categories and subcategories of a specified catalog. Composite API for Product Discovery.',
    page:306,
    params:[
      {name:'catalogId',type:'String',req:true,location:'body',desc:'(v60.0) Catalog ID for offers with pricing details. Required.'},
      {name:'depth',type:'Integer',req:false,location:'body',desc:'(v61.0) Number of subcategory levels to retrieve beneath parentCategoryId. Only applies when parentCategoryId is provided.'},
      {name:'parentCategoryId',type:'String',req:false,location:'body',desc:'(v61.0) ID of parent category whose subcategories to retrieve. If unspecified, root-level categories are returned.'},
      {name:'additionalContextData',type:'Context Data Input[]',req:false,location:'body',desc:'(v60.0) Additional custom context nodes. Maximum supported is 10.'},
      {name:'contextDefinition',type:'String',req:false,location:'body',desc:'(v60.0) Custom context definition API name.'},
      {name:'contextMapping',type:'String',req:false,location:'body',desc:'(v60.0) Context mapping for hydration.'},
      {name:'customFields',type:'String[]',req:false,location:'body',desc:'(v60.0) Category fields to retrieve.'},
      {name:'correlationId',type:'String',req:false,location:'body',desc:'(v60.0) Unique request identifier.'},
      {name:'enableQualification',type:'Boolean',req:false,location:'body',desc:'(v60.0) Enable qualification rules. Default: true.'},
      {name:'filter',type:'Filter Input',req:false,location:'body',desc:'(v60.0) Filter records by supported criteria.'},
      {name:'qualificationProcedure',type:'String',req:false,location:'body',desc:'(v60.0) Custom qualification procedure API name.'},
      {name:'usePromotions',type:'Boolean',req:false,location:'body',desc:'(v66.0) Fetch eligible promotions from GPM.'},
      {name:'userContext',type:'User Context Input',req:false,location:'body',desc:'(v60.0) User context details for qualification rules: accountId (String), contactId (String), contextId (String — ID of an existing session context).'},
    ],
    request:'{\n  "catalogId": "{{CATALOG_ID}}",\n  "parentCategoryId": "{{PARENT_CATEGORY_ID}}",\n  "depth": 2,\n  "enableQualification": true,\n  "userContext": {\n    "accountId": "{{ACCOUNT_ID}}"\n  }\n}',
    response:'{\n  "categories": [\n    {\n      "id": "0ZGAU000000BC2h4AG",\n      "name": "Configurable",\n      "isActive": true,\n      "sortOrder": 1,\n      "subCategories": [\n        {\n          "id": "0ZGAU000000BC2m4AG",\n          "name": "Laptops",\n          "isActive": true,\n          "sortOrder": 1,\n          "subCategories": []\n        }\n      ]\n    },\n    {\n      "id": "0ZGAU000000BC2k4AG",\n      "name": "PreConfigured",\n      "isActive": true,\n      "sortOrder": 2,\n      "subCategories": []\n    }\n  ],\n  "correlationId": "cat-list-001"\n}' },

  { id:'disc-4', category:'Discovery', name:'Guided Selection', methods:['POST'],
    path:'/connect/cpq/products/guided-selection', version:'v62.0',
    desc:'Retrieve products based on guided selection response identifier or search terms.',
    page:315,
    params:[
      {name:'catalogId',type:'String',req:true,location:'body',desc:'(v62.0) Catalog ID. Required.'},
      {name:'priceBookId',type:'String',req:true,location:'body',desc:'(v62.0) Price book ID. Required.'},
      {name:'guidedSelectionResponseId',type:'String',req:false,location:'body',desc:'(v62.0) Response identifier. Required if searchTerms is not specified.'},
      {name:'searchTerms',type:'Guided Selection Search Term Input[]',req:false,location:'body',desc:'(v62.0) Search terms. Required if guidedSelectionResponseId is not specified.'},
      {name:'additionalContextData',type:'Context Data Input[]',req:false,location:'body',desc:'(v62.0) Custom context nodes. Maximum supported is 10.'},
      {name:'additionalFields',type:'Map<String,Additional Fields Input>',req:false,location:'body',desc:'(v62.0) Additional Product2 fields.'},
      {name:'categoryId',type:'String',req:false,location:'body',desc:'(v62.0) Category ID.'},
      {name:'contextDefinition',type:'String',req:false,location:'body',desc:'(v62.0) Custom context definition API name.'},
      {name:'contextMapping',type:'String',req:false,location:'body',desc:'(v62.0) Context mapping for hydration.'},
      {name:'correlationId',type:'String',req:false,location:'body',desc:'(v62.0) Unique request identifier.'},
      {name:'currencyCode',type:'String',req:false,location:'body',desc:'(v62.0) Currency code for pricing.'},
      {name:'cursor',type:'String',req:false,location:'body',desc:'(v62.0) Unique ID for product position.'},
      {name:'enablePricing',type:'Boolean',req:false,location:'body',desc:'(v62.0) Enable pricing. Default: true.'},
      {name:'enableQualification',type:'Boolean',req:false,location:'body',desc:'(v62.0) Enable qualification rules. Default: true.'},
      {name:'executeConfigurationRules',type:'Boolean',req:false,location:'body',desc:'(v67.0) Execute configuration rules.'},
      {name:'filter',type:'Filter Input',req:false,location:'body',desc:'(v62.0) Filter by criteria. Operators: eq, in, contains.'},
      {name:'includeCatalogDetails',type:'Boolean',req:false,location:'body',desc:'(v62.0) Include catalog details. Default: false.'},
      {name:'limit',type:'Integer',req:false,location:'body',desc:'(v62.0) Number of items in response. Default: 10.'},
      {name:'orderBy',type:'String[]',req:false,location:'body',desc:'(v62.0) Sort order. Default: asc.'},
      {name:'pricingProcedure',type:'String',req:false,location:'body',desc:'(v62.0) Custom pricing procedure API name.'},
      {name:'productClassificationId',type:'String',req:false,location:'body',desc:'(v62.0) Product classification ID.'},
      {name:'qualificationProcedure',type:'String',req:false,location:'body',desc:'(v62.0) Custom qualification procedure API name.'},
      {name:'transactionContextId',type:'String',req:false,location:'body',desc:'(v67.0) Transaction context ID.'},
      {name:'transactionId',type:'String',req:false,location:'body',desc:'(v67.0) Transaction ID.'},
      {name:'usePromotions',type:'Boolean',req:false,location:'body',desc:'(v66.0) Fetch eligible promotions.'},
      {name:'userContext',type:'User Context Input',req:false,location:'body',desc:'(v62.0) User context details for qualification rules: accountId (String), contactId (String), contextId (String — ID of an existing session context).'},
    ],
    request:'// Option A — use a prior guided-selection response ID\n{\n  "catalogId": "{{CATALOG_ID}}",\n  "priceBookId": "{{PRICE_BOOK_ID}}",\n  "guidedSelectionResponseId": "{{GUIDED_SELECTION_RESPONSE_ID}}",\n  "limit": 10,\n  "enablePricing": true,\n  "enableQualification": true,\n  "userContext": {\n    "accountId": "{{ACCOUNT_ID}}"\n  }\n}\n\n// Option B — pass explicit searchTerms (no response ID yet)\n{\n  "catalogId": "{{CATALOG_ID}}",\n  "priceBookId": "{{PRICE_BOOK_ID}}",\n  "searchTerms": [\n    {\n      "attributeDefinitionId": "{{ATTRIBUTE_DEFINITION_ID}}",\n      "attributePicklistValueId": "{{ATTRIBUTE_PICKLIST_VALUE_ID}}",\n      "value": "Blue"\n    }\n  ],\n  "limit": 20,\n  "enablePricing": true,\n  "enableQualification": true,\n  "userContext": {\n    "accountId": "{{ACCOUNT_ID}}"\n  }\n}',
    response:'{\n  "apiStatus": {\n    "messages": [],\n    "statusCode": "FETCHED_DETAILS_SUCCESSFULLY"\n  },\n  "correlationId": "corrId",\n  "cursor": "MTAwMDAwMDAwNg==",\n  "searchTerms": [\n    {"term": "IPhone"},\n    {"term": "4GB"},\n    {"term": "64GB"}\n  ],\n  "result": [\n    {\n      "id": "01txx0000006kYwAAI",\n      "name": "Sample product 1",\n      "description": "IPhone-13",\n      "additionalFields": {\n        "CustomField1__c": "TextValue"\n      },\n      "prices": [\n        {\n          "price": 150,\n          "priceBookEntryId": "12Axx0000004DF7EAM",\n          "pricingModel": {\n            "frequency": "Monthly",\n            "pricingModelType": "Recurring"\n          }\n        }\n      ],\n      "qualificationContext": {\n        "isQualified": true\n      }\n    }\n  ]\n}' },

  { id:'disc-5', category:'Discovery', name:'Product Details (CPQ)', methods:['POST'],
    path:'/connect/cpq/products/{productId}', version:'v60.0',
    desc:'Get product details such as attributes, hierarchy, or cardinality for a product ID. Composite API for Product Discovery.',
    page:307,
    params:[
      {name:'productId',type:'String',req:true,location:'path',desc:'Product ID.'},
      {name:'priceBookId',type:'String',req:true,location:'body',desc:'(v60.0) ID of the price book to get prices from. Required.'},
      {name:'additionalContextData',type:'Context Data Input[]',req:false,location:'body',desc:'(v60.0) Custom context nodes. Maximum supported is 10.'},
      {name:'additionalFields',type:'Map<String,Additional Fields Input>',req:false,location:'body',desc:'(v61.0) Additional fields to include. Supported objects: Product2, ProductAttributeDefinition.'},
      {name:'catalogId',type:'String',req:false,location:'body',desc:'(v60.0) ID of the catalog.'},
      {name:'contextDefinition',type:'String',req:false,location:'body',desc:'(v60.0) Custom context definition API name.'},
      {name:'contextMapping',type:'String',req:false,location:'body',desc:'(v60.0) Context mapping for hydration.'},
      {name:'correlationId',type:'String',req:false,location:'body',desc:'(v60.0) Unique request identifier.'},
      {name:'currencyCode',type:'String',req:false,location:'body',desc:'(v60.0) Currency code for pricing.'},
      {name:'enablePricing',type:'Boolean',req:false,location:'body',desc:'(v60.0) Enable pricing calculation. Default: true.'},
      {name:'enableQualification',type:'Boolean',req:false,location:'body',desc:'(v60.0) Enable qualification rules. Default: true.'},
      {name:'pricingProcedure',type:'String',req:false,location:'body',desc:'(v60.0) Custom pricing procedure API name.'},
      {name:'productSellingModelId',type:'String',req:false,location:'body',desc:'(v60.0) ID of the product selling model.'},
      {name:'qualificationProcedure',type:'String',req:false,location:'body',desc:'(v60.0) Custom qualification procedure API name.'},
      {name:'userContext',type:'User Context Input',req:false,location:'body',desc:'(v60.0) User context details for qualification rules: accountId (String), contactId (String), contextId (String — ID of an existing session context).'},
    ],
    request:'{\n  "catalogId": "{{CATALOG_ID}}",\n  "priceBookId": "{{PRICE_BOOK_ID}}",\n  "currencyCode": "USD",\n  "enablePricing": true,\n  "enableQualification": true,\n  "userContext": {\n    "accountId": "{{ACCOUNT_ID}}",\n    "contactId": "{{CONTACT_ID}}"\n  },\n  "additionalContextData": [\n    {\n      "nodeName": "Account",\n      "nodeData": {\n        "id": "{{ACCOUNT_ID}}",\n        "name": "Cloud Kicks"\n      }\n    }\n  ],\n  "additionalFields": {\n    "Product2": {\n      "fields": ["ProductCode","Description"]\n    },\n    "ProductAttributeDefinition": {\n      "fields": ["DefaultValue"]\n    }\n  }\n}',
    response:'{\n  "correlationId": "prod-detail-001",\n  "product": {\n    "id": "01tSa00000AzpIaIAJ",\n    "name": "ADM Offer",\n    "productCode": "BUND-SUB-ADM",\n    "isActive": true,\n    "isAssetizable": true,\n    "nodeType": "bundleProduct",\n    "configureDuringSale": "Allowed",\n    "productSpecificationType": {"name": "Commercial"},\n    "productSellingModelOptions": [\n      {"id": "0iOSa00000007SjMAI","isDefault": true,"productSellingModel": {"name": "Evergreen - Monthly","sellingModelType": "Evergreen","pricingTerm": 1}}\n    ],\n    "prices": [{"priceType": "Standard","unitPrice": 50.00,"currencyCode": "USD"}],\n    "attributeCategory": [{"name": "Subscription Details","attributes": [{"name": "Subscription Term","dataType": "Picklist","defaultValue": "36"}]}]\n  },\n  "status": {"code": "200","message": "Successfully fetched product details."}\n}' },

  { id:'disc-6', category:'Discovery', name:'Products List (CPQ)', methods:['POST'],
    path:'/connect/cpq/products', version:'v60.0',
    desc:'Get a list of products for a specified catalog, category, or subcategory. Composite API for Product Discovery. If a parent categoryId is specified, returns products from all child categories.',
    page:314,
    params:[
      {name:'priceBookId',type:'String',req:true,location:'body',desc:'(v60.0) ID of the price book to get prices from. Required. If not specified, prices from the standard price book are fetched.'},
      {name:'additionalContextData',type:'Context Data Input[]',req:false,location:'body',desc:'(v60.0) Additional nodes added to the context definition. Max 10. Each entry: { "nodeName": "Account", "nodeData": { "id": "001xx...", "name": "Cloud Kicks" } }'},
      {name:'additionalFields',type:'Map<String,Additional Fields Input>',req:false,location:'body',desc:'(v61.0) Extra Product2 fields to return. Structure: { "Product2": { "fields": ["CanRamp","ProductCode","DecompositionScope"] } }. Throws error if fields are invalid or inaccessible.'},
      {name:'catalogId',type:'String',req:false,location:'body',desc:'(v60.0) ID of the catalog. Returns products from this catalog with pricing details.'},
      {name:'categoryId',type:'String',req:false,location:'body',desc:'(v60.0) ID of the category. If not specified, returns all products from the catalog.'},
      {name:'contextDefinition',type:'String',req:false,location:'body',desc:'(v60.0) API name of the custom context definition. If not specified, the default context definition is used.'},
      {name:'contextMapping',type:'String',req:false,location:'body',desc:'(v60.0) Context mapping for hydration. Must belong to the specified contextDefinition.'},
      {name:'correlationId',type:'String',req:false,location:'body',desc:'(v60.0) Unique identifier for the request (e.g. a UUID).'},
      {name:'currencyCode',type:'String',req:false,location:'body',desc:'(v60.0) Currency ISO code (e.g. "USD"). Required when multi-currency is enabled in the org.'},
      {name:'cursor',type:'String',req:false,location:'body',desc:'(v60.0) Opaque cursor for pagination — use the value returned in the previous response to get the next page.'},
      {name:'enablePricing',type:'Boolean',req:false,location:'body',desc:'(v60.0) Include pricing in response. Default: true. Overridden by the Pricing Procedure toggle in Product Discovery Settings.'},
      {name:'enableQualification',type:'Boolean',req:false,location:'body',desc:'(v60.0) Run qualification rules. Default: true. Overridden by the Qualification Procedure toggle in Product Discovery Settings.'},
      {name:'executeConfigurationRules',type:'Boolean',req:false,location:'body',desc:'(v67.0) Execute visibility/configuration rules. Use with transactionId to run rules in context of an existing quote/order.'},
      {name:'filter',type:'Filter Input',req:false,location:'body',desc:'(v60.0) Filter products. Structure: { "criteria": [{ "property": "name", "operator": "eq", "value": "Laptop" }] }. Supported operators: eq, in, contains (contains unavailable when indexed search is on). Multiple criteria are ANDed.'},
      {name:'includeCatalogDetails',type:'Boolean',req:false,location:'body',desc:'(v61.0) Include catalog details in the response. Default: false.'},
      {name:'limit',type:'Integer',req:false,location:'body',desc:'(v60.0) Number of products to return. Default: 10.'},
      {name:'offset',type:'Integer',req:false,location:'body',desc:'(v60.0) Reserved for internal use.'},
      {name:'orderBy',type:'String[]',req:false,location:'body',desc:'(v60.0) Sort fields. Format: ["name:asc"] or ["name:desc"]. When indexed search is on, only name is supported.'},
      {name:'pricingProcedure',type:'String',req:false,location:'body',desc:'(v60.0) API name of the custom pricing procedure. Defaults to the procedure configured in Product Discovery Settings.'},
      {name:'productClassificationId',type:'String',req:false,location:'body',desc:'(v60.0) ID of the product classification to filter by.'},
      {name:'qualificationProcedure',type:'String',req:false,location:'body',desc:'(v60.0) API name of the custom qualification procedure. Defaults to the procedure configured in Product Discovery Settings.'},
      {name:'relatedObjectFilters',type:'Related Object Filter Input[]',req:false,location:'body',desc:'(v60.0) Filter by related object fields. Structure: [{ "objectName": "ProductSpecificationRecType", "criteria": [{ "property": "IsCommercial", "operator": "eq", "value": true }] }]. Supported object: ProductSpecificationRecType. Supported property: IsCommercial. Operator: eq.'},
      {name:'transactionContextId',type:'String',req:false,location:'body',desc:'(v67.0) ID of an existing transaction context (for config rules execution).'},
      {name:'transactionId',type:'String',req:false,location:'body',desc:'(v67.0) ID of a quote or order to scope config rules against.'},
      {name:'usePromotions',type:'Boolean',req:false,location:'body',desc:'(v66.0) Include applicable GPM promotions per product. Default: true when Promotions feature is enabled, false otherwise.'},
      {name:'userContext',type:'User Context Input',req:false,location:'body',desc:'(v60.0) User context for qualification rules. Structure: { "accountId": "001xx...", "contactId": "003xx...", "contextId": "e055bb18-..." }. All sub-fields optional.'},
    ],
    request:'{\n  "correlationId": "eeaa1db2-f371-4227-a886-c77e2f66ce1d",\n  "catalogId": "{{CATALOG_ID}}",\n  "categoryId": "{{CATEGORY_ID}}",\n  "priceBookId": "{{PRICE_BOOK_ID}}",\n  "productClassificationId": "{{PRODUCT_CLASSIFICATION_ID}}",\n  "currencyCode": "USD",\n  "limit": 60,\n  "cursor": "MTAwMDAwMDAwNg==",\n  "orderBy": ["name:asc"],\n  "enableQualification": true,\n  "enablePricing": true,\n  "includeCatalogDetails": true,\n  "qualificationProcedure": "ProductQualification",\n  "pricingProcedure": "pricingProcedure",\n  "contextDefinition": "BrowseContextDefinitionExt",\n  "contextMapping": "ProductDiscoveryMapping",\n  "userContext": {\n    "accountId": "001xx0000000001AAA",\n    "contactId": "003xx00000000D7AAI",\n    "contextId": "e055bb18-d4e8-41c3-881e-0132b9561708"\n  },\n  "filter": {\n    "criteria": [\n      {\n        "property": "name",\n        "operator": "eq",\n        "value": "Laptop Pro Bundle"\n      }\n    ]\n  },\n  "relatedObjectFilters": [\n    {\n      "objectName": "ProductSpecificationRecType",\n      "criteria": [\n        {\n          "property": "IsCommercial",\n          "operator": "eq",\n          "value": true\n        }\n      ]\n    }\n  ],\n  "additionalContextData": [\n    {\n      "nodeName": "Account",\n      "nodeData": {\n        "id": "001xx0000000001AAA",\n        "name": "Cloud Kicks"\n      }\n    }\n  ],\n  "additionalFields": {\n    "Product2": {\n      "fields": [\n        "CanRamp",\n        "DecompositionScope",\n        "ProductCode"\n      ]\n    }\n  }\n}',
    response:'{\n  "correlationId": "eeaa1db2-f371-4227-a886-c77e2f66ce1d",\n  "products": [\n    {\n      "id": "01tSa00000AzpIaIAJ",\n      "name": "Laptop Pro Bundle",\n      "productCode": "BUND-SUB-ADM",\n      "isActive": true,\n      "nodeType": "bundleProduct",\n      "canRamp": true,\n      "decompositionScope": "LineItem",\n      "catalogs": [{"id": "{{CATALOG_ID}}","name": "Product Catalog"}],\n      "categories": [{"id": "{{CATEGORY_ID}}","name": "Configurable"}],\n      "prices": [{"priceType": "Standard","unitPrice": 150.00,"currencyCode": "USD"}],\n      "productSellingModelOptions": [\n        {"id": "0iOSa00000007SjMAI","isDefault": true,"productSellingModel": {"name": "Evergreen - Monthly","sellingModelType": "Evergreen"}}\n      ],\n      "qualificationContext": {"isQualified": true,"qualificationReasons": []}\n    }\n  ],\n  "totalCount": 1,\n  "cursor": "MTAwMDAwMDAxNg==",\n  "status": {"code": "200","message": "Successfully fetched products."}\n}',
    examples:[
      {
        type:'basic',
        label:'1 — Basic catalog browse',
        desc:'Minimum viable request: browse a catalog category with pricing and qualification enabled. Replace CATALOG_ID, CATEGORY_ID, and PRICE_BOOK_ID with your org values.',
        steps:[
          'Replace {{CATALOG_ID}} with your catalog ID (starts with 0ZS)',
          'Replace {{CATEGORY_ID}} with your category ID (starts with 0ZG)',
          'Replace {{PRICE_BOOK_ID}} with your price book ID (starts with 01s)',
          'Set limit to control page size (max 300)'
        ],
        body:'{"catalogId":"{{CATALOG_ID}}","categoryId":"{{CATEGORY_ID}}","priceBookId":"{{PRICE_BOOK_ID}}","currencyCode":"USD","limit":20,"orderBy":["name:asc"],"enableQualification":true,"enablePricing":true}'
      },
      {
        type:'account-context',
        label:'2 — Browse with account context + extra fields',
        desc:'Pass userContext to run qualification rules for a specific account. Use additionalFields to return custom Product2 fields (CanRamp, ProductCode) and additionalContextData to inject Account data into the context.',
        steps:[
          'Replace accountId in userContext with your Account ID',
          'Update additionalFields.Product2.fields with any extra Product2 fields you need',
          'Update additionalContextData nodeData with the real account name'
        ],
        body:'{"catalogId":"{{CATALOG_ID}}","categoryId":"{{CATEGORY_ID}}","priceBookId":"{{PRICE_BOOK_ID}}","currencyCode":"USD","limit":60,"enableQualification":true,"enablePricing":true,"includeCatalogDetails":true,"userContext":{"accountId":"001xx0000000001AAA","contactId":"003xx00000000D7AAI","contextId":"e055bb18-d4e8-41c3-881e-0132b9561708"},"additionalFields":{"Product2":{"fields":["CanRamp","DecompositionScope","ProductCode"]}},"additionalContextData":[{"nodeName":"Account","nodeData":{"id":"001xx0000000001AAA","name":"Cloud Kicks"}}]}'
      },
      {
        type:'filter-related',
        label:'3 — Filter by name + related object criteria',
        desc:'Use filter.criteria to narrow by product name, and relatedObjectFilters to filter by a ProductSpecificationRecType field (e.g. IsCommercial = true).',
        steps:[
          'Set filter.criteria[0].value to the product name to match',
          'Set relatedObjectFilters[0].criteria[0].value to true or false'
        ],
        body:'{"catalogId":"{{CATALOG_ID}}","priceBookId":"{{PRICE_BOOK_ID}}","currencyCode":"USD","limit":20,"enableQualification":false,"enablePricing":true,"filter":{"criteria":[{"property":"name","operator":"contains","value":"Bundle"}]},"relatedObjectFilters":[{"objectName":"ProductSpecificationRecType","criteria":[{"property":"IsCommercial","operator":"eq","value":true}]}]}'
      },
      {
        type:'promotions',
        label:'4 — With promotions (GPM)',
        desc:'Fetch eligible GPM promotions per product. Requires Global Promotion Management enabled in the org. Pass transactionId to scope promotions to an existing quote/order.',
        steps:[
          'Set usePromotions to true (this is the default when GPM is enabled)',
          'Optionally pass transactionId to get promotions relevant to an active quote/order',
          'Each product in the response will include a promotions[] array'
        ],
        body:'{"catalogId":"{{CATALOG_ID}}","categoryId":"{{CATEGORY_ID}}","priceBookId":"{{PRICE_BOOK_ID}}","currencyCode":"USD","limit":60,"enableQualification":true,"enablePricing":true,"usePromotions":true,"transactionId":"{{QUOTE_OR_ORDER_ID}}","userContext":{"accountId":"001xx0000000001AAA"}}'
      },
      {
        type:'config-rules',
        label:'5 — Run visibility/config rules in transaction context',
        desc:'Set executeConfigurationRules:true to run visibility rules and return UITreatments alongside products. Pass transactionId so rules are evaluated against an active quote or order line context.',
        steps:[
          'Replace transactionId with your quote/order ID',
          'Set executeConfigurationRules to true',
          'Response products will include configRuleResults/uiTreatments per product'
        ],
        body:'{"catalogId":"{{CATALOG_ID}}","priceBookId":"{{PRICE_BOOK_ID}}","currencyCode":"USD","limit":12,"enableQualification":true,"enablePricing":true,"includeCatalogDetails":true,"executeConfigurationRules":true,"transactionId":"{{QUOTE_OR_ORDER_ID}}","userContext":{"accountId":"001xx0000000001AAA"},"filter":{"criteria":[{"property":"isActive","operator":"eq","value":true}]},"orderBy":["name:asc"]}'
      }
    ] },

  { id:'disc-7', category:'Discovery', name:'Qualification (CPQ)', methods:['POST'],
    path:'/connect/cpq/qualification', version:'v60.0',
    desc:'Run the qualification procedure on a list of product IDs. Composite API for Product Discovery.',
    page:321,
    params:[
      {name:'productIds',type:'String[]',req:true,location:'body',desc:'(v60.0) List of product IDs to run qualification on. Required.'},
      {name:'additionalContextData',type:'Context Data Input[]',req:false,location:'body',desc:'(v60.0) Custom context nodes. Maximum supported is 10.'},
      {name:'catalogId',type:'String',req:false,location:'body',desc:'(v60.0) ID of the catalog.'},
      {name:'categoryId',type:'String',req:false,location:'body',desc:'(v60.0) ID of the category.'},
      {name:'contextDefinition',type:'String',req:false,location:'body',desc:'(v60.0) Custom context definition API name.'},
      {name:'contextMapping',type:'String',req:false,location:'body',desc:'(v60.0) Context mapping for hydration.'},
      {name:'correlationId',type:'String',req:false,location:'body',desc:'(v60.0) Unique request identifier.'},
      {name:'qualificationProcedure',type:'String',req:false,location:'body',desc:'(v60.0) Custom qualification procedure API name.'},
      {name:'userContext',type:'User Context Input',req:false,location:'body',desc:'(v60.0) User context details for qualification rules: accountId (String), contactId (String), contextId (String — ID of an existing session context).'},
    ],
    request:'{\n  "productIds": [\n    "{{PRODUCT_ID}}"\n  ],\n  "catalogId": "{{CATALOG_ID}}",\n  "userContext": {\n    "accountId": "{{ACCOUNT_ID}}"\n  }\n}',
    response:'{\n  "correlationId": "qual-001",\n  "products": [\n    {\n      "id": "01tSa00000AzpIaIAJ",\n      "name": "ADM Offer",\n      "isActive": true,\n      "qualificationContext": {\n        "isQualified": true,\n        "qualificationReasons": []\n      }\n    }\n  ],\n  "status": {"code": "200","message": "Qualification completed successfully."}\n}' },

  { id:'disc-8', category:'Discovery', name:'Product Recommendations', methods:['POST'],
    path:'/connect/cpq/products/recommendations', version:'v67.0',
    desc:'Get a list of recommended products based on underlying business rules and constraint rules.',
    page:310,
    params:[
      {name:'additionalContextData',type:'Context Data Input[]',req:false,location:'body',desc:'(v67.0) Custom context nodes. Maximum supported is 10.'},
      {name:'additionalFields',type:'Map<String,Additional Fields Input>',req:false,location:'body',desc:'(v67.0) Additional Product2 fields.'},
      {name:'catalogId',type:'String',req:false,location:'body',desc:'(v67.0) ID of the catalog for recommendations.'},
      {name:'contextDefinition',type:'String',req:false,location:'body',desc:'(v67.0) Custom context definition API name.'},
      {name:'contextMapping',type:'String',req:false,location:'body',desc:'(v67.0) Context mapping for hydration.'},
      {name:'currencyCode',type:'String',req:false,location:'body',desc:'(v67.0) Currency code for pricing.'},
      {name:'cursor',type:'String',req:false,location:'body',desc:'(v67.0) Unique ID for product position.'},
      {name:'enablePricing',type:'Boolean',req:false,location:'body',desc:'(v67.0) Enable pricing for recommended products. Default: true.'},
      {name:'enableQualification',type:'Boolean',req:false,location:'body',desc:'(v67.0) Enable qualification rules. Default: true.'},
      {name:'filter',type:'Filter Input[]',req:false,location:'body',desc:'(v67.0) Filter by criteria. Operators: eq, in, contains.'},
      {name:'limit',type:'Integer',req:false,location:'body',desc:'(v67.0) Number of recommended products. Default: 10.'},
      {name:'priceBookId',type:'String',req:false,location:'body',desc:'(v67.0) ID of the price book.'},
      {name:'pricingProcedure',type:'String',req:false,location:'body',desc:'(v67.0) Custom pricing procedure API name.'},
      {name:'qualificationProcedure',type:'String',req:false,location:'body',desc:'(v67.0) Custom qualification procedure API name.'},
      {name:'transactionContextId',type:'String',req:false,location:'body',desc:'(v67.0) ID of the sales transaction context instance.'},
      {name:'transactionId',type:'String',req:false,location:'body',desc:'(v67.0) ID of the quote or order.'},
      {name:'usePromotions',type:'Boolean',req:false,location:'body',desc:'(v67.0) Fetch eligible promotions. Default: false.'},
      {name:'userContext',type:'User Context Input',req:false,location:'body',desc:'(v67.0) User context details for qualification rules: accountId (String), contactId (String), contextId (String — ID of an existing session context). Singular object, not an array.'},
      {name:'correlationId',type:'String',req:false,location:'body',desc:'(v67.0) Unique request correlation token for traceability. If not specified a UUID is generated.'},
    ],
    request:'{\n  "currencyCode": "USD",\n  "enablePricing": true,\n  "enableQualification": true,\n  "filter": [\n    {"criteria": [{"property": "isActive","operator": "eq","value": true}]}\n  ],\n  "limit": 12,\n  "priceBookId": "{{PRICE_BOOK_ID}}",\n  "transactionId": "{{QUOTE_OR_ORDER_ID}}"\n}',
    response:'{\n  "correlationId": "rec-001",\n  "products": [\n    {\n      "id": "01tSa00000AzpIaIAJ",\n      "name": "ADM Offer",\n      "productCode": "BUND-SUB-ADM",\n      "isActive": true,\n      "prices": [{"priceType": "Standard","unitPrice": 50.00,"currencyCode": "USD"}]\n    }\n  ],\n  "status": {"code": "200","message": "Successfully fetched recommendations."}\n}' },

  { id:'disc-9', category:'Discovery', name:'Catalog Details (CPQ)', methods:['POST'],
    path:'/connect/cpq/catalogs/{catalogId}', version:'v60.0',
    desc:'Get catalog details for a specified catalog ID. Composite API for Product Discovery.',
    page:305,
    params:[
      {name:'catalogId',type:'String',req:true,location:'path',desc:'ID of the catalog.'},
      {name:'correlationId',type:'String',req:false,location:'body',desc:'(v60.0) Unique request identifier.'},
      {name:'userContext',type:'User Context Input',req:false,location:'body',desc:'(v60.0) User context details for qualification rules: accountId (String), contactId (String), contextId (String — ID of an existing session context).'},
    ],
    request:'{\n  "userContext": {\n    "accountId": "{{ACCOUNT_ID}}"\n  }\n}',
    response:'{\n  "id": "0ZSAU000000ANZd4AO",\n  "name": "CAR and LCV",\n  "catalogType": "Sales",\n  "isActive": true,\n  "correlationId": "cat-detail-001"\n}' },

  { id:'disc-10', category:'Discovery', name:'Category Details (CPQ)', methods:['POST'],
    path:'/connect/cpq/categories/{categoryId}', version:'v60.0',
    desc:'Get details of a category for a specified category ID. Composite API for Product Discovery.',
    page:308,
    params:[
      {name:'categoryId',type:'String',req:true,location:'path',desc:'ID of the category.'},
      {name:'additionalContextData',type:'Context Data Input[]',req:false,location:'body',desc:'(v60.0) Custom context nodes. Maximum supported is 10.'},
      {name:'catalogId',type:'String',req:false,location:'body',desc:'(v60.0) Catalog ID for pricing details.'},
      {name:'contextDefinition',type:'String',req:false,location:'body',desc:'(v60.0) Custom context definition API name.'},
      {name:'contextMapping',type:'String',req:false,location:'body',desc:'(v60.0) Default context mapping for hydration.'},
      {name:'customFields',type:'String[]',req:false,location:'body',desc:'(v60.0) Category fields to retrieve.'},
      {name:'correlationId',type:'String',req:false,location:'body',desc:'(v60.0) Unique request identifier.'},
      {name:'enableQualification',type:'Boolean',req:false,location:'body',desc:'(v60.0) Enable qualification rules. Default: true.'},
      {name:'filter',type:'Filter Input',req:false,location:'body',desc:'(v60.0) Filter records by criteria.'},
      {name:'qualificationProcedure',type:'String',req:false,location:'body',desc:'(v60.0) Custom qualification procedure API name.'},
      {name:'usePromotions',type:'Boolean',req:false,location:'body',desc:'(v66.0) Fetch eligible promotions from GPM.'},
      {name:'userContext',type:'User Context Input',req:false,location:'body',desc:'(v60.0) User context details for qualification rules: accountId (String), contactId (String), contextId (String — ID of an existing session context).'},
    ],
    request:'{\n  "catalogId": "{{CATALOG_ID}}",\n  "enableQualification": true,\n  "userContext": {\n    "accountId": "{{ACCOUNT_ID}}"\n  },\n  "additionalContextData": [\n    {\n      "nodeName": "Account",\n      "nodeData": {\n        "id": "{{ACCOUNT_ID}}",\n        "name": "Cloud Kicks"\n      }\n    }\n  ]\n}',
    response:'{\n  "correlationId": "cat-detail-001",\n  "category": {\n    "id": "0ZGAU000000BC2h4AG",\n    "name": "Configurable",\n    "isActive": true,\n    "sortOrder": 1,\n    "catalogId": "0ZSAU000000ANZd4AO",\n    "subCategories": [],\n    "isQualified": true\n  },\n  "status": {"code": "200","message": "Successfully fetched category details."}\n}' },

  { id:'disc-11', category:'Discovery', name:'Bulk Product Details (CPQ)', methods:['POST'],
    path:'/connect/cpq/products/bulk', version:'v61.0',
    desc:'Retrieve details for multiple products in the CPQ product discovery context.',
    page:309,
    params:[
      {name:'productData',type:'Product Data Input[]',req:true,location:'body',desc:'(v61.0) List of product IDs and selling model IDs to retrieve details for. Required.'},
      {name:'additionalContextData',type:'Context Data Input[]',req:false,location:'body',desc:'(v61.0) Custom/default context nodes. Maximum supported is 10.'},
      {name:'additionalFields',type:'Map<String,Additional Fields Input>',req:false,location:'body',desc:'(v61.0) Additional Product2 fields.'},
      {name:'contextDefinition',type:'String',req:false,location:'body',desc:'(v61.0) Custom context definition API name.'},
      {name:'contextMapping',type:'String',req:false,location:'body',desc:'(v61.0) Context mapping for hydration.'},
      {name:'correlationId',type:'String',req:false,location:'body',desc:'(v61.0) Unique token for tracking.'},
      {name:'currencyCode',type:'String',req:false,location:'body',desc:'(v61.0) Currency code for pricing.'},
      {name:'enablePricing',type:'Boolean',req:false,location:'body',desc:'(v61.0) Enable pricing. Default: true.'},
      {name:'enableQualification',type:'Boolean',req:false,location:'body',desc:'(v61.0) Enable qualification rules. Default: true.'},
      {name:'priceBookId',type:'String',req:false,location:'body',desc:'(v61.0) Price book ID for prices.'},
      {name:'pricingProcedure',type:'String',req:false,location:'body',desc:'(v61.0) Custom pricing procedure API name.'},
      {name:'qualificationProcedure',type:'String',req:false,location:'body',desc:'(v61.0) Custom qualification procedure API name.'},
      {name:'userContext',type:'User Context Input[]',req:false,location:'body',desc:'(v61.0) User context details for qualification rules: accountId (String), contactId (String), contextId (String — ID of an existing session context).'},
    ],
    request:'{\n  "productData": [\n    {\n      "productId": "{{PRODUCT_ID}}",\n      "productSellingModelId": "{{SELLING_MODEL_ID}}"\n    }\n  ],\n  "priceBookId": "{{PRICE_BOOK_ID}}",\n  "currencyCode": "USD",\n  "enablePricing": true,\n  "enableQualification": true,\n  "userContext": {\n    "accountId": "{{ACCOUNT_ID}}"\n  },\n  "additionalFields": {\n    "Product2": {\n      "fields": ["ProductCode","Description"]\n    }\n  }\n}',
    response:'{\n  "correlationId": "bulk-detail-001",\n  "products": [\n    {\n      "id": "01tSa00000AzpIaIAJ",\n      "name": "ADM Offer",\n      "productCode": "BUND-SUB-ADM",\n      "isActive": true,\n      "nodeType": "bundleProduct",\n      "isAssetizable": true,\n      "configureDuringSale": "Allowed",\n      "productSpecificationType": {"name": "Commercial"},\n      "productSellingModelOptions": [\n        {"id": "0iOSa00000007SjMAI","isDefault": true,"productSellingModel": {"name": "Evergreen - Monthly","sellingModelType": "Evergreen","pricingTerm": 1,"pricingTermUnit": "Months"}}\n      ],\n      "prices": [{"priceType": "Standard","unitPrice": 50.00,"currencyCode": "USD"}],\n      "attributeCategory": [{"name": "Subscription Details","attributes": [{"name": "Subscription Term","dataType": "Picklist","defaultValue": "36","isRequired": true}]}],\n      "qualificationContext": {"isQualified": true,"qualificationReasons": []}\n    }\n  ],\n  "status": {"code": "200","message": "Successfully fetched bulk product details."}\n}',
    examples:[
      {
        type:'basic',
        label:'1 — Bulk details for multiple products',
        desc:'Retrieve details for 2+ products at once. productData is required — each entry must have productId, and optionally productSellingModelId to get pricing for a specific selling model.',
        steps:[
          'Add one productData entry per product ID you want details for',
          'Set priceBookId and enablePricing to get prices per product',
          'enableQualification:false skips qualification for faster response'
        ],
        body:'{"productData":[{"productId":"{{PRODUCT_ID_1}}","productSellingModelId":"{{SELLING_MODEL_ID_1}}"},{"productId":"{{PRODUCT_ID_2}}","productSellingModelId":"{{SELLING_MODEL_ID_2}}"}],"priceBookId":"{{PRICE_BOOK_ID}}","currencyCode":"USD","enablePricing":true,"enableQualification":false}'
      },
      {
        type:'with-context',
        label:'2 — With account context + extra fields (qualification)',
        desc:'Run qualification rules per-account and return extra Product2 fields. Use additionalFields to include custom attributes like ProductCode.',
        steps:[
          'Set userContext.accountId to run qualification per-account',
          'additionalFields lists extra standard/custom Product2 fields to include in the response'
        ],
        body:'{"productData":[{"productId":"{{PRODUCT_ID}}","productSellingModelId":"{{SELLING_MODEL_ID}}"}],"priceBookId":"{{PRICE_BOOK_ID}}","currencyCode":"USD","enablePricing":true,"enableQualification":true,"userContext":{"accountId":"{{ACCOUNT_ID}}","contactId":"{{CONTACT_ID}}"},"additionalFields":{"Product2":{"fields":["ProductCode","Description"]}}}'
      }
    ] },

  // Salesforce Pricing
  { id:'price-1', category:'Pricing', name:'Pricing', methods:['POST'],
    path:'/connect/core-pricing/pricing', version:'v60.0',
    desc:'Execute headless pricing calculation. Takes a context definition, context mapping, and raw Cart/CartItem JSON data. Returns pricing results as a map of output tags. Different from Instant Pricing (price-6) which takes Salesforce sObject records.',
    page:764,
    params:[
      {name:'contextDefinitionId',type:'String',req:true,desc:'ID or developer name of the context definition.'},
      {name:'contextMappingId',type:'String',req:true,desc:'ID or name of the context mapping.'},
      {name:'jsonDataString',type:'String',req:true,desc:'Cart/CartItem data as a JSON string to price.'},
      {name:'pricingProcedureId',type:'String',req:false,desc:'ID of a specific pricing procedure to use. If omitted, the default procedure is used.'},
      {name:'configurationOverrides',type:'Object',req:false,desc:'Override options: skipWaterfall (Boolean), useSessionScopedContext (Boolean), persistContext (Boolean), referenceKey (String), displayContext (String), taggedData (Object), isHighVolumeLineItems (Boolean).'},
    ],
    request:'{\n  "contextDefinitionId": "{{CONTEXT_DEFINITION_ID}}",\n  "contextMappingId": "{{CONTEXT_MAPPING_ID}}",\n  "jsonDataString": "{\\\"cartId\\\":\\\"{{CART_ID}}\\\",\\\"cartItems\\\":[{\\\"id\\\":\\\"item1\\\",\\\"quantity\\\":1,\\\"listPrice\\\":100}]}"\n}',
    response:'{\n  "apiExecutionId": "0YBSG00000000AAAA",\n  "pricingExecutionId": "0YBSG00000000BBBB",\n  "status": "Completed",\n  "pricingResult": {\n    "subtotal": [{"key": "item1","value": "100.00"}],\n    "netunitprice": [{"key": "item1","value": "95.00"}],\n    "discount": [{"key": "item1","value": "5.00"}]\n  },\n  "pricingResultErrors": []\n}' },

  { id:'price-2', category:'Pricing', name:'API Execution Logs', methods:['GET'],
    path:'/connect/core-pricing/apiexecutionlogs/{executionId}', version:'v63.0',
    desc:'Returns execution logs for a pricing API execution.',
    page:766,
    params:[{name:'executionId',type:'String',req:true,location:'path',desc:'Execution ID. (Path param)'}],
    request:'No request body.',
    response:'{\n  "executionId": "0YBSG00000000AAAA",\n  "status": "Success",\n  "startTime": "2024-07-09T10:00:00Z",\n  "endTime": "2024-07-09T10:00:02Z",\n  "logs": [\n    {"level": "INFO","message": "Pricing execution started","timestamp": "2024-07-09T10:00:00Z"},\n    {"level": "INFO","message": "List price applied: 100.00","timestamp": "2024-07-09T10:00:01Z"},\n    {"level": "INFO","message": "Pricing execution completed","timestamp": "2024-07-09T10:00:02Z"}\n  ]\n}' },

  { id:'price-3', category:'Pricing', name:'Pricing Waterfall (GET)', methods:['GET'],
    path:'/connect/core-pricing/waterfall/{lineItemId}/{executionId}', version:'v60.0',
    desc:'Returns the pricing waterfall for a line item execution.',
    page:773,
    params:[
      {name:'lineItemId',type:'String',req:true,location:'path',desc:'Line item ID. (Path param)'},
      {name:'executionId',type:'String',req:true,location:'path',desc:'Execution ID. (Path param)'},
      {name:'tagsToFilter',type:'String',req:false,location:'query',desc:'(v61.0) Comma-separated list of tags to filter waterfall steps by.'},
      {name:'usageType',type:'String',req:false,location:'query',desc:'(v62.0) Usage type filter: Pricing, Discovery, or Rating.'},
    ],
    request:'No request body.',
    response:'{\n  "lineItemId": "0QASa00000001AAAA",\n  "executionId": "0YBSG00000000AAAA",\n  "waterfall": [\n    {"stepName": "List Price","price": 100.00,"cumulative": 100.00},\n    {"stepName": "Tier Discount","price": -5.00,"cumulative": 95.00},\n    {"stepName": "Customer Discount","price": -5.00,"cumulative": 90.00},\n    {"stepName": "Net Price","price": 90.00,"cumulative": 90.00}\n  ]\n}' },

  { id:'price-4', category:'Pricing', name:'Pricing Waterfall (POST)', methods:['POST'],
    path:'/connect/core-pricing/waterfall', version:'v60.0',
    desc:'Persist/log waterfall results for a pricing execution. This is a write/persist operation — it stores the calculated waterfall data for later retrieval via GET. It is NOT a recalculation endpoint.',
    page:774,
    params:[
      {name:'executionId',type:'String',req:true,desc:'Execution ID of the pricing run.'},
      {name:'lineItemId',type:'String',req:true,desc:'ID of the line item the waterfall belongs to.'},
      {name:'waterfall',type:'Pricing Waterfall Input[]',req:true,desc:'Array of waterfall steps to persist. Each step: fieldToTagNameMapping (Object), inputParameters (Object), outputParameters (Object), pricingElement (String), sequence (Integer).'},
      {name:'currencyCode',type:'String',req:false,desc:'Currency ISO code.'},
      {name:'executionEndTimestamp',type:'String',req:false,desc:'ISO 8601 timestamp when execution ended.'},
      {name:'executionStartTimestamp',type:'String',req:false,desc:'ISO 8601 timestamp when execution started.'},
      {name:'output',type:'Map<String,Object>',req:false,desc:'Output values to persist alongside the waterfall.'},
      {name:'contextDefinitionVersionId',type:'String',req:false,desc:'ID of the context definition version used.'},
      {name:'contextMappingId',type:'String',req:false,desc:'ID of the context mapping used.'},
    ],
    request:'{\n  "executionId": "{{EXECUTION_ID}}",\n  "lineItemId": "{{LINE_ITEM_ID}}",\n  "waterfall": [\n    {\n      "pricingElement": "ListPrice",\n      "sequence": 1,\n      "inputParameters": {},\n      "outputParameters": {"netunitprice": 100.00},\n      "fieldToTagNameMapping": {}\n    }\n  ]\n}',
    response:'{\n  "success": true,\n  "id": "0YBSG00000000CCCC"\n}' },

  { id:'price-5', category:'Pricing', name:'Procedure Plan Definitions', methods:['GET','POST'],
    path:'/connect/procedure-plan-definitions', version:'v62.0',
    desc:'GET all procedure plan definitions. POST creates a new one.',
    page:776,
    params:[
      {name:'developerName',type:'String',req:true,desc:'(POST) Developer/API name of the definition.'},
      {name:'processType',type:'String',req:true,desc:'(POST) Process type of the definition. Valid values (from v63.0): Billing, DRO, DeepClone, ProductDiscovery, "Revenue Cloud", Default.'},
      {name:'procedurePlanDefinitionVersions',type:'Object[]',req:true,desc:'(POST) At least one version definition must be included inline.'},
      {name:'description',type:'String',req:false,desc:'(POST) Optional description.'},
      {name:'isTemplate',type:'Boolean',req:false,location:'query',desc:'(GET) When true, returns file-based template definitions.'},
    ],
    request:'{\n  "developerName": "StandardPricingPlan",\n  "processType": "Revenue Cloud",\n  "procedurePlanDefinitionVersions": [\n    {\n      "active": false,\n      "developerName": "v1",\n      "effectiveFrom": "2024-01-01T00:00:00.000Z",\n      "effectiveTo": "2025-01-01T00:00:00.000Z",\n      "rank": 1\n    }\n  ]\n}',
    response:'{\n  "id": "0YDSG00000001AAAA",\n  "developerName": "StandardPricingPlan",\n  "processType": "Revenue Cloud",\n  "success": true\n}' },

  { id:'price-6', category:'Pricing', name:'Instant Pricing', methods:['POST'],
    path:'/industries/cpq/quotes/actions/get-instant-price', version:'v60.0',
    desc:'Fetch instant pricing data for quote/order line grid.',
    page:1396,
    params:[
      {name:'contextId',type:'String',req:false,desc:'Existing context ID.'},
      {name:'records',type:'Object[]',req:true,desc:'Records to price.'},
    ],
    request:'{\n  "correlationId": "instant-price-001",\n  "records": [\n    {\n      "referenceId": "ref1",\n      "record": {\n        "attributes": {"type": "Quote","method": "POST"},\n        "Name": "Test Quote",\n        "Pricebook2Id": "{{PRICE_BOOK_ID}}"\n      }\n    }\n  ]\n}',
    response:'{\n  "contextId": "0HbSG00000001AAAA",\n  "records": [\n    {\n      "referenceId": "ref1",\n      "record": {\n        "attributes": {"type": "Quote"},\n        "TotalAmount": 150.00,\n        "NetAmount": 135.00,\n        "TaxAmount": 15.00\n      }\n    }\n  ]\n}',
    examples:[
      {
        type:'group-by',
        label:'GroupBy — group line items by product family',
        desc:'Use GroupBy to organize line items by a field such as ProductFamily. The response includes a groupId for each group.',
        steps:['Set groupAction to "GroupBy"','Specify groupBy field (e.g. "ProductFamily")','Run pricing — response includes groups with groupId'],
        body:'{"groupAction":"GroupBy","groupBy":"ProductFamily","records":[{"referenceId":"ref1","record":{"attributes":{"type":"QuoteLineItem","method":"PATCH"},"Id":"{{QUOTE_LINE_ID}}","Quantity":2}}]}'
      },
      {
        type:'group-all',
        label:'GroupAll — put all line items into a single group',
        desc:'GroupAll collapses all line items into one group for aggregate pricing.',
        steps:['Set groupAction to "GroupAll"','Run pricing'],
        body:'{"groupAction":"GroupAll","records":[{"referenceId":"ref1","record":{"attributes":{"type":"QuoteLineItem","method":"PATCH"},"Id":"{{QUOTE_LINE_ID}}"}}]}'
      },
      {
        type:'move-group',
        label:'MoveGroup — move a line item to another group',
        desc:'Move an existing line item to a different pricing group. Obtain groupId from a previous GroupBy call.',
        steps:['Obtain groupId from a previous GroupBy call','Set groupAction to "MoveGroup"','Specify targetGroupId'],
        body:'{"groupAction":"MoveGroup","targetGroupId":"grp-001","records":[{"referenceId":"ref2","record":{"attributes":{"type":"QuoteLineItem","method":"PATCH"},"Id":"{{QUOTE_LINE_ID_2}}"}}]}'
      }
    ] },

  { id:'price-7', category:'Pricing', name:'Procedure Plan Version (POST)', methods:['POST'],
    path:'/connect/procedure-plan-definitions/{procedurePlanDefinitionId}/version', version:'v62.0',
    desc:'Create records of a procedure plan version with details.',
    page:767,
    params:[
      {name:'procedurePlanDefinitionId',type:'String',req:true,location:'path',desc:'Procedure plan definition ID. (Path param — starts with 1FN)'},
      {name:'active',type:'Boolean',req:true,desc:'Whether the version is active. Cannot edit/delete an active version.'},
      {name:'contextDefinition',type:'String',req:true,desc:'Context definition associated with the version.'},
      {name:'developerName',type:'String',req:true,desc:'Unique developer name of the version.'},
      {name:'effectiveFrom',type:'String',req:true,desc:'Date/time the version comes into effect (ISO 8601).'},
      {name:'effectiveTo',type:'String',req:false,desc:'Date/time the version is no longer in effect (ISO 8601). Optional — omit for an open-ended version.'},
      {name:'procedurePlanSections',type:'Procedure Plan Section Input[]',req:true,desc:'Procedure setup sections.'},
      {name:'rank',type:'Integer',req:true,desc:'Rank for execution sequence.'},
      {name:'recordId',type:'String',req:true,desc:'ID of the procedure plan definition version record.'},
      {name:'readContextMapping',type:'String',req:false,desc:'Mapping used to read data from context definition.'},
      {name:'saveContextMapping',type:'String',req:false,desc:'Mapping used to save data to context definition.'},
    ],
    request:'{\n  "active": false,\n  "developerName": "sample_version_input",\n  "effectiveFrom": "2024-07-09T00:00:00.000Z",\n  "effectiveTo": "2025-07-09T00:00:00.000Z",\n  "contextDefinition": "SalesTransactionContext__stdctx",\n  "procedurePlanSections": [],\n  "rank": 1,\n  "recordId": "{{PROCEDURE_PLAN_VERSION_ID}}",\n  "readContextMapping": "ProductDiscoveryContextMapping",\n  "saveContextMapping": "OrderEntitiesMapping"\n}',
    response:'{\n  "id": "1CvSa0000001nzZKAQ",\n  "developerName": "sample_version_input",\n  "active": false,\n  "rank": 1,\n  "effectiveFrom": "2024-07-09T00:00:00.000Z",\n  "effectiveTo": "2025-07-09T00:00:00.000Z",\n  "success": true\n}' },

  { id:'price-8', category:'Pricing', name:'Procedure Plan Version Details', methods:['GET','PATCH','DELETE'],
    path:'/connect/procedure-plan-definitions/versions/{procedurePlanVersionId}', version:'v62.0',
    desc:'GET, update (PATCH), or delete a procedure plan definition version by record ID. Cannot delete the only version.',
    page:770,
    params:[
      {name:'procedurePlanVersionId',type:'String',req:true,location:'path',desc:'Procedure plan version record ID or name. (Path param — starts with 1Cv)'},
      {name:'active',type:'Boolean',req:false,desc:'(PATCH only) Active status. Cannot edit/delete an active version.'},
      {name:'contextDefinition',type:'String',req:false,desc:'(PATCH only) Context definition API name.'},
      {name:'developerName',type:'String',req:false,desc:'(PATCH only) Unique developer name.'},
      {name:'effectiveFrom',type:'String',req:false,desc:'(PATCH only) Effective from date/time. Required when setting a time-bounded version.'},
      {name:'effectiveTo',type:'String',req:false,desc:'(PATCH only) Effective end date/time. Required when setting a time-bounded version alongside effectiveFrom.'},
      {name:'procedurePlanSections',type:'Procedure Plan Section Input[]',req:false,desc:'(PATCH only) Procedure plan sections.'},
      {name:'rank',type:'Integer',req:false,desc:'(PATCH only) Execution rank.'},
      {name:'recordId',type:'String',req:false,desc:'(PATCH only) Version record ID.'},
      {name:'readContextMapping',type:'String',req:false,desc:'(PATCH only) Context mapping used to read input data.'},
      {name:'saveContextMapping',type:'String',req:false,desc:'(PATCH only) Context mapping used to save output data.'},
    ],
    request:'{\n  "active": false,\n  "developerName": "sample_version_input",\n  "effectiveFrom": "2024-07-09T00:00:00.000Z",\n  "contextDefinition": "SalesTransactionContext__stdctx",\n  "procedurePlanSections": [],\n  "rank": 1,\n  "recordId": "{{PROCEDURE_PLAN_VERSION_ID}}"\n}',
    response:'{\n  "id": "1CvSa0000001nzZKAQ",\n  "developerName": "sample_version_input",\n  "active": false,\n  "rank": 1,\n  "effectiveFrom": "2024-07-09T00:00:00.000Z",\n  "success": true\n}' },

  { id:'price-9', category:'Pricing', name:'Pricing Simulation Input Variables', methods:['GET'],
    path:'/connect/core-pricing/simulationInputVariablesWithData', version:'v64.0',
    desc:'Get details of the pricing simulation input variables along with associated data.',
    page:773,
    params:[
      {name:'contextDefinitionId',type:'String',req:true,location:'query',desc:'ID or developer name of the context definition.'},
      {name:'contextMappingId',type:'String',req:true,location:'query',desc:'ID or name of the context mapping.'},
      {name:'entityId',type:'String',req:true,location:'query',desc:'ID of a quote or order.'},
      {name:'expressionSetVersionId',type:'String',req:true,location:'query',desc:'ID of the expression set version (starts with 9QM).'},
    ],
    request:'No request body. All parameters are query params.',
    response:'{\n  "simulationInputVariables": [\n    {"apiName": "Quantity","label": "Quantity","dataType": "Number","currentValue": 1},\n    {"apiName": "UnitPrice","label": "Unit Price","dataType": "Currency","currentValue": 100.00},\n    {"apiName": "Discount","label": "Discount %","dataType": "Percent","currentValue": 10}\n  ]\n}' },

  // Rate Management
  { id:'rate-1', category:'Rate', name:'Rate Plan', methods:['GET'],
    path:'/connect/core-rating/rate-plan', version:'v62.0',
    desc:'Get a rate plan for a specified context. Retrieves rate cards, entries, and adjustments.',
    page:936,
    params:[
      {name:'contextId',type:'String',req:true,location:'query',desc:'Context input ID.'},
      {name:'procedureApiName',type:'String',req:true,location:'query',desc:'API name of the procedure.'},
    ],
    request:'No request body. Pass contextId and procedureApiName as query params.',
    response:'{\n  "success": true,\n  "executionId": "a521d592-71c3-4db3-8048-r64504df1605",\n  "ratePlan": {\n    "rateCards": [\n      {\n        "id": "0RP0000000001AAA",\n        "name": "Standard Rate Card",\n        "entries": [\n          {"minQty": 1,"maxQty": 100,"unitRate": 0.05},\n          {"minQty": 101,"maxQty": 1000,"unitRate": 0.04}\n        ]\n      }\n    ]\n  },\n  "error": {}\n}' },

  { id:'rate-2', category:'Rate', name:'Rating Waterfall', methods:['GET'],
    path:'/connect/core-pricing/waterfall/{lineItemId}/{executionId}', version:'v62.0',
    desc:'Get the persisted rating waterfall process logs.',
    page:937,
    params:[
      {name:'lineItemId',type:'String',req:true,location:'path',desc:'Line item ID. (Path param)'},
      {name:'executionId',type:'String',req:true,location:'path',desc:'Execution ID. (Path param)'},
      {name:'tagsToFilter',type:'String',req:false,desc:'Comma-separated tags.'},
      {name:'usageType',type:'String',req:false,desc:'(v62.0) Filter by waterfall type. Valid values: Rating, Pricing. Default is Pricing. Use Rating to fetch rating waterfall logs.'},
    ],
    request:'No request body.',
    response:'{\n  "success": true,\n  "usageType": "Rating",\n  "output": {"quantity": "250","netUnitPrice": "0.045"},\n  "waterfall": [\n    {"stepName": "Tier 1 Rate","rate": 0.05,"quantity": 100,"amount": 5.00},\n    {"stepName": "Tier 2 Rate","rate": 0.04,"quantity": 150,"amount": 6.00},\n    {"stepName": "Net Charge","rate": null,"quantity": 250,"amount": 11.00}\n  ]\n}' },

  { id:'rate-3', category:'Rate', name:'Invoke Rating Service Action', methods:['POST'],
    path:'/services/data/v67.0/actions/standard/invokeRatingService', version:'v62.0',
    desc:'Invokes the rating service to calculate usage-based pricing.',
    page:935,
    params:[
      {name:'contextDefinitionId',type:'String',req:true,location:'body',desc:'(v62.0) ID of the context definition for the rating service.'},
      {name:'recordID',type:'String',req:true,location:'body',desc:'(v62.0) ID of the record to rate (e.g., OrderItem ID). Note: field name uses capital D per the API spec.'},
      {name:'contextMappingID',type:'String',req:false,location:'body',desc:'(v62.0) ID of the context mapping.'},
      {name:'procedureName',type:'String',req:false,location:'body',desc:'(v62.0) API name of the rating procedure.'},
      {name:'baseRateCardID',type:'String',req:false,location:'body',desc:'(v62.0) ID of the base rate card.'},
      {name:'tierRateCardID',type:'String',req:false,location:'body',desc:'(v62.0) ID of the tier rate card.'},
      {name:'attributeRateCardID',type:'String',req:false,location:'body',desc:'(v62.0) ID of the attribute rate card.'},
      {name:'isSkipWaterfall',type:'Boolean',req:false,location:'body',desc:'(v62.0) If true, skips waterfall logging. Default: false.'},
    ],
    request:'{\n  "inputs": [\n    {\n      "contextDefinitionId": "{{CONTEXT_DEFINITION_ID}}",\n      "recordID": "{{ORDER_ITEM_ID}}"\n    }\n  ]\n}',
    response:'[\n  {\n    "actionName": "invokeRatingService",\n    "errors": null,\n    "isSuccess": true,\n    "outputValues": {}\n  }\n]' },

  // Configurator
  { id:'cfg-1', category:'Configurator', name:'Configuration', methods:['POST'],
    path:'/connect/cpq/configurator/actions/configure', version:'v60.0',
    desc:'Retrieve and update a product\'s configuration from a configurator. Executes configuration rules, validates bundle structure, notifies of violations, and returns pricing. Use to initiate a new configuration context (pass transactionId + transactionLineId) OR modify an existing one (pass transactionContextId + addedNodes/updatedNodes/deletedNodes).',
    page:970,
    params:[
      {name:'transactionId',type:'String',req:true,desc:'ID of the sales transaction (quote or order) being configured. Starts with 0Q0.'},
      {name:'transactionLineId',type:'String',req:false,desc:'ID of the top-level line item to configure (the bundle root). Starts with 0QL. Required when initiating a new context.'},
      {name:'correlationId',type:'String',req:false,desc:'Optional UUID for request traceability in logs. Generate any unique string e.g. a UUID.'},
      {name:'transactionContextId',type:'String',req:false,desc:'ID of an existing transaction context to continue modifying (returned from a previous configure call). Required when adding/updating/deleting nodes in an existing context.'},
      {name:'contextResponseType',type:'String',req:false,desc:'Response scope. Valid values: Delta (only changed items), Full (all items in transaction), None (empty response), Product (items related to configured product). Required for transactions >1000 line items (v65.0+).'},
      {name:'configuratorOptions',type:'Object',req:false,desc:'Options controlling configurator behavior. addDefaultConfiguration (Boolean v60) — add default configs. executeConfigurationRules (Boolean v60) — run config rules. executePricing (Boolean v60) — run pricing. explainabilityEnabled (Boolean v66) — collect solver explainability logs (use with Action Logs API). pricingProcedure (String v60) — name of pricing procedure to use. qualifyAllProductsInTransaction (Boolean v60) — run qualification on all products. returnProductCatalogData (Boolean v60) — include catalog metadata; set false when calling without the Configurator UI. validateAmendRenewCancel (Boolean v60) — run A/R/C validations. validateProductCatalog (Boolean v60) — validate against catalog.'},
      {name:'qualificationContext',type:'User Context Input',req:false,desc:'User context for qualification rules. accountId (String v60) — account ID. contactId (String v60) — contact ID. contextId (String v60) — ID of an existing session context.'},
      {name:'addedNodes',type:'Configurator Added Node Input[]',req:false,desc:'Nodes to add. Each entry has: path (String[] — hierarchy of IDs from transactionId down to the new node; 2 IDs for a line item, 3 IDs for a relationship) and addedObject (Map<String,Object> — supports all Sales Transaction context fields). For a QuoteLineItem: set businessObjectType="QuoteLineItem", SalesTransactionItemSource=same as id, SalesTransactionItemParent=parent transaction ID, PricebookEntry, ProductSellingModel, Product, Quantity, UnitPrice. For a relationship: businessObjectType="QuoteLineRelationship" (quotes) or "OrderItemRelationship" (orders), MainItem=parent line ID, AssociatedItem=ref_ ID of the child, ProductRelatedComponent, AssociatedItemPricing, AssociatedQuantScaleMethod.'},
      {name:'updatedNodes',type:'Object[]',req:false,desc:'Nodes to update. Each has: path (String[] pointing to the node) and updatedAttributes (object with fields to change, e.g. { "Quantity": 5 }).'},
      {name:'deletedNodes',type:'Object[]',req:false,desc:'Nodes to delete. Each has: path (String[] pointing to the node to remove).'},
    ],
    request:'{\n  "transactionId": "0Q0AW00000123ABCDE",\n  "transactionLineId": "0QLAW000001XYZABCD",\n  "correlationId": "c95246d4-102c-4ecd-a263-f74ac525d1e5",\n  "configuratorOptions": {\n    "executePricing": true,\n    "returnProductCatalogData": true,\n    "executeConfigurationRules": true,\n    "addDefaultConfiguration": true,\n    "validateProductCatalog": true,\n    "validateAmendRenewCancel": true,\n    "qualifyAllProductsInTransaction": true\n  },\n  "contextResponseType": "Full",\n  "qualificationContext": {\n    "accountId": "001AW00001s9qg4YAA",\n    "contactId": "003AW00001XYZABCD"\n  },\n  "transactionContextId": "008d27d7-e004-4906-a949-ee7d7c323c77",\n  "addedNodes": [\n    {\n      "path": ["0Q0AW00000123ABCDE", "ref_d3a3f8d2_e031_4517_ae28_69ce16cb6589"],\n      "addedObject": {\n        "id": "ref_d3a3f8d2_e031_4517_ae28_69ce16cb6589",\n        "SalesTransactionItemSource": "ref_d3a3f8d2_e031_4517_ae28_69ce16cb6589",\n        "SalesTransactionItemParent": "0Q0AW00000123ABCDE",\n        "businessObjectType": "QuoteLineItem",\n        "PricebookEntry": "01uSa00000650DsIAI",\n        "ProductSellingModel": "0jPSa00000007SjMAI",\n        "Product": "01tSa00000AzpIXIAZ",\n        "Quantity": 1,\n        "UnitPrice": 33.96\n      }\n    },\n    {\n      "path": ["0Q0AW00000123ABCDE", "ref_d3a3f8d2_e031_4517_ae28_69ce16cb6589", "ref_d85b036d_d305_4bb6_aba8_a1dff645a664"],\n      "addedObject": {\n        "id": "ref_d85b036d_d305_4bb6_aba8_a1dff645a664",\n        "businessObjectType": "QuoteLineRelationship",\n        "MainItem": "0QLAW000001XYZABCD",\n        "AssociatedItem": "ref_d3a3f8d2_e031_4517_ae28_69ce16cb6589",\n        "ProductRelatedComponent": "0dSAW0000000q2T2AQ",\n        "ProductRelationshipType": null,\n        "AssociatedItemPricing": "NotIncludedInBundlePrice",\n        "AssociatedQuantScaleMethod": "Proportional"\n      }\n    }\n  ],\n  "updatedNodes": [\n    {\n      "path": ["0Q0AW00000123ABCDE", "0QLAW000001XYZABCD"],\n      "updatedAttributes": {\n        "Quantity": 2\n      }\n    }\n  ],\n  "deletedNodes": [\n    {\n      "path": ["0Q0AW00000123ABCDE", "0QLAW000001SOME_OLD_LINE"]\n    }\n  ]\n}',
    response:'{\n  "contextId": "008d27d7-e004-4906-a949-ee7d7c323c77",\n  "success": true,\n  "errors": [],\n  "salesTransaction": {\n    "id": "0Q0AW00000123ABCDE",\n    "salesTransactionItems": [\n      {\n        "id": "0QLAW000001XYZABCD",\n        "product": { "id": "01tSa00000AzpIaIAJ", "name": "ADM Offer", "productCode": "BUND-SUB-ADM" },\n        "quantity": 2,\n        "unitPrice": 33.96,\n        "totalPrice": 67.92,\n        "salesTransactionItemRelationships": [\n          {\n            "id": "ref_relationship_001",\n            "associatedItem": { "id": "ref_component_001" },\n            "associatedItemPricing": "NotIncludedInBundlePrice"\n          }\n        ]\n      }\n    ]\n  },\n  "productQualifications": {\n    "01tSa00000AzpIXIAZ": { "isQualified": true }\n  },\n  "configuratorMessages": {},\n  "violations": []\n}',
    examples:[
      {
        type:'initiate',
        label:'1 — Initiate a new configuration context (Quote)',
        desc:'First call for a bundle line item. Pass transactionId (Quote ID) + transactionLineId (top-level QLI). The response gives you contextId — save it for all subsequent modify calls.',
        steps:[
          'Replace transactionId with your Quote ID (starts with 0Q0)',
          'Replace transactionLineId with the bundle root QLI ID (starts with 0QL)',
          'Replace accountId in qualificationContext with your Account ID',
          'Response contextId is used as transactionContextId in all follow-up calls'
        ],
        body:'{"transactionId":"0Q0AW00000123ABCDE","transactionLineId":"0QLAW000001XYZABCD","correlationId":"c95246d4-102c-4ecd-a263-f74ac525d1e5","configuratorOptions":{"executePricing":true,"returnProductCatalogData":true,"executeConfigurationRules":true,"addDefaultConfiguration":true,"validateProductCatalog":true,"validateAmendRenewCancel":true,"qualifyAllProductsInTransaction":true},"contextResponseType":"Full","qualificationContext":{"accountId":"001AW00001s9qg4YAA"}}'
      },
      {
        type:'modify',
        label:'2 — Add a component to an existing context (Quote)',
        desc:'Add a child QuoteLineItem and its QuoteLineRelationship to an existing configuration context. Use the contextId from the Initiate call as transactionContextId. Path has 2 entries for a line item, 3 entries for its relationship.',
        steps:[
          'Replace transactionId with your Quote ID',
          'Replace transactionContextId with the contextId from the Initiate response',
          'Replace transactionLineId with the parent bundle QLI ID',
          'Replace PricebookEntry, ProductSellingModel, Product with real IDs from your org',
          'Replace ProductRelatedComponent with the 0dS... ID from your product bundle structure',
          'SalesTransactionItemSource and id must match (use a unique ref_ string)',
          'SalesTransactionItemParent = the Quote ID (transaction root)'
        ],
        body:'{"transactionId":"0Q0AW00000123ABCDE","transactionLineId":"0QLAW000001XYZABCD","transactionContextId":"008d27d7-e004-4906-a949-ee7d7c323c77","correlationId":"c95246d4-102c-4ecd-a263-f74ac525d1e5","configuratorOptions":{"executePricing":true,"returnProductCatalogData":true,"executeConfigurationRules":true,"addDefaultConfiguration":true,"validateProductCatalog":true,"validateAmendRenewCancel":true},"contextResponseType":"Delta","qualificationContext":{"accountId":"001AW00001s9qg4YAA"},"addedNodes":[{"path":["0Q0AW00000123ABCDE","ref_d3a3f8d2_e031_4517_ae28_69ce16cb6589"],"addedObject":{"id":"ref_d3a3f8d2_e031_4517_ae28_69ce16cb6589","SalesTransactionItemSource":"ref_d3a3f8d2_e031_4517_ae28_69ce16cb6589","SalesTransactionItemParent":"0Q0AW00000123ABCDE","businessObjectType":"QuoteLineItem","PricebookEntry":"01uSa00000650DsIAI","ProductSellingModel":"0jPSa00000007SjMAI","Product":"01tSa00000AzpIXIAZ","Quantity":1,"UnitPrice":33.96}},{"path":["0Q0AW00000123ABCDE","ref_d3a3f8d2_e031_4517_ae28_69ce16cb6589","ref_d85b036d_d305_4bb6_aba8_a1dff645a664"],"addedObject":{"id":"ref_d85b036d_d305_4bb6_aba8_a1dff645a664","businessObjectType":"QuoteLineRelationship","MainItem":"0QLAW000001XYZABCD","AssociatedItem":"ref_d3a3f8d2_e031_4517_ae28_69ce16cb6589","ProductRelatedComponent":"0dSAW0000000q2T2AQ","ProductRelationshipType":null,"AssociatedItemPricing":"NotIncludedInBundlePrice","AssociatedQuantScaleMethod":"Proportional"}}],"updatedNodes":[],"deletedNodes":[]}'
      },
      {
        type:'modify',
        label:'3 — Update quantity of an existing line item',
        desc:'Update the Quantity of an existing QLI already in the context. Only pass updatedAttributes with the fields that changed.',
        steps:[
          'Replace transactionId with your Quote ID',
          'Replace transactionContextId with the contextId from the Initiate response',
          'Replace the path entry 0QLAW000001XYZABCD with the real QLI ID to update',
          'Add any other fields to updatedAttributes that need changing (UnitPrice, Description, etc.)'
        ],
        body:'{"transactionId":"0Q0AW00000123ABCDE","transactionLineId":"0QLAW000001XYZABCD","transactionContextId":"008d27d7-e004-4906-a949-ee7d7c323c77","correlationId":"c95246d4-102c-4ecd-a263-f74ac525d1e5","configuratorOptions":{"executePricing":true,"executeConfigurationRules":true},"contextResponseType":"Delta","updatedNodes":[{"path":["0Q0AW00000123ABCDE","0QLAW000001XYZABCD"],"updatedAttributes":{"Quantity":5}}],"addedNodes":[],"deletedNodes":[]}'
      },
      {
        type:'order',
        label:'4 — Add a component to an Order (OrderItem)',
        desc:'Same structure as the Quote example but businessObjectType is OrderItem and OrderItemRelationship instead of QuoteLineItem and QuoteLineRelationship.',
        steps:[
          'Replace transactionId with your Order ID (starts with 801)',
          'Replace transactionContextId with the contextId from the Initiate response',
          'Replace PricebookEntry, ProductSellingModel, Product with real IDs',
          'Note: businessObjectType = OrderItem (not QuoteLineItem)',
          'Note: relationship businessObjectType = OrderItemRelationship'
        ],
        body:'{"transactionId":"801AW00001spT6sYAE","transactionLineId":"802AW00001XYZABCD","transactionContextId":"008d27d7-e004-4906-a949-ee7d7c323c77","correlationId":"c95246d4-102c-4ecd-a263-f74ac525d1e5","configuratorOptions":{"executePricing":true,"returnProductCatalogData":true,"executeConfigurationRules":true,"addDefaultConfiguration":true},"contextResponseType":"Delta","qualificationContext":{"accountId":"001AW00001s9qg4YAA"},"addedNodes":[{"path":["801AW00001spT6sYAE","ref_d3a3f8d2_e031_4517_ae28_69ce16cb6589"],"addedObject":{"id":"ref_d3a3f8d2_e031_4517_ae28_69ce16cb6589","SalesTransactionItemSource":"ref_d3a3f8d2_e031_4517_ae28_69ce16cb6589","SalesTransactionItemParent":"801AW00001spT6sYAE","businessObjectType":"OrderItem","PricebookEntry":"01uSa00000650DsIAI","ProductSellingModel":"0jPSa00000007SjMAI","Product":"01tSa00000AzpIXIAZ","Quantity":1,"UnitPrice":33.96}},{"path":["801AW00001spT6sYAE","ref_d3a3f8d2_e031_4517_ae28_69ce16cb6589","ref_d85b036d_d305_4bb6_aba8_a1dff645a664"],"addedObject":{"id":"ref_d85b036d_d305_4bb6_aba8_a1dff645a664","businessObjectType":"OrderItemRelationship","MainItem":"802AW00001XYZABCD","AssociatedItem":"ref_d3a3f8d2_e031_4517_ae28_69ce16cb6589","ProductRelatedComponent":"0dSAW0000000q2T2AQ","ProductRelationshipType":null,"AssociatedItemPricing":"NotIncludedInBundlePrice","AssociatedQuantScaleMethod":"Proportional"}}],"updatedNodes":[],"deletedNodes":[]}'
      }
    ] },

  { id:'cfg-2', category:'Configurator', name:'Saved Configuration', methods:['GET','POST'],
    path:'/connect/cpq/configurator/saved-configuration', version:'v63.0',
    desc:'GET retrieves a list of saved configurations for a record (pass referenceRecordId as query param). POST saves the current configuration of a line item so it can be applied to other quotes/orders later.',
    page:971,
    params:[
      {name:'referenceRecordId',type:'String',req:true,desc:'(GET query param) ID of the record whose saved configurations must be retrieved. (POST body field) ID of the product record for which the configuration must be saved (starts with 01t).'},
      {name:'data',type:'String',req:false,desc:'(POST) The sales transaction line item data as a JSON string (URL-encoded). Contains the full QLI object including SalesTransactionItemAttribute array.'},
      {name:'description',type:'String',req:false,desc:'(POST) Human-readable description of this saved configuration.'},
      {name:'name',type:'String',req:false,desc:'(POST) Name for this saved configuration.'},
    ],
    request:'{\n  "data": "{\\"LegalEntity\\":null,\\"ProductName\\":\\"Monitor\\",\\"businessObjectType\\":\\"QuoteLineItem\\",\\"Product\\":\\"01txx0000006i2aAAA\\",\\"Quantity\\":12,\\"UnitPrice\\":144.99,\\"PricebookEntry\\":\\"01uxx0000008yX0AAI\\",\\"ProductSellingModel\\":\\"0jPxx0000000001EAA\\",\\"SalesTransactionItemSource\\":\\"0QLxx0000004C9VGAU\\",\\"SalesTransactionItemParent\\":\\"0Q0xx0000004C92CAE\\",\\"id\\":\\"0QLxx0000004C9VGAU\\",\\"SalesTransactionItemAttribute\\":[{\\"AttributeKey\\":\\"0tjxx0000000001AAA\\",\\"AttributeValue\\":\\"1080p Built-in Display\\",\\"ParentReference\\":\\"0QLxx0000004C9VGAU\\",\\"AttributePicklistValue\\":\\"0v6xx0000000001AAA\\",\\"businessObjectType\\":\\"QuoteLineItemAttribute\\",\\"id\\":\\"0zuxx000000000FAAQ\\"}]}",\n  "description": "This configuration is saved for reuse.",\n  "name": "Favorite Configuration",\n  "referenceRecordId": "01txx0000006iCFAAY"\n}',
    response:'// Success\n{\n  "errors": [],\n  "id": "1Nyxx0000004CNYCA2"\n}\n\n// Error\n{\n  "errors": [{\n    "code": "INTERNAL_SERVER_ERROR",\n    "message": "INVALID_REFERENCEOBJECTID"\n  }]\n}',
    examples:[
      {
        type:'get',
        label:'1 — GET: List saved configurations for a product',
        desc:'Retrieve all saved configurations for a given product (by referenceRecordId). Switch the method to GET and pass referenceRecordId as a query parameter.',
        steps:[
          'Change method to GET in Try It',
          'Add referenceRecordId as a query parameter (the product ID starting with 01t)',
          'Leave the request body empty',
          'Response is a list of Configuration List items with id, name, description'
        ],
        body:''
      },
      {
        type:'post',
        label:'2 — POST: Save a configuration for reuse',
        desc:'Save the configuration of an existing QuoteLineItem so it can be applied to other quotes. The data field must be a JSON string (the entire QLI object serialized as a string, not an object).',
        steps:[
          'Replace referenceRecordId with the Product2 ID (01t...) of the product being configured',
          'The data field contains the full QLI object as a serialized JSON string — get this from a prior configure response',
          'SalesTransactionItemAttribute array inside data should include all attribute key/value pairs',
          'Response returns id (1Ny...) on success, or errors array on failure'
        ],
        body:'{"data":"{\\"LegalEntity\\":null,\\"ProductName\\":\\"Monitor\\",\\"businessObjectType\\":\\"QuoteLineItem\\",\\"Product\\":\\"01txx0000006i2aAAA\\",\\"Quantity\\":12,\\"UnitPrice\\":144.99,\\"PricebookEntry\\":\\"01uxx0000008yX0AAI\\",\\"ProductSellingModel\\":\\"0jPxx0000000001EAA\\",\\"SalesTransactionItemSource\\":\\"0QLxx0000004C9VGAU\\",\\"SalesTransactionItemParent\\":\\"0Q0xx0000004C92CAE\\",\\"id\\":\\"0QLxx0000004C9VGAU\\",\\"SalesTransactionItemAttribute\\":[{\\"AttributeKey\\":\\"0tjxx0000000001AAA\\",\\"AttributeValue\\":\\"1080p Built-in Display\\",\\"ParentReference\\":\\"0QLxx0000004C9VGAU\\",\\"AttributePicklistValue\\":\\"0v6xx0000000001AAA\\",\\"businessObjectType\\":\\"QuoteLineItemAttribute\\",\\"id\\":\\"0zuxx000000000FAAQ\\"}]}","description":"This configuration is saved for reuse.","name":"Favorite Configuration","referenceRecordId":"01txx0000006iCFAAY"}'
      }
    ] },

  { id:'cfg-2b', category:'Configurator', name:'Saved Configuration (DELETE/PUT)', methods:['DELETE','PUT'],
    path:'/connect/cpq/configurator/saved-configuration/{id}', version:'v63.0',
    desc:'DELETE removes a saved configuration by ID (no request body needed). PUT updates the data, name, and description of an existing saved configuration — all three PUT body fields are required.',
    page:972,
    params:[
      {name:'id',type:'String',req:true,location:'path',desc:'ID of the saved configuration to update or delete (starts with 1Ny — returned from POST /saved-configuration).'},
      {name:'data',type:'String',req:true,desc:'(PUT, Required) Full QLI object as a serialized JSON string. Same format as POST /saved-configuration — include SalesTransactionItemAttribute array for attributes.'},
      {name:'description',type:'String',req:true,desc:'(PUT, Required) Description of the configuration.'},
      {name:'name',type:'String',req:true,desc:'(PUT, Required) Name of the configuration.'},
    ],
    request:'{\n  "data": "{\\"LegalEntity\\":null,\\"ProductName\\":\\"Monitor\\",\\"businessObjectType\\":\\"QuoteLineItem\\",\\"Product\\":\\"01txx0000006i2aAAA\\",\\"Quantity\\":12,\\"UnitPrice\\":144.99,\\"PricebookEntry\\":\\"01uxx0000008yX0AAI\\",\\"ProductSellingModel\\":\\"0jPxx0000000001EAA\\",\\"SalesTransactionItemSource\\":\\"0QLxx0000004C9VGAU\\",\\"SalesTransactionItemParent\\":\\"0Q0xx0000004C92CAE\\",\\"id\\":\\"0QLxx0000004C9VGAU\\",\\"SalesTransactionItemAttribute\\":[{\\"AttributeKey\\":\\"0tjxx0000000001AAA\\",\\"AttributeValue\\":\\"4K Display\\",\\"ParentReference\\":\\"0QLxx0000004C9VGAU\\",\\"AttributePicklistValue\\":\\"0v6xx0000000002AAA\\",\\"businessObjectType\\":\\"QuoteLineItemAttribute\\",\\"id\\":\\"0zuxx000000000FAAQ\\"}]}",\n  "description": "This configuration is updated.",\n  "name": "Updated Configuration"\n}',
    response:'// Success\n{\n  "errors": [],\n  "success": true\n}\n\n// Error\n{\n  "errors": [{\n    "code": "INTERNAL_SERVER_ERROR",\n    "message": "INVALID_REFERENCEOBJECTID"\n  }],\n  "success": false\n}',
    examples:[
      {
        type:'delete',
        label:'1 — DELETE: Remove a saved configuration',
        desc:'Delete a saved configuration by its ID (1Ny...). No request body needed — just set the path parameter and switch the method to DELETE.',
        steps:[
          'Change method to DELETE in Try It',
          'Set the {id} path parameter to the saved configuration ID (1Ny...)',
          'Leave the request body empty',
          'Response is empty (204 No Content) on success'
        ],
        body:''
      },
      {
        type:'put',
        label:'2 — PUT: Update name, description, or data of a saved configuration',
        desc:'Update an existing saved configuration. All three fields (data, description, name) are required. The data field must be the full QLI as a serialized JSON string.',
        steps:[
          'Change method to PUT in Try It',
          'Set the {id} path parameter to the saved configuration ID (1Ny...)',
          'Replace data with the updated QLI JSON string — include the full object even if only changing attributes',
          'Response: { "errors": [], "success": true } on success'
        ],
        body:'{"data":"{\\"LegalEntity\\":null,\\"ProductName\\":\\"Monitor\\",\\"businessObjectType\\":\\"QuoteLineItem\\",\\"Product\\":\\"01txx0000006i2aAAA\\",\\"Quantity\\":12,\\"UnitPrice\\":144.99,\\"PricebookEntry\\":\\"01uxx0000008yX0AAI\\",\\"ProductSellingModel\\":\\"0jPxx0000000001EAA\\",\\"SalesTransactionItemSource\\":\\"0QLxx0000004C9VGAU\\",\\"SalesTransactionItemParent\\":\\"0Q0xx0000004C92CAE\\",\\"id\\":\\"0QLxx0000004C9VGAU\\",\\"SalesTransactionItemAttribute\\":[{\\"AttributeKey\\":\\"0tjxx0000000001AAA\\",\\"AttributeValue\\":\\"4K Display\\",\\"ParentReference\\":\\"0QLxx0000004C9VGAU\\",\\"AttributePicklistValue\\":\\"0v6xx0000000002AAA\\",\\"businessObjectType\\":\\"QuoteLineItemAttribute\\",\\"id\\":\\"0zuxx000000000FAAQ\\"}]}","description":"This configuration is updated.","name":"Updated Configuration"}'
      }
    ] },

  { id:'cfg-3', category:'Configurator', name:'Configurator Add Nodes', methods:['POST'],
    path:'/connect/cpq/configurator/actions/add-nodes', version:'v60.0',
    desc:'Add one or more nodes (line items, relationships) to an existing configuration context without using the Salesforce UI. Use after load-instance to build out the bundle structure programmatically.',
    page:975,
    params:[
      {name:'contextId',type:'String',req:true,desc:'ID of the context object to add nodes into (returned from load-instance or configure).'},
      {name:'addedNodes',type:'Configurator Added Node Input[]',req:true,desc:'Nodes to add. Each has path (String[]) and addedObject (Map<String,Object>). Path rules: QuoteLineItem → 2 IDs [quoteId, qliRef]. QuoteLineRelationship → 3 IDs [quoteId, qliRef, relationshipRef]. OrderItem → 2 IDs. OrderItemRelationship → 3 IDs. addedObject must include id, SalesTransactionItemSource (= id), SalesTransactionItemParent (= transactionId), businessObjectType, PricebookEntry, ProductSellingModel, Product, Quantity, UnitPrice. Relationship addedObject: id, MainItem (parent QLI ID), AssociatedItem (child ref_), ProductRelatedComponent, AssociatedItemPricing, AssociatedQuantScaleMethod, businessObjectType.'},
      {name:'configuratorOptions',type:'Configurator Options Input',req:false,desc:'Options: addDefaultConfiguration, executeConfigurationRules, executePricing, explainabilityEnabled (Boolean v66 — collect solver logs), pricingProcedure (String), qualifyAllProductsInTransaction, returnProductCatalogData (set false when not using Configurator UI), validateAmendRenewCancel, validateProductCatalog.'},
      {name:'qualificationContext',type:'User Context Input',req:false,desc:'User context for qualification rules: accountId (String), contactId (String), contextId (String — existing session).'},
    ],
    request:'{\n  "configuratorOptions": {\n    "executePricing": true,\n    "returnProductCatalogData": true,\n    "qualifyAllProductsInTransaction": true,\n    "validateProductCatalog": true,\n    "validateAmendRenewCancel": true,\n    "executeConfigurationRules": true,\n    "addDefaultConfiguration": true\n  },\n  "qualificationContext": {\n    "accountId": "001xx0000000001AAA",\n    "contactId": "003xx00000000D7AAI"\n  },\n  "contextId": "008d27d7-e004-4906-a949-ee7d7c323c77",\n  "addedNodes": [\n    {\n      "path": ["0Q0xx0000004EvcCAE", "ref_d3a3f8d2_e031_4517_ae28_69ce16cb6589"],\n      "addedObject": {\n        "id": "ref_d3a3f8d2_e031_4517_ae28_69ce16cb6589",\n        "SalesTransactionItemSource": "ref_d3a3f8d2_e031_4517_ae28_69ce16cb6589",\n        "SalesTransactionItemParent": "0Q0xx0000004EvcCAE",\n        "PricebookEntry": "01uxx00000090VuAAI",\n        "ProductSellingModel": "0jPxx00000001KHEAY",\n        "UnitPrice": 15.26,\n        "Quantity": 1,\n        "Product": "01txx0000006lfHAAQ",\n        "businessObjectType": "QuoteLineItem"\n      }\n    },\n    {\n      "path": ["0Q0xx0000004EvcCAE", "ref_d3a3f8d2_e031_4517_ae28_69ce16cb6589", "ref_d85b036d_d305_4bb6_aba8_a1dff645a664"],\n      "addedObject": {\n        "id": "ref_d85b036d_d305_4bb6_aba8_a1dff645a664",\n        "MainItem": "0QLxx0000004QdRGAU",\n        "AssociatedItem": "ref_d3a3f8d2_e031_4517_ae28_69ce16cb6589",\n        "ProductRelatedComponent": "0dSxx00000001p6EAA",\n        "ProductRelationshipType": null,\n        "AssociatedItemPricing": "NotIncludedInBundlePrice",\n        "AssociatedQuantScaleMethod": "Proportional",\n        "businessObjectType": "QuoteLineRelationship"\n      }\n    }\n  ]\n}',
    response:'{\n  "configuratorMessages": {},\n  "configuratorUITreatments": [\n    {\n      "details": {\n        "attributeId": "0tjxx0000000007AAA",\n        "prcId": "0dSxx0000000007EAA",\n        "stiId": "0QLxx0000004CU0GAM",\n        "attributePicklistValueId": "0v6xx0000000005AAA"\n      },\n      "uiTreatmentScope": "Bundle",\n      "uiTreatmentTarget": "Attribute_Picklist_Value",\n      "uiTreatmentType": "Hide"\n    },\n    {\n      "details": {\n        "stiId": "ref_f0f2da7b_c431_482d_bf4b_599052f3a2e1"\n      },\n      "uiTreatmentScope": "Product",\n      "uiTreatmentTarget": "Component",\n      "uiTreatmentType": "Disable"\n    }\n  ],\n  "errors": [],\n  "productQualifications": {\n    "01tDU000000EOTCYA4": { "isQualified": true }\n  },\n  "success": true\n}' },

  { id:'cfg-4', category:'Configurator', name:'Config Rules Execute', methods:['POST'],
    path:'/services/data/v65.0/actions/standard/runConfigRules', version:'v65.0',
    desc:'Run configuration rules for a quote or order via standard invocable action. Returns message rules (validation/warning/info), product recommendation rules, visibility rules (hide/disable), and a transactionContextId. Pass either transactionContextId or transactionId — one is required. Wrap inputs in the standard invocable action "inputs" array.',
    page:978,
    params:[
      {name:'transactionContextId',type:'String',req:false,location:'body',desc:'ID of the sales transaction context instance. Required if transactionId is not specified.'},
      {name:'transactionId',type:'String',req:false,location:'body',desc:'ID of the quote or order. Required if transactionContextId is not specified.'},
    ],
    request:'{\n  "inputs": [\n    {\n      "transactionContextId": "008d27d7-e004-4906-a949-ee7d7c323c77",\n      "transactionId": "0Q0DU0000005tJh0AI"\n    }\n  ]\n}',
    response:'[\n  {\n    "actionName": "runConfigRules",\n    "isSuccess": true,\n    "outputValues": {\n      "transactionContextId": "0000000r25tq18g00291775730228818e689c3c5756e409fb3f886f68937ab13",\n      "configRuleResult": {\n        "errors": [],\n        "messageRules": [\n          {\n            "stiId": "0Q0VW000000z8yN0AQ",\n            "severity": "error",\n            "messages": ["You have a 128GB LRDIMM QLI"]\n          },\n          {\n            "stiId": "0Q0VW000000z8yN0AQ",\n            "severity": "warning",\n            "messages": ["You have a 16GB RDIMM QLI"]\n          }\n        ],\n        "productRecommendationRules": [\n          {\n            "message": "32GB RDIMM recommends 16GB RDIMM",\n            "productIds": ["01tVW000003l7uaYAA"],\n            "referenceId": "0Q0VW000000z8yN0AQ"\n          }\n        ],\n        "visibilityRules": [\n          {\n            "message": "128GB LRDIMM disables 16GB RDIMM",\n            "productIds": ["01tVW000003l7uaYAA"],\n            "scope": "virtual",\n            "target": "product",\n            "type": "disable"\n          }\n        ]\n      }\n    }\n  }\n]' },

  // Transaction Management
  { id:'txn-1', category:'Transaction', name:'Asset Amendment', methods:['POST'],
    path:'/connect/revenue-management/assets/actions/amend', version:'v62.0',
    desc:'Initiates and executes the amendment of one or more assets, creating an amendment quote or order.',
    page:1383,
    params:[
      {name:'assetIds',type:'String[]',req:true,desc:'IDs of the assets that you want to add to the amendment record.'},
      {name:'amendmentStartDate',type:'String',req:true,desc:'Start date of the amendment.'},
      {name:'outputRecordType',type:'String',req:true,desc:'Type of amendment record that you want to create. For usage products, set to Quote — usage-related records are copied in the quote action flow, not in the amend order flow.'},
      {name:'quantityChange',type:'Double',req:true,desc:'Quantity to add to or reduce from the asset\'s existing quantity.'},
      {name:'contractId',type:'String',req:false,desc:'ID of the Contract record that you want to sync with the amendment quote.'},
      {name:'opportunityId',type:'String',req:false,desc:'ID of the Opportunity record that you want to sync with the amendment quote.'},
      {name:'outputRecordId',type:'String',req:false,desc:'ID of the quote or order record that you want to add the assets to.'},
      {name:'skipPricing',type:'Boolean',req:false,desc:'Whether to skip pricing (true) or run the pricing procedure (false). Available in API v64.0+.'},
    ],
    request:'{\n  "assetIds": ["{{ASSET_ID}}"],\n  "amendmentStartDate": "2026-07-01T00:00:00",\n  "outputRecordType": "Quote",\n  "quantityChange": 5,\n  "contractId": "{{CONTRACT_ID}}",\n  "opportunityId": "{{OPPORTUNITY_ID}}",\n  "outputRecordId": "{{OUTPUT_RECORD_ID}}",\n  "skipPricing": false\n}',
    response:'{\n  "outputRecordId": "801SG00000DX1jWYAT",\n  "outputRecordType": "Quote"\n}' },

  { id:'txn-2', category:'Transaction', name:'Asset Cancellation', methods:['POST'],
    path:'/connect/revenue-management/assets/actions/cancel', version:'v62.0',
    desc:'Initiates and executes the cancellation of an asset.',
    page:1385,
    params:[
      {name:'assetIds',type:'String[]',req:true,desc:'IDs of the assets to cancel. All assets must belong to the same price book.'},
      {name:'cancellationDate',type:'String',req:true,desc:'Effective date of the cancellation.'},
      {name:'outputRecordType',type:'String',req:true,desc:'Type of cancellation record to create (Quote or Order).'},
      {name:'contractId',type:'String',req:false,desc:'ID of the Contract record to sync with the cancellation quote.'},
      {name:'opportunityId',type:'String',req:false,desc:'ID of the Opportunity record to sync with the cancellation quote.'},
      {name:'outputRecordId',type:'String',req:false,desc:'ID of the quote or order that you want to cancel.'},
    ],
    request:'{\n  "assetIds": ["{{ASSET_ID}}"],\n  "cancellationDate": "2024-01-01T00:00:00",\n  "contractId": "{{CONTRACT_ID}}",\n  "opportunityId": "{{OPPORTUNITY_ID}}",\n  "outputRecordId": "{{OUTPUT_RECORD_ID}}",\n  "outputRecordType": "Quote"\n}',
    response:'{\n  "outputRecordId": "801SG00000CX1jWYAT",\n  "outputRecordType": "Quote"\n}' },

  { id:'txn-3', category:'Transaction', name:'Asset Renewal', methods:['POST'],
    path:'/connect/revenue-management/assets/actions/renew', version:'v62.0',
    desc:'Initiates and executes the renewal of an asset. Requires the InitiateRenewal API permission set.',
    page:1386,
    params:[
      {name:'assetIds',type:'String[]',req:true,desc:'IDs of the assets that you want to renew.'},
      {name:'outputRecordType',type:'String',req:true,desc:'Type of renewal record that you want to create.'},
      {name:'contractId',type:'String',req:false,desc:'ID of the Contract record that you want to sync with the renewal of the Quote or Order record.'},
      {name:'opportunityId',type:'String',req:false,desc:'ID of the Opportunity record that you want to sync with the renewal quote.'},
      {name:'outputRecordId',type:'String',req:false,desc:'ID of the Quote or Order record that you want to renew.'},
      {name:'renewalStartDate',type:'String',req:false,desc:'Start date of the renewal process for the assets. Required for early asset renewals and renewing expired assets, using today\'s date or a future date.'},
      {name:'renewalEndDate',type:'String',req:false,desc:'End date of the renewal process for the assets.'},
    ],
    request:'{\n  "assetIds": ["{{ASSET_ID}}"],\n  "outputRecordType": "Quote",\n  "contractId": "{{CONTRACT_ID}}",\n  "opportunityId": "{{OPPORTUNITY_ID}}",\n  "outputRecordId": "{{OUTPUT_RECORD_ID}}",\n  "renewalStartDate": "2026-07-01T00:00:00",\n  "renewalEndDate": "2027-07-01T00:00:00"\n}',
    response:'{\n  "outputRecordId": "801SG00000EX1jWYAT",\n  "outputRecordType": "Quote"\n}' },

  { id:'txn-4', category:'Transaction', name:'Place Quote', methods:['POST'],
    path:'/commerce/quotes/actions/place', version:'v60.0',
    desc:'Create a quote to discover and price products and services. Insert, update, or delete quote line items. Deprecated as of API v63.0 — use Place Sales Transaction instead.',
    page:1400,
    params:[
      {name:'graph',type:'Object Graph Input',req:true,desc:'The sObject graph representing the quote structure. Supports create, update, or delete operations on Quote, QuoteLineItem, QuoteLineGroup, QuoteLineItemAttribute, and custom objects.'},
      {name:'pricingPref',type:'String',req:false,desc:'Pricing preference: Force, Skip, or System. Default is System.'},
      {name:'configurationInput',type:'String',req:false,desc:'Configuration input: RunAndAllowErrors, RunAndBlockErrors, or Skip. Default is RunAndBlockErrors.'},
      {name:'configurationOptions',type:'Configuration Options Input',req:false,desc:'Configuration options during the ingestion process.'},
      {name:'catalogRatesPref',type:'String',req:false,desc:'Rate card fetch preference for usage-based pricing: Fetch or Skip. Default is Skip. Available when Usage-Based Selling is enabled (v62.0+).'},
    ],
    request:'{\n  "pricingPref": "System",\n  "configurationInput": "RunAndAllowErrors",\n  "configurationOptions": {\n    "validateProductCatalog": true,\n    "validateAmendRenewCancel": true,\n    "executeConfigurationRules": true,\n    "addDefaultConfiguration": true\n  },\n  "graph": {\n    "graphId": "createQuote",\n    "records": [\n      {\n        "referenceId": "refQuote",\n        "record": {\n          "attributes": {"type": "Quote", "method": "POST"},\n          "opportunityId": "{{OPPORTUNITY_ID}}"\n        }\n      },\n      {\n        "referenceId": "refQuoteLineItem1",\n        "record": {\n          "attributes": {"type": "QuoteLineItem", "method": "POST"},\n          "QuoteId": "@{refQuote.id}",\n          "PricebookEntryId": "{{PBE_ID}}",\n          "Product2Id": "{{PRODUCT_ID}}",\n          "Quantity": 1,\n          "UnitPrice": 0,\n          "StartDate": "2026-07-01"\n        }\n      }\n    ]\n  }\n}',
    response:'{\n  "contextId": "0HbSG00000001AAAA",\n  "records": [\n    {\n      "referenceId": "refQuote",\n      "id": "0Q0SG0000014Ui5AAF",\n      "record": {"attributes": {"type": "Quote"},"Name": "My Quote","Status": "Draft","TotalAmount": 0}\n    }\n  ]\n}' },

  { id:'txn-5', category:'Transaction', name:'Initiate Downgrade', methods:['POST'],
    path:'/revenue/transaction-management/assets/actions/downgrade', version:'v66.0',
    desc:'Move to a lower-tier or lower-value product. Creates an amendment quote and order with downgrade-specific order actions and quote action subtypes. After assetization, the original asset receives an asset action with business category Downgrade.',
    page:1391,
    params:[
      {name:'swapStartDate',type:'String',req:true,desc:'Amendment start date for the downgrade action.'},
      {name:'outputRecordType',type:'String',req:true,desc:'Record type of the output for the downgrade.'},
      {name:'swapGroups',type:'Swap Group[]',req:true,desc:'Groups that contain the asset details for the downgrade.'},
      {name:'contractId',type:'String',req:false,desc:'ID of the contract record to downgrade.'},
      {name:'opportunityId',type:'String',req:false,desc:'ID of the opportunity record to downgrade.'},
    ],
    request:'{\n  "swapStartDate": "2026-07-01T00:00:00Z",\n  "outputRecordType": "Quote",\n  "swapGroups": {\n    "groups": [\n      {\n        "referenceId": "DOWNGRADE-001",\n        "outGroup": {\n          "swapAssets": [{"assetId": "{{ASSET_ID}}", "quantity": 1}]\n        },\n        "inGroup": {\n          "graphId": "downgradeRequest",\n          "records": [{\n            "referenceId": "refQuoteLine0",\n            "record": {\n              "attributes": {"type": "QuoteLineItem", "method": "POST"},\n              "Product2Id": "{{PRODUCT_ID}}",\n              "PricebookEntryId": "{{PBE_ID}}",\n              "UnitPrice": 0,\n              "Quantity": "1",\n              "StartDate": "2026-07-01"\n            }\n          }]\n        }\n      }\n    ]\n  }\n}',
    response:'{\n  "outputRecordId": "801SG00000FX1jWYAT",\n  "outputRecordType": "Quote",\n  "status": "Success",\n  "swapDetails": [\n    {"fromAssetId": "02iSG0000003NMhYAM","toProductId": "01tSa00000AzpIbIAJ","action": "DOWNGRADE"}\n  ]\n}' },

  { id:'txn-6', category:'Transaction', name:'Initiate Upgrade', methods:['POST'],
    path:'/revenue/transaction-management/assets/actions/upgrade', version:'v66.0',
    desc:'Move a lower-tier product to a higher-tier product. Creates an amendment quote and order with upgrade-specific order actions and quote action subtypes. The original asset receives an asset action with business category Upgrade.',
    page:1394,
    params:[
      {name:'swapStartDate',type:'String',req:true,desc:'Amendment start date for the upgrade action.'},
      {name:'outputRecordType',type:'String',req:true,desc:'Record type of the output for the upgrade.'},
      {name:'swapGroups',type:'Swap Group[]',req:true,desc:'Groups that contain the asset details for the upgrade.'},
      {name:'contractId',type:'String',req:false,desc:'ID of the contract record to upgrade.'},
      {name:'opportunityId',type:'String',req:false,desc:'ID of the opportunity record to upgrade.'},
    ],
    request:'{\n  "swapStartDate": "2026-07-01T00:00:00Z",\n  "outputRecordType": "Quote",\n  "swapGroups": {\n    "groups": [\n      {\n        "referenceId": "UPGRADE-001",\n        "outGroup": {\n          "swapAssets": [{"assetId": "{{ASSET_ID}}", "quantity": 1}]\n        },\n        "inGroup": {\n          "graphId": "upgradeRequest",\n          "records": [{\n            "referenceId": "refQuoteLine0",\n            "record": {\n              "attributes": {"type": "QuoteLineItem", "method": "POST"},\n              "Product2Id": "{{PRODUCT_ID}}",\n              "PricebookEntryId": "{{PBE_ID}}",\n              "UnitPrice": 0,\n              "Quantity": "1",\n              "StartDate": "2026-07-01"\n            }\n          }]\n        }\n      }\n    ]\n  }\n}',
    response:'{\n  "outputRecordId": "801SG00000GX1jWYAT",\n  "outputRecordType": "Quote",\n  "status": "Success",\n  "swapDetails": [\n    {"fromAssetId": "02iSG0000003NMhYAM","toProductId": "01tSa00000AzpIcIAJ","action": "UPGRADE"}\n  ]\n}' },

  { id:'txn-7', category:'Transaction', name:'Get Eligible Promotions', methods:['POST'],
    path:'/revenue/transaction-management/sales-transactions/actions/get-eligible-promotions', version:'v66.0',
    desc:'Get eligible promotions for line items within a quote or order.',
    page:1390,
    params:[
      {name:'salesTransactionId',type:'String',req:true,desc:'Quote or order ID.'},
      {name:'lineItemIds',type:'String[]',req:true,desc:'Line item IDs.'},
    ],
    request:'{\n  "salesTransactionId": "{{QUOTE_OR_ORDER_ID}}",\n  "lineItemIds": ["{{LINE_ITEM_ID}}"]\n}',
    response:'{\n  "eligiblePromotions": [\n    {\n      "promotionId": "0lGSG0000000001AAA",\n      "promotionName": "Q3 Fleet Discount",\n      "promotionCode": "FLEET-Q3",\n      "discountType": "Percentage",\n      "discountAmount": 10.0,\n      "applicableLineItemIds": ["0QLxx0000004E7eGAE"],\n      "expiryDate": "2024-09-30T23:59:59Z"\n    }\n  ]\n}' },

  { id:'txn-promo-1', category:'Transaction', name:'Promotions (Create / List / Update)', methods:['GET','POST','PUT'],
    path:'/global-promotions-management/promotions', version:'v66.0',
    desc:'Get rewards based on a product selling model template. Create, list, or update promotions with rules, reward configurations, eligibility, and product selling model discounts.',
    page:1395,
    params:[
      {name:'promotionDetails',type:'Object',req:true,location:'body',desc:'Details of the promotion including name, displayName, isAutomatic, isEmailActivated, startDateTime, promotionEligibility, promotionLimits, and ruleLibrary.'},
      {name:'rules',type:'Object[]',req:true,location:'body',desc:'Array of promotion rules. Each rule has journalType, priority, rewardConfiguration (scope, discountType, discountValue, termBasedRewards), and templateName.'},
    ],
    request:'{\n  "promotionDetails": {\n    "additionalFieldValues": {"attributes": {}},\n    "displayName": "10% off on Cisco Router",\n    "isAutomatic": true,\n    "isEmailActivated": false,\n    "name": "10% off on Cisco Router",\n    "promotionEligibility": {\n      "eligibleCustomerEvents": {},\n      "eligibleEnrollmentPeriod": {"isEnrollmentRequired": false},\n      "eligibleProducts": [{"id": "{{PRODUCT_ID}}", "name": "Cisco Router", "productType": "SimpleProduct"}]\n    },\n    "promotionLimits": {},\n    "ruleLibrary": {"id": "{{RULE_LIBRARY_ID}}", "name": "RLMSales"},\n    "startDateTime": "2026-07-01T00:00:00.000Z"\n  },\n  "rules": [\n    {\n      "eventConfiguration": [],\n      "journalType": "Customer Purchase",\n      "priority": 10,\n      "rewardConfiguration": [\n        {\n          "scope": "SimpleProduct",\n          "scopeDetails": [{"name": "Cisco Router", "id": "{{PRODUCT_ID}}"}],\n          "doNotDefineRewards": false,\n          "rewardDetailsList": [\n            {\n              "productSellingModel": {"name": "Monthly", "id": "{{PSM_ID}}"},\n              "discountType": "PercentageOff",\n              "discountValue": 10,\n              "termBasedRewards": {\n                "psmTenure": {"tenure": "SpecificTerm", "operator": "Equals", "value": 12},\n                "rewardDuration": {"tenure": "SpecificTerm", "value": 3}\n              }\n            }\n          ],\n          "childProducts": [],\n          "type": "PSMDiscount",\n          "isPrimaryReward": false\n        }\n      ],\n      "ruleName": "rule",\n      "templateName": "GetRewardsBasedOnSellingModel"\n    }\n  ]\n}',
    response:'{\n  "id": "0lGxx0000000001AAA",\n  "name": "10% off on Cisco Router",\n  "status": "Active"\n}' },

  // Usage Management
  { id:'usage-1', category:'Usage', name:'Asset Usage Details', methods:['GET'],
    path:'/asset-management/assets/{assetId}/usage-details', version:'v63.0',
    desc:'Get usage-based product details associated with an asset.',
    page:2033,
    params:[
      {name:'assetId',type:'String',req:true,location:'path',desc:'Asset ID. (Path param)'},
      {name:'effectiveDate',type:'String',req:true,location:'query',desc:'Date for rate card entries.'},
    ],
    request:'No request body.',
    response:'{\n  "assetId": "02iRM0000000tCbYAI",\n  "productId": "01tSa00000AzpIaIAJ",\n  "usageResources": [\n    {"id": "0hUxx000000001AAA","name": "Data Bandwidth","unit": "GB","monthlyLimit": 500}\n  ],\n  "grants": [\n    {"id": "0UGxx000000001AAA","usageResourceId": "0hUxx000000001AAA","grantedQuantity": 500,"consumedQuantity": 123.5,"remainingQuantity": 376.5}\n  ],\n  "rates": [\n    {"id": "0RPxx000000001AAA","usageResourceId": "0hUxx000000001AAA","tierFrom": 0,"tierTo": 500,"ratePerUnit": 0.00},\n    {"id": "0RPxx000000002AAA","usageResourceId": "0hUxx000000001AAA","tierFrom": 501,"tierTo": null,"ratePerUnit": 0.05}\n  ]\n}' },

  { id:'usage-2', category:'Usage', name:'Binding Object Usage Details', methods:['GET'],
    path:'/revenue/usage-management/binding-objects/{bindingObjectId}/actions/usage-details', version:'v65.0',
    desc:'Get grants, resources, rates, and policies for a binding object.',
    page:2034,
    params:[
      {name:'bindingObjectId',type:'String',req:true,location:'path',desc:'Binding object ID. (Path param)'},
      {name:'effectiveDate',type:'String',req:true,location:'query',desc:'Date filter (yyyy-MM-dd).'},
    ],
    request:'No request body.',
    response:'{\n  "bindingObjectId": "1B0x00000000C9GU",\n  "grants": [\n    {"id": "0UGxx000000001AAA","usageResourceId": "0hUxx000000001AAA","grantedQuantity": 1000,"consumedQuantity": 450,"remainingQuantity": 550}\n  ],\n  "rates": [\n    {"usageResourceId": "0hUxx000000001AAA","tierFrom": 1001,"tierTo": null,"ratePerUnit": 0.02}\n  ],\n  "policies": [\n    {"id": "0P0xx000000001AAA","name": "Overage Policy","overageAction": "Charge","notificationThreshold": 80}\n  ]\n}' },

  { id:'usage-3', category:'Usage', name:'Consumption Traceabilities', methods:['POST'],
    path:'/revenue/usage-management/consumption/actions/trace', version:'v66.0',
    desc:'Comprehensive breakdown of overage charges and resource drawdown.',
    page:2034,
    params:[{name:'liableSummaryIds',type:'String[]',req:true,desc:'Liable summary IDs.'}],
    request:'{\n  "liableSummaryIds": ["{{LIABLE_SUMMARY_ID}}"]\n}',
    response:'{\n  "consumptionTraceabilities": [\n    {\n      "liableSummaryId": "1HG000000000001",\n      "usageResourceId": "0hUxx000000001AAA",\n      "totalConsumed": 523.5,\n      "grantedQuantity": 500,\n      "overageQuantity": 23.5,\n      "overageCharges": [\n        {"period": "2024-07","overageUnits": 23.5,"unitRate": 0.05,"amount": 1.175}\n      ]\n    }\n  ]\n}' },

  { id:'usage-4', category:'Usage', name:'Usage Product Activation', methods:['POST'],
    path:'/revenue/usage-management/usage-products/actions/activate', version:'v67.0',
    desc:'[Unverified path — not confirmed in official docs] Activate a usage product and all related records in a single request.',
    page:2037,
    params:[
      {name:'activationRequests',type:'Object[]',req:true,desc:'One activation request (max 1 product).'},
      {name:'shouldValidateProductSetup',type:'Boolean',req:false,desc:'Run validation before activation.'},
    ],
    request:'{\n  "shouldValidateProductSetup": false,\n  "activationRequests": [\n    {"productId": "{{PRODUCT_ID}}","usageResourceIds": ["{{USAGE_RESOURCE_ID}}"]}\n  ]\n}',
    response:'{\n  "activationResults": [{"productId": "01txx000000006i2gAAA","status": "Activated","errors": []}]\n}' },

  { id:'usage-5', category:'Usage', name:'Usage Product Validation', methods:['POST'],
    path:'/revenue/usage-management/usage-products/actions/validate', version:'v66.0',
    desc:'Validate cross-object relationships for usage-based products.',
    page:2038,
    params:[
      {name:'productIds',type:'String[]',req:true,desc:'Product IDs to validate (max 10).'},
      {name:'startDate',type:'String',req:false,desc:'Date range start.'},
      {name:'endDate',type:'String',req:false,desc:'Date range end.'},
    ],
    request:'{\n  "productIds": ["{{PRODUCT_ID}}"],\n  "startDate": "2024-01-01T00:00:00Z",\n  "endDate": "2024-12-31T23:59:59Z"\n}',
    response:'{\n  "validationResults": [{"productId": "01txx0000006i2gAAA","status": "Valid","errors": []}]\n}' },

  // Billing
  { id:'bill-1', category:'Billing', name:'Invoice Creation', methods:['POST'],
    path:'/commerce/invoicing/invoices/collection/actions/generate', version:'v62.0',
    desc:'Create an invoice for an account, order, or list of billing schedules.',
    page:2484,
    params:[
      {name:'action',type:'String',req:true,location:'body',desc:'(v62.0) Draft or Posted.'},
      {name:'invoiceDate',type:'String',req:true,location:'body',desc:'(v62.0) Invoice stamping date (ISO 8601).'},
      {name:'targetDate',type:'String',req:true,location:'body',desc:'(v62.0) Date to decide billing periods (ISO 8601).'},
      {name:'accountId',type:'String',req:false,location:'body',desc:'(v63.0) Account record ID. Required if billingScheduleIds and billingTransactionId not specified.'},
      {name:'billingScheduleIds',type:'String[]',req:false,location:'body',desc:'(v62.0) Billing schedule IDs (max 200). Required if accountId and billingTransactionId not specified.'},
      {name:'billingTransactionId',type:'String',req:false,location:'body',desc:'(v63.0) Billing transaction (Order) record ID. Required if accountId and billingScheduleIds not specified.'},
      {name:'correlationId',type:'String',req:false,location:'body',desc:'(v62.0) Tagged on InvoiceProcessedEvent for traceability.'},
    ],
    request:'{\n  "action": "Draft",\n  "invoiceDate": "2026-07-01",\n  "targetDate": "2026-07-01",\n  "billingScheduleIds": ["{{BILLING_SCHEDULE_ID}}"]\n}',
    response:'{\n  "requestIdentifier": "req-inv-001",\n  "success": true,\n  "errors": []\n}',
    examples:[
      {
        type:'by-billing-schedule',
        label:'1 — Invoice by billing schedule IDs',
        desc:'Generate invoices for specific billing schedules. action:Draft creates draft invoices; use action:Posted to post directly. billingScheduleIds accepts up to 200 IDs.',
        steps:[
          'Replace BILLING_SCHEDULE_ID with your billing schedule ID (starts with 44b)',
          'Set action to "Draft" (review first) or "Posted" (immediate posting)',
          'invoiceDate = stamp date on the invoice; targetDate = period cutoff date',
          'Response is async: requestIdentifier returned, InvoiceProcessedEvent fires on completion'
        ],
        body:'{"action":"Draft","invoiceDate":"2026-07-01","targetDate":"2026-07-01","billingScheduleIds":["{{BILLING_SCHEDULE_ID}}"],"correlationId":"inv-gen-001"}'
      },
      {
        type:'by-account',
        label:'2 — Invoice by account ID (v63.0+)',
        desc:'Generate invoices for all billing schedules under an account. Use accountId instead of billingScheduleIds. Available from API v63.0.',
        steps:[
          'Replace ACCOUNT_ID with your account ID (starts with 001)',
          'Set targetDate to the billing cutoff date — schedules due on or before this date are invoiced'
        ],
        body:'{"action":"Posted","invoiceDate":"2026-07-01","targetDate":"2026-07-31","accountId":"{{ACCOUNT_ID}}"}'
      },
      {
        type:'by-order',
        label:'3 — Invoice by billing transaction (Order) (v63.0+)',
        desc:'Generate invoices for a specific order/billing transaction. Use billingTransactionId. Available from API v63.0.',
        steps:[
          'Replace ORDER_ID with your order ID (starts with 801)',
          'billingTransactionId = the order ID that produced billing schedules'
        ],
        body:'{"action":"Draft","invoiceDate":"2026-07-01","targetDate":"2026-07-01","billingTransactionId":"{{ORDER_ID}}"}'
      }
    ] },

  { id:'bill-2', category:'Billing', name:'Batch Invoice Scheduler', methods:['POST','PUT'],
    path:'/commerce/invoicing/invoice-schedulers', version:'v62.0',
    desc:'Create or update an invoice scheduler (Once, Daily, Weekly, Monthly). PUT requires {billingBatchSchedulerId} appended to the path.',
    page:2490,
    params:[
      {name:'schedulerName',type:'String',req:true,desc:'Unique scheduler name.'},
      {name:'startDate',type:'String',req:true,desc:'Start date (yyyy-MM-dd).'},
      {name:'status',type:'String',req:true,desc:'Draft, Active, or Inactive.'},
      {name:'frequencyCadence',type:'String',req:true,desc:'Once, Daily, Weekly, or Monthly.'},
      {name:'invoiceStatus',type:'String',req:true,desc:'DRAFT or POSTED.'},
      {name:'preferredTime',type:'String',req:true,desc:'Preferred run time (HH:mm).'},
      {name:'targetDate',type:'String',req:false,desc:'(v62.0) Target date for invoice generation. Required when frequencyCadence is Once (yyyy-MM-dd).'},
      {name:'targetDateOffset',type:'Integer',req:false,desc:'(v62.0) Days offset for target date. Required for Daily, Weekly, Monthly cadences.'},
      {name:'invoiceDateOffset',type:'Integer',req:false,desc:'(v62.0) Days offset for invoice date. Required for Daily, Weekly, Monthly cadences.'},
      {name:'isInvoiceDateFromRunDate',type:'Boolean',req:false,desc:'(v63.0) Whether the invoice date is calculated from the run date.'},
      {name:'endDate',type:'String',req:false,desc:'(v63.0) End date for recurring schedulers (yyyy-MM-dd).'},
      {name:'filterCriteria',type:'Object',req:false,desc:'(v62.0) Filter criteria to select billing schedules.'},
      {name:'timezone',type:'String',req:false,desc:'(v62.0) Timezone for the scheduler (e.g. "America/Los_Angeles").'},
      {name:'frequencyCadenceOptions',type:'Object',req:false,desc:'(v62.0) Options for the frequency cadence: recursOnDay (Integer), recursOnDate (Integer), shouldStartRunImmediately (Boolean).'},
    ],
    request:'{\n  "schedulerName": "InvoiceScheduler",\n  "startDate": "2024-05-06",\n  "targetDate": "2024-05-06",\n  "invoiceStatus": "POSTED",\n  "preferredTime": "00:45",\n  "frequencyCadence": "Once",\n  "frequencyCadenceOptions": {},\n  "timezone": "America/Los_Angeles",\n  "status": "Active"\n}',
    response:'{\n  "schedulerId": "5BSSG0000004TwGGAU",\n  "schedulerName": "InvoiceScheduler",\n  "status": "Active",\n  "frequencyCadence": "Once",\n  "startDate": "2024-05-06",\n  "preferredTime": "00:45",\n  "lastRunDate": null,\n  "nextRunDate": "2024-05-06"\n}' },

  { id:'bill-3', category:'Billing', name:'Billing Arrangement', methods:['GET'],
    path:'/revenue/billing/billing-arrangement/{billingArrangementId}', version:'v66.0',
    desc:'Retrieve a billing arrangement and its associated lines.',
    page:2499,
    params:[{name:'billingArrangementId',type:'String',req:true,location:'path',desc:'Billing arrangement ID. (Path param)'}],
    request:'No request body.',
    response:'{\n  "id": "1b0SG000000004eAAA",\n  "name": "Primary Billing Arrangement",\n  "accountId": "001SG00000DX1jWYAT",\n  "status": "Active",\n  "billingDay": 1,\n  "billingArrangementLines": [\n    {"id": "1b1SG000000001AAA","assetId": "02iSG0000003NMhYAM","nextBillingDate": "2024-08-01","amount": 50.00}\n  ]\n}' },

  { id:'bill-4', category:'Billing', name:'Billing Schedule Recovery List', methods:['POST'],
    path:'/commerce/invoicing/billing-schedules/collection/actions/recover', version:'v62.0',
    desc:'Recover the latest generated invoice for billing schedules in Error or Processing status.',
    page:2500,
    params:[{name:'billingScheduleIds',type:'String[]',req:true,desc:'Billing schedule IDs to recover.'}],
    request:'{\n  "billingScheduleIds": ["{{BILLING_SCHEDULE_ID}}"]\n}',
    response:'{\n  "results": [\n    {\n      "billingScheduleId": "44bSG00000000XXYAY",\n      "status": "Success",\n      "invoiceId": "3ttSG00000002AAAA"\n    }\n  ]\n}' },

  { id:'bill-5', category:'Billing', name:'Create Billing Schedules for Orders', methods:['POST'],
    path:'/commerce/invoicing/billing-schedules/actions/create', version:'v62.0',
    desc:'Generate billing schedules for orders using context service.',
    page:2501,
    params:[{name:'billingTransactionIds',type:'String[]',req:true,desc:'Order/billing transaction ID.'}],
    request:'{\n  "billingTransactionIds": ["{{ORDER_ID}}"]\n}',
    response:'{\n  "billingSchedules": [\n    {\n      "id": "44bSG00000001XXYAY",\n      "orderId": "801xx000003H1H9AAK",\n      "billingDay": 1,\n      "startDate": "2024-07-09",\n      "nextBillingDate": "2024-08-01",\n      "amount": 50.00,\n      "status": "Active"\n    }\n  ],\n  "status": "Success"\n}' },

  { id:'bill-6', category:'Billing', name:'Apply Credit Memo', methods:['POST'],
    path:'/commerce/invoicing/credit-memos/{creditMemoId}/actions/apply', version:'v60.0',
    desc:'Adjust or correct already issued invoices by applying a credit memo. The credit memo ID is a path parameter. The request body contains an applications array.',
    page:2484,
    params:[
      {name:'creditMemoId',type:'String',req:true,location:'path',desc:'ID of the credit memo to apply (path parameter).'},
      {name:'applications',type:'Credit Memo Application Input[]',req:true,location:'body',desc:'List of invoice applications. Each entry: appliedToId (String, req — invoice ID), amount (Decimal, req), description (String, opt), effectiveDate (String, opt).'},
    ],
    request:'{\n  "applications": [\n    {\n      "appliedToId": "{{INVOICE_ID}}",\n      "amount": 25.00,\n      "description": "Credit applied for returned goods",\n      "effectiveDate": "2024-07-09"\n    }\n  ]\n}',
    response:'{\n  "creditMemoId": "0cMSG0000000001AAA",\n  "appliedAmount": 25.00,\n  "remainingCreditMemoBalance": 0.00,\n  "status": "Applied"\n}' },

  { id:'bill-7', category:'Billing', name:'Sequence Gap Reconciliation', methods:['POST'],
    path:'/connect/sequences/gap-reconciliation', version:'v65.0',
    desc:'Restore a missing sequence value in gapless-enabled sequences.',
    page:2486,
    params:[
      {name:'sequencePolicyIds',type:'String[]',req:false,desc:'Sequence policy IDs.'},
      {name:'targetObjects',type:'String[]',req:false,desc:'Invoice or CreditMemo.'},
    ],
    request:'{\n  "sequencePolicyIds": ["1vdxx0000000abc"]\n}',
    response:'{\n  "status": "Success",\n  "reconciled": 1,\n  "details": [\n    {"sequencePolicyId": "1vdxx0000000abc","missingValues": [42],"restoredValues": [42]}\n  ]\n}' },

  { id:'bill-8', category:'Billing', name:'Tax Calculation', methods:['POST'],
    path:'/commerce/taxes/actions/calculate', version:'v60.0',
    desc:'Calculate tax for a transaction using the raw tax engine. Requires lineItems, taxEngineId, taxType, and transactionDate. For invoice-level estimated tax use bill-est-tax instead.',
    page:2485,
    params:[
      {name:'lineItems',type:'Object[]',req:true,location:'body',desc:'Line items to calculate tax for. Each entry: amount (required), productCode, quantity, taxCode, taxIncluded, itemId.'},
      {name:'taxEngineId',type:'String',req:true,location:'body',desc:'ID of the tax engine to use for calculation.'},
      {name:'taxType',type:'String',req:true,location:'body',desc:'Type of tax calculation: Actual or Estimated.'},
      {name:'transactionDate',type:'String',req:true,location:'body',desc:'Transaction date for tax calculation (ISO 8601).'},
      {name:'addresses',type:'Object',req:false,location:'body',desc:'Shipping and billing addresses for tax jurisdiction resolution.'},
      {name:'currencyIsoCode',type:'String',req:false,location:'body',desc:'Currency ISO code.'},
      {name:'customerDetails',type:'Object',req:false,location:'body',desc:'Customer details (accountId, contactId, taxExemptionCertificate).'},
      {name:'documentCode',type:'String',req:false,location:'body',desc:'Unique document code for this transaction.'},
      {name:'effectiveDate',type:'String',req:false,location:'body',desc:'Effective date for tax rate lookup.'},
      {name:'isCommit',type:'Boolean',req:false,location:'body',desc:'Whether to commit the transaction to the tax engine.'},
      {name:'referenceDocumentCode',type:'String',req:false,location:'body',desc:'Reference document code for credit/refund scenarios.'},
      {name:'referenceEntityId',type:'String',req:false,location:'body',desc:'ID of the Salesforce record (invoice, order) associated with this calculation.'},
      {name:'shouldVoidTax',type:'Boolean',req:false,location:'body',desc:'(v65.0) Whether to void a previously committed tax transaction.'},
      {name:'taxTransactionType',type:'String',req:false,location:'body',desc:'Type of transaction: SalesOrder, ReturnOrder, etc.'},
    ],
    request:'{\n  "lineItems": [\n    {\n      "amount": 150.00,\n      "productCode": "PROD-001",\n      "quantity": 1,\n      "itemId": "line-001",\n      "taxCode": "P0000000"\n    }\n  ],\n  "taxEngineId": "{{TAX_ENGINE_ID}}",\n  "taxType": "Actual",\n  "transactionDate": "2026-07-01",\n  "currencyIsoCode": "USD",\n  "referenceEntityId": "{{INVOICE_ID}}",\n  "addresses": {\n    "shipTo": {\n      "city": "San Francisco",\n      "country": "US",\n      "postalCode": "94105",\n      "state": "CA",\n      "street": "123 Market St"\n    }\n  },\n  "customerDetails": {\n    "accountId": "{{ACCOUNT_ID}}"\n  },\n  "isCommit": false\n}',
    response:'{\n  "taxLines": [\n    {\n      "itemId": "line-001",\n      "description": "CA State Tax",\n      "taxableAmount": 150.00,\n      "taxRate": 0.09,\n      "taxAmount": 13.50,\n      "jurisdiction": "CA"\n    }\n  ],\n  "totalTaxAmount": 13.50,\n  "status": "Calculated"\n}',
    examples:[
      {
        type:'estimate',
        label:'1 — Estimated tax (no commit)',
        desc:'Calculate tax without committing it to the external tax engine. Use isCommit:false for previewing tax amounts before posting an invoice. taxType:Estimated or Actual both work for previews.',
        steps:[
          'Replace TAX_ENGINE_ID with your Tax Engine record ID (starts with 0tE)',
          'Set isCommit:false so the tax engine does not record a permanent document',
          'referenceEntityId: ID of the invoice or order this tax is for'
        ],
        body:'{"lineItems":[{"amount":150.00,"productCode":"PROD-001","quantity":1,"itemId":"line-001"}],"taxEngineId":"{{TAX_ENGINE_ID}}","taxType":"Estimated","transactionDate":"2026-07-01","currencyIsoCode":"USD","isCommit":false}'
      },
      {
        type:'actual-with-address',
        label:'2 — Actual tax with address (jurisdiction resolution)',
        desc:'Calculate and commit an actual tax document. Pass addresses.shipTo so the tax engine can resolve the correct jurisdiction. Include customerDetails.accountId for account-level tax exemptions.',
        steps:[
          'Fill in addresses.shipTo with the customer\'s shipping address',
          'Set isCommit:true to create a committed tax document in the external engine',
          'taxTransactionType: SalesOrder is the default for invoices'
        ],
        body:'{"lineItems":[{"amount":150.00,"productCode":"PROD-001","quantity":1,"itemId":"line-001","taxCode":"P0000000"}],"taxEngineId":"{{TAX_ENGINE_ID}}","taxType":"Actual","transactionDate":"2026-07-01","currencyIsoCode":"USD","referenceEntityId":"{{INVOICE_ID}}","addresses":{"shipTo":{"city":"San Francisco","country":"US","postalCode":"94105","state":"CA","street":"123 Market St"}},"customerDetails":{"accountId":"{{ACCOUNT_ID}}"},"isCommit":true,"taxTransactionType":"SalesOrder"}'
      },
      {
        type:'void',
        label:'3 — Void a committed tax transaction (v65.0+)',
        desc:'Void a previously committed tax document. Use shouldVoidTax:true with referenceDocumentCode pointing to the original committed transaction code.',
        steps:[
          'Set shouldVoidTax:true',
          'Set referenceDocumentCode to the documentCode of the original committed tax transaction',
          'Set isCommit:false (no new commitment, just a void)'
        ],
        body:'{"lineItems":[],"taxEngineId":"{{TAX_ENGINE_ID}}","taxType":"Actual","transactionDate":"2026-07-01","currencyIsoCode":"USD","referenceDocumentCode":"{{ORIGINAL_DOCUMENT_CODE}}","shouldVoidTax":true,"isCommit":false}'
      }
    ] },

  { id:'bill-est-tax', category:'Billing', name:'Invoice Estimated Tax Calculation', methods:['POST'],
    path:'/commerce/invoicing/invoices/collection/actions/calculate-estimated-tax', version:'v63.0',
    desc:'Calculate estimated tax for one or more draft invoices. Returns a requestIdentifier for async tracking. Requires RevLifecycleManagementCalculateTaxesApi permission set.',
    page:2490,
    params:[
      {name:'invoiceIds',type:'String[]',req:true,location:'body',desc:'IDs of draft invoices to calculate tax for.'},
      {name:'correlationId',type:'String',req:false,location:'body',desc:'Optional correlation ID for traceability.'},
    ],
    request:'{\n  "invoiceIds": [\n    "{{INVOICE_ID}}"\n  ]\n}',
    response:'{\n  "errors": [],\n  "requestIdentifier": "req-abc123",\n  "success": true\n}' },

  // Pricing — additional endpoints from PDF
  { id:'price-10', category:'Pricing', name:'PBE Derived Pricing', methods:['POST'],
    path:'/connect/core-pricing/pbeDerivedPricingSourceProduct', version:'v61.0',
    desc:'Get derived pricing source product details for a price book entry.',
    page:744,
    params:[
      {name:'effectiveFrom',type:'String',req:true,location:'body',desc:'(v61.0) Date from when the PBE is effective.'},
      {name:'effectiveTo',type:'String',req:true,location:'body',desc:'(v61.0) Date until the PBE is effective.'},
      {name:'pricebookEntryId',type:'String',req:true,location:'body',desc:'(v61.0) Price book entry ID.'},
      {name:'productId',type:'String',req:true,location:'body',desc:'(v61.0) Product ID.'},
    ],
    request:'{\n  "effectiveFrom": "2024-01-01",\n  "effectiveTo": "2024-12-31",\n  "pricebookEntryId": "{{PRICEBOOK_ENTRY_ID}}",\n  "productId": "{{PRODUCT_ID}}"\n}',
    response:'{\n  "pricebookEntryId": "01uSG00000001AAAA",\n  "productId": "01tSa00000AzpIaIAJ",\n  "derivedPrice": 99.00,\n  "currencyCode": "USD"\n}' },

  { id:'price-11', category:'Pricing', name:'Price Context', methods:['POST'],
    path:'/connect/core-pricing/price-contexts/{contextId}', version:'v60.0',
    desc:'Get pricing details for a specific context instance.',
    page:744,
    params:[
      {name:'contextId',type:'String',req:true,location:'path',desc:'(v60.0) Context instance ID.'},
      {name:'configurationOverrides',type:'Object',req:false,location:'body',desc:'(v60.0) Override pricing configuration parameters.'},
      {name:'procedureName',type:'String',req:false,location:'body',desc:'(v60.0) API name of the pricing procedure.'},
    ],
    request:'{\n  "procedureName": "MyPricingProcedure"\n}',
    response:'{\n  "contextId": "0HbSG00000001AAAA",\n  "pricingResults": [\n    {\n      "lineItemId": "0QASG00000001AAAA",\n      "netUnitPrice": 90.00,\n      "totalPrice": 90.00,\n      "currency": "USD"\n    }\n  ],\n  "success": true\n}' },

  { id:'price-12', category:'Pricing', name:'Pricing Data Sync', methods:['GET'],
    path:'/connect/core-pricing/sync/{pricingSyncOrigin}', version:'v60.0',
    desc:'Sync pricing data from a specified origin.',
    page:744,
    params:[
      {name:'pricingSyncOrigin',type:'String',req:true,location:'path',desc:'(v60.0) Sync origin identifier.'},
      {name:'pricingRecipeId',type:'String',req:false,location:'query',desc:'(v67.0) ID of the pricing recipe whose decision tables to sync.'},
    ],
    request:'No request body.',
    response:'{\n  "success": true\n}' },

  { id:'price-13', category:'Pricing', name:'Pricing Recipe', methods:['GET'],
    path:'/connect/core-pricing/recipe', version:'v60.0',
    desc:'Get the pricing recipe and its mapping details.',
    page:744,
    params:[],
    request:'No request body.',
    response:'{\n  "recipeId": "0PrSG00000001AAAA",\n  "name": "Standard Pricing Recipe",\n  "mappings": [\n    {\n      "mappingId": "0PmSG00000001AAAA",\n      "objectApiName": "QuoteLineItem",\n      "lookupTableId": "0TcSG00000001AAAA",\n      "pricingProcedure": "StandardPricingProcedure"\n    }\n  ]\n}' },

  { id:'price-14', category:'Pricing', name:'Pricing Recipe Mapping', methods:['POST'],
    path:'/connect/core-pricing/recipe/mapping', version:'v60.0',
    desc:'Create or update pricing recipe lookup table and procedure mappings.',
    page:744,
    params:[
      {name:'recipeId',type:'String',req:true,location:'body',desc:'(v60.0) ID of the pricing recipe.'},
      {name:'pricingRecipeLookupTableInputRepresentations',type:'Object[]',req:true,location:'body',desc:'(v60.0) Input of lookup tables for the recipe.'},
      {name:'pricingRecipeProcedureInputRepresentation',type:'Object',req:true,location:'body',desc:'(v60.0) Input of procedure used in the recipe.'},
    ],
    request:'{\n  "recipeId": "{{RECIPE_ID}}",\n  "pricingRecipeLookupTableInputRepresentations": [\n    {\n      "lookupTableId": "{{LOOKUP_TABLE_ID}}",\n      "objectApiName": "QuoteLineItem"\n    }\n  ],\n  "pricingRecipeProcedureInputRepresentation": {\n    "procedureApiName": "StandardPricingProcedure",\n    "procedureType": "Pricing"\n  }\n}',
    response:'{\n  "success": true,\n  "recipeId": "0PrSG00000001AAAA"\n}' },

  { id:'price-15', category:'Pricing', name:'Pricing Versioned Revision Details', methods:['POST'],
    path:'/connect/core-pricing/versioned-revise-details', version:'v60.0',
    desc:'Get versioned revision details for a price adjustment.',
    page:744,
    params:[
      {name:'adjustmentType',type:'String',req:true,location:'body',desc:'(v60.0) percentage, amount, or override.'},
      {name:'adjustmentValue',type:'String',req:true,location:'body',desc:'(v60.0) Value for the adjustment.'},
      {name:'effectiveFrom',type:'String',req:true,location:'body',desc:'(v60.0) Date the adjustment is effective from.'},
      {name:'entityName',type:'String',req:true,location:'body',desc:'(v60.0) AttributeBasedAdjustment or BundleBasedAdjustment.'},
      {name:'id',type:'String',req:true,location:'body',desc:'(v60.0) Record ID.'},
      {name:'priceAdjustmentScheduleId',type:'String',req:true,location:'body',desc:'(v60.0) Price adjustment schedule record ID.'},
      {name:'productId',type:'String',req:true,location:'body',desc:'(v60.0) Product ID.'},
      {name:'effectiveTo',type:'String',req:false,location:'body',desc:'(v60.0) Date the adjustment ends.'},
      {name:'productSellingModelId',type:'String',req:false,location:'body',desc:'(v60.0) Selling model ID.'},
      {name:'additionalFieldsToValueMap',type:'Map<String,String>',req:false,location:'body',desc:'(v60.0) Additional entity-specific fields.'},
    ],
    request:'{\n  "adjustmentType": "percentage",\n  "adjustmentValue": "10",\n  "effectiveFrom": "2024-01-01",\n  "entityName": "AttributeBasedAdjustment",\n  "id": "{{RECORD_ID}}",\n  "priceAdjustmentScheduleId": "{{PRICE_ADJ_SCHEDULE_ID}}",\n  "productId": "{{PRODUCT_ID}}"\n}',
    response:'{\n  "success": true,\n  "versionedRevisionDetails": [\n    {\n      "id": "{{RECORD_ID}}",\n      "adjustmentType": "percentage",\n      "adjustmentValue": "10",\n      "effectiveFrom": "2024-01-01",\n      "effectiveTo": null,\n      "productId": "{{PRODUCT_ID}}",\n      "priceAdjustmentScheduleId": "{{PRICE_ADJ_SCHEDULE_ID}}"\n    }\n  ]\n}' },

  { id:'price-16', category:'Pricing', name:'Pricing Process Execution', methods:['GET'],
    path:'/connect/core-pricing/pricing-process-execution/{executionId}', version:'v63.0',
    desc:'Get details of a pricing process execution record.',
    page:773,
    params:[
      {name:'executionId',type:'String',req:true,location:'path',desc:'(v63.0) Execution record ID.'},
      {name:'executionType',type:'String',req:false,location:'query',desc:'(v63.0) API_Execution, Discovery, Discovery_Line, Pricing, or Pricing_Line.'},
    ],
    request:'No request body.',
    response:'{\n  "executionId": "0YBSG00000001AAAA",\n  "status": "Success",\n  "executionType": "Pricing",\n  "procedureName": "StandardPricingProcedure",\n  "startTime": "2024-07-09T10:00:00Z",\n  "endTime": "2024-07-09T10:00:01Z",\n  "lineItemCount": 5,\n  "errorCount": 0\n}' },

  { id:'price-17', category:'Pricing', name:'Pricing Process Execution Line Items', methods:['GET'],
    path:'/connect/core-pricing/pricing-process-execution/lineitems/{executionId}/{executionType}', version:'v63.0',
    desc:'Get line item details for a pricing process execution.',
    page:773,
    params:[
      {name:'executionId',type:'String',req:true,location:'path',desc:'(v63.0) Execution record ID.'},
      {name:'executionType',type:'String',req:true,location:'path',desc:'(v63.0) Pricing_Line or Discovery_Line.'},
    ],
    request:'No request body.',
    response:'{\n  "executionId": "0YBSG00000001AAAA",\n  "lineItems": [\n    {\n      "lineItemId": "0QASG00000001AAAA",\n      "status": "Success",\n      "netUnitPrice": 90.00,\n      "totalPrice": 180.00,\n      "quantity": 2\n    }\n  ]\n}' },

  { id:'price-18', category:'Pricing', name:'Procedure Plan Definition By ID', methods:['GET','PATCH','DELETE'],
    path:'/connect/procedure-plan-definitions/{procedurePlanDefinitionId}', version:'v62.0',
    desc:'Get, update, or delete a procedure plan definition by ID.',
    page:773,
    params:[
      {name:'procedurePlanDefinitionId',type:'String',req:true,location:'path',desc:'(v62.0) ID or developer name of the definition.'},
    ],
    request:'No request body for GET/DELETE. For PATCH: provide fields to update.',
    response:'{\n  "id": "1FNSG00000001AAAA",\n  "name": "My Plan",\n  "developerName": "My_Plan",\n  "processType": "Revenue Cloud",\n  "description": "Primary procedure plan",\n  "procedurePlanDefinitionVersions": [\n    {"id": "1CVSG00000001AAAA","developerName": "My_Plan_v1","active": true,"rank": 1}\n  ],\n  "success": true\n}' },

  { id:'price-19', category:'Pricing', name:'Procedure Plan Evaluation By Object', methods:['POST'],
    path:'/connect/procedure-plan-definitions/evaluate', version:'v62.0',
    desc:'Evaluate procedure plan definitions by object ID list.',
    page:773,
    params:[
      {name:'evaluationDate',type:'String',req:true,location:'body',desc:'(v62.0) Date when the evaluation applies.'},
      {name:'idList',type:'String[]',req:true,location:'body',desc:'(v62.0) Record IDs of procedure plan definitions.'},
      {name:'processType',type:'String',req:false,location:'body',desc:'(v63.0) Business process type: Billing, DRO, DeepClone, ProductDiscovery, Revenue_Cloud.'},
      {name:'sectionType',type:'String[]',req:false,location:'body',desc:'(v62.0) Section names to evaluate.'},
      {name:'subSectionType',type:'String[]',req:false,location:'body',desc:'(v62.0) Subsection names to evaluate.'},
    ],
    request:'{\n  "evaluationDate": "2024-07-09",\n  "idList": ["{{PROCEDURE_PLAN_DEFINITION_ID}}"]\n}',
    response:'{\n  "success": true,\n  "evaluationResults": [\n    {\n      "procedurePlanDefinitionId": "1FNSG00000001AAAA",\n      "matchedVersionId": "1CVSG00000001AAAA",\n      "evaluationDate": "2024-07-09",\n      "effectiveProcedurePlanSections": ["Pricing","Fulfillment"]\n    }\n  ]\n}' },

  { id:'price-20', category:'Pricing', name:'Procedure Plan Evaluation By Name', methods:['POST'],
    path:'/connect/procedure-plan-definitions/evaluate/{procedurePlanDefinitionName}', version:'v62.0',
    desc:'Evaluate a procedure plan definition by developer name.',
    page:773,
    params:[
      {name:'procedurePlanDefinitionName',type:'String',req:true,location:'path',desc:'(v62.0) Developer name of the definition.'},
      {name:'evaluationDate',type:'String',req:true,location:'body',desc:'(v62.0) Date when the evaluation applies.'},
      {name:'idList',type:'String[]',req:true,location:'body',desc:'(v62.0) Record IDs of procedure plan definitions.'},
      {name:'processType',type:'String',req:false,location:'body',desc:'(v63.0) Business process type.'},
      {name:'sectionType',type:'String[]',req:false,location:'body',desc:'(v62.0) Section names to evaluate.'},
      {name:'subSectionType',type:'String[]',req:false,location:'body',desc:'(v62.0) Subsection names to evaluate.'},
    ],
    request:'{\n  "evaluationDate": "2024-07-09",\n  "idList": ["{{PROCEDURE_PLAN_DEFINITION_ID}}"]\n}',
    response:'{\n  "success": true,\n  "evaluationResults": [\n    {\n      "procedurePlanDefinitionId": "1FNSG00000001AAAA",\n      "matchedVersionId": "1CVSG00000001AAAA",\n      "evaluationDate": "2024-07-09",\n      "effectiveProcedurePlanSections": ["Pricing","Fulfillment"]\n    }\n  ]\n}' },

  // Transaction — additional endpoints from PDF
  { id:'txn-8', category:'Transaction', name:'Place Order', methods:['POST'],
    path:'/commerce/sales-orders/actions/place', version:'v60.0',
    desc:'Place orders with integrated pricing, configuration, and validation. Insert, update, or delete order items. Supports up to 300 transaction line items. Deprecated as of API v63.0 — use Place Sales Transaction instead.',
    page:1381,
    params:[
      {name:'graph',type:'Object Graph Input',req:true,location:'body',desc:'The sObject graph of the order payload to be ingested. Supports create, update, or delete on Order, OrderItem, OrderItemGroup, and custom objects.'},
      {name:'pricingPref',type:'String',req:false,location:'body',desc:'Pricing preference: Force, Skip, or System. Default is System.'},
      {name:'configurationInput',type:'String',req:false,location:'body',desc:'Configuration input: RunAndAllowErrors, RunAndBlockErrors, or Skip. Default is RunAndBlockErrors.'},
      {name:'configurationOptions',type:'Object',req:false,location:'body',desc:'Configuration options during the ingestion process.'},
      {name:'catalogRatesPref',type:'String',req:false,location:'body',desc:'Rate card fetch preference for usage-based pricing: Fetch or Skip. Default is Skip. Available when Usage-Based Selling is enabled (v62.0+).'},
    ],
    request:'{\n  "pricingPref": "System",\n  "configurationInput": "RunAndAllowErrors",\n  "configurationOptions": {\n    "validateProductCatalog": true,\n    "validateAmendRenewCancel": true,\n    "executeConfigurationRules": true,\n    "addDefaultConfiguration": true\n  },\n  "graph": {\n    "graphId": "graphId",\n    "records": [\n      {\n        "referenceId": "refOrder",\n        "record": {\n          "attributes": {"type": "Order", "method": "POST", "Id": "POST"}\n        }\n      },\n      {\n        "referenceId": "refOrderItem",\n        "record": {\n          "attributes": {"type": "OrderItem", "method": "POST"},\n          "OrderId": "@{refOrder.id}",\n          "PricebookEntryId": "{{PBE_ID}}",\n          "Product2Id": "{{PRODUCT_ID}}",\n          "Quantity": 1,\n          "UnitPrice": 0,\n          "ListPrice": 0\n        }\n      }\n    ]\n  }\n}',
    response:'{\n  "graphs": [\n    {\n      "graphId": "graphId",\n      "isSuccessful": true,\n      "graphResponse": {\n        "compositeResponse": []\n      }\n    }\n  ]\n}' },

  { id:'txn-9', category:'Transaction', name:'Place Sales Transaction', methods:['POST'],
    path:'/connect/rev/sales-transaction/actions/place', version:'v63.0',
    desc:'Create a sales transaction (quote or order) with integrated pricing and configuration. Supports insert, update, and delete of line items. Supports up to 1000 quote line items or 1000 order products. Does not support amendment, renewal, or cancellation — use the dedicated APIs for those.\n\nKEY RULES:\n• Response is a JSON array [{isSuccess, salesTransactionId, errorResponse}] — NOT an object.\n• CurrencyIsoCode must be set explicitly on Quote POST — omitting it defaults to org base currency and causes FIELD_INTEGRITY_EXCEPTION if PBE currency differs.\n• AccountId is blocked by PST FLS on Quote POST — omit it entirely (INVALID_FIELD_FOR_INSERT_UPDATE).\n• Graph node ORDER matters: (1) Quote/Order first, (2) QLR DELETE before QLI DELETE, (3) QLI POST before its QLR POST.\n• Use @{referenceId.id} cross-references to link records created in the same call.\n• ProductSellingModelId is not createable on QLI — omit it.\n• ParentQuoteLineItemId on QLI is read-only — use QuoteLineRelationship for bundle hierarchy.',
    page:1381,
    params:[
      {name:'graph',type:'Object Graph Input',req:false,location:'body',desc:'The sObject graph of the sales transaction. Required if contextDetails is not specified. Supports create, update, or delete on Quote, QuoteLineItem, QuoteLineGroup, QuoteLineItemAttribute, QuoteLineRelationship, Order, OrderItem, OrderItemGroup, and custom objects.'},
      {name:'contextDetails',type:'Context Input',req:false,location:'body',desc:'Context details for the sales transaction. Required if graph is not specified.'},
      {name:'pricingPref',type:'String',req:false,location:'body',desc:'Pricing preference: Force, Skip, or System. Default is System. Use Skip when restructuring existing quotes to avoid repricing.'},
      {name:'configurationPref',type:'Configurator Preference Input',req:false,location:'body',desc:'Configuration preference (v63.0+). Contains configurationMethod (Skip | RunAndAllowErrors | RunAndBlockErrors) and configurationOptions object.'},
      {name:'catalogRatesPref',type:'String',req:false,location:'body',desc:'Rate card fetch preference for usage-based pricing: Fetch or Skip. Default is Skip. Available when Usage-Based Selling is enabled (v63.0+).'},
      {name:'taxPref',type:'String',req:false,location:'body',desc:'Tax calculation preference. Valid value: Skip. If not specified, tax calculation is performed by default (v65.0+).'},
      {name:'groupRampAction',type:'String',req:false,location:'body',desc:'Action on group ramp segments: AddProducts, DeleteProducts, EditGroup, EditRampSchedule, DeleteSegment, or ConvertToNonRampedGroup (v65.0+).'},
    ],
    request:'// ── SCENARIO 1: Simple quote — new Quote + single QLI ──────────────────────\n{\n  "pricingPref": "System",\n  "graph": {\n    "graphId": "simpleQuote",\n    "records": [\n      {\n        "referenceId": "refQuote",\n        "record": {\n          "attributes": {"type": "Quote", "method": "POST"},\n          "Name": "My Quote",\n          "Pricebook2Id": "{{PRICEBOOK_ID}}",\n          "CurrencyIsoCode": "USD"\n        }\n      },\n      {\n        "referenceId": "refQLI_0",\n        "record": {\n          "attributes": {"type": "QuoteLineItem", "method": "POST"},\n          "QuoteId": "@{refQuote.id}",\n          "Product2Id": "{{PRODUCT_ID}}",\n          "PricebookEntryId": "{{PBE_ID}}",\n          "Quantity": 1,\n          "UnitPrice": 0\n        }\n      }\n    ]\n  }\n}\n\n// ── SCENARIO 2: Bundle quote — parent QLI + child QLIs + relationships + attrs ─\n{\n  "pricingPref": "System",\n  "catalogRatesPref": "Skip",\n  "configurationPref": {\n    "configurationMethod": "Skip",\n    "configurationOptions": {\n      "validateProductCatalog": true,\n      "validateAmendRenewCancel": true,\n      "executeConfigurationRules": true,\n      "addDefaultConfiguration": true\n    }\n  },\n  "graph": {\n    "graphId": "bundleQuote",\n    "records": [\n      {\n        "referenceId": "refQuote",\n        "record": {\n          "attributes": {"type": "Quote", "method": "POST"},\n          "Name": "Bundle Quote",\n          "Pricebook2Id": "{{PRICEBOOK_ID}}",\n          "CurrencyIsoCode": "USD"\n        }\n      },\n      {\n        "referenceId": "refQLI_bundle",\n        "record": {\n          "attributes": {"type": "QuoteLineItem", "method": "POST"},\n          "QuoteId": "@{refQuote.id}",\n          "Product2Id": "{{BUNDLE_PRODUCT_ID}}",\n          "PricebookEntryId": "{{BUNDLE_PBE_ID}}",\n          "Quantity": 1,\n          "UnitPrice": 0\n        }\n      },\n      {\n        "referenceId": "refQLI_comp_0",\n        "record": {\n          "attributes": {"type": "QuoteLineItem", "method": "POST"},\n          "QuoteId": "@{refQuote.id}",\n          "Product2Id": "{{COMPONENT_PRODUCT_ID}}",\n          "PricebookEntryId": "{{COMPONENT_PBE_ID}}",\n          "Quantity": 1,\n          "UnitPrice": 0\n        }\n      },\n      {\n        "referenceId": "refRel_0",\n        "record": {\n          "attributes": {"type": "QuoteLineRelationship", "method": "POST"},\n          "MainQuoteLineId": "refQLI_bundle",\n          "AssociatedQuoteLineId": "refQLI_comp_0",\n          "AssociatedQuoteLinePricing": "IncludedInBundlePrice",\n          "ProductRelationshipTypeId": "{{PRODUCT_RELATIONSHIP_TYPE_ID}}",\n          "ProductRelatedComponentId": "{{PRODUCT_RELATED_COMPONENT_ID}}"\n        }\n      },\n      {\n        "referenceId": "refAttr_0",\n        "record": {\n          "attributes": {"type": "QuoteLineItemAttribute", "method": "POST"},\n          "QuoteLineItemId": "refQLI_bundle",\n          "AttributeDefinitionId": "{{ATTRIBUTE_DEFINITION_ID}}",\n          "AttributePicklistValueId": "{{ATTRIBUTE_PICKLIST_VALUE_ID}}"\n        }\n      }\n    ]\n  }\n}\n\n// ── SCENARIO 3: Add QLI to existing quote ───────────────────────────────────\n{\n  "pricingPref": "System",\n  "graph": {\n    "graphId": "addToQuote",\n    "records": [\n      {\n        "referenceId": "refQuote",\n        "record": {\n          "attributes": {"type": "Quote", "method": "PATCH", "id": "{{EXISTING_QUOTE_ID}}"}\n        }\n      },\n      {\n        "referenceId": "refQLI_new",\n        "record": {\n          "attributes": {"type": "QuoteLineItem", "method": "POST"},\n          "QuoteId": "{{EXISTING_QUOTE_ID}}",\n          "Product2Id": "{{PRODUCT_ID}}",\n          "PricebookEntryId": "{{PBE_ID}}",\n          "Quantity": 2,\n          "UnitPrice": 0\n        }\n      }\n    ]\n  }\n}\n\n// ── SCENARIO 4: Update quantity on existing QLI ─────────────────────────────\n{\n  "pricingPref": "Force",\n  "graph": {\n    "graphId": "patchQLI",\n    "records": [\n      {\n        "referenceId": "refQuote",\n        "record": {\n          "attributes": {"type": "Quote", "method": "PATCH", "id": "{{EXISTING_QUOTE_ID}}"}\n        }\n      },\n      {\n        "referenceId": "refQLI_patch",\n        "record": {\n          "attributes": {"type": "QuoteLineItem", "method": "PATCH", "id": "{{EXISTING_QLI_ID}}"},\n          "Quantity": 5\n        }\n      }\n    ]\n  }\n}\n\n// ── SCENARIO 5: Delete QLI (and its QLR first) ──────────────────────────────\n// NOTE: QLR DELETE must come BEFORE QLI DELETE — otherwise QLI delete is silently skipped\n{\n  "pricingPref": "Skip",\n  "graph": {\n    "graphId": "deleteQLI",\n    "records": [\n      {\n        "referenceId": "refQuote",\n        "record": {\n          "attributes": {"type": "Quote", "method": "PATCH", "id": "{{EXISTING_QUOTE_ID}}"}\n        }\n      },\n      {\n        "referenceId": "refDelRel",\n        "record": {\n          "attributes": {"type": "QuoteLineRelationship", "method": "DELETE", "id": "{{EXISTING_QLR_ID}}"}\n        }\n      },\n      {\n        "referenceId": "refDelQLI",\n        "record": {\n          "attributes": {"type": "QuoteLineItem", "method": "DELETE", "id": "{{EXISTING_QLI_ID}}"}\n        }\n      }\n    ]\n  }\n}\n\n// ── SCENARIO 6: Quote with Opportunity link ─────────────────────────────────\n// NOTE: AccountId is blocked by PST FLS — NEVER include it on Quote POST\n{\n  "pricingPref": "System",\n  "graph": {\n    "graphId": "quoteWithOpp",\n    "records": [\n      {\n        "referenceId": "refQuote",\n        "record": {\n          "attributes": {"type": "Quote", "method": "POST"},\n          "Name": "Opp Quote",\n          "Pricebook2Id": "{{PRICEBOOK_ID}}",\n          "CurrencyIsoCode": "USD",\n          "OpportunityId": "{{OPPORTUNITY_ID}}"\n        }\n      },\n      {\n        "referenceId": "refQLI_0",\n        "record": {\n          "attributes": {"type": "QuoteLineItem", "method": "POST"},\n          "QuoteId": "@{refQuote.id}",\n          "Product2Id": "{{PRODUCT_ID}}",\n          "PricebookEntryId": "{{PBE_ID}}",\n          "Quantity": 1,\n          "UnitPrice": 0\n        }\n      }\n    ]\n  }\n}',
    response:'[\n  {\n    "isSuccess": true,\n    "salesTransactionId": "0Q0AY000001Kx2p0AC",\n    "errorResponse": []\n  }\n]',
    examples:[
      {
        type:'create-quote',
        label:'1 — Create new quote with single product',
        desc:'Minimum viable PST call: new Quote + one QuoteLineItem. IMPORTANT: always set CurrencyIsoCode on the Quote POST. Never include AccountId — it is blocked by PST FLS and will cause INVALID_FIELD_FOR_INSERT_UPDATE.',
        steps:[
          'Replace PRICEBOOK_ID with your PriceBook2 ID (starts with 01s)',
          'Replace PRODUCT_ID with your Product2 ID (starts with 01t)',
          'Replace PBE_ID with your PricebookEntry ID (starts with 01u)',
          'CurrencyIsoCode must match the PBE currency — omitting it causes FIELD_INTEGRITY_EXCEPTION',
          'NEVER include AccountId on Quote POST — it is read-only via PST'
        ],
        body:'{"pricingPref":"System","graph":{"graphId":"simpleQuote","records":[{"referenceId":"refQuote","record":{"attributes":{"type":"Quote","method":"POST"},"Name":"My Quote","Pricebook2Id":"{{PRICEBOOK_ID}}","CurrencyIsoCode":"USD"}},{"referenceId":"refQLI_0","record":{"attributes":{"type":"QuoteLineItem","method":"POST"},"QuoteId":"@{refQuote.id}","Product2Id":"{{PRODUCT_ID}}","PricebookEntryId":"{{PBE_ID}}","Quantity":1,"UnitPrice":0}}]}}'
      },
      {
        type:'bundle-quote',
        label:'2 — Bundle quote (parent + children + relationships + attributes)',
        desc:'Create a Quote with a bundle product: parent QLI, component QLIs, QuoteLineRelationships, and a QuoteLineItemAttribute. QLI POST must come before QLR POST for that QLI. configurationPref.configurationMethod: Skip skips runtime config rules.',
        steps:[
          'Replace BUNDLE_PRODUCT_ID, BUNDLE_PBE_ID, COMPONENT_PRODUCT_ID, COMPONENT_PBE_ID with real IDs',
          'Replace PRODUCT_RELATIONSHIP_TYPE_ID (0yo...) and PRODUCT_RELATED_COMPONENT_ID (0dS...) with IDs from your bundle structure',
          'Replace ATTRIBUTE_DEFINITION_ID (0tj...) and ATTRIBUTE_PICKLIST_VALUE_ID (0v6...)',
          'AssociatedQuoteLinePricing: IncludedInBundlePrice or NotIncludedInBundlePrice'
        ],
        body:'{"pricingPref":"System","configurationPref":{"configurationMethod":"Skip","configurationOptions":{"validateProductCatalog":true,"validateAmendRenewCancel":true,"executeConfigurationRules":true,"addDefaultConfiguration":true}},"graph":{"graphId":"bundleQuote","records":[{"referenceId":"refQuote","record":{"attributes":{"type":"Quote","method":"POST"},"Name":"Bundle Quote","Pricebook2Id":"{{PRICEBOOK_ID}}","CurrencyIsoCode":"USD"}},{"referenceId":"refQLI_bundle","record":{"attributes":{"type":"QuoteLineItem","method":"POST"},"QuoteId":"@{refQuote.id}","Product2Id":"{{BUNDLE_PRODUCT_ID}}","PricebookEntryId":"{{BUNDLE_PBE_ID}}","Quantity":1,"UnitPrice":0}},{"referenceId":"refQLI_comp_0","record":{"attributes":{"type":"QuoteLineItem","method":"POST"},"QuoteId":"@{refQuote.id}","Product2Id":"{{COMPONENT_PRODUCT_ID}}","PricebookEntryId":"{{COMPONENT_PBE_ID}}","Quantity":1,"UnitPrice":0}},{"referenceId":"refRel_0","record":{"attributes":{"type":"QuoteLineRelationship","method":"POST"},"MainQuoteLineId":"refQLI_bundle","AssociatedQuoteLineId":"refQLI_comp_0","AssociatedQuoteLinePricing":"IncludedInBundlePrice","ProductRelationshipTypeId":"{{PRODUCT_RELATIONSHIP_TYPE_ID}}","ProductRelatedComponentId":"{{PRODUCT_RELATED_COMPONENT_ID}}"}},{"referenceId":"refAttr_0","record":{"attributes":{"type":"QuoteLineItemAttribute","method":"POST"},"QuoteLineItemId":"refQLI_bundle","AttributeDefinitionId":"{{ATTRIBUTE_DEFINITION_ID}}","AttributePicklistValueId":"{{ATTRIBUTE_PICKLIST_VALUE_ID}}"}}]}}'
      },
      {
        type:'add-to-quote',
        label:'3 — Add a line item to an existing quote',
        desc:'Add a new QLI to an existing quote. Include the Quote as PATCH (with its id) so PST knows which quote to update, then POST the new QLI with QuoteId pointing to the existing quote.',
        steps:[
          'Replace EXISTING_QUOTE_ID with the real quote ID',
          'Replace PRODUCT_ID and PBE_ID with the new product to add'
        ],
        body:'{"pricingPref":"System","graph":{"graphId":"addToQuote","records":[{"referenceId":"refQuote","record":{"attributes":{"type":"Quote","method":"PATCH","id":"{{EXISTING_QUOTE_ID}}"},"CurrencyIsoCode":"USD"}},{"referenceId":"refQLI_new","record":{"attributes":{"type":"QuoteLineItem","method":"POST"},"QuoteId":"{{EXISTING_QUOTE_ID}}","Product2Id":"{{PRODUCT_ID}}","PricebookEntryId":"{{PBE_ID}}","Quantity":2,"UnitPrice":0}}]}}'
      },
      {
        type:'update-qty',
        label:'4 — Update quantity on existing QLI',
        desc:'PATCH an existing QLI to change its quantity. Use pricingPref:Force to reprice immediately.',
        steps:[
          'Replace EXISTING_QUOTE_ID and EXISTING_QLI_ID with real IDs',
          'Add any other fields to the PATCH record to update (UnitPrice, Description, etc.)'
        ],
        body:'{"pricingPref":"Force","graph":{"graphId":"patchQLI","records":[{"referenceId":"refQuote","record":{"attributes":{"type":"Quote","method":"PATCH","id":"{{EXISTING_QUOTE_ID}}"}}},{"referenceId":"refQLI_patch","record":{"attributes":{"type":"QuoteLineItem","method":"PATCH","id":"{{EXISTING_QLI_ID}}"},"Quantity":5}}]}}'
      },
      {
        type:'delete-line',
        label:'5 — Delete QLI (delete QLR before QLI)',
        desc:'Delete a QLI and its QuoteLineRelationship. CRITICAL: QLR DELETE must come before QLI DELETE in the records array — if QLI is deleted first the QLR delete is silently skipped. Use pricingPref:Skip to avoid repricing.',
        steps:[
          'Replace EXISTING_QUOTE_ID, EXISTING_QLR_ID, EXISTING_QLI_ID with real IDs',
          'QLR DELETE must be listed BEFORE QLI DELETE in the records array'
        ],
        body:'{"pricingPref":"Skip","graph":{"graphId":"deleteQLI","records":[{"referenceId":"refQuote","record":{"attributes":{"type":"Quote","method":"PATCH","id":"{{EXISTING_QUOTE_ID}}"}}},{"referenceId":"refDelRel","record":{"attributes":{"type":"QuoteLineRelationship","method":"DELETE","id":"{{EXISTING_QLR_ID}}"}}},{"referenceId":"refDelQLI","record":{"attributes":{"type":"QuoteLineItem","method":"DELETE","id":"{{EXISTING_QLI_ID}}"}}}]}}'
      },
      {
        type:'order',
        label:'6 — Create Order with OrderItem (Place Order equivalent)',
        desc:'Create a new Order with OrderItems. Same structure as Quote scenario but uses Order/OrderItem types. Requires AccountId, EffectiveDate, Status, Pricebook2Id on the Order.',
        steps:[
          'Replace ACCOUNT_ID, PRICEBOOK_ID, PBE_ID, PRODUCT_ID with real IDs',
          'Status must be "Draft" for new orders',
          'EffectiveDate format: YYYY-MM-DDTHH:mm:ss'
        ],
        body:'{"pricingPref":"System","configurationPref":{"configurationMethod":"Skip"},"taxPref":"Skip","graph":{"graphId":"createOrder","records":[{"referenceId":"refOrder","record":{"attributes":{"type":"Order","method":"POST"},"AccountId":"{{ACCOUNT_ID}}","Pricebook2Id":"{{PRICEBOOK_ID}}","EffectiveDate":"2026-07-01T00:00:00","Status":"Draft","CurrencyIsoCode":"USD"}},{"referenceId":"refOrderItem","record":{"attributes":{"type":"OrderItem","method":"POST"},"OrderId":"@{refOrder.id}","Product2Id":"{{PRODUCT_ID}}","PricebookEntryId":"{{PBE_ID}}","Quantity":1,"UnitPrice":0}}]}}'
      }
    ] },

  { id:'txn-9b', category:'Transaction', name:'Retrieve Sales Transaction API Errors', methods:['GET'],
    path:'/connect/revenue/transaction-management/sales-transactions/actions/place/{trackerId}/errors', version:'v66.0',
    desc:'Retrieve asynchronous error details associated with a Place Sales Transaction request. Returns blocking errors, retryable payload, and rollbackedReferenceIds. Does not return non-blocking warnings (configuration or tax warnings).',
    page:1382,
    params:[
      {name:'trackerId',type:'String',req:true,location:'path',desc:'ID of the async tracker returned by the Place Sales Transaction API (e.g. 16PRM0000004DBq).'},
      {name:'includeRetryablePayload',type:'Boolean',req:false,location:'query',desc:'Whether to return a subset of the original Place Sales Transaction API payload errors (true) or not (false). Default is false.'},
    ],
    request:'No request body. Pass includeRetryablePayload=true as a query param to get the retry payload.',
    response:'{\n  "errors": [\n    {\n      "referenceId": "refQuote",\n      "errorCode": "INVALID_API_INPUT",\n      "message": "Error details here"\n    }\n  ],\n  "rolledBackReferenceIds": ["refQuoteLine0"],\n  "jobStatus": "CompletedWithError",\n  "retryablePayload": null\n}' },

  { id:'txn-10', category:'Transaction', name:'Clone Sales Transaction', methods:['POST'],
    path:'/connect/rev/sales-transaction/actions/clone', version:'v64.0',
    desc:'Clone a sales transaction. Both recordIds and salesTransactionId are required.',
    page:1381,
    params:[
      {name:'recordIds',type:'String[]',req:true,location:'body',desc:'(v64.0) IDs of the quote line items or order items to clone.'},
      {name:'salesTransactionId',type:'String',req:true,location:'body',desc:'(v64.0) ID of the sales transaction (quote or order) to clone.'},
      {name:'options',type:'Object',req:false,location:'body',desc:'(v65.0) Optional clone options.'},
    ],
    request:'{\n  "recordIds": ["{{QUOTE_LINE_ITEM_ID}}"],\n  "salesTransactionId": "{{SALES_TRANSACTION_ID}}"\n}',
    response:'{\n  "requestId": "req-clone-001",\n  "salesTransactionId": "{{NEW_SALES_TRANSACTION_ID}}",\n  "success": true,\n  "errors": []\n}' },

  { id:'txn-11', category:'Transaction', name:'Read Sales Transaction', methods:['POST'],
    path:'/connect/revenue/transaction-management/sales-transactions/actions/read', version:'v65.0',
    desc:'Read records from a sales transaction context.',
    page:1381,
    params:[
      {name:'contextId',type:'String',req:true,location:'body',desc:'(v65.0) Context ID to retrieve records from.'},
      {name:'queryTags',type:'String[]',req:false,location:'body',desc:'(v65.0) Objects to retrieve: Quote, QuoteLineItem, Product.'},
      {name:'sObjectFieldMap',type:'Object',req:false,location:'body',desc:'(v67.0) sObject field name mapping.'},
      {name:'filters',type:'Object[]',req:false,location:'body',desc:'(v67.0) Filter conditions to query context data.'},
    ],
    request:'{\n  "contextId": "{{CONTEXT_ID}}",\n  "queryTags": ["Quote","QuoteLineItem"]\n}',
    response:'{\n  "requestId": "req-read-001",\n  "records": [\n    {\n      "objectType": "Quote",\n      "id": "0Q0SG00000001AAAA",\n      "fields": {"Name": "My Quote","Status": "Draft","TotalAmount": 1500.00}\n    },\n    {\n      "objectType": "QuoteLineItem",\n      "id": "0QASG00000001AAAA",\n      "fields": {"Quantity": 2,"UnitPrice": 750.00}\n    }\n  ],\n  "success": true\n}' },

  { id:'txn-12', category:'Transaction', name:'Preview Approval', methods:['POST'],
    path:'/connect/advanced-approvals/approval-submission/preview', version:'v65.0',
    desc:'Preview the approval levels, approval chains, approvers, and conditions for a record before submitting it for approval.',
    page:1381,
    params:[
      {name:'flowApiName',type:'String',req:true,location:'body',desc:'API name of the auto-launched flow.'},
      {name:'objectApiName',type:'String',req:true,location:'body',desc:'API name of the object to preview the approvals for.'},
      {name:'recordId',type:'String',req:true,location:'body',desc:'ID of the record to preview the approvals for.'},
      {name:'inputParameters',type:'Map<String, Object>',req:false,location:'body',desc:'List of input parameters to preview (v67.0+).'},
    ],
    request:'{\n  "flowApiName": "QuoteApprovals",\n  "objectApiName": "Quote",\n  "recordId": "{{QUOTE_ID}}",\n  "inputParameters": {\n    "approverComments": "Submitted for approval",\n    "requestType": "Standard"\n  }\n}',
    response:'{\n  "requestId": "req-preview-001",\n  "approvalChainItems": [\n    {\n      "approvalLevel": 1,\n      "approverName": "Sales Manager",\n      "approverId": "005SG00000001AAAA",\n      "condition": "TotalAmount > 10000",\n      "status": "Pending"\n    }\n  ],\n  "success": true\n}' },

  { id:'txn-13', category:'Transaction', name:'Initiate Swap', methods:['POST'],
    path:'/revenue/transaction-management/assets/actions/swap', version:'v67.0',
    desc:'Initiate a product swap amendment. Replaces one or more RCA-managed assets with different products, producing a new Quote or Order with negative (journal) + positive QLIs. Use the Swap Builder for a guided experience.',
    page:1381,
    params:[
      {name:'swapStartDate',type:'String',req:true,location:'body',desc:'ISO 8601 datetime — effective date of the swap, e.g. "2026-06-14T00:00:00Z"'},
      {name:'outputRecordType',type:'String',req:true,location:'body',desc:'"Quote" or "Order"'},
      {name:'swapGroups.groups',type:'Object[]',req:true,location:'body',desc:'One group per asset. Each: referenceId, outGroup.swapAssets[].{assetId,quantity}, inGroup.{graphId,records[].record.{Product2Id,PricebookEntryId,UnitPrice,Quantity,StartDate}}'},
      {name:'contractId',type:'String',req:false,location:'body',desc:'(v67.0) ID of the contract associated with the swap.'},
      {name:'opportunityId',type:'String',req:false,location:'body',desc:'(v67.0) ID of the opportunity associated with the swap.'},
    ],
    request:'{\n  "swapStartDate": "2026-06-14T00:00:00Z",\n  "outputRecordType": "Quote",\n  "swapGroups": {\n    "groups": [\n      {\n        "referenceId": "SWAP-<assetId>",\n        "outGroup": {\n          "swapAssets": [{ "assetId": "<assetId>", "quantity": 1 }]\n        },\n        "inGroup": {\n          "graphId": "graph-<assetId>",\n          "records": [{\n            "referenceId": "line-<assetId>",\n            "record": {\n              "attributes": { "type": "QuoteLineItem", "method": "POST" },\n              "Product2Id":       "<replacementProductId>",\n              "PricebookEntryId": "<pbeId>",\n              "UnitPrice":        0,\n              "Quantity":         "1",\n              "StartDate":        "2026-06-14"\n            }\n          }]\n        }\n      }\n    ]\n  }\n}',
    response:'{\n  "success": true,\n  "salesTransactionId": "0Q0G5000004pXXXKAI"\n}' },

  { id:'txn-14', category:'Transaction', name:'Create Ramp Deal', methods:['POST'],
    path:'/connect/revenue-management/sales-transaction-contexts/{resourceId}/actions/ramp-deal-create', version:'v62.0',
    desc:'Create a ramp deal for a customer on a product. Applicable for line ramps only. To work with ramp deals for groups, use the Place Sales Transaction API with groupRampActions.',
    page:1381,
    params:[
      {name:'resourceId',type:'String',req:true,location:'path',desc:'(v62.0) ID of the quote line item, order item, or context.'},
      {name:'transactionId',type:'String',req:true,location:'body',desc:'(v62.0) ID of the sales transaction (quote or order).'},
      {name:'transactionLineId',type:'String',req:true,location:'body',desc:'(v62.0) Quote line item ID or order item ID that the price ramp is created for.'},
      {name:'segmentType',type:'String',req:true,location:'body',desc:'(v62.0) Type of segment to create. Valid values: FREE_TRIAL, CUSTOM, YEARLY.'},
      {name:'subscriptionTerm',type:'Integer',req:true,location:'body',desc:'(v62.0) Subscription length of the term-defined product.'},
      {name:'subscriptionTermUnit',type:'String',req:true,location:'body',desc:'(v62.0) Unit of time for the subscription length. Valid value: MONTHS.'},
      {name:'trialTerm',type:'Integer',req:false,location:'body',desc:'(v62.0) Length of the trial period, if any.'},
      {name:'trialTermUnit',type:'String',req:false,location:'body',desc:'(v62.0) Unit of time for the trial period. Valid value: DAYS. Required if trialTerm is specified.'},
      {name:'executionSettings',type:'Execution Settings Input',req:false,location:'body',desc:'(v62.0) Settings to run pricing or configuration rules. executePricing (Boolean), executeConfigRules (Boolean).'},
    ],
    request:'{\n  "transactionId": "{{SALES_TRANSACTION_ID}}",\n  "transactionLineId": "{{QUOTE_LINE_ITEM_ID}}",\n  "subscriptionTerm": 14,\n  "subscriptionTermUnit": "MONTHS",\n  "trialTerm": 45,\n  "trialTermUnit": "DAYS",\n  "segmentType": "YEARLY",\n  "executionSettings": {\n    "executePricing": true,\n    "executeConfigRules": false\n  }\n}',
    response:'{\n  "correlationId": "0QLDU0000002t0Z4AQ",\n  "errors": [],\n  "salesTransactionContext": {\n    "SalesTransaction": [\n      {\n        "businessObjectType": "Quote",\n        "id": "0Q0DU0000002f3d0AA",\n        "SalesTransactionName": "WarrantyPriceRampAR",\n        "Status": "Draft",\n        "TotalAmount": 99.98,\n        "SalesTransactionItem": [\n          {\n            "businessObjectType": "QuoteLineItem",\n            "id": "0QLDU0000002t0Z4AQ",\n            "ItemSegmentName": "Trial",\n            "ItemSegmentType": "FreeTrial",\n            "ItemIsPrimarySegment": true,\n            "StartDate": "2024-08-23T00:00:00.000Z",\n            "EndDate": "2024-09-22T00:00:00.000Z",\n            "Quantity": 2,\n            "UnitPrice": 49.99,\n            "NetUnitPrice": 0,\n            "Discount": 100,\n            "ItemRampIdentifier": "RDI5b5ce52b2db4484"\n          },\n          {\n            "businessObjectType": "QuoteLineItem",\n            "id": "0QLDU0000003CZ94AM",\n            "ItemSegmentName": "Year-1",\n            "ItemSegmentType": "Yearly",\n            "ItemIsPrimarySegment": false,\n            "StartDate": "2024-09-23T00:00:00.000Z",\n            "EndDate": "2025-08-22T00:00:00.000Z",\n            "Quantity": 2,\n            "UnitPrice": 49.99,\n            "NetUnitPrice": 49.99,\n            "TotalPrice": 99.98,\n            "ItemRampIdentifier": "RDI5b5ce52b2db4484"\n          }\n        ]\n      }\n    ]\n  },\n  "success": true,\n  "transactionContextId": "d3fd83b007418ce4980340313b40fd45665b194973486ebac3674c2b8002336f"\n}' },

  { id:'txn-15', category:'Transaction', name:'Update Ramp Deal', methods:['POST'],
    path:'/connect/revenue-management/sales-transaction-contexts/{resourceId}/actions/ramp-deal-update', version:'v62.0',
    desc:'Update a ramp deal when a segment has quantity, discount, or date changes. Applicable for line ramps only.',
    page:1381,
    params:[
      {name:'resourceId',type:'String',req:true,location:'path',desc:'(v62.0) ID of the context data instance (from Context Service API).'},
      {name:'addedNodes',type:'Context Node Input[]',req:true,location:'body',desc:'(v62.0) Details of the nodes to be added. Each node has contextNodePath (String[] — hierarchy of IDs) and contextNode (Object — segment fields: Discount, Quantity, ItemSegmentName, StartDate, EndDate).'},
      {name:'deletedNodes',type:'Context Node Input[]',req:true,location:'body',desc:'(v62.0) Details of the nodes to be deleted. Each node has contextNodePath.'},
      {name:'updatedNodes',type:'Context Node Input[]',req:true,location:'body',desc:'(v62.0) Details of the nodes to be updated. Each node has contextNodePath and contextNode with fields to change.'},
      {name:'executionSettings',type:'Execution Settings Input',req:false,location:'body',desc:'(v62.0) Settings to run pricing or configuration rules. executePricing (Boolean), executeConfigRules (Boolean).'},
    ],
    request:'{\n  "executionSettings": {\n    "executePricing": true,\n    "executeConfigRules": false\n  },\n  "addedNodes": [\n    {\n      "contextNodePath": [\n        "{{CONTEXT_ID}}",\n        "{{SALES_TRANSACTION_ID}}",\n        "{{NEW_LINE_UUID}}"\n      ],\n      "contextNode": {\n        "Discount": 10,\n        "Quantity": 5,\n        "ItemSegmentName": "Year 5",\n        "StartDate": "2024-09-07T00:00:00.000Z",\n        "EndDate": "2025-09-07T00:00:00.000Z"\n      }\n    }\n  ],\n  "updatedNodes": [\n    {\n      "contextNodePath": [\n        "{{CONTEXT_ID}}",\n        "{{SALES_TRANSACTION_ID}}",\n        "{{QUOTE_LINE_ITEM_ID}}"\n      ],\n      "contextNode": {\n        "Discount": 10,\n        "Quantity": 5\n      }\n    }\n  ],\n  "deletedNodes": [\n    {\n      "contextNodePath": [\n        "{{CONTEXT_ID}}",\n        "{{SALES_TRANSACTION_ID}}",\n        "{{QUOTE_LINE_ITEM_ID}}"\n      ]\n    }\n  ]\n}',
    response:'{\n  "correlationId": "0QLDU0000002t0Z4AQ",\n  "errors": [],\n  "salesTransactionContext": {\n    "SalesTransaction": [\n      {\n        "businessObjectType": "Quote",\n        "id": "0Q0DU0000002f3d0AA",\n        "Status": "Draft",\n        "TotalAmount": 99.98,\n        "SalesTransactionItem": [\n          {\n            "businessObjectType": "QuoteLineItem",\n            "id": "0QLDU0000002t0Z4AQ",\n            "ItemSegmentName": "Year 5",\n            "Discount": 10,\n            "Quantity": 5,\n            "ItemRampIdentifier": "RDI5b5ce52b2db4484"\n          }\n        ]\n      }\n    ]\n  },\n  "success": true,\n  "transactionContextId": "d3fd83b007418ce4980340313b40fd45665b194973486ebac3674c2b8002336f"\n}' },

  { id:'txn-16', category:'Transaction', name:'Place Supplemental Transaction', methods:['POST'],
    path:'/connect/rev/sales-transaction/actions/place-supplemental-transaction', version:'v64.0',
    desc:'Create a supplemental order or change orders after they are submitted for processing, such as during the fulfillment process. The original order must not be assetized or billed.',
    page:1381,
    params:[
      {name:'relatedSalesTransactionId',type:'String',req:true,location:'body',desc:'(v64.0) ID of the original sales transaction upon which a supplemental transaction is created.'},
      {name:'pricingPref',type:'String',req:false,location:'body',desc:'(v64.0) Pricing preference. Valid values: Force (enforces pricing), Skip (skips pricing), System (determines if pricing is required).'},
      {name:'supplementalGraph',type:'Object Graph Input',req:false,location:'body',desc:'(v64.0) sObject graph with additional changes to ingest. The attribute HTTP method must be PATCH, and the attribute ID must be the ID of the original order or order item to supplement.'},
    ],
    request:'{\n  "relatedSalesTransactionId": "{{SALES_TRANSACTION_ID}}",\n  "pricingPref": "System",\n  "supplementalGraph": {\n    "graphId": "1",\n    "records": [\n      {\n        "referenceId": "refOrder",\n        "record": {\n          "attributes": {\n            "type": "Order",\n            "method": "PATCH",\n            "id": "{{SALES_TRANSACTION_ID}}"\n          },\n          "EffectiveDate": "2025-03-01",\n          "QuoteId": "{{QUOTE_ID}}"\n        }\n      },\n      {\n        "referenceId": "refOrderItem",\n        "record": {\n          "attributes": {\n            "type": "OrderItem",\n            "method": "PATCH",\n            "id": "{{ORDER_ITEM_ID}}"\n          },\n          "QuoteLineItemId": "{{QUOTE_LINE_ITEM_ID}}"\n        }\n      }\n    ]\n  }\n}',
    response:'{\n  "requestId": "16PRM0000004DBq",\n  "statusURL": "/services/data/v67.0/sobjects/AsyncOperationTracker/16PRM0000004DBq",\n  "orderId": "{{SALES_TRANSACTION_ID}}",\n  "supplementalTransactionId": "{{SUPPLEMENTAL_TRANSACTION_ID}}",\n  "success": true,\n  "errors": []\n}' },

  { id:'txn-17', category:'Transaction', name:'View Ramp Deal', methods:['GET'],
    path:'/connect/revenue-management/sales-transaction-contexts/{resourceId}/actions/ramp-deal-view', version:'v62.0',
    desc:'View a ramp deal related to a quote line item or an order item. Applicable for line ramps only.',
    page:1381,
    params:[
      {name:'resourceId',type:'String',req:true,location:'path',desc:'(v62.0) ID of the quote line item, order item, or context.'},
      {name:'transactionId',type:'String',req:true,location:'query',desc:'(v62.0) ID of the quote or order required to hydrate the context and retrieve the quote lines.'},
      {name:'transactionLineId',type:'String',req:true,location:'query',desc:'(v62.0) ID of the quote or order line required to retrieve the segmented details.'},
    ],
    request:'No request body. Pass transactionId and transactionLineId as query params.',
    response:'{\n  "correlationId": "0QLDU0000002t0Z4AQ",\n  "errors": [],\n  "salesTransactionContext": {\n    "SalesTransaction": [\n      {\n        "businessObjectType": "Quote",\n        "id": "0Q0DU0000002f3d0AA",\n        "SalesTransactionName": "WarrantyPriceRampAR",\n        "Status": "Draft",\n        "TotalAmount": 99.98,\n        "SalesTransactionItem": [\n          {\n            "businessObjectType": "QuoteLineItem",\n            "id": "0QLDU0000002t0Z4AQ",\n            "ItemSegmentName": "Trial",\n            "ItemSegmentType": "FreeTrial",\n            "ItemIsPrimarySegment": true,\n            "StartDate": "2024-08-23T00:00:00.000Z",\n            "EndDate": "2024-09-22T00:00:00.000Z",\n            "Quantity": 2,\n            "Discount": 100,\n            "NetUnitPrice": 0,\n            "ItemRampIdentifier": "RDI5b5ce52b2db4484"\n          },\n          {\n            "businessObjectType": "QuoteLineItem",\n            "id": "0QLDU0000003CZ94AM",\n            "ItemSegmentName": "Year-1",\n            "ItemSegmentType": "Yearly",\n            "ItemIsPrimarySegment": false,\n            "StartDate": "2024-09-23T00:00:00.000Z",\n            "EndDate": "2025-08-22T00:00:00.000Z",\n            "Quantity": 2,\n            "UnitPrice": 49.99,\n            "TotalPrice": 99.98,\n            "ItemRampIdentifier": "RDI5b5ce52b2db4484"\n          }\n        ]\n      }\n    ]\n  },\n  "success": true,\n  "transactionContextId": "d3fd83b007418ce4980340313b40fd45665b194973486ebac3674c2b8002336f"\n}' },

  { id:'txn-18', category:'Transaction', name:'Delete Ramp Deal', methods:['POST'],
    path:'/connect/revenue-management/sales-transaction-contexts/{resourceId}/actions/ramp-deal-delete', version:'v62.0',
    desc:'Delete a ramp deal to convert a ramped product back to a single quote line item or order item. Applicable for line ramps only.',
    page:1381,
    params:[
      {name:'resourceId',type:'String',req:true,location:'path',desc:'(v62.0) ID of the context.'},
      {name:'rampDealIds',type:'String[]',req:true,location:'body',desc:'(v62.0) Ramp identifiers on the quote line item or order item to delete.'},
    ],
    request:'{\n  "rampDealIds": [\n    "{{SALES_TRANSACTION_ID}}",\n    "{{QUOTE_LINE_ITEM_ID}}"\n  ]\n}',
    response:'{\n  "correlationId": "0QLDU0000002t0Z4AQ",\n  "errors": [],\n  "salesTransactionContext": {\n    "SalesTransaction": [\n      {\n        "businessObjectType": "Quote",\n        "id": "0Q0DU0000002f3d0AA",\n        "Status": "Draft",\n        "SalesTransactionItem": [\n          {\n            "businessObjectType": "QuoteLineItem",\n            "id": "0QLDU0000002t0Z4AQ",\n            "ItemIsPrimarySegment": true,\n            "ItemRampIdentifier": null\n          }\n        ]\n      }\n    ]\n  },\n  "success": true,\n  "transactionContextId": "d3fd83b007418ce4980340313b40fd45665b194973486ebac3674c2b8002336f"\n}' },

  // Configurator — canonical paths from official docs
  { id:'cfg-5', category:'Configurator', name:'Configuration Load Instance', methods:['POST'],
    path:'/connect/cpq/configurator/actions/load-instance', version:'v64.0',
    desc:'Create a session for the product configuration instance using the transaction ID. Get the session ID that includes the results of actions such as configuration rules, qualification rules, and pricing management.',
    page:955,
    params:[
      {name:'transactionId',type:'String',req:true,desc:'Transaction ID of the header entity that\'s used to create a session. For example, a Quote or an Order.'},
      {name:'configuratorOptions',type:'Configurator Options Input',req:false,desc:'Options controlling what the configurator executes. addDefaultConfiguration (Boolean v60), executeConfigurationRules (Boolean v60), executePricing (Boolean v60), explainabilityEnabled (Boolean v66 — collect solver explainability logs for Action Logs API), pricingProcedure (String v60 — pricing procedure name), qualifyAllProductsInTransaction (Boolean v60), returnProductCatalogData (Boolean v60 — set false when not using Product Configurator UI), validateAmendRenewCancel (Boolean v60), validateProductCatalog (Boolean v60).'},
      {name:'contextMappingId',type:'String',req:false,desc:'ID of the context mapping record.'},
      {name:'qualificationContext',type:'User Context Input',req:false,desc:'User context for qualification rules. accountId (String v60) — account ID. contactId (String v60) — contact ID. contextId (String v60) — ID of an existing session context.'},
    ],
    request:'{\n  "configuratorOptions": {\n    "addDefaultConfiguration": true,\n    "executeConfigurationRules": true,\n    "executePricing": true,\n    "qualifyAllProductsInTransaction": true,\n    "validateAmendRenewCancel": true,\n    "validateProductCatalog": true,\n    "returnProductCatalogData": false\n  },\n  "qualificationContext": {\n    "accountId": "001DU000001nHUGYA2"\n  },\n  "transactionId": "0Q0DU0000000XoN0AU"\n}',
    response:'{\n  "contextId": "008d27d7-e004-4906-a949-ee7d7c323c77",\n  "status": "InProgress"\n}',
    examples:[
      {
        type:'quote-session',
        label:'1 — Load session for a Quote',
        desc:'First call in a programmatic configurator flow. Pass the Quote ID as transactionId. Response contextId is used for all subsequent add-nodes/update-nodes/delete-nodes/save-instance calls. Set returnProductCatalogData:false when not using the UI — it reduces response payload size.',
        steps:[
          'Replace transactionId with your Quote ID (starts with 0Q0)',
          'Set accountId in qualificationContext for per-account qualification rules',
          'Save the contextId from the response — every follow-up call needs it',
          'Set returnProductCatalogData:false when calling from Apex/API (not UI)'
        ],
        body:'{"transactionId":"{{QUOTE_ID}}","configuratorOptions":{"addDefaultConfiguration":true,"executeConfigurationRules":true,"executePricing":true,"qualifyAllProductsInTransaction":true,"validateAmendRenewCancel":true,"validateProductCatalog":true,"returnProductCatalogData":false},"qualificationContext":{"accountId":"{{ACCOUNT_ID}}"}}'
      },
      {
        type:'order-session',
        label:'2 — Load session for an Order',
        desc:'Same as Quote but transactionId is an Order ID. Used for order amendment configurator flows.',
        steps:[
          'Replace transactionId with your Order ID (starts with 801)',
          'Save the contextId for follow-up calls'
        ],
        body:'{"transactionId":"{{ORDER_ID}}","configuratorOptions":{"addDefaultConfiguration":true,"executeConfigurationRules":true,"executePricing":true,"validateAmendRenewCancel":true,"validateProductCatalog":true,"returnProductCatalogData":false},"qualificationContext":{"accountId":"{{ACCOUNT_ID}}"}}'
      }
    ] },

  { id:'cfg-6', category:'Configurator', name:'Configuration Set Instance', methods:['POST'],
    path:'/connect/cpq/configurator/actions/set-instance', version:'v64.0',
    desc:'Set a product configuration instance. Use this when the configuration instance lives in an external database (not Salesforce) and the product catalog data is in Salesforce. contextMappingId and transaction are both required.',
    page:955,
    params:[
      {name:'contextMappingId',type:'String',req:true,desc:'ID of the context mapping record that maps the external transaction structure to the Salesforce context definition.'},
      {name:'transaction',type:'String',req:true,desc:'Transaction JSON payload (serialized as a string) representing the external system object used to create a session. Must include businessObjectType and id for each node (Quote, QuoteLineItem, etc.).'},
      {name:'configuratorOptions',type:'Configurator Options Input',req:false,desc:'Options: addDefaultConfiguration, executeConfigurationRules, executePricing, explainabilityEnabled (Boolean v66), pricingProcedure (String), qualifyAllProductsInTransaction, returnProductCatalogData (set false when not using Configurator UI), validateAmendRenewCancel, validateProductCatalog.'},
      {name:'qualificationContext',type:'User Context Input',req:false,desc:'User context for qualification rules: accountId (String), contactId (String), contextId (String — existing session).'},
    ],
    request:'{\n  "configuratorOptions": {\n    "addDefaultConfiguration": true,\n    "executeConfigurationRules": true,\n    "executePricing": false,\n    "qualifyAllProductsInTransaction": false,\n    "validateAmendRenewCancel": false,\n    "validateProductCatalog": false\n  },\n  "contextMappingId": "11jEk000017YdyUIAS",\n  "qualificationContext": {\n    "accountId": "001DU000001nHUGYA2"\n  },\n  "transaction": "{\\"Quote\\":[{\\"QuoteLineItem\\":[{\\"businessObjectType\\":\\"QuoteLineItem\\",\\"id\\":\\"qli_1\\"},{\\"businessObjectType\\":\\"QuoteLineItem\\",\\"id\\":\\"qli_2\\"},{\\"businessObjectType\\":\\"QuoteLineItem\\",\\"id\\":\\"qli_3\\"},{\\"businessObjectType\\":\\"QuoteLineItem\\",\\"id\\":\\"qli_4\\"}],\\"businessObjectType\\":\\"Quote\\",\\"id\\":\\"aJSdm0000003m3JGAQ\\"}]}"\n}',
    response:'{\n  "errors": [],\n  "success": true,\n  "contextId": "008d27d7-e004-4906-a949-ee7d7c323c77"\n}' },

  { id:'cfg-7', category:'Configurator', name:'Configurator Delete Nodes', methods:['POST'],
    path:'/connect/cpq/configurator/actions/delete-nodes', version:'v64.0',
    desc:'Delete nodes from a product configuration.',
    page:955,
    params:[
      {name:'contextId',type:'String',req:true,desc:'ID of the context object that\'s being considered.'},
      {name:'deletedNodes',type:'Configurator Deleted Node Input[]',req:true,desc:'List of nodes to delete. Each node has path (String[]) — path to the node being deleted (same path structure as add-nodes).'},
      {name:'configuratorOptions',type:'Configurator Options Input',req:false,desc:'Options: addDefaultConfiguration, executeConfigurationRules, executePricing, explainabilityEnabled (v66.0), pricingProcedure, qualifyAllProductsInTransaction, returnProductCatalogData, validateAmendRenewCancel, validateProductCatalog.'},
      {name:'qualificationContext',type:'User Context Input',req:false,desc:'Context for qualification rules: accountId (String), contactId (String), contextId (String).'},
    ],
    request:'{\n  "configuratorOptions": {\n    "executePricing": true,\n    "returnProductCatalogData": true,\n    "qualifyAllProductsInTransaction": true,\n    "validateProductCatalog": true,\n    "validateAmendRenewCancel": true,\n    "executeConfigurationRules": true,\n    "addDefaultConfiguration": true\n  },\n  "qualificationContext": {\n    "accountId": "001xx0000000001AAA",\n    "contactId": "003xx00000000D7AAI"\n  },\n  "contextId": "008d27d7-e004-4906-a949-ee7d7c323c77",\n  "deletedNodes": [\n    {\n      "path": ["0Q0DE000000ISHJs81", "0QLDE000000IBXw4AO"]\n    }\n  ]\n}',
    response:'{\n  "configuratorMessages": {},\n  "configuratorUITreatments": [\n    {\n      "details": {\n        "attributeId": "0tjxx0000000007AAA",\n        "prcId": "0dSxx0000000007EAA",\n        "stiId": "0QLxx0000004CU0GAM",\n        "attributePicklistValueId": "0v6xx0000000005AAA"\n      },\n      "uiTreatmentScope": "Bundle",\n      "uiTreatmentTarget": "Attribute_Picklist_Value",\n      "uiTreatmentType": "Hide"\n    },\n    {\n      "details": {\n        "stiId": "ref_f0f2da7b_c431_482d_bf4b_599052f3a2e1"\n      },\n      "uiTreatmentScope": "Product",\n      "uiTreatmentTarget": "Component",\n      "uiTreatmentType": "Disable"\n    }\n  ],\n  "errors": [],\n  "productQualifications": {\n    "01tDU000000EOTCYA4": { "isQualified": true }\n  },\n  "success": true\n}',
    examples:[
      {
        type:'delete-line',
        label:'1 — Remove a QLI from a bundle',
        desc:'Delete a specific QuoteLineItem node from the active configuration. The path array must contain [quoteId, qliId] — the same 2-element path used in add-nodes. After this call the deleted node is gone; call save-instance to persist.',
        steps:[
          'Get contextId from the prior load-instance or configure call',
          'path[0] = Quote ID, path[1] = QuoteLineItem ID to delete',
          'Call save-instance after to persist the deletion'
        ],
        body:'{"contextId":"{{CONTEXT_ID}}","deletedNodes":[{"path":["{{QUOTE_ID}}","{{QLI_ID}}"]}],"configuratorOptions":{"executePricing":true,"executeConfigurationRules":true,"addDefaultConfiguration":true,"validateProductCatalog":true,"returnProductCatalogData":false}}'
      }
    ] },

  { id:'cfg-8', category:'Configurator', name:'Configurator Update Nodes', methods:['POST'],
    path:'/connect/cpq/configurator/actions/update-nodes', version:'v64.0',
    desc:'Update one or more nodes in a product configuration context. Use updatedAttributes to change any field on a Sales Transaction context item — Quantity, UnitPrice, custom fields, etc.',
    page:955,
    params:[
      {name:'contextId',type:'String',req:true,desc:'ID of the context object to update nodes in (returned from load-instance or configure).'},
      {name:'updatedNodes',type:'Configurator Updated Node Input[]',req:true,desc:'Nodes to update. Each has: path (String[]) — same 2-ID path structure as add-nodes (e.g. [quoteId, qliId]); updatedAttributes (Map<String,Object>) — fields to update; supports all Sales Transaction context definition fields including custom fields.'},
      {name:'configuratorOptions',type:'Configurator Options Input',req:false,desc:'Options: addDefaultConfiguration, executeConfigurationRules, executePricing, explainabilityEnabled (Boolean v66 — solver logs), pricingProcedure (String), qualifyAllProductsInTransaction, returnProductCatalogData (false when not using Configurator UI), validateAmendRenewCancel, validateProductCatalog.'},
      {name:'qualificationContext',type:'User Context Input',req:false,desc:'User context for qualification rules: accountId (String), contactId (String), contextId (String — existing session).'},
    ],
    request:'{\n  "configuratorOptions": {\n    "executePricing": true,\n    "returnProductCatalogData": true,\n    "qualifyAllProductsInTransaction": true,\n    "validateProductCatalog": true,\n    "validateAmendRenewCancel": true,\n    "executeConfigurationRules": true,\n    "addDefaultConfiguration": true\n  },\n  "qualificationContext": {\n    "accountId": "001xx0000000001AAA",\n    "contactId": "003xx00000000D7AAI"\n  },\n  "contextId": "008d27d7-e004-4906-a949-ee7d7c323c77",\n  "updatedNodes": [\n    {\n      "path": ["0Q0DE000000ISHJs81", "0QLDE000000IBXw4AO"],\n      "updatedAttributes": {\n        "Quantity": 5\n      }\n    }\n  ]\n}',
    response:'{\n  "configuratorMessages": {},\n  "configuratorUITreatments": [\n    {\n      "details": {\n        "attributeId": "0tjxx0000000007AAA",\n        "prcId": "0dSxx0000000007EAA",\n        "stiId": "0QLxx0000004CU0GAM",\n        "attributePicklistValueId": "0v6xx0000000005AAA"\n      },\n      "uiTreatmentScope": "Bundle",\n      "uiTreatmentTarget": "Attribute_Picklist_Value",\n      "uiTreatmentType": "Hide"\n    },\n    {\n      "details": {\n        "stiId": "ref_f0f2da7b_c431_482d_bf4b_599052f3a2e1"\n      },\n      "uiTreatmentScope": "Product",\n      "uiTreatmentTarget": "Component",\n      "uiTreatmentType": "Disable"\n    }\n  ],\n  "errors": [],\n  "productQualifications": {\n    "01tDU000000EOTCYA4": { "isQualified": true }\n  },\n  "success": true\n}',
    examples:[
      {
        type:'update-quantity',
        label:'1 — Update QLI Quantity',
        desc:'Change the quantity of a QuoteLineItem already in the configuration. The updatedAttributes map accepts any Sales Transaction context field — Quantity, UnitPrice, custom fields, or QuoteLineItemAttribute values.',
        steps:[
          'Get contextId from the prior load-instance or configure call',
          'path[0] = Quote ID, path[1] = QuoteLineItem ID',
          'Set Quantity to the new value in updatedAttributes',
          'Call save-instance after to persist the change'
        ],
        body:'{"contextId":"{{CONTEXT_ID}}","updatedNodes":[{"path":["{{QUOTE_ID}}","{{QLI_ID}}"],"updatedAttributes":{"Quantity":5}}],"configuratorOptions":{"executePricing":true,"executeConfigurationRules":true,"addDefaultConfiguration":true,"validateProductCatalog":true,"returnProductCatalogData":false}}'
      },
      {
        type:'update-attribute',
        label:'2 — Update a product attribute value',
        desc:'Update a specific QuoteLineItemAttribute — e.g. change Color from "Blue" to "Red". The path drills into the attribute node: [quoteId, qliId, qliAttrId]. Use the attributePicklistValueId from the catalog for picklist attributes.',
        steps:[
          'path[0] = Quote ID, path[1] = QLI ID, path[2] = QuoteLineItemAttribute ID',
          'updatedAttributes key = AttributeKey or the specific field; value = new value or attributePicklistValueId',
          'Call save-instance after to persist'
        ],
        body:'{"contextId":"{{CONTEXT_ID}}","updatedNodes":[{"path":["{{QUOTE_ID}}","{{QLI_ID}}","{{QLIA_ID}}"],"updatedAttributes":{"AttributeValue":"Red","AttributePicklistValueId":"{{ATTR_PICKLIST_VALUE_ID}}"}}],"configuratorOptions":{"executePricing":true,"executeConfigurationRules":true,"addDefaultConfiguration":true,"returnProductCatalogData":false}}'
      }
    ] },

  { id:'cfg-9', category:'Configurator', name:'Configuration Save Instance', methods:['POST'],
    path:'/connect/cpq/configurator/actions/save-instance', version:'v64.0',
    desc:'Save a configuration instance after a successful product configuration. Saves changes to the source (e.g. quote line item) after a successful configuration.',
    page:955,
    params:[
      {name:'contextId',type:'String',req:true,desc:'Transaction context ID of the product configuration instance that\'s to be saved.'},
    ],
    request:'{\n  "contextId": "008d27d7-e004-4906-a949-ee7d7c323c77"\n}',
    response:'// Success\n{\n  "errors": [],\n  "success": true\n}\n\n// Error\n{\n  "errors": [{\n    "code": "INTERNAL_SERVER_ERROR",\n    "message": "CONTEXT_NOT_FOUND"\n  }],\n  "success": false\n}',
    examples:[
      {
        type:'save-quote-config',
        label:'1 — Persist configuration changes to Quote',
        desc:'Final step in any programmatic configurator flow. After all add-nodes/update-nodes/delete-nodes calls are complete, call save-instance to write the configuration back to the Quote and QuoteLineItem records. The context is released after save.',
        steps:[
          'Only call this after all add/update/delete-nodes calls are done',
          'The contextId is released after save — do not reuse it',
          'Check errors[] in response before treating as success'
        ],
        body:'{"contextId":"{{CONTEXT_ID}}"}'
      }
    ] },

  { id:'cfg-10', category:'Configurator', name:'Configuration Get Instance', methods:['POST'],
    path:'/connect/cpq/configurator/actions/get-instance', version:'v64.0',
    desc:'Fetch the full JSON representation of a product configuration instance by contextId. Use the response to display configuration details on the Salesforce UI or to save the instance to an external system.',
    page:955,
    params:[
      {name:'contextId',type:'String',req:true,desc:'Transaction context ID of the product configuration instance to fetch. Returned from a prior configure or load-instance call.'},
    ],
    request:'{\n  "contextId": "008d27d7-e004-4906-a949-ee7d7c323c77"\n}',
    response:'// Success\n{\n  "errors": [],\n  "success": true,\n  "transaction": {\n    "id": "0Q0DU0000000XoN0AU",\n    "salesTransactionItems": [\n      {\n        "id": "0QLDU000000XYZABCD",\n        "businessObjectType": "QuoteLineItem",\n        "Product": "01txx0000006i2aAAA",\n        "Quantity": 12,\n        "UnitPrice": 144.99,\n        "SalesTransactionItemAttribute": [\n          {\n            "id": "0zuxx000000000FAAQ",\n            "AttributeKey": "0tjxx0000000001AAA",\n            "AttributeValue": "1080p Built-in Display",\n            "businessObjectType": "QuoteLineItemAttribute"\n          }\n        ]\n      }\n    ]\n  }\n}' },

  { id:'cfg-11', category:'Configurator', name:'Product Set Quantity', methods:['POST'],
    path:'/connect/cpq/configurator/actions/set-product-quantity', version:'v64.0',
    desc:'Set the quantity of a product through the runtime system.',
    page:955,
    params:[
      {name:'contextId',type:'String',req:true,desc:'ID of the context object that\'s being considered.'},
      {name:'quantity',type:'Integer',req:true,desc:'Value of the product quantity.'},
      {name:'transactionLinePath',type:'String[]',req:true,desc:'Path to the line item where the update to the quantity is applied. For example, Quote.QuoteLineItem.Quantity.'},
      {name:'configuratorOptions',type:'Configurator Options Input',req:false,desc:'Options: addDefaultConfiguration, executeConfigurationRules, executePricing, explainabilityEnabled (Boolean v66 — solver logs), pricingProcedure (String), qualifyAllProductsInTransaction, returnProductCatalogData (false when not using Configurator UI), validateAmendRenewCancel, validateProductCatalog.'},
      {name:'qualificationContext',type:'User Context Input',req:false,desc:'User context for qualification rules: accountId (String), contactId (String), contextId (String — existing session).'},
    ],
    request:'{\n  "configuratorOptions": {\n    "executePricing": true,\n    "returnProductCatalogData": true,\n    "qualifyAllProductsInTransaction": true,\n    "validateProductCatalog": true,\n    "validateAmendRenewCancel": true,\n    "executeConfigurationRules": true,\n    "addDefaultConfiguration": true\n  },\n  "qualificationContext": {\n    "accountId": "001xx0000000001AAA",\n    "contactId": "003xx00000000D7AAI"\n  },\n  "contextId": "008d27d7-e004-4906-a949-ee7d7c323c77",\n  "quantity": 20,\n  "transactionLinePath": "Quote.QuoteLineItem.Quantity"\n}',
    response:'{\n  "configuratorMessages": {},\n  "configuratorUITreatments": [\n    {\n      "details": {\n        "attributeId": "0tjxx0000000007AAA",\n        "prcId": "0dSxx0000000007EAA",\n        "stiId": "0QLxx0000004CU0GAM",\n        "attributePicklistValueId": "0v6xx0000000005AAA"\n      },\n      "uiTreatmentScope": "Bundle",\n      "uiTreatmentTarget": "Attribute_Picklist_Value",\n      "uiTreatmentType": "Hide"\n    },\n    {\n      "details": {\n        "stiId": "ref_f0f2da7b_c431_482d_bf4b_599052f3a2e1"\n      },\n      "uiTreatmentScope": "Product",\n      "uiTreatmentTarget": "Component",\n      "uiTreatmentType": "Disable"\n    }\n  ],\n  "errors": [],\n  "productQualifications": {\n    "01tDU000000EOTCYA4": { "isQualified": true }\n  },\n  "success": true\n}',
    examples:[
      {
        type:'set-qty-on-line',
        label:'1 — Set quantity on a QuoteLineItem',
        desc:'Set product quantity directly via the configurator runtime. Equivalent to update-nodes with Quantity but uses a dedicated path-based selector. The transactionLinePath must resolve to the specific QLI — pass the full path from Quote root to the QLI.',
        steps:[
          'Get contextId from the prior load-instance call',
          'transactionLinePath uses dot notation from the transaction root: e.g. "Quote.QuoteLineItem.Quantity"',
          'quantity is an Integer',
          'Call save-instance after to persist'
        ],
        body:'{"contextId":"{{CONTEXT_ID}}","quantity":5,"transactionLinePath":"Quote.QuoteLineItem.Quantity","configuratorOptions":{"executePricing":true,"executeConfigurationRules":true,"addDefaultConfiguration":true,"returnProductCatalogData":false}}'
      }
    ] },

  { id:'cfg-12', category:'Configurator', name:'Run Config Rules (Invocable)', methods:['POST'],
    path:'/services/data/v67.0/actions/standard/runConfigRules', version:'v67.0',
    desc:'Invocable action that runs configuration rules for a quote or order. Decouples rule execution from configuration so rules can be run independently or from a Flow. Returns visibilityRules, messageRules, productRecommendationRules, and a transactionContextId. Available from v65.0.',
    page:979,
    params:[
      {name:'transactionContextId',type:'String',req:false,desc:'Unique identifier for the transaction context. Pass this or transactionId.'},
      {name:'transactionId',type:'String',req:true,desc:'Unique identifier for the transaction (quote or order ID). Required.'},
    ],
    request:'{\n  "inputs": [\n    {\n      "transactionContextId": "008d27d7-e004-4906-a949-ee7d7c323c77",\n      "transactionId": "0Q0DU0000005tJh0AI"\n    }\n  ]\n}',
    response:'[\n  {\n    "actionName": "runConfigRules",\n    "errors": null,\n    "isSuccess": true,\n    "outputValues": {\n      "transactionContextId": "0000000p18dq18g0029175793402786243c3d5ea94c241f09c11388ac1b865f9",\n      "configRuleResult": {\n        "visibilityRules": [\n          {\n            "stiId": "0QLxx0000004CU0GAM",\n            "prcId": "PRC1",\n            "attributeId": "Color",\n            "attributePicklistValueId": "Red",\n            "target": "Attribute",\n            "scope": "Product",\n            "type": "Hide"\n          }\n        ],\n        "transactionContextId": "0000000p18dq18g0029175793402786243c3d5ea94c241f09c11388ac1b865f9",\n        "productRecommendationRules": [\n          {\n            "referenceId": "CORE_BUNDLE_001",\n            "productIds": ["01t000000001234", "01t000000005678"]\n          }\n        ],\n        "messageRules": [\n          {\n            "stiId": "0QLxx0000004CU0GAM",\n            "severity": "INFO",\n            "messages": ["Product configuration validated successfully"]\n          }\n        ],\n        "errors": []\n      }\n    }\n  }\n]' },

  // DRO — Dynamic Revenue Orchestrator (entirely new category)
  { id:'dro-1', category:'DRO', name:'Decompose Sales Transaction', methods:['POST'],
    path:'/services/data/v67.0/actions/standard/decomposeSalesTransaction', version:'v67.0',
    desc:'Decompose and submit a sales transaction to the fulfillment system (available from v67.0). Use Orchestrate Sales Transaction as the current preferred action.',
    page:1877,
    params:[
      {name:'salesTransactionId',type:'String',req:true,location:'body',desc:'(v67.0) ID of the sales transaction to submit.'},
      {name:'fulfillmentAdapter',type:'String',req:true,location:'body',desc:'(v67.0) StandardOrder or GenericAdapter.'},
      {name:'allowOverrideOfPointOfNoReturn',type:'Boolean',req:false,location:'body',desc:'(v67.0) Override point-of-no-return setting. Default: false.'},
      {name:'fulfillmentPriority',type:'String',req:false,location:'body',desc:'(v67.0) High, Bulk, or Default.'},
      {name:'hydratedContextId',type:'String',req:false,location:'body',desc:'(v67.0) ID of the hydrated context.'},
      {name:'intakeRequestType',type:'String',req:false,location:'body',desc:'(v67.0) Synchronous or Asynchronous.'},
      {name:'priorityLimitAction',type:'String',req:false,location:'body',desc:'(v67.0) Reject or Downgrade when priority limit reached.'},
    ],
    request:'{\n  "inputs": [\n    {\n      "salesTransactionId": "{{SALES_TRANSACTION_ID}}",\n      "fulfillmentAdapter": "StandardOrder"\n    }\n  ]\n}',
    response:'[\n  {\n    "actionName": "decomposeSalesTransaction",\n    "errors": null,\n    "isSuccess": true,\n    "outputValues": {\n      "requestId": "req-decomp-001",\n      "submitStatus": "SUBMITTED",\n      "requestedFulfillmentPriority": "Default",\n      "resolvedFulfillmentPriority": "Default",\n      "usedContextId": "{{CONTEXT_ID}}",\n      "errorCode": null\n    }\n  }\n]' },

  { id:'dro-2', category:'DRO', name:'Freeze Sales Transaction', methods:['POST'],
    path:'/services/data/v67.0/actions/standard/freezeSalesTransaction', version:'v64.0',
    desc:'Freeze a submitted sales transaction to prevent further fulfillment changes.',
    page:1877,
    params:[
      {name:'salesTransactionId',type:'String',req:true,location:'body',desc:'(v64.0) ID of the submitted sales transaction to freeze.'},
    ],
    request:'{\n  "inputs": [\n    {\n      "salesTransactionId": "{{SALES_TRANSACTION_ID}}"\n    }\n  ]\n}',
    response:'[\n  {\n    "actionName": "freezeSalesTransaction",\n    "errors": null,\n    "isSuccess": true,\n    "outputValues": {\n      "requestId": "req-freeze-001",\n      "orchestrationPlanId": "{{ORCHESTRATION_PLAN_ID}}",\n      "planState": "FROZEN",\n      "salesTransactionId": "{{SALES_TRANSACTION_ID}}",\n      "pointOfNoReturnDetailForLineItemsList": [],\n      "errorCode": null\n    }\n  }\n]' },

  { id:'dro-3', category:'DRO', name:'Get Point Of No Return', methods:['POST'],
    path:'/services/data/v67.0/actions/standard/getPointOfNoReturn', version:'v64.0',
    desc:'Get the point-of-no-return status for line items in a sales transaction.',
    page:1877,
    params:[
      {name:'salesTransactionId',type:'String',req:true,location:'body',desc:'(v64.0) ID of the sales transaction to check.'},
    ],
    request:'{\n  "inputs": [\n    {\n      "salesTransactionId": "{{SALES_TRANSACTION_ID}}"\n    }\n  ]\n}',
    response:'[\n  {\n    "actionName": "getPointOfNoReturn",\n    "errors": null,\n    "isSuccess": true,\n    "outputValues": {\n      "requestId": "req-ponr-001",\n      "planId": "{{PLAN_ID}}",\n      "planState": "Active",\n      "salesTransactionId": "{{SALES_TRANSACTION_ID}}",\n      "lineItemsPointOfNoReturnInfo": [],\n      "errorCode": null\n    }\n  }\n]' },

  { id:'dro-4', category:'DRO', name:'Orchestrate Sales Transaction', methods:['POST'],
    path:'/services/data/v67.0/actions/standard/orchestrateSalesTransaction', version:'v67.0',
    desc:'Orchestrate and submit a sales transaction to the fulfillment system (v67.0 replacement for Decompose).',
    page:1877,
    params:[
      {name:'salesTransactionId',type:'String',req:true,location:'body',desc:'(v67.0) ID of the sales transaction to submit.'},
      {name:'fulfillmentAdapter',type:'String',req:true,location:'body',desc:'(v67.0) StandardOrder or GenericAdapter.'},
      {name:'allowOverrideOfPointOfNoReturn',type:'Boolean',req:false,location:'body',desc:'(v67.0) Override point-of-no-return. Default: false.'},
      {name:'fulfillmentPriority',type:'String',req:false,location:'body',desc:'(v67.0) High, Bulk, or Default.'},
      {name:'hydratedContextId',type:'String',req:false,location:'body',desc:'(v67.0) ID of the hydrated context.'},
      {name:'intakeRequestType',type:'String',req:false,location:'body',desc:'(v67.0) Synchronous or Asynchronous.'},
      {name:'priorityLimitAction',type:'String',req:false,location:'body',desc:'(v67.0) Reject or Downgrade when priority limit reached.'},
    ],
    request:'{\n  "inputs": [\n    {\n      "salesTransactionId": "{{SALES_TRANSACTION_ID}}",\n      "fulfillmentAdapter": "StandardOrder"\n    }\n  ]\n}',
    response:'[\n  {\n    "actionName": "orchestrateSalesTransaction",\n    "errors": null,\n    "isSuccess": true,\n    "outputValues": {\n      "requestId": "req-orch-001",\n      "fulfillmentPlanId": "{{FULFILLMENT_PLAN_ID}}",\n      "submitStatus": "SUBMITTED",\n      "usedContextId": "{{CONTEXT_ID}}",\n      "requestedFulfillmentPriority": "Default",\n      "resolvedFulfillmentPriority": "Default",\n      "errorCode": null\n    }\n  }\n]' },

  { id:'dro-5', category:'DRO', name:'Orchestrate Transaction', methods:['POST'],
    path:'/services/data/v67.0/actions/standard/orchestrateTransaction', version:'v66.0',
    desc:'Orchestrate a generic business/domain object (e.g., Collection Plan).',
    page:1877,
    params:[
      {name:'transactionId',type:'String',req:true,location:'body',desc:'(v66.0) ID of the business/domain object to orchestrate.'},
      {name:'orchestrationType',type:'String',req:true,location:'body',desc:'(v66.0) Generic, Fulfillment, or Billing.'},
    ],
    request:'{\n  "inputs": [\n    {\n      "transactionId": "{{TRANSACTION_ID}}",\n      "orchestrationType": "Fulfillment"\n    }\n  ]\n}',
    response:'[\n  {\n    "actionName": "orchestrateTransaction",\n    "errors": null,\n    "isSuccess": true,\n    "outputValues": {\n      "requestId": "req-orchtxn-001",\n      "fulfillmentPlanId": "{{FULFILLMENT_PLAN_ID}}",\n      "submitStatus": "SUBMITTED",\n      "errorCode": null\n    }\n  }\n]' },

  { id:'dro-6', category:'DRO', name:'Submit Order', methods:['POST'],
    path:'/services/data/v67.0/actions/standard/submitOrder', version:'v61.0',
    desc:'Submit a bare order to DRO for fulfillment.',
    page:1877,
    params:[
      {name:'orderId',type:'String',req:true,location:'body',desc:'(v61.0) ID of the order to submit to DRO.'},
      {name:'callType',type:'String',req:false,location:'body',desc:'(v61.0) Synchronous or Asynchronous. Default: Asynchronous.'},
      {name:'contextId',type:'String',req:false,location:'body',desc:'(v61.0) ID of the hydrated context (see Context Service).'},
    ],
    request:'{\n  "inputs": [\n    {\n      "orderId": "{{ORDER_ID}}"\n    }\n  ]\n}',
    response:'[\n  {\n    "actionName": "submitOrder",\n    "errors": null,\n    "isSuccess": true,\n    "outputValues": {\n      "requestId": "req-submitorder-001",\n      "fulfillmentPlanId": "{{FULFILLMENT_PLAN_ID}}",\n      "submitStatus": "SUBMITTED",\n      "usedContextId": "{{CONTEXT_ID}}",\n      "errorCode": null\n    }\n  }\n]' },

  { id:'dro-7', category:'DRO', name:'Submit Sales Transaction', methods:['POST'],
    path:'/services/data/v67.0/actions/standard/submitSalesTransaction', version:'v63.0',
    desc:'Submit a Revenue Cloud sales transaction to DRO for fulfillment.',
    page:1877,
    params:[
      {name:'salesTransactionId',type:'String',req:true,location:'body',desc:'(v63.0) ID of the sales transaction to submit.'},
      {name:'fulfillmentPriority',type:'String',req:false,location:'body',desc:'(v63.0) High, Bulk, or Default.'},
      {name:'hydratedContextId',type:'String',req:false,location:'body',desc:'(v63.0) ID of the hydrated context (see Context Service).'},
      {name:'intakeRequestType',type:'String',req:false,location:'body',desc:'(v63.0) Intake request type for the fulfillment plan.'},
      {name:'fulfillmentAdapter',type:'String',req:false,location:'body',desc:'(v63.0) Custom fulfillment adapter API name.'},
      {name:'allowOverrideOfPointOfNoReturn',type:'Boolean',req:false,location:'body',desc:'(v63.0) Allow override of point-of-no-return check.'},
      {name:'priorityLimitAction',type:'String',req:false,location:'body',desc:'(v63.0) Action to take when priority limit is reached.'},
    ],
    request:'{\n  "inputs": [\n    {\n      "salesTransactionId": "{{SALES_TRANSACTION_ID}}"\n    }\n  ]\n}',
    response:'[\n  {\n    "actionName": "submitSalesTransaction",\n    "errors": null,\n    "isSuccess": true,\n    "outputValues": {\n      "fulfillmentPlanId": "{{FULFILLMENT_PLAN_ID}}",\n      "requestId": "req-submitsalestxn-001",\n      "resolvedFulfillmentPriority": "Default",\n      "requestedFulfillmentPriority": "Default",\n      "usedContextId": "{{CONTEXT_ID}}",\n      "submitStatus": "SUBMITTED"\n    }\n  }\n]' },

  { id:'dro-8', category:'DRO', name:'Unfreeze Sales Transaction', methods:['POST'],
    path:'/services/data/v67.0/actions/standard/unfreezeSalesTransaction', version:'v64.0',
    desc:'Unfreeze a previously frozen sales transaction to allow fulfillment changes.',
    page:1877,
    params:[
      {name:'salesTransactionId',type:'String',req:true,location:'body',desc:'(v64.0) ID of the submitted sales transaction to unfreeze.'},
    ],
    request:'{\n  "inputs": [\n    {\n      "salesTransactionId": "{{SALES_TRANSACTION_ID}}"\n    }\n  ]\n}',
    response:'[\n  {\n    "actionName": "unfreezeSalesTransaction",\n    "errors": null,\n    "isSuccess": true,\n    "outputValues": {\n      "orchestrationPlanId": "{{ORCHESTRATION_PLAN_ID}}",\n      "salesTransactionId": "{{SALES_TRANSACTION_ID}}",\n      "planState": "ACTIVE",\n      "requestId": "req-unfreeze-001",\n      "errorCode": null\n    }\n  }\n]' },

  // Usage — additional endpoints from PDF
  { id:'usage-6', category:'Usage', name:'Order Item Usage Details', methods:['GET'],
    path:'/commerce/sales-orders/line-items/{orderItemId}/usage-details', version:'v63.0',
    desc:'Get usage details for an order item, including grants, resources, and configured rates.',
    page:2040,
    params:[
      {name:'orderItemId',type:'String',req:true,location:'path',desc:'(v63.0) Order item ID.'},
      {name:'effectiveDate',type:'String',req:false,location:'query',desc:'(v63.0) Date to search for applicable rate card entries.'},
      {name:'optionalFields',type:'String[]',req:false,location:'query',desc:'(v63.0) Custom fields: OrderItemRateCardEntry, OrderItemRateAdjustment.'},
    ],
    request:'No request body.',
    response:'{\n  "orderItemId": "{{ORDER_ITEM_ID}}",\n  "grants": [],\n  "resources": [],\n  "configuredRates": []\n}' },

  { id:'usage-7', category:'Usage', name:'Quote Line Item Usage Details', methods:['GET'],
    path:'/commerce/quotes/line-items/{quoteLineItemId}/usage-details', version:'v62.0',
    desc:'Get usage details for a quote line item.',
    page:2040,
    params:[
      {name:'quoteLineItemId',type:'String',req:true,location:'path',desc:'(v62.0) Quote line item ID.'},
      {name:'effectiveDate',type:'String',req:false,location:'query',desc:'(v62.0) Date to search for applicable rate card entries.'},
      {name:'optionalFields',type:'String[]',req:false,location:'query',desc:'(v62.0) Custom fields: QuoteLineRateCardEntry, QuoteLineRateAdjustment.'},
    ],
    request:'No request body.',
    response:'{\n  "quoteLineItemId": "{{QUOTE_LINE_ITEM_ID}}",\n  "grants": [],\n  "resources": [],\n  "configuredRates": []\n}' },

  { id:'usage-8', category:'Usage', name:'Invoke Summary Creation', methods:['POST'],
    path:'/services/data/v67.0/actions/standard/invokeSummaryCreationService', version:'v63.0',
    desc:'Invoke summary creation for a usage entitlement account. Creates usage, ratable, and liable summaries asynchronously.',
    page:2040,
    params:[
      {name:'usageEntitlementAccountId',type:'String',req:true,location:'body',desc:'(v63.0) Usage entitlement account record ID.'},
    ],
    request:'{\n  "inputs": [\n    {\n      "usageEntitlementAccountId": "{{USAGE_ENTITLEMENT_ACCOUNT_ID}}"\n    }\n  ]\n}',
    response:'[\n  {\n    "actionName": "invokeSummaryCreationService",\n    "errors": null,\n    "isSuccess": true,\n    "outputValues": {\n      "success": true\n    }\n  }\n]' },

  { id:'usage-9', category:'Usage', name:'Process Consumption Overages', methods:['POST'],
    path:'/services/data/v67.0/actions/standard/processConsumptionOverages', version:'v63.0',
    desc:'Process overages for a usage ratable summary. Applies to SummaryComplete records.',
    page:2040,
    params:[
      {name:'usageRatableSummaryId',type:'String',req:true,location:'body',desc:'(v63.0) Usage ratable summary ID for overage calculation.'},
    ],
    request:'{\n  "inputs": [\n    {\n      "usageRatableSummaryId": "{{USAGE_RATABLE_SUMMARY_ID}}"\n    }\n  ]\n}',
    response:'[\n  {\n    "actionName": "processConsumptionOverages",\n    "errors": null,\n    "isSuccess": true,\n    "outputValues": {\n      "success": true\n    }\n  }\n]' },

  { id:'usage-10', category:'Usage', name:'Refresh Entitlement Bucket', methods:['POST'],
    path:'/services/data/v67.0/actions/standard/refreshUsageEntitlementBucket', version:'v63.0',
    desc:'Refresh entitlements for a transaction usage entitlement by evaluating usage entitlement bucket records.',
    page:2040,
    params:[
      {name:'transactionUsageEntitlementId',type:'String',req:true,location:'body',desc:'(v63.0) Transaction usage entitlement record with buckets to refresh.'},
    ],
    request:'{\n  "inputs": [\n    {\n      "transactionUsageEntitlementId": "{{TRANSACTION_USAGE_ENTITLEMENT_ID}}"\n    }\n  ]\n}',
    response:'[\n  {\n    "actionName": "refreshUsageEntitlementBucket",\n    "errors": null,\n    "isSuccess": true,\n    "outputValues": {\n      "success": true\n    }\n  }\n]' },

  { id:'usage-11', category:'Usage', name:'Retrigger Entitlement Creation', methods:['POST'],
    path:'/services/data/v67.0/actions/standard/retriggerEntlCreaProc', version:'v65.0',
    desc:'Retrigger entitlement creation for an asset. Triggers for failed/unprocessed assets or creates wallets.',
    page:2040,
    params:[
      {name:'assetId',type:'String',req:true,location:'body',desc:'(v65.0) Asset ID to retrigger entitlement creation for.'},
    ],
    request:'{\n  "inputs": [\n    {\n      "assetId": "{{ASSET_ID}}"\n    }\n  ]\n}',
    response:'[\n  {\n    "actionName": "retriggerEntlCreaProc",\n    "errors": null,\n    "isSuccess": true,\n    "outputValues": {\n      "success": true\n    }\n  }\n]' },

  // Billing — additional endpoints from PDF
  { id:'bill-9', category:'Billing', name:'Invoice Draft to Posted', methods:['POST'],
    path:'/commerce/invoicing/invoices/collection/actions/post', version:'v62.0',
    desc:'Move a collection of draft invoices to Posted status.',
    page:2489,
    params:[
      {name:'invoiceIds',type:'String[]',req:true,location:'body',desc:'(v62.0) Invoice IDs to post.'},
      {name:'correlationId',type:'String',req:false,location:'body',desc:'(v62.0) Correlation ID for traceability.'},
    ],
    request:'{\n  "invoiceIds": ["{{INVOICE_ID}}"]\n}',
    response:'{\n  "success": true,\n  "postedInvoiceIds": ["{{INVOICE_ID}}"]\n}' },

  { id:'bill-10', category:'Billing', name:'Invoice Ingestion', methods:['POST'],
    path:'/commerce/invoicing/invoices/collection/actions/ingest', version:'v63.0',
    desc:'Ingest invoice data from an external source.',
    page:2489,
    params:[
      {name:'invoices',type:'Object[]',req:true,location:'body',desc:'(v63.0) Invoice objects to ingest.'},
    ],
    request:'{\n  "invoices": [\n    {\n      "accountId": "{{ACCOUNT_ID}}",\n      "invoiceDate": "2024-07-09",\n      "dueDate": "2024-08-09",\n      "currencyIsoCode": "USD",\n      "invoiceLines": [\n        {"description": "Service Fee","amount": 150.00,"chargeDate": "2024-07-09"}\n      ]\n    }\n  ]\n}',
    response:'{\n  "success": true\n}' },

  { id:'bill-11', category:'Billing', name:'Invoice Estimated Tax (Async)', methods:['POST'],
    path:'/commerce/invoicing/invoices/collection/actions/calculate-estimated-tax', version:'v63.0',
    desc:'Async version of estimated tax calculation. Returns a requestIdentifier for polling. Identical path to bill-est-tax — use bill-est-tax for the primary reference.',
    page:2489,
    params:[
      {name:'invoiceIds',type:'String[]',req:true,location:'body',desc:'(v63.0) Invoice IDs to calculate estimated tax for.'},
      {name:'correlationId',type:'String',req:false,location:'body',desc:'Optional correlation ID for traceability.'},
    ],
    request:'{\n  "invoiceIds": ["{{INVOICE_ID}}"]\n}',
    response:'{\n  "errors": [],\n  "requestIdentifier": "req-tax-est-001",\n  "success": true\n}' },

  { id:'bill-12', category:'Billing', name:'Invoice Preview', methods:['POST'],
    path:'/commerce/invoicing/invoices/collection/actions/preview', version:'v63.0',
    desc:'Preview invoices before generation.',
    page:2489,
    params:[
      {name:'billingTransactionId',type:'String',req:true,location:'body',desc:'(v63.0) Billing transaction ID to preview.'},
      {name:'numberOfBillingPeriods',type:'Integer',req:false,location:'body',desc:'(v63.0) Number of billing periods to preview.'},
      {name:'previewDate',type:'String',req:false,location:'body',desc:'(v63.0) Date to use for preview.'},
    ],
    request:'{\n  "billingTransactionId": "{{BILLING_TRANSACTION_ID}}"\n}',
    response:'{\n  "previewInvoices": [\n    {\n      "billingScheduleId": "{{BILLING_SCHEDULE_ID}}",\n      "amount": 150.00,\n      "billingPeriodStart": "2024-07-01",\n      "billingPeriodEnd": "2024-07-31",\n      "invoiceDate": "2024-07-09"\n    }\n  ]\n}' },

  { id:'bill-13', category:'Billing', name:'Invoice Run Recovery', methods:['POST'],
    path:'/commerce/invoicing/invoice-batch-runs/{invoiceBatchRunId}/actions/recover', version:'v62.0',
    desc:'Recover an invoice batch run.',
    page:2489,
    params:[
      {name:'invoiceBatchRunId',type:'String',req:true,location:'path',desc:'(v62.0) Invoice batch run ID to recover.'},
    ],
    request:'No request body.',
    response:'{\n  "results": [\n    {\n      "billingScheduleId": "{{BILLING_SCHEDULE_ID}}",\n      "status": "Success",\n      "invoiceId": "3ttSG00000001AAAA"\n    }\n  ]\n}' },

  { id:'bill-14', category:'Billing', name:'Batch Invoices Draft to Posted', methods:['POST'],
    path:'/commerce/invoicing/invoice-batch-runs/{invoiceBatchRunId}/actions/draft-to-posted', version:'v62.0',
    desc:'Move all draft invoices in a batch run to Posted status.',
    page:2489,
    params:[
      {name:'invoiceBatchRunId',type:'String',req:true,location:'path',desc:'(v62.0) Invoice batch run ID.'},
    ],
    request:'No request body.',
    response:'{\n  "success": true\n}' },

  { id:'bill-15', category:'Billing', name:'Send Emails for Posted Invoices', methods:['POST'],
    path:'/commerce/invoicing/invoice-batch-runs/actions/send-email', version:'v65.0',
    desc:'Send email notifications for posted invoices in a batch run.',
    page:2489,
    params:[
      {name:'invoiceBatchRunId',type:'String',req:true,location:'body',desc:'(v65.0) Invoice batch run ID.'},
    ],
    request:'{\n  "invoiceBatchRunId": "{{INVOICE_BATCH_RUN_ID}}"\n}',
    response:'{\n  "success": true\n}' },

  { id:'bill-16', category:'Billing', name:'Negative Invoice Lines to Credit', methods:['POST'],
    path:'/commerce/invoicing/invoices/{invoiceId}/actions/convert-to-credit', version:'v62.0',
    desc:'Convert negative invoice lines to a credit memo.',
    page:2489,
    params:[
      {name:'invoiceId',type:'String',req:true,location:'path',desc:'(v62.0) Invoice ID.'},
    ],
    request:'No request body.',
    response:'{\n  "creditMemoId": "{{CREDIT_MEMO_ID}}",\n  "success": true\n}' },

  { id:'bill-17', category:'Billing', name:'Create and Apply Credit Memo', methods:['POST'],
    path:'/commerce/invoicing/invoices/{invoiceId}/actions/credit', version:'v62.0',
    desc:'Create a credit memo and apply it to an invoice.',
    page:2489,
    params:[
      {name:'invoiceId',type:'String',req:true,location:'path',desc:'(v62.0) Invoice ID.'},
      {name:'invoiceLines',type:'Object[]',req:true,location:'body',desc:'(v62.0) Credit invoice line inputs.'},
      {name:'taxStrategy',type:'String',req:true,location:'body',desc:'(v62.0) Tax strategy for the credit memo.'},
      {name:'description',type:'String',req:false,location:'body',desc:'(v62.0) Description of the credit memo.'},
      {name:'effectiveDate',type:'String',req:false,location:'body',desc:'(v62.0) Effective date.'},
      {name:'taxEffectiveDate',type:'String',req:false,location:'body',desc:'(v62.0) Tax effective date.'},
      {name:'type',type:'String',req:false,location:'body',desc:'(v62.0) Type of credit memo.'},
    ],
    request:'{\n  "invoiceLines": [\n    {\n      "invoiceLineId": "{{INVOICE_LINE_ID}}",\n      "amount": 50.00\n    }\n  ],\n  "taxStrategy": "Net",\n  "description": "Credit for billing adjustment"\n}',
    response:'{\n  "creditMemoId": "{{CREDIT_MEMO_ID}}",\n  "invoiceId": "{{INVOICE_ID}}",\n  "success": true\n}' },

  { id:'bill-18', category:'Billing', name:'Unapply Credit Memo', methods:['POST'],
    path:'/commerce/invoicing/credit-memo-inv-applications/{creditMemoInvApplicationId}/actions/unapply', version:'v62.0',
    desc:'Unapply a credit memo from an invoice.',
    page:2489,
    params:[
      {name:'creditMemoInvApplicationId',type:'String',req:true,location:'path',desc:'(v62.0) Credit memo invoice application ID.'},
    ],
    request:'No request body.',
    response:'{\n  "success": true\n}' },

  { id:'bill-19', category:'Billing', name:'Apply Credit Memo Line', methods:['POST'],
    path:'/commerce/invoicing/credit-memo-lines/{creditMemoLineId}/actions/apply', version:'v62.0',
    desc:'Apply a specific credit memo line to invoice lines.',
    page:2489,
    params:[
      {name:'creditMemoLineId',type:'String',req:true,location:'path',desc:'(v62.0) Credit memo line ID.'},
      {name:'applications',type:'Object[]',req:true,location:'body',desc:'(v62.0) Applications to apply.'},
    ],
    request:'{\n  "applications": [\n    {\n      "invoiceLineId": "{{INVOICE_LINE_ID}}",\n      "amount": 25.00\n    }\n  ]\n}',
    response:'{\n  "success": true\n}' },

  { id:'bill-20', category:'Billing', name:'Unapply Credit Memo Line', methods:['POST'],
    path:'/commerce/invoicing/credit-memo-line-invoice-line/{creditMemoLineInvoiceLineId}/actions/unapply', version:'v62.0',
    desc:'Unapply a credit memo line from an invoice line.',
    page:2489,
    params:[
      {name:'creditMemoLineInvoiceLineId',type:'String',req:true,location:'path',desc:'(v62.0) Credit memo line invoice line ID.'},
    ],
    request:'No request body.',
    response:'{\n  "success": true\n}' },

  { id:'bill-21', category:'Billing', name:'Standalone Credit Memo', methods:['POST'],
    path:'/commerce/invoicing/credit-memos/actions/generate', version:'v62.0',
    desc:'Generate a standalone credit memo not tied to an invoice.',
    page:2489,
    params:[
      {name:'billingAccountId',type:'String',req:true,location:'body',desc:'(v62.0) Billing account ID.'},
      {name:'charges',type:'Object[]',req:true,location:'body',desc:'(v62.0) Charges for the credit memo.'},
      {name:'taxStrategy',type:'String',req:true,location:'body',desc:'(v62.0) Tax strategy.'},
      {name:'billToContactId',type:'String',req:false,location:'body',desc:'(v62.0) Bill-to contact ID.'},
      {name:'currencyIsoCode',type:'String',req:false,location:'body',desc:'(v62.0) Currency ISO code.'},
      {name:'description',type:'String',req:false,location:'body',desc:'(v62.0) Description.'},
      {name:'effectiveDate',type:'String',req:false,location:'body',desc:'(v62.0) Effective date.'},
      {name:'type',type:'String',req:false,location:'body',desc:'(v62.0) Type of credit memo.'},
    ],
    request:'{\n  "billingAccountId": "{{ACCOUNT_ID}}",\n  "charges": [\n    {\n      "description": "Service credit",\n      "amount": 75.00,\n      "chargeDate": "2024-07-09"\n    }\n  ],\n  "taxStrategy": "Net"\n}',
    response:'{\n  "creditMemoId": "{{CREDIT_MEMO_ID}}",\n  "success": true\n}' },

  { id:'bill-22', category:'Billing', name:'Post a Draft Memo', methods:['POST'],
    path:'/commerce/invoicing/credit/collection/actions/post', version:'v65.0',
    desc:'Post a collection of draft credit memos.',
    page:2489,
    params:[
      {name:'creditMemoIds',type:'String[]',req:true,location:'body',desc:'(v65.0) Credit memo IDs to post.'},
    ],
    request:'{\n  "creditMemoIds": ["{{CREDIT_MEMO_ID}}"]\n}',
    response:'{\n  "success": true\n}' },

  { id:'bill-23', category:'Billing', name:'Void Posted Credit Memo', methods:['POST'],
    path:'/commerce/billing/credit-memos/{creditMemoId}/actions/void', version:'v66.0',
    desc:'Void a posted credit memo.',
    page:2489,
    params:[
      {name:'creditMemoId',type:'String',req:true,location:'path',desc:'(v66.0) Credit memo ID.'},
    ],
    request:'No request body.',
    response:'{\n  "creditMemoId": "{{CREDIT_MEMO_ID}}",\n  "status": "Voided",\n  "success": true\n}' },

  { id:'bill-24', category:'Billing', name:'Void a Posted Invoice', methods:['POST'],
    path:'/commerce/invoicing/invoices/{invoiceId}/actions/void', version:'v62.0',
    desc:'Void a posted invoice.',
    page:2489,
    params:[
      {name:'invoiceId',type:'String',req:true,location:'path',desc:'(v62.0) Invoice ID.'},
    ],
    request:'No request body.',
    response:'{\n  "requestIdentifier": "req-void-001",\n  "success": true,\n  "errors": []\n}' },

  { id:'bill-25', category:'Billing', name:'Posted Invoice List Write-Off', methods:['POST'],
    path:'/commerce/invoicing/invoices/actions/write-off', version:'v64.0',
    desc:'Write off a list of posted invoices.',
    page:2489,
    params:[
      {name:'invoiceIds',type:'String[]',req:true,location:'body',desc:'(v64.0) Invoice IDs to write off.'},
    ],
    request:'{\n  "invoiceIds": ["{{INVOICE_ID}}"]\n}',
    response:'{\n  "success": true,\n  "writtenOffCount": 1\n}' },

  { id:'bill-26', category:'Billing', name:'Payment Line Apply', methods:['POST'],
    path:'/commerce/billing/payments/{paymentId}/actions/apply', version:'v64.0',
    desc:'Apply a payment to invoice lines.',
    page:2489,
    params:[
      {name:'paymentId',type:'String',req:true,location:'path',desc:'(v64.0) Payment ID.'},
      {name:'applications',type:'Object[]',req:true,location:'body',desc:'(v64.0) Invoice lines to apply the payment to. Each: invoiceLineId (String, req), amount (Decimal, req), description (String, opt).'},
    ],
    request:'{\n  "applications": [\n    {\n      "invoiceLineId": "{{INVOICE_LINE_ID}}",\n      "amount": 100.00\n    }\n  ]\n}',
    response:'{\n  "success": true\n}' },

  { id:'bill-27', category:'Billing', name:'Payment Line Unapply', methods:['POST'],
    path:'/commerce/billing/payments/{paymentId}/paymentlines/{paymentLineId}/actions/unapply', version:'v64.0',
    desc:'Unapply a payment line from an invoice line.',
    page:2489,
    params:[
      {name:'paymentId',type:'String',req:true,location:'path',desc:'(v64.0) Payment ID.'},
      {name:'paymentLineId',type:'String',req:true,location:'path',desc:'(v64.0) Payment line ID.'},
    ],
    request:'No request body.',
    response:'{\n  "success": true\n}' },

  { id:'bill-28', category:'Billing', name:'Refund Line Apply', methods:['POST'],
    path:'/commerce/billing/refunds/{refundId}/actions/apply', version:'v64.0',
    desc:'Apply a refund to payment lines.',
    page:2489,
    params:[
      {name:'refundId',type:'String',req:true,location:'path',desc:'(v64.0) Refund ID.'},
      {name:'applications',type:'Object[]',req:true,location:'body',desc:'(v64.0) Payment lines to apply the refund to.'},
    ],
    request:'{\n  "applications": [\n    {\n      "paymentLineId": "{{PAYMENT_LINE_ID}}",\n      "amount": 50.00\n    }\n  ]\n}',
    response:'{\n  "success": true\n}' },

  { id:'bill-29', category:'Billing', name:'Batch Payment Scheduler', methods:['POST'],
    path:'/commerce/payments/payment-schedulers', version:'v64.0',
    desc:'Create a batch payment scheduler.',
    page:2489,
    params:[
      {name:'schedulerName',type:'String',req:true,location:'body',desc:'(v64.0) Unique scheduler name.'},
      {name:'startDate',type:'String',req:true,location:'body',desc:'(v64.0) Start date (yyyy-MM-dd).'},
      {name:'status',type:'String',req:true,location:'body',desc:'(v64.0) Draft, Active, or Inactive.'},
      {name:'frequencyCadence',type:'String',req:true,location:'body',desc:'(v64.0) Once, Daily, Weekly, or Monthly.'},
      {name:'preferredTime',type:'String',req:true,location:'body',desc:'(v64.0) Preferred run time (HH:mm).'},
      {name:'filterCriteria',type:'Object',req:false,location:'body',desc:'(v64.0) Filter criteria to select payments.'},
    ],
    request:'{\n  "schedulerName": "PaymentScheduler",\n  "startDate": "2024-07-09",\n  "status": "Active",\n  "frequencyCadence": "Once",\n  "preferredTime": "00:45"\n}',
    response:'{\n  "schedulerId": "{{SCHEDULER_ID}}",\n  "success": true\n}' },

  { id:'bill-30', category:'Billing', name:'Payment Scheduler Update', methods:['PATCH'],
    path:'/commerce/payments/payment-schedulers/{billingBatchSchedulerId}', version:'v64.0',
    desc:'Update an existing payment scheduler.',
    page:2489,
    params:[
      {name:'billingBatchSchedulerId',type:'String',req:true,location:'path',desc:'(v64.0) Payment scheduler ID.'},
      {name:'status',type:'String',req:false,location:'body',desc:'(v64.0) New status: Draft, Active, Inactive, or Canceled.'},
    ],
    request:'{\n  "status": "Inactive"\n}',
    response:'{\n  "schedulerId": "{{SCHEDULER_ID}}",\n  "success": true\n}' },

  { id:'bill-31', category:'Billing', name:'Rules Application', methods:['POST'],
    path:'/revenue/billing/transactions/actions/apply', version:'v66.0',
    desc:'Apply billing rules to transactions.',
    page:2489,
    params:[
      {name:'transactionIds',type:'String[]',req:true,location:'body',desc:'(v66.0) Transaction IDs to apply rules to.'},
    ],
    request:'{\n  "transactionIds": ["{{TRANSACTION_ID}}"]\n}',
    response:'{\n  "success": true\n}' },

  { id:'bill-32', category:'Billing', name:'Suspend Billing', methods:['POST'],
    path:'/commerce/invoicing/actions/suspend-billing', version:'v63.0',
    desc:'Suspend billing for accounts or billing schedules.',
    page:2489,
    params:[
      {name:'accountIds',type:'String[]',req:false,location:'body',desc:'(v63.0) Account IDs to suspend billing for.'},
      {name:'billingScheduleIds',type:'String[]',req:false,location:'body',desc:'(v63.0) Billing schedule IDs to suspend.'},
    ],
    request:'{\n  "accountIds": ["{{ACCOUNT_ID}}"]\n}',
    response:'{\n  "success": true\n}' },

  { id:'bill-33', category:'Billing', name:'Resume Billing', methods:['POST'],
    path:'/commerce/invoicing/actions/resume-billing', version:'v63.0',
    desc:'Resume billing for suspended accounts or billing schedules.',
    page:2489,
    params:[
      {name:'accountIds',type:'String[]',req:false,location:'body',desc:'(v63.0) Account IDs to resume billing for.'},
      {name:'billingScheduleIds',type:'String[]',req:false,location:'body',desc:'(v63.0) Billing schedule IDs to resume.'},
    ],
    request:'{\n  "accountIds": ["{{ACCOUNT_ID}}"]\n}',
    response:'{\n  "success": true\n}' },

  { id:'bill-34', category:'Billing', name:'Generate On-Demand Invoice Document', methods:['POST'],
    path:'/revenue/billing/document/actions/generate', version:'v66.0',
    desc:'Generate an on-demand invoice document.',
    page:2489,
    params:[
      {name:'invoiceId',type:'String',req:true,location:'body',desc:'(v66.0) Invoice ID to generate document for.'},
      {name:'documentTemplateId',type:'String',req:false,location:'body',desc:'(v66.0) Document template ID.'},
    ],
    request:'{\n  "invoiceId": "{{INVOICE_ID}}"\n}',
    response:'{\n  "documentId": "{{DOCUMENT_ID}}",\n  "success": true\n}' },

  { id:'bill-35', category:'Billing', name:'Generate Account Statement', methods:['POST'],
    path:'/revenue/billing/accounts/{accountId}/statement', version:'v66.0',
    desc:'Generate an account statement for a billing account.',
    page:2489,
    params:[
      {name:'accountId',type:'String',req:true,location:'path',desc:'(v66.0) Billing account ID.'},
      {name:'startDate',type:'String',req:true,location:'body',desc:'(v66.0) Start date of statement period.'},
      {name:'associatedAccountIds',type:'String[]',req:false,location:'body',desc:'(v66.0) Associated account IDs to include.'},
      {name:'correlationId',type:'String',req:false,location:'body',desc:'(v66.0) Correlation ID for traceability.'},
      {name:'customFields',type:'Object',req:false,location:'body',desc:'(v67.0) Custom fields to include.'},
      {name:'documentTemplateId',type:'String',req:false,location:'body',desc:'(v66.0) Document template ID.'},
      {name:'shouldShowOpenBalancesOnly',type:'Boolean',req:false,location:'body',desc:'(v66.0) Show only open balances. Default: false.'},
      {name:'sortBy',type:'String',req:false,location:'body',desc:'(v66.0) Field to sort by.'},
      {name:'sortingOrder',type:'String',req:false,location:'body',desc:'(v66.0) Ascending or Descending.'},
      {name:'transactionTypes',type:'String[]',req:false,location:'body',desc:'(v66.0) Transaction types to include.'},
    ],
    request:'{\n  "startDate": "2024-01-01"\n}',
    response:'{\n  "documentId": "{{DOCUMENT_ID}}",\n  "success": true\n}' },

  { id:'bill-36', category:'Billing', name:'Create Sequence Policy', methods:['POST'],
    path:'/connect/sequences/policy', version:'v65.0',
    desc:'Create a sequence policy for invoice or credit memo numbering.',
    page:2489,
    params:[
      {name:'name',type:'String',req:true,location:'body',desc:'(v65.0) Policy name.'},
      {name:'targetObject',type:'String',req:true,location:'body',desc:'(v65.0) Invoice or CreditMemo.'},
      {name:'sequenceMode',type:'String',req:true,location:'body',desc:'(v65.0) Basic or Gapless.'},
      {name:'sequencePattern',type:'String',req:true,location:'body',desc:'(v65.0) Pattern for sequence numbers.'},
      {name:'sequenceStartNumber',type:'Integer',req:true,location:'body',desc:'(v65.0) Starting number.'},
      {name:'incrementNumber',type:'Integer',req:true,location:'body',desc:'(v65.0) Increment value.'},
      {name:'isActive',type:'Boolean',req:true,location:'body',desc:'(v65.0) Whether policy is active.'},
      {name:'effectiveFromDateTime',type:'String',req:true,location:'body',desc:'(v65.0) Effective from date/time.'},
      {name:'filterCriteria',type:'Object',req:true,location:'body',desc:'(v65.0) Filter criteria for applying the policy.'},
      {name:'dateStampFormat',type:'String',req:true,location:'body',desc:'(v65.0) Date stamp format in pattern.'},
    ],
    request:'{\n  "name": "InvoiceSeq",\n  "targetObject": "Invoice",\n  "sequenceMode": "Gapless",\n  "sequencePattern": "INV-{YYYY}-{0000}",\n  "sequenceStartNumber": 1,\n  "incrementNumber": 1,\n  "isActive": true,\n  "effectiveFromDateTime": "2024-01-01T00:00:00Z",\n  "filterCriteria": {},\n  "dateStampFormat": "YYYY"\n}',
    response:'{\n  "sequencePolicyId": "{{SEQUENCE_POLICY_ID}}",\n  "success": true\n}' },

  { id:'bill-37', category:'Billing', name:'Update Sequence Policy', methods:['PATCH'],
    path:'/connect/sequences/policy/{sequencePolicyId}', version:'v65.0',
    desc:'Update an existing sequence policy.',
    page:2489,
    params:[
      {name:'sequencePolicyId',type:'String',req:true,location:'path',desc:'(v65.0) Sequence policy ID.'},
      {name:'isActive',type:'Boolean',req:false,location:'body',desc:'(v65.0) Enable or disable the policy.'},
    ],
    request:'{\n  "isActive": false\n}',
    response:'{\n  "success": true\n}' },

  { id:'bill-38', category:'Billing', name:'Sequence Assignment', methods:['POST'],
    path:'/connect/sequences/actions/assign', version:'v65.0',
    desc:'Assign a sequence policy to records.',
    page:2489,
    params:[
      {name:'recordIds',type:'String[]',req:true,location:'body',desc:'(v65.0) Record IDs to assign sequence to.'},
      {name:'sequencePolicyId',type:'String',req:true,location:'body',desc:'(v65.0) Sequence policy ID to assign.'},
    ],
    request:'{\n  "recordIds": ["{{INVOICE_ID}}"],\n  "sequencePolicyId": "{{SEQUENCE_POLICY_ID}}"\n}',
    response:'{\n  "success": true\n}' },

  { id:'bill-39', category:'Billing', name:'Create Standalone Billing Schedules', methods:['POST'],
    path:'/commerce/invoicing/standalone/billing-schedules/actions/create', version:'v64.0',
    desc:'Create standalone billing schedules not tied to an order.',
    page:2489,
    params:[
      {name:'billingSchedules',type:'Object[]',req:true,location:'body',desc:'(v64.0) Billing schedule data to create.'},
    ],
    request:'{\n  "billingSchedules": [\n    {\n      "accountId": "{{ACCOUNT_ID}}",\n      "billingDay": 1,\n      "billingFrequency": "Monthly",\n      "startDate": "2024-07-01",\n      "endDate": "2025-06-30",\n      "amount": 150.00,\n      "currencyIsoCode": "USD"\n    }\n  ]\n}',
    response:'{\n  "billingScheduleIds": ["44bSG00000001AAAA"],\n  "success": true\n}' },

  // Billing — invocable actions
  { id:'bill-act-1', category:'Billing', name:'Recover Billing Schedules', methods:['POST'],
    path:'/services/data/v67.0/actions/standard/recoverBillingSchedules', version:'v62.0',
    desc:'Recover a billing schedule in Error or Processing status. One schedule per invocation input (singular).',
    page:2489,
    params:[
      {name:'billingScheduleId',type:'String',req:true,location:'body',desc:'(v62.0) Single billing schedule ID to recover (singular, not an array).'},
    ],
    request:'{\n  "inputs": [\n    {\n      "billingScheduleId": "{{BILLING_SCHEDULE_ID}}"\n    }\n  ]\n}',
    response:'[\n  {\n    "actionName": "recoverBillingSchedules",\n    "errors": null,\n    "isSuccess": true,\n    "outputValues": {\n      "successBillingScheduleIds": ["{{BILLING_SCHEDULE_ID}}"]\n    }\n  }\n]' },

  { id:'bill-act-2', category:'Billing', name:'Send Dunning Email', methods:['POST'],
    path:'/services/data/v67.0/actions/standard/blngSendDunningEmail', version:'v63.0',
    desc:'Send a dunning email for overdue invoices. Note: the action name prefix is blng (not bing). Verify the exact action name in your org before use.',
    page:2489,
    params:[
      {name:'invoiceId',type:'String',req:true,location:'body',desc:'(v63.0) Invoice ID to send dunning email for.'},
    ],
    request:'{\n  "inputs": [\n    {\n      "invoiceId": "{{INVOICE_ID}}"\n    }\n  ]\n}',
    response:'[\n  {\n    "actionName": "blngSendDunningEmail",\n    "errors": null,\n    "isSuccess": true,\n    "outputValues": {}\n  }\n]' },

  { id:'bill-act-3', category:'Billing', name:'Suspend Billing Action', methods:['POST'],
    path:'/services/data/v67.0/actions/standard/blngSvcSuspendBilling', version:'v63.0',
    desc:'Suspend billing for an account via invocable action. Takes accountId and suspensionDate as required inputs.',
    page:2489,
    params:[
      {name:'accountId',type:'String',req:true,location:'body',desc:'(v63.0) Account ID to suspend billing for.'},
      {name:'suspensionDate',type:'String',req:true,location:'body',desc:'(v63.0) Date to suspend billing (ISO 8601).'},
      {name:'resumptionDate',type:'String',req:false,location:'body',desc:'(v63.0) Optional date to automatically resume billing (ISO 8601).'},
    ],
    request:'{\n  "inputs": [\n    {\n      "accountId": "{{ACCOUNT_ID}}",\n      "suspensionDate": "2024-08-01"\n    }\n  ]\n}',
    response:'[\n  {\n    "actionName": "blngSvcSuspendBilling",\n    "errors": null,\n    "isSuccess": true,\n    "outputValues": {}\n  }\n]' },

  { id:'bill-act-4', category:'Billing', name:'Update Bill To Contact', methods:['POST'],
    path:'/services/data/v67.0/actions/standard/blngSvcUpdateBillToContact', version:'v63.0',
    desc:'Update the bill-to contact on an invoice via invocable action.',
    page:2489,
    params:[
      {name:'invoiceId',type:'String',req:true,location:'body',desc:'(v63.0) Invoice ID to update the bill-to contact on.'},
      {name:'newBillToContactId',type:'String',req:true,location:'body',desc:'(v63.0) ID of the new bill-to contact.'},
      {name:'setAsDefault',type:'Boolean',req:false,location:'body',desc:'(v63.0) Whether to set the contact as the default bill-to contact.'},
    ],
    request:'{\n  "inputs": [\n    {\n      "invoiceId": "{{INVOICE_ID}}",\n      "newBillToContactId": "{{CONTACT_ID}}"\n    }\n  ]\n}',
    response:'[\n  {\n    "actionName": "blngSvcUpdateBillToContact",\n    "errors": null,\n    "isSuccess": true,\n    "outputValues": {}\n  }\n]' },

  { id:'bill-act-5', category:'Billing', name:'Unapply Credit', methods:['POST'],
    path:'/services/data/v67.0/actions/standard/unapplyCredit', version:'v62.0',
    desc:'Unapply a credit memo from an invoice via invocable action. Pass the CreditMemoInvApplication junction record ID (not the raw credit memo or invoice IDs).',
    page:2489,
    params:[
      {name:'recordId',type:'String',req:true,location:'body',desc:'(v62.0) ID of the CreditMemoInvApplication junction record to unapply (not the credit memo or invoice ID directly).'},
      {name:'description',type:'String',req:false,location:'body',desc:'(v62.0) Optional description.'},
      {name:'effectiveDate',type:'String',req:false,location:'body',desc:'(v62.0) Effective date of the unapply operation.'},
    ],
    request:'{\n  "inputs": [\n    {\n      "recordId": "{{CREDIT_MEMO_INV_APPLICATION_ID}}"\n    }\n  ]\n}',
    response:'[\n  {\n    "actionName": "unapplyCredit",\n    "errors": null,\n    "isSuccess": true,\n    "outputValues": {\n      "recordId": "{{CREDIT_MEMO_INV_APPLICATION_ID}}"\n    }\n  }\n]' },

  { id:'bill-act-6', category:'Billing', name:'Unapply Payment', methods:['POST'],
    path:'/services/data/v67.0/actions/standard/unapplyPayment', version:'v64.0',
    desc:'Unapply a payment from invoice lines via invocable action. Pass the PaymentLineInvoice junction record ID (type=Applied), not the payment or invoice IDs directly.',
    page:2489,
    params:[
      {name:'recordId',type:'String',req:true,location:'body',desc:'(v64.0) ID of the PaymentLineInvoice or PaymentLineInvoiceLine junction record to unapply (must have type=Applied).'},
      {name:'description',type:'String',req:false,location:'body',desc:'(v64.0) Optional description.'},
      {name:'effectiveDateTime',type:'String',req:false,location:'body',desc:'(v64.0) Effective datetime of the unapply operation (ISO 8601).'},
    ],
    request:'{\n  "inputs": [\n    {\n      "recordId": "{{PAYMENT_LINE_INVOICE_ID}}"\n    }\n  ]\n}',
    response:'[\n  {\n    "actionName": "unapplyPayment",\n    "errors": null,\n    "isSuccess": true,\n    "outputValues": {\n      "recordId": "{{PAYMENT_LINE_INVOICE_ID}}",\n      "unappliedDateTime": "2024-07-09T10:00:00Z"\n    }\n  }\n]' },

  { id:'bill-act-7', category:'Billing', name:'Void Posted Credit Memo Action', methods:['POST'],
    path:'/services/data/v67.0/actions/standard/voidPostedCreditMemo', version:'v66.0',
    desc:'Void a posted credit memo via invocable action.',
    page:2489,
    params:[
      {name:'creditMemoId',type:'String',req:true,location:'body',desc:'(v66.0) Credit memo ID to void.'},
    ],
    request:'{\n  "inputs": [\n    {\n      "creditMemoId": "{{CREDIT_MEMO_ID}}"\n    }\n  ]\n}',
    response:'[\n  {\n    "actionName": "voidPostedCreditMemo",\n    "errors": null,\n    "isSuccess": true,\n    "outputValues": {\n      "creditMemoId": "{{CREDIT_MEMO_ID}}"\n    }\n  }\n]' },

  { id:'bill-act-8', category:'Billing', name:'Write Off Invoices', methods:['POST'],
    path:'/services/data/v67.0/actions/standard/writeOffInvoices', version:'v64.0',
    desc:'Write off invoices via invocable action.',
    page:2489,
    params:[
      {name:'invoiceIds',type:'String[]',req:true,location:'body',desc:'(v64.0) Invoice IDs to write off.'},
    ],
    request:'{\n  "inputs": [\n    {\n      "invoiceIds": ["{{INVOICE_ID}}"]\n    }\n  ]\n}',
    response:'[\n  {\n    "actionName": "writeOffInvoices",\n    "errors": null,\n    "isSuccess": true,\n    "outputValues": {}\n  }\n]' },

  { id:'bill-docgen-1', category:'Billing', name:'Batch Invoice Document Generation', methods:['POST'],
    path:'/commerce/billing/invoices/invoice-batch-docgen/{invoiceBatchRunId}/actions/{actionName}', version:'v63.0',
    desc:'Asynchronously generate PDF documents for invoices in Draft or Posted status associated with an invoice batch run record. Requires Document Generation for Billing enabled. actionName: use "run" to generate, or "retry" to regenerate failed invoices.',
    page:1381,
    params:[
      {name:'invoiceBatchRunId',type:'String',req:true,location:'path',desc:'(v63.0) ID of the invoice batch run record that created the Draft or Posted invoices.'},
      {name:'actionName',type:'String',req:true,location:'path',desc:'(v63.0) Name of the action to perform. Valid values: run (generate documents), retry (regenerate previously failed documents).'},
    ],
    request:'No request body.',
    response:'{\n  "requestIdentifier": "5IRDU000000009i4AA",\n  "success": true,\n  "errors": []\n}' },
];
