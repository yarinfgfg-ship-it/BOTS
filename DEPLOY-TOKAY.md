# ×¤×¨×™×¡×” ×‘Ö¾Tokay â€” ×ª×ž×™×“ ×“×•×œ×§, ×—×™× ×, ×‘×œ×™ ×›×¨×˜×™×¡ ××©×¨××™

Tokay × ×•×ª× ×ª **Free workspace ×§×‘×•×¢** (×œ× trial, ×‘×œ×™ ×›×¨×˜×™×¡): 2 vCPU, 2.5 GB RAM, 20 GB storage.
×”Ö¾VM ×ª×ž×™×“ ×“×•×œ×§, ××™×Ÿ ×©×™× ×”, ××™×Ÿ ×¦×•×¨×š ×‘×¤×™× ×’×¨.

## ×©×œ×‘ 1 â€” ×—×©×‘×•×Ÿ

1. ×”×™×›× ×¡×• ×œÖ¾https://tokay.io â†’ **Sign Up** (×—×™× ×ž×™, ×‘×œ×™ ×›×¨×˜×™×¡).
2. ×¦×¨×• Workspace ×—×“×© â€” ×”×•× ×™×”×™×” ×”Ö¾FreeWorkspace ×”×™×—×™×“ ×©×œ×›×.

## ×©×œ×‘ 2 â€” ×”×•×¡×¤×ª ×”×§×•×“

1. **Add code** â†’ **GitHub**.
2. ×¤×¢× ×¨××©×•× ×”: **Install GitHub App** (××• **Use your GitHub account** ×× ××™ ××¤×©×¨ ×œ×”×ª×§×™×Ÿ ××¤×œ×™×§×¦×™×”).
3. ×‘×—×¨×• ××ª ×”×—×©×‘×•×Ÿ `yarinfgfg-ship-it` ×•××ª ×”×¨×™×¤×• **BOTS**.
4. Tokay ×ª×–×”×” Node.js ×•×ª×¦×™×¢ ×¡×•×’ ×©×™×¨×•×ª. ×‘×—×¨×• **Web Service** (×›×“×™ ×œ×§×‘×œ ×›×ª×•×‘×ª ×œÖ¾`/health`) ××• **Background Worker** (×× ×¨×•×¦×™× ×¨×§ ××ª ×”×‘×•×˜).
5. ×•×”×’×“×™×¨×•:

| ×©×“×” | ×¢×¨×š |
| --- | --- |
| Runtime | Node.js 20 (××• 24) |
| Start command | `npm start` |
| Branch | `main` |

## ×©×œ×‘ 3 â€” ×ž×©×ª× ×™× (Environment / Secrets)

×‘Ö¾**Service Environment** ×”×•×¡×™×¤×•:

| ×ž×¤×ª×— | ×¡×•×’ | ×¢×¨×š |
| --- | --- | --- |
| `DISCORD_TOKEN` | **Secret** | ×˜×•×§×Ÿ ×”×‘×•×˜ (×ž×”Ö¾Render) |
| `CLIENT_ID` | Config | `1572355509502218270` |
| `BOT_OWNER_IDS` | Config | `1090650042030899262` |
| `ENABLE_MEMBERS_INTENT` | Config | `true` |
| `WELCOME_TIMEZONE` | Config | `Asia/Jerusalem` (××•×¤×¦×™×•× ×œ×™ â€” ×©×¢×•×Ÿ ×‘×›×¨×˜×™×¡ ×”×‘×¨×›×”) |
| `AUTO_DEPLOY_COMMANDS` | Config | `true` |
| `GUILDS_JSON` | Secret | ×ª×•×›×Ÿ `guilds.json` ×žÖ¾Render |
| `ADMIN_ROLE_IDS` | Config | **××•×¤×¦×™×•× ×œ×™** â€” ×ž×–×”×™ ×¨×•×œ×™ ××“×ž×™×Ÿ ×œ×˜×™×§×˜×™×, ×ž×•×¤×¨×“×™× ×‘×¤×¡×™×§×™× (××• `/ticket-admin-role add`) |
| `GIVEAWAYS_JSON` | Secret | ×ª×•×›×Ÿ `giveaways.json` (×× ×™×©) |
| `SUGGESTIONS_JSON` | Secret | ×ª×•×›×Ÿ `suggestions.json` (×× ×™×©) |
| `CLIENT_SECRET` | Secret | **××•×¤×¦×™×•× ×œ×™** |
| `REDIRECT_URI` | Config | **××•×¤×¦×™×•× ×œ×™** â€” ×¨×§ ×× ×ž×©×ª×ž×©×™× ×‘Ö¾`/auth-*` |

**××œ ×ª×“×‘×™×§×• ××ª ×”×˜×•×§×Ÿ ×‘×¦×³××˜ ××• ×‘×¨×™×¤×•** â€” ×¨×§ ×‘×©×“×” Secret ×‘Ö¾Tokay.

## ×©×œ×‘ 4 â€” ××—×¡×•×Ÿ × ×ª×•× ×™×

×‘Ö¾**Persistent Storage** ×©×œ ×”×©×™×¨×•×ª ×”×•×¡×™×¤×• ××ª ×”×ª×™×§×™×™×” `/tokay/data`.
×”×§×•×“ ×›×‘×¨ ×ž×–×”×” ××•×˜×•×ž×˜×™×ª ××ª `TOKAY_DATA_DIR` ×•×©×•×ž×¨ ×©× ××ª ×›×œ ×”Ö¾JSON (`guilds`, `levels`, `giveaways`, `suggestions`, `tickets`, `profiles`, `oauth`).
×× ××ª× ×ž×’×“×™×¨×™× `DATA_DIR` ×ž×¤×•×¨×©×ª, ×©×™×ž×• ××•×ª×” ×œ××•×ª×” ×ª×™×§×™×™×”.

## ×©×œ×‘ 5 â€” ×”×¢×‘×¨×” ×žÖ¾Render

1. **×”×©×‘×™×ª×• (Suspend) ××ª ×©×™×¨×•×ª Render** â€” ××—×¨×ª ×©× ×™ ×ž×•×¤×¢×™× ×™×ª×—×‘×¨×• ×œ×“×™×¡×§×•×¨×“ ×•×™×ª×§×©×•.
2. ×¤×¨×¡×ž×• (Deploy) ×‘Ö¾Tokay.
3. ×‘×œ×•×’×™× ×—×¤×©×•:
   ```
   [seed] data dir: /tokay/data
   âœ… Logged in as TicketFlow#9810
   ```
4. ×× ×‘×—×¨×ª× Web Service, ×¤×ª×—×• ××ª ×”×›×ª×•×‘×ª ×©Ö¾Tokay × ×ª× ×” + `/health` â†’ `ok`, ×•Ö¾`/version` â†’ `visual-v22-2026-11-25`.

## ××—×¨×™ ×”×ž×¢×‘×¨

×× ×ž×©×ª×ž×©×™× ×‘Ö¾OAuth (`/auth-*`), ×¢×“×›× ×• ×‘×“×™×¡×§×•×¨×“:
https://discord.com/developers/applications/1572355509502218270/oauth2
â†³ **Redirects** â† `https://<×”×›×ª×•×‘×ª-×©×œ-tokay>/callback`

×× ×œ× ×ž×©×ª×ž×©×™× ×‘Ö¾`/auth-*` â€” ××¤×©×¨ ×œ×”×ª×¢×œ×.

