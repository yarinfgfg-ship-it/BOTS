# 🛡️ AutoMod — בוט חסימת קישורים ותוכן NSFW

בוט עצמאי שיוצר בשרת כללי **Discord AutoMod** מובנים: חסימת כל קישור וחסימת מילות NSFW, עם **השהייה של דקה** למי ששולח.

הכללים נוצרים בצד של Discord (אין צורך לקרוא הודעות), כך שהם עובדים גם כשהבוט לא מחובר.

## מה הוא עושה
- 🔗 חוסם כל קישור: `http://`, `www.`, `discord.gg`, קישורי הזמנה, וכתובות אתר רגילות.
- ⏱️ מוחק את ההודעה ומשהה את המשתמש לדקה.
- 🚫 חוסם מילות NSFW בהודעה.
- 🛡️ תפקידי צוות יכולים להיות פטורים מהכללים.

## התקנה

### שלב 1 — יצירת הבוט
1. https://discord.com/developers/applications → **New Application** → שם (למשל `Shomer AutoMod`) → **Create**.
2. **Bot** → **Add Bot** → **Reset Token** → שמרו את הטוקן בסוד.
3. **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: **Manage Server** (נדרש כדי ליצור כללי AutoMod)
4. פתחו את הקישור והזמינו את הבוט לשרת.

> אין צורך ב־Message Content Intent או ב־Server Members Intent.

### שלב 2 — הפעלה מקומית
```bash
cd bots/automod
npm install
copy .env.example .env   # מלאו DISCORD_TOKEN
npm start
```

בהפעלה הראשונה הבוט יוצר אוטומטית שני כללים בכל שרת שהוא נמצא בו:
```
[automod] 🚫 אין קישורים ready
[automod] 🚫 אין תוכן NSFW ready
```

## פקודות
| פקודה | מה היא עושה |
| --- | --- |
| `/automod-setup` | יוצר/מעדכן את הכללים בשרת הנוכחי |
| `/automod-status` | מראה אילו כללים קיימים והאם הם פעילים |

## התאמה אישית
כל הטקסטים וההגדרות ב־`config.js`:
- `timeoutMs` — משך ההשהייה (ברירת מחדל: דקה)
- `linkRegex` — תבניות הקישורים שנחסמים
- `nsfwKeywords` — המילים שנחסמות
- `linkRuleName` / `nsfwRuleName` — שמות הכללים בשרת
- `EXEMPT_ROLE_IDS` ב־`.env` — תפקידים שפטורים

## תמונות NSFW
הכלל חוסם מילות NSFW בהודעה. כדי לסרוק גם תמונות/GIF בלי טקסט, הפעילו בדיסקורד:

**Server Settings → Safety Setup → AutoMod → Block explicit content**
