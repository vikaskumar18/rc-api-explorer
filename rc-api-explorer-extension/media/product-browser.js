// product-browser.js — webview-side logic for RC Product Browser panel
/* global acquireVsCodeApi */
'use strict';

const vscode = acquireVsCodeApi();

// ── State ─────────────────────────────────────────────────────────────────────
const bm = {                 // bundle modal state
  productId:          null,
  product:            null,  // full PCM product detail
  selectedComponents: {},    // componentId → boolean
  attrValues:         {},    // attributeName → value
  selectedModel:      null,
  pbeCurrency:        null,  // CurrencyIsoCode from selected pricebook entry
  subProductCache:    {},    // compId → fetched PCM product object
  pendingSubFetch:    new Set(), // compIds currently being fetched
};

const state = {
  orgs:              [],
  selectedOrg:       null,
  catalogs:          [],
  selectedCatalogId: null,
  categories:        [],       // { id, name, catalogId, subCategories }
  selectedCatId:     null,
  products:          [],
  productsOffset:    0,
  productsTotal:     0,
  searchTerm:        '',
  activeOnly:        true,
  cart:              [],       // { productId, name, productCode, pbeId, quantity }
  pricebooks:        [],       // { id, name, isStandard }
  pbeMap:            {},       // product2Id → { id, unitPrice, currency }
  selectedPbId:      null,
  flow:              { quoteId: null, contextId: null },
  lastResult:        null,
  apiCalls:          [],       // [{method, path, version, requestBody, status, responseBody, ts}] newest first, max 100
  selectedInspIdx:   -1,
};

// ── VS Code messaging ─────────────────────────────────────────────────────────
function send(msg) { vscode.postMessage(msg); }

window.addEventListener('message', e => {
  const msg = e.data;
  switch (msg.type) {
    case 'init':              onInit(msg); break;
    case 'orgSelected':       onOrgSelected(msg); break;
    case 'sessionExpired':    log('Session expired — run: sf org login web --alias ' + msg.orgAlias, 'err'); break;
    case 'catalogs':          onCatalogs(msg); break;
    case 'categories':        onCategories(msg); break;
    case 'products':          onProducts(msg); break;
    case 'pricebooks':        onPricebooks(msg); break;
    case 'pricebookEntries':  onPricebookEntries(msg); break;
    case 'quoteCreated':      onQuoteCreated(msg); break;
    case 'cfgStep':           onCfgStep(msg); break;
    case 'productDetail':       onProductDetail(msg); break;
    case 'bmSubProductDetail':  onBmSubProductDetail(msg); break;
    case 'cfgModalStep':        onCfgModalStep(msg); break;
    case 'cfgError':          log('Configurator error: ' + msg.error, 'err'); break;
    case 'apiCall':           recordApiCall(msg); break;
  }
});

// Send ready immediately
send({ type: 'ready' });

// ── Init ──────────────────────────────────────────────────────────────────────
function onInit(msg) {
  state.orgs = msg.orgs || [];
  const sel = document.getElementById('org-select');
  sel.innerHTML = '<option value="">— Select org —</option>';
  state.orgs.forEach(o => {
    const opt = document.createElement('option');
    opt.value = o.alias;
    opt.textContent = `${o.alias} (${o.username})`;
    if (o.isDefault) opt.selected = true;
    sel.appendChild(opt);
  });
  if (state.orgs.length > 0 && !sel.value) sel.selectedIndex = 1;
  log(`Found ${state.orgs.length} org(s)`, 'info');
}

// ── Org selection ─────────────────────────────────────────────────────────────
window.onOrgChange = function() {
  state.selectedOrg = document.getElementById('org-select').value || null;
};

window.onConnect = function() {
  const alias = document.getElementById('org-select').value;
  if (!alias) { log('Select an org first', 'warn'); return; }
  state.selectedOrg = alias;
  setOrgStatus('Connecting…');
  log(`Connecting to org: ${alias}`, 'info');
  send({ type: 'selectOrg', orgAlias: alias });
};

function onOrgSelected(msg) {
  setOrgStatus('Connected ✓');
  log('Connected — loading catalogs & pricebooks…', 'ok');
  document.getElementById('search-input').disabled = false;
  send({ type: 'getCatalogs', orgAlias: state.selectedOrg });
  send({ type: 'getPricebooks', orgAlias: state.selectedOrg });
}

function setOrgStatus(text) {
  document.getElementById('org-status').textContent = text;
}

// ── Pricebooks ────────────────────────────────────────────────────────────────
function onPricebooks(msg) {
  const sel = document.getElementById('pb-select');
  if (msg.status >= 300) { log('Failed to load pricebooks: HTTP ' + msg.status, 'err'); return; }
  let records = [];
  try { records = JSON.parse(msg.body).records || []; } catch { return; }
  state.pricebooks = records;
  sel.innerHTML = '<option value="">— Select pricebook —</option>';
  records.forEach(pb => {
    const opt = document.createElement('option');
    opt.value = pb.Id;
    opt.textContent = pb.Name + (pb.IsStandard ? ' (Standard)' : '');
    sel.appendChild(opt);
  });
  sel.disabled = false;
  log(`Loaded ${records.length} pricebook(s)`, 'ok');
}

window.onPricebookChange = function() {
  const pbId = document.getElementById('pb-select').value;
  document.getElementById('pb-id').value = pbId;
  state.selectedPbId = pbId || null;
  state.pbeMap = {};
  document.getElementById('pbe-status').textContent = '';
  if (!pbId) { renderCart(); return; }
  document.getElementById('pbe-status').textContent = '⟳ loading…';
  send({ type: 'getPricebookEntries', orgAlias: state.selectedOrg, pricebookId: pbId });
};

function onPricebookEntries(msg) {
  document.getElementById('pbe-status').textContent = '';
  if (msg.status >= 300) { log('Failed to load pricebook entries: HTTP ' + msg.status, 'err'); return; }
  let records = [];
  try { records = JSON.parse(msg.body).records || []; } catch { return; }
  // Build map: first 15 chars of Product2Id → { id, unitPrice }
  // PCM API returns 15-char IDs; SOQL returns 18-char IDs — normalize to 15 so lookup always matches
  state.pbeMap = {};
  records.forEach(r => { state.pbeMap[r.Product2Id.substring(0, 15)] = { id: r.Id, unitPrice: r.UnitPrice, currency: r.CurrencyIsoCode }; });
  log(`Loaded ${records.length} pricebook entr${records.length === 1 ? 'y' : 'ies'}`, 'ok');
  document.getElementById('pbe-status').textContent = `${records.length} entries`;
  // Auto-fill pbeId for any cart items already added
  state.cart.forEach(item => {
    const entry = state.pbeMap[item.productId.substring(0, 15)];
    if (entry) { item.pbeId = entry.id; }
  });
  renderCart();
  updateCartBadge();
}

