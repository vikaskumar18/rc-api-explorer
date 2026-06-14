/**
 * PST Graph Builder — mock tests
 *
 * Tests the _buildPstGraph logic by replicating it in plain JS and asserting
 * the PST payload shape, node ordering, and @{ref.id} reference syntax.
 *
 * Run:  node src/lib/__tests__/pstGraphBuilder.test.js
 */

// ── Replicate _buildPstGraph from panel.js ────────────────────────────────────
function buildPstGraph(s) {
  const records = [];

  // 1. Quote anchor
  records.push({ referenceId: 'refQuote',
    record: { attributes: { type: 'Quote', method: 'PATCH' }, id: s.quoteId } });

  // 2. QLR DELETEs
  s.deletedQlrIds.forEach(id => {
    records.push({ referenceId: 'refDelQlr_' + id.slice(-6),
      record: { attributes: { type: 'QuoteLineRelationship', method: 'DELETE' }, id } });
  });

  // 3. QLI DELETEs
  s.deletedQliIds.forEach(id => {
    records.push({ referenceId: 'refDelQli_' + id.slice(-6),
      record: { attributes: { type: 'QuoteLineItem', method: 'DELETE' }, id } });
  });

  // 4. QLI PATCHes
  Object.entries(s.patchedQlis).forEach(([qliId, patch]) => {
    if (s.deletedQliIds.has(qliId)) return;
    const orig = s.existingQlis.find(q => q.id === qliId);
    if (!orig) return;
    const changed = patch.qty !== orig.qty || patch.billingFreq !== orig.billingFreq;
    if (!changed) return;
    const rec = { attributes: { type: 'QuoteLineItem', method: 'PATCH' }, id: qliId };
    if (patch.qty !== orig.qty) rec.Quantity = patch.qty;
    if (patch.billingFreq !== orig.billingFreq) rec.BillingFrequency = patch.billingFreq || null;
    records.push({ referenceId: 'refPatch_' + qliId.slice(-6), record: rec });
  });

  // 5. QLI POSTs
  s.newInserts.forEach(ins => {
    const rec = {
      attributes: { type: 'QuoteLineItem', method: 'POST' },
      QuoteId: '@{refQuote.id}',
      Product2Id: ins.product2Id.trim(),
      PricebookEntryId: ins.pbeId.trim(),
      Quantity: ins.qty || '1',
    };
    if (ins.billingFreq && ins.billingFreq.trim()) rec.BillingFrequency = ins.billingFreq.trim();
    records.push({ referenceId: ins.localRef, record: rec });
  });

  // 6. QLR POSTs
  let qlrIdx = 0;
  s.newInserts.forEach(ins => {
    const parent = ins.parentRef;
    if (!parent) return;
    const isRef = parent.startsWith('ref_ins_');
    const mainId = isRef ? '@{' + parent + '.id}' : parent;
    records.push({ referenceId: 'refQlr_' + (qlrIdx++),
      record: {
        attributes: { type: 'QuoteLineRelationship', method: 'POST' },
        ProductRelationshipTypeId: '{{PRT_ID}}',
        MainQuoteLineId: mainId,
        AssociatedQuoteLineId: '@{' + ins.localRef + '.id}',
        AssociatedQuoteLinePricing: 'IncludedInBundlePrice',
      } });
  });

  return { inputs: [{ pricingPref: s.pricingPref, configurationInput: s.configInput,
    graph: { graphId: 'pstBuilder', records } }] };
}

// ── Test helpers ──────────────────────────────────────────────────────────────
let passed = 0, failed = 0;

function test(name, fn) {
  try { fn(); console.log('  ✓', name); passed++; }
  catch (e) { console.error('  ✗', name, '\n   ', e.message); failed++; }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'assertion failed');
}

function assertEqual(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error((msg || 'not equal') + '\n    expected: ' + JSON.stringify(b) + '\n    got:      ' + JSON.stringify(a));
  }
}

