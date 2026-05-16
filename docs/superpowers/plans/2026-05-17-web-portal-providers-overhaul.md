# Web Portal & Provider Connection Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the web portal dashboard "Loading..." bug, add a Live Stats panel, fix the Providers page UX, and create a `connect-provider` CLI script for instant provider connection inside Claude Code.

**Architecture:** All web portal changes are edits inside the `DASHBOARD_HTML` and `PROVIDERS_HTML` template literal constants in `opencode-proxy-server.js`. A new `/api/stats` endpoint is added to the proxy's HTTP request handler. A new `bin/connect-provider` bash script is created independently of the proxy server.

**Tech Stack:** Node.js (proxy server), Bash (CLI script), vanilla JS (web portal), curl (API calls)

**CRITICAL CONSTRAINT:** Do NOT touch any model routing logic, model switching scripts (`switch-model`, `switch-model-visual`, `run-claude-opencode`), config file format, or any existing API endpoints. Only modify what is listed in the Files section below.

---

## Files

| File | Action |
|------|--------|
| `opencode-proxy-server.js` | Modify — add `PROXY_START_TIME`, `/api/stats` endpoint, fix `loadConfig()` JS, add Live Stats panel HTML, fix Providers page JS |
| `bin/connect-provider` | Create new script |
| `.claude/commands/connect-provider.md` | Create new slash command |

---

## Task 1: Add PROXY_START_TIME constant

**Files:**
- Modify: `opencode-proxy-server.js` near line 259

- [ ] **Step 1: Add PROXY_START_TIME after REQUEST_COUNTS**

Find this exact block (line ~259):
```javascript
const REQUEST_COUNTS = {
  'github-copilot': 0,
  gemini: 0,
  openai: 0,
  groq: 0,
  nvidia: 0,
  openrouter: 0,
  ollama: 0,
  opencode: 0,
  anthropic: 0,
};
let _oauthState = ''; // CSRF state for GitHub OAuth flow
```

Replace with:
```javascript
const REQUEST_COUNTS = {
  'github-copilot': 0,
  gemini: 0,
  openai: 0,
  groq: 0,
  nvidia: 0,
  openrouter: 0,
  ollama: 0,
  opencode: 0,
  anthropic: 0,
};
const PROXY_START_TIME = Date.now(); // used by /api/stats uptime calculation
let _oauthState = ''; // CSRF state for GitHub OAuth flow
```

- [ ] **Step 2: Verify the change compiles**

```bash
cd ~/Claude-Opencode-Ollama && node -e "require('./opencode-proxy-server.js')" 2>&1 | head -5
```
Expected: Process starts (may hang waiting for port) — kill with Ctrl+C or use timeout:
```bash
timeout 3 node opencode-proxy-server.js 2>&1 | head -3 || echo "Started OK (timed out as expected)"
```

---

## Task 2: Add `/api/stats` endpoint to proxy server

**Files:**
- Modify: `opencode-proxy-server.js` — insert after the `/api/active-model` endpoint (line ~1572)

- [ ] **Step 1: Find the exact insertion point**

```bash
grep -n "Active model override status" ~/Claude-Opencode-Ollama/opencode-proxy-server.js
```
Expected output: `1567:  // Active model override status`

- [ ] **Step 2: Insert the /api/stats endpoint**

Find this exact block (lines ~1567-1572):
```javascript
  // Active model override status
  if (method === 'GET' && reqPath === '/api/active-model') {
    const activeModel = readActiveModel();
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ model: activeModel }));
  }
```

Replace with:
```javascript
  // Active model override status
  if (method === 'GET' && reqPath === '/api/active-model') {
    const activeModel = readActiveModel();
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ model: activeModel }));
  }

  // Live stats — active model + per-provider request counts + uptime
  if (method === 'GET' && reqPath === '/api/stats') {
    const activeModel = readActiveModel();
    const totalRequests = Object.values(REQUEST_COUNTS).reduce((a, b) => a + b, 0);
    const providers = [
      { id: 'opencode',       name: 'OpenCode (free)',  requests: REQUEST_COUNTS.opencode       || 0 },
      { id: 'github-copilot', name: 'GitHub Copilot',   requests: REQUEST_COUNTS['github-copilot'] || 0 },
      { id: 'gemini',         name: 'Gemini',           requests: REQUEST_COUNTS.gemini         || 0 },
      { id: 'groq',           name: 'Groq',             requests: REQUEST_COUNTS.groq           || 0 },
      { id: 'openai',         name: 'OpenAI',           requests: REQUEST_COUNTS.openai         || 0 },
      { id: 'nvidia',         name: 'Nvidia NIM',       requests: REQUEST_COUNTS.nvidia         || 0 },
      { id: 'openrouter',     name: 'OpenRouter',       requests: REQUEST_COUNTS.openrouter     || 0 },
      { id: 'ollama',         name: 'Ollama',           requests: REQUEST_COUNTS.ollama         || 0 },
    ].filter(p => p.requests > 0);
    const uptime = Math.floor((Date.now() - PROXY_START_TIME) / 1000);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ activeModel, totalRequests, providers, uptime }));
  }
```

