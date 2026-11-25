# פריסה ב־Tokay — תמיד דולק, חינם, בלי כרטיס אשראי

Tokay נותנת **Free workspace קבוע** (לא trial, בלי כרטיס): 2 vCPU, 2.5 GB RAM, 20 GB storage.
ה־VM תמיד דולק, אין שינה, אין צורך בפינגר.

## שלב 1 — חשבון

1. היכנסו ל־https://tokay.io → **Sign Up** (חינמי, בלי כרטיס).
2. צרו Workspace חדש — הוא יהיה ה־FreeWorkspace היחיד שלכם.

## שלב 2 — הוספת הקוד

1. **Add code** → **GitHub**.
2. פעם ראשונה: **Install GitHub App** (או **Use your GitHub account** אם אי אפשר להתקין אפליקציה).
3. בחרו את החשבון `yarinfgfg-ship-it` ואת הריפו **BOTS**.
4. Tokay תזהה Node.js ותציע סוג שירות. בחרו **Web Service** (כדי לקבל כתובת ל־`/health`) או **Background Worker** (אם רוצים רק את הבוט).
5. והגדירו:

| שדה | ערך |
| --- | --- |
| Runtime | Node.js 20 (או 24) |
| Start command | `npm start` |
| Branch | `main` |

## שלב 3 — משתנים (Environment / Secrets)

ב־**Service Environment** הוסיפו:

| מפתח | סוג | ערך |
| --- | --- | --- |
| `DISCORD_TOKEN` | **Secret** | טוקן הבוט (מה־Render) |
| `CLIENT_ID` | Config | `1572355509502218270` |
| `BOT_OWNER_IDS` | Config | `1090650042030899262` |
| `ENABLE_MEMBERS_INTENT` | Config | `true` |
| `WELCOME_TIMEZONE` | Config | `Asia/Jerusalem` (אופציונלי — שעון בכרטיס הברכה) |
| `AUTO_DEPLOY_COMMANDS` | Config | `true` |
| `GUILDS_JSON` | Secret | תוכן `guilds.json` מ־Render |
| `ADMIN_ROLE_IDS` | Config | **אופציונלי** — מזהי רולי אדמין לטיקטים, מופרדים בפסיקים (או `/ticket-admin-role add`) |
| `GIVEAWAYS_JSON` | Secret | תוכן `giveaways.json` (אם יש) |
| `SUGGESTIONS_JSON` | Secret | תוכן `suggestions.json` (אם יש) |
| `CLIENT_SECRET` | Secret | **אופציונלי** |
| `REDIRECT_URI` | Config | **אופציונלי** — רק אם משתמשים ב־`/auth-*` |

**אל תדביקו את הטוקן בצ׳אט או בריפו** — רק בשדה Secret ב־Tokay.

## שלב 4 — אחסון נתונים

ב־**Persistent Storage** של השירות הוסיפו את התיקייה `/tokay/data`.
הקוד כבר מזהה אוטומטית את `TOKAY_DATA_DIR` ושומר שם את כל ה־JSON (`guilds`, `levels`, `giveaways`, `suggestions`, `tickets`, `profiles`, `oauth`).
אם אתם מגדירים `DATA_DIR` מפורשת, שימו אותה לאותה תיקייה.

## שלב 5 — העברה מ־Render

1. **השביתו (Suspend) את שירות Render** — אחרת שני מופעים יתחברו לדיסקורד ויתקשו.
2. פרסמו (Deploy) ב־Tokay.
3. בלוגים חפשו:
   ```
   [seed] data dir: /tokay/data
   ✅ Logged in as TicketFlow#9810
   ```
4. אם בחרתם Web Service, פתחו את הכתובת ש־Tokay נתנה + `/health` → `ok`, ו־`/version` → `visual-v30-2026-11-25`.

## אחרי המעבר

אם משתמשים ב־OAuth (`/auth-*`), עדכנו בדיסקורד:
https://discord.com/developers/applications/1572355509502218270/oauth2
↳ **Redirects** ← `https://<הכתובת-של-tokay>/callback`

אם לא משתמשים ב־`/auth-*` — אפשר להתעלם.