// ── Catalogs ──────────────────────────────────────────────────────────────────
function onCatalogs(msg) {
  if (msg.status >= 300) { log('Failed to load catalogs: ' + msg.body, 'err'); return; }
  try {
    const data = JSON.parse(msg.body);
    state.catalogs = data.catalogs || [];
  } catch { log('Could not parse catalog response', 'err'); return; }
  renderCatalogTree();
  log(`Loaded ${state.catalogs.length} catalog(s)`, 'ok');
}

function renderCatalogTree() {
  const tree = document.getElementById('catalog-tree');
  tree.innerHTML = '';
  if (!state.catalogs.length) {
    tree.innerHTML = '<div style="padding:10px;font-size:11px;color:var(--fg3)">No catalogs found</div>';
    return;
  }
  state.catalogs.forEach(cat => {
    const row = document.createElement('div');
    row.className = 'tree-item' + (cat.id === state.selectedCatalogId ? ' active' : '');
    row.dataset.id = cat.id;
    row.innerHTML = `<span class="caret" id="caret-${cat.id}">▶</span><span>${esc(cat.name)}</span>`;
    row.onclick = () => onCatalogClick(cat);
    tree.appendChild(row);

    // Placeholder for categories
    const catContainer = document.createElement('div');
    catContainer.id = `cats-${cat.id}`;
    catContainer.style.display = 'none';
    tree.appendChild(catContainer);
  });
}

window.onCatalogClick = function(cat) {
  state.selectedCatalogId = cat.id;
  state.selectedCatId     = null;
  state.productsOffset    = 0;

  // Toggle highlight
  document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('active'));
  const row = document.querySelector(`[data-id="${cat.id}"]`);
  if (row) row.classList.add('active');

  // Toggle category container
  const container = document.getElementById(`cats-${cat.id}`);
  const caret     = document.getElementById(`caret-${cat.id}`);
  if (container.style.display === 'none') {
    container.style.display = 'block';
    if (caret) caret.textContent = '▼';
    // Load categories if not yet loaded
    if (!container.dataset.loaded) {
      container.innerHTML = '<div style="padding:4px 22px;font-size:11px;color:var(--fg3)"><span class="spinner"></span> Loading…</div>';
      send({ type: 'getCategories', orgAlias: state.selectedOrg, catalogId: cat.id });
    }
  } else {
    container.style.display = 'none';
    if (caret) caret.textContent = '▶';
  }

  // Load products for whole catalog
  loadProducts();
};

// ── Categories ────────────────────────────────────────────────────────────────
function onCategories(msg) {
  const container = document.getElementById(`cats-${msg.catalogId}`);
  if (!container) return;
  container.dataset.loaded = '1';

  if (msg.status >= 300) {
    container.innerHTML = '<div style="padding:4px 22px;font-size:11px;color:var(--red)">Failed to load</div>';
    return;
  }
  let cats = [];
  try { cats = JSON.parse(msg.body).categories || []; } catch { return; }
  state.categories = cats;

  container.innerHTML = '';
  if (!cats.length) {
    container.innerHTML = '<div style="padding:4px 22px;font-size:11px;color:var(--fg3)">No categories</div>';
    return;
  }
  renderCategoryItems(container, cats, msg.catalogId);
}

function renderCategoryItems(container, cats, catalogId) {
  cats.forEach(cat => {
    const row = document.createElement('div');
    row.className = 'tree-item tree-cat' + (cat.id === state.selectedCatId ? ' active' : '');
    row.dataset.catid = cat.id;
    const hasSub = cat.subCategories && cat.subCategories.length > 0;
    row.innerHTML = `<span class="caret">${hasSub ? '▶' : ' '}</span><span>${esc(cat.name)}</span>`;
    row.onclick = (e) => { e.stopPropagation(); onCategoryClick(cat, catalogId, row, hasSub); };
    container.appendChild(row);

    if (hasSub) {
      const subContainer = document.createElement('div');
      subContainer.id = `subcats-${cat.id}`;
      subContainer.style.display = 'none';
      renderCategoryItems(subContainer, cat.subCategories, catalogId);
      container.appendChild(subContainer);
    }
  });
}

window.onCategoryClick = function(cat, catalogId, rowEl, hasSub) {
  state.selectedCatId  = cat.id;
  state.productsOffset = 0;

  document.querySelectorAll('[data-catid]').forEach(el => el.classList.remove('active'));
  rowEl.classList.add('active');

  if (hasSub) {
    const sub = document.getElementById(`subcats-${cat.id}`);
    const caret = rowEl.querySelector('.caret');
    if (sub) {
      const open = sub.style.display === 'none';
      sub.style.display = open ? 'block' : 'none';
      if (caret) caret.textContent = open ? '▼' : '▶';
    }
  }

  loadProducts();
};

// ── Products ──────────────────────────────────────────────────────────────────
function loadProducts(append) {
  if (!state.selectedOrg) return;
  const grid = document.getElementById('products-grid');
  if (!append) {
    state.productsOffset = 0;
    state.products       = [];
    grid.innerHTML = '<div class="empty-hint"><span class="spinner"></span> Loading products…</div>';
  }
  const payload = {
    type:        'getProducts',
    orgAlias:    state.selectedOrg,
    pageSize:    20,
    offset:      state.productsOffset,
    searchTerm:  state.searchTerm || undefined,
  };
  if (state.selectedCatId)     payload.categoryId  = state.selectedCatId;
  else if (state.selectedCatalogId) payload.catalogId = state.selectedCatalogId;
  send(payload);
}

function onProducts(msg) {
  if (msg.status >= 300) {
    log('Failed to load products: HTTP ' + msg.status, 'err');
    document.getElementById('products-grid').innerHTML = '<div class="empty-hint">Failed to load products</div>';
    return;
  }
  let data;
  try { data = JSON.parse(msg.body); } catch {
    document.getElementById('products-grid').innerHTML = '<div class="empty-hint">Parse error</div>';
    return;
  }
  const newProds = data.products || [];
  if (msg.offset === 0) {
    state.products = newProds;
  } else {
    state.products = [...state.products, ...newProds];
  }
  state.productsTotal = data.totalCount ?? newProds.length;
  renderProducts();
  log(`Loaded ${state.products.length} product(s)`, 'info');
}