- [ ] **Step 3: Test the endpoint (proxy must be running)**

```bash
curl -s http://127.0.0.1:4001/api/stats | python3 -m json.tool
```
Expected:
```json
{
    "activeModel": "copilot/gpt-5-mini",
    "totalRequests": 31,
    "providers": [
        { "id": "opencode", "name": "OpenCode (free)", "requests": 31 }
    ],
    "uptime": 1234
}
```

- [ ] **Step 4: Restart proxy to pick up changes**

```bash
# Find and kill existing proxy
PROXY_PID=$(lsof -ti :4001 2>/dev/null) && [[ -n "$PROXY_PID" ]] && kill $PROXY_PID && echo "Killed PID $PROXY_PID" || echo "No proxy running"
sleep 1
cd ~/Claude-Opencode-Ollama && nohup node opencode-proxy-server.js > /tmp/opencode-proxy.log 2>&1 &
sleep 2
curl -s http://127.0.0.1:4001/api/stats | python3 -m json.tool
```
Expected: JSON with `activeModel`, `totalRequests`, `providers`, `uptime` keys.

- [ ] **Step 5: Commit**

```bash
cd ~/Claude-Opencode-Ollama && git add opencode-proxy-server.js && git commit -m "feat: add /api/stats endpoint — active model, request counts, uptime

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 3: Fix dashboard `loadConfig()` — add error handling + auto-retry

**Files:**
- Modify: `opencode-proxy-server.js` — inside `DASHBOARD_HTML` constant, the browser-side `loadConfig()` function

- [ ] **Step 1: Find the exact function to replace**

```bash
grep -n "async function loadConfig" ~/Claude-Opencode-Ollama/opencode-proxy-server.js
```
Expected: two results — line ~155 (Node.js server function) and line ~1087 (browser JS inside DASHBOARD_HTML). We modify only line ~1087.

- [ ] **Step 2: Replace the browser loadConfig() function**

Find this exact block (inside DASHBOARD_HTML, line ~1087):
```javascript
async function loadConfig(){
  cfg=await(await fetch('/api/config')).json();
  document.getElementById('d-go').textContent=(cfg.goModels||[]).length;
  document.getElementById('d-free').textContent=(cfg.freeModels||[]).length;
  document.getElementById('d-keys').innerHTML='<div style="font-size:12px;color:#8b949e;line-height:2">Go Plan: <code style="color:#58a6ff">'+cfg.apiKeyGo+'</code><br>Free Zen: <code style="color:#3fb950">'+cfg.apiKeyFree+'</code></div>';
  document.getElementById('d-summary').innerHTML='<div style="font-size:12px;color:#8b949e;line-height:2">Go models: <strong style="color:#58a6ff">'+(cfg.goModels||[]).length+'</strong> &nbsp;·&nbsp; Free models: <strong style="color:#3fb950">'+(cfg.freeModels||[]).length+'</strong> &nbsp;·&nbsp; No-vision: <strong style="color:#d29922">'+(cfg.nonVisionModels||[]).length+'</strong></div>';
  document.getElementById('inp-go').value=cfg.apiKeyGo||'';
  document.getElementById('inp-free').value=cfg.apiKeyFree||'';
  document.getElementById('inp-groq').value=cfg.groqApiKey||'';
  document.getElementById('inp-nvidia').value=cfg.nvidiaApiKey||'';
  document.getElementById('inp-openrouter').value=cfg.openrouterApiKey||'';
  renderModels();
}
```

Replace with:
```javascript
let _configRetried=false;
async function loadConfig(){
  try{
    cfg=await(await fetch('/api/config')).json();
    document.getElementById('d-go').textContent=(cfg.goModels||[]).length;
    document.getElementById('d-free').textContent=(cfg.freeModels||[]).length;
    document.getElementById('d-keys').innerHTML='<div style="font-size:12px;color:#8b949e;line-height:2">Go Plan: <code style="color:#58a6ff">'+cfg.apiKeyGo+'</code><br>Free Zen: <code style="color:#3fb950">'+cfg.apiKeyFree+'</code></div>';
    document.getElementById('d-summary').innerHTML='<div style="font-size:12px;color:#8b949e;line-height:2">Go models: <strong style="color:#58a6ff">'+(cfg.goModels||[]).length+'</strong> &nbsp;·&nbsp; Free models: <strong style="color:#3fb950">'+(cfg.freeModels||[]).length+'</strong> &nbsp;·&nbsp; No-vision: <strong style="color:#d29922">'+(cfg.nonVisionModels||[]).length+'</strong></div>';
    document.getElementById('inp-go').value=cfg.apiKeyGo||'';
    document.getElementById('inp-free').value=cfg.apiKeyFree||'';
    document.getElementById('inp-groq').value=cfg.groqApiKey||'';
    document.getElementById('inp-nvidia').value=cfg.nvidiaApiKey||'';
    document.getElementById('inp-openrouter').value=cfg.openrouterApiKey||'';
    renderModels();
    _configRetried=false;
  } catch(e) {
    const errHtml='<div style="font-size:12px;color:#f85149">❌ Failed to load — <button onclick="loadConfig()" style="background:none;border:1px solid #f85149;color:#f85149;cursor:pointer;padding:2px 8px;border-radius:4px;font-size:11px">Retry</button></div>';
    document.getElementById('d-keys').innerHTML=errHtml;
    document.getElementById('d-summary').innerHTML=errHtml;
    if(!_configRetried){_configRetried=true;setTimeout(loadConfig,1500);}
  }
}
```

- [ ] **Step 3: Verify syntax — no parse errors**

```bash
cd ~/Claude-Opencode-Ollama && node --check opencode-proxy-server.js && echo "Syntax OK"
```
Expected: `Syntax OK`

- [ ] **Step 4: Commit**

```bash
cd ~/Claude-Opencode-Ollama && git add opencode-proxy-server.js && git commit -m "fix: dashboard loadConfig() — add try-catch, retry button, auto-retry

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 4: Add Live Stats panel to Dashboard HTML + loadStats() JS

