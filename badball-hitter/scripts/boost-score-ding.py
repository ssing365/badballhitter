"""결과 화면 점수 띠링(score-ding) 효과음 음량 키우기.

원본(assets-src/sounds/effects/score-ding*)은 peak 0.33 정도로 다른 효과음(타격음 0.87, new-ball 0.99)보다
훨씬 작아서 scoreboard·BGM에 묻힘 → peak 0.9로 정규화.
뒤쪽 1.5초 이후는 거의 무음이라 잘라서 번들 크기도 줄임 (끝 0.2초 fade out).
mp3 원본은 macOS afconvert로 wav로 풀어서 처리. 결과는 public/sounds/effects/score-ding*.wav
파일명의 '+'는 뺌 (score-ding_pitch-+2st → score-ding_pitch-2st) — 토스 웹뷰가 URL의 '+'를 공백으로 읽어 로드 실패
"""
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets-src/sounds/effects'
DST = ROOT / 'public/sounds/effects'

TARGET_PEAK = 0.9
KEEP_SEC = 1.5
FADE_SEC = 0.2


def read_wav(path):
    with wave.open(str(path)) as w:
        assert w.getsampwidth() == 2
        sr, ch = w.getframerate(), w.getnchannels()
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).reshape(-1, ch)
    return data.astype(np.float64) / 32768, sr


def write_wav(path, data, sr):
    pcm = (np.clip(data, -1, 1) * 32767).round().astype(np.int16)
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(pcm.shape[1])
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())


for src in sorted(SRC.glob('score-ding*')):
    if src.suffix == '.mp3':
        tmp = Path(tempfile.mkdtemp()) / (src.stem + '.wav')
        subprocess.run(['afconvert', '-f', 'WAVE', '-d', 'LEI16@44100', str(src), str(tmp)], check=True)
        data, sr = read_wav(tmp)
    else:
        data, sr = read_wav(src)

    data = data[: int(KEEP_SEC * sr)]
    fade = int(FADE_SEC * sr)
    data[-fade:] *= np.linspace(1, 0, fade)[:, None]
    data *= TARGET_PEAK / np.abs(data).max()

    out = DST / (src.stem.replace('+', '') + '.wav')
    write_wav(out, data, sr)
    print(f'{out.relative_to(ROOT)}  peak {TARGET_PEAK}  {len(data) / sr:.2f}s')
