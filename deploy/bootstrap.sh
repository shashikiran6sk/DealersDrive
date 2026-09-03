#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# One-time provisioning for a fresh Ubuntu 22.04/24.04 EC2 instance.
#
#   ssh ubuntu@<elastic-ip>
#   git clone <your-repo-url> ~/dealers-drive
#   bash ~/dealers-drive/deploy/bootstrap.sh
#
# Installs Node 24, pnpm, Docker, nginx and certbot, and adds swap so the
# Next.js build does not get OOM-killed on a 2 GB instance. Safe to re-run.
#
# It does NOT write .env, request a certificate or start the app — those need
# your domain and your secrets. deploy/README.md picks up from here.
# ---------------------------------------------------------------------------
set -euo pipefail

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

log "System packages"
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg git ufw

log "Swap (4 GB) — a 2 GB box cannot run the Next.js build without it"
if ! sudo swapon --show | grep -q '/swapfile'; then
  sudo fallocate -l 4G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
else
  echo "swapfile already present, skipping"
fi

log "Node 24 (matches .nvmrc)"
if ! command -v node >/dev/null || [[ "$(node -v)" != v24.* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node -v

log "pnpm via corepack (version pinned by package.json)"
sudo corepack enable
corepack prepare pnpm@9.15.9 --activate
pnpm -v

log "Docker Engine + compose plugin"
if ! command -v docker >/dev/null; then
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  sudo apt-get update -y
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  sudo usermod -aG docker "$USER"
  echo "NOTE: log out and back in (or run 'newgrp docker') before using docker without sudo."
fi

log "nginx + certbot"
sudo apt-get install -y nginx certbot python3-certbot-nginx
sudo systemctl enable --now nginx

log "Host firewall — SSH and HTTP(S) only"
# The AWS security group is the real gate; ufw is the second lock, and it is
# what stops 5432/9000 being reachable if the security group is ever widened.
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
sudo ufw status verbose

log "Done. Next: deploy/README.md step 4 (write .env)."