**Files:**
- Modify: `opencode-proxy-server.js` — `DASHBOARD_HTML` constant

- [ ] **Step 1: Add Live Stats panel HTML after the Model Summary panel**

Find this exact block (inside DASHBOARD_HTML, line ~952):
```html
      <div class="panel">
        <div class="panel-hdr"><span>🤖</span><span class="panel-title">Model Summary</span></div>
        <div class="panel-body" id="d-summary">Loading…</div>
      </div>
    </div>
    <div id="sec-logs" style="display:none">
```

Replace with:
```html
      <div class="panel">
        <div class="panel-hdr"><span>🤖</span><span class="panel-title">Model Summary</span></div>
        <div class="panel-body" id="d-summary">Loading…</div>
      </div>
      <div class="panel">
        <div class="panel-hdr" style="display:flex;align-items:center;justify-content:space-between"><span style="display:flex;align-items:center;gap:8px"><span>⚡</span><span class="panel-title">Live Stats</span></span><button onclick="loadStats()" style="background:none;border:1px solid #30363d;color:#8b949e;cursor:pointer;padding:2px 10px;border-radius:4px;font-size:11px">↻ Refresh</button></div>
        <div class="panel-body" id="d-stats">Loading…</div>
      </div>
    </div>
    <div id="sec-logs" style="display:none">
```

- [ ] **Step 2: Add loadStats() function before the closing loadConfig() call**

Find this exact block (inside DASHBOARD_HTML, line ~1144):
```javascript
function toast(msg,err){const el=document.getElementById('toast');el.textContent=msg;el.className='toast show'+(err?' error':'');setTimeout(()=>el.className='toast',3000);}
loadConfig();
</script>
```