function renderProducts() {
  const grid = document.getElementById('products-grid');
  grid.innerHTML = '';

  const active = document.getElementById('active-only').checked;
  let prods = active ? state.products.filter(p => p.isActive !== false) : state.products;
  if (state.searchTerm) {
    const term = state.searchTerm.toLowerCase();
    prods = prods.filter(p => p.name?.toLowerCase().includes(term) || p.productCode?.toLowerCase().includes(term));
  }

  if (!prods.length) {
    grid.innerHTML = '<div class="empty-hint">No products found</div>';
    document.getElementById('load-more').style.display = 'none';
    return;
  }

  prods.forEach(p => {
    const inCart = state.cart.some(c => c.productId === p.id);
    const card = document.createElement('div');
    card.className = 'prod-card' + (inCart ? ' in-cart' : '');
    card.id = `prod-${p.id}`;
    const badges = [];
    if (p.isActive !== false) badges.push('<span class="badge active">Active</span>');
    if (p.nodeType === 'bundleProduct') badges.push('<span class="badge bundle">Bundle</span>');
    const gearBtn = p.nodeType === 'bundleProduct'
      ? `<button class="btn-gear" title="Configure bundle" onclick="openBundleModal('${p.id}','${esc(p.name || '')}')">⚙</button>`
      : '';
    card.innerHTML = `
      <div class="prod-name">${esc(p.name || 'Unnamed')}</div>
      ${p.productCode ? `<div class="prod-code">${esc(p.productCode)}</div>` : ''}
      ${p.description ? `<div class="prod-desc">${esc(p.description)}</div>` : ''}
      <div class="prod-badges">${badges.join('')}</div>
      <div class="prod-card-actions">
        <button class="${inCart ? 'btn-sec' : 'btn-pri'}" onclick="onToggleCart('${p.id}','${esc(p.name || '')}','${esc(p.productCode || '')}')">
          ${inCart ? '✓ In Cart' : '+ Add to Quote'}
        </button>
        ${gearBtn}
      </div>`;
    grid.appendChild(card);
  });

  const hasMore = state.products.length < state.productsTotal || state.products.length === 20;
  document.getElementById('load-more').style.display = hasMore && state.productsTotal > state.products.length ? 'block' : 'none';
}

window.onLoadMore = function() {
  state.productsOffset = state.products.length;
  loadProducts(true);
};

let searchTimeout;
window.onSearch = function() {
  state.searchTerm = document.getElementById('search-input').value.trim();
  state.activeOnly = document.getElementById('active-only').checked;
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => loadProducts(), 350);
};

// ── Cart ──────────────────────────────────────────────────────────────────────
window.onToggleCart = function(productId, name, productCode) {
  const idx = state.cart.findIndex(c => c.productId === productId);
  if (idx >= 0) {
    state.cart.splice(idx, 1);
    log(`Removed "${name}" from cart`, 'info');
  } else {
    const autoEntry = state.pbeMap[productId.substring(0, 15)];
    state.cart.push({ productId, name, productCode, pbeId: autoEntry ? autoEntry.id : '', quantity: 1 });
    log(`Added "${name}" to cart${autoEntry ? ' (PBE auto-filled)' : ' — select a pricebook to auto-fill PBE'}`, 'ok');
  }
  updateCartBadge();
  renderCart();
  // Refresh the product card button
  const card = document.getElementById(`prod-${productId}`);
  if (card) {
    const inCart = idx < 0; // was just added
    card.className = 'prod-card' + (inCart ? ' in-cart' : '');
    const btn = card.querySelector('button');
    if (btn) { btn.className = inCart ? 'btn-sec' : 'btn-pri'; btn.textContent = inCart ? '✓ In Cart' : '+ Add to Quote'; }
  }
};

function updateCartBadge() {
  document.getElementById('cart-count').textContent = state.cart.length > 0 ? `(${state.cart.length})` : '';
  document.getElementById('btn-create-quote').disabled = state.cart.length === 0 || !state.selectedOrg;
}

function renderCart() {
  const container = document.getElementById('cart-items');
  if (!state.cart.length) {
    container.innerHTML = '<div class="cart-empty">No products selected</div>';
    return;
  }
  container.innerHTML = '';
  state.cart.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `
      <div class="cart-name">${esc(item.name)}</div>
      <button class="cart-del" onclick="removeFromCart(${i})" title="Remove">✕</button>
      <div class="cart-fields">
        <div><label>PricebookEntry ID *</label><input type="text" value="${esc(item.pbeId)}" placeholder="01u…" oninput="state.cart[${i}].pbeId=this.value"></div>
        <div><label>Qty</label><input type="number" value="${item.quantity}" min="1" oninput="state.cart[${i}].quantity=Number(this.value)||1" style="text-align:center"></div>
      </div>`;
    container.appendChild(div);
  });
}

window.removeFromCart = function(i) {
  const item = state.cart[i];
  state.cart.splice(i, 1);
  updateCartBadge();
  renderCart();
  // Refresh card in grid
  const card = document.getElementById(`prod-${item.productId}`);
  if (card) {
    card.className = 'prod-card';
    const btn = card.querySelector('button');
    if (btn) { btn.className = 'btn-pri'; btn.textContent = '+ Add to Quote'; }
  }
};

// ── Create Quote ──────────────────────────────────────────────────────────────
window.onCreateQuote = function() {
  const oppId = document.getElementById('opp-id').value.trim();
  const pbId  = document.getElementById('pb-id').value.trim() || state.selectedPbId;
  if (!pbId)  { log('Select a pricebook first', 'warn'); return; }
  for (const item of state.cart) {
    if (!item.pbeId || !item.pbeId.trim()) { log(`PricebookEntry ID missing for "${item.name}" — select a pricebook to auto-fill`, 'warn'); return; }
    if (item.quantity < 1)                 { log(`Quantity must be ≥ 1 for "${item.name}"`, 'warn'); return; }
  }
  // Pick currency from first cart item's PBE — all items share same pricebook so currency is uniform
  const firstPbe = state.pbeMap[state.cart[0]?.productId?.substring(0, 15)];
  const currency = firstPbe?.currency || null;

  log('Creating quote…', 'info');
  document.getElementById('btn-create-quote').disabled = true;
  send({
    type:          'createQuote',
    orgAlias:      state.selectedOrg,
    opportunityId: oppId || '',
    pricebookId:   pbId,
    quoteName:     document.getElementById('q-name').value.trim(),
    currencyIsoCode: currency,
    cart:          state.cart.map(c => ({ productId: c.productId, pbeId: c.pbeId, quantity: c.quantity })),
  });
};

