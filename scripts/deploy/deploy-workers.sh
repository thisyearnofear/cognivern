#!/bin/bash
# Cloudflare Workers Deployment Script
# Deploys Cognivern Agents to Cloudflare Workers edge network

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-staging} # staging | production
PROJECT_NAME="cognivern-agents"

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Cognivern Agents - Cloudflare Workers Deployment    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${YELLOW}Wrangler CLI not found. Installing...${NC}"
    npm install -g wrangler
fi

# Check if logged in to Cloudflare
if ! wrangler whoami &> /dev/null; then
    echo -e "${YELLOW}Not logged in to Cloudflare. Please authenticate...${NC}"
    wrangler login
fi

echo -e "${GREEN}✓ Cloudflare authentication verified${NC}"
echo ""

# Validate environment
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    echo -e "${RED}✗ Invalid environment: $ENVIRONMENT${NC}"
    echo -e "${YELLOW}Usage: $0 [staging|production]${NC}"
    exit 1
fi

echo -e "${BLUE}Environment: ${GREEN}$ENVIRONMENT${NC}"
echo ""

# Create D1 database if it doesn't exist
echo -e "${YELLOW}Setting up D1 database...${NC}"
DB_NAME="cognivern-db-${ENVIRONMENT}"

# Check if database exists
if ! wrangler d1 info "$DB_NAME" &> /dev/null; then
    echo -e "${YELLOW}Creating D1 database: $DB_NAME${NC}"
    wrangler d1 create "$DB_NAME"
    echo -e "${GREEN}✓ Database created${NC}"
else
    echo -e "${GREEN}✓ Database exists: $DB_NAME${NC}"
fi

# Get database ID
DB_ID=$(wrangler d1 info "$DB_NAME" --json | jq -r '.[0].uuid')
echo -e "${BLUE}Database ID: ${GREEN}$DB_ID${NC}"

# Update wrangler.toml with database ID
echo -e "${YELLOW}Updating wrangler.toml configuration...${NC}"
if [[ "$ENVIRONMENT" == "production" ]]; then
    sed -i.bak "s/database_id = \"your-production-database-id\"/database_id = \"$DB_ID\"/" src/modules/cloudflare-agents/wrangler.toml
else
    sed -i.bak "s/database_id = \"your-staging-database-id\"/database_id = \"$DB_ID\"/" src/modules/cloudflare-agents/wrangler.toml
fi
rm src/modules/cloudflare-agents/wrangler.toml.bak
echo -e "${GREEN}✓ Configuration updated${NC}"
echo ""

# Initialize D1 database schema
echo -e "${YELLOW}Initializing database schema...${NC}"
wrangler d1 execute "$DB_NAME" --file=src/modules/cloudflare-agents/schema.sql --remote
echo -e "${GREEN}✓ Database schema initialized${NC}"
echo ""

# Set environment secrets
echo -e "${YELLOW}Configuring environment secrets...${NC}"
echo -e "${BLUE}Note: Skip if already configured${NC}"

if command -v read -s &> /dev/null; then
    read -s -p "Enter OPENAI_API_KEY (or press Enter to skip): " OPENAI_KEY
    echo ""
    if [[ -n "$OPENAI_KEY" ]]; then
        wrangler secret put OPENAI_API_KEY --environment "$ENVIRONMENT" <<< "$OPENAI_KEY"
        echo -e "${GREEN}✓ OPENAI_API_KEY configured${NC}"
    fi

    read -s -p "Enter GEMINI_API_KEY (or press Enter to skip): " GEMINI_KEY
    echo ""
    if [[ -n "$GEMINI_KEY" ]]; then
        wrangler secret put GEMINI_API_KEY --environment "$ENVIRONMENT" <<< "$GEMINI_KEY"
        echo -e "${GREEN}✓ GEMINI_API_KEY configured${NC}"
    fi

    read -s -p "Enter ANTHROPIC_API_KEY (or press Enter to skip): " ANTHROPIC_KEY
    echo ""
    if [[ -n "$ANTHROPIC_KEY" ]]; then
        wrangler secret put ANTHROPIC_API_KEY --environment "$ENVIRONMENT" <<< "$ANTHROPIC_KEY"
        echo -e "${GREEN}✓ ANTHROPIC_API_KEY configured${NC}"
    fi
else
    echo -e "${YELLOW}Interactive secret configuration not supported in this shell.${NC}"
    echo -e "${BLUE}Please set secrets manually:${NC}"
    echo -e "  wrangler secret put OPENAI_API_KEY --environment $ENVIRONMENT"
    echo -e "  wrangler secret put GEMINI_API_KEY --environment $ENVIRONMENT"
    echo -e "  wrangler secret put ANTHROPIC_API_KEY --environment $ENVIRONMENT"
fi
echo ""

# Build worker
echo -e "${YELLOW}Building worker...${NC}"
pnpm run build:workers
echo -e "${GREEN}✓ Worker built successfully${NC}"
echo ""

# Deploy
echo -e "${YELLOW}Deploying to Cloudflare Workers...${NC}"
if [[ "$ENVIRONMENT" == "production" ]]; then
    wrangler deploy --environment production
else
    wrangler deploy --environment staging
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              ✓ Deployment Successful!                  ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Get deployment URL
DEPLOYMENT_URL=$(wrangler tail --environment "$ENVIRONMENT" 2>&1 | grep -o 'https://[^.]*\.workers\.dev' | head -1 || echo "https://$PROJECT_NAME.workers.dev")

echo -e "${BLUE}Worker URL: ${GREEN}$DEPLOYMENT_URL${NC}"
echo -e "${BLUE}Health Check: ${GREEN}${DEPLOYMENT_URL}/health${NC}"
echo -e "${BLUE}API Endpoint: ${GREEN}${DEPLOYMENT_URL}/api/governance/evaluate${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Test the health endpoint: curl ${DEPLOYMENT_URL}/health"
echo "  2. Configure custom domain (optional): wrangler routes add"
echo "  3. Monitor logs: wrangler tail --environment $ENVIRONMENT"
echo ""
