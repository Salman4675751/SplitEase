#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# SplitEase — one-shot VPS setup script
#
# Installs MongoDB (locked to localhost) and verifies the install.
# Auto-selects MongoDB 8.0 on Ubuntu 24.04 (noble) and 7.0 on older.
# Idempotent — re-running won't break things.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Salman4675751/SplitEase/main/scripts/setup-vps.sh | sudo bash
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

[[ -f /etc/os-release ]] || fail "Cannot detect OS — /etc/os-release missing"
. /etc/os-release
log "Detected: $PRETTY_NAME"

case "$ID" in
  ubuntu|debian) ;;
  *) fail "This script only supports Ubuntu / Debian. Got: $ID" ;;
esac

# ─── 1. Pick MongoDB version based on OS codename ─────────────────
CODENAME=$(lsb_release -cs)
case "$CODENAME" in
  noble)                       # Ubuntu 24.04
    MONGO_VERSION="8.0"
    ;;
  jammy|focal|bionic)          # Ubuntu 22.04 / 20.04 / 18.04
    MONGO_VERSION="7.0"
    ;;
  bookworm|bullseye|buster)    # Debian 12 / 11 / 10
    MONGO_VERSION="7.0"
    ;;
  *)
    warn "Unrecognized codename '$CODENAME' — defaulting to MongoDB 8.0"
    MONGO_VERSION="8.0"
    ;;
esac
ok "Will install MongoDB $MONGO_VERSION (codename: $CODENAME)"

# ─── 2. System packages ────────────────────────────────────────────
log "Updating package index"
apt-get update -qq
ok "Package index up to date"

log "Installing prerequisites"
apt-get install -y -qq curl gnupg ca-certificates lsb-release > /dev/null
ok "Prerequisites installed"

# ─── 3. Clean up any stale MongoDB repo files from previous attempts ─
for STALE in /etc/apt/sources.list.d/mongodb-org-*.list; do
  if [[ -f "$STALE" && "$STALE" != "/etc/apt/sources.list.d/mongodb-org-${MONGO_VERSION}.list" ]]; then
    warn "Removing stale repo: $STALE"
    rm -f "$STALE"
  fi
done
for STALE in /usr/share/keyrings/mongodb-server-*.gpg; do
  if [[ -f "$STALE" && "$STALE" != "/usr/share/keyrings/mongodb-server-${MONGO_VERSION}.gpg" ]]; then
    rm -f "$STALE"
  fi
done

# ─── 4. MongoDB install ────────────────────────────────────────────
if command -v mongod >/dev/null 2>&1 && systemctl is-active --quiet mongod; then
  warn "MongoDB is already installed and running — skipping install"
else
  log "Adding MongoDB ${MONGO_VERSION} official APT repository"
  curl -fsSL "https://www.mongodb.org/static/pgp/server-${MONGO_VERSION}.asc" \
    | gpg -o "/usr/share/keyrings/mongodb-server-${MONGO_VERSION}.gpg" --dearmor --yes

  echo "deb [signed-by=/usr/share/keyrings/mongodb-server-${MONGO_VERSION}.gpg] https://repo.mongodb.org/apt/${ID} ${CODENAME}/mongodb-org/${MONGO_VERSION} multiverse" \
    > "/etc/apt/sources.list.d/mongodb-org-${MONGO_VERSION}.list"
  ok "Repo added"

  log "Installing mongodb-org (this may take a minute)"
  apt-get update -qq
  apt-get install -y -qq mongodb-org > /dev/null
  ok "MongoDB installed: $(mongod --version | head -1)"

  log "Enabling + starting mongod service"
  systemctl enable --now mongod
  sleep 3
  ok "mongod service running"
fi

# ─── 5. Lock to localhost ──────────────────────────────────────────
if grep -qE "^\s*bindIp:\s*127\.0\.0\.1\s*$" /etc/mongod.conf; then
  ok "MongoDB already bound to localhost only"
else
  warn "Tightening bindIp to 127.0.0.1 only"
  sed -i 's/^\([[:space:]]*bindIp:\).*/\1 127.0.0.1/' /etc/mongod.conf
  systemctl restart mongod
  sleep 3
  ok "Restarted with localhost-only binding"
fi

# ─── 6. Verification ───────────────────────────────────────────────
log "Verifying MongoDB is reachable"
PING_OK=$(mongosh --quiet --eval 'db.runCommand({ ping: 1 }).ok' 2>/dev/null || true)
if [[ "$PING_OK" == "1" ]]; then
  ok "Ping succeeded — MongoDB is healthy"
else
  fail "MongoDB ping failed — check 'systemctl status mongod' and 'journalctl -u mongod -n 50'"
fi

EXTERNAL=$(ss -ltn | awk '{print $4}' | grep ':27017$' | grep -v '^127' || true)
if [[ -n "$EXTERNAL" ]]; then
  warn "MongoDB is listening on a non-localhost address: $EXTERNAL"
else
  ok "Port 27017 not exposed externally"
fi

# ─── 7. Summary ────────────────────────────────────────────────────
echo
echo -e "${GREEN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✓ SplitEase VPS setup complete                ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════╝${NC}"
echo
echo "MongoDB version: $(mongod --version | head -1)"
echo
echo "Connection string for your backend .env:"
echo "    MONGODB_URI=mongodb://localhost:27017/splitwise"
echo
echo "Next: create the api.<your-domain> Node.js site in CloudPanel,"
echo "      then clone the SplitEase repo into htdocs/<domain>/"
echo "      See DEPLOYMENT.md in the repo for the full walkthrough."
echo
