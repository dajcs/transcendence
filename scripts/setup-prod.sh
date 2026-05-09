#!/usr/bin/env bash
# One-shot production bootstrap for voxpo.me.
# Run once on a fresh server BEFORE starting the stack: make setup-prod
set -euo pipefail

# Let your user run docker without sudo
sudo usermod -aG docker $USER


DOMAIN="voxpo.me"
DEPLOY_USER="${SUDO_USER:-$USER}"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE="docker compose -f $REPO_DIR/docker-compose.yml -f $REPO_DIR/docker-compose.prod.yml"

echo "=== Vox Populi production setup ==="
echo "Repo: $REPO_DIR"
echo "Domain: $DOMAIN"
echo "Deploy user: $DEPLOY_USER"
echo

# --- Prerequisites ---

missing=()
command -v docker  &>/dev/null || missing+=("docker")
command -v certbot &>/dev/null || missing+=("certbot")
command -v setfacl &>/dev/null || missing+=("acl")

if [ ${#missing[@]} -gt 0 ]; then
    echo "Installing missing packages: ${missing[*]}"
    sudo apt-get update -q
    pkgs=()
    for m in "${missing[@]}"; do
        case "$m" in
            certbot) pkgs+=("certbot") ;;
            acl)     pkgs+=("acl") ;;
            docker)
                echo "ERROR: Docker is not installed. Install Docker Engine first:"
                echo "  https://docs.docker.com/engine/install/ubuntu/"
                exit 1
                ;;
        esac
    done
    sudo apt-get install -y "${pkgs[@]}"
fi

# --- Let's Encrypt certificate (standalone — nginx not running yet) ---

if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo "Certificate already exists for $DOMAIN, skipping issuance."
else
    # Free port 80: stop any system web server that may be pre-installed on the droplet
    for svc in apache2 nginx; do
        if systemctl is-active --quiet "$svc" 2>/dev/null; then
            echo "Stopping $svc (occupying port 80)..."
            sudo systemctl stop "$svc"
            sudo systemctl disable "$svc"
        fi
    done
    # Kill anything else still holding port 80
    if sudo ss -tlnp | grep -q ':80 '; then
        echo "Killing remaining process on port 80..."
        sudo fuser -k 80/tcp 2>/dev/null || true
        sleep 1
    fi

    echo "Issuing Let's Encrypt certificate for $DOMAIN..."
    read -rp "Email for Let's Encrypt notices: " LE_EMAIL
    sudo certbot certonly \
        --standalone \
        --non-interactive \
        --agree-tos \
        --email "$LE_EMAIL" \
        -d "$DOMAIN"
    echo "Certificate issued."
fi

# --- ACL: allow $DEPLOY_USER to read certs (owned by root) ---

echo "Setting ACL on /etc/letsencrypt for user $DEPLOY_USER..."
sudo setfacl -R -m "u:$DEPLOY_USER:rX" /etc/letsencrypt/live
sudo setfacl -R -m "u:$DEPLOY_USER:rX" /etc/letsencrypt/archive
sudo setfacl    -m "u:$DEPLOY_USER:rX" /etc/letsencrypt
echo "ACL applied."

# --- Certbot renewal hooks (standalone: brief nginx stop/start ~10s) ---

PRE_HOOK="/etc/letsencrypt/renewal-hooks/pre/stop-nginx.sh"
POST_HOOK="/etc/letsencrypt/renewal-hooks/post/start-nginx.sh"

echo "Writing certbot renewal hooks..."
sudo tee "$PRE_HOOK" > /dev/null <<EOF
#!/bin/sh
# Stop nginx before certbot standalone renewal
$COMPOSE stop nginx
EOF

sudo tee "$POST_HOOK" > /dev/null <<EOF
#!/bin/sh
# Restart nginx after certbot standalone renewal
$COMPOSE start nginx
EOF

sudo chmod +x "$PRE_HOOK" "$POST_HOOK"
echo "Renewal hooks written."

# --- Weekly renewal cron (certs are 90-day; certbot only renews within 30 days of expiry) ---

CRON_FILE="/etc/cron.d/certbot-voxpo"
echo "Installing weekly renewal cron ($CRON_FILE)..."
sudo tee "$CRON_FILE" > /dev/null <<EOF
# Check and renew voxpo.me cert weekly (Sundays 03:00)
# certbot only acts when expiry is < 30 days away
0 3 * * 0  root  certbot renew --quiet
EOF
sudo chmod 644 "$CRON_FILE"
echo "Renewal cron installed (Sundays 03:00)."

# --- JWT signing keys ---

if [ -f "$REPO_DIR/backend/keys/jwt_private.pem" ]; then
    echo "JWT keys already exist, skipping."
else
    echo "Generating JWT RSA key pair..."
    mkdir -p "$REPO_DIR/backend/keys"
    openssl genrsa -out "$REPO_DIR/backend/keys/jwt_private.pem" 2048
    openssl rsa -in "$REPO_DIR/backend/keys/jwt_private.pem" \
        -pubout -out "$REPO_DIR/backend/keys/jwt_public.pem"
    chmod 600 "$REPO_DIR/backend/keys/jwt_private.pem"
    echo "JWT keys generated."
fi

# --- .env ---

if [ -f "$REPO_DIR/.env" ]; then
    echo ".env already exists, skipping creation."
else
    cp "$REPO_DIR/.env.prod.example" "$REPO_DIR/.env"
    echo ".env created from .env.prod.example."
fi

# --- Done ---

echo
echo "=== Setup complete ==="
echo
echo "Next steps:"
echo "  1. Edit $REPO_DIR/.env — fill in all CHANGE_ME values"
echo "     (POSTGRES_PASSWORD, SECRET_KEY, OPENROUTER_API_KEY, OAuth IDs, SMTP)"
echo "  2. Start the stack:  make main"
echo "  3. Verify:           curl -I https://$DOMAIN"
echo
echo "Cert renewal runs weekly (Sundays 03:00) via $CRON_FILE"
echo "Manual renewal: make cert-renew"
