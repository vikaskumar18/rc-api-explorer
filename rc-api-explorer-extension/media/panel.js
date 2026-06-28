const vscode = acquireVsCodeApi();
function vscMsg(m){ vscode.postMessage(m); }

// ── Global API version default (user-configurable in sidebar) ────────────────
let DEFAULT_API_VERSION = 'v66.0';

function setGlobalVersion(val) {
  const v = val.trim();
  if (!v) return;
  DEFAULT_API_VERSION = v;
  // Update all open tab version inputs
  document.querySelectorAll('.try-ver').forEach(el => {
    el.value = DEFAULT_API_VERSION;
    const tabId = el.id.replace(/^(try-ver-|cr-ver-)/, '');
    applyVersionChange(tabId);
  });
}

// ── State ────────────────────────────────────────────────────────────────────
let endpoints = [];
let orgs = [];
let orgVars = {};
let varsOrg = '';
let activeEnvVars = {};
let activeEnvName = '';
let envs = [];
let history = [];
let customRequests = [];
let playbooks = [];
let customPlaybooks = [];
let chainConfig = { defaultMode:'playbook', defaultExecution:'hybrid' };
let chainSession = null;
let runs = [];
let chainMode = 'playbook';
let chainExec = 'hybrid';
let selPlaybook = null;

let curFilter = 'all';
let reqCounter = 0;
const pendingReqs = {};

// Tab state
let tabs = [];
let activeTabId = null;
let tabCounter = 0;

// Endpoint list extras
let pinnedEps = new Set(JSON.parse(localStorage.getItem('rc-pinned')||'[]'));
let collapsedCats = new Set(JSON.parse(localStorage.getItem('rc-collapsed')||'[]'));

// Diff baselines (keyed by label slug, supports cross-tab compare)
let _diffBaselines = {};

// Org picker debounce timer
let _oppDebTimer = null;

// History pagination
let _histPage = 0;

// PST collapsed nodes
let _pstCollapsed = {};

// ── Message handler ───────────────────────────────────────────────────────────
window.addEventListener('message', e => {
  const m = e.data;
  if(m.type === 'init'){
    endpoints      = m.endpoints      || [];
    orgs           = m.orgs           || [];
    orgVars        = m.vars           || {};
    varsOrg        = m.varsOrg        || '';
    activeEnvVars  = m.activeEnvVars  || {};
    activeEnvName  = m.activeEnvName  || '';
    envs           = m.envs           || [];
    history        = m.history        || [];
    customRequests = m.customRequests || [];
    playbooks      = m.playbooks      || [];
    customPlaybooks = m.customPlaybooks || [];
    chainConfig    = m.chainConfig    || chainConfig;
    runs           = m.runs           || [];
    chainMode      = chainConfig.defaultMode;
    chainExec      = chainConfig.defaultExecution;
    populateOrgs();
    render();
    renderCustomReqList();
    _loadCollectionCatalog();
    renderPlaybookCards();
    renderRunHistory();
    renderEnvsPanel();
    renderHistory();
    updateEnvBadge();
    if(!document.getElementById('org-picker-popup')){
      document.body.insertAdjacentHTML('beforeend',
        '<div id="org-picker-popup" style="display:none;position:fixed;z-index:9999;min-width:320px;max-width:420px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;box-shadow:0 4px 24px rgba(0,0,0,.5);padding:12px">'+
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'+
        '<span style="font-size:12px;font-weight:600;color:var(--fg)">Browse Org Records</span>'+
        '<button onclick="closeOrgPicker()" style="background:none;border:none;color:var(--fg3);font-size:14px;cursor:pointer;line-height:1">&#10005;</button>'+
        '</div>'+
        '<div style="display:flex;gap:6px;margin-bottom:8px">'+
        '<select id="opp-type" style="flex:1;background:var(--bg2);border:1px solid var(--border);color:var(--fg);border-radius:4px;font-size:11px;padding:3px"></select>'+
        '<input id="opp-filter" placeholder="Name filter…" style="flex:2;background:var(--bg2);border:1px solid var(--border);border-radius:4px;color:var(--fg);font-size:11px;padding:3px 6px" oninput="clearTimeout(_oppDebTimer);_oppDebTimer=setTimeout(oppFetch,300)">'+
        '<button class="icon-btn" style="padding:2px 6px;color:var(--fg3);font-size:12px" onclick="document.getElementById(\'opp-filter\').value=\'\';oppFetch()" title="Clear filter">&#10005;</button>'+
        '<button class="btn btn-sec" style="font-size:11px;padding:3px 8px" onclick="oppFetch()">Fetch</button>'+
        '</div>'+
        '<div id="opp-results" style="max-height:220px;overflow-y:auto"></div>'+
        '</div>'
      );
      document.addEventListener('click', function(e){
        const popup=document.getElementById('org-picker-popup');
        if(popup&&popup.style.display!=='none'&&!popup.contains(e.target)&&!e.target.dataset.opp){
          closeOrgPicker();
        }
      }, true);
    }
  } else if(m.type === 'envsUpdated'){
    envs          = m.envs          || [];
    activeEnvName = m.activeEnvName || '';
    activeEnvVars = m.activeEnvVars || {};
    orgVars = activeEnvVars;
    renderEnvsPanel();
    updateEnvBadge();
  } else if(m.type === 'historyUpdated'){
    history = m.history || [];
    _histPage = 0;
    renderHistory();
  } else if(m.type === 'varsLoaded'){
    orgVars = m.vars || {};
    varsOrg = m.orgAlias || '';
  } else if(m.type === 'orgsRefreshed'){
    orgs = m.orgs || [];
    populateOrgs();
    setOrgStatus('ok', orgs.length+' org'+(orgs.length!==1?'s':'')+' loaded');
  } else if(m.type === 'orgsError'){
    setOrgStatus('err','Error: '+m.error);
  } else if(m.type === 'sessionExpired'){
    setOrgStatus('err','⚠ Session expired — run: sf org login web --alias '+m.orgAlias);
  } else if(m.type === 'loading'){
    setOrgStatus('',m.message);
  } else if(m.type === 'execResult'){
    const cb = pendingReqs[m.requestId];
    if(cb){ cb(m); delete pendingReqs[m.requestId]; }
  } else if(m.type === 'chainStarted'){
    chainSession = m.session;
    renderChainTimeline();
  } else if(m.type === 'chainSessionUpdated'){
    chainSession = m.session;
    renderChainTimeline();
  } else if(m.type === 'chainStepStarted'){
    if(chainSession){ chainSession.steps[m.stepIdx].status = 'running'; }
    renderChainTimeline();
  } else if(m.type === 'chainStepDone'){
    chainSession = m.session;
    renderChainTimeline();
  } else if(m.type === 'chainCompositePayload'){
    const ta = document.getElementById('chain-composite-payload');
    if(ta) ta.value = JSON.stringify(m.payload, null, 2);
    const wrap = document.getElementById('chain-composite-wrap');
    if(wrap) wrap.style.display = 'block';
    const rw = document.getElementById('chain-composite-resp-wrap');
    if(rw) rw.style.display = 'none';
  } else if(m.type === 'chainCompositeResult'){
    try{
      const el = document.getElementById('chain-composite-resp');
      const rw = document.getElementById('chain-composite-resp-wrap');
      if(el) el.textContent = JSON.stringify(JSON.parse(m.result.body),null,2);
      if(rw) rw.style.display = 'block';
    }catch(_){}
  } else if(m.type === 'orgQueryResult'){
    const pending = seedPending[m.requestId];
    if(pending){
      delete seedPending[m.requestId];
      if(pending.isOpp){
        _renderOppResults(pending.recipe, m.records||[], m.error, pending);
      } else {
        _renderSeedResults(pending.stepIdx, pending.recipe, m.records||[], m.error);
      }
    }
  } else if(m.type === 'chainRunLoaded'){
    renderLoadedRun(m.run);
  } else if(m.type === 'relaunchRun'){
    relaunchRun(m.run);
  } else if(m.type === 'runsRefreshed'){
    runs = m.runs || [];
    renderRunHistory();
  } else if(m.type === 'openImportModal'){
    showImportModal();
  } else if(m.type === 'postmanTree'){
    _pmLoadTree(m.tree);
  } else if(m.type === 'postmanFetchError'){
    const errEl=document.getElementById('pm-fetch-error');
    if(errEl){ errEl.textContent='Error: '+m.message; errEl.style.display='block'; }
  } else if(m.type === 'collectionCatalogLoaded'){
    _renderCatalogBtns(m.catalog||[]);
  } else if(m.type === 'collectionCatalogError'){
    const el=document.getElementById('catalog-btn-list');
    if(el) el.innerHTML='<span style="font-size:10px;color:var(--red)">Failed to load. </span><button class="icon-btn" style="font-size:10px;padding:1px 6px" onclick="_loadCollectionCatalog()">&#8635; Retry</button>';
  } else if(m.type === 'postmanEnvLoaded'){
    _pmEnvLoaded(m.vars||[], m.name||'');
  } else if(m.type === 'toast'){
    showToast(m.message, m.kind||'info');
  } else if(m.type === 'customRequestsUpdated'){
    customRequests = m.customRequests || [];
    renderCustomReqList();
    if(m.savedId) openCustomRequest(m.savedId);
  } else if(m.type === 'permAssignResult'){
    const statusEl=document.getElementById('perm-status-'+m.pbId);
    if(statusEl) statusEl.textContent=m.error ? '✗ '+m.error : '✓ Done — reload org session to apply';
    (m.results||[]).forEach(r=>{
      const chip=document.getElementById('perm-chip-'+m.pbId+'-'+r.apiName);
      if(chip){
        chip.style.background=r.ok ? 'var(--green-bg,#0d3b2e)' : 'var(--red-bg,#3b0d0d)';
        chip.style.color=r.ok ? 'var(--green,#4ec9b0)' : 'var(--red,#f44747)';
        chip.style.borderColor=r.ok ? 'var(--green,#4ec9b0)' : 'var(--red,#f44747)';
        chip.title=r.ok ? 'Assigned' : (r.error||'Failed');
      }
    });
  } else if(m.type === 'customPlaybooksList'){
    customPlaybooks = m.playbooks || [];
    renderPlaybookCards();
  }
});

// ── Rail ─────────────────────────────────────────────────────────────────────
function switchRail(panel){
  document.querySelectorAll('.rail-btn').forEach(b => b.classList.remove('on'));
  document.querySelectorAll('.sb-panel').forEach(p => p.classList.remove('on'));
  const btn = document.querySelector('.rail-btn[data-panel="'+panel+'"]');
  if(btn) btn.classList.add('on');
  const sb = document.getElementById('sb-'+panel);
  if(sb) sb.classList.add('on');
  // Reload catalog if it failed or is still showing Loading
  if(panel==='requests'){
    const el=document.getElementById('catalog-btn-list');
    if(el&&(el.innerHTML.includes('Loading')||el.innerHTML.includes('Failed'))) _loadCollectionCatalog();
  }
}

// ── Orgs ──────────────────────────────────────────────────────────────────────
function populateOrgs(){
  const sel = document.getElementById('org-select');
  if(!orgs.length){
    sel.innerHTML = '<option value="">No authenticated orgs found</option>';
    setOrgStatus('err','Run: sf org login web  to authenticate');
    return;
  }
  sel.innerHTML = orgs.map(o=>
    '<option value="'+esc(o.alias)+'"'+(o.isDefault?' selected':'')+'>'+
    esc(o.alias)+(o.alias!==o.username?' ('+esc(o.username)+')':'')+
    (o.isDefault?' ★':'')+
    '</option>'
  ).join('');
  if(!sel.value) sel.value = orgs[0].alias;
  setOrgStatus('ok', orgs.length+' org'+(orgs.length!==1?'s':'')+' loaded');
  const clearBtn = document.getElementById('org-clear-btn');
  if(clearBtn && sel.value) clearBtn.style.display = '';
}

function setOrgStatus(cls, txt){
  const el = document.getElementById('org-status');
  el.className = 'org-status'+(cls?' '+cls:'');
  el.textContent = txt;
}

function onOrgChange(){
  const alias = document.getElementById('org-select').value;
  const org = orgs.find(o=>o.alias===alias);
  if(org) setOrgStatus('ok',org.username);
  if(alias){
    vscMsg({type:'loadVars', orgAlias:alias});
    vscMsg({type:'preWarmToken', orgAlias:alias}); // kick off token refresh in background
  }
  const clearBtn = document.getElementById('org-clear-btn');
  if(clearBtn) clearBtn.style.display = alias ? '' : 'none';
}

function clearOrg(){
  const sel = document.getElementById('org-select');
  if(sel){ sel.value = ''; }
  const clearBtn = document.getElementById('org-clear-btn');
  if(clearBtn) clearBtn.style.display = 'none';
  setOrgStatus('', '');
}

function refreshOrgs(){ vscMsg({type:'refreshOrgs'}); setOrgStatus('','Refreshing…'); }

// ── Endpoint list ─────────────────────────────────────────────────────────────
const CAT_LABELS = {
  PCM:'Product Catalog Mgmt', Discovery:'Product Discovery',
  Pricing:'Salesforce Pricing', Rate:'Rate Management',
  Configurator:'Configurator', Transaction:'Transaction Mgmt',
  Usage:'Usage Management', Billing:'Billing', DRO:'DRO & Fulfillment',
  Context:'Context Service'
};
const CATS = ['PCM','Discovery','Pricing','Rate','Configurator','Transaction','Usage','Billing','DRO','Context'];

function setF(f, btn){
  curFilter = f;
  document.querySelectorAll('#filter-bar .fb').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  render();
}

function render(){
  const q = (document.getElementById('search')||{}).value?.toLowerCase()||'';
  const list = document.getElementById('ep-list');
  let html = '';

  // Pinned section
  const pinned = endpoints.filter(e=>pinnedEps.has(e.id)&&(
    !q||e.name.toLowerCase().includes(q)||e.path.toLowerCase().includes(q)
  ));
  if(pinned.length){
    html += '<div class="sec-hdr" style="cursor:default"><span>★ Pinned</span></div>';
    pinned.forEach(ep=>{ html += epRow(ep, true); });
  }

  CATS.forEach(cat=>{
    if(curFilter!=='all'&&curFilter!==cat) return;
    const eps = endpoints.filter(e=>e.category===cat&&!pinnedEps.has(e.id)&&(
      !q||e.name.toLowerCase().includes(q)||e.path.toLowerCase().includes(q)||e.desc.toLowerCase().includes(q)
    ));
    if(!eps.length) return;
    const collapsed = collapsedCats.has(cat);
    html += '<div class="sec-hdr'+(collapsed?' collapsed':'')+'" onclick="toggleCategory(\''+cat+'\')">' +
      '<span class="chevron">&#9660;</span>' +
      '<span>'+(CAT_LABELS[cat]||cat)+'</span>' +
      '<span style="margin-left:auto;color:var(--fg3);font-weight:400">'+eps.length+'</span>' +
      '</div>';
    if(!collapsed){
      eps.forEach(ep=>{ html += epRow(ep, false); });
    }
  });
  list.innerHTML = html||'<div style="padding:20px 14px;color:var(--fg3);font-size:12px">No endpoints found.</div>';
}

function epRow(ep, isPinned){
  const tabExists = tabs.find(t=>t.type==='endpoint'&&t.epId===ep.id);
  const mc = ep.methods.length>1?'MULTI':ep.methods[0];
  const ml = ep.methods.length>1?ep.methods.join('/'):ep.methods[0];
  const pinned = pinnedEps.has(ep.id);
  return '<div class="ep'+(tabExists?' sel':'')+(isPinned?' pinned-item':'')+'" onclick="showEp(\''+ep.id+'\')">'+
    '<div class="ep-body">'+
    '<div class="ep-top"><span class="mb '+mc+'">'+ml+'</span>'+
    '<span class="ep-name">'+esc(ep.name)+'</span></div>'+
    '<div class="ep-path">'+esc(ep.path)+'</div></div>'+
    '<button class="ep-pin'+(pinned?' pinned':'')+'" onclick="event.stopPropagation();togglePin(\''+ep.id+'\')" title="'+(pinned?'Unpin':'Pin')+'">'+(pinned?'★':'☆')+'</button>'+
    '<button class="ep-pin" onclick="event.stopPropagation();cloneEpToCustom(\''+ep.id+'\')" title="Clone to Saved Requests">&#128203;</button>'+
    '</div>';
}

function cloneEpToCustom(epId){
  const ep=endpoints.find(function(e){ return e.id===epId; });
  if(!ep) return;
  const method=ep.methods[0]||'GET';
  vscMsg({type:'saveCustomRequest', name:ep.name, method:method, path:ep.path,
    headers:{}, body:'', category:'RC API — '+ep.category, description:ep.desc||''});
  showToast('Cloned to Saved Requests','info');
}

function toggleCategory(cat){
  if(collapsedCats.has(cat)) collapsedCats.delete(cat);
  else collapsedCats.add(cat);
  localStorage.setItem('rc-collapsed', JSON.stringify([...collapsedCats]));
  render();
}
function collapseAll(){
  CATS.forEach(c=>collapsedCats.add(c));
  localStorage.setItem('rc-collapsed', JSON.stringify([...collapsedCats]));
  render();
}
function expandAll(){
  collapsedCats.clear();
  localStorage.setItem('rc-collapsed','[]');
  render();
}

function togglePin(epId){
  if(pinnedEps.has(epId)) pinnedEps.delete(epId);
  else pinnedEps.add(epId);
  localStorage.setItem('rc-pinned', JSON.stringify([...pinnedEps]));
  render();
}

// ── Tab system ────────────────────────────────────────────────────────────────
function openTab(type, entityId, label, buildFn){
  const existing = tabs.find(t=>
    (type==='endpoint'&&t.type==='endpoint'&&t.epId===entityId)||
    (type==='custom'&&t.type==='custom'&&t.reqId===entityId)
  );
  if(existing){ activateTab(existing.id); return existing.id; }

  const tabId = 'tab-'+(++tabCounter);
  tabs.push({ id:tabId, type, label, epId:entityId, reqId:entityId });
  renderTabBar();

  const panel = document.createElement('div');
  panel.id = 'tp-'+tabId;
  panel.className = 'tab-panel';
  document.getElementById('detail').appendChild(panel);
  if(buildFn) buildFn(panel, tabId);
  activateTab(tabId);
  return tabId;
}

function activateTab(tabId){
  activeTabId = tabId;
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('on'));
  const panel = document.getElementById('tp-'+tabId);
  if(panel){
    panel.classList.add('on');
    document.getElementById('tab-empty').style.display='none';
  }
  renderTabBar();
  render();
}

function closeTab(tabId){
  const idx = tabs.findIndex(t=>t.id===tabId);
  tabs.splice(idx,1);
  const panel = document.getElementById('tp-'+tabId);
  if(panel) panel.remove();
  delete cfgBuilderState[tabId];
  if(activeTabId===tabId){
    if(tabs.length) activateTab(tabs[Math.max(0,idx-1)].id);
    else{
      activeTabId=null;
      document.getElementById('tab-empty').style.display='flex';
      renderTabBar();
      render();
    }
  } else {
    renderTabBar();
  }
}

function renderTabBar(){
  const scroll = document.getElementById('tab-scroll');
  if(!scroll) return;
  scroll.innerHTML = tabs.map(t=>{
    const ep = t.type==='endpoint' ? endpoints.find(e=>e.id===t.epId) : null;
    const cr = t.type==='custom' ? customRequests.find(r=>r.id===t.reqId) : null;
    let mc = 'GET';
    if(ep) mc = ep.methods.length>1?'MULTI':ep.methods[0];
    else if(cr) mc = cr.method||'GET';
    else if(t.type==='new-custom') mc = 'GET';
    else if(t.type==='playbook') mc = '';
    else if(t.type==='history') mc = t.histMethod||'GET';
    const mbHtml = mc ? '<span class="tab-mb '+mc+'">'+(mc==='MULTI'?'M':mc.slice(0,1))+'</span>' : '◎ ';
    return '<div class="tab-item'+(t.id===activeTabId?' on':'')+'" onclick="activateTab(\''+t.id+'\')">'+
      mbHtml+
      '<span class="tab-label">'+esc(t.label)+'</span>'+
      '<button class="tab-close" onclick="event.stopPropagation();closeTab(\''+t.id+'\')">&#215;</button>'+
      '</div>';
  }).join('');
}

function closeAllTabs(){
  tabs.splice(0, tabs.length);
  document.querySelectorAll('.tab-panel').forEach(p=>p.remove());
  Object.keys(cfgBuilderState).forEach(k=>delete cfgBuilderState[k]);
  activeTabId=null;
  document.getElementById('tab-empty').style.display='flex';
  renderTabBar();
  render();
}

// ── Endpoint detail ───────────────────────────────────────────────────────────
function showEp(id){
  const ep = endpoints.find(e=>e.id===id);
  if(!ep) return;

  openTab('endpoint', id, ep.name, (panel, tabId)=>{
    buildEpPanel(panel, tabId, ep);
  });
  render();
}

function buildEpPanel(panel, tabId, ep){
  const mc = ep.methods.length>1?'MULTI':ep.methods[0];
  const ml = ep.methods.join(' / ');

  // Params tab content
  let paramsHtml;
  if(!ep.params||!ep.params.length){
    paramsHtml = '<p class="no-p">No parameters documented.</p>';
  } else {
    paramsHtml = '<table><thead><tr><th>Parameter</th><th>Type</th><th>Location</th><th>Required</th><th>Description</th></tr></thead><tbody>'+
      ep.params.map(p=>{
        const loc = p.location||(ep.methods.includes('GET')?'query':'body');
        const locColor = loc==='query'?'#7c6f00':loc==='path'?'#7a3a00':'#1a5276';
        const locBg    = loc==='query'?'#fef9c3':loc==='path'?'#fde8d8':'#d6eaf8';
        return '<tr><td><span class="pn">'+esc(p.name)+'</span></td>'+
          '<td style="font-family:monospace;color:var(--fg2);font-size:11px">'+esc(p.type)+'</td>'+
          '<td><span style="font-size:10px;padding:2px 6px;border-radius:3px;font-family:monospace;color:'+locColor+';background:'+locBg+'">'+loc+'</span></td>'+
          '<td><span class="'+(p.req?'preq':'popt')+'">'+(p.req?'Required':'Optional')+'</span></td>'+
          '<td style="color:var(--fg2)">'+esc(p.desc)+'</td></tr>';
      }).join('')+
      '</tbody></table>';
  }

  const builderCta = (ep.id === 'txn-9')
    ? '<div style="margin:8px 0 10px;padding:8px 10px;background:var(--bg3);border-radius:6px;border-left:3px solid var(--acc)">'+
      '<span style="font-size:11px;color:var(--fg2)">This API is complex — use the visual builder instead.</span>'+
      ' <button class="btn btn-pri" onclick="openPstBuilderTab()" style="font-size:11px;padding:3px 10px">&#9889; Open PST Builder</button>'+
      '</div>'
    : (ep.id === 'txn-8')
    ? '<div style="margin:8px 0 10px;padding:8px 10px;background:var(--bg3);border-radius:6px;border-left:3px solid #27ae60">'+
      '<span style="font-size:11px;color:var(--fg2)">This API is complex — use the visual builder instead.</span>'+
      ' <button class="btn btn-pri" onclick="openOrderBuilderTab()" style="font-size:11px;padding:3px 10px;background:#27ae60">&#128220; Open Order Builder</button>'+
      '</div>'
    : (ep.id === 'txn-13')
    ? '<div style="margin:8px 0 10px;padding:8px 10px;background:var(--bg3);border-radius:6px;border-left:3px solid #8e44ad">'+
      '<span style="font-size:11px;color:var(--fg2)">This API is complex — use the visual builder instead.</span>'+
      ' <button class="btn btn-pri" onclick="openSwapBuilderTab()" style="font-size:11px;padding:3px 10px;background:#8e44ad">&#8646; Open Swap Builder</button>'+
      '</div>'
    : (['cfg-1','cfg-3','cfg-5','cfg-7','cfg-8','cfg-9','cfg-10'].indexOf(ep.id) >= 0)
    ? '<div style="margin:8px 0 10px;padding:8px 10px;background:#e67e2215;border-radius:6px;border-left:3px solid #e67e22">'+
      '<span style="font-size:11px;color:var(--fg2)"><b>Stateful session API</b> — <code>contextId</code> must flow through every call.</span>'+
      ' <span style="font-size:11px;color:var(--fg3)">load-instance → add-nodes → save-instance</span>'+
      ' <button class="btn" onclick="openCfgBuilderTab()" style="font-size:11px;padding:3px 10px;background:#e67e22;color:#fff;border-color:#e67e22;margin-left:8px">&#9881; Configurator Builder</button>'+
      '</div>'
    : '';

  const hasExamples = !!ep.examples;

  panel.innerHTML =
    '<div class="d-title">'+esc(ep.name)+'</div>'+
    '<div class="d-meta">'+
      '<span class="mb '+mc+'">'+ml+'</span>'+
      '<span class="d-ver">'+esc(ep.version)+'</span>'+
    '</div>'+
    '<div class="d-desc">'+esc(ep.desc)+'</div>'+
    '<div class="d-path">/services/data/'+(DEFAULT_API_VERSION||ep.version||'v66.0')+esc(ep.path)+'</div>'+
    '<div class="d-src">PDF source: book page ~'+esc(ep.page)+' — Revenue Cloud Dev Guide v67.0</div>'+
    builderCta+
    '<div class="tabs">'+
      '<div class="tab on"  onclick="showSubTab(\'params\',this,\''+tabId+'\')">Parameters</div>'+
      '<div class="tab"     onclick="showSubTab(\'request\',this,\''+tabId+'\')">Request</div>'+
      '<div class="tab"     onclick="showSubTab(\'response\',this,\''+tabId+'\')">Response</div>'+
      (hasExamples?'<div class="tab" onclick="showSubTab(\'examples\',this,\''+tabId+'\')">&#128218; Examples</div>':'')+
      '<div class="tab"     onclick="showSubTab(\'tryit\',this,\''+tabId+'\')">&#9654; Try It</div>'+
    '</div>'+
    '<div id="stp-params-'+tabId+'" class="tp on">'+paramsHtml+'</div>'+
    '<div id="stp-request-'+tabId+'" class="tp"><pre>'+esc(ep.request)+'</pre></div>'+
    '<div id="stp-response-'+tabId+'" class="tp"><pre>'+esc(ep.response)+'</pre></div>'+
    (hasExamples?'<div id="stp-examples-'+tabId+'" class="tp">'+buildExamplesPanel(ep,tabId)+'</div>':'')+
    '<div id="stp-tryit-'+tabId+'" class="tp"></div>';

  buildTryIt(ep, tabId);

  // Wire up paste auto-prettify
  setTimeout(()=>{
    const tb = document.getElementById('try-body-'+tabId);
    if(tb) tb.addEventListener('paste', e=>{
      setTimeout(()=>{
        try{ tb.value=JSON.stringify(JSON.parse(tb.value),null,2); }catch(_){}
      },10);
    });
  },0);
}

function buildExamplesPanel(ep, tabId){
  if(!ep.examples||!ep.examples.length) return '';
  const cards = ep.examples.map(function(ex, i){
    const badgeColor = ex.type==='initiate'?'#2980b9': ex.type==='modify'?'#27ae60': ex.type==='order'?'#e67e22':'#8e44ad';
    const badgeLabel = ex.type==='initiate'?'Initiate': ex.type==='modify'?'Modify': ex.type==='order'?'Order':'Example';
    return '<div style="margin-bottom:12px;border:1px solid var(--border);border-radius:6px;overflow:hidden">'+
      '<div style="padding:8px 12px;background:var(--bg3);display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--border)">'+
        '<span style="font-size:10px;padding:2px 7px;border-radius:3px;background:'+badgeColor+';color:#fff;font-weight:600">'+esc(badgeLabel)+'</span>'+
        '<span style="font-size:12px;font-weight:600;color:var(--fg2)">'+esc(ex.label)+'</span>'+
        '<button class="btn btn-sec" style="margin-left:auto;font-size:10px;padding:2px 8px" '+
          'onclick="loadExample(\''+tabId+'\','+i+')" title="Load this payload into the Try It tab">'+
          '&#9654; Load into Try It</button>'+
      '</div>'+
      '<div style="padding:8px 12px;font-size:11px;color:var(--fg3);border-bottom:1px solid var(--border)">'+esc(ex.desc)+'</div>'+
      (ex.steps?'<div style="padding:6px 12px;background:var(--bg2)">'+
        ex.steps.map(function(s){ return '<div style="font-size:11px;color:var(--fg2);padding:2px 0;display:flex;gap:6px"><span style="color:var(--acc)">→</span>'+esc(s)+'</div>'; }).join('')+
      '</div>':'')+
      (ex.body?'<pre style="margin:0;padding:10px 12px;font-size:11px;overflow-x:auto;background:var(--bg1);max-height:260px;overflow-y:auto">'+esc((function(){try{return JSON.stringify(JSON.parse(ex.body),null,2);}catch(_){return ex.body;}})())+'</pre>':'')+
    '</div>';
  }).join('');
  return '<div style="padding:4px 2px 8px">'+
    '<div style="font-size:11px;color:var(--fg3);margin-bottom:10px;padding:6px 10px;background:var(--bg3);border-radius:4px;border-left:3px solid var(--acc)">'+
      'Click <b>▶ Load into Try It</b> on any example to copy the payload and switch to the Try It tab.'+
    '</div>'+cards+'</div>';
}

function loadExample(tabId, exIdx){
  const panel = document.getElementById('tp-'+tabId);
  if(!panel) return;
  const tab = tabs.find(function(t){ return t.id===tabId; });
  if(!tab) return;
  const ep = endpoints.find(function(e){ return e.id===tab.epId; });
  if(!ep||!ep.examples||!ep.examples[exIdx]) return;
  const ex = ep.examples[exIdx];
  // Switch to Try It tab
  const tryItTab = panel.querySelector('.tab:last-child');
  panel.querySelectorAll('.tab').forEach(function(t){ t.classList.remove('on'); });
  if(tryItTab) tryItTab.classList.add('on');
  panel.querySelectorAll('.tp').forEach(function(t){ t.classList.remove('on'); });
  const tryItPanel = document.getElementById('stp-tryit-'+tabId);
  if(tryItPanel) tryItPanel.classList.add('on');
  // Load body into Try It textarea
  const bodyEl = document.getElementById('try-body-'+tabId);
  if(bodyEl){
    try{ bodyEl.value = JSON.stringify(JSON.parse(ex.body), null, 2); }
    catch(_){ bodyEl.value = ex.body; }
    bodyEl.dispatchEvent(new Event('input'));
  }
  showToast('Loaded: '+ex.label,'ok');
}

function showSubTab(name, clicked, tabId){
  const panel = document.getElementById('tp-'+tabId);
  if(!panel) return;
  panel.querySelectorAll('.tab').forEach(t=>t.classList.remove('on'));
  panel.querySelectorAll('.tp').forEach(p=>p.classList.remove('on'));
  if(clicked) clicked.classList.add('on');
  const tp = document.getElementById('stp-'+name+'-'+tabId);
  if(tp) tp.classList.add('on');
}

function buildTryIt(ep, tabId){
  const method = ep.methods[0];
  const hasBody = ['POST','PUT','PATCH'].includes(method);
  const epVersion = DEFAULT_API_VERSION || ep.version || 'v66.0';
  const fullPath = '/services/data/'+epVersion+ep.path;
  const methodOpts = ep.methods.map(m=>'<option value="'+m+'"'+(m===method?' selected':'')+'>'+m+'</option>').join('');

  const queryParams = (ep.params||[]).filter(p=>{
    const loc = p.location||(ep.methods.includes('GET')?'query':'body');
    return loc==='query';
  });
  const querySection = queryParams.length
    ? '<div class="try-sec"><div class="try-lbl">Query Parameters</div>'+
      '<table style="width:100%;border-collapse:collapse">'+
      queryParams.map(p=>'<tr>'+
        '<td style="padding:3px 6px;font-family:monospace;font-size:11px;width:160px">'+esc(p.name)+'</td>'+
        '<td style="padding:3px 6px;display:flex;align-items:center;gap:3px">'+
        '<input class="try-inp" id="qp-'+esc(p.name)+'-'+tabId+'" placeholder="'+esc(p.type)+'" style="font-size:11px;flex:1">'+
        '<button data-opp="1" onclick="openOrgPicker(this,\''+esc(p.name)+'\')" title="Browse org records" style="background:none;border:none;color:var(--accent,#569cd6);cursor:pointer;font-size:14px;padding:0 2px;line-height:1;flex-shrink:0">&#8853;</button>'+
        '</td>'+
        '<td style="padding:3px 6px;color:var(--fg3);font-size:10px;min-width:180px">'+esc(p.desc.split('.')[0])+'</td></tr>'
      ).join('')+'</table></div>' : '';

  const pathParams = (ep.params||[]).filter(p => p.location === 'path');
  const pathParamSection = pathParams.length
    ? '<div class="try-sec"><div class="try-lbl">Path Parameters</div>'+
      '<table style="width:100%;border-collapse:collapse">'+
      pathParams.map(p =>
        '<tr>'+
        '<td style="padding:3px 6px;font-family:monospace;font-size:11px;width:160px">'+esc(p.name)+'</td>'+
        '<td style="padding:3px 6px;display:flex;align-items:center;gap:3px">'+
        '<input class="try-inp" id="pp-'+esc(p.name)+'-'+tabId+
          '" placeholder="'+esc(p.type)+'" value="'+esc(activeEnvVars[p.name.toUpperCase()]||activeEnvVars[p.name]||'')+
          '" oninput="applyPathParam(\''+tabId+'\')" style="font-size:11px;flex:1">'+
        '<button data-opp="1" onclick="openOrgPicker(this,\''+esc(p.name)+'\')" title="Browse org records" style="background:none;border:none;color:var(--accent,#569cd6);cursor:pointer;font-size:14px;padding:0 2px;line-height:1;flex-shrink:0">&#8853;</button>'+
        '</td>'+
        '<td style="padding:3px 6px;color:var(--fg3);font-size:10px;min-width:180px">'+esc(p.desc.split('.')[0])+'</td>'+
        '</tr>'
      ).join('')+'</table></div>'
    : '';

  // Quick var fill
  const unresolvedVars = (ep.request||'').match(/\{\{([A-Z0-9_]+)\}\}/g)||[];
  const uniqueVars = [...new Set(unresolvedVars.map(v=>v.slice(2,-2)))];
  const varFillSection = uniqueVars.length
    ? '<div class="var-quick-fill">'+
      '<div class="vqf-title">&#9888; Quick Variable Fill</div>'+
      uniqueVars.map(v=>'<div class="var-quick-row" style="display:flex;align-items:center;gap:4px">'+
        '<label style="min-width:120px">{{'+esc(v)+'}}</label>'+
        '<input class="try-inp" id="vqf-'+v+'-'+tabId+'" placeholder="'+esc(v)+'" value="'+esc(activeEnvVars[v]||'')+'" oninput="setQuickVar(\''+v+'\',this.value,\''+tabId+'\')" style="font-size:11px;flex:1">'+
        '<button data-opp="1" onclick="openOrgPicker(this,\''+esc(v.toLowerCase())+'\')" title="Browse org records" style="background:none;border:none;color:var(--accent,#569cd6);cursor:pointer;font-size:14px;padding:0 2px;line-height:1;flex-shrink:0">&#8853;</button>'+
        '</div>'
      ).join('')+
      '</div>' : '';

  const prefilledRequest = applyVars(ep.request||'');
  const bodySection = hasBody
    ? '<div class="try-sec">'+
      '<div class="try-lbl">Request Body (JSON)</div>'+
      varFillSection+
      '<textarea class="try-body" id="try-body-'+tabId+'" onkeydown="if((event.ctrlKey||event.metaKey)&&event.key===\'Enter\'){event.preventDefault();execute(\''+tabId+'\')}">'+escTA(prefilledRequest)+'</textarea>'+
      '<div class="btn-row" style="margin-top:6px">'+
      '<button class="btn btn-sec" onclick="fmtBody(\''+tabId+'\')">Format JSON</button>'+
      '<button class="btn btn-sec" onclick="clearBody(\''+tabId+'\')">Clear</button>'+
      '</div></div>'
    : '<div id="try-body-'+tabId+'" style="display:none"></div>';

  const tryitEl = document.getElementById('stp-tryit-'+tabId);
  if(!tryitEl) return;
  tryitEl.innerHTML =
    '<div class="try-tip">Execute directly against your Salesforce org. Select an org, edit path/body, hit <b>Execute</b>.</div>'+
    '<div class="try-sec"><div class="try-lbl">Method &amp; Path</div>'+
    '<div class="try-row">'+
    '<select class="try-sel" id="try-method-'+tabId+'">'+methodOpts+'</select>'+
    '<input class="try-ver" id="try-ver-'+tabId+'" value="'+esc(epVersion)+'" title="API version (editable)" oninput="applyVersionChange(\''+tabId+'\')" style="width:54px;font-family:monospace;font-size:11px;text-align:center;flex-shrink:0">'+
    '<input class="try-inp" id="try-path-'+tabId+'" value="'+esc(fullPath)+'" style="font-family:monospace;font-size:11px">'+
    '</div></div>'+
    '<div class="btn-row">'+
    '<button class="btn btn-pri" id="exec-btn-'+tabId+'" onclick="execute(\''+tabId+'\')" title="Execute (⌘↵ / Ctrl+Enter)">&#9654; Execute <span style="font-size:9px;opacity:.6">⌘↵</span></button>'+
    '<button class="btn btn-sec" onclick="validateBody(\''+tabId+'\')">&#10003; Validate</button>'+
    '<div style="flex:1"></div>'+
    '<button class="btn btn-sec" onclick="setDiffBaseline(null,null,\''+tabId+'\')" title="Set response as diff baseline">&#9638; Baseline</button>'+
    '<button class="btn btn-sec" id="diff-btn-'+tabId+'" onclick="showDiff(\''+tabId+'\')" disabled title="Diff with baseline">Diff</button>'+
    '<button class="btn btn-sec" onclick="copyCurl(\''+tabId+'\')">cURL</button>'+
    '<button class="btn btn-sec" onclick="copyApex(\''+tabId+'\')">Apex</button>'+
    '<button class="btn btn-sec" onclick="copyJs(\''+tabId+'\')">JS</button>'+
    '</div>'+
    pathParamSection+
    querySection+
    bodySection+
    '<div id="try-validation-'+tabId+'" style="margin-bottom:8px"></div>'+
    '<div class="try-sec">'+
    '<div class="try-lbl">Response</div>'+
    '<div id="try-status-pill-'+tabId+'" style="margin-bottom:8px"></div>'+
    '<div class="resp-toolbar" id="try-resp-toolbar-'+tabId+'" style="display:none">'+
      '<input placeholder="Search response…" oninput="respSearchTree(\''+tabId+'\',this.value)" style="flex:1;font-size:10px;padding:2px 6px;background:var(--bg2);border:1px solid var(--border);border-radius:4px;color:var(--fg);outline:none">'+
      '<button id="try-rtree-'+tabId+'" class="rt-btn active" onclick="switchRespMode(\''+tabId+'\',\'tree\',document.getElementById(\'try-rtree-'+tabId+'\'),document.getElementById(\'try-rraw-'+tabId+'\'))">Tree</button>'+
      '<button id="try-rraw-'+tabId+'"  class="rt-btn" onclick="switchRespMode(\''+tabId+'\',\'raw\',document.getElementById(\'try-rtree-'+tabId+'\'),document.getElementById(\'try-rraw-'+tabId+'\'))">Raw</button>'+
    '</div>'+
    '<div class="resp-box" id="try-resp-'+tabId+'" style="color:var(--fg3)">Response will appear here after execution.</div>'+
    '<div id="try-extract-'+tabId+'"></div></div>';
}

function applyPathParam(tabId){
  const tab = tabs.find(t => t.id === tabId);
  const ep = tab ? endpoints.find(e => e.id === tab.epId) : null;
  if(!ep) return;
  const pathEl = document.getElementById('try-path-'+tabId);
  if(!pathEl) return;
  const verEl = document.getElementById('try-ver-'+tabId);
  const ver = (verEl && verEl.value.trim()) || ep.version || 'v67.0';
  let path = '/services/data/' + ver + ep.path;
  (ep.params||[]).filter(p => p.location === 'path').forEach(p => {
    const el = document.getElementById('pp-'+p.name+'-'+tabId);
    const val = el && el.value.trim();
    if(val) path = path.replace('{'+p.name+'}', encodeURIComponent(val));
  });
  pathEl.value = path;
}

function applyVersionChange(tabId){
  const pathEl = document.getElementById('try-path-'+tabId);
  const verEl  = document.getElementById('try-ver-'+tabId);
  if(!pathEl || !verEl) return;
  const newVer = verEl.value.trim();
  if(!newVer) return;
  // Replace the version segment in the current path (e.g. v61.0 → v67.0)
  pathEl.value = pathEl.value.replace(/\/services\/data\/v[\d.]+\//, '/services/data/'+newVer+'/');
}


function setQuickVar(name, value, tabId){
  // Update the textarea live with the new var value
  const tb = document.getElementById('try-body-'+tabId);
  if(tb && tb.tagName==='TEXTAREA'){
    tb.value = tb.value.replace(
      new RegExp('\\{\\{'+name+'\\}\\}','g'), value||('{{'+name+'}}')
    );
  }
  // Also persist to active env
  if(activeEnvName) vscMsg({type:'setEnvVar', envName:activeEnvName, varName:name, value});
}

function execute(tabId){
  const orgAlias = document.getElementById('org-select').value;
  if(!orgAlias){ showToast('Select an org first.','error'); return; }
  const method = (document.getElementById('try-method-'+tabId)||{}).value||'GET';
  let path = (document.getElementById('try-path-'+tabId)||{}).value||'';

  // Append query params
  const tab = tabs.find(t=>t.id===tabId);
  const ep = tab ? endpoints.find(e=>e.id===tab.epId) : null;
  if(ep && ep.params){
    const qps = ep.params.filter(p=>{
      const loc = p.location||(ep.methods.includes('GET')?'query':'body');
      return loc==='query';
    });
    const filled = qps.map(p=>{
      const el = document.getElementById('qp-'+p.name+'-'+tabId);
      return el&&el.value.trim() ? p.name+'='+encodeURIComponent(el.value.trim()) : null;
    }).filter(Boolean);
    if(filled.length) path+=(path.includes('?')?'&':'?')+filled.join('&');
    // Substitute path params from dedicated inputs
    ep.params.filter(p => p.location === 'path').forEach(p => {
      const el = document.getElementById('pp-'+p.name+'-'+tabId);
      const val = el && el.value.trim();
      if(val) path = path.replace(new RegExp('\\{'+p.name+'\\}','g'), encodeURIComponent(val));
      if(el) el.style.borderColor = (p.req && !val) ? 'var(--red,#f44747)' : '';
    });
  }

  // Block execution if any required path params remain unfilled
  const unfilled = (path.match(/\{[^}]+\}/g)||[]);
  if(unfilled.length){
    showToast('Unfilled path params: '+unfilled.join(', '),'error');
    return;
  }

  const bodyEl = document.getElementById('try-body-'+tabId);
  let body = bodyEl && bodyEl.tagName==='TEXTAREA' ? bodyEl.value.trim() : '';
  body = applyVars(body);
  path = applyVars(path);

  validateBody(tabId);

  const btn    = document.getElementById('exec-btn-'+tabId);
  const resp   = document.getElementById('try-resp-'+tabId);
  const pill   = document.getElementById('try-status-pill-'+tabId);
  const extract= document.getElementById('try-extract-'+tabId);

  btnExecuting(btn);
  resp.style.color='var(--fg3)'; resp.textContent='Waiting for response…';
  if(pill) pill.innerHTML='';
  if(extract) extract.innerHTML='';

  const requestId = ++reqCounter;
  pendingReqs[requestId] = (result)=>{
    btnReady(btn, '▶ Execute');
    const st = result.status;
    const hint = handle401(result);
    setPill(pill, st, result.durationMs, hint);
    const toolbar=document.getElementById('try-resp-toolbar-'+tabId);
    setRespBox(resp, toolbar, result.body, st, tabId);

    // Enable diff button
    const diffBtn=document.getElementById('diff-btn-'+tabId);
    if(diffBtn&&Object.keys(_diffBaselines).length) diffBtn.disabled=false;

    // Status bar
    updateStatusBar(method, path, st, result.durationMs);

    // Save to vars
    let parsed=null; try{ parsed=JSON.parse(result.body); }catch(_){}
    if(parsed&&st>=200&&st<300&&extract){
      const ids=extractIds(parsed);
      if(ids.length){
        extract.innerHTML='<div style="margin-top:8px;font-size:11px;font-weight:600;color:var(--fg2);margin-bottom:4px">&#128190; Save to Variables</div>'+
          ids.map(({key,value})=>
            '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">'+
            '<span style="font-family:monospace;font-size:10px;color:var(--acc);min-width:140px;flex-shrink:0">{{'+esc(suggestVarName(key,value))+'}}</span>'+
            '<span style="font-size:11px;color:var(--fg2);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(value)+'</span>'+
            '<button class="btn btn-sec" style="font-size:10px;padding:2px 8px;flex-shrink:0" onclick="saveResponseVar(\''+esc(suggestVarName(key,value))+'\',\''+esc(value)+'\')">Save</button>'+
            '</div>'
          ).join('');
      }
    }
  };
  const apiVerEl = document.getElementById('try-ver-'+tabId);
  const apiVersion = (apiVerEl && apiVerEl.value.trim()) || ep?.version || 'v67.0';
  vscMsg({type:'executeApi', requestId, orgAlias, method, path, body, apiVersion,
    endpointId: ep?.id, endpointName: ep?.name});
}

function _jsonLineCol(str, pos){
  const before=str.slice(0,pos);
  const line=before.split('\n').length;
  const col=pos-before.lastIndexOf('\n');
  return 'line '+line+' col '+col;
}
function _jsonErrMsg(str, e){
  const m=e.message||'';
  const posMatch=m.match(/position (\d+)/i);
  if(posMatch){ return 'JSON error at '+_jsonLineCol(str,parseInt(posMatch[1]))+': '+m.replace(/\s*\(position \d+\)/i,''); }
  return 'Invalid JSON: '+m;
}
function fmtBody(tabId){
  const el=document.getElementById('try-body-'+tabId);
  if(!el||el.tagName!=='TEXTAREA') return;
  try{ el.value=JSON.stringify(JSON.parse(el.value),null,2); }
  catch(e){ showToast(_jsonErrMsg(el.value,e),'error'); }
}
function clearBody(tabId){
  const el=document.getElementById('try-body-'+tabId);
  if(el&&el.tagName==='TEXTAREA') el.value='';
}

function validateBody(tabId){
  const box=document.getElementById('try-validation-'+tabId);
  if(!box) return true;
  const tab=tabs.find(t=>t.id===tabId);
  const ep=tab?endpoints.find(e=>e.id===tab.epId):null;
  if(!ep){ box.innerHTML=''; return true; }

  const bodyEl=document.getElementById('try-body-'+tabId);
  const rawBody=bodyEl&&bodyEl.tagName==='TEXTAREA'?bodyEl.value.trim():'';
  const errors=[];

  const bodyParams=(ep.params||[]).filter(p=>{ const loc=p.location||(ep.methods.includes('GET')?'query':'body'); return loc==='body'&&p.req; });
  if(bodyParams.length&&rawBody){
    let parsed=null; try{ parsed=JSON.parse(rawBody); }catch(_){}
    if(parsed){
      // Invocable action format: {"inputs":[{...}]} — check inside inputs[0]
      const checkObj = (parsed.inputs&&Array.isArray(parsed.inputs)&&parsed.inputs[0]) ? parsed.inputs[0] : parsed;
      bodyParams.forEach(p=>{ if(checkObj[p.name]===undefined||checkObj[p.name]==='') errors.push('Missing required body param: <code>'+esc(p.name)+'</code>'); });
    }
    else if(rawBody) errors.push('Request body is not valid JSON');
  } else if(bodyParams.length&&!rawBody){ bodyParams.forEach(p=>errors.push('Missing required body param: <code>'+esc(p.name)+'</code>')); }

  const qParams=(ep.params||[]).filter(p=>{ const loc=p.location||(ep.methods.includes('GET')?'query':'body'); return loc==='query'&&p.req; });
  qParams.forEach(p=>{ const el=document.getElementById('qp-'+p.name+'-'+tabId); if(!el||!el.value.trim()) errors.push('Missing required query param: <code>'+esc(p.name)+'</code>'); });

  const pathParamsReq=(ep.params||[]).filter(p=>p.location==='path'&&p.req);
  pathParamsReq.forEach(p=>{ const el=document.getElementById('pp-'+p.name+'-'+tabId); if(!el||!el.value.trim()) errors.push('Missing required path param: <code>'+esc(p.name)+'</code>'); });
  const pathVal=(document.getElementById('try-path-'+tabId)||{}).value||'';
  const unresolvedPath=pathVal.match(/\{[a-zA-Z]+\}/g);
  if(unresolvedPath)[...new Set(unresolvedPath)].forEach(v=>errors.push('Unsubstituted path param: <code>'+esc(v)+'</code>'));

  const resolvedBody=applyVars(rawBody);
  const unresolved=resolvedBody.match(/\{\{[A-Z0-9_]+\}\}/g);
  if(unresolved) [...new Set(unresolved)].forEach(v=>errors.push('Unresolved variable: <code>'+esc(v)+'</code>'));

  if(errors.length){
    box.innerHTML='<div style="padding:6px 10px;background:#1e0a0a;border:1px solid #7c2020;border-radius:5px;font-size:11px;color:#f87171">'+
      '<b>&#10005; Validation errors</b><ul style="margin:4px 0 0 14px;padding:0">'+errors.map(e=>'<li style="margin:2px 0">'+e+'</li>').join('')+'</ul></div>';
    return false;
  }
  box.innerHTML='<div style="padding:6px 10px;background:#0a1e0a;border:1px solid #207c20;border-radius:5px;font-size:11px;color:#86efac">&#10003; Looks good</div>';
  return true;
}

// ── Copy helpers ──────────────────────────────────────────────────────────────
function _buildCopyContext(tabId){
  const orgAlias=(document.getElementById('org-select')||{}).value||'';
  const method=(document.getElementById('try-method-'+tabId)||{}).value||'GET';
  const path=(document.getElementById('try-path-'+tabId)||{}).value||'';
  const bodyEl=document.getElementById('try-body-'+tabId);
  const rawBody=bodyEl&&bodyEl.tagName==='TEXTAREA'?bodyEl.value.trim():'';
  return { orgAlias, method, path, body:applyVars(rawBody) };
}
function copyCurl(tabId){
  const {orgAlias,method,path,body}=_buildCopyContext(tabId);
  const lines=['curl -X '+method+' \\','  "https://YOUR_INSTANCE.salesforce.com'+path+'" \\',
    '  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\','  -H "Content-Type: application/json"'+(body?' \\':'')];
  if(body) lines.push('  -d \''+body.replace(/'/g,"'\\''")+'\'' );
  navigator.clipboard.writeText(lines.join('\n')+(orgAlias?'\n# org: '+orgAlias:'')).then(()=>_copyToast('cURL copied'));
}
function copyApex(tabId){
  const {orgAlias,method,path,body}=_buildCopyContext(tabId);
  const lines=['HttpRequest req = new HttpRequest();','req.setEndpoint(\'callout:Named_Cred'+path+'\');','req.setMethod(\''+method+'\');','req.setHeader(\'Content-Type\', \'application/json\');'];
  if(body) lines.push('req.setBody(\''+body.replace(/\\/g,'\\\\').replace(/'/g,"\\'")+'\');');
  lines.push('Http h = new Http();','HttpResponse res = h.send(req);','System.debug(res.getStatusCode() + \' \' + res.getBody());');
  navigator.clipboard.writeText(lines.join('\n')+(orgAlias?'\n// org: '+orgAlias:'')).then(()=>_copyToast('Apex copied'));
}
function copyJs(tabId){
  const {orgAlias,method,path,body}=_buildCopyContext(tabId);
  const opts=['  method: \''+method+'\'','  headers: { Authorization: \'Bearer YOUR_ACCESS_TOKEN\', \'Content-Type\': \'application/json\' }'];
  if(body) opts.push('  body: JSON.stringify('+body+')');
  const txt=['const response = await fetch(','  \'https://YOUR_INSTANCE.salesforce.com'+path+'\',','  {',opts.map(o=>'    '+o+',').join('\n'),'  }',');','const data = await response.json();','console.log(data);'].join('\n')+(orgAlias?'\n// org: '+orgAlias:'');
  navigator.clipboard.writeText(txt).then(()=>_copyToast('JS fetch copied'));
}
function _copyToast(msg){
  let el=document.getElementById('copy-toast');
  if(!el){ el=document.createElement('div'); el.id='copy-toast'; el.style.cssText='position:fixed;bottom:24px;right:24px;padding:8px 16px;background:#1e4620;border:1px solid #3a8c3f;border-radius:6px;font-size:12px;color:#86efac;z-index:9999;transition:opacity .3s'; document.body.appendChild(el); }
  el.textContent='✓ '+msg; el.style.opacity='1'; clearTimeout(el._t); el._t=setTimeout(()=>{ el.style.opacity='0'; },2000);
}

// ── Environments panel ────────────────────────────────────────────────────────
function updateEnvBadge(){
  const badge=document.getElementById('env-badge');
  const sbLabel=document.getElementById('sb-env-label');
  const name=activeEnvName||'—';
  if(badge) badge.textContent=name;
  if(sbLabel) sbLabel.textContent=activeEnvName?'Env: '+activeEnvName:'No environment';
}

function renderEnvsPanel(){
  const el=document.getElementById('env-list');
  if(!el) return;
  if(!envs.length){
    el.innerHTML='<div style="color:var(--fg3);font-size:11px;padding:6px 0">No environments yet. Create one below.</div>';
    document.getElementById('env-vars-section').innerHTML='';
    return;
  }
  el.innerHTML=envs.map(env=>'<div class="env-card'+(env.name===activeEnvName?' active':'')+'" onclick="switchEnvCard(\''+esc(env.name)+'\')">'+
    '<div style="display:flex;align-items:center;gap:6px">'+
    '<div class="env-name">'+esc(env.name)+'</div>'+
    (env.name===activeEnvName?'<span style="font-size:9px;color:var(--acc);border:1px solid var(--acc);border-radius:3px;padding:1px 5px">ACTIVE</span>':'')+
    '<button class="icon-btn" style="padding:1px 5px;font-size:10px;color:var(--red);margin-left:auto" onclick="event.stopPropagation();deleteEnvCard(\''+esc(env.name)+'\')">&#10005;</button>'+
    '</div>'+
    '<div class="env-org">'+esc(env.orgAlias||'no org')+'</div>'+
    '</div>'
  ).join('');

  // Show vars for active env
  renderEnvVars();
}

function switchEnvCard(name){
  vscMsg({type:'switchEnv', name});
}
function deleteEnvCard(name){
  showConfirm('Delete environment "'+name+'"?', ()=>{ vscMsg({type:'deleteEnv', name}); });
}

function createNewEnv(){
  const nameEl=document.getElementById('new-env-name');
  const name=nameEl.value.trim();
  if(!name){ showToast('Enter environment name.','error'); return; }
  const orgAlias=document.getElementById('org-select').value;
  vscMsg({type:'createEnv', name, orgAlias});
  nameEl.value='';
}

function renderEnvVars(){
  const sec=document.getElementById('env-vars-section');
  if(!sec) return;
  const env=envs.find(e=>e.name===activeEnvName);
  if(!env){ sec.innerHTML=''; return; }
  const entries=Object.entries(env.vars||{});
  sec.innerHTML=
    '<div style="font-size:10px;font-weight:700;color:var(--fg3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px;margin-top:8px">'+
    'Variables — '+esc(activeEnvName)+'</div>'+
    (entries.length
      ? entries.map(([k,v])=>
          '<div style="display:flex;align-items:center;gap:4px;margin-bottom:4px">'+
          '<span style="font-family:monospace;font-size:10px;color:var(--acc);min-width:120px;flex-shrink:0">{{'+esc(k)+'}}</span>'+
          '<input class="try-inp" style="flex:1;font-size:11px" value="'+esc(v)+'" onchange="updateEnvVar(\''+esc(k)+'\',this.value)">'+
          '<button class="icon-btn" style="padding:2px 6px;font-size:11px;color:var(--red)" onclick="deleteEnvVarEntry(\''+esc(k)+'\')">&#10005;</button>'+
          '</div>'
        ).join('')
      : '<div style="color:var(--fg3);font-size:11px;margin-bottom:8px">No variables yet.</div>')+
    '<div style="display:flex;gap:4px;margin-top:4px">'+
    '<input id="new-ev-name" class="try-inp" placeholder="VAR_NAME" style="flex:1;font-family:monospace;font-size:11px;text-transform:uppercase">'+
    '<input id="new-ev-val" class="try-inp" placeholder="value" style="flex:2;font-size:11px">'+
    '</div>'+
    '<button class="btn btn-pri" onclick="addEnvVar()" style="width:100%;font-size:11px;margin-top:4px">+ Add Variable</button>';
}

function addEnvVar(){
  const nameEl=document.getElementById('new-ev-name');
  const valEl=document.getElementById('new-ev-val');
  const name=(nameEl?.value||'').trim().toUpperCase().replace(/[^A-Z0-9_]/g,'_');
  const value=(valEl?.value||'').trim();
  if(!name){ showToast('Enter variable name.','error'); return; }
  if(!activeEnvName){ showToast('No active environment.','error'); return; }
  vscMsg({type:'setEnvVar', envName:activeEnvName, varName:name, value});
  if(nameEl) nameEl.value='';
  if(valEl) valEl.value='';
}
function updateEnvVar(name, value){ if(activeEnvName) vscMsg({type:'setEnvVar', envName:activeEnvName, varName:name, value}); }
function deleteEnvVarEntry(name){ if(activeEnvName) vscMsg({type:'deleteEnvVar', envName:activeEnvName, varName:name}); }

function saveResponseVar(key, value){
  const name=key.toUpperCase().replace(/[^A-Z0-9_]/g,'_');
  if(activeEnvName){
    vscMsg({type:'setEnvVar', envName:activeEnvName, varName:name, value});
  } else {
    const org=document.getElementById('org-select').value;
    if(org) vscMsg({type:'setVar', orgAlias:org, name, value});
  }
  switchRail('envs');
  _copyToast('Saved {{'+name+'}}');
}

function applyVars(text){
  const vars={...orgVars, ...activeEnvVars};
  return text.replace(/\{\{([A-Z0-9_]+)\}\}/g,(m,k)=>vars[k]!==undefined?vars[k]:m);
}
function extractIds(obj, prefix, results){
  if(!results) results=[];
  if(!prefix) prefix='';
  if(!obj||typeof obj!=='object') return results;
  if(Array.isArray(obj)){ if(obj.length>0) extractIds(obj[0],prefix+'[0]',results); return results; }
  for(const k of Object.keys(obj)){
    const v=obj[k]; const path=prefix?prefix+'.'+k:k;
    if(typeof v==='string'&&/^[a-zA-Z0-9]{15,18}$/.test(v)&&results.length<12) results.push({key:path,value:v});
    else if(v&&typeof v==='object'&&results.length<12) extractIds(v,path,results);
  }
  return results;
}
const SF_ID_PREFIX_MAP = {
  '0Q0':'QUOTE_ID','0QL':'QUOTE_LINE_ITEM_ID','02i':'ASSET_ID','0cD':'ASSET_STATE_PERIOD_ID',
  '01t':'PRODUCT_ID','01u':'PRICEBOOK_ENTRY_ID','0ZS':'CATALOG_ID','0ZG':'CATEGORY_ID',
  '0iO':'PSM_ID','0Q1':'ORDER_ID','0Og':'SALES_TRANSACTION_ID','001':'ACCOUNT_ID',
  '006':'OPPORTUNITY_ID','01Z':'PRICEBOOK_ID','0bQ':'BILLING_SCHEDULE_ID',
  '1b0':'BILLING_ARRANGEMENT_ID','0YB':'EXECUTION_ID','0QA':'LINE_ITEM_ID',
};
function suggestVarName(path, idValue){
  if(idValue && idValue.length >= 3){
    const prefix = idValue.substring(0,3);
    if(SF_ID_PREFIX_MAP[prefix]) return SF_ID_PREFIX_MAP[prefix];
  }
  return path.replace(/\[\d+\]/g,'').replace(/\./g,'_').replace(/([a-z])([A-Z])/g,'$1_$2').toUpperCase().replace(/[^A-Z0-9_]/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'');
}

// ── History panel ─────────────────────────────────────────────────────────────
const HIST_PAGE_SIZE = 50;
function renderHistory(){
  const el=document.getElementById('history-list');
  if(!el) return;
  const q=(document.getElementById('hist-search')||{}).value?.toLowerCase()||'';
  const filtered=history.filter(h=>!q||h.path.toLowerCase().includes(q)||h.method.toLowerCase().includes(q));
  if(!filtered.length){ el.innerHTML='<div style="padding:16px 12px;color:var(--fg3);font-size:11px">'+(history.length?'No matches.':'No history yet.')+'</div>'; return; }

  const page = _histPage;
  const visible = filtered.slice(0, (page+1)*HIST_PAGE_SIZE);
  const remaining = filtered.length - visible.length;

  // Group by date
  const groups={};
  visible.forEach(h=>{
    const d=h.timestamp.slice(0,10);
    if(!groups[d]) groups[d]=[];
    groups[d].push(h);
  });

  const today=new Date().toISOString().slice(0,10);
  const yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10);
  const label=(d)=>d===today?'Today':d===yesterday?'Yesterday':d;

  let html=Object.entries(groups).map(([date,entries])=>
    '<div class="hist-group">'+label(date)+'</div>'+
    entries.map(h=>{
      const mc=h.method==='GET'?'GET':h.method==='POST'?'POST':h.method==='PUT'?'PUT':h.method==='PATCH'?'PATCH':'DELETE';
      const st=h.status;
      let scls='serr'; if(st>=200&&st<300) scls='s2xx'; else if(st>=400&&st<500) scls='s4xx'; else if(st>=500) scls='s5xx';
      const t=h.timestamp.slice(11,16);
      return '<div class="hist-entry" onclick="openHistoryEntry(\''+esc(h.id)+'\')">'+
        '<div class="hist-entry-top">'+
        '<span class="mb '+mc+'" style="min-width:38px;font-size:9px">'+esc(h.method)+'</span>'+
        '<span class="status-pill '+scls+'" style="font-size:9px;padding:1px 5px">'+h.status+'</span>'+
        '<span class="hist-time">'+t+'</span>'+
        '</div>'+
        '<div class="hist-path">'+esc(h.path)+'</div>'+
        '</div>';
    }).join('')
  ).join('');
  if(remaining>0){
    html+='<div style="padding:8px 12px"><button class="btn btn-sec" style="width:100%;font-size:11px" onclick="_histPage++;renderHistory()">Load '+Math.min(remaining,HIST_PAGE_SIZE)+' more ('+remaining+' remaining)</button></div>';
  }
  el.innerHTML=html;
}

function openHistoryEntry(id){
  const entry=history.find(h=>h.id===id);
  if(!entry) return;
  const existing=tabs.find(t=>t.type==='history'&&t.histId===id);
  if(existing){ activateTab(existing.id); return; }

  const tabId='tab-'+(++tabCounter);
  const label=entry.method+' '+entry.path.split('/').pop();
  tabs.push({id:tabId, type:'history', label, histId:id, histMethod:entry.method});
  renderTabBar();

  const panel=document.createElement('div');
  panel.id='tp-'+tabId;
  panel.className='tab-panel';
  const t=entry.timestamp.replace('T',' ').slice(0,16);
  const st=entry.status;
  let scls='serr'; if(st>=200&&st<300) scls='s2xx'; else if(st>=400&&st<500) scls='s4xx'; else if(st>=500) scls='s5xx';
  panel.innerHTML=
    '<div class="d-title">History: '+esc(entry.method)+' '+esc(entry.path.split('/').pop())+'</div>'+
    '<div class="d-meta">'+
    '<span class="status-pill '+scls+'">'+st+'</span>'+
    '<span class="d-ver">'+esc(t)+'</span>'+
    '<span style="font-size:10px;color:var(--fg3)">'+esc(entry.orgAlias)+'</span>'+
    (entry.durationMs?'<span style="font-size:10px;color:var(--fg3)">'+entry.durationMs+'ms</span>':'')+
    '</div>'+
    '<div class="d-path">'+esc(entry.method)+' '+esc(entry.path)+'</div>'+
    '<div style="margin-top:14px">'+
    '<div class="try-lbl">Request Body</div>'+
    '<pre style="margin-top:4px">'+esc(entry.requestBody||'(empty)')+'</pre>'+
    '</div>'+
    '<div style="margin-top:14px">'+
    '<div class="try-lbl">Response</div>'+
    '<pre style="margin-top:4px">'+esc(entry.responseBody)+'</pre>'+
    '</div>'+
    '<div style="margin-top:14px">'+
    '<button class="btn btn-pri" onclick="replayHistory(\''+esc(id)+'\')">&#9654; Replay</button>'+
    '</div>';
  document.getElementById('detail').appendChild(panel);
  activateTab(tabId);
}

function replayHistory(id){
  const entry=history.find(h=>h.id===id);
  if(!entry) return;
  // Route PST and Swap calls to their visual builders
  if(entry.endpointId==='txn-9'){
    openPstBuilderTab();
    setTimeout(()=>_loadPstFromJson(entry.requestBody),150);
    return;
  }
  if(entry.endpointId==='txn-13'){
    openSwapBuilderTab();
    setTimeout(()=>_loadSwapFromJson(entry.requestBody),150);
    return;
  }
  if(entry.endpointId){
    showEp(entry.endpointId);
    setTimeout(()=>{
      const t=tabs.find(tb=>tb.type==='endpoint'&&tb.epId===entry.endpointId);
      if(!t) return;
      showSubTab('tryit', null, t.id);
      const panel=document.getElementById('tp-'+t.id);
      if(panel){ const tryitTab=panel.querySelectorAll('.tab')[3]; if(tryitTab){ tryitTab.click(); } }
      const bodyEl=document.getElementById('try-body-'+t.id);
      if(bodyEl&&bodyEl.tagName==='TEXTAREA'&&entry.requestBody) bodyEl.value=entry.requestBody;
      const pathEl=document.getElementById('try-path-'+t.id);
      if(pathEl&&entry.path) pathEl.value=entry.path;
    },80);
  } else {
    // Custom request replay — open a new-custom tab pre-filled with history entry
    const tabId='tab-'+(++tabCounter);
    tabs.push({id:tabId, type:'new-custom', label:'Replay'});
    renderTabBar();
    const panel=document.createElement('div');
    panel.id='tp-'+tabId;
    panel.className='tab-panel';
    document.getElementById('detail').appendChild(panel);
    const syntheticReq={name:'',method:entry.method||'GET',path:entry.path||'',headers:{},body:entry.requestBody||''};
    _buildCustomPanel(panel,tabId,syntheticReq,true);
    activateTab(tabId);
  }
}

function _loadPstFromJson(jsonStr){
  const tab=tabs.find(t=>t.type==='pst-builder');
  if(!tab) return;
  const tabId=tab.id; const s=pstState[tabId];
  if(!s) return;
  try{
    const p=JSON.parse(jsonStr||'{}');
    if(p.contextId) s.contextId=p.contextId;
    if(p.pricingPreference) s.pricingPref=p.pricingPreference;
    const quoteRef=p.records&&p.records.find(r=>r.record&&r.record.attributes&&r.record.attributes.type==='Quote');
    if(quoteRef&&quoteRef.record){
      if(quoteRef.record.Name){
        s.mode='new-quote';
        s.newQuoteFields={name:quoteRef.record.Name||'',pricebook2Id:quoteRef.record.Pricebook2Id||'',currencyIsoCode:quoteRef.record.CurrencyIsoCode||'USD',opportunityId:quoteRef.record.OpportunityId||''};
      } else if(quoteRef.referenceId){
        s.mode='existing';
      }
    }
    const panel=document.getElementById('tp-'+tabId);
    if(panel) _buildPstPanel(panel,tabId);
    _copyToast('PST loaded from history');
  } catch(_){ _copyToast('Could not parse PST body'); }
}

function _loadSwapFromJson(jsonStr){
  const tab=tabs.find(t=>t.type==='swap-builder');
  if(!tab) return;
  const tabId=tab.id; const s=swapState[tabId];
  if(!s) return;
  try{
    const p=JSON.parse(jsonStr||'{}');
    s.swapStartDate=(p.swapStartDate||'').replace(/:00Z$/,'').replace(/Z$/,'');
    s.outputRecordType=p.outputRecordType||'Quote';
    s.groups=[]; s.groupCounter=0;
    ((p.swapGroups&&p.swapGroups.groups)||[]).forEach(g=>{
      const gId='sg_'+(s.groupCounter++);
      const outAssets=((g.outGroup&&g.outGroup.swapAssets)||[]).map((a,ai)=>({localId:'oa_'+ai,assetId:a.assetId||'',quantity:String(a.quantity||1)}));
      const inRecords=((g.inGroup&&g.inGroup.records)||[]).map((r,ri)=>{
        const rec=r.record||{};
        return {localId:'ir_'+ri,product2Id:rec.Product2Id||'',pbeId:rec.PricebookEntryId||'',unitPrice:String(rec.UnitPrice||0),startDate:rec.StartDate||''};
      });
      s.groups.push({localId:gId,outAssets,inRecords,assetCounter:outAssets.length,recordCounter:inRecords.length});
    });
    const panel=document.getElementById('tp-'+tabId);
    if(panel) _buildSwapPanel(panel,tabId);
    _copyToast('Swap loaded from history');
  } catch(_){ _copyToast('Could not parse Swap body'); }
}

// ── Custom Requests ───────────────────────────────────────────────────────────
const METHODS=['GET','POST','PUT','PATCH','DELETE'];

const collapsedCustomCats=new Set(JSON.parse(localStorage.getItem('rc-custom-collapsed')||'[]'));
const collapsedCustomSubs=new Set(JSON.parse(localStorage.getItem('rc-custom-subs-collapsed')||'[]'));

function toggleCustomCat(key){
  collapsedCustomCats.has(key)?collapsedCustomCats.delete(key):collapsedCustomCats.add(key);
  localStorage.setItem('rc-custom-collapsed',JSON.stringify([...collapsedCustomCats]));
  renderCustomReqList();
}
function toggleCustomSub(key){
  collapsedCustomSubs.has(key)?collapsedCustomSubs.delete(key):collapsedCustomSubs.add(key);
  localStorage.setItem('rc-custom-subs-collapsed',JSON.stringify([...collapsedCustomSubs]));
  renderCustomReqList();
}
function collapseAllCustom(){
  Object.keys(_buildCustomTree(customRequests)).forEach(k=>collapsedCustomCats.add(k));
  localStorage.setItem('rc-custom-collapsed',JSON.stringify([...collapsedCustomCats]));
  renderCustomReqList();
}
function expandAllCustom(){
  collapsedCustomCats.clear();
  localStorage.setItem('rc-custom-collapsed','[]');
  renderCustomReqList();
}

function _buildCustomTree(reqs){
  const tree={};
  for(const r of reqs){
    const parts=(r.category||'Custom').split(' > ');
    const l1=parts[0], l2=parts[1];
    if(!tree[l1]) tree[l1]={requests:[],subs:{}};
    if(l2){ if(!tree[l1].subs[l2]) tree[l1].subs[l2]={requests:[]}; tree[l1].subs[l2].requests.push(r); }
    else tree[l1].requests.push(r);
  }
  return tree;
}

function customReqRow(r, showCat){
  const mc=r.method||'GET';
  const pinned=r.pinned?true:false;
  return '<div style="display:flex;align-items:center;gap:4px;margin-bottom:4px;padding:5px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;cursor:pointer'+(pinned?';border-left:2px solid #f0c040':'')+'" onclick="openCustomRequest(\''+esc(r.id)+'\')">'+
    '<span class="mb '+mc+'" style="font-size:9px;padding:1px 4px;min-width:34px">'+esc(r.method)+'</span>'+
    '<span style="flex:1;min-width:0">'+
      '<div style="font-size:11px;color:var(--fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(r.name)+'</div>'+
      (showCat&&r.category?'<div style="font-size:9px;color:var(--fg3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(r.category)+'</div>':'')+
    '</span>'+
    '<button class="cr-pin-btn'+(pinned?' pinned':'')+'" onclick="event.stopPropagation();togglePinCustomReq(\''+esc(r.id)+'\')" title="'+(pinned?'Unpin':'Pin')+'">'+(pinned?'★':'☆')+'</button>'+
    '<button class="cr-action-btn" onclick="event.stopPropagation();duplicateCustomReq(\''+esc(r.id)+'\')" title="Duplicate request">&#128203;</button>'+
    '<button class="cr-action-btn" style="color:var(--red)" onclick="event.stopPropagation();deleteCustomReq(\''+esc(r.id)+'\')">&#10005;</button>'+
    '</div>';
}

function togglePinCustomReq(id){
  const r=customRequests.find(function(x){ return x.id===id; });
  if(!r) return;
  vscMsg({type:'updateCustomRequest', id, pinned:!r.pinned});
}

function renderCustomReqList(){
  const el=document.getElementById('custom-req-list');
  if(!el) return;
  if(!customRequests.length){ el.innerHTML='<div style="color:var(--fg3);font-size:11px;padding:6px 0">No saved requests yet.</div>'; return; }

  const q=((document.getElementById('custom-search')||{}).value||'').toLowerCase().trim();

  if(q){
    const matches=customRequests.filter(r=>
      r.name.toLowerCase().includes(q)||r.method.toLowerCase().includes(q)||r.path.toLowerCase().includes(q)
    );
    el.innerHTML=matches.length
      ? matches.map(r=>customReqRow(r,true)).join('')
      : '<div style="color:var(--fg3);font-size:11px;padding:6px 4px">No matches.</div>';
    return;
  }

  // Dedicated ★ Pinned section at the top
  const pinnedReqs=customRequests.filter(function(r){ return r.pinned; });
  const unpinnedReqs=customRequests.filter(function(r){ return !r.pinned; });
  let html='';
  if(pinnedReqs.length){
    html+='<div class="sec-hdr" style="cursor:default;font-size:11px"><span style="color:#f0c040">★ Pinned</span><span style="margin-left:auto;color:var(--fg3);font-weight:400">'+pinnedReqs.length+'</span></div>';
    pinnedReqs.forEach(function(r){ html+=customReqRow(r,true); });
  }

  const tree=_buildCustomTree(unpinnedReqs);
  for(const [l1,node] of Object.entries(tree)){
    const total=node.requests.length+Object.values(node.subs).reduce(function(s,sub){ return s+sub.requests.length; },0);
    const collapsed=collapsedCustomCats.has(l1);
    html+='<div class="sec-hdr'+(collapsed?' collapsed':'')+'" onclick="toggleCustomCat(\''+esc(l1)+'\')" style="font-size:11px">'+
      '<span class="chevron">&#9660;</span><span>'+esc(l1)+'</span>'+
      '<span style="margin-left:auto;color:var(--fg3);font-weight:400">'+total+'</span>'+
      '<button class="icon-btn" style="font-size:10px;padding:0 3px;margin-left:4px;flex-shrink:0;color:var(--acc)" onclick="event.stopPropagation();runCollection(\''+esc(l1)+'\')" title="Run all in '+esc(l1)+'">&#9654;</button>'+
      '<button class="icon-btn" style="font-size:10px;color:var(--red,#f44);padding:0 3px;flex-shrink:0" onclick="event.stopPropagation();_confirmDeleteCat(\''+esc(l1)+'\')" title="Remove all in '+esc(l1)+'">&#128465;</button>'+
      '</div>';
    if(!collapsed){
      for(const [l2,sub] of Object.entries(node.subs)){
        const subKey=l1+' > '+l2;
        const subCol=collapsedCustomSubs.has(subKey);
        html+='<div style="padding-left:12px">'+
          '<div class="sec-hdr'+(subCol?' collapsed':'')+'" onclick="toggleCustomSub(\''+esc(subKey)+'\')" style="font-size:10px;padding:3px 8px">'+
          '<span class="chevron">&#9660;</span><span>'+esc(l2)+'</span>'+
          '<span style="margin-left:auto;color:var(--fg3);font-weight:400">'+sub.requests.length+'</span></div>';
        if(!subCol) sub.requests.forEach(function(r){ html+='<div style="padding-left:12px">'+customReqRow(r)+'</div>'; });
        html+='</div>';
      }
      node.requests.forEach(function(r){ html+=customReqRow(r); });
    }
  }
  el.innerHTML=html;
}

function _showConfirmModal(message, onConfirm){
  let ov=document.getElementById('confirm-modal-overlay');
  if(!ov){ ov=document.createElement('div'); ov.id='confirm-modal-overlay';
    ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:2000;display:flex;align-items:center;justify-content:center';
    document.body.appendChild(ov); }
  ov.innerHTML=`<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:20px 24px;max-width:360px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.4)">
    <div style="font-size:13px;color:var(--fg);margin-bottom:18px;line-height:1.5">${message}</div>
    <div style="display:flex;justify-content:flex-end;gap:8px">
      <button class="btn" onclick="document.getElementById('confirm-modal-overlay').remove()">Cancel</button>
      <button class="btn" style="background:var(--red,#c0392b);border-color:var(--red,#c0392b);color:#fff" id="confirm-modal-ok">Delete</button>
    </div>
  </div>`;
  document.getElementById('confirm-modal-ok').onclick=()=>{ ov.remove(); onConfirm(); };
}

function _confirmDeleteAllCustom(){
  if(!customRequests.length){ showToast('No saved requests to remove.','error'); return; }
  _showConfirmModal('Remove <strong>ALL '+customRequests.length+' saved requests</strong>? This cannot be undone.',
    ()=>vscMsg({type:'deleteAllCustomRequests'}));
}
function _confirmDeleteCat(cat){
  const count=customRequests.filter(r=>{ const c=r.category||'Custom'; return c===cat||c.startsWith(cat+' > '); }).length;
  if(count===0){ showToast('No requests in "'+cat+'".','error'); return; }
  _showConfirmModal('Remove all <strong>'+count+' request'+(count===1?'':'s')+' in &ldquo;'+esc(cat)+'&rdquo;</strong>? This cannot be undone.',
    ()=>vscMsg({type:'deleteCustomRequestsByCategory',category:cat}));
}

// ── Postman Import Modal ──────────────────────────────────────────────────────
let _pmTree=[], _pmFlat=[], _pmChecked=new Set(), _pmFolderOpen=new Set();

function _pmFlatten(folders){
  const out=[];
  for(const f of folders){ out.push(...f.requests); if(f.children?.length) out.push(..._pmFlatten(f.children)); }
  return out;
}

function _loadCollectionCatalog(){
  vscMsg({type:'loadCollectionCatalog'});
}
function _importCollectionFromCatalog(url, label){
  // Open modal immediately with loading state, then fetch
  showImportModal();
  const section=document.getElementById('pm-tree-section');
  if(section){ section.style.display='block'; section.innerHTML='<div style="padding:20px;text-align:center;color:var(--fg3);font-size:12px">&#8987; Loading '+esc(label)+'…</div>'; }
  vscMsg({type:'importCollectionFromUrl', url});
}
function _renderCatalogBtns(catalog){
  const el=document.getElementById('catalog-btn-list');
  if(!el) return;
  if(!catalog||!catalog.length){ el.innerHTML='<span style="font-size:10px;color:var(--fg3)">No collections found.</span>'; return; }
  el.innerHTML=catalog.map(function(c){
    return '<button class="btn btn-sec" style="width:100%;font-size:11px;text-align:left" title="'+esc(c.description||'')+'" onclick="_importCollectionFromCatalog(\''+esc(c.url)+'\',\''+esc(c.label)+'\')">'+
      (c.icon||'📦')+' '+esc(c.label)+'</button>';
  }).join('');
}

function showImportModal(){
  let ov=document.getElementById('pm-modal-overlay');
  if(!ov){ ov=document.createElement('div'); ov.id='pm-modal-overlay';
    ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:1000;display:flex;align-items:center;justify-content:center';
    document.body.appendChild(ov); }
  ov.innerHTML=`<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;width:540px;max-height:82vh;display:flex;flex-direction:column;overflow:hidden">
    <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">
      <span style="flex:1;font-weight:600;font-size:13px">Import Collection</span>
      <button class="icon-btn" onclick="_closePmModal()">&#10005;</button>
    </div>
    <div style="padding:8px 16px;border-bottom:1px solid var(--border);display:flex;gap:6px">
      <button id="pm-tab-file" class="btn" style="background:var(--accent);color:#fff" onclick="_pmSwitchTab('file')">From File</button>
      <button id="pm-tab-url"  class="btn" onclick="_pmSwitchTab('url')">From URL</button>
      <button id="pm-tab-env"  class="btn" onclick="_pmSwitchTab('env')" title="Import Postman environment variables">&#127759; Environments</button>
    </div>
    <div id="pm-tab-file-body" style="padding:10px 16px;display:flex;align-items:center;gap:8px">
      <span style="font-size:11px;color:var(--fg3)">Select a Postman Collection JSON:</span>
      <button class="btn" onclick="vscMsg({type:'importPostmanFile'})">Browse&hellip;</button>
    </div>
    <div id="pm-tab-url-body" style="padding:10px 16px;display:none;align-items:center;gap:8px">
      <input id="pm-url-input" type="text" placeholder="https://raw.githubusercontent.com/..." style="flex:1;font-size:11px;background:var(--bg3);border:1px solid var(--border);color:var(--fg);border-radius:4px;padding:4px 8px">
      <button class="btn" onclick="_pmFetchUrl()">Fetch</button>
    </div>
    <div id="pm-tab-env-body" style="padding:10px 16px;display:none;flex-direction:column;gap:8px">
      <div style="font-size:11px;color:var(--fg3)">Import a Postman environment file (<code>*.postman_environment.json</code>) or collection variables. Creates a new environment with all variables.</div>
      <div style="display:flex;gap:8px;align-items:center">
        <input id="pm-env-name" class="try-inp" placeholder="Environment name (auto from file)" style="flex:1;font-size:11px">
        <button class="btn" onclick="vscMsg({type:'importPostmanEnvFile'})">Browse&hellip;</button>
      </div>
      <div id="pm-env-preview" style="display:none;font-size:10px;color:var(--fg3);max-height:120px;overflow-y:auto;font-family:monospace;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:6px 8px"></div>
      <button id="pm-env-import-btn" class="btn btn-pri" style="display:none;align-self:flex-start" onclick="_pmEnvImport()">Import Variables</button>
    </div>
    <div id="pm-fetch-error" style="color:var(--red);font-size:11px;padding:0 16px 6px;display:none"></div>
    <div id="pm-tree-section" style="display:none;flex:1;overflow-y:auto;padding:6px 12px"></div>
    <div style="padding:10px 16px;border-top:1px solid var(--border);display:flex;align-items:center;gap:8px;justify-content:flex-end">
      <span id="pm-sel-all-wrap" style="display:none;margin-right:auto;gap:4px;display:none">
        <button class="icon-btn" onclick="_pmSelectAll(true)" style="font-size:10px">Select All</button>
        <button class="icon-btn" onclick="_pmSelectAll(false)" style="font-size:10px">None</button>
      </span>
      <button class="btn" onclick="_closePmModal()">Cancel</button>
      <button id="pm-import-btn" class="btn" style="display:none;background:var(--accent);color:#fff" onclick="_pmImport()">Import Selected (<span id="pm-count">0</span>)</button>
    </div>
  </div>`;
}

function _pmLoadTree(tree){
  _pmTree=tree; _pmFlat=_pmFlatten(tree);
  _pmChecked=new Set(_pmFlat.map((_,i)=>i));
  _pmFolderOpen=new Set(tree.map(f=>f.category));
  const section=document.getElementById('pm-tree-section');
  if(section){ section.style.display='block'; section.innerHTML=_renderPmTree(_pmTree,0); }
  const btn=document.getElementById('pm-import-btn');
  if(btn) btn.style.display='inline-block';
  const wrap=document.getElementById('pm-sel-all-wrap');
  if(wrap) wrap.style.display='inline-flex';
  const cnt=document.getElementById('pm-count');
  if(cnt) cnt.textContent=_pmFlat.length;
}

function _pmSwitchTab(tab){
  document.getElementById('pm-tab-file-body').style.display=tab==='file'?'flex':'none';
  document.getElementById('pm-tab-url-body').style.display=tab==='url'?'flex':'none';
  const envBody=document.getElementById('pm-tab-env-body');
  if(envBody) envBody.style.display=tab==='env'?'flex':'none';
  ['file','url','env'].forEach(function(t){
    const btn=document.getElementById('pm-tab-'+t);
    if(!btn) return;
    btn.style.background=t===tab?'var(--accent)':'';
    btn.style.color=t===tab?'#fff':'';
  });
  // hide tree section and import button when switching to env tab
  if(tab==='env'){
    const ts=document.getElementById('pm-tree-section'); if(ts) ts.style.display='none';
    const ib=document.getElementById('pm-import-btn'); if(ib) ib.style.display='none';
    const sw=document.getElementById('pm-sel-all-wrap'); if(sw) sw.style.display='none';
  }
}

// Postman env vars loaded from backend
let _pmEnvVars=[];
function _pmEnvLoaded(vars, name){
  _pmEnvVars=vars;
  const nameEl=document.getElementById('pm-env-name');
  if(nameEl&&!nameEl.value) nameEl.value=name||'Imported Env';
  const prev=document.getElementById('pm-env-preview');
  if(prev){
    prev.style.display='block';
    prev.textContent=vars.map(function(v){ return v.key+'  =  '+(v.value||'(empty)'); }).join('\n');
  }
  const btn=document.getElementById('pm-env-import-btn');
  if(btn) btn.style.display='inline-block';
}
function _pmEnvImport(){
  const name=((document.getElementById('pm-env-name')||{}).value||'').trim()||'Imported Env';
  if(!_pmEnvVars.length){ showToast('No variables to import','error'); return; }
  vscMsg({type:'importPostmanEnvVars', envName:name, vars:_pmEnvVars});
  _closePmModal();
}

function _pmFetchUrl(){
  const url=(document.getElementById('pm-url-input')||{}).value?.trim();
  if(!url) return;
  const errEl=document.getElementById('pm-fetch-error');
  if(errEl) errEl.style.display='none';
  vscMsg({type:'importPostmanUrl',url});
}

function _renderPmTree(folders,depth){
  let html='';
  for(const f of folders){
    const open=_pmFolderOpen.has(f.category);
    const total=f.requests.length+(f.children?_pmFlatten(f.children).length:0);
    const allChk=_pmFolderAllChecked(f);
    html+=`<div style="padding-left:${depth*14}px">
      <div style="display:flex;align-items:center;gap:4px;padding:3px 0;cursor:default">
        <input type="checkbox" ${allChk?'checked':''} onchange="_pmToggleFolder('${esc(f.category)}',this.checked)" onclick="event.stopPropagation()" style="cursor:pointer">
        <span onclick="_pmToggleFolderOpen('${esc(f.category)}')" style="flex:1;font-size:11px;font-weight:500;cursor:pointer">${esc(f.name)}</span>
        <span style="font-size:10px;color:var(--fg3)">${total}</span>
        <span style="font-size:10px;cursor:pointer" onclick="_pmToggleFolderOpen('${esc(f.category)}')">${open?'&#9660;':'&#9654;'}</span>
      </div>`;
    if(open){
      if(f.children?.length) html+=_renderPmTree(f.children,depth+1);
      f.requests.forEach(r=>{
        const idx=_pmFlat.indexOf(r);
        html+=`<div style="padding-left:${(depth+1)*14}px;display:flex;align-items:center;gap:4px;padding-top:2px;padding-bottom:2px">
          <input type="checkbox" ${_pmChecked.has(idx)?'checked':''} onchange="_pmToggleReq(${idx},this.checked)" style="cursor:pointer">
          <span class="mb ${esc(r.method)}" style="font-size:9px;padding:1px 3px;min-width:30px">${esc(r.method)}</span>
          <span style="font-size:10px;color:var(--fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${esc(r.name)}</span>
        </div>`;
      });
    }
    html+='</div>';
  }
  return html;
}

function _pmFolderAllChecked(folder){
  const all=_pmFlatten([folder]);
  return all.length>0 && all.every(r=>_pmChecked.has(_pmFlat.indexOf(r)));
}
function _pmToggleFolderOpen(cat){
  if(_pmFolderOpen.has(cat)) _pmFolderOpen.delete(cat); else _pmFolderOpen.add(cat);
  const s=document.getElementById('pm-tree-section');
  if(s) s.innerHTML=_renderPmTree(_pmTree,0);
}
function _pmToggleFolder(cat,checked){
  function find(fs){ for(const f of fs){ if(f.category===cat) return f; const r=find(f.children||[]); if(r) return r; } }
  const folder=find(_pmTree);
  if(!folder) return;
  _pmFlatten([folder]).forEach(r=>{ const i=_pmFlat.indexOf(r); checked?_pmChecked.add(i):_pmChecked.delete(i); });
  const cnt=document.getElementById('pm-count'); if(cnt) cnt.textContent=_pmChecked.size;
  const s=document.getElementById('pm-tree-section'); if(s) s.innerHTML=_renderPmTree(_pmTree,0);
}
function _pmToggleReq(idx,checked){
  checked?_pmChecked.add(idx):_pmChecked.delete(idx);
  const cnt=document.getElementById('pm-count'); if(cnt) cnt.textContent=_pmChecked.size;
}
function _pmSelectAll(checked){
  _pmFlat.forEach((_,i)=>checked?_pmChecked.add(i):_pmChecked.delete(i));
  const cnt=document.getElementById('pm-count'); if(cnt) cnt.textContent=_pmChecked.size;
  const s=document.getElementById('pm-tree-section'); if(s) s.innerHTML=_renderPmTree(_pmTree,0);
}
function _closePmModal(){ const el=document.getElementById('pm-modal-overlay'); if(el) el.remove(); }
function _pmImport(){
  const requests=[..._pmChecked].sort((a,b)=>a-b).map(i=>_pmFlat[i]);
  vscMsg({type:'importPostmanSelected',requests});
  _closePmModal();
}

function openNewRequestTab(){
  const tabId='tab-'+(++tabCounter);
  tabs.push({id:tabId, type:'new-custom', label:'New Request'});
  renderTabBar();
  const panel=document.createElement('div');
  panel.id='tp-'+tabId;
  panel.className='tab-panel';
  document.getElementById('detail').appendChild(panel);
  _buildCustomPanel(panel, tabId, {name:'',method:'GET',path:'/connect/pcm/catalogs',headers:{},body:''}, true);
  activateTab(tabId);
}

function openCustomRequest(id){
  const req=customRequests.find(r=>r.id===id);
  if(!req) return;

  const existing=tabs.find(t=>t.type==='custom'&&t.reqId===id);
  if(existing){ activateTab(existing.id); return; }

  const tabId='tab-'+(++tabCounter);
  tabs.push({id:tabId, type:'custom', label:req.name, reqId:id});
  renderTabBar();
  const panel=document.createElement('div');
  panel.id='tp-'+tabId;
  panel.className='tab-panel';
  document.getElementById('detail').appendChild(panel);
  _buildCustomPanel(panel, tabId, req, false);
  activateTab(tabId);
}

function deleteCustomReq(id){ vscMsg({type:'deleteCustomRequest', id}); }
function duplicateCustomReq(id){
  const r=customRequests.find(function(x){ return x.id===id; });
  if(!r) return;
  const copy=Object.assign({},r);
  delete copy.id; delete copy.savedAt; delete copy.pinned;
  copy.name=r.name+' (copy)';
  vscMsg({type:'saveCustomRequest', name:copy.name, method:copy.method, path:copy.path,
    headers:copy.headers||{}, body:copy.body||'', category:copy.category,
    description:copy.description, queryParams:copy.queryParams, pathVariables:copy.pathVariables});
}

function _buildCustomPanel(panel, tabId, req, isNew){
  const headerRows=Object.entries(req.headers||{}).map(([k,v])=>
    '<div class="cr-hdr-row" style="display:flex;gap:4px;margin-bottom:4px">'+
    '<input class="try-inp" placeholder="Header name" value="'+esc(k)+'" style="flex:1;font-family:monospace;font-size:11px">'+
    '<input class="try-inp" placeholder="Value" value="'+esc(v)+'" style="flex:2;font-size:11px">'+
    '<button class="icon-btn" style="padding:2px 6px;font-size:11px;color:var(--red)" onclick="this.closest(\'.cr-hdr-row\').remove()">&#10005;</button>'+
    '</div>'
  ).join('');

  const pathVars = req.pathVariables||[];
  const queryParams = req.queryParams||[];

  const descHtml = req.description
    ? '<div class="try-sec"><div class="try-lbl">Description</div>'+
      '<div style="font-size:11px;color:var(--fg3);line-height:1.5;white-space:pre-wrap;max-height:80px;overflow-y:auto">'+esc(req.description)+'</div></div>'
    : '';

  const pathVarHtml = pathVars.length
    ? '<div class="try-sec"><div class="try-lbl">Path Variables</div>'+
      pathVars.map(v=>
        '<div style="display:flex;gap:6px;margin-bottom:4px;align-items:center">'+
        '<span style="font-size:10px;font-family:monospace;color:var(--acc,#4ec9b0);min-width:90px;flex-shrink:0">:'+esc(v.key)+'</span>'+
        '<input class="try-inp cr-pathvar-'+tabId+'" data-key="'+esc(v.key)+'" placeholder="value" style="flex:1;font-size:11px">'+
        (v.description?'<span style="font-size:9px;color:var(--fg3);flex-shrink:0;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+esc(v.description)+'">'+esc(v.description)+'</span>':'')+
        '</div>'
      ).join('')+
      '</div>'
    : '';

  const queryParamHtml = queryParams.length
    ? '<div class="try-sec"><div class="try-lbl">Query Parameters</div>'+
      queryParams.map((q,i)=>
        '<div style="display:flex;gap:4px;margin-bottom:4px">'+
        '<input class="try-inp" value="'+esc(q.key)+'" placeholder="key" style="flex:1;font-family:monospace;font-size:11px" id="cr-qpk-'+tabId+'-'+i+'">'+
        '<input class="try-inp" value="'+esc(q.value)+'" placeholder="value" style="flex:2;font-size:11px" id="cr-qpv-'+tabId+'-'+i+'">'+
        '</div>'
      ).join('')+
      '</div>'
    : '';

  panel.innerHTML=
    '<div class="d-title" style="margin-bottom:14px">'+(isNew?'New Request':esc(req.name))+'</div>'+
    descHtml+
    '<div class="try-sec"><div class="try-lbl">Name</div>'+
    '<input class="try-inp" id="cr-name-'+tabId+'" placeholder="My Request" value="'+esc(req.name||'')+'" style="width:100%"></div>'+
    '<div class="try-sec"><div class="try-lbl">Method &amp; Path</div>'+
    '<div class="try-row">'+
    '<select class="try-sel" id="cr-method-'+tabId+'" onchange="_updateCrBody(\''+tabId+'\')">'+
    METHODS.map(m=>'<option value="'+m+'"'+(m===req.method?' selected':'')+'>'+m+'</option>').join('')+
    '</select>'+
    '<input class="try-ver" id="cr-ver-'+tabId+'" value="'+(req.apiVersion||DEFAULT_API_VERSION||'v66.0')+'" title="API version (editable)" style="width:54px;font-family:monospace;font-size:11px;text-align:center;flex-shrink:0">'+
    '<input class="try-inp" id="cr-path-'+tabId+'" value="'+esc(req.path||'')+'" placeholder="/connect/pcm/catalogs" style="font-family:monospace;font-size:11px">'+
    '</div></div>'+
    pathVarHtml+
    queryParamHtml+
    '<div class="try-sec"><div class="try-lbl" style="display:flex;justify-content:space-between;align-items:center">Extra Headers <button class="icon-btn" style="padding:1px 7px;font-size:10px" onclick="_addCrHeader(\''+tabId+'\')">+ Add</button></div>'+
    '<div id="cr-headers-'+tabId+'">'+headerRows+'</div>'+
    '<div style="font-size:10px;color:var(--fg3);margin-top:4px">Authorization is added automatically. Add extra headers like <code>X-Custom</code> here.</div></div>'+
    '<div class="try-sec" id="cr-body-sec-'+tabId+'" style="display:'+(req.method==='GET'||req.method==='DELETE'?'none':'block')+'">'+
    '<div class="try-lbl">Request Body (JSON)</div>'+
    '<textarea class="try-body" id="cr-body-'+tabId+'" style="min-height:100px">'+escTA(req.body||'')+'</textarea>'+
    '<div class="btn-row" style="margin-top:6px">'+
    '<button class="btn btn-sec" onclick="fmtCrBody(\''+tabId+'\')">Format JSON</button>'+
    '<button class="btn btn-sec" onclick="clearCrBody(\''+tabId+'\')">Clear</button>'+
    '</div></div>'+
    '<div class="btn-row" style="margin-bottom:16px">'+
    '<button class="btn btn-pri" id="cr-exec-btn-'+tabId+'" onclick="executeCustomReq(\''+tabId+'\')" title="Execute (⌘↵ / Ctrl+Enter)">&#9654; Execute <span style="font-size:9px;opacity:.6">⌘↵</span></button>'+
    '<button class="btn btn-sec" onclick="saveCustomReq(\''+tabId+'\','+(isNew?'true':'false')+')">&#128190; '+(isNew?'Save':'Update')+'</button>'+
    (!isNew?'<button class="btn btn-sec" onclick="saveCustomReqAsNew(\''+tabId+'\')">Save as New</button>':'')+
    (!isNew?'<button class="btn btn-sec" title="Duplicate" onclick="_duplicateCrTab(\''+tabId+'\')">&#128203; Duplicate</button>':'')+
    '<div style="flex:1"></div>'+
    '<button class="btn btn-sec" onclick="copyCrCurl(\''+tabId+'\')">cURL</button>'+
    '<button class="btn btn-sec" onclick="copyCrApex(\''+tabId+'\')">Apex</button>'+
    '</div>'+
    '<div id="cr-status-pill-'+tabId+'" style="margin-bottom:8px"></div>'+
    '<div id="cr-extract-'+tabId+'"></div>'+
    '<div class="resp-toolbar" id="cr-resp-toolbar-'+tabId+'" style="display:none">'+
      '<input placeholder="Search response…" oninput="respSearchTree(\''+tabId+'\',this.value)" style="flex:1;font-size:10px;padding:2px 6px;background:var(--bg2);border:1px solid var(--border);border-radius:4px;color:var(--fg);outline:none">'+
      '<button id="cr-rtree-'+tabId+'" class="rt-btn active" onclick="switchRespMode(\''+tabId+'\',\'tree\',document.getElementById(\'cr-rtree-'+tabId+'\'),document.getElementById(\'cr-rraw-'+tabId+'\'))">Tree</button>'+
      '<button id="cr-rraw-'+tabId+'"  class="rt-btn" onclick="switchRespMode(\''+tabId+'\',\'raw\',document.getElementById(\'cr-rtree-'+tabId+'\'),document.getElementById(\'cr-rraw-'+tabId+'\'))">Raw</button>'+
    '</div>'+
    '<div class="resp-box" id="cr-resp-'+tabId+'" style="color:var(--fg3)">Response will appear here after execution.</div>';

  // Auto-prettify on paste
  setTimeout(()=>{
    const tb=document.getElementById('cr-body-'+tabId);
    if(tb) tb.addEventListener('paste',e=>{ setTimeout(()=>{ try{ tb.value=JSON.stringify(JSON.parse(tb.value),null,2); }catch(_){} },10); });
  },0);
}

function _updateCrBody(tabId){
  const m=(document.getElementById('cr-method-'+tabId)||{}).value||'GET';
  const sec=document.getElementById('cr-body-sec-'+tabId);
  if(sec) sec.style.display=(m==='GET'||m==='DELETE')?'none':'block';
}
function _addCrHeader(tabId){
  const c=document.getElementById('cr-headers-'+tabId); if(!c) return;
  const row=document.createElement('div'); row.className='cr-hdr-row'; row.style.cssText='display:flex;gap:4px;margin-bottom:4px';
  row.innerHTML='<input class="try-inp" placeholder="Header name" style="flex:1;font-family:monospace;font-size:11px"><input class="try-inp" placeholder="Value" style="flex:2;font-size:11px"><button class="icon-btn" style="padding:2px 6px;font-size:11px;color:var(--red)" onclick="this.closest(\'.cr-hdr-row\').remove()">&#10005;</button>';
  c.appendChild(row); row.querySelector('input').focus();
}
function _readCrHeaders(tabId){
  const headers={}; document.querySelectorAll('#cr-headers-'+tabId+' .cr-hdr-row').forEach(row=>{
    const inputs=row.querySelectorAll('input'); const k=inputs[0]?.value.trim(); const v=inputs[1]?.value.trim(); if(k) headers[k]=v||'';
  }); return headers;
}
function _readCrForm(tabId){
  return {
    name:(document.getElementById('cr-name-'+tabId)?.value||'').trim(),
    method:document.getElementById('cr-method-'+tabId)?.value||'GET',
    path:(document.getElementById('cr-path-'+tabId)?.value||'').trim(),
    headers:_readCrHeaders(tabId),
    body:(document.getElementById('cr-body-'+tabId)?.value||'').trim(),
  };
}
function saveCustomReq(tabId, isNew){
  const f=_readCrForm(tabId);
  if(!f.name){ showToast('Give this request a name.','error'); return; }
  if(!f.path){ showToast('Path is required.','error'); return; }
  const tab=tabs.find(t=>t.id===tabId);
  if(!isNew&&tab&&tab.reqId){
    vscMsg({type:'updateCustomRequest', id:tab.reqId, ...f});
    tab.label=f.name; renderTabBar();
  } else {
    vscMsg({type:'saveCustomRequest', ...f});
  }
}
function saveCustomReqAsNew(tabId){
  const f=_readCrForm(tabId);
  vscMsg({type:'saveCustomRequest', ...f});
}
function _duplicateCrTab(tabId){
  const tab=tabs.find(function(t){ return t.id===tabId; });
  const origReq=tab&&tab.reqId?customRequests.find(function(r){ return r.id===tab.reqId; }):null;
  if(origReq){ duplicateCustomReq(origReq.id); } else {
    const f=_readCrForm(tabId);
    f.name=f.name+' (copy)';
    vscMsg({type:'saveCustomRequest', ...f});
  }
}
function fmtCrBody(tabId){ const el=document.getElementById('cr-body-'+tabId); if(!el) return; try{ el.value=JSON.stringify(JSON.parse(el.value),null,2); }catch(e){ showToast(_jsonErrMsg(el.value,e),'error'); } }
function clearCrBody(tabId){ const el=document.getElementById('cr-body-'+tabId); if(el) el.value=''; }

function executeCustomReq(tabId){
  const orgAlias=document.getElementById('org-select').value;
  if(!orgAlias){ showToast('Select an org first.','error'); return; }
  const f=_readCrForm(tabId);
  const body=applyVars(f.body);
  let path=applyVars(f.path);

  // Substitute :paramName path variables from path-var inputs
  document.querySelectorAll('.cr-pathvar-'+tabId).forEach(inp=>{
    const key=inp.dataset.key; const val=inp.value.trim();
    if(key&&val) path=path.replace(':'+key, encodeURIComponent(val));
  });

  // Append query params from editable rows
  const qpKeys=document.querySelectorAll('[id^="cr-qpk-'+tabId+'-"]');
  const qpVals=document.querySelectorAll('[id^="cr-qpv-'+tabId+'-"]');
  const qps=[];
  qpKeys.forEach((k,i)=>{ if(k.value.trim()) qps.push(k.value.trim()+'='+encodeURIComponent(qpVals[i]?.value||'')); });
  if(qps.length) path+=(path.includes('?')?'&':'?')+qps.join('&');
  const btn=document.getElementById('cr-exec-btn-'+tabId);
  const resp=document.getElementById('cr-resp-'+tabId);
  const pill=document.getElementById('cr-status-pill-'+tabId);
  const crExtract=document.getElementById('cr-extract-'+tabId);
  btnExecuting(btn);
  resp.style.color='var(--fg3)'; resp.textContent='Waiting for response…';
  if(pill) pill.innerHTML='';
  if(crExtract) crExtract.innerHTML='';
  const requestId=++reqCounter;
  pendingReqs[requestId]=(result)=>{
    btnReady(btn, '▶ Execute ⌘↵');
    const st=result.status;
    setPill(pill, st, result.durationMs, handle401(result));
    const crToolbar=document.getElementById('cr-resp-toolbar-'+tabId);
    setRespBox(resp, crToolbar, result.body, st, tabId);
    updateStatusBar(f.method, path, st, result.durationMs);
    // Auto-extract IDs banner (same as catalog)
    let crParsed=null; try{ crParsed=JSON.parse(result.body); }catch(_){}
    if(crParsed&&st>=200&&st<300&&crExtract){
      const ids=extractIds(crParsed);
      if(ids.length){
        crExtract.innerHTML='<div style="margin-top:8px;font-size:11px;font-weight:600;color:var(--fg2);margin-bottom:4px">&#128190; Save to Variables</div>'+
          ids.map(function(e){ return '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">'+
            '<span style="font-family:monospace;font-size:10px;color:var(--acc);min-width:140px;flex-shrink:0">{{'+esc(suggestVarName(e.key,e.value))+'}}</span>'+
            '<span style="font-size:11px;color:var(--fg2);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(e.value)+'</span>'+
            '<button class="btn btn-sec" style="font-size:10px;padding:2px 8px;flex-shrink:0" onclick="saveResponseVar(\''+esc(suggestVarName(e.key,e.value))+'\',\''+esc(e.value)+'\')">Save</button>'+
            '</div>'; }).join('');
      }
    }
  };
  const crVerEl = document.getElementById('cr-ver-'+tabId);
  const crApiVersion = (crVerEl && crVerEl.value.trim()) || 'v67.0';
  // Apply var substitution to header values
  const resolvedHeaders = {};
  for(const [k,v] of Object.entries(f.headers||{})){ resolvedHeaders[k] = applyVars(v); }
  vscMsg({type:'executeCustom', requestId, orgAlias, method:f.method, path, headers:resolvedHeaders, body, apiVersion:crApiVersion});
}

function copyCrCurl(tabId){
  const f=_readCrForm(tabId); const body=applyVars(f.body);
  const lines=['curl -X '+f.method+' \\','  "https://YOUR_INSTANCE.salesforce.com'+f.path+'" \\','  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\','  -H "Content-Type: application/json"'];
  Object.entries(f.headers||{}).forEach(([k,v])=>{ lines[lines.length-1]+=' \\'; lines.push('  -H "'+k.replace(/"/g,'\\"')+': '+v.replace(/"/g,'\\"')+'"'); });
  if(body){ lines[lines.length-1]+=' \\'; lines.push('  -d \''+body.replace(/'/g,"'\\''")+'\'' ); }
  navigator.clipboard.writeText(lines.join('\n')).then(()=>_copyToast('cURL copied'));
}
function copyCrApex(tabId){
  const f=_readCrForm(tabId); const body=applyVars(f.body);
  const lines=['HttpRequest req = new HttpRequest();','req.setEndpoint(\'callout:Named_Cred'+f.path+'\');','req.setMethod(\''+f.method+'\');','req.setHeader(\'Content-Type\', \'application/json\');'];
  Object.entries(f.headers||{}).forEach(([k,v])=>lines.push('req.setHeader(\''+k.replace(/'/g,"\\'")+'\', \''+v.replace(/'/g,"\\'")+'\');'));
  if(body) lines.push('req.setBody(\''+body.replace(/\\/g,'\\\\').replace(/'/g,"\\'")+'\');');
  lines.push('Http h = new Http();','HttpResponse res = h.send(req);','System.debug(res.getStatusCode() + \' \' + res.getBody());');
  navigator.clipboard.writeText(lines.join('\n')).then(()=>_copyToast('Apex copied'));
}

// ── Diff viewer ───────────────────────────────────────────────────────────────
function _diffSlug(lbl){ return lbl.replace(/[^a-z0-9]/gi,'_').toLowerCase().slice(0,40)+'_'+Date.now().toString(36); }
function setDiffBaseline(label, body, tabId){
  const respEl=document.getElementById('try-resp-'+tabId)||document.getElementById('cr-resp-'+tabId);
  const respBody=respEl?respEl.textContent:'';
  const lbl=label||(tabs.find(t=>t.id===tabId)?.label||'response');
  const key=_diffSlug(lbl);
  _diffBaselines[key]={label:lbl, body:respBody, key};
  // Update baseline selector in diff modal
  const sel=document.getElementById('diff-baseline-select');
  if(sel){
    const opt=document.createElement('option');
    opt.value=key; opt.textContent=lbl; sel.appendChild(opt);
    sel.value=key;
  }
  // Enable diff buttons
  document.querySelectorAll('[id^="diff-btn-"]').forEach(b=>b.disabled=false);
  _copyToast('Baseline set: '+lbl);
}
function _refreshDiffSelect(){
  const sel=document.getElementById('diff-baseline-select');
  if(!sel) return;
  const prev=sel.value;
  sel.innerHTML=Object.values(_diffBaselines).map(b=>'<option value="'+esc(b.key)+'">'+esc(b.label)+'</option>').join('');
  if(prev&&_diffBaselines[prev]) sel.value=prev;
}
function showDiff(tabId){
  const entries=Object.keys(_diffBaselines);
  if(!entries.length){ showToast('Set a baseline first using the Baseline button.','error'); return; }
  _refreshDiffSelect();
  const sel=document.getElementById('diff-baseline-select');
  const key=sel?sel.value:entries[0];
  const baseline=_diffBaselines[key]||_diffBaselines[entries[0]];
  const respEl=document.getElementById('try-resp-'+tabId)||document.getElementById('cr-resp-'+tabId);
  const newBody=respEl?respEl.textContent:'';
  const leftLines=baseline.body.split('\n');
  const rightLines=newBody.split('\n');
  const maxLen=Math.max(leftLines.length,rightLines.length);
  let leftHtml='',rightHtml='';
  for(let i=0;i<maxLen;i++){
    const l=leftLines[i]??''; const r=rightLines[i]??'';
    if(l===r){ leftHtml+=esc(l)+'\n'; rightHtml+=esc(r)+'\n'; }
    else if(!r){ leftHtml+='<span class="diff-del">'+esc(l)+'</span>\n'; rightHtml+='\n'; }
    else if(!l){ leftHtml+='\n'; rightHtml+='<span class="diff-add">'+esc(r)+'</span>\n'; }
    else{ leftHtml+='<span class="diff-chg">'+esc(l)+'</span>\n'; rightHtml+='<span class="diff-chg">'+esc(r)+'</span>\n'; }
  }
  document.getElementById('diff-left').innerHTML=leftHtml;
  document.getElementById('diff-right').innerHTML=rightHtml;
  document.getElementById('diff-modal').classList.add('on');
}
function closeDiff(){ document.getElementById('diff-modal').classList.remove('on'); }

// ── Status bar ────────────────────────────────────────────────────────────────
function updateStatusBar(method, path, status, durationMs){
  const req=document.getElementById('sb-last-req');
  const st=document.getElementById('sb-last-status');
  if(req) req.textContent=method+' '+path;
  if(st){
    let cls='serr';
    if(status>=200&&status<300) cls='s2xx'; else if(status>=400&&status<500) cls='s4xx'; else if(status>=500) cls='s5xx';
    st.innerHTML='<span class="status-pill '+cls+'" style="font-size:9px;padding:1px 6px">'+status+(durationMs?' — '+durationMs+'ms':'')+'</span>';
  }
}

// ── Playbooks ─────────────────────────────────────────────────────────────────
function _pbCardHtml(pb, isCustom){
  const permsHtml=(pb.requiredPermissions&&pb.requiredPermissions.length)
    ? '<div style="margin-bottom:6px">'+
      '<div style="font-size:10px;color:var(--fg3);margin-bottom:3px">Required Permissions:</div>'+
      '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:4px">'+
      pb.requiredPermissions.map(p=>
        '<span id="perm-chip-'+esc(pb.id)+'-'+esc(p.apiName)+'" title="'+esc(p.apiName)+'" style="font-size:10px;padding:1px 8px;border-radius:10px;background:var(--bg2);border:1px solid var(--border);color:var(--fg2)">'+esc(p.name)+'</span>'
      ).join('')+
      '</div>'+
      '<button class="btn btn-sec" style="font-size:10px;padding:2px 8px" onclick="assignPermSets(\''+esc(pb.id)+'\')">&#10003; Assign Permissions</button>'+
      '<span id="perm-status-'+esc(pb.id)+'" style="font-size:10px;color:var(--fg3);margin-left:6px"></span>'+
      '</div>'
    : '';
  const notesHtml=pb.notes
    ? '<div style="font-size:10px;color:var(--fg3);margin-bottom:6px;padding:4px 6px;background:var(--bg2);border-radius:4px;border-left:2px solid var(--accent,#569cd6)">'+esc(pb.notes)+'</div>'
    : '';
  const customBadge=isCustom ? '<span style="font-size:9px;padding:1px 6px;border-radius:8px;background:var(--bg2);border:1px solid var(--accent,#569cd6);color:var(--accent,#569cd6);margin-left:6px;vertical-align:middle">custom</span>' : '';
  const editDeleteBtns=isCustom
    ? '<button class="btn btn-sec" style="font-size:11px;padding:3px 8px" onclick="openPlaybookBuilder(\''+esc(pb.id)+'\')">&#9998; Edit</button>'+
      '<button class="btn btn-sec" style="font-size:11px;padding:3px 8px;color:var(--red)" onclick="deleteCustomPlaybook(\''+esc(pb.id)+'\',\''+esc(pb.name)+'\')">&#10005;</button>'
    : '';
  return '<div style="margin:4px 10px;padding:10px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:6px">'+
    '<div style="font-size:12px;font-weight:600;color:var(--fg);margin-bottom:2px">'+esc(pb.name)+customBadge+'</div>'+
    '<div style="font-size:11px;color:var(--fg2);margin-bottom:6px">'+esc(pb.description)+'</div>'+
    notesHtml+
    permsHtml+
    '<div style="display:flex;gap:6px;flex-wrap:wrap">'+
    '<button class="btn btn-pri" style="font-size:11px;padding:3px 10px" onclick="startPlaybook(\''+esc(pb.id)+'\')">&#9654; Start</button>'+
    editDeleteBtns+
    '</div>'+
    '</div>';
}

function renderPlaybookCards(){
  const cards=document.getElementById('pb-cards'); if(!cards) return;
  const allPbs = [...playbooks, ...customPlaybooks];
  const header='<div style="padding:6px 10px 4px;display:flex;justify-content:flex-end">'+
    '<button class="btn btn-sec" style="font-size:11px;padding:3px 10px" onclick="openPlaybookBuilder()">&#43; New Playbook</button>'+
    '</div>';
  if(!allPbs.length){ cards.innerHTML=header+'<div style="padding:14px;color:var(--fg3);font-size:12px">No playbooks loaded.</div>'; return; }
  cards.innerHTML=header+
    playbooks.map(pb=>_pbCardHtml(pb,false)).join('')+
    (customPlaybooks.length ? '<div style="padding:4px 10px 2px;font-size:10px;color:var(--fg3);font-weight:600;text-transform:uppercase;letter-spacing:.04em">My Playbooks</div>'+customPlaybooks.map(pb=>_pbCardHtml(pb,true)).join('') : '');
}

function deleteCustomPlaybook(pbId, pbName){
  showConfirm('Delete playbook "'+pbName+'"?', ()=>{
    vscMsg({type:'deleteCustomPlaybook', id:pbId});
  });
}

function assignPermSets(pbId){
  const pb=[...playbooks,...customPlaybooks].find(p=>p.id===pbId);
  if(!pb||!pb.requiredPermissions||!pb.requiredPermissions.length) return;
  const statusEl=document.getElementById('perm-status-'+pbId);
  if(statusEl) statusEl.textContent='Assigning…';
  const orgAlias=document.getElementById('org-select')?.value;
  vscMsg({type:'assignPermSets', pbId, permApiNames:pb.requiredPermissions.map(p=>p.apiName), orgAlias});
}

// Alias for old call sites
function renderPlaybooksTab(){ renderPlaybookCards(); }

// ── Playbook Builder ──────────────────────────────────────────────────────────
let _builderState = null; // { id, name, desc, steps:[{endpointId,label,initialBody,extract:[{from,into}]}] }

function openPlaybookBuilder(pbId){
  const pbCardsEl = document.getElementById('pb-cards');
  if(!pbCardsEl) return;
  if(pbId){
    const pb = customPlaybooks.find(p=>p.id===pbId);
    _builderState = pb ? {
      id: pb.id,
      name: pb.name,
      desc: pb.description||'',
      steps: (pb.steps||[]).map(s=>({
        endpointId: s.endpointId||'',
        label: s.label||'',
        initialBody: s.initialBody||'',
        extract: (s.extract||[]).map(r=>({from:r.from||'',into:r.into||''}))
      }))
    } : {id:'', name:'', desc:'', steps:[]};
  } else {
    _builderState = {id:'', name:'', desc:'', steps:[]};
  }
  pbCardsEl.style.display='none';
  let builderEl = document.getElementById('pb-builder');
  if(!builderEl){
    builderEl = document.createElement('div');
    builderEl.id = 'pb-builder';
    pbCardsEl.parentNode.insertBefore(builderEl, pbCardsEl.nextSibling);
  }
  builderEl.style.display='block';
  _renderBuilder();
}

function closePlaybookBuilder(){
  const pbCardsEl = document.getElementById('pb-cards');
  const builderEl = document.getElementById('pb-builder');
  if(pbCardsEl) pbCardsEl.style.display='';
  if(builderEl) builderEl.style.display='none';
  _builderState = null;
}

function _epOptionsByCategory(){
  return Object.entries(
    endpoints.reduce((acc,ep)=>{ (acc[ep.category]=acc[ep.category]||[]).push(ep); return acc; },{})
  ).map(([cat,eps])=>
    '<optgroup label="'+esc(cat)+' — '+(CAT_LABELS[cat]||cat)+'">'+
    eps.map(ep=>'<option value="'+esc(ep.id)+'">'+esc(ep.name)+'</option>').join('')+
    '</optgroup>'
  ).join('');
}

function _renderBuilder(){
  const builderEl = document.getElementById('pb-builder');
  if(!builderEl||!_builderState) return;
  const s = _builderState;
  const stepsHtml = s.steps.map((step,i)=>{
    const extractHtml = step.extract.map((rule,ri)=>
      '<div style="display:flex;align-items:center;gap:4px;margin-bottom:3px">'+
      '<input class="try-inp" placeholder="$.response.field" value="'+esc(rule.from)+'" style="flex:1;font-size:10px;font-family:monospace" oninput="_builderState.steps['+i+'].extract['+ri+'].from=this.value">'+
      '<span style="color:var(--fg3);font-size:11px">&#8594;</span>'+
      '<input class="try-inp" placeholder="next.body.field" value="'+esc(rule.into)+'" style="flex:1;font-size:10px;font-family:monospace" oninput="_builderState.steps['+i+'].extract['+ri+'].into=this.value">'+
      '<button class="icon-btn" style="color:var(--red);padding:1px 5px;font-size:10px" onclick="removeExtractRule('+i+','+ri+')">&#10005;</button>'+
      '</div>'
    ).join('');
    return '<div style="margin-bottom:8px;padding:10px 12px;background:var(--bg2);border:1px solid var(--border);border-radius:6px">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'+
      '<span style="font-size:11px;font-weight:600;color:var(--fg)">Step '+(i+1)+'</span>'+
      '<button class="icon-btn" style="color:var(--red);padding:1px 6px;font-size:11px" onclick="removeBuilderStep('+i+')">&#10005; Remove</button>'+
      '</div>'+
      '<div style="margin-bottom:4px"><label style="font-size:10px;color:var(--fg3)">Endpoint</label>'+
      '<select style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--fg);border-radius:4px;font-size:11px;padding:3px;margin-top:2px" onchange="onBuilderEndpointChange('+i+',this.value)">'+
      '<option value="">— Select endpoint —</option>'+
      _epOptionsByCategory().replace('value="'+esc(step.endpointId)+'"','value="'+esc(step.endpointId)+'" selected')+
      '</select></div>'+
      '<div style="margin-bottom:4px"><label style="font-size:10px;color:var(--fg3)">Step Label</label>'+
      '<input class="try-inp" value="'+esc(step.label)+'" placeholder="Step '+(i+1)+' — description" style="width:100%;margin-top:2px;font-size:11px" oninput="_builderState.steps['+i+'].label=this.value"></div>'+
      '<div style="margin-bottom:4px"><label style="font-size:10px;color:var(--fg3)">Initial Body (JSON, optional)</label>'+
      '<textarea style="width:100%;min-height:60px;margin-top:2px;font-size:10px;font-family:monospace;background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--fg);padding:4px;box-sizing:border-box;resize:vertical" oninput="_builderState.steps['+i+'].initialBody=this.value">'+escTA(step.initialBody)+'</textarea></div>'+
      '<div><label style="font-size:10px;color:var(--fg3)">Extract Rules</label>'+
      '<div style="margin-top:4px">'+extractHtml+'</div>'+
      '<button class="btn btn-sec" style="font-size:10px;padding:1px 8px;margin-top:4px" onclick="addExtractRule('+i+')">+ Add Rule</button>'+
      '</div>'+
      '</div>';
  }).join('');

  builderEl.innerHTML=
    '<div style="padding:10px 12px 6px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--border);margin-bottom:8px">'+
    '<button class="btn btn-sec" style="font-size:11px;padding:2px 8px" onclick="closePlaybookBuilder()">&#8592; Back</button>'+
    '<span style="font-size:13px;font-weight:600;color:var(--fg)">'+(s.id?'Edit Playbook':'New Playbook')+'</span>'+
    '</div>'+
    '<div style="padding:0 12px">'+
    '<div style="margin-bottom:6px"><label style="font-size:10px;color:var(--fg3)">Name *</label>'+
    '<input class="try-inp" id="builder-name" value="'+esc(s.name)+'" placeholder="My API Flow" style="width:100%;margin-top:2px" oninput="_builderState.name=this.value"></div>'+
    '<div style="margin-bottom:10px"><label style="font-size:10px;color:var(--fg3)">Description</label>'+
    '<input class="try-inp" id="builder-desc" value="'+esc(s.desc)+'" placeholder="What does this playbook do?" style="width:100%;margin-top:2px" oninput="_builderState.desc=this.value"></div>'+
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'+
    '<span style="font-size:11px;font-weight:600;color:var(--fg)">Steps</span>'+
    '<button class="btn btn-sec" style="font-size:11px;padding:2px 8px" onclick="addBuilderStep()">+ Add Step</button>'+
    '</div>'+
    stepsHtml+
    (s.steps.length===0?'<div style="padding:12px;color:var(--fg3);font-size:11px;text-align:center">No steps yet. Click "+ Add Step" to begin.</div>':'')+
    '<div style="display:flex;justify-content:flex-end;gap:8px;padding-top:10px;border-top:1px solid var(--border);margin-top:8px">'+
    '<button class="btn btn-sec" onclick="closePlaybookBuilder()">Cancel</button>'+
    '<button class="btn btn-pri" onclick="saveBuilderPlaybook()">&#128190; Save Playbook</button>'+
    '</div>'+
    '</div>';
}

function addBuilderStep(){
  if(!_builderState) return;
  _builderState.steps.push({endpointId:'',label:'',initialBody:'',extract:[]});
  _renderBuilder();
}

function removeBuilderStep(idx){
  if(!_builderState) return;
  _builderState.steps.splice(idx,1);
  _renderBuilder();
}

function addExtractRule(stepIdx){
  if(!_builderState||!_builderState.steps[stepIdx]) return;
  _builderState.steps[stepIdx].extract.push({from:'',into:''});
  _renderBuilder();
}

function removeExtractRule(stepIdx, ruleIdx){
  if(!_builderState||!_builderState.steps[stepIdx]) return;
  _builderState.steps[stepIdx].extract.splice(ruleIdx,1);
  _renderBuilder();
}

function onBuilderEndpointChange(stepIdx, epId){
  if(!_builderState||!_builderState.steps[stepIdx]) return;
  _builderState.steps[stepIdx].endpointId = epId;
  const ep = endpoints.find(e=>e.id===epId);
  if(ep && !_builderState.steps[stepIdx].initialBody){
    const hasBody = ['POST','PUT','PATCH'].includes(ep.methods[0]);
    _builderState.steps[stepIdx].initialBody = hasBody ? (ep.request||'') : '';
  }
  if(ep && !_builderState.steps[stepIdx].label){
    _builderState.steps[stepIdx].label = 'Step '+(_builderState.steps.indexOf(_builderState.steps[stepIdx])+1)+' — '+ep.name;
  }
  _renderBuilder();
}

function saveBuilderPlaybook(){
  if(!_builderState) return;
  const name = _builderState.name.trim();
  if(!name){ showToast('Name is required','error'); return; }
  if(!_builderState.steps.length){ showToast('Add at least one step','error'); return; }
  for(let i=0;i<_builderState.steps.length;i++){
    if(!_builderState.steps[i].endpointId){ showToast('Step '+(i+1)+' needs an endpoint selected','error'); return; }
  }
  const id = _builderState.id || ('custom-'+(Date.now().toString(36)));
  const pb = {
    id,
    name,
    description: _builderState.desc||'',
    mode: 'playbook',
    execution: 'hybrid',
    steps: _builderState.steps.map((s,i)=>({
      id: 'step-'+(i+1),
      endpointId: s.endpointId,
      label: s.label || ('Step '+(i+1)+' — '+(endpoints.find(e=>e.id===s.endpointId)?.name||s.endpointId)),
      initialBody: s.initialBody||undefined,
      extract: s.extract.filter(r=>r.from.trim()&&r.into.trim()).map(r=>({from:r.from.trim(),into:r.into.trim()}))
    }))
  };
  vscMsg({type:'saveCustomPlaybook', playbook:pb});
  closePlaybookBuilder();
  showToast('Playbook saved','success');
}

function startPlaybook(pbId){
  const orgAlias=document.getElementById('org-select').value;
  if(!orgAlias){ showToast('Select an org first.','error'); return; }
  selPlaybook=pbId;
  vscMsg({type:'chainStart', playbookId:pbId, orgAlias, mode:chainMode, execution:chainExec, apiVersion:DEFAULT_API_VERSION||'v66.0'});
  showChainDetail(pbId);
}

function _chainDetailHTML(pb){
  return '<div style="padding:18px 24px 8px;font-size:16px;font-weight:700;color:var(--fg)">'+(pb?.name||'Chain Runner')+'</div>'+
    '<div style="padding:0 24px 10px;display:flex;gap:8px;flex-wrap:wrap">'+
    '<button class="btn btn-pri" onclick="runAllSteps()">&#9654; Run All</button>'+
    '<button class="btn btn-sec" onclick="pauseChain()">&#9646;&#9646; Pause</button>'+
    '<button class="btn btn-sec" onclick="runComposite()" title="Run as Salesforce Composite API">&#9728; Composite</button>'+
    '</div>'+
    '<div id="chain-timeline" style="padding:0 24px 16px"></div>'+
    '<div id="chain-composite-wrap" style="display:none;margin:0 24px 16px;padding:10px 12px;background:var(--bg2);border:1px solid var(--border);border-radius:6px">'+
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'+
    '<span style="font-size:11px;font-weight:600;color:var(--fg)">&#9728; Composite Payload</span>'+
    '<div style="display:flex;gap:6px">'+
    '<button class="btn btn-sec" style="font-size:10px;padding:2px 8px" onclick="copyCompositePayload()">Copy</button>'+
    '<button class="btn btn-pri" style="font-size:10px;padding:2px 8px" onclick="sendComposite()">Send &#8594;</button>'+
    '</div></div>'+
    '<textarea id="chain-composite-payload" style="width:100%;min-height:200px;max-height:400px;font-size:10px;font-family:monospace;padding:6px;background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--fg);resize:vertical;box-sizing:border-box"></textarea>'+
    '<div id="chain-composite-resp-wrap" style="display:none;margin-top:8px">'+
    '<div style="font-size:10px;font-weight:600;color:var(--fg2);margin-bottom:3px">Response</div>'+
    '<pre id="chain-composite-resp" style="font-size:10px;max-height:300px;overflow-y:auto;padding:6px;background:var(--bg);border:1px solid var(--border);border-radius:4px;white-space:pre-wrap;word-break:break-all"></pre>'+
    '</div>'+
    '</div>';
}

function showChainDetail(pbId){
  const pb=[...playbooks,...customPlaybooks].find(p=>p.id===pbId);
  const label=(pb?.name||pbId)+' ▶';

  // Always reuse a single playbook runner tab — prevents duplicate #chain-timeline IDs
  const existing=tabs.find(t=>t.type==='playbook');
  if(existing){
    existing.pbId=pbId;
    existing.label=label;
    renderTabBar();
    const det=document.getElementById('tp-'+existing.id);
    if(det) det.innerHTML=_chainDetailHTML(pb);
    activateTab(existing.id);
    renderChainTimeline();
    return;
  }

  const tabId='tab-'+(++tabCounter);
  tabs.push({id:tabId, type:'playbook', label, pbId});
  renderTabBar();

  const det=document.createElement('div');
  det.id='tp-'+tabId;
  det.className='tab-panel';
  det.style.padding='0';
  det.innerHTML=_chainDetailHTML(pb);
  document.getElementById('detail').appendChild(det);
  activateTab(tabId);
  renderChainTimeline();
}

let chainPaused=false;
function pauseChain(){ chainPaused=true; }
function runAllSteps(){ chainPaused=false; if(chainMode==='composite'){ runComposite(); return; } vscMsg({type:'chainRunAll'}); }
function runComposite(){ vscMsg({type:'chainCompositePreview'}); }
function sendComposite(){ const ta=document.getElementById('chain-composite-payload'); vscMsg({type:'chainComposite',body:ta?ta.value:null}); }
function copyCompositePayload(){ const ta=document.getElementById('chain-composite-payload'); if(ta){ navigator.clipboard.writeText(ta.value); _copyToast('Composite payload copied'); } }

function renderChainTimeline(){
  const tl=document.getElementById('chain-timeline'); if(!tl||!chainSession) return;
  // M1: sticky failure banner
  const failedIdx=chainSession.steps.findIndex(s=>s.status==='error');
  const bannerHtml=failedIdx>=0
    ? '<div style="position:sticky;top:0;z-index:10;padding:7px 12px;background:var(--red-bg,#3b0d0d);border:1px solid var(--red,#f44747);border-radius:5px;margin-bottom:10px;font-size:11px;color:var(--red,#f44747)">'+
      '&#9888; Step '+(failedIdx+1)+' failed — <a href="#" style="color:var(--red,#f44747);text-decoration:underline" onclick="document.querySelector(\'.chain-step-error\').scrollIntoView({behavior:\'smooth\'});return false">scroll to error</a></div>'
    : '';
  const stepsHtml=chainSession.steps.map((step,i)=>{
    const icon=step.status==='done'?'&#10003;':step.status==='error'?'&#10007;':step.status==='running'?'<span class="spin">&#9696;</span>':'&#9675;';
    const color=step.status==='done'?'var(--green)':step.status==='error'?'var(--red)':step.status==='running'?'var(--yellow)':'var(--fg3)';
    const dur=step.response?' <span style="color:var(--fg3);font-size:10px">'+step.response.durationMs+'ms</span>':'';
    const httpBadge=step.response?'<span style="font-size:10px;padding:1px 6px;border-radius:3px;margin-left:6px;background:'+(step.response.status<300?'#0d3b2e':'#3b2d0d')+';color:'+(step.response.status<300?'var(--green)':'var(--yellow)')+'">HTTP '+step.response.status+'</span>':'';
    const isActive=chainSession.activeStep===i&&step.status==='pending';
    const isDone=step.status==='done';
    const isError=step.status==='error';
    const extractedEntries=Object.entries(step.extractedValues||{});

    // Extracted vars: editable on active step, read-only on done/error
    const extractedHtml=extractedEntries.map(([k,v])=>{
      if(isActive){
        return '<tr>'+
          '<td style="padding:2px 6px;font-size:10px;color:var(--cyan);white-space:nowrap;vertical-align:middle">&#8627; '+esc(k.split('.').pop())+'</td>'+
          '<td style="padding:2px 4px"><input class="try-inp" style="font-size:10px;font-family:monospace;width:100%;padding:2px 4px" value="'+esc(v)+
          '" oninput="overrideExtracted('+i+',\''+esc(k)+'\',this.value)"></td>'+
          '</tr>';
      }
      return '<div style="font-size:10px;color:var(--cyan);margin-top:2px">&#8627; '+esc(k.split('.').pop())+': <b>'+esc(v)+'</b></div>';
    }).join('');
    const extractedSection=extractedEntries.length
      ? (isActive
          ? '<div style="font-size:10px;font-weight:600;color:var(--fg2);margin-bottom:3px">&#128101; Mapped Variables <span style="font-weight:400;color:var(--fg3)">(edit to override)</span></div>'+
            '<table style="width:100%;border-collapse:collapse;margin-bottom:4px">'+extractedHtml+'</table>'
          : '<div style="margin-top:4px">'+extractedHtml+'</div>')
      : '';

    // Path override row — shown for active step so user can fix {param} or add ?query
    const pathOverride=isActive
      ? '<div style="margin-top:6px;margin-bottom:4px">'+
        '<div style="font-size:10px;color:var(--fg3);margin-bottom:2px">URL <span style="opacity:.6">(edit to fix path params or add query params)</span></div>'+
        '<input id="chain-path-'+i+'" class="try-inp" style="width:100%;font-size:11px;font-family:monospace;padding:3px 6px" value="'+esc(step.resolvedPath)+
        '" oninput="overridePath('+i+',this.value)"></div>'
      : '';

    const seedPanel=isActive
      ? '<div id="seed-panel-'+i+'" style="display:none;margin-top:8px;padding:8px;background:var(--bg3);border:1px solid var(--border);border-radius:4px">'+
        '<div style="font-size:10px;font-weight:600;color:var(--fg2);margin-bottom:5px">Browse Org Records</div>'+
        '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:5px">'+
        '<select id="seed-type-'+i+'" style="font-size:10px;padding:2px 4px;background:var(--bg2);border:1px solid var(--border);border-radius:3px;color:var(--fg)">'+
        Object.values(SEED_RECIPES).map(r=>'<option value="'+r.key+'">'+r.label+'</option>').join('')+
        '</select>'+
        '<input id="seed-filter-'+i+'" placeholder="name filter…" style="font-size:10px;width:110px;padding:2px 5px;background:var(--bg2);border:1px solid var(--border);border-radius:3px;color:var(--fg)">'+
        '<button class="btn btn-sec" style="font-size:10px;padding:2px 8px" onclick="seedFetch('+i+')">Fetch</button>'+
        '</div>'+
        '<div id="seed-results-'+i+'" style="max-height:140px;overflow-y:auto;font-size:10px;color:var(--fg3)">Select a type and click Fetch.</div>'+
        '</div>'
      : '';
    const bodyTextarea=isActive
      ? '<textarea id="chain-body-'+i+'" style="width:100%;min-height:80px;padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:4px;color:var(--fg);font-size:11px;font-family:monospace;resize:vertical">'+escTA(step.resolvedBody)+'</textarea>'+
        '<div style="margin-top:4px;display:flex;gap:6px;flex-wrap:wrap">'+
        '<button class="btn btn-pri" style="font-size:11px;padding:3px 10px" onclick="runStep('+i+')">&#9654; Run Step</button>'+
        '<button class="btn btn-sec" style="font-size:11px;padding:3px 10px" onclick="saveBodyOverride('+i+')">Save Edit</button>'+
        '<button class="btn btn-sec" style="font-size:11px;padding:3px 10px" onclick="runFrom('+i+')">Run from here &#8594;</button>'+
        '<button class="btn btn-sec" style="font-size:11px;padding:3px 10px" onclick="toggleSeedPanel('+i+')">Browse Org &#128269;</button>'+
        '</div>'+
        seedPanel
      : '';

    const bodyArea=isActive&&extractedEntries.length
      ? '<div style="display:flex;gap:10px;margin-top:2px">'+
        '<div style="flex:1;min-width:0">'+extractedSection+'</div>'+
        '<div style="flex:2;min-width:0">'+bodyTextarea+'</div>'+
        '</div>'
      : (isActive?'<div style="margin-top:6px">'+bodyTextarea+'</div>':extractedSection);

    const rerunBtn=(isDone||isError)?'<button class="btn btn-sec" style="font-size:10px;padding:2px 8px;margin-left:6px" onclick="resetAndEdit('+i+')">Re-run</button>':'';

    // Response shown for both done and error steps
    const respBlock=step.response&&(isDone||isError)
      ? '<details style="margin-top:6px"'+(isError?' open':'')+'>'+
        '<summary style="font-size:10px;color:'+(isError?'var(--red)':'var(--fg3)')+';cursor:pointer;display:flex;align-items:center;gap:6px">'+
        '<span>'+(isError?'&#9888; Error Response':'Response')+'</span>'+
        (step.response.body.length>3000?'<button onclick="event.preventDefault();event.stopPropagation();copyChainResp('+i+')" style="font-size:9px;padding:1px 6px;background:var(--bg3);border:1px solid var(--border);border-radius:3px;color:var(--fg2);cursor:pointer;margin-left:4px">Copy full ('+Math.round(step.response.body.length/1024)+'KB)</button>':'')+
        '</summary>'+
        '<pre style="font-size:10px;max-height:200px;overflow-y:auto;margin-top:4px;padding:6px;background:var(--bg);border-radius:4px;white-space:pre-wrap;word-break:break-all">'+esc(step.response.body.slice(0,3000))+(step.response.body.length>3000?'\n… [truncated — '+step.response.body.length+' chars total\nClick \"Copy full\" above to copy the complete response]':'')+'</pre>'+
        '</details>'
      : '';

    // M2: extraction warnings
    const warnHtml=(step.extractionWarnings&&step.extractionWarnings.length)
      ? '<div style="color:var(--yellow,#dca966);font-size:10px;margin-top:4px">&#9888; Extract failed: '+step.extractionWarnings.map(w=>'<code>'+esc(w)+'</code>').join(', ')+'</div>'
      : '';

    const card='<div class="'+(isError?'chain-step-error':'')+'" style="margin-bottom:10px;padding:10px 12px;background:var(--bg2);border:1px solid '+(isActive?'var(--acc)':isError?'var(--red)':'var(--border)')+';border-radius:6px">'+
      '<div style="display:flex;align-items:center;gap:8px"><span style="color:'+color+';font-size:14px">'+icon+'</span><span style="font-size:12px;font-weight:600;color:var(--fg)">'+esc(step.label)+'</span>'+dur+httpBadge+rerunBtn+'</div>'+
      '<div style="font-size:10px;color:var(--fg3);margin-top:2px;font-family:monospace">'+esc(step.resolvedPath)+'</div>'+
      pathOverride+
      bodyArea+
      warnHtml+
      respBlock+
      '</div>';
    const connector=i<chainSession.steps.length-1?_connectorHtml(i):'';
    return card+connector;
  }).join('');
  tl.innerHTML=bannerHtml+stepsHtml;
}

function runStep(i){ const b=document.getElementById('chain-body-'+i); const body=b?b.value:undefined; if(body!=null&&chainSession) chainSession.steps[i].resolvedBody=body; vscMsg({type:'chainStep',stepIdx:i,body}); }
function runFrom(i){ const b=document.getElementById('chain-body-'+i); const body=b?b.value:undefined; if(body!=null&&chainSession) chainSession.steps[i].resolvedBody=body; vscMsg({type:'chainRunFrom',fromStepIdx:i,body}); }
function saveBodyOverride(i){ const b=document.getElementById('chain-body-'+i); if(!b||!chainSession) return; chainSession.steps[i].resolvedBody=b.value; vscMsg({type:'chainOverride',stepIdx:i,target:'body.__raw__',value:b.value}); showToast('Body saved','success'); }
function resetAndEdit(i){ vscMsg({type:'chainResetStep',stepIdx:i,apiVersion:DEFAULT_API_VERSION||'v66.0'}); }
function copyChainResp(i){
  const step=chainSession&&chainSession.steps&&chainSession.steps[i];
  if(!step||!step.response) return;
  navigator.clipboard.writeText(step.response.body).then(()=>showToast('Full response copied ('+Math.round(step.response.body.length/1024)+'KB)','ok')).catch(()=>showToast('Copy failed','error'));
}
function overrideExtracted(i, key, value){
  if(!chainSession) return;
  if(!chainSession.steps[i].extractedValues) chainSession.steps[i].extractedValues={};
  chainSession.steps[i].extractedValues[key]=value;
  // If the key maps to a path param, update the path input too
  if(key.startsWith('next.path.')){
    const param=key.slice('next.path.'.length);
    const pi=document.getElementById('chain-path-'+i);
    if(pi) pi.value=pi.value.replace('{'+param+'}',value);
    chainSession.steps[i].resolvedPath=(document.getElementById('chain-path-'+i)||{}).value||chainSession.steps[i].resolvedPath;
  }
  const b=document.getElementById('chain-body-'+i);
  if(b){
    const shortKey=key.split('.').pop();
    b.value=b.value.replace(new RegExp('"'+shortKey+'"\\s*:\\s*"[^"]*"','g'),'"'+shortKey+'": "'+value+'"');
  }
  vscMsg({type:'chainOverride',stepIdx:i,target:key,value});
}
function overridePath(i, value){
  if(!chainSession) return;
  chainSession.steps[i].resolvedPath=value;
  vscMsg({type:'chainOverride',stepIdx:i,target:'path.__raw__',value});
}

// ── Org Record Browser ────────────────────────────────────────────────────────
const SEED_RECIPES = {
  asset:     { key:'asset',     label:'Asset',         soql:(f)=>'SELECT Id, Name, Status FROM Asset'+(f?' WHERE Name LIKE \'%'+f+'%\'':'')+' ORDER BY Name LIMIT 20',                                              display:['Name','Status'] },
  account:   { key:'account',   label:'Account',       soql:(f)=>'SELECT Id, Name FROM Account'+(f?' WHERE Name LIKE \'%'+f+'%\'':'')+' ORDER BY Name LIMIT 20',                                                    display:['Name'] },
  quote:     { key:'quote',     label:'Quote',         soql:(f)=>'SELECT Id, Name, Status FROM Quote'+(f?' WHERE Name LIKE \'%'+f+'%\'':'')+' ORDER BY Name LIMIT 20',                                              display:['Name','Status'] },
  pricebook: { key:'pricebook', label:'Price Book',    soql:(f)=>'SELECT Id, Name FROM Pricebook2 WHERE IsActive=true'+(f?' AND Name LIKE \'%'+f+'%\'':'')+' LIMIT 20',                                             display:['Name'] },
  product:   { key:'product',   label:'Product2',      soql:(f)=>'SELECT Id, Name FROM Product2'+(f?' WHERE Name LIKE \'%'+f+'%\'':'')+' ORDER BY Name LIMIT 20',                                                   display:['Name'] },
  catalog:   { key:'catalog',   label:'Catalog (PCM)', soql:(f)=>'SELECT Id, Name FROM ProductCatalog'+(f?' WHERE Name LIKE \'%'+f+'%\'':'')+' LIMIT 20',                                                           display:['Name'] },
  order:          { key:'order',          label:'Order',           soql:(f)=>'SELECT Id, OrderNumber, Status FROM Order'+(f?' WHERE OrderNumber LIKE \'%'+f+'%\'':'')+' ORDER BY CreatedDate DESC LIMIT 20',             display:['OrderNumber','Status'] },
  invoice:        { key:'invoice',        label:'Invoice',         soql:(f)=>'SELECT Id, InvoiceNumber, Status FROM Invoice'+(f?' WHERE InvoiceNumber LIKE \'%'+f+'%\'':'')+' ORDER BY CreatedDate DESC LIMIT 20',            display:['InvoiceNumber','Status'] },
  billingSchedule:{ key:'billingSchedule',label:'Billing Schedule',soql:(f)=>'SELECT Id, Name, Status FROM BillingSchedule'+(f?' WHERE Name LIKE \'%'+f+'%\'':'')+' ORDER BY Name LIMIT 20',                                 display:['Name','Status'] },
};
const seedPending = {};

function toggleSeedPanel(i){
  const p=document.getElementById('seed-panel-'+i);
  if(p) p.style.display=p.style.display==='none'?'block':'none';
}

function seedFetch(i){
  const typeKey=document.getElementById('seed-type-'+i)?.value;
  const filter=(document.getElementById('seed-filter-'+i)?.value||'').trim();
  const recipe=SEED_RECIPES[typeKey]; if(!recipe) return;
  const soql=recipe.soql(filter);
  const results=document.getElementById('seed-results-'+i);
  if(results) results.innerHTML='<div style="font-size:10px;color:var(--fg3);padding:4px">Fetching…</div>';
  const requestId='seed_'+i+'_'+Date.now();
  seedPending[requestId]={stepIdx:i, recipe};
  vscMsg({type:'orgQuery', requestId, soql});
}

function _guessTargetField(stepIdx, recipe){
  try{
    const body=chainSession?.steps[stepIdx]?.resolvedBody||'{}';
    const keys=Object.keys(JSON.parse(body));
    const direct={asset:['assetId','assetIds'],account:['accountId'],quote:['salesTransactionId','quoteId'],pricebook:['priceBookId'],catalog:['catalogId'],product:['productId','productIds'],order:['salesTransactionId']};
    const hints={asset:'assetIds[0]',account:'accountId',quote:'salesTransactionId',pricebook:'priceBookId',catalog:'catalogId',product:'productIds[0]',order:'salesTransactionId'};
    for(const k of (direct[recipe.key]||[])){
      if(keys.some(bk=>bk.toLowerCase()===k.toLowerCase())) return k;
    }
    return hints[recipe.key]||'id';
  }catch{ return 'id'; }
}

function _renderSeedResults(stepIdx, recipe, records, error){
  const el=document.getElementById('seed-results-'+stepIdx); if(!el) return;
  if(error){ el.innerHTML='<div style="color:var(--red);font-size:10px;padding:4px">'+esc(String(error).slice(0,200))+'</div>'; return; }
  if(!records.length){ el.innerHTML='<div style="font-size:10px;color:var(--fg3);padding:4px">No records found.</div>'; return; }
  el.innerHTML=records.map((r,j)=>{
    const extras=recipe.display.slice(1).map(f=>r[f]||'').filter(Boolean).join(' · ');
    const guessed=_guessTargetField(stepIdx, recipe);
    return '<div style="display:flex;align-items:center;gap:5px;padding:3px 0;border-bottom:1px solid var(--border)">'+
      '<span style="font-size:9px;font-family:monospace;color:var(--fg3);flex-shrink:0;max-width:110px;overflow:hidden;text-overflow:ellipsis">'+esc(r.Id)+'</span>'+
      '<span style="font-size:10px;color:var(--fg);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(r[recipe.display[0]]||'')+(extras?' <span style="color:var(--fg3)">'+esc(extras)+'</span>':'')+'</span>'+
      '<input id="stgt-'+stepIdx+'-'+j+'" style="font-size:10px;width:90px;padding:2px 3px;background:var(--bg2);border:1px solid var(--border);border-radius:3px;color:var(--fg)" value="'+esc(guessed)+'" placeholder="field path">'+
      '<button class="btn btn-pri" style="font-size:10px;padding:1px 6px;flex-shrink:0" onclick="seedInject('+stepIdx+',\''+esc(r.Id)+'\',document.getElementById(\'stgt-'+stepIdx+'-'+j+'\').value)">Use</button>'+
      '</div>';
  }).join('');
}

function showToast(msg, type){
  let t=document.getElementById('rc-toast');
  if(!t){
    t=document.createElement('div');
    t.id='rc-toast';
    t.style.cssText='position:fixed;bottom:20px;right:20px;z-index:10000;padding:8px 14px;border-radius:6px;font-size:12px;max-width:340px;box-shadow:0 2px 12px rgba(0,0,0,.4);transition:opacity .3s;pointer-events:none';
    document.body.appendChild(t);
  }
  clearTimeout(t._tid);
  t.style.background=type==='error'?'var(--red-bg,#3b0d0d)':type==='success'?'var(--green-bg,#0d3b2e)':'var(--bg3)';
  t.style.color=type==='error'?'var(--red,#f44747)':type==='success'?'var(--green,#4ec9b0)':'var(--fg)';
  t.style.border='1px solid '+(type==='error'?'var(--red,#f44747)':type==='success'?'var(--green,#4ec9b0)':'var(--border)');
  t.textContent=msg;
  t.style.opacity='1';
  t._tid=setTimeout(()=>{ t.style.opacity='0'; },3500);
}

function showConfirm(msg, onConfirm){
  let overlay=document.getElementById('rc-confirm');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='rc-confirm';
    overlay.style.cssText='position:fixed;inset:0;z-index:10001;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5)';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML='<div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:16px 20px;max-width:320px;text-align:center">'+
    '<div style="font-size:13px;color:var(--fg);margin-bottom:14px">'+esc(msg)+'</div>'+
    '<div style="display:flex;gap:8px;justify-content:center">'+
    '<button class="btn btn-sec" onclick="document.getElementById(\'rc-confirm\').style.display=\'none\'">Cancel</button>'+
    '<button class="btn btn-pri" style="background:var(--red-bg,#3b0d0d);border-color:var(--red,#f44747);color:var(--red,#f44747)" id="rc-confirm-ok">Delete</button>'+
    '</div></div>';
  overlay.style.display='flex';
  document.getElementById('rc-confirm-ok').onclick=()=>{ overlay.style.display='none'; onConfirm(); };
}

function _guessRecipeForParam(paramName){
  const n=(paramName||'').toLowerCase();
  if(/asset/.test(n)) return 'asset';
  if(/account/.test(n)) return 'account';
  if(/quote|salestransaction/.test(n)) return 'quote';
  if(/pricebook|pricebook2/.test(n)) return 'pricebook';
  if(/product/.test(n)) return 'product';
  if(/catalog/.test(n)) return 'catalog';
  if(/order|billingtransaction/.test(n)) return 'order';
  if(/invoice/.test(n)) return 'invoice';
  if(/billingschedule/.test(n)) return 'billingSchedule';
  return null;
}

let _oppTarget=null;

function openOrgPicker(btn, paramName){
  _oppTarget={inputEl:btn.previousElementSibling};
  const popup=document.getElementById('org-picker-popup'); if(!popup) return;
  const rect=btn.getBoundingClientRect();
  popup.style.top=Math.min(rect.bottom+4, window.innerHeight-280)+'px';
  popup.style.left=Math.max(4, rect.left-160)+'px';
  const typeEl=document.getElementById('opp-type');
  typeEl.innerHTML=Object.values(SEED_RECIPES).map(r=>'<option value="'+r.key+'">'+r.label+'</option>').join('');
  const guessed=_guessRecipeForParam(paramName);
  if(guessed) typeEl.value=guessed;
  document.getElementById('opp-filter').value='';
  document.getElementById('opp-results').innerHTML='';
  popup.style.display='block';
}

function closeOrgPicker(){
  const p=document.getElementById('org-picker-popup');
  if(p) p.style.display='none';
  _oppTarget=null;
}

function oppFetch(){
  const typeKey=document.getElementById('opp-type').value;
  const filter=(document.getElementById('opp-filter').value||'').trim();
  const recipe=SEED_RECIPES[typeKey]; if(!recipe) return;
  const soql=recipe.soql(filter);
  document.getElementById('opp-results').innerHTML='<div style="font-size:10px;color:var(--fg3);padding:4px">Fetching…</div>';
  const requestId='opp_'+Date.now();
  const _oppOrgAlias=document.getElementById('org-select')?.value;
  seedPending[requestId]={stepIdx:'__opp__', recipe, isOpp:true, orgAlias:_oppOrgAlias};
  vscMsg({type:'orgQuery', requestId, soql, orgAlias:_oppOrgAlias});
}

function oppInject(id){
  if(!_oppTarget) return;
  _oppTarget.inputEl.value=id;
  _oppTarget.inputEl.dispatchEvent(new Event('input'));
  closeOrgPicker();
}

function _renderOppResults(recipe, records, error, debugInfo){
  const el=document.getElementById('opp-results'); if(!el) return;
  const dbg='<div style="font-size:9px;color:var(--fg3);padding:2px 4px;margin-top:2px;font-family:monospace;opacity:0.7">'+
    'Org: '+esc((debugInfo&&debugInfo.orgAlias)||'(none selected)')+'<br>'+
    'SOQL: '+esc(recipe.soql('').replace(/ (ORDER BY|LIMIT).*/,''))+'</div>';
  if(error){ el.innerHTML='<div style="color:var(--red);font-size:10px;padding:4px">'+esc(String(error).slice(0,300))+'</div>'+dbg; return; }
  if(!records.length){ el.innerHTML='<div style="font-size:10px;color:var(--fg3);padding:4px">No records found.</div>'+dbg; return; }
  el.innerHTML=records.map(r=>{
    const extras=recipe.display.slice(1).map(f=>r[f]||'').filter(Boolean).join(' · ');
    return '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid var(--border)">'+
      '<span style="font-size:9px;font-family:monospace;color:var(--fg3);flex-shrink:0;max-width:100px;overflow:hidden;text-overflow:ellipsis" title="'+esc(r.Id)+'">'+esc(r.Id.slice(-9))+'</span>'+
      '<span style="font-size:11px;color:var(--fg);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(r[recipe.display[0]]||'')+(extras?' <span style="color:var(--fg3);font-size:10px">'+esc(extras)+'</span>':'')+'</span>'+
      '<button class="btn btn-pri" style="font-size:10px;padding:2px 6px;flex-shrink:0" onclick="oppInject(\''+esc(r.Id)+'\')">Use</button>'+
      '</div>';
  }).join('');
}

function seedInject(stepIdx, id, fieldPath){
  if(!fieldPath||!chainSession) return;
  // Update body textarea locally
  const ta=document.getElementById('chain-body-'+stepIdx);
  if(ta){
    try{
      const obj=JSON.parse(ta.value||'{}');
      const parts=fieldPath.replace(/\[(\d+)\]/g,'.$1').split('.');
      let cur=obj;
      for(let k=0;k<parts.length-1;k++){
        if(cur[parts[k]]==null) cur[parts[k]]=isNaN(Number(parts[k+1]))?{}:[];
        cur=cur[parts[k]];
      }
      const last=parts[parts.length-1];
      cur[isNaN(Number(last))?last:Number(last)]=id;
      ta.value=JSON.stringify(obj,null,2);
      chainSession.steps[stepIdx].resolvedBody=ta.value;
    }catch{}
  }
  // Also tell backend so resetStep preserves it
  vscMsg({type:'chainOverride',stepIdx,target:'body.'+fieldPath,value:id});
}

// ── Step Connector ────────────────────────────────────────────────────────────
function _connectorHtml(i){
  if(!chainSession||i>=chainSession.steps.length-1) return '';
  const step=chainSession.steps[i];
  const pb=playbooks.find(p=>p.id===chainSession.playbookId);
  const rules=(pb?.steps[i]?.extract)||[];
  const extracted=step.extractedValues||{};
  const nextIdx=i+1;

  if(step.status==='error'){
    return '<div style="margin:-2px 0 6px 20px;padding:4px 10px;border-left:2px solid var(--red);border-radius:0 4px 4px 0;background:var(--bg3);font-size:10px;color:var(--red)">&#9888; chain stopped — fix error above to continue</div>';
  }

  if(!rules.length){
    const color=step.status==='done'?'var(--fg3)':'var(--border)';
    return '<div style="margin:-2px 0 6px 20px;padding:3px 10px;border-left:2px solid '+color+';border-radius:0 4px 4px 0;background:var(--bg3);font-size:10px;color:var(--fg3)">&#8212; no data passed to next step &#8212;</div>';
  }

  const isDone=step.status==='done';
  const borderColor=isDone&&Object.keys(extracted).length?'var(--green)':'var(--fg3)';
  const rows=rules.map(rule=>{
    const val=extracted[rule.into]||'';
    const shortTarget=rule.into.split('.').pop();
    const shortFrom=rule.from.replace(/\$\./,'');
    const inputHtml=isDone
      ? '<input class="try-inp" style="font-size:10px;font-family:monospace;padding:2px 4px;width:150px;background:var(--bg2);border:1px solid var(--border);border-radius:3px;color:var(--fg)" value="'+esc(val)+'" placeholder="(not yet extracted)" oninput="overrideExtracted('+nextIdx+',\''+esc(rule.into)+'\',this.value)">'
      : '<span style="font-size:10px;font-family:monospace;color:var(--fg3);font-style:italic">(runs after step completes)</span>';
    return '<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;flex-wrap:wrap">'+
      '<span style="font-size:10px;font-family:monospace;color:var(--fg3)">'+esc(shortFrom)+'</span>'+
      '<span style="color:var(--fg3)">&#8594;</span>'+
      '<span style="font-size:10px;font-family:monospace;color:var(--cyan)">'+esc(shortTarget)+'</span>'+
      '<span style="color:var(--fg3)">=</span>'+
      inputHtml+
      '</div>';
  }).join('');

  return '<div style="margin:-2px 0 6px 20px;padding:5px 10px;border-left:2px solid '+borderColor+';border-radius:0 4px 4px 0;background:var(--bg3)">'+
    '<div style="font-size:10px;color:var(--fg3);margin-bottom:3px">&#8595; passing to Step '+(nextIdx+1)+'</div>'+
    rows+
    '</div>';
}

function renderRunHistory(){
  const el=document.getElementById('run-history-list'); if(!el) return;
  if(!runs.length){ el.innerHTML='<div style="padding:8px 12px;font-size:11px;color:var(--fg3)">No runs yet.</div>'; return; }
  el.innerHTML=runs.map(r=>{
    const icon=r.status==='completed'?'&#10003;':r.status==='partial'?'&#9888;':'&#10007;';
    const color=r.status==='completed'?'var(--green)':r.status==='partial'?'var(--yellow)':'var(--red)';
    const date=r.startedAt.slice(0,16).replace('T',' ');
    return '<div style="margin:4px 10px;padding:8px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:5px">'+
      '<div style="display:flex;align-items:center;gap:6px"><span style="color:'+color+'">'+icon+'</span><span style="font-size:11px;font-weight:600;color:var(--fg)">'+esc(r.playbookName)+'</span><span style="font-size:10px;color:var(--fg3)">'+esc(r.org)+'</span></div>'+
      '<div style="font-size:10px;color:var(--fg3);margin-top:2px">'+date+' · '+r.steps.length+' steps</div>'+
      '<div style="margin-top:5px;display:flex;gap:5px"><button class="btn btn-sec" style="font-size:10px;padding:2px 8px" onclick="loadRun(\''+esc(r.id)+'\')">Load</button><button class="btn btn-sec" style="font-size:10px;padding:2px 8px" onclick="rerunFromHistory(\''+esc(r.playbookId)+'\')">Re-run</button></div>'+
      '</div>';
  }).join('');
}

function loadRun(runId){ vscMsg({type:'chainLoadRun',runId}); }
function rerunFromHistory(pbId){ startPlaybook(pbId); }

function renderLoadedRun(run){
  const tabId='tab-'+(++tabCounter);
  tabs.push({id:tabId, type:'playbook', label:run.playbookName+' (loaded)', pbId:run.playbookId+'_loaded'});
  renderTabBar();
  const det=document.createElement('div');
  det.id='tp-'+tabId;
  det.className='tab-panel';
  det.style.padding='0';
  det.innerHTML=
    '<div style="padding:18px 24px 8px;font-size:16px;font-weight:700;color:var(--fg)">'+esc(run.playbookName)+'</div>'+
    '<div style="padding:0 24px 12px;font-size:11px;color:var(--fg3)">'+esc(run.org)+' · '+esc(run.startedAt.slice(0,16).replace('T',' '))+' · '+esc(run.mode)+' / '+esc(run.execution)+'</div>'+
    '<div style="padding:0 24px">'+
    run.steps.map(s=>{
      const ok=s.responseStatus>=200&&s.responseStatus<300;
      return '<div style="margin-bottom:10px;padding:10px 12px;background:var(--bg2);border:1px solid var(--border);border-radius:6px">'+
        '<div style="display:flex;align-items:center;gap:8px"><span style="color:'+(ok?'var(--green)':'var(--red)')+'">'+( ok?'&#10003;':'&#10007;')+'</span><span style="font-size:12px;font-weight:600">'+esc(s.label)+'</span><span style="font-size:10px;padding:1px 6px;border-radius:3px;background:'+(ok?'#0d3b2e':'#3b2d0d')+';color:'+(ok?'var(--green)':'var(--red)')+'">HTTP '+s.responseStatus+'</span><span style="font-size:10px;color:var(--fg3)">'+s.durationMs+'ms</span></div>'+
        '<div style="font-size:10px;color:var(--fg3);font-family:monospace;margin-top:3px">'+esc(s.path)+'</div>'+
        '<details style="margin-top:6px"><summary style="font-size:10px;color:var(--fg3);cursor:pointer">Request / Response</summary>'+
        '<div style="font-size:10px;color:var(--fg2);margin-top:4px">Request:</div><pre style="font-size:10px;max-height:120px;overflow-y:auto;padding:6px;background:var(--bg);border-radius:4px">'+esc(s.requestBody)+'</pre>'+
        '<div style="font-size:10px;color:var(--fg2);margin-top:4px">Response:</div><pre style="font-size:10px;max-height:120px;overflow-y:auto;padding:6px;background:var(--bg);border-radius:4px">'+esc(s.responseBody.slice(0,1500))+'</pre>'+
        '</details></div>';
    }).join('')+
    '</div>';
  document.getElementById('detail').appendChild(det);
  activateTab(tabId);
}

function relaunchRun(run){
  if(run.type==='single'&&run.endpointId){
    showEp(run.endpointId);
    const firstStep=run.steps[0];
    if(firstStep){
      setTimeout(()=>{
        const t=tabs.find(tb=>tb.type==='endpoint'&&tb.epId===run.endpointId);
        if(!t) return;
        const panel=document.getElementById('tp-'+t.id);
        if(panel){ const tryitTab=panel.querySelectorAll('.tab')[3]; if(tryitTab){ tryitTab.click(); } }
        const bodyEl=document.getElementById('try-body-'+t.id);
        if(bodyEl&&bodyEl.tagName==='TEXTAREA'&&firstStep.requestBody) bodyEl.value=firstStep.requestBody;
        const pathEl=document.getElementById('try-path-'+t.id);
        if(pathEl&&firstStep.path) pathEl.value=firstStep.path;
      },80);
    }
  } else if(run.playbookId){
    startPlaybook(run.playbookId);
  }
}

// ── PST Graph Builder ─────────────────────────────────────────────────────────
const pstState = {};

function openPstBuilderTab(){
  const existing = tabs.find(t => t.type === 'pst-builder');
  if(existing){ activateTab(existing.id); return; }
  const tabId = 'tab-' + (++tabCounter);
  tabs.push({ id: tabId, type: 'pst-builder', label: 'PST Builder' });
  pstState[tabId] = {
    quoteId:'', pricingPref:'Skip', configInput:'Skip',
    existingQlis:[], existingQlrs:[],
    deletedQliIds: new Set(), deletedQlrIds: new Set(),
    patchedQlis:{}, newInserts:[], insertCounter:0,
    newQuote: false,
    newQuoteFields: { name:'', pricebook2Id:'', currencyIsoCode:'USD', opportunityId:'' },
    quoteRecord: null,
    existingAttrs: {},
    previewActive: false
  };
  renderTabBar();
  const panel = document.createElement('div');
  panel.id = 'tp-' + tabId;
  panel.className = 'tab-panel';
  document.getElementById('detail').appendChild(panel);
  _buildPstPanel(panel, tabId);
  activateTab(tabId);
}

function _buildPstPanel(panel, tabId){
  panel.innerHTML =
    '<div class="d-title">&#9889; PST Graph Builder</div>'+

    // ── Inner tab bar ──────────────────────────────────────────────────────────
    '<div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:14px">'+
    '<button id="pst-itab-builder-'+tabId+'" onclick="pstInnerTab(\''+tabId+'\',\'builder\')" '+
    'style="padding:5px 16px;font-size:11px;font-weight:600;background:var(--acc);color:#fff;border:none;border-radius:4px 4px 0 0;cursor:pointer;margin-right:2px">Builder</button>'+
    '<button id="pst-itab-ref-'+tabId+'" onclick="pstInnerTab(\''+tabId+'\',\'ref\')" '+
    'style="padding:5px 16px;font-size:11px;font-weight:600;background:var(--bg3);color:var(--fg2);border:none;border-radius:4px 4px 0 0;cursor:pointer">Reference</button>'+
    '</div>'+

    // ── BUILDER PANEL ──────────────────────────────────────────────────────────
    '<div id="pst-inner-builder-'+tabId+'">'+

    '<div style="color:var(--fg3);font-size:11px;margin-bottom:14px">Load a Quote, mark nodes for DELETE/PATCH/INSERT, then Execute as a single atomic PST call.</div>'+

    '<div class="try-sec"><div class="try-lbl">Quote</div>'+
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">'+
    '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:11px;color:var(--fg2)">'+
    '<input type="checkbox" id="pst-newquote-'+tabId+'" onchange="pstToggleNewQuote(\''+tabId+'\',this.checked)">'+
    'Create new quote from scratch</label>'+
    '</div>'+
    '<div id="pst-existingquote-'+tabId+'">'+
    '<div class="try-row">'+
    '<input class="try-inp" id="pst-qid-'+tabId+'" placeholder="0Q0..." style="flex:2;font-family:monospace;font-size:11px" oninput="pstState[\''+tabId+'\'].quoteId=this.value">'+
    '<button class="btn btn-pri" id="pst-load-btn-'+tabId+'" onclick="loadQuoteForPst(\''+tabId+'\')" style="flex:0 0 auto">&#128196; Load Quote</button>'+
    '</div>'+
    '</div>'+
    '<div id="pst-newquote-form-'+tabId+'" style="display:none;margin-bottom:6px">'+
    '<div style="font-size:10px;color:var(--fg3);margin-bottom:6px;padding:6px 8px;background:var(--bg3);border-radius:4px;border-left:3px solid var(--acc)">'+
    'PST creates Quote + QLIs in a single atomic call. <code>salesTransactionId</code> in the response is the new Quote ID. <b>AccountId is blocked by PST FLS — omit it.</b>'+
    '</div>'+
    '<div style="display:flex;gap:6px;flex-wrap:wrap">'+
    '<label style="font-size:10px;color:var(--fg2)">Quote Name * <input class="try-inp" id="pst-nq-name-'+tabId+'" placeholder="My Quote" style="width:160px;font-size:11px;padding:2px 5px" oninput="pstState[\''+tabId+'\'].newQuoteFields.name=this.value"></label>'+
    '<label style="font-size:10px;color:var(--fg2)">Pricebook2Id <span style="color:var(--red)">*</span> <input class="try-inp" id="pst-nq-pb-'+tabId+'" placeholder="01s… (required)" style="width:145px;font-size:11px;font-family:monospace;padding:2px 5px" oninput="pstState[\''+tabId+'\'].newQuoteFields.pricebook2Id=this.value;this.style.borderColor=this.value?\'\':\' var(--red)\'"></label>'+
    '<label style="font-size:10px;color:var(--fg2)">CurrencyIsoCode * <input class="try-inp" id="pst-nq-cur-'+tabId+'" placeholder="USD" style="width:70px;font-size:11px;padding:2px 5px" oninput="pstState[\''+tabId+'\'].newQuoteFields.currencyIsoCode=this.value"></label>'+
    '<label style="font-size:10px;color:var(--fg2)">OpportunityId <input class="try-inp" id="pst-nq-opp-'+tabId+'" placeholder="006... (optional)" style="width:150px;font-size:11px;font-family:monospace;padding:2px 5px" oninput="pstState[\''+tabId+'\'].newQuoteFields.opportunityId=this.value"></label>'+
    '</div>'+
    '</div>'+
    '<div style="display:flex;gap:8px;margin-top:6px;align-items:center">'+
    '<label style="font-size:11px;color:var(--fg2)">Pricing</label>'+
    '<select class="try-sel" id="pst-pricing-'+tabId+'" onchange="pstState[\''+tabId+'\'].pricingPref=this.value">'+
    '<option value="Skip">Skip</option><option value="Force">Force</option><option value="System">System</option>'+
    '</select>'+
    '<label style="font-size:11px;color:var(--fg2)">Config</label>'+
    '<select class="try-sel" id="pst-config-'+tabId+'" onchange="pstState[\''+tabId+'\'].configInput=this.value">'+
    '<option value="Skip">Skip</option><option value="RunAndAllowErrors">RunAndAllowErrors</option><option value="RunAndBlockErrors">RunAndBlockErrors</option>'+
    '</select>'+
    '</div>'+
    '<div style="font-size:10px;color:var(--fg3);margin-top:6px">&#9432; Set <code>{{PRT_ID}}</code> in your active environment (<code>SELECT Id FROM ProductRelationshipType WHERE Name=\'Bundle to Bundle Component Relationship\'</code>)</div>'+
    '</div>'+

    '<div id="pst-load-status-'+tabId+'" style="font-size:11px;color:var(--fg3);padding:4px 0;min-height:18px"></div>'+
    '<div id="pst-quote-info-'+tabId+'" style="display:none;margin-bottom:10px;padding:8px 10px;background:var(--bg2);border:1px solid var(--border);border-radius:4px;font-size:11px"></div>'+
    '<div id="pst-tree-'+tabId+'" style="margin-bottom:10px"></div>'+
    '<div style="margin-bottom:12px">'+
    '<button class="btn btn-sec" onclick="pstAddFlatInsert(\''+tabId+'\')" style="font-size:11px">+ Add Flat QLI (no parent)</button>'+
    '</div>'+
    '<div class="btn-row" style="margin-bottom:10px">'+
    '<button class="btn btn-sec" onclick="pstPreview(\''+tabId+'\')">&#128269; Preview Graph</button>'+
    '<button class="btn btn-pri" id="pst-exec-btn-'+tabId+'" onclick="executePst(\''+tabId+'\')">&#9654; Execute PST</button>'+
    '<button class="btn btn-sec" onclick="copyPstApex(\''+tabId+'\')">Copy Apex</button>'+
    '</div>'+
    '<div id="pst-pill-'+tabId+'" style="margin-bottom:8px"></div>'+
    '<div class="resp-box" id="pst-resp-'+tabId+'" style="color:var(--fg3);min-height:80px">Preview / response will appear here.</div>'+
    '</div>'+ // end builder panel

    // ── REFERENCE PANEL ────────────────────────────────────────────────────────
    '<div id="pst-inner-ref-'+tabId+'" style="display:none">'+
    _buildPstReference()+
    '</div>';
}

function pstInnerTab(tabId, which){
  const builder = document.getElementById('pst-inner-builder-'+tabId);
  const ref     = document.getElementById('pst-inner-ref-'+tabId);
  const btnB    = document.getElementById('pst-itab-builder-'+tabId);
  const btnR    = document.getElementById('pst-itab-ref-'+tabId);
  if(which==='builder'){
    builder.style.display=''; ref.style.display='none';
    btnB.style.background='var(--acc)'; btnB.style.color='#fff';
    btnR.style.background='var(--bg3)'; btnR.style.color='var(--fg2)';
  } else {
    builder.style.display='none'; ref.style.display='';
    btnR.style.background='var(--acc)'; btnR.style.color='#fff';
    btnB.style.background='var(--bg3)'; btnB.style.color='var(--fg2)';
  }
}

function _buildPstReference(){
  function sec(title, body){ return '<div style="margin-bottom:20px"><div style="font-size:12px;font-weight:700;color:var(--acc);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;border-bottom:1px solid var(--border);padding-bottom:4px">'+title+'</div>'+body+'</div>'; }
  function row2(a,b,c){ return '<tr><td style="padding:4px 8px 4px 0;font-size:11px;font-family:monospace;color:var(--cyan);white-space:nowrap">'+a+'</td><td style="padding:4px 8px;font-size:11px;color:var(--fg2);white-space:nowrap">'+b+'</td><td style="padding:4px 0;font-size:11px;color:var(--fg3)">'+c+'</td></tr>'; }
  function row3(a,b,c,d){ return '<tr><td style="padding:4px 8px 4px 0;font-size:11px;font-family:monospace;color:var(--red);white-space:nowrap">'+a+'</td><td style="padding:4px 8px;font-size:11px;color:var(--fg2)">'+b+'</td><td style="padding:4px 8px;font-size:11px;color:var(--yellow)">'+c+'</td><td style="padding:4px 0;font-size:11px;color:var(--fg3)">'+d+'</td></tr>'; }
  function tbl(hdr, rows){ return '<table style="border-collapse:collapse;width:100%"><thead><tr>'+hdr.map(h=>'<th style="padding:3px 8px 3px 0;font-size:10px;font-weight:700;color:var(--fg3);text-align:left;border-bottom:1px solid var(--border)">'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table>'; }
  function code(s){ return '<code style="font-family:monospace;font-size:10px;background:var(--bg2);padding:1px 4px;border-radius:3px">'+s+'</code>'; }
  function pill(s,c){ return '<span style="font-size:9px;font-weight:700;padding:1px 6px;border-radius:3px;background:'+c+'20;color:'+c+';border:1px solid '+c+';margin-left:4px">'+s+'</span>'; }
  function warn(s){ return '<div style="font-size:11px;color:var(--yellow);background:#2a2000;border:1px solid #554000;border-radius:4px;padding:7px 10px;margin-bottom:8px">&#9888; '+s+'</div>'; }
  function tip(s){ return '<div style="font-size:11px;color:var(--fg2);background:var(--bg3);border-left:3px solid var(--acc);padding:6px 10px;margin-bottom:8px">'+s+'</div>'; }
  function scen(num, title, badge, desc, bullets){
    const bcolor = badge==='verified'?'var(--green)':badge==='gotcha'?'var(--red)':'var(--fg3)';
    const blabel = badge==='verified'?'✓ verified':badge==='gotcha'?'⚑ gotcha':'';
    return '<details style="margin-bottom:8px;background:var(--bg2);border:1px solid var(--border);border-radius:5px"><summary style="padding:8px 12px;cursor:pointer;font-size:12px;font-weight:600;color:var(--fg);display:flex;align-items:center;gap:8px"><span style="font-size:10px;font-weight:700;padding:1px 6px;border-radius:3px;background:var(--bg3);color:var(--fg3)">S'+num+'</span>'+title+(blabel?'<span style="font-size:9px;font-weight:700;padding:1px 6px;border-radius:3px;background:'+bcolor+'20;color:'+bcolor+';border:1px solid '+bcolor+'">'+blabel+'</span>':'')+'</summary>'+
    '<div style="padding:10px 12px 12px;border-top:1px solid var(--border)">'+
    '<div style="font-size:11px;color:var(--fg2);margin-bottom:8px">'+desc+'</div>'+
    '<ul style="margin:0;padding-left:18px;font-size:11px;color:var(--fg3);line-height:1.7">'+bullets.map(b=>'<li>'+b+'</li>').join('')+'</ul>'+
    '</div></details>';
  }

  const overview = sec('What is PST?',
    tip('Place Sales Transaction is Revenue Cloud\'s single canonical API for all quote/order mutations — the ONLY correct way to create, update, or delete QLIs, OrderItems, QLRs, and related RC-managed objects.')+
    warn('Never use plain DML (insert/update/delete) on QuoteLineItem. It sets '+code('Quote.ValidationResult = TransactionIncomplete')+' — the quote cannot be activated until repriced via PST.')+
    '<div style="font-size:11px;color:var(--fg2);margin-bottom:6px">Endpoint:</div>'+
    '<div style="font-family:monospace;font-size:11px;padding:8px 10px;background:var(--bg2);border-radius:4px;border:1px solid var(--border);margin-bottom:8px">POST /services/data/v63.0/connect/rev/sales-transaction/actions/place</div>'+
    '<div style="font-size:11px;color:var(--fg2);margin-bottom:4px">Response on success:</div>'+
    '<div style="font-family:monospace;font-size:10px;padding:8px 10px;background:var(--bg2);border-radius:4px;border:1px solid var(--border);color:var(--green)">{ "isSuccess": true, "salesTransactionId": "0Q0...", "errorResponse": [] }</div>'
  );

  const params = sec('Parameters',
    '<div style="font-size:11px;font-weight:600;color:var(--fg2);margin-bottom:6px">pricingPref</div>'+
    tbl(['Value','Effect','When to use'],[
      row2('Skip','No repricing — preserves existing prices','Post-swap restructuring, bulk imports, structure-only changes'),
      row2('Force','Reprices ALL lines regardless of change','When prices must be recalculated from list price'),
      row2('System','Delta pricing — only reprices changed lines','Normal incremental edits when Delta Pricing is enabled')
    ])+
    '<div style="font-size:11px;font-weight:600;color:var(--fg2);margin:12px 0 6px">configurationInput</div>'+
    tbl(['Value','Effect'],[
      row2('Skip','No configuration rules run (fastest)',''),
      row2('RunAndAllowErrors','Config rules run; errors recorded but do not block save',''),
      row2('RunAndBlockErrors','Config rules run; any error prevents the entire save','')
    ])+
    '<div style="margin-top:10px;font-size:11px;color:var(--fg3)">'+tip('Always use Skip/Skip for post-swap restructuring — the swap quote already has negotiated prices set. Forcing a reprice recalculates from list price and breaks them.')+'</div>'
  );

  const ordering = sec('Graph Ordering Rules (Critical)',
    warn('The graph is executed top-to-bottom. Violating these rules causes silent no-ops or FK errors — PST returns isSuccess:true but nothing changes.')+
    '<ol style="margin:0;padding-left:20px;font-size:11px;color:var(--fg2);line-height:2">'+
    '<li><b style="color:var(--fg)">Quote anchor first</b> — always node 0. All QLI POSTs reference '+code('@{refQuote.id}')+'.</li>'+
    '<li><b style="color:var(--fg)">QLR DELETE before QLI DELETE</b> — a QLI with an existing QLR cannot be deleted. The QLR delete must appear before its QLI delete.</li>'+
    '<li><b style="color:var(--fg)">QLI POST before its QLR POST</b> — the QLR\'s '+code('AssociatedQuoteLineId = @{ref.id}')+'only resolves after the QLI node runs.</li>'+
    '<li><b style="color:var(--fg)">Parent QLI POST before child QLR POST</b> — '+code('MainQuoteLineId = @{refParent.id}')+'requires the parent to already exist in the graph.</li>'+
    '</ol>'+
    '<div style="margin-top:10px;font-size:11px;color:var(--fg3)">Builder enforces this automatically: DELETEs → PATCHes → QLI POSTs → QLR POSTs.</div>'
  );

  const refs = sec('Reference Syntax & FLS Blockers',
    '<div style="font-size:11px;font-weight:600;color:var(--fg2);margin-bottom:6px">Reference syntax</div>'+
    '<div style="font-size:11px;color:var(--fg3);margin-bottom:6px">Link a node\'s ID to a field in a later node in the same graph:</div>'+
    '<div style="font-family:monospace;font-size:11px;padding:8px 10px;background:var(--bg2);border-radius:4px;border:1px solid var(--border);margin-bottom:12px;color:var(--cyan)">"AssociatedQuoteLineId": "@{refChild.id}"</div>'+
    '<div style="font-size:11px;font-weight:600;color:var(--fg2);margin-bottom:6px">FLS Blockers — never include these in fieldValues</div>'+
    tbl(['Field','Object','Why'],[
      row2('ProductSellingModelId','QuoteLineItem','isCreateable: false platform-wide — set implicitly by PricebookEntryId'),
      row2('ParentQuoteLineItemId','QuoteLineItem','Read-only everywhere — use QuoteLineRelationship instead'),
      row2('AccountId','Quote (POST)','PST FLS-blocked — derived from Opportunity, read-only at Quote level')
    ])
  );

  const qlrRef = sec('QuoteLineRelationship Fields',
    tbl(['Field','Value','Notes'],[
      row2('MainQuoteLineId','Parent QLI Id or @{ref.id}','The bundle root or parent component'),
      row2('AssociatedQuoteLineId','Child QLI Id or @{ref.id}','The bundle component being linked'),
      row2('ProductRelationshipTypeId','Org-specific ID','Query: SELECT Id FROM ProductRelationshipType WHERE Name=\'Bundle to Bundle Component Relationship\' — set as {{PRT_ID}}'),
      row2('AssociatedQuoteLinePricing','IncludedInBundlePrice','Standard value for all bundle children')
    ])+
    '<div style="margin-top:8px;font-size:10px;color:var(--fg3);font-family:monospace;padding:6px 8px;background:var(--bg2);border-radius:4px;border:1px solid var(--border)">'+
    'SELECT Id FROM ProductRelationshipType<br>WHERE Name = \'Bundle to Bundle Component Relationship\''+
    '</div>'
  );

  const validationResult = sec('ValidationResult Behaviour',
    tbl(['Action','ValidationResult after'],[
      row2('PST with pricingPref: Skip','null — clean',''),
      row2('PST with pricingPref: Force','null — clean (full reprice)',''),
      row2('Plain DML on QLI','TransactionIncomplete — quote cannot activate',''),
      row2('Swap API creates quote','TransactionIncomplete — pre-existing, not caused by your code',''),
      row2('Place Quote API','null — clean (full reprice + config)','')
    ])+
    tip('TransactionIncomplete on a swap quote is set by the swap API itself before you touch it. PST with pricingPref:Skip is the only way to clear it without a full reprice.')
  );

  const scenarios = sec('Scenarios (all verified live on sunpoc)',
    scen(1,'Simple flat QLI insert','verified',
      'Add one product to an existing quote with no bundle structure.',
      ['Nodes: Quote PATCH anchor → QLI POST','No QLR needed — flat QLI has no parent',''+code('QuoteId: "@{refQuote.id}"')+'on the QLI links it to the anchor']
    )+
    scen(2,'Insert child QLI (1-level bundle)','verified',
      'Add a child product and link it to an existing parent QLI via QuoteLineRelationship in one call.',
      ['Parent QLI already exists — use its real ID as '+code('MainQuoteLineId'),'Child QLI is new — use '+code('"@{refChild.id}"')+'as '+code('AssociatedQuoteLineId'),'Order: Quote → QLI POST → QLR POST']
    )+
    scen(3,'Insert grandchild (2-level, both new)','verified',
      'Insert a parent and grandchild in the same call. Neither has an ID yet.',
      ['All QLI POSTs come before all QLR POSTs','Grandchild QLR: '+code('"MainQuoteLineId": "@{refChild.id}"')+'— both sides are references','Verified on sunpoc: CAM Pro under Webfleet Video, single PST, ValidationResult = null']
    )+
    scen(4,'Delete a QLI (no QLR blocking)','verified',
      'Delete a flat QLI that has no QuoteLineRelationship pointing to it.',
      ['Nodes: Quote PATCH anchor → QLI DELETE','If the QLI has any QLR, this silently does nothing — use Scenario 5 instead']
    )+
    scen(5,'Delete a QLI that has a QLR','gotcha',
      'QLI with an existing QLR cannot be deleted without first deleting the QLR. Both go in the same graph.',
      [warn('PST silently no-ops a QLI DELETE if the QLI has a blocking QLR — no error, QLI still exists.'),'Order: Quote → QLR DELETE → QLI DELETE','Query blocking QLRs first: '+code('SELECT Id FROM QuoteLineRelationship WHERE AssociatedQuoteLineId IN :toDeleteSet'),'Builder does this automatically when you click 🗑 on a QLI']
    )+
    scen(6,'Full swap restructure','verified',
      'The production case: delete wrong-default children (with their QLRs), insert correct children + grandchildren, all in one call.',
      ['Delete blocking QLR → delete wrong QLI → insert correct QLIs → insert QLRs → insert grandchildren','pricingPref: Skip — swap quote prices are already set','Result: ValidationResult = null, no repricing','Verified: LINK245 removed, Webfleet Video + LINK640 + CAM Pro inserted, all QLRs wired']
    )+
    scen(7,'PATCH an existing QLI','verified',
      'Update fields on an existing QLI (quantity, discount, etc.).',
      ['Nodes: Quote PATCH anchor → QLI PATCH with id + changed fields only','PATCHes can appear anywhere in the graph after the Quote anchor','Only include fields that actually changed — omit unchanged ones']
    )+
    scen(8,'Mixed: DELETE + PATCH + INSERT in one call','verified',
      'All operation types can be combined in a single graph.',
      ['Enforced order: Quote → QLR DELETEs → QLI DELETEs → QLI PATCHes → QLI POSTs → QLR POSTs','Builder enforces this automatically — you never need to think about order']
    )+
    scen(9,'Create brand-new quote + QLIs (single call)','verified',
      'Use method:POST on the Quote node with no id field. QLIs reference @{refQuote.id}. salesTransactionId in the response IS the new Quote ID.',
      [warn('AccountId is PST FLS-blocked — INVALID_FIELD_FOR_INSERT_UPDATE. Omit it entirely.'),'Set '+code('CurrencyIsoCode')+'explicitly — must match all PBE currencies or you get "Price book entry currency code is different"','ValidationResult = null from birth — no TransactionIncomplete','Verified: quote 0Q0G5000004p9N7KAI created with 2 QLIs in single PST call']
    )
  );

  const errors = sec('Common Errors',
    tbl(['Error','Cause','Fix'],[
      row3('Silent no-op on DELETE','QLI has a QLR — PST skips delete silently, no error returned','Add QLR DELETE node before QLI DELETE in graph','Builder auto-detects blocking QLRs when you click 🗑'),
      row3('FIELD_INTEGRITY_EXCEPTION: BillingFrequency can\'t be null','Evergreen PSM PBE selected but BillingFrequency not set','Copy BillingFrequency from the negative journal QLI on the same quote',''),
      row3('isCreateable: false on ProductSellingModelId','PST enforces FLS — platform read-only','Remove from fieldValues; set implicitly by PricebookEntryId',''),
      row3('INVALID_FIELD_FOR_INSERT_UPDATE: AccountId on Quote POST','PST FLS-blocked — derived from Opportunity','Omit AccountId from Quote POST fieldValues',''),
      row3('Price book entry currency code is different','Quote currency doesn\'t match PBE CurrencyIsoCode','Set CurrencyIsoCode explicitly on the Quote POST node; use matching PBEs',''),
      row3('Ambiguous method call (Apex)','Bare null as 5th arg to execute()','Cast: '+code('(String) null'),''),
      row3('Graph returns success but nothing changed','Ordering violation','Check: QLR DELETE before QLI DELETE; QLI POST before QLR POST','')
    ])
  );

  const pbeRef = sec('PricebookEntry Selection for Inserts',
    '<div style="font-size:11px;color:var(--fg3);margin-bottom:8px">When inserting a QLI, the PBE must match all three of these:</div>'+
    '<ol style="margin:0;padding-left:20px;font-size:11px;color:var(--fg2);line-height:2">'+
    '<li>'+code('Product2Id')+'— the product being added</li>'+
    '<li>'+code('CurrencyIsoCode')+'— from the source asset / quote currency</li>'+
    '<li>'+code('SellingModelType')+'— Evergreen if BillingFrequency is set, OneTime otherwise</li>'+
    '</ol>'+
    tip('Shortcut for swap restructuring: the negative journal QLIs on the same quote already carry the exact PricebookEntryId and BillingFrequency needed. Copy them directly — no Asset or ProductSellingModel queries needed.')
  );

  return '<div style="overflow-y:auto;max-height:calc(100vh - 200px);padding:0 2px">'+overview+params+ordering+refs+qlrRef+validationResult+scenarios+errors+pbeRef+'</div>';
}

function setLoadStatus(tabId, msg){
  const el = document.getElementById('pst-load-status-'+tabId);
  if(el) el.textContent = msg;
}

function loadQuoteForPst(tabId){
  const s = pstState[tabId];
  if(!s.quoteId.trim()){ showToast('Enter Quote ID first.','error'); return; }
  const orgAlias = document.getElementById('org-select').value;
  if(!orgAlias){ showToast('Select an org first.','error'); return; }

  s.existingQlis = []; s.existingQlrs = [];
  s.deletedQliIds = new Set(); s.deletedQlrIds = new Set();
  s.patchedQlis = {}; s.newInserts = []; s.insertCounter = 0;
  s.quoteRecord = null; s.existingAttrs = {};
  _renderPstTree(tabId);
  const infoEl = document.getElementById('pst-quote-info-'+tabId);
  if(infoEl) infoEl.style.display = 'none';
  setLoadStatus(tabId, 'Loading QLIs…');

  const rId1 = ++reqCounter;
  pendingReqs[rId1] = (r1) => {
    let data;
    try{ data = JSON.parse(r1.body); }
    catch(_){ setLoadStatus(tabId, 'Error: invalid response'); return; }
    if(!data.records){ setLoadStatus(tabId, 'Error: '+(data[0]&&data[0].message||'no records field')); return; }
    s.existingQlis = data.records.map(q=>({
      id: q.Id,
      product2Id: q.Product2Id,
      name: (q.Product2 && q.Product2.Name) || q.Product2Id,
      pbeId: q.PricebookEntryId,
      qty: String(q.Quantity||1),
      billingFreq: q.BillingFrequency||'',
      unitPrice: q.UnitPrice||''
    }));

    if(!s.existingQlis.length){
      setLoadStatus(tabId, 'No QLIs found on this quote.');
      _renderPstTree(tabId);
      _loadQuoteRecord(tabId, orgAlias, 0, 0);
      return;
    }

    setLoadStatus(tabId, 'Loading QLRs…');
    const ids = s.existingQlis.map(q=>"'"+q.id+"'").join(',');
    const rId2 = ++reqCounter;
    pendingReqs[rId2] = (r2) => {
      try{
        const data2 = JSON.parse(r2.body);
        s.existingQlrs = (data2.records||[]).map(r=>({
          id: r.Id,
          mainQliId: r.MainQuoteLineId,
          assocQliId: r.AssociatedQuoteLineId,
          prtId: r.ProductRelationshipTypeId
        }));
      }catch(_){ s.existingQlrs = []; }
      _renderPstTree(tabId);
      _loadQuoteRecord(tabId, orgAlias, s.existingQlis.length, s.existingQlrs.length);
    };
    vscMsg({ type:'executeCustom', requestId:rId2, orgAlias,
      method:'GET',
      path:'/services/data/v67.0/query?q=SELECT+Id,MainQuoteLineId,AssociatedQuoteLineId,ProductRelationshipTypeId+FROM+QuoteLineRelationship+WHERE+MainQuoteLineId+IN+('+encodeURIComponent(ids)+')',
      headers:{}, body:'', apiVersion:'v67.0' });
  };

  const q = encodeURIComponent("SELECT Id,Product2Id,Product2.Name,PricebookEntryId,Quantity,BillingFrequency,UnitPrice FROM QuoteLineItem WHERE QuoteId='"+s.quoteId.trim()+"' ORDER BY CreatedDate");
  vscMsg({ type:'executeCustom', requestId:rId1, orgAlias,
    method:'GET',
    path:'/services/data/v67.0/query?q='+q,
    headers:{}, body:'', apiVersion:'v67.0' });
}

function _loadQuoteRecord(tabId, orgAlias, qliCount, qlrCount){
  const s = pstState[tabId];
  const rId = ++reqCounter;
  pendingReqs[rId] = (r) => {
    try{
      const d = JSON.parse(r.body);
      const qRec = (d.records && d.records[0]) || (d.Id ? d : null);
      if(qRec && qRec.Id){
        s.quoteRecord = qRec;
        const infoEl = document.getElementById('pst-quote-info-'+tabId);
        if(infoEl){
          infoEl.style.display = 'block';
          infoEl.innerHTML =
            '<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center">'+
            '<span style="font-weight:600;color:var(--fg)">'+esc(qRec.Name||'—')+'</span>'+
            '<span style="font-family:monospace;font-size:10px;color:var(--fg3)">'+esc(s.quoteId.trim())+'</span>'+
            (qRec.Status ? '<span style="padding:1px 7px;border-radius:10px;background:var(--bg3);color:var(--fg2);font-size:10px">'+esc(qRec.Status)+'</span>' : '')+
            (qRec.CurrencyIsoCode ? '<span style="color:var(--fg2)">&#128178; '+esc(qRec.CurrencyIsoCode)+'</span>' : '')+
            (qRec.Pricebook2 ? '<span style="color:var(--fg2)">&#128214; '+esc(qRec.Pricebook2.Name)+'</span>' : '')+
            (qRec.Opportunity ? '<span style="color:var(--fg2)">&#128204; '+esc(qRec.Opportunity.Name)+'</span>' : '')+
            (qRec.Account ? '<span style="color:var(--fg2)">&#127970; '+esc(qRec.Account.Name)+'</span>' : '')+
            (qRec.TotalPrice != null ? '<span style="color:var(--fg2)">Total: '+esc(String(qRec.TotalPrice))+'</span>' : '')+
            '</div>';
        }
      }
    }catch(_){}

    // Fetch QuoteLineItemAttributes if we have QLIs
    if(s.existingQlis.length){
      const qliIds = s.existingQlis.map(q=>"'"+q.id+"'").join(',');
      const rIdA = ++reqCounter;
      pendingReqs[rIdA] = (rA) => {
        try{
          const dA = JSON.parse(rA.body);
          s.existingAttrs = {};
          (dA.records||[]).forEach(a => {
            if(!s.existingAttrs[a.QuoteLineItemId]) s.existingAttrs[a.QuoteLineItemId] = [];
            const defLabel = (a.AttributeDefinition && (a.AttributeDefinition.Label||a.AttributeDefinition.Name)) || a.AttributeDefinitionId;
            s.existingAttrs[a.QuoteLineItemId].push({ id:a.Id, attrDefId:a.AttributeDefinitionId, attrLabel:defLabel, attrValue:a.AttributeValue||'', picklistValueId:a.AttributePicklistValueId||'', isPriceImpacting:a.IsPriceImpacting });
          });
        }catch(_){}
        const attrCount = Object.values(s.existingAttrs).reduce((n,a)=>n+a.length,0);
        const msg = qliCount+' QLIs, '+qlrCount+' QLRs'+(attrCount?' , '+attrCount+' Attributes':'')+' loaded.';
        setLoadStatus(tabId, msg);
        _renderPstTree(tabId);
        pstPreview(tabId);
      };
      vscMsg({ type:'executeCustom', requestId:rIdA, orgAlias,
        method:'GET',
        path:'/services/data/v67.0/query?q='+encodeURIComponent('SELECT Id,QuoteLineItemId,AttributeDefinitionId,AttributeDefinition.Label,AttributeDefinition.Name,AttributeValue,AttributePicklistValueId,IsPriceImpacting FROM QuoteLineItemAttribute WHERE QuoteLineItemId IN ('+qliIds+')'),
        headers:{}, body:'', apiVersion:'v67.0' });
    } else {
      const msg = qliCount ? qliCount+' QLIs, '+qlrCount+' QLRs loaded.' : 'Quote loaded (no QLIs).';
      setLoadStatus(tabId, msg);
      pstPreview(tabId);
    }
  };
  vscMsg({ type:'executeCustom', requestId:rId, orgAlias,
    method:'GET',
    path:'/services/data/v67.0/query?q='+encodeURIComponent("SELECT Id,Name,Status,CurrencyIsoCode,TotalPrice,Pricebook2Id,Pricebook2.Name,OpportunityId,Opportunity.Name,AccountId,Account.Name FROM Quote WHERE Id='"+s.quoteId.trim()+"'"),
    headers:{}, body:'', apiVersion:'v67.0' });
}

function _renderPstTree(tabId){
  const s = pstState[tabId];
  const treeEl = document.getElementById('pst-tree-'+tabId);
  if(!treeEl) return;

  // Build parent→children map from QLRs
  const childrenOf = {};  // mainQliId → [assocQliId]
  const childSet = new Set();
  s.existingQlrs.forEach(qlr => {
    if(!childrenOf[qlr.mainQliId]) childrenOf[qlr.mainQliId] = [];
    childrenOf[qlr.mainQliId].push(qlr.assocQliId);
    childSet.add(qlr.assocQliId);
  });
  const roots = s.existingQlis.filter(q => !childSet.has(q.id));

  function renderQliNode(qli, depth){
    const isDeleted = s.deletedQliIds.has(qli.id);
    const patched = s.patchedQlis[qli.id];
    const hasChanges = patched && (patched.qty !== qli.qty || patched.billingFreq !== qli.billingFreq);
    const op = isDeleted ? 'DELETE' : hasChanges ? 'PATCH' : 'UNCHANGED';
    const opColor = op==='DELETE'?'var(--red)':op==='PATCH'?'var(--yellow)':'var(--fg3)';
    const opBg   = op==='DELETE'?'#2a0a0a':op==='PATCH'?'#2a2000':'var(--bg3)';
    const indent = depth * 20;
    const curQty = (patched&&patched.qty!==undefined) ? patched.qty : qli.qty;
    const curBF  = (patched&&patched.billingFreq!==undefined) ? patched.billingFreq : qli.billingFreq;

    // Collapse state
    const colKey = tabId+':'+qli.id;
    const children = (childrenOf[qli.id]||[]).map(cid => s.existingQlis.find(q=>q.id===cid)).filter(Boolean);
    const childInserts = s.newInserts.filter(ins => ins.parentRef === qli.id);
    const hasChildren = children.length > 0 || childInserts.length > 0;
    const collapsed = hasChildren && !!_pstCollapsed[colKey];

    // Find QLR for this node (as child)
    const qlrAsChild = s.existingQlrs.find(r => r.assocQliId === qli.id);
    const qlrBadge = qlrAsChild && isDeleted
      ? '<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:#2a0a0a;color:var(--red);margin-left:4px">QLR DELETE</span>'
      : qlrAsChild
        ? '<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:var(--bg);color:var(--fg3);margin-left:4px">QLR</span>'
        : '';

    const leftBorder = op==='DELETE'?'var(--red)':op==='PATCH'?'var(--yellow)':qlrAsChild?'#2a6496':'var(--acc)';
    let html = '<div style="margin-left:'+indent+'px;margin-bottom:5px;background:'+opBg+';border:1px solid '+(op==='UNCHANGED'?'var(--border)':opColor)+';border-left:3px solid '+leftBorder+';border-radius:4px;opacity:'+(isDeleted?'0.6':'1')+'">';

    // ── Header row ──
    html += '<div style="display:flex;align-items:center;gap:5px;padding:6px 8px 4px 8px;border-bottom:1px solid rgba(255,255,255,.05)">';
    if(hasChildren){
      html += '<button class="icon-btn" style="font-size:10px;padding:0 3px;color:var(--fg3);flex-shrink:0" onclick="_pstCollapsed[\''+colKey+'\']=!_pstCollapsed[\''+colKey+'\'];_renderPstTree(\''+tabId+'\')">'+(collapsed?'▶':'▼')+'</button>';
    } else {
      html += '<span style="width:14px;flex-shrink:0"></span>';
    }
    html += '<span id="pst-op-badge-'+tabId+'-'+qli.id+'" style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;color:'+opColor+';border:1px solid '+opColor+';flex-shrink:0">'+op+'</span>';
    if(qlrAsChild) html += '<span style="font-size:9px;padding:1px 4px;border-radius:3px;background:rgba(42,100,150,.25);color:#5b9bd5;flex-shrink:0">QLR</span>';
    html += '<span style="font-size:12px;font-weight:600;color:var(--fg);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(qli.name)+'</span>';
    html += '<span style="font-family:monospace;font-size:9px;color:var(--fg3);flex-shrink:0">'+esc(qli.id.slice(0,15))+'…</span>';
    if(!isDeleted){
      html += '<button class="icon-btn" style="color:var(--red);font-size:11px;padding:1px 6px;flex-shrink:0" onclick="pstDeleteQli(\''+tabId+'\',\''+qli.id+'\')" title="Mark for delete">🗑</button>';
    } else {
      html += '<button class="icon-btn" style="color:var(--fg3);font-size:11px;padding:1px 6px;flex-shrink:0" onclick="pstUndeleteQli(\''+tabId+'\',\''+qli.id+'\')" title="Undo delete">↩</button>';
    }
    html += '</div>';

    // ── Fields + actions row ──
    if(!isDeleted){
      html += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:5px 8px">';
      if(qli.unitPrice) html += '<span style="font-size:10px;color:var(--fg2)">💰 '+esc(String(qli.unitPrice))+'</span>';
      html += '<label style="font-size:10px;color:var(--fg2)">Qty <input type="number" class="try-inp" value="'+esc(curQty)+'" min="1" style="width:48px;font-size:11px;padding:2px 4px" onchange="pstPatchQli(\''+tabId+'\',\''+qli.id+'\',\'qty\',this.value)"></label>';
      html += '<label style="font-size:10px;color:var(--fg2)">Freq <input class="try-inp" value="'+esc(curBF)+'" placeholder="Monthly" style="width:72px;font-size:11px;padding:2px 4px" onchange="pstPatchQli(\''+tabId+'\',\''+qli.id+'\',\'billingFreq\',this.value)"></label>';
      html += '<button class="icon-btn" style="font-size:10px;color:var(--acc);margin-left:auto" onclick="pstAddChildInsert(\''+tabId+'\',\''+qli.id+'\',\''+esc(qli.name)+'\')">+ Child QLI</button>';
      html += '</div>';
    }

    // ── Attributes table ──
    const existAttrs = s.existingAttrs[qli.id]||[];
    if(existAttrs.length){
      html += '<div style="margin:0 8px 6px 8px;border:1px solid rgba(255,255,255,.07);border-radius:3px;overflow:hidden">';
      html += '<div style="background:rgba(255,255,255,.04);padding:3px 7px;font-size:9px;font-weight:600;color:var(--fg3);text-transform:uppercase;letter-spacing:.5px">Attributes ('+existAttrs.length+')</div>';
      existAttrs.forEach(a => {
        const val = a.picklistValueId||a.attrValue||'—';
        const displayLabel = a.attrLabel && a.attrLabel !== a.attrDefId ? a.attrLabel : a.attrDefId.slice(0,15)+'…';
        const shortVal = val.slice(0,22)+(val.length>22?'…':'');
        const isPicklist = !!a.picklistValueId;
        html += '<div style="display:flex;gap:6px;padding:3px 7px;font-size:10px;border-top:1px solid rgba(255,255,255,.04);align-items:center" title="AttrDef ID: '+esc(a.attrDefId)+'\nValue: '+esc(val)+'">';
        html += '<span style="color:var(--fg2);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500">'+esc(displayLabel)+'</span>';
        html += '<span style="font-size:9px;padding:0 4px;border-radius:2px;background:'+(isPicklist?'rgba(80,150,80,.2)':'rgba(80,120,200,.2)')+';color:'+(isPicklist?'#7ec87e':'#7eb5e8')+';flex-shrink:0">'+(isPicklist?'picklist':'text')+'</span>';
        html += '<span style="font-family:monospace;color:var(--fg2);flex:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right">'+esc(shortVal)+'</span>';
        html += '</div>';
      });
      html += '</div>';
    }

    html += '</div>';

    // Render children only when not collapsed
    if(!collapsed){
      children.forEach(child => { html += renderQliNode(child, depth+1); });
      childInserts.forEach(ins => { html += renderInsertCard(ins, depth+1, tabId); });
    }

    return html;
  }

  const hasItems = s.existingQlis.length > 0 || s.newInserts.length > 0;
  let html = '';
  if(!hasItems){
    html = '<div style="color:var(--fg3);font-size:11px;padding:8px 0">Load a quote to see its QLI tree here.</div>';
  } else {
    // Collapse/expand all controls
    const allKeys = s.existingQlis.filter(q=>(childrenOf[q.id]||[]).length>0).map(q=>tabId+':'+q.id);
    html += '<div style="display:flex;gap:6px;margin-bottom:8px">'+
      '<button class="btn btn-sec" style="font-size:10px;padding:2px 8px" onclick="'+allKeys.map(k=>'_pstCollapsed[\''+k+'\']=true').join(';')+';_renderPstTree(\''+tabId+'\')">Collapse all</button>'+
      '<button class="btn btn-sec" style="font-size:10px;padding:2px 8px" onclick="'+allKeys.map(k=>'delete _pstCollapsed[\''+k+'\']').join(';')+';_renderPstTree(\''+tabId+'\')">Expand all</button>'+
      '</div>';
    roots.forEach(qli => { html += renderQliNode(qli, 0); });
    // Flat inserts (no parent)
    s.newInserts.filter(ins => !ins.parentRef).forEach(ins => {
      html += renderInsertCard(ins, 0, tabId);
    });
  }
  treeEl.innerHTML = html;
  if(s.previewActive) pstPreview(tabId);
}

function _renderAttrRows(ins, tabId){
  if(!ins.attrs || !ins.attrs.length) return '';
  let html = '<div style="margin:4px 0 0 0;border:1px solid rgba(255,255,255,.07);border-radius:3px;overflow:hidden">';
  html += '<div style="background:rgba(255,255,255,.04);padding:3px 7px;font-size:9px;font-weight:600;color:var(--fg3);text-transform:uppercase;letter-spacing:.5px">Attributes ('+ins.attrs.length+')</div>';
  ins.attrs.forEach((attr, i) => {
    const isPicklist = attr.usePicklist !== false;
    html += '<div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;padding:4px 7px;border-top:1px solid rgba(255,255,255,.04);background:rgba(0,0,0,.15)">';
    html += '<label style="font-size:10px;color:var(--fg2)">Def <input class="try-inp" value="'+esc(attr.attrDefId)+'" placeholder="0Yf…" style="width:110px;font-size:11px;font-family:monospace;padding:2px 4px" onchange="pstUpdateAttr(\''+tabId+'\',\''+ins.localRef+'\','+i+',\'attrDefId\',this.value)"></label>';
    html += '<select class="try-inp" style="font-size:10px;padding:2px 4px;color:var(--fg2)" onchange="pstUpdateAttr(\''+tabId+'\',\''+ins.localRef+'\','+i+',\'usePicklist\',this.value)">'+
      '<option value="picklist"'+(isPicklist?' selected':'')+'>Picklist</option>'+
      '<option value="text"'+(!isPicklist?' selected':'')+'>Text</option>'+
      '</select>';
    if(isPicklist){
      html += '<label style="font-size:10px;color:var(--fg2)">Value ID <input class="try-inp" value="'+esc(attr.picklistValueId)+'" placeholder="0Yg…" style="width:110px;font-size:11px;font-family:monospace;padding:2px 4px" onchange="pstUpdateAttr(\''+tabId+'\',\''+ins.localRef+'\','+i+',\'picklistValueId\',this.value)"></label>';
    } else {
      html += '<label style="font-size:10px;color:var(--fg2)">Value <input class="try-inp" value="'+esc(attr.attrValue)+'" placeholder="value" style="width:90px;font-size:11px;padding:2px 4px" onchange="pstUpdateAttr(\''+tabId+'\',\''+ins.localRef+'\','+i+',\'attrValue\',this.value)"></label>';
    }
    html += '<button class="icon-btn" style="color:var(--red);font-size:10px;padding:1px 4px;margin-left:auto" onclick="pstRemoveAttr(\''+tabId+'\',\''+ins.localRef+'\','+i+')">✕</button>';
    html += '</div>';
  });
  html += '</div>';
  return html;
}

function renderInsertCard(ins, depth, tabId){
  const s = pstState[tabId];
  const indent = depth * 20;
  const parentLabel = ins.parentRef
    ? 'child of '+esc(ins.parentLabel || ins.parentRef.slice(0,12))
    : 'flat (no parent)';

  let html = '<div style="margin-left:'+indent+'px;margin-bottom:5px;background:#071a07;border:1px solid var(--green);border-left:3px solid var(--green);border-radius:4px">';
  // Header
  html += '<div style="display:flex;align-items:center;gap:5px;padding:6px 8px 4px 8px;border-bottom:1px solid rgba(255,255,255,.05)">';
  html += '<span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;color:var(--green);border:1px solid var(--green);flex-shrink:0">NEW</span>';
  html += '<span style="font-size:10px;color:var(--fg3);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+parentLabel+'</span>';
  html += '<span style="font-family:monospace;font-size:9px;color:var(--fg3);flex-shrink:0">'+esc(ins.localRef)+'</span>';
  html += '<button class="icon-btn" style="color:var(--red);font-size:11px;padding:1px 6px;flex-shrink:0" onclick="pstRemoveInsert(\''+tabId+'\',\''+ins.localRef+'\')">✕</button>';
  html += '</div>';
  // Fields row
  html += '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;padding:5px 8px">';
  html += '<label style="font-size:10px;color:var(--fg2)">Prod <input class="try-inp" value="'+esc(ins.product2Id)+'" placeholder="01t…" style="width:110px;font-size:11px;font-family:monospace;padding:2px 4px" oninput="pstUpdateInsert(\''+tabId+'\',\''+ins.localRef+'\',\'product2Id\',this.value)"></label>';
  html += '<label style="font-size:10px;color:var(--fg2)">PBE <input class="try-inp" value="'+esc(ins.pbeId)+'" placeholder="01u…" style="width:110px;font-size:11px;font-family:monospace;padding:2px 4px" onchange="pstUpdateInsert(\''+tabId+'\',\''+ins.localRef+'\',\'pbeId\',this.value)"></label>';
  html += '<label style="font-size:10px;color:var(--fg2)">Qty <input type="number" class="try-inp" value="'+esc(ins.qty||'1')+'" min="1" style="width:46px;font-size:11px;padding:2px 4px" onchange="pstUpdateInsert(\''+tabId+'\',\''+ins.localRef+'\',\'qty\',this.value)"></label>';
  html += '<label style="font-size:10px;color:var(--fg2)">Freq <input class="try-inp" value="'+esc(ins.billingFreq||'')+'" placeholder="Monthly" style="width:70px;font-size:11px;padding:2px 4px" onchange="pstUpdateInsert(\''+tabId+'\',\''+ins.localRef+'\',\'billingFreq\',this.value)"></label>';
  html += '<button class="icon-btn" style="font-size:10px;color:var(--acc);margin-left:auto" onclick="pstAddAttr(\''+tabId+'\',\''+ins.localRef+'\')">+ Attr</button>';
  html += '<button class="icon-btn" style="font-size:10px;color:var(--acc)" onclick="pstAddChildInsert(\''+tabId+'\',\''+ins.localRef+'\',\''+esc(ins.product2Id||ins.localRef)+'\')">+ Child QLI</button>';
  html += '<button class="icon-btn" style="font-size:10px;color:#7eb5e8;border:1px solid rgba(126,181,232,.4);border-radius:3px;padding:1px 6px" onclick="pstOpenConfigurator(\''+tabId+'\',\''+ins.localRef+'\')" title="Load product structure from PCM API">⚙ Configure</button>';
  html += '</div>';
  // Attr rows
  const attrHtml = _renderAttrRows(ins, tabId);
  if(attrHtml) html += '<div style="padding:0 8px 6px 8px">'+attrHtml+'</div>';
  html += '</div>';

  // Recursively render any new inserts that are children of this insert
  s.newInserts.filter(child => child.parentRef === ins.localRef).forEach(child => {
    html += renderInsertCard(child, depth+1, tabId);
  });

  return html;
}

function pstDeleteQli(tabId, qliId){
  const s = pstState[tabId];
  s.deletedQliIds.add(qliId);
  // Auto-detect blocking QLR
  s.existingQlrs.filter(r => r.assocQliId === qliId).forEach(r => s.deletedQlrIds.add(r.id));
  // Also delete children recursively
  (s.existingQlrs.filter(r => r.mainQliId === qliId)||[]).forEach(r => pstDeleteQli(tabId, r.assocQliId));
  _renderPstTree(tabId);
}

function pstUndeleteQli(tabId, qliId){
  const s = pstState[tabId];
  s.deletedQliIds.delete(qliId);
  s.existingQlrs.filter(r => r.assocQliId === qliId).forEach(r => s.deletedQlrIds.delete(r.id));
  _renderPstTree(tabId);
}

function pstPatchQli(tabId, qliId, field, value){
  const s = pstState[tabId];
  if(!s.patchedQlis[qliId]){
    const orig = s.existingQlis.find(q => q.id === qliId);
    s.patchedQlis[qliId] = { qty: orig.qty, billingFreq: orig.billingFreq };
  }
  s.patchedQlis[qliId][field] = value;
  // Partial DOM update — update op-badge only to avoid focus loss on inputs
  const patched = s.patchedQlis[qliId];
  const orig = s.existingQlis.find(q => q.id === qliId);
  const hasChanges = patched && orig && (patched.qty !== orig.qty || patched.billingFreq !== orig.billingFreq);
  const op = s.deletedQliIds.has(qliId) ? 'DELETE' : hasChanges ? 'PATCH' : 'UNCHANGED';
  const opColor = op==='DELETE'?'var(--red)':op==='PATCH'?'var(--yellow)':'var(--fg3)';
  const badge = document.getElementById('pst-op-badge-'+tabId+'-'+qliId);
  if(badge){ badge.textContent=op; badge.style.color=opColor; badge.style.borderColor=opColor; }
  else { _renderPstTree(tabId); }
}

function pstAddChildInsert(tabId, parentQliId, parentName){
  const s = pstState[tabId];
  const localRef = 'ref_ins_' + (s.insertCounter++);
  s.newInserts.push({ localRef, product2Id:'', pbeId:'', qty:'1', billingFreq:'', parentRef: parentQliId, parentLabel: parentName, attrs:[] });
  _renderPstTree(tabId);
}

function pstToggleNewQuote(tabId, checked){
  const s = pstState[tabId];
  s.newQuote = checked;
  const existing = document.getElementById('pst-existingquote-'+tabId);
  const form = document.getElementById('pst-newquote-form-'+tabId);
  const loadBtn = document.getElementById('pst-load-btn-'+tabId);
  const execBtn = document.getElementById('pst-exec-btn-'+tabId);
  if(existing) existing.style.display = checked ? 'none' : '';
  if(form) form.style.display = checked ? '' : 'none';
  if(execBtn) execBtn.textContent = checked ? '▶ Create Quote + QLIs (single PST call)' : '▶ Execute PST';
  // Reset tree when toggling mode
  s.existingQlis = []; s.existingQlrs = [];
  s.deletedQliIds = new Set(); s.deletedQlrIds = new Set();
  s.patchedQlis = {}; s.newInserts = []; s.insertCounter = 0;
  if(!checked) s.quoteId = '';
  _renderPstTree(tabId);
}

function pstAddFlatInsert(tabId){
  const s = pstState[tabId];
  const localRef = 'ref_ins_' + (s.insertCounter++);
  s.newInserts.push({ localRef, product2Id:'', pbeId:'', qty:'1', billingFreq:'', parentRef:'', parentLabel:'', attrs:[] });
  _renderPstTree(tabId);
}

function pstRemoveInsert(tabId, localRef){
  const s = pstState[tabId];
  s.newInserts = s.newInserts.filter(ins => ins.localRef !== localRef);
  _renderPstTree(tabId);
}

function pstAddAttr(tabId, localRef){
  const s = pstState[tabId];
  const ins = s.newInserts.find(i => i.localRef === localRef);
  if(!ins) return;
  ins.attrs.push({ attrDefId:'', usePicklist:true, picklistValueId:'', attrValue:'' });
  _renderPstTree(tabId);
}
function pstRemoveAttr(tabId, localRef, attrIdx){
  const s = pstState[tabId];
  const ins = s.newInserts.find(i => i.localRef === localRef);
  if(!ins) return;
  ins.attrs.splice(attrIdx, 1);
  _renderPstTree(tabId);
}
function pstUpdateAttr(tabId, localRef, attrIdx, field, value){
  const s = pstState[tabId];
  const ins = s.newInserts.find(i => i.localRef === localRef);
  if(!ins || !ins.attrs[attrIdx]) return;
  if(field === 'usePicklist') ins.attrs[attrIdx].usePicklist = value === 'picklist';
  else ins.attrs[attrIdx][field] = value;
}

function pstUpdateInsert(tabId, localRef, field, value){
  const s = pstState[tabId];
  const ins = s.newInserts.find(i => i.localRef === localRef);
  if(ins) ins[field] = value;
  // Don't re-render tree on every keystroke — would lose focus; badge update not needed for inserts
}

function _buildPstGraph(tabId){
  const s = pstState[tabId];
  const records = [];

  // 1. Quote anchor — PATCH for existing, POST for new
  if(s.newQuote){
    const nq = s.newQuoteFields;
    // AccountId is PST FLS-blocked — omit it (per Scenario 9 POC)
    const quoteRec = { attributes:{type:'Quote',method:'POST'}, Name:nq.name, Pricebook2Id:nq.pricebook2Id };
    if(nq.currencyIsoCode.trim()) quoteRec.CurrencyIsoCode = nq.currencyIsoCode.trim();
    if(nq.opportunityId.trim()) quoteRec.OpportunityId = nq.opportunityId.trim();
    records.push({ referenceId:'refQuote', record:quoteRec });
  } else {
    records.push({ referenceId:'refQuote',
      record:{ attributes:{type:'Quote', method:'PATCH', id:s.quoteId.trim() } }});
  }

  // 2. QLR DELETEs
  s.deletedQlrIds.forEach(id => {
    records.push({ referenceId:'refDelQlr_'+id.slice(-6),
      record:{ attributes:{type:'QuoteLineRelationship', method:'DELETE', id } }});
  });

  // 3. QLI DELETEs
  s.deletedQliIds.forEach(id => {
    records.push({ referenceId:'refDelQli_'+id.slice(-6),
      record:{ attributes:{type:'QuoteLineItem', method:'DELETE', id } }});
  });

  // 4. QLI PATCHes
  Object.entries(s.patchedQlis).forEach(([qliId, patch]) => {
    if(s.deletedQliIds.has(qliId)) return;
    const orig = s.existingQlis.find(q => q.id === qliId);
    if(!orig) return;
    const changed = patch.qty !== orig.qty || patch.billingFreq !== orig.billingFreq;
    if(!changed) return;
    const rec = { attributes:{type:'QuoteLineItem', method:'PATCH', id:qliId } };
    if(patch.qty !== orig.qty) rec.Quantity = patch.qty;
    if(patch.billingFreq !== orig.billingFreq) rec.BillingFrequency = patch.billingFreq||null;
    records.push({ referenceId:'refPatch_'+qliId.slice(-6), record:rec });
  });

  // 5. QLI POSTs + inline QuoteLineItemAttribute POSTs
  s.newInserts.forEach(ins => {
    const rec = {
      attributes:{type:'QuoteLineItem',method:'POST'},
      QuoteId:'@{refQuote.id}',
      Product2Id: ins.product2Id.trim(),
      PricebookEntryId: ins.pbeId.trim(),
      Quantity: ins.qty||'1'
    };
    if(ins.billingFreq.trim()) rec.BillingFrequency = ins.billingFreq.trim();
    records.push({ referenceId: ins.localRef, record: rec });
    (ins.attrs||[]).forEach((attr, ai) => {
      if(!attr.attrDefId.trim()) return;
      const attrRec = {
        attributes:{ type:'QuoteLineItemAttribute', method:'POST' },
        QuoteLineItemId: '@{'+ins.localRef+'.id}',
        AttributeDefinitionId: attr.attrDefId.trim()
      };
      if(attr.usePicklist !== false){
        if(attr.picklistValueId.trim()) attrRec.AttributePicklistValueId = attr.picklistValueId.trim();
      } else {
        if(attr.attrValue.trim()) attrRec.AttributeValue = attr.attrValue.trim();
      }
      records.push({ referenceId: ins.localRef+'_attr'+ai, record: attrRec });
    });
  });

  // 6. QLR POSTs — one per insert with a parentRef
  let qlrIdx = 0;
  s.newInserts.forEach(ins => {
    const parent = ins.parentRef;
    if(!parent) return;
    // parent is either a real QLI id (existing) or a localRef string (new insert)
    const isRef = parent.startsWith('ref_ins_');
    const mainId = isRef ? '@{'+parent+'.id}' : parent;
    records.push({ referenceId:'refQlr_'+(qlrIdx++),
      record:{
        attributes:{type:'QuoteLineRelationship',method:'POST'},
        ProductRelationshipTypeId:'{{PRT_ID}}',
        MainQuoteLineId: mainId,
        AssociatedQuoteLineId:'@{'+ins.localRef+'.id}',
        AssociatedQuoteLinePricing:'IncludedInBundlePrice'
      }});
  });

  return {
    pricingPref: s.pricingPref,
    configurationPref: { configurationMethod: s.configInput },
    graph:{ graphId:'pstBuilder', records }
  };
}

function _buildFullPstGraph(tabId){
  const s = pstState[tabId];
  const records = [];

  // Quote anchor
  records.push({ referenceId:'refQuote', record:{ attributes:{type:'Quote', method:'PATCH', id:s.quoteId.trim() }}});

  // All existing QLIs — DELETE / PATCH / no-op (include all for full picture)
  s.existingQlis.forEach(qli => {
    const isDeleted = s.deletedQliIds.has(qli.id);
    const patched = s.patchedQlis[qli.id];
    const hasChanges = patched && (patched.qty !== qli.qty || patched.billingFreq !== qli.billingFreq);

    if(isDeleted){
      // QLR DELETE first
      s.existingQlrs.filter(r => r.assocQliId === qli.id).forEach(r => {
        records.push({ referenceId:'refDelQlr_'+r.id.slice(-6), record:{ attributes:{type:'QuoteLineRelationship', method:'DELETE', id:r.id }}});
      });
      records.push({ referenceId:'refDelQli_'+qli.id.slice(-6), record:{ attributes:{type:'QuoteLineItem', method:'DELETE', id:qli.id }}});
    } else if(hasChanges){
      const rec = { attributes:{type:'QuoteLineItem', method:'PATCH', id:qli.id } };
      if(patched.qty !== qli.qty) rec.Quantity = patched.qty;
      if(patched.billingFreq !== qli.billingFreq) rec.BillingFrequency = patched.billingFreq||null;
      records.push({ referenceId:'refPatch_'+qli.id.slice(-6), record:rec });
    } else {
      // Unchanged — shown in full structure preview only
      records.push({ referenceId:'refExist_'+qli.id.slice(-6), record:{ attributes:{type:'QuoteLineItem', method:'PATCH', id:qli.id }, _note:'UNCHANGED' }});
    }

    // Existing attributes for this QLI
    (s.existingAttrs[qli.id]||[]).forEach((a,ai) => {
      const attrRec = { attributes:{type:'QuoteLineItemAttribute', method:'PATCH', id:a.id } };
      if(a.picklistValueId) attrRec.AttributePicklistValueId = a.picklistValueId;
      else if(a.attrValue) attrRec.AttributeValue = a.attrValue;
      attrRec._attrDef = a.attrDefId;
      records.push({ referenceId:'refExistAttr_'+qli.id.slice(-6)+'_'+ai, record:attrRec });
    });
  });

  // Existing QLRs (non-deleted) — show structure
  s.existingQlrs.forEach(r => {
    if(s.deletedQlrIds.has(r.id)) return;
    records.push({ referenceId:'refExistQlr_'+r.id.slice(-6), record:{
      attributes:{type:'QuoteLineRelationship', method:'PATCH', id:r.id },
      _main:r.mainQliId, _assoc:r.assocQliId
    }});
  });

  // New QLI inserts + their attrs + QLRs
  s.newInserts.forEach(ins => {
    const rec = { attributes:{type:'QuoteLineItem',method:'POST'}, QuoteId:'@{refQuote.id}',
      Product2Id:ins.product2Id.trim(), PricebookEntryId:ins.pbeId.trim(), Quantity:ins.qty||'1' };
    if(ins.billingFreq.trim()) rec.BillingFrequency = ins.billingFreq.trim();
    records.push({ referenceId:ins.localRef, record:rec });
    (ins.attrs||[]).forEach((attr,ai) => {
      if(!attr.attrDefId.trim()) return;
      const attrRec = { attributes:{type:'QuoteLineItemAttribute',method:'POST'},
        QuoteLineItemId:'@{'+ins.localRef+'.id}', AttributeDefinitionId:attr.attrDefId.trim() };
      if(attr.usePicklist !== false && attr.picklistValueId.trim()) attrRec.AttributePicklistValueId = attr.picklistValueId.trim();
      else if(attr.usePicklist === false && attr.attrValue.trim()) attrRec.AttributeValue = attr.attrValue.trim();
      records.push({ referenceId:ins.localRef+'_attr'+ai, record:attrRec });
    });
  });
  s.newInserts.forEach((ins,idx) => {
    if(!ins.parentRef) return;
    const isRef = ins.parentRef.startsWith('ref_ins_');
    const mainId = isRef ? '@{'+ins.parentRef+'.id}' : ins.parentRef;
    records.push({ referenceId:'refQlr_new_'+idx, record:{
      attributes:{type:'QuoteLineRelationship',method:'POST'},
      ProductRelationshipTypeId:'{{PRT_ID}}', MainQuoteLineId:mainId,
      AssociatedQuoteLineId:'@{'+ins.localRef+'.id}', AssociatedQuoteLinePricing:'IncludedInBundlePrice'
    }});
  });

  return { pricingPref:s.pricingPref, configurationPref:{ configurationMethod:s.configInput }, graph:{ graphId:'pstBuilder', records }};
}

function pstPreview(tabId){
  const s = pstState[tabId];
  s.previewActive = true;
  const respEl = document.getElementById('pst-resp-'+tabId);
  try{
    const graph = _buildPstGraph(tabId);
    let prefix = '';
    if(s.newQuote){
      const nq = s.newQuoteFields;
      const quotePayload = {
        Name: nq.name||'(required)',
        Pricebook2Id: nq.pricebook2Id||'(required)',
        AccountId: nq.accountId||'(required)',
        ...(nq.opportunityId.trim() ? { OpportunityId: nq.opportunityId } : {})
      };
      prefix = '// Step 1: POST /services/data/v67.0/sobjects/Quote\n'+
               JSON.stringify(quotePayload, null, 2)+
               '\n\n// Step 2: POST /services/data/v63.0/connect/rev/sales-transaction/actions/place\n// (quoteId from Step 1 substituted as Quote anchor PATCH)\n';
      // Show what the PST graph looks like with a placeholder ID
      const savedId = s.quoteId;
      s.quoteId = '<NEW_QUOTE_ID_FROM_STEP1>';
      s.newQuote = false;
      const pstPreviewGraph = _buildPstGraph(tabId);
      s.newQuote = true; s.quoteId = savedId;
      respEl.style.color = 'var(--fg)';
      respEl.textContent = prefix + JSON.stringify(pstPreviewGraph, null, 2);
    } else {
      let out = '';

      // Quote info header
      if(s.quoteRecord){
        const q = s.quoteRecord;
        out += '// ════════════════════════════════════════════════════\n';
        out += '// QUOTE: '+q.Name+'\n';
        out += '// ID:    '+s.quoteId.trim()+'\n';
        out += '// Status: '+(q.Status||'—')+'  |  Currency: '+(q.CurrencyIsoCode||'—')+'  |  Pricebook: '+(q.Pricebook2&&q.Pricebook2.Name||'—')+'\n';
        if(q.Account&&q.Account.Name)    out += '// Account:     '+q.Account.Name+'\n';
        if(q.Opportunity&&q.Opportunity.Name) out += '// Opportunity: '+q.Opportunity.Name+'\n';
        out += '// ════════════════════════════════════════════════════\n\n';
      }

      // Section 1 — Full structure (all QLIs + attrs + QLRs)
      const fullGraph = _buildFullPstGraph(tabId);
      out += '// ┌─ SECTION 1: FULL QUOTE STRUCTURE (complete picture)\n';
      out += '// │  Includes all existing QLIs, attributes, QLRs and any new inserts.\n';
      out += '// │  NOTE: _note fields and _attrDef/_main/_assoc are for display only.\n';
      out += '// └────────────────────────────────────────────────────\n';
      out += JSON.stringify(fullGraph, null, 2);

      // Section 2 — Delta only (what actually gets sent)
      const deltaRecords = graph.graph.records;
      const nonAnchor = deltaRecords.filter(r => r.referenceId !== 'refQuote');
      out += '\n\n\n// ┌─ SECTION 2: ACTUAL PST PAYLOAD (delta only — what will be sent)\n';
      out += '// │  Only changed/deleted/new nodes. UNCHANGED QLIs are omitted.\n';
      out += '// │  Delta: '+nonAnchor.length+' record(s) beyond Quote anchor.\n';
      out += '// └────────────────────────────────────────────────────\n';
      out += JSON.stringify(graph, null, 2);

      respEl.style.color = 'var(--fg)';
      respEl.textContent = out;
    }
  }catch(e){
    respEl.style.color = 'var(--red)';
    respEl.textContent = 'Error building graph: '+e.message;
  }
}

function executePst(tabId){
  const s = pstState[tabId];
  const orgAlias = document.getElementById('org-select').value;
  if(!orgAlias){ showToast('Select an org first.','error'); return; }

  if(s.newQuote){
    _executePstNewQuote(tabId, orgAlias);
  } else {
    if(!s.quoteId.trim()){ showToast('Quote ID is required.','error'); return; }
    _executePstExisting(tabId, orgAlias);
  }
}

function _executePstExisting(tabId, orgAlias){
  const s = pstState[tabId];
  const bad = s.newInserts.find(ins => !ins.product2Id.trim() || !ins.pbeId.trim());
  if(bad){ showToast('All new QLI rows require Product2Id and PBE Id.','error'); return; }

  const btn = document.getElementById('pst-exec-btn-'+tabId);
  const respEl = document.getElementById('pst-resp-'+tabId);
  const pill = document.getElementById('pst-pill-'+tabId);
  btn.disabled = true; btn.textContent = 'Executing…';
  respEl.style.color = 'var(--fg3)'; respEl.textContent = 'Waiting for response…';
  if(pill) pill.innerHTML = '';

  let body;
  try{ body = applyVars(JSON.stringify(_buildPstGraph(tabId))); }
  catch(e){ btn.disabled=false; btn.textContent='▶ Execute PST'; showToast('Graph error: '+e.message,'error'); return; }

  const requestId = ++reqCounter;
  pendingReqs[requestId] = (result) => {
    btn.disabled = false; btn.textContent = '▶ Execute PST';
    _showPstResult(tabId, result, 'POST', '/services/data/v63.0/connect/rev/sales-transaction/actions/place');
  };

  vscMsg({ type:'executeCustom', requestId, orgAlias,
    method:'POST',
    path:'/services/data/v63.0/connect/rev/sales-transaction/actions/place',
    headers:{}, body, apiVersion:'v63.0' });
}

function _executePstNewQuote(tabId, orgAlias){
  const s = pstState[tabId];
  const nq = s.newQuoteFields;
  if(!nq.name.trim()){ showToast('Quote Name is required.','error'); return; }
  if(!nq.pricebook2Id.trim()){
    const pbEl = document.getElementById('pst-nq-pb-'+tabId);
    if(pbEl){ pbEl.style.borderColor='var(--red)'; pbEl.style.boxShadow='0 0 0 2px rgba(220,50,50,.3)'; pbEl.focus(); setTimeout(()=>{ pbEl.style.borderColor=''; pbEl.style.boxShadow=''; },3000); }
    showToast('Pricebook2Id is required — paste the 01s… ID.','error'); return;
  }
  if(!nq.currencyIsoCode.trim()){ showToast('CurrencyIsoCode is required (must match all PBE currencies).','error'); return; }
  const bad = s.newInserts.find(ins => !ins.product2Id.trim() || !ins.pbeId.trim());
  if(bad){ showToast('All new QLI rows require Product2Id and PBE Id.','error'); return; }

  const btn = document.getElementById('pst-exec-btn-'+tabId);
  const respEl = document.getElementById('pst-resp-'+tabId);
  const pill = document.getElementById('pst-pill-'+tabId);
  btn.disabled = true; btn.textContent = 'Executing…';
  respEl.style.color = 'var(--fg3)'; respEl.textContent = 'Waiting for response…';
  if(pill) pill.innerHTML = '';

  // Single PST call — Quote POST + QLI POSTs in one graph (Scenario 9)
  // salesTransactionId in the response IS the new Quote ID
  let body;
  try{ body = applyVars(JSON.stringify(_buildPstGraph(tabId))); }
  catch(e){ btn.disabled=false; btn.textContent='▶ Create Quote + Add QLIs'; showToast('Graph error: '+e.message,'error'); return; }

  const requestId = ++reqCounter;
  pendingReqs[requestId] = (result) => {
    btn.disabled = false; btn.textContent = '▶ Create Quote + Add QLIs';
    let parsed;
    try{ parsed = JSON.parse(result.body); }catch(_){ parsed = null; }
    const isOk = parsed && parsed.isSuccess;
    if(pill){
      if(isOk){
        const newQuoteId = parsed.salesTransactionId;
        pill.innerHTML = '<span class="status-pill s2xx">&#10003; Quote + QLIs created — '+esc(newQuoteId)+'</span>'+
          '<div style="margin-top:4px;font-size:10px;color:var(--fg3)">Quote ID: <code>'+esc(newQuoteId)+'</code> · Auto-set as <code>{{QUOTE_ID}}</code> in your environment</div>';
        setQuickVar('QUOTE_ID', newQuoteId, null);
      } else {
        const errs = parsed&&parsed.errorResponse ? parsed.errorResponse.map(e=>'<li>'+esc(e.errorCode)+': '+esc(e.message)+'</li>').join('') : '';
        pill.innerHTML = '<span class="status-pill serr">&#10005; PST Failed</span>'+
          (errs?'<ul style="margin:6px 0 0 16px;font-size:11px;color:var(--red)">'+errs+'</ul>':'');
      }
    }
    s.previewActive = false;
    respEl.style.color = isOk ? 'var(--fg)' : 'var(--yellow)';
    respEl.textContent = parsed ? JSON.stringify(parsed, null, 2) : result.body;
    updateStatusBar('POST', '/services/data/v63.0/connect/rev/sales-transaction/actions/place', result.status, result.durationMs);
  };

  vscMsg({ type:'executeCustom', requestId, orgAlias,
    method:'POST',
    path:'/services/data/v63.0/connect/rev/sales-transaction/actions/place',
    headers:{}, body, apiVersion:'v63.0' });
}

function _showPstResult(tabId, result, method, path){
  const pill = document.getElementById('pst-pill-'+tabId);
  const respEl = document.getElementById('pst-resp-'+tabId);
  let parsed;
  try{ parsed = JSON.parse(result.body); }catch(_){ parsed = null; }
  const isOk = parsed && parsed.isSuccess;
  if(pill){
    if(isOk) pill.innerHTML = '<span class="status-pill s2xx">&#10003; Success — '+esc(parsed.salesTransactionId)+'</span>';
    else{
      const errs = parsed&&parsed.errorResponse ? parsed.errorResponse.map(e=>'<li>'+esc(e.errorCode)+': '+esc(e.message)+'</li>').join('') : '';
      pill.innerHTML = '<span class="status-pill serr">&#10005; PST Failed</span>'+
        (errs?'<ul style="margin:6px 0 0 16px;font-size:11px;color:var(--red)">'+errs+'</ul>':'');
    }
  }
  pstState[tabId].previewActive = false;
  respEl.style.color = isOk ? 'var(--fg)' : 'var(--yellow)';
  respEl.textContent = parsed ? JSON.stringify(parsed, null, 2) : result.body;
  updateStatusBar(method, path, result.status, result.durationMs);
}

function copyPstApex(tabId){
  const s = pstState[tabId];
  const prtId = activeEnvVars['PRT_ID'] || '{{PRT_ID}}';
  const lines = [];

  if(s.newQuote){
    const nq = s.newQuoteFields;
    // Scenario 9 pattern: Quote POST + QLI POSTs in single PST call
    lines.push('// Create Quote + QLIs in one atomic PST call (Scenario 9)');
    lines.push('// AccountId is PST FLS-blocked — omit it');
    lines.push('Schema.SObjectType quoteType = Quote.getSObjectType();');
    lines.push('Schema.SObjectType qliType   = QuoteLineItem.getSObjectType();');
    lines.push('List<RevSalesTrxn.RecordWithReferenceRequest> records = new List<RevSalesTrxn.RecordWithReferenceRequest>();');
    lines.push('');
    lines.push('RevSalesTrxn.RecordResource quoteRes = new RevSalesTrxn.RecordResource(quoteType, \'POST\');');
    lines.push('quoteRes.fieldValues = new Map<String,Object>{');
    lines.push('    \'Name\'            => \''+nq.name.trim()+'\',');
    lines.push('    \'Pricebook2Id\'    => \''+nq.pricebook2Id.trim()+'\',');
    lines.push('    \'CurrencyIsoCode\' => \''+nq.currencyIsoCode.trim()+'\'');
    if(nq.opportunityId.trim()) lines.push('    // \'OpportunityId\' => \''+nq.opportunityId.trim()+'\'');
    lines.push('};');
    lines.push('records.add(new RevSalesTrxn.RecordWithReferenceRequest(\'refQuote\', quoteRes));');
    lines.push('');
  } else {
    lines.push('PSTGraphBuilder b = new PSTGraphBuilder(\''+s.quoteId.trim()+'\', \''+prtId+'\');');
    lines.push('');
  }
  if(s.newQuote){
    // New-quote mode: emit RecordResource pattern directly
    if(s.newInserts.length){
      lines.push('// QLI inserts — each references @{refQuote.id}');
      s.newInserts.forEach((ins, idx) => {
        lines.push('RevSalesTrxn.RecordResource qli'+idx+' = new RevSalesTrxn.RecordResource(qliType, \'POST\');');
        lines.push('qli'+idx+'.fieldValues = new Map<String,Object>{');
        lines.push('    \'QuoteId\'          => \'@{refQuote.id}\',');
        lines.push('    \'Product2Id\'       => \''+ins.product2Id+'\',');
        lines.push('    \'PricebookEntryId\' => \''+ins.pbeId+'\',');
        lines.push('    \'Quantity\'         => \'1\'');
        if(ins.billingFreq) lines.push('    // ,\'BillingFrequency\' => \''+ins.billingFreq+'\'');
        lines.push('};');
        lines.push('records.add(new RevSalesTrxn.RecordWithReferenceRequest(\''+ins.localRef+'\', qli'+idx+'));');
        (ins.attrs||[]).forEach((attr, ai) => {
          if(!attr.attrDefId.trim()) return;
          lines.push('RevSalesTrxn.RecordResource attr'+idx+'_'+ai+' = new RevSalesTrxn.RecordResource(Schema.getGlobalDescribe().get(\'QuoteLineItemAttribute\'), \'POST\');');
          lines.push('attr'+idx+'_'+ai+'.fieldValues = new Map<String,Object>{');
          lines.push('    \'QuoteLineItemId\'        => \'@{'+ins.localRef+'.id}\',');
          lines.push('    \'AttributeDefinitionId\' => \''+attr.attrDefId.trim()+'\'');
          if(attr.usePicklist !== false && attr.picklistValueId.trim())
            lines.push('    ,\'AttributePicklistValueId\' => \''+attr.picklistValueId.trim()+'\'');
          else if(attr.usePicklist === false && attr.attrValue.trim())
            lines.push('    ,\'AttributeValue\' => \''+attr.attrValue.trim()+'\'');
          lines.push('};');
          lines.push('records.add(new RevSalesTrxn.RecordWithReferenceRequest(\''+ins.localRef+'_attr'+ai+'\', attr'+idx+'_'+ai+'));');
        });
        if(ins.parentRef){
          const isRef = ins.parentRef.startsWith('ref_ins_');
          const mainId = isRef ? '@{'+ins.parentRef+'.id}' : ins.parentRef;
          lines.push('// QLR: '+mainId+' → @{'+ins.localRef+'.id}');
          lines.push('RevSalesTrxn.RecordResource qlr'+idx+' = new RevSalesTrxn.RecordResource(Schema.getGlobalDescribe().get(\'QuoteLineRelationship\'), \'POST\');');
          lines.push('qlr'+idx+'.fieldValues = new Map<String,Object>{');
          lines.push('    \'ProductRelationshipTypeId\'  => \''+prtId+'\',');
          lines.push('    \'MainQuoteLineId\'            => \''+mainId+'\',');
          lines.push('    \'AssociatedQuoteLineId\'      => \'@{'+ins.localRef+'.id}\',');
          lines.push('    \'AssociatedQuoteLinePricing\' => \'IncludedInBundlePrice\'');
          lines.push('};');
          lines.push('records.add(new RevSalesTrxn.RecordWithReferenceRequest(\'refQlr_'+idx+'\', qlr'+idx+'));');
        }
        lines.push('');
      });
    }
    lines.push('RevSalesTrxn.GraphRequest graph = new RevSalesTrxn.GraphRequest(\'new-quote\', records);');
    lines.push('RevSalesTrxn.PlaceSalesTransactionResponse resp =');
    lines.push('    RevSalesTrxn.PlaceSalesTransactionExecutor.execute(graph,');
    lines.push('        RevSalesTrxn.PricingPreferenceEnum.SKIP,');
    lines.push('        RevSalesTrxn.ConfigurationExecutionEnum.SKIP,');
    lines.push('        new RevSalesTrxn.ConfigurationOptionsInput(), (String) null);');
    lines.push('if (!resp.isSuccess) throw new MyException(JSON.serialize(resp.errorResponse));');
    lines.push('String newQuoteId = resp.salesTransactionId; // new Quote Id');
  } else {
    if(s.deletedQlrIds.size){
      lines.push('// QLR deletes (blocking)');
      s.deletedQlrIds.forEach(id => lines.push('b.deleteQLR(\''+id+'\');'));
      lines.push('');
    }
    if(s.deletedQliIds.size){
      lines.push('// QLI deletes');
      s.deletedQliIds.forEach(id => {
        const qli = s.existingQlis.find(q=>q.id===id);
        lines.push('b.deleteQLI(\''+id+'\'); // '+(qli?qli.name:''));
      });
      lines.push('');
    }
    if(s.newInserts.length){
      lines.push('// Inserts');
      s.newInserts.forEach(ins => {
        lines.push('QuoteLineItem tpl_'+ins.localRef+' = new QuoteLineItem(');
        lines.push('    Product2Id=\''+ins.product2Id+'\',');
        lines.push('    PricebookEntryId=\''+ins.pbeId+'\'');
        if(ins.billingFreq) lines.push('    // BillingFrequency=\''+ins.billingFreq+'\'');
        lines.push(');');
        lines.push('String '+ins.localRef+' = b.insertQLI(tpl_'+ins.localRef+');');
        if(ins.parentRef){
          const isRef = ins.parentRef.startsWith('ref_ins_');
          const parentArg = isRef ? ins.parentRef : '\''+ins.parentRef+'\'';
          lines.push('b.addQLR('+parentArg+', '+ins.localRef+');');
        }
        (ins.attrs||[]).forEach((attr, ai) => {
          if(!attr.attrDefId.trim()) return;
          lines.push('b.addQLIAttr('+ins.localRef+', \''+attr.attrDefId.trim()+'\''+
            (attr.usePicklist !== false && attr.picklistValueId.trim() ? ', \''+attr.picklistValueId.trim()+'\', null' :
             attr.usePicklist === false && attr.attrValue.trim() ? ', null, \''+attr.attrValue.trim()+'\'' : ', null, null')+');');
        });
        lines.push('');
      });
    }
    lines.push('RevSalesTrxn.PlaceSalesTransactionResponse resp = b.execute();');
    lines.push('if (!resp.isSuccess) throw new MyException(JSON.serialize(resp.errorResponse));');
  }
  navigator.clipboard.writeText(lines.join('\n')).then(()=>_copyToast('Apex copied'));
}

// ── Swap Builder ──────────────────────────────────────────────────────────────
// State shape per group:
//   { localId, groupCounter, outAssets:[{localId,assetId,quantity}], inRecords:[{localId,product2Id,pbeId,unitPrice,startDate}], assetCounter, recordCounter }
const swapState = {};

function openSwapBuilderTab(){
  const existing = tabs.find(t => t.type === 'swap-builder');
  if(existing){ activateTab(existing.id); return; }
  const tabId = 'tab-' + (++tabCounter);
  tabs.push({ id: tabId, type: 'swap-builder', label: 'Swap Builder' });
  swapState[tabId] = { swapStartDate:'', outputRecordType:'Quote', groups:[], groupCounter:0, mode:'form', rawJson:'' };
  renderTabBar();
  const panel = document.createElement('div');
  panel.id = 'tp-' + tabId;
  panel.className = 'tab-panel';
  document.getElementById('detail').appendChild(panel);
  _buildSwapPanel(panel, tabId);
  activateTab(tabId);
}

function _buildSwapPanel(panel, tabId){
  panel.innerHTML =
    '<div class="d-title">&#8646; Swap Builder</div>'+

    '<div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:14px;align-items:flex-end;justify-content:space-between">'+
    '<div style="display:flex;gap:0">'+
    '<button id="swap-itab-builder-'+tabId+'" onclick="swapInnerTab(\''+tabId+'\',\'builder\')" '+
    'style="padding:5px 16px;font-size:11px;font-weight:600;background:#8e44ad;color:#fff;border:none;border-radius:4px 4px 0 0;cursor:pointer;margin-right:2px">Builder</button>'+
    '<button id="swap-itab-ref-'+tabId+'" onclick="swapInnerTab(\''+tabId+'\',\'ref\')" '+
    'style="padding:5px 16px;font-size:11px;font-weight:600;background:var(--bg3);color:var(--fg2);border:none;border-radius:4px 4px 0 0;cursor:pointer">Reference</button>'+
    '</div>'+
    '<div style="display:flex;gap:2px;margin-bottom:1px">'+
    '<button id="swap-mode-form-'+tabId+'" onclick="swapToggleMode(\''+tabId+'\',\'form\')" '+
    'style="padding:3px 10px;font-size:10px;font-weight:600;background:#8e44ad;color:#fff;border:none;border-radius:4px 4px 0 0;cursor:pointer">&#9776; Form</button>'+
    '<button id="swap-mode-raw-'+tabId+'" onclick="swapToggleMode(\''+tabId+'\',\'raw\')" '+
    'style="padding:3px 10px;font-size:10px;font-weight:600;background:var(--bg3);color:var(--fg2);border:none;border-radius:4px 4px 0 0;cursor:pointer">&#123;&#125; Raw JSON</button>'+
    '</div>'+
    '</div>'+

    '<div id="swap-inner-builder-'+tabId+'">'+
    '<div style="color:var(--fg3);font-size:11px;margin-bottom:14px">'+
    'Each group maps N source assets (<b>outGroup</b>) → M replacement QLIs (<b>inGroup</b>). All assets in one call must belong to the same Account.'+
    '</div>'+

    '<div class="try-sec"><div class="try-lbl">Swap Settings</div>'+
    '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px">'+
    '<label style="font-size:11px;color:var(--fg2)">Swap Start Date *&nbsp;'+
    '<input type="datetime-local" class="try-inp" id="swap-start-'+tabId+'" style="font-size:11px;padding:2px 5px" '+
    'oninput="swapState[\''+tabId+'\'].swapStartDate=this.value"></label>'+
    '<label style="font-size:11px;color:var(--fg2)">Output Record Type&nbsp;'+
    '<select class="try-sel" id="swap-output-'+tabId+'" onchange="swapState[\''+tabId+'\'].outputRecordType=this.value">'+
    '<option value="Quote">Quote</option><option value="Order">Order</option>'+
    '</select></label>'+
    '</div>'+
    '<div style="font-size:10px;color:var(--fg3);padding:5px 7px;background:var(--bg3);border-radius:4px;border-left:3px solid #8e44ad">'+
    'PBE currency must match source asset currency. Assets must have <code>HasLifecycleManagement=true</code> + <code>AssetStatePeriod</code>. Only root-level assets (not bundle children).'+
    '</div></div>'+

    '<div class="try-sec"><div class="try-lbl" style="display:flex;align-items:center;justify-content:space-between">'+
    '<span>Swap Groups</span>'+
    '<button class="btn btn-sec" onclick="swapAddGroup(\''+tabId+'\')" style="font-size:11px;padding:2px 10px">+ Add Group</button>'+
    '</div>'+
    '<div id="swap-groups-'+tabId+'" style="margin-top:8px">'+
    '<div style="color:var(--fg3);font-size:11px;text-align:center;padding:16px 0">No groups yet — click "+ Add Group"</div>'+
    '</div></div>'+

    '<div id="swap-raw-'+tabId+'" style="display:none;margin-bottom:10px">'+
    '<div style="font-size:11px;color:var(--fg3);margin-bottom:5px">Paste or edit the full JSON payload. Variables like <code>{{VAR}}</code> are substituted on execute.</div>'+
    '<div id="swap-raw-err-'+tabId+'" style="color:#e74c3c;font-size:11px;margin-bottom:4px;display:none"></div>'+
    '<textarea id="swap-raw-txt-'+tabId+'" spellcheck="false" '+
    'style="width:100%;height:360px;font-family:monospace;font-size:12px;padding:8px;box-sizing:border-box;background:var(--bg3);color:var(--fg1);border:1px solid var(--border);border-radius:4px;resize:vertical;line-height:1.4" '+
    'oninput="swapState[\''+tabId+'\'].rawJson=this.value"></textarea>'+
    '</div>'+

    '<div class="btn-row" style="margin-bottom:10px">'+
    '<button class="btn btn-sec" onclick="swapPreviewJson(\''+tabId+'\')">&#128269; Preview JSON</button>'+
    '<button class="btn btn-pri" onclick="executeSwap(\''+tabId+'\')" style="background:#8e44ad;border-color:#8e44ad">&#9654; Execute Swap</button>'+
    '<button class="btn btn-sec" onclick="copySwapAs(\''+tabId+'\',\'apex\')">Copy Apex</button>'+
    '<button class="btn btn-sec" onclick="copySwapAs(\''+tabId+'\',\'curl\')">Copy cURL</button>'+
    '<button class="btn btn-sec" onclick="copySwapAs(\''+tabId+'\',\'js\')">Copy JS</button>'+
    '</div>'+
    '<div id="swap-pill-'+tabId+'" style="margin-bottom:8px"></div>'+
    '<div class="resp-box" id="swap-resp-'+tabId+'" style="color:var(--fg3);min-height:80px">Preview / response will appear here.</div>'+
    '</div>'+

    '<div id="swap-inner-ref-'+tabId+'" style="display:none">'+
    _buildSwapReference()+
    '</div>';
}

function swapInnerTab(tabId, which){
  const builder = document.getElementById('swap-inner-builder-'+tabId);
  const ref     = document.getElementById('swap-inner-ref-'+tabId);
  const btnB    = document.getElementById('swap-itab-builder-'+tabId);
  const btnR    = document.getElementById('swap-itab-ref-'+tabId);
  if(!builder||!ref) return;
  if(which==='builder'){
    builder.style.display=''; ref.style.display='none';
    btnB.style.background='#8e44ad'; btnB.style.color='#fff';
    btnR.style.background='var(--bg3)'; btnR.style.color='var(--fg2)';
  } else {
    builder.style.display='none'; ref.style.display='';
    btnR.style.background='#8e44ad'; btnR.style.color='#fff';
    btnB.style.background='var(--bg3)'; btnB.style.color='var(--fg2)';
  }
}

function swapAddGroup(tabId){
  const s = swapState[tabId];
  const gid = s.groupCounter++;
  const gNum = s.groups.length + 1;
  s.groups.push({
    localId: 'sg_'+gid,
    referenceId: '',
    graphId: '',
    outAssets:   [{ localId:'oa_0', assetId:'', quantity:'1' }],
    inRecords:   [{ localId:'ir_0', product2Id:'', pbeId:'', unitPrice:'0', quantity:'1', startDate:'' }],
    assetCounter: 1,
    recordCounter: 1
  });
  _renderSwapGroups(tabId);
}

function swapRemoveGroup(tabId, gLocalId){
  const s = swapState[tabId];
  s.groups = s.groups.filter(g => g.localId !== gLocalId);
  _renderSwapGroups(tabId);
}

function swapAddAsset(tabId, gLocalId){
  const g = swapState[tabId].groups.find(x => x.localId === gLocalId);
  if(!g) return;
  g.outAssets.push({ localId:'oa_'+(g.assetCounter++), assetId:'', quantity:'1' });
  _renderSwapGroups(tabId);
}

function swapRemoveAsset(tabId, gLocalId, aLocalId){
  const g = swapState[tabId].groups.find(x => x.localId === gLocalId);
  if(!g || g.outAssets.length <= 1) return;
  g.outAssets = g.outAssets.filter(a => a.localId !== aLocalId);
  _renderSwapGroups(tabId);
}

function swapAddRecord(tabId, gLocalId){
  const g = swapState[tabId].groups.find(x => x.localId === gLocalId);
  if(!g) return;
  g.inRecords.push({ localId:'ir_'+(g.recordCounter++), product2Id:'', pbeId:'', unitPrice:'0', quantity:'1', startDate:'' });
  _renderSwapGroups(tabId);
}

function swapRemoveRecord(tabId, gLocalId, rLocalId){
  const g = swapState[tabId].groups.find(x => x.localId === gLocalId);
  if(!g || g.inRecords.length <= 1) return;
  g.inRecords = g.inRecords.filter(r => r.localId !== rLocalId);
  _renderSwapGroups(tabId);
}

function _renderSwapGroups(tabId){
  const s = swapState[tabId];
  const container = document.getElementById('swap-groups-'+tabId);
  if(!container) return;
  if(!s.groups.length){
    container.innerHTML = '<div style="color:var(--fg3);font-size:11px;text-align:center;padding:16px 0">No groups yet — click "+ Add Group"</div>';
    return;
  }
  container.innerHTML = s.groups.map((g, idx) => {
    // Use single-quoted literals — tabId and localIds are safe (alphanumeric + - _)
    const tid = tabId;
    const gid = g.localId;

    const assetRows = g.outAssets.map((a) => {
      const aid = a.localId;
      const canRemove = g.outAssets.length > 1;
      return '<div style="display:flex;gap:6px;align-items:flex-end;margin-bottom:5px">'+
        '<label style="font-size:10px;color:var(--fg2);flex:2">Asset ID *<br>'+
        '<input class="try-inp" placeholder="02i..." style="width:100%;font-family:monospace;font-size:11px;padding:2px 5px" value="'+esc(a.assetId)+'" '+
        'oninput="swapState[\''+tid+'\'].groups.find(x=>x.localId===\''+gid+'\').outAssets.find(x=>x.localId===\''+aid+'\').assetId=this.value"></label>'+
        '<label style="font-size:10px;color:var(--fg2);width:50px">Qty<br>'+
        '<input class="try-inp" type="number" placeholder="1" style="width:100%;font-size:11px;padding:2px 5px" value="'+esc(a.quantity)+'" '+
        'oninput="swapState[\''+tid+'\'].groups.find(x=>x.localId===\''+gid+'\').outAssets.find(x=>x.localId===\''+aid+'\').quantity=this.value"></label>'+
        (canRemove ? '<button class="btn" onclick="swapRemoveAsset(\''+tid+'\',\''+gid+'\',\''+aid+'\')" style="font-size:10px;padding:1px 6px;background:var(--bg3);color:#e74c3c;border:1px solid #e74c3c;height:24px;margin-bottom:1px">&#10005;</button>' : '<div style="width:28px"></div>')+
        '</div>';
    }).join('');

    const recordRows = g.inRecords.map((r, ri) => {
      const rid = r.localId;
      const canRemove = g.inRecords.length > 1;
      const autoRefId = 'line-G'+(idx+1)+'-R'+(ri+1);
      return '<div style="border:1px solid var(--border);border-radius:4px;padding:6px 8px;margin-bottom:6px">'+
        '<div style="display:flex;gap:6px;align-items:flex-end;flex-wrap:wrap;margin-bottom:4px">'+
        '<label style="font-size:10px;color:var(--fg2);flex:2;min-width:110px">Product2Id *<br>'+
        '<input class="try-inp" placeholder="01t..." style="width:100%;font-family:monospace;font-size:11px;padding:2px 5px" value="'+esc(r.product2Id)+'" '+
        'oninput="swapState[\''+tid+'\'].groups.find(x=>x.localId===\''+gid+'\').inRecords.find(x=>x.localId===\''+rid+'\').product2Id=this.value"></label>'+
        '<label style="font-size:10px;color:var(--fg2);flex:2;min-width:110px">PBE Id *<br>'+
        '<input class="try-inp" placeholder="01u..." style="width:100%;font-family:monospace;font-size:11px;padding:2px 5px" value="'+esc(r.pbeId)+'" '+
        'oninput="swapState[\''+tid+'\'].groups.find(x=>x.localId===\''+gid+'\').inRecords.find(x=>x.localId===\''+rid+'\').pbeId=this.value"></label>'+
        '<label style="font-size:10px;color:var(--fg2);width:60px">UnitPrice<br>'+
        '<input class="try-inp" type="number" placeholder="0" style="width:100%;font-size:11px;padding:2px 5px" value="'+esc(r.unitPrice)+'" '+
        'oninput="swapState[\''+tid+'\'].groups.find(x=>x.localId===\''+gid+'\').inRecords.find(x=>x.localId===\''+rid+'\').unitPrice=this.value"></label>'+
        '<label style="font-size:10px;color:var(--fg2);width:50px">Qty<br>'+
        '<input class="try-inp" type="number" placeholder="1" style="width:100%;font-size:11px;padding:2px 5px" value="'+esc(r.quantity||'1')+'" '+
        'oninput="swapState[\''+tid+'\'].groups.find(x=>x.localId===\''+gid+'\').inRecords.find(x=>x.localId===\''+rid+'\').quantity=this.value"></label>'+
        '<label style="font-size:10px;color:var(--fg2);width:90px">StartDate<br>'+
        '<input class="try-inp" placeholder="2026-06-14" style="width:100%;font-size:11px;padding:2px 5px" value="'+esc(r.startDate)+'" '+
        'oninput="swapState[\''+tid+'\'].groups.find(x=>x.localId===\''+gid+'\').inRecords.find(x=>x.localId===\''+rid+'\').startDate=this.value"></label>'+
        (canRemove ? '<button class="btn" onclick="swapRemoveRecord(\''+tid+'\',\''+gid+'\',\''+rid+'\')" style="font-size:10px;padding:1px 6px;background:var(--bg3);color:#e74c3c;border:1px solid #e74c3c;height:24px;margin-bottom:1px">&#10005;</button>' : '<div style="width:28px"></div>')+
        '</div>'+
        '<label style="font-size:10px;color:var(--fg3)">referenceId&nbsp;'+
        '<input class="try-inp" placeholder="'+autoRefId+'" style="width:160px;font-size:10px;padding:1px 5px;font-family:monospace" value="'+esc(r.refId||'')+'\" '+
        'oninput="swapState[\''+tid+'\'].groups.find(x=>x.localId===\''+gid+'\').inRecords.find(x=>x.localId===\''+rid+'\').refId=this.value"></label>'+
        '</div>';
    }).join('');

    const autoGroupRefId = 'SWAP-GROUP-'+(idx+1);
    const autoGraphId = 'graph-GROUP-'+(idx+1);

    return '<div style="border:1px solid var(--border);border-radius:6px;padding:10px 12px;margin-bottom:10px">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'+
      '<span style="font-size:11px;font-weight:600;color:var(--fg2)">Group #'+(idx+1)+'</span>'+
      '<button class="btn" onclick="swapRemoveGroup(\''+tid+'\',\''+gid+'\')" style="font-size:11px;padding:1px 8px;background:var(--bg3);color:#e74c3c;border:1px solid #e74c3c">&#10005; Remove Group</button>'+
      '</div>'+
      '<div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap">'+
      '<label style="font-size:10px;color:var(--fg3)">referenceId&nbsp;'+
      '<input class="try-inp" placeholder="'+autoGroupRefId+'" style="width:160px;font-size:10px;padding:1px 5px;font-family:monospace" value="'+esc(g.referenceId||'')+'\" '+
      'oninput="swapState[\''+tid+'\'].groups.find(x=>x.localId===\''+gid+'\').referenceId=this.value"></label>'+
      '<label style="font-size:10px;color:var(--fg3)">graphId&nbsp;'+
      '<input class="try-inp" placeholder="'+autoGraphId+'" style="width:160px;font-size:10px;padding:1px 5px;font-family:monospace" value="'+esc(g.graphId||'')+'\" '+
      'oninput="swapState[\''+tid+'\'].groups.find(x=>x.localId===\''+gid+'\').graphId=this.value"></label>'+
      '</div>'+

      '<div style="margin-bottom:10px">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">'+
      '<span style="font-size:10px;font-weight:600;color:#8e44ad;text-transform:uppercase;letter-spacing:.5px">OUT — Source Assets</span>'+
      '<button class="btn btn-sec" onclick="swapAddAsset(\''+tid+'\',\''+gid+'\')" style="font-size:10px;padding:1px 8px">+ Add Asset</button>'+
      '</div>'+
      assetRows+
      '</div>'+

      '<div style="border-top:1px dashed var(--border);padding-top:10px">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">'+
      '<span style="font-size:10px;font-weight:600;color:#27ae60;text-transform:uppercase;letter-spacing:.5px">IN — Replacement QLIs</span>'+
      '<button class="btn btn-sec" onclick="swapAddRecord(\''+tid+'\',\''+gid+'\')" style="font-size:10px;padding:1px 8px">+ Add Record</button>'+
      '</div>'+
      recordRows+
      '</div>'+
      '</div>';
  }).join('');
}

function _buildSwapPayload(tabId){
  const s = swapState[tabId];
  // datetime-local produces "YYYY-MM-DDTHH:MM" — pad to full ISO 8601 with seconds+Z
  let isoDate = s.swapStartDate || new Date().toISOString().slice(0,10)+'T00:00:00Z';
  if(isoDate && !isoDate.endsWith('Z') && !isoDate.includes('+')) isoDate += ':00Z';
  const fallbackDate = isoDate.split('T')[0];
  const groups = s.groups.map((g, gi) => ({
    referenceId: (g.referenceId||'').trim() || 'SWAP-GROUP-'+(gi+1),
    outGroup: {
      swapAssets: g.outAssets.map(a => ({ assetId: a.assetId.trim(), quantity: parseInt(a.quantity)||1 }))
    },
    inGroup: {
      graphId: (g.graphId||'').trim() || 'graph-GROUP-'+(gi+1),
      records: g.inRecords.map((r, ri) => ({
        referenceId: (r.refId||'').trim() || 'line-G'+(gi+1)+'-R'+(ri+1),
        record: {
          attributes: { type:'QuoteLineItem', method:'POST' },
          Product2Id:       r.product2Id.trim(),
          PricebookEntryId: r.pbeId.trim(),
          UnitPrice:        parseFloat(r.unitPrice)||0,
          Quantity:         String(parseInt(r.quantity)||1),
          StartDate:        r.startDate||fallbackDate
        }
      }))
    }
  }));
  return { swapStartDate: isoDate, outputRecordType: s.outputRecordType, swapGroups: { groups } };
}

function swapPreviewJson(tabId){
  const resp = document.getElementById('swap-resp-'+tabId);
  if(!resp) return;
  const payload = _getSwapPayload(tabId);
  if(payload === null){ resp.innerHTML = '<pre style="color:#e74c3c">Invalid JSON in raw mode — fix before previewing.</pre>'; return; }
  resp.innerHTML = '<pre>'+esc(JSON.stringify(payload,null,2))+'</pre>';
}

function executeSwap(tabId){
  const s = swapState[tabId];
  const orgAlias = document.getElementById('org-select').value;
  if(!orgAlias){ showToast('Select an org first.','error'); return; }

  if(s.mode === 'raw'){
    const rawTxt = document.getElementById('swap-raw-txt-'+tabId);
    const errEl = document.getElementById('swap-raw-err-'+tabId);
    if(!rawTxt) return;
    let parsed;
    try{ parsed = JSON.parse(rawTxt.value); } catch(e){ if(errEl){ errEl.textContent='Invalid JSON: '+e.message; errEl.style.display=''; } showToast('Fix JSON errors first.','error'); return; }
    if(errEl) errEl.style.display='none';
    const payload = parsed;
    const reqId = ++reqCounter;
    document.getElementById('swap-pill-'+tabId).innerHTML = '<span style="color:var(--fg3)">Executing…</span>';
    pendingReqs[reqId] = (res) => {
      let pill, html;
      try{
        const data = JSON.parse(res.body);
        if(data.success === true){
          pill = '<span style="color:#27ae60;font-weight:600">&#10003; Success — Quote: '+esc(data.salesTransactionId)+'</span>';
          setQuickVar('QUOTE_ID', data.salesTransactionId, null);
          html = '<pre>'+esc(JSON.stringify(data,null,2))+'</pre>';
        } else {
          const msg = (data.errors&&data.errors[0]) ? data.errors[0].message : JSON.stringify(data);
          pill = '<span style="color:#e74c3c;font-weight:600">&#10007; Failed</span>';
          html = '<pre style="color:#e74c3c">'+esc(msg)+'</pre>';
        }
      } catch(_){
        pill = '<span style="color:#e74c3c">Parse error (status '+res.status+')</span>';
        html = '<pre>'+esc(res.body)+'</pre>';
      }
      document.getElementById('swap-pill-'+tabId).innerHTML = pill;
      document.getElementById('swap-resp-'+tabId).innerHTML = html;
    };
    vscMsg({ type:'executeCustom', requestId:reqId, orgAlias,
      method:'POST',
      path:'/services/data/v67.0/revenue/transaction-management/assets/actions/swap',
      headers:{}, body: applyVars(JSON.stringify(payload)),
      apiVersion:'v67.0' });
    return;
  }

  if(!s.swapStartDate){ showToast('Enter a Swap Start Date.','error'); return; }
  if(!s.groups.length){ showToast('Add at least one swap group.','error'); return; }
  for(const g of s.groups){
    if(g.outAssets.some(a => !a.assetId.trim())){ showToast('All source assets need an Asset ID.','error'); return; }
    if(g.inRecords.some(r => !r.product2Id.trim()||!r.pbeId.trim())){ showToast('All replacement records need Product2Id and PBE Id.','error'); return; }
  }

  const payload = _buildSwapPayload(tabId);
  const reqId = ++reqCounter;
  document.getElementById('swap-pill-'+tabId).innerHTML = '<span style="color:var(--fg3)">Executing…</span>';
  pendingReqs[reqId] = (res) => {
    let pill, html;
    try{
      const data = JSON.parse(res.body);
      if(data.success === true){
        pill = '<span style="color:#27ae60;font-weight:600">&#10003; Success — Quote: '+esc(data.salesTransactionId)+'</span>';
        setQuickVar('QUOTE_ID', data.salesTransactionId, null);
        html = '<pre>'+esc(JSON.stringify(data,null,2))+'</pre>';
      } else {
        const msg = (data.errors&&data.errors[0]) ? data.errors[0].message : JSON.stringify(data);
        pill = '<span style="color:#e74c3c;font-weight:600">&#10007; Failed</span>';
        html = '<pre style="color:#e74c3c">'+esc(msg)+'</pre>';
      }
    } catch(_){
      pill = '<span style="color:#e74c3c">Parse error (status '+res.status+')</span>';
      html = '<pre>'+esc(res.body)+'</pre>';
    }
    document.getElementById('swap-pill-'+tabId).innerHTML = pill;
    document.getElementById('swap-resp-'+tabId).innerHTML = html;
  };
  vscMsg({ type:'executeCustom', requestId:reqId, orgAlias,
    method:'POST',
    path:'/services/data/v67.0/revenue/transaction-management/assets/actions/swap',
    headers:{}, body: applyVars(JSON.stringify(payload)),
    apiVersion:'v67.0' });
}

function copySwapAs(tabId, format){
  const s = swapState[tabId];
  const payload = _getSwapPayload(tabId);
  if(payload === null){ showToast('Fix JSON errors first.','error'); return; }
  const bodyJson = JSON.stringify(payload, null, 2);

  if(format === 'curl'){
    const orgAlias = document.getElementById('org-select').value;
    const orgEl = document.getElementById('org-select');
    const orgText = orgEl ? orgEl.options[orgEl.selectedIndex]?.text || orgAlias : orgAlias;
    const text = [
      '# Swap API — cURL',
      '# Get session: sf org display --target-org '+orgAlias+' --verbose',
      'SESSION_ID="<your-session-id>"',
      'ORG_DOMAIN="<your-org-domain>.my.salesforce.com"',
      '',
      'curl -s -X POST \\',
      '  "https://${ORG_DOMAIN}/services/data/v67.0/revenue/transaction-management/assets/actions/swap" \\',
      '  -H "Authorization: Bearer ${SESSION_ID}" \\',
      '  -H "Content-Type: application/json" \\',
      '  -d \''+JSON.stringify(payload)+'\' | python3 -m json.tool',
    ].join('\n');
    navigator.clipboard.writeText(text).then(()=>_copyToast('cURL copied'));
    return;
  }

  if(format === 'js'){
    const text = [
      '// Swap API — JavaScript (Node.js / browser fetch)',
      'const SF_SESSION_ID = process.env.SF_SESSION_ID;',
      'const ORG_DOMAIN    = \'<your-org>.my.salesforce.com\';',
      '',
      'const payload = '+bodyJson+';',
      '',
      'const res = await fetch(',
      '  `https://${ORG_DOMAIN}/services/data/v67.0/revenue/transaction-management/assets/actions/swap`,',
      '  {',
      '    method:  \'POST\',',
      '    headers: { Authorization: `Bearer ${SF_SESSION_ID}`, \'Content-Type\': \'application/json\' },',
      '    body: JSON.stringify(payload),',
      '  }',
      ');',
      'const data = await res.json();',
      'if (data.success !== true) {',
      '  const msg = data.errors?.[0]?.message ?? JSON.stringify(data);',
      '  throw new Error(\'Swap failed: \' + msg);',
      '}',
      'console.log(\'Swap quote created:\', data.salesTransactionId);',
    ].join('\n');
    navigator.clipboard.writeText(text).then(()=>_copyToast('JS copied'));
    return;
  }

  // Apex
  const startIso  = s.swapStartDate || 'Date.today().addDays(1)+\'T00:00:00Z\'';
  const fallbackDate = s.swapStartDate ? s.swapStartDate.split('T')[0] : 'String.valueOf(Date.today().addDays(1))';
  const groupLines = s.groups.map((g, gi) => {
    const assetLines = g.outAssets.map(a =>
      '        new Map<String,Object>{\'assetId\' => \''+a.assetId+'\', \'quantity\' => '+(parseInt(a.quantity)||1)+'}'
    ).join(',\n');
    const recordLines = g.inRecords.map((r, ri) =>
      '        new Map<String,Object>{\n'+
      '            \'referenceId\' => \'line-G'+(gi+1)+'-R'+(ri+1)+'\',\n'+
      '            \'record\' => new Map<String,Object>{\n'+
      '                \'attributes\' => new Map<String,Object>{\'type\' => \'QuoteLineItem\', \'method\' => \'POST\'},\n'+
      '                \'Product2Id\' => \''+r.product2Id+'\',\n'+
      '                \'PricebookEntryId\' => \''+r.pbeId+'\',\n'+
      '                \'UnitPrice\' => '+(parseFloat(r.unitPrice)||0)+',\n'+
      '                \'Quantity\' => \'1\',\n'+
      '                \'StartDate\' => \''+(r.startDate||fallbackDate)+'\'}}'
    ).join(',\n');
    return 'groups.add(new Map<String,Object>{\n'+
      '    \'referenceId\' => \'SWAP-GROUP-'+(gi+1)+'\',\n'+
      '    \'outGroup\' => new Map<String,Object>{\'swapAssets\' => new List<Object>{\n'+
      assetLines+'}},\n'+
      '    \'inGroup\' => new Map<String,Object>{\n'+
      '        \'graphId\' => \'graph-GROUP-'+(gi+1)+'\',\n'+
      '        \'records\' => new List<Object>{\n'+
      recordLines+'\n    }}}\n});';
  });
  const apex = [
    'List<Object> groups = new List<Object>();',
    ...groupLines,
    'Map<String,Object> body = new Map<String,Object>{',
    '    \'swapStartDate\'    => \''+startIso+'\',',
    '    \'outputRecordType\' => \''+s.outputRecordType+'\',',
    '    \'swapGroups\'       => new Map<String,Object>{ \'groups\' => groups }',
    '};',
    'HttpRequest hr = new HttpRequest();',
    'hr.setEndpoint(URL.getOrgDomainUrl().toExternalForm()+\'/services/data/v67.0/revenue/transaction-management/assets/actions/swap\');',
    'hr.setMethod(\'POST\');',
    'hr.setHeader(\'Authorization\', \'Bearer \'+UserInfo.getSessionId());',
    'hr.setHeader(\'Content-Type\', \'application/json\');',
    'hr.setBody(JSON.serialize(body));',
    'hr.setTimeout(120000);',
    'HttpResponse res = new Http().send(hr);',
    'Map<String,Object> resp = (Map<String,Object>)JSON.deserializeUntyped(res.getBody());',
    'Boolean ok = (Boolean)resp.get(\'success\');',
    'if(ok == true){',
    '    String quoteId = (String)resp.get(\'salesTransactionId\');',
    '    System.debug(\'Swap quote: \'+quoteId);',
    '} else {',
    '    List<Object> errs = (List<Object>)resp.get(\'errors\');',
    '    String msg = (errs != null && !errs.isEmpty()) ? (String)((Map<String,Object>)errs[0]).get(\'message\') : \'Swap failed\';',
    '    throw new CalloutException(msg);',
    '}',
  ].join('\n');
  navigator.clipboard.writeText(apex).then(()=>_copyToast('Apex copied'));
}

function _getSwapPayload(tabId){
  const s = swapState[tabId];
  if(s.mode === 'raw'){
    const rawTxt = document.getElementById('swap-raw-txt-'+tabId);
    if(!rawTxt) return null;
    try{ return JSON.parse(rawTxt.value); } catch(_){ return null; }
  }
  return _buildSwapPayload(tabId);
}

const _SWAP_RAW_EXAMPLE = JSON.stringify({
  swapStartDate: '2026-06-14T00:00:00Z',
  outputRecordType: 'Quote',
  swapGroups: {
    groups: [{
      referenceId: 'SWAP-<assetId>',
      outGroup: { swapAssets: [{ assetId: '<assetId>', quantity: 1 }] },
      inGroup: {
        graphId: 'graph-<assetId>',
        records: [{
          referenceId: 'line-<assetId>',
          record: {
            attributes: { type: 'QuoteLineItem', method: 'POST' },
            Product2Id: '<replacementProductId>',
            PricebookEntryId: '<pbeId>',
            UnitPrice: 0,
            Quantity: '1',
            StartDate: '2026-06-14'
          }
        }]
      }
    }]
  }
}, null, 2);

function swapToggleMode(tabId, mode){
  const s = swapState[tabId];
  if(!s) return;

  const formEl = document.getElementById('swap-groups-'+tabId)?.closest('.try-sec');
  const settingsEl = document.getElementById('swap-start-'+tabId)?.closest('.try-sec');
  const rawEl = document.getElementById('swap-raw-'+tabId);
  const rawTxt = document.getElementById('swap-raw-txt-'+tabId);
  const rawErr = document.getElementById('swap-raw-err-'+tabId);
  const btnForm = document.getElementById('swap-mode-form-'+tabId);
  const btnRaw  = document.getElementById('swap-mode-raw-'+tabId);

  if(mode === 'raw'){
    // Sync form → raw
    const current = JSON.stringify(_buildSwapPayload(tabId), null, 2);
    const startVal = current === JSON.stringify(_buildSwapPayload(tabId), null, 2) ? current : _SWAP_RAW_EXAMPLE;
    const textVal = s.rawJson || (s.groups.length ? JSON.stringify(_buildSwapPayload(tabId), null, 2) : _SWAP_RAW_EXAMPLE);
    if(rawTxt){ rawTxt.value = textVal; s.rawJson = textVal; }
    if(rawErr) rawErr.style.display = 'none';
    // hide form sections, show raw
    const allSections = document.getElementById('swap-inner-builder-'+tabId)?.querySelectorAll('.try-sec');
    if(allSections) allSections.forEach(el => el.style.display = 'none');
    if(rawEl) rawEl.style.display = '';
    if(btnForm){ btnForm.style.background='var(--bg3)'; btnForm.style.color='var(--fg2)'; }
    if(btnRaw){ btnRaw.style.background='#8e44ad'; btnRaw.style.color='#fff'; }
    s.mode = 'raw';
  } else {
    // Sync raw → form (if valid)
    if(s.rawJson){
      try{
        const parsed = JSON.parse(rawTxt ? rawTxt.value : s.rawJson);
        _applySwapPayloadToState(tabId, parsed);
      } catch(e){
        if(rawErr){ rawErr.textContent='Cannot switch to form: '+e.message; rawErr.style.display=''; }
        return;
      }
    }
    // show form sections, hide raw
    const allSections = document.getElementById('swap-inner-builder-'+tabId)?.querySelectorAll('.try-sec');
    if(allSections) allSections.forEach(el => el.style.display = '');
    if(rawEl) rawEl.style.display = 'none';
    if(btnForm){ btnForm.style.background='#8e44ad'; btnForm.style.color='#fff'; }
    if(btnRaw){ btnRaw.style.background='var(--bg3)'; btnRaw.style.color='var(--fg2)'; }
    s.mode = 'form';
    // Re-render groups to reflect any parsed state
    _renderSwapGroups(tabId);
    // Restore settings inputs
    const startEl = document.getElementById('swap-start-'+tabId);
    const outEl = document.getElementById('swap-output-'+tabId);
    if(startEl) startEl.value = s.swapStartDate || '';
    if(outEl) outEl.value = s.outputRecordType || 'Quote';
  }
}

function _applySwapPayloadToState(tabId, parsed){
  const s = swapState[tabId];
  if(!s) return;
  // Parse top-level fields
  if(parsed.swapStartDate){
    // datetime-local wants YYYY-MM-DDTHH:MM
    s.swapStartDate = parsed.swapStartDate.replace(/Z$|(\+\d{2}:\d{2})$/, '').slice(0,16);
  }
  if(parsed.outputRecordType) s.outputRecordType = parsed.outputRecordType;
  // Parse groups
  const rawGroups = parsed?.swapGroups?.groups || [];
  s.groups = rawGroups.map((rg, gi) => {
    const rawAssets = rg?.outGroup?.swapAssets || [];
    const rawRecords = rg?.inGroup?.records || [];
    return {
      localId: 'sg_'+gi,
      referenceId: rg.referenceId||'',
      graphId: rg?.inGroup?.graphId||'',
      outAssets: rawAssets.map((a, ai) => ({ localId:'oa_'+ai, assetId: a.assetId||'', quantity: String(a.quantity||1) })),
      inRecords: rawRecords.map((r, ri) => {
        const rec = r.record || {};
        return {
          localId: 'ir_'+ri,
          refId: r.referenceId||'',
          product2Id: rec.Product2Id||'',
          pbeId: rec.PricebookEntryId||'',
          unitPrice: String(rec.UnitPrice??0),
          quantity: String(rec.Quantity||'1'),
          startDate: rec.StartDate||''
        };
      }),
      assetCounter: rawAssets.length,
      recordCounter: rawRecords.length
    };
  });
  s.groupCounter = rawGroups.length;
}

function _buildSwapReference(){
  return '<div style="font-size:12px;line-height:1.6">'+

  '<details open><summary style="font-weight:600;cursor:pointer;padding:6px 0;font-size:12px">What is Swap?</summary>'+
  '<div style="padding:8px 0 4px;color:var(--fg2)">'+
  'Swap replaces one or more RCA-managed assets with different products while preserving subscription history. It is the only RC action implemented as a <b>direct REST callout</b> (not an invocable action). '+
  'The output Quote/Order contains:<br>'+
  '&bull; <b>Negative QLIs</b> (swap-out journal) — carry exact PricebookEntryId + BillingFrequency from source assets<br>'+
  '&bull; <b>Positive QLIs</b> — the replacement lines; may have wrong default bundle components (see Bundle Restructuring)<br>'+
  '<span style="color:#e67e22;font-weight:600">&#9888; ValidationResult = TransactionIncomplete</span> is set on the raw output quote. Cleared to <code>null</code> only by PST restructure — DML-only restructure does NOT clear it.'+
  '</div></details>'+

  '<details><summary style="font-weight:600;cursor:pointer;padding:6px 0;font-size:12px">Endpoint</summary>'+
  '<div style="padding:8px 0 4px">'+
  '<code style="background:var(--bg3);padding:4px 8px;border-radius:4px;font-size:11px">POST /services/data/v67.0/revenue/transaction-management/assets/actions/swap</code>'+
  '<br><br><b>Different from PST</b> — this is a pure RC Transaction Management REST endpoint, not <code>AsyncOperationTracker</code>.'+
  '</div></details>'+

  '<details><summary style="font-weight:600;cursor:pointer;padding:6px 0;font-size:12px">Request Fields</summary>'+
  '<div style="padding:4px 0">'+
  '<table style="width:100%;border-collapse:collapse;font-size:11px">'+
  '<thead><tr style="background:var(--bg3)"><th style="padding:5px 8px;text-align:left">Field</th><th style="padding:5px 8px;text-align:left">Required</th><th style="padding:5px 8px;text-align:left">Description</th></tr></thead>'+
  '<tbody>'+
  '<tr><td style="padding:4px 8px;font-family:monospace">swapStartDate</td><td style="padding:4px 8px"><span style="color:#c0392b;font-size:10px">Required</span></td><td style="padding:4px 8px;color:var(--fg2)">ISO 8601 datetime e.g. <code>"2026-06-14T00:00:00Z"</code></td></tr>'+
  '<tr style="background:var(--bg3)"><td style="padding:4px 8px;font-family:monospace">outputRecordType</td><td style="padding:4px 8px"><span style="color:#c0392b;font-size:10px">Required</span></td><td style="padding:4px 8px;color:var(--fg2)"><code>"Quote"</code> or <code>"Order"</code></td></tr>'+
  '<tr><td style="padding:4px 8px;font-family:monospace">groups[].referenceId</td><td style="padding:4px 8px"><span style="color:#c0392b;font-size:10px">Required</span></td><td style="padding:4px 8px;color:var(--fg2)">Unique string per group — used for error correlation. Convention: <code>SWAP-&lt;assetId&gt;</code></td></tr>'+
  '<tr style="background:var(--bg3)"><td style="padding:4px 8px;font-family:monospace">outGroup.swapAssets[].assetId</td><td style="padding:4px 8px"><span style="color:#c0392b;font-size:10px">Required</span></td><td style="padding:4px 8px;color:var(--fg2)">18-char Asset ID being swapped out</td></tr>'+
  '<tr><td style="padding:4px 8px;font-family:monospace">inGroup.graphId</td><td style="padding:4px 8px"><span style="color:#c0392b;font-size:10px">Required</span></td><td style="padding:4px 8px;color:var(--fg2)">Unique string — PST-style graph ID. Convention: <code>graph-&lt;assetId&gt;</code></td></tr>'+
  '<tr style="background:var(--bg3)"><td style="padding:4px 8px;font-family:monospace">record.Product2Id</td><td style="padding:4px 8px"><span style="color:#c0392b;font-size:10px">Required</span></td><td style="padding:4px 8px;color:var(--fg2)">Replacement product ID</td></tr>'+
  '<tr><td style="padding:4px 8px;font-family:monospace">record.PricebookEntryId</td><td style="padding:4px 8px"><span style="color:#c0392b;font-size:10px">Required</span></td><td style="padding:4px 8px;color:var(--fg2)">PBE for replacement product — must match source asset currency</td></tr>'+
  '<tr style="background:var(--bg3)"><td style="padding:4px 8px;font-family:monospace">record.UnitPrice</td><td style="padding:4px 8px"><span style="color:#c0392b;font-size:10px">Required</span></td><td style="padding:4px 8px;color:var(--fg2)">Price — use <code>0</code> for Skip pricing</td></tr>'+
  '<tr><td style="padding:4px 8px;font-family:monospace">record.StartDate</td><td style="padding:4px 8px"><span style="color:#27ae60;font-size:10px">Recommended</span></td><td style="padding:4px 8px;color:var(--fg2)">Date string (not ISO datetime): <code>"2026-06-14"</code></td></tr>'+
  '</tbody></table>'+
  '<div style="margin-top:6px;font-size:10px;color:var(--fg3)">&#9432; All assets in one call must belong to the same Account — the API produces one output Quote per call.</div>'+
  '</div></details>'+

  '<details><summary style="font-weight:600;cursor:pointer;padding:6px 0;font-size:12px">Response</summary>'+
  '<div style="padding:8px 0 4px;color:var(--fg2)">'+
  '<b>Success:</b> <code>{ "success": true, "salesTransactionId": "0Q0..." }</code><br>'+
  '<b>Failure:</b> <code>{ "success": false, "errors": [{ "message": "..." }] }</code><br><br>'+
  '<div style="background:#fff3cd;border-left:3px solid #e67e22;padding:6px 8px;border-radius:0 4px 4px 0;margin-top:6px;font-size:11px">'+
  '<b>GOTCHA:</b> Wrong Product2Id or PBE → API returns an unexpected error shape where <code>success</code> is <b>null</b>, not <code>false</code>. Always null-check: <code>data.success === true</code> (strict equality), not just <code>if(data.success)</code>.'+
  '</div>'+
  '</div></details>'+

  '<details><summary style="font-weight:600;cursor:pointer;padding:6px 0;font-size:12px">Asset Eligibility</summary>'+
  '<div style="padding:8px 0 4px;color:var(--fg2)">'+
  'An asset must pass all three checks:<br>'+
  '1. <code>HasLifecycleManagement = true</code> — must be RCA-managed<br>'+
  '2. <code>AssetStatePeriod</code> exists — <code>Id IN (SELECT AssetId FROM AssetStatePeriod)</code><br>'+
  '3. Active subscription state (Status = Installed)<br><br>'+
  '<b>SOQL to find eligible assets:</b>'+
  '<pre style="background:var(--bg3);padding:8px;border-radius:4px;font-size:10px;overflow-x:auto">SELECT Id, Name, Product2.Name, AccountId, CurrencyIsoCode, Status\nFROM Asset\nWHERE AccountId = \'001XXX\'\n  AND Status = \'Installed\'\n  AND HasLifecycleManagement = true\n  AND Id IN (SELECT AssetId FROM AssetStatePeriod)</pre>'+
  '</div></details>'+

  '<details><summary style="font-weight:600;cursor:pointer;padding:6px 0;font-size:12px">Bundle Restructuring</summary>'+
  '<div style="padding:8px 0 4px;color:var(--fg2)">'+
  '<b>Why it\'s needed:</b> Swap API auto-adds default bundle components based on the product catalog — not the source asset\'s actual configuration. A customer running ECO Offer + Webfleet Video + LINK 740 may get LINK 245 on the swap output.<br><br>'+
  '<b>BFS Algorithm:</b><br>'+
  '1. Query all QLIs on output quote (pos + neg) with PBE, BillingFrequency, ParentQuoteLineItemId<br>'+
  '2. Pair roots via <code>ReplacementGroupId</code> → (negRoot, posRoot) per swap group<br>'+
  '3. For each pair: compare neg children (authoritative) vs pos children (API defaults)<br>'+
  '&nbsp;&nbsp;&nbsp;• pos child in neg → KEEP; add QLR if missing<br>'+
  '&nbsp;&nbsp;&nbsp;• pos child not in neg → DELETE (wrong API default)<br>'+
  '&nbsp;&nbsp;&nbsp;• neg child not in pos → INSERT, copying PBE + BillingFrequency from neg child<br>'+
  '4. Recurse into children (handles grandchildren)<br>'+
  '5. DML: delete QLRs first, then QLIs; insert new QLIs + QLRs<br>'+
  '6. Use PST (not raw DML) to clear ValidationResult to null<br><br>'+
  '<div style="background:#fff3cd;border-left:3px solid #e67e22;padding:6px 8px;border-radius:0 4px 4px 0;font-size:11px">'+
  '<b>QLR delete ordering:</b> Always delete <code>QuoteLineRelationship</code> records before deleting QLIs. PST/DML silently skips QLI deletes if a QLR still references the QLI.'+
  '</div>'+
  '</div></details>'+

  '<details><summary style="font-weight:600;cursor:pointer;padding:6px 0;font-size:12px">Common Errors</summary>'+
  '<div style="padding:4px 0">'+
  '<table style="width:100%;border-collapse:collapse;font-size:11px">'+
  '<thead><tr style="background:var(--bg3)"><th style="padding:5px 8px;text-align:left">Error</th><th style="padding:5px 8px;text-align:left">Cause</th><th style="padding:5px 8px;text-align:left">Fix</th></tr></thead>'+
  '<tbody>'+
  '<tr><td style="padding:4px 8px;font-family:monospace;color:#c0392b">success == null</td><td style="padding:4px 8px;color:var(--fg2)">Wrong Product2Id or PBE</td><td style="padding:4px 8px;color:var(--fg2)">Verify IDs are 18-char, active, correct</td></tr>'+
  '<tr style="background:var(--bg3)"><td style="padding:4px 8px;font-family:monospace;color:#c0392b">Read timed out</td><td style="padding:4px 8px;color:var(--fg2)">HTTP default timeout 10s; swap takes 30–60s</td><td style="padding:4px 8px;color:var(--fg2)"><code>hr.setTimeout(120000)</code></td></tr>'+
  '<tr><td style="padding:4px 8px;font-family:monospace;color:#c0392b">Uncommitted work pending</td><td style="padding:4px 8px;color:var(--fg2)">DML ran before callout</td><td style="padding:4px 8px;color:var(--fg2)">Move all DML after <code>invokeSwap()</code></td></tr>'+
  '<tr style="background:var(--bg3)"><td style="padding:4px 8px;font-family:monospace;color:#c0392b">Asset not RCA-managed</td><td style="padding:4px 8px;color:var(--fg2)">No AssetStatePeriod record</td><td style="padding:4px 8px;color:var(--fg2)">Filter with <code>Id IN (SELECT AssetId FROM AssetStatePeriod)</code></td></tr>'+
  '<tr><td style="padding:4px 8px;font-family:monospace;color:#c0392b">ValidationResult = TransactionIncomplete</td><td style="padding:4px 8px;color:var(--fg2)">Set by swap API on raw output</td><td style="padding:4px 8px;color:var(--fg2)">Run PST restructure — DML-only does NOT clear it</td></tr>'+
  '<tr style="background:var(--bg3)"><td style="padding:4px 8px;font-family:monospace;color:#c0392b">Wrong bundle components</td><td style="padding:4px 8px;color:var(--fg2)">Swap adds catalog defaults, not source config</td><td style="padding:4px 8px;color:var(--fg2)">Enable Restructure_Bundle__c — BFS restructure corrects hierarchy</td></tr>'+
  '</tbody></table>'+
  '</div></details>'+

  '<details><summary style="font-weight:600;cursor:pointer;padding:6px 0;font-size:12px">SOQL Reference</summary>'+
  '<div style="padding:8px 0 4px">'+
  '<b>Find PBE for replacement product (match asset currency):</b>'+
  '<pre style="background:var(--bg3);padding:8px;border-radius:4px;font-size:10px;overflow-x:auto">SELECT Id, Product2.Name, CurrencyIsoCode, UnitPrice\nFROM PricebookEntry\nWHERE Product2Id = \'01tXXX\'\n  AND Pricebook2Id = \'01sXXX\'\n  AND CurrencyIsoCode = \'EUR\'\n  AND IsActive = true</pre>'+
  '<b>After swap — inspect output quote QLIs:</b>'+
  '<pre style="background:var(--bg3);padding:8px;border-radius:4px;font-size:10px;overflow-x:auto">SELECT Id, Product2.Name, Quantity, ReplacementGroupId,\n       ParentQuoteLineItemId, PricebookEntryId, BillingFrequency\nFROM QuoteLineItem\nWHERE QuoteId = \'0Q0XXX\'\nORDER BY Quantity DESC</pre>'+
  '<b>Check bundle hierarchy on output quote:</b>'+
  '<pre style="background:var(--bg3);padding:8px;border-radius:4px;font-size:10px;overflow-x:auto">SELECT MainQuoteLineId, AssociatedQuoteLineId\nFROM QuoteLineRelationship\nWHERE MainQuoteLineId IN (\n  SELECT Id FROM QuoteLineItem WHERE QuoteId = \'0Q0XXX\' AND Quantity > 0\n)</pre>'+
  '</div></details>'+

  '</div>';
}

// ── Order Builder ─────────────────────────────────────────────────────────────

let orderState = {};  // keyed by tabId

function openOrderBuilderTab(){
  const existing = tabs.find(t => t.type === 'order-builder');
  if(existing){ activateTab(existing.id); return; }
  const tabId = 'tab-' + (++tabCounter);
  tabs.push({ id: tabId, type: 'order-builder', label: 'Order Builder' });
  orderState[tabId] = {
    mode: 'new',           // 'new' | 'patch'
    orderId: '',
    accountId: '',
    effectiveDate: '',
    pricebook2Id: '',
    orderName: 'New Order',
    contractId: '',
    currencyIsoCode: '',
    billToContactId: '',
    billingStreet: '', billingCity: '', billingPostalCode: '', billingCountry: '',
    shippingStreet: '', shippingCity: '', shippingPostalCode: '', shippingCountry: '',
    billingExpanded: false,
    pricingPref: 'Force',
    taxPref: 'Skip',
    configInput: 'RunAndAllowErrors',
    configOptions: { validateProductCatalog:true, validateAmendRenewCancel:true, executeConfigurationRules:true, addDefaultConfiguration:true },
    includeAppUsage: false,
    items: [],
    itemCounter: 0,
    previewActive: false,
    orgAlias: ''
  };
  renderTabBar();
  const panel = document.createElement('div');
  panel.id = 'tp-' + tabId;
  panel.className = 'tab-panel';
  document.getElementById('detail').appendChild(panel);
  _buildOrderPanel(panel, tabId);
  activateTab(tabId);
}

function _buildOrderPanel(panel, tabId){
  panel.innerHTML =
    '<div class="d-title">&#128220; Order Builder</div>'+
    '<div style="color:var(--fg3);font-size:11px;margin-bottom:14px">Builds payloads for <code>POST /connect/rev/sales-transaction/actions/place</code>. Includes Order anchor, OrderAction, OrderItems, attributes, and bundle relationships.</div>'+

    // ── Mode toggle ────────────────────────────────────────────────────────────
    '<div class="try-sec" style="margin-bottom:10px">'+
    '<div class="try-lbl">Order</div>'+
    '<div style="display:flex;gap:12px;margin-bottom:8px">'+
    '<label style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--fg2);cursor:pointer">'+
    '<input type="radio" name="ob-mode-'+tabId+'" value="new" checked onchange="orderBuilderSetMode(\''+tabId+'\',\'new\')"> Create new order</label>'+
    '<label style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--fg2);cursor:pointer">'+
    '<input type="radio" name="ob-mode-'+tabId+'" value="patch" onchange="orderBuilderSetMode(\''+tabId+'\',\'patch\')"> Patch existing order</label>'+
    '</div>'+

    // New order fields
    '<div id="ob-new-fields-'+tabId+'">'+
    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">'+
    '<label style="font-size:10px;color:var(--fg2)">Name *<br><input class="try-inp" id="ob-name-'+tabId+'" value="New Order" style="width:180px;font-size:11px;padding:2px 5px" oninput="orderState[\''+tabId+'\'].orderName=this.value"></label>'+
    '<label style="font-size:10px;color:var(--fg2)">AccountId *<br><input class="try-inp" id="ob-acc-'+tabId+'" placeholder="001..." style="width:160px;font-size:11px;font-family:monospace;padding:2px 5px" oninput="orderState[\''+tabId+'\'].accountId=this.value"></label>'+
    '<label style="font-size:10px;color:var(--fg2)">Pricebook2Id *<br><input class="try-inp" id="ob-pb-'+tabId+'" placeholder="01s..." style="width:160px;font-size:11px;font-family:monospace;padding:2px 5px" oninput="orderState[\''+tabId+'\'].pricebook2Id=this.value"></label>'+
    '<label style="font-size:10px;color:var(--fg2)">EffectiveDate *<br><input class="try-inp" id="ob-date-'+tabId+'" type="datetime-local" style="width:175px;font-size:11px;padding:2px 5px" oninput="orderState[\''+tabId+'\'].effectiveDate=this.value"></label>'+
    '<label style="font-size:10px;color:var(--fg2)">CurrencyIsoCode<br><input class="try-inp" placeholder="USD / GBP / EUR…" style="width:100px;font-size:11px;padding:2px 5px" oninput="orderState[\''+tabId+'\'].currencyIsoCode=this.value.toUpperCase()"></label>'+
    '</div>'+

    // Billing & Shipping collapsible
    '<div style="margin-bottom:4px">'+
    '<button class="btn btn-sec" id="ob-billing-toggle-'+tabId+'" style="font-size:10px;padding:2px 8px" onclick="obToggleBilling(\''+tabId+'\')">&#9654; Billing &amp; Shipping (optional)</button>'+
    '</div>'+
    '<div id="ob-billing-fields-'+tabId+'" style="display:none">'+
    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px">'+
    '<label style="font-size:10px;color:var(--fg2)">ContractId<br><input class="try-inp" placeholder="800..." style="width:170px;font-size:10px;font-family:monospace;padding:2px 4px" oninput="orderState[\''+tabId+'\'].contractId=this.value"></label>'+
    '<label style="font-size:10px;color:var(--fg2)">BillToContactId<br><input class="try-inp" placeholder="003..." style="width:170px;font-size:10px;font-family:monospace;padding:2px 4px" oninput="orderState[\''+tabId+'\'].billToContactId=this.value"></label>'+
    '</div>'+
    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px">'+
    '<label style="font-size:10px;color:var(--fg2)">BillingStreet<br><input class="try-inp" style="width:200px;font-size:10px;padding:2px 4px" oninput="orderState[\''+tabId+'\'].billingStreet=this.value"></label>'+
    '<label style="font-size:10px;color:var(--fg2)">BillingCity<br><input class="try-inp" style="width:120px;font-size:10px;padding:2px 4px" oninput="orderState[\''+tabId+'\'].billingCity=this.value"></label>'+
    '<label style="font-size:10px;color:var(--fg2)">PostalCode<br><input class="try-inp" style="width:90px;font-size:10px;padding:2px 4px" oninput="orderState[\''+tabId+'\'].billingPostalCode=this.value"></label>'+
    '<label style="font-size:10px;color:var(--fg2)">Country<br><input class="try-inp" style="width:60px;font-size:10px;padding:2px 4px" oninput="orderState[\''+tabId+'\'].billingCountry=this.value"></label>'+
    '</div>'+
    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">'+
    '<label style="font-size:10px;color:var(--fg2)">ShippingStreet<br><input class="try-inp" style="width:200px;font-size:10px;padding:2px 4px" oninput="orderState[\''+tabId+'\'].shippingStreet=this.value"></label>'+
    '<label style="font-size:10px;color:var(--fg2)">ShippingCity<br><input class="try-inp" style="width:120px;font-size:10px;padding:2px 4px" oninput="orderState[\''+tabId+'\'].shippingCity=this.value"></label>'+
    '<label style="font-size:10px;color:var(--fg2)">PostalCode<br><input class="try-inp" style="width:90px;font-size:10px;padding:2px 4px" oninput="orderState[\''+tabId+'\'].shippingPostalCode=this.value"></label>'+
    '<label style="font-size:10px;color:var(--fg2)">Country<br><input class="try-inp" style="width:60px;font-size:10px;padding:2px 4px" oninput="orderState[\''+tabId+'\'].shippingCountry=this.value"></label>'+
    '</div>'+
    '</div>'+

    '</div>'+

    // Patch mode — just order ID
    '<div id="ob-patch-fields-'+tabId+'" style="display:none;margin-bottom:6px">'+
    '<label style="font-size:10px;color:var(--fg2)">Order Id *<br><input class="try-inp" id="ob-oid-'+tabId+'" placeholder="801..." style="width:220px;font-size:11px;font-family:monospace;padding:2px 5px" oninput="orderState[\''+tabId+'\'].orderId=this.value"></label>'+
    '</div>'+

    // Options row
    '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px">'+
    '<label style="font-size:11px;color:var(--fg2)">Pricing</label>'+
    '<select class="try-sel" onchange="orderState[\''+tabId+'\'].pricingPref=this.value">'+
    '<option value="Force" selected>Force</option><option value="System">System</option><option value="Skip">Skip</option>'+
    '</select>'+
    '<label style="font-size:11px;color:var(--fg2)">Tax</label>'+
    '<select class="try-sel" onchange="orderState[\''+tabId+'\'].taxPref=this.value">'+
    '<option value="Skip" selected>Skip</option>'+
    '</select>'+
    '<label style="font-size:11px;color:var(--fg2)">Config</label>'+
    '<select class="try-sel" onchange="orderState[\''+tabId+'\'].configInput=this.value">'+
    '<option value="RunAndAllowErrors" selected>RunAndAllowErrors</option>'+
    '<option value="RunAndBlockErrors">RunAndBlockErrors</option>'+
    '<option value="Skip">Skip</option>'+
    '</select>'+
    '<label style="font-size:11px;color:var(--fg2);display:flex;align-items:center;gap:4px;cursor:pointer" title="Only needed for Usage-Based / Revenue Lifecycle Management products">'+
    '<input type="checkbox" onchange="orderState[\''+tabId+'\'].includeAppUsage=this.checked"> AppUsageAssignment</label>'+
    '</div>'+
    '</div>'+

    // ── Order Items ────────────────────────────────────────────────────────────
    '<div class="try-sec">'+
    '<div class="try-lbl">Order Items</div>'+
    '<div id="ob-items-'+tabId+'" style="margin-bottom:8px"></div>'+
    '<button class="btn btn-sec" style="font-size:11px" onclick="obAddItem(\''+tabId+'\',\'\',\'\')">+ Add Order Item</button>'+
    '</div>'+

    // ── Actions ────────────────────────────────────────────────────────────────
    '<div class="btn-row" style="margin-bottom:10px">'+
    '<button class="btn btn-sec" onclick="obPreview(\''+tabId+'\')">&#128269; Preview Graph</button>'+
    '<button class="btn btn-pri" id="ob-exec-btn-'+tabId+'" onclick="executeOrder(\''+tabId+'\')">&#9654; Execute Order API</button>'+
    '<button class="btn btn-sec" onclick="obCopyApex(\''+tabId+'\')">Copy Apex</button>'+
    '<button class="btn btn-sec" style="font-size:10px;color:var(--acc)" onclick="obDiagnoseContext(\''+tabId+'\')" title="Query SalesTransactionContext records in the selected org">&#128270; Diagnose Org</button>'+
    '</div>'+
    '<div id="ob-pill-'+tabId+'" style="margin-bottom:8px"></div>'+
    '<div class="resp-box" id="ob-resp-'+tabId+'" style="color:var(--fg3);min-height:80px">Preview / response will appear here.</div>';

  // Set today's date as default
  const now = new Date();
  const todayDt = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0')+'T'+String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  const dateInput = document.getElementById('ob-date-'+tabId);
  if(dateInput){ dateInput.value = todayDt; orderState[tabId].effectiveDate = todayDt; }
  _obRenderItems(tabId);
}

function orderBuilderSetMode(tabId, mode){
  orderState[tabId].mode = mode;
  document.getElementById('ob-new-fields-'+tabId).style.display = mode==='new' ? '' : 'none';
  document.getElementById('ob-patch-fields-'+tabId).style.display = mode==='patch' ? '' : 'none';
}

function obToggleBilling(tabId){
  const s = orderState[tabId];
  s.billingExpanded = !s.billingExpanded;
  const fields = document.getElementById('ob-billing-fields-'+tabId);
  const btn = document.getElementById('ob-billing-toggle-'+tabId);
  if(fields) fields.style.display = s.billingExpanded ? '' : 'none';
  if(btn) btn.innerHTML = (s.billingExpanded ? '&#9660;' : '&#9654;') + ' Billing &amp; Shipping (optional)';
}

function obAddItem(tabId, parentRef, parentLabel){
  const s = orderState[tabId];
  const localRef = 'refItem_' + (s.itemCounter++);
  s.items.push({
    localRef,
    op: 'POST',
    product2Id: '',
    pbeId: '',
    qty: '1',
    unitPrice: '0',
    orderItemId: '',
    parentRef: parentRef || '',
    parentLabel: parentLabel || '',
    attrs: [],
    serviceDate: '',
    periodBoundary: 'Anniversary',
    billingFrequency: 'Monthly',
    description: '',
    prcRelCompId: '',
    prcRelTypeId: '',
    assocPricing: 'NotIncludedInBundlePrice',
    _collapsed: false
  });
  _obRenderItems(tabId);
}

function obRemoveItem(tabId, localRef){
  const s = orderState[tabId];
  s.items = s.items.filter(i => i.localRef !== localRef && i.parentRef !== localRef);
  _obRenderItems(tabId);
}

function obAddAttr(tabId, localRef){
  const s = orderState[tabId];
  const item = s.items.find(i => i.localRef === localRef);
  if(!item) return;
  item.attrs.push({ attrDefId:'', usePicklist:false, picklistValueId:'', attrValue:'' });
  _obRenderItems(tabId);
}

function obRemoveAttr(tabId, localRef, ai){
  const s = orderState[tabId];
  const item = s.items.find(i => i.localRef === localRef);
  if(item) item.attrs.splice(ai,1);
  _obRenderItems(tabId);
}

function _obRenderItems(tabId){
  const s = orderState[tabId];
  const container = document.getElementById('ob-items-'+tabId);
  if(!container) return;

  function renderItem(item, depth){
    const indent = depth * 16;
    const isPost = item.op === 'POST';
    const isPatch = item.op === 'PATCH';
    const isDel = item.op === 'DELETE';
    const borderColor = isDel ? 'var(--red)' : isPatch ? 'var(--yellow)' : 'var(--green)';
    const opColors = { POST:'var(--green)', PATCH:'var(--yellow)', DELETE:'var(--red)' };

    let h = '<div style="margin-left:'+indent+'px;margin-bottom:8px;border:1px solid var(--border);border-left:3px solid '+borderColor+';border-radius:4px;overflow:hidden">';

    // Header row
    h += '<div style="display:flex;align-items:center;gap:6px;padding:4px 8px;background:rgba(0,0,0,.15)">';
    h += '<span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;background:'+opColors[item.op]+'20;color:'+opColors[item.op]+';border:1px solid '+opColors[item.op]+'">'+item.op+'</span>';
    h += '<span style="font-size:11px;color:var(--fg2);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(item.product2Id || item.orderItemId || item.localRef)+(item.parentRef?' <span style="font-size:9px;color:var(--fg3)">child of '+esc(item.parentLabel||item.parentRef)+'</span>':'')+'</span>';
    if(item.attrs.length) h += '<span style="font-size:9px;color:var(--fg3)">'+item.attrs.length+' attr'+(item.attrs.length>1?'s':'')+'</span>';
    h += '<button class="btn btn-sec" style="font-size:10px;padding:1px 6px" onclick="obAddItem(\''+tabId+'\',\''+item.localRef+'\',\''+esc(item.product2Id||item.localRef)+'\')" title="Add child item">+ Child</button>';
    h += '<button class="btn btn-sec" style="font-size:10px;padding:1px 6px" onclick="obAddAttr(\''+tabId+'\',\''+item.localRef+'\')" title="Add attribute">+ Attr</button>';
    if(isPost) h += '<button class="icon-btn" style="font-size:10px;color:#7eb5e8;border:1px solid rgba(126,181,232,.4);border-radius:3px;padding:1px 6px" onclick="obOpenConfigurator(\''+tabId+'\',\''+item.localRef+'\')" title="Load product structure from PCM API">⚙ Configure</button>';
    h += '<button class="icon-btn" style="color:var(--red);font-size:12px" onclick="obRemoveItem(\''+tabId+'\',\''+item.localRef+'\')">✕</button>';
    h += '</div>';

    // Fields row
    h += '<div style="display:flex;gap:6px;flex-wrap:wrap;padding:5px 8px;background:rgba(0,0,0,.08)">';
    h += '<select class="try-sel" style="font-size:10px" onchange="orderState[\''+tabId+'\'].items.find(i=>i.localRef===\''+item.localRef+'\').op=this.value;_obRenderItems(\''+tabId+'\')">';
    ['POST','PATCH','DELETE'].forEach(op => { h += '<option'+(item.op===op?' selected':'')+'>'+op+'</option>'; });
    h += '</select>';

    if(isPost || isPatch){
      if(isPatch || isDel){
        h += '<input class="try-inp" value="'+esc(item.orderItemId)+'" placeholder="OrderItem Id (802...)" style="font-size:10px;padding:2px 5px;width:180px;font-family:monospace" oninput="orderState[\''+tabId+'\'].items.find(i=>i.localRef===\''+item.localRef+'\').orderItemId=this.value">';
      }
      if(isPost){
        h += '<input class="try-inp" value="'+esc(item.product2Id)+'" placeholder="Product2Id (01t...)" style="font-size:10px;padding:2px 5px;width:165px;font-family:monospace" oninput="orderState[\''+tabId+'\'].items.find(i=>i.localRef===\''+item.localRef+'\').product2Id=this.value">';
        h += '<input class="try-inp" value="'+esc(item.pbeId)+'" placeholder="PricebookEntryId (01u...)" style="font-size:10px;padding:2px 5px;width:185px;font-family:monospace" oninput="orderState[\''+tabId+'\'].items.find(i=>i.localRef===\''+item.localRef+'\').pbeId=this.value">';
      }
      h += '<label style="font-size:10px;color:var(--fg2);display:flex;align-items:center;gap:3px">Qty <input class="try-inp" value="'+esc(item.qty)+'" style="font-size:10px;padding:2px 4px;width:50px" oninput="orderState[\''+tabId+'\'].items.find(i=>i.localRef===\''+item.localRef+'\').qty=this.value"></label>';
      if(isPost) h += '<label style="font-size:10px;color:var(--fg2);display:flex;align-items:center;gap:3px">UnitPrice <input class="try-inp" value="'+esc(item.unitPrice)+'" style="font-size:10px;padding:2px 4px;width:70px" oninput="orderState[\''+tabId+'\'].items.find(i=>i.localRef===\''+item.localRef+'\').unitPrice=this.value"></label>';
    }
    h += '</div>';

    // Extra POST fields row: ServiceDate, PeriodBoundary, BillingFrequency, Description
    if(isPost){
      h += '<div style="display:flex;gap:6px;flex-wrap:wrap;padding:4px 8px;border-top:1px solid rgba(255,255,255,.04);background:rgba(0,0,0,.06)">';
      h += '<label style="font-size:10px;color:var(--fg2)">ServiceDate<br><input class="try-inp" type="datetime-local" value="'+esc(item.serviceDate||'')+'" style="font-size:10px;padding:2px 4px;width:160px" oninput="orderState[\''+tabId+'\'].items.find(i=>i.localRef===\''+item.localRef+'\').serviceDate=this.value"></label>';
      h += '<label style="font-size:10px;color:var(--fg2)">PeriodBoundary<br><select class="try-sel" style="font-size:10px" onchange="orderState[\''+tabId+'\'].items.find(i=>i.localRef===\''+item.localRef+'\').periodBoundary=this.value"><option'+(item.periodBoundary==='Anniversary'?' selected':'')+'>Anniversary</option><option'+(item.periodBoundary==='AlignToCalendar'?' selected':'')+'>AlignToCalendar</option><option value=""'+((!item.periodBoundary)?' selected':'')+'>— none —</option></select></label>';
      h += '<label style="font-size:10px;color:var(--fg2)">BillingFrequency<br><select class="try-sel" style="font-size:10px" onchange="orderState[\''+tabId+'\'].items.find(i=>i.localRef===\''+item.localRef+'\').billingFrequency=this.value"><option'+(item.billingFrequency==='Monthly'?' selected':'')+'>Monthly</option><option'+(item.billingFrequency==='Quarterly'?' selected':'')+'>Quarterly</option><option'+(item.billingFrequency==='Annual'?' selected':'')+'>Annual</option><option'+(item.billingFrequency==='OneTime'?' selected':'')+'>OneTime</option><option value=""'+((!item.billingFrequency)?' selected':'')+'>— none —</option></select></label>';
      h += '<label style="font-size:10px;color:var(--fg2)">Description<br><input class="try-inp" value="'+esc(item.description||'')+'" placeholder="e.g. LIVE" style="font-size:10px;padding:2px 4px;width:140px" oninput="orderState[\''+tabId+'\'].items.find(i=>i.localRef===\''+item.localRef+'\').description=this.value"></label>';
      h += '</div>';
    }

    // Relationship row for child items
    if(isPost && item.parentRef){
      h += '<div style="display:flex;gap:6px;flex-wrap:wrap;padding:4px 8px;border-top:1px solid rgba(255,255,255,.04);background:rgba(255,200,100,.04)">';
      h += '<span style="font-size:9px;color:var(--yellow);align-self:center;min-width:20px" title="OrderItemRelationship fields">OIR</span>';
      h += '<label style="font-size:10px;color:var(--fg2)">PrdRelComponentId<br><input class="try-inp" value="'+esc(item.prcRelCompId||'')+'" placeholder="0dS..." style="font-size:10px;padding:2px 4px;width:165px;font-family:monospace" oninput="orderState[\''+tabId+'\'].items.find(i=>i.localRef===\''+item.localRef+'\').prcRelCompId=this.value"></label>';
      h += '<label style="font-size:10px;color:var(--fg2)">PrdRelTypeId<br><input class="try-inp" value="'+esc(item.prcRelTypeId||'')+'" placeholder="0yo..." style="font-size:10px;padding:2px 4px;width:165px;font-family:monospace" oninput="orderState[\''+tabId+'\'].items.find(i=>i.localRef===\''+item.localRef+'\').prcRelTypeId=this.value"></label>';
      h += '<label style="font-size:10px;color:var(--fg2)">AssocPricing<br><select class="try-sel" style="font-size:10px" onchange="orderState[\''+tabId+'\'].items.find(i=>i.localRef===\''+item.localRef+'\').assocPricing=this.value"><option'+(item.assocPricing==='NotIncludedInBundlePrice'?' selected':'')+'>NotIncludedInBundlePrice</option><option'+(item.assocPricing==='IncludedInBundlePrice'?' selected':'')+'>IncludedInBundlePrice</option></select></label>';
      h += '</div>';
    }

    // Attributes
    item.attrs.forEach((a, ai) => {
      h += '<div style="display:flex;gap:5px;align-items:center;padding:3px 8px;border-top:1px solid rgba(255,255,255,.04);background:rgba(126,181,232,.05)">';
      h += '<span style="font-size:9px;color:#7eb5e8;min-width:28px">attr</span>';
      h += '<input class="try-inp" value="'+esc(a.attrDefId)+'" placeholder="AttributeDefinitionId (0tj...)" style="font-size:10px;padding:2px 4px;width:175px;font-family:monospace" oninput="orderState[\''+tabId+'\'].items.find(i=>i.localRef===\''+item.localRef+'\').attrs['+ai+'].attrDefId=this.value">';
      h += '<label style="font-size:10px;color:var(--fg2);display:flex;align-items:center;gap:3px;cursor:pointer"><input type="checkbox"'+(a.usePicklist?' checked':'')+' onchange="orderState[\''+tabId+'\'].items.find(i=>i.localRef===\''+item.localRef+'\').attrs['+ai+'].usePicklist=this.checked;_obRenderItems(\''+tabId+'\')"> Picklist</label>';
      if(a.usePicklist){
        h += '<input class="try-inp" value="'+esc(a.picklistValueId)+'" placeholder="PicklistValueId (0v6...)" style="font-size:10px;padding:2px 4px;width:165px;font-family:monospace" oninput="orderState[\''+tabId+'\'].items.find(i=>i.localRef===\''+item.localRef+'\').attrs['+ai+'].picklistValueId=this.value">';
      } else {
        h += '<input class="try-inp" value="'+esc(a.attrValue)+'" placeholder="AttributeValue (text)" style="font-size:10px;padding:2px 4px;width:165px" oninput="orderState[\''+tabId+'\'].items.find(i=>i.localRef===\''+item.localRef+'\').attrs['+ai+'].attrValue=this.value">';
      }
      h += '<button class="icon-btn" style="color:var(--red);font-size:11px" onclick="obRemoveAttr(\''+tabId+'\',\''+item.localRef+'\','+ai+')">✕</button>';
      h += '</div>';
    });

    h += '</div>';

    // Render children recursively
    s.items.filter(i => i.parentRef === item.localRef).forEach(child => {
      h += renderItem(child, depth+1);
    });
    return h;
  }

  // Only render root items (no parent)
  const roots = s.items.filter(i => !i.parentRef);
  container.innerHTML = roots.length ? roots.map(i => renderItem(i, 0)).join('') :
    '<div style="font-size:11px;color:var(--fg3);padding:6px 0">No items yet. Click + Add Order Item.</div>';
}

function _buildOrderGraph(tabId){
  const s = orderState[tabId];
  const records = [];
  let qlrIdx = 0;

  // 1. Order anchor
  if(s.mode === 'new'){
    const today = s.effectiveDate || new Date().toISOString().slice(0,10);
    const orderRec = {
      attributes:{ type:'Order', method:'POST' },
      AccountId: s.accountId,
      EffectiveDate: today,
      Pricebook2Id: s.pricebook2Id,
      Status: 'Draft',
      Name: s.orderName || 'New Order'
    };
    if(s.contractId)      orderRec.ContractId = s.contractId;
    if(s.currencyIsoCode) orderRec.CurrencyIsoCode = s.currencyIsoCode;
    if(s.billToContactId) orderRec.BillToContactId = s.billToContactId;
    if(s.billingStreet){
      orderRec.BillingStreet = s.billingStreet;
      if(s.billingCity)       orderRec.BillingCity = s.billingCity;
      if(s.billingPostalCode) orderRec.BillingPostalCode = s.billingPostalCode;
      if(s.billingCountry)    orderRec.BillingCountry = s.billingCountry;
    }
    if(s.shippingStreet){
      orderRec.ShippingStreet = s.shippingStreet;
      if(s.shippingCity)       orderRec.ShippingCity = s.shippingCity;
      if(s.shippingPostalCode) orderRec.ShippingPostalCode = s.shippingPostalCode;
      if(s.shippingCountry)    orderRec.ShippingCountry = s.shippingCountry;
    }
    records.push({ referenceId:'refOrder', record: orderRec });
  } else {
    records.push({ referenceId:'refOrder', record:{
      attributes:{ type:'Order', method:'PATCH', id: s.orderId }
    }});
  }

  // 2. AppUsageAssignment — only for Usage-Based / Revenue Lifecycle Management products
  if(s.includeAppUsage){
    records.push({ referenceId:'refAppTag', record:{
      attributes:{ type:'AppUsageAssignment', method:'POST' },
      AppUsageType: 'RevenueLifecycleManagement',
      RecordId: '@{refOrder.id}'
    }});
  }

  // 3. OrderAction (required — every OrderItem links to it)
  records.push({ referenceId:'refOrderAction', record:{
    attributes:{ type:'OrderAction', method:'POST' },
    OrderId: '@{refOrder.id}',
    Type: 'Add'
  }});

  // 4. Order items — POSTs first, then PATCHes, then DELETEs (to mirror PST ordering)
  const postItems = s.items.filter(i => i.op === 'POST');
  const patchItems = s.items.filter(i => i.op === 'PATCH');
  const delItems = s.items.filter(i => i.op === 'DELETE');

  [...postItems, ...patchItems, ...delItems].forEach(item => {
    if(item.op === 'POST'){
      const oiRec = {
        attributes:{ type:'OrderItem', method:'POST' },
        OrderId: '@{refOrder.id}',
        OrderActionId: '@{refOrderAction.id}',
        PricebookEntryId: item.pbeId,
        Product2Id: item.product2Id,
        Quantity: parseFloat(item.qty)||1,
        UnitPrice: parseFloat(item.unitPrice)||0
      };
      if(item.serviceDate)      oiRec.ServiceDate = item.serviceDate;
      if(item.periodBoundary)   oiRec.PeriodBoundary = item.periodBoundary;
      if(item.billingFrequency) oiRec.BillingFrequency2 = item.billingFrequency;
      if(item.description)      oiRec.Description = item.description;
      records.push({ referenceId: item.localRef, record: oiRec });
    } else if(item.op === 'PATCH'){
      records.push({ referenceId: item.localRef, record:{
        attributes:{ type:'OrderItem', method:'PATCH', id: item.orderItemId },
        Quantity: parseFloat(item.qty)||1
      }});
    } else if(item.op === 'DELETE'){
      records.push({ referenceId: item.localRef, record:{
        attributes:{ type:'OrderItem', method:'DELETE', id: item.orderItemId }
      }});
    }

    // Attributes for this item
    (item.attrs||[]).forEach((a, ai) => {
      if(!a.attrDefId) return;
      const aRec = {
        attributes:{ type:'OrderItemAttribute', method:'POST' },
        OrderItemId: item.op==='POST' ? '@{'+item.localRef+'.id}' : item.orderItemId,
        AttributeDefinitionId: a.attrDefId
      };
      if(a.usePicklist && a.picklistValueId) aRec.AttributePicklistValueId = a.picklistValueId;
      else if(!a.usePicklist && a.attrValue) aRec.AttributeValue = a.attrValue;
      records.push({ referenceId: item.localRef+'_attr'+ai, record: aRec });
    });
  });

  // 5. OrderItemRelationships for parent-child pairs
  postItems.filter(i => i.parentRef).forEach(child => {
    const parent = s.items.find(i => i.localRef === child.parentRef);
    if(!parent) return;
    const mainId = parent.op==='POST' ? '@{'+parent.localRef+'.id}' : parent.orderItemId;
    const assocId = '@{'+child.localRef+'.id}';
    const oirRec = {
      attributes:{ type:'OrderItemRelationship', method:'POST' },
      MainOrderItemId: mainId,
      AssociatedOrderItemId: assocId,
      AssociatedOrderItemPricing: child.assocPricing || 'NotIncludedInBundlePrice'
    };
    if(child.prcRelCompId) oirRec.ProductRelatedComponentId = child.prcRelCompId;
    if(child.prcRelTypeId) oirRec.ProductRelationshipTypeId = child.prcRelTypeId;
    records.push({ referenceId:'refOir_'+(qlrIdx++), record: oirRec });
  });

  const opts = s.configOptions;
  return {
    pricingPref: s.pricingPref,
    catalogRatesPref: 'Skip',
    configurationPref: {
      configurationMethod: s.configInput,
      configurationOptions: {
        validateProductCatalog:    !!opts.validateProductCatalog,
        validateAmendRenewCancel:  !!opts.validateAmendRenewCancel,
        executeConfigurationRules: !!opts.executeConfigurationRules,
        addDefaultConfiguration:   !!opts.addDefaultConfiguration
      }
    },
    taxPref: s.taxPref || 'Skip',
    graph:{ graphId:'createOrderStructure', records }
  };
}

function obPreview(tabId){
  const respEl = document.getElementById('ob-resp-'+tabId);
  if(!respEl) return;
  try{
    const graph = _buildOrderGraph(tabId);
    respEl.style.color='var(--fg2)';
    respEl.textContent = JSON.stringify(graph, null, 2);
    orderState[tabId].previewActive = true;
  } catch(e){
    respEl.style.color='var(--red)';
    respEl.textContent = 'Graph error: '+e.message;
  }
}

function executeOrder(tabId){
  const s = orderState[tabId];
  const orgAlias = document.getElementById('org-select').value;
  if(!orgAlias){ showToast('Select an org first.','error'); return; }
  if(s.mode==='new'){
    if(!s.accountId.trim()){ showToast('AccountId is required.','error'); return; }
    if(!s.pricebook2Id.trim()){
      const pbEl = document.getElementById('ob-pb-'+tabId);
      if(pbEl){ pbEl.style.borderColor='var(--red)'; pbEl.style.boxShadow='0 0 0 2px rgba(220,50,50,.3)'; pbEl.focus(); setTimeout(()=>{ pbEl.style.borderColor=''; pbEl.style.boxShadow=''; },3000); }
      showToast('Pricebook2Id is required — paste the 01s… ID.','error'); return;
    }
    if(!s.effectiveDate){ showToast('EffectiveDate is required.','error'); return; }
  } else {
    if(!s.orderId.trim()){ showToast('Order Id is required for PATCH mode.','error'); return; }
  }

  const btn = document.getElementById('ob-exec-btn-'+tabId);
  const respEl = document.getElementById('ob-resp-'+tabId);
  const pill = document.getElementById('ob-pill-'+tabId);
  btn.disabled=true; btn.textContent='Executing…';
  respEl.style.color='var(--fg3)'; respEl.textContent='Waiting for response…';
  if(pill) pill.innerHTML='';

  // Pre-flight: validate cross-references have .id suffix
  const xrefWarnings = _validateOrderGraphRefs(tabId);
  if(xrefWarnings.length){
    const msg = 'Cross-reference issue:\n'+xrefWarnings.join('\n')+'\n\nProceed anyway?';
    if(!confirm(msg)){ btn.disabled=false; btn.textContent='▶ Execute Order API'; return; }
  }

  let body;
  try{ body = applyVars(JSON.stringify(_buildOrderGraph(tabId))); }
  catch(e){ btn.disabled=false; btn.textContent='▶ Execute Order API'; showToast('Graph error: '+e.message,'error'); return; }

  const requestId = ++reqCounter;
  pendingReqs[requestId] = (result) => {
    btn.disabled=false; btn.textContent='▶ Execute Order API';
    let parsed;
    try{ parsed = JSON.parse(result.body); }catch(_){ parsed=null; }
    const isOk = parsed && parsed.success;
    const status = result.status||0;

    respEl.style.color = (status>=200&&status<300) ? 'var(--fg2)' : 'var(--red)';
    respEl.textContent = (result.body||'').length>100000
      ? result.body.slice(0,100000)+'\n… (truncated)'
      : result.body;

    if(pill){
      if(isOk){
        const orderId = parsed.orderId;
        pill.innerHTML = '<span class="status-pill s2xx">&#10003; Order created — '+esc(orderId)+'</span>'+
          '<div style="margin-top:4px;font-size:10px;color:var(--fg3)">Order Id: <code>'+esc(orderId)+'</code> · Auto-set as <code>{{ORDER_ID}}</code></div>'+
          (parsed.statusURL?'<div style="margin-top:2px;font-size:10px;color:var(--fg3)">Poll status: <code>'+esc(parsed.statusURL)+'</code></div>':'');
        setQuickVar('ORDER_ID', orderId, null);
      } else {
        const errList = (parsed&&parsed.errorResponse) ? parsed.errorResponse : (parsed&&parsed.errors ? parsed.errors : []);
        const errs = errList.map(e=>'<li>'+esc(e.errorCode||'')+': '+esc(e.message||'')+'</li>').join('');
        const hasCtxErr = errList.some(e=>(e.message||'').includes('SalesTransactionContext')||(e.message||'').includes('context definition'));
        const ctxBanner = hasCtxErr
          ? '<div style="margin-top:6px;padding:6px 10px;background:rgba(255,160,0,.12);border:1px solid rgba(255,160,0,.4);border-radius:4px;font-size:11px;color:#e6a000">'+
            '&#9888; <b>Sales Transaction Context error</b> — the context definition referenced by this org is missing or inactive.<br>'+
            'Fix: <b>Setup → Revenue Cloud → Sales Transaction Context Definitions</b> → verify the context is <b>Active</b> and all field mappings are complete.<br>'+
            'Click <b>🔍 Diagnose Org</b> above to check org readiness, or contact your Salesforce admin.'+
            '</div>'
          : '';
        pill.innerHTML = '<span class="status-pill serr">&#10005; Order API Failed</span>'+ctxBanner+
          (errs?'<ul style="margin:6px 0 0 16px;font-size:11px;color:var(--red)">'+errs+'</ul>':'');
      }
    }
  };

  vscMsg({ type:'executeCustom', requestId, orgAlias,
    method:'POST',
    path:'/services/data/v66.0/connect/rev/sales-transaction/actions/place',
    headers:{}, body, apiVersion:'v66.0' });
}

function obCopyApex(tabId){
  let body;
  try{ body = JSON.stringify(_buildOrderGraph(tabId), null, 2); }
  catch(e){ showToast('Graph error: '+e.message,'error'); return; }
  const apex = `HttpRequest req = new HttpRequest();
req.setEndpoint(URL.getOrgDomainUrl().toExternalForm() + '/services/data/v66.0/connect/rev/sales-transaction/actions/place');
req.setMethod('POST');
req.setHeader('Content-Type', 'application/json');
req.setHeader('Authorization', 'Bearer ' + UserInfo.getSessionId());
req.setTimeout(120000);
req.setBody('${body.replace(/'/g,"\\'")}');
HttpResponse res = new Http().send(req);
System.debug(res.getStatusCode() + ' ' + res.getBody());`;
  navigator.clipboard.writeText(apex).then(()=>showToast('Apex copied!','success'),()=>showToast('Copy failed','error'));
}

// ── Configurator Session Builder ──────────────────────────────────────────────

let cfgBuilderState = {};  // keyed by tabId

function _cfgUuid(){
  return 'xxxxxxxx_xxxx_4xxx_yxxx_xxxxxxxxxxxx'.replace(/[xy]/g, function(c){
    const r = Math.random()*16|0;
    return (c==='x' ? r : (r&0x3|0x8)).toString(16);
  });
}

function openCfgBuilderTab(){
  const existing = tabs.find(function(t){ return t.type === 'cfg-builder'; });
  if(existing){ activateTab(existing.id); return; }
  const tabId = 'tab-' + (++tabCounter);
  tabs.push({ id: tabId, type: 'cfg-builder', label: '⚙ Cfg Builder' });
  cfgBuilderState[tabId] = {
    transactionId: '', transactionType: 'Quote', contextId: '',
    accountId: '', contactId: '',
    phase: 'idle',
    nodes: [], pendingNodes: [], nodeCounter: 0,
    cfgOptions: {
      executePricing: true, executeConfigurationRules: true,
      addDefaultConfiguration: true, validateProductCatalog: true,
      validateAmendRenewCancel: true, returnProductCatalogData: false,
      qualifyAllProductsInTransaction: true
    },
    orgAlias: '', lastResp: null
  };
  renderTabBar();
  const panel = document.createElement('div');
  panel.id = 'tp-' + tabId;
  panel.className = 'tab-panel';
  document.getElementById('detail').appendChild(panel);
  _buildCfgPanel(panel, tabId);
  activateTab(tabId);
}

function _buildCfgPanel(panel, tabId){
  panel.innerHTML =
    '<div style="padding:16px 20px;overflow-y:auto;height:100%">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
      '<div style="font-size:16px;font-weight:600;color:var(--fg)">⚙ Configurator Session Builder</div>' +
      '<div style="display:flex;gap:6px">' +
        '<button class="btn" onclick="cfgInnerTab(\'builder\',\''+tabId+'\')" id="cfg-inner-builder-'+tabId+'" style="font-size:11px;padding:3px 10px;background:var(--acc);color:#fff">Builder</button>' +
        '<button class="btn" onclick="cfgInnerTab(\'ref\',\''+tabId+'\')" id="cfg-inner-ref-'+tabId+'" style="font-size:11px;padding:3px 10px">Reference</button>' +
      '</div>' +
    '</div>' +

    // ── Builder inner panel
    '<div id="cfg-builder-body-'+tabId+'">' +

    // Section 1: Session
    '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:12px">' +
      '<div style="font-size:12px;font-weight:600;color:var(--fg);margin-bottom:10px;display:flex;align-items:center;gap:8px">' +
        '<span>① Session</span>' +
        '<span id="cfg-phase-badge-'+tabId+'" style="font-size:10px;padding:2px 8px;border-radius:10px;background:var(--bg3);color:var(--fg3)">idle</span>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">' +
        '<div><label style="font-size:10px;color:var(--fg3);display:block;margin-bottom:3px">Transaction ID (Quote 0Q0 / Order 801) *</label>' +
          '<input id="cfg-txn-'+tabId+'" placeholder="0Q0AW00000..." style="width:100%;box-sizing:border-box;padding:5px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--fg);font-size:12px" ' +
          'oninput="cfgBuilderState[\''+tabId+'\'].transactionId=this.value;cfgBuilderState[\''+tabId+'\'].transactionType=this.value.startsWith(\'801\')?\'Order\':\'Quote\'">' +
        '</div>' +
        '<div><label style="font-size:10px;color:var(--fg3);display:block;margin-bottom:3px">Account ID (for qualification)</label>' +
          '<input id="cfg-acct-'+tabId+'" placeholder="001AW..." style="width:100%;box-sizing:border-box;padding:5px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--fg);font-size:12px" ' +
          'oninput="cfgBuilderState[\''+tabId+'\'].accountId=this.value">' +
        '</div>' +
        '<div><label style="font-size:10px;color:var(--fg3);display:block;margin-bottom:3px">Context ID (auto-filled on load)</label>' +
          '<input id="cfg-ctx-'+tabId+'" placeholder="auto-filled…" readonly style="width:100%;box-sizing:border-box;padding:5px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg3);color:var(--fg2);font-size:11px;font-family:monospace">' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
        '<button class="btn btn-pri" onclick="cfgLoadSession(\''+tabId+'\')" style="font-size:12px;padding:5px 14px">⚡ Load Session</button>' +
        '<button class="btn" onclick="cfgGetInstance(\''+tabId+'\')" style="font-size:11px;padding:4px 10px" title="Refresh node tree from org">↻ Refresh Tree</button>' +
        '<button class="btn" onclick="cfgRunRules(\''+tabId+'\')" style="font-size:11px;padding:4px 10px">▶ Run Rules</button>' +
        '<button class="btn" onclick="cfgSaveInstance(\''+tabId+'\')" style="font-size:11px;padding:4px 10px;background:#27ae60;color:#fff;border-color:#27ae60">💾 Save Instance</button>' +
        '<details style="display:inline-block;font-size:11px;color:var(--fg3)">' +
          '<summary style="cursor:pointer;outline:none">⚙ Options</summary>' +
          '<div id="cfg-opts-'+tabId+'" style="margin-top:6px;background:var(--bg3);padding:8px 10px;border-radius:5px;display:grid;grid-template-columns:1fr 1fr;gap:4px 16px">' +
            ['executePricing','executeConfigurationRules','addDefaultConfiguration','validateProductCatalog',
             'validateAmendRenewCancel','returnProductCatalogData','qualifyAllProductsInTransaction'].map(function(k){
              return '<label style="display:flex;align-items:center;gap:5px;font-size:10px;cursor:pointer">' +
                '<input type="checkbox" '+((['executePricing','executeConfigurationRules','addDefaultConfiguration','validateProductCatalog','validateAmendRenewCancel','qualifyAllProductsInTransaction'].indexOf(k)>=0)?'checked':'')+
                ' onchange="cfgBuilderState[\''+tabId+'\'].cfgOptions[\''+k+'\']=this.checked"> '+k+'</label>';
            }).join('') +
          '</div>' +
        '</details>' +
      '</div>' +
    '</div>' +

    // Section 2: Context Tree
    '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:12px">' +
      '<div style="font-size:12px;font-weight:600;color:var(--fg);margin-bottom:8px">② Context Tree <span style="font-weight:400;color:var(--fg3);font-size:10px">(loads after Load Session or Refresh)</span></div>' +
      '<div id="cfg-tree-'+tabId+'" style="font-size:11px;color:var(--fg3);font-style:italic">No session loaded yet.</div>' +
    '</div>' +

    // Section 3: Add Nodes
    '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:12px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">' +
        '<div style="font-size:12px;font-weight:600;color:var(--fg)">③ Add Line Items to Context</div>' +
        '<button class="btn btn-pri" onclick="cfgAddPendingNode(\''+tabId+'\')" style="font-size:11px;padding:3px 10px">+ Draft Node</button>' +
      '</div>' +
      '<div style="font-size:11px;color:var(--fg3);margin-bottom:10px">Fill in the fields below, then click <b>↑ Send to Org</b> to add all drafted nodes in one API call.</div>' +
      '<div id="cfg-pending-'+tabId+'"></div>' +
      '<div style="display:flex;align-items:center;gap:8px;margin-top:8px">' +
        '<button id="cfg-submit-add-'+tabId+'" class="btn btn-pri" onclick="cfgExecuteAddNodes(\''+tabId+'\')" disabled style="font-size:12px;padding:5px 16px;opacity:0.45">↑ Send to Org</button>' +
        '<div id="cfg-add-pill-'+tabId+'" style="font-size:11px;color:var(--fg3)"></div>' +
      '</div>' +
    '</div>' +

    // Response box
    '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:12px">' +
      '<div style="font-size:11px;font-weight:600;color:var(--fg2);margin-bottom:6px">Last Response</div>' +
      '<div id="cfg-resp-pill-'+tabId+'"></div>' +
      '<div id="cfg-resp-'+tabId+'" style="font-size:11px;font-family:monospace;color:var(--fg3);white-space:pre-wrap;max-height:280px;overflow-y:auto;margin-top:4px"></div>' +
    '</div>' +

    '</div>' + // end cfg-builder-body

    // ── Reference inner panel
    '<div id="cfg-ref-body-'+tabId+'" style="display:none">' +
    _buildCfgReference() +
    '</div>' +

    '</div>'; // end outer padding
}

function cfgInnerTab(which, tabId){
  document.getElementById('cfg-builder-body-'+tabId).style.display = which==='builder' ? '' : 'none';
  document.getElementById('cfg-ref-body-'+tabId).style.display = which==='ref' ? '' : 'none';
  const b = document.getElementById('cfg-inner-builder-'+tabId);
  const r = document.getElementById('cfg-inner-ref-'+tabId);
  if(b && r){
    b.style.background = which==='builder' ? 'var(--acc)' : 'var(--bg3)';
    b.style.color = which==='builder' ? '#fff' : 'var(--fg)';
    r.style.background = which==='ref' ? 'var(--acc)' : 'var(--bg3)';
    r.style.color = which==='ref' ? '#fff' : 'var(--fg)';
  }
}

function cfgLoadSession(tabId){
  const s = cfgBuilderState[tabId];
  const orgAlias = document.getElementById('org-select').value;
  if(!orgAlias){ showToast('Select an org first.','error'); return; }
  if(!s.transactionId.trim()){ showToast('Transaction ID required.','error'); return; }
  s.orgAlias = orgAlias;
  const body = {
    transactionId: s.transactionId.trim(),
    configuratorOptions: s.cfgOptions,
    qualificationContext: {}
  };
  if(s.accountId.trim()) body.qualificationContext.accountId = s.accountId.trim();
  if(s.contactId.trim()) body.qualificationContext.contactId = s.contactId.trim();

  _cfgSetBadge(tabId, 'loading…', '#e67e22');
  const reqId = ++reqCounter;
  pendingReqs[reqId] = function(result){
    _cfgHandleResponse(tabId, result, function(parsed){
      const ctxId = parsed.contextId;
      if(!ctxId){ _cfgShowResp(tabId, result, ''); showToast('No contextId in response — check the transaction ID.','error'); return; }
      s.contextId = ctxId;
      s.phase = 'loaded';
      _cfgSetBadge(tabId, 'loaded', '#27ae60');
      const ctxInput = document.getElementById('cfg-ctx-'+tabId);
      if(ctxInput) ctxInput.value = ctxId;
      // Save to env so other tabs can use {{CFG_CONTEXT_ID}}
      setQuickVar('CFG_CONTEXT_ID', ctxId, null);
      showToast('Session loaded — contextId saved to CFG_CONTEXT_ID','success');
      _cfgShowResp(tabId, result, '');
      cfgGetInstance(tabId);
    });
  };
  vscMsg({ type:'executeCustom', requestId:reqId, orgAlias,
    method:'POST',
    path:'/services/data/'+(DEFAULT_API_VERSION||'v66.0')+'/connect/cpq/configurator/actions/load-instance',
    headers:{}, body: JSON.stringify(body), apiVersion: DEFAULT_API_VERSION||'v66.0' });
}

function cfgGetInstance(tabId){
  const s = cfgBuilderState[tabId];
  if(!s.contextId){ showToast('Load a session first.','error'); return; }
  const orgAlias = s.orgAlias || document.getElementById('org-select').value;
  const reqId = ++reqCounter;
  pendingReqs[reqId] = function(result){
    _cfgHandleResponse(tabId, result, function(parsed){
      // transaction may be a map (keyed by field name) or have salesTransactionItems array
      const txn = parsed.transaction || {};
      const items = txn.salesTransactionItems || txn.SalesTransactionItems || [];
      // also handle map-of-maps shape: { "0QL...": { businessObjectType:"QuoteLineItem", ... } }
      if(!items.length && typeof txn === 'object'){
        const candidates = Object.values(txn).filter(function(v){
          return v && typeof v === 'object' && (v.businessObjectType === 'QuoteLineItem' || v.businessObjectType === 'OrderItem');
        });
        s.nodes = candidates;
      } else {
        s.nodes = items.filter(function(n){ return n && (n.businessObjectType === 'QuoteLineItem' || n.businessObjectType === 'OrderItem' || !n.businessObjectType); });
      }
      _cfgRenderNodeTree(tabId);
      _cfgShowResp(tabId, result, '');
    });
  };
  vscMsg({ type:'executeCustom', requestId:reqId, orgAlias,
    method:'POST',
    path:'/services/data/'+(DEFAULT_API_VERSION||'v66.0')+'/connect/cpq/configurator/actions/get-instance',
    headers:{}, body: JSON.stringify({contextId: s.contextId}), apiVersion: DEFAULT_API_VERSION||'v66.0' });
}

function _cfgRenderNodeTree(tabId){
  const s = cfgBuilderState[tabId];
  const el = document.getElementById('cfg-tree-'+tabId);
  if(!el) return;
  if(!s.nodes.length){ el.innerHTML = '<div style="font-size:11px;color:var(--fg3);font-style:italic">Context has no line items yet.</div>'; return; }
  // Store paths in state so onclick can reference by index — avoids quote-escaping inside HTML attributes
  s._nodePaths = s.nodes.map(function(node){
    return [s.transactionId, node.id||node.SalesTransactionItemSource||''];
  });
  let html = '<div style="display:flex;flex-direction:column;gap:4px">';
  s.nodes.forEach(function(node, idx){
    // RC returns product info in various shapes depending on API version
    const productName = (node.productDetails && (node.productDetails.name || node.productDetails.Name)) ||
      (node.product && (node.product.name || node.product.Name || node.product.id)) ||
      node.ProductCode || node.Name || node.name || node.Product || '';
    const pid = esc(productName || node.id || '(unknown product)');
    const qty = esc(String(node.Quantity||node.quantity||node.quantity||'-'));
    const nid = esc(node.id||'');
    const safeId = 'cfg-uqty-'+tabId+'-'+idx;
    html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--bg3);border-radius:5px;font-size:11px">' +
      '<span style="flex:1;color:var(--fg);font-weight:500">'+pid+'</span>' +
      '<span style="color:var(--fg3);font-family:monospace;font-size:10px">'+nid+'</span>' +
      '<span style="color:var(--fg2)">qty: '+qty+'</span>' +
      '<input type="number" id="'+safeId+'" value="'+qty+'" min="0" style="width:52px;padding:2px 5px;border:1px solid var(--border);border-radius:3px;background:var(--bg);color:var(--fg);font-size:11px">' +
      '<button class="btn" style="font-size:10px;padding:2px 8px" onclick="cfgUpdateNode(\''+tabId+'\','+idx+',document.getElementById(\''+safeId+'\').value)">Update</button>' +
      '<button class="btn" style="font-size:10px;padding:2px 8px;color:#e74c3c;border-color:#e74c3c" onclick="cfgDeleteNode(\''+tabId+'\','+idx+')">Delete</button>' +
    '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

function cfgAddPendingNode(tabId){
  const s = cfgBuilderState[tabId];
  s.nodeCounter++;
  const localRef = 'ref_' + _cfgUuid();
  s.pendingNodes.push({
    localRef: localRef, productId: '', pbeId: '', psmId: '',
    qty: '1', unitPrice: '0',
    addRelationship: true, mainItemId: '', prcId: '', prtId: '',
    assocPricing: 'NotIncludedInBundlePrice', assocQtyMethod: 'Proportional'
  });
  _cfgRenderPendingNodes(tabId);
}

function cfgRemovePendingNode(tabId, localRef){
  const s = cfgBuilderState[tabId];
  s.pendingNodes = s.pendingNodes.filter(function(d){ return d.localRef !== localRef; });
  _cfgRenderPendingNodes(tabId);
}

function _cfgRenderPendingNodes(tabId){
  const s = cfgBuilderState[tabId];
  const el = document.getElementById('cfg-pending-'+tabId);
  const submitBtn = document.getElementById('cfg-submit-add-'+tabId);
  if(!el) return;
  if(!s.pendingNodes.length){
    el.innerHTML = '<div style="font-size:11px;color:var(--fg3);font-style:italic;padding:6px 0">No drafts yet — click "+ Draft Node" to start.</div>';
    if(submitBtn){ submitBtn.disabled = true; submitBtn.style.opacity = '0.45'; }
    return;
  }
  if(submitBtn){ submitBtn.disabled = false; submitBtn.style.opacity = '1'; }
  let html = '';
  s.pendingNodes.forEach(function(draft, idx){
    const ref = draft.localRef;
    const sRef = JSON.stringify(ref);
    html += '<div style="background:var(--bg3);border:1px solid #e67e2244;border-radius:6px;padding:10px 12px;margin-bottom:8px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
        '<div style="display:flex;align-items:center;gap:8px">' +
          '<span style="font-size:11px;font-weight:600;color:var(--fg)">Draft node '+(idx+1)+'</span>' +
          '<span style="font-size:10px;background:#e67e2222;color:#e67e22;border:1px solid #e67e2266;border-radius:10px;padding:1px 7px">not sent yet</span>' +
        '</div>' +
        '<button class="btn" style="font-size:10px;padding:2px 7px;color:#e74c3c;border-color:#e74c3c" onclick="cfgRemovePendingNode(\''+tabId+'\','+sRef+')">✕ Discard</button>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 80px 80px;gap:6px;margin-bottom:8px">' +
        '<div><label style="font-size:10px;color:var(--fg3);display:block;margin-bottom:2px">Product2 ID (01t…) *</label>' +
          '<input value="'+esc(draft.productId)+'" placeholder="01txx..." style="width:100%;box-sizing:border-box;padding:4px 7px;border:1px solid var(--border);border-radius:3px;background:var(--bg);color:var(--fg);font-size:11px" oninput="cfgBuilderState[\''+tabId+'\'].pendingNodes['+idx+'].productId=this.value"></div>' +
        '<div><label style="font-size:10px;color:var(--fg3);display:block;margin-bottom:2px">PricebookEntry ID (01u…) *</label>' +
          '<input value="'+esc(draft.pbeId)+'" placeholder="01uxx..." style="width:100%;box-sizing:border-box;padding:4px 7px;border:1px solid var(--border);border-radius:3px;background:var(--bg);color:var(--fg);font-size:11px" oninput="cfgBuilderState[\''+tabId+'\'].pendingNodes['+idx+'].pbeId=this.value"></div>' +
        '<div><label style="font-size:10px;color:var(--fg3);display:block;margin-bottom:2px">ProductSellingModel (0jP…) *</label>' +
          '<input value="'+esc(draft.psmId)+'" placeholder="0jPxx..." style="width:100%;box-sizing:border-box;padding:4px 7px;border:1px solid var(--border);border-radius:3px;background:var(--bg);color:var(--fg);font-size:11px" oninput="cfgBuilderState[\''+tabId+'\'].pendingNodes['+idx+'].psmId=this.value"></div>' +
        '<div><label style="font-size:10px;color:var(--fg3);display:block;margin-bottom:2px">Qty</label>' +
          '<input type="number" value="'+esc(draft.qty)+'" min="0" style="width:100%;box-sizing:border-box;padding:4px 7px;border:1px solid var(--border);border-radius:3px;background:var(--bg);color:var(--fg);font-size:11px" oninput="cfgBuilderState[\''+tabId+'\'].pendingNodes['+idx+'].qty=this.value"></div>' +
        '<div><label style="font-size:10px;color:var(--fg3);display:block;margin-bottom:2px">Unit Price</label>' +
          '<input type="number" value="'+esc(draft.unitPrice)+'" min="0" step="0.01" style="width:100%;box-sizing:border-box;padding:4px 7px;border:1px solid var(--border);border-radius:3px;background:var(--bg);color:var(--fg);font-size:11px" oninput="cfgBuilderState[\''+tabId+'\'].pendingNodes['+idx+'].unitPrice=this.value"></div>' +
      '</div>' +
      '<label style="display:flex;align-items:center;gap:6px;font-size:11px;cursor:pointer;margin-bottom:6px">' +
        '<input type="checkbox" '+(draft.addRelationship?'checked':'')+' onchange="cfgBuilderState[\''+tabId+'\'].pendingNodes['+idx+'].addRelationship=this.checked;_cfgRenderPendingNodes(\''+tabId+'\')"> Add relationship (link to parent bundle QLI)' +
      '</label>' +
      (draft.addRelationship ?
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;padding:8px;background:var(--bg2);border-radius:5px">' +
          '<div><label style="font-size:10px;color:var(--fg3);display:block;margin-bottom:2px">Parent QLI ID (MainItem) *</label>' +
            '<input value="'+esc(draft.mainItemId)+'" placeholder="0QLxx..." style="width:100%;box-sizing:border-box;padding:4px 7px;border:1px solid var(--border);border-radius:3px;background:var(--bg);color:var(--fg);font-size:11px" oninput="cfgBuilderState[\''+tabId+'\'].pendingNodes['+idx+'].mainItemId=this.value"></div>' +
          '<div><label style="font-size:10px;color:var(--fg3);display:block;margin-bottom:2px">ProductRelatedComponent (0dS…)</label>' +
            '<input value="'+esc(draft.prcId)+'" placeholder="0dSxx..." style="width:100%;box-sizing:border-box;padding:4px 7px;border:1px solid var(--border);border-radius:3px;background:var(--bg);color:var(--fg);font-size:11px" oninput="cfgBuilderState[\''+tabId+'\'].pendingNodes['+idx+'].prcId=this.value"></div>' +
          '<div><label style="font-size:10px;color:var(--fg3);display:block;margin-bottom:2px">AssocItemPricing</label>' +
            '<select style="width:100%;padding:4px 7px;border:1px solid var(--border);border-radius:3px;background:var(--bg);color:var(--fg);font-size:11px" onchange="cfgBuilderState[\''+tabId+'\'].pendingNodes['+idx+'].assocPricing=this.value">' +
              '<option value="NotIncludedInBundlePrice" '+(draft.assocPricing==='NotIncludedInBundlePrice'?'selected':'')+'>NotIncludedInBundlePrice</option>' +
              '<option value="IncludedInBundlePrice" '+(draft.assocPricing==='IncludedInBundlePrice'?'selected':'')+'>IncludedInBundlePrice</option>' +
            '</select></div>' +
        '</div>'
      : '') +
    '</div>';
  });
  el.innerHTML = html;
}

function _cfgBuildAddedNodes(s, draft){
  const txId = s.transactionId;
  const isOrder = s.transactionType === 'Order';
  const qliType = isOrder ? 'OrderItem' : 'QuoteLineItem';
  const relType = isOrder ? 'OrderItemRelationship' : 'QuoteLineRelationship';
  const nodes = [{
    path: [txId, draft.localRef],
    addedObject: {
      id: draft.localRef,
      SalesTransactionItemSource: draft.localRef,
      SalesTransactionItemParent: txId,
      businessObjectType: qliType,
      PricebookEntry: draft.pbeId,
      ProductSellingModel: draft.psmId,
      Product: draft.productId,
      Quantity: parseFloat(draft.qty) || 1,
      UnitPrice: parseFloat(draft.unitPrice) || 0
    }
  }];
  if(draft.addRelationship && draft.mainItemId){
    const relRef = 'ref_' + _cfgUuid();
    nodes.push({
      path: [txId, draft.localRef, relRef],
      addedObject: {
        id: relRef,
        businessObjectType: relType,
        MainItem: draft.mainItemId,
        AssociatedItem: draft.localRef,
        ...(draft.prcId ? { ProductRelatedComponent: draft.prcId } : {}),
        ...(draft.prtId ? { ProductRelationshipType: draft.prtId } : {}),
        AssociatedItemPricing: draft.assocPricing,
        AssociatedQuantScaleMethod: draft.assocQtyMethod
      }
    });
  }
  return nodes;
}

function cfgExecuteAddNodes(tabId){
  const s = cfgBuilderState[tabId];
  if(!s.contextId){ showToast('Load a session first.','error'); return; }
  if(!s.pendingNodes.length){ showToast('Add at least one node first.','error'); return; }
  const orgAlias = s.orgAlias || document.getElementById('org-select').value;
  if(!orgAlias){ showToast('Select an org first.','error'); return; }

  const errors = [];
  s.pendingNodes.forEach(function(d, i){
    if(!d.productId) errors.push('Node '+(i+1)+': Product ID required');
    if(!d.pbeId)     errors.push('Node '+(i+1)+': PricebookEntry ID required');
    if(!d.psmId)     errors.push('Node '+(i+1)+': ProductSellingModel ID required');
    if(d.addRelationship && !d.mainItemId) errors.push('Node '+(i+1)+': Parent QLI ID required when adding relationship');
  });
  if(errors.length){ showToast(errors[0],'error'); return; }

  const allNodes = [];
  s.pendingNodes.forEach(function(draft){
    _cfgBuildAddedNodes(s, draft).forEach(function(n){ allNodes.push(n); });
  });

  const body = {
    contextId: s.contextId,
    configuratorOptions: s.cfgOptions,
    addedNodes: allNodes
  };
  if(s.accountId){ body.qualificationContext = { accountId: s.accountId }; }
  if(s.contactId){ body.qualificationContext = Object.assign(body.qualificationContext||{}, { contactId: s.contactId }); }

  const pillEl = document.getElementById('cfg-add-pill-'+tabId);
  if(pillEl) pillEl.innerHTML = '<span style="font-size:11px;color:var(--fg3)">Submitting…</span>';

  const reqId = ++reqCounter;
  pendingReqs[reqId] = function(result){
    _cfgHandleResponse(tabId, result, function(){
      s.pendingNodes = [];
      s.phase = 'modified';
      _cfgSetBadge(tabId, 'modified', '#e67e22');
      _cfgRenderPendingNodes(tabId);
      if(pillEl) pillEl.innerHTML = '<span style="font-size:11px;color:#27ae60">✓ Nodes added</span>';
      _cfgShowResp(tabId, result, '');
      cfgGetInstance(tabId);
    });
  };
  vscMsg({ type:'executeCustom', requestId:reqId, orgAlias,
    method:'POST',
    path:'/services/data/'+(DEFAULT_API_VERSION||'v66.0')+'/connect/cpq/configurator/actions/add-nodes',
    headers:{}, body: JSON.stringify(body), apiVersion: DEFAULT_API_VERSION||'v66.0' });
}

function cfgUpdateNode(tabId, nodeIdx, qty){
  const s = cfgBuilderState[tabId];
  if(!s.contextId){ showToast('No active session.','error'); return; }
  const orgAlias = s.orgAlias || document.getElementById('org-select').value;
  if(!orgAlias){ showToast('Select an org first.','error'); return; }
  const pathArr = s._nodePaths && s._nodePaths[nodeIdx];
  if(!pathArr){ showToast('Node path not found — refresh tree first.','error'); return; }
  const body = {
    contextId: s.contextId,
    configuratorOptions: s.cfgOptions,
    updatedNodes: [{ path: pathArr, updatedAttributes: { Quantity: parseFloat(qty)||1 } }]
  };
  const reqId = ++reqCounter;
  pendingReqs[reqId] = function(result){
    _cfgHandleResponse(tabId, result, function(){
      _cfgShowResp(tabId, result, '');
      cfgGetInstance(tabId);
    });
  };
  vscMsg({ type:'executeCustom', requestId:reqId, orgAlias,
    method:'POST',
    path:'/services/data/'+(DEFAULT_API_VERSION||'v66.0')+'/connect/cpq/configurator/actions/update-nodes',
    headers:{}, body: JSON.stringify(body), apiVersion: DEFAULT_API_VERSION||'v66.0' });
}

function cfgDeleteNode(tabId, nodeIdx){
  showConfirm('Delete this node from the configuration context?', function(){
    const s = cfgBuilderState[tabId];
    if(!s.contextId){ showToast('No active session.','error'); return; }
    const orgAlias = s.orgAlias || document.getElementById('org-select').value;
    if(!orgAlias){ showToast('Select an org first.','error'); return; }
    const pathArr = s._nodePaths && s._nodePaths[nodeIdx];
    if(!pathArr){ showToast('Node path not found — refresh tree first.','error'); return; }
    const body = {
      contextId: s.contextId,
      configuratorOptions: s.cfgOptions,
      deletedNodes: [{ path: pathArr }]
    };
    const reqId = ++reqCounter;
    pendingReqs[reqId] = function(result){
      _cfgHandleResponse(tabId, result, function(){
        _cfgShowResp(tabId, result, '');
        cfgGetInstance(tabId);
      });
    };
    vscMsg({ type:'executeCustom', requestId:reqId, orgAlias,
      method:'POST',
      path:'/services/data/'+(DEFAULT_API_VERSION||'v66.0')+'/connect/cpq/configurator/actions/delete-nodes',
      headers:{}, body: JSON.stringify(body), apiVersion: DEFAULT_API_VERSION||'v66.0' });
  });
}

function cfgSaveInstance(tabId){
  const s = cfgBuilderState[tabId];
  if(!s.contextId){ showToast('Load a session first.','error'); return; }
  const orgAlias = s.orgAlias || document.getElementById('org-select').value;
  if(!orgAlias){ showToast('Select an org first.','error'); return; }
  const reqId = ++reqCounter;
  pendingReqs[reqId] = function(result){
    _cfgHandleResponse(tabId, result, function(parsed){
      s.phase = 'saved';
      _cfgSetBadge(tabId, 'saved ✓', '#27ae60');
      _cfgShowResp(tabId, result, '');
      showToast('Configuration saved to Salesforce!','success');
    });
  };
  vscMsg({ type:'executeCustom', requestId:reqId, orgAlias,
    method:'POST',
    path:'/services/data/'+(DEFAULT_API_VERSION||'v66.0')+'/connect/cpq/configurator/actions/save-instance',
    headers:{}, body: JSON.stringify({contextId: s.contextId}), apiVersion: DEFAULT_API_VERSION||'v66.0' });
}

function cfgRunRules(tabId){
  const s = cfgBuilderState[tabId];
  if(!s.transactionId){ showToast('Enter a Transaction ID first.','error'); return; }
  if(!s.contextId){ showToast('Load a session first.','error'); return; }
  const orgAlias = s.orgAlias || document.getElementById('org-select').value;
  if(!orgAlias){ showToast('Select an org first.','error'); return; }
  const body = {
    transactionId: s.transactionId,
    transactionContextId: s.contextId,
    configuratorOptions: Object.assign({}, s.cfgOptions, {
      executeConfigurationRules: true,
      executePricing: true,
      returnProductCatalogData: false
    }),
    contextResponseType: 'Delta',
    addedNodes: [],
    updatedNodes: [],
    deletedNodes: []
  };
  if(s.accountId) body.qualificationContext = { accountId: s.accountId };
  const reqId = ++reqCounter;
  pendingReqs[reqId] = function(result){
    _cfgHandleResponse(tabId, result, function(parsed){
      if(parsed.contextId) s.contextId = parsed.contextId;
      _cfgShowResp(tabId, result, '');
    });
  };
  vscMsg({ type:'executeCustom', requestId:reqId, orgAlias,
    method:'POST',
    path:'/services/data/'+(DEFAULT_API_VERSION||'v66.0')+'/connect/cpq/configurator/actions/configure',
    headers:{}, body: JSON.stringify(body), apiVersion: DEFAULT_API_VERSION||'v66.0' });
}

function _cfgHandleResponse(tabId, result, onSuccess){
  let parsed = null;
  try{ parsed = JSON.parse(result.body); }catch(_){}

  // RC error shapes: { success:false, errors:[] } OR [{ message, errorCode }] (array at root)
  const errArray = Array.isArray(parsed) ? parsed : (parsed && parsed.errors && parsed.success === false ? parsed.errors : null);
  const firstErr = errArray && errArray[0];
  const errCode = firstErr && (firstErr.errorCode || firstErr.code);
  const errMsg  = firstErr && (firstErr.message || firstErr.msg || '');

  if(errCode === 'CONTEXT_NOT_FOUND' || errCode === 'INVALID_SESSION_ID'){
    const s = cfgBuilderState[tabId];
    s.contextId = ''; s.phase = 'idle';
    _cfgSetBadge(tabId, 'session expired', '#e74c3c');
    const ctxInput = document.getElementById('cfg-ctx-'+tabId);
    if(ctxInput) ctxInput.value = '';
    showToast('Session expired — click Load Session to restart.','error');
    _cfgShowResp(tabId, result, '');
    return;
  }

  if(result.status >= 400){
    const msg = errMsg || (parsed ? JSON.stringify(parsed).substring(0,120) : ('HTTP '+result.status));
    _cfgShowResp(tabId, result, '');
    showToast(msg.substring(0,100),'error');
    return;
  }

  if(parsed && parsed.success === false && errMsg){
    _cfgShowResp(tabId, result, '<span style="color:#e74c3c">'+esc(errMsg)+'</span>');
    showToast(errMsg.substring(0,80),'error');
    return;
  }

  if(onSuccess) onSuccess(parsed || {});
}

function _cfgShowResp(tabId, result, extraHtml){
  const el = document.getElementById('cfg-resp-'+tabId);
  const pill = document.getElementById('cfg-resp-pill-'+tabId);
  if(!el) return;
  const ok = result.status >= 200 && result.status < 300;
  if(pill) pill.innerHTML = '<span style="font-size:11px;font-weight:600;color:'+(ok?'#27ae60':'#e74c3c')+'">HTTP '+result.status+'</span>' +
    (result.durationMs ? ' <span style="font-size:10px;color:var(--fg3)">'+result.durationMs+'ms</span>' : '');
  let body = result.body || '';
  try{ body = JSON.stringify(JSON.parse(body), null, 2); }catch(_){}
  el.innerHTML = (extraHtml||'') + '<pre style="margin:0;white-space:pre-wrap;word-break:break-all">'+esc(body)+'</pre>';
}

function _cfgSetBadge(tabId, label, color){
  const el = document.getElementById('cfg-phase-badge-'+tabId);
  if(!el) return;
  el.textContent = label;
  el.style.background = color+'22';
  el.style.color = color;
  el.style.border = '1px solid '+color+'55';
}

function _buildCfgReference(){
  return '<div style="padding:4px 0;font-size:12px;color:var(--fg)">' +
    '<div style="font-size:13px;font-weight:600;margin-bottom:12px">Configurator Session Lifecycle</div>' +
    '<div style="display:flex;align-items:center;gap:6px;margin-bottom:16px;flex-wrap:wrap;font-size:11px">' +
      '<div style="padding:5px 10px;background:#e67e2222;border:1px solid #e67e22;border-radius:5px;color:#e67e22;font-weight:600">1. load-instance</div>' +
      '<span style="color:var(--fg3)">→</span>' +
      '<div style="padding:5px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:5px">2. add-nodes / update-nodes / delete-nodes</div>' +
      '<span style="color:var(--fg3)">→</span>' +
      '<div style="padding:5px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:5px">3. (optional) run-rules</div>' +
      '<span style="color:var(--fg3)">→</span>' +
      '<div style="padding:5px 10px;background:#27ae6022;border:1px solid #27ae60;border-radius:5px;color:#27ae60;font-weight:600">4. save-instance</div>' +
    '</div>' +

    '<div style="font-size:12px;font-weight:600;margin-bottom:8px">addedNodes path rules</div>' +
    '<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:14px">' +
      '<thead><tr style="border-bottom:1px solid var(--border)">' +
        '<th style="text-align:left;padding:4px 8px;color:var(--fg3)">businessObjectType</th>' +
        '<th style="text-align:left;padding:4px 8px;color:var(--fg3)">path length</th>' +
        '<th style="text-align:left;padding:4px 8px;color:var(--fg3)">path contents</th>' +
      '</tr></thead>' +
      '<tbody>' +
        '<tr style="border-bottom:1px solid var(--border)"><td style="padding:4px 8px">QuoteLineItem</td><td style="padding:4px 8px">2</td><td style="padding:4px 8px;font-family:monospace">[quoteId, ref_QLI]</td></tr>' +
        '<tr style="border-bottom:1px solid var(--border)"><td style="padding:4px 8px">QuoteLineRelationship</td><td style="padding:4px 8px">3</td><td style="padding:4px 8px;font-family:monospace">[quoteId, ref_QLI, ref_Rel]</td></tr>' +
        '<tr style="border-bottom:1px solid var(--border)"><td style="padding:4px 8px">OrderItem</td><td style="padding:4px 8px">2</td><td style="padding:4px 8px;font-family:monospace">[orderId, ref_Item]</td></tr>' +
        '<tr><td style="padding:4px 8px">OrderItemRelationship</td><td style="padding:4px 8px">3</td><td style="padding:4px 8px;font-family:monospace">[orderId, ref_Item, ref_Rel]</td></tr>' +
      '</tbody>' +
    '</table>' +

    '<div style="font-size:12px;font-weight:600;margin-bottom:8px">addedObject required fields (QLI)</div>' +
    '<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:14px">' +
      '<thead><tr style="border-bottom:1px solid var(--border)">' +
        '<th style="text-align:left;padding:4px 8px;color:var(--fg3)">Field</th>' +
        '<th style="text-align:left;padding:4px 8px;color:var(--fg3)">Value</th>' +
      '</tr></thead>' +
      '<tbody>' +
        '<tr style="border-bottom:1px solid var(--border)"><td style="padding:4px 8px;font-family:monospace">id</td><td style="padding:4px 8px">same as localRef (ref_…)</td></tr>' +
        '<tr style="border-bottom:1px solid var(--border)"><td style="padding:4px 8px;font-family:monospace">SalesTransactionItemSource</td><td style="padding:4px 8px">same as id</td></tr>' +
        '<tr style="border-bottom:1px solid var(--border)"><td style="padding:4px 8px;font-family:monospace">SalesTransactionItemParent</td><td style="padding:4px 8px">transactionId (Quote/Order)</td></tr>' +
        '<tr style="border-bottom:1px solid var(--border)"><td style="padding:4px 8px;font-family:monospace">businessObjectType</td><td style="padding:4px 8px">QuoteLineItem or OrderItem</td></tr>' +
        '<tr style="border-bottom:1px solid var(--border)"><td style="padding:4px 8px;font-family:monospace">PricebookEntry</td><td style="padding:4px 8px">01u… ID</td></tr>' +
        '<tr style="border-bottom:1px solid var(--border)"><td style="padding:4px 8px;font-family:monospace">ProductSellingModel</td><td style="padding:4px 8px">0jP… ID</td></tr>' +
        '<tr style="border-bottom:1px solid var(--border)"><td style="padding:4px 8px;font-family:monospace">Product</td><td style="padding:4px 8px">01t… ID</td></tr>' +
        '<tr style="border-bottom:1px solid var(--border)"><td style="padding:4px 8px;font-family:monospace">Quantity</td><td style="padding:4px 8px">number</td></tr>' +
        '<tr><td style="padding:4px 8px;font-family:monospace">UnitPrice</td><td style="padding:4px 8px">number (0 if pricing executes)</td></tr>' +
      '</tbody>' +
    '</table>' +

    '<div style="font-size:11px;background:var(--bg3);padding:8px 10px;border-radius:5px;color:var(--fg2)">' +
      '<b>Tip:</b> Set <code>returnProductCatalogData: false</code> in options when calling without the Configurator UI — it reduces response size. ' +
      'Session contexts expire after ~30 min of inactivity. If you get CONTEXT_NOT_FOUND, reload the session.' +
    '</div>' +
  '</div>';
}

// ── PST Configurator Modal (PCM API → auto-populate inserts) ──────────────────

let _pstCfgState = {};  // keyed by tabId+localRef

function pstOpenConfigurator(tabId, localRef){
  const s = pstState[tabId];
  const ins = s.newInserts.find(i => i.localRef === localRef);
  if(!ins){ showToast('Insert not found.','error'); return; }

  const liveProductId = ins.product2Id.trim();
  if(!liveProductId){ showToast('Enter a Product2Id before configuring.','error'); return; }

  const stateKey = tabId + ':' + localRef;
  const orgAlias = document.getElementById('org-select')?.value || '';
  _pstCfgState[stateKey] = { tabId, localRef, product: null, selections: {}, compSelections: {}, compAttrSelections: {}, subProductCache: {}, pendingSubFetch: new Set(), orgAlias, applyTarget: 'pst' };
  _pcmFetchAndOpenCfg(stateKey, liveProductId, orgAlias);
}

// Validates that all @{referenceId} cross-references in relationship records have .id suffix
function _validateOrderGraphRefs(tabId){
  const warnings = [];
  try{
    const graph = _buildOrderGraph(tabId);
    const records = graph.graph.records || [];
    records.forEach(function(r){
      const rec = r.record || {};
      Object.entries(rec).forEach(function([field, val]){
        if(typeof val === 'string' && val.startsWith('@{') && !val.endsWith('.id}')){
          warnings.push(field + ': "' + val + '" is missing .id — did you mean "' + val.replace('}','.id}') + '"?');
        }
      });
    });
  } catch(_){}
  return warnings;
}

// Diagnoses org RC readiness by running 3 checks in parallel
function obDiagnoseContext(tabId){
  const orgAlias = document.getElementById('org-select').value;
  if(!orgAlias){ showToast('Select an org first.','error'); return; }
  const respEl = document.getElementById('ob-resp-'+tabId);
  const pill = document.getElementById('ob-pill-'+tabId);
  if(respEl){ respEl.style.color='var(--fg3)'; respEl.textContent='Running org diagnostics…'; }
  if(pill){ pill.innerHTML='<div style="font-size:11px;color:var(--fg3);padding:4px 0">⌛ Checking org…</div>'; }

  const results = {};
  function _render(){
    if(Object.keys(results).length < 3) return;
    let html = '<div style="font-size:12px;font-weight:600;color:var(--fg2);margin-bottom:8px">&#128270; Org Diagnostic Results</div>';

    // Check 1: AppUsageAssignment (RC enabled?)
    const r1 = results.appUsage;
    const rcEnabled = r1 && r1.totalSize > 0;
    html += _diagRow('Revenue Cloud enabled (AppUsageAssignment records exist)', rcEnabled,
      rcEnabled ? r1.totalSize+' record(s) found' : 'No AppUsageAssignment records — Revenue Cloud may not be enabled or no orders placed yet');

    // Check 2: Pricebook
    const r2 = results.pricebook;
    const hasPb = r2 && r2.totalSize > 0;
    html += _diagRow('Standard/Active Pricebooks available', hasPb,
      hasPb ? r2.records.slice(0,3).map(function(p){ return esc(p.Name)+' ('+esc(p.Id)+')'; }).join(', ') : 'No active pricebooks found');

    // Check 3: RC connect API accessible
    const r3 = results.connect;
    const connectOk = r3 && !r3.error && r3.status !== 0;
    const connectMsg = r3 ? (r3.status===404 ? 'API path accessible (404 expected for GET)' : r3.status===405 ? 'API accessible (405 = method not allowed for GET, expected)' : 'HTTP '+r3.status) : 'Failed to reach';
    html += _diagRow('Place Sales Transaction API reachable', connectOk || (r3&&(r3.status===404||r3.status===405)),
      connectMsg + ' — if this fails check API version and org permissions');

    html += '<div style="margin-top:8px;font-size:10px;color:var(--fg3)">'+
      'For <b>SalesTransactionContext</b> errors: check <b>Setup → Revenue Cloud → Sales Transaction Context Definitions</b> — the context definition must be <b>Active</b>.</div>';

    if(pill) pill.innerHTML = html;
    if(respEl){ respEl.style.color='var(--fg3)'; respEl.textContent = JSON.stringify(results, null, 2); }
  }

  function _diagRow(label, ok, detail){
    const icon = ok ? '&#9989;' : '&#9888;';
    const color = ok ? '#27ae60' : '#e67e22';
    return '<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:6px;padding:5px 8px;background:var(--bg3);border-radius:4px">'+
      '<span style="font-size:13px">'+icon+'</span>'+
      '<div><div style="font-size:11px;font-weight:500;color:'+color+'">'+label+'</div>'+
      '<div style="font-size:10px;color:var(--fg3);margin-top:1px">'+detail+'</div></div></div>';
  }

  // Check 1: AppUsageAssignment records
  const r1 = ++reqCounter;
  pendingReqs[r1] = function(res){
    try{ results.appUsage = JSON.parse(res.body); }catch(_){ results.appUsage = {totalSize:0}; }
    _render();
  };
  const q1 = encodeURIComponent("SELECT Id,AppUsageType FROM AppUsageAssignment WHERE AppUsageType='RevenueLifecycleManagement' LIMIT 5");
  vscMsg({type:'executeCustom', requestId:r1, orgAlias, method:'GET', path:'/services/data/v66.0/query/?q='+q1, headers:{}, body:'', apiVersion:'v66.0'});

  // Check 2: Active pricebooks
  const r2 = ++reqCounter;
  pendingReqs[r2] = function(res){
    try{ results.pricebook = JSON.parse(res.body); }catch(_){ results.pricebook = {totalSize:0, records:[]}; }
    _render();
  };
  const q2 = encodeURIComponent("SELECT Id,Name FROM Pricebook2 WHERE IsActive=true LIMIT 3");
  vscMsg({type:'executeCustom', requestId:r2, orgAlias, method:'GET', path:'/services/data/v66.0/query/?q='+q2, headers:{}, body:'', apiVersion:'v66.0'});

  // Check 3: RC connect API reachable (GET returns 404/405 — that's fine, just checking auth + path)
  const r3 = ++reqCounter;
  pendingReqs[r3] = function(res){
    results.connect = {status: res.status};
    _render();
  };
  vscMsg({type:'executeCustom', requestId:r3, orgAlias, method:'GET', path:'/services/data/v66.0/connect/rev/sales-transaction/actions/place', headers:{}, body:'', apiVersion:'v66.0'});
}

function obOpenConfigurator(tabId, localRef){
  const s = orderState[tabId];
  const item = s.items.find(i => i.localRef === localRef);
  if(!item){ showToast('Item not found.','error'); return; }

  const liveProductId = item.product2Id.trim();
  if(!liveProductId){ showToast('Enter a Product2Id before configuring.','error'); return; }

  const stateKey = tabId + ':' + localRef;
  const orgAlias = document.getElementById('org-select')?.value || '';
  _pstCfgState[stateKey] = { tabId, localRef, product: null, selections: {}, compSelections: {}, compAttrSelections: {}, subProductCache: {}, pendingSubFetch: new Set(), orgAlias, applyTarget: 'order' };
  _pcmFetchAndOpenCfg(stateKey, liveProductId, orgAlias);
}

function _pcmFetchAndOpenCfg(stateKey, productId, orgAlias){
  _pstShowCfgOverlay(null, null, '<div style="padding:30px;text-align:center;color:var(--fg3)">Loading product structure…</div>');

  const rId = ++reqCounter;
  pendingReqs[rId] = (r) => {
    const st = _pstCfgState[stateKey];
    try {
      const data = JSON.parse(r.body);
      const p = (data.products || [data])[0];
      if(!p || !p.id){ _pstShowCfgOverlay(null, null, '<div style="padding:20px;color:var(--red)">Product not found or API error: '+esc(r.body.slice(0,200))+'</div>'); return; }
      st.product = p;

      // Resolve defaultValue to picklist ID (defaultValue may be label/value, not ID)
      function _resolvePicklistId(attr, rawDefault){
        if(!rawDefault || attr.dataType !== 'Picklist') return rawDefault;
        const match = (attr.picklist?.values||[]).find(v => v.id===rawDefault || v.value===rawDefault || v.displayValue===rawDefault);
        return match ? match.id : rawDefault;
      }

      // Init bundle-level attribute defaults
      (p.attributeCategory||[]).forEach(cat => {
        (cat.attributes||[]).forEach(a => {
          if(a.defaultValue) st.selections[a.id] = _resolvePicklistId(a, a.defaultValue);
        });
      });
      // Init component selections + attribute defaults recursively
      function _initCompDefaults(comp){
        const prc = comp.productRelatedComponent||{};
        if(prc.isComponentRequired || prc.isDefaultComponent) st.compSelections[comp.id] = true;
        st.compAttrSelections[comp.id] = {};
        (comp.attributeCategory||[]).forEach(cat => {
          (cat.attributes||[]).forEach(a => {
            if(a.defaultValue) st.compAttrSelections[comp.id][a.id] = _resolvePicklistId(a, a.defaultValue);
          });
        });
        (comp.productComponentGroups||[]).forEach(sg => {
          (sg.components||[]).forEach(sc => _initCompDefaults(sc));
        });
      }
      (p.productComponentGroups||[]).forEach(g => {
        (g.components||[]).forEach(c => _initCompDefaults(c));
      });
      _pstRenderConfigModal(stateKey);
    } catch(e) {
      _pstShowCfgOverlay(null, null, '<div style="padding:20px;color:var(--red)">Parse error: '+esc(String(e))+'</div>');
    }
  };
  vscMsg({ type:'executeCustom', requestId:rId, orgAlias,
    method:'GET',
    path:'/services/data/v66.0/connect/pcm/products/'+encodeURIComponent(productId),
    headers:{}, body:'', apiVersion:'v61.0' });
}

function _pstShowCfgOverlay(tabId, localRef, content){
  const existing = document.getElementById('pst-cfg-overlay');
  if(existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'pst-cfg-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML =
    '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:6px;width:min(680px,96vw);max-height:85vh;display:flex;flex-direction:column;overflow:hidden">' +
      '<div style="display:flex;align-items:center;padding:10px 14px;border-bottom:1px solid var(--border)">' +
        '<span style="font-weight:700;font-size:13px;flex:1">⚙ Configure Product</span>' +
        '<button class="icon-btn" style="font-size:14px;padding:1px 7px" onclick="document.querySelectorAll(\'#pst-cfg-overlay\').forEach(e=>e.remove())">✕</button>' +
      '</div>' +
      '<div id="pst-cfg-body" style="flex:1;overflow-y:auto;padding:14px">' + content + '</div>' +
      '<div id="pst-cfg-footer" style="padding:10px 14px;border-top:1px solid var(--border);display:flex;gap:8px;justify-content:flex-end"></div>' +
    '</div>';
  document.body.appendChild(overlay);
}

function _pstRenderConfigModal(stateKey){
  const st = _pstCfgState[stateKey];
  if(!st) return;
  const p = st.product;
  const tabId = st.tabId;
  const localRef = st.localRef;

  let html = '';

  // Product header
  html += '<div style="font-size:12px;font-weight:600;color:var(--fg);margin-bottom:10px">'+esc(p.name)+'</div>';
  html += '<div style="font-size:10px;color:var(--fg3);margin-bottom:12px;font-family:monospace">'+esc(p.id)+' · '+esc(p.nodeType||'')+'</div>';

  // Selling models
  const models = p.productSellingModelOptions||[];
  if(models.length > 1){
    html += '<div style="margin-bottom:12px"><div style="font-size:10px;font-weight:600;color:var(--fg2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Selling Model</div>';
    models.forEach(m => {
      const sm = m.productSellingModel||{};
      const checked = m.isDefault || false;
      html += '<label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--fg2);margin-bottom:4px;cursor:pointer">' +
        '<input type="radio" name="pst-cfg-model-'+stateKey+'" value="'+esc(sm.id||sm.name)+'"'+(checked?' checked':'')+' onchange="_pstCfgState[\''+stateKey+'\'].selectedModel=this.value"> '+
        esc(sm.name)+' <span style="font-size:9px;color:var(--fg3)">('+esc(sm.sellingModelType||'')+(sm.pricingTerm?' · '+sm.pricingTerm+' '+sm.pricingTermUnit:'')+')' +'</span></label>';
    });
    html += '</div>';
  }

  // Attributes
  const cats = p.attributeCategory||[];
  if(cats.length){
    html += '<div style="margin-bottom:12px"><div style="font-size:10px;font-weight:600;color:var(--fg2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Attributes</div>';
    html += '<div style="border:1px solid var(--border);border-radius:4px;overflow:hidden">';
    let first = true;
    cats.forEach(cat => {
      (cat.attributes||[]).forEach(a => {
        const curVal = st.selections[a.id] || a.defaultValue || '';
        html += '<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;'+(first?'':'border-top:1px solid rgba(255,255,255,.05);')+'background:rgba(0,0,0,.1)">';
        first = false;
        html += '<span style="font-size:11px;color:var(--fg2);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+esc(a.id)+'">'+esc(a.name)+(a.isRequired?' <span style="color:var(--red)">*</span>':'')+'</span>';
        if(a.dataType === 'Picklist' && a.picklist?.values?.length){
          html += '<select class="try-inp" style="font-size:11px;padding:2px 5px;max-width:180px" onchange="_pstCfgState[\''+stateKey+'\'].selections[\''+esc(a.id)+'\']=this.value">';
          html += '<option value="">— select —</option>';
          (a.picklist.values||[]).forEach(v => {
            const selected = (v.value === curVal || v.displayValue === curVal || v.id === curVal);
            html += '<option value="'+esc(v.id)+'"'+(selected?' selected':'')+'>'+esc(v.displayValue||v.value)+'</option>';
          });
          html += '</select>';
        } else {
          html += '<input class="try-inp" value="'+esc(curVal)+'" placeholder="value" style="font-size:11px;padding:2px 5px;width:160px" onchange="_pstCfgState[\''+stateKey+'\'].selections[\''+esc(a.id)+'\']=this.value">';
        }
        html += '</div>';
      });
    });
    html += '</div></div>';
  }

  // Recursive component group renderer
  function _renderCompGroupHtml(groups, depth){
    let h = '';
    const indent = depth * 16;
    groups.forEach(g => {
      const min = g.minBundleComponents ?? 0;
      const max = g.maxBundleComponents ?? '∞';
      const borderColor = depth === 0 ? 'var(--border)' : 'rgba(255,255,255,.1)';
      h += '<div style="margin-left:'+indent+'px;margin-bottom:6px;border:1px solid '+borderColor+';border-radius:4px;overflow:hidden">';
      h += '<div style="background:rgba(255,255,255,.04);padding:3px 8px;font-size:10px;color:var(--fg2)">'+esc(g.name)+' <span style="color:var(--fg3)">(min:'+min+' max:'+max+')</span></div>';
      (g.components||[]).forEach((c, ci) => {
        const prc = c.productRelatedComponent||{};
        const checked = !!st.compSelections[c.id];
        const disabled = prc.isComponentRequired;
        const compAttrs = (c.attributeCategory||[]).flatMap(cat => cat.attributes||[]);
        const hasSubGroups = (c.productComponentGroups||[]).length > 0;
        const isBundle = c.nodeType === 'bundleProduct';

        h += '<div style="border-top:1px solid rgba(255,255,255,.04)">';
        h += '<label style="display:flex;align-items:center;gap:7px;padding:4px 8px;cursor:'+(disabled?'default':'pointer')+';background:rgba(0,0,0,.1)">';
        h += '<input type="checkbox" '+(checked?'checked ':'')+''+(disabled?'disabled ':'')+
             ' onchange="_pstCfgToggleComp(\''+stateKey+'\',\''+esc(g.id||String(ci))+'\',\''+esc(c.id)+'\',this.checked,'+min+','+max+')">';
        h += '<span style="font-size:11px;color:var(--fg2);flex:1">'+esc(c.name)+'</span>';
        const tags = [];
        if(hasSubGroups){ const subCount = (c.productComponentGroups||[]).reduce((n,sg)=>n+(sg.components||[]).length,0); tags.push('<span style="font-size:9px;padding:0 4px;border-radius:2px;background:rgba(200,150,50,.2);color:#e0c080">Bundle · '+subCount+' sub</span>'); }
        else if(isBundle)                   tags.push('<span style="font-size:9px;padding:0 4px;border-radius:2px;background:rgba(200,150,50,.2);color:#e0c080">Bundle</span>');
        if(prc.isComponentRequired)         tags.push('<span style="font-size:9px;padding:0 4px;border-radius:2px;background:rgba(200,50,50,.2);color:#e08080">Required</span>');
        if(prc.isDefaultComponent)          tags.push('<span style="font-size:9px;padding:0 4px;border-radius:2px;background:rgba(80,80,200,.2);color:#8080e0">Default</span>');
        if(prc.doesBundlePriceIncludeChild) tags.push('<span style="font-size:9px;padding:0 4px;border-radius:2px;background:rgba(50,150,50,.2);color:#80c080">Included</span>');
        if(compAttrs.length)                tags.push('<span style="font-size:9px;padding:0 4px;border-radius:2px;background:rgba(80,150,200,.15);color:#7eb5e8">'+compAttrs.length+' attr'+(compAttrs.length>1?'s':'')+'</span>');
        h += tags.join(' ')+'</label>';

        // Attributes for this component — shown when checked
        if(checked && compAttrs.length){
          h += '<div style="margin:0 8px 4px '+(24+indent)+'px;border:1px solid rgba(126,181,232,.2);border-radius:3px;overflow:hidden">';
          h += '<div style="background:rgba(126,181,232,.07);padding:3px 7px;font-size:9px;color:#7eb5e8;font-weight:600;text-transform:uppercase;letter-spacing:.5px">'+esc(c.name)+' Attributes</div>';
          compAttrs.forEach(a => {
            const curVal = (st.compAttrSelections[c.id]||{})[a.id] || a.defaultValue || '';
            h += '<div style="display:flex;align-items:center;gap:8px;padding:4px 7px;border-top:1px solid rgba(255,255,255,.04);background:rgba(0,0,0,.1)">';
            h += '<span style="font-size:11px;color:var(--fg2);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+esc(a.id)+'">'+esc(a.name)+(a.isRequired?' <span style="color:var(--red)">*</span>':'')+'</span>';
            const cid = esc(c.id), aid = esc(a.id);
            const onChange = 'if(!_pstCfgState[\''+stateKey+'\'].compAttrSelections[\''+cid+'\'])_pstCfgState[\''+stateKey+'\'].compAttrSelections[\''+cid+'\']={}; _pstCfgState[\''+stateKey+'\'].compAttrSelections[\''+cid+'\'][\''+aid+'\']=this.value';
            if(a.dataType === 'Picklist' && a.picklist?.values?.length){
              h += '<select class="try-inp" style="font-size:11px;padding:2px 5px;max-width:160px" onchange="'+onChange+'">';
              h += '<option value="">— select —</option>';
              (a.picklist.values||[]).forEach(v => {
                const sel = v.value===curVal||v.displayValue===curVal||v.id===curVal;
                h += '<option value="'+esc(v.id)+'"'+(sel?' selected':'')+'>'+esc(v.displayValue||v.value)+'</option>';
              });
              h += '</select>';
            } else {
              h += '<input class="try-inp" value="'+esc(curVal)+'" placeholder="value" style="font-size:11px;padding:2px 5px;width:140px" onchange="'+onChange+'">';
            }
            h += '</div>';
          });
          h += '</div>';
        }

        // Sub-component groups — always visible, dimmed when parent unchecked; spinner while loading
        if(isBundle){
          const isPending = checked && st.pendingSubFetch && st.pendingSubFetch.has(c.id);
          const subGroups = c.productComponentGroups||[];
          h += '<div style="padding:4px 8px 6px 8px;transition:opacity .15s'+(checked?'':';opacity:.35;pointer-events:none')+'">';
          if(!checked){
            h += '<div style="font-size:9px;color:var(--fg3);padding:0 2px 3px 2px;font-style:italic">↑ check '+esc(c.name)+' to expand sub-options</div>';
          } else if(isPending){
            h += '<div style="font-size:10px;color:var(--fg3);padding:4px 2px;font-style:italic">⏳ Loading sub-components…</div>';
          } else if(subGroups.length){
            h += _renderCompGroupHtml(subGroups, depth+1);
          } else {
            h += '<div style="font-size:9px;color:var(--fg3);padding:2px 2px;font-style:italic">No sub-components found</div>';
          }
          h += '</div>';
        }

        h += '</div>';
      });
      h += '</div>';
    });
    return h;
  }

  // Component groups
  const groups = p.productComponentGroups||[];
  if(groups.length){
    html += '<div><div style="font-size:10px;font-weight:600;color:var(--fg2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Bundle Components</div>';
    html += _renderCompGroupHtml(groups, 0);
    html += '</div>';
  }

  _pstShowCfgOverlay(null, null, html);

  // Footer button — route by applyTarget
  const footer = document.getElementById('pst-cfg-footer');
  if(footer){
    const isOrder = st.applyTarget === 'order';
    const applyFn = isOrder ? '_obApplyConfiguration' : '_pstApplyConfiguration';
    const applyLabel = isOrder ? '✓ Apply to Order Builder' : '✓ Apply to PST Builder';
    footer.innerHTML =
      '<span style="font-size:10px;color:var(--fg3);flex:1">Applies attributes + selected components as child inserts</span>' +
      '<button class="btn btn-sec" style="font-size:11px" onclick="document.querySelectorAll(\'#pst-cfg-overlay\').forEach(e=>e.remove())">Cancel</button>' +
      '<button class="btn" style="font-size:11px;background:#2a6a2a" onclick="'+applyFn+'(\''+stateKey+'\')">'+applyLabel+'</button>';
  }
}

function _pstCfgToggleComp(stateKey, groupId, compId, checked, min, max){
  const st = _pstCfgState[stateKey];
  if(!st) return;
  st.compSelections[compId] = checked;

  // If checked and this component's sub-structure hasn't been fetched yet, fetch it
  if(checked && !st.subProductCache[compId] && !st.pendingSubFetch.has(compId)){
    // Find the component in the tree to check if it's a bundle
    function _findComp(groups){
      for(const g of groups||[]){
        for(const c of g.components||[]){
          if(c.id === compId) return c;
          const found = _findComp(c.productComponentGroups);
          if(found) return found;
        }
      }
      return null;
    }
    const comp = _findComp(st.product.productComponentGroups);
    // Fetch sub-structure for any component that might be a bundle (nodeType bundleProduct or unknown)
    // nodeType may not be set on deeply merged components, so fetch unless it's explicitly simpleProduct with no sub-groups
    const skipFetch = comp && comp.nodeType === 'simpleProduct' && !(comp.productComponentGroups||[]).length;
    if(comp && !skipFetch){
      st.pendingSubFetch.add(compId);
      // Show loading indicator under this component
      _pstRenderConfigModal(stateKey);
      // Fetch sub-structure
      const rId = ++reqCounter;
      pendingReqs[rId] = (r) => {
        st.pendingSubFetch.delete(compId);
        try {
          const data = JSON.parse(r.body);
          const subP = (data.products||[data])[0];
          if(subP && subP.id){
            st.subProductCache[compId] = subP;
            // Merge sub-groups back into the component in the product tree
            function _mergeIntoTree(groups){
              for(const g of groups||[]){
                for(const c of g.components||[]){
                  if(c.id === compId){
                    c.productComponentGroups = subP.productComponentGroups||[];
                    c.attributeCategory = subP.attributeCategory||[];
                    return true;
                  }
                  if(_mergeIntoTree(c.productComponentGroups)) return true;
                }
              }
              return false;
            }
            _mergeIntoTree(st.product.productComponentGroups);
            // Init defaults for newly loaded sub-components
            function _initSubDefaults(comp2){
              const prc = comp2.productRelatedComponent||{};
              if(prc.isComponentRequired||prc.isDefaultComponent) st.compSelections[comp2.id]=true;
              if(!st.compAttrSelections[comp2.id]) st.compAttrSelections[comp2.id]={};
              (comp2.attributeCategory||[]).forEach(cat=>(cat.attributes||[]).forEach(a=>{
                if(a.defaultValue) st.compAttrSelections[comp2.id][a.id]=a.defaultValue;
              }));
              (comp2.productComponentGroups||[]).forEach(sg=>(sg.components||[]).forEach(sc=>_initSubDefaults(sc)));
            }
            (subP.productComponentGroups||[]).forEach(sg=>(sg.components||[]).forEach(sc=>_initSubDefaults(sc)));
          }
        } catch(e){ console.warn('[Configure] sub-fetch parse error', e); }
        _pstRenderConfigModal(stateKey);
      };
      vscMsg({ type:'executeCustom', requestId:rId, orgAlias:st.orgAlias||pstState[st.tabId].orgAlias,
        method:'GET', path:'/services/data/v66.0/connect/pcm/products/'+encodeURIComponent(compId),
        headers:{}, body:'', apiVersion:'v61.0' });
      return;
    }
  }

  _pstRenderConfigModal(stateKey);
}

function _pstApplyConfiguration(stateKey){
  const st = _pstCfgState[stateKey];
  if(!st) return;
  const { tabId, localRef, product, selections, compSelections } = st;
  const s = pstState[tabId];
  const ins = s.newInserts.find(i => i.localRef === localRef);
  if(!ins) return;

  // Clear existing attrs on this insert
  ins.attrs = [];

  // Apply attribute selections
  (product.attributeCategory||[]).forEach(cat => {
    (cat.attributes||[]).forEach(a => {
      const val = selections[a.id];
      if(!val) return;
      const isPicklist = a.dataType === 'Picklist';
      ins.attrs.push({
        attrDefId: a.id,
        usePicklist: isPicklist,
        picklistValueId: isPicklist ? val : '',
        attrValue: !isPicklist ? val : ''
      });
    });
  });

  // Remove ALL descendant inserts that came from a previous Configure apply (any depth)
  const _fromConfigRefs = new Set();
  function _collectConfigRefs(parentRef){
    s.newInserts.forEach(i => {
      if(i._fromConfigure && i.parentRef === parentRef){
        _fromConfigRefs.add(i.localRef);
        _collectConfigRefs(i.localRef);
      }
    });
  }
  _collectConfigRefs(localRef);
  s.newInserts = s.newInserts.filter(i => !_fromConfigRefs.has(i.localRef));

  // Recursively add child inserts for all selected components at every depth
  function _addCompInserts(groups, parentRef, parentLabel){
    (groups||[]).forEach(g => {
      (g.components||[]).forEach(c => {
        if(!compSelections[c.id]) return;
        const prc = c.productRelatedComponent||{};
        const childRef = 'ref_ins_' + (s.insertCounter++);
        const compAttrs = [];
        (c.attributeCategory||[]).forEach(cat => {
          (cat.attributes||[]).forEach(a => {
            const val = (st.compAttrSelections[c.id]||{})[a.id] || a.defaultValue || '';
            if(!val) return;
            const isPicklist = a.dataType === 'Picklist';
            compAttrs.push({ attrDefId: a.id, usePicklist: isPicklist, picklistValueId: isPicklist ? val : '', attrValue: !isPicklist ? val : '' });
          });
        });
        s.newInserts.push({
          localRef: childRef,
          product2Id: c.id,
          pbeId: '',
          qty: String(prc.quantity || 1),
          billingFreq: '',
          parentRef,
          parentLabel,
          attrs: compAttrs,
          _fromConfigure: true,
          _componentName: c.name
        });
        // Recurse into this component's sub-groups if it's a bundle
        if((c.productComponentGroups||[]).length){
          _addCompInserts(c.productComponentGroups, childRef, c.name);
        }
      });
    });
  }
  _addCompInserts(product.productComponentGroups, localRef, ins.product2Id || localRef);

  // Close all cfg overlays
  document.querySelectorAll('#pst-cfg-overlay').forEach(el => el.remove());
  _renderPstTree(tabId);
  if(s.previewActive) pstPreview(tabId);
}

function _obApplyConfiguration(stateKey){
  const st = _pstCfgState[stateKey];
  if(!st) return;
  const { tabId, localRef, product, selections, compSelections, compAttrSelections } = st;
  const s = orderState[tabId];
  if(!s) return;
  const item = s.items.find(i => i.localRef === localRef);
  if(!item) return;

  // Build attrs from bundle-level attributes
  const newAttrs = [];
  (product.attributeCategory||[]).forEach(cat => {
    (cat.attributes||[]).forEach(a => {
      const val = selections[a.id];
      if(!val) return;
      const isPicklist = a.dataType === 'Picklist';
      newAttrs.push({ attrDefId: a.id, usePicklist: isPicklist, picklistValueId: isPicklist ? val : '', attrValue: !isPicklist ? val : '' });
    });
  });
  item.attrs = newAttrs;

  // Remove existing child items that came from a previous Configure apply
  s.items = s.items.filter(i => !(i._fromConfigure && i.parentRef === localRef));

  // Recursively add child items for selected components
  function _addCompItems(groups, parentRef, parentLabel){
    (groups||[]).forEach(g => {
      (g.components||[]).forEach(c => {
        if(!compSelections[c.id]) return;
        const prc = c.productRelatedComponent||{};
        const childRef = 'refItem_' + (s.itemCounter++);
        const compAttrs = [];
        (c.attributeCategory||[]).forEach(cat => {
          (cat.attributes||[]).forEach(a => {
            const val = (compAttrSelections[c.id]||{})[a.id] || a.defaultValue || '';
            if(!val) return;
            const isPicklist = a.dataType === 'Picklist';
            compAttrs.push({ attrDefId: a.id, usePicklist: isPicklist, picklistValueId: isPicklist ? val : '', attrValue: !isPicklist ? val : '' });
          });
        });
        s.items.push({ localRef: childRef, op: 'POST', product2Id: c.id, pbeId: '', qty: String(prc.quantity||1), unitPrice: '0', orderItemId: '', parentRef, parentLabel, attrs: compAttrs, _fromConfigure: true, _collapsed: false });
        if((c.productComponentGroups||[]).length){
          _addCompItems(c.productComponentGroups, childRef, c.name);
        }
      });
    });
  }
  _addCompItems(product.productComponentGroups, localRef, item.product2Id || localRef);

  document.querySelectorAll('#pst-cfg-overlay').forEach(el => el.remove());
  _obRenderItems(tabId);
  if(orderState[tabId].previewActive) obPreview(tabId);
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escTA(s){ return String(s||'').replace(/<\/textarea/gi,'&lt;/textarea'); }

// ── Shared UI helpers (reused across catalog, custom, PST, Swap, Order) ───────

/** Build status pill HTML from an HTTP status code + duration. */
function statusPillHtml(status, durationMs){
  let cls='serr', label='Error';
  if(status>=200&&status<300){ cls='s2xx'; label='HTTP '+status+' OK'; }
  else if(status>=400&&status<500){ cls='s4xx'; label='HTTP '+status; }
  else if(status>=500){ cls='s5xx'; label='HTTP '+status+' Server Error'; }
  const dur=durationMs?' — '+durationMs+'ms':'';
  return {cls, html:'<span class="status-pill '+cls+'">'+esc(label+dur)+'</span>'};
}

/** Handle 401/0 responses: show toast, return extra hint HTML string. */
function handle401(result){
  const st=result.status;
  if(st!==401&&st!==0) return '';
  try{
    const p=JSON.parse(result.body);
    if(p.hint){
      showToast('Session expired — '+p.hint.replace('Run: ',''),'error');
      return '<div style="margin-top:6px;font-size:11px;color:var(--yellow)">&#9888; '+esc(p.hint)+'</div>';
    }
  }catch(_){}
  showToast('HTTP 401 — session may be expired. Try re-logging in.','error');
  return '';
}

/** Disable a button and show "Executing…" text. Returns original label for restore. */
function btnExecuting(btn){
  if(!btn) return '';
  const prev=btn.textContent; btn.disabled=true; btn.textContent='Executing…'; return prev;
}

/** Re-enable a button and restore its label. */
function btnReady(btn, label){ if(btn){ btn.disabled=false; if(label) btn.textContent=label; } }

/** Set a status pill element's innerHTML. */
function setPill(pillEl, status, durationMs, extraHtml){
  if(!pillEl) return;
  pillEl.innerHTML=statusPillHtml(status, durationMs).html+(extraHtml||'');
}

// ── JSON Tree Renderer ────────────────────────────────────────────────────────
let _jtCounter = 0;
function renderJsonTree(val, depth){
  depth = depth||0;
  if(val===null) return '<span class="jt-null">null</span>';
  if(typeof val==='boolean') return '<span class="jt-bool">'+val+'</span>';
  if(typeof val==='number') return '<span class="jt-num">'+val+'</span>';
  if(typeof val==='string') return '<span class="jt-str">"'+esc(val)+'"</span>';
  if(Array.isArray(val)){
    if(!val.length) return '<span class="jt-bracket">[]</span>';
    const id='jt'+(++_jtCounter);
    const startOpen = depth < 2;
    return '<span class="jt-toggle" onclick="jtToggle(\''+id+'\')">'+(startOpen?'▾':'▸')+'</span>'
      +'<span class="jt-bracket">[</span>'
      +'<div id="'+id+'" class="jt-body" style="display:'+(startOpen?'block':'none')+'">'
        +val.map(function(v,i){ return '<div class="jt-row">'+renderJsonTree(v,depth+1)+(i<val.length-1?'<span class="jt-punct">,</span>':'')+'</div>'; }).join('')
      +'</div>'
      +'<span class="jt-bracket">]</span>';
  }
  const keys=Object.keys(val);
  if(!keys.length) return '<span class="jt-bracket">{}</span>';
  const id='jt'+(++_jtCounter);
  const startOpen = depth < 2;
  return '<span class="jt-toggle" onclick="jtToggle(\''+id+'\')">'+(startOpen?'▾':'▸')+'</span>'
    +'<span class="jt-bracket">{</span>'
    +'<div id="'+id+'" class="jt-body" style="display:'+(startOpen?'block':'none')+'">'
      +keys.map(function(k,i){
        return '<div class="jt-row">'
          +'<span class="jt-key" onclick="jtCopyVal(this)" title="Click to copy value">'+esc(k)+'</span>'
          +'<span class="jt-colon">: </span>'
          +renderJsonTree(val[k],depth+1)
          +(i<keys.length-1?'<span class="jt-punct">,</span>':'')
          +'</div>';
      }).join('')
    +'</div>'
    +'<span class="jt-bracket">}</span>';
}
function jtToggle(id){
  const el=document.getElementById(id);
  if(!el) return;
  const open=el.style.display!=='none';
  el.style.display=open?'none':'block';
  const tog=el.previousElementSibling;
  if(tog&&tog.classList.contains('jt-toggle')) tog.textContent=open?'▸':'▾';
}
function jtCopyVal(keyEl){
  const row=keyEl.parentElement;
  const valEl=row.querySelector('.jt-str,.jt-num,.jt-bool,.jt-null');
  const txt=valEl?valEl.textContent.replace(/^"|"$/g,''):keyEl.textContent;
  navigator.clipboard.writeText(txt).then(function(){ showToast('Copied: '+keyEl.textContent,'info'); });
}

// Render response: tree view or raw toggle
const _respRaw = {};  // tabId → raw string
const _respMode = {}; // tabId → 'tree' | 'raw'
const RESP_NODE_LIMIT = 2000;
function _countNodes(val, depth){
  if(!val||typeof val!=='object') return 1;
  if(depth>8) return 1;
  let n=1;
  const keys=Array.isArray(val)?val:Object.values(val);
  for(const v of keys){ n+=_countNodes(v,depth+1); if(n>RESP_NODE_LIMIT+1) break; }
  return n;
}
function setRespBox(boxEl, toolbarEl, body, status, tabId){
  _respRaw[tabId] = body;
  let parsed = null;
  try{ parsed = JSON.parse(body); }catch(_){}
  if(!parsed || typeof parsed !== 'object'){
    boxEl.style.color = status>=400?'var(--yellow)':'var(--fg)';
    boxEl.textContent = body;
    if(toolbarEl) toolbarEl.style.display='none';
    return;
  }
  // Large response guard: if > RESP_NODE_LIMIT nodes, show truncated with "Show full" button
  const nodeCount = _countNodes(parsed, 0);
  if(nodeCount > RESP_NODE_LIMIT){
    _respMode[tabId]='raw';
    if(toolbarEl) toolbarEl.style.display='flex';
    boxEl.style.whiteSpace='pre-wrap';
    boxEl.style.color = status>=400?'var(--yellow)':'var(--fg)';
    const preview = body.length>8000?body.slice(0,8000)+'…\n[truncated]':body;
    const sizeKb = Math.round(body.length/1024);
    boxEl.innerHTML='<div style="background:rgba(250,180,0,0.12);border:1px solid #f0c040;border-radius:4px;padding:6px 10px;margin-bottom:8px;font-size:10px;color:#f0c040">'+
      '&#9888; Large response (~'+sizeKb+'KB, '+nodeCount+'+ nodes). Showing raw text. '+
      '<button class="btn btn-sec" style="font-size:10px;padding:2px 8px;margin-left:6px" onclick="'+
        '_respMode[\''+tabId+'\']=\'tree\';'+
        '_applyRespMode(document.getElementById(\'try-resp-'+tabId+'\')||document.getElementById(\'cr-resp-'+tabId+'\'),'+
        'JSON.parse(_respRaw[\''+tabId+'\']),_respRaw[\''+tabId+'\'],'+status+',\'tree\')'+
      '">Show Tree (may be slow)</button></div>'+
      '<span style="white-space:pre-wrap">'+esc(preview)+'</span>';
    return;
  }
  if(toolbarEl) toolbarEl.style.display='flex';
  const mode = _respMode[tabId]||'tree';
  _applyRespMode(boxEl, parsed, body, status, mode);
}
function _applyRespMode(boxEl, parsed, raw, status, mode){
  if(mode==='tree'){
    boxEl.style.color = status>=400?'var(--yellow)':'var(--fg)';
    boxEl.style.whiteSpace = 'normal';
    boxEl.innerHTML = renderJsonTree(parsed, 0);
  } else {
    boxEl.style.color = status>=400?'var(--yellow)':'var(--fg)';
    boxEl.style.whiteSpace = 'pre-wrap';
    boxEl.textContent = typeof raw==='string'?raw:JSON.stringify(parsed,null,2);
  }
}
function switchRespMode(tabId, mode, btnTree, btnRaw){
  _respMode[tabId]=mode;
  const raw=_respRaw[tabId]||'';
  let parsed=null; try{ parsed=JSON.parse(raw); }catch(_){}
  const boxEl=document.getElementById('try-resp-'+tabId)||document.getElementById('cr-resp-'+tabId);
  if(boxEl&&parsed) _applyRespMode(boxEl, parsed, raw, 0, mode);
  if(btnTree) btnTree.classList.toggle('active', mode==='tree');
  if(btnRaw)  btnRaw.classList.toggle('active', mode==='raw');
}
function respSearchTree(tabId, q){
  const box=document.getElementById('try-resp-'+tabId)||document.getElementById('cr-resp-'+tabId);
  if(!box) return;
  if(!q){ setRespBox(box, null, _respRaw[tabId]||'', 0, tabId); return; }
  // In raw mode, filter lines; in tree mode, highlight text
  const mode=_respMode[tabId]||'tree';
  if(mode==='raw'){
    const lines=(_respRaw[tabId]||'').split('\n').filter(function(l){ return l.toLowerCase().includes(q.toLowerCase()); });
    box.style.whiteSpace='pre-wrap'; box.textContent=lines.length?lines.join('\n'):'(no matches)';
  } else {
    // Walk text nodes and wrap matches in <mark>
    _highlightTreeSearch(box, q);
  }
}
function _highlightTreeSearch(root, q){
  // Remove existing highlights first
  root.querySelectorAll('mark.jt-hl').forEach(function(m){ m.replaceWith(document.createTextNode(m.textContent)); });
  if(!q) return;
  const walk=document.createTreeWalker(root, 4);
  const toMark=[];
  let node;
  while((node=walk.nextNode())){
    if(node.textContent.toLowerCase().includes(q.toLowerCase())) toMark.push(node);
  }
  toMark.forEach(function(tn){
    const idx=tn.textContent.toLowerCase().indexOf(q.toLowerCase());
    if(idx<0) return;
    const before=document.createTextNode(tn.textContent.slice(0,idx));
    const mark=document.createElement('mark');
    mark.className='jt-hl';
    mark.style.cssText='background:#f0c040;color:#000;border-radius:2px';
    mark.textContent=tn.textContent.slice(idx,idx+q.length);
    const after=document.createTextNode(tn.textContent.slice(idx+q.length));
    tn.parentNode.replaceChild(after, tn);
    tn.parentNode.insertBefore(mark, after);
    tn.parentNode.insertBefore(before, mark);
  });
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
document.addEventListener('keydown', function(e){
  if((e.metaKey||e.ctrlKey) && e.key==='Enter'){
    e.preventDefault();
    const tab=tabs.find(function(t){ return t.id===activeTabId; });
    if(!tab) return;
    if(tab.type==='custom'||tab.type==='new-custom') executeCustomReq(activeTabId);
    else if(tab.type==='endpoint') execute(activeTabId);
  }
});

// ── Collection Runner ─────────────────────────────────────────────────────────
function runCollection(category){
  const reqs=customRequests.filter(function(r){
    const c=r.category||'Custom';
    return c===category||c.startsWith(category+' > ');
  });
  if(!reqs.length){ showToast('No requests in "'+category+'"','error'); return; }
  const orgAlias=document.getElementById('org-select').value;
  if(!orgAlias){ showToast('Select an org first.','error'); return; }
  const apiVersion=DEFAULT_API_VERSION||'v67.0';

  let ov=document.getElementById('cr-runner-overlay');
  if(!ov){ ov=document.createElement('div'); ov.id='cr-runner-overlay';
    ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9500;display:flex;align-items:center;justify-content:center';
    document.body.appendChild(ov); }
  ov.style.display='flex';

  ov.innerHTML=`<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;width:700px;max-height:80vh;display:flex;flex-direction:column;overflow:hidden">
    <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">
      <span style="flex:1;font-weight:600;font-size:13px">&#9654; Run: ${esc(category)} (${reqs.length} requests)</span>
      <button class="icon-btn" onclick="document.getElementById('cr-runner-overlay').remove()">&#10005;</button>
    </div>
    <div style="padding:8px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <span style="font-size:11px;color:var(--fg3)">Delay between requests (ms):</span>
      <input id="cr-runner-delay" type="number" value="300" min="0" max="5000" style="width:70px;font-size:11px;padding:3px 6px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--fg)">
      <button class="btn btn-pri" style="font-size:11px;padding:4px 14px" id="cr-runner-run-btn" onclick="_runCollectionStart()">&#9654; Run All</button>
      <button class="btn btn-sec" style="font-size:11px;padding:4px 14px" id="cr-runner-csv-btn" onclick="_runnerExportCsv()" disabled>Export CSV</button>
      <span id="cr-runner-summary" style="font-size:11px;color:var(--fg3);margin-left:auto"></span>
    </div>
    <div style="overflow-y:auto;flex:1">
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead><tr style="background:var(--bg3);font-size:10px;color:var(--fg3)">
          <th style="padding:5px 8px;text-align:left;width:60px">Status</th>
          <th style="padding:5px 8px;text-align:left;width:50px">Method</th>
          <th style="padding:5px 8px;text-align:left">Name</th>
          <th style="padding:5px 8px;text-align:left">Path</th>
          <th style="padding:5px 8px;text-align:right;width:70px">Duration</th>
          <th style="padding:5px 8px;text-align:center;width:50px">Open</th>
        </tr></thead>
        <tbody id="cr-runner-tbody">
          ${reqs.map(function(r,i){ return '<tr id="cr-run-row-'+i+'" style="border-bottom:1px solid var(--border)">'+
            '<td style="padding:5px 8px"><span id="cr-run-status-'+i+'" style="color:var(--fg3)">—</span></td>'+
            '<td style="padding:5px 8px;font-family:monospace">'+esc(r.method)+'</td>'+
            '<td style="padding:5px 8px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+esc(r.name)+'">'+esc(r.name)+'</td>'+
            '<td style="padding:5px 8px;font-family:monospace;font-size:10px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+esc(r.path)+'">'+esc(r.path)+'</td>'+
            '<td style="padding:5px 8px;text-align:right" id="cr-run-dur-'+i+'">—</td>'+
            '<td style="padding:5px 8px;text-align:center"><button class="btn btn-sec" style="font-size:9px;padding:1px 6px" onclick="_runnerOpenReq('+i+')" disabled id="cr-run-open-'+i+'">Open</button></td>'+
          '</tr>'; }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;

  // Store runner context
  window._runnerReqs = reqs;
  window._runnerOrgAlias = orgAlias;
  window._runnerApiVersion = apiVersion;
  window._runnerResults = [];
}

async function _runCollectionStart(){
  const btn=document.getElementById('cr-runner-run-btn');
  if(btn) btn.disabled=true;
  const delay=parseInt((document.getElementById('cr-runner-delay')||{}).value||'300',10)||300;
  const reqs=window._runnerReqs||[];
  const orgAlias=window._runnerOrgAlias||'';
  const apiVersion=window._runnerApiVersion||'v67.0';
  window._runnerResults=[];
  let pass=0, fail=0;

  for(let i=0;i<reqs.length;i++){
    const r=reqs[i];
    const statusEl=document.getElementById('cr-run-status-'+i);
    const durEl=document.getElementById('cr-run-dur-'+i);
    const rowEl=document.getElementById('cr-run-row-'+i);
    if(statusEl) statusEl.textContent='⟳';
    const rId=++reqCounter;
    const result=await new Promise(function(resolve){
      pendingReqs[rId]=function(res){ resolve(res); };
      vscMsg({type:'executeCustom', requestId:rId, orgAlias, method:r.method,
        path:r.path, headers:r.headers||{}, body:r.body||'', apiVersion});
    });
    window._runnerResults.push({req:r, result});
    const st=result.status;
    const ok=st>=200&&st<300;
    pass+=ok?1:0; fail+=ok?0:1;
    if(statusEl){ statusEl.textContent=st||'ERR'; statusEl.style.color=ok?'var(--green)':'var(--red)'; }
    if(durEl) durEl.textContent=(result.durationMs||0)+'ms';
    if(rowEl) rowEl.style.background=ok?'rgba(0,80,0,0.08)':'rgba(80,0,0,0.08)';
    const openBtn=document.getElementById('cr-run-open-'+i);
    if(openBtn) openBtn.disabled=false;
    const summary=document.getElementById('cr-runner-summary');
    if(summary) summary.textContent=(i+1)+'/'+reqs.length+' done — ✓'+pass+' ✗'+fail;
    if(i<reqs.length-1) await new Promise(function(r){ setTimeout(r, delay); });
  }
  if(btn) btn.disabled=false;
  const csvBtn=document.getElementById('cr-runner-csv-btn');
  if(csvBtn) csvBtn.disabled=false;
}

function _runnerOpenReq(idx){
  const reqs=window._runnerReqs||[];
  const r=reqs[idx];
  if(!r) return;
  // Open in new tab
  openCustomRequest(r);
  document.getElementById('cr-runner-overlay')?.remove();
}

function _runnerExportCsv(){
  const results=window._runnerResults||[];
  if(!results.length){ showToast('No results to export','error'); return; }
  const rows=[['Name','Method','Path','Status','Duration (ms)']];
  results.forEach(function(row){ rows.push([row.req.name,row.req.method,row.req.path,row.result.status,row.result.durationMs||0]); });
  const csv=rows.map(function(r){ return r.map(function(c){ return '"'+String(c).replace(/"/g,'""')+'"'; }).join(','); }).join('\n');
  const blob=new Blob([csv],{type:'text/csv'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='collection-run.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ── Sidebar resize ────────────────────────────────────────────────────────────
(function(){
  const resizer=document.getElementById('sidebar-resizer');
  const sidebar=document.getElementById('sidebar');
  if(!resizer||!sidebar) return;
  let startX=0, startW=0;
  resizer.addEventListener('mousedown',function(e){
    startX=e.clientX; startW=sidebar.offsetWidth;
    resizer.classList.add('dragging');
    document.body.style.cursor='col-resize';
    document.body.style.userSelect='none';
  });
  document.addEventListener('mousemove',function(e){
    if(!resizer.classList.contains('dragging')) return;
    const w=Math.max(160,Math.min(520,startW+(e.clientX-startX)));
    sidebar.style.width=w+'px';
  });
  document.addEventListener('mouseup',function(){
    resizer.classList.remove('dragging');
    document.body.style.cursor='';
    document.body.style.userSelect='';
  });
})();

// ── Dark/light theme toggle ───────────────────────────────────────────────────
let _themeMode='dark';
function toggleTheme(){
  _themeMode=_themeMode==='dark'?'light':'dark';
  const btn=document.getElementById('theme-toggle-btn');
  if(_themeMode==='light'){
    document.documentElement.style.setProperty('--bg','#f8f9fb');
    document.documentElement.style.setProperty('--bg2','#eef0f5');
    document.documentElement.style.setProperty('--bg3','#e2e5ee');
    document.documentElement.style.setProperty('--fg','#1a1d27');
    document.documentElement.style.setProperty('--fg2','#3a3f55');
    document.documentElement.style.setProperty('--fg3','#7a819a');
    document.documentElement.style.setProperty('--border','#cdd2e1');
    if(btn) btn.textContent='☀';
  } else {
    document.documentElement.style.removeProperty('--bg');
    document.documentElement.style.removeProperty('--bg2');
    document.documentElement.style.removeProperty('--bg3');
    document.documentElement.style.removeProperty('--fg');
    document.documentElement.style.removeProperty('--fg2');
    document.documentElement.style.removeProperty('--fg3');
    document.documentElement.style.removeProperty('--border');
    if(btn) btn.textContent='🌙';
  }
}

// Bootstrap — notify extension
vscMsg({type:'ready'});
