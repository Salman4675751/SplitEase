# SplitEase — CloudPanel Deployment Guide

Deploy SplitEase on a VPS running CloudPanel. The whole stack lives on one
server: NGINX (reverse proxy, SSL) + Node.js (API) + MongoDB + static React
frontend. Single $5–10/mo VPS handles dozens of users comfortably.

---

## 0. Prerequisites

- A VPS with **CloudPanel installed** (Ubuntu 22.04+ / Debian 12)
- Two subdomains pointing to the VPS IP via A records, e.g.
  - `app.itcentralpark.com` — frontend
  - `api.itcentralpark.com` — backend API
- SSH access to the VPS

---

## 1. Install MongoDB on the VPS

```bash
ssh root@your-vps-ip

# MongoDB 7 official repo
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

sudo apt update
sudo apt install -y mongodb-org
sudo systemctl enable --now mongod
sudo systemctl status mongod   # should show "active (running)"
```

**Lock MongoDB to localhost only** (default already is). Verify:
```bash
sudo grep bindIp /etc/mongod.conf       # should be 127.0.0.1
```

(Optional but recommended) **Enable auth** for an extra layer:
```bash
mongosh
> use admin
> db.createUser({ user: "splitease", pwd: "<strong-password>", roles: [{ role: "readWrite", db: "splitwise" }] })
> exit

sudo nano /etc/mongod.conf       # add: security: \n  authorization: enabled
sudo systemctl restart mongod
```

If auth is enabled, your `MONGODB_URI` becomes:
`mongodb://splitease:<password>@localhost:27017/splitwise?authSource=admin`

---

## 2. Push your code to the VPS

Easiest path is GitHub → CloudPanel pull:

```bash
# On your machine — push to GitHub first
cd "D:/Users/Administrator/Desktop/Claude Projects/Splitwise"
git init
git add .
git commit -m "Initial deploy"
git remote add origin git@github.com:youruser/splitease.git
git push -u origin main
```

