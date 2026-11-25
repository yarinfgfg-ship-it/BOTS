# מעבר לאחסון תמיד דולק (בלי שינה, בלי כרטיס אשראי)

Render Free נרדם אחרי 15 דקות בלי תעבורה, ולכן הבוט נראה כבוי כשה־PC כבוי.
הפתרון: להעביר את אותו ריפו לספק שמריץ תהליך Node **24/7 בלי מצב שינה**.

## ספק מומלץ: Botkeep

- חינם לצמיתות, **בלי כרטיס אשראי** ובלי חידוש ידני.
- 512 MB RAM, 50% CPU, 1 GB אחסון — מספיק לבוט הזה.
- ייבוא ישיר מ־GitHub, פקודת התחלה `npm start`.
- https://botkeep.cloud → **Start free**.

> חלופות אם אין קיבולת: https://fadehost.com (256 MB, שומר קבצים בין דיפלואים), https://quaxly.com, https://tokay.io.
> בכל ספק כזה **תנו את טוקן הבוט רק דרך Environment Variables**, לעולם לא בקובץ או בצ׳אט.

---

## שלב 1 — להוציא את הערכים מ־Render

ב־Render Dashboard → השירות `bots-xinz` → **Environment**, העתיקו לעצמכם (לא לצ׳אט!) את הערכים של המשתנים האלה:

| מפתח | הערה |
| --- | --- |
| `DISCORD_TOKEN` | טוקן הבוט — סודי ביותר |
| `CLIENT_ID` | מזהה האפליקציה |
| `BOT_OWNER_IDS` | `1090650042030899262` |
| `ENABLE_MEMBERS_INTENT` | `true` |
| `WELCOME_TIMEZONE` | `Asia/Jerusalem` (אופציונלי — שעון בכרטיס הברכה) |
| `AUTO_DEPLOY_COMMANDS` | `true` |
| `GUILDS_JSON` | כל ההגדרות של השרתים — חובה לשמור |
| `ADMIN_ROLE_IDS` | **אופציונלי** — רולי אדמין לטיקטים, מופרדים בפסיקים |
| `GIVEAWAYS_JSON` | מצב הגרלות (אם יש) |
| `SUGGESTIONS_JSON` | מצב הצעות/הצבעות (אם יש) |
| `CLIENT_SECRET` | **אופציונלי** — רק אם משתמשים ב־`/auth-*` |
| `REDIRECT_URI` | **אופציונלי** — רק אם משתמשים ב־`/auth-*` |

`CLIENT_SECRET` אינו נדרש — הבוט וה־`/health` עובדים גם בלעדיו.

---

## שלב 2 — לעצור את Render

לפני ש מפעילים מופע שני, עצרו את השירות ב־Render (**Suspend** או **Delete**).
שני מופעים של אותו בוט מתחברים ל־Discord בו־זמנית וגורמים לניתוקים.

---

## שלב 3 — לפרוס ב־Botkeep

1. הירשמו ב־https://botkeep.cloud (חשבון חינמי, בלי כרטיס).
2. **Start free** → יצירת Workload חדש.
3. בחרו **Import from GitHub**:
   - Repository: `yarinfgfg-ship-it/BOTS`
   - Branch: `main`
   - Start command: `npm start`
   - Runtime: Node.js 20
4. תחת **Environment Variables** הדביקו את כל המשתנים מהטבלה למעלה.
5. שמרו והפעילו (**Start**).

---

## שלב 4 — לוודא שזה עובד

בלוגים של השרת צריך להופיע:

```
[seed] data dir: ...
[oauth] CLIENT_SECRET not set — OAuth callback disabled, health check still active.
✅ Logged in as TicketFlow#9810
```

ואז בדיסקורד: `/rank` או `/leaderboard` צריכים להגיב מיד, גם אחרי שעה בלי פעילות.

אם הספק נותן כתובת ציבורית, בדקו `/health` → `ok` ו־`/version` → `visual-v29-2026-11-25`.

---

## שמירת נתונים

הבוט שומר את ה־JSON תחת `data/` (או מה ש־`DATA_DIR` אומר). `src/seedEnv.js` יוצר את התיקייה ומפיל לשם את הערכים מה־env בכל הפעלה.

- אם הספק שומר קבצים בין דיפלואים — הכל נשמר לבד (גם XP ומטבעות).
- אם הספק מנקה קבצים בכל דיפלוי — העבירו את התוכן של `levels.json` למשתנה `LEVELS_JSON`, ואת שאר הקבצים למשתנים המתאימים.
- שינוי הגדרות בשרת נשמר ב־`guilds.json`; אם `GUILDS_JSON` מוגדר, הוא זה שיקבע בכל ריסטארט.

---

## אם משתמשים ב־OAuth (/auth-*)

בכתובת https://discord.com/developers/applications/1572355509502218270/oauth2
מחליפים את ה־Redirect ל־הכתובת החדשה:

```
https://<הכתובת-שלך-בספק-החדש>/callback
```

אם לא משתמשים ב־`/auth-*` — אפשר להתעלם מהשלב הזה.
