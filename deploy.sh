#!/bin/bash
# Production Deployment Script for SARKARIPYQ
# Supports 100-500 concurrent users

set -euo pipefail

echo "=========================================="
echo "  SARKARIPYQ Production Deployment"
echo "  Database: Supabase PostgreSQL"
echo "=========================================="

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()     { echo -e "${RED}[ERR]${NC} $1"; }

check_prerequisites() {
    info "Checking prerequisites..."
    if ! command -v docker &> /dev/null; then err "Docker not installed."; exit 1; fi
    if ! docker compose version &> /dev/null; then err "Docker Compose plugin not available."; exit 1; fi
    info "Prerequisites OK"
}

setup_environment() {
    info "Setting up environment..."
    if [ ! -f "backend/.env.production" ]; then
        err "backend/.env.production not found."
        info "Create it from template: cp backend/.env.production backend/.env.production"
        exit 1
    fi
    if [ ! -f "frontend/.env.production" ]; then
        warn "frontend/.env.production not found."
        info "Create it from template: cp frontend/.env.production frontend/.env.production"
    fi
    # Inject .env.production values into shell for docker compose
    export $(grep -v '^\s*#' backend/.env.production | grep -v '^\s*$' | xargs)
    info "Environment configured"
}

check_ssl() {
    if [ ! -f "ssl/cert.pem" ] || [ ! -f "ssl/key.pem" ]; then
        warn "SSL certificates not found in ./ssl/"
        info "Run: ./setup-ssl.sh selfsigned sarkaripyq.com  (for dev)"
        info "  or: ./setup-ssl.sh letsencrypt sarkaripyq.com  (for production)"
        info "Continuing without SSL — nginx will reject HTTPS requests."
    else
        info "SSL certificates found"
        # Warn if cert expires in < 30 days
        if command -v openssl &> /dev/null; then
            expiry=$(openssl x509 -in ssl/cert.pem -noout -enddate 2>/dev/null | cut -d= -f2)
            expiry_epoch=$(date -d "$expiry" +%s 2>/dev/null || date -j -f "%b %d %H:%M:%S %Y %Z" "$expiry" +%s 2>/dev/null || echo 0)
            now=$(date +%s)
            days_left=$(( (expiry_epoch - now) / 86400 ))
            if [ "$days_left" -lt 30 ] 2>/dev/null; then
                warn "SSL cert expires in $days_left days. Renew soon."
            fi
        fi
    fi
}

run_migrations() {
    info "Running database migrations..."
    if [ ! -f "backend/scripts/migrate.js" ]; then
        err "Migration script not found at backend/scripts/migrate.js"
        exit 1
    fi
    cd backend
    npm run migrate -- --status 2>/dev/null || true
    npm run migrate 2>&1 || {
        warn "Migration step failed. Check DATABASE_URL in .env.production"
        warn "You can retry later with: cd backend && npm run migrate"
    }
    cd ..
}

deploy() {
    info "Building containers..."
    docker compose build --parallel

    info "Starting services..."
    docker compose up -d

    info "Waiting for services..."
    sleep 15

    info "Checking health..."
    check_health
}

check_health() {
    local max_retries=12
    local retry=0
    while [ $retry -lt $max_retries ]; do
        if curl -sf http://localhost:5000/api/health &>/dev/null; then
            info "API: Healthy"
            break
        fi
        retry=$((retry + 1))
        if [ $retry -eq $max_retries ]; then
            err "API: Unhealthy after 60s"
            info "Check logs: docker compose logs api"
            return 1
        fi
        sleep 5
    done

    if curl -sf -o /dev/null http://localhost/; then
        info "Web: Responding"
    else
        warn "Web: Not responding (expected if SSL not set up)"
    fi
}

setup_ssl_interactive() {
    if ! command -v certbot &> /dev/null; then
        warn "Certbot not installed locally."
        warn "You can use: docker compose --profile certbot run certbot"
        read -rp "Enter your domain (e.g. sarkaripyq.com): " domain
        docker compose --profile certbot run --rm certbot certonly --webroot \
            -w /var/www/html -d "$domain" -d "www.$domain" || {
            err "SSL setup failed."
            info "Try: sudo ./setup-ssl.sh letsencrypt $domain"
            return 1
        }
        info "SSL cert obtained. Restarting nginx..."
        docker compose exec nginx nginx -s reload
        return 0
    fi
    ./setup-ssl.sh letsencrypt
}

show_status() {
    echo ""
    echo "=========================================="
    echo "  Deployment Status"
    echo "=========================================="
    docker compose ps
    echo ""
    local ip
    ip=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
    echo "URLs:"
    echo "  - Site:     https://$ip"
    echo "  - API:      http://$ip:5000"
    echo "  - Grafana:  http://$ip:3001  (admin:GRAFANA_ADMIN_PASSWORD)"
    echo "  - Prometheus: http://$ip:9090"
    echo ""
    info "Logs:  ./deploy.sh logs [service]"
    info "Stop:  ./deploy.sh stop"
    info "Scale: ./deploy.sh scale 3"
}

case "${1:-}" in
    deploy)
        check_prerequisites
        setup_environment
        check_ssl
        run_migrations
        deploy
        show_status
        info "Deployment complete."
        ;;
    migrate)
        check_prerequisites
        setup_environment
        run_migrations
        ;;
    health)
        check_health
        ;;
    logs)
        shift
        docker compose logs -f "${@:-}"
        ;;
    stop)
        docker compose down
        info "Services stopped."
        ;;
    restart)
        docker compose restart
        info "Services restarted."
        ;;
    scale)
        local n="${2:-2}"
        docker compose up -d --scale api="$n"
        info "API scaled to $n instances"
        ;;
    ssl)
        setup_ssl_interactive
        ;;
    backup)
        if [ -f ./backup.sh ]; then
            ./backup.sh
        else
            err "backup.sh not found"
            exit 1
        fi
        ;;
    *)
        echo "Usage: $0 {deploy|migrate|health|logs [service]|stop|restart|scale [n]|ssl|backup}"
        echo ""
        echo "Commands:"
        echo "  deploy          Full deployment (env check → SSL check → migrate → build → start)"
        echo "  migrate         Run pending database migrations"
        echo "  health          Check API health"
        echo "  logs [svc]      Tail logs for all or a specific service"
        echo "  stop            Stop all services"
        echo "  restart         Restart all services"
        echo "  scale [n]       Scale API to n instances (default: 2)"
        echo "  ssl             Interactive SSL setup via certbot"
        echo "  backup          Run backup script"
        ;;
esac
