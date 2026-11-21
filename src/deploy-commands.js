require('dotenv').config();

const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

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
    .setName('ticket-config')
    .setDescription('הגדרת ערוץ לוגים לשרת הזה')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((o) =>
      o.setName('log').setDescription('ערוץ לשמירת תמלולי טיקטים')
    )
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
          o.setName('value').setDescription('הערך של הקטגוריה (ראו /ticket-category list)').setRequired(true)
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
];

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID, INSTANT_GUILD_IDS } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('❌ DISCORD_TOKEN and CLIENT_ID must be set in .env');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    const route = GUILD_ID
      ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
      : Routes.applicationCommands(CLIENT_ID);

    console.log(`Registering ${commands.length} slash command(s)...`);
    await rest.put(route, { body: commands });
    console.log('✅ Slash commands registered globally.');

    const instantGuilds = (INSTANT_GUILD_IDS || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    for (const gid of instantGuilds) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, gid), { body: commands });
      console.log(`✅ Slash commands registered instantly in guild ${gid}.`);
    }
  } catch (error) {
    console.error('❌ Failed to register commands:', error);
    process.exit(1);
  }
})();
