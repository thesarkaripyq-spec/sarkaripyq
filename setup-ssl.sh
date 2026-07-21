#!/bin/bash
# SARKARIPYQ SSL Setup Script
# Usage:
#   ./setup-ssl.sh selfsigned   — Generate self-signed cert for dev/staging
#   ./setup-ssl.sh letsencrypt  — Obtain real Let's Encrypt cert for production
#   ./setup-ssl.sh renew        — Renew Let's Encrypt cert
#   ./setup-ssl.sh cleanup      — Remove old/renewed certs

set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()   { echo -e "${RED}[ERR]${NC} $1"; }

SSL_DIR="$(cd "$(dirname "$0")" && pwd)/ssl"
mkdir -p "$SSL_DIR"

selfsigned() {
  local domain="${1:-localhost}"
  info "Generating self-signed cert for domain: $domain"
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$SSL_DIR/key.pem" \
    -out "$SSL_DIR/cert.pem" \
    -subj "/CN=$domain/O=SARKARIPYQ/C=IN" \
    -addext "subjectAltName=DNS:$domain,DNS:*.$domain,IP:127.0.0.1"
  chmod 600 "$SSL_DIR/key.pem"
  info "Self-signed cert created:"
  echo "  Certificate: $SSL_DIR/cert.pem"
  echo "  Key:         $SSL_DIR/key.pem"
  openssl x509 -in "$SSL_DIR/cert.pem" -noout -text | grep -E "Subject:|Not Before|Not After"
}

letsencrypt() {
  local domain="$1"
  if [ -z "$domain" ]; then
    read -rp "Enter your domain (e.g. sarkaripyq.com): " domain
  fi
  if ! command -v certbot &>/dev/null; then
    warn "Certbot not found. Installing..."
    if command -v apt-get &>/dev/null; then
      sudo apt-get update && sudo apt-get install -y certbot
    elif command -v yum &>/dev/null; then
      sudo yum install -y certbot
    else
      err "Package manager not supported. Install certbot manually: https://certbot.eff.org"
      exit 1
    fi
  fi
  sudo certbot certonly --standalone \
    -d "$domain" -d "www.$domain" \
    --non-interactive --agree-tos \
    -m "admin@$domain" || {
    warn "Standalone mode failed. Trying webroot..."
    sudo certbot certonly --webroot -w /usr/share/nginx/html \
      -d "$domain" -d "www.$domain" \
      --non-interactive --agree-tos -m "admin@$domain" || {
      err "SSL cert request failed."
      info "You can obtain certs manually:"
      echo "  sudo certbot certonly --standalone -d $domain -d www.$domain"
      exit 1
    }
  }
  local cert_dir="/etc/letsencrypt/live/$domain"
  if [ -f "$cert_dir/fullchain.pem" ] && [ -f "$cert_dir/privkey.pem" ]; then
    sudo cp "$cert_dir/fullchain.pem" "$SSL_DIR/cert.pem"
    sudo cp "$cert_dir/privkey.pem" "$SSL_DIR/key.pem"
    sudo chown -R "$(whoami)" "$SSL_DIR"
    chmod 600 "$SSL_DIR/key.pem"
    info "Let's Encrypt cert copied to $SSL_DIR"
  fi
  info "Set up auto-renewal via cron:"
  echo "  0 3 * * * root $(pwd)/setup-ssl.sh renew"
}

renew() {
  info "Renewing Let's Encrypt certificate..."
  if command -v certbot &>/dev/null; then
    sudo certbot renew --quiet
    local domain="${1:-sarkaripyq.com}"
    local cert_dir="/etc/letsencrypt/live/$domain"
    if [ -f "$cert_dir/fullchain.pem" ]; then
      sudo cp "$cert_dir/fullchain.pem" "$SSL_DIR/cert.pem"
      sudo cp "$cert_dir/privkey.pem" "$SSL_DIR/key.pem"
      info "Certificate renewed and copied to $SSL_DIR"
    fi
    docker compose exec web nginx -s reload 2>/dev/null || true
  else
    err "certbot not installed"
    exit 1
  fi
}

cleanup() {
  info "Cleaning old certs..."
  find "$SSL_DIR" -name "*.pem" -mtime +365 -delete
  info "Removed certificates older than 365 days from $SSL_DIR"
}

case "${1:-}" in
  selfsigned) selfsigned "${2:-}" ;;
  letsencrypt) letsencrypt "${2:-}" ;;
  renew) renew "${2:-}" ;;
  cleanup) cleanup ;;
  *)
    echo "Usage: $0 {selfsigned [domain]|letsencrypt [domain]|renew [domain]|cleanup}"
    echo ""
    echo "Examples:"
    echo "  ./setup-ssl.sh selfsigned               # dev cert for localhost"
    echo "  ./setup-ssl.sh selfsigned sarkaripyq.com # dev cert for domain"
    echo "  ./setup-ssl.sh letsencrypt               # production cert (prompts for domain)"
    echo "  ./setup-ssl.sh letsencrypt sarkaripyq.com"
    echo "  ./setup-ssl.sh renew                     # renew existing cert"
    ;;
esac
