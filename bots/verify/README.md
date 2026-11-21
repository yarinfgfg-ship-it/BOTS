# ✅ Verify — בוט אימות בלחיצה אחת

אימות בלי אתר ובלי OAuth: לחצו על כפתור **verify** → מקבלים תפקיד מאומת, והתפקיד "לא מאומת" מוסר.

---

## איך להתקין על השרת שלך — שלבים

### שלב 1 — יצירת הבוט ב־Discord
1. כנסו ל־https://discord.com/developers/applications
2. **New Application** → שם (למשל `VerifyPro`) → **Create**.
3. **Bot** → **Add Bot** → אשרו.
4. **Reset Token** → העתיקו את הטוקן. שמרו אותו בסוד.

### שלב 2 — אינטנט חובה (חשוב!)
בדף **Bot**, גללו ל־**Privileged Gateway Intents**:
- הפעילו **Server Members Intent** (נדרש כדי לתת תפקיד לחבר חדש בהצטרפות).
- לחצו **Save Changes**.

> בלי זה, החבר החדש לא יקבל את התפקיד האוטומטי.

### שלב 3 — הרשאות והזמנה לשרת
1. **OAuth2 → URL Generator**.
2. **Scopes**: סמנו `bot` ו־`applications.commands`.
3. **Bot Permissions**: סמנו
   - View Channels, Send Messages, Embed Links
   - **Manage Roles** (חובה לתת ולהוריד תפקידים)
   - Read Message History
4. פתחו את הקישור שנוצר → בחרו שרת → **Authorize**.

### שלב 4 — הפעלת הקוד
```bash
cd bots/verify
npm install
copy .env.example .env
```
בתוך `.env`:
```
DISCORD_TOKEN=הטוקן_מהשלב_1
CLIENT_ID=מזהה_האפליקציה
GUILD_IDS=מזהה_השרת_שלך
ENABLE_MEMBERS_INTENT=true
```

ואז:
```bash
node index.js
```

### שלב 5 — הגדרה בשרת
1. `/verify-setup` בערוץ האימות — יוצר פאנל עם כפתור ירוק **verify** (ויוצר תפקיד "מאומת" אוטומטית).
2. `/verify-role role:@מאומת` — לבחירת התפקיד שניתן אחרי האימות.
3. `/join-role role:@לא מאומת` — לבחירת התפקיד שיינתן בהצטרפות ויוסר אחרי האימות.
4. `/join-role` בלי פרמטרים — מראה את התפקיד הנוכחי.
5. `/join-role clear:true` — מבטל אותו.

---

## הערות חשובות
- התפקידים חייבים להיות **מתחת** לתפקיד הגבוה ביותר של הבוט ברשימת התפקידים.
- ההגדרות נשמרות בקובץ `guilds.json`.
- כל הטקסטים ב־`config.js`.
