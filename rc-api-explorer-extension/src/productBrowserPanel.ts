import * as vscode from 'vscode';
import { listOrgs, callApi, preWarmToken, OrgInfo } from './lib/orgAuth';

const API_VERSION     = 'v67.0';
const CFG_VERSION     = 'v66.0';
const PCM_VERSION     = 'v66.0';
const TXN_VERSION     = 'v63.0';

export class ProductBrowserPanel {
  private static instance: ProductBrowserPanel | undefined;

  private panel: vscode.WebviewPanel;
  private orgs: OrgInfo[] = [];
  private outputChannel: vscode.OutputChannel;

  static createOrShow(context: vscode.ExtensionContext): void {  // eslint-disable-line
    if (ProductBrowserPanel.instance) {
      ProductBrowserPanel.instance.panel.reveal();
      return;
    }
    ProductBrowserPanel.instance = new ProductBrowserPanel(context, () => {
      ProductBrowserPanel.instance = undefined;
    });
  }

  constructor(
    private context: vscode.ExtensionContext,
    private onDispose: () => void,
  ) {
    this.outputChannel = vscode.window.createOutputChannel('RC Product Browser');

    this.panel = vscode.window.createWebviewPanel(
      'rcProductBrowser',
      'Revenue Cloud Product Browser',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
      }
    );

    this.panel.webview.onDidReceiveMessage(
      (msg) => this.handleMessage(msg),
      undefined,
      context.subscriptions,
    );

    this.panel.onDidDispose(() => {
      this.outputChannel.dispose();
      this.onDispose();
    });

