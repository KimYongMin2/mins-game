// 메인 큰 배너 그림 (사용자 요청 2026-11-13 — 경기 사진 대신 직접 그린 그림으로).
// 남색 바탕 + 노란 햇살 무늬 위에 우리 게임 물건들(폭탄·야구공·과녁·카드·권투 글러브)을 모아 그린 SVG.
// 그림은 오른쪽에 모이고(xMaxYMid slice) 왼쪽은 글자 자리. 움직임 없음.

const RAYS = Array.from({ length: 18 }, (_, i) => i)

export function HeroArt({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 960 540" preserveAspectRatio="xMaxYMid slice" aria-hidden>
      <rect width="960" height="540" fill="#1c1748" />
      {/* 햇살 무늬 */}
      <g transform="translate(640 270)">
        {RAYS.map((i) => (
          <path key={i} d="M0 0 L-60 -720 L60 -720 Z" fill={i % 2 ? '#241e5c' : '#2b2470'} transform={`rotate(${i * 20})`} />
        ))}
        <circle r="210" fill="#ffd23f" opacity="0.12" />
        <circle r="150" fill="#ffd23f" opacity="0.16" />
      </g>
      {/* 바닥 점무늬 */}
      <g fill="#ffffff" opacity="0.08">
        {Array.from({ length: 60 }, (_, i) => (
          <circle key={i} cx={360 + (i % 15) * 42 + (Math.floor(i / 15) % 2) * 21} cy={420 + Math.floor(i / 15) * 30} r="3" />
        ))}
      </g>

      {/* 카드 (뒷면 별) */}
      <g transform="translate(470 330) rotate(14)">
        <rect x="8" y="8" width="96" height="132" rx="8" fill="#0f0b2e" />
        <rect width="96" height="132" rx="8" fill="#2f5bd0" stroke="#fff" strokeWidth="6" />
        <path d="M48 40 l9 20 22 2 -17 14 5 22 -19 -12 -19 12 5 -22 -17 -14 22 -2z" fill="#ffd23f" />
      </g>

      {/* 과녁 */}
      <g transform="translate(850 410) scale(0.85)">
        <circle cx="8" cy="8" r="92" fill="#0f0b2e" />
        <circle r="92" fill="#fff" />
        <circle r="74" fill="#1f1b3a" />
        <circle r="56" fill="#2f8fe0" />
        <circle r="38" fill="#e8473f" />
        <circle r="20" fill="#ffd23f" />
        <path d="M-150 -120 L-6 -6" stroke="#8a5a2b" strokeWidth="8" strokeLinecap="round" />
        <path d="M-150 -120 l-22 -4 -4 -22 26 26z" fill="#ff6b5e" />
      </g>

      {/* 폭탄 */}
      <g transform="translate(660 270) scale(0.92)">
        <circle cx="10" cy="10" r="118" fill="#0f0b2e" />
        <circle r="118" fill="#2a2546" />
        <circle r="118" fill="url(#heroShine)" />
        <rect x="-30" y="-150" width="60" height="44" rx="8" fill="#4a4470" transform="rotate(18)" />
        <path d="M30 -150 C 60 -210, 120 -200, 120 -250" fill="none" stroke="#c99a5b" strokeWidth="10" strokeLinecap="round" />
        <g transform="translate(122 -262)">
          <path d="M0 -40 L10 -12 40 -14 16 4 26 34 0 16 -26 34 -16 4 -40 -14 -10 -12z" fill="#ffd23f" />
          <path d="M0 -20 L5 -6 20 -7 8 2 13 17 0 8 -13 17 -8 2 -20 -7 -5 -6z" fill="#ff6b5e" />
        </g>
        <ellipse cx="-44" cy="-50" rx="26" ry="14" fill="#fff" opacity="0.35" transform="rotate(-35 -44 -50)" />
      </g>

      {/* 야구공 */}
      <g transform="translate(860 120) rotate(20)">
        <circle cx="8" cy="8" r="62" fill="#0f0b2e" />
        <circle r="62" fill="#fff" />
        <path d="M-34 -50 C -10 -20, -10 20, -34 50" fill="none" stroke="#e8473f" strokeWidth="5" strokeDasharray="7 6" />
        <path d="M34 -50 C 10 -20, 10 20, 34 50" fill="none" stroke="#e8473f" strokeWidth="5" strokeDasharray="7 6" />
      </g>

      {/* 권투 글러브 */}
      <g transform="translate(450 150) rotate(-18) scale(0.78)">
        <path d="M8 8 h110 a46 46 0 0 1 0 92 h-110 z" fill="#0f0b2e" />
        <path d="M0 0 h110 a46 46 0 0 1 0 92 h-110 z" fill="#e8473f" />
        <path d="M70 0 a30 30 0 0 1 0 50 h40" fill="none" stroke="#b8322a" strokeWidth="6" />
        <rect x="-40" y="6" width="44" height="80" rx="6" fill="#fff" />
        <rect x="-40" y="38" width="44" height="14" fill="#ffd23f" />
      </g>

      {/* 반짝이 */}
      <g fill="#ffd23f">
        <path d="M520 60 l5 14 14 5 -14 5 -5 14 -5 -14 -14 -5 14 -5z" />
        <path d="M930 280 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4z" />
        <path d="M420 300 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z" opacity="0.8" />
      </g>

      <defs>
        <radialGradient id="heroShine" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.18" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.25" />
        </radialGradient>
      </defs>
    </svg>
  )
}
