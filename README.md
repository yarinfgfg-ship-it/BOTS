# 🤖 שומר הקהילה — Discord Bot

One bot with everything: tickets, one-click verify, join role, welcome messages, owner tools, and text beautifying.

## ✨ Features

- 🎫 **Tickets** — panel **category dropdown** (pick a type → ticket opens instantly), private channels, claim/rename/close, inactivity auto-close with warning, post-close star rating, per-server settings
- 🔐 **Ticket admins** — `/ticket-admin list/close/rename` to manage any ticket from anywhere, plus `/ticket-admin-role` to configure which roles can do it
- ✅ **Verify** — one click grants the verified role and removes the "unverified" join role (no OAuth/site), optional minimum account age, audit log, `/reverify`
- 👋 **Welcome** — real Discord text in the message with a real @mention that pings the new member; the member's photo appears as the embed thumbnail at the top right of the message, not inside the image. The image has the editable text, server icon + name, and a banner you choose with `/welcome-card banner`. `/welcome-card preview` shows the exact result
- 🛠️ **Owner tools** — `/dm`, `/alert`, `/join-server`, `/auth-*`
- 💅 **Beautify** — `/beautify` / `/betifuel` turns plain text into a nice Discord message
- 🛡️ **AutoMod** — blocks links in every chat (deletes + 1-minute timeout), filters NSFW media/keywords; staff are exempt
- 🎁 **Giveaways** — `/giveaway` with entry button, timer, multiple winners, winner DMs, cancel, reroll that excludes previous winners, restart-safe storage, and a generated 16:9 winner card with the winner's avatar + text baked in
- 💡 **Suggestions & Polls** — richer suggestion/poll cards, a time picker, auto-decide for suggestions, and `/staff-hide` to hide staff commands from regular members
- 🎨 **Canvas image cards** — generated welcome image, `/rank` profile card, level-up card, podium `/leaderboard`, plus matching branded **ticket and verify panel art** (Hebrew text baked in, avatars included)
- 📈 **XP & coins** — earned from messages with a cooldown, saved in `levels.json`; powers the profile and leaderboard cards (no Message Content Intent needed)
- 📦 **Sellable products** — 7 standalone bots in `bots/`

## 🚀 Run locally

```bash
npm install
copy .env.example .env   # fill DISCORD_TOKEN, CLIENT_ID, etc.
npm run deploy
npm start
```

`npm run deploy` registers one global command set and clears old per-guild copies — this is what prevents every command from appearing twice in Discord.

## 🛡️ AutoMod setup
The bot creates Discord-native AutoMod rules on startup — no Message Content Intent needed. It needs **Manage Server** permission to create rules, so re-invite it with `npm run invite` (or grant that permission to its role). Edit the rule names, link regexes, timeout, and NSFW keyword list in `config.js` → `moderation`.

For AI scanning of explicit images/GIFs with no text, also enable Discord’s built-in **Server Settings → Safety Setup → AutoMod → Block explicit content**.

## ☁️ Run 24/7 for free (no credit card)

**Recommended: Tokay** — permanent free workspace, no card, no sleeping — **[DEPLOY-TOKAY.md](DEPLOY-TOKAY.md)**. Other options: **[DEPLOY-ALWAYS-ON.md](DEPLOY-ALWAYS-ON.md)**

Render Free is also possible but it sleeps after 15 minutes idle, so it needs an external monitor — **[DEPLOY-FREE.md](DEPLOY-FREE.md)**. GitHub Actions schedules are not reliable for this and should not be used as the pinger.

Short version:
1. Push this repo to GitHub (already done here).
2. Render → **New Web Service** → this repo → **Free** → `/health`.
3. Add env vars (`DISCORD_TOKEN`, `CLIENT_ID`, `CLIENT_SECRET`, `REDIRECT_URI`, `BOT_OWNER_IDS`, `ENABLE_MEMBERS_INTENT=true`, `AUTO_DEPLOY_COMMANDS=true`, `GUILDS_JSON`, and optionally `ADMIN_ROLE_IDS`).
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
| `/ticket-category add/list/remove` | Manage ticket categories; remove by number, name or value |
| `/ticket-admin list` | List every open ticket with status, creator and channel name |
| `/ticket-admin close ticket:#channel` | Close any ticket from outside its channel |
| `/ticket-admin rename ticket:#channel name:...` | Rename any ticket channel |
| `/ticket-admin-role add/remove/list role:@role` | Configure admin roles that can use `/ticket-admin` |
| `/verify-setup` | Post the verify panel |
| `/verify-role role:@role` | Choose the verified role |
| `/verify-minage days:7` | Minimum account age to verify (0 = off) |
| `/verify-log channel:#channel` | Verify audit-log channel |
| `/verify-image set/url/remove` | Picture on the verify panel and success message |
| `/reverify user:@member` | Re-verify a member and refresh the profile |
| `/join-role role:@role` | Role given on join, removed on verify |
| `/welcome-setup` | Set welcome channel |
| `/welcome-card text ...` | Edit greeting / hello / line1 / line2 / optional footer; supports `{user}`, `{guild}`, `{count}`, `{date}`; `clear: true` resets |
| `/welcome-card banner upload image:...` | Upload the big banner image for this server |
| `/welcome-card banner url link:...` | Use an image URL as the banner |
| `/welcome-card banner remove` | Remove the banner (member photo is used again) |
| `/welcome-card preview` | Preview the exact card privately |
| `/test` | Preview the welcome embed |
| `/beautify text:...` | Beautify text |
| `/dm`, `/alert`, `/join-server` | Owner-only tools |

Uploaded banners are saved under `DATA_DIR/welcome-banners`, so they survive restarts. `/welcome-card` is visible to members with **Manage Server**.

`/ticket-admin` is shown to members with **Manage Server**; the configured admin roles are checked again in code. Give the admin role Manage Server if you want it to appear in the slash-command menu for those members.
