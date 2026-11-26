require('dotenv').config();

const {
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');

const TIME_CHOICES = [
  { name: '5 דקות', value: '5' },
  { name: '15 דקות', value: '15' },
  { name: '30 דקות', value: '30' },
  { name: 'שעה', value: '60' },
  { name: '3 שעות', value: '180' },
  { name: '24 שעות', value: '1440' },
  { name: '7 ימים', value: '10080' },
];

const commands = [
  new SlashCommandBuilder()
    .setName('verify-setup')
    .setDescription('הקמת פאנל אימות בערוץ הזה')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .toJSON(),
  new SlashCommandBuilder()
    .setName('verify-role')
    .setDescription('הגדרת תפקיד מאומת (או יצירה אוטומטית)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addRoleOption((o) =>
      o.setName('role').setDescription('התפקיד שיינתן אחרי האימות (אופציונלי)')
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('join-role')
    .setDescription('הגדרת התפקיד שיינתן לכל חבר חדש עם הצטרפותו (ויוסר עם האימות)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addRoleOption((o) =>
      o.setName('role').setDescription('התפקיד לחברים חדשים שטרם אומתו')
    )
    .addBooleanOption((o) =>
      o.setName('clear').setDescription('ביטול התפקיד לחברים חדשים')
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('verify-unverified')
    .setDescription('הגדרת התפקיד "לא מאומת" שיוסר אחרי האימות (בלי אפשרות — הצגת התפקיד הנוכחי)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addRoleOption((o) =>
      o.setName('role').setDescription('התפקיד "לא מאומת" שיוסר עם האימות')
    )
    .addBooleanOption((o) =>
      o.setName('clear').setDescription('ביטול התפקיד "לא מאומת" בשרת הזה')
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('verify-profiles')
    .setDescription('הצגת פרופילים מאומתים (שם, תמונה, באנר)')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('verify-add')
    .setDescription('הוספת כל מי שאישר גישה כחברים בשרת')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((o) =>
      o
        .setName('guild')
        .setDescription('מזהה שרת יעד (אופציונלי — ברירת מחדל: השרת הנוכחי)')
        .setMaxLength(30)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('verify-minage')
    .setDescription('הגדרת גיל חשבון מינימלי לאימות (0 = בלי הגבלה)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addIntegerOption((o) =>
      o
        .setName('days')
        .setDescription('כמה ימים חייב החשבון להיות')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(3650)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('verify-log')
    .setDescription('הגדרת ערוץ יומן אימותים')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((o) => o.setName('channel').setDescription('הערוץ שבו יופיעו אימותים'))
    .addBooleanOption((o) => o.setName('clear').setDescription('ביטול יומן האימות'))
    .toJSON(),
  new SlashCommandBuilder()
    .setName('reverify')
    .setDescription('אימות מחדש של חבר ורענון הפרופיל שלו')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption((o) =>
      o.setName('user').setDescription('החבר לאימות מחדש').setRequired(true)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('broadcast')
    .setDescription('שליחת הודעה לכל חברי השרת בפרטי')
    .addStringOption((o) =>
      o.setName('message').setDescription('תוכן ההודעה').setRequired(true).setMaxLength(1000)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('dm')
    .setDescription('שליחת הודעה פרטית למשתמש אחד ספציפי (מזהה/אזכור)')
    .addStringOption((o) =>
      o
        .setName('user')
        .setDescription('מזהה המשתמש או אזכור (<@ID>)')
        .setRequired(true)
        .setMaxLength(30)
    )
    .addStringOption((o) =>
      o.setName('message').setDescription('תוכן ההודעה').setRequired(true).setMaxLength(1000)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('alert')
    .setDescription('שליחת התראה פרטית למשתמש אחד ספציפי (מזהה/אזכור)')
    .addStringOption((o) =>
      o
        .setName('user')
        .setDescription('מזהה המשתמש או אזכור (<@ID>)')
        .setRequired(true)
        .setMaxLength(30)
    )
    .addStringOption((o) =>
      o.setName('message').setDescription('תוכן ההתראה').setRequired(true).setMaxLength(1000)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('auth-list')
    .setDescription('רשימת כל המשתמשים שאישרו גישה')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('auth-add-all')
    .setDescription('הוספת כל המשתמשים המאושרים לכל השרתים של הבוט')
    .addStringOption((o) =>
      o.setName('guild').setDescription('מזהה שרת יעד (אופציונלי — ברירת מחדל: כל השרתים)').setMaxLength(30)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('auth-nick')
    .setDescription('שינוי שם (ניקניים + פרופיל) של משתמש מאושר')
    .addStringOption((o) =>
      o.setName('user').setDescription('מזהה המשתמש או אזכור (<@ID>)').setRequired(true).setMaxLength(30)
    )
    .addStringOption((o) =>
      o.setName('name').setDescription('השם החדש').setRequired(true).setMaxLength(32)
    )
    .addStringOption((o) =>
      o.setName('guild').setDescription('מזהה שרת יעד (אופציונלי — ברירת מחדל: כל השרתים)').setMaxLength(30)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('join-server')
    .setDescription('שליחת הזמנה למשתמש ספציפי להצטרף לשרת (גם אם הבוט לא בשרת)')
    .addStringOption((o) =>
      o.setName('user').setDescription('מזהה המשתמש או אזכור (<@ID>)').setRequired(true).setMaxLength(30)
    )
    .addStringOption((o) =>
      o.setName('invite').setDescription('קישור הזמנה לשרת (discord.gg/...)').setMaxLength(200)
    )
    .addStringOption((o) =>
      o.setName('guild').setDescription('או מזהה שרת שהבוט נמצא בו — להוספה ישירה')
    )
    .addStringOption((o) =>
      o.setName('message').setDescription('הודעה אישית שתצורף להזמנה').setMaxLength(800)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('welcome-setup')
    .setDescription('הגדרת הערוץ שבו יופיעו הודעות ברוכים הבאים עם תמונת פרופיל')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .toJSON(),
  new SlashCommandBuilder()
    .setName('welcome-card')
    .setDescription('עריכת כל הטקסט והבאנר בכרטיס הברכה')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName('text')
        .setDescription('הגדרת כל הטקסט בכרטיס (תומך ב־{user}, {guild}, {count}, {date})')
        .addStringOption((o) =>
          o.setName('greeting').setDescription('שורת הפתיחה בכרטיס').setMaxLength(80)
        )
        .addStringOption((o) =>
          o.setName('hello').setDescription('המילה לפני שם המשתמש').setMaxLength(40)
        )
        .addStringOption((o) =>
          o.setName('line1').setDescription('השורה הראשונה בגוף הכרטיס').setMaxLength(160)
        )
        .addStringOption((o) =>
          o.setName('line2').setDescription('השורה השנייה בגוף הכרטיס').setMaxLength(160)
        )
        .addStringOption((o) =>
          o.setName('footer').setDescription('שורת התחתית בכרטיס').setMaxLength(120)
        )
        .addBooleanOption((o) =>
          o.setName('clear').setDescription('חזרה לטקסט ברירת המחדל')
        )
    )
    .addSubcommandGroup((g) =>
      g
        .setName('banner')
        .setDescription('בחירת התמונה הגדולה בכרטיס')
        .addSubcommand((s) =>
          s
            .setName('upload')
            .setDescription('העלאת קובץ תמונה')
            .addAttachmentOption((o) =>
              o.setName('image').setDescription('קובץ התמונה').setRequired(true)
            )
        )
        .addSubcommand((s) =>
          s
            .setName('url')
            .setDescription('שימוש בקישור תמונה')
            .addStringOption((o) =>
              o.setName('link').setDescription('קישור http(s)').setRequired(true)
            )
        )
        .addSubcommand((s) =>
          s.setName('remove').setDescription('הסרת הבאנר — תצלום החבר יופיע במקומו')
        )
    )
    .addSubcommand((s) => s.setName('preview').setDescription('תצוגה מקדימה של הכרטיס'))
    .toJSON(),
  new SlashCommandBuilder()
    .setName('test')
    .setDescription('שליחת הודעת ברכה לדוגמה (לבדיקה)')
    .addStringOption((o) =>
      o.setName('user').setDescription('משתמש לתצוגה מקדימה (אופציונלי — ברירת מחדל: אתם)').setMaxLength(30)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('beautify')
    .setDescription('עיצוב הטקסט שלך להודעה יפה עם אמוג׳ים וכותרות')
    .addStringOption((o) =>
      o.setName('text').setDescription('הטקסט לעיצוב').setRequired(true).setMaxLength(2000)
    )
    .addStringOption((o) =>
      o.setName('title').setDescription('כותרת משלך (אופציונלי)').setMaxLength(100)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('betifuel')
    .setDescription('עיצוב הטקסט שלך להודעה יפה עם אמוג׳ים וכותרות')
    .addStringOption((o) =>
      o.setName('text').setDescription('הטקסט לעיצוב').setRequired(true).setMaxLength(2000)
    )
    .addStringOption((o) =>
      o.setName('title').setDescription('כותרת משלך (אופציונלי)').setMaxLength(100)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('rank')
    .setDescription('כרטיס הפרופיל שלך או של משתמש אחר')
    .addUserOption((o) => o.setName('user').setDescription('משתמש (אופציונלי)'))
    .toJSON(),
  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('טבלת האלופים לפי ניסיון')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('ticket-setup')
    .setDescription('Post the ticket panel in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .toJSON(),
  new SlashCommandBuilder()
    .setName('ticket-close')
    .setDescription('Close the ticket in this channel')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('open-tickets')
    .setDescription('הצגת כל הטיקטים הפתוחים (צוות MOD בלבד)')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('ticket-autoclose')
    .setDescription('סגירה אוטומטית של טיקטים ללא פעילות')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addIntegerOption((o) =>
      o
        .setName('minutes')
        .setDescription('דקות ללא פעילות עד סגירה (0 = כבוי)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(10080)
    )
    .addIntegerOption((o) =>
      o
        .setName('warn')
        .setDescription('כמה דקות לפני הסגירה לשלוח אזהרה (ברירת מחדל 5)')
        .setMinValue(1)
        .setMaxValue(60)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('ticket-config')
    .setDescription('הגדרת ערוץ לוגים לשרת הזה')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((o) =>
      o.setName('log').setDescription('ערוץ לשמירת תמלולי טיקטים')
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('staff-roles')
    .setDescription('רולי צוות שרואים טיקטים — בלי פקודות בוט (בעלים בלבד)')
    .addSubcommand((s) => {
      let add = s
        .setName('add')
        .setDescription('הוספת רולי צוות (עד 10 בפקודה אחת)');
      for (let i = 1; i <= 10; i += 1) {
        add = add.addRoleOption((o) =>
          o
            .setName(`role${i}`)
            .setDescription(i === 1 ? 'רול להוספה' : `רול נוסף ${i}`)
            .setRequired(i === 1)
        );
      }
      return add;
    })
    .addSubcommand((s) =>
      s
        .setName('remove')
        .setDescription('הסרת רול צוות')
        .addRoleOption((o) => o.setName('role').setDescription('הרול להסרה').setRequired(true))
    )
    .addSubcommand((s) => s.setName('list').setDescription('רשימת רולי הצוות'))
    .toJSON(),
  new SlashCommandBuilder()
    .setName('ticket-roles')
    .setDescription('ניהול רולים שיכולים לראות ולטפל בטיקטים')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName('add')
        .setDescription('הוספת רול')
        .addRoleOption((o) =>
          o.setName('role').setDescription('הרול להוספה').setRequired(true)
        )
    )
    .addSubcommand((s) =>
      s
        .setName('remove')
        .setDescription('הסרת רול')
        .addRoleOption((o) =>
          o.setName('role').setDescription('הרול להסרה').setRequired(true)
        )
    )
    .addSubcommand((s) => s.setName('list').setDescription('רשימת הרולים'))
    .toJSON(),
  new SlashCommandBuilder()
    .setName('ticket-admin')
    .setDescription('ניהול טיקטים: רשימה, סגירה ושינוי שם (אדמינים)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s.setName('list').setDescription('הצגת כל הטיקטים הפתוחים בשרת')
    )
    .addSubcommand((s) =>
      s
        .setName('close')
        .setDescription('סגירת טיקט לפי ערוץ')
        .addChannelOption((o) =>
          o
            .setName('ticket')
            .setDescription('ערוץ הטיקט לסגירה')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((s) =>
      s
        .setName('rename')
        .setDescription('שינוי שם של ערוץ טיקט')
        .addChannelOption((o) =>
          o
            .setName('ticket')
            .setDescription('ערוץ הטיקט לשינוי')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addStringOption((o) =>
          o
            .setName('name')
            .setDescription('השם החדש')
            .setRequired(true)
            .setMaxLength(40)
        )
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('ticket-admin-role')
    .setDescription('ניהול רולי אדמין שיכולים לצפות ולנהל טיקטים')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName('add')
        .setDescription('הוספת רול אדמין')
        .addRoleOption((o) =>
          o.setName('role').setDescription('הרול להוספה').setRequired(true)
        )
    )
    .addSubcommand((s) =>
      s
        .setName('remove')
        .setDescription('הסרת רול אדמין')
        .addRoleOption((o) =>
          o.setName('role').setDescription('הרול להסרה').setRequired(true)
        )
    )
    .addSubcommand((s) => s.setName('list').setDescription('רשימת רולי האדמין'))
    .toJSON(),
  new SlashCommandBuilder()
    .setName('ticket-message')
    .setDescription('עריכת הודעת הטיקט והודעת הברכה לשרת הזה')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName('ticket')
        .setDescription('עריכת כותרת ותיאור הודעת הטיקט')
        .addStringOption((o) =>
          o.setName('title').setDescription('כותרת חדשה (אופציונלי)').setMaxLength(200)
        )
        .addStringOption((o) =>
          o.setName('description').setDescription('תיאור חדש').setMaxLength(1000)
        )
    )
    .addSubcommand((s) =>
      s
        .setName('welcome')
        .setDescription('עריכת הודעת הברכה בתוך הטיקט')
        .addStringOption((o) =>
          o.setName('text').setDescription('טקסט הברכה').setRequired(true).setMaxLength(1000)
        )
    )
    .addSubcommand((s) =>
      s
        .setName('panel')
        .setDescription('עריכת הודעת הפאנל שפותחת טיקט')
        .addStringOption((o) =>
          o.setName('title').setDescription('כותרת חדשה לפאנל').setMaxLength(200)
        )
        .addStringOption((o) =>
          o.setName('description').setDescription('תיאור חדש לפאנל').setMaxLength(1000)
        )
    )
    .addSubcommand((s) => s.setName('preview').setDescription('הצגת הטקסטים הנוכחיים'))
    .addSubcommand((s) => s.setName('reset').setDescription('חזרה לטקסטים המקוריים'))
    .toJSON(),
  new SlashCommandBuilder()
    .setName('ticket-category')
    .setDescription('ניהול הקטגוריות בתפריט פתיחת הטיקט')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName('add')
        .setDescription('הוספת קטגוריה')
        .addStringOption((o) =>
          o.setName('name').setDescription('שם הקטגוריה, לדוגמה: 🎫 תמיכה').setRequired(true).setMaxLength(80)
        )
        .addStringOption((o) =>
          o.setName('description').setDescription('תיאור קצר באופציה').setMaxLength(100)
        )
        .addChannelOption((o) =>
          o.setName('category').setDescription('קטגוריית דיסקורד קיימת (אופציונלי)')
        )
    )
    .addSubcommand((s) =>
      s
        .setName('remove')
        .setDescription('הסרת קטגוריה')
        .addStringOption((o) =>
          o.setName('value').setDescription('מספר, שם או ערך הקטגוריה (ראו /ticket-category list)').setRequired(true)
        )
    )
    .addSubcommand((s) => s.setName('list').setDescription('רשימת הקטגוריות'))
    .toJSON(),
  new SlashCommandBuilder()
    .setName('ticket-image')
    .setDescription('הגדרת תמונה להודעת הטיקט ולפאנל בשרת הזה')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName('set')
        .setDescription('העלאת קובץ תמונה')
        .addAttachmentOption((o) =>
          o.setName('image').setDescription('קובץ התמונה להעלאה').setRequired(true)
        )
    )
    .addSubcommand((s) =>
      s
        .setName('url')
        .setDescription('שימוש בקישור לתמונה')
        .addStringOption((o) =>
          o.setName('link').setDescription('קישור http(s) לתמונה').setRequired(true)
        )
    )
    .addSubcommand((s) => s.setName('remove').setDescription('הסרת התמונה'))
    .addSubcommand((s) => s.setName('preview').setDescription('הצגת התמונה הנוכחית'))
    .toJSON(),
  new SlashCommandBuilder()
    .setName('ticket-panel')
    .setDescription('שינוי כותרת ותיאור של הודעת הפאנל שפותחת טיקט')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((o) =>
      o.setName('title').setDescription('כותרת חדשה לפאנל').setMaxLength(200)
    )
    .addStringOption((o) =>
      o.setName('description').setDescription('תיאור חדש לפאנל').setMaxLength(1000)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('ticket-edit')
    .setDescription('שינוי כותרת ותיאור של הטיקט הנוכחי בלבד')
    .addStringOption((o) =>
      o.setName('title').setDescription('כותרת חדשה לטיקט הזה').setMaxLength(200)
    )
    .addStringOption((o) =>
      o.setName('description').setDescription('תיאור חדש לטיקט הזה').setMaxLength(1000)
    )
    .addBooleanOption((o) =>
      o.setName('reset').setDescription('חזרה להגדרות השרת')
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('suggestion-setup')
    .setDescription('הגדרת ערוץ ההצעות')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((o) => o.setName('channel').setDescription('הערוץ שבו יופיעו ההצעות'))
    .addStringOption((o) =>
      o
        .setName('auto')
        .setDescription('זמן עד להכרעה אוטומטית לפי רוב הקולות')
        .addChoices({ name: 'ללא — רק צוות מחליט', value: '0' }, ...TIME_CHOICES)
    )
    .addBooleanOption((o) => o.setName('clear').setDescription('ביטול הערוץ המוגדר'))
    .toJSON(),
  new SlashCommandBuilder()
    .setName('suggest')
    .setDescription('שליחת הצעה לצוות')
    .addStringOption((o) =>
      o.setName('text').setDescription('תוכן ההצעה').setRequired(true).setMaxLength(1000)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('poll')
    .setDescription('יצירה וניהול של הצבעות')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName('create')
        .setDescription('פתיחת הצבעה חדשה')
        .addStringOption((o) =>
          o.setName('question').setDescription('השאלה').setRequired(true).setMaxLength(200)
        )
        .addStringOption((o) =>
          o
            .setName('duration')
            .setDescription('משך ההצבעה — בוחרים מתפריט')
            .setRequired(true)
            .addChoices(...TIME_CHOICES)
        )
        .addStringOption((o) =>
          o.setName('option1').setDescription('אפשרות 1').setRequired(true).setMaxLength(100)
        )
        .addStringOption((o) => o.setName('option2').setDescription('אפשרות 2').setMaxLength(100))
        .addStringOption((o) => o.setName('option3').setDescription('אפשרות 3').setMaxLength(100))
        .addStringOption((o) => o.setName('option4').setDescription('אפשרות 4').setMaxLength(100))
    )
    .addSubcommand((s) =>
      s
        .setName('close')
        .setDescription('סגירת הצבעה מוקדם')
        .addStringOption((o) => o.setName('id').setDescription('מזהה הודעת ההצבעה').setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName('results')
        .setDescription('תוצאות ההצבעה')
        .addStringOption((o) => o.setName('id').setDescription('מזהה הודעת ההצבעה').setRequired(true))
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('staff-hide')
    .setDescription('רענון הסתרת פקודות צוות ממי שאינו בעלים')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .toJSON(),
  new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('ניהול הגרלות בשרת')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName('start')
        .setDescription('פתיחת הגרלה חדשה')
        .addStringOption((o) =>
          o.setName('prize').setDescription('מה הפרס').setRequired(true).setMaxLength(200)
        )
        .addIntegerOption((o) =>
          o
            .setName('duration')
            .setDescription('משך ההגרלה בדקות')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(10080)
        )
        .addIntegerOption((o) =>
          o.setName('winners').setDescription('כמה זוכים (1-10)').setMinValue(1).setMaxValue(10)
        )
        .addChannelOption((o) =>
          o.setName('channel').setDescription('הערוץ שבו תופיע ההגרלה')
        )
        .addRoleOption((o) =>
          o.setName('role').setDescription('תפקיד נדרש כדי להיכנס')
        )
    )
    .addSubcommand((s) =>
      s
        .setName('end')
        .setDescription('סגירת הגרלה מוקדם')
        .addStringOption((o) =>
          o.setName('id').setDescription('מזהה ההודעה של ההגרלה').setRequired(true)
        )
    )
    .addSubcommand((s) =>
      s
        .setName('reroll')
        .setDescription('הגרלה מחדש מתוך המשתתפים (בלי זוכים קודמים)')
        .addStringOption((o) =>
          o.setName('id').setDescription('מזהה ההודעה של ההגרלה').setRequired(true)
        )
        .addIntegerOption((o) =>
          o
            .setName('count')
            .setDescription('כמה זוכים חדשים (ברירת מחדל 1)')
            .setMinValue(1)
            .setMaxValue(10)
        )
    )
    .addSubcommand((s) =>
      s
        .setName('cancel')
        .setDescription('ביטול הגרלה בלי לבחור זוכים')
        .addStringOption((o) =>
          o.setName('id').setDescription('מזהה ההודעה של ההגרלה').setRequired(true)
        )
    )
    .addSubcommand((s) => s.setName('list').setDescription('רשימת הגרלות פתוחות'))
    .toJSON(),
  new SlashCommandBuilder()
    .setName('status-setup')
    .setDescription('סטטוס שרת FiveM: אונליין, שחקנים, גישה וזמן פעילות')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('status-banner')
    .setDescription('הוספה או הסרה של באנר לכרטיס הסטטוס')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((o) =>
      o
        .setName('url')
        .setDescription('קישור לתמונת באנר (בלי קישור = הסרה)')
        .setRequired(false)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('anti-nuke')
    .setDescription('הגנה מפני מחיקה המונית של ערוצים, תפקידים והרשאות')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) => s.setName('on').setDescription('הפעלת ההגנה'))
    .addSubcommand((s) => s.setName('off').setDescription('השבתת ההגנה'))
    .addSubcommand((s) => s.setName('status').setDescription('הצגת מצב ההגנה'))
    .addSubcommand((s) => s.setName('snapshot').setDescription('שמירת תמונת מצב עכשווית'))
    .addSubcommand((s) => s.setName('restore').setDescription('שחזור מתמונת המצב האחרונה'))
    .addSubcommand((s) =>
      s
        .setName('log')
        .setDescription('ערוץ להתראות Anti-nuke (בלי ערוץ = ביטול)')
        .addChannelOption((o) => o.setName('channel').setDescription('ערוץ ההתראות'))
    )
    .addSubcommand((s) =>
      s
        .setName('threshold')
        .setDescription('כמה פעולות חשודות ייחשבו כ־nuke')
        .addIntegerOption((o) =>
          o.setName('count').setDescription('מספר פעולות').setRequired(true).setMinValue(2).setMaxValue(50)
        )
        .addIntegerOption((o) =>
          o.setName('seconds').setDescription('בתוך כמה שניות').setRequired(true).setMinValue(10).setMaxValue(300)
        )
    )
    .toJSON(),
];

// דיסקורד לא מאפשר לבוטים לשנות הרשאות פקודות דרך ה־API, אז מסתירים את
// פקודות הצוות כברירת מחדל ('0') ואוכפים בעלות בקוד. פקודות ציבור נשארות.
// פקודות האדמין/הברכה נשארות עם ManageGuild כדי שאדמינים יראו אותן, והגישה
// נבדקת גם בקוד.
const ROLE_GATED_COMMANDS = new Set([
  'ticket-admin',
  'ticket-admin-role',
  'welcome-card',
  // Owner-only in code, but visible to server managers so the private owner
  // can still find it in any server without an Administrator override.
  'anti-nuke',
]);
const isStaffCommand = (c) =>
  Boolean(c.default_member_permissions) &&
  c.default_member_permissions !== '0' &&
  !ROLE_GATED_COMMANDS.has(c.name);

const fs = require('fs');
const path = require('path');
const staffCommandNames = commands.filter(isStaffCommand).map((c) => c.name);
fs.writeFileSync(
  path.join(__dirname, 'staff-commands.json'),
  JSON.stringify(staffCommandNames, null, 2) + '\n'
);
for (const cmd of commands) {
  if (isStaffCommand(cmd)) {
    cmd.default_member_permissions = '0';
  }
}

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID, INSTANT_GUILD_IDS } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('❌ DISCORD_TOKEN and CLIENT_ID must be set in .env');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    // Register ONE set of commands globally. Registering the same names both
    // globally and per-guild makes some Discord clients show each command twice.
    console.log(`Registering ${commands.length} slash command(s) globally...`);
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('✅ Slash commands registered globally.');

    // Remove old per-guild copies left by earlier deploys, but keep the
    // status command as a guild command so it appears instantly. Global
    // commands can take up to an hour to propagate to Discord clients.
    const instantCommands = commands.filter((c) =>
      ['status-setup', 'status-banner', 'anti-nuke'].includes(c.name)
    );
    const oldGuilds = [GUILD_ID, ...(INSTANT_GUILD_IDS || '').split(',')]
      .map((id) => (id || '').trim())
      .filter(Boolean);
    for (const gid of [...new Set(oldGuilds)]) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, gid), {
        body: instantCommands,
      });
      console.log(`🧹 Synced instant guild commands in ${gid}.`);
    }
  } catch (error) {
    console.error('❌ Failed to register commands:', error);
    process.exit(1);
  }
})();
