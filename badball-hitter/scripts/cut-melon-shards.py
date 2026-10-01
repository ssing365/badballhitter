# 깨진 수박 그림(assets-src/balls/crash_watermelon.png)에서 파편만 잘라 스프라이트 시트로 저장
# 실행: python3 scripts/cut-melon-shards.py  (Pillow 필요) → 출력된 MELON_SHARDS를 constants.js에 붙여넣기
# 큰 수박 몸통(가장 큰 덩어리)과 노란 충격선은 빼고, 수박 조각·씨·과즙 덩어리만 남김
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'assets-src', 'balls', 'crash_watermelon.png')
OUT = os.path.join(ROOT, 'public', 'assets', 'balls', 'melon_shards.png')
SIZE = 256  # 원본 전체를 이 크기로 줄인 뒤 자름
GAP = 2

im = Image.open(SRC).convert('RGBA')
px = im.load()
for y in range(im.height):
    for x in range(im.width):
        r, g, b, a = px[x, y]
        # 배경 지우고 남은 흰 반투명 얼룩 + 조각 틈의 회백색 제거
        if a < 160 or (min(r, g, b) > 120 and max(r, g, b) - min(r, g, b) < 40):
            px[x, y] = (0, 0, 0, 0)
        else:
            px[x, y] = (r, g, b, 255)
l, t, r, b = im.getbbox()
side = max(r - l, b - t) + 16
cx, cy = (l + r) // 2, (t + b) // 2
im = im.crop((cx - side // 2, cy - side // 2, cx - side // 2 + side, cy - side // 2 + side))
# 알파 곱한 색으로 줄여야 테두리가 검게 번지지 않음
im = im.convert('RGBa').resize((SIZE, SIZE), Image.BOX).convert('RGBA')
im.putalpha(im.getchannel('A').point(lambda v: 255 if v >= 128 else 0))
px = im.load()

# 8방향 연결 덩어리 찾기
seen = set()
comps = []
for y in range(SIZE):
    for x in range(SIZE):
        if px[x, y][3] and (x, y) not in seen:
            stack, pts = [(x, y)], []
            seen.add((x, y))
            while stack:
                qx, qy = stack.pop()
                pts.append((qx, qy))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        n = (qx + dx, qy + dy)
                        if 0 <= n[0] < SIZE and 0 <= n[1] < SIZE and n not in seen and px[n][3]:
                            seen.add(n)
                            stack.append(n)
            comps.append(pts)
comps.sort(key=len, reverse=True)

def is_spark(pts):
    yellow = sum(1 for p in pts if px[p][0] > 200 and px[p][1] > 180 and px[p][2] < 100)
    return yellow / len(pts) > 0.5

# 몸통(가장 큰 덩어리)·충격선·잡티 제외
shards = [c for c in comps[1:] if not is_spark(c) and len(c) >= 120]

# 가로 한 줄 시트로 배치
boxes = []
for c in shards:
    xs = [p[0] for p in c]
    ys = [p[1] for p in c]
    boxes.append((min(xs), min(ys), max(xs) + 1, max(ys) + 1, c))
sheet_w = sum(bx[2] - bx[0] for bx in boxes) + GAP * (len(boxes) - 1)
sheet_h = max(bx[3] - bx[1] for bx in boxes)
sheet = Image.new('RGBA', (sheet_w, sheet_h), (0, 0, 0, 0))
rects = []
ox = 0
for x0, y0, x1, y1, c in boxes:
    for x, y in c:  # 상자 안 다른 덩어리가 섞이지 않게 자기 픽셀만 복사
        sheet.putpixel((ox + x - x0, y - y0), px[x, y])
    w, h = x1 - x0, y1 - y0
    rects.append((ox, 0, w, h, len(c) >= 400))
    ox += w + GAP
sheet.save(OUT, optimize=True)

print(f'saved {os.path.abspath(OUT)} {sheet_w}x{sheet_h}, {len(rects)} shards')
print(f'export const MELON_SHARDS_SIZE = [{sheet_w}, {sheet_h}]')
print('export const MELON_SHARDS = [')
for x, y, w, h, big in rects:
    print(f'  {{ x: {x}, y: {y}, w: {w}, h: {h}, big: {str(big).lower()} }},')
print(']')