function onQuoteCreated(msg) {
  document.getElementById('btn-create-quote').disabled = false;
  if (msg.status >= 300) {
    log('Quote creation failed: HTTP ' + msg.status, 'err');
    showResult('Quote Creation Failed', msg.body);
    return;
  }
  let quoteId;
  try { const b = JSON.parse(msg.body); const first = Array.isArray(b) ? b[0] : b; quoteId = first?.salesTransactionId; } catch {}
  if (quoteId) {
    state.flow.quoteId = quoteId;
    log(`Quote created: ${quoteId}`, 'ok');
    document.getElementById('btn-load-cfg').disabled = false;
    showResult(`Quote Created — ${quoteId}`, msg.body);
  } else {
    log('Quote created (no quoteId in response)', 'warn');
    showResult('Quote Created', msg.body);
  }
}

// ── Configurator ──────────────────────────────────────────────────────────────
window.onLoadConfigurator = function() {
  if (!state.flow.quoteId) { log('No quote created yet', 'warn'); return; }
  log('Starting configurator flow…', 'info');
  document.getElementById('btn-load-cfg').disabled = true;
  send({
    type:     'loadConfigurator',
    orgAlias: state.selectedOrg,
    quoteId:  state.flow.quoteId,
    cart:     state.cart.map(c => ({ productId: c.productId, pbeId: c.pbeId, quantity: c.quantity })),
  });
};

function onCfgStep(msg) {
  const ok = msg.status < 300;
  log(`[Configurator] ${msg.step} — HTTP ${msg.status}`, ok ? 'ok' : 'err');
  if (msg.step === 'save-instance') {
    document.getElementById('btn-load-cfg').disabled = false;
    if (ok) {
      showResult('Configurator Complete — Instance Saved', msg.body);
    } else {
      showResult('Configurator — save-instance Failed', msg.body);
    }
  } else if (!ok) {
    document.getElementById('btn-load-cfg').disabled = false;
    showResult(`Configurator — ${msg.step} Failed`, msg.body);
  }
}

// ── Bundle Modal ──────────────────────────────────────────────────────────────
window.openBundleModal = function(productId, name) {
  if (!state.selectedPbId) {
    const pbSel = document.getElementById('pb-select');
    if (pbSel) { pbSel.style.outline = '2px solid var(--red)'; pbSel.style.boxShadow = '0 0 6px var(--red)'; setTimeout(() => { pbSel.style.outline = ''; pbSel.style.boxShadow = ''; }, 3000); }
    log('Please select a Pricebook before configuring a bundle product.', 'warn');
    return;
  }
  bm.productId = productId;
  bm.product   = null;
  bm.selectedComponents = {};
  bm.attrValues = {};
  bm.selectedModel = null;
  bm.subProductCache = {};
  bm.pendingSubFetch = new Set();

  document.getElementById('bm-title').textContent = `Configure: ${name}`;
  document.getElementById('bm-sub').textContent   = '';
  document.getElementById('bundle-body').innerHTML = '<div class="empty-hint"><span class="spinner"></span> Loading product structure…</div>';
  document.getElementById('bm-steps').style.display = 'none';
  document.getElementById('bm-save-btn').disabled = false;
  ['load','add','save'].forEach(k => { const d = document.getElementById(`bdot-${k}`); if (d) d.className = 'dot'; });

  // Pre-fill quote/pbe from existing cart if possible
  const cartItem = state.cart.find(c => c.productId === productId);
  if (cartItem?.pbeId) document.getElementById('bm-pbe-id').value = cartItem.pbeId;
  if (state.flow?.quoteId) document.getElementById('bm-quote-id').value = state.flow.quoteId;
  // Capture currency from pbeMap for this product so Quote POST gets the right CurrencyIsoCode
  bm.pbeCurrency = state.pbeMap[productId?.substring(0,15)]?.currency || null;

  document.getElementById('bundle-modal').classList.add('visible');
  log(`Loading bundle structure for "${name}"…`, 'info');
  send({ type: 'getProductDetail', orgAlias: state.selectedOrg, productId });
};

window.closeBundleModal = function() {
  document.getElementById('bundle-modal').classList.remove('visible');
};

function onProductDetail(msg) {
  if (msg.status >= 300) {
    document.getElementById('bundle-body').innerHTML = `<div class="empty-hint">Failed to load product (HTTP ${msg.status})</div>`;
    log('Failed to load product detail: HTTP ' + msg.status, 'err');
    return;
  }
  let parsed;
  try { parsed = JSON.parse(msg.body); } catch { return; }
  const p = Array.isArray(parsed.products) ? parsed.products[0] : parsed;
  bm.product = p;

  document.getElementById('bm-sub').textContent = `${p.nodeType || ''} · ${p.productCode || p.id}`;
  log(`Bundle structure loaded — ${(p.productComponentGroups||[]).length} group(s)`, 'ok');

  // Init defaults
  (p.productComponentGroups || []).forEach(g => {
    (g.components || []).forEach(c => {
      const prc = c.productRelatedComponent || {};
      bm.selectedComponents[c.id] = !!(prc.isComponentRequired || prc.isDefaultComponent);
    });
  });
  (p.attributeCategory || []).forEach(cat => {
    (cat.attributes || []).forEach(attr => {
      if (attr.defaultValue) bm.attrValues[attr.name] = attr.defaultValue;
    });
  });
  const defModel = (p.productSellingModelOptions || []).find(m => m.isDefault);
  if (defModel) bm.selectedModel = defModel.productSellingModel?.id || defModel.productSellingModel?.name;

  renderBundleModal(p);
}

