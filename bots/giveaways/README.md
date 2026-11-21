# 🎁 Giveaways — בוט הגרלות

בוט עצמאי להגרלות בדיסקורד: כפתור כניסה, מונה משתתפים חי, טיימר, הגרלה אוטומטית ו־reroll.

## מה הוא עושה
- 🎁 `/giveaway start` — פותח הגרלה עם פרס, משך בדקות, מספר זוכים, ערוץ ותפקיד נדרש.
- 🎉 כשהטיימר מסתיים נוצרת **כרטיסיית זוכה 16:9** עם התמונה שלו ברקע והטקסט מודפס בתוך התמונה: `כל הכבוד @משתמש` / `זכיתה ב הפרס` (גם ב־reroll).
- 🖼️ הכרטיסייה נוצרת מקומית עם `@napi-rs/canvas` — בלי שירות תמונות בתשלום.
- 🔁 `/giveaway reroll` — הגרלה מחדש מתוך המשתתפים (בלי זוכים קודמים).
- 📋 `/giveaway list` — כל ההגרלות הפתוחות בשרת.
- 💾 ההגרלות נשמרות ב־`giveaways.json` וממשיכות אחרי ריסטארט.

## התקנה

### שלב 1 — יצירת הבוט
1. https://discord.com/developers/applications → **New Application** → שם (למשל `GiveawayPro`) → **Create**.
2. **Bot** → **Add Bot** → **Reset Token** — שמרו את הטוקן בסוד.
3. **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: **Send Messages**, **Embed Links**, **Use External Emojis**, **Manage Messages**
4. הזמינו את הבוט לשרת.

אין צורך ב־Privileged Intents.

### שלב 2 — הפעלה
```bash
cd bots/giveaways
npm install
copy .env.example .env   # מלאו DISCORD_TOKEN ו־CLIENT_ID
npm start
```

## דוגמה
```
/giveaway start prize:"Nitro" duration:60 winners:2 channel:#הגרלות
```

הודעת ההגרלה תיראה כך:

> 🎉 **Nitro**
> לחצו על הכפתור כדי להיכנס!
> 👥 משתתפים: **12**
> 🏆 זוכים: **2**
> ⏰ מסתיים: בעוד 58 דקות

## פקודות
| פקודה | תיאור |
| --- | --- |
| `/giveaway start` | פתיחת הגרלה |
| `/giveaway end id:<מזהה>` | סגירה מוקדמת |
| `/giveaway reroll id:<מזהה>` | זוכה חדש |
| `/giveaway list` | רשימת הגרלות פתוחות |

מזהה ההודעה מופיע בהודעת האישור אחרי יצירת ההגרלה.

## התאמה אישית
כל הטקסטים והצבעים ב־`config.js`.
