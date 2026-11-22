"""
Farrukh Dev Hub - promo video renderer (1280x720, 30 fps, ~46 s).

Builds the video from the project's own assets (Blender avatar renders and
game screenshots) and real portfolio data, with an original synthesised
soundtrack, then encodes an MP4 with ffmpeg.

    python video/render_promo.py            # full render -> public/videos/promo.mp4
    python video/render_promo.py --preview  # a few still frames only
"""
import math, os, random, re, subprocess, sys, time
import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ASSETS = os.path.join(HERE, "assets")
FPS, W, H = 30, 1280, 720
TOTAL = 46.0
PREVIEW = "--preview" in sys.argv

CYAN, VIOLET, PINK, GREEN, AMBER, BLUE = (34, 211, 238), (139, 92, 246), (244, 114, 182), (52, 211, 153), (251, 191, 36), (96, 165, 250)

# --------------------------------------------------------------------- data
def read(p): return open(os.path.join(ROOT, p), encoding="utf-8").read()
projects_src = read("components/Projects/Projects-s.ts")
TITLES = re.findall(r'\n\s+title: "([^"]+)"', projects_src)
CATS = re.findall(r'category: "([^"]+)"', projects_src)
exp_src = read("components/Experience/ExperiencedData.ts")
EXP = list(zip(re.findall(r'year: "([^"]+)"', exp_src), re.findall(r'role: "([^"]+)"', exp_src)))
SKILL_COUNT = len(re.findall(r'category: "', read("components/Skills/skillsData.ts")))
CATEGORIES = ["Frontend", "Languages", "Backend", "Database", "DevOps", "Game Development", "AI"]
CERT_DONE = len(re.findall(r'status: "completed"', read("components/certificates/certificatesData.ts")))
short = lambda t: (t.split(" - ")[0])[:34]
cat_color = {"webdev": CYAN, "gamedev": PINK, "ai": (248, 113, 113), "devops": VIOLET}

# -------------------------------------------------------------------- fonts
F = lambda w, s: ImageFont.truetype(os.path.join(HERE, "fonts", f"orbitron-{w}.ttf"), s)
FONTS = {}
def font(w, s):
    k = (w, s)
    if k not in FONTS: FONTS[k] = F(w, s)
    return FONTS[k]

# ------------------------------------------------------------------ helpers
clamp = lambda x, a=0.0, b=1.0: max(a, min(b, x))
ease_out = lambda x: 1 - (1 - clamp(x)) ** 3
ease_io = lambda x: (lambda c: c * c * (3 - 2 * c))(clamp(x))
lerp = lambda a, b, t: a + (b - a) * t

def load(name, mode="RGB"):
    return Image.open(os.path.join(ASSETS, name)).convert(mode)
IMG = {n: load(n + ".png") for n in [
    "avatar_front_idle", "avatar_three_quarter_wave", "avatar_walk", "13-sky-night", "14-sky-day",
    "20-skill-grove", "22-arcade-hall", "29-quest-road-3d", "42-mobile-home", "23-projects-panel"]}

def cover(img, w, h, zoom=1.0, cx=0.5, cy=0.5):
    """Resize-crop `img` to exactly w x h (like CSS object-fit: cover) with optional zoom/pan."""
    s = max(w / img.width, h / img.height) * zoom
    cw, ch = w / s, h / s
    x0 = clamp(cx * img.width - cw / 2, 0, img.width - cw)
    y0 = clamp(cy * img.height - ch / 2, 0, img.height - ch)
    return img.resize((w, h), Image.BILINEAR, box=(x0, y0, x0 + cw, y0 + ch))

_mask = {}
def rmask(w, h, r):
    k = (w, h, r)
    if k not in _mask:
        m = Image.new("L", (w, h), 0)
        ImageDraw.Draw(m).rounded_rectangle((0, 0, w - 1, h - 1), r, fill=255)
        _mask[k] = m
    return _mask[k]

def tw(f, s, track=0): return sum(f.getlength(c) + track for c in s) - track if s else 0

