#!/bin/bash

# Test Agent Comparison API Endpoints
# Run this after starting the backend server

BASE_URL="http://localhost:3000/api"

echo "🧪 Testing Agent Comparison API Endpoints"
echo "=========================================="
echo ""

# Test 1: Compare all agents
echo "1️⃣  Testing /agents/compare (all agents)"
curl -s "$BASE_URL/agents/compare" | jq '.'
echo ""
echo ""

# Test 2: Compare with filters
echo "2️⃣  Testing /agents/compare (filtered by type)"
curl -s "$BASE_URL/agents/compare?agentTypes=sapience&sortBy=winRate&sortDirection=desc" | jq '.'
echo ""
echo ""

# Test 3: Leaderboard
echo "3️⃣  Testing /agents/leaderboard"
curl -s "$BASE_URL/agents/leaderboard?limit=5" | jq '.'
echo ""
echo ""

# Test 4: Aggregate stats
echo "4️⃣  Testing /agents/stats"
curl -s "$BASE_URL/agents/stats" | jq '.'
echo ""
echo ""

# Test 5: List agents
echo "5️⃣  Testing /agents (list all)"
curl -s "$BASE_URL/agents" | jq '.'
echo ""
echo ""

echo "✅ All tests complete!"
