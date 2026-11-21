require('dotenv').config();

const token = process.env.DISCORD_TOKEN;
const channelId = '1572351677686616078';
const headers = { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' };

async function api(path, options = {}) {
  const res = await fetch(`https://discord.com/api/v10${path}`, {
    ...options,
    headers,
  });
  const json = await res.json().catch(() => ({}));
  console.log(`${options.method || 'GET'} ${path} -> ${res.status}`, json.username || json.id || '');
  return { res, json };
}

(async () => {
  // Rename the bot
  await api('/users/@me', {
    method: 'PATCH',
    body: JSON.stringify({ username: 'בוט טיקטים' }),
  });

  // Long Hebrew guide in #general
  const embed = {
    title: '📘 מדריך הטיקטים — ברוכים הבאים!',
    description:
      'היי 👋\n\n' +
      'אנחנו כאן כדי לעזור לכם בכל שאלה, בעיה או בקשה. במקום לכתוב בערוץ הראשי ולאבד את ההודעה בתוך השיחה, פשוט פותחים טיקט — ויש לכם ערוץ פרטי משלכם עם צוות התמיכה.\n\n' +
      'המדריך למטה מסביר איך הכל עובד, שלב אחר שלב. קחו רגע לקרוא — זה לוקח פחות מדקה.',
    color: 5793274,
    fields: [
      {
        name: '🎫 שלב 1 — פותחים טיקט',
        value:
          'לחצו על הכפתור **פתיחת טיקט** בהודעת הפאנל שבערוץ הזה. תופיע לכם תפריט קטן ובו האפשרויות הזמינות.',
        inline: false,
      },
      {
        name: '📂 שלב 2 — בוחרים קטגוריה',
        value:
          'כרגע זמינה קטגוריה אחת בלבד: **בדיקה**. בחרו אותה והטיקט שלכם ייווצר מיד. בהמשך נוסיף עוד קטגוריות לפי הצורך.',
        inline: false,
      },
      {
        name: '🔢 איך נקרא הערוץ?',
        value:
          'כל טיקט מקבל מספר סידורי משלו: `ticket-001`, `ticket-002` וכן הלאה. המספרים עולים אוטומטית, כך שלעולם לא תהיה כפילות.',
        inline: false,
      },
      {
        name: '👋 מה תראו בתוך הטיקט?',
        value:
          'מיד עם פתיחת הערוץ תקבלו הודעת **ברוכים הבאים לטיקט! 👋**, יחד עם הודעה שמזכירה לכם לכתוב את פרטי הפנייה. כתבו כאן את כל המידע הרלוונטי — ככל שתפרטו יותר, כך נוכל לעזור מהר יותר.',
        inline: false,
      },
      {
        name: '🙋 מי מטפל בטיקט?',
        value:
          'חבר צוות יכול ללחוץ על **תפוס טיקט** כדי לסמן שהוא לוקח את הפנייה שלכם. משם ואילך הוא מלווה אתכם עד לפתרון.',
        inline: false,
      },
      {
        name: '🔒 איך סוגרים?',
        value:
          'כשהכל ברור — לחצו על **סגור טיקט**. תופיע הודעת אישור, ואחרי אישור הערוץ נמחק אוטומטית. לפני המחיקה השיחה נשמרת כתמלול בערוץ הלוגים, כדי שתמיד נוכל לחזור אליה.',
        inline: false,
      },
      {
        name: '📬 מה עוד קורה?',
        value:
          'בסגירה תקבלו הודעה פרטית שמבשרת שהטיקט נסגר. אם ההודעות הפרטיות שלכם חסומות — אל דאגה, תישאר הודעה בערוץ עצמו לפני המחיקה.',
        inline: false,
      },
      {
        name: '⚠️ חשוב לדעת',
        value:
          '• ערוץ הטיקט פרטי — רק אתם וצוות התמיכה רואים אותו.\n' +
          '• אפשר לפתוח טיקט אחד פתוח בכל פעם. אם יש לכם כבר אחד, פשוט המשיכו שם.\n' +
          '• אל תשלחו מידע רגיש כמו סיסמאות או פרטי תשלום.\n' +
          '• נשמח אם תשמרו על שפה נעימה ומכבדת 😊',
        inline: false,
      },
      {
        name: '💬 שאלה כללית?',
        value:
          'אם זו סתם שאלה קטנה שאינה דורשת מעקב — אפשר לשאול כאן ב־`general` ומישהו מהצוות יענה כשיראה.',
        inline: false,
      },
    ],
    footer: { text: 'בוט טיקטים • בלי שם שרת' },
    timestamp: new Date().toISOString(),
  };

  await api(`/channels/${channelId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ embeds: [embed] }),
  });
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