function renderBundleModal(p) {
  const body = document.getElementById('bundle-body');
  body.innerHTML = '';

  // Selling models
  const models = p.productSellingModelOptions || [];
  if (models.length > 1) {
    const div = document.createElement('div');
    div.className = 'sm-group';
    div.innerHTML = `<div class="sm-group-name">Selling Model</div>` +
      models.map((m, i) => {
        const sm  = m.productSellingModel || {};
        const id  = sm.id || sm.name || `sm_${i}`;
        const sel = id === bm.selectedModel ? 'checked' : '';
        return `<label class="sm-row">
          <input type="radio" name="bm_sm" value="${esc(id)}" ${sel} onchange="bm.selectedModel=this.value">
          <span class="sm-label">${esc(sm.name || id)}<span class="sm-meta">${esc(sm.sellingModelType||'')}${sm.pricingTerm?' · '+sm.pricingTerm+' '+(sm.pricingTermUnit||''):''}</span></span>
          ${m.isDefault ? '<span class="sm-def">Default</span>' : ''}
        </label>`;
      }).join('');
    body.appendChild(div);
  }

  // Attributes
  (p.attributeCategory || []).forEach(cat => {
    if (!(cat.attributes||[]).length) return;
    const div = document.createElement('div');
    div.className = 'attr-group';
    div.innerHTML = `<div class="attr-group-name">${esc(cat.name||'Attributes')}</div><div class="attr-grid" id="ag-${esc(cat.name)}"></div>`;
    body.appendChild(div);
    const grid = div.querySelector('.attr-grid');
    (cat.attributes || []).forEach(attr => {
      const name  = attr.name || attr.apiName || '';
      const val   = bm.attrValues[name] || attr.defaultValue || '';
      const req   = attr.isRequired ? '<span style="color:var(--red)">*</span>' : '';
      const field = document.createElement('div');
      field.className = 'attr-field';
      if (attr.dataType === 'Picklist' && attr.picklist?.values?.length) {
        const opts = attr.picklist.values.map(v => {
          const vv = typeof v === 'string' ? v : (v.value || v);
          return `<option value="${esc(String(vv))}" ${String(vv)===String(val)?'selected':''}>${esc(String(v.label||vv))}</option>`;
        }).join('');
        field.innerHTML = `<label>${esc(name)} ${req}</label><select onchange="bm.attrValues['${esc(name)}']=this.value">${opts}</select>`;
      } else {
        field.innerHTML = `<label>${esc(name)} ${req}</label><input type="text" value="${esc(val)}" oninput="bm.attrValues['${esc(name)}']=this.value">`;
      }
      grid.appendChild(field);
    });
  });

  // Component groups (recursive)
  const groups = p.productComponentGroups || [];
  if (!groups.length) {
    const d = document.createElement('div');
    d.className = 'empty-hint';
    d.textContent = 'No component groups — simple product, no bundle components';
    body.appendChild(d);
    return;
  }
  renderCompGroups(groups, body, 0);
}

function renderCompGroups(groups, container, depth) {
  groups.forEach((g, gi) => {
    const min = g.minBundleComponents ?? 0;
    const max = g.maxBundleComponents ?? 999;
    const metaParts = [];
    if (min > 0) metaParts.push(`min ${min}`);
    if (max < 999) metaParts.push(`max ${max}`);
    const div = document.createElement('div');
    div.className = 'pcg-group';
    div.style.marginLeft = (depth * 16) + 'px';
    const groupId = `pcg-${depth}-${gi}-${(g.name||'').replace(/\W/g,'_')}`;
    div.id = groupId;
    div.innerHTML = `<div class="pcg-header">
        <span class="pcg-name">${esc(g.name || `Group ${gi+1}`)}</span>
        <span class="pcg-meta">${esc(metaParts.join(', '))}</span>
      </div>`;
    (g.components || []).forEach((c) => {
      const prc   = c.productRelatedComponent || {};
      const isReq = !!prc.isComponentRequired;
      const isDef = !!prc.isDefaultComponent;
      const incl  = !!prc.doesBundlePriceIncludeChild;
      const checked = bm.selectedComponents[c.id];
      const isBundle = c.nodeType === 'bundleProduct';
      const subGroups = bm.subProductCache[c.id]?.productComponentGroups || c.productComponentGroups || [];
      const isPending = bm.pendingSubFetch.has(c.id);

      const wrapper = document.createElement('div');
      wrapper.id = `bm-comp-wrapper-${esc(c.id)}`;

      const row = document.createElement('label');
      row.className = 'comp-row';
      row.innerHTML = `
        <input type="checkbox" data-cid="${esc(c.id)}" data-gi="${gi}" data-depth="${depth}" ${checked?'checked':''} ${isReq?'disabled title="Required"':''}
          onchange="onBmCompToggle('${esc(c.id)}',${gi},this,${depth})">
        <span class="comp-info">
          <span class="comp-name">${esc(c.name||c.id)}</span>
          ${c.productCode?`<span class="comp-code">${esc(c.productCode)}</span>`:''}
        </span>
        <span class="comp-tags">
          ${isReq?'<span class="ctag req">Required</span>':''}
          ${isDef&&!isReq?'<span class="ctag def">Default</span>':''}
          ${incl?'<span class="ctag inc">Included</span>':'<span class="ctag ext">+Price</span>'}
          ${isBundle?'<span class="ctag" style="background:rgba(255,160,0,.15);color:#ffa000;border-color:rgba(255,160,0,.4)">Bundle</span>':''}
        </span>`;
      wrapper.appendChild(row);

      // Sub-groups container
      const subContainer = document.createElement('div');
      subContainer.id = `bm-sub-${esc(c.id)}`;
      subContainer.style.display = checked ? 'block' : 'none';
      subContainer.style.marginLeft = '20px';
      subContainer.style.borderLeft = '2px solid var(--border)';
      subContainer.style.paddingLeft = '8px';
      subContainer.style.marginTop = '4px';

      if (isPending) {
        subContainer.innerHTML = '<div style="padding:6px 0;opacity:.6;font-size:11px"><span class="spinner"></span> Loading sub-components…</div>';
      } else if (subGroups.length && checked) {
        renderCompGroups(subGroups, subContainer, depth + 1);
      } else if (isBundle && checked && !subGroups.length) {
        subContainer.innerHTML = '<div style="padding:4px 0;opacity:.5;font-size:11px">No sub-components found</div>';
      }

      wrapper.appendChild(subContainer);
      div.appendChild(wrapper);
    });
    const errDiv = document.createElement('div');
    errDiv.className = 'pcg-err';
    errDiv.id = `pcg-err-${depth}-${gi}`;
    div.appendChild(errDiv);
    container.appendChild(div);
  });
}

