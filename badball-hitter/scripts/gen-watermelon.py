# 수박 공 픽셀아트를 코드로 그림 — 36×36 격자를 4배 키워 144px로 저장
# 실행: python3 scripts/gen-watermelon.py  (Pillow 필요)
# 구면 조명(좌상단 빛)으로 명암 4단계 + 큰 하이라이트 + 우하단 반사광으로 윤기를 냄
import math
import os
from PIL import Image

GRID = 36
SCALE = 4
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'balls', 'watermelon.png')

def hexc(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)

# 팔레트 16색 이하
OUTLINE = hexc('#0b1a0d')
LIGHT = [hexc(c) for c in ('#3c9a2c', '#5ac53a', '#86e24c', '#b8f774')]  # 밝은 껍질: 그늘 → 기본 → 밝음 → 빛
DARK = [hexc(c) for c in ('#0b3d18', '#125a25', '#1c7a33', '#2f9a45')]   # 짙은 줄무늬
RIM = hexc('#7fe7a8')       # 우하단 반사광
SPEC = hexc('#ffffff')      # 하이라이트 중심
SPEC_SOFT = hexc('#e6ffd2')  # 하이라이트 테두리
STEM = hexc('#8cc63f')
STEM_DARK = hexc('#4f7f1f')

CX, CY, R = 18.0, 20.0, 14.6
L = (-0.5, -0.65, 0.58)
LN = math.sqrt(sum(v * v for v in L))
L = tuple(v / LN for v in L)

grid = [[None] * GRID for _ in range(GRID)]

def body(x, y):
    dx, dy = (x + 0.5 - CX) / R, (y + 0.5 - CY) / R
    return dx * dx + dy * dy <= 1.0

for y in range(GRID):
    for x in range(GRID):
        if not body(x, y):
            continue
        nx, ny = (x + 0.5 - CX) / R, (y + 0.5 - CY) / R
        nz = math.sqrt(max(0.0, 1 - nx * nx - ny * ny))
        # 줄무늬 — 경도(위아래로 모이는 세로 줄) + 2칸마다 엇갈리는 지그재그
        lon = math.atan2(nx, nz)
        zig = (0, 0.05, 0, -0.05)[y % 4]
        stripe = math.sin((lon + zig) * 8.0) > -0.1
        # 명암 — 좌상단 빛, 가장자리는 어둡게
        d = nx * L[0] + ny * L[1] + nz * L[2]
        level = 0 if d < 0.05 else 1 if d < 0.5 else 2 if d < 0.88 else 3
        grid[y][x] = (DARK if stripe else LIGHT)[level]
        # 우하단 가장자리 반사광 (테두리 바로 안쪽 한 줄)
        edge = any(not body(x + ox, y + oy) for ox, oy in ((1, 0), (0, 1), (1, 1)))
        if edge and nx > 0.15 and ny > 0.15 and nx + ny > 0.75:
            grid[y][x] = RIM

# 하이라이트 — 좌상단 큰 타원 반사 + 작은 점 하나
HX, HY = 11, 11
for y in range(GRID):
    for x in range(GRID):
        if grid[y][x] is None:
            continue
        ex, ey = (x - HX) / 2.6, (y - HY) / 1.7
        # 살짝 기울인 타원 (구 표면을 따라 비스듬히)
        rx, ry = ex * 0.85 + ey * 0.5, -ex * 0.5 + ey * 0.85
        e = rx * rx + ry * ry
        if e <= 0.55:
            grid[y][x] = SPEC
        elif e <= 1.25:
            grid[y][x] = SPEC_SOFT
for x, y in ((15, 9), (8, 15)):
    grid[y][x] = SPEC

# 꼭지 — 위로 솟았다 오른쪽으로 말림
stem = [(17, 5), (17, 4), (17, 3), (17, 2), (18, 1), (19, 1), (20, 1), (21, 2), (16, 5)]
stem_dark = [(18, 5), (18, 4), (18, 3), (18, 2), (19, 2)]
for x, y in stem:
    grid[y][x] = STEM
for x, y in stem_dark:
    grid[y][x] = STEM_DARK

# 외곽선 — 채워진 칸 바깥 4방향 이웃
filled = {(x, y) for y in range(GRID) for x in range(GRID) if grid[y][x] is not None}
for x, y in list(filled):
    for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nx, ny = x + ox, y + oy
        if 0 <= nx < GRID and 0 <= ny < GRID and (nx, ny) not in filled:
            grid[ny][nx] = OUTLINE

img = Image.new('RGBA', (GRID, GRID), (0, 0, 0, 0))
for y in range(GRID):
    for x in range(GRID):
        if grid[y][x] is not None:
            img.putpixel((x, y), grid[y][x])
img = img.resize((GRID * SCALE, GRID * SCALE), Image.NEAREST)
img.save(OUT, optimize=True)
print('saved', os.path.abspath(OUT), 'colors:', len(img.getcolors(256)) - 1)
