#!/bin/bash
# Local Development Script for Cloudflare Workers
# Runs Workers locally with Miniflare for fast iteration

set -e

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║      Cognivern Agents - Local Development Server       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if .dev.vars exists (for local secrets)
if [ ! -f ".dev.vars" ]; then
    echo -e "${YELLOW}Creating .dev.vars file for local development...${NC}"
    cat > .dev.vars << EOF
# Local development API keys (not used in production)
OPENAI_API_KEY=sk-local-dev-key
GEMINI_API_KEY=local-dev-key
ANTHROPIC_API_KEY=sk-ant-local-dev-key

# Environment
ENVIRONMENT=development
LOG_LEVEL=debug
EOF
    echo -e "${GREEN}✓ .dev.vars created${NC}"
    echo -e "${YELLOW}Please update .dev.vars with your actual API keys${NC}"
    echo ""
fi

# Create local D1 database
echo -e "${YELLOW}Setting up local D1 database...${NC}"
if [ ! -f ".wrangler/state/d1/cognivern-db-dev.sqlite" ]; then
    echo -e "${BLUE}Creating local D1 database...${NC}"
    mkdir -p .wrangler/state/d1
    sqlite3 .wrangler/state/d1/cognivern-db-dev.sqlite < src/modules/cloudflare-agents/schema.sql
    echo -e "${GREEN}✓ Local database created${NC}"
else
    echo -e "${GREEN}✓ Local database exists${NC}"
fi
echo ""

# Start wrangler dev
echo -e "${GREEN}Starting local development server...${NC}"
echo -e "${BLUE}Worker URL: http://localhost:8787${NC}"
echo -e "${BLUE}Health Check: http://localhost:8787/health${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
echo ""

wrangler dev
