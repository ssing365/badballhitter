# 투수 교체 후 새 투수 그림 — 기존 pitcher_idle.png와 같은 캔버스·크기·발 위치로 맞춤
# 실행: python3 scripts/make-second-pitcher.py  (Pillow 필요)
# 원본 assets-src/second_pitcher.png는 거의 안 보이는 반투명 테두리가 있어서 먼저 걷어내고 자름
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'assets-src', 'second_pitcher.png')
OUT = os.path.join(ROOT, 'public', 'assets', 'pitcher_second.png')

CANVAS = (165, 216)   # pitcher_idle.png 캔버스
HEIGHT = 191          # pitcher_idle.png 그림 높이
BOTTOM = 196          # pitcher_idle.png 발(마운드) 아래쪽 y
FAINT_ALPHA = 64      # 이보다 흐린 픽셀은 투명으로
CROP_ALPHA = 128      # 이 이상인 영역으로 자름

im = Image.open(SRC).convert('RGBA')
r, g, b, a = im.split()
a = a.point(lambda v: 0 if v < FAINT_ALPHA else v)
im = Image.merge('RGBA', (r, g, b, a))

box = a.point(lambda v: 255 if v >= CROP_ALPHA else 0).getbbox()
im = im.crop(box)
width = round(im.width * HEIGHT / im.height)
im = im.resize((width, HEIGHT), Image.LANCZOS)

out = Image.new('RGBA', CANVAS, (0, 0, 0, 0))
out.paste(im, ((CANVAS[0] - width) // 2, BOTTOM - HEIGHT), im)
out.save(OUT, optimize=True)
print('saved', os.path.abspath(OUT), out.size, 'content', (width, HEIGHT))
