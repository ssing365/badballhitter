"""타자 유니폼 색 시안 — batter_{idle,swing_l,swing_r}.png의 파랑·빨강을 다른 색으로 바꿔 보기

원본 그림은 안티앨리어싱 때문에 색이 많아서 팔레트 스왑 대신 HSV 범위로 골라 바꾼다.
- 파랑(H 180~260°): 헬멧(helmet)·상의·바지 라인(jersey)
- 빨강(H 335~12°): 헬멧 챙(brim)·이니셜 글자(letter)·벨트·소매·신발(trim)
- 피부·배트(H 12~60°), 흰색, 외곽선(검정)은 그대로
- 색은 '#RRGGBB'. 원본 기준색(BLUE_REF·RED_REF) 자리가 정확히 그 색이 되고, 밝은 면·그림자는 기준색 대비 비율 그대로
- 글자: 헬멧 흰 패치 안의 빨강 덩어리(검정·파랑에 안 닿는 빨강)를 지우고 5×5 비트맵 글자를 같은 자리에 찍음
- jersey='pinstripe': 몸통(y >= BODY_Y)의 파랑을 흰색으로 바꾸고 흰 부분에 세로 검정 줄무늬

사용: python3 scripts/recolor-batter.py <출력 폴더> [키=값 ...]
- 키=값 없으면 VARIANTS 전부, 있으면 그 값으로 만든 'custom' 시안 하나
  예) python3 scripts/recolor-batter.py out helmet=#1E3A8A brim=#F5C400 initial=S
- teams: TEAMS 구단 시안 10개
- 색 이름 black·white도 됨 (NAMED)
- --assets: 비교 시트 없이 개별 PNG만 — 게임 팀 타자 그림은
  python3 scripts/recolor-batter.py public/assets/batters teams --assets
→ <폴더>/<시안>_<포즈>.png 개별 그림 + batter-uniforms.png 비교 시트
"""
import colorsys
import os
import sys

from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets')
POSES = ['idle', 'swing_l', 'swing_r']
BODY_Y = 120  # 이 줄부터 몸통 (헬멧 귀덮개가 ~115까지 내려옴)
STRIPE_PERIOD = 10  # 줄무늬 간격 px (원본 픽셀아트 한 칸 ≈ 5px)
STRIPE_WIDTH = 2
BLUE_REF = '#006EE6'  # 원본 파랑 최빈색
RED_REF = '#FE251B'  # 원본 빨강 최빈색

# 부위 키: helmet·jersey(파랑 자리), brim·letter·trim(빨강 자리), patch(글자 뒤 흰 패치), initial(글자)
# main = helmet+jersey, accent = brim+letter+trim 단축 키. 없는 키는 원본 유지
VARIANTS = {
    'red': {'main': '#DB0000', 'accent': '#3F3F3F'},  # 빨강 + 검정 포인트
    'orange': {'main': '#FD6500', 'accent': '#3F3F3F'},  # 주황 + 검정 포인트
    'pinstripe': {'helmet': '#454545', 'jersey': 'pinstripe', 'accent': '#3F3F3F'},  # 흰 유니폼 + 검정 줄무늬, 헬멧은 검정
}