window.onBmCompToggle = function(cId, gi, checkbox, depth) {
  // Find the component in the tree (could be nested)
  const comp = findCompInTree(bm.product, cId);
  const depth0 = depth || 0;

  // Max-check against the group at root level only (depth 0 uses gi)
  if (depth0 === 0 && checkbox.checked) {
    const g   = bm.product?.productComponentGroups?.[gi];
    const max = g?.maxBundleComponents ?? 999;
    const cnt = (g?.components||[]).filter(c => bm.selectedComponents[c.id]).length;
    if (cnt >= max) {
      checkbox.checked = false;
      const errEl = document.getElementById(`pcg-err-0-${gi}`);
      if (errEl) { errEl.textContent = `Max ${max} component(s) allowed in this group`; errEl.style.display = 'block'; setTimeout(()=>{ errEl.style.display='none'; }, 2500); }
      return;
    }
  }

  bm.selectedComponents[cId] = checkbox.checked;

  // Show/hide sub-container immediately
  const subContainer = document.getElementById(`bm-sub-${cId}`);
  if (subContainer) subContainer.style.display = checkbox.checked ? 'block' : 'none';

  // If checking a bundle component, fire sub-fetch if not yet cached
  if (checkbox.checked && comp) {
    const isBundle = comp.nodeType === 'bundleProduct';
    const alreadyHasGroups = (bm.subProductCache[cId]?.productComponentGroups || comp.productComponentGroups || []).length > 0;
    if (isBundle && !alreadyHasGroups && !bm.pendingSubFetch.has(cId)) {
      bm.pendingSubFetch.add(cId);
      if (subContainer) subContainer.innerHTML = '<div style="padding:6px 0;opacity:.6;font-size:11px"><span class="spinner"></span> Loading sub-components…</div>';
      if (subContainer) subContainer.style.display = 'block';
      send({ type: 'getBmSubProduct', orgAlias: state.selectedOrg, compId: cId });
    } else if (alreadyHasGroups && subContainer && !subContainer.children.length) {
      // Already cached — re-render sub-groups
      const subGroups = bm.subProductCache[cId]?.productComponentGroups || comp.productComponentGroups || [];
      renderCompGroups(subGroups, subContainer, (depth0 || 0) + 1);
    }
  }
};

function findCompInTree(product, cId) {
  if (!product) return null;
  for (const g of (product.productComponentGroups || [])) {
    for (const c of (g.components || [])) {
      if (c.id === cId) return c;
      // Check cached sub-products
      const sub = bm.subProductCache[c.id];
      if (sub) {
        const found = findCompInTree(sub, cId);
        if (found) return found;
      }
    }
  }
  return null;
}

function onBmSubProductDetail(msg) {
  const { compId } = msg;
  bm.pendingSubFetch.delete(compId);

  if (msg.status >= 300) {
    log(`Sub-product fetch failed for ${compId}: HTTP ${msg.status}`, 'err');
    const subContainer = document.getElementById(`bm-sub-${compId}`);
    if (subContainer) subContainer.innerHTML = '<div style="padding:4px 0;color:var(--red);font-size:11px">Failed to load sub-components</div>';
    return;
  }

  let parsed;
  try { parsed = JSON.parse(msg.body); } catch { return; }
  const sub = Array.isArray(parsed.products) ? parsed.products[0] : parsed;
  bm.subProductCache[compId] = sub;

  // Init selection defaults for new sub-components
  (sub.productComponentGroups || []).forEach(g => {
    (g.components || []).forEach(c => {
      if (bm.selectedComponents[c.id] === undefined) {
        const prc = c.productRelatedComponent || {};
        bm.selectedComponents[c.id] = !!(prc.isComponentRequired || prc.isDefaultComponent);
      }
    });
  });

  const subGroups = sub.productComponentGroups || [];
  const subContainer = document.getElementById(`bm-sub-${compId}`);
  if (!subContainer) return;
  subContainer.innerHTML = '';
  if (!subGroups.length) {
    subContainer.innerHTML = '<div style="padding:4px 0;opacity:.5;font-size:11px">No sub-components found</div>';
  } else {
    renderCompGroups(subGroups, subContainer, 1);
    log(`Loaded ${subGroups.length} sub-group(s) for component ${compId}`, 'ok');
  }
}

// ── Payload builder (shared by preview + save) ────────────────────────────────
function buildPstPayload(productId, quoteId, pbeId, accountId, pricebookId, quoteName, opportunityId) {
  const bundleRef = `refQLI_bundle_${(productId || 'xxx').slice(-6)}`;
  const records   = [];

  // Quote record
  if (quoteId) {
    records.push({ referenceId: 'refQuote', record: { attributes: { type: 'Quote', method: 'PATCH', id: quoteId } } });
  } else {
    const qRec = { attributes: { type: 'Quote', method: 'POST' }, Name: quoteName || 'Bundle Quote' };
    if (pricebookId)     { qRec.Pricebook2Id     = pricebookId; }
    if (opportunityId)   { qRec.OpportunityId    = opportunityId; }
    // AccountId is blocked by PST FLS — omit it
    if (bm.pbeCurrency)  { qRec.CurrencyIsoCode  = bm.pbeCurrency; }
    records.push({ referenceId: 'refQuote', record: qRec });
  }

  // Bundle parent QLI
  records.push({
    referenceId: bundleRef,
    record: {
      attributes: { type: 'QuoteLineItem', method: 'POST' },
      QuoteId:          quoteId || '@{refQuote.id}',
      Product2Id:       productId,
      PricebookEntryId: pbeId,
      Quantity:         1,
    },
  });

  // Child QLIs + relationships (from current bm selection)
  const groups = bm.product?.productComponentGroups || [];
  let ci = 0;
  groups.forEach(g => {
    (g.components || []).forEach(c => {
      if (!bm.selectedComponents[c.id]) { return; }
      const prc     = c.productRelatedComponent || {};
      const compRef = `refQLI_comp_${ci}_${c.id.slice(-6)}`;
      const relRef  = `refRel_${ci}_${c.id.slice(-6)}`;
      const compPbe = state.pbeMap[c.id?.substring(0,15)]?.id || pbeId;
      records.push({
        referenceId: compRef,
        record: {
          attributes: { type: 'QuoteLineItem', method: 'POST' },
          QuoteId:          quoteId || '@{refQuote.id}',
          Product2Id:       c.id,
          PricebookEntryId: compPbe,
          Quantity:         prc.quantity || 1,
        },
      });
      const relRec = { attributes: { type: 'QuoteLineRelationship', method: 'POST' },
        MainQuoteLineId:         bundleRef,
        AssociatedQuoteLineId:   compRef,
        AssociatedQuoteLinePricing: prc.doesBundlePriceIncludeChild ? 'IncludedInBundlePrice' : 'NotIncludedInBundlePrice',
      };
      if (prc.productRelationshipTypeId) { relRec.ProductRelationshipTypeId = prc.productRelationshipTypeId; }
      if (prc.id)                        { relRec.ProductRelatedComponentId  = prc.id; }
      records.push({ referenceId: relRef, record: relRec });
      ci++;
    });
  });

  // Attributes
  buildAttrRecords(bm.product, bm.attrValues, bundleRef).forEach((a, i) => {
    if (!a.attributeDefinitionId || !a.attributePicklistValueId) { return; }
    records.push({
      referenceId: `refAttr_${i}`,
      record: {
        attributes:              { type: 'QuoteLineItemAttribute', method: 'POST' },
        AttributeDefinitionId:   a.attributeDefinitionId,
        QuoteLineItemId:         bundleRef,
        AttributePicklistValueId: a.attributePicklistValueId,
      },
    });
  });

  return {
    bundleRef,
    body: {
      pricingPref:      'System',
      catalogRatesPref: 'Skip',
      configurationPref: {
        configurationMethod: 'Skip',
        configurationOptions: {
          validateProductCatalog:     true,
          validateAmendRenewCancel:   true,
          executeConfigurationRules:  true,
          addDefaultConfiguration:    true,
        },
      },
      graph: { graphId: 'bundleQuote', records },
    },
  };
}