Replace with:
```javascript
function toast(msg,err){const el=document.getElementById('toast');el.textContent=msg;el.className='toast show'+(err?' error':'');setTimeout(()=>el.className='toast',3000);}
async function loadStats(){
  try{
    const j=await(await fetch('/api/stats')).json();
    const upMin=Math.floor((j.uptime||0)/60);
    const upStr=upMin<60?upMin+'m uptime':Math.floor(upMin/60)+'h '+upMin%60+'m uptime';
    let html='<div style="font-size:12px;color:#8b949e;line-height:2">';
    html+='Active model: <code style="color:#58a6ff">'+(j.activeModel||'none')+'</code><br>';
    html+='Total requests: <strong style="color:#3fb950">'+(j.totalRequests||0)+'</strong> &nbsp;·&nbsp; '+upStr;
    if(j.providers&&j.providers.length){
      html+='<br><span style="color:#6e7681">By provider: ';
      html+=j.providers.map(p=>'<span style="color:#eee">'+p.name+'</span> <strong style="color:#58a6ff">'+p.requests+'</strong>').join(' &nbsp;·&nbsp; ');
      html+='</span>';
    }
    html+='</div>';
    document.getElementById('d-stats').innerHTML=html;
  } catch(e){
    document.getElementById('d-stats').innerHTML='<div style="font-size:12px;color:#6e7681">Stats unavailable — <button onclick="loadStats()" style="background:none;border:1px solid #444;color:#8b949e;cursor:pointer;padding:2px 8px;border-radius:4px;font-size:11px">Retry</button></div>';
  }
}
loadConfig();
loadStats();
setInterval(loadStats,10000);
</script>
```

- [ ] **Step 3: Verify syntax**

```bash
cd ~/Claude-Opencode-Ollama && node --check opencode-proxy-server.js && echo "Syntax OK"
```
Expected: `Syntax OK`

- [ ] **Step 4: Restart proxy and verify endpoint**

```bash
PROXY_PID=$(lsof -ti :4001 2>/dev/null) && [[ -n "$PROXY_PID" ]] && kill $PROXY_PID && sleep 1
cd ~/Claude-Opencode-Ollama && nohup node opencode-proxy-server.js > /tmp/opencode-proxy.log 2>&1 &
sleep 2
curl -s http://127.0.0.1:4001/api/stats | python3 -m json.tool
```
Expected: JSON with `activeModel`, `totalRequests`, `uptime` fields.

- [ ] **Step 5: Verify dashboard HTML contains d-stats element**

```bash
curl -s http://127.0.0.1:4001/ | grep -c "d-stats"
```
Expected: `1`

- [ ] **Step 6: Commit**

