# 🛠️ Y.G Owner Tools — כלי יוצר הבוט

כלים פרטיים ליוצר הבוט בלבד: הודעה פרטית, התראה אדומה, ושליחת הזמנה לשרת.

---

## איך להתקין על השרת שלך — שלבים

### שלב 1 — יצירת הבוט
1. https://discord.com/developers/applications
2. **New Application** → שם (למשל `OwnerKit`) → **Create**.
3. **Bot** → **Add Bot** → **Reset Token** → העתיקו את הטוקן.
4. העתיקו גם את **APPLICATION ID** (מזהה האפליקציה).

### שלב 2 — מזהה היוצר שלך
1. בדיסקורד, לחצו **Settings → Advanced** והפעילו **Developer Mode**.
2. לחצו ימין על השם/הפרופיל שלכם → **Copy User ID**.
3. זה המזהה שיוכל להשתמש בפקודות.

### שלב 3 — הרשאות והזמנה
1. **OAuth2 → URL Generator**.
2. **Scopes**: `bot` + `applications.commands`.
3. **Bot Permissions**: View Channels, Send Messages, Embed Links.
4. פתחו את הקישור → בחרו שרת → **Authorize**.

> לא צריך הרשאות מיוחדות — כל הפקודות נשלחות דרך תגובה לפקודה.

### שלב 4 — הפעלת הקוד
```bash
cd bots/owner-tools
npm install
copy .env.example .env
```
בתוך `.env`:
```
DISCORD_TOKEN=הטוקן_שלך
CLIENT_ID=מזהה_האפליקציה
GUILD_IDS=מזהה_השרת
BOT_OWNER_IDS=מזהה_היוצר_מהשלב_2
```
ואז:
```bash
node index.js
```

### שלב 5 — שימוש
```
/dm user:@משתמש message:ההודעה
/alert user:@משתמש message:התראה חשובה
/join-server user:@משתמש invite:https://discord.gg/xxxxx
```

---

## הערות
- כותרת ההתראה היא תמיד: `⚠️הודעה מהשרת התראה⚠️`
- `/join-server` שולח קישור הזמנה גם כשהבוט **לא** נמצא באותו שרת (בוטים לא יכולים להוסיף אנשים לשרתים שהם לא חברים בהם).
- אפשר להוסיף כמה מזהי יוצר עם פסיק: `BOT_OWNER_IDS=id1,id2`.
- כל הטקסטים ב־`config.js`.
