import { useRef } from "react";

// 각도 다이얼: 반원 각도기를 손가락(마우스)으로 끌어 돌린다. 0° = 오른쪽, 90° = 위, 180° = 왼쪽.
// 다이얼 가운데에서 손가락 쪽이 곧 포신 방향 (반원 아래로 내려가면 가까운 끝 0°·180°에 붙음).

const R = 44;
const LINE = "#1f2937";

type Props = {
  angle: number;
  color: string;
  onChange: (angle: number) => void;
};

export function AngleDial({ angle, color, onChange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  function angleAt(e: React.PointerEvent): number | null {
    const m = svgRef.current?.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    const dx = p.x;
    const dy = -p.y; // 위로 +
    if (Math.hypot(dx, dy) < 3) return null;
    const a = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (a >= 0) return a;
    return dx >= 0 ? 0 : 180;
  }
  function update(e: React.PointerEvent) {
    const a = angleAt(e);
    if (a !== null) onChange(Math.round(a));
  }

  const rad = (angle * Math.PI) / 180;
  const nx = Math.cos(rad) * (R - 6);
  const ny = -Math.sin(rad) * (R - 6);
  const arc = (a0: number, a1: number, r: number) => {
    const p = (a: number) =>
      `${(Math.cos((a * Math.PI) / 180) * r).toFixed(2)},${(-Math.sin((a * Math.PI) / 180) * r).toFixed(2)}`;
    return `M${p(a0)} A${r},${r} 0 0 0 ${p(a1)}`;
  };

  return (
    <svg
      ref={svgRef}
      className="at-dial"
      viewBox="-52 -52 104 58"
      role="slider"
      aria-label="각도"
      aria-valuemin={0}
      aria-valuemax={180}
      aria-valuenow={Math.round(angle)}
      onPointerDown={(e) => {
        e.preventDefault();
        try {
          e.currentTarget.setPointerCapture?.(e.pointerId);
        } catch {
          // 이미 뗀 손가락이면 무시
        }
        dragging.current = true;
        update(e);
      }}
      onPointerMove={(e) => dragging.current && update(e)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      {/* 판 */}
      <path
        d={`${arc(0, 180, R + 4)} Z`}
        fill="#fff"
        stroke={LINE}
        strokeWidth={1.6}
      />
      {/* 눈금: 15°마다, 45°마다 길게 */}
      {Array.from({ length: 13 }, (_, i) => i * 15).map((a) => {
        const r0 = a % 45 === 0 ? R - 7 : R - 3;
        const c = Math.cos((a * Math.PI) / 180);
        const s = -Math.sin((a * Math.PI) / 180);
        return (
          <line
            key={a}
            x1={c * r0}
            y1={s * r0}
            x2={c * (R + 1)}
            y2={s * (R + 1)}
            stroke={LINE}
            strokeWidth={a % 45 === 0 ? 1.4 : 0.8}
          />
        );
      })}
      {[0, 45, 90, 135, 180].map((a) => {
        const c = Math.cos((a * Math.PI) / 180);
        const s = -Math.sin((a * Math.PI) / 180);
        const r = R - 13;
        // 0·180은 바닥선에 안 가리게 조금 위로
        return (
          <text
            key={a}
            x={c * r}
            y={s * r + (a % 180 === 0 ? -2.5 : 2.5)}
            textAnchor="middle"
            fontSize={6.5}
            fill="#6b7280"
            fontWeight={700}
          >
            {a}
          </text>
        );
      })}
      {/* 바늘 = 포신 */}
      <line
        x1={0}
        y1={0}
        x2={nx}
        y2={ny}
        stroke={LINE}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <line
        x1={0}
        y1={0}
        x2={nx}
        y2={ny}
        stroke={color}
        strokeWidth={2.8}
        strokeLinecap="round"
      />
      <circle
        cx={nx}
        cy={ny}
        r={4.5}
        fill={color}
        stroke={LINE}
        strokeWidth={1.4}
      />
      <circle
        cx={0}
        cy={0}
        r={4.5}
        fill={color}
        stroke={LINE}
        strokeWidth={1.4}
      />
    </svg>
  );
}
