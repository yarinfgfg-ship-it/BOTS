# Discord Ticket Bot

A clean ticket bot built with **discord.js v14**. It posts a ticket panel, creates private ticket channels, supports claiming/closing, saves transcripts, and — as requested — **does not show the server name anywhere** (the footer shows only the timestamp).

## Features

- `/ticket-setup` — posts the ticket panel embed with a **Create Ticket** button
- Creates a private `ticket-0042` channel inside your configured category
- **Claim Ticket** button for support staff
- **Close Ticket** button with confirmation
- Transcript saved to a log channel (optional)
- DM to the user when their ticket is closed
- All text, colors, and button labels editable in [`config.js`](./config.js)

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure**
   ```bash
   copy .env.example .env
   ```
   Open `.env` and fill in:
   - `DISCORD_TOKEN` — bot token from the Discord Developer Portal
   - `CLIENT_ID` — your application's client ID
   - `GUILD_ID` — your test server ID (optional, faster command registration)
   - `TICKET_CATEGORY_ID` — category where ticket channels go
   - `SUPPORT_ROLE_IDS` — comma-separated staff role IDs
   - `LOG_CHANNEL_ID` — optional transcript log channel

   > To get IDs: enable **Developer Mode** in Discord → right-click a category/role/channel → **Copy ID**.

3. **Invite the bot**
   ```bash
   npm run invite
   ```
   Open the printed link in your browser and choose your server. It already includes all needed scopes (`bot`, `applications.commands`) and permissions.

4. **Register slash commands**
   ```bash
   npm run deploy
   ```

5. **Start the bot**
   ```bash
   npm start
   ```

6. In your server, run `/ticket-setup` in the channel where you want the panel.

## Customizing the look

Open [`config.js`](./config.js). Every embed title, description, button label, color, and footer lives there.

Placeholders you can use in any text field:

| Placeholder | Meaning |
| --- | --- |
| `{number}` | Ticket number, e.g. `0042` |
| `{user}` | Mentions the ticket creator |
| `{username}` | Creator's plain username |
| `{staff}` | Mentions the staff member |
| `{count}` | Open ticket count |
| `{date}` | `4.11.2026` |
| `{time}` | `16:57` |
| `{timestamp}` | `4.11.2026 - 16:57` |
| `{channel}` | Ticket channel mention |

By default the ticket footer is generated from `{timestamp}` only:

```text
4.11.2026 - 16:57
```

If you want extra footer text, put it in `ticket.footerText` and it will be joined like:

```text
Your text - 4.11.2026 - 16:57
```

There is deliberately **no server-name placeholder** — nothing in this bot reads `interaction.guild.name`.

## Verification

Create a channel for verification, then run inside it:

```
/verify-setup
/verify-role role:@מאומת      ← optional; a "מאומת" role is created automatically
```

The panel has **one button — verify**. It gives the member the verified role (once) and saves a profile snapshot (username, display name, avatar, banner) to `profiles.json`. View with `/verify-profiles`.

Settings are per server in `guilds.json`.

### Adding verified users to a server as members (`/verify-add`)

This uses OAuth2 `guilds.join` so it also adds people who are **not currently in the server**.

One-time setup:
1. Developer Portal → OAuth2 → add redirect URL `http://localhost:3000/callback` (must match `.env` exactly).
2. Developer Portal → OAuth2 → copy **Client Secret** into `CLIENT_SECRET` in `.env`.
3. Restart the bot. It logs `[oauth] Callback server ready at ...`.

Then members click **verify**; the confirmation includes an "אשר גישה" link. After they authorize, run:

```
/verify-add                 ← current server
/verify-add guild:1559952474276630559   ← a specific server the bot is in
```

Tokens are stored in `oauth.json` and refreshed automatically. The report shows added / already-present / failed / skipped counts. The target server's verified role is applied too, if configured there.

### Broadcast to everyone

```
/broadcast message:הודעה לכל החברים
```

DMs every non-bot member of the server (skips users with DMs off, capped at 500). Support roles only.

If the member list looks incomplete, enable **Server Members Intent** in Developer Portal → Bot → Privileged Gateway Intents, then add `ENABLE_MEMBERS_INTENT=true` to `.env` and restart.

The bot needs **Manage Roles** permission, and the verified role must be **below** the bot's highest role. Re-invite with:

```
https://discord.com/oauth2/authorize?client_id=1572355509502218270&permissions=268561488&scope=bot%20applications.commands
```

## Commands & buttons

| Action | Who can use it |
| --- | --- |
| `/verify-setup` | Manage Channels — post the verification panel |
| `/verify-role role:@role` | Manage Server — set the verified role (auto-created if omitted) |
| `/verify-profiles` | Support roles — saved usernames, avatars, banners |
| `/verify-add guild:...` | Manage Server / support — add all authorized users as members via OAuth2 |
| `/broadcast message:...` | Support roles — DM every server member |
| `/ticket-setup` | Manage Channels permission |
| `/ticket-config log:#channel` | Manage Server — per-server log channel |
| `/ticket-roles add / remove / list` | Manage Server — unlimited support roles per server |
| `/ticket-panel title:... description:...` | Manage Server — edit the button panel (standalone alias) |
| `/ticket-message panel / ticket / welcome / preview / reset` | Manage Server — per-server text editing |
| `/ticket-category add / remove / list` | Manage Server — per-server dropdown categories |
| `/ticket-image set / url / remove / preview` | Manage Server — per-server banner image |
| `/ticket-edit title:... description:...` | Support roles — edit only the current ticket |
| `/open-tickets` | Support roles — list open tickets |
| Create Ticket button | Everyone who can see the panel |
| Claim / Rename / Close buttons | Support roles / Manage Channels |

### Editing messages live (per server)

```
/ticket-message panel title:כותרת לפאנל description:תיאור לפאנל
/ticket-message ticket title:כותרת חדשה description:תיאור חדש
/ticket-message welcome text:ברוכים הבאים! ...
/ticket-message preview
/ticket-message reset
```

`panel` — or the standalone `/ticket-panel title:... description:...` — edits the message with the **פתיחת טיקט** button, instantly in every panel. `INSTANT_GUILD_IDS` in `.env` makes command updates appear immediately in those servers.

Changes to `ticket` are applied **immediately** to every open ticket, and again whenever the bot restarts.

### Editing one ticket only

Run this **inside** the ticket channel:

```
/ticket-edit title:כותרת מיוחדת description:תיאור מיוחד
/ticket-edit reset:true          ← back to server defaults
```

Only support roles can use it. Per-ticket overrides beat the server defaults, survive a claim, and are removed when the ticket is closed. Stored in `tickets.json`.

### Image per server

```
/ticket-image set image:@banner.png     ← upload a file
/ticket-image url link:https://...      ← or use a link
/ticket-image preview
/ticket-image remove
```

The image is applied immediately to all open ticket embeds and to all bot panels, and is included in new tickets. `reset` also clears it.

### Categories per server

```
/ticket-category add name:"🐛 דיווח באג" description:"דיווח על תקלה" category:#באגים
/ticket-category list
/ticket-category remove value:דיווח-באג
```

If you don't pass a Discord `category:`, one is created automatically with the option's name.

Placeholders `{number}`, `{user}`, `{username}`, `{date}`, `{time}`, `{timestamp}` work in these texts too. Settings are stored in `guilds.json`.
