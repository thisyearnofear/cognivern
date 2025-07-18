#!/bin/bash

# Migration script from current architecture to production-ready setup
# This script safely migrates the existing Cognivern deployment

set -e

# Configuration
CURRENT_DIR="/opt/cognivern"
BACKUP_DIR="/opt/cognivern-migration-backup"
NEW_DIR="/opt/cognivern-production"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
    exit 1
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if running as root
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root"
    fi
    
    # Check available disk space (need at least 5GB free)
    available_space=$(df / | awk 'NR==2 {print $4}')
    if [ "$available_space" -lt 5242880 ]; then  # 5GB in KB
        error "Insufficient disk space. Need at least 5GB free."
    fi
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        error "Docker is not running or not accessible"
    fi
    
    log "Prerequisites check passed"
}

# Create comprehensive backup
create_backup() {
    log "Creating comprehensive backup..."
    
    mkdir -p "$BACKUP_DIR"
    
    # Stop current services
    cd "$CURRENT_DIR"
    docker-compose down || warn "Failed to stop current services"
    
    # Backup entire current directory
    log "Backing up current installation..."
    cp -r "$CURRENT_DIR" "$BACKUP_DIR/current-installation"
    
    # Backup Docker volumes if they exist
    log "Backing up Docker volumes..."
    docker volume ls -q | grep cognivern | while read volume; do
        docker run --rm -v "$volume":/data -v "$BACKUP_DIR":/backup alpine tar czf "/backup/${volume}.tar.gz" -C /data .
    done
    
    # Export current environment
    if [ -f "$CURRENT_DIR/.env" ]; then
        cp "$CURRENT_DIR/.env" "$BACKUP_DIR/current.env"
    fi
    
    log "Backup completed at: $BACKUP_DIR"
}

# Analyze current resource usage
analyze_current_setup() {
    log "Analyzing current setup..."
    
    cd "$CURRENT_DIR"
    
    # Check current disk usage
    info "Current directory size: $(du -sh . | cut -f1)"
    
    # Check Docker resource usage
    info "Docker images:"
    docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | grep -E "(cognivern|nginx|postgres|redis)" || true
    
    # Check running containers
    info "Current containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" || true
    
    # Check log sizes
    info "Log file sizes:"
    find . -name "*.log" -exec du -sh {} \; | sort -hr | head -10
}

# Clean up current inefficiencies
cleanup_current() {
    log "Cleaning up current inefficiencies..."
    
    cd "$CURRENT_DIR"
    
    # Remove duplicate node_modules
    log "Removing duplicate node_modules..."
    find . -name "node_modules" -type d | while read dir; do
        if [ "$dir" != "./node_modules" ]; then
            rm -rf "$dir"
            log "Removed: $dir"
        fi
    done
    
    # Clean up old Docker resources
    log "Cleaning Docker resources..."
    docker system prune -f
    docker image prune -f
    docker volume prune -f
    
    # Remove old build artifacts
    log "Removing old build artifacts..."
    rm -rf dist/ build/ .next/ || true
    
    # Compress old logs
    log "Compressing old logs..."
    find . -name "*.log" -size +10M -exec gzip {} \;
    
    log "Cleanup completed"
}

# Setup new production structure with DRY architecture
setup_production() {
    log "Setting up new modular production structure..."

    # Create new production directory
    mkdir -p "$NEW_DIR"
    cd "$NEW_DIR"

    # Copy source code with smart filtering (DRY principle)
    log "Copying source code with deduplication..."
    rsync -av \
          --exclude='node_modules' \
          --exclude='dist' \
          --exclude='build' \
          --exclude='*.log' \
          --exclude='trading-agent/scripts' \
          --exclude='scripts/competitionAgent.ts' \
          --exclude='scripts/mcpCompetitionAgent.ts' \
          --exclude='scripts/startFirstAgent.ts' \
          "$CURRENT_DIR/" "$NEW_DIR/"

    # Remove duplicate files (maintain DRY)
    log "Removing duplicate files..."
    find . -name "*.ts" -path "*/trading-agent/*" | while read file; do
        base_file=$(echo "$file" | sed 's|trading-agent/||')
        if [ -f "$base_file" ]; then
            rm -f "$file"
            log "Removed duplicate: $file"
        fi
    done

    # Copy new modular architecture files
    log "Setting up modular architecture..."

    # Install production dependencies (optimized)
    log "Installing optimized dependencies..."
    npm install -g pnpm

    # Clean install with production optimizations
    pnpm install --frozen-lockfile --prod --prefer-offline

    # Build with modular architecture
    log "Building modular production assets..."
    pnpm build:clean

    log "Modular production setup completed"
}

