module.exports = {
  // משך ההשהייה כשמישהו שולח קישור / תוכן NSFW (במילישניות)
  timeoutMs: 60_000,

  // שמות הכללים בשרת — אפשר לשנות לכל שם שרוצים
  linkRuleName: '🚫 אין קישורים',
  nsfwRuleName: '🚫 אין תוכן NSFW',

  // תבניות שמתפסות על כל סוגי הקישורים
  linkRegex: [
    'https?://',
    'www\\.',
    'discord\\.gg/',
    'discord(app)?\\.com/invite/',
    '\\b[a-z0-9-]+\\.(com|net|org|io|gg|ly|tv|co|app|dev|info|biz|ru|il)\\b',
  ],

  // מילים שייחסמו בהודעה (גם אם מצורפת תמונה)
  nsfwKeywords: [
    'nsfw', 'porn', 'xxx', 'hentai', 'nude', 'sex', 'cum', 'anal', 'oral',
    'pussy', 'fap', 'pornhub', 'xvideos', 'onlyfans',
    'פורנו', 'עירום', 'הנטאי', 'מין', 'אוננות', 'זונה',
  ],

  // תפקידים שפטורים מהכללים (אופציונלי, מ־.env)
  exemptRoles: (process.env.EXEMPT_ROLE_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),
};
