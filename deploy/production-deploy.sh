#!/bin/bash

# Cognivern Production Deployment Script
# Handles proper Docker deployment with zero-downtime updates

set -e

# Configuration
DEPLOY_DIR="/opt/cognivern"
BACKUP_DIR="/opt/cognivern-backups"
LOG_FILE="/var/log/cognivern-deploy.log"
COMPOSE_FILE="docker-compose.production.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   error "This script must be run as root"
fi

# Create backup
create_backup() {
    log "Creating backup..."
    BACKUP_NAME="cognivern-backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR/$BACKUP_NAME"

    # Backup database
    docker exec cognivern-postgres pg_dump -U postgres cognivern > "$BACKUP_DIR/$BACKUP_NAME/database.sql" 2>/dev/null || warn "Database backup failed"

    # Backup volumes
    docker run --rm -v cognivern_postgres_data:/data -v "$BACKUP_DIR/$BACKUP_NAME":/backup alpine tar czf /backup/postgres_data.tar.gz -C /data . 2>/dev/null || warn "Postgres volume backup failed"
    docker run --rm -v cognivern_redis_data:/data -v "$BACKUP_DIR/$BACKUP_NAME":/backup alpine tar czf /backup/redis_data.tar.gz -C /data . 2>/dev/null || warn "Redis volume backup failed"

    log "Backup created: $BACKUP_NAME"
}

# Health check function
health_check() {
    local service=$1
    local max_attempts=30
    local attempt=1

    log "Checking health of $service..."

    while [ $attempt -le $max_attempts ]; do
        if docker exec "$service" curl -f http://localhost:3000/health >/dev/null 2>&1; then
            log "$service is healthy"
            return 0
        fi

        log "Attempt $attempt/$max_attempts: $service not ready yet..."
        sleep 10
        ((attempt++))
    done

    error "$service failed health check after $max_attempts attempts"
}

# Clean up old Docker resources
cleanup_docker() {
    log "Cleaning up Docker resources..."

    # Remove unused images (keep last 2 versions)
    docker image prune -f

    # Remove unused volumes
    docker volume prune -f

    # Remove unused networks
    docker network prune -f

    log "Docker cleanup completed"
}

# Main deployment function
deploy() {
    log "Starting Cognivern production deployment..."

    # Navigate to deployment directory
    cd "$DEPLOY_DIR" || error "Cannot access deployment directory: $DEPLOY_DIR"

    # Pull latest code (if using git)
    if [ -d ".git" ]; then
        log "Pulling latest code..."
        git pull origin main || error "Failed to pull latest code"
    fi

    # Create backup before deployment
    create_backup

    # Build new images
    log "Building new Docker images..."
    docker-compose -f "$COMPOSE_FILE" build --no-cache || error "Failed to build Docker images"

    # Start database and cache first
    log "Starting core services..."
    docker-compose -f "$COMPOSE_FILE" up -d postgres redis

    # Wait for database to be ready
    log "Waiting for database to be ready..."
    sleep 30

    # Run database migrations if needed
    # docker-compose -f "$COMPOSE_FILE" run --rm cognivern-api npm run migrate

    # Start API service
    log "Starting API service..."
    docker-compose -f "$COMPOSE_FILE" up -d cognivern-api

    # Health check API
    health_check "cognivern-api"

    # Start remaining services
    log "Starting remaining services..."
    docker-compose -f "$COMPOSE_FILE" up -d

    # Final health checks
    sleep 30
    health_check "cognivern-api"

    # Clean up old resources
    cleanup_docker

    log "Deployment completed successfully!"
    log "Services status:"
    docker-compose -f "$COMPOSE_FILE" ps
}

# Rollback function
rollback() {
    local backup_name=$1
    if [ -z "$backup_name" ]; then
        error "Please specify backup name for rollback"
    fi

    log "Rolling back to backup: $backup_name"

    # Stop current services
    docker-compose -f "$COMPOSE_FILE" down

    # Restore database
    if [ -f "$BACKUP_DIR/$backup_name/database.sql" ]; then
        log "Restoring database..."
        docker-compose -f "$COMPOSE_FILE" up -d postgres
        sleep 30
        docker exec -i cognivern-postgres psql -U postgres -d cognivern < "$BACKUP_DIR/$backup_name/database.sql"
    fi

    # Restore volumes
    if [ -f "$BACKUP_DIR/$backup_name/postgres_data.tar.gz" ]; then
        docker run --rm -v cognivern_postgres_data:/data -v "$BACKUP_DIR/$backup_name":/backup alpine tar xzf /backup/postgres_data.tar.gz -C /data
    fi

    # Start services
    docker-compose -f "$COMPOSE_FILE" up -d

    log "Rollback completed"
}

# Command handling
case "$1" in
    deploy)
        deploy
        ;;
    rollback)
        rollback "$2"
        ;;
    backup)
        create_backup
        ;;
    cleanup)
        cleanup_docker
        ;;
    *)
        echo "Usage: $0 {deploy|rollback <backup_name>|backup|cleanup}"
        exit 1
        ;;
esac
