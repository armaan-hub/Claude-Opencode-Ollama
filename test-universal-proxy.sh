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

# ── Test 11: /api/providers returns 8 providers ──────────────────────────────
echo -n "Test 11: /api/providers has 8 providers ... "
COUNT=$(curl -s http://localhost:4001/api/providers | python3 -c "import sys,json; print(len(json.load(sys.stdin)['providers']))")
if [ "$COUNT" = "8" ]; then
  echo "PASS (got $COUNT)"
  PASS=$((PASS+1))
else
  echo "FAIL (got $COUNT, expected 8)"
  FAIL=$((FAIL+1))
fi

# ── Test 12: /api/providers includes github-copilot ──────────────────────────
echo -n "Test 12: github-copilot provider present ... "
HAS=$(curl -s http://localhost:4001/api/providers | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if any(p['id']=='github-copilot' for p in d['providers']) else 'no')")
if [ "$HAS" = "yes" ]; then
  echo "PASS"
  PASS=$((PASS+1))
else
  echo "FAIL"
  FAIL=$((FAIL+1))
fi

# ── Test 13: /providers HTML page returns 200 ────────────────────────────────
echo -n "Test 13: /providers page returns 200 ... "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4001/providers)
if [ "$STATUS" = "200" ]; then
  echo "PASS"
  PASS=$((PASS+1))
else
  echo "FAIL (got HTTP $STATUS)"
  FAIL=$((FAIL+1))
fi

# ── Test 14: /api/auth/github/start redirects (302) ──────────────────────────
echo -n "Test 14: /api/auth/github/start redirects ... "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4001/api/auth/github/start)
# Redirects to /providers?error=missing-client-id if no client ID, or to GitHub if configured
if [ "$STATUS" = "302" ]; then
  echo "PASS (got 302)"
  PASS=$((PASS+1))
else
  echo "FAIL (got HTTP $STATUS, expected 302)"
  FAIL=$((FAIL+1))
fi

# ── Test 15: /provider slash command file exists ──────────────────────────────
echo -n "Test 15: /provider slash command file exists ... "
if [ -f "$HOME/.claude/commands/provider.md" ]; then
  echo "PASS"
  PASS=$((PASS+1))
else
  echo "FAIL (file missing)"
  FAIL=$((FAIL+1))
fi

# ── Test 16: /api/providers/groq/connect accepts API key POST ────────────────
echo -n "Test 16: /api/providers/groq/connect endpoint ... "
RESP=$(curl -s -X POST http://localhost:4001/api/providers/groq/connect \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"test-key-do-not-use"}')
FIELD=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('ok','missing'))" 2>/dev/null)
if [ "$FIELD" = "True" ] || [ "$FIELD" = "true" ]; then
  echo "PASS"
  PASS=$((PASS+1))
  # Restore: remove the test key
  curl -s -X POST http://localhost:4001/api/providers/groq/disconnect > /dev/null
else
  echo "FAIL (got: $RESP)"
  FAIL=$((FAIL+1))
fi

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ $FAIL -eq 0 ] && exit 0 || exit 1