```bash
cd ~/Claude-Opencode-Ollama && git add opencode-proxy-server.js && git commit -m "feat: add Live Stats panel to dashboard — active model, requests, uptime

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 5: Fix Providers page — loading state + modal save feedback + request counts

**Files:**
- Modify: `opencode-proxy-server.js` — `PROVIDERS_HTML` constant

- [ ] **Step 1: Fix load() function — show loading state while fetching**

Find this exact block (inside PROVIDERS_HTML):
```javascript
async function load() {
  const r = await fetch('/api/providers').catch(() => null);
  if (!r || !r.ok) { document.getElementById('grid').textContent = '⚠️ Proxy unreachable'; return; }
  let data;
  try { data = await r.json(); }
  catch { document.getElementById('grid').textContent = '⚠️ Invalid response from proxy'; return; }
  providers = data.providers;

  // Check URL params for feedback
  const qs = new URLSearchParams(location.search);
  if (qs.get('connected') === 'github') toast('✅ GitHub connected as ' + (qs.get('user') || 'your account'), false);
  if (qs.get('error')) toast('❌ Error: ' + qs.get('error'), true);
  history.replaceState({}, '', '/providers');

  render();
}
```

Replace with:
```javascript
async function load() {
  document.getElementById('grid').innerHTML = '<div style="color:#8b949e;padding:32px;text-align:center;font-size:14px">⏳ Loading providers...</div>';
  const r = await fetch('/api/providers').catch(() => null);
  if (!r || !r.ok) { document.getElementById('grid').innerHTML = '<div style="color:#f85149;padding:32px;text-align:center">⚠️ Proxy unreachable — <button onclick="load()" style="background:none;border:1px solid #f85149;color:#f85149;cursor:pointer;padding:2px 8px;border-radius:4px;font-size:12px">Retry</button></div>'; return; }
  let data;
  try { data = await r.json(); }
  catch { document.getElementById('grid').innerHTML = '<div style="color:#f85149;padding:32px;text-align:center">⚠️ Invalid response from proxy</div>'; return; }
  providers = data.providers;

  // Check URL params for feedback
  const qs = new URLSearchParams(location.search);
  if (qs.get('connected') === 'github') toast('✅ GitHub connected as ' + (qs.get('user') || 'your account'), false);
  if (qs.get('error')) toast('❌ Error: ' + qs.get('error'), true);
  history.replaceState({}, '', '/providers');

  render();
}
```

- [ ] **Step 2: Fix submitKey() — show saving state, reload after success**

Find this exact block (inside PROVIDERS_HTML):
```javascript
async function submitKey() {
  const key = document.getElementById('modal-key').value.trim();
  if (!key) { toast('Please enter an API key', true); return; }
  try {
    const r = await fetch(`/api/providers/${currentProvider.id}/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: key }),
    });
    const j = await r.json();
    if (j.ok) { closeModal(); toast('✅ ' + currentProvider.name + ' connected'); await load(); }
    else { toast('❌ ' + (j.message || 'Error saving key'), true); }
  } catch { toast('❌ Network error — proxy unreachable', true); }
}
```

Replace with:
```javascript
async function submitKey() {
  const key = document.getElementById('modal-key').value.trim();
  if (!key) { toast('Please enter an API key', true); return; }
  const btn = document.querySelector('.btn-connect');
  if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }
  try {
    const r = await fetch(\`/api/providers/\${currentProvider.id}/connect\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: key }),
    });
    const j = await r.json();
    if (j.ok) { closeModal(); toast('✅ ' + currentProvider.name + ' connected!'); await load(); }
    else { toast('❌ ' + (j.message || 'Error saving key'), true); }
  } catch { toast('❌ Network error — proxy unreachable', true); }
  finally { if (btn) { btn.textContent = 'Save & Connect'; btn.disabled = false; } }
}
```

- [ ] **Step 3: Add request count to each provider card in render()**

Find this exact block inside the `render()` function (inside PROVIDERS_HTML):
```javascript
      <div class="meta">
        ${p.modelCount ? `<span>${p.modelCount} models</span>` : ''}
        <span>${p.requestCount} requests</span>
        ${p.note && p.authType === 'none' ? `<span>${p.note}</span>` : ''}
      </div>
```

Replace with (uses escaped template literals because it's inside a JS template literal):
```javascript
      <div class="meta">
        \${p.modelCount ? \`<span>\${p.modelCount} models</span>\` : ''}
        \${p.requestCount > 0 ? \`<span style="color:#3fb950">\${p.requestCount} requests this session</span>\` : \`<span style="color:#6e7681">0 requests</span>\`}
        \${p.note && p.authType === 'none' ? \`<span style="color:#8b949e">\${p.note}</span>\` : ''}
        \${!p.connected && p.getKeyUrl ? \`<a href="\${p.getKeyUrl}" target="_blank" style="color:#58a6ff;font-size:0.82em;text-decoration:none">→ Get API key</a>\` : ''}
      </div>
```

- [ ] **Step 4: Verify syntax**

```bash
cd ~/Claude-Opencode-Ollama && node --check opencode-proxy-server.js && echo "Syntax OK"
```
Expected: `Syntax OK`

- [ ] **Step 5: Restart proxy and check providers page loads**

```bash
PROXY_PID=$(lsof -ti :4001 2>/dev/null) && [[ -n "$PROXY_PID" ]] && kill $PROXY_PID && sleep 1
cd ~/Claude-Opencode-Ollama && nohup node opencode-proxy-server.js > /tmp/opencode-proxy.log 2>&1 &
sleep 2
curl -s http://127.0.0.1:4001/providers | grep -c "Load providers" && echo "Providers page serving OK"
```

- [ ] **Step 6: Commit**

```bash
cd ~/Claude-Opencode-Ollama && git add opencode-proxy-server.js && git commit -m "fix: providers page — loading state, save feedback, request counts, get-key links

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 6: Create `bin/connect-provider` script

**Files:**
- Create: `bin/connect-provider`

- [ ] **Step 1: Create the script**

Create file `bin/connect-provider` with this exact content:

```bash
#!/bin/bash
# connect-provider — Connect/disconnect AI providers to the Claude-Opencode proxy
#
# Usage (inside Claude Code with ! prefix — instant, zero tokens):
#   !~/bin/connect-provider                       → show status table
#   !~/bin/connect-provider status                → status table only
#   !~/bin/connect-provider gemini AIzaXXXX       → connect Google Gemini
#   !~/bin/connect-provider groq gsk_XXXX         → connect Groq
#   !~/bin/connect-provider openai sk-XXXX        → connect OpenAI
#   !~/bin/connect-provider nvidia nvapi-XXXX     → connect Nvidia NIM
#   !~/bin/connect-provider openrouter sk-or-XXX  → connect OpenRouter
#   !~/bin/connect-provider copilot               → connect via gh CLI OAuth
#   !~/bin/connect-provider disconnect groq       → disconnect a provider

PROXY_URL="http://127.0.0.1:4001"
REPO_DIR="$HOME/Claude-Opencode-Ollama"

ensure_proxy() {
  if ! curl -sf --max-time 2 "$PROXY_URL/health" >/dev/null 2>&1; then
    echo "  ⏳ Proxy not running, starting..."
    cd "$REPO_DIR" || { echo "  ❌ Could not find $REPO_DIR"; exit 1; }
    nohup node opencode-proxy-server.js > /tmp/opencode-proxy.log 2>&1 &
    for i in {1..15}; do
      sleep 1
      curl -sf --max-time 1 "$PROXY_URL/health" >/dev/null 2>&1 && echo "  ✅ Proxy started" && return
    done
    echo "  ❌ Proxy failed to start — check: /tmp/opencode-proxy.log"
    exit 1
  fi
}

show_status() {
  ensure_proxy
  local data; data=$(curl -sf --max-time 5 "$PROXY_URL/api/providers" 2>/dev/null) || {
    echo "  ❌ Could not reach proxy at $PROXY_URL"
    exit 1
  }
  echo ""
  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║              PROVIDER CONNECTION STATUS                  ║"
  echo "╚══════════════════════════════════════════════════════════╝"
  echo ""
  echo "$data" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for i, p in enumerate(data.get('providers', []), 1):
    pid     = p.get('id', '')
    name    = p.get('name', pid)
    conn    = p.get('connected', False)
    mcount  = p.get('modelCount', 0)
    reqs    = p.get('requestCount', 0)
    note    = p.get('note', '')
    key_url = p.get('getKeyUrl', '')
    mark    = '✅' if conn else '❌'
    if conn:
        parts = []
        if mcount: parts.append(f'{mcount} models')
        if reqs:   parts.append(f'{reqs} reqs')
        if note:   parts.append(f'[{note}]')
        detail = '  ·  '.join(parts) if parts else 'connected'
        print(f'  {i}. {mark} {name:<22} {detail}')
    else:
        url_hint = f'  get key → {key_url}' if key_url else ''
        print(f'  {i}. {mark} {name:<22} —{url_hint}')
"
  echo ""
  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║  To connect:  !~/bin/connect-provider groq YOUR_KEY      ║"
  echo "║  Copilot:     !~/bin/connect-provider copilot            ║"
  echo "╚══════════════════════════════════════════════════════════╝"
  echo ""
}

connect_provider() {
  local provider="$1"
  local key="$2"
  ensure_proxy

  case "$provider" in
    copilot|github-copilot)
      echo ""
      echo "  Connecting GitHub Copilot via gh CLI OAuth..."
      if ! command -v gh &>/dev/null; then
        echo "  ❌ gh CLI not installed."
        echo "     macOS:  brew install gh"
        echo "     Linux:  https://cli.github.com/manual/installation"
        exit 1
      fi
      gh auth login
      echo "  ✅ GitHub authenticated!"
      echo "  → Switch to a Copilot model: !~/bin/switch-model-visual"
      echo ""
      ;;

    ollama)
      echo ""
      echo "  ℹ️  Ollama connects automatically when running at localhost:11434"
      echo "     Start Ollama:   ollama serve"
      echo "     Pull a model:   ollama pull qwen3:8b"
      echo "     Browse models:  https://ollama.com/library"
      echo ""
      ;;

    opencode)
      echo ""
      echo "  ℹ️  OpenCode (free tier) is always on — no key needed."
      echo "     Free models include: minimax-m2.5-free, ring-2.6-1t-free, nemotron-3-super-free"
      echo "     These are already available in your model list."
      echo ""
      ;;

    gemini|groq|openai|nvidia|openrouter)
      if [[ -z "$key" ]]; then
        echo ""
        echo "  ❌ API key required."
        echo "  Usage: !~/bin/connect-provider $provider YOUR_API_KEY"
        case "$provider" in
          gemini)     echo "  Get key → https://aistudio.google.com/apikey" ;;
          groq)       echo "  Get key → https://console.groq.com/keys" ;;
          openai)     echo "  Get key → https://platform.openai.com/api-keys" ;;
          nvidia)     echo "  Get key → https://build.nvidia.com" ;;
          openrouter) echo "  Get key → https://openrouter.ai/keys" ;;
        esac
        echo ""
        exit 1
      fi

      echo ""
      echo "  Connecting $provider..."
      local result; result=$(curl -sf --max-time 10 \
        -X POST "$PROXY_URL/api/providers/$provider/connect" \
        -H "Content-Type: application/json" \
        -d "{\"apiKey\":\"$key\"}" 2>/dev/null) || {
        echo "  ❌ Proxy unreachable — check: !cat /tmp/opencode-proxy.log"
        exit 1
      }

      local ok; ok=$(echo "$result" | python3 -c "import json,sys; print(json.load(sys.stdin).get('ok','false'))" 2>/dev/null)
      if [[ "$ok" == "True" ]]; then
        # Get updated provider info
        local pdata; pdata=$(curl -sf --max-time 5 "$PROXY_URL/api/providers" 2>/dev/null)
        local mcount; mcount=$(echo "$pdata" | python3 -c "
import json,sys
data=json.load(sys.stdin)
for p in data.get('providers',[]):
    if p['id']=='$provider':
        print(p.get('modelCount',0))
        break
else:
    print(0)
" 2>/dev/null || echo "?")

        echo "  ✅ Connected! $provider · $mcount models available"

        # Suggest first available model for this provider
        local first_model; first_model=$(curl -sf --max-time 5 "$PROXY_URL/v1/models" 2>/dev/null | python3 -c "
import json,sys
data=json.load(sys.stdin)
prefix='$provider/'
for m in data.get('data',[]):
    mid=m.get('id','')
    if mid.startswith(prefix):
        print(mid)
        break
" 2>/dev/null)
        [[ -n "$first_model" ]] && echo "  → Switch to it:  !~/bin/switch-model-visual $first_model"
        echo ""
      else
        local err; err=$(echo "$result" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('message','Unknown error'))" 2>/dev/null || echo "Unknown error")
        echo "  ❌ Failed: $err"
        echo ""
        exit 1
      fi
      ;;

    *)
      echo ""
      echo "  ❌ Unknown provider: $provider"
      echo "  Valid providers: gemini  groq  openai  nvidia  openrouter  copilot  ollama  opencode"
      echo "  Usage: !~/bin/connect-provider PROVIDER [API_KEY]"
      echo ""
      exit 1
      ;;
  esac
}

