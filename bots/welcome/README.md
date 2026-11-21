# 👋 ש.ה Welcome — בוט ברוכים הבאים

הודעת קבלה בעברית עם **תמונת הפרופיל הגדולה** של החבר החדש ומספר החברים בשרת.

---

## איך להתקין על השרת שלך — שלבים

### שלב 1 — יצירת הבוט ב־Discord
1. https://discord.com/developers/applications
2. **New Application** → שם (למשל `WelcomeWave`) → **Create**.
3. **Bot** → **Add Bot** → **Reset Token** → העתיקו את הטוקן.

### שלב 2 — אינטנט חובה
בדף **Bot** → **Privileged Gateway Intents**:
- הפעילו **Server Members Intent**
- **Save Changes**

> בלי זה הבוט לא יודע שמישהו הצטרף ולא ישלח ברכה.

### שלב 3 — הרשאות והזמנה
1. **OAuth2 → URL Generator**.
2. **Scopes**: `bot` + `applications.commands`.
3. **Bot Permissions**: View Channels, Send Messages, Embed Links, Read Message History.
4. פתחו את הקישור → בחרו שרת → **Authorize**.

> ודאו שלבוט יש הרשאה לכתוב בערוץ הברכות (גם אם `@everyone` חסום שם).

### שלב 4 — הפעלת הקוד
```bash
cd bots/welcome
npm install
copy .env.example .env
```
בתוך `.env`:
```
DISCORD_TOKEN=הטוקן_שלך
CLIENT_ID=מזהה_האפליקציה
GUILD_IDS=מזהה_השרת
ENABLE_MEMBERS_INTENT=true
```
ואז:
```bash
node index.js
```

### שלב 5 — הגדרה בשרת
1. `/welcome-setup` בערוץ שבו רוצים את הברכות.
   - אם חסרות הרשאות, הבוט יגיד לכם בדיוק מה חסר.
2. `/test` — תצוגה מקדימה של ההודעה (עם האווטאר שלכם).
3. `/test user:@שם` — תצוגה מקדימה עם משתמש אחר.

---

## הערות
- הטקסט והצבע נמצאים ב־`config.js`.
- ההגדרות נשמרות ב־`guilds.json`.
- דוגמה להודעה:
  > 🎉 **ברוכים הבאים!**
  > ברוכים הבאים @shalev2147 ל־**ILRepublic Community**!
  > את/ה החבר/ה ה־13 שלנו!