(If GitHub isn't an option, scp the folder up: `scp -r ./Splitwise root@vps:/home/splitease/`)

---

## 3. Create the Backend site in CloudPanel

In the **CloudPanel UI**:

1. **Sites → Add Site → Create a Node.js Site**
2. Domain: `api.itcentralpark.com`
3. Node.js version: **20.x LTS**
4. App port: `5000` (CloudPanel reverse-proxies NGINX → 5000)
5. App user: e.g. `splitease`

Once created, you get an SSH user. Switch to it:
```bash
ssh splitease@your-vps-ip
cd htdocs/api.itcentralpark.com
```

Clone or copy your repo here, then install deps:
```bash
git clone https://github.com/youruser/splitease.git .
cd backend
npm ci --production
```

**Configure `.env` for production:**
```bash
nano .env
```
```
PORT=5000
NODE_ENV=production
MONGODB_URI=mongodb://localhost:27017/splitwise
# (or with auth:)
# MONGODB_URI=mongodb://splitease:STRONGPASS@localhost:27017/splitwise?authSource=admin

JWT_SECRET=<generate with: openssl rand -hex 64>
JWT_EXPIRES_IN=7d

CLIENT_URL=https://app.itcentralpark.com

# Mailtrap production stream (you already have this)
SMTP_HOST=live.smtp.mailtrap.io
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=api
SMTP_PASS=<your-mailtrap-token>
MAIL_FROM="SplitEase <no-reply@itcentralpark.com>"
```

**Tell CloudPanel how to start the app.** In CloudPanel → your Node.js site → **App Configuration**:
- Startup file: `backend/server.js`
- Or use a custom start command: `node backend/server.js`

CloudPanel uses **systemd + PM2 under the hood** to keep it alive on crash and reboot. Click **Start** in the UI.

**Enable SSL**: Site → **SSL/TLS → Let's Encrypt → Issue**. Done in 30 seconds.

Test: visit `https://api.itcentralpark.com/api/health` → should return `{"status":"ok"}`.

---

## 4. Create the Frontend site in CloudPanel

The frontend is a static SPA — built once, served by NGINX. No Node process needed.

1. **Sites → Add Site → Create a Static Site (PHP-FPM not needed, but the static option works fine)**
2. Domain: `app.itcentralpark.com`
3. App user: `splitease` (same user, separate site dir)

On the VPS:
```bash
ssh splitease@your-vps-ip
cd htdocs/app.itcentralpark.com

git clone https://github.com/youruser/splitease.git .
cd frontend

# Set the production API URL
echo "VITE_API_URL=https://api.itcentralpark.com/api" > .env.production

npm ci
npm run build

# Deploy the build output to NGINX's webroot
rm -rf ../public/* 2>/dev/null
cp -r dist/* ../    # CloudPanel serves from htdocs/<domain>/
# OR if using a separate webroot:
# cp -r dist/* /home/splitease/htdocs/app.itcentralpark.com/
```

**Add SPA fallback** — React Router needs every URL to serve `index.html`:
In CloudPanel → frontend site → **Vhost** (NGINX config), add inside the `server { ... }` block:
```nginx
location / {
    try_files $uri $uri/ /index.html;
}

# Aggressive caching for hashed assets, none for index.html
location ~* \.(js|css|svg|png|jpg|jpeg|gif|webp|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```
Save → CloudPanel auto-reloads NGINX.

**SSL**: same as backend — Let's Encrypt → Issue.

Visit `https://app.itcentralpark.com` → SplitEase loads, hits the API at `https://api.itcentralpark.com`.

---

## 5. Verification checklist

- [ ] `https://api.itcentralpark.com/api/health` → `{"status":"ok"}`
- [ ] `https://app.itcentralpark.com` → loads the app
- [ ] Register a new account → email arrives via Mailtrap
- [ ] Forgot password flow works (link in email opens reset page)
- [ ] Create a group → add expense → add a comment
- [ ] Logout → log back in → state persists
- [ ] Mobile browser: open `https://app.itcentralpark.com` on your phone

---

## 6. Updating later

Whenever you push new code:

```bash
ssh splitease@your-vps-ip

# Backend update
cd htdocs/api.itcentralpark.com
git pull
cd backend
npm ci --production
# In CloudPanel UI → Restart the Node.js app

# Frontend update
cd ../../htdocs/app.itcentralpark.com
git pull
cd frontend
npm ci
npm run build
cp -r dist/* ../
```

Or write a small `deploy.sh` script that does both.

---

## 7. Hardening (recommended before public launch)

- **MongoDB auth enabled** (step 1, optional path)
- **Strong JWT_SECRET** (`openssl rand -hex 64`)
- **Rate limiting** — add `express-rate-limit` on `/api/auth/*` routes
- **Helmet** — `npm i helmet` + `app.use(helmet())` in `server.js`
- **Backup MongoDB nightly** — CloudPanel has a backup tab, or a simple cron:
  ```bash
  0 3 * * * mongodump --db splitwise --out /home/splitease/backups/$(date +\%F) && find /home/splitease/backups -mtime +14 -exec rm -rf {} +
  ```
- **Sentry** for error tracking (`@sentry/node` on backend, `@sentry/react` on frontend)
- **Plausible / Posthog** for analytics

---

## 8. DNS quick reference

In your DNS provider (Cloudflare, Namecheap, etc.) for `itcentralpark.com`:

| Type | Host | Value |
|---|---|---|
| A | `app` | `<your-vps-ipv4>` |
| A | `api` | `<your-vps-ipv4>` |

Wait 5-10 minutes for propagation, then issue the Let's Encrypt certs in CloudPanel.

---

## Troubleshooting

**Backend won't start** — Check `journalctl -u <cloudpanel-service-name>` or CloudPanel's app logs tab.

**CORS error in browser** — Verify `CLIENT_URL` in backend `.env` matches the exact frontend origin (including https + no trailing slash).

**MongoDB connection refused** — `sudo systemctl status mongod`, check that bind is 127.0.0.1 and the connection string matches.

**Email not delivering** — Mailtrap dashboard shows live sending logs. Verify MAIL_FROM uses your verified domain (`@itcentralpark.com`).
