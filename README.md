# 🤖 שומר הקהילה — Discord Bot

One bot with everything: tickets, one-click verify, join role, welcome messages, owner tools, and text beautifying.

## ✨ Features

- 🎫 **Tickets** — panel button, private channels, claim/rename/close, inactivity auto-close with warning, post-close star rating, per-server settings
- ✅ **Verify** — one click grants the verified role and removes the "unverified" join role (no OAuth/site), optional minimum account age, audit log, `/reverify`
- 👋 **Welcome** — Hebrew join message with the member's large avatar + member count
- 🛠️ **Owner tools** — `/dm`, `/alert`, `/join-server`, `/auth-*`
- 💅 **Beautify** — `/beautify` / `/betifuel` turns plain text into a nice Discord message
- 🛡️ **AutoMod** — blocks links in every chat (deletes + 1-minute timeout), filters NSFW media/keywords; staff are exempt
- 🎁 **Giveaways** — `/giveaway` with entry button, timer, multiple winners, winner DMs, cancel, reroll that excludes previous winners, restart-safe storage, and a generated 16:9 winner card with the winner's avatar + text baked in
- 💡 **Suggestions & Polls** — richer suggestion/poll cards, a time picker, auto-decide for suggestions, and `/staff-hide` to hide staff commands from regular members
- 🎨 **Canvas image cards** — generated welcome image, `/rank` profile card, level-up card, and a podium `/leaderboard` image (Hebrew text baked in, avatars included)
- 📈 **XP & coins** — earned from messages with a cooldown, saved in `levels.json`; powers the profile and leaderboard cards (no Message Content Intent needed)
- 📦 **Sellable products** — 7 standalone bots in `bots/`

## 🚀 Run locally

```bash
npm install
copy .env.example .env   # fill DISCORD_TOKEN, CLIENT_ID, etc.
npm run deploy
npm start
```

## 🛡️ AutoMod setup
The bot creates Discord-native AutoMod rules on startup — no Message Content Intent needed. It needs **Manage Server** permission to create rules, so re-invite it with `npm run invite` (or grant that permission to its role). Edit the rule names, link regexes, timeout, and NSFW keyword list in `config.js` → `moderation`.

For AI scanning of explicit images/GIFs with no text, also enable Discord’s built-in **Server Settings → Safety Setup → AutoMod → Block explicit content**.

## ☁️ Run 24/7 for free (no credit card)

**Recommended: Tokay** — permanent free workspace, no card, no sleeping — **[DEPLOY-TOKAY.md](DEPLOY-TOKAY.md)**. Other options: **[DEPLOY-ALWAYS-ON.md](DEPLOY-ALWAYS-ON.md)**

Render Free is also possible but it sleeps after 15 minutes idle, so it needs an external monitor — **[DEPLOY-FREE.md](DEPLOY-FREE.md)**. GitHub Actions schedules are not reliable for this and should not be used as the pinger.

Short version:
1. Push this repo to GitHub (already done here).
2. Render → **New Web Service** → this repo → **Free** → `/health`.
3. Add env vars (`DISCORD_TOKEN`, `CLIENT_ID`, `CLIENT_SECRET`, `REDIRECT_URI`, `BOT_OWNER_IDS`, `ENABLE_MEMBERS_INTENT=true`, `AUTO_DEPLOY_COMMANDS=true`, `GUILDS_JSON`).
4. Discord Portal → OAuth2 Redirects → `https://bots-xinz.onrender.com/callback`.
5. UptimeRobot → ping `/health` every 5 minutes so Render doesn't sleep.

## 📁 Structure

```
index.js              main combined bot
config.js             all texts (edit without touching code)
src/deploy-commands.js slash command registration
src/store.js          persistent JSON storage (DATA_DIR)
src/seedEnv.js        creates data dir + seeds JSON from env on any host
bots/                 7 standalone sellable bots
DEPLOY-TOKAY.md       recommended free 24/7 hosting guide
DEPLOY-FREE.md        Render free hosting guide (needs a pinger)
Dockerfile            cloud deployment
render.yaml           Render free service config
```

## 🔧 Useful commands

| Command | What it does |
| --- | --- |
| `/ticket-setup` | Post the ticket panel |
| `/ticket-autoclose minutes:60 warn:5` | Auto-close idle tickets (0 = off) |
| `/verify-setup` | Post the verify panel |
| `/verify-role role:@role` | Choose the verified role |
| `/verify-minage days:7` | Minimum account age to verify (0 = off) |
| `/verify-log channel:#channel` | Verify audit-log channel |
| `/reverify user:@member` | Re-verify a member and refresh the profile |
| `/join-role role:@role` | Role given on join, removed on verify |
| `/welcome-setup` | Set welcome channel |
| `/test` | Preview the welcome embed |
| `/beautify text:...` | Beautify text |
| `/dm`, `/alert`, `/join-server` | Owner-only tools |
