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

5. לחצו **Create Web Service** וחכו לבנייה (כמה דקות).
6. כשהסטטוס יהיה **Live**, פתחו:
   ```
   https://bots-xinzon.onrender.com/health
   ```
   צריך לחזור `ok`.

---

## שלב 3 — עדכון ה־Redirect URI בדיסקורד

1. https://discord.com/developers/applications/1572355509502218270/oauth2
2. תחת **Redirects**, הוסיפו בדיוק:
   ```
   https://bots-xinzon.onrender.com/callback
   ```
3. **Save Changes**.
4. מחקו את הישן (כתובת ה־Cloudflare tunnel) אם הוא כבר לא פעיל.

---

## שלב 4 — UptimeRobot (שומר מהשינה)

1. צרו חשבון חינמי ב־https://uptimerobot.com
2. **Add New Monitor**:
   - Monitor Type: **HTTP(s)**
   - Friendly Name: `Shomer Havoda`
   - URL: `https://bots-xinzon.onrender.com/health`
   - Monitoring Interval: **5 minutes** (מותר בחינם)
3. שמרו. מעכשיו הבוט יישאר ער.

---

## מה שומר ומה לא

- ✅ `guilds.json` נשמר דרך משתנה `GUILDS_JSON` — ההגדרות בשרת יישארו גם אחרי ריסטארט.
- ✅ פקודות ה־slash נרשמות אוטומטית בכל הפעלה (`AUTO_DEPLOY_COMMANDS`).
- ⚠️ `oauth.json` (טוקנים של משתמשים) יכול להיפסק אחרי ריסטארט — המשתמשים יצטרכו לאשר גישה מחדש. אימות בלחיצה אחת לא מושפע מזה.
- ⚠️ Render Free עלול לקחת 30–60 שניות להתעורר אחרי ריסטארט.

---

## חלופה אם Render לא עובד

אפשר לנסות ספקי אחסון בוטים חינמיים, אבל **אל תנו להם את טוקן הבוט** לפני שבדקתם שהשירות מוכר ואמין. Render הוא ספק מוכר, ולכן מומלץ.
