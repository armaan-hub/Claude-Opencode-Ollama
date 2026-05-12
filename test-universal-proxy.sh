#!/bin/bash
# Integration tests for universal proxy model override
PROXY="http://localhost:4001"
PASS=0; FAIL=0

check() {
  local name="$1" cmd="$2" expected="$3"
  local result
  result=$(eval "$cmd" 2>/dev/null)
  if echo "$result" | grep -q "$expected"; then
    echo "✅ PASS: $name"; ((PASS++))
  else
    echo "❌ FAIL: $name"
    echo "   Expected substring: $expected"
    echo "   Got: ${result:0:300}"
    ((FAIL++))
  fi
}

# Clean state
rm -f ~/.claude/active-model

echo "=== Test Suite: Universal LLM Proxy ==="

# Test 1: Proxy is running
check "Proxy health check" \
  "curl -s $PROXY/health" \
  '"status":"ok"'

# Test 2: Models list includes Groq model
check "Models list has Groq llama-3.3-70b-versatile" \
  "curl -s $PROXY/v1/models | python3 -c \"import sys,json; ids=[m['id'] for m in json.load(sys.stdin)['data']]; print(chr(10).join(ids))\"" \
  "llama-3.3-70b-versatile"

# Test 3: Models list includes Nvidia model
check "Models list has Nvidia meta/llama-3.3-70b-instruct" \
  "curl -s $PROXY/v1/models | python3 -c \"import sys,json; ids=[m['id'] for m in json.load(sys.stdin)['data']]; print(chr(10).join(ids))\"" \
  "meta/llama-3.3-70b-instruct"

# Test 4: /api/active-model returns null when no file
check "api/active-model returns null when no file" \
  "curl -s $PROXY/api/active-model" \
  '"model":null'

# Test 5: /api/active-model returns model name after writing file
echo "llama-3.3-70b-versatile" > ~/.claude/active-model
check "api/active-model returns set model" \
  "curl -s $PROXY/api/active-model" \
  "llama-3.3-70b-versatile"

# Cleanup
rm -f ~/.claude/active-model

# ── Test 6: Copilot models in /v1/models ─────────────────────────────────────
result6=$(curl -s http://localhost:4001/v1/models | python3 -c "
import sys,json
d=json.load(sys.stdin)
ids=[m['id'] for m in d.get('data',[])]
copilot=[x for x in ids if x.startswith('copilot/')]
print(len(copilot))
" 2>/dev/null)
if [[ "$result6" =~ ^[0-9]+$ ]] && [[ "$result6" -ge 11 ]]; then
  echo "✅ PASS: Copilot models in /v1/models ($result6 models)"
  ((PASS++))
else
  echo "❌ FAIL: Expected ≥11 copilot/ models, got: $result6"
  ((FAIL++))
fi

# ── Test 7: /api/copilot/test returns ok ─────────────────────────────────────
check "Copilot /api/copilot/test reports connected" \
  "curl -s http://localhost:4001/api/copilot/test" \
  '"ok":true'

# ── Test 8: Copilot real API call through proxy ───────────────────────────────
result8=$(curl -s http://localhost:4001/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test" \
  -H "anthropic-version: 2023-06-01" \
  -d '{"model":"copilot/gpt-4.1","max_tokens":15,"messages":[{"role":"user","content":"Reply with exactly: PROXY_OK"}]}' \
  | python3 -c "
import sys,json
d=json.load(sys.stdin)
t=d.get('content',[{}])[0].get('text','')
print('ok' if t else 'empty: '+str(d))
" 2>/dev/null)
if [[ "$result8" == "ok" ]]; then
  echo "✅ PASS: Real Copilot API call via proxy succeeded"
  ((PASS++))
else
  echo "❌ FAIL: Copilot API call returned empty/error (got: $result8)"
  ((FAIL++))
fi

# ── Test 9: set-model works with copilot/ prefix ─────────────────────────────
source ~/.zshrc 2>/dev/null
set-model "copilot/claude-sonnet-4.6" 2>/dev/null
written=$(cat ~/.claude/active-model 2>/dev/null)
set-model clear 2>/dev/null
if [[ "$written" == "copilot/claude-sonnet-4.6" ]]; then
  echo "✅ PASS: set-model correctly wrote copilot/claude-sonnet-4.6"
  ((PASS++))
else
  echo "❌ FAIL: set-model wrote '$written' instead of 'copilot/claude-sonnet-4.6'"
  ((FAIL++))
fi

# ── Test 10: ~/.claude/commands/model.md exists ───────────────────────────────
if [[ -f "$HOME/.claude/commands/model.md" ]]; then
  has_frontmatter=$(head -1 ~/.claude/commands/model.md)
  if [[ "$has_frontmatter" == "---" ]]; then
    echo "✅ PASS: ~/.claude/commands/model.md exists with valid frontmatter"
    ((PASS++))
  else
    echo "❌ FAIL: model.md exists but missing frontmatter (first line: $has_frontmatter)"
    ((FAIL++))
  fi
else
  echo "❌ FAIL: ~/.claude/commands/model.md does not exist"
  ((FAIL++))
fi

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ $FAIL -eq 0 ] && exit 0 || exit 1
