from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math, random

W, H = 1600, 900
random.seed(42)

# --- background gradient ---
img = Image.new('RGB', (W, H), (8, 10, 24))
px = img.load()
for y in range(H):
    t = y / H
    r = int(10 + 18 * t)
    g = int(12 + 8 * t)
    b = int(32 + 30 * t)
    for x in range(W):
        px[x, y] = (r, g, b)

# --- glow blobs ---
glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
for cx, cy, rad, color, alpha in [
    (360, 450, 380, (60, 120, 255), 105),
    (1250, 250, 330, (150, 70, 255), 95),
    (1150, 760, 300, (0, 200, 255), 70),
]:
    gd.ellipse([cx-rad, cy-rad, cx+rad, cy+rad], fill=(*color, alpha))
glow = glow.filter(ImageFilter.GaussianBlur(120))
img = Image.alpha_composite(img.convert('RGBA'), glow).convert('RGB')

# --- subtle grid ---
grid = Image.new('RGBA', (W, H), (0, 0, 0, 0))
gdraw = ImageDraw.Draw(grid)
for x in range(0, W, 80):
    gdraw.line([(x, 0), (x, H)], fill=(120, 160, 255, 14), width=1)
for y in range(0, H, 80):
    gdraw.line([(0, y), (W, y)], fill=(120, 160, 255, 14), width=1)
img = Image.alpha_composite(img.convert('RGBA'), grid).convert('RGB')

d = ImageDraw.Draw(img)

# --- stars / particles ---
for _ in range(160):
    x = random.randint(0, W)
    y = random.randint(0, H)
    radius = random.choice([1, 1, 2])
    c = random.choice([(120, 190, 255), (190, 150, 255), (255, 255, 255)])
    d.ellipse([x-radius, y-radius, x+radius, y+radius], fill=c)

# --- ticket icon (glowing) ---
layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
ld = ImageDraw.Draw(layer)
tx0, ty0, tx1, ty1 = 150, 290, 720, 610
ld.rounded_rectangle([tx0, ty0, tx1, ty1], radius=36, fill=(20, 30, 70, 230),
                     outline=(110, 190, 255, 255), width=8)
# notches
ld.ellipse([tx0-26, ty0+140, tx0+26, ty0+196], fill=(8, 10, 24, 255))
ld.ellipse([tx1-26, ty0+140, tx1+26, ty0+196], fill=(8, 10, 24, 255))
# dashed divider
for x in range(tx0+40, tx1-40, 34):
    ld.line([(x, ty0+168), (x+18, ty0+168)], fill=(150, 210, 255, 220), width=5)
# small bars
ld.rounded_rectangle([tx0+54, ty0+58, tx0+240, ty0+78], radius=10, fill=(120, 180, 255, 220))
ld.rounded_rectangle([tx0+54, ty0+102, tx0+160, ty0+118], radius=8, fill=(150, 130, 255, 200))
ld.rounded_rectangle([tx0+40, ty0+230, tx0+250, ty0+252], radius=10, fill=(120, 180, 255, 170))
ld.rounded_rectangle([tx0+40, ty0+272, tx0+190, ty0+290], radius=9, fill=(150, 130, 255, 150))
layer_blur = layer.filter(ImageFilter.GaussianBlur(18))
img = Image.alpha_composite(img.convert('RGBA'), layer_blur).convert('RGB')
img = Image.alpha_composite(img.convert('RGBA'), layer).convert('RGB')
d = ImageDraw.Draw(img)

# --- fonts ---
font_big = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 96)
font_mid = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 42)
font_small = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 30)
font_tag = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 26)

def rtl(s):
    return s[::-1]

def shadow_text(pos, text, font, fill, shadow=(0, 0, 0), offset=5):
    x, y = pos
    d.text((x+offset, y+offset), text, font=font, fill=shadow)
    d.text((x, y), text, font=font, fill=fill)

# --- text block (right side) ---
shadow_text((900, 300), rtl('בוט טיקטים'), font_big, (255, 255, 255))
shadow_text((905, 420), 'TICKET BOT', font_mid, (120, 200, 255))
shadow_text((905, 500), rtl('תמיכה מהירה, פרטית ומסודרת'), font_small, (210, 220, 245))
shadow_text((905, 556), rtl('כפתור אחד → קטגוריה → טיקט משלך'), font_small, (180, 195, 230))

# tag pill
pill = [905, 640, 1400, 700]
d.rounded_rectangle(pill, radius=30, fill=(40, 60, 130, 255), outline=(110, 190, 255, 255), width=3)
d.text((930, 654), rtl('בלי שם שרת • הכל בעברית • ticket-001'), font=font_tag, fill=(230, 240, 255))

# bottom line
d.line([(150, 820), (1450, 820)], fill=(90, 140, 220), width=2)
d.text((150, 838), 'SUPPORT • TICKETS • 24/7', font=font_tag, fill=(140, 170, 220))

out = 'C:/Users/yyyya/discord-ticket-bot/assets/banner.png'
img.save(out)
print('saved', out, img.size)