    this.panel.webview.html = this.buildHtml();
  }

  reveal(): void { this.panel.reveal(); }

  private post(msg: any): void {
    this.panel.webview.postMessage(msg);
  }

  private postApiCall(method: string, path: string, version: string, requestBody: string | null, r: { status: number; body: string }): void {
    this.post({ type: 'apiCall', method, path, version, requestBody, status: r.status, responseBody: r.body, ts: Date.now() });
  }

  private sfPath(version: string, path: string): string {
    return `/services/data/${version}${path}`;
  }

  private async handleMessage(msg: any): Promise<void> {
    this.outputChannel.appendLine(`[PB] ${msg.type}`);
    switch (msg.type) {

      case 'ready': {
        try { this.orgs = await listOrgs(); } catch { this.orgs = []; }
        this.post({ type: 'init', orgs: this.orgs });
        break;
      }

      case 'selectOrg': {
        const alive = await preWarmToken(msg.orgAlias);
        if (!alive) { this.post({ type: 'sessionExpired', orgAlias: msg.orgAlias }); }
        else        { this.post({ type: 'orgSelected', orgAlias: msg.orgAlias }); }
        break;
      }

      case 'getCatalogs': {
        const catalogBody = JSON.stringify({ pageSize: 100, offset: 0 });
        const catalogPath = this.sfPath(PCM_VERSION, '/connect/pcm/catalogs');
        const r = await callApi(msg.orgAlias, 'POST', catalogPath, catalogBody);
        this.post({ type: 'catalogs', status: r.status, body: r.body });
        this.postApiCall('POST', catalogPath, PCM_VERSION, catalogBody, r);
        break;
      }

      case 'getCategories': {
        const catPath = this.sfPath(PCM_VERSION, `/connect/pcm/catalogs/${msg.catalogId}/categories?depth=2`);
        const r = await callApi(msg.orgAlias, 'GET', catPath);
        this.post({ type: 'categories', catalogId: msg.catalogId, status: r.status, body: r.body });
        this.postApiCall('GET', catPath, PCM_VERSION, null, r);
        break;
      }

      case 'getPricebooks': {
        const pbPath = this.sfPath(API_VERSION, `/query?q=${encodeURIComponent("SELECT Id, Name, IsStandard FROM Pricebook2 WHERE IsActive=true ORDER BY IsStandard DESC, Name ASC LIMIT 50")}`);
        const r = await callApi(msg.orgAlias, 'GET', pbPath);
        this.post({ type: 'pricebooks', status: r.status, body: r.body });
        this.postApiCall('GET', pbPath, API_VERSION, null, r);
        break;
      }

      case 'getPricebookEntries': {
        const q = `SELECT Id, Product2Id, UnitPrice, CurrencyIsoCode FROM PricebookEntry WHERE Pricebook2Id='${msg.pricebookId}' AND IsActive=true`;
        const pbeFirstPath = this.sfPath(API_VERSION, `/query?q=${encodeURIComponent(q)}`);
        let allRecords: any[] = [];
        let nextUrl: string | null = pbeFirstPath;
        let status = 200; let pageNum = 0;
        while (nextUrl) {
          const r = await callApi(msg.orgAlias, 'GET', nextUrl);
          status = r.status;
          if (pageNum === 0) { this.postApiCall('GET', nextUrl, API_VERSION, null, r); }
          if (r.status >= 300) { nextUrl = null; break; }
          let page: any;
          try { page = JSON.parse(r.body); } catch { nextUrl = null; break; }
          allRecords = allRecords.concat(page.records || []);
          nextUrl = page.nextRecordsUrl
            ? this.sfPath(API_VERSION, page.nextRecordsUrl.replace(/\/services\/data\/v[\d.]+/, ''))
            : null;
          pageNum++;
        }
        this.post({
          type: 'pricebookEntries', pricebookId: msg.pricebookId, status,
          body: JSON.stringify({ records: allRecords, totalSize: allRecords.length }),
        });
        break;
      }

      case 'getProducts': {
        const payload: any = {
          pageSize: msg.pageSize ?? 20,
          offset: msg.offset ?? 0,
          additionalFields: { Product2: { fields: ['ProductCode'] } },
        };
        if (msg.categoryId)     { payload.categoryIds  = [msg.categoryId]; }
        else if (msg.catalogId) { payload.catalogIds   = [msg.catalogId]; }
        if (msg.searchTerm)     { payload.searchTerm   = msg.searchTerm; }
        const prodBody = JSON.stringify(payload);
        const prodPath = this.sfPath(PCM_VERSION, '/connect/pcm/products');
        const r = await callApi(msg.orgAlias, 'POST', prodPath, prodBody);
        this.post({ type: 'products', offset: msg.offset ?? 0, status: r.status, body: r.body });
        this.postApiCall('POST', prodPath, PCM_VERSION, prodBody, r);
        break;
      }

      case 'createQuote': {
        const { orgAlias, opportunityId, pricebookId, quoteName, currencyIsoCode, cart } = msg;
        const records: any[] = [
          {
            referenceId: 'refQuote',
            record: {
              attributes: { type: 'Quote', method: 'POST' },
              ...(opportunityId    ? { OpportunityId:   opportunityId }    : {}),
              ...(currencyIsoCode  ? { CurrencyIsoCode: currencyIsoCode }  : {}),
              Pricebook2Id: pricebookId,
              Name:         quoteName || `Product Browser Quote`,
            },
          },
          ...cart.map((item: any, i: number) => ({
            referenceId: `refQLI_${i}`,
            record: {
              attributes:       { type: 'QuoteLineItem', method: 'POST' },
              QuoteId:          '@{refQuote.id}',
              PricebookEntryId: item.pbeId,
              Product2Id:       item.productId,
              Quantity:         Number(item.quantity),
              UnitPrice:        0,
            },
          })),
        ];
        const cqBody = JSON.stringify({ graph: { graphId: 'productBrowserQuote', records } });
        const cqPath = this.sfPath(TXN_VERSION, '/connect/rev/sales-transaction/actions/place');
        const r = await callApi(orgAlias, 'POST', cqPath, cqBody);
        this.post({ type: 'quoteCreated', status: r.status, body: r.body });
        this.postApiCall('POST', cqPath, TXN_VERSION, cqBody, r);
        break;
      }

      case 'getProductDetail': {
        const pdPath = this.sfPath(PCM_VERSION, `/connect/pcm/products/${msg.productId}`);
        const r = await callApi(msg.orgAlias, 'GET', pdPath);
        this.post({ type: 'productDetail', productId: msg.productId, status: r.status, body: r.body });
        this.postApiCall('GET', pdPath, PCM_VERSION, null, r);
        break;
      }

      case 'getBmSubProduct': {
        const spPath = this.sfPath(PCM_VERSION, `/connect/pcm/products/${msg.compId}`);
        const sr = await callApi(msg.orgAlias, 'GET', spPath);
        this.post({ type: 'bmSubProductDetail', compId: msg.compId, status: sr.status, body: sr.body });
        this.postApiCall('GET', spPath, PCM_VERSION, null, sr);
        break;
      }

      case 'saveConfiguration': {
        // pstBody is pre-built by buildPstPayload() in product-browser.js
        const { orgAlias, pstBody } = msg;
        const pstPath = this.sfPath(TXN_VERSION, '/connect/rev/sales-transaction/actions/place');
        const pstBodyStr = JSON.stringify(pstBody);
        const pstR = await callApi(orgAlias, 'POST', pstPath, pstBodyStr);
        this.post({ type: 'cfgModalStep', step: 'place-sales-transaction', status: pstR.status, body: pstR.body });
        this.postApiCall('POST', pstPath, TXN_VERSION, pstBodyStr, pstR);
        break;
      }

      case 'loadConfigurator': {
        const { orgAlias, quoteId, cart } = msg;

        // Step 1 — load-instance
        const liPath = this.sfPath(CFG_VERSION, '/connect/cpq/configurator/actions/load-instance');
        const liBody = JSON.stringify({ transactionId: quoteId, configuratorOptions: { addDefaultConfiguration: true, executeConfigurationRules: true, executePricing: true, qualifyAllProductsInTransaction: true, validateAmendRenewCancel: false, validateProductCatalog: true, returnProductCatalogData: false }, qualificationContext: {} });
        const loadR = await callApi(orgAlias, 'POST', liPath, liBody);
        this.post({ type: 'cfgStep', step: 'load-instance', status: loadR.status, body: loadR.body });
        this.postApiCall('POST', liPath, CFG_VERSION, liBody, loadR);
        if (loadR.status >= 300) { break; }

        let contextId: string;
        try { contextId = JSON.parse(loadR.body).contextId; } catch { break; }
        if (!contextId) { this.post({ type: 'cfgError', error: 'No contextId returned from load-instance' }); break; }

        // Step 2 — add-nodes (one per cart item)
        const addedNodes = cart.map((item: any, i: number) => {
          const refId = `ref_node_${i}_${item.productId.slice(-6)}`;
          return { path: [quoteId, refId], addedObject: { id: refId, SalesTransactionItemSource: refId, SalesTransactionItemParent: quoteId, PricebookEntry: item.pbeId, Product: item.productId, Quantity: Number(item.quantity), UnitPrice: 0, businessObjectType: 'QuoteLineItem' } };
        });
        const anPath = this.sfPath(CFG_VERSION, '/connect/cpq/configurator/actions/add-nodes');
        const anBody = JSON.stringify({ contextId, configuratorOptions: { executePricing: true, returnProductCatalogData: false, qualifyAllProductsInTransaction: true, validateProductCatalog: true, validateAmendRenewCancel: false, executeConfigurationRules: true, addDefaultConfiguration: false }, qualificationContext: {}, addedNodes });
        const addR = await callApi(orgAlias, 'POST', anPath, anBody);
        this.post({ type: 'cfgStep', step: 'add-nodes', status: addR.status, body: addR.body });
        this.postApiCall('POST', anPath, CFG_VERSION, anBody, addR);
        if (addR.status >= 300) { break; }

        // Step 3 — get-instance
        const giPath = this.sfPath(CFG_VERSION, '/connect/cpq/configurator/actions/get-instance');
        const giBody = JSON.stringify({ contextId });
        const getR = await callApi(orgAlias, 'POST', giPath, giBody);
        this.post({ type: 'cfgStep', step: 'get-instance', status: getR.status, body: getR.body });
        this.postApiCall('POST', giPath, CFG_VERSION, giBody, getR);
        if (getR.status >= 300) { break; }

        // Step 4 — save-instance
        const siPath = this.sfPath(CFG_VERSION, '/connect/cpq/configurator/actions/save-instance');
        const siBody = JSON.stringify({ contextId });
        const saveR = await callApi(orgAlias, 'POST', siPath, siBody);
        this.post({ type: 'cfgStep', step: 'save-instance', status: saveR.status, body: saveR.body });
        this.postApiCall('POST', siPath, CFG_VERSION, siBody, saveR);
        break;
      }
    }
  }

  private buildHtml(): string {
    const scriptUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'product-browser.js')
    );
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Revenue Cloud Product Browser</title>
<style>
:root{--bg1:#1e1e2e;--bg2:#181825;--bg3:#313244;--fg1:#cdd6f4;--fg2:#a6adc8;--fg3:#585b70;--border:#45475a;--pri:#89b4fa;--grn:#a6e3a1;--red:#f38ba8;--amb:#f9e2af;--sky:#89dceb;--lav:#b4befe}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg1);color:var(--fg1);font:13px/1.5 'Segoe UI',system-ui,sans-serif;height:100vh;display:flex;flex-direction:column;overflow:hidden}
button{cursor:pointer;border:none;border-radius:4px;font:inherit;padding:5px 12px;transition:opacity .15s}
button:disabled{opacity:.4;cursor:not-allowed}
.btn-pri{background:var(--pri);color:var(--bg2)}
.btn-sec{background:var(--bg3);color:var(--fg1);border:1px solid var(--border)}
.btn-grn{background:var(--grn);color:var(--bg2)}
.btn-amb{background:var(--amb);color:var(--bg2)}
input,select{background:var(--bg3);color:var(--fg1);border:1px solid var(--border);border-radius:4px;padding:5px 8px;font:inherit;width:100%}
input:focus,select:focus{outline:1px solid var(--pri)}
/* Header */
#header{background:var(--bg2);border-bottom:1px solid var(--border);padding:8px 12px;display:flex;gap:8px;align-items:center;flex-shrink:0}
#header select{width:220px}
#header .org-status{font-size:11px;color:var(--fg2)}
/* Body */
#body{flex:1;display:flex;overflow:hidden}
/* Left — catalog tree */
#left{width:220px;min-width:160px;border-right:1px solid var(--border);overflow-y:auto;flex-shrink:0;background:var(--bg2);padding:6px 0}
.tree-section{font-size:11px;color:var(--fg3);padding:6px 10px 2px;text-transform:uppercase;letter-spacing:.06em}
.tree-item{padding:5px 10px 5px 12px;cursor:pointer;display:flex;align-items:center;gap:6px;font-size:12px;color:var(--fg2)}
.tree-item:hover{background:var(--bg3);color:var(--fg1)}
.tree-item.active{background:var(--bg3);color:var(--pri)}
.tree-item .caret{font-size:9px;color:var(--fg3);width:10px;flex-shrink:0}
.tree-cat{padding-left:22px;font-size:11px}
.tree-cat.active{color:var(--pri)}
/* Center — product grid */
#center{flex:1;display:flex;flex-direction:column;overflow:hidden;padding:10px}
#search-bar{display:flex;gap:6px;margin-bottom:8px;align-items:center}
#search-bar input{flex:1}
#products-grid{flex:1;overflow-y:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;align-content:start}
.prod-card{background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:10px;display:flex;flex-direction:column;gap:6px}
.prod-card:hover{border-color:var(--pri)}
.prod-card.in-cart{border-color:var(--grn)}
.prod-name{font-size:12px;font-weight:600;color:var(--fg1);line-height:1.3}
.prod-code{font-size:11px;color:var(--fg3)}
.prod-desc{font-size:11px;color:var(--fg2);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.prod-badges{display:flex;gap:4px;flex-wrap:wrap}
.badge{font-size:10px;padding:1px 5px;border-radius:3px;background:var(--bg3)}
.badge.active{background:#a6e3a120;color:var(--grn)}
.badge.bundle{background:#89b4fa20;color:var(--pri)}
.prod-card button{font-size:11px;padding:4px 8px;margin-top:auto}
#load-more{margin-top:8px;align-self:center}
.empty-hint{color:var(--fg3);font-size:12px;padding:20px;grid-column:1/-1;text-align:center}
/* Right — quote builder */
#right{width:280px;min-width:240px;border-left:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden;background:var(--bg2);flex-shrink:0}
#right-header{padding:8px 10px;border-bottom:1px solid var(--border);font-size:12px;font-weight:600;color:var(--fg2)}
#quote-form{padding:8px 10px;display:flex;flex-direction:column;gap:6px;border-bottom:1px solid var(--border)}
.form-row label{font-size:11px;color:var(--fg3);display:block;margin-bottom:2px}
#cart-items{flex:1;overflow-y:auto;padding:6px 10px;display:flex;flex-direction:column;gap:6px}
.cart-item{background:var(--bg3);border-radius:5px;padding:7px 8px;position:relative}
.cart-name{font-size:11px;font-weight:600;color:var(--fg1);margin-bottom:4px;padding-right:16px}
.cart-fields{display:grid;grid-template-columns:1fr 60px;gap:4px 6px}
.cart-fields label{font-size:10px;color:var(--fg3);display:block;margin-bottom:1px}
.cart-del{position:absolute;top:5px;right:5px;background:none;color:var(--red);font-size:13px;padding:0 2px}
.cart-del:hover{color:#fff}
.cart-empty{color:var(--fg3);font-size:12px;text-align:center;padding:16px}
#right-actions{padding:8px 10px;display:flex;flex-direction:column;gap:6px;border-top:1px solid var(--border)}
/* Bottom panel — Log + API Inspector */
#bottom-panel{height:260px;min-height:80px;max-height:80vh;border-top:1px solid var(--border);background:var(--bg2);display:flex;flex-direction:column;flex-shrink:0}
#bp-resize-handle{height:5px;cursor:ns-resize;background:transparent;flex-shrink:0;border-top:2px solid var(--border)}
#bp-resize-handle:hover{background:var(--acc)}
.bp-tab-bar{display:flex;align-items:center;gap:2px;padding:2px 6px;border-bottom:1px solid var(--border);flex-shrink:0}
.bp-tab{background:none;color:var(--fg3);font-size:11px;padding:2px 10px;border-radius:4px;border:none;cursor:pointer;position:relative}
.bp-tab:hover{color:var(--fg1)}
.bp-tab.active{color:var(--fg1);font-weight:600;background:var(--bg3)}
.bp-tab .bp-badge{position:absolute;top:1px;right:2px;width:5px;height:5px;border-radius:50%;background:var(--amb);display:none}
.bp-tab .bp-badge.show{display:block}
#bp-log{flex:1;overflow-y:auto;padding:3px 8px}
.log-line{font-size:11px;font-family:monospace;padding:1px 0;white-space:pre-wrap;word-break:break-all}
.log-info{color:var(--fg2)}.log-ok{color:var(--grn)}.log-err{color:var(--red)}.log-warn{color:var(--amb)}
/* API Inspector */
#bp-inspector{flex:1;display:none;overflow:hidden;flex-direction:row}
#bp-inspector.active{display:flex}
#insp-list{width:230px;min-width:180px;border-right:1px solid var(--border);overflow-y:auto;flex-shrink:0}
.insp-row{display:flex;align-items:center;gap:5px;padding:3px 7px;cursor:pointer;font-size:11px;border-bottom:1px solid var(--border)33}
.insp-row:hover{background:var(--bg3)}
.insp-row.selected{background:var(--bg3);border-left:2px solid var(--pri)}
.insp-method{font-size:10px;font-weight:700;padding:1px 4px;border-radius:3px;flex-shrink:0;min-width:30px;text-align:center}
.insp-method.get{background:#a6e3a120;color:var(--grn)}
.insp-method.post{background:#89b4fa20;color:var(--pri)}
.insp-method.patch{background:#f9e2af20;color:var(--amb)}
.insp-method.delete{background:#f38ba820;color:var(--red)}
.insp-path{flex:1;color:var(--fg2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:monospace}
.insp-status{font-size:10px;font-weight:600;flex-shrink:0;padding:1px 5px;border-radius:3px}
.insp-status.ok{background:#a6e3a115;color:var(--grn)}
.insp-status.err{background:#f38ba815;color:var(--red)}
.insp-status.pend{color:var(--fg3)}
#insp-detail{flex:1;display:flex;flex-direction:column;overflow:hidden}
.insp-detail-header{font-size:10px;color:var(--fg3);padding:3px 8px;border-bottom:1px solid var(--border);flex-shrink:0;font-family:monospace;display:flex;gap:8px;align-items:center}
.insp-detail-header .insp-full-path{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--fg2)}
.insp-panes{flex:1;display:flex;overflow:hidden}
.insp-pane{flex:1;display:flex;flex-direction:column;overflow:hidden;border-right:1px solid var(--border)}
.insp-pane:last-child{border-right:none}
.insp-pane-label{font-size:10px;color:var(--fg3);padding:2px 8px;border-bottom:1px solid var(--border);flex-shrink:0;text-transform:uppercase;letter-spacing:.05em;display:flex;justify-content:space-between;align-items:center}
.insp-pane-copy{font-size:10px;background:none;color:var(--fg3);padding:0 4px;border:none;cursor:pointer}
.insp-pane-copy:hover{color:var(--fg1)}
.insp-pane pre{flex:1;overflow-y:auto;padding:6px 8px;margin:0;font-size:10.5px;font-family:monospace;white-space:pre-wrap;word-break:break-all;color:var(--fg2);background:none}
.insp-empty{color:var(--fg3);font-size:11px;padding:12px;text-align:center}
/* Gear button */
.btn-gear{background:none;color:var(--fg3);font-size:13px;padding:2px 5px;line-height:1;border:1px solid transparent;border-radius:3px;flex-shrink:0}
.btn-gear:hover{color:var(--pri);border-color:var(--border)}
.prod-card-actions{display:flex;gap:4px;margin-top:auto;align-items:center}
.prod-card-actions .btn-pri,.prod-card-actions .btn-sec{flex:1;font-size:11px;padding:4px 8px}
/* Bundle Modal */
#bundle-modal{display:none;position:fixed;inset:0;background:#0009;z-index:200;align-items:center;justify-content:center}
#bundle-modal.visible{display:flex}
#bundle-box{background:var(--bg2);border:1px solid var(--border);border-radius:8px;width:620px;max-height:88vh;display:flex;flex-direction:column}
#bundle-box header{padding:10px 14px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-shrink:0}
#bundle-box header h3{font-size:13px;font-weight:700;color:var(--fg1)}
#bundle-box header .sub{font-size:11px;color:var(--fg3);margin-top:1px}
#bm-tab-area{flex:1;overflow:hidden;display:flex;flex-direction:column;min-height:0}
#bundle-body{flex:1;overflow-y:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px}
#bundle-footer{padding:10px 14px;border-top:1px solid var(--border);display:flex;gap:8px;align-items:center;flex-shrink:0}
#bundle-footer .cfg-fields{display:flex;gap:6px;flex:1}
#bundle-footer .cfg-fields input{flex:1;font-size:11px}
.pcg-group{background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:10px}
.pcg-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.pcg-name{font-size:12px;font-weight:700;color:var(--fg1)}
.pcg-meta{font-size:10px;color:var(--fg3)}
.pcg-meta.warn{color:var(--amb)}
.pcg-err{font-size:11px;color:var(--red);margin-top:4px;display:none}
.comp-row{display:flex;align-items:center;gap:8px;padding:4px 6px;border-radius:4px;cursor:pointer}
.comp-row:hover{background:var(--bg2)}
.comp-row input[type=checkbox]{width:13px;height:13px;accent-color:var(--pri);cursor:pointer;flex-shrink:0}
.comp-row input[type=checkbox]:disabled{cursor:not-allowed;opacity:.5}
.comp-info{flex:1}
.comp-info .comp-name{font-size:12px;color:var(--fg2)}
.comp-info .comp-code{font-size:10px;color:var(--fg3)}
.comp-tags{display:flex;gap:3px;flex-shrink:0}
.ctag{font-size:9px;padding:1px 5px;border-radius:3px;font-weight:600}
.ctag.req{background:#f38ba822;color:var(--red)}
.ctag.def{background:#89b4fa22;color:var(--pri)}
.ctag.inc{background:#a6e3a122;color:var(--grn)}
.ctag.ext{background:#f9e2af22;color:var(--amb)}
.attr-group{background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:10px}
.attr-group-name{font-size:11px;font-weight:700;color:var(--fg3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px}
.attr-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.attr-field label{font-size:10px;color:var(--fg3);margin-bottom:2px;display:block}
.attr-field select,.attr-field input[type=text]{width:100%;font-size:11px}
.sm-group{background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:10px}
.sm-group-name{font-size:11px;font-weight:700;color:var(--fg3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px}
.sm-row{display:flex;align-items:center;gap:8px;padding:3px 6px;border-radius:4px;cursor:pointer}
.sm-row:hover{background:var(--bg2)}
.sm-row input[type=radio]{accent-color:var(--pri);width:13px;height:13px;cursor:pointer}
.sm-label{flex:1;font-size:12px;color:var(--fg2)}
.sm-meta{font-size:10px;color:var(--fg3);display:block}
.sm-def{font-size:9px;padding:1px 5px;border-radius:3px;background:#89b4fa22;color:var(--pri)}
/* Step progress in modal footer */
.cfg-steps{display:flex;gap:10px;margin-right:auto}
.cfg-step{display:flex;align-items:center;gap:4px;font-size:11px;color:var(--fg3)}
.cfg-step .dot{width:7px;height:7px;border-radius:50%;background:var(--fg3);flex-shrink:0}
.cfg-step .dot.ok{background:var(--grn)}
.cfg-step .dot.err{background:var(--red)}
.cfg-step .dot.run{background:var(--amb);animation:spin .8s linear infinite}
/* Bundle modal tabs */
.bm-tabs{display:flex;gap:2px;background:var(--bg3);border-radius:5px;padding:2px}
.bm-tab{background:none;color:var(--fg3);font-size:11px;padding:3px 10px;border-radius:4px;border:none;cursor:pointer;transition:background .15s,color .15s}
.bm-tab:hover{color:var(--fg1)}
.bm-tab.active{background:var(--bg2);color:var(--fg1);font-weight:600}
.bm-tab-pane{flex:1;overflow:hidden;min-height:0;display:flex;flex-direction:column}
/* Payload preview */
#bm-payload-panel{display:flex;flex-direction:column;height:100%;padding:10px 14px;gap:8px}
.payload-endpoint{display:flex;align-items:center;gap:8px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:7px 10px;flex-shrink:0}
.payload-method{font-size:11px;font-weight:700;background:#89b4fa33;color:var(--pri);padding:2px 7px;border-radius:4px}
.payload-path{font-size:11px;font-family:monospace;color:var(--fg1)}
.payload-ver{font-size:10px;color:var(--fg3);background:var(--bg2);padding:1px 6px;border-radius:3px}
.payload-desc{font-size:11px;color:var(--fg3);flex-shrink:0}
.payload-json{flex:1;overflow-y:auto;margin:0;font-size:11px;font-family:monospace;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:10px;color:var(--fg2);white-space:pre-wrap;word-break:break-all;min-height:0}
/* Spinner */
@keyframes spin{to{transform:rotate(360deg)}}
.spinner{display:inline-block;width:12px;height:12px;border:2px solid var(--border);border-top-color:var(--pri);border-radius:50%;animation:spin .6s linear infinite;vertical-align:middle}
/* Result overlay */
#result-overlay{display:none;position:fixed;inset:0;background:#0008;z-index:100;align-items:center;justify-content:center}
#result-overlay.visible{display:flex}
#result-box{background:var(--bg2);border:1px solid var(--border);border-radius:8px;width:560px;max-height:80vh;display:flex;flex-direction:column}
#result-box header{padding:10px 14px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;font-size:13px;font-weight:600}
#result-body{flex:1;overflow-y:auto;padding:10px 14px;font-size:12px;font-family:monospace;white-space:pre-wrap;word-break:break-all}
#result-box footer{padding:8px 14px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:6px}
</style>
</head>
<body>
<!-- Header -->
<div id="header">
  <select id="org-select" onchange="onOrgChange()">
    <option value="">— Select org —</option>
  </select>
  <button class="btn-pri" onclick="onConnect()">Connect</button>
  <span id="org-status" class="org-status"></span>
</div>

<!-- Body -->
<div id="body">
  <!-- Left: Catalog Tree -->
  <div id="left">
    <div class="tree-section">Catalogs</div>
    <div id="catalog-tree"><div style="padding:10px;font-size:11px;color:var(--fg3)">Connect to an org to browse</div></div>
  </div>

  <!-- Center: Product Grid -->
  <div id="center">
    <div id="search-bar">
      <input id="search-input" type="text" placeholder="Search products…" oninput="onSearch()" disabled>
      <label style="font-size:11px;color:var(--fg2);white-space:nowrap;display:flex;align-items:center;gap:4px">
        <input type="checkbox" id="active-only" checked onchange="onSearch()" style="width:auto"> Active
      </label>
    </div>
    <div id="products-grid"><div class="empty-hint">Select a catalog or category to browse products</div></div>
    <button id="load-more" class="btn-sec" style="display:none" onclick="onLoadMore()">Load more</button>
  </div>

  <!-- Right: Quote Builder -->
  <div id="right">
    <div id="right-header">Quote Builder <span id="cart-count" style="color:var(--fg3)"></span></div>
    <div id="quote-form">
      <div class="form-row"><label>Opportunity ID <span style="color:var(--fg3)">(optional)</span></label><input id="opp-id" type="text" placeholder="006…"></div>
      <div class="form-row">
        <label>Pricebook *</label>
        <div style="display:flex;gap:4px;align-items:center">
          <select id="pb-select" onchange="onPricebookChange()" style="flex:1" disabled>
            <option value="">— connect org first —</option>
          </select>
          <span id="pbe-status" style="font-size:10px;color:var(--fg3);white-space:nowrap"></span>
        </div>
        <input id="pb-id" type="hidden">
      </div>
      <div class="form-row"><label>Quote Name</label><input id="q-name" type="text" placeholder="(auto-generated)"></div>
    </div>
    <div id="cart-items"><div class="cart-empty">No products selected</div></div>
    <div id="right-actions">
      <button class="btn-grn" id="btn-create-quote" onclick="onCreateQuote()" disabled>Create Quote</button>
      <button class="btn-amb" id="btn-load-cfg" onclick="onLoadConfigurator()" disabled>Load Configurator</button>
    </div>
  </div>
</div>

<!-- Bottom panel: Log + API Inspector -->
<div id="bp-resize-handle" onmousedown="startBpResize(event)"></div>
<div id="bottom-panel">
  <div class="bp-tab-bar">
    <button class="bp-tab active" id="bpt-log" onclick="switchBpTab('log')">Log</button>
    <button class="bp-tab" id="bpt-inspector" onclick="switchBpTab('inspector')">API Inspector <span class="bp-badge" id="insp-badge"></span></button>
  </div>
  <div id="bp-log"></div>
  <div id="bp-inspector">
    <div id="insp-list"><div class="insp-empty">No API calls yet</div></div>
    <div id="insp-detail">
      <div class="insp-detail-header"><span id="insp-full-path" class="insp-full-path">Select a call to inspect</span></div>
      <div class="insp-panes">
        <div class="insp-pane">
          <div class="insp-pane-label">Request <button class="insp-pane-copy" onclick="copyInspPane('req')">copy</button></div>
          <pre id="insp-req-body">(none)</pre>
        </div>
        <div class="insp-pane">
          <div class="insp-pane-label">Response <button class="insp-pane-copy" onclick="copyInspPane('res')">copy</button></div>
          <pre id="insp-res-body">(none)</pre>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Bundle Configurator Modal -->
<div id="bundle-modal" onclick="if(event.target===this)closeBundleModal()">
  <div id="bundle-box">
    <header>
      <div>
        <h3 id="bm-title">Configure Bundle</h3>
        <div class="sub" id="bm-sub"></div>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <div class="bm-tabs">
          <button class="bm-tab active" id="bmt-configure" onclick="switchBmTab('configure')">Configure</button>
          <button class="bm-tab" id="bmt-payload" onclick="switchBmTab('payload')">Payload Preview</button>
        </div>
        <button class="btn-sec" onclick="closeBundleModal()" style="padding:2px 8px">✕</button>
      </div>
    </header>
    <!-- Tab content area — must be flex:1 to fill between header and footer -->
    <div id="bm-tab-area">
      <!-- Configure tab -->
      <div id="bm-tab-configure" class="bm-tab-pane">
        <div id="bundle-body"><div class="empty-hint"><span class="spinner"></span> Loading…</div></div>
      </div>
      <!-- Payload Preview tab -->
      <div id="bm-tab-payload" class="bm-tab-pane" style="display:none">
        <div id="bm-payload-panel">
          <div class="payload-endpoint">
            <span class="payload-method">POST</span>
            <span class="payload-path" id="bm-payload-path">/connect/rev/sales-transaction/actions/place</span>
            <span class="payload-ver" id="bm-payload-ver">v63.0</span>
            <button class="btn-sec" style="margin-left:auto;font-size:10px;padding:2px 7px" onclick="copyBmPayload()">Copy JSON</button>
          </div>
          <div class="payload-desc">
            Place Sales Transaction — creates bundle quote with parent QLI, child QLIs, relationships, and attributes in one atomic call.
          </div>
          <pre id="bm-payload-json" class="payload-json"></pre>
        </div>
      </div>
    </div>
    <div id="bundle-footer">
      <div class="cfg-fields">
        <input id="bm-quote-id"   type="text" placeholder="Quote ID (patch) or leave blank (new)" oninput="debounceBmPayload()">
        <input id="bm-account-id" type="text" placeholder="Account ID (001…)" oninput="debounceBmPayload()">
        <input id="bm-pbe-id"     type="text" placeholder="Bundle PBE ID (01u…) *" oninput="debounceBmPayload()">
      </div>
      <div class="cfg-steps" id="bm-steps" style="display:none">
        <span class="cfg-step"><span class="dot" id="bdot-pst"></span>saving…</span>
      </div>
      <button class="btn-grn" id="bm-save-btn" onclick="onSaveConfiguration()">Save Configuration</button>
    </div>
  </div>
</div>

<!-- Result Overlay -->
<div id="result-overlay" onclick="if(event.target===this)hideResult()">
  <div id="result-box">
    <header>
      <span id="result-title">Result</span>
      <button class="btn-sec" onclick="hideResult()" style="padding:2px 8px">✕</button>
    </header>
    <div id="result-body"></div>
    <footer>
      <button class="btn-sec" onclick="copyResult()">Copy</button>
      <button class="btn-sec" onclick="hideResult()">Close</button>
    </footer>
  </div>
</div>

<script src="${scriptUri}"></script>
</body>
</html>`;
  }
}