def text(d, x, y, s, f, fill, track=0, anchor="l", alpha=1.0):
    a = int(255 * clamp(alpha))
    if a <= 0 or not s: return
    w = tw(f, s, track)
    if anchor == "m": x -= w / 2
    elif anchor == "r": x -= w
    for ch in s:
        d.text((x, y), ch, font=f, fill=fill + (a,))
        x += f.getlength(ch) + track

def window(layer_rgb, txt, img, x, y, w, h, color, alpha, zoom=1.0, cx=0.5, cy=0.5, r=18):
    """Screenshot inside a rounded, neon-outlined window."""
    pic = cover(img, w, h, zoom, cx, cy)
    m = rmask(w, h, r).point(lambda v: int(v * alpha))
    layer_rgb.paste(pic, (x, y), m)
    ImageDraw.Draw(txt).rounded_rectangle((x, y, x + w, y + h), r, outline=color + (int(230 * alpha),), width=3)

# -------------------------------------------------------- static backgrounds
rnd = random.Random(7)
STARS = [(rnd.randrange(W), rnd.randrange(int(H * 0.62)), rnd.random(), rnd.random() * 6.28) for _ in range(160)]
yy = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
top, bot = np.array([2, 4, 12], np.float32), np.array([14, 20, 52], np.float32)
BG = (top * (1 - yy) + bot * yy) * np.ones((H, W, 3), np.float32)
vx = np.linspace(-1, 1, W, dtype=np.float32)[None, :]
vy = np.linspace(-1, 1, H, dtype=np.float32)[:, None]
VIGNETTE = (1.0 - 0.55 * np.clip(np.sqrt(vx ** 2 * 0.8 + vy ** 2) - 0.45, 0, 1) ** 1.4)[..., None]

