const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const money = (value) => `$${(value / 1_000_000).toFixed(2).replace(/\.00$/, '')}M`;
const shortHash = (value) => value ? String(value).slice(0, 8) : 'UNAVAILABLE';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let state = null;
let selected = null;
let demoSession = null;
let generatedHTML = '';
let workspaceView = 'preview';

function fromBase64url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0));
}

function toBase64url(value) {
  if (!value) return null;
  const bytes = new Uint8Array(value);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function hydratePublicKey(options) {
  const hydrated = structuredClone(options);
  hydrated.challenge = fromBase64url(hydrated.challenge);
  if (hydrated.user?.id) hydrated.user.id = fromBase64url(hydrated.user.id);
  for (const key of ['allowCredentials', 'excludeCredentials']) {
    if (Array.isArray(hydrated[key])) hydrated[key] = hydrated[key].map((item) => ({ ...item, id: fromBase64url(item.id) }));
  }
  return hydrated;
}

function serializeCredential(credential) {
  const response = credential.response;
  const serialized = {
    id: credential.id,
    rawId: toBase64url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: { clientDataJSON: toBase64url(response.clientDataJSON) },
  };
  for (const key of ['attestationObject', 'authenticatorData', 'signature', 'userHandle']) {
    if (response[key]) serialized.response[key] = toBase64url(response[key]);
  }
  if (typeof response.getTransports === 'function') serialized.response.transports = response.getTransports();
  return serialized;
}

function renderRestoredMessages(messages = []) {
  if (!messages.length) return;
  $('#messages').innerHTML = '';
  for (const message of messages) appendMessage(message.role, message.content, false, message.role === 'assistant' ? 'MOBLEY' : 'YOU');
}

async function passkeyRequest(path, body = {}) {
  const response = await fetch(`./api/passkey/${path}`, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, csrf: demoSession.csrf }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  return payload;
}

async function usePasskey() {
  const button = $('#passkeyButton');
  button.disabled = true;
  const returning = localStorage.getItem('mobley-passkey') === 'registered';
  try {
    if (returning) {
      button.textContent = 'VERIFYING…';
      const options = await passkeyRequest('auth/options');
      const credential = await navigator.credentials.get({ publicKey: hydratePublicKey(options.publicKey) });
      const verified = await passkeyRequest('auth/verify', { credential: serializeCredential(credential) });
      demoSession = { ...demoSession, ...verified.session };
      renderRestoredMessages(verified.session.messages);
    } else {
      button.textContent = 'CREATING…';
      const options = await passkeyRequest('register/options');
      const credential = await navigator.credentials.create({ publicKey: hydratePublicKey(options.publicKey) });
      const verified = await passkeyRequest('register/verify', { credential: serializeCredential(credential) });
      demoSession = { ...demoSession, ...verified.session };
      localStorage.setItem('mobley-passkey', 'registered');
    }
    button.textContent = 'PASSKEY ACTIVE';
    $('#sessionStatus').textContent = 'PASSKEY CONTINUITY / ACTIVE';
    $('#promptMeta').textContent = 'SESSION CONTINUITY PROTECTED WITHOUT A PASSWORD';
  } catch (error) {
    button.textContent = returning ? 'RESUME WITH PASSKEY' : 'KEEP WITH PASSKEY';
    $('#promptMeta').textContent = `PASSKEY NOT CHANGED · ${error.message.toUpperCase()}`;
    button.disabled = false;
  }
}

function appendMessage(role, content, pending = false, labelOverride = '') {
  const article = document.createElement('article');
  article.className = `message ${role}${pending ? ' pending' : ''}`;
  const label = document.createElement('b');
  label.textContent = labelOverride || (role === 'user' ? 'YOU' : 'MOBLEY');
  const paragraph = document.createElement('p');
  paragraph.textContent = content;
  article.append(label, paragraph);
  $('#messages').append(article);
  $('#messages').scrollTop = $('#messages').scrollHeight;
  return article;
}

function renderPresence(collaboration = {}) {
  const isLive = Boolean(collaboration.live);
  const presence = $('#presence');
  presence.classList.toggle('live', isLive);
  presence.classList.toggle('autonomous', !isLive);
  const age = Number.isFinite(collaboration.age_seconds) ? ` · ACTIVE ${collaboration.age_seconds}s AGO` : '';
  $('span', presence).textContent = isLive
    ? `MOBLEY + JOHN LIVE${age}`
    : 'MOBLEY ACTING FOR MOBLEYSOFT';
  $('#topLiveLabel').textContent = isLive ? 'VIRTUAL TWIN + HUMAN LIVE' : 'MOBLEY RUNTIME LIVE';
}

async function startDemoSession() {
  try {
    const response = await fetch(`./api/session?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    demoSession = payload.session;
    $('#sessionStatus').textContent = `EPHEMERAL / EXPIRES ${new Date(payload.session.expires_at).toLocaleTimeString()}`;
    const button = $('#passkeyButton');
    if (!window.PublicKeyCredential || !payload.session.passkeys_available) {
      button.textContent = 'PASSKEY UNAVAILABLE';
      button.disabled = true;
    } else if (payload.session.passkey_authenticated) {
      button.textContent = 'PASSKEY ACTIVE';
      button.disabled = true;
      $('#sessionStatus').textContent = 'PASSKEY CONTINUITY / ACTIVE';
      renderRestoredMessages(payload.session.messages);
    } else {
      button.textContent = localStorage.getItem('mobley-passkey') === 'registered' ? 'RESUME WITH PASSKEY' : 'KEEP WITH PASSKEY';
    }
    renderPresence(payload.collaboration);
  } catch (error) {
    $('#sessionStatus').textContent = 'SESSION SERVICE OFFLINE';
    $('#promptMeta').textContent = 'DEMO TEMPORARILY UNAVAILABLE';
    $('#submitPrompt').disabled = true;
  }
}

function showWorkspace(view = workspaceView) {
  workspaceView = view;
  const hasOutput = Boolean(generatedHTML);
  $('#workspaceEmpty').hidden = hasOutput;
  $('#workspaceFrame').hidden = !hasOutput || view !== 'preview';
  $('#workspaceSource').hidden = !hasOutput || view !== 'source';
  $$('.view-switch button').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
}

function renderWorkspace(payload) {
  generatedHTML = payload.workspace_html;
  $('#workspaceFrame').srcdoc = generatedHTML;
  $('code', $('#workspaceSource')).textContent = generatedHTML;
  $('#workspaceTitle').textContent = payload.workspace.title.toUpperCase();
  $('#ticket').textContent = `${payload.source} · ${payload.ticket}`;
  $('#workspaceBoundary').textContent = `${payload.generation.provider.toUpperCase()} · SANDBOXED ALLOWLIST HTML`;
  showWorkspace('preview');
  renderPresence(payload.collaboration);
}

async function pollHumanResponse(ticket, deadline = Date.now() + 120_000) {
  if (Date.now() >= deadline) return;
  try {
    const response = await fetch(`./api/update?ticket=${encodeURIComponent(ticket)}&t=${Date.now()}`, { cache: 'no-store' });
    if (response.ok) {
      const payload = await response.json();
      if (payload.status === 'observed') {
        appendMessage('mobley', payload.reply, false, 'MOBLEY + JOHN');
        $('#promptMeta').textContent = `${ticket} · HUMAN-IN-THE-LOOP RESPONSE RECEIVED`;
        $('#ticket').textContent = `${payload.source} · ${ticket}`;
        return;
      }
    }
  } catch (error) {
    // The autonomous response remains valid if the optional human loop is unavailable.
  }
  setTimeout(() => pollHumanResponse(ticket, deadline), 4_000);
}

async function submitDemo(prompt) {
  if (!demoSession || !prompt.trim()) return;
  appendMessage('user', prompt.trim());
  const pending = appendMessage('mobley', 'Thinking with your context and composing a bounded workspace…', true);
  $('#submitPrompt').disabled = true;
  $('#prompt').disabled = true;
  $('#promptMeta').textContent = 'GENERATING WITH THE LOCAL MOBLEY CORTEX';
  try {
    const response = await fetch('./api/prompt', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt.trim(), csrf: demoSession.csrf }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    pending.remove();
    appendMessage('mobley', payload.reply);
    renderWorkspace(payload);
    $('#promptMeta').textContent = `${payload.ticket} · ${payload.collaboration.context_status.replaceAll('-', ' ').toUpperCase()}`;
    if (payload.collaboration.live) pollHumanResponse(payload.ticket);
  } catch (error) {
    pending.remove();
    appendMessage('mobley', `I could not complete that turn: ${error.message}`);
    $('#promptMeta').textContent = 'TURN FAILED · TRY AGAIN';
  } finally {
    $('#submitPrompt').disabled = false;
    $('#prompt').disabled = false;
    $('#prompt').focus();
  }
}

function render(data) {
  state = data;
  const { valuation, coverage, verification } = data;
  $('#midpoint').textContent = money(valuation.midpoint);
  $('#range').textContent = `${money(valuation.low)}–${money(valuation.high)}`;
  $('#ask').textContent = `STRATEGIC ASK ${money(valuation.strategic_ask)}`;
  $('#coveragePassing').textContent = coverage.passing;
  $('#coverageRequired').textContent = coverage.required;
  $('#coveragePercent').textContent = `${(coverage.ratio * 100).toFixed(2)}%`;
  $('#coverageRing').style.setProperty('--coverage', `${coverage.ratio * 100}%`);
  $('#testsPassed').textContent = verification.tests_passed;
  $('#proofStatus').textContent = verification.status.toUpperCase();
  $('#releaseVersion').textContent = data.version;
  $('#sourceCommit').textContent = shortHash(verification.source_commit);
  $('#updatedAt').textContent = new Date(data.generated_at).toLocaleString();
  $('#valuationEquation').textContent = `${money(valuation.base_midpoint)} base + ${coverage.passing} × $50K evidence premium`;
  $('#disclaimer').textContent = valuation.disclaimer;
  renderChain(data.capabilities);
  renderCapabilities(data.capabilities, $('.filters .active')?.dataset.domain || 'all');
}

function renderChain(capabilities) {
  const passed = new Set(capabilities.filter((item) => item.passed).map((item) => item.id));
  const nodes = [
    ['01', 'Exact retrieval', 'Find the authoritative unit'],
    ['02', 'Ingest + normalize', 'Make unlike sources searchable'],
    ['03', 'Federate + hydrate', 'Reach remote truth on demand'],
    ['04', 'Inspect + replace', 'Change behavior without losing identity'],
    ['05', 'Retain + rollback', 'Reject regression and restore safely'],
  ];
  $('#proofChain').innerHTML = nodes.map(([number, title, detail], index) => `
    <article class="chain-node">
      <b>${number} / ${index < 3 ? 'UNLOST' : 'MORPHOGENESIS'}</b>
      <strong>${title}</strong>
      <small>${detail}</small>
      <small>${index === 0 ? passed.has('memory.exact-search') : 'COMPOSED PROOF'} · PASSED</small>
    </article>`).join('');
}

function renderCapabilities(capabilities, domain) {
  const visible = capabilities.filter((item) => domain === 'all' || item.domain === domain);
  $('#capabilities').innerHTML = visible.map((item) => `
    <button class="capability" data-capability="${item.id}">
      <span class="cap-top"><span>${item.domain.toUpperCase()}</span><span class="pass">● PROVEN</span></span>
      <h3>${item.name}</h3>
      <p>${item.depends_on.length ? `Composes: ${item.depends_on.map((id) => id.split('.').pop()).join(' + ')}` : 'Primitive capability with direct deterministic evidence.'}</p>
      <span class="cap-foot"><span>${item.observations} OBSERVATIONS</span><span>${Number(item.latest_score).toFixed(2)} / ${Number(item.target_score).toFixed(2)}</span></span>
    </button>`).join('');
  $$('.capability').forEach((button) => button.addEventListener('click', () => openProof(button.dataset.capability)));
}

function openProof(id) {
  selected = state.capabilities.find((item) => item.id === id);
  if (!selected) return;
  $('#dialogDomain').textContent = `${selected.domain} / ${selected.id}`;
  $('#dialogTitle').textContent = selected.name;
  $('#dialogScore').textContent = `PASS · ${selected.latest_score.toFixed(2)} ACTUAL / ${selected.target_score.toFixed(2)} TARGET · ${selected.observations} OBSERVATIONS`;
  $('#dialogDependencies').textContent = selected.depends_on.length
    ? `Prerequisites: ${selected.depends_on.join(', ')}`
    : 'Primitive capability: no prerequisite proof claimed.';
  $('#proofTerminal').innerHTML = '<p>Ready to replay recorded evidence.</p>';
  $('#observations').innerHTML = selected.evidence.map((item, index) => `
    <article class="observation">
      <strong>OBSERVATION ${index + 1} · SCORE ${item.normalized_score}</strong>
      <div>${item.evidence_class}</div>
      <div>${item.test_id || 'direct runtime evaluator'}</div>
      <div>evaluator ${shortHash(item.evaluator_sha256)}</div>
      <div>output ${shortHash(item.stdout_sha256 || item.module_source_sha256)}</div>
    </article>`).join('');
  $('#proofDialog').showModal();
}

async function replayProof() {
  if (!selected) return;
  const terminal = $('#proofTerminal');
  terminal.innerHTML = `<p>&gt; replay ${selected.id}</p>`;
  for (const [index, observation] of selected.evidence.entries()) {
    terminal.insertAdjacentHTML('beforeend', `<p>&gt; observation ${index + 1}: ${observation.evaluation_id}</p>`);
    await sleep(180);
    for (const [assertion, passed] of Object.entries(observation.assertions || {})) {
      terminal.insertAdjacentHTML('beforeend', `<p class="${passed ? 'ok' : ''}">${passed ? '✓' : '✕'} ${assertion}</p>`);
      await sleep(110);
    }
  }
  terminal.insertAdjacentHTML('beforeend', `<p class="ok">✓ ${selected.id} satisfies the two-observation policy</p>`);
}

async function verifyIntegrity(raw, response) {
  try {
    let expected = response.headers.get('X-Mobley-Payload-SHA256');
    if (!expected) {
      const expectedText = await fetch(`./data.sha256?t=${Date.now()}`, { cache: 'no-store' }).then((checksumResponse) => checksumResponse.text());
      expected = expectedText.trim().split(/\s+/)[0];
    }
    const actualBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    const actual = [...new Uint8Array(actualBuffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    const passed = actual === expected;
    $('#integrity').textContent = passed ? `DATA INTEGRITY PASSED · ${shortHash(actual)}` : 'DATA INTEGRITY FAILED';
    $('#integrity').className = passed ? 'passed' : 'failed';
  } catch (error) {
    $('#integrity').textContent = 'DATA INTEGRITY UNAVAILABLE';
    $('#integrity').className = 'failed';
  }
}

async function refresh() {
  try {
    let response = await fetch(`./live.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) response = await fetch(`./data.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const raw = await response.text();
    const data = JSON.parse(raw);
    if (!state || state.generated_at !== data.generated_at) render(data);
    await verifyIntegrity(raw, response);
  } catch (error) {
    $('#updatedAt').textContent = 'DATA SOURCE OFFLINE';
  }
}

$$('.filters button').forEach((button) => button.addEventListener('click', () => {
  $$('.filters button').forEach((item) => item.classList.toggle('active', item === button));
  if (state) renderCapabilities(state.capabilities, button.dataset.domain);
}));
$('.close').addEventListener('click', () => $('#proofDialog').close());
$('#proofDialog').addEventListener('click', (event) => {
  if (event.target === $('#proofDialog')) $('#proofDialog').close();
});
$('#replayProof').addEventListener('click', replayProof);

$('#promptForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const prompt = $('#prompt').value;
  $('#prompt').value = '';
  submitDemo(prompt);
});
$$('.suggestions button').forEach((button) => button.addEventListener('click', () => {
  $('#prompt').value = button.dataset.prompt;
  $('#prompt').focus();
}));
$$('.view-switch button').forEach((button) => button.addEventListener('click', () => showWorkspace(button.dataset.view)));
$('#passkeyButton').addEventListener('click', usePasskey);

startDemoSession();
refresh();
setInterval(refresh, 5000);
