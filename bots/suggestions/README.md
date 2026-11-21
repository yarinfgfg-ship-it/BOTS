# 💡 Suggestions & Polls — בוט הצעות והצבעות

בוט עצמאי להצעות מהקהילה ולהצבעות עם כפתורים, מונה חי, טיימר וסיכום אוטומטי.

## מה הוא עושה
- 💡 `/suggest` — חבר שולח הצעה; ההודעה נשלחת לערוץ ההצעות עם 👍 / 👎 ועם כפתורי ✅ אישור / ❌ דחייה לצוות.
- 📊 `/poll create` — הצבעה עם 2–4 אפשרויות, כפתור הצבעה לכל אפשרות, פס התקדמות ואחוזים.
- ⏰ סגירה אוטומטית בזמן שנקבע, עם הודעת זוכה / תיקו בערוץ.
- ⏹️ `/poll close` ו־`/poll results` לסגירה ותוצאות ידניות.
- 💾 הכל נשמר ב־`suggestions.json` וממשיך אחרי ריסטארט.

## התקנה

### שלב 1 — יצירת הבוט
1. https://discord.com/developers/applications → **New Application** → שם (למשל `SuggestPro`) → **Create**.
2. **Bot** → **Add Bot** → **Reset Token** — שמרו את הטוקן בסוד.
3. **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: **Send Messages**, **Embed Links**, **Use External Emojis**
4. הזמינו את הבוט לשרת. אין צורך ב־Privileged Intents.

### שלב 2 — הפעלה
```bash
cd bots/suggestions
npm install
copy .env.example .env   # מלאו DISCORD_TOKEN ו־CLIENT_ID
npm start
```

## הגדרה בשרת
```
/suggestion-setup channel:#הצעות
```
אחרי זה כל חבר יכול:
```
/suggest text:"אפשר להוסיף ערוץ שאלות?"
```
הצוות לוחץ ✅ אישור או ❌ דחייה על ההודעה בערוץ.

## דוגמת הצבעה
```
/poll create question:"איזה יום נעשה event?" option1:"שישי" option2:"שבת" option3:"ראשון" duration:60
```

| פקודה | תיאור |
| --- | --- |
| `/suggestion-setup` | הגדרת/ביטול ערוץ ההצעות (צוות) |
| `/suggest` | הגשת הצעה |
| `/poll create` | פתיחת הצבעה (צוות) |
| `/poll close` | סגירה מוקדמת (צוות) |
| `/poll results` | הצגת תוצאות (צוות) |

## התאמה אישית
כל הטקסטים והצבעים ב־`config.js`. כל אדם עם הרשאת **Manage Server** יכול לאשר הצעות ולסגור הצבעות.
