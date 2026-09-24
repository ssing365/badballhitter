# BadBall Hitter — Claude Code Context

## 프로젝트 개요
야구 테마 웹 캐주얼 게임. 투수가 던지는 공(구종)을 좌/우 방향키로 분류하는 순발력 게임.
글로벌 배포 타겟 (영어 UI). 피터 레벨스 스타일 — 빠르게 만들고 배포, 데이터 보고 개선.

## 기술 스택
- **Frontend**: React 18 + Vite 5 (JS, TypeScript 아님)
- **Styling**: 컴포넌트별 일반 `.css` 파일 import (CSS Modules 아님 — 전역 클래스명)
- **Sound**: Howler.js
- **Backend/DB**: Supabase (PostgreSQL) — 현재 TODO 상태, 추후 연동
- **배포**: Vercel
- **도메인**: 추후 연결 예정 (공유 텍스트에는 `https://badballhitter.com` 사용 중)

## 폴더 구조
```
badball-hitter/
├── index.html                # <title>BadBallHitter</title>
├── public/
│   ├── assets/               # 픽셀아트 이미지 (PNG)
│   │   ├── bg.png                # 타이틀/게임 배경
│   │   ├── pitcher_idle.png
│   │   ├── feverpitcher.png      # (미사용)
│   │   ├── batter_idle.png
│   │   ├── batter_swing_l.png
│   │   ├── batter_swing_r.png
│   │   └── balls/
│   │       ├── white.png         # 직구 고정
│   │       ├── blue.png / green.png / purple.png / red.png / nurcle.png  # 게임마다 셔플 배정
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
│   │   └── sound.js          # Howler.js BGM 관리
│   └── components/
│       ├── constants.js      # 구종 정의, 해금 단계, 게임 상수 (components/ 안에 위치)
│       ├── Title/TitleScreen.jsx / .css
│       ├── Game/GameScreen.jsx / .css
│       ├── Game/GameResult.jsx / .css
│       ├── Game/Crowd.jsx / .css      # 관중석 들썩임 레이어
│       └── Team/TeamSelect.jsx / .css   # ⚠️ 미사용 + 깨짐 (constants에 없는 TEAMS import, 한글 UI)
```

## 화면 흐름 (현재)
타이틀(`TitleScreen`) → 게임(`GameScreen`) → 결과(`GameResult`) → Play Again / Back to Title
- 팀 선택/닉네임 입력 화면은 아직 흐름에 없음
- 타이틀의 Ranking 버튼은 `alert('Ranking coming soon!')`
- 재시작 시 `gameKey` 증가로 `GameScreen` 리마운트

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
- 좌/우 힌트: 최신 해금 구종이 맨 위, 각 사이드 세로 중앙 정렬 (`--hint-offset`), 새 공 추가 시 기존 공이 부드럽게 내려감

### 공 이미지
- 전 구종 이미지 사용 (`IMAGE_PITCH_IDS`)
- fastball = `white.png` 고정, 나머지 5개는 `COLOR_BALL_FILES` 셔플 배정 (`createPitchBallImages`, 게임마다)
- 이미지가 없으면 color + text 원형으로 렌더 (폴백)

### 점수 공식
`calcScore(combo) = 100 + floor(100 * log2(combo + 1))` — 콤보 복리 증가

### 게임 규칙
- **타이머**: 공 하나당 `TIMER_MAX = 3`초 (색상: >2초 초록, >1초 노랑, 이하 빨강)
- **게임 오버**: 3아웃 (오답 또는 시간 초과 시 1아웃, 콤보 리셋)
- **피버**: 랜덤 목표 콤보에 발동 — 첫 피버 `FEVER_FIRST_RANGE`(15~20), 이후 `FEVER_GAP_RANGE`(12~18) 간격. 콤보 끊기면 첫 피버 범위로 재설정, 구종 해금과 겹치면 `FEVER_UNLOCK_DELAY`(2)콤보 미룸. `FEVER_DURATION = 4`초간 좌우 무관 연타 +50점씩, 타이머 정지·아웃 없음
- **공 대기열**: `QUEUE_SIZE = 8`개, 앞(index 0)이 크고 뒤로 갈수록 작게 겹쳐 표시
- **등급(GRADES)**: 게임 종료 시 해금 구종 수 기준 — 6개 SSS(Hall of Famer) / 5개 S(All-Star) / 4개 A(Starting Lineup) / 3개 B(Bench Warmer) / 2개 C(Minor Leaguer) (`getGrade(unlockStep)`)

### Bat Speed / 최종 점수 (결과 화면)
- **Bat Speed**: 일반 모드 정답 스윙의 평균 반응시간(공 준비~스윙, `reactionRef`) → `calcBatSpeed(avgMs) = clamp(round(100 - avgMs/40), 40, 99)` mph. 정답 0개면 `null`
- **최종 점수** = 인게임 점수 + Max Combo 보너스(`maxCombo × 100`) + Bat Speed 보너스(`max(0, mph − 50) × hits`) — `calcFinalBreakdown(stats)`가 BOX SCORE 행과 `finalScore` 반환
- Fever Taps 점수(`× FEVER_TAP_POINTS`)는 이미 인게임 점수에 포함 → 표에서만 Hits와 분리 표시
- 최고 기록(localStorage `bestScore`)·공유 문구는 `finalScore` 기준

### 결과 화면 (GameResult)
- 타이틀과 같은 `bg.jpg` + 스크림, 헤더 Bebas Neue, 숫자 Press Start 2P
- 전광판 `FINAL SCORE` → BOX SCORE 행(Hits+AVG / Fever Taps / Max Combo / Bat Speed)이 하나씩 켜지며 점수 카운트업 (rAF + easeOutCubic). 탭/Enter/Space로 스킵, reduced-motion이면 즉시 완료
- 완료 후 등급 도장 + 해금 공 6칸, 신기록이면 `HOME RUN!` 배너

## 관중 연출 (Crowd)
- `bg.jpg` 관중석을 줄×블록×2명 조각으로 잘라 같은 배경을 붙인 레이어가 steps로 점프 (새 픽셀아트 없음)
- calm(0~9콤보, 열성팬만) / warm(10~29) / hype(30+) / fever(파도) / 아웃 직후 1.2초 멈춤
- `prefers-reduced-motion`이면 끔

## BGM 전환 로직 (src/lib/sound.js)
```js
playBgm('normal')   // Pinball Spring.mp3, loop — 타이틀/결과
playBgm('fast')     // Pinball Spring 160.mp3, loop — 게임 플레이
stopBgm()
```
- **크로스페이드 없음** — 다른 트랙은 즉시 stop 후 새 트랙 재생 (fade 레이스 버그 방지 목적)
- `currentType` 변수로 현재 BGM 추적, 같은 트랙 재생 중이면 무시
- `App.jsx`의 `useEffect([screen])`가 단일 진입점 + 버튼 클릭 핸들러에서도 동기 호출 (autoplay unlock용)
- 효과음은 아직 미구현

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
- 우상단 HUD: 콤보 숫자 — 10콤보마다 `combo-lv-0~5`로 색/크기/글로우 강화 (50+ 불꽃 깜빡임)
- 픽셀 폰트: Google Fonts `Press Start 2P` (`index.html` 로드, CSS 변수 `--pixel-font`) — 점수/콤보/중앙 팝업/피버
- 공 레인: width 54px, 중앙 세로
- 공 아이템: 48×48px
- 힌트 공: 48×48px
- 방향 버튼: 76×58px
- 타자/투수 스프라이트: 88×88px

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
- `onGameOver` stats: `{ score, correct, classified, maxCombo, feverTaps, unlockStep, batSpeed, pitchBallImages }` (accuracy·finalScore는 결과 화면에서 계산)

## 코딩 컨벤션
- 컴포넌트: PascalCase (`GameScreen.jsx`), 화면별 폴더 (`Game/`, `Title/`)
- 함수: camelCase (`startFever`, `judge`)
- CSS 클래스: kebab-case (`.ball-item`, `.fever-overlay`)
- 상수: UPPER_SNAKE_CASE (`PITCHES`, `QUEUE_SIZE`)
- 상태관리: `useState` + `useRef` (외부 상태 라이브러리 없음). 콜백 내 최신 상태는 `stateRef.current`로 참조
- `var` 사용 금지 — `const` / `let` 만 사용
- 주석은 한글, UI 텍스트는 영어

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
- 피버 타임: 공이 전부 불타는 공(`balls/feverball.png`)으로 교체, 투수 `feverpitcher.png`
- 효과음 (스윙/포구 — `public/sounds/`에 파일만 있음)
- 콤보 끊길 때 투수 비웃는 모션 + 화면 흔들림
- 투수 표정이 콤보에 따라 변화 (10콤보: 당황, 20콤보: 분노)
- 데일리 챌린지 (매일 고정 시퀀스, 전국 동일 패턴)
- 개인 기록 그래프 ("어제보다 +230점")
- 구종 해금 진행 바
