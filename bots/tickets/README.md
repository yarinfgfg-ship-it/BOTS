# 🎫 זרימה — בוט טיקטים

מערכת טיקטים מלאה: פאנל → פתיחת טיקט פרטי → תפיסה וסגירה ע"י הצוות.

---

## איך להתקין על השרת שלך — שלבים

### שלב 1 — יצירת הבוט ב־Discord
1. כנסו ל־https://discord.com/developers/applications
2. לחצו **New Application**, תנו שם (למשל `זרימה`) ולחצו **Create**.
3. בתפריט השמאלי לחצו **Bot** → **Add Bot** → אשרו.
4. לחצו **Reset Token** ו**העתיקו את הטוקן**. שמרו אותו במקום בטוח — לא לשתף אותו.

### שלב 2 — הרשאות (OAuth2)
1. בפורטל, כנסו ל־**OAuth2 → URL Generator**.
2. תחת **Scopes** סמנו:
   - `bot`
   - `applications.commands`
3. תחת **Bot Permissions** סמנו:
   - View Channels
   - Send Messages
   - Embed Links
   - Manage Channels
   - Manage Roles
   - Read Message History
4. העתיקו את הקישור שנוצר למטה, פתחו אותו בדפדפן, בחרו את השרת שלכם ולחצו **Authorize**.

### שלב 3 — הפעלת הקוד
```bash
cd bots/tickets
npm install
copy .env.example .env
```
פתחו את `.env` והדביקו:
```
DISCORD_TOKEN=הטוקן_שאפשרתם_בשלב_1
CLIENT_ID=מזהה_האפליקציה_מהפורטל
```
אופציונלי (לרישום מיידי של פקודות):
```
GUILD_IDS=מזהה_שרת_1,מזהה_שרת_2
TICKET_CATEGORY_ID=מזהה_קטגוריית_טיקטים
SUPPORT_ROLE_IDS=מזהה_תפקיד_צוות
```

ואז:
```bash
node index.js
```

### שלב 4 — הגדרה בשרת
בשרת, כתבו `/ticket-setup` בערוץ שבו רוצים את הפאנל. הבוט יפרסם שם כפתור **🎫 פתיחת טיקט**.

---

## שינוי טקסטים
כל ההודעות נמצאות בקובץ `config.js` — אפשר לערוך בלי לגעת בקוד.

## הערות
- הבוט חייב להיות עם **Manage Channels** כדי ליצור ולמחוק ערוצי טיקט.
- הפקודות נרשמות גלובלית (עד שעה), או מיידית אם מילאתם `GUILD_IDS`.
