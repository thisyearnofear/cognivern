#!/bin/bash

# Cognivern Monitoring Script
# Run this script to check the health of your deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if running on server
if [ ! -f "docker-compose.yml" ]; then
    print_error "docker-compose.yml not found. Run this script from the deployment directory."
    exit 1
fi

print_header "COGNIVERN SYSTEM STATUS"

# Check Docker services
echo ""
echo "🐳 Docker Services:"
docker-compose ps

# Check service health
echo ""
echo "🏥 Service Health:"

# Backend health
if curl -f -s http://localhost:10000/health > /dev/null; then
    print_status "Backend API is healthy"
else
    print_error "Backend API is not responding"
fi

# Check if trading agent is running
if docker-compose ps | grep -q "cognivern-trading-agent.*Up"; then
    print_status "Trading Agent is running"
else
    print_error "Trading Agent is not running"
fi

# Check nginx
if docker-compose ps | grep -q "cognivern-nginx.*Up"; then
    print_status "Nginx is running"
else
    print_error "Nginx is not running"
fi

# Check recent logs for errors
echo ""
echo "📋 Recent Activity (last 10 lines):"
echo ""
echo "Backend logs:"
docker-compose logs --tail=5 cognivern-backend | tail -5

echo ""
echo "Agent logs:"
docker-compose logs --tail=5 cognivern-agent | tail -5

# Check disk usage
echo ""
echo "💾 Disk Usage:"
df -h /opt/cognivern

# Check memory usage
echo ""
echo "🧠 Memory Usage:"
free -h

# Check trading activity
echo ""
echo "📈 Trading Activity Check:"
if docker-compose logs cognivern-agent | grep -q "Executing trading round"; then
    print_status "Trading activity detected in logs"
    echo "Last trading activity:"
    docker-compose logs cognivern-agent | grep "Executing trading round" | tail -1
else
    print_warning "No recent trading activity found"
fi

# Check for policy violations
echo ""
echo "🛡️  Governance Status:"
if docker-compose logs cognivern-agent | grep -q "Violations today: 0"; then
    print_status "No policy violations detected"
else
    print_warning "Policy violations may have occurred - check logs"
fi

print_header "MONITORING COMPLETE"

echo ""
echo "🔍 For detailed logs, run:"
echo "  docker-compose logs -f cognivern-agent"
echo "  docker-compose logs -f cognivern-backend"
echo ""
echo "🔄 To restart services:"
echo "  docker-compose restart"
echo ""
echo "📊 Dashboard: https://your-domain.com"
echo "🏆 Competition: https://competitions.recall.network"
