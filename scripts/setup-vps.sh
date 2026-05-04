#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# SplitEase — one-shot VPS setup script
#
# Installs MongoDB 7 (locked to localhost) and verifies the install.
# Safe to run on a fresh CloudPanel VPS (Ubuntu 22.04+ / Debian 12).
# Idempotent — re-running won't break things.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Salman4675751/SplitEase/main/scripts/setup-vps.sh | sudo bash
#
# Or download + inspect first (recommended):
#   wget https://raw.githubusercontent.com/Salman4675751/SplitEase/main/scripts/setup-vps.sh
#   less setup-vps.sh
#   sudo bash setup-vps.sh
# ─────────────────────────────────────────────────────────────────────

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${BLUE}▶${NC} $*"; }
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}!${NC} $*"; }
fail() { echo -e "${RED}✗${NC} $*" >&2; exit 1; }

# ─── Sanity checks ─────────────────────────────────────────────────
[[ $EUID -eq 0 ]] || fail "This script must be run as root (sudo bash setup-vps.sh)"

if [[ ! -f /etc/os-release ]]; then
  fail "Cannot detect OS — /etc/os-release missing"
fi
. /etc/os-release
log "Detected: $PRETTY_NAME"

case "$ID" in
  ubuntu|debian) ;;
  *) fail "This script only supports Ubuntu / Debian. Got: $ID" ;;
esac

# ─── 1. System packages ────────────────────────────────────────────
log "Updating package index"
apt-get update -qq
ok "Package index up to date"

log "Installing prerequisites (curl, gnupg, ca-certificates)"
apt-get install -y -qq curl gnupg ca-certificates lsb-release > /dev/null
ok "Prerequisites installed"

# ─── 2. MongoDB 7 ──────────────────────────────────────────────────
if command -v mongod >/dev/null 2>&1 && systemctl is-active --quiet mongod; then
  warn "MongoDB is already installed and running — skipping install"
else
  log "Adding MongoDB 7.0 official APT repository"
  curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc \
    | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor --yes

  CODENAME=$(lsb_release -cs)
  # MongoDB only publishes for jammy on Ubuntu 22.04 etc.
  echo "deb [signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg] https://repo.mongodb.org/apt/${ID} ${CODENAME}/mongodb-org/7.0 multiverse" \
    > /etc/apt/sources.list.d/mongodb-org-7.0.list
  ok "Repo added"

  log "Installing mongodb-org (this may take a minute)"
  apt-get update -qq
  apt-get install -y -qq mongodb-org > /dev/null
  ok "MongoDB installed: $(mongod --version | head -1)"

  log "Enabling + starting mongod service"
  systemctl enable --now mongod
  sleep 2
  ok "mongod service running"
fi

# ─── 3. Lock to localhost (defense in depth) ───────────────────────
if grep -q "bindIp: 127.0.0.1" /etc/mongod.conf; then
  ok "MongoDB already bound to localhost only"
else
  warn "Tightening bindIp to 127.0.0.1 only"
  sed -i 's/^\([[:space:]]*bindIp:\).*/\1 127.0.0.1/' /etc/mongod.conf
  systemctl restart mongod
  sleep 2
  ok "Restarted with localhost-only binding"
fi

# ─── 4. Verification ────────────────────────────────────────────────
log "Verifying MongoDB is reachable"
if mongosh --quiet --eval 'db.runCommand({ ping: 1 }).ok' 2>/dev/null | grep -q '^1$'; then
  ok "Ping succeeded — MongoDB is healthy"
else
  fail "MongoDB ping failed — check 'systemctl status mongod' and 'journalctl -u mongod -n 50'"
fi

PORT_OPEN=$(ss -ltn | awk '{print $4}' | grep -c ':27017$' || true)
if [[ "$PORT_OPEN" -gt 0 ]]; then
  ok "Port 27017 listening (localhost)"
fi

EXTERNAL=$(ss -ltn | awk '{print $4}' | grep ':27017$' | grep -v '^127' || true)
if [[ -n "$EXTERNAL" ]]; then
  warn "MongoDB is listening on a non-localhost address: $EXTERNAL"
  warn "Check /etc/mongod.conf 'net.bindIp' setting"
else
  ok "Port 27017 not exposed externally — good"
fi

# ─── 5. Summary ─────────────────────────────────────────────────────
echo
echo -e "${GREEN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✓ SplitEase VPS setup complete               ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════╝${NC}"
echo
echo "MongoDB connection string for your backend .env:"
echo
echo "    MONGODB_URI=mongodb://localhost:27017/splitwise"
echo
echo "Next steps:"
echo "  1. Create the 'api.<your-domain>' Node.js site in CloudPanel"
echo "  2. SSH as the site user, clone the repo, and configure .env"
echo "  3. See DEPLOYMENT.md in the repo for the full walkthrough"
echo