# 구단 시안 — `teams` 인자로 실행
TEAMS = {
    'kt': {'helmet': 'black', 'jersey': 'white', 'brim': '#AF917B', 'letter': 'white', 'patch': 'black', 'trim': 'black', 'initial': 'K'},
    'samsung': {'helmet': '#064CA1', 'jersey': '#064CA1', 'brim': '#064CA1', 'letter': 'white', 'patch': '#064CA1', 'trim': '#064CA1', 'initial': 'S'},
    'kia': {'helmet': '#EA0029', 'jersey': 'black', 'brim': '#EA0029', 'letter': 'black', 'patch': '#EA0029', 'trim': '#EA0029', 'initial': 'K'},
    'lg': {'helmet': 'black', 'jersey': 'pinstripe', 'brim': '#C7014E', 'letter': '#C7014E', 'patch': 'black', 'trim': 'black', 'initial': 'T'},
    'doosan': {'helmet': '#191748', 'jersey': 'white', 'brim': '#191748', 'letter': 'white', 'patch': '#191748', 'trim': '#D00E31', 'initial': 'D'},
    'ssg': {'helmet': '#052E2B', 'jersey': '#052E2B', 'brim': '#052E2B', 'letter': 'white', 'patch': '#052E2B', 'trim': 'white', 'initial': 'S'},
    'nc': {'helmet': '#00275A', 'jersey': '#AF917B', 'brim': '#00275A', 'letter': '#AF917B', 'patch': '#00275A', 'trim': '#00275A', 'initial': 'N'},
    'lotte': {'helmet': '#0C2340', 'jersey': '#0C2340', 'brim': '#0C2340', 'letter': '#D00E31', 'patch': '#0C2340', 'trim': '#0C2340', 'initial': 'G'},
    'hanwha': {'helmet': 'black', 'jersey': '#FC4E00', 'brim': 'black', 'letter': '#FC4E00', 'patch': 'black', 'trim': '#FC4E00', 'initial': 'E'},
    'kiwoom': {'helmet': '#E4017F', 'jersey': 'white', 'brim': '#E4017F', 'letter': '#570514', 'patch': 'white', 'trim': '#E4017F', 'initial': 'K'},
}
# 이름으로 쓰는 색 — black은 외곽선(검정)과 구분되게 살짝 밝게
NAMED = {'black': '#2A2A2A', 'white': '#FFFFFF'}

# 5×5 글자 (원본 K와 같은 칸 격자)
FONT = {
    'K': ['X...X', 'X..X.', 'XXX..', 'X..X.', 'X...X'],
    'S': ['.XXXX', 'X....', '.XXX.', '....X', 'XXXX.'],
    'L': ['X....', 'X....', 'X....', 'X....', 'XXXXX'],
    'E': ['XXXXX', 'X....', 'XXXX.', 'X....', 'XXXXX'],
    'D': ['XXXX.', 'X...X', 'X...X', 'X...X', 'XXXX.'],
    'N': ['X...X', 'XX..X', 'X.X.X', 'X..XX', 'X...X'],
    'G': ['.XXXX', 'X....', 'X..XX', 'X...X', '.XXXX'],
    'T': ['XXXXX', '..X..', '..X..', '..X..', '..X..'],
}


def classify(r, g, b):
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    h *= 360
    if v < 0.2:
        return 'dark', h, s, v
    if s < 0.2:
        return 'white', h, s, v
    if 180 <= h <= 260:
        return 'blue', h, s, v
    if h >= 335 or h < 12:
        return 'red', h, s, v
    return 'other', h, s, v


def hex_rgb(code):
    code = NAMED.get(code, code).lstrip('#')
    return tuple(int(code[i:i + 2], 16) for i in (0, 2, 4))


def hex_hsv(code):
    r, g, b = hex_rgb(code)
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    return h * 360, s, v


def to_rgb(h, s, v):
    r, g, b = colorsys.hsv_to_rgb((h % 360) / 360, min(s, 1), min(v, 1))
    return round(r * 255), round(g * 255), round(b * 255)


def shift(target, ref, s, v):
    # 기준색 자리 = target, 나머지는 기준색 대비 채도·명도 비율 유지
    th, ts, tv = hex_hsv(target)
    _, rs, rv = hex_hsv(ref)
    return to_rgb(th, ts * s / rs, tv * v / rv)


def parts(cfg):
    out = {}
    for k in ('helmet', 'jersey'):
        out[k] = cfg.get(k, cfg.get('main'))
    for k in ('brim', 'letter', 'trim'):
        out[k] = cfg.get(k, cfg.get('accent'))
    out['patch'] = cfg.get('patch')
    out['initial'] = cfg.get('initial')
    return out


