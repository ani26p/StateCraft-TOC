const $ = (s) => document.querySelector(s);
const state = {
  states: [],
  accept: [],
  alphabet: ['0', '1'],
  start: '',
  transitions: {},
  dfa: null,
  step: 0,
  sim: null,
  simStep: 0,
  timer: null,
  simTimer: null
};

const colors = {
  green: '#177653',
  orange: '#db794d',
  edge: '#89978c',
  text: '#24332b',
  node: '#fffefa',
  graph: '#eef2eb'
};

let toastTimer;
const graphInstances = {};

function toast(message, error=false){
  const el = $('#toast');
  el.textContent = message;
  el.classList.toggle('error', error);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

function setTheme(theme){
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('sc-theme', theme);
  const dark = theme === 'dark';
  $('#themeIcon').textContent = dark ? '☀' : '☾';
  $('#themeName').textContent = dark ? 'Light mode' : 'Dark mode';
  renderAllGraphs();
}

$('#themeToggle').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
setTheme(localStorage.getItem('sc-theme') || 'light');

function uniqueStateName(){
  let i = 0;
  while (state.states.includes(`q${i}`)) i++;
  return `q${i}`;
}

function addState(name=uniqueStateName(), accepting=false){
  if (state.states.length >= 12) return toast('Keep the visual editor to 12 states or fewer.', true);
  if (state.states.includes(name)) name = uniqueStateName();
  clearOutput();
  state.states.push(name);
  state.transitions[name] = {};
  if (!state.start) state.start = name;
  if (accepting) state.accept.push(name);
  renderInput();
}

function renderInput(){
  const start = $('#startSelect').value;
  $('#startSelect').innerHTML = state.states.map(q => `<option value="${esc(q)}">${esc(q)}</option>`).join('');
  if (state.states.includes(start)) $('#startSelect').value = start;
  else $('#startSelect').value = state.start;
  state.start = $('#startSelect').value;

  $('#statesList').innerHTML = state.states.map((q, i) => {
    const isAcc = state.accept.includes(q);
    const isStart = state.start === q;
    return `
      <div class="state-chip ${isAcc ? 'is-accept' : ''} ${isStart ? 'is-start' : ''}" data-state="${esc(q)}">
        <button type="button" class="chip-status-btn ${isAcc ? 'acc' : ''}" data-toggle-acc="${esc(q)}" title="${isAcc ? 'Accepting state (Double-ring) - click to toggle' : 'Regular state - click to make accepting'}">
          ${isAcc ? '◎' : '○'}
        </button>
        <input type="text" value="${esc(q)}" aria-label="State name" data-rename="${i}">
        <button type="button" class="chip-acc-tag ${isAcc ? 'acc' : ''}" data-toggle-acc="${esc(q)}" title="Toggle accepting">
          final
        </button>
        ${state.states.length > 1 ? `<button type="button" class="remove-state" data-remove="${esc(q)}" aria-label="Remove ${esc(q)}" title="Delete state">×</button>` : ''}
      </div>
    `;
  }).join('');

  $('#statesList').querySelectorAll('[data-toggle-acc]').forEach(btn => btn.onclick = (e) => {
    e.stopPropagation();
    const q = btn.dataset.toggleAcc;
    state.accept = state.accept.includes(q) ? state.accept.filter(x => x !== q) : [...state.accept, q];
    renderInput();
  });

  $('#statesList').querySelectorAll('[data-rename]').forEach(input => input.onchange = () => {
    renameState(Number(input.dataset.rename), input.value.trim());
  });

  $('#statesList').querySelectorAll('[data-remove]').forEach(b => b.onclick = (e) => {
    e.stopPropagation();
    removeState(b.dataset.remove);
  });

  renderTableEditor();
  drawInputNfa();
}

function renameState(index, next){
  const old = state.states[index];
  if (!next || state.states.includes(next)){
    toast('State names must be unique and cannot be blank.', true);
    renderInput();
    return;
  }
  state.states[index] = next;
  if (state.start === old) state.start = next;
  state.accept = state.accept.map(x => x === old ? next : x);
  state.transitions[next] = state.transitions[old] || {};
  delete state.transitions[old];
  for (const src of Object.keys(state.transitions)){
    for (const sym of Object.keys(state.transitions[src])){
      state.transitions[src][sym] = state.transitions[src][sym].map(x => x === old ? next : x);
    }
  }
  renderInput();
}

function removeState(q){
  clearOutput();
  state.states = state.states.filter(x => x !== q);
  state.accept = state.accept.filter(x => x !== q);
  if (state.start === q) state.start = state.states[0];
  delete state.transitions[q];
  for (const src of state.states){
    for (const sym of Object.keys(state.transitions[src] || {})){
      state.transitions[src][sym] = (state.transitions[src][sym] || []).filter(x => x !== q);
    }
  }
  renderInput();
}

function parseAlphabet(){
  const symbols = $('#alphabetInput').value.split(',').map(x => x.trim()).filter(Boolean);
  if (!symbols.length || symbols.some(x => [...x].length !== 1 || /\s/.test(x)) || new Set(symbols).size !== symbols.length){
    throw Error('Use a comma-separated list of unique, single character symbols (for example: 0, 1).');
  }
  state.alphabet = symbols;
  return symbols;
}

$('#alphabetInput').onchange = () => {
  try {
    parseAlphabet();
    renderInput();
  } catch(e) {
    toast(e.message, true);
  }
};

$('#startSelect').onchange = () => {
  state.start = $('#startSelect').value;
  renderInput();
};

$('#addState').onclick = () => addState();

function renderTableEditor(){
  const box = $('#tableEditor');
  if (!box) return;
  box.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>State</th>
          ${state.alphabet.map(a => `<th>on ${esc(a)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${state.states.map(q => `
          <tr>
            <td><strong>${esc(q)}</strong>${q === state.start ? ' <span class="tag-start">start</span>' : ''}${state.accept.includes(q) ? ' <span class="tag-acc">final</span>' : ''}</td>
            ${state.alphabet.map(a => `
              <td>
                <input class="table-dest" data-source="${esc(q)}" data-symbol="${esc(a)}" value="${esc((state.transitions[q]?.[a] || []).join(', '))}" placeholder="∅" aria-label="${esc(q)} on ${esc(a)} destinations">
              </td>
            `).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  box.querySelectorAll('.table-dest').forEach(input => input.onchange = () => {
    const rawVal = input.value.trim();
    if (!rawVal || rawVal === '∅') {
      state.transitions[input.dataset.source][input.dataset.symbol] = [];
      input.value = '';
      drawInputNfa();
      return;
    }
    const vals = rawVal.split(',').map(x => x.trim()).filter(Boolean);
    if (vals.some(v => !state.states.includes(v))) {
      toast('Use listed state names (e.g. q0, q1) separated by commas.', true);
      input.value = (state.transitions[input.dataset.source]?.[input.dataset.symbol] || []).join(', ');
      return;
    }
    state.transitions[input.dataset.source][input.dataset.symbol] = [...new Set(vals)];
    input.value = state.transitions[input.dataset.source][input.dataset.symbol].join(', ');
    drawInputNfa();
  });
}

function getNfa(){
  parseAlphabet();
  for (const s of state.states) {
    for (const a of state.alphabet) {
      state.transitions[s][a] ??= [];
    }
  }
  return {
    states: [...state.states],
    alphabet: [...state.alphabet],
    start: state.start,
    accept: [...state.accept],
    transitions: structuredClone(state.transitions)
  };
}

function esc(v){
  return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function api(path, body){
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || 'The request could not be completed.');
  return data;
}

$('#exampleBtn').onclick = () => {
  state.states = ['q0', 'q1', 'q2'];
  state.start = 'q0';
  state.accept = ['q2'];
  state.alphabet = ['0', '1'];
  state.transitions = {
    q0: { '0': ['q0', 'q1'], '1': ['q0'] },
    q1: { '0': [], '1': ['q2'] },
    q2: { '0': [], '1': [] }
  };
  $('#alphabetInput').value = '0, 1';
  $('#testString').value = '0101';
  clearOutput();
  renderInput();
  toast('Example loaded: strings containing 01 are accepted.');
};

function clearOutput(){
  clearInterval(state.timer);
  clearInterval(state.simTimer);
  state.timer = null;
  state.simTimer = null;
  state.dfa = null;
  state.sim = null;
  const graphEmpty = $('#graphEmpty');
  if (graphEmpty) {
    graphEmpty.hidden = false;
    graphEmpty.style.display = 'flex';
  }
  $('#stateCount').textContent = '—';
  $('#dfaFinalTable').innerHTML = '<div class="table-placeholder">Your final deterministic transition table appears here after conversion.</div>';
  $('#stepDfaTable').innerHTML = '<div class="table-placeholder">Transition table rows will appear dynamically here as you step through.</div>';
  $('#stepText').textContent = 'Ready when you are. Convert to explore each subset computation step by step.';
  $('#stepIndex').textContent = '— / —';
  ['prevStep', 'nextStep', 'runSteps', 'resetSteps'].forEach(id => $('#' + id).disabled = true);
  $('#simTrace').hidden = true;
  $('#simResult').textContent = 'Enter a string after converting your NFA.';
  $('#simResult').className = 'sim-result';
  if (graphInstances['inputNfaGraph']) {
    graphInstances['inputNfaGraph'].destroy();
    delete graphInstances['inputNfaGraph'];
  }
  if (graphInstances['dfaFinalGraph']) {
    graphInstances['dfaFinalGraph'].destroy();
    delete graphInstances['dfaFinalGraph'];
  }
  if (graphInstances['stepDfaGraph']) {
    graphInstances['stepDfaGraph'].destroy();
    delete graphInstances['stepDfaGraph'];
  }
  drawInputNfa();
}

$('.input-panel')?.addEventListener('input', e => {
  if (e.target.id !== 'testString' && e.target.id !== 'convertBtn') clearOutput();
});
$('.input-panel')?.addEventListener('change', e => {
  if (e.target.id !== 'testString' && e.target.id !== 'convertBtn') clearOutput();
});

$('#convertBtn').onclick = async () => {
  try {
    const nfa = getNfa();
    const result = await api('/api/nfa/convert', nfa);
    state.dfa = result;
    state.step = 0;
    const graphEmpty = $('#graphEmpty');
    if (graphEmpty) {
      graphEmpty.hidden = true;
      graphEmpty.style.display = 'none';
    }
    $('#stateCount').textContent = `${result.states.length} states`;
    
    // Render 2: Final Converted DFA Diagram & Final Table (clean, no step highlighting)
    drawFinalDfa();
    renderFinalDfaTable();

    // Render 3: Step-by-step conversion simulation & dynamic table
    updateStep();

    ['prevStep', 'nextStep', 'runSteps', 'resetSteps'].forEach(id => $('#' + id).disabled = false);
    $('#prevStep').disabled = true;
    $('#nextStep').disabled = result.steps.length === 0;
    $('#simulateBtn').disabled = false;
    toast(`Conversion complete: ${result.states.length} reachable DFA states.`);
  } catch(e) {
    toast(e.message, true);
  }
};

function themeColors(){
  const d = document.documentElement.dataset.theme === 'dark';
  return d
    ? { green: '#69c49a', orange: '#f09a70', edge: '#84958a', text: '#e9eee8', node: '#18231d', graph: '#202e26' }
    : colors;
}

function cyStyle(){
  const c = themeColors();
  return [
    {
      selector: 'node',
      style: {
        'background-color': c.node,
        'border-width': 2,
        'border-color': c.green,
        'label': 'data(label)',
        'color': c.text,
        'font-family': 'DM Mono, monospace',
        'font-size': 11,
        'text-valign': 'center',
        'text-halign': 'center',
        'width': 58,
        'height': 58,
        'text-wrap': 'wrap',
        'text-max-width': 52
      }
    },
    { selector: 'node.accept', style: { 'border-width': 5, 'border-color': c.green } },
    { selector: 'node.start', style: { 'border-color': c.green, 'border-width': 3 } },
    { selector: 'node.active', style: { 'border-color': c.orange, 'background-color': c.orange, 'color': '#fff', 'border-width': 4 } },
    {
      selector: 'edge',
      style: {
        'width': 1.6,
        'line-color': c.edge,
        'target-arrow-color': c.edge,
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'label': 'data(label)',
        'font-family': 'DM Mono, monospace',
        'font-size': 10,
        'color': c.text,
        'text-background-color': c.graph,
        'text-background-opacity': 0.92,
        'text-background-padding': 2,
        'text-rotation': 'autorotate'
      }
    },
    { selector: 'edge.active', style: { 'line-color': c.orange, 'target-arrow-color': c.orange, 'width': 3.4 } }
  ];
}

function makeGraph(id, states, alphabet, trans, start, accept, activeStep=null, mini=false, activeNodes=[]){
  if (!window.cytoscape) return;
  const el = document.getElementById(id);
  if (!el) return;
  if (graphInstances[id]){
    graphInstances[id].destroy();
    delete graphInstances[id];
  }
  const nodes = states.map(s => ({
    data: { id: s, label: mini ? (s === '∅' ? '∅' : s) : s },
    classes: [
      ...(s === start ? ['start'] : []),
      ...(accept.includes(s) ? ['accept'] : []),
      ...(activeStep?.source === s ? ['active'] : []),
      ...(activeNodes.includes(s) ? ['active'] : [])
    ]
  }));
  const edges = [];
  const grouped = {};
  Object.entries(trans).forEach(([s, by]) => {
    Object.entries(by).forEach(([a, rawTargets]) => {
      for (const t of (Array.isArray(rawTargets) ? rawTargets : [rawTargets])) {
        if (!trans[t]) continue;
        const k = `${s}→${t}`;
        (grouped[k] ??= { source: s, target: t, symbols: [], active: false }).symbols.push(a);
        if (activeStep?.source === s && activeStep?.target === t && activeStep?.symbol === a) {
          grouped[k].active = true;
        }
      }
    });
  });
  Object.values(grouped).forEach((g, i) => edges.push({
    data: { id: `e${i}`, source: g.source, target: g.target, label: g.symbols.join(', ') },
    classes: g.active ? ['active'] : []
  }));
  const cy = cytoscape({
    container: el,
    elements: [...nodes, ...edges],
    style: cyStyle(),
    layout: {
      name: 'cose',
      animate: false,
      fit: true,
      padding: 28,
      idealEdgeLength: mini ? 50 : 100,
      nodeRepulsion: mini ? 3200 : 5200
    },
    userZoomingEnabled: true,
    userPanningEnabled: true,
    boxSelectionEnabled: false
  });
  graphInstances[id] = cy;

  // If container is resized by user, keep Cytoscape viewport and canvas resized
  if (window.ResizeObserver && !el._hasResizeObserver) {
    el._hasResizeObserver = true;
    const ro = new ResizeObserver(() => {
      if (graphInstances[id]) {
        graphInstances[id].resize();
      }
    });
    ro.observe(el);
  }

  return cy;
}

// 2: Final Converted DFA (clean, no active highlight)
function drawFinalDfa(){
  if (!state.dfa) return;
  makeGraph('dfaFinalGraph', state.dfa.states, state.dfa.alphabet, state.dfa.transitions, state.dfa.start, state.dfa.accept, null);
}

function renderFinalDfaTable(){
  const d = state.dfa;
  $('#dfaFinalTable').innerHTML = `
    <table>
      <thead>
        <tr>
          <th>DFA State (Subset)</th>
          ${d.alphabet.map(a => `<th>on ${esc(a)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${d.states.map(q => `
          <tr class="${q === d.start ? 'is-start' : ''}">
            <td><strong>${esc(q)}</strong>${q === d.start ? ' <span class="tag-start">start</span>' : ''}${d.accept.includes(q) ? ' <span class="tag-acc">final</span>' : ''}</td>
            ${d.alphabet.map(a => `<td><code>${esc(d.transitions[q][a])}</code></td>`).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// 1: Input NFA graph (in section 1 below the input table, clean without simulation)
function drawInputNfa(){
  const n = getNfa();
  makeGraph('inputNfaGraph', n.states, n.alphabet, n.transitions, n.start, n.accept, null);
}

// 3: Step-by-step conversion simulation graph and dynamic table (section 3)
function updateStep(){
  const d = state.dfa;
  if (!d) return;
  const n = d.steps.length;
  $('#stepIndex').textContent = n ? `${Math.min(state.step + 1, n)} / ${n}` : '0 / 0';
  const step = d.steps[state.step];

  if (step) {
    const fromStates = step.nfaSources.length ? step.nfaSources.join(', ') : '∅';
    const toStates = step.nfaTargets.length ? step.nfaTargets.join(', ') : '∅';
    $('#stepText').innerHTML = `
      Expanding DFA subset state <strong>${esc(step.source)}</strong> on input symbol <strong>'${esc(step.symbol)}'</strong>:<br>
      Union of transitions for NFA states {${esc(fromStates)}} on '${esc(step.symbol)}' gives {${esc(toStates)}}.<br>
      Resulting DFA target state is <strong>${esc(step.target)}</strong>.
    `;
  } else {
    $('#stepText').textContent = 'Every reachable subset state has been processed. The subset construction is complete!';
  }

  // Draw step-by-step DFA graph on the left of section 3
  drawStepDfa();

  // Render step-by-step dynamic transition table on the right of section 3
  renderStepDfaTable();

  $('#prevStep').disabled = (state.step <= 0);
  $('#nextStep').disabled = (state.step >= n);
  $('#runSteps').disabled = !n;
  $('#runSteps').innerHTML = state.timer ? '<span>Ⅱ</span> Pause' : '<span>▶</span> Auto Run';
}

function drawStepDfa(){
  const d = state.dfa;
  if (!d) return;
  const currentStep = d.steps[state.step] || null;

  // Build partial graph including only states and transitions discovered up to this step
  const discoveredStates = new Set([d.start]);
  const partialTransitions = {};
  partialTransitions[d.start] = {};

  const limit = Math.min(state.step + 1, d.steps.length);
  for (let i = 0; i < limit; i++) {
    const s = d.steps[i];
    discoveredStates.add(s.source);
    discoveredStates.add(s.target);
    partialTransitions[s.source] ??= {};
    partialTransitions[s.target] ??= {};
    partialTransitions[s.source][s.symbol] = s.target;
  }

  // Also ensure empty targets have valid structure
  for (const st of discoveredStates) {
    partialTransitions[st] ??= {};
  }

  const activeAccept = d.accept.filter(s => discoveredStates.has(s));
  makeGraph('stepDfaGraph', [...discoveredStates], d.alphabet, partialTransitions, d.start, activeAccept, currentStep);
}

function renderStepDfaTable(){
  const d = state.dfa;
  if (!d) return;

  const currentStep = d.steps[state.step] || null;
  const limit = Math.min(state.step + 1, d.steps.length);

  // Collect discovered rows and their partially filled cells
  const discoveredOrder = [d.start];
  const tableData = {
    [d.start]: {}
  };

  for (let i = 0; i < limit; i++) {
    const s = d.steps[i];
    if (!discoveredOrder.includes(s.source)) discoveredOrder.push(s.source);
    if (!discoveredOrder.includes(s.target)) discoveredOrder.push(s.target);
    tableData[s.source] ??= {};
    tableData[s.target] ??= {};
    tableData[s.source][s.symbol] = s.target;
  }

  $('#stepDfaTable').innerHTML = `
    <table>
      <thead>
        <tr>
          <th>DFA State (Subset)</th>
          ${d.alphabet.map(a => `<th>on ${esc(a)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${discoveredOrder.map(q => {
          const isRowActive = currentStep && currentStep.source === q;
          return `
            <tr class="${q === d.start ? 'is-start' : ''} ${isRowActive ? 'step-row-active' : ''}">
              <td>
                <strong>${esc(q)}</strong>
                ${q === d.start ? ' <span class="tag-start">start</span>' : ''}
                ${d.accept.includes(q) ? ' <span class="tag-acc">final</span>' : ''}
              </td>
              ${d.alphabet.map(a => {
                const val = tableData[q]?.[a];
                const isCellActive = currentStep && currentStep.source === q && currentStep.symbol === a;
                if (val !== undefined) {
                  return `<td class="${isCellActive ? 'step-cell-active' : 'step-cell-filled'}"><code>${esc(val)}</code></td>`;
                }
                return `<td class="step-cell-pending"><em>pending</em></td>`;
              }).join('')}
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function moveStep(delta){
  if (!state.dfa) return;
  state.step = Math.max(0, Math.min(state.dfa.steps.length, state.step + delta));
  updateStep();
}

$('#prevStep').onclick = () => moveStep(-1);
$('#nextStep').onclick = () => moveStep(1);
$('#resetSteps').onclick = () => {
  clearInterval(state.timer);
  state.timer = null;
  state.step = 0;
  updateStep();
};
$('#runSteps').onclick = () => {
  if (state.timer){
    clearInterval(state.timer);
    state.timer = null;
    updateStep();
    return;
  }
  if (state.step >= state.dfa.steps.length) state.step = 0;
  state.timer = setInterval(() => {
    if (state.step >= state.dfa.steps.length){
      clearInterval(state.timer);
      state.timer = null;
      updateStep();
      return;
    }
    moveStep(1);
  }, 950);
  updateStep();
};

function renderAllGraphs(){
  if (state.dfa) {
    drawFinalDfa();
    drawStepDfa();
  }
  drawInputNfa();
  if (state.sim) drawNfaTraceGraph();
}

// 4: STRING SIMULATION
$('#simulateBtn').onclick = async () => {
  if (!state.dfa) return toast('Please convert the NFA first.', true);
  try {
    const input = $('#testString').value;
    const result = await api('/api/simulate', { nfa: getNfa(), input });
    if (result.nfa.accepted !== result.dfa.accepted) throw Error('Internal check failed: the two machines disagree.');
    state.sim = result;
    state.simStep = 0;
    $('#simTrace').hidden = false;
    const ok = result.dfa.accepted;
    $('#simResult').textContent = ok ? `Accepted — string reaches accepting state ${result.dfa.path[result.dfa.path.length-1]}.` : 'Rejected — string does not end in an accepting state.';
    $('#simResult').className = 'sim-result ' + (ok ? 'accepted' : 'rejected');
    $('#nfaVerdict').textContent = ok ? '✓ ACCEPT' : '✗ REJECT';
    $('#nfaVerdict').className = 'verdict ' + (ok ? 'ok' : 'no');
    $('#dfaVerdict').textContent = ok ? '✓ ACCEPT' : '✗ REJECT';
    $('#dfaVerdict').className = 'verdict ' + (ok ? 'ok' : 'no');
    $('#prevSim').disabled = true;
    $('#nextSim').disabled = result.dfa.path.length <= 1;
    $('#runSim').disabled = false;
    $('#resetSim').disabled = false;
    updateSim();
    $('#simTrace').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch(e) {
    toast(e.message, true);
  }
};

function updateSim(){
  if (!state.sim) return;
  const paths = [
    ['nfaTrace', state.sim.nfa.path.map(p => p.length ? `{${p.join(', ')}}` : '∅')],
    ['dfaTrace', state.sim.dfa.path]
  ];
  for (const [id, path] of paths) {
    $('#' + id).innerHTML = path.map((q, i) => `${i ? '<span class="path-arrow">→</span>' : ''}<span class="path-state ${i === state.simStep ? 'current' : ''}">${esc(q)}</span>`).join('');
  }
  $('#simStepIndex').textContent = `Step ${state.simStep + 1} of ${state.sim.dfa.path.length}`;
  const char = $('#testString').value[state.simStep - 1];
  $('#simStepText').textContent = (state.simStep === 0)
    ? `Initial state: ${state.sim.dfa.path[0]}`
    : `Read symbol "${char}" → moved to ${state.sim.dfa.path[state.simStep]}`;
  $('#prevSim').disabled = (state.simStep === 0);
  $('#nextSim').disabled = (state.simStep >= state.sim.dfa.path.length - 1);
  drawNfaTraceGraph();
}

function drawNfaTraceGraph(){
  const n = getNfa();
  const active = state.sim?.nfa.path[state.simStep] || [];
  makeGraph('nfaGraph', n.states, n.alphabet, n.transitions, n.start, n.accept, null, true, active);
}

function moveSim(delta){
  if (!state.sim) return;
  state.simStep = Math.max(0, Math.min(state.sim.dfa.path.length - 1, state.simStep + delta));
  updateSim();
}

$('#prevSim').onclick = () => moveSim(-1);
$('#nextSim').onclick = () => moveSim(1);
$('#resetSim').onclick = () => {
  clearInterval(state.simTimer);
  state.simTimer = null;
  state.simStep = 0;
  updateSim();
};
$('#runSim').onclick = () => {
  if (state.simTimer){
    clearInterval(state.simTimer);
    state.simTimer = null;
    $('#runSim').innerHTML = '▶ Auto Run';
    return;
  }
  if (state.simStep >= state.sim.dfa.path.length - 1) state.simStep = 0;
  $('#runSim').innerHTML = 'Ⅱ Pause';
  state.simTimer = setInterval(() => {
    if (state.simStep >= state.sim.dfa.path.length - 1){
      clearInterval(state.simTimer);
      state.simTimer = null;
      $('#runSim').innerHTML = '▶ Auto Run';
      return;
    }
    moveSim(1);
  }, 850);
};

$('#testString').addEventListener('keydown', e => {
  if (e.key === 'Enter') $('#simulateBtn').click();
});

// Initialize with example
$('#exampleBtn').click();
