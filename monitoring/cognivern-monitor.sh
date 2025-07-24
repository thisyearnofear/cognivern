#!/bin/bash

# Cognivern Service Health Monitor
# This script continuously monitors the Cognivern service health

LOG_FILE="/var/log/cognivern-monitor.log"
API_URL="http://localhost:3000"
CHECK_INTERVAL=2

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

check_systemd_status() {
    systemctl is-active cognivern >/dev/null 2>&1
    return $?
}

check_api_health() {
    curl -s --max-time 1 "$API_URL/health" >/dev/null 2>&1
    return $?
}

check_api_agents() {
    curl -s --max-time 1 "$API_URL/api/agents" >/dev/null 2>&1
    return $?
}

get_service_stats() {
    systemctl show cognivern --property=ActiveState,SubState,ExecMainPID,NRestarts
}

main_monitor_loop() {
    log_message "🚀 Starting Cognivern Health Monitor"
    
    while true; do
        # Check systemd service status
        if check_systemd_status; then
            systemd_status="${GREEN}ACTIVE${NC}"
        else
            systemd_status="${RED}INACTIVE${NC}"
        fi
        
        # Check API health
        if check_api_health; then
            api_status="${GREEN}RESPONDING${NC}"
            api_available=true
        else
            api_status="${RED}NOT_RESPONDING${NC}"
            api_available=false
        fi
        
        # Check agents endpoint if API is available
        agents_status="${YELLOW}N/A${NC}"
        if [ "$api_available" = true ]; then
            if check_api_agents; then
                agents_status="${GREEN}WORKING${NC}"
            else
                agents_status="${RED}FAILED${NC}"
            fi
        fi
        
        # Get service statistics
        stats=$(get_service_stats)
        restarts=$(echo "$stats" | grep NRestarts | cut -d'=' -f2)
        
        # Display status
        printf "\r$(date '+%H:%M:%S') | Service: $systemd_status | API: $api_status | Agents: $agents_status | Restarts: $restarts"
        
        # Log significant events
        if [ "$api_available" = true ]; then
            log_message "✅ API Available - Health and Agents endpoints responding"
        fi
        
        sleep $CHECK_INTERVAL
    done
}

# Handle script termination
trap 'echo -e "\n🛑 Monitor stopped"; exit 0' INT TERM

# Start monitoring
main_monitor_loop
