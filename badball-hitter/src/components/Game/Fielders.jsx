import './Fielders.css'

// 내야 수비수(유격수·2루수) — 좌우 힌트 열·투수·공 레인을 피한 위치 (left: 화면 %, top: cqh)
// side: 피버 때 도망가는 방향
const FIELDERS = [
  { id: 'ss', left: 31, top: 38, side: 'left', delay: 0 },
  { id: '2b', left: 69, top: 38, side: 'right', delay: 0.35 },
]

// mood: 'normal' | 'hype' | 'fever' | 'out' (GameScreen의 sceneMood)
export default function Fielders({ mood }) {
  return (
    <div className={`fielders fielders-${mood}`} aria-hidden="true">
      {FIELDERS.map((f) => (
        <div
          key={f.id}
          className={`fielder side-${f.side}`}
          style={{ left: `${f.left}%`, top: `${f.top}cqh`, '--delay': `${f.delay}s` }}
        >
          <div className="fielder-body">
            <img className="fielder-sprite" src="/assets/pitcher_idle.png" alt="" draggable={false} />
          </div>
        </div>
      ))}
    </div>
  )
}
