# 📦 חבילות הבוטים למכירה

התיקייה הזו מכילה **7 בוטים נפרדים**, כל אחד בתיקייה משלו. אפשר להעתיק תיקייה, להוסיף טוקן, ולמכור אותה כמוצר עצמאי.

| תיקייה | מוצר | פקודות |
| --- | --- | --- |
| `tickets/` | **זרימה** — מערכת טיקטים | `/ticket-setup` + כפתורי פתיחה/תפיסה/סגירה |
| `verify/` | אימות בלחיצה אחת | `/verify-setup`, `/verify-role`, `/join-role` + כפתור verify |
| `welcome/` | ברוכים הבאים | `/welcome-setup`, `/test` |
| `owner-tools/` | כלי יוצר | `/dm`, `/alert`, `/join-server` |
| `automod/` | חסימת קישורים ו־NSFW | `/automod-setup`, `/automod-status` + כללי AutoMod אוטומטיים |
| `giveaways/` | הגרלות | `/giveaway start/end/reroll/list` + כפתור כניסה והגרלה אוטומטית |
| `suggestions/` | הצעות והצבעות | `/suggest`, `/suggestion-setup`, `/poll create/close/results` |

הבוט הראשי שלך (`שומר הקהילה`) נשאר בקובץ `index.js` שבשורש הפרויקט וממשיך להריץ הכל יחד.

---

## איך להתקין כל מוצר

1. כנסו לתיקייה הרצויה, לדוגמה:
   ```bash
   cd bots/verify
   ```
2. קראו את `README.md` בתוך התיקייה — שם יש מדריך מלא בעברית, שלב אחר שלב:
   - יצירת אפליקציה ובוט בפורטל של Discord
   - הפעלת **Server Members Intent** (במוצרים שצריכים זיהוי הצטרפות)
   - יצירת קישור הזמנה עם ההרשאות הנכונות
   - מילוי `.env` והפעלת הבוט
   - הגדרה בשרת בעזרת פקודות ה־slash

3. התקנה בסיסית:
   ```bash
   npm install
   copy .env.example .env
   node index.js
   ```

כל תיקייה מכילה:
- `index.js` — קוד הבוט המלא לאותו תכונה
- `config.js` — כל הטקסטים לעריכה קלה
- `package.json` — תלות ושם עצמאיים
- `.env.example` — דוגמת הגדרות
- `README.md` — מדריך התקנה בעברית
