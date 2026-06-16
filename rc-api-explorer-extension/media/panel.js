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
  Usage:'Usage Management', Billing:'Billing', DRO:'DRO & Fulfillment'
};
const CATS = ['PCM','Discovery','Pricing','Rate','Configurator','Transaction','Usage','Billing','DRO'];

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
    '</div>';
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
    : (ep.id === 'txn-13')
    ? '<div style="margin:8px 0 10px;padding:8px 10px;background:var(--bg3);border-radius:6px;border-left:3px solid #8e44ad">'+
      '<span style="font-size:11px;color:var(--fg2)">This API is complex — use the visual builder instead.</span>'+
      ' <button class="btn btn-pri" onclick="openSwapBuilderTab()" style="font-size:11px;padding:3px 10px;background:#8e44ad">&#8646; Open Swap Builder</button>'+
      '</div>'
    : '';

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
      '<div class="tab"     onclick="showSubTab(\'tryit\',this,\''+tabId+'\')">&#9654; Try It</div>'+
    '</div>'+
    '<div id="stp-params-'+tabId+'" class="tp on">'+paramsHtml+'</div>'+
    '<div id="stp-request-'+tabId+'" class="tp"><pre>'+esc(ep.request)+'</pre></div>'+
    '<div id="stp-response-'+tabId+'" class="tp"><pre>'+esc(ep.response)+'</pre></div>'+
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
    '<button class="btn btn-pri" id="exec-btn-'+tabId+'" onclick="execute(\''+tabId+'\')" title="Execute (Ctrl+Enter)">&#9654; Execute</button>'+
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
    '<div class="try-lbl">Response'+
    '<input id="resp-search-'+tabId+'" placeholder="Search response…" oninput="filterResp(\''+tabId+'\')"'+
    ' style="float:right;font-size:10px;padding:2px 6px;width:150px;background:var(--bg2);border:1px solid var(--brd);border-radius:4px;color:var(--fg)">'+
    '</div>'+
    '<div id="try-status-pill-'+tabId+'" style="margin-bottom:8px"></div>'+
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

const _respCache = {};

