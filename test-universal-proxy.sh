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

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ $FAIL -eq 0 ] && exit 0 || exit 1
