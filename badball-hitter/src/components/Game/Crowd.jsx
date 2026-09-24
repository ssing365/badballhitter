import './Crowd.css'

// bg.jpg(800×1120) 관중석 좌표 — 원본 픽셀 기준
const CROWD_ROWS = [292, 317, 342, 367, 392]           // 좌석 4줄 경계 (y)
const CROWD_ROW_PHASE = [20, 25, 2, 19]                // 줄마다 사람 사이 틈 위치 (x mod 26)
const CROWD_BLOCKS = [[0, 205], [230, 555], [595, 800]] // 계단 통로 제외한 좌/중/우 블록 (x)
const CHUNK_W = 52      // 한 조각 = 관중 2명 폭
const CHUNK_MIN_W = 20  // 이보다 좁은 자투리는 옆 조각에 합침

// 결정적 의사난수 (렌더마다 조각 배치가 바뀌지 않도록)
const hash = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

// 관중석을 줄 × 블록 × 2명 단위 조각으로 분할
const buildChunks = () => {
  const chunks = []
  CROWD_ROW_PHASE.forEach((phase, r) => {
    const y = CROWD_ROWS[r]
    const h = CROWD_ROWS[r + 1] - y
    CROWD_BLOCKS.forEach(([start, end]) => {
      const cuts = [start]
      for (let x = phase; x < end; x += CHUNK_W) {
        if (x - cuts[cuts.length - 1] >= CHUNK_MIN_W && end - x >= CHUNK_MIN_W) cuts.push(x)
      }
      cuts.push(end)
      for (let i = 0; i < cuts.length - 1; i++) {
        const idx = chunks.length
        chunks.push({
          x: cuts[i], y, w: cuts[i + 1] - cuts[i], h,
          delay: hash(idx),                  // 들썩임 위상 (0~1 주기)
          jitter: 0.85 + hash(idx + 99) * 0.3, // 주기 편차 — 조각끼리 박자가 어긋나게
          eager: hash(idx + 7) < 0.3,        // 평소에도 들썩이는 열성 팬
        })
      }
    })
  })
  return chunks
}

const CHUNKS = buildChunks()

// mood: 'calm' | 'warm' | 'hype' | 'fever', hush: 아웃 직후 잠깐 조용
export default function Crowd({ mood, hush }) {
  return (
    <div className={`crowd crowd-${mood}${hush ? ' hush' : ''}`} aria-hidden="true">
      {CHUNKS.map((c, i) => (
        <div
          key={i}
          className={`crowd-chunk${c.eager ? ' eager' : ''}`}
          style={{
            '--x': c.x, '--y': c.y, '--w': c.w, '--h': c.h,
            '--d': c.delay, '--j': c.jitter, '--wave': c.x / 800,
          }}
        />
      ))}
    </div>
  )
}