// ── Bundle modal tab switching + payload preview ───────────────────────────────
window.switchBmTab = function(tab) {
  ['configure','payload'].forEach(t => {
    document.getElementById(`bm-tab-${t}`).style.display  = t === tab ? '' : 'none';
    document.getElementById(`bmt-${t}`).classList.toggle('active', t === tab);
  });
  if (tab === 'payload') { renderPayloadTab(); }
};

function renderPayloadTab() {
  const quoteId      = document.getElementById('bm-quote-id')?.value?.trim()   || '';
  const pbeId        = document.getElementById('bm-pbe-id')?.value?.trim()      || '';
  const accountId    = document.getElementById('bm-account-id')?.value?.trim()  || '';
  const pricebookId  = state.selectedPbId || '';
  const quoteName    = document.getElementById('q-name')?.value?.trim()         || 'Bundle Quote';
  const opportunityId= document.getElementById('opp-id')?.value?.trim()         || '';
  const productId    = bm.productId || '<productId>';

  if (!bm.product) {
    document.getElementById('bm-payload-json').textContent = '// Product not loaded yet — open Configure tab first';
    return;
  }

  const { body } = buildPstPayload(productId, quoteId, pbeId, accountId, pricebookId, quoteName, opportunityId);
  document.getElementById('bm-payload-json').textContent = JSON.stringify(body, null, 2);
}

let _bmPayloadTimer = null;
window.debounceBmPayload = function() {
  clearTimeout(_bmPayloadTimer);
  _bmPayloadTimer = setTimeout(() => {
    // Only re-render if the payload tab is active
    if (document.getElementById('bm-tab-payload')?.style.display !== 'none') {
      renderPayloadTab();
    }
  }, 300);
};

window.copyBmPayload = function() {
  const txt = document.getElementById('bm-payload-json')?.textContent || '';
  if (txt) { navigator.clipboard.writeText(txt).catch(() => {}); }
};

function buildAttrRecords(product, attrValues, bundleRef) {
  const records = [];
  (product?.attributeCategory || []).forEach(cat => {
    (cat.attributes || []).forEach(attr => {
      const selectedVal = attrValues[attr.name];
      if (!selectedVal) { return; }
      // Find the picklist value id matching the selected value
      const match = (attr.picklist?.values || []).find(v =>
        String(v.value || v).toLowerCase() === String(selectedVal).toLowerCase()
      );
      if (!match?.id) { return; } // no 0v6… id — skip
      records.push({
        attributeDefinitionId:    attr.id,              // 0tj…
        quoteLineRef:             bundleRef,             // referenceId of parent QLI
        attributePicklistValueId: match.id,             // 0v6…
      });
    });
  });
  return records;
}

window.onSaveConfiguration = function() {
  const quoteId = document.getElementById('bm-quote-id').value.trim();
  const pbeId   = document.getElementById('bm-pbe-id').value.trim();

  if (!state.selectedPbId) {
    const pbSel = document.getElementById('pb-select');
    if (pbSel) { pbSel.style.outline = '2px solid var(--red)'; pbSel.style.boxShadow = '0 0 6px var(--red)'; setTimeout(() => { pbSel.style.outline = ''; pbSel.style.boxShadow = ''; }, 3000); }
    log('Please select a Pricebook before saving.', 'warn');
    return;
  }
  if (!pbeId) {
    const pbeInp = document.getElementById('bm-pbe-id');
    if (pbeInp) { pbeInp.style.outline = '2px solid var(--red)'; pbeInp.style.boxShadow = '0 0 6px var(--red)'; pbeInp.focus(); setTimeout(() => { pbeInp.style.outline = ''; pbeInp.style.boxShadow = ''; }, 3000); }
    log('Bundle PricebookEntry ID is required — enter the 01u… ID in the footer field.', 'warn');
    return;
  }
  if (!bm.product) return;

  // Validate required attributes
  for (const cat of bm.product.attributeCategory || []) {
    for (const attr of cat.attributes || []) {
      if (attr.isRequired && !bm.attrValues[attr.name]) {
        log(`Required attribute "${attr.name}" is not set`, 'warn'); return;
      }
    }
  }
  // Validate min components per group
  const groups = bm.product.productComponentGroups || [];
  for (let gi = 0; gi < groups.length; gi++) {
    const g   = groups[gi];
    const min = g.minBundleComponents ?? 0;
    const cnt = (g.components||[]).filter(c => bm.selectedComponents[c.id]).length;
    if (cnt < min) { log(`Group "${g.name}" requires at least ${min} component(s)`, 'warn'); return; }
  }

  const accountId    = document.getElementById('bm-account-id')?.value?.trim() || '';
  const pricebookId  = state.selectedPbId || '';
  const quoteName    = document.getElementById('q-name')?.value?.trim()        || 'Bundle Quote';
  const opportunityId= document.getElementById('opp-id')?.value?.trim()        || '';

  const { body: pstBody } = buildPstPayload(bm.productId, quoteId, pbeId, accountId, pricebookId, quoteName, opportunityId);

  const compCount = (bm.product?.productComponentGroups || [])
    .flatMap(g => g.components || []).filter(c => bm.selectedComponents[c.id]).length;

  document.getElementById('bm-save-btn').disabled = true;
  document.getElementById('bm-steps').style.display = 'flex';
  const d = document.getElementById('bdot-pst'); if (d) d.className = 'dot run';

  log(`Creating bundle quote — 1 parent + ${compCount} component(s)…`, 'info');
  send({
    type:     'saveConfiguration',
    orgAlias: state.selectedOrg,
    pstBody,
  });
};

function setBmDot(key, st) {
  const d = document.getElementById(`bdot-${key}`);
  if (d) d.className = `dot ${st}`;
}

