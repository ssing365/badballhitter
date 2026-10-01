# 수박 공을 밝고 싱그러운 초록으로 다시 칠함 — 픽셀 모양은 그대로, 색만 바꿈
# 실행: python3 scripts/brighten-watermelon.py  (Pillow 필요)
# 원본 assets-src/balls/watermelon_144.png(예전 게임용 144px)의 짙은 줄~밝은 껍질 사이 색을 새 색 사이로 옮김
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'assets-src', 'balls', 'watermelon_144.png')
OUT = os.path.join(ROOT, 'public', 'assets', 'balls', 'watermelon.png')

OLD_DARK, OLD_LIGHT = (37, 70, 30), (101, 165, 47)   # 원본 짙은 줄 / 밝은 껍질
NEW_DARK, NEW_LIGHT = (32, 80, 34), (96, 174, 50)   # 바꿀 색

im = Image.open(SRC).convert('RGBA')
px = im.load()
for y in range(im.height):
    for x in range(im.width):
        r, g, b, a = px[x, y]
        # 투명·외곽선(검정)·하이라이트(흰색)는 그대로
        if a == 0 or max(r, g, b) < 25 or min(r, g, b) > 180:
            continue
        # 초록 채널 기준으로 원본 짙은 줄(0) ~ 밝은 껍질(1) 사이 위치를 구해 새 색에 같은 위치로
        t = (g - OLD_DARK[1]) / (OLD_LIGHT[1] - OLD_DARK[1])
        px[x, y] = tuple(
            max(0, min(255, round(NEW_DARK[i] + (NEW_LIGHT[i] - NEW_DARK[i]) * t))) for i in range(3)
        ) + (a,)
im.save(OUT, optimize=True)
print('saved', os.path.abspath(OUT))
