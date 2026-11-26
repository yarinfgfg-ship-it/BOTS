# איך להריץ את הבוט 24/7 בחינם — בלי כרטיס אשראי

השיטה הכי אמינה בלי תשלום: **Render** (חבילה Free) + **UptimeRobot** (חינם) ששומר על הבוט ער.

> חשוב: Render Free נרדם אחרי 15 דקות בלי תעבורה. ה־`UptimeRobot` שולח בקשה ל־`/health` כל 5 דקות כדי להשאיר אותו ער. הוספתי כבר את נקודת הבדיקה.

---

## שלב 1 — העלאת הפרויקט ל־GitHub

1. צרו חשבון חינמי ב־https://github.com
2. צרו Repository חדש (למשל `shomer-hakkahila`).
3. העלו את כל קבצי הפרויקט **בלי** `node_modules` ובלי `.env` (יש `.gitignore` שעושה את זה).
4. ודאו שיש לכם את הקבצים: `Dockerfile`, `render.yaml`, `docker-entrypoint.sh`, `package.json`.

---

## שלב 2 — פריסה ב־Render

1. כנסו ל־https://render.com והתחברו עם GitHub (אין צורך בכרטיס אשראי).
2. **New + → Web Service** → בחרו את ה־Repository שיצרתם.
3. Render יזהה אוטומטית את ה־Dockerfile.
   - Name: `shomer-hakkahila`
   - Plan: **Free**
   - Health Check Path: `/health`
4. הוסיפו **Environment Variables** (ב־Dashboard, אחרי יצירת השירות):

| מפתח | ערך |
| --- | --- |
| `DISCORD_TOKEN` | הטוקן של הבוט |
| `CLIENT_ID` | מזהה האפליקציה |
| `CLIENT_SECRET` | **אופציונלי** — רק לפקודות `/auth-*`; אפשר להשאיר ריק |
| `REDIRECT_URI` | `https://<שם-השירות-שלך>.onrender.com/callback` — רק אם משתמשים ב־`/auth-*` |
| `BOT_OWNER_IDS` | מזהה המשתמש שלכם |
| `ENABLE_MEMBERS_INTENT` | `true` |
| `AUTO_DEPLOY_COMMANDS` | `true` |
| `GUILDS_JSON` | תוכן קובץ `guilds.json` שלכם (הדביקו כמחרוזת אחת) — שומר על ההגדרות אחרי ריסטארט |
| `GIVEAWAYS_JSON` | **אופציונלי** — תוכן קובץ `giveaways.json` לשחזור הגרלות אחרי ריסטארט (השרת שומר לבד ב־`/app/data`) |
| `SUGGESTIONS_JSON` | **אופציונלי** — תוכן קובץ `suggestions.json` לשחזור הצעות והצבעות אחרי ריסטארט |

5. לחצו **Create Web Service** וחכו לבנייה (כמה דקות).
6. כשהסטטוס יהיה **Live**, פתחו:
   ```
   https://bots-xinz.onrender.com/health
   ```
   צריך לחזור `ok`.

---

## שלב 3 — עדכון ה־Redirect URI בדיסקורד

1. https://discord.com/developers/applications/1572355509502218270/oauth2
2. תחת **Redirects**, הוסיפו בדיוק:
   ```
   https://bots-xinz.onrender.com/callback
   ```
3. **Save Changes**.
4. מחקו את הישן (כתובת ה־Cloudflare tunnel) אם הוא כבר לא פעיל.

---

## שלב 4 — שמירה מהשינה

הריפו כולל עכשיו **שרשרת keep-alive שמתקדמת מעצמה** ב־GitHub Actions:
כל רץ (`keep-alive-long.yml` ו־`keep-alive-long-backup.yml`) פונה ל־`/health` כל 4 דקות כ־5 שעות ו־40 דקות, ואז מזמין את הריצה הבאה ב־`workflow_dispatch` — בלי להסתמך על ה־cron של GitHub, שלפעמים מתעכב שעות. יש גם פינג פנימי כל 4 דקות בתוך התהליך עצמו.

**מומלץ עדיין** להוסיף מוניטור חיצוני עצמאי (שכבה נוספת, בלי קשר ל־GitHub):

1. צרו חשבון חינמי ב־https://uptimerobot.com (בלי כרטיס אשראי).
2. התחברו → **Add New Monitor**:
   - Monitor Type: **HTTP(s)**
   - Friendly Name: `Shomer Havoda`
   - URL: `https://bots-xinz.onrender.com/health`
   - Monitoring Interval: **5 minutes** (מותר בחינם)
3. לחצו **Create Monitor**.
4. תוך כמה דקות המוניטור צריך להיות ירוק (Up).

**חלופה:** https://cron-job.org — חשבון חינמי, מוסיפים Job שפונה לאותה כתובת כל 5 דקות.

**בדיקה:** after 20+ דקות בלי שימוש, פתחו `https://bots-xinz.onrender.com/health`. אם הזמן התגובה הוא מתחת לשנייה — הפינגר עובד. אם לוקח 15–60 שניות — הוא לא עובד.

---

## מה שומר ומה לא

- ✅ `guilds.json` נשמר דרך משתנה `GUILDS_JSON` — ההגדרות בשרת יישארו גם אחרי ריסטארט.
- ✅ פקודות ה־slash נרשמות אוטומטית בכל הפעלה (`AUTO_DEPLOY_COMMANDS`).
- ⚠️ `oauth.json` (טוקנים של משתמשים) יכול להיפסק אחרי ריסטארט — המשתמשים יצטרכו לאשר גישה מחדש. אימות בלחיצה אחת לא מושפע מזה.
- ⚠️ Render Free עלול לקחת 30–60 שניות להתעורר אחרי ריסטארט.

---

## חלופה אם Render לא עובד

אפשר לנסות ספקי אחסון בוטים חינמיים, אבל **אל תנו להם את טוקן הבוט** לפני שבדקתם שהשירות מוכר ואמין. Render הוא ספק מוכר, ולכן מומלץ.