def find_letter(im):
    """헬멧 이니셜 — 머리 쪽 빨강 중 검정·파랑에 안 닿는(흰 패치에 둘러싸인) 덩어리. (글자 픽셀 집합, 패치 픽셀 집합)"""
    px = im.load()
    W, H = im.width, min(im.height, BODY_Y)

    def kind(x, y):
        r, g, b, a = px[x, y]
        return 'none' if a == 0 else classify(r, g, b)[0]

    seen = set()
    for y0 in range(H):
        for x0 in range(W):
            if (x0, y0) in seen or kind(x0, y0) != 'red':
                continue
            comp, stack, touches = set(), [(x0, y0)], set()
            while stack:
                x, y = stack.pop()
                if (x, y) in comp:
                    continue
                comp.add((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if not (0 <= nx < W and 0 <= ny < H):
                        touches.add('edge')
                        continue
                    k = kind(nx, ny)
                    if k == 'red':
                        stack.append((nx, ny))
                    else:
                        touches.add(k)
            seen |= comp
            if len(comp) > 50 and touches <= {'white', 'other'}:
                return comp, white_around(im, comp)
    raise RuntimeError('헬멧 글자를 못 찾음')


def white_around(im, letter):
    """글자를 둘러싼 흰 패치 (글자 왼쪽 흰 픽셀에서 흰색만 채우기)"""
    px = im.load()
    x, y = min(letter)
    x -= 2
    patch, stack = set(), [(x, y)]
    while stack:
        x, y = stack.pop()
        if (x, y) in patch or (x, y) in letter or not (0 <= x < im.width and 0 <= y < BODY_Y):
            continue
        r, g, b, a = px[x, y]
        if a == 0 or classify(r, g, b)[0] != 'white':
            continue
        patch.add((x, y))
        stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    # 가장자리 1px — 흰색·헬멧색이 섞인 경계 픽셀도 패치로 (안 하면 패치색을 바꿨을 때 흐린 네모 테두리가 남음)
    edge = set()
    for x, y in patch:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                n = (x + dx, y + dy)
                if n in patch or n in letter or not (0 <= n[0] < im.width and 0 <= n[1] < BODY_Y):
                    continue
                r, g, b, a = px[n]
                if a and classify(r, g, b)[0] not in ('dark', 'red'):
                    edge.add(n)
    return patch | edge


def glyph_pixels(letter, ch):
    """원본 글자 bbox를 5×5 칸으로 나눠 ch 모양 칸에 해당하는 픽셀"""
    xs = [x for x, _ in letter]
    ys = [y for _, y in letter]
    x0, x1, y0, y1 = min(xs), max(xs) + 1, min(ys), max(ys) + 1
    cx = [round(x0 + (x1 - x0) * i / 5) for i in range(6)]
    cy = [round(y0 + (y1 - y0) * i / 5) for i in range(6)]
    out = set()
    for j, row in enumerate(FONT[ch]):
        for i, cell in enumerate(row):
            if cell == 'X':
                # 칸을 오른쪽·아래로 1px 넓혀 원본 K만큼 굵게 (획 ~6px, 틈 ~3px)
                out |= {(x, y) for x in range(cx[i], min(cx[i + 1] + 1, x1)) for y in range(cy[j], min(cy[j + 1] + 1, y1))}
    return out


def recolor(im, cfg):
    p = parts(cfg)
    pinstripe = p['jersey'] == 'pinstripe'
    letter, patch = find_letter(im)
    # 글자 bbox (+1px 안티앨리어싱 테두리) — 다른 글자로 바꿀 땐 통째로 패치색으로 지움
    xs, ys = [x for x, _ in letter], [y for _, y in letter]
    box = {(x, y) for x in range(min(xs) - 1, max(xs) + 2) for y in range(min(ys) - 1, max(ys) + 2)}
    # K는 원본 손그림 K(5×5 글자보다 굵음)를 그대로 두고 색만 바꿈
    new_letter = glyph_pixels(letter, p['initial']) if p['initial'] not in (None, 'K') else None
    out = im.copy()
    src, dst = im.load(), out.load()
    patch_rgb = hex_rgb(p['patch']) if p['patch'] else (255, 255, 255)
    letter_rgb = hex_rgb(p['letter'] or RED_REF)  # 새로 찍는 글자는 단색 (칸 단위라 음영 없음)
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = src[x, y]
            if a == 0:
                continue
            k, h, s, v = classify(r, g, b)
            body = y >= BODY_Y
            c = (r, g, b)
            if new_letter is not None and (x, y) in box:
                c = letter_rgb if (x, y) in new_letter else patch_rgb
            elif (x, y) in letter:
                if p['letter']:
                    c = shift(p['letter'], RED_REF, s, v)
            elif (x, y) in patch:
                if p['patch']:
                    c = patch_rgb
            elif k == 'blue' and body and pinstripe:
                c = to_rgb(0, 0, 0.55 + 0.45 * v)  # 상의·바지 파랑 → 흰 천 (어두운 파랑은 그림자처럼 연회색)
                k = 'white'
            elif k == 'blue' and body and s < 0.5 and v > 0.7:
                if p['jersey']:
                    c = to_rgb(0, 0, 0.55 + 0.45 * v)  # 흰 바지의 연파랑 음영 → 연회색 (분홍·살구로 물들지 않게)
            elif k == 'blue':
                target = p['jersey'] if body else p['helmet']
                if target:
                    c = shift(target, BLUE_REF, s, v)
            elif k == 'red':
                target = p['trim'] if body else p['brim']
                if target:
                    c = shift(target, RED_REF, s, v)
            if pinstripe and k == 'white' and body and x % STRIPE_PERIOD < STRIPE_WIDTH:
                c = tuple(round(ch * 0.18) for ch in c)
            dst[x, y] = (*c, a)
    if p['patch'] and p['patch'] == p['helmet']:
        blend_patch(src, dst, patch | (box if new_letter is not None else set()), new_letter or letter)
    return out


def blend_patch(src, dst, region, keep):
    """패치색이 헬멧색과 같으면 단색 네모가 헬멧 음영 위에 떠 보임 → 줄마다 패치 좌우 헬멧색을 이어 칠함
    (원본에서 파랑이던 픽셀만 참고 — 챙·외곽선 색이 끌려 들어오지 않게, 없으면 패치 둘레 헬멧 평균색)"""
    def helmet_at(x, y):
        r, g, b, a = src[x, y]
        return a and classify(r, g, b)[0] == 'blue'

    ring = [dst[x + dx, y + dy][:3] for x, y in region for dx in (-3, 3) for dy in (-3, 3)
            if (x + dx, y + dy) not in region and helmet_at(x + dx, y + dy)]
    avg = tuple(round(sum(c[i] for c in ring) / len(ring)) for i in range(3))
    rows = {}
    for x, y in region:
        rows.setdefault(y, []).append(x)
    for y, xs in rows.items():
        xl, xr = min(xs), max(xs)
        left = next((dst[x, y][:3] for x in range(xl - 1, xl - 7, -1) if helmet_at(x, y)), None)
        right = next((dst[x, y][:3] for x in range(xr + 1, xr + 7) if helmet_at(x, y)), None)
        left, right = left or right or avg, right or left or avg
        for x in xs:
            if (x, y) in keep:
                continue
            t = (x - xl + 1) / (xr - xl + 2)
            dst[x, y] = (*(round(a + (b - a) * t) for a, b in zip(left, right)), dst[x, y][3])


def sheet(rows, scale=2):
    cell_w = max(im.width for _, ims in rows for im in ims)
    label_h = 14
    W = cell_w * max(len(ims) for _, ims in rows) * scale
    H = (216 * scale + label_h) * len(rows)
    out = Image.new('RGBA', (W, H), (78, 150, 78, 255))
    d = ImageDraw.Draw(out)
    for i, (name, ims) in enumerate(rows):
        y0 = i * (216 * scale + label_h)
        d.text((4, y0 + 2), name, fill=(255, 255, 255, 255))
        for j, im in enumerate(ims):
            big = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
            out.alpha_composite(big, (j * cell_w * scale, y0 + label_h))
    return out


def main():
    args = sys.argv[1:]
    as_assets = '--assets' in args  # 게임 에셋용 — 비교 시트 없이 개별 PNG만
    args = [a for a in args if a != '--assets']
    out_dir = args[0]
    os.makedirs(out_dir, exist_ok=True)
    variants = VARIANTS
    if args[1:] == ['teams']:
        variants = TEAMS
    elif len(args) > 1:
        variants = {'custom': dict(arg.split('=', 1) for arg in args[1:])}
    originals = [Image.open(os.path.join(ROOT, f'batter_{p}.png')).convert('RGBA') for p in POSES]
    rows = [('original', originals)]
    for name, cfg in variants.items():
        ims = [recolor(im, cfg) for im in originals]
        for pose, im in zip(POSES, ims):
            im.save(os.path.join(out_dir, f'{name}_{pose}.png'))
        rows.append((name, ims))
    if not as_assets:
        sheet(rows).save(os.path.join(out_dir, 'batter-uniforms.png'))


if __name__ == '__main__':
    main()
