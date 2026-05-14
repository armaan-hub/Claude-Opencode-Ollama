/**
 * OpenCode Zen Proxy Server
 *
 * Bridges Claude Code (Anthropic protocol) → OpenCode Zen (OpenAI-compatible)
 *
 * What it does:
 *  - HEAD / and GET /  → 200 OK (connectivity check for Claude Code)
 *  - GET /v1/models    → proxies OpenCode Zen models list (so Claude Code picker shows all models)
 *  - POST /v1/messages → converts Anthropic format → OpenAI format, forwards to OpenCode Zen,
 *                        converts response back to Anthropic format (streaming + non-streaming)
 *
 * Run:  node ~/opencode-proxy-server.js
 * Port: 4001
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { saveOauthState, readOauthState, deleteOauthState, STATE_PATH } = require('./lib/oauth_state');

const PORT = 4001;
const OPENCODE_HOST = 'opencode.ai';
const OPENCODE_BASE_GO = '/zen/go/v1';   // Go plan (subscription)
const OPENCODE_BASE_ZEN = '/zen/v1';     // Zen plan (free models)

// ─── Additional provider endpoints ───────────────────────────────────────────
const ACTIVE_MODEL_PATH = path.join(os.homedir(), '.claude', 'active-model');
const GROQ_HOST    = 'api.groq.com';
const GROQ_BASE    = '/openai/v1';
const NVIDIA_HOST  = 'integrate.api.nvidia.com';
const NVIDIA_BASE  = '/v1';
const OPENROUTER_HOST = 'openrouter.ai';
const OPENROUTER_BASE = '/api/v1';
const OLLAMA_HOST  = '127.0.0.1';
const OLLAMA_PORT  = 11434;
const OLLAMA_BASE  = '/v1';
const GEMINI_HOST  = 'generativelanguage.googleapis.com';
const GEMINI_BASE  = '/v1beta/openai';   // OpenAI-compatible endpoint
const OPENAI_HOST  = 'api.openai.com';
const OPENAI_BASE  = '/v1';

const COPILOT_HOST           = 'api.githubcopilot.com';
const COPILOT_EDITOR_VERSION = 'vscode/1.99.0';
const COPILOT_INTEGRATION_ID = 'vscode-chat';
const COPILOT_MODELS = [
  'copilot/claude-opus-4.7',
  'copilot/claude-opus-4.6-1m',
  'copilot/claude-sonnet-4.6',
  'copilot/claude-sonnet-4.5',
  'copilot/claude-haiku-4.5',
  'copilot/claude-opus-4.5',
  'copilot/gpt-5.4',
  'copilot/gpt-5.2',
  'copilot/gpt-5-mini',
  'copilot/gpt-4.1',
  'copilot/grok-code-fast-1',
];

// Rate multipliers match GitHub Copilot CLI's model selector (0 = free, 1 = standard, etc.)
const COPILOT_RATE_MULTIPLIERS = {
  'copilot/gpt-5.5':            7.5,
  'copilot/gpt-5.4':            1,
  'copilot/gpt-5.2':            1,
  'copilot/gpt-5-mini':         0,
  'copilot/gpt-4.1':            0,
  'copilot/claude-sonnet-4.6':  1,
  'copilot/claude-sonnet-4.5':  1,
  'copilot/claude-haiku-4.5':   0.33,
  'copilot/claude-opus-4.7':    15,
  'copilot/claude-opus-4.6-1m': 15,
  'copilot/claude-opus-4.5':    1,
  'copilot/grok-code-fast-1':   1,
};

const CONFIG_PATH = path.join(os.homedir(), 'opencode-proxy-config.json');

const DEFAULT_CONFIG = {
  apiKeyGo:   '',
  apiKeyFree: '',
  goModels: [
    'glm-5', 'glm-5.1', 'kimi-k2.5', 'kimi-k2.6',
    'mimo-v2.5', 'mimo-v2.5-pro', 'mimo-v2-omni', 'mimo-v2-pro',
    'minimax-m2.5', 'minimax-m2.7', 'qwen3.5-plus', 'qwen3.6-plus',
    'deepseek-v4-pro', 'deepseek-v4-flash', 'hy3-preview',
  ],
  freeModels: [
    'big-pickle', 'minimax-m2.5-free', 'ring-2.6-1t-free',
    'trinity-large-preview-free', 'nemotron-3-super-free',
    'mimo-v2-flash-free', 'mimo-v2-omni-free', 'mimo-v2-pro-free',
    'glm-5-free', 'kimi-k2.5-free', 'qwen3.6-plus-free',
    'hy3-preview-free', 'ling-2.6-flash-free', 'minimax-m2.1-free',
  ],
  nonVisionModels: [
    'minimax-m2.5-free', 'minimax-m2.1-free',
    'mimo-v2-flash-free', 'mimo-v2.5', 'mimo-v2.5-pro',
    'nemotron-3-super-free', 'big-pickle',
    'ring-2.6-1t-free', 'trinity-large-preview-free',
    'deepseek-v4-flash', 'deepseek-v4-pro',
    'ling-2.6-flash-free',
  ],
  groqApiKey: '',
  nvidiaApiKey: '',
  openrouterApiKey: '',
  geminiApiKey: '',
  openaiApiKey: '',
  githubOAuthClientId:     '',
  githubOAuthClientSecret: '',
  githubOAuthToken:        '',   // stored after successful OAuth
  githubOAuthUsername:     '',   // e.g. 'armaan-hub'
  groqModels: [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'deepseek-r1-distill-llama-70b-32768',
    'mixtral-8x7b-32768',
    'gemma2-9b-it',
  ],
  nvidiaModels: [
    'meta/llama-3.3-70b-instruct',
    'meta/llama-3.1-8b-instruct',
    'nvidia/llama-3.1-nemotron-70b-instruct',
    'mistralai/mistral-7b-instruct-v0.3',
  ],
  openrouterModels: [
    'google/gemma-3-27b-it:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'deepseek/deepseek-r1:free',
    'qwen/qwen3-8b:free',
  ],
  ollamaModels: [
    'qwen3:8b',
    'qwen3:14b',
    'llama3.3:70b',
  ],
  geminiModels: [
    'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash',
    'gemini-1.5-pro', 'gemini-1.5-flash',
  ],
  openaiModels: [
    'gpt-4o', 'gpt-4o-mini', 'o3-mini', 'o4-mini',
    'gpt-4.1', 'codex-mini-latest',
  ],
};

function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    try {
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    } catch (parseErr) {
      console.error(`[CONFIG] Invalid JSON in ${CONFIG_PATH}: ${parseErr.message} — using defaults`);
      return { ...DEFAULT_CONFIG };
    }
  } catch {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

// ─── Log buffer + SSE (must be set up before loadConfig so startup errors appear in dashboard) ──
const LOG_BUFFER_SIZE = 500;
const logBuffer      = [];
const logSubscribers = [];

const _origLog = console.log.bind(console);
const _origErr = console.error.bind(console);

function proxyLog(level, ...args) {
  const line = args.map(a => {
    if (typeof a === 'string') return a;
    if (a instanceof Error) return `${a.name}: ${a.message}`;
    try { return JSON.stringify(a); } catch { return String(a); }
  }).join(' ');
  const ts    = new Date().toISOString().slice(11, 19);
  const entry = JSON.stringify({ ts, level, line });
  logBuffer.push(entry);
  if (logBuffer.length > LOG_BUFFER_SIZE) logBuffer.shift();
  const ssePayload = `event: log\ndata: ${entry}\n\n`;
  for (let i = logSubscribers.length - 1; i >= 0; i--) {
    try { logSubscribers[i].write(ssePayload); }
    catch { logSubscribers.splice(i, 1); }
  }
  if (level === 'error') _origErr(...args);
  else _origLog(...args);
}

console.log   = (...a) => proxyLog('info',  ...a);
console.error = (...a) => proxyLog('error', ...a);
// ─────────────────────────────────────────────────────────────────────────────

let CFG = loadConfig();

function rebuildSets() {
  GO_MODELS         = new Set(Array.isArray(CFG.goModels)        ? CFG.goModels        : DEFAULT_CONFIG.goModels);
  ZEN_FREE_MODELS   = new Set(Array.isArray(CFG.freeModels)      ? CFG.freeModels      : DEFAULT_CONFIG.freeModels);
  NON_VISION_MODELS = new Set(Array.isArray(CFG.nonVisionModels) ? CFG.nonVisionModels : DEFAULT_CONFIG.nonVisionModels);
  API_KEY_GO        = typeof CFG.apiKeyGo   === 'string' ? CFG.apiKeyGo   : DEFAULT_CONFIG.apiKeyGo;
  API_KEY_FREE      = typeof CFG.apiKeyFree === 'string' ? CFG.apiKeyFree : DEFAULT_CONFIG.apiKeyFree;
  GROQ_MODELS       = new Set(Array.isArray(CFG.groqModels)       ? CFG.groqModels       : DEFAULT_CONFIG.groqModels);
  NVIDIA_MODELS     = new Set(Array.isArray(CFG.nvidiaModels)     ? CFG.nvidiaModels     : DEFAULT_CONFIG.nvidiaModels);
  OPENROUTER_MODELS = new Set(Array.isArray(CFG.openrouterModels) ? CFG.openrouterModels : DEFAULT_CONFIG.openrouterModels);
  OLLAMA_MODELS     = new Set(Array.isArray(CFG.ollamaModels)     ? CFG.ollamaModels     : DEFAULT_CONFIG.ollamaModels);
  GROQ_API_KEY      = typeof CFG.groqApiKey       === 'string' ? CFG.groqApiKey       : DEFAULT_CONFIG.groqApiKey;
  NVIDIA_API_KEY    = typeof CFG.nvidiaApiKey     === 'string' ? CFG.nvidiaApiKey     : DEFAULT_CONFIG.nvidiaApiKey;
  OPENROUTER_API_KEY= typeof CFG.openrouterApiKey === 'string' ? CFG.openrouterApiKey : DEFAULT_CONFIG.openrouterApiKey;
  GEMINI_MODELS     = new Set(Array.isArray(CFG.geminiModels)   ? CFG.geminiModels   : DEFAULT_CONFIG.geminiModels);
  OPENAI_MODELS     = new Set(Array.isArray(CFG.openaiModels)   ? CFG.openaiModels   : DEFAULT_CONFIG.openaiModels);
  GEMINI_API_KEY    = typeof CFG.geminiApiKey  === 'string' ? CFG.geminiApiKey  : DEFAULT_CONFIG.geminiApiKey;
  OPENAI_API_KEY    = typeof CFG.openaiApiKey  === 'string' ? CFG.openaiApiKey  : DEFAULT_CONFIG.openaiApiKey;
}

// GEMINI_MODELS / OPENAI_MODELS: used for /v1/models listing. Routing uses startsWith() prefix matching.
let GO_MODELS, ZEN_FREE_MODELS, NON_VISION_MODELS, API_KEY_GO, API_KEY_FREE, GROQ_MODELS, NVIDIA_MODELS, OPENROUTER_MODELS, OLLAMA_MODELS, GEMINI_MODELS, OPENAI_MODELS, GROQ_API_KEY, NVIDIA_API_KEY, OPENROUTER_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY;
rebuildSets();

function getEndpoint(modelId) {
  if (ZEN_FREE_MODELS.has(modelId)) return { base: OPENCODE_BASE_ZEN, apiKey: API_KEY_FREE };
  return { base: OPENCODE_BASE_GO, apiKey: API_KEY_GO };
}

// ─── Active model override ────────────────────────────────────────────────────
function readActiveModel() {
  try {
    const content = fs.readFileSync(ACTIVE_MODEL_PATH, 'utf8').trim();
    return content || null;
  } catch {
    return null;
  }
}

// ─── GitHub Copilot token cache ─────────────────────────────────────────────
let _copilotToken     = null;
let _copilotTokenTime = 0;
const COPILOT_TOKEN_TTL = 5 * 60 * 1000; // 5 minutes
// ─── Per-provider request counter (in-memory, reset on proxy restart) ────────
const REQUEST_COUNTS = {
  'github-copilot': 0,
  gemini: 0,
  openai: 0,
  groq: 0,
  nvidia: 0,
  openrouter: 0,
  ollama: 0,
  opencode: 0,
};
let _oauthState = ''; // CSRF state for GitHub OAuth flow

function getCopilotToken(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && _copilotToken && now - _copilotTokenTime < COPILOT_TOKEN_TTL) {
    return _copilotToken;
  }
  // Prefer stored OAuth token from our own GitHub OAuth App
  if (CFG.githubOAuthToken) {
    _copilotToken     = CFG.githubOAuthToken;
    _copilotTokenTime = now;
    return _copilotToken;
  }
  // Fallback: use gh CLI token
  try {
    // NOTE: execSync blocks the event loop ~100-400ms on refresh. Acceptable for
    // single-user proxy (5-min TTL = rare). For multi-user, use async exec + promise queue.
    _copilotToken = require('child_process').execSync('gh auth token', {
      encoding: 'utf8',
      env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}` },
    }).trim();
    _copilotTokenTime = now;
    return _copilotToken;
  } catch {
    _copilotToken     = null;
    _copilotTokenTime = 0;
    return null;
  }
}

// ─── Route model to provider ──────────────────────────────────────────────────
function getProviderForModel(modelId) {
  if (modelId.startsWith('copilot/')) {
    const actualModel = modelId.slice('copilot/'.length);
    if (!actualModel) return null; // malformed "copilot/" with no model name
    const token       = getCopilotToken();
    return {
      name:         'GitHub Copilot',
      host:         COPILOT_HOST,
      base:         '',
      port:         443,
      ssl:          true,
      apiKey:       token || '',
      actualModel,
      extraHeaders: {
        'Editor-Version':        COPILOT_EDITOR_VERSION,
        'Copilot-Integration-Id': COPILOT_INTEGRATION_ID,
      },
    };
  }
  if (modelId.startsWith('gemini/')) {
    const actualModel = modelId.slice('gemini/'.length);
    if (!actualModel) return null;
    return {
      name:       'Google Gemini',
      host:       GEMINI_HOST,
      base:       GEMINI_BASE,
      port:       443,
      ssl:        true,
      apiKey:     GEMINI_API_KEY,
      actualModel,
    };
  }
  if (modelId.startsWith('openai/')) {
    const actualModel = modelId.slice('openai/'.length);
    if (!actualModel) return null;
    return {
      name:       'OpenAI',
      host:       OPENAI_HOST,
      base:       OPENAI_BASE,
      port:       443,
      ssl:        true,
      apiKey:     OPENAI_API_KEY,
      actualModel,
    };
  }
  if (GROQ_MODELS.has(modelId))
    return { name: 'Groq',       host: GROQ_HOST,       base: GROQ_BASE,       port: 443,        ssl: true,  apiKey: GROQ_API_KEY };
  if (NVIDIA_MODELS.has(modelId))
    return { name: 'Nvidia NIM', host: NVIDIA_HOST,     base: NVIDIA_BASE,     port: 443,        ssl: true,  apiKey: NVIDIA_API_KEY };
  if (OPENROUTER_MODELS.has(modelId))
    return { name: 'OpenRouter', host: OPENROUTER_HOST, base: OPENROUTER_BASE, port: 443,        ssl: true,  apiKey: OPENROUTER_API_KEY };
  if (OLLAMA_MODELS.has(modelId))
    return { name: 'Ollama',     host: OLLAMA_HOST,     base: OLLAMA_BASE,     port: OLLAMA_PORT, ssl: false, apiKey: 'ollama' };
  return null; // OpenCode default
}

// ─── Generic provider forwarder ───────────────────────────────────────────────
function forwardToProvider(reqPath, method, headers, body, host, port, base, ssl, extraHeaders = {}, providerName = null) {
  return new Promise((resolve, reject) => {
    const proto = ssl ? https : http;
    // For GitHub Copilot, use editor User-Agent to avoid ToS-based rejection
    const userAgent = providerName === 'GitHub Copilot' ? COPILOT_EDITOR_VERSION : 'universal-llm-proxy/2.0';
    const options = {
      hostname: host,
      port,
      path: base + reqPath,
      method,
      headers: {
        'Content-Type':   'application/json',
        'Authorization':  headers.authorization || `Bearer ${headers['x-api-key'] || ''}`,
        'User-Agent':     userAgent,
        'HTTP-Referer':   'https://github.com/anthropics/claude-code',
        'X-Title':        'Claude Code',
        ...extraHeaders,
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
      },
    };
    const req = proto.request(options, resolve);
    req.setTimeout(0);
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ─── Anthropic → OpenAI request conversion ──────────────────────────────────

function convertContentBlock(block) {
  if (typeof block === 'string') return { type: 'text', text: block };
  if (block.type === 'text') return { type: 'text', text: block.text };
  if (block.type === 'image') {
    // OpenAI vision format
    if (block.source?.type === 'base64') {
      return { type: 'image_url', image_url: { url: `data:${block.source.media_type};base64,${block.source.data}` } };
    }
    if (block.source?.type === 'url') {
      return { type: 'image_url', image_url: { url: block.source.url } };
    }
  }
  return null;  // skip unknown blocks (filter(Boolean) removes nulls)
}

function convertAnthropicMessage(msg) {
  if (msg.role === 'user') {
    if (Array.isArray(msg.content)) {
      const toolResults = msg.content.filter(b => b.type === 'tool_result');
      if (toolResults.length > 0) {
        // Tool results become separate "tool" role messages
        return toolResults.map(tr => {
          const content = Array.isArray(tr.content)
            ? tr.content.map(b => typeof b === 'string' ? b : (b.text || '')).join('')
            : (typeof tr.content === 'string' ? tr.content : '');
          return { role: 'tool', tool_call_id: tr.tool_use_id, content };
        });
      }
      // Mixed content (text + possibly images) — all items must be typed objects
      const parts = msg.content.map(convertContentBlock).filter(Boolean);
      // Simplify to plain string when there are no images (most efficient for LLMs)
      const content = parts.every(p => p.type === 'text') ? parts.map(p => p.text).join('') : parts;
      return [{ role: 'user', content }];
    }
    return [{ role: 'user', content: msg.content }];
  }

  if (msg.role === 'assistant') {
    if (Array.isArray(msg.content)) {
      const thinkingBlocks = msg.content.filter(b => b.type === 'thinking');
      const textBlocks = msg.content.filter(b => b.type === 'text');
      const toolUse = msg.content.filter(b => b.type === 'tool_use');
      const oaiMsg = { role: 'assistant' };
      // DeepSeek (and some others) require reasoning_content passed back in history
      if (thinkingBlocks.length > 0) oaiMsg.reasoning_content = thinkingBlocks.map(b => b.thinking).join('');
      if (textBlocks.length > 0) oaiMsg.content = textBlocks.map(b => b.text).join('');
      if (toolUse.length > 0) {
        oaiMsg.tool_calls = toolUse.map(tu => ({
          id: tu.id,
          type: 'function',
          function: { name: tu.name, arguments: JSON.stringify(tu.input || {}) },
        }));
      }
      return [oaiMsg];
    }
    return [{ role: 'assistant', content: msg.content }];
  }

  return [{ role: msg.role, content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }];
}

function anthropicToOpenAI(body) {
  const messages = [];

  // System prompt
  if (body.system) {
    const sysText = Array.isArray(body.system)
      ? body.system.filter(b => b.type === 'text').map(b => b.text).join('\n')
      : body.system;
    if (sysText) messages.push({ role: 'system', content: sysText });
  }

  for (const msg of body.messages || []) {
    const converted = convertAnthropicMessage(msg);
    messages.push(...converted);
  }

  // Strip images for models that don't support vision
  if (NON_VISION_MODELS.has(body.model)) {
    for (const msg of messages) {
      if (Array.isArray(msg.content)) {
        const filtered = msg.content.filter(b => b.type !== 'image_url');
        msg.content = filtered.length > 0
          ? (filtered.every(b => b.type === 'text') ? filtered.map(b => b.text).join('') : filtered)
          : '[User attached an image — this model does not support image input]';
      }
    }
  }

  const result = {
    model: body.model,
    messages,
    max_tokens: body.max_tokens,
    // Only include stream:true when explicitly requested.
    // GitHub Copilot returns 403 when stream:false is present.
    ...(body.stream ? { stream: true } : {}),
  };

  if (body.temperature !== undefined) result.temperature = body.temperature;
  if (body.top_p !== undefined) result.top_p = body.top_p;
  if (body.stop_sequences?.length) result.stop = body.stop_sequences;

  if (body.tools?.length) {
    result.tools = body.tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description || '',
        parameters: t.input_schema || { type: 'object', properties: {} },
      },
    }));
    if (body.tool_choice) {
      if (body.tool_choice.type === 'auto') result.tool_choice = 'auto';
      else if (body.tool_choice.type === 'any') result.tool_choice = 'required';
      else if (body.tool_choice.type === 'tool') result.tool_choice = { type: 'function', function: { name: body.tool_choice.name } };
    }
  }

  return result;
}

// ─── OpenAI → Anthropic response conversion (non-streaming) ─────────────────

function oaiFinishToAnthropic(finish) {
  if (finish === 'tool_calls') return 'tool_use';
  if (finish === 'length') return 'max_tokens';
  if (finish === 'stop') return 'end_turn';
  return 'end_turn';
}

function openAIToAnthropic(oai, model) {
  const choice = oai.choices?.[0];
  const msg = choice?.message || {};
  const content = [];

  if (msg.content) content.push({ type: 'text', text: msg.content });

  // Handle reasoning_content from Go plan models (pass as thinking block)
  if (msg.reasoning_content) {
    content.unshift({ type: 'thinking', thinking: msg.reasoning_content });
  }

  if (msg.tool_calls?.length) {
    for (const tc of msg.tool_calls) {
      let input = {};
      try { input = JSON.parse(tc.function.arguments || '{}'); } catch {}
      content.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input });
    }
  }

  return {
    id: (oai.id || 'msg_' + Date.now()).replace(/^chatcmpl-?/, 'msg_'),
    type: 'message',
    role: 'assistant',
    content,
    model: model,
    stop_reason: oaiFinishToAnthropic(choice?.finish_reason),
    stop_sequence: null,
    usage: {
      input_tokens: oai.usage?.prompt_tokens || 0,
      output_tokens: oai.usage?.completion_tokens || 0,
    },
  };
}

// ─── OpenAI streaming SSE → Anthropic streaming SSE ─────────────────────────

function makeSSELine(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function transformOAIStreamToAnthropic(oaiStream, res, model) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  let msgId = 'msg_' + Date.now();
  let sentStart = false;
  let inputTokens = 0;
  let outputTokens = 0;
  let buffer = '';
  let toolCallBuffers = {};
  let inToolCall = false;
  let sentFinish = false;
  let totalChunks = 0;
  let hasText = false;

  // Block tracking — each block type gets its own index slot
  let nextIndex = 0;
  let thinkingIdx = -1;   // index of the thinking block (-1 = not opened)
  let textIdx = -1;       // index of the text block (-1 = not opened)
  let thinkingOpen = false;
  let textOpen = false;

  function sendStart(id, promptTokens) {
    msgId = id;
    inputTokens = promptTokens || 0;
    res.write(makeSSELine('message_start', {
      type: 'message_start',
      message: {
        id: msgId, type: 'message', role: 'assistant', content: [],
        model, stop_reason: null, stop_sequence: null,
        usage: { input_tokens: inputTokens, output_tokens: 0 },
      },
    }));
    res.write(makeSSELine('ping', { type: 'ping' }));
    sentStart = true;
  }

  function openThinkingBlock() {
    thinkingIdx = nextIndex++;
    thinkingOpen = true;
    res.write(makeSSELine('content_block_start', {
      type: 'content_block_start', index: thinkingIdx,
      content_block: { type: 'thinking', thinking: '' },
    }));
  }

  function closeThinkingBlock() {
    if (thinkingOpen) {
      res.write(makeSSELine('content_block_stop', { type: 'content_block_stop', index: thinkingIdx }));
      thinkingOpen = false;
    }
  }

  function openTextBlock() {
    textIdx = nextIndex++;
    textOpen = true;
    res.write(makeSSELine('content_block_start', {
      type: 'content_block_start', index: textIdx,
      content_block: { type: 'text', text: '' },
    }));
  }

  function closeTextBlock() {
    if (textOpen) {
      res.write(makeSSELine('content_block_stop', { type: 'content_block_stop', index: textIdx }));
      textOpen = false;
    }
  }

  oaiStream.on('data', chunk => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === ':') continue;
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') continue;

      let parsed;
      try { parsed = JSON.parse(payload); } catch { continue; }

      if (!sentStart) {
        const id = (parsed.id || 'msg_' + Date.now()).replace(/^chatcmpl-?/, 'msg_');
        sendStart(id, parsed.usage?.prompt_tokens || 0);
      }

      const choice = parsed.choices?.[0];
      if (!choice) continue;
      const delta = choice.delta || {};

      // Thinking delta — Go plan uses reasoning_content, free Zen uses reasoning
      const thinkingText = delta.reasoning_content || delta.reasoning;
      if (thinkingText && !inToolCall) {
        if (!thinkingOpen) openThinkingBlock();
        outputTokens++;
        res.write(makeSSELine('content_block_delta', {
          type: 'content_block_delta', index: thinkingIdx,
          delta: { type: 'thinking_delta', thinking: thinkingText },
        }));
      }

      // Text delta — close thinking block first if open, then open text block
      if (delta.content && !inToolCall) {
        hasText = true;
        if (thinkingOpen) closeThinkingBlock();
        if (!textOpen) openTextBlock();
        outputTokens++;
        res.write(makeSSELine('content_block_delta', {
          type: 'content_block_delta', index: textIdx,
          delta: { type: 'text_delta', text: delta.content },
        }));
      }

      // Tool call deltas — accumulate for later emission
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          if (!toolCallBuffers[idx]) {
            // Initialize with empty name — name is appended below (avoids double-setting bug)
            toolCallBuffers[idx] = { id: tc.id || '', name: '', args: '' };
          }
          if (tc.id) toolCallBuffers[idx].id = tc.id;
          // Use += so multi-chunk name streaming works AND first-chunk single-set works
          if (tc.function?.name) toolCallBuffers[idx].name += tc.function.name;
          if (tc.function?.arguments) toolCallBuffers[idx].args += tc.function.arguments;
        }
        inToolCall = true;
      }

      // Finish — close open blocks, emit tool calls, send message end events
      if (choice.finish_reason && !sentFinish) {
        sentFinish = true;
        console.log(`[STREAM DONE] model=${model} finish=${choice.finish_reason} hasText=${hasText} thinkingIdx=${thinkingIdx} textIdx=${textIdx}`);
        const stopReason = oaiFinishToAnthropic(choice.finish_reason);

        closeThinkingBlock();
        closeTextBlock();

        // Emit accumulated tool calls as tool_use content blocks
        for (const [, tc] of Object.entries(toolCallBuffers)) {
          const tcIdx = nextIndex++;
          console.log(`[TOOL_CALL] name="${tc.name}" id="${tc.id}" args_len=${tc.args.length}`);
          res.write(makeSSELine('content_block_start', {
            type: 'content_block_start', index: tcIdx,
            content_block: { type: 'tool_use', id: tc.id, name: tc.name, input: {} },
          }));
          res.write(makeSSELine('content_block_delta', {
            type: 'content_block_delta', index: tcIdx,
            delta: { type: 'input_json_delta', partial_json: tc.args },
          }));
          res.write(makeSSELine('content_block_stop', { type: 'content_block_stop', index: tcIdx }));
        }

        // Anthropic requires at least one content block — emit empty text if nothing was sent
        if (nextIndex === 0) {
          res.write(makeSSELine('content_block_start', {
            type: 'content_block_start', index: 0,
            content_block: { type: 'text', text: '' },
          }));
          res.write(makeSSELine('content_block_stop', { type: 'content_block_stop', index: 0 }));
        }

        res.write(makeSSELine('message_delta', {
          type: 'message_delta',
          delta: { stop_reason: stopReason, stop_sequence: null },
          usage: { output_tokens: outputTokens },
        }));
        res.write(makeSSELine('message_stop', { type: 'message_stop' }));
      }
    }
  });

  oaiStream.on('end', () => {
    if (!sentStart) {
      sendStart('msg_' + Date.now(), 0);
    }
    if (!sentFinish) {
      // Stream ended without finish_reason (timeout/network drop) — close everything properly
      sentFinish = true;
      console.log(`[STREAM END-FALLBACK] model=${model} hasText=${hasText} nextIndex=${nextIndex}`);
      closeThinkingBlock();
      closeTextBlock();
      if (nextIndex === 0) {
        res.write(makeSSELine('content_block_start', {
          type: 'content_block_start', index: 0,
          content_block: { type: 'text', text: '' },
        }));
        res.write(makeSSELine('content_block_stop', { type: 'content_block_stop', index: 0 }));
      }
      res.write(makeSSELine('message_delta', {
        type: 'message_delta',
        delta: { stop_reason: 'end_turn', stop_sequence: null },
        usage: { output_tokens: outputTokens },
      }));
      res.write(makeSSELine('message_stop', { type: 'message_stop' }));
    }
    res.end();
  });

  oaiStream.on('error', err => {
    console.error('[STREAM ERROR]', model, err.message);
    if (!sentStart) sendStart('msg_' + Date.now(), 0);
    if (!sentFinish) {
      sentFinish = true;
      closeThinkingBlock();
      closeTextBlock();
      if (nextIndex === 0) {
        res.write(makeSSELine('content_block_start', {
          type: 'content_block_start', index: 0,
          content_block: { type: 'text', text: '[Connection error — please retry]' },
        }));
        res.write(makeSSELine('content_block_delta', {
          type: 'content_block_delta', index: 0,
          delta: { type: 'text_delta', text: '' },
        }));
        res.write(makeSSELine('content_block_stop', { type: 'content_block_stop', index: 0 }));
      }
      res.write(makeSSELine('message_delta', {
        type: 'message_delta',
        delta: { stop_reason: 'end_turn', stop_sequence: null },
        usage: { output_tokens: outputTokens },
      }));
      res.write(makeSSELine('message_stop', { type: 'message_stop' }));
    }
    res.end();
  });
}

// ─── Forward to OpenCode Zen ─────────────────────────────────────────────────

function forwardToZen(path, method, headers, body, endpointBase) {
  const base = endpointBase || OPENCODE_BASE_GO;
  return new Promise((resolve, reject) => {
    const options = {
      hostname: OPENCODE_HOST,
      port: 443,
      path: base + path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': headers['authorization'] || `Bearer ${headers['x-api-key'] || ''}`,
        'User-Agent': 'opencode-proxy/1.0',
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
      },
    };

    const req = https.request(options, resolve);
    req.setTimeout(0); // no timeout — let long-running models finish
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ─── Dashboard HTML ───────────────────────────────────────────────────────────
const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>OpenCode Proxy Dashboard</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0d1117;color:#e6edf3;min-height:100vh}
.topbar{background:#161b22;border-bottom:1px solid #30363d;padding:12px 24px;display:flex;align-items:center;gap:10px}
.topbar .logo{font-size:17px;font-weight:700;color:#58a6ff}
.topbar .badge{background:#388bfd26;color:#58a6ff;font-size:11px;padding:2px 8px;border-radius:20px;border:1px solid #388bfd}
.dot{width:8px;height:8px;background:#3fb950;border-radius:50%;box-shadow:0 0 6px #3fb950;margin-left:auto}
.status-lbl{font-size:12px;color:#3fb950;margin-left:6px}
.layout{display:grid;grid-template-columns:210px 1fr;min-height:calc(100vh - 49px)}
.sidebar{background:#161b22;border-right:1px solid #30363d;padding:12px 0}
.nav-sec{padding:6px 16px 3px;font-size:10px;font-weight:600;color:#8b949e;text-transform:uppercase;letter-spacing:.8px;margin-top:8px}
.nav-item{display:flex;align-items:center;gap:10px;padding:8px 16px;font-size:13px;color:#8b949e;cursor:pointer;border-left:2px solid transparent;transition:all .15s}
.nav-item:hover{color:#e6edf3;background:#21262d}
.nav-item.active{color:#58a6ff;border-left-color:#58a6ff;background:#388bfd12}
.main{padding:24px;overflow-y:auto}
.section-title{font-size:16px;font-weight:600;margin-bottom:3px}
.section-sub{font-size:12px;color:#8b949e;margin-bottom:20px}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:22px}
.card{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:14px 18px}
.card .lbl{font-size:11px;color:#8b949e;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
.card .val{font-size:26px;font-weight:700}
.card .sub{font-size:11px;color:#8b949e;margin-top:3px}
.card.green .val{color:#3fb950}.card.blue .val{color:#58a6ff}
.panel{background:#161b22;border:1px solid #30363d;border-radius:8px;margin-bottom:18px;overflow:hidden}
.panel-hdr{padding:11px 18px;border-bottom:1px solid #30363d;display:flex;align-items:center;gap:8px}
.panel-title{font-size:13px;font-weight:600}
.panel-body{padding:18px}
.key-row{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.key-lbl{font-size:12px;color:#8b949e;width:76px;flex-shrink:0}
.badge-go{font-size:10px;padding:1px 5px;border-radius:4px;background:#1f6feb26;color:#58a6ff;border:1px solid #1f6feb}
.badge-free{font-size:10px;padding:1px 5px;border-radius:4px;background:#2ea04326;color:#3fb950;border:1px solid #2ea043}
.key-input{flex:1;background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:6px 10px;font-size:12px;color:#8b949e;font-family:monospace}
.key-input.revealed{color:#e6edf3}
.btn{background:#238636;border:none;border-radius:6px;padding:6px 14px;font-size:12px;font-weight:600;color:#fff;cursor:pointer;margin-top:6px}
.btn:hover{background:#2ea043}
.btn-ghost{background:#21262d;border:1px solid #30363d;border-radius:6px;padding:5px 10px;font-size:12px;color:#8b949e;cursor:pointer}
.btn-ghost:hover{color:#e6edf3}
.model-groups{display:flex;flex-direction:column;gap:14px}
.model-group-lbl{font-size:11px;color:#8b949e;text-transform:uppercase;letter-spacing:.5px;margin-bottom:7px}
.tags{display:flex;flex-wrap:wrap;gap:7px}
.tag{display:inline-flex;align-items:center;gap:5px;border-radius:20px;padding:3px 10px;font-size:12px}
.tag.go{background:#1f6feb18;border:1px solid #1f6feb;color:#e6edf3}
.tag.free{background:#2ea04318;border:1px solid #2ea043;color:#e6edf3}
.tag.nv{background:#d2992218;border:1px solid #d29922;color:#d29922}
.tag .dot-sm{width:5px;height:5px;border-radius:50%;flex-shrink:0}
.tag.go .dot-sm{background:#58a6ff}.tag.free .dot-sm{background:#3fb950}.tag.nv .dot-sm{background:#d29922}
.tag-x{color:#8b949e;cursor:pointer;font-size:10px;margin-left:3px}.tag-x:hover{color:#f85149}
.add-row{display:flex;gap:8px;margin-top:8px}
.add-input{background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:5px 10px;font-size:12px;color:#e6edf3;width:200px}
.btn-save-models{background:#238636;border:none;border-radius:6px;padding:6px 14px;font-size:12px;font-weight:600;color:#fff;cursor:pointer;margin-top:14px}
.btn-save-models:hover{background:#2ea043}
.rl-table{width:100%;border-collapse:collapse;font-size:12px}
.rl-table th{text-align:left;padding:8px 12px;color:#8b949e;font-size:11px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #30363d;white-space:nowrap}
.rl-table td{padding:9px 12px;border-bottom:1px solid #21262d;vertical-align:middle}
.rl-table tr:last-child td{border-bottom:none}
.rl-table tr:hover td{background:#21262d}
.rl-model{font-weight:600;color:#e6edf3}
.rl-ctx{font-size:11px;color:#8b949e;background:#21262d;padding:2px 7px;border-radius:10px;white-space:nowrap}
.rl-num{font-family:'SF Mono',Consolas,monospace;color:#58a6ff}
.rl-fast{color:#3fb950}.rl-slow{color:#d29922}
.rl-badge{display:inline-block;font-size:10px;padding:1px 6px;border-radius:10px;margin-left:4px;vertical-align:middle}
.rl-go{background:#1f6feb18;border:1px solid #1f6feb;color:#58a6ff}
.rl-tip{font-size:11px;color:#8b949e;margin-top:12px;padding:10px;background:#21262d;border-radius:6px;line-height:1.6}
.log-box{background:#0d1117;border-radius:6px;padding:12px;font-family:'SF Mono',Consolas,monospace;font-size:11px;line-height:1.8;height:260px;overflow-y:auto}
.log-ts{color:#8b949e}.log-model{color:#58a6ff}.log-tool{color:#3fb950}.log-done{color:#d29922}.log-err{color:#f85149}.log-info{color:#e6edf3}
.log-controls{display:flex;gap:8px;margin-bottom:10px;align-items:center}
.live-dot{width:7px;height:7px;background:#3fb950;border-radius:50%;box-shadow:0 0 5px #3fb950;animation:pulse 1.5s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.toast{position:fixed;bottom:24px;right:24px;background:#238636;color:#fff;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;opacity:0;transition:opacity .3s;pointer-events:none;z-index:999}
.toast.show{opacity:1}.toast.error{background:#b91c1c}
</style>
</head>
<body>
<div class="topbar">
  <div class="logo">⚡ OpenCode Proxy</div>
  <div class="badge">port ${PORT}</div>
  <div class="dot" style="margin-left:auto"></div>
  <span class="status-lbl">Running</span>
</div>
<div class="layout">
  <div class="sidebar">
    <div class="nav-sec">Overview</div>
    <div class="nav-item active" onclick="show('dashboard',this)">📊 Dashboard</div>
    <div class="nav-item" onclick="show('logs',this)">📋 Live Logs</div>
    <div class="nav-sec">Configuration</div>
    <div class="nav-item" onclick="show('apikeys',this)">🔑 API Keys</div>
    <div class="nav-item" onclick="show('models',this)">🤖 Models</div>
    <div class="nav-item" onclick="show('ratelimits',this)">📈 Rate Limits</div>
    <div class="nav-item" onclick="show('copilot',this)">🐙 GitHub Copilot</div>
    <div class="nav-item" onclick="window.location='/providers'">🔌 Providers</div>
  </div>
  <div class="main">
    <div id="sec-dashboard">
      <div class="section-title">Dashboard</div>
      <div class="section-sub">OpenCode Zen Proxy — bridges Claude Code ↔ OpenCode API</div>
      <div class="cards">
        <div class="card green"><div class="lbl">Status</div><div class="val">● Live</div><div class="sub">Auto-restarts on crash</div></div>
        <div class="card blue"><div class="lbl">Go Models</div><div class="val" id="d-go">—</div><div class="sub">Go plan subscription</div></div>
        <div class="card"><div class="lbl">Free Models</div><div class="val" id="d-free">—</div><div class="sub">No credits required</div></div>
      </div>
      <div class="panel">
        <div class="panel-hdr"><span>🔑</span><span class="panel-title">API Keys (masked)</span></div>
        <div class="panel-body" id="d-keys">Loading…</div>
      </div>
      <div class="panel">
        <div class="panel-hdr"><span>🤖</span><span class="panel-title">Model Summary</span></div>
        <div class="panel-body" id="d-summary">Loading…</div>
      </div>
    </div>
    <div id="sec-logs" style="display:none">
      <div class="section-title">Live Logs</div>
      <div class="section-sub">Real-time stream from the proxy process</div>
      <div class="log-controls">
        <div class="live-dot"></div>
        <span style="font-size:12px;color:#3fb950;margin-left:4px">Live</span>
        <button class="btn-ghost" id="btn-pause" onclick="togglePause()">⏸ Pause</button>
        <button class="btn-ghost" onclick="document.getElementById('log-box').innerHTML=''">🗑 Clear</button>
      </div>
      <div class="log-box" id="log-box"></div>
    </div>
    <div id="sec-apikeys" style="display:none">
      <div class="section-title">API Keys</div>
      <div class="section-sub">Stored in ~/opencode-proxy-config.json — never committed to git</div>
      <div class="panel">
        <div class="panel-hdr"><span>🔑</span><span class="panel-title">Edit Keys</span></div>
        <div class="panel-body">
          <div class="key-row">
            <span class="key-lbl">Go Plan <span class="badge-go">paid</span></span>
            <input class="key-input" id="inp-go" type="password" placeholder="sk-…">
            <button class="btn-ghost" onclick="toggleKey('inp-go',this)">👁 Show</button>
          </div>
          <div class="key-row">
            <span class="key-lbl">Free Zen <span class="badge-free">free</span></span>
            <input class="key-input" id="inp-free" type="password" placeholder="sk-…">
            <button class="btn-ghost" onclick="toggleKey('inp-free',this)">👁 Show</button>
          </div>
          <div class="key-row">
            <span class="key-lbl">Groq <span class="badge-free">free tier</span></span>
            <input class="key-input" id="inp-groq" type="password" placeholder="gsk_…">
            <button class="btn-ghost" onclick="toggleKey('inp-groq',this)">👁 Show</button>
          </div>
          <div class="key-row">
            <span class="key-lbl">Nvidia NIM <span class="badge-free">free credits</span></span>
            <input class="key-input" id="inp-nvidia" type="password" placeholder="nvapi-…">
            <button class="btn-ghost" onclick="toggleKey('inp-nvidia',this)">👁 Show</button>
          </div>
          <div class="key-row">
            <span class="key-lbl">OpenRouter <span class="badge-free">free models</span></span>
            <input class="key-input" id="inp-openrouter" type="password" placeholder="sk-or-…">
            <button class="btn-ghost" onclick="toggleKey('inp-openrouter',this)">👁 Show</button>
          </div>
          <button class="btn" onclick="saveKeys()">💾 Save Keys</button>
        </div>
      </div>
    </div>
    <div id="sec-models" style="display:none">      <div class="section-title">Model Routing</div>
      <div class="section-sub">Click ✕ to remove · type in + Add field · Save when done</div>
      <div class="panel">
        <div class="panel-hdr"><span>🤖</span><span class="panel-title">Routing Groups</span></div>
        <div class="panel-body">
          <div class="model-groups">
            <div><div class="model-group-lbl">🔵 Go Plan → paid key + /zen/go/v1</div><div class="tags" id="tags-go"></div><div class="add-row"><input class="add-input" id="add-go" placeholder="model-name"><button class="btn-ghost" onclick="addTag('go')">+ Add</button></div></div>
            <div><div class="model-group-lbl">🟢 Free Zen → free key + /zen/v1</div><div class="tags" id="tags-free"></div><div class="add-row"><input class="add-input" id="add-free" placeholder="model-name"><button class="btn-ghost" onclick="addTag('free')">+ Add</button></div></div>
            <div><div class="model-group-lbl">🟡 No Vision — images stripped</div><div class="tags" id="tags-nv"></div><div class="add-row"><input class="add-input" id="add-nv" placeholder="model-name"><button class="btn-ghost" onclick="addTag('nv')">+ Add</button></div></div>
          </div>
          <button class="btn-save-models" onclick="saveModels()">💾 Save Changes</button>
        </div>
      </div>
    </div>
    <div id="sec-ratelimits" style="display:none">
      <div class="section-title">Rate Limits</div>
      <div class="section-sub">Go Plan model quotas — context windows + request limits per period</div>
      <div class="panel">
        <div class="panel-hdr"><span>📈</span><span class="panel-title">Go Plan Models</span></div>
        <div class="panel-body" style="padding:0;overflow-x:auto">
          <table class="rl-table">
            <thead><tr>
              <th>Model</th><th>Context</th>
              <th>Req / 5 h</th><th>Req / Week</th><th>Req / Month</th>
            </tr></thead>
            <tbody>
              <tr><td><span class="rl-model">GLM-5.1</span><span class="rl-badge rl-go">thinking</span></td><td><span class="rl-ctx">128K</span></td><td class="rl-num rl-slow">880</td><td class="rl-num">2,150</td><td class="rl-num">4,300</td></tr>
              <tr><td><span class="rl-model">GLM-5</span><span class="rl-badge rl-go">thinking</span></td><td><span class="rl-ctx">128K</span></td><td class="rl-num rl-slow">1,150</td><td class="rl-num">2,880</td><td class="rl-num">5,750</td></tr>
              <tr><td><span class="rl-model">Kimi K2.5</span></td><td><span class="rl-ctx">128K</span></td><td class="rl-num">1,850</td><td class="rl-num">4,630</td><td class="rl-num">9,250</td></tr>
              <tr><td><span class="rl-model">Kimi K2.6</span></td><td><span class="rl-ctx">128K</span></td><td class="rl-num">1,150</td><td class="rl-num">2,880</td><td class="rl-num">5,750</td></tr>
              <tr><td><span class="rl-model">MiMo-V2.5 (≤ 256K)</span></td><td><span class="rl-ctx">256K</span></td><td class="rl-num">2,150</td><td class="rl-num">5,450</td><td class="rl-num">10,900</td></tr>
              <tr><td><span class="rl-model">MiMo-V2.5-Pro</span></td><td><span class="rl-ctx">256K</span></td><td class="rl-num">1,290</td><td class="rl-num">3,225</td><td class="rl-num">6,450</td></tr>
              <tr><td><span class="rl-model">MiniMax M2.7</span></td><td><span class="rl-ctx">1M</span></td><td class="rl-num">3,400</td><td class="rl-num">8,500</td><td class="rl-num">17,000</td></tr>
              <tr><td><span class="rl-model">MiniMax M2.5</span></td><td><span class="rl-ctx">1M</span></td><td class="rl-num rl-fast">6,300</td><td class="rl-num">15,900</td><td class="rl-num">31,800</td></tr>
              <tr><td><span class="rl-model">Qwen3.6 Plus</span></td><td><span class="rl-ctx">128K</span></td><td class="rl-num">3,300</td><td class="rl-num">8,200</td><td class="rl-num">16,300</td></tr>
              <tr><td><span class="rl-model">Qwen3.5 Plus</span></td><td><span class="rl-ctx">128K</span></td><td class="rl-num rl-fast">10,200</td><td class="rl-num">25,200</td><td class="rl-num">50,500</td></tr>
              <tr><td><span class="rl-model">DeepSeek V4 Pro</span></td><td><span class="rl-ctx">64K</span></td><td class="rl-num">3,450</td><td class="rl-num">8,550</td><td class="rl-num">17,150</td></tr>
              <tr><td><span class="rl-model">DeepSeek V4 Flash</span></td><td><span class="rl-ctx">64K</span></td><td class="rl-num rl-fast">31,650</td><td class="rl-num">79,050</td><td class="rl-num">158,150</td></tr>
            </tbody>
          </table>
          <div class="rl-tip" style="margin:14px">
            💡 <strong style="color:#d29922">Thinking models</strong> (GLM-5, GLM-5.1) generate internal reasoning before answering — they are slow by design. Use <strong style="color:#3fb950">Qwen3.5 Plus</strong> or <strong style="color:#3fb950">DeepSeek V4 Flash</strong> for fast agentic/coding tasks.
          </div>
        </div>
      </div>
    </div>
    <div id="sec-copilot" style="display:none">
      <div class="section-title">GitHub Copilot</div>
      <div class="section-sub">Use GitHub Copilot subscription models — GPT-5.4, Claude Opus 4.7, Grok Code Fast, and more</div>
      <div class="panel">
        <div class="panel-hdr"><span>🐙</span><span class="panel-title">Connection Status</span></div>
        <div class="panel-body">
          <div id="copilot-status" style="font-size:13px;color:#8b949e;margin-bottom:14px">Checking…</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn" onclick="testCopilot()">🔍 Test Connection</button>
            <button class="btn" id="btn-copilot-login" onclick="loginCopilot()" style="display:none">🔑 Login with GitHub</button>
            <button class="btn-ghost" id="btn-copilot-logout" onclick="logoutCopilot()" style="display:none">Disconnect</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-hdr"><span>🤖</span><span class="panel-title">Available Models (via Copilot subscription)</span></div>
        <div class="panel-body">
          <div style="font-size:12px;color:#8b949e;line-height:2.2">
          <!-- NOTE: keep in sync with COPILOT_MODELS array in constants section above -->
            <code style="color:#58a6ff">copilot/claude-opus-4.7</code> · <code style="color:#58a6ff">copilot/claude-opus-4.6-1m</code> · <code style="color:#3fb950">copilot/claude-sonnet-4.6</code> · <code style="color:#3fb950">copilot/claude-sonnet-4.5</code><br>
            <code style="color:#3fb950">copilot/claude-haiku-4.5</code> · <code style="color:#58a6ff">copilot/gpt-5.4</code> · <code style="color:#3fb950">copilot/gpt-5.2</code> · <code style="color:#3fb950">copilot/gpt-5-mini</code><br>
            <code style="color:#3fb950">copilot/gpt-4.1</code> · <code style="color:#d29922">copilot/grok-code-fast-1</code> · <code style="color:#58a6ff">copilot/claude-opus-4.5</code>
          </div>
          <div style="margin-top:12px;font-size:12px;color:#8b949e">Use <code style="color:#58a6ff">/model copilot/gpt-5.4</code> in Claude Code or <code style="color:#58a6ff">set-model copilot/gpt-5.4</code> in terminal to switch.</div>
        </div>
      </div>
    </div>
  </div>
</div>
<div class="toast" id="toast"></div>
<script>
let cfg={},logPaused=false,logEs=null;
function show(id,navEl){
  ['dashboard','logs','apikeys','models','ratelimits','copilot'].forEach(s=>document.getElementById('sec-'+s).style.display=s===id?'':'none');
  document.querySelectorAll('.nav-item').forEach(el=>el.classList.remove('active'));
  if(navEl)navEl.classList.add('active');
  if(id==='logs'&&!logEs)startLogs();
  if(id==='copilot')loadCopilotStatus();
}
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
function renderModels(){['go','free','nv'].forEach(cls=>{const key=cls==='go'?'goModels':cls==='free'?'freeModels':'nonVisionModels';const container=document.getElementById('tags-'+cls);container.innerHTML='';(cfg[key]||[]).forEach((m,i)=>{const span=document.createElement('span');span.className='tag '+cls;const dot=document.createElement('span');dot.className='dot-sm';const label=document.createTextNode(m);const x=document.createElement('span');x.className='tag-x';x.textContent='✕';x.onclick=()=>removeTag(key,cls,i);span.append(dot,label,x);container.appendChild(span);});});}
function removeTag(key,cls,idx){cfg[key].splice(idx,1);renderModels();}
function addTag(cls){const inpId='add-'+cls;const val=document.getElementById(inpId).value.trim();if(!val)return;const key=cls==='go'?'goModels':cls==='free'?'freeModels':'nonVisionModels';if(!cfg[key])cfg[key]=[];if(!cfg[key].includes(val)){cfg[key].push(val);renderModels();}document.getElementById(inpId).value='';}
async function saveModels(){const r=await fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({goModels:cfg.goModels,freeModels:cfg.freeModels,nonVisionModels:cfg.nonVisionModels})});const j=await r.json();toast(j.ok?'✅ Model routing saved':'❌ '+j.error,!j.ok);}
function toggleKey(id,btn){const inp=document.getElementById(id);const h=inp.type==='password';inp.type=h?'text':'password';inp.classList.toggle('revealed',h);btn.textContent=h?'🙈 Hide':'👁 Show';}
async function saveKeys(){const go=document.getElementById('inp-go').value.trim();const free=document.getElementById('inp-free').value.trim();const groq=document.getElementById('inp-groq').value.trim();const nvidia=document.getElementById('inp-nvidia').value.trim();const openrouter=document.getElementById('inp-openrouter').value.trim();const body={};if(go&&!go.includes('•'))body.apiKeyGo=go;if(free&&!free.includes('•'))body.apiKeyFree=free;if(groq&&!groq.includes('•'))body.groqApiKey=groq;if(nvidia&&!nvidia.includes('•'))body.nvidiaApiKey=nvidia;if(openrouter&&!openrouter.includes('•'))body.openrouterApiKey=openrouter;if(!Object.keys(body).length){toast('Enter new key values first',true);return;}const r=await fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json();toast(j.ok?'✅ Keys saved & hot-reloaded':'❌ '+j.error,!j.ok);if(j.ok)loadConfig();}
function startLogs(){if(logEs){logEs.close();logEs=null;}logEs=new EventSource('/api/logs');logEs.addEventListener('log',e=>{if(logPaused)return;try{appendLog(JSON.parse(e.data));}catch{}});logEs.onerror=()=>{logEs.close();logEs=null;setTimeout(()=>{if(document.getElementById('sec-logs').style.display!=='none')startLogs();},5000);};}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function appendLog(e){const box=document.getElementById('log-box');const d=document.createElement('div');const safe=esc(e.line);const c=safe.replace(/(\[TOOL_CALL\][^\\n]*)/,'<span class="log-tool">$1</span>').replace(/(\[STREAM DONE\][^\\n]*)/,'<span class="log-done">$1</span>').replace(/(\[STREAM END-FALLBACK\][^\\n]*)/,'<span class="log-err">$1</span>').replace(/(glm-\S+|kimi-\S+|qwen\S+|deepseek\S+|mimo\S+|minimax\S+)/,'<span class="log-model">$1</span>');d.innerHTML='<span class="log-ts">'+esc(e.ts)+'</span> <span class="'+(e.level==='error'?'log-err':'log-info')+'">'+c+'</span>';box.appendChild(d);while(box.children.length>200)box.removeChild(box.firstChild);box.scrollTop=box.scrollHeight;}
function togglePause(){logPaused=!logPaused;document.getElementById('btn-pause').textContent=logPaused?'▶ Resume':'⏸ Pause';}
async function loadCopilotStatus(){
  const r=await fetch('/api/copilot/test').catch(()=>null);
  if(!r){document.getElementById('copilot-status').textContent='⚠️ Proxy not responding';return;}
  const j=await r.json();
  const el=document.getElementById('copilot-status');
  const loginBtn=document.getElementById('btn-copilot-login');
  const logoutBtn=document.getElementById('btn-copilot-logout');
  if(j.ok){
    el.innerHTML='✅ <strong style="color:#3fb950">Connected</strong> · '+j.modelCount+' chat-compatible models available';
    loginBtn.style.display='none';
    logoutBtn.style.display='';
  } else {
    el.innerHTML='❌ <strong style="color:#f85149">Not connected</strong> — '+j.message;
    loginBtn.style.display='';
    logoutBtn.style.display='none';
  }
}
async function testCopilot(){
  document.getElementById('copilot-status').textContent='Testing…';
  await loadCopilotStatus();
}
async function loginCopilot(){
  const r=await fetch('/api/copilot/login',{method:'POST'});
  const j=await r.json();
  toast(j.ok?'🐙 '+j.message:'❌ '+j.message,!j.ok);
  if(j.ok){setTimeout(()=>{loadCopilotStatus();},3000);}
}
async function logoutCopilot(){
  const r=await fetch('/api/copilot/logout',{method:'POST'});
  const j=await r.json();
  toast(j.ok?'✅ Disconnected from GitHub':'❌ '+j.message,!j.ok);
  if(j.ok)loadCopilotStatus();
}
function toast(msg,err){const el=document.getElementById('toast');el.textContent=msg;el.className='toast show'+(err?' error':'');setTimeout(()=>el.className='toast',3000);}
loadConfig();
</script>
</body>
</html>`;

function maskKey(k) {
  if (!k || k.length < 12) return k;
  return k.slice(0, 8) + '•'.repeat(Math.min(16, k.length - 8));
}

// ─── Providers page HTML ─────────────────────────────────────────────────────

const PROVIDERS_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Providers — LLM Proxy</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#111;color:#eee;min-height:100vh}
nav{background:#1a1a1a;border-bottom:1px solid #333;padding:0 24px;display:flex;align-items:center;gap:24px;height:52px}
nav a{color:#aaa;text-decoration:none;font-size:0.9em;padding:4px 0}
nav a:hover,nav a.active{color:#fff}
nav .brand{color:#fff;font-weight:600;margin-right:12px}
h1{font-size:1.5em;font-weight:600;padding:28px 28px 0}
.subtitle{color:#888;font-size:0.9em;padding:6px 28px 0}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px;padding:24px 28px}
.card{background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:20px;transition:border-color .2s}
.card.connected{border-color:rgba(76,175,80,.4)}
.card.disconnected{border-color:#333}
.card-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px}
.card-title{font-size:1.05em;font-weight:600}
.badge{font-size:0.75em;padding:3px 10px;border-radius:20px;white-space:nowrap}
.badge.ok{background:rgba(76,175,80,.15);color:#4caf50;border:1px solid rgba(76,175,80,.3)}
.badge.warn{background:rgba(255,152,0,.12);color:#ff9800;border:1px solid rgba(255,152,0,.3)}
.meta{font-size:0.82em;color:#888;margin-bottom:14px;line-height:1.6}
.meta span{display:inline-block;margin-right:14px}
.actions{display:flex;gap:8px;flex-wrap:wrap}
button{padding:6px 14px;border:none;border-radius:6px;font-size:0.85em;cursor:pointer;transition:opacity .15s}
button:hover{opacity:.85}
.btn-connect{background:#2196f3;color:#fff}
.btn-oauth{background:#238636;color:#fff}
.btn-disconnect{background:#c0392b;color:#fff}
.btn-update{background:#444;color:#eee}
.btn-info{background:#333;color:#aaa;cursor:default}
.modal-bg{display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:100;align-items:center;justify-content:center}
.modal-bg.open{display:flex}
.modal{background:#1e1e1e;border:1px solid #444;border-radius:12px;padding:28px;width:min(440px,90vw)}
.modal h3{margin-bottom:8px;font-size:1.1em}
.modal p{color:#888;font-size:0.88em;margin-bottom:18px;line-height:1.5}
.modal input{width:100%;padding:10px 12px;background:#111;border:1px solid #444;border-radius:6px;color:#eee;font-size:0.9em;margin-bottom:12px;outline:none}
.modal input:focus{border-color:#2196f3}
.modal-link{font-size:0.82em;color:#2196f3;text-decoration:none}
.modal-link:hover{text-decoration:underline}
.modal-actions{display:flex;gap:10px;margin-top:4px}
.modal-actions button{flex:1}
.toast{position:fixed;bottom:24px;right:24px;background:#333;color:#eee;padding:12px 20px;border-radius:8px;font-size:0.88em;opacity:0;transition:opacity .3s;pointer-events:none;z-index:200}
.toast.show{opacity:1}
.setup-banner{margin:16px 28px 0;padding:14px 18px;background:rgba(255,152,0,.08);border:1px solid rgba(255,152,0,.25);border-radius:8px;font-size:0.88em;color:#ddd;line-height:1.6}
.setup-banner code{background:#333;padding:1px 5px;border-radius:3px;font-size:0.9em}
</style>
</head>
<body>
<nav>
  <span class="brand">🔀 LLM Proxy</span>
  <a href="/">Dashboard</a>
  <a href="/providers" class="active">Providers</a>
</nav>
<h1>Provider Authentication</h1>
<p class="subtitle">Connect your accounts and API keys. Models only appear when a provider is connected.</p>
<div id="setup-banner" style="display:none" class="setup-banner"></div>
<div class="grid" id="grid">Loading providers...</div>

<!-- API Key Modal -->
<div class="modal-bg" id="modal-bg">
  <div class="modal">
    <h3 id="modal-title">Connect Provider</h3>
    <p id="modal-desc"></p>
    <a id="modal-link" href="#" target="_blank" class="modal-link">→ Get API key</a>
    <input id="modal-key" type="password" placeholder="Paste your API key here">
    <div class="modal-actions">
      <button class="btn-update" onclick="closeModal()">Cancel</button>
      <button class="btn-connect" onclick="submitKey()">Save & Connect</button>
    </div>
  </div>
</div>

<!-- GitHub OAuth Client ID Modal -->
<div class="modal-bg" id="gh-setup-bg">
  <div class="modal">
    <h3>GitHub OAuth App Setup</h3>
    <p>Register a GitHub OAuth App to enable direct GitHub authentication.
       Set the callback URL to <code style="background:#333;padding:1px 5px;border-radius:3px">http://127.0.0.1:4001/api/auth/github/callback</code></p>
    <a href="https://github.com/settings/developers" target="_blank" class="modal-link">→ Open GitHub Developer Settings</a><br><br>
    <input id="gh-client-id" type="text" placeholder="Client ID (e.g. Ov23liXXXXXXXXXXX)">
    <input id="gh-client-secret" type="password" placeholder="Client Secret">
    <div class="modal-actions">
      <button class="btn-update" onclick="closeGhSetup()">Cancel</button>
      <button class="btn-oauth" onclick="saveGhSetup()">Save & Continue to GitHub</button>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
let providers = [];
let currentProvider = null;

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

function render() {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';

  const ghProvider = providers.find(p => p.id === 'github-copilot');
  const banner = document.getElementById('setup-banner');
  if (ghProvider && ghProvider.needsClientId) {
    banner.style.display = 'block';
    banner.innerHTML = '⚙️ <strong>One-time setup required for GitHub Copilot:</strong> Register a GitHub OAuth App to enable browser-based login. ' +
      '<button class="btn-oauth" style="margin-left:10px;padding:4px 12px" onclick="openGhSetup()">Set Up OAuth App</button>';
  } else {
    banner.style.display = 'none';
  }

  for (const p of providers) {
    const card = document.createElement('div');
    card.className = 'card ' + (p.connected ? 'connected' : 'disconnected');

    const icon = {
      'github-copilot': '🐙', gemini: '🤖', openai: '🧠',
      groq: '⚡', nvidia: '🟢', openrouter: '🔀', ollama: '🦙', opencode: '☁️'
    }[p.id] || '🔌';

    const statusBadge = p.connected
      ? \`<span class="badge ok">✅ \${p.username || (p.authType === 'none' ? 'active' : 'API key ••••' + (p.keyHint || '').slice(-4))}</span>\`
      : \`<span class="badge warn">⚠️ Not connected</span>\`;

    let actions = '';
    if (p.authType === 'oauth') {
      if (p.connected) {
        actions = \`<button class="btn-disconnect" onclick="disconnectGitHub()">Disconnect</button>
                   <button class="btn-update" onclick="window.location='/api/auth/github/start'">Re-authenticate</button>\n                   <button class="btn-oauth" onclick="openGhSetup()">Edit OAuth App</button>\`;
      } else if (p.needsClientId) {
        actions = \`<button class="btn-oauth" onclick="openGhSetup()">🔐 Set Up & Connect GitHub</button>\`;
      } else {
        actions = \`<button class="btn-oauth" onclick="window.location='/api/auth/github/start'">🔐 Connect with GitHub</button>\`;
      }
    } else if (p.authType === 'api-key') {
      if (p.connected) {
        actions = \`<button class="btn-disconnect" onclick="disconnectProvider('\${p.id}')">Disconnect</button>
                   <button class="btn-update" onclick="openModal('\${p.id}')">Update Key</button>\`;
      } else {
        actions = \`<button class="btn-connect" onclick="openModal('\${p.id}')">+ Connect</button>\`;
      }
    } else {
      actions = p.connected
        ? \`<button class="btn-info" disabled>Auto-detected</button>\`
        : \`<span style="font-size:0.82em;color:#888">\${p.note || ''}</span>\`;
    }

    card.innerHTML = \`
      <div class="card-header">
        <div class="card-title">\${icon} \${p.name}</div>
        \${statusBadge}
      </div>
      <div class="meta">
        \${p.modelCount ? \`<span>\${p.modelCount} models</span>\` : ''}
        <span>\${p.requestCount} requests</span>
        \${p.note && p.authType === 'none' ? \`<span>\${p.note}</span>\` : ''}
      </div>
      <div class="actions">\${actions}</div>
    \`;
    grid.appendChild(card);
  }
}

function openModal(id) {
  currentProvider = providers.find(p => p.id === id);
  if (!currentProvider) return;
  document.getElementById('modal-title').textContent = (currentProvider.connected ? 'Update' : 'Connect') + ' ' + currentProvider.name;
  document.getElementById('modal-desc').textContent = 'Paste your API key below. It will be stored in the proxy config on your machine only.';
  const link = document.getElementById('modal-link');
  link.href = currentProvider.getKeyUrl || '#';
  link.textContent = '→ Get your ' + currentProvider.name + ' API key';
  document.getElementById('modal-key').value = '';
  document.getElementById('modal-bg').classList.add('open');
  setTimeout(() => document.getElementById('modal-key').focus(), 50);
}

function closeModal() {
  document.getElementById('modal-bg').classList.remove('open');
  currentProvider = null;
}

async function submitKey() {
  const key = document.getElementById('modal-key').value.trim();
  if (!key) { toast('Please enter an API key', true); return; }
  try {
    const r = await fetch(\`/api/providers/\${currentProvider.id}/connect\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: key }),
    });
    const j = await r.json();
    if (j.ok) { closeModal(); toast('✅ ' + currentProvider.name + ' connected'); await load(); }
    else { toast('❌ ' + (j.message || 'Error saving key'), true); }
  } catch { toast('❌ Network error — proxy unreachable', true); }
}

async function disconnectProvider(id) {
  if (!confirm('Disconnect this provider? API key will be removed from config.')) return;
  try {
    const r = await fetch(\`/api/providers/\${id}/disconnect\`, { method: 'POST' });
    const j = await r.json();
    if (j.ok) { toast('Provider disconnected'); await load(); }
    else { toast('❌ ' + (j.message || 'Error'), true); }
  } catch { toast('❌ Network error — proxy unreachable', true); }
}

async function disconnectGitHub() {
  if (!confirm('Disconnect GitHub? The stored OAuth token will be removed.')) return;
  try {
    const r = await fetch('/api/auth/github/disconnect', { method: 'POST' });
    const j = await r.json();
    if (j.ok) { toast('GitHub disconnected'); await load(); }
    else { toast('❌ ' + (j.message || 'Error'), true); }
  } catch { toast('❌ Network error — proxy unreachable', true); }
}

function openGhSetup() {
  document.getElementById('gh-client-id').value = '';
  document.getElementById('gh-client-secret').value = '';
  document.getElementById('gh-setup-bg').classList.add('open');
  setTimeout(() => document.getElementById('gh-client-id').focus(), 50);
}

function closeGhSetup() {
  document.getElementById('gh-setup-bg').classList.remove('open');
}

async function saveGhSetup() {
  const clientId     = document.getElementById('gh-client-id').value.trim();
  const clientSecret = document.getElementById('gh-client-secret').value.trim();
  if (!clientId || !clientSecret) { toast('Both Client ID and Secret are required', true); return; }
  try {
    const r = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ githubOAuthClientId: clientId, githubOAuthClientSecret: clientSecret }),
    });
    const j = await r.json();
    if (j.ok) {
      closeGhSetup();
      toast('OAuth App saved — redirecting to GitHub...');
      setTimeout(() => { window.location = '/api/auth/github/start'; }, 1200);
    } else {
      toast('❌ ' + (j.message || 'Save failed'), true);
    }
  } catch { toast('❌ Network error — proxy unreachable', true); }
}

function toast(msg, err = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = err ? '#c0392b' : '#27ae60';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

load();
setInterval(load, 30000); // refresh every 30s
</script>
</body>
</html>`;

// ─── HTTP server ─────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  req.socket.setTimeout(0); // no server-side socket timeout
  const method = req.method;
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const reqPath = url.pathname;

  console.log(`[${new Date().toISOString()}] ${method} ${reqPath}`);

  // CORS + preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, anthropic-version, anthropic-beta');
  if (method === 'OPTIONS') { res.writeHead(200); return res.end(); }

  // Providers UI
  if (method === 'GET' && reqPath === '/providers') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(PROVIDERS_HTML);
  }

  // Dashboard UI
  if (method === 'GET' && reqPath === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(DASHBOARD_HTML);
  }

  // Health / connectivity checks
  if (method === 'HEAD' || (method === 'GET' && reqPath === '/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', proxy: 'opencode-zen' }));
  }

  // Dashboard API — current config (keys masked)
  if (method === 'GET' && reqPath === '/api/config') {
    const safe = {
      apiKeyGo:        maskKey(CFG.apiKeyGo),
      apiKeyFree:      maskKey(CFG.apiKeyFree),
      goModels:        CFG.goModels,
      freeModels:      CFG.freeModels,
      nonVisionModels: CFG.nonVisionModels,
      groqApiKey:        CFG.groqApiKey       ? '•'.repeat(8) + CFG.groqApiKey.slice(-4)       : '',
      nvidiaApiKey:      CFG.nvidiaApiKey     ? '•'.repeat(8) + CFG.nvidiaApiKey.slice(-4)     : '',
      openrouterApiKey:  CFG.openrouterApiKey ? '•'.repeat(8) + CFG.openrouterApiKey.slice(-4) : '',
      groqModels:        [...(CFG.groqModels       || DEFAULT_CONFIG.groqModels)],
      nvidiaModels:      [...(CFG.nvidiaModels     || DEFAULT_CONFIG.nvidiaModels)],
      openrouterModels:  [...(CFG.openrouterModels || DEFAULT_CONFIG.openrouterModels)],
      ollamaModels:      [...(CFG.ollamaModels     || DEFAULT_CONFIG.ollamaModels)],
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(safe));
  }

  // Dashboard API — save + hot-reload config
  if (method === 'POST' && reqPath === '/api/config') {
    const MAX_BODY = 64 * 1024; // 64 KB — config JSON will never be larger
    let body = '';
    req.on('data', d => {
      body += d;
      if (body.length > MAX_BODY) {
        req.destroy();
        if (!res.headersSent) {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Request body too large' }));
        }
      }
    });
    req.on('end', () => {
      try {
        const update = JSON.parse(body);
        if (update.apiKeyGo   && !update.apiKeyGo.includes('•'))   CFG.apiKeyGo   = update.apiKeyGo;
        if (update.apiKeyFree && !update.apiKeyFree.includes('•'))  CFG.apiKeyFree = update.apiKeyFree;
        if (Array.isArray(update.goModels))        CFG.goModels        = update.goModels;
        if (Array.isArray(update.freeModels))      CFG.freeModels      = update.freeModels;
        if (Array.isArray(update.nonVisionModels)) CFG.nonVisionModels = update.nonVisionModels;
        if (update.groqApiKey       && typeof update.groqApiKey       === 'string' && !update.groqApiKey.includes('•'))       CFG.groqApiKey       = update.groqApiKey;
        if (update.nvidiaApiKey     && typeof update.nvidiaApiKey     === 'string' && !update.nvidiaApiKey.includes('•'))     CFG.nvidiaApiKey     = update.nvidiaApiKey;
        if (update.openrouterApiKey && typeof update.openrouterApiKey === 'string' && !update.openrouterApiKey.includes('•')) CFG.openrouterApiKey = update.openrouterApiKey;
        if (typeof update.geminiApiKey  === 'string') CFG.geminiApiKey  = update.geminiApiKey;
        if (typeof update.openaiApiKey  === 'string') CFG.openaiApiKey  = update.openaiApiKey;
        if (typeof update.githubOAuthClientId     === 'string') CFG.githubOAuthClientId     = update.githubOAuthClientId;
        if (typeof update.githubOAuthClientSecret === 'string') CFG.githubOAuthClientSecret = update.githubOAuthClientSecret;
        if (Array.isArray(update.groqModels))       CFG.groqModels       = update.groqModels;
        if (Array.isArray(update.nvidiaModels))     CFG.nvidiaModels     = update.nvidiaModels;
        if (Array.isArray(update.openrouterModels)) CFG.openrouterModels = update.openrouterModels;
        if (Array.isArray(update.ollamaModels))     CFG.ollamaModels     = update.ollamaModels;
        saveConfig(CFG);
        rebuildSets();
        console.log('[CONFIG] Saved and hot-reloaded');
        if (!res.headersSent) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        }
      } catch (e) {
        if (!res.headersSent) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      }
    });
    req.on('error', (err) => {
      console.error('[CONFIG] Request error:', err.message);
      if (!res.headersSent) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Request stream error' }));
      }
    });
    return;
  }

  // Dashboard API — live log stream (SSE)
  if (method === 'GET' && reqPath === '/api/logs') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    // Replay last 50 buffered lines immediately
    for (const entry of logBuffer.slice(-50)) {
      res.write(`event: log\ndata: ${entry}\n\n`);
    }
    logSubscribers.push(res);
    req.on('close', () => {
      const i = logSubscribers.indexOf(res);
      if (i !== -1) logSubscribers.splice(i, 1);
    });
    return;
  }

  // Active model override status
  if (method === 'GET' && reqPath === '/api/active-model') {
    const activeModel = readActiveModel();
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ model: activeModel }));
  }

  // ── GitHub Copilot auth endpoints ─────────────────────────────────────────
  if (method === 'GET' && reqPath === '/api/copilot/test') {
    const token = getCopilotToken(true);
    if (!token) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, loggedIn: false, message: "Not logged in to GitHub. Run 'gh auth login' in terminal." }));
    }
    const testReq = https.request({
      hostname: COPILOT_HOST, port: 443, path: '/models', method: 'GET',
      headers: { 'Authorization': `Bearer ${token}`, 'Editor-Version': COPILOT_EDITOR_VERSION, 'User-Agent': COPILOT_EDITOR_VERSION, 'Copilot-Integration-Id': COPILOT_INTEGRATION_ID },
    }, testRes => {
      let data = '';
      testRes.on('data', d => data += d);
      testRes.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (testRes.statusCode !== 200) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ ok: false, loggedIn: true,
              message: `Copilot API returned ${testRes.statusCode}: ${json.message || 'check subscription'}` }));
          }
          const models = json.data || [];
          const chatModels = models.filter(m => Array.isArray(m.supported_endpoints) && m.supported_endpoints.includes('/chat/completions'));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: chatModels.length > 0, loggedIn: true, modelCount: chatModels.length, totalModels: models.length }));
        } catch {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, loggedIn: true, message: 'Unexpected response from Copilot API' }));
        }
      });
    });
    testReq.on('error', err => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, loggedIn: false, message: err.message }));
    });
    testReq.end();
    return;
  }

  if (method === 'POST' && reqPath === '/api/copilot/login') {
    try {
      const { spawn } = require('child_process');
      spawn('gh', ['auth', 'login', '--hostname', 'github.com', '--web', '--scopes', 'copilot'], {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}` },
      }).unref();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, message: 'Browser opened for GitHub login. Complete auth in browser then click "Test Connection".' }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, message: err.message }));
    }
    return;
  }

  if (method === 'POST' && reqPath === '/api/copilot/logout') {
    try {
      require('child_process').execSync('gh auth logout --hostname github.com -y', { encoding: 'utf8', env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}` } });
      _copilotToken     = null;
      _copilotTokenTime = 0;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, message: err.message }));
    }
    return;
  }

  // ── GitHub OAuth App flow ─────────────────────────────────────────────────
  if (method === 'GET' && reqPath === '/api/auth/github/start') {
    if (!CFG.githubOAuthClientId) {
      res.writeHead(302, { Location: '/providers?error=missing-client-id' });
      return res.end();
    }
    _oauthState = require('crypto').randomBytes(16).toString('hex');
    // persist state to disk so server restarts don't break the flow
    try {
      const ok = saveOauthState(_oauthState);
      if (!ok) console.error('[OAuth] saveOauthState returned false');
    } catch (e) {
      console.error('[OAuth] saveOauthState error:', e && e.message ? e.message : e);
    }
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(CFG.githubOAuthClientId)}&redirect_uri=http%3A%2F%2F127.0.0.1%3A4001%2Fapi%2Fauth%2Fgithub%2Fcallback&scope=read%3Auser&state=${_oauthState}`;
    res.writeHead(302, { Location: authUrl });
    return res.end();
  }

  if (method === 'GET' && reqPath.startsWith('/api/auth/github/callback')) {
    const qs = url.searchParams;
    const code  = qs.get('code')  || '';
    const state = qs.get('state') || '';
    // If server restarted, try reading saved state from disk
    if (!_oauthState) {
      const saved = readOauthState();
      if (saved && saved.state) _oauthState = saved.state;
    }
    if (!code || !_oauthState || state !== _oauthState) {
      res.writeHead(302, { Location: '/providers?error=bad-state' });
      return res.end();
    }
    // consume and remove persisted state
    try {
      const ok = deleteOauthState();
      if (!ok) console.error('[OAuth] deleteOauthState returned false');
    } catch (e) {
      console.error('[OAuth] deleteOauthState error:', e && e.message ? e.message : e);
    }
    _oauthState = ''; // consume

    const exchangeBody = JSON.stringify({
      client_id:     CFG.githubOAuthClientId,
      client_secret: CFG.githubOAuthClientSecret,
      code,
    });

    const tokenReq = https.request({
      hostname: 'github.com', port: 443,
      path: '/login/oauth/access_token', method: 'POST',
      headers: {
        'Content-Type':   'application/json',
        'Accept':         'application/json',
        'User-Agent':     'universal-llm-proxy/2.0',
        'Content-Length': Buffer.byteLength(exchangeBody),
      },
    }, tokenRes => {
      let data = '';
      tokenRes.on('data', d => data += d);
      tokenRes.on('end', () => {
        if (tokenRes.statusCode !== 200) {
          res.writeHead(302, { Location: `/providers?error=github-${tokenRes.statusCode}` });
          return res.end();
        }
        let tokenJson;
        try { tokenJson = JSON.parse(data); } catch {
          res.writeHead(302, { Location: '/providers?error=invalid-token-response' });
          return res.end();
        }
        if (!tokenJson.access_token) {
          res.writeHead(302, { Location: `/providers?error=${encodeURIComponent(tokenJson.error_description || 'no-token')}` });
          return res.end();
        }

        // Fetch GitHub username to display
        const userReq = https.request({
          hostname: 'api.github.com', port: 443, path: '/user', method: 'GET',
          headers: {
            'Authorization': `Bearer ${tokenJson.access_token}`,
            'User-Agent':    'universal-llm-proxy/2.0',
            'Accept':        'application/vnd.github+json',
          },
        }, userRes => {
          let ud = '';
          userRes.on('data', d => ud += d);
          userRes.on('end', () => {
            let username = '';
            if (userRes.statusCode === 200) {
              try { username = JSON.parse(ud).login || ''; } catch {}
            }

            CFG.githubOAuthToken    = tokenJson.access_token;
            CFG.githubOAuthUsername = username;
            saveConfig(CFG);
            _copilotToken     = tokenJson.access_token;
            _copilotTokenTime = Date.now();
            console.log(`[OAuth] GitHub connected as: ${username}`);
            res.writeHead(302, { Location: `/providers?connected=github&user=${encodeURIComponent(username)}` });
            res.end();
          });
        });
        userReq.on('error', () => {
          // Token saved even if username lookup fails
          CFG.githubOAuthToken = tokenJson.access_token;
          saveConfig(CFG);
          _copilotToken     = tokenJson.access_token;
          _copilotTokenTime = Date.now();
          res.writeHead(302, { Location: '/providers?connected=github' });
          res.end();
        });
        userReq.end();
      });
    });
    tokenReq.on('error', err => {
      console.error('[OAuth] Token exchange network error:', err.message);
      res.writeHead(302, { Location: '/providers?error=network-error' });
      res.end();
    });
    tokenReq.write(exchangeBody);
    tokenReq.end();
    return;
  }

  if (method === 'POST' && reqPath === '/api/auth/github/disconnect') {
    CFG.githubOAuthToken    = '';
    CFG.githubOAuthUsername = '';
    saveConfig(CFG);
    _copilotToken     = null;
    _copilotTokenTime = 0;
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ ok: true }));
  }

  if (method === 'POST' && reqPath.startsWith('/api/providers/') && reqPath.endsWith('/connect')) {
    const providerId = reqPath.split('/')[3]; // e.g. 'gemini', 'openai', 'groq'
    let body = '';
    const MAX_BODY = 1024;
    req.on('data', d => {
      body += d;
      if (body.length > MAX_BODY) {
        req.destroy();
        if (!res.headersSent) {
          res.writeHead(413, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ ok: false, message: 'Request body too large' }));
        }
      }
    });
    req.on('error', () => { /* swallow: req.destroy() above already sent 413 */ });
    req.on('end', () => {
      let payload;
      try { payload = JSON.parse(body); } catch {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ ok: false, message: 'Invalid JSON' }));
      }
      const key = (payload.apiKey || '').trim();
      if (!key) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ ok: false, message: 'apiKey is required' }));
      }
      const fieldMap = {
        gemini:      'geminiApiKey',
        openai:      'openaiApiKey',
        groq:        'groqApiKey',
        nvidia:      'nvidiaApiKey',
        openrouter:  'openrouterApiKey',
      };
      const field = fieldMap[providerId];
      if (!field) {
        res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ ok: false, message: `Unknown provider: ${providerId}` }));
      }
      CFG[field] = key;
      saveConfig(CFG);
      rebuildSets();
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: true, provider: providerId }));
    });
    return;
  }

  if (method === 'POST' && reqPath.startsWith('/api/providers/') && reqPath.endsWith('/disconnect')) {
    const providerId = reqPath.split('/')[3];
    const fieldMap = {
      gemini:     'geminiApiKey',
      openai:     'openaiApiKey',
      groq:       'groqApiKey',
      nvidia:     'nvidiaApiKey',
      openrouter: 'openrouterApiKey',
    };
    const field = fieldMap[providerId];
    if (!field) {
      res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ ok: false, message: `Unknown provider: ${providerId}` }));
    }
    CFG[field] = '';
    saveConfig(CFG);
    rebuildSets();
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ ok: true }));
  }

  if (method === 'GET' && reqPath === '/api/providers') {
    // Async Ollama check — does NOT block event loop
    const checkOllama = () => new Promise(resolve => {
      const req = http.request(
        { hostname: '127.0.0.1', port: OLLAMA_PORT, path: '/api/tags', method: 'GET' },
        r => { r.resume(); resolve(r.statusCode < 500); }
      );
      req.setTimeout(1000, () => { req.destroy(); resolve(false); });
      req.on('error', () => resolve(false));
      req.end();
    });

    checkOllama().then(ollamaOk => {
      const copilotToken = getCopilotToken();
      const providers = [
        {
          id: 'github-copilot', name: 'GitHub Copilot', authType: 'oauth',
          connected: !!copilotToken,
          username:  CFG.githubOAuthUsername || (copilotToken ? 'via gh CLI' : ''),
          modelCount: COPILOT_MODELS.length,
          requestCount: REQUEST_COUNTS['github-copilot'] || 0,
          connectUrl: '/api/auth/github/start',
          needsClientId: !CFG.githubOAuthClientId,
        },
        {
          id: 'gemini', name: 'Google Gemini', authType: 'api-key',
          connected: !!GEMINI_API_KEY,
          modelCount: GEMINI_API_KEY ? (CFG.geminiModels || DEFAULT_CONFIG.geminiModels).length : 0,
          requestCount: REQUEST_COUNTS['gemini'] || 0,
          keyHint: GEMINI_API_KEY ? `•••${GEMINI_API_KEY.slice(-4)}` : '',
          getKeyUrl: 'https://aistudio.google.com/apikey',
        },
        {
          id: 'openai', name: 'OpenAI / Codex', authType: 'api-key',
          connected: !!OPENAI_API_KEY,
          modelCount: OPENAI_API_KEY ? (CFG.openaiModels || DEFAULT_CONFIG.openaiModels).length : 0,
          requestCount: REQUEST_COUNTS['openai'] || 0,
          keyHint: OPENAI_API_KEY ? `•••${OPENAI_API_KEY.slice(-4)}` : '',
          getKeyUrl: 'https://platform.openai.com/api-keys',
        },
        {
          id: 'groq', name: 'Groq', authType: 'api-key',
          connected: !!GROQ_API_KEY,
          modelCount: GROQ_API_KEY ? GROQ_MODELS.size : 0,
          requestCount: REQUEST_COUNTS['groq'] || 0,
          keyHint: GROQ_API_KEY ? `•••${GROQ_API_KEY.slice(-4)}` : '',
          getKeyUrl: 'https://console.groq.com/keys',
        },
        {
          id: 'nvidia', name: 'NVIDIA NIM', authType: 'api-key',
          connected: !!NVIDIA_API_KEY,
          modelCount: NVIDIA_API_KEY ? NVIDIA_MODELS.size : 0,
          requestCount: REQUEST_COUNTS['nvidia'] || 0,
          keyHint: NVIDIA_API_KEY ? `•••${NVIDIA_API_KEY.slice(-4)}` : '',
          getKeyUrl: 'https://build.nvidia.com',
        },
        {
          id: 'openrouter', name: 'OpenRouter', authType: 'api-key',
          connected: !!OPENROUTER_API_KEY,
          modelCount: OPENROUTER_API_KEY ? OPENROUTER_MODELS.size : 0,
          requestCount: REQUEST_COUNTS['openrouter'] || 0,
          keyHint: OPENROUTER_API_KEY ? `•••${OPENROUTER_API_KEY.slice(-4)}` : '',
          getKeyUrl: 'https://openrouter.ai/keys',
        },
        {
          id: 'ollama', name: 'Ollama', authType: 'none',
          connected: ollamaOk,
          modelCount: 0,
          requestCount: REQUEST_COUNTS['ollama'] || 0,
          note: ollamaOk ? `Running on :${OLLAMA_PORT}` : `Not running — start with: ollama serve`,
        },
        {
          id: 'opencode', name: 'OpenCode (free)', authType: 'none',
          connected: true,
          modelCount: ZEN_FREE_MODELS.size,
          requestCount: REQUEST_COUNTS['opencode'] || 0,
          note: 'Free tier — always available',
        },
      ];
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ providers }));
    });
    return;
  }

  // Models list — merge Go plan + free Zen models
  if (method === 'GET' && reqPath === '/v1/models') {
    // Known context windows for OpenCode models (used to populate ctx% in Claude Code)
    const MODEL_CTX = {
      'glm-5': 128000, 'glm-5.1': 128000, 'glm-5-free': 128000,
      'kimi-k2.5': 131072, 'kimi-k2.5-free': 131072,
      'kimi-k2.6': 131072, 'kimi-k2.6-free': 131072,
      'mimo-v2.5': 262144, 'mimo-v2.5-pro': 262144,
      'mimo-v2-omni': 65536, 'mimo-v2-omni-free': 65536,
      'mimo-v2-pro': 65536, 'mimo-v2-pro-free': 65536,
      'mimo-v2-flash-free': 65536,
      'minimax-m2.5': 1000000, 'minimax-m2.5-free': 1000000,
      'minimax-m2.7': 1000000, 'minimax-m2.1-free': 1000000,
      'qwen3.5-plus': 131072, 'qwen3.5-plus-free': 131072,
      'qwen3.6-plus': 131072, 'qwen3.6-plus-free': 131072,
      'deepseek-v4-pro': 65536, 'deepseek-v4-flash': 65536,
      'big-pickle': 131072,
      'ring-2.6-1t-free': 131072, 'ling-2.6-flash-free': 131072,
      'trinity-large-preview-free': 131072,
      'nemotron-3-super-free': 131072,
      'hy3-preview': 131072, 'hy3-preview-free': 131072,
    };

    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '') || '';
    Promise.all([
      forwardToZen('/models', 'GET', { authorization: `Bearer ${apiKey}` }, null, OPENCODE_BASE_GO),
      forwardToZen('/models', 'GET', { authorization: 'Bearer public' }, null, OPENCODE_BASE_ZEN),
    ]).then(([goRes, zenRes]) => {
      const chunks = { go: [], zen: [] };
      goRes.on('data', d => chunks.go.push(d));
      zenRes.on('data', d => chunks.zen.push(d));
      let done = 0;
      const finish = () => {
        if (++done < 2) return;
        try {
          const goData = JSON.parse(Buffer.concat(chunks.go).toString());
          const zenData = JSON.parse(Buffer.concat(chunks.zen).toString());
          const goModels = goData.data || [];
          const zenModels = (zenData.data || []).filter(m =>
            ZEN_FREE_MODELS.has(m.id) && !goModels.find(g => g.id === m.id)
          );
          // Inject context_length so Claude Code can display ctx% correctly
          const allModels = [...goModels, ...zenModels].map(m => ({
            ...m,
            context_length: m.context_length || MODEL_CTX[m.id] || 128000,
          }));
          const groqModelsList       = GROQ_API_KEY
            ? [...GROQ_MODELS].map(id => ({ id, object: 'model', created: 0, owned_by: 'groq',       context_length: 131072 }))
            : [];
          const nvidiaModelsList     = NVIDIA_API_KEY
            ? [...NVIDIA_MODELS].map(id => ({ id, object: 'model', created: 0, owned_by: 'nvidia',     context_length: 131072 }))
            : [];
          const openrouterModelsList = OPENROUTER_API_KEY
            ? [...OPENROUTER_MODELS].map(id => ({ id, object: 'model', created: 0, owned_by: 'openrouter', context_length: 131072 }))
            : [];
          const ollamaModelsList     = [...OLLAMA_MODELS].map(id => ({ id, object: 'model', created: 0, owned_by: 'ollama',     context_length: 131072 }));
          const copilotToken         = getCopilotToken();
          const copilotModelsList    = copilotToken
            ? COPILOT_MODELS.map(id => {
                const rate = COPILOT_RATE_MULTIPLIERS[id];
                const rateTag = rate === 0 ? ' [FREE]'
                              : rate !== undefined && rate < 1 ? ` [${rate}x]`
                              : rate !== undefined && rate > 1 ? ` [${rate}x premium]`
                              : '';
                return {
                  id,
                  object:           'model',
                  created:          0,
                  owned_by:         `github-copilot${rateTag}`,
                  context_length:   128000,
                  x_copilot_rate:   rate !== undefined ? rate : null,
                };
              })
            : [];
          const geminiModelsList = GEMINI_API_KEY
            ? [...GEMINI_MODELS].map(id => ({ id: `gemini/${id}`, object: 'model', owned_by: 'google-gemini', created: 0, context_length: 131072 }))
            : [];
          const openaiModelsList = OPENAI_API_KEY
            ? [...OPENAI_MODELS].map(id => ({ id: `openai/${id}`, object: 'model', owned_by: 'openai', created: 0, context_length: 131072 }))
            : [];
          const combined = { object: 'list', data: [...allModels, ...groqModelsList, ...nvidiaModelsList, ...openrouterModelsList, ...ollamaModelsList, ...copilotModelsList, ...geminiModelsList, ...openaiModelsList] };
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify(combined));
        } catch {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to merge model lists' }));
        }
      };
      goRes.on('end', finish);
      zenRes.on('end', finish);
    }).catch(err => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });
    return;
  }

  // Messages — Anthropic → OpenAI conversion
  if (method === 'POST' && reqPath === '/v1/messages') {
    const MAX_BODY = 10 * 1024 * 1024; // 10 MB
    let rawBody = '';
    let bodyTooLarge = false;
    req.on('data', d => {
      if (bodyTooLarge) return;
      rawBody += d;
      if (rawBody.length > MAX_BODY) {
        bodyTooLarge = true;
        if (!res.headersSent) {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Request body too large' }));
        }
        req.destroy();
      }
    });
    req.on('end', () => {
      if (bodyTooLarge) return;
      let anthropicBody;
      try { anthropicBody = JSON.parse(rawBody); } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      }

      // ── Hot-swap model override ───────────────────────────────────────────
      // Only override "bare" default model names (e.g. claude-opus-4-7).
      // If model already contains '/', user made an explicit /model selection — honour it.
      const activeModel = readActiveModel();
      const isExplicitProviderModel = (anthropicBody.model || '').includes('/');
      if (activeModel && !isExplicitProviderModel) {
        console.log(`[MODEL OVERRIDE] ${anthropicBody.model} → ${activeModel}`);
        anthropicBody.model = activeModel;
      }
      // ─────────────────────────────────────────────────────────────────────

      const isStreaming  = !!anthropicBody.stream;
      const model        = anthropicBody.model;

      // Route to correct provider (before body serialization so we can fix model name)
      const providerInfo = getProviderForModel(model);
      // Increment request counter for this provider
      if (providerInfo) {
        const pid = providerInfo.name === 'GitHub Copilot' ? 'github-copilot'
                  : providerInfo.name === 'Google Gemini'  ? 'gemini'
                  : providerInfo.name === 'OpenAI'         ? 'openai'
                  : providerInfo.name === 'Groq'           ? 'groq'
                  : providerInfo.name === 'Nvidia NIM'     ? 'nvidia'
                  : providerInfo.name === 'OpenRouter'     ? 'openrouter'
                  : providerInfo.name === 'Ollama'         ? 'ollama'
                  : 'opencode';
        REQUEST_COUNTS[pid] = (REQUEST_COUNTS[pid] || 0) + 1;
      } else {
        REQUEST_COUNTS.opencode = (REQUEST_COUNTS.opencode || 0) + 1;
      }
      const openaiBody   = anthropicToOpenAI(anthropicBody);
      // Strip provider prefix for upstream (e.g. copilot/gpt-4.1 → gpt-4.1)
      if (providerInfo?.actualModel) openaiBody.model = providerInfo.actualModel;
      const bodyStr = JSON.stringify(openaiBody);

      let forwardPromise;
      if (providerInfo) {
        // Error if Copilot but no token
        if (providerInfo.name === 'GitHub Copilot' && !providerInfo.apiKey) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: "GitHub Copilot: not logged in. Run 'gh auth login' in terminal or use the proxy dashboard." }));
        }
        if (['Google Gemini', 'OpenAI', 'Groq', 'Nvidia NIM', 'OpenRouter'].includes(providerInfo.name) && !providerInfo.apiKey) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: { message: `${providerInfo.name}: API key not configured. Visit http://localhost:4001/providers to connect.`, type: 'authentication_error' } }));
        }
        const fwdHeaders = { authorization: `Bearer ${providerInfo.apiKey}` };
        console.log(`[${new Date().toISOString()}] ${model} → ${providerInfo.name}`);
        forwardPromise = forwardToProvider('/chat/completions', 'POST', fwdHeaders, bodyStr,
          providerInfo.host, providerInfo.port, providerInfo.base, providerInfo.ssl,
          providerInfo.extraHeaders || {}, providerInfo.name);
      } else {
        const { base: endpointBase, apiKey: routedKey } = getEndpoint(model);
        const fwdHeaders = { authorization: `Bearer ${routedKey}` };
        console.log(`[${new Date().toISOString()}] ${model} → ${endpointBase.includes('/go/') ? 'Go plan' : 'Free Zen'}`);
        forwardPromise = forwardToZen('/chat/completions', 'POST', fwdHeaders, bodyStr, endpointBase);
      }

      forwardPromise.then(upstream => {
        const statusCode = upstream.statusCode;
        console.log(`[${new Date().toISOString()}] upstream ${model} → HTTP ${statusCode}`);

        if (isStreaming) {
          // If upstream returned an error, read body and return proper Anthropic error
          if (statusCode >= 400) {
            let errData = '';
            upstream.on('data', d => errData += d);
            upstream.on('end', () => {
              let errMsg = errData;
              try { const j = JSON.parse(errData); errMsg = j.error?.message || j.message || errData; } catch {}
              console.error(`[UPSTREAM ERROR] ${model} HTTP ${statusCode}: ${errMsg.slice(0, 200)}`);
              res.writeHead(statusCode, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message: errMsg } }));
            });
            return;
          }
          transformOAIStreamToAnthropic(upstream, res, model);
        } else {
          let data = '';
          upstream.on('data', d => data += d);
          upstream.on('end', () => {
            let oaiResponse;
            try { oaiResponse = JSON.parse(data); } catch {
              res.writeHead(502, { 'Content-Type': 'application/json' });
              return res.end(data); // pass through raw error
            }

            if (oaiResponse.error || upstream.statusCode >= 400) {
              // Pass errors back as Anthropic error format
              res.writeHead(upstream.statusCode, { 'Content-Type': 'application/json' });
              const errMsg = oaiResponse.error?.message || oaiResponse.message || JSON.stringify(oaiResponse);
              return res.end(JSON.stringify({
                type: 'error',
                error: { type: 'api_error', message: errMsg },
              }));
            }

            const anthropicResponse = openAIToAnthropic(oaiResponse, model);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(anthropicResponse));
          });
          upstream.on('error', err => {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          });
        }
      }).catch(err => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        const providerName = providerInfo ? providerInfo.name : 'OpenCode Zen';
        res.end(JSON.stringify({ error: `Failed to reach ${providerName}`, details: err.message }));
      });
    });
    return;
  }

  // Fallback 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found', reqPath }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`OpenCode Zen proxy running on http://127.0.0.1:${PORT}`);
  console.log(`Go endpoint: https://${OPENCODE_HOST}${OPENCODE_BASE_GO}`);
  console.log(`Free endpoint: https://${OPENCODE_HOST}${OPENCODE_BASE_ZEN}`);
  console.log(`Models: http://127.0.0.1:${PORT}/v1/models`);
});
