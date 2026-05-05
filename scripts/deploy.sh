#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# SplitEase — one-shot deploy script for CloudPanel VPS
#
# What this DOES (automated):
#   • Clones/updates the repo into both site webroots
#   • Installs backend production deps
#   • Generates a strong JWT secret + writes backend .env
#   • Installs frontend deps + builds production bundle
#   • Copies the built bundle into the frontend webroot
#   • Writes/updates an NGINX SPA-fallback include for React Router
#
# What it DOES NOT do (you do these in CloudPanel UI):
#   • Create the two CloudPanel sites
#   • Set the Node.js app startup file + port
#   • Click "Start" on the Node.js app
#   • Issue Let's Encrypt SSL certs
#
# Usage (run as root on the VPS):
#   curl -fsSL https://raw.githubusercontent.com/Salman4675751/SplitEase/main/scripts/deploy.sh | sudo bash
#
# Or with overrides:
#   API_USER=splitease-api APP_USER=splitease-app sudo bash deploy.sh
# ─────────────────────────────────────────────────────────────────────

set -euo pipefail

# ─── Config (override via env vars) ───────────────────────────────
API_DOMAIN="${API_DOMAIN:-api.itcentralpark.com}"
APP_DOMAIN="${APP_DOMAIN:-app.itcentralpark.com}"
REPO_URL="${REPO_URL:-https://github.com/Salman4675751/SplitEase.git}"
SMTP_PASS="${SMTP_PASS:-aaafb6078130da63c49a36e9a24de356}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'
log()  { echo -e "${BLUE}▶${NC} $*"; }
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}!${NC} $*"; }
fail() { echo -e "${RED}✗${NC} $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || fail "Run as root (sudo bash deploy.sh)"

# ─── 1. Find the CloudPanel site users ────────────────────────────
log "Locating CloudPanel site directories"

API_HOME=""
APP_HOME=""
API_USER_DETECTED=""
APP_USER_DETECTED=""

for U in /home/*; do
  [[ -d "$U" ]] || continue
  USER_NAME=$(basename "$U")
  if [[ -d "$U/htdocs/$API_DOMAIN" ]]; then
    API_HOME="$U/htdocs/$API_DOMAIN"
    API_USER_DETECTED="$USER_NAME"
  fi
  if [[ -d "$U/htdocs/$APP_DOMAIN" ]]; then
    APP_HOME="$U/htdocs/$APP_DOMAIN"
    APP_USER_DETECTED="$USER_NAME"
  fi
done

API_USER="${API_USER:-$API_USER_DETECTED}"
APP_USER="${APP_USER:-$APP_USER_DETECTED}"

[[ -n "$API_HOME" ]] || fail "Couldn't find /home/*/htdocs/${API_DOMAIN} — did you create the backend Node.js site in CloudPanel UI yet?"
[[ -n "$APP_HOME" ]] || fail "Couldn't find /home/*/htdocs/${APP_DOMAIN} — did you create the frontend site in CloudPanel UI yet?"

ok "Backend  site: $API_HOME (user: $API_USER)"
ok "Frontend site: $APP_HOME (user: $APP_USER)"

# ─── 2. Verify Node + git available ───────────────────────────────
command -v git    >/dev/null || fail "git not installed — apt install -y git"
command -v node   >/dev/null || fail "node not installed — install Node.js 20 LTS in CloudPanel"
command -v npm    >/dev/null || fail "npm not found"
log "Node $(node -v) · npm $(npm -v) · git $(git --version | awk '{print $3}')"

# Clone/sync helper — works whether target is empty, has CloudPanel
# placeholder files, or is already a checked-out repo. Uses the
# init+fetch+reset pattern so we can safely overwrite vendor placeholders.
clone_or_pull() {
  local target="$1" user="$2"
  if [[ -d "$target/.git" ]]; then
    ok "Repo present — pulling latest into $target"
    sudo -u "$user" git -C "$target" fetch origin main -q
    sudo -u "$user" git -C "$target" reset --hard origin/main
    sudo -u "$user" git -C "$target" clean -fd  # respects .gitignore (won't touch .env)
  else
    ok "Initializing repo in $target (over any placeholder files)"
    sudo -u "$user" bash <<EOF
cd '$target'
git init -q -b main
git remote add origin '$REPO_URL' 2>/dev/null || git remote set-url origin '$REPO_URL'
git fetch origin main -q
git reset --hard origin/main
git clean -fd
EOF
  fi
}

# ─── 3. Backend: clone or pull ────────────────────────────────────
log "Setting up backend in $API_HOME"
clone_or_pull "$API_HOME" "$API_USER"

log "Installing backend production dependencies"
sudo -u "$API_USER" bash -c "cd '$API_HOME/backend' && npm ci --omit=dev --no-audit --no-fund"
ok "Backend deps installed"

# ─── 4. Backend .env (only create if missing — preserves existing) ─
ENV_FILE="$API_HOME/backend/.env"
if [[ -f "$ENV_FILE" ]]; then
  warn "$ENV_FILE already exists — leaving untouched"
else
  log "Generating .env with fresh JWT secret"
  JWT_SECRET=$(openssl rand -hex 64)
  cat > "$ENV_FILE" <<EOF
PORT=5000
NODE_ENV=production
MONGODB_URI=mongodb://localhost:27017/splitwise
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d
CLIENT_URL=https://$APP_DOMAIN
SMTP_HOST=live.smtp.mailtrap.io
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=api
SMTP_PASS=$SMTP_PASS
MAIL_FROM="SplitEase <no-reply@itcentralpark.com>"
EOF
  chown "$API_USER:$API_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  ok ".env created (chmod 600, owned by $API_USER)"
fi

# ─── 5. Frontend: clone or pull ───────────────────────────────────
log "Setting up frontend in $APP_HOME"
clone_or_pull "$APP_HOME" "$APP_USER"

log "Writing frontend production .env"
sudo -u "$APP_USER" bash -c "echo 'VITE_API_URL=https://$API_DOMAIN/api' > '$APP_HOME/frontend/.env.production'"

log "Installing frontend dependencies (this takes 1-2 minutes)"
sudo -u "$APP_USER" bash -c "cd '$APP_HOME/frontend' && npm ci --no-audit --no-fund"
ok "Frontend deps installed"

log "Building frontend production bundle"
sudo -u "$APP_USER" bash -c "cd '$APP_HOME/frontend' && npm run build"
ok "Build complete"

# ─── 6. Deploy built files ────────────────────────────────────────
log "Copying dist/ → $APP_HOME"
# Clean old assets but keep node_modules + git + frontend/ + backend/
sudo -u "$APP_USER" bash <<EOF
shopt -s extglob
cd '$APP_HOME'
# Remove previously deployed files (everything except source dirs we keep)
rm -rf assets index.html favicon.svg vite.svg robots.txt 2>/dev/null || true
cp -r frontend/dist/* '$APP_HOME/'
EOF
ok "Built files deployed"

# ─── 7. Restart the running backend so new code is actually executed ─
# Without this, deploy.sh updates the source on disk but the live Node
# process keeps running yesterday's code. PM2 is what supervises it.
if command -v pm2 >/dev/null 2>&1 && sudo -u "$API_USER" pm2 jlist 2>/dev/null | grep -q "splitease-api"; then
  log "Restarting PM2 process splitease-api"
  sudo -u "$API_USER" pm2 restart splitease-api --update-env
  sleep 2
  HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/health || echo "000")
  if [[ "$HEALTH" == "200" ]]; then
    ok "Backend restarted and healthy (200 from /api/health)"
  else
    warn "Backend restarted but health check returned HTTP $HEALTH — check 'pm2 logs splitease-api'"
  fi
else
  warn "PM2 process splitease-api not found — start it manually:"
  warn "  sudo -u $API_USER pm2 start $API_HOME/backend/server.js --name splitease-api --cwd $API_HOME/backend"
fi

# ─── 8. Summary + manual steps ────────────────────────────────────
echo
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✓ Code deployed + backend restarted                     ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo
echo "BACKEND  (api.itcentralpark.com)"
echo "  1. CloudPanel → $API_DOMAIN site → Settings"
echo "  2. App Startup file:  backend/server.js"
echo "     (or Command: node backend/server.js)"
echo "  3. App Port: 5000"
echo "  4. Click Save → Start (or Restart)"
echo "  5. SSL/TLS → Let's Encrypt → Issue"
echo
echo "FRONTEND ($APP_DOMAIN)"
echo "  1. CloudPanel → $APP_DOMAIN site → Vhost"
echo "  2. Inside server { ... } add this block:"
echo
echo '         location / {'
echo '             try_files \$uri \$uri/ /index.html;'
echo '         }'
echo
echo '         location ~* \.(js|css|svg|png|jpg|jpeg|gif|webp|woff2|ico)$ {'
echo '             expires 1y;'
echo '             add_header Cache-Control "public, immutable";'
echo '         }'
echo
echo "  3. Save (CloudPanel auto-reloads NGINX)"
echo "  4. SSL/TLS → Let's Encrypt → Issue"
echo
echo "VERIFY"
echo "  curl -s http://localhost:5000/api/health   # → {\"status\":\"ok\"}"
echo "  Open https://$APP_DOMAIN in your browser"
echo
