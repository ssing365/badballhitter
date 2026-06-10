// ─────────────────────────────────────────
// 구종 정의
// dir: 'left' | 'right' — 정답 방향
// ─────────────────────────────────────────
export const BALL_TYPES = [
    { id: 'fastball', label: '직구',    color: '#f59e0b', border: '#d97706', dir: 'left',  text: '직' },
    { id: 'curve',    label: '변화구',  color: '#22c55e', border: '#16a34a', dir: 'right', text: '변' },
    { id: 'knuckle',  label: '너클볼',  color: '#ef4444', border: '#dc2626', dir: 'left',  text: '너' },
    { id: 'slider',   label: '슬라이더',color: '#3b82f6', border: '#2563eb', dir: 'right', text: '슬' },
  ]
  
  // 레인에 표시될 공 대기열 길이
  export const QUEUE_SIZE = 7
  
  // 타이머 초기값 (초)
  export const TIMER_MAX = 5
  
  // 콤보 점수 공식: 100 + floor(100 * log2(combo+1))
  export const calcScore = (combo) => 100 + Math.floor(100 * Math.log2(combo + 1))
  
  // 페이즈별 활성 구종
  export const getActiveTypes = (phase) =>
    phase === 1 ? BALL_TYPES.slice(0, 2) : BALL_TYPES
  
  // 피버 발동 콤보 간격
  export const FEVER_COMBO_INTERVAL = 10
  
  // 피버 지속시간 (초)
  export const FEVER_DURATION = 4
  
  // 난이도 UP 분류 횟수 기준
  export const PHASE2_THRESHOLD = 20
  
  // KBO 팀 목록
  export const TEAMS = [
    { id: 'LG',   name: 'LG 트윈스',   emoji: '🔴' },
    { id: 'KT',   name: 'KT 위즈',     emoji: '⚫' },
    { id: 'SSG',  name: 'SSG 랜더스',  emoji: '🔵' },
    { id: 'NC',   name: 'NC 다이노스',  emoji: '🟣' },
    { id: '두산', name: '두산 베어스',  emoji: '🐻' },
    { id: 'KIA',  name: 'KIA 타이거즈', emoji: '🟠' },
    { id: '롯데', name: '롯데 자이언츠', emoji: '🌊' },
    { id: '삼성', name: '삼성 라이온즈', emoji: '💙' },
  ]
  
  // 점수별 등급
  export const GRADES = [
    { minAcc: 90, label: 'S급 — 삼진 없는 선구안!' },
    { minAcc: 75, label: 'A급 — 주전 타자감!' },
    { minAcc: 55, label: 'B급 — 연습이 필요해' },
    { minAcc: 0,  label: 'C급 — 삼진왕...' },
  ]