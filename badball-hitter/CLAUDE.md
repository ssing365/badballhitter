# BadBall Hitter — Claude Code Context

## 프로젝트 개요
야구 테마 웹 캐주얼 게임. 투수가 던지는 공(구종)을 좌/우 방향키로 분류하는 순발력 게임.
앱인토스(토스 미니게임) 출시 타겟 (appName `badball-hitter`). UI는 영어, 구종명·타이틀 태그라인·피버 문구·공유 문구만 한글. 피터 레벨스 스타일 — 빠르게 만들고 배포, 데이터 보고 개선.

## 기술 스택
- **Frontend**: React 18 + Vite 5 (JS, TypeScript 아님)
- **Styling**: 컴포넌트별 일반 `.css` 파일 import (CSS Modules 아님 — 전역 클래스명)
- **Sound**: Howler.js
- **Backend/DB**: Supabase (PostgreSQL) — 현재 TODO 상태, 추후 연동
- **배포**: 앱인토스 (`@apps-in-toss/web-framework` 3.x, `apps-in-toss.config.ts`, `npm run build` → `.ait`) / 웹은 Vercel (`npm run build:web` = `--mode web`, `vercel.json` buildCommand)
- **분석**: GA(gtag, `vite.config.js` 플러그인)·Vercel Analytics(`App.jsx` lazy)는 `--mode web`에서만 포함 — 앱인토스 번들에는 없음
- **도메인**: 추후 연결 예정 (공유 텍스트에는 `https://badballhitter.com` 사용 중)

## 폴더 구조
```
badball-hitter/
├── index.html                # <title>BadBallHitter</title>
├── public/
│   ├── assets/               # 픽셀아트 이미지 (PNG)
│   │   ├── bg.png                # 타이틀/게임 배경
│   │   ├── pitcher_idle.png
│   │   ├── feverpitcher.png      # 땀 흘리는 투수 (30콤보+/피버)
│   │   ├── batter_idle.png
│   │   ├── batter_swing_l.png
│   │   ├── batter_swing_r.png
│   │   └── balls/
│   │       ├── white.png         # 직구 고정
│   │       ├── blue.png / green.png / purple.png / red.png / nurcle.png  # 게임마다 셔플 배정
│   │       ├── watermelon.png    # 수박 연타 공 (144px, 원본 assets-src/balls/watermelon_144.png를 `scripts/brighten-watermelon.py`로 밝은 초록으로 다시 칠함)
│   │       ├── melon_shards.png  # 수박 파편 시트 (`scripts/cut-melon-shards.py`가 원본 assets-src/balls/crash_watermelon.png에서 조각 16개만 잘라냄, 위치는 `MELON_SHARDS`)
│   │       ├── fever_<색>.png    # 피버 중 금테 공 (white/blue/green/purple/red/nurcle, 원본 assets-src/balls/, 192px)
│   │       └── feverball.png     # (미사용)
│   └── sounds/
│       ├── Pinball Spring.mp3        # BGM normal (타이틀/결과)
│       ├── Pinball Spring 160.mp3    # BGM fast (게임 플레이)
│       ├── *fast-swing-air-woosh.wav # 효과음 (미사용)
│       └── *baseball-into-glove.aiff # 효과음 (미사용)
├── src/
│   ├── main.jsx
│   ├── App.jsx               # 화면 전환 + BGM 전환 (screen: 'title' | 'playing' | 'result')
│   ├── App.css               # Vite 템플릿 잔재 (미사용)
│   ├── index.css             # 전역 스타일만 (reset, body)
│   ├── lib/
│   │   ├── sound.js          # Howler.js BGM 관리
│   │   ├── records.js        # 최고 기록 — SDK Storage, 토스 밖이면 localStorage 폴백 (앱 시작 시 로드·캐시)
│   │   ├── leaderboard.js    # 토스 게임센터 리더보드 열기·점수 제출 (5.221.0+, 토스 밖이면 no-op)
│   │   └── haptic.js         # 햅틱(Device.triggerHaptic) + 진동 on/off(localStorage `hapticOff`), 토스 웹뷰 밖이면 no-op
│   ├── assets/icons/         # 마스크용 svg (volume / volume-xmark / vibrate / vibrate-off)
│   └── components/
│       ├── constants.js      # 구종 정의, 해금 단계, 게임 상수 (components/ 안에 위치)
│       ├── Title/TitleScreen.jsx / .css
│       ├── Game/GameScreen.jsx / .css
│       ├── Game/GameResult.jsx / .css
│       ├── Game/Crowd.jsx / .css      # 관중석 들썩임 레이어
│       ├── Game/Fielders.jsx / .css   # 내야 수비수 2명 (유격수·2루수)
│       ├── Sound/BgmToggle.jsx / .css # 타이틀·결과 우상단 사운드 토글 + 진동 토글(토스 웹뷰에서만)
│       └── Team/TeamSelect.jsx / .css   # ⚠️ 미사용 + 깨짐 (constants에 없는 TEAMS import, 한글 UI)
```

## 화면 흐름 (현재)
타이틀(`TitleScreen`) → 게임(`GameScreen`) → 결과(`GameResult`) → Play Again / Back to Title
- 팀 선택/닉네임 입력 화면은 아직 흐름에 없음
- 타이틀의 Ranking 버튼은 토스 게임센터 리더보드(`openLeaderboard`), 토스 밖(웹)에서는 `alert('Ranking coming soon!')`
- 재시작 시 `gameKey` 증가로 `GameScreen` 리마운트
- 타이틀 `Play Ball!`은 결과 화면 `Play again!`과 같은 스타일(주황빛 노란 블록, 안팎 글로우, 갈색 그라데이션 픽셀 글씨, 실밥 점선), Ranking은 결과 화면 메인화면 버튼과 같은 Galmuri11 텍스트 버튼

## 게임 핵심 로직 (src/components/constants.js)

### 구종 (PITCHES)
6개 구종 정의 (fastball, slider, changeup, forkball, curve, sweeper). 각 구종: `id, label, text(공에 표시할 약자), color, border`.
**방향(dir)은 고정이 아니라 게임 시작·해금 시 랜덤 배정** (`pitchDirs` 상태로 관리, 큐에는 dir 저장 안 함).

### 구종 해금 (콤보·점수 기준)
- 시작 `BASE_PITCHES`(fastball, slider)는 좌/우 하나씩 랜덤 배치 (`assignPairDirs`)
- 이후 `PITCH_UNLOCKS` 순서대로 **1구종씩** 해금 — 현재 콤보 AND 누적 점수 조건 (`unlockStep` 상태, `getUnlockStep`). 앞 단계가 해금돼야 다음 단계 조건 검사
- 새 구종은 개수가 적은 쪽, 동률이면 왼쪽 → 왼쪽부터 좌/우 번갈아 추가 (`assignDirsForStep`)

| 단계 | 조건 | 추가 구종 (방향) |
|----|------|---------|
| 0 | 시작 | fastball, slider (랜덤 좌/우) |
| 1 | 20콤보 | changeup (좌) |
| 2 | 30,000점 + 10콤보 | forkball (우) |
| 3 | 50,000점 + 15콤보 | curve (좌) |
| 4 | 80,000점 + 20콤보 | sweeper (우) |

- 콤보가 끊겨도 해금된 단계는 유지
- 해금 점수 조건은 **타격 등급 배율을 뺀 점수**(`score - gradeBonusRef`)로 판정 — 홈런·2루타 보너스가 해금 속도와 결과 등급을 끌어올리지 않도록
- 좌/우 힌트: 최신 해금 구종이 맨 위, 각 사이드 세로 중앙 정렬 (`--hint-offset`), 새 공 추가 시 기존 공이 부드럽게 내려감

### 공 이미지
- 전 구종 이미지 사용 (`IMAGE_PITCH_IDS`)
- fastball = `white.png` 고정, 나머지 5개는 `COLOR_BALL_FILES` 셔플 배정 (`createPitchBallImages`, 게임마다)
- 피버 중에는 레인·타구 공이 같은 색 금테 공(`toFeverBallImage` → `fever_<색>.png`, `.ball-sprite.lane.fever` 64px + 음수 margin, 레인 공은 준비 시간 동안 뒤에서부터 차례로 바뀜), 맨 앞 공 글로우는 금빛. 좌/우 힌트 공과 수박은 그대로
- 이미지가 없으면 color + text 원형으로 렌더 (폴백)

### 점수 공식
`calcScore(combo) = 100 + floor(100 * log2(combo + 1))` — 콤보 복리 증가. 정타 점수 = `round(calcScore × 타격 등급 mult)`

### 타격 등급 (HIT_GRADES, `getHitGrade(reactionMs)`)
공 준비~정타 시간 기준. 파울도 정답 처리(콤보·피버 차지 유지), 라벨은 영어
| 등급 | 조건 (타이머 3초) | 배율 | 타구 |
|----|------|----|----|
| HOME RUN! | 0.3초 이내 | 2 | 가장 깊게 + 금빛 글로우, 타이머 바 플래시 + 관중 fever 들썩임(`hrFlash`) |
| DOUBLE! | 2.1초 이상 남김 | 1.2 | 기본 궤적 |
| SINGLE! | 0.7초 초과 남김 | 1 | 짧게 |
| FOUL | 마지막 0.7초 | 0.7 | 옆으로 크게 빠짐 |
- 타이머 바 색 = 지금 치면 받을 등급(`timerLevelAt`): hr 금 / safe 초록 / warn 노랑 / danger 빨강 깜빡임. 바 위 픽셀 화살표로 경계(2.7s 금·2.1s 초록·0.7s 빨강) 표시 (피버·수박 타임엔 숨김)
- 판정 결과는 타이머 바 아래(`.hit-label`)에 작게 0.7초. 홈런 수·홈런 점수는 결과 화면 Home Run 행

### 게임 규칙
- **타이머**: 공 하나당 `TIMER_MAX = 3`초. 피버 게이지 톤의 픽셀 가로 바(`timerLevel` safe >2초 초록 / warn >1초 노랑 / danger 빨강 깜빡임). 피버 중에는 타이머를 숨기고 합쳐진 파워 버튼·중앙 초 박스가 대신함(타자 옆 피버 게이지도 숨김)
- **게임 오버**: 3아웃 (오답 또는 시간 초과 시 1아웃, 콤보 리셋)
- **입력 반응**: 판정 즉시 대기열 보충 + 다음 공 타이머 시작 (대기 없이 연타 가능). 리렌더 전 연속 입력도 맞게 판정하도록 `judge`가 바뀐 값을 `stateRef`에 바로 반영
- **피버 차지 바**(타자 왼쪽 세로 게이지 `.fever-gauge.power`, 14×120px): 정타(파울 포함) 1회당 +1, `FEVER_CHARGE_MAX = 40`에 도달하면 피버. 아날로그 바라서 마지막 정타 후 `FEVER_CHARGE_DECAY_DELAY_MS`(1초)가 지나면 초당 `FEVER_CHARGE_DECAY_PER_SEC`(2)씩 감소 (1.5초 무입력 시 1칸). 아웃(오답·시간 초과) 시 절반, 피버 종료 시 0. 구종 해금과 겹치면 차지를 `MAX - FEVER_UNLOCK_DELAY`(2)로 되돌려 미룸. `chargeRef`에 두고 rAF 루프가 게이지 DOM을 직접 갱신(피버 중에는 게이지를 숨기고 같은 루프가 파워 버튼에 `--power`를 세팅)
- **수박 차지**(화면엔 안 보임 — 사용자에겐 랜덤처럼, `cycleChargeRef`): 파울 제외 정타 1회당 +1, `CYCLE_CHARGE_MAX = 15`에 도달하면 다음에 채워지는 공 `WATERMELON_MIN~MAX`(15~20)개가 수박(`buildQueue`의 `melonPendingRef`, 대기열 뒤에서 들어옴), 첫 수박이 맨 앞에 오는 순간 `WATERMELON!` 팝업(`announceMelonFront`). 수박 타임(`melonActiveRef`) 동안은 구종 해금을 미룸(끝난 뒤 다음 정타에서 해금). 감소 규칙은 피버 바와 같음, 아웃 시 0, 해금과 겹치면 미룸. 수박이 남아 있는 동안(`melonActiveRef`)은 차지가 멈추고, 마지막 수박을 치면 0. 피버가 시작되면 수박은 전부 취소(`cancelWatermelons` — 남은 수박 0, 대기열 수박은 일반 공으로, 차지 0), 같은 타격에 피버·수박 차지가 함께 가득 차면 수박 없이 차지 0
- **수박 연타**: 맨 앞 공이 수박이면(`melonFront`) 방향 무관 — 누를 때마다 1개 `WATERMELON_POINTS`(100) 즉시 가산(결과 화면에선 Hits에 포함), 콤보 +1(점수는 고정, 수박 차지·타율 변화 없음), 투수 던지는 모션은 평소처럼, 피버 차지는 +1(가득 차면 피버). 수박 타임엔 좌/우 힌트 공도 수박. 타이머는 평소처럼 돌아서 놓치면 TIME UP. 타이머 바는 수박색(초록 껍질 → 빨간 속, `.timer-wrap.melon`), 타이머 아래 수박색 "마구 눌러요!"(`.fever-sub.melon`)·TAP! 안내. 수박 공은 은은한 연두빛 글로우(`.ball-sprite.melon`). 수박을 치면 공은 평소처럼 날아가고 그 자리에서 파편 6개(큰 조각 3 + 씨·과즙 3 랜덤, `randomMelonShards`)가 사방으로 퍼지며 빙글 돌고 흐려짐(`.melon-shards`, 0.5초), 소리는 타격음 + 수박 깨지는 소리 2종 중 랜덤(`playMelonCrashSfx`). 좌/우 힌트 수박은 꼭지가 ±17°로 편도 6프레임씩 끊기며 흔들리고 넘어갈 때마다 2px 콩 뜀(`.ball-sprite.hint.melon`, 칸마다 박자 엇갈림). 좌우 버튼은 수박 조각(`.dir-btn.melon` — 빨간 속 윗면·까만 씨·흰 화살표, 연두 속껍질·초록 껍질 밑면, 아웃 색이 우선), 버튼 위 TAP!도 수박색(`.tap-badge.melon`)
- **피버(파워 스윙)**: 피버 내내 배경만 살짝 어둡게(`.fever-dim`, z 19 — 투수·공·타자·버튼은 위, 끝나면 서서히 밝아짐). 시작 후 `FEVER_READY_MS`(0.8초)는 준비 시간 — 입력 무시(연타 관성 방지), 제목 자리 `CHANCE!`(40px 금빛, 쾅 내려찍힘), `scoreboard.wav` 작게(`scoreboardSoft` 0.3), 좌우 버튼이 가로로 긴 파워 버튼 하나로 합쳐지고(`.power-btn`, 높이는 그대로 58px, 가운데서 펼쳐지는 `power-btn-merge`) 타자는 그 위에 올라섬(`.batter-slot.fever-active` 버튼 높이만큼 위로, 1.55배, 버튼보다 앞·터치는 버튼이), 레인 공이 뒤(투수 쪽)부터 차례로 금테 공으로(`.ball-sprite.gold-in` 겹침, `--gold-delay` 70ms 간격). 준비가 끝나는 순간 버튼·키를 누르고 있으면(`heldInputsRef`) 바로 충전 시작. 이어서 `FEVER_DURATION = 4`초 안에 파워 버튼(또는 ←/→ 키)을 꾹 눌러 충전 → 떼면 그 파워로 파워 스윙 한 번(`powerSwing`). `POWER_TAP_IGNORE_MS`(0.3초)보다 짧은 터치는 피버 내내 스윙 없이 충전 취소 — 버튼 글씨가 `SHORT_TAP_HINT_MS`(0.9초) 동안 "더 길게 꾹!"으로 흔들림(`shortTapId`, 다시 꾹 누르면 됨). 파워 = 누르는 순간 `POWER_MIN`(20%) → `POWER_FULL_MS`(피버 시간 − 0.3초 = 3.7초)에 100%, 100%가 되면 바로 자동 스윙. 4초가 끝나면 그 시점 파워로 자동 스윙(안 눌렀으면 20%). 파워 버튼 글씨는 안 누름 "꾹 누르세요"(준비 중엔 흐리게) / 누르는 중·스윙 후 `N%` + 왼쪽부터 금색 채움(`.btn-fill`, 게이지 rAF 루프가 `.game-screen`에 세팅하는 `--power`), 50%부터 점점 빨개져 100%에 완전히 빨강(`::after` opacity, 눌림 글로우도 금→빨강). 남은 피버 초는 파워 버튼 바깥 우측 위 24px 검은 바탕·금테 박스(`.fever-clock .fever-sec`, 초마다 톡 튐, 마지막 1초 빨간 깜빡임, 스윙하면 숨김). 공 수 `powerBallCount` = `POWER_BALLS_MAX`(20) × 파워(20%=4개), `POWER_BALL_INTERVAL_MS`(40ms) 간격으로 날아감(대기열과 별개로 만든 공, 홈런 궤적). 스윙하면 항상 `GRAND SLAM`(붉은 금빛, 쾅 내려찍힘 + 화면 흔들림, 피버가 끝나도 1.2초 유지). 스윙 순간 대기열 공은 전부 치움, **마지막 공이 발사되는 순간 피버 종료** → `PITCHER_REST_MS`(0.1초) 뒤 `refillQueue`가 `QUEUE_REFILL_INTERVAL_MS`(60ms)마다 한 개씩 투수로부터 던져 채운 뒤 타이머 시작(채우는 중 입력 무시 `refillingRef`, 게임 시작 때도 같은 방식). 날린 공 × `POWER_BALL_POINTS`(300)를 피버 종료 시 합산(전광판 아래 금색 `+N`). 충전 중 타자는 뒤로 젖히고 떨며 금빛 오라(`.batter-wrap.charging`), 스윙 궤적은 크게(`.swing-trail.power`). 입력은 누름=`press`→`judge`, 뗌=`release`(버튼 `onPointerUp/Cancel` + pointer capture, 키보드 `keyup`, 키 자동 반복은 무시). 일시정지 시 누른 시간 보존(`powerHeldMsRef`)
- **일시정지**: 우상단 버튼 / Esc / P, 탭 전환 시 자동. 타이머는 경과 시간(`startTimer(elapsedMs)`), 피버는 종료 시각 기준(`runFeverClock`)으로 멈췄다 재개. 메뉴는 Resume / Sound on·off / Vibration on·off(토스 웹뷰에서만) / Quit(타이틀)
- **공 대기열**: `QUEUE_SIZE = 8`개, 레인은 투수 위(z 22), 맨 뒤 2개만 살짝 투명(`--ball-opacity` 0.88·0.76). 새 공은 자기 자리의 살짝 옆(그 구종 힌트 방향 쪽 ±10px)에서 작게 나타나며 들어옴(`ball-spawn`, `--spawn-x`), 레인 바닥 기준(`ballLaneLayout`, bottom %) — 맨 앞(쳐야 할 공)은 1.3배 + 흰 글로우, 뒤로 갈수록 작게 겹쳐 표시. 앞 공이 커져도 위로 자라서 타이머와 안 겹침. 게임 시작·그랜드슬램 후 채우는 공(`fromPitcher`)은 투수 손 위치(레인 bottom 50%)에서 작게 출발해 자기 칸까지 날아옴(`pitch-in`)
- **처리된 공 연출**(`flyBalls`, 레인 밖 `.fly-layer` z 33): 판정 즉시 큐에서 빼고 keyframes 재생 후 `onAnimationEnd`로 제거. `hit`(친 방향 관중석으로 직선 → 끝에서 살짝 떨어지며 흐려짐, 좌/우 궤적 2종 `v0`/`v1` 랜덤, 등급별 거리) / `miss`(헛스윙 — 배트 반대쪽으로 비켜 몸쪽으로 커지며 지나감) / `take`(시간 초과 — 가운데로 지나감). 파워 스윙 공도 `hit`(`fever: true`면 금테 공)
- **햅틱**: 정타 `tickWeak`, 홈런 `tap`, 아웃 `error`, 피버 시작·파워 스윙 `success`, 피버 충전 시작·파워 스윙 공마다·수박 `tickWeak`(최소 50ms 간격). 토스 앱 설정 > 진동이 켜져 있어야 동작
- **등급(GRADES)**: 게임 종료 시 해금 구종 수 기준 — 6개 SSS(Hall of Famer) / 5개 S(All-Star) / 4개 A(Starting Lineup) / 3개 B(Bench Warmer) / 2개 C(Minor Leaguer) (`getGrade(unlockStep)`)

### 최종 점수 (결과 화면)
- **최종 점수** = 인게임 점수 + Max Combo 보너스(`maxCombo × 100`) — `calcFinalBreakdown(stats)`가 BOX SCORE 행과 `finalScore` 반환
- Power Swing 점수(날린 공 `× POWER_BALL_POINTS`)와 홈런 타구 점수(`homeRunPtsRef` 누적)는 이미 인게임 점수에 포함 → 표에서만 Hits와 분리 표시
- Hits 행 옆 타율(AVG)은 LED 배지(`.box-avg`)로 강조
- 최고 기록(`lib/records.js`, 키 `bestScore`)은 `finalScore` 기준. 결과 화면 진입 시 개인 최고 점수를 리더보드에 제출. 신기록 시 그 판의 `unlockStep`도 `bestUnlockStep`에 저장. Share(클립보드 복사) 문구는 개인 최고 점수+등급 기준 (`bestUnlockStep` 없는 예전 기록은 등급 생략)

### 결과 화면 (GameResult)
- 타이틀과 같은 `bg.jpg` + 스크림, 헤더 Bebas Neue, 숫자 Press Start 2P
- 전광판 `FINAL SCORE` → BOX SCORE 행(Hits+AVG / Home Run / Power Swing / Max Combo)이 하나씩 켜지며 점수 카운트업 (rAF + easeOutCubic). 탭/Enter/Space로 스킵, reduced-motion이면 즉시 완료
- 완료 후 등급 도장 + 해금 공 6칸, 신기록이면 `NEW BEST SCORE` 배너, 아니면 FINAL SCORE 아래 매달린 BEST 전광판
- 버튼: `Play again!`(Press Start 2P 16px, 가운데 넓게) 아래 줄에 메인화면 · 공유하기(Galmuri14 14px)

## 상황별 연출 (새 픽셀아트 없이 CSS)
- `sceneMood` = `'out'`(아웃 후 1.2초, `outFlash`) > `'fever'` > `'hype'`(30콤보+) > `'normal'` → `.game-screen.scene-*` 클래스로 CSS에서 분기
- 상황별 크기·위치는 CSS 개별 속성(`scale`/`translate`/`rotate`), 반복 모션은 `transform` 애니메이션 — 투수 `throwing` transform과 충돌 방지 (`.pitcher-body`, `.batter-wrap` wrapper)
- **관중**(`Crowd`): `bg.jpg` 관중석을 줄×블록×2명 조각으로 잘라 steps 점프. calm(0~9, 열성팬만) / warm(10~29) / hype(30+) / fever(파도) / 아웃 시 멈춤
- **투수**: 평소 숨쉬기 / hype 땀(`feverpitcher.png`, `.sweat`로 크기 보정)+떨림 / 피버 물러나며 크게 떨림 / 아웃 콩콩 점프+좌우반전+"HA!" 말풍선
- **타자**: 홈플레이트보다 20px 우측(`.batter-slot`), 평소 1.15배 / hype 1.25배+주황 오라 / 피버 1.4배+불꽃 오라 / 아웃 흑백+풀죽음. 스윙 궤적(`.swing-trail`, `swingId` key) 평소 흰색 / hype 주황 / 피버 금색
- **수비수**(`Fielders`, 유격수·2루수 2명, `pitcher_idle.png` 축소 재사용): 피버 바깥으로 도망 / 아웃 환호 점프
- **피버 테두리**: inset box-shadow 3겹 색 순환 + 주황 비네트 + 집중선(`::before` conic-gradient)
- **아웃**: 화면 흔들림(±4px) + 붉은 비네트(`.out-vignette`)
- `prefers-reduced-motion`이면 반복 모션·흔들림·깜빡임 끔

## BGM 전환 로직 (src/lib/sound.js)
```js
playBgm('normal')   // Pinball Spring.mp3, loop — 타이틀/결과
playBgm('fast')     // Pinball Spring 160.mp3, loop — 게임 플레이
stopBgm()
```
- **크로스페이드 없음** — 다른 트랙은 즉시 stop 후 새 트랙 재생 (fade 레이스 버그 방지 목적)
- `currentType` 변수로 현재 BGM 추적, 같은 트랙 재생 중이면 무시
- `App.jsx`의 `useEffect([screen])`가 단일 진입점 + 버튼 클릭 핸들러에서도 동기 호출 (autoplay unlock용)
- **음소거**: `isMuted/setMuted` — `Howler.mute`로 BGM + 효과음 전체 (localStorage `bgmMuted`). 타이틀·결과는 `BgmToggle`, 게임 중은 일시정지 메뉴
- 백그라운드 전환(`visibilitychange`) 시 전역 무음, 복귀 시 음소거 설정으로 복원 (앱인토스 검수 항목)
- 일시정지 중 `pauseSfx/resumeSfx`로 피버 효과음을 멈췄다 이어서 재생

## 게임 화면 사이즈
```css
.game-screen {
  width: 100%;
  max-width: 400px;
  height: 100svh;      /* 모바일 주소창 제외 실제 뷰포트 */
  max-height: 700px;   /* 태블릿 대응 */
}
```
- `.game-screen`은 `container-type: size` — 자식에서 `cqh` 단위 사용 (배경이 높이 기준 cover라 배경 위치 맞출 때 유용)
- 점수: 배경 전광판 화면 위 `.scoreboard` (top 15.3cqh, 23.8×7cqh, 앰버 LED 픽셀 폰트)
- 우상단 HUD: 일시정지 버튼 (`.pause-btn`)
- 콤보(`.center-combo`, top 29%, 뒤에 어두운 radial 그림자): 10콤보마다 `combo-lv-0~5`로 색/크기(24·24·32·32·32·40px)/글로우 강화 (50+ 불꽃 깜빡임), 0이면 숨김. 피버 중엔 숨김
- 정타 점수 `+N`: 전광판 오른쪽에서 튀어나오는 `.score-pop.hit`. 피버 합계는 전광판 아래 중앙 `.score-pop.fever`(1.6초)로 따로 표시해서 직후 정타 팝업에 묻히지 않음 (`showScorePop(text, tone)`). MISS/TIME UP/NEW PITCH는 `.result-pop`(top 42%, `showPop(text, tone)`) — `new` 보라~핑크 그라데이션 + 빛줄기, `bad` 22px 빨강→검붉은 그라데이션 + 검은 그림자, 등장 후 축 처짐
- 픽셀 폰트: Google Fonts `Press Start 2P` (`index.html` 로드, CSS 변수 `--pixel-font`) — 점수/콤보/중앙 팝업/피버
- 공 레인: width 54px, 중앙 세로, top 13% ~ bottom `calc(25% + 48px)` (타이머 위에서 끝남)
- 타이머(`.timer-wrap`, bottom 25%, 좌우 10%): grid `[바 | 초]` + 아래 줄(타격 결과 / 수박 땐 안내 문구, 피버 중엔 타이머 전체 숨김). 전체 높이가 레인 아래 여백 48px 안이어야 맨 앞 공을 안 가림
- 공 아이템: 48×48px (맨 앞 1.3배)
- 힌트 공: 48×48px
- 방향 버튼: 76×58px (피버 중 좌우 6% 안쪽 전체 폭 × 58px 파워 버튼 하나)
- 타자 스프라이트: 88×88px / 투수: 76×76px (top 37.5%)

## 리더보드 / 닉네임 전략 (미구현)
- **로그인 없음** — 절대 소셜 로그인 붙이지 않음
- 닉네임: 타이틀 화면에서 텍스트 입력 (선택사항)
- 미입력 시 자동 닉네임 배정 (예: "Anonymous LG Fan")
- localStorage에 닉네임 + 팀 저장 → 재방문 시 자동 입력
- 팀 선택 + 닉네임이 리더보드에 표시

## Supabase 연동 (TODO)
코드 내 `// TODO: Supabase` 주석으로 연동 위치 표시됨:
- `GameScreen.jsx` `handleGameOver()` — `saveScore()` 호출 위치
- `GameResult.jsx` — `saveScore` import 위치, Top 10 `<Leaderboard>` 위치

```sql
-- 연동 시 필요한 테이블
users  (id uuid, nickname text, team_id text, created_at timestamp)
scores (id uuid, nickname text, team_id text, score int,
        accuracy int, max_combo int, played_at timestamp)
```
- RLS: scores INSERT 누구나, SELECT 전체 공개
- `src/lib/supabase.js` 파일 생성해서 연동
- `onGameOver` stats: `{ score, correct, classified, maxCombo, powerBalls, homeRuns, homeRunPts, unlockStep, pitchBallImages }` (accuracy·finalScore는 결과 화면에서 계산)

## 코딩 컨벤션
- 컴포넌트: PascalCase (`GameScreen.jsx`), 화면별 폴더 (`Game/`, `Title/`)
- 함수: camelCase (`startFever`, `judge`)
- CSS 클래스: kebab-case (`.ball-item`, `.fever-overlay`)
- 상수: UPPER_SNAKE_CASE (`PITCHES`, `QUEUE_SIZE`)
- 상태관리: `useState` + `useRef` (외부 상태 라이브러리 없음). 콜백 내 최신 상태는 `stateRef.current`로 참조
- `var` 사용 금지 — `const` / `let` 만 사용
- 주석은 한글, UI 텍스트는 영어 (구종명·태그라인·피버 문구·공유 문구는 한글)
- 픽셀 폰트에 한글이 나오면 `--pixel-font`의 `Galmuri11` 폴백으로 렌더 (Press Start 2P에 한글 없음)
- Press Start 2P는 **8px 배수(8/16/24/32/40)**에서만 선명 — 12·14·22px 등은 깨져 보임
- 그라데이션 글씨(`background-clip: text` + 투명 채움)는 text-shadow가 비쳐 보이므로 외곽선·글로우를 `filter: drop-shadow`로
- 토스 SDK 호출은 `lib/`에 감싸서 try/catch — 토스 밖(웹 배포)에서는 SDK가 throw하므로 폴백 필수

## 에셋 규칙
- 픽셀아트 PNG: `public/assets/` 저장 (공은 `public/assets/balls/`)
- **반드시** `image-rendering: pixelated` 적용 (안 하면 흐려짐)
- 공 스프라이트: 40×40px
- 타자/투수 캐릭터: 64×64px
- 배경: 400×560px
- 픽셀아트 색상 수: 최대 16색 (팔레트 스왑 편의를 위해)

## 주요 UX 원칙
- 모바일 우선 설계
- 조작: 모바일(좌우 버튼 클릭) + PC(방향키 ←/→, A/D) 동시 지원
- 로그인 없이 바로 플레이 가능 — 진입 장벽 제로
- 목표 화면 흐름: 타이틀 → 팀선택/닉네임 입력 → 게임 → 결과 → 타이틀 루프
- 결과 공유: `navigator.share` 없으면 클립보드 복사

## 구현 예정
- 팀 선택/닉네임 화면 (TeamSelect 재작성 — 영어 UI, TEAMS 상수 추가)

### 그랜드슬램(파워 피버)
- 파워 충전 효과음 찾기 (결과 화면 효과음으로 같이 써도 될 듯)
- 파워 스윙 때 날아가는 공들이 너무 정적 — 연출 개선 방법 찾기
- 칠 때 차라랑 금빛 효과음, 수비수들 도망가기
- 파워 스윙 점수 밸런스 (최대 20개 × 300점)

### 버그·기타
- 쓰리 아웃 시 터치 금지 확인
- 구종 6개 해금 이후 투수 교체 → 힌트 공 좌우 바뀜 or 랜덤 재배치
- 랭킹 버튼이 토스 리더보드로 이동되는지 실기기 확인
