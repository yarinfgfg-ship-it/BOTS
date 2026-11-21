# 🤖 שומר הקהילה — Discord Bot

One bot with everything: tickets, one-click verify, join role, welcome messages, owner tools, and text beautifying.

## ✨ Features

- 🎫 **Tickets** — panel button, private channels, claim/rename/close, per-server settings
- ✅ **Verify** — one click grants the verified role and removes the "unverified" join role (no OAuth/site)
- 👋 **Welcome** — Hebrew join message with the member's large avatar + member count
- 🛠️ **Owner tools** — `/dm`, `/alert`, `/join-server`, `/auth-*`
- 💅 **Beautify** — `/beautify` / `/betifuel` turns plain text into a nice Discord message
- 📦 **Sellable products** — `bots/tickets`, `bots/verify`, `bots/welcome`, `bots/owner-tools`

## 🚀 Run locally

```bash
npm install
copy .env.example .env   # fill DISCORD_TOKEN, CLIENT_ID, etc.
npm run deploy
npm start
```

## ☁️ Run 24/7 for free (no credit card)

Full guide: **[DEPLOY-FREE.md](DEPLOY-FREE.md)**

Short version:
1. Push this repo to GitHub (already done here).
2. Render → **New Web Service** → this repo → **Free** → `/health`.
3. Add env vars (`DISCORD_TOKEN`, `CLIENT_ID`, `CLIENT_SECRET`, `REDIRECT_URI`, `BOT_OWNER_IDS`, `ENABLE_MEMBERS_INTENT=true`, `AUTO_DEPLOY_COMMANDS=true`, `GUILDS_JSON`).
4. Discord Portal → OAuth2 Redirects → `https://shomer-hakkahila.onrender.com/callback`.
5. UptimeRobot → ping `/health` every 5 minutes so Render doesn't sleep.

## 📁 Structure

```
index.js              main combined bot
config.js             all texts (edit without touching code)
src/deploy-commands.js slash command registration
src/store.js          persistent JSON storage (DATA_DIR)
bots/                 4 standalone sellable bots
DEPLOY-FREE.md        free hosting guide
Dockerfile            cloud deployment
render.yaml           Render free service config
```

## 🔧 Useful commands

| Command | What it does |
| --- | --- |
| `/ticket-setup` | Post the ticket panel |
| `/verify-setup` | Post the verify panel |
| `/verify-role role:@role` | Choose the verified role |
| `/join-role role:@role` | Role given on join, removed on verify |
| `/welcome-setup` | Set welcome channel |
| `/test` | Preview the welcome embed |
| `/beautify text:...` | Beautify text |
| `/dm`, `/alert`, `/join-server` | Owner-only tools |