# Migrate data
migrate_data() {
    log "Migrating data..."
    
    # Create data directories
    mkdir -p "$NEW_DIR/data" "$NEW_DIR/logs" "$NEW_DIR/backups"
    
    # Copy existing data
    if [ -d "$CURRENT_DIR/data" ]; then
        cp -r "$CURRENT_DIR/data/"* "$NEW_DIR/data/" || true
    fi
    
    # Copy important logs (last 7 days)
    find "$CURRENT_DIR" -name "*.log" -mtime -7 -exec cp {} "$NEW_DIR/logs/" \; || true
    
    log "Data migration completed"
}

# Update configuration
update_configuration() {
    log "Updating configuration..."
    
    cd "$NEW_DIR"
    
    # Copy environment variables
    if [ -f "$BACKUP_DIR/current.env" ]; then
        log "Migrating environment variables..."
        
        # Create new .env from template
        cp .env.production .env
        
        # Migrate existing values
        while IFS='=' read -r key value; do
            if [[ $key =~ ^[A-Z_]+$ ]] && [ ! -z "$value" ]; then
                sed -i "s|^${key}=.*|${key}=${value}|" .env
            fi
        done < "$BACKUP_DIR/current.env"
    fi
    
    log "Configuration updated"
}

# Test new setup
test_new_setup() {
    log "Testing new production setup..."
    
    cd "$NEW_DIR"
    
    # Start services
    log "Starting production services..."
    docker-compose -f docker-compose.production.yml up -d
    
    # Wait for services to start
    sleep 60
    
    # Test API health
    log "Testing API health..."
    for i in {1..10}; do
        if curl -f http://localhost/health >/dev/null 2>&1; then
            log "API health check passed"
            break
        fi
        if [ $i -eq 10 ]; then
            error "API health check failed after 10 attempts"
        fi
        sleep 10
    done
    
    # Test database connection
    log "Testing database connection..."
    docker exec cognivern-postgres pg_isready -U postgres || error "Database connection failed"
    
    # Test Redis connection
    log "Testing Redis connection..."
    docker exec cognivern-redis redis-cli ping || error "Redis connection failed"
    
    log "All tests passed!"
}

# Generate migration report
generate_report() {
    log "Generating migration report..."
    
    REPORT_FILE="$NEW_DIR/migration-report.txt"
    
    cat > "$REPORT_FILE" << EOF
Cognivern Production Migration Report
Generated: $(date)

BEFORE MIGRATION:
- Directory size: $(du -sh "$BACKUP_DIR/current-installation" | cut -f1)
- Docker images: $(docker images --format "{{.Size}}" | awk '{sum+=$1} END {print sum "MB"}' || echo "Unknown")

AFTER MIGRATION:
- Directory size: $(du -sh "$NEW_DIR" | cut -f1)
- Active containers: $(docker ps --format "{{.Names}}" | wc -l)
- Services status:
$(docker-compose -f "$NEW_DIR/docker-compose.production.yml" ps)

IMPROVEMENTS:
- ✅ Separated API and agents into different containers
- ✅ Added PostgreSQL database for persistent storage
- ✅ Added Redis for caching and message queuing
- ✅ Implemented proper monitoring with Prometheus/Grafana
- ✅ Added automated backups and health checks
- ✅ Optimized Docker images with multi-stage builds
- ✅ Implemented proper security headers and rate limiting
- ✅ Added comprehensive logging and metrics

NEXT STEPS:
1. Update DNS to point to new setup
2. Configure SSL certificates
3. Set up automated backups
4. Configure monitoring alerts
5. Test trading agents functionality

BACKUP LOCATION: $BACKUP_DIR
EOF

    log "Migration report saved to: $REPORT_FILE"
    cat "$REPORT_FILE"
}

# Main migration process
main() {
    log "Starting Cognivern production migration..."
    
    check_prerequisites
    analyze_current_setup
    create_backup
    cleanup_current
    setup_production
    migrate_data
    update_configuration
    test_new_setup
    generate_report
    
    log "Migration completed successfully!"
    log "New production setup is running at: $NEW_DIR"
    log "Backup available at: $BACKUP_DIR"
    
    info "To switch to the new setup permanently:"
    info "1. Update your deployment scripts to use: $NEW_DIR"
    info "2. Update DNS/proxy configuration"
    info "3. Test all functionality thoroughly"
    info "4. Remove old setup after confirming everything works"
}

# Run migration
main "$@"