disconnect_provider() {
  local provider="$1"
  if [[ -z "$provider" ]]; then
    echo ""
    echo "  ❌ Specify a provider. Example: !~/bin/connect-provider disconnect groq"
    echo "  Valid: gemini  groq  openai  nvidia  openrouter"
    echo ""
    exit 1
  fi
  ensure_proxy
  local result; result=$(curl -sf --max-time 5 \
    -X POST "$PROXY_URL/api/providers/$provider/disconnect" 2>/dev/null) || {
    echo "  ❌ Proxy unreachable"
    exit 1
  }
  local ok; ok=$(echo "$result" | python3 -c "import json,sys; print(json.load(sys.stdin).get('ok','false'))" 2>/dev/null)
  echo ""
  [[ "$ok" == "True" ]] && echo "  ✅ Disconnected $provider" || echo "  ❌ Failed to disconnect $provider"
  echo ""
}

# ── Dispatch ──────────────────────────────────────────────────────────────────
case "${1:-}" in
  ""|status|-s)
    show_status
    ;;
  disconnect|remove)
    disconnect_provider "$2"
    ;;
  *)
    connect_provider "$1" "$2"
    ;;
esac
```

- [ ] **Step 2: Make executable**

```bash
chmod +x ~/Claude-Opencode-Ollama/bin/connect-provider
```

- [ ] **Step 3: Verify the script runs (status command)**

```bash
~/Claude-Opencode-Ollama/bin/connect-provider status
```
Expected: Prints provider status table with ✅/❌ for each provider.

- [ ] **Step 4: Test invalid provider returns helpful error**

```bash
~/Claude-Opencode-Ollama/bin/connect-provider invalidprovider
```
Expected: `❌ Unknown provider: invalidprovider` + list of valid providers.

- [ ] **Step 5: Test missing key returns helpful error**

```bash
~/Claude-Opencode-Ollama/bin/connect-provider groq
```
Expected: `❌ API key required` + `Get key → https://console.groq.com/keys`

