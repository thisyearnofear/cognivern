#!/bin/bash

# Simple Cognivern API Monitor
# Tests API endpoints and tracks availability

API_URL="http://157.180.36.156:3000"
LOG_FILE="api-monitor.log"

echo "🚀 Cognivern API Monitor Started"
echo "================================"
echo "API URL: $API_URL"
echo "Log file: $LOG_FILE"
echo ""

# Function to test API endpoint
test_endpoint() {
    local endpoint=$1
    local name=$2

    response=$(curl -s --max-time 3 "$API_URL$endpoint" 2>/dev/null)
    if [ $? -eq 0 ] && [ ! -z "$response" ]; then
        echo "✅ $name: WORKING"
        echo "$(date): ✅ $name working" >> "$LOG_FILE"
        return 0
    else
        echo "❌ $name: FAILED"
        echo "$(date): ❌ $name failed" >> "$LOG_FILE"
        return 1
    fi
}

# Function to check systemd service
check_service() {
    ssh root@157.180.36.156 "systemctl is-active cognivern" >/dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "🟢 Service: ACTIVE"
    else
        echo "🔴 Service: INACTIVE"
    fi
}

# Main monitoring loop
echo "Starting continuous monitoring (Ctrl+C to stop)..."
echo ""

while true; do
    echo "$(date '+%H:%M:%S') - Testing API..."

    # Check systemd service
    check_service

    # Test endpoints
    health_ok=false
    agents_ok=false

    if test_endpoint "/health" "Health"; then
        health_ok=true
    fi

    if test_endpoint "/api/agents" "Agents"; then
        agents_ok=true
    fi

    test_endpoint "/api/governance/metrics" "Governance"

    # Summary
    if [ "$health_ok" = true ] && [ "$agents_ok" = true ]; then
        echo "🎉 API is fully operational!"
        echo "$(date): 🎉 API fully operational" >> "$LOG_FILE"
    elif [ "$health_ok" = true ]; then
        echo "⚠️  API partially working (health only)"
    else
        echo "💥 API not responding"
    fi

    echo "---"
    sleep 5
done