function recordTypes(graph) {
  return graph.inputs[0].graph.records.map(r => r.record.attributes.type + ':' + r.record.attributes.method);
}

function baseState(overrides = {}) {
  return {
    quoteId: '0Q0TEST0000001KAA',
    pricingPref: 'Skip',
    configInput: 'Skip',
    existingQlis: [],
    existingQlrs: [],
    deletedQliIds: new Set(),
    deletedQlrIds: new Set(),
    patchedQlis: {},
    newInserts: [],
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

console.log('\nPST Graph Builder Tests\n');

console.log('── Scenario 1: Simple flat insert ──');
test('Quote anchor is always node 0', () => {
  const s = baseState({ newInserts: [{ localRef: 'ref_ins_0', product2Id: '01tPROD0001', pbeId: '01uPBE00001', qty: '1', billingFreq: '', parentRef: '' }] });
  const g = buildPstGraph(s);
  assertEqual(g.inputs[0].graph.records[0].referenceId, 'refQuote');
  assertEqual(g.inputs[0].graph.records[0].record.attributes.method, 'PATCH');
});

test('Single flat QLI POST — no QLR created', () => {
  const s = baseState({ newInserts: [{ localRef: 'ref_ins_0', product2Id: '01tPROD0001', pbeId: '01uPBE00001', qty: '1', billingFreq: '', parentRef: '' }] });
  const g = buildPstGraph(s);
  const types = recordTypes(g);
  assertEqual(types, ['Quote:PATCH', 'QuoteLineItem:POST']);
});

test('Flat insert fields mapped correctly', () => {
  const s = baseState({ newInserts: [{ localRef: 'ref_ins_0', product2Id: '01tPROD0001', pbeId: '01uPBE00001', qty: '2', billingFreq: 'Monthly', parentRef: '' }] });
  const g = buildPstGraph(s);
  const qli = g.inputs[0].graph.records[1].record;
  assertEqual(qli.Product2Id, '01tPROD0001');
  assertEqual(qli.PricebookEntryId, '01uPBE00001');
  assertEqual(qli.Quantity, '2');
  assertEqual(qli.BillingFrequency, 'Monthly');
  assertEqual(qli.QuoteId, '@{refQuote.id}');
});

test('No BillingFrequency field when billingFreq is blank', () => {
  const s = baseState({ newInserts: [{ localRef: 'ref_ins_0', product2Id: '01tPROD0001', pbeId: '01uPBE00001', qty: '1', billingFreq: '', parentRef: '' }] });
  const g = buildPstGraph(s);
  assert(!('BillingFrequency' in g.inputs[0].graph.records[1].record), 'BillingFrequency should be absent');
});

console.log('\n── Scenario 2: Insert with existing parent (child of existing QLI) ──');
test('QLI POST before QLR POST', () => {
  const s = baseState({
    newInserts: [{ localRef: 'ref_ins_0', product2Id: '01tCHILD001', pbeId: '01uPBE00002', qty: '1', billingFreq: 'Monthly', parentRef: '0QLPARENT001' }],
  });
  const g = buildPstGraph(s);
  const types = recordTypes(g);
  assertEqual(types, ['Quote:PATCH', 'QuoteLineItem:POST', 'QuoteLineRelationship:POST']);
});

test('QLR MainQuoteLineId is the real parent ID when parent is existing QLI', () => {
  const s = baseState({
    newInserts: [{ localRef: 'ref_ins_0', product2Id: '01tCHILD001', pbeId: '01uPBE00002', qty: '1', billingFreq: '', parentRef: '0QLPARENT001' }],
  });
  const g = buildPstGraph(s);
  const qlr = g.inputs[0].graph.records[2].record;
  assertEqual(qlr.MainQuoteLineId, '0QLPARENT001');
  assertEqual(qlr.AssociatedQuoteLineId, '@{ref_ins_0.id}');
});

console.log('\n── Scenario 3: Two-level new insert tree (child→grandchild, both new) ──');
test('Two new inserts with parent→child ref — QLI POSTs before QLR POSTs', () => {
  const s = baseState({
    newInserts: [
      { localRef: 'ref_ins_0', product2Id: '01tPARENT', pbeId: '01uPBE0', qty: '1', billingFreq: 'Monthly', parentRef: '0QLROOT001' },
      { localRef: 'ref_ins_1', product2Id: '01tCHILD0', pbeId: '01uPBE1', qty: '1', billingFreq: '', parentRef: 'ref_ins_0' },
    ],
  });
  const g = buildPstGraph(s);
  const types = recordTypes(g);
  assertEqual(types, [
    'Quote:PATCH',
    'QuoteLineItem:POST',   // ref_ins_0 (parent)
    'QuoteLineItem:POST',   // ref_ins_1 (child)
    'QuoteLineRelationship:POST',  // root → ref_ins_0
    'QuoteLineRelationship:POST',  // ref_ins_0 → ref_ins_1
  ]);
});

test('Grandchild QLR MainQuoteLineId is @{ref_ins_0.id} (reference, not hard ID)', () => {
  const s = baseState({
    newInserts: [
      { localRef: 'ref_ins_0', product2Id: '01tPARENT', pbeId: '01uPBE0', qty: '1', billingFreq: 'Monthly', parentRef: '0QLROOT001' },
      { localRef: 'ref_ins_1', product2Id: '01tCHILD0', pbeId: '01uPBE1', qty: '1', billingFreq: '', parentRef: 'ref_ins_0' },
    ],
  });
  const g = buildPstGraph(s);
  const qlrs = g.inputs[0].graph.records.filter(r => r.record.attributes.type === 'QuoteLineRelationship');
  assertEqual(qlrs[1].record.MainQuoteLineId, '@{ref_ins_0.id}');
  assertEqual(qlrs[1].record.AssociatedQuoteLineId, '@{ref_ins_1.id}');
});

console.log('\n── Scenario 4: Three-level deep new insert tree (no depth restriction) ──');
test('Three new inserts nested: root→child→grandchild all new — correct ordering', () => {
  const s = baseState({
    newInserts: [
      { localRef: 'ref_ins_0', product2Id: '01tROOT', pbeId: '01uPBE0', qty: '1', billingFreq: '', parentRef: '' },
      { localRef: 'ref_ins_1', product2Id: '01tCHILD', pbeId: '01uPBE1', qty: '1', billingFreq: '', parentRef: 'ref_ins_0' },
      { localRef: 'ref_ins_2', product2Id: '01tGRAND', pbeId: '01uPBE2', qty: '1', billingFreq: '', parentRef: 'ref_ins_1' },
    ],
  });
  const g = buildPstGraph(s);
  const types = recordTypes(g);
  // All 3 QLI POSTs come before all QLR POSTs
  const qliEnd = types.lastIndexOf('QuoteLineItem:POST');
  const qlrStart = types.indexOf('QuoteLineRelationship:POST');
  assert(qliEnd < qlrStart, 'All QLI POSTs must come before QLR POSTs');
  assertEqual(types.filter(t => t === 'QuoteLineItem:POST').length, 3);
  assertEqual(types.filter(t => t === 'QuoteLineRelationship:POST').length, 2); // root has no parent
});

test('Four levels deep — no depth limit, QLRs reference correctly', () => {
  const s = baseState({
    newInserts: [
      { localRef: 'ref_ins_0', product2Id: '01tA', pbeId: '01u0', qty: '1', billingFreq: '', parentRef: '0QLEXISTING' },
      { localRef: 'ref_ins_1', product2Id: '01tB', pbeId: '01u1', qty: '1', billingFreq: '', parentRef: 'ref_ins_0' },
      { localRef: 'ref_ins_2', product2Id: '01tC', pbeId: '01u2', qty: '1', billingFreq: '', parentRef: 'ref_ins_1' },
      { localRef: 'ref_ins_3', product2Id: '01tD', pbeId: '01u3', qty: '1', billingFreq: '', parentRef: 'ref_ins_2' },
    ],
  });
  const g = buildPstGraph(s);
  const qlrs = g.inputs[0].graph.records.filter(r => r.record.attributes.type === 'QuoteLineRelationship');
  assertEqual(qlrs.length, 4);
  assertEqual(qlrs[3].record.MainQuoteLineId, '@{ref_ins_2.id}');
  assertEqual(qlrs[3].record.AssociatedQuoteLineId, '@{ref_ins_3.id}');
});

console.log('\n── Scenario 5: DELETE ordering ──');
test('QLR DELETE appears before QLI DELETE', () => {
  const s = baseState({
    deletedQliIds: new Set(['0QLDELETE01']),
    deletedQlrIds: new Set(['0QRBLOCK001']),
  });
  const g = buildPstGraph(s);
  const types = recordTypes(g);
  const qlrDelIdx = types.indexOf('QuoteLineRelationship:DELETE');
  const qliDelIdx = types.indexOf('QuoteLineItem:DELETE');
  assert(qlrDelIdx < qliDelIdx, 'QLR DELETE must precede QLI DELETE');
});

test('DELETE nodes appear before POST nodes', () => {
  const s = baseState({
    deletedQliIds: new Set(['0QLDELETE01']),
    deletedQlrIds: new Set(['0QRBLOCK001']),
    newInserts: [{ localRef: 'ref_ins_0', product2Id: '01tNEW', pbeId: '01uNEW', qty: '1', billingFreq: '', parentRef: '' }],
  });
  const g = buildPstGraph(s);
  const types = recordTypes(g);
  const lastDel = Math.max(types.lastIndexOf('QuoteLineItem:DELETE'), types.lastIndexOf('QuoteLineRelationship:DELETE'));
  const firstPost = types.indexOf('QuoteLineItem:POST');
  assert(lastDel < firstPost, 'All DELETEs must precede all POSTs');
});

console.log('\n── Scenario 6: PATCH existing QLI ──');
test('PATCH node emitted only when value actually changed', () => {
  const existing = { id: '0QLEXIST001', product2Id: '01tXX', name: 'Widget', pbeId: '01uXX', qty: '1', billingFreq: 'Monthly', unitPrice: 100 };
  const s = baseState({
    existingQlis: [existing],
    patchedQlis: { '0QLEXIST001': { qty: '3', billingFreq: 'Monthly' } }, // only qty changed
  });
  const g = buildPstGraph(s);
  const patch = g.inputs[0].graph.records.find(r => r.record.attributes.method === 'PATCH' && r.record.attributes.type === 'QuoteLineItem');
  assert(patch, 'PATCH node should be emitted');
  assertEqual(patch.record.Quantity, '3');
  assert(!('BillingFrequency' in patch.record), 'Unchanged BillingFrequency should not be included');
});

test('No PATCH node when nothing changed', () => {
  const existing = { id: '0QLEXIST001', product2Id: '01tXX', name: 'Widget', pbeId: '01uXX', qty: '1', billingFreq: 'Monthly', unitPrice: 100 };
  const s = baseState({
    existingQlis: [existing],
    patchedQlis: { '0QLEXIST001': { qty: '1', billingFreq: 'Monthly' } }, // same values
  });
  const g = buildPstGraph(s);
  const patch = g.inputs[0].graph.records.find(r => r.record.attributes.method === 'PATCH' && r.record.attributes.type === 'QuoteLineItem');
  assert(!patch, 'No PATCH node should be emitted when nothing changed');
});

test('PATCH skipped for deleted QLI', () => {
  const existing = { id: '0QLEXIST001', product2Id: '01tXX', name: 'Widget', pbeId: '01uXX', qty: '1', billingFreq: '', unitPrice: 100 };
  const s = baseState({
    existingQlis: [existing],
    deletedQliIds: new Set(['0QLEXIST001']),
    patchedQlis: { '0QLEXIST001': { qty: '5', billingFreq: '' } },
  });
  const g = buildPstGraph(s);
  const patch = g.inputs[0].graph.records.find(r => r.record.attributes.method === 'PATCH' && r.record.id === '0QLEXIST001');
  assert(!patch, 'PATCH should be suppressed for deleted QLI');
});

console.log('\n── Scenario 7: Full restructure (mirrors sunpoc Scenario 6 from PST doc) ──');
test('Full swap restructure graph has correct node count and order', () => {
  // Mirrors: delete LINK245+its QLR, insert WebfleetVideo+LINK640 under root, insert CAMPro under WV
  const s = baseState({
    deletedQliIds: new Set(['0QLLINK245001']),
    deletedQlrIds: new Set(['0QRLINK245QLR']),
    newInserts: [
      { localRef: 'ref_ins_0', product2Id: '01tWEBFLEET', pbeId: '01uWEBFLEET', qty: '1', billingFreq: 'Monthly', parentRef: '0QLBASEROOT1' },
      { localRef: 'ref_ins_1', product2Id: '01tLINK640X', pbeId: '01uLINK640X', qty: '1', billingFreq: '', parentRef: '0QLBASEROOT1' },
      { localRef: 'ref_ins_2', product2Id: '01tCAMPROXX', pbeId: '01uCAMPROXX', qty: '1', billingFreq: '', parentRef: 'ref_ins_0' },
    ],
  });
  const g = buildPstGraph(s);
  const types = recordTypes(g);

  // Expected: Quote, QLR-DEL, QLI-DEL, 3×QLI-POST, 3×QLR-POST
  assertEqual(types.length, 9);
  assertEqual(types[0], 'Quote:PATCH');
  assertEqual(types[1], 'QuoteLineRelationship:DELETE');
  assertEqual(types[2], 'QuoteLineItem:DELETE');
  assertEqual(types[3], 'QuoteLineItem:POST');
  assertEqual(types[4], 'QuoteLineItem:POST');
  assertEqual(types[5], 'QuoteLineItem:POST');
  assertEqual(types[6], 'QuoteLineRelationship:POST');
  assertEqual(types[7], 'QuoteLineRelationship:POST');
  assertEqual(types[8], 'QuoteLineRelationship:POST');
});

test('CAM Pro QLR references WebfleetVideo by @{ref_ins_0.id}', () => {
  const s = baseState({
    newInserts: [
      { localRef: 'ref_ins_0', product2Id: '01tWEBFLEET', pbeId: '01uWEBFLEET', qty: '1', billingFreq: 'Monthly', parentRef: '0QLBASEROOT1' },
      { localRef: 'ref_ins_1', product2Id: '01tCAMPROXX', pbeId: '01uCAMPROXX', qty: '1', billingFreq: '', parentRef: 'ref_ins_0' },
    ],
  });
  const g = buildPstGraph(s);
  const qlrs = g.inputs[0].graph.records.filter(r => r.record.attributes.type === 'QuoteLineRelationship');
  const camQlr = qlrs.find(r => r.record.AssociatedQuoteLineId === '@{ref_ins_1.id}');
  assert(camQlr, 'CAM Pro QLR not found');
  assertEqual(camQlr.record.MainQuoteLineId, '@{ref_ins_0.id}', 'CAM Pro parent must be ref, not hardcoded ID');
});

console.log('\n── Scenario 8: Pricing preferences ──');
test('pricingPref and configInput propagated', () => {
  const s = baseState({ pricingPref: 'Force', configInput: 'RunAndAllowErrors' });
  const g = buildPstGraph(s);
  assertEqual(g.inputs[0].pricingPref, 'Force');
  assertEqual(g.inputs[0].configurationInput, 'RunAndAllowErrors');
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) { process.exit(1); }