function filterResp(tabId){
  const q = ((document.getElementById('resp-search-'+tabId)||{}).value||'').toLowerCase();
  const box = document.getElementById('try-resp-'+tabId);
  if(!box) return;
  const raw = _respCache[tabId]||'';
  if(!q){ box.textContent = raw; return; }
  const lines = raw.split('\n').filter(l => l.toLowerCase().includes(q));
  box.textContent = lines.length ? lines.join('\n') : '(no matches)';
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

  btn.disabled = true; btn.textContent = 'Executing…';
  resp.style.color='var(--fg3)'; resp.textContent='Waiting for response…';
  if(pill) pill.innerHTML='';
  if(extract) extract.innerHTML='';

  const requestId = ++reqCounter;
  pendingReqs[requestId] = (result)=>{
    btn.disabled=false; btn.textContent='▶ Execute';
    const st = result.status;
    let cls='serr', label='Error';
    if(st>=200&&st<300){ cls='s2xx'; label='HTTP '+st+' OK'; }
    else if(st>=400&&st<500){ cls='s4xx'; label='HTTP '+st; }
    else if(st>=500){ cls='s5xx'; label='HTTP '+st+' Server Error'; }
    const dur = result.durationMs?' — '+result.durationMs+'ms':'';
    let hint='';
    if(st===401||st===0){
      try{
        const p=JSON.parse(result.body);
        if(p.hint){ hint='<div style="margin-top:6px;font-size:11px;color:var(--yellow)">&#9888; '+esc(p.hint)+'</div>'; showToast('Session expired — '+p.hint.replace('Run: ',''),'error'); }
        else if(st===401){ showToast('HTTP 401 — session may be expired. Try re-logging in.','error'); }
      }catch(_){ if(st===401) showToast('HTTP 401 — session may be expired.','error'); }
    }
    if(pill) pill.innerHTML='<span class="status-pill '+cls+'">'+esc(label+dur)+'</span>'+hint;
    let parsed=null;
    try{
      parsed=JSON.parse(result.body);
      resp.style.color=st>=400?'var(--yellow)':'var(--fg)';
      const pretty=JSON.stringify(parsed,null,2);
      resp.textContent=pretty;
      _respCache[tabId]=pretty;
    }catch(_){ resp.style.color='var(--fg)'; resp.textContent=result.body; _respCache[tabId]=result.body; }
    const _rcKeys=Object.keys(_respCache); if(_rcKeys.length>10) delete _respCache[_rcKeys[0]];

    // Enable diff button
    const diffBtn=document.getElementById('diff-btn-'+tabId);
    if(diffBtn&&Object.keys(_diffBaselines).length) diffBtn.disabled=false;

    // Status bar
    updateStatusBar(method, path, st, result.durationMs);

    // Save to vars
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

function renderCustomReqList(){
  const el=document.getElementById('custom-req-list');
  if(!el) return;
  if(!customRequests.length){ el.innerHTML='<div style="color:var(--fg3);font-size:11px;padding:6px 0">No saved requests yet.</div>'; return; }
  el.innerHTML=customRequests.map(r=>{
    const mc=r.method||'GET';
    return '<div style="display:flex;align-items:center;gap:4px;margin-bottom:5px;padding:6px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;cursor:pointer" onclick="openCustomRequest(\''+esc(r.id)+'\')">'+
      '<span class="mb '+mc+'" style="font-size:9px;padding:1px 4px;min-width:34px">'+esc(r.method)+'</span>'+
      '<span style="flex:1;font-size:11px;color:var(--fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(r.name)+'</span>'+
      '<button class="icon-btn" style="padding:1px 5px;font-size:10px;color:var(--red);flex-shrink:0" onclick="event.stopPropagation();deleteCustomReq(\''+esc(r.id)+'\')">&#10005;</button>'+
      '</div>';
  }).join('');
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

function _buildCustomPanel(panel, tabId, req, isNew){
  const headerRows=Object.entries(req.headers||{}).map(([k,v])=>
    '<div class="cr-hdr-row" style="display:flex;gap:4px;margin-bottom:4px">'+
    '<input class="try-inp" placeholder="Header name" value="'+esc(k)+'" style="flex:1;font-family:monospace;font-size:11px">'+
    '<input class="try-inp" placeholder="Value" value="'+esc(v)+'" style="flex:2;font-size:11px">'+
    '<button class="icon-btn" style="padding:2px 6px;font-size:11px;color:var(--red)" onclick="this.closest(\'.cr-hdr-row\').remove()">&#10005;</button>'+
    '</div>'
  ).join('');

  panel.innerHTML=
    '<div class="d-title" style="margin-bottom:14px">'+(isNew?'New Request':esc(req.name))+'</div>'+
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
    '<button class="btn btn-pri" id="cr-exec-btn-'+tabId+'" onclick="executeCustomReq(\''+tabId+'\')">&#9654; Execute</button>'+
    '<button class="btn btn-sec" onclick="saveCustomReq(\''+tabId+'\','+(isNew?'true':'false')+')">&#128190; '+(isNew?'Save':'Update')+'</button>'+
    (!isNew?'<button class="btn btn-sec" onclick="saveCustomReqAsNew(\''+tabId+'\')">Save as New</button>':'')+
    '<div style="flex:1"></div>'+
    '<button class="btn btn-sec" onclick="copyCrCurl(\''+tabId+'\')">cURL</button>'+
    '<button class="btn btn-sec" onclick="copyCrApex(\''+tabId+'\')">Apex</button>'+
    '</div>'+
    '<div id="cr-status-pill-'+tabId+'" style="margin-bottom:8px"></div>'+
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
function fmtCrBody(tabId){ const el=document.getElementById('cr-body-'+tabId); if(!el) return; try{ el.value=JSON.stringify(JSON.parse(el.value),null,2); }catch(e){ showToast(_jsonErrMsg(el.value,e),'error'); } }
function clearCrBody(tabId){ const el=document.getElementById('cr-body-'+tabId); if(el) el.value=''; }

function executeCustomReq(tabId){
  const orgAlias=document.getElementById('org-select').value;
  if(!orgAlias){ showToast('Select an org first.','error'); return; }
  const f=_readCrForm(tabId);
  const body=applyVars(f.body);
  const path=applyVars(f.path);
  const btn=document.getElementById('cr-exec-btn-'+tabId);
  const resp=document.getElementById('cr-resp-'+tabId);
  const pill=document.getElementById('cr-status-pill-'+tabId);
  btn.disabled=true; btn.textContent='Executing…';
  resp.style.color='var(--fg3)'; resp.textContent='Waiting for response…';
  if(pill) pill.innerHTML='';
  const requestId=++reqCounter;
  pendingReqs[requestId]=(result)=>{
    btn.disabled=false; btn.textContent='▶ Execute';
    const st=result.status;
    let cls='serr',label='Error';
    if(st>=200&&st<300){ cls='s2xx'; label='HTTP '+st+' OK'; }
    else if(st>=400&&st<500){ cls='s4xx'; label='HTTP '+st; }
    else if(st>=500){ cls='s5xx'; label='HTTP '+st+' Server Error'; }
    const dur=result.durationMs?' — '+result.durationMs+'ms':'';
    let crHint='';
    if(st===401||st===0){
      try{
        const p=JSON.parse(result.body);
        if(p.hint){ crHint='<div style="margin-top:6px;font-size:11px;color:var(--yellow)">&#9888; '+esc(p.hint)+'</div>'; showToast('Session expired — '+p.hint.replace('Run: ',''),'error'); }
        else if(st===401){ showToast('HTTP 401 — session may be expired. Try re-logging in.','error'); }
      }catch(_){ if(st===401) showToast('HTTP 401 — session may be expired.','error'); }
    }
    if(pill) pill.innerHTML='<span class="status-pill '+cls+'">'+esc(label+dur)+'</span>'+crHint;
    try{ resp.style.color=st>=400?'var(--yellow)':'var(--fg)'; resp.textContent=JSON.stringify(JSON.parse(result.body),null,2); }
    catch(_){ resp.style.color='var(--fg)'; resp.textContent=result.body; }
    updateStatusBar(f.method, path, st, result.durationMs);
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
  vscMsg({type:'chainStart', playbookId:pbId, orgAlias, mode:chainMode, execution:chainExec});
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
function saveBodyOverride(i){ const b=document.getElementById('chain-body-'+i); if(!b||!chainSession) return; chainSession.steps[i].resolvedBody=b.value; vscMsg({type:'chainOverride',stepIdx:i,target:'body.__raw__',value:b.value}); }
function resetAndEdit(i){ vscMsg({type:'chainResetStep',stepIdx:i}); }
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
    '<label style="font-size:10px;color:var(--fg2)">Pricebook2Id * <input class="try-inp" id="pst-nq-pb-'+tabId+'" placeholder="01s..." style="width:130px;font-size:11px;font-family:monospace;padding:2px 5px" oninput="pstState[\''+tabId+'\'].newQuoteFields.pricebook2Id=this.value"></label>'+
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
  html += '<label style="font-size:10px;color:var(--fg2)">Prod <input class="try-inp" value="'+esc(ins.product2Id)+'" placeholder="01t…" style="width:110px;font-size:11px;font-family:monospace;padding:2px 4px" onchange="pstUpdateInsert(\''+tabId+'\',\''+ins.localRef+'\',\'product2Id\',this.value)"></label>';
  html += '<label style="font-size:10px;color:var(--fg2)">PBE <input class="try-inp" value="'+esc(ins.pbeId)+'" placeholder="01u…" style="width:110px;font-size:11px;font-family:monospace;padding:2px 4px" onchange="pstUpdateInsert(\''+tabId+'\',\''+ins.localRef+'\',\'pbeId\',this.value)"></label>';
  html += '<label style="font-size:10px;color:var(--fg2)">Qty <input type="number" class="try-inp" value="'+esc(ins.qty||'1')+'" min="1" style="width:46px;font-size:11px;padding:2px 4px" onchange="pstUpdateInsert(\''+tabId+'\',\''+ins.localRef+'\',\'qty\',this.value)"></label>';
  html += '<label style="font-size:10px;color:var(--fg2)">Freq <input class="try-inp" value="'+esc(ins.billingFreq||'')+'" placeholder="Monthly" style="width:70px;font-size:11px;padding:2px 4px" onchange="pstUpdateInsert(\''+tabId+'\',\''+ins.localRef+'\',\'billingFreq\',this.value)"></label>';
  html += '<button class="icon-btn" style="font-size:10px;color:var(--acc);margin-left:auto" onclick="pstAddAttr(\''+tabId+'\',\''+ins.localRef+'\')">+ Attr</button>';
  html += '<button class="icon-btn" style="font-size:10px;color:var(--acc)" onclick="pstAddChildInsert(\''+tabId+'\',\''+ins.localRef+'\',\''+esc(ins.product2Id||ins.localRef)+'\')">+ Child QLI</button>';
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
  if(!nq.pricebook2Id.trim()){ showToast('Pricebook2Id is required.','error'); return; }
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

// ── Utils ─────────────────────────────────────────────────────────────────────
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escTA(s){ return String(s||'').replace(/<\/textarea/gi,'&lt;/textarea'); }

// Bootstrap — notify extension
vscMsg({type:'ready'});