function onCfgModalStep(msg) {
  const ok = msg.status < 300;
  setBmDot('pst', ok ? 'ok' : 'err');
  log(`[Bundle] ${msg.step} → HTTP ${msg.status}`, ok ? 'ok' : 'err');
  document.getElementById('bm-save-btn').disabled = false;

  if (ok) {
    let txnId;
    try {
      const body = JSON.parse(msg.body);
      const first = Array.isArray(body) ? body[0] : body;
      txnId = first?.salesTransactionId;
    } catch {}
    if (txnId) { state.flow.quoteId = txnId; }
    log('Bundle quote created' + (txnId ? `: ${txnId}` : ''), 'ok');
    closeBundleModal();
    showResult('Bundle Quote Created ✓', msg.body);
  } else {
    // Close modal first so result overlay (z-index 100) is not hidden behind bundle modal (z-index 200)
    closeBundleModal();
    showResult(`Bundle creation failed (HTTP ${msg.status})`, msg.body);
  }
}

// ── Result Overlay ────────────────────────────────────────────────────────────
function showResult(title, body) {
  state.lastResult = body;
  document.getElementById('result-title').textContent = title;
  document.getElementById('result-body').innerHTML = syntaxHighlight(body);
  document.getElementById('result-overlay').classList.add('visible');
}

window.hideResult = function() {
  document.getElementById('result-overlay').classList.remove('visible');
};

window.copyResult = function() {
  if (state.lastResult) navigator.clipboard.writeText(state.lastResult).catch(() => {});
};

// ── Bottom panel tab switching ────────────────────────────────────────────────
window.switchBpTab = function(tab) {
  const isInspector = tab === 'inspector';
  document.getElementById('bp-log').style.display        = isInspector ? 'none' : '';
  const insp = document.getElementById('bp-inspector');
  insp.classList.toggle('active', isInspector);
  document.getElementById('bpt-log').classList.toggle('active', !isInspector);
  document.getElementById('bpt-inspector').classList.toggle('active', isInspector);
  if (isInspector) {
    // Clear the new-activity badge
    document.getElementById('insp-badge').classList.remove('show');
    // Auto-select most recent call if none selected
    if (state.selectedInspIdx === -1 && state.apiCalls.length > 0) { selectInspRow(0); }
  }
};

// ── API Inspector ─────────────────────────────────────────────────────────────
function recordApiCall(call) {
  state.apiCalls.unshift(call);           // newest first
  if (state.apiCalls.length > 100) { state.apiCalls.pop(); }

  renderInspList();

  // If inspector tab is active, auto-select newest; otherwise badge the tab
  const inspActive = document.getElementById('bp-inspector').classList.contains('active');
  if (inspActive) {
    selectInspRow(0);
  } else {
    document.getElementById('insp-badge').classList.add('show');
  }
}

function renderInspList() {
  const list = document.getElementById('insp-list');
  if (!state.apiCalls.length) {
    list.innerHTML = '<div class="insp-empty">No API calls yet</div>';
    return;
  }
  list.innerHTML = state.apiCalls.map((c, i) => {
    const method  = (c.method || 'GET').toLowerCase();
    const short   = (c.path || '').replace(/\/services\/data\/v[\d.]+/, '').replace(/\?.*$/, '');
    const status  = c.status;
    const stClass = !status ? 'pend' : status < 300 ? 'ok' : 'err';
    const stLabel = status || '…';
    const sel     = i === state.selectedInspIdx ? ' selected' : '';
    return `<div class="insp-row${sel}" onclick="selectInspRow(${i})">` +
      `<span class="insp-method ${method}">${c.method}</span>` +
      `<span class="insp-path" title="${esc(c.path)}">${esc(short)}</span>` +
      `<span class="insp-status ${stClass}">${stLabel}</span>` +
      `</div>`;
  }).join('');
}

function selectInspRow(i) {
  state.selectedInspIdx = i;
  renderInspList();   // re-render to update selected highlight

  const call = state.apiCalls[i];
  if (!call) { return; }

  // Header line
  const ver   = call.path?.match(/\/services\/data\/(v[\d.]+)\//)?.[1] || call.version || '';
  const short = call.path?.replace(/\/services\/data\/v[\d.]+/, '') || '';
  document.getElementById('insp-full-path').textContent =
    `${call.method}  ${ver}  ${short}  →  ${call.status || '…'}`;

  // Request pane
  const reqEl = document.getElementById('insp-req-body');
  if (call.requestBody) {
    try { reqEl.innerHTML = syntaxHighlight(JSON.stringify(JSON.parse(call.requestBody), null, 2)); }
    catch { reqEl.textContent = call.requestBody; }
  } else {
    reqEl.textContent = '(none)';
  }

  // Response pane
  const resEl = document.getElementById('insp-res-body');
  if (call.responseBody) {
    try { resEl.innerHTML = syntaxHighlight(JSON.stringify(JSON.parse(call.responseBody), null, 2)); }
    catch { resEl.textContent = call.responseBody; }
  } else {
    resEl.textContent = '(none)';
  }
}

window.copyInspPane = function(pane) {
  const call = state.apiCalls[state.selectedInspIdx];
  if (!call) { return; }
  const text = pane === 'req' ? (call.requestBody || '') : (call.responseBody || '');
  navigator.clipboard.writeText(text).catch(() => {});
};

// ── Log ───────────────────────────────────────────────────────────────────────
function log(text, level = 'info') {
  const logEl = document.getElementById('bp-log');
  const line  = document.createElement('div');
  const ts    = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  line.className = `log-line log-${level}`;
  line.textContent = `[${ts}] ${text}`;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function syntaxHighlight(json) {
  let s = typeof json === 'string' ? json : JSON.stringify(json, null, 2);
  s = s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return s.replace(/("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, m => {
    let cls = 'color:var(--grn)';
    if (/^"/.test(m)) cls = /:$/.test(m) ? 'color:var(--sky)' : 'color:var(--amb)';
    else if (/true|false/.test(m)) cls = 'color:var(--pri)';
    else if (/null/.test(m)) cls = 'color:var(--fg3)';
    return `<span style="${cls}">${m}</span>`;
  });
}

// ── Bottom panel drag-to-resize ───────────────────────────────────────────────
function startBpResize(e) {
  e.preventDefault();
  const panel = document.getElementById('bottom-panel');
  const startY = e.clientY;
  const startH = panel.offsetHeight;
  function onMove(ev) {
    const newH = Math.max(80, Math.min(window.innerHeight * 0.8, startH - (ev.clientY - startY)));
    panel.style.height = newH + 'px';
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}