- [ ] **Step 6: Commit**

```bash
cd ~/Claude-Opencode-Ollama && git add bin/connect-provider && git commit -m "feat: add connect-provider CLI script — status table, direct connect, OAuth

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 7: Add slash command + install to ~/bin/ + final verification

**Files:**
- Create: `.claude/commands/connect-provider.md`
- Install: `~/bin/connect-provider`

- [ ] **Step 1: Create the slash command**

Create `.claude/commands/connect-provider.md`:
```markdown
---
description: Connect or check AI provider status. Usage: /connect-provider [provider] [apikey]
---
Run this shell command and show the output:
!~/bin/connect-provider $ARGUMENTS
```

- [ ] **Step 2: Install script to ~/bin/**

```bash
cp ~/Claude-Opencode-Ollama/bin/connect-provider ~/bin/connect-provider
chmod +x ~/bin/connect-provider
```

- [ ] **Step 3: Verify ~/bin/connect-provider is in PATH**

```bash
which connect-provider
```
Expected: `/Users/armaan/bin/connect-provider`

- [ ] **Step 4: Full end-to-end verification**

```bash
# 1. Status table works
connect-provider status

# 2. Direct run via full path (as used with ! prefix in Claude Code)
~/bin/connect-provider status

# 3. Dashboard API Keys and Model Summary load (not stuck at Loading...)
curl -s http://127.0.0.1:4001/ | python3 -c "
import sys
html = sys.stdin.read()
# d-keys and d-summary should still say Loading... in HTML (JS fills them)
# but d-stats should exist
print('d-stats present:', 'd-stats' in html)
print('loadStats present:', 'loadStats' in html)
print('_configRetried present:', '_configRetried' in html)
print('/api/stats fetch present:', '/api/stats' in html)
"

