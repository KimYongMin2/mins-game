// 사이트 전체에서 쓰는 선 졸라맨 장식. 색은 currentColor를 따른다.
type Props = {
  size?: number
  className?: string
}

export function StickFigure({ size = 64, className }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="20" cy="8" r="5" />
      <path d="M20 13v14M20 17l-8 6M20 17l8-6M20 27l-6 10M20 27l6 10" />
    </svg>
  )
}