def background(t):
    img = Image.fromarray(BG.astype(np.uint8))
    d = ImageDraw.Draw(img)
    for x, y, b, ph in STARS:
        v = int(90 + 120 * b * (0.6 + 0.4 * math.sin(t * 1.5 + ph)))
        d.point((x, y), fill=(v, v, min(255, v + 30)))
    # perspective grid on a half-resolution canvas, upscaled for a soft neon look
    g = Image.new("RGB", (W // 2, H // 2), (0, 0, 0))
    gd = ImageDraw.Draw(g)
    hz, w2, h2 = int(H * 0.56) // 2, W // 2, H // 2
    for i in range(-14, 15):
        gd.line((w2 / 2 + i * 6, hz, w2 / 2 + i * 62, h2), fill=(10, 70, 90), width=1)
    off = (t * 0.35) % 1
    for k in range(14):
        p = ((k + off) / 14) ** 2.2
        gd.line((0, hz + (h2 - hz) * p, w2, hz + (h2 - hz) * p), fill=(14, 100, 125), width=1)
    gd.line((0, hz, w2, hz), fill=(60, 200, 230), width=1)
    g = g.resize((W, H), Image.BILINEAR)
    return ImageChops.add(img, g)

def glow(txt, strength=1.0):
    """Cheap bloom: blur a 1/4-res copy of the text layer and add it back."""
    small = txt.resize((W // 4, H // 4), Image.BOX)
    arr = np.asarray(small, np.float32)
    rgb = arr[..., :3] * (arr[..., 3:4] / 255.0)
    s = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))
    return np.asarray(s.resize((W, H), Image.BILINEAR), np.float32) * strength

# ----------------------------------------------------------------- scenes
# boundaries (seconds)
B = [0, 5, 11.5, 18.5, 25, 32, 37.5, 42, TOTAL]
XF = 0.55

def label(d, t, n, s, color, a=1.0):
    text(d, 70, 62, f"0{n} / {s}", font("500", 20), color, 4, alpha=a)

def scene_intro(t, rgb, txt):
    d = ImageDraw.Draw(txt)
    name, f = "FARRUKH", font("700", 150)
    total_w = tw(f, name, 10)
    x = W / 2 - total_w / 2
    for i, ch in enumerate(name):
        st = 0.35 + 0.13 * i
        p = ease_out((t - st) / 0.5)
        jitter = 0
        if 1.7 < t < 1.85: jitter = random.Random(int(t * 60)).randint(-9, 9)
        if p > 0:
            for dx, col in ((-3 if jitter else 0, (255, 60, 120)), (3 if jitter else 0, (60, 230, 255))):
                if jitter: d.text((x + jitter + dx, 232 + (1 - p) * 40), ch, font=f, fill=col + (int(110 * p),))
            d.text((x + jitter, 232 + (1 - p) * 40), ch, font=f, fill=CYAN + (int(255 * p),))
        x += f.getlength(ch) + 10
    text(d, W / 2, 428, "GAME DEVELOPER  •  FULL STACK  •  AI", font("500", 30), (203, 213, 225), 5, "m", ease_out((t - 2.2) / 0.7))
    p = ease_out((t - 3.1) / 0.6)
    w = tw(font("700", 22), "PLAYABLE 3D PORTFOLIO", 6) + 50
    if p > 0:
        d.rounded_rectangle((W / 2 - w / 2, 490, W / 2 + w / 2, 538), 24, outline=VIOLET + (int(255 * p),), width=3)
        text(d, W / 2, 502, "PLAYABLE 3D PORTFOLIO", font("700", 22), (196, 181, 253), 6, "m", p)

def scene_avatar(t, rgb, txt):
    d = ImageDraw.Draw(txt)
    label(d, t, 1, "THE PLAYER", VIOLET, ease_out(t / 0.5))
    text(d, 70, 120, "MEET MY", font("700", 66), (226, 232, 240), 3, alpha=ease_out((t - 0.1) / 0.6))
    text(d, 70, 196, "AVATAR", font("700", 96), VIOLET, 4, alpha=ease_out((t - 0.25) / 0.6))
    lines = ["Modelled & rigged in Blender", "Idle  •  Walk  •  Wave animations", "Exported as GLB for the web"]
    for i, s in enumerate(lines):
        p = ease_out((t - 0.9 - 0.45 * i) / 0.6)
        d.ellipse((70, 368 + i * 62 + 8, 84, 368 + i * 62 + 22), fill=CYAN + (int(255 * p),))
        text(d, 104 + (1 - p) * 30, 362 + i * 62, s, font("500", 25), (203, 213, 225), 1, alpha=p)
    # avatar card (cycles through the 3 renders)
    names = ["avatar_front_idle", "avatar_three_quarter_wave", "avatar_walk"]
    cw, ch, cx0, cy0 = 470, 590, 720, 66
    enter = ease_out((t - 0.2) / 0.8)
    idx = min(2, int(max(0, t - 0.6) // 1.9)); nxt = min(2, idx + 1)
    mix = ease_io(((t - 0.6) % 1.9 - 1.5) / 0.4) if (t - 0.6) > 0 and idx < 2 else 0
    pic = cover(IMG[names[idx]], cw, ch, 1.18, 0.5, 0.56)
    if mix > 0: pic = Image.blend(pic, cover(IMG[names[nxt]], cw, ch, 1.18, 0.5, 0.56), mix)
    y = cy0 + math.sin(t * 1.6) * 6 + (1 - enter) * 50
    m = rmask(cw, ch, 28).point(lambda v: int(v * enter))
    for r_i in range(3):  # expanding pulse rings behind the card
        pr = ((t * 0.6 + r_i / 3) % 1)
        rad = 250 + pr * 160
        d.ellipse((cx0 + cw / 2 - rad, y + ch / 2 - rad, cx0 + cw / 2 + rad, y + ch / 2 + rad), outline=VIOLET + (int(70 * (1 - pr) * enter),), width=2)
    rgb.paste(pic, (cx0, int(y)), m)
    d.rounded_rectangle((cx0, y, cx0 + cw, y + ch), 28, outline=CYAN + (int(230 * enter),), width=3)

def scene_world(t, rgb, txt):
    d = ImageDraw.Draw(txt)
    night, day = IMG["13-sky-night"], IMG["14-sky-day"]
    zoom = 1.32 + 0.08 * (t / 7)
    pic = cover(night, W, H, zoom, 0.70, 0.40)
    mix = ease_io((t - 3.4) / 0.7)
    if mix > 0: pic = Image.blend(pic, cover(day, W, H, zoom, 0.70, 0.40), mix)
    arr = np.asarray(pic, np.float32)
    gx = np.clip(1 - np.linspace(0, 1, W) / 0.78, 0, 1)[None, :, None] ** 0.8
    pic = Image.fromarray((arr * (1 - 0.93 * gx)).astype(np.uint8))
    rgb.paste(pic, (0, 0))
    label(d, t, 2, "THE WORLD", CYAN, ease_out(t / 0.5))
    text(d, 70, 250, "A PLAYABLE", font("700", 54), (226, 232, 240), 3, alpha=ease_out((t - 0.2) / 0.6))
    text(d, 70, 316, "3D ISLAND", font("700", 88), CYAN, 3, alpha=ease_out((t - 0.4) / 0.6))
    text(d, 70, 436, "9 zones  •  collect XP  •  built with Three.js", font("500", 24), (203, 213, 225), 1, alpha=ease_out((t - 0.9) / 0.6))
    isday = t > 3.9
    w = 150
    d.rounded_rectangle((70, 500, 70 + w, 546), 23, outline=(AMBER if isday else BLUE) + (255,), width=3)
    text(d, 70 + w / 2, 512, "DAY" if isday else "NIGHT", font("700", 20), AMBER if isday else BLUE, 4, "m", ease_out((t - 1.2) / 0.5))

def scene_skills(t, rgb, txt):
    d = ImageDraw.Draw(txt)
    label(d, t, 3, "SKILL GROVE", GREEN, ease_out(t / 0.5))
    n = int(SKILL_COUNT * ease_out((t - 0.5) / 1.8))
    text(d, 66, 100, str(n), font("700", 210), GREEN, 2, alpha=ease_out((t - 0.2) / 0.5))
    text(d, 74, 338, "SKILLS TO COLLECT", font("700", 36), (226, 232, 240), 3, alpha=ease_out((t - 1.0) / 0.6))
    text(d, 74, 392, "walk into an orb  →  +10 XP", font("500", 22), (148, 163, 184), 1, alpha=ease_out((t - 1.4) / 0.6))
    x, y = 74, 460
    cols = [CYAN, GREEN, BLUE, AMBER, (248, 113, 113), PINK, VIOLET]
    for i, c in enumerate(CATEGORIES):
        f = font("500", 18); w = tw(f, c.upper(), 2) + 34
        if x + w > 620: x, y = 74, y + 52
        p = ease_out((t - 1.8 - 0.14 * i) / 0.5)
        d.rounded_rectangle((x, y, x + w, y + 38), 19, outline=cols[i] + (int(255 * p),), width=2)
        text(d, x + 17, y + 8, c.upper(), f, cols[i], 2, alpha=p)
        x += w + 12
    p = ease_out((t - 0.3) / 0.8)
    window(rgb, txt, IMG["20-skill-grove"], 668, int(98 + math.sin(t * 1.4) * 7 + (1 - p) * 40), 560, 520, GREEN, p, 1.08 + 0.05 * (t / 6.5), 0.5, 0.5)

def scene_projects(t, rgb, txt):
    d = ImageDraw.Draw(txt)
    label(d, t, 4, "ARCADE HALL", PINK, ease_out(t / 0.5))
    text(d, 70, 104, "MY PROJECTS", font("700", 62), (226, 232, 240), 3, alpha=ease_out((t - 0.1) / 0.6))
    text(d, 70, 182, "search  •  filter  •  quest board", font("500", 22), (148, 163, 184), 1, alpha=ease_out((t - 0.5) / 0.6))
    for i, (ti, ca) in enumerate(zip(TITLES, CATS)):
        p = ease_out((t - 0.9 - 0.28 * i) / 0.55)
        c = cat_color.get(ca, VIOLET); y = 250 + i * 66
        d.rounded_rectangle((70 + (1 - p) * 60, y, 650 + (1 - p) * 60, y + 54), 14, outline=c + (int(210 * p),), width=2)
        d.ellipse((90 + (1 - p) * 60, y + 19, 106 + (1 - p) * 60, y + 35), fill=c + (int(255 * p),))
        text(d, 126 + (1 - p) * 60, y + 13, short(ti).upper(), font("500", 18), (226, 232, 240), 1, alpha=p)
    p = ease_out((t - 0.3) / 0.8)
    window(rgb, txt, IMG["22-arcade-hall"], 690, int(110 + math.sin(t * 1.3) * 7 + (1 - p) * 40), 540, 500, PINK, p, 1.12 + 0.05 * (t / 7), 0.72, 0.62)

def scene_journey(t, rgb, txt):
    d = ImageDraw.Draw(txt)
    pic = cover(IMG["29-quest-road-3d"], W, H, 1.04 + 0.06 * (t / 5.5), 0.5, 0.5)
    arr = np.asarray(pic, np.float32) * 0.38
    rgb.paste(Image.fromarray(arr.astype(np.uint8)), (0, 0))
    label(d, t, 5, "QUEST ROAD", AMBER, ease_out(t / 0.5))
    text(d, 70, 104, "THE JOURNEY", font("700", 66), (226, 232, 240), 3, alpha=ease_out((t - 0.1) / 0.6))
    line_p = ease_out((t - 0.6) / 1.4)
    d.line((140, 250, 140, 250 + 330 * line_p), fill=AMBER + (200,), width=3)
    for i, (yr, role) in enumerate(EXP):
        p = ease_out((t - 0.9 - 0.45 * i) / 0.6); y = 244 + i * 92
        edu = "BS" in role
        c = BLUE if edu else AMBER
        d.ellipse((128, y + 8, 152, y + 32), fill=(5, 8, 20, 255), outline=c + (int(255 * p),), width=3)
        text(d, 190 + (1 - p) * 40, y, yr, font("700", 30), c, 2, alpha=p)
        text(d, 338 + (1 - p) * 40, y + 5, role.upper(), font("500", 24), (226, 232, 240), 1, alpha=p)
    p = ease_out((t - 3.2) / 0.7)
    text(d, 70, 640, f"{CERT_DONE} certificates earned  •  3 years of learning", font("500", 22), (148, 163, 184), 1, alpha=p)

def scene_features(t, rgb, txt):
    d = ImageDraw.Draw(txt)
    label(d, t, 6, "UNDER THE HOOD", VIOLET, ease_out(t / 0.5))
    text(d, 70, 104, "MORE THAN A PAGE", font("700", 54), (226, 232, 240), 3, alpha=ease_out((t - 0.1) / 0.6))
    cards = [("AI CHATBOT", "RAG answers grounded in my CV", VIOLET), ("CONTACT TERMINAL", "validated form, real email", GREEN), ("DAY / NIGHT", "themes, sound, accessible", AMBER), ("MOBILE READY", "touch joystick & menu", CYAN)]
    for i, (a, b, c) in enumerate(cards):
        p = ease_out((t - 0.6 - 0.35 * i) / 0.55); y = 200 + i * 106
        d.rounded_rectangle((70 + (1 - p) * 50, y, 700 + (1 - p) * 50, y + 90), 18, outline=c + (int(220 * p),), width=2)
        text(d, 104 + (1 - p) * 50, y + 14, a, font("700", 26), c, 2, alpha=p)
        text(d, 104 + (1 - p) * 50, y + 52, b, font("500", 20), (203, 213, 225), 1, alpha=p)
    p = ease_out((t - 0.4) / 0.8)
    pw, ph = 290, 590
    window(rgb, txt, IMG["42-mobile-home"], 880, int(66 + math.sin(t * 1.5) * 6 + (1 - p) * 50), pw, ph, CYAN, p, 1.0, 0.5, 0.5, 34)

def scene_outro(t, rgb, txt):
    d = ImageDraw.Draw(txt)
    p = ease_out(t / 0.8)
    text(d, W / 2, 190, "EXPLORE THE", font("700", 56), (226, 232, 240), 6, "m", p)
    text(d, W / 2, 262, "DEV HUB", font("700", 150), CYAN, 8, "m", ease_out((t - 0.2) / 0.8))
    text(d, W / 2, 452, "FARRUKH", font("700", 36), VIOLET, 14, "m", ease_out((t - 1.0) / 0.6))
    blink = 0.35 + 0.65 * (0.5 + 0.5 * math.sin(t * 5))
    text(d, W / 2, 548, "PRESS START", font("700", 30), AMBER, 8, "m", ease_out((t - 1.6) / 0.5) * blink)

SCENES = [scene_intro, scene_avatar, scene_world, scene_skills, scene_projects, scene_journey, scene_features, scene_outro]

def frame(t):
    base = background(t)
    img = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8))
    txt_all = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for i, fn in enumerate(SCENES):
        s, e = B[i], B[i + 1]
        if t < s or t >= e + (XF if i < len(SCENES) - 1 else 0): continue
        a_in = 1.0 if i == 0 else ease_io((t - s) / XF)
        a_out = 1.0 if t < e or i == len(SCENES) - 1 else 1 - ease_io((t - e) / XF)
        a = min(a_in, a_out)
        rgb = Image.new("RGB", (W, H), (0, 0, 0)); layer_mask = Image.new("L", (W, H), 0)
        txt = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        fn(t - s, rgb, txt)
        # RGB content only where something was pasted (non-black); blend by `a`
        mask = rgb.convert("L").point(lambda v: 255 if v > 0 else 0).filter(ImageFilter.MaxFilter(3))
        img.paste(rgb, (0, 0), mask.point(lambda v: int(v * a)))
        if a < 1.0:
            al = txt.getchannel("A").point(lambda v: int(v * a)); txt.putalpha(al)
        txt_all = Image.alpha_composite(txt_all, txt)
    # global progress bar
    ImageDraw.Draw(txt_all).rectangle((0, H - 5, int(W * t / TOTAL), H), fill=CYAN + (230,))
    out = np.asarray(img, np.float32) + glow(txt_all, 1.15)
    out = np.asarray(Image.alpha_composite(Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).convert("RGBA"), txt_all).convert("RGB"), np.float32)
    return np.clip(out * VIGNETTE, 0, 255).astype(np.uint8)

# ------------------------------------------------------------------ audio
def synth(path):
    sr, n = 44100, int(TOTAL * 44100)
    t = np.arange(n) / sr
    bpm = 110; beat = 60 / bpm
    out = np.zeros(n, np.float32)
    rng = np.random.default_rng(3)

    def env(len_s, a=0.005, r=0.2):
        m = int(len_s * sr); e = np.ones(m, np.float32)
        ai = max(1, int(a * sr)); e[:ai] = np.linspace(0, 1, ai)
        ri = min(m, int(r * sr)); e[m - ri:] *= np.linspace(1, 0, ri)
        return e
    def add(at, sig):
        i = int(at * sr); j = min(n, i + len(sig))
        if i < n: out[i:j] += sig[: j - i]
    def lowpass(x, k):
        c = np.cumsum(x, dtype=np.float64); y = (c[k:] - c[:-k]) / k
        return np.concatenate([np.zeros(k, np.float32), y.astype(np.float32)])
    def saw(f, L): tt = np.arange(int(L * sr)) / sr; return 2 * ((tt * f) % 1) - 1
    def sq(f, L): return np.sign(np.sin(2 * np.pi * f * np.arange(int(L * sr)) / sr))
    hz = lambda m: 440 * 2 ** ((m - 69) / 12)

    chords = [(57, [57, 60, 64]), (53, [53, 57, 60]), (48, [48, 52, 55]), (55, [55, 59, 62])]  # Am F C G
    bar = beat * 4
    nbars = int(TOTAL / bar) + 1
    for b in range(nbars):
        root, notes = chords[b % 4]; t0 = b * bar
        if t0 >= TOTAL: break
        intro = b < 2
        # pad
        pad = sum(saw(hz(m) * (1 + d), bar) for m in notes for d in (-0.004, 0.004)) / 6
        pad = lowpass(pad, 40) * env(bar, 0.4, 0.5) * (0.30 if intro else 0.24)
        add(t0, pad)
        # arpeggio (16ths)
        for s in range(16):
            nm = notes[[0, 1, 2, 1][s % 4]] + (12 if (s // 4) % 2 else 24)
            add(t0 + s * beat / 4, sq(hz(nm), beat / 4) * env(beat / 4, 0.002, 0.12) * (0.045 if intro else 0.07))
        if intro: continue
        # bass (8ths)
        for s in range(8):
            add(t0 + s * beat / 2, lowpass(saw(hz(root - 12), beat / 2), 14) * env(beat / 2, 0.003, 0.08) * 0.42)
        # drums
        for q in range(4):
            tk = t0 + q * beat
            kd = np.arange(int(0.18 * sr)) / sr
            add(tk, np.sin(2 * np.pi * (45 + 110 * np.exp(-kd * 28)) * kd) * np.exp(-kd * 14) * 0.9)
            add(tk + beat / 2, (rng.standard_normal(int(0.04 * sr)).astype(np.float32) * np.linspace(1, 0, int(0.04 * sr)) ** 2) * 0.09)
            if q in (1, 3):
                sn = rng.standard_normal(int(0.16 * sr)).astype(np.float32)
                add(tk, (sn - lowpass(sn, 6)) * np.linspace(1, 0, len(sn)) ** 2 * 0.25)
    # whooshes on scene changes
    for tb in B[1:-1]:
        L = int(0.7 * sr); x = rng.standard_normal(L).astype(np.float32)
        x = (x - lowpass(x, 40)) * (np.sin(np.linspace(0, np.pi, L)) ** 2) * 0.16
        add(tb - 0.35, x)
    out = np.tanh(out * 1.3)
    fade = np.ones(n, np.float32); fi, fo = int(1.2 * sr), int(2.5 * sr)
    fade[:fi] = np.linspace(0, 1, fi); fade[-fo:] = np.linspace(1, 0, fo)
    out *= fade * 0.55
    st = np.stack([out, np.roll(out, 90) * 0.97], 1)  # tiny Haas offset for width
    import wave
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((np.clip(st, -1, 1) * 32767).astype("<i2").tobytes())

# ------------------------------------------------------------------- main
if PREVIEW:
    out = os.path.join(HERE, "preview"); os.makedirs(out, exist_ok=True)
    for tt in (2.4, 8.0, 14.5, 17.0, 22.5, 29.0, 34.5, 39.5, 44.0):
        Image.fromarray(frame(tt)).save(os.path.join(out, f"t{tt:05.1f}.png"))
    print("previews ->", out); sys.exit()

os.makedirs(os.path.join(ROOT, "public", "videos"), exist_ok=True)
wav = os.path.join(HERE, "audio", "promo-music.wav")
mp4 = os.path.join(ROOT, "public", "videos", "promo.mp4")
t0 = time.time(); synth(wav); print(f"audio ready ({time.time()-t0:.1f}s)", flush=True)
cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
       "-i", wav, "-c:v", "libx264", "-preset", "fast", "-crf", "21", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k",
       "-shortest", "-movflags", "+faststart", mp4]
p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
N = int(TOTAL * FPS)
for i in range(N):
    p.stdin.write(frame(i / FPS).tobytes())
    if i % 60 == 0: print(f"frame {i}/{N}  ({time.time()-t0:.0f}s)", flush=True)
p.stdin.close(); p.wait()
Image.fromarray(frame(3.8)).convert("RGB").save(os.path.join(ROOT, "public", "videos", "promo-poster.jpg"), quality=88)
print("DONE", mp4, f"{os.path.getsize(mp4)/1e6:.1f} MB", f"{time.time()-t0:.0f}s")