# 4. /api/stats endpoint returns valid JSON
curl -s http://127.0.0.1:4001/api/stats | python3 -c "
import json,sys
d=json.load(sys.stdin)
assert 'activeModel' in d, 'missing activeModel'
assert 'totalRequests' in d, 'missing totalRequests'
assert 'uptime' in d, 'missing uptime'
print('✅ /api/stats OK:', d)
"

# 5. Providers page serves HTML with loading state
curl -s http://127.0.0.1:4001/providers | grep -c "Loading providers" && echo "✅ Providers loading state present"
```

Expected output:
```
d-stats present: True
loadStats present: True
_configRetried present: True
/api/stats fetch present: True
✅ /api/stats OK: {'activeModel': 'copilot/gpt-5-mini', 'totalRequests': 31, ...}
1
✅ Providers loading state present
```

- [ ] **Step 5: Commit slash command and final sync**

```bash
cd ~/Claude-Opencode-Ollama
cp ~/.claude/commands/connect-provider.md .claude/commands/connect-provider.md 2>/dev/null || true
git add .claude/commands/connect-provider.md bin/connect-provider
git commit -m "feat: add /connect-provider slash command and complete provider CLI

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

- [ ] **Step 6: Push to GitHub**

```bash
cd ~/Claude-Opencode-Ollama && git push origin main
```

- [ ] **Step 7: Sync latest scripts to ~/bin/**

```bash
cp ~/Claude-Opencode-Ollama/bin/connect-provider ~/bin/connect-provider
chmod +x ~/bin/connect-provider
echo "✅ All done. Test in Claude Code with: !~/bin/connect-provider"
```

---

## Quick Reference After Implementation

```bash
# In Claude Code (instant, no tokens):
!~/bin/connect-provider                      # show all provider status
!~/bin/connect-provider gemini AIzaXXX       # connect Gemini
!~/bin/connect-provider groq gsk_XXX         # connect Groq
!~/bin/connect-provider openai sk-XXX        # connect OpenAI
!~/bin/connect-provider nvidia nvapi-XXX     # connect Nvidia
!~/bin/connect-provider openrouter sk-or-XXX # connect OpenRouter
!~/bin/connect-provider copilot              # OAuth via gh CLI
!~/bin/connect-provider disconnect groq      # disconnect Groq

# Web portal
open http://127.0.0.1:4001/           # Dashboard (Live Stats auto-refreshes)
open http://127.0.0.1:4001/providers  # Provider cards with Connect buttons
```
