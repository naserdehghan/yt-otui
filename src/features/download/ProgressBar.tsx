interface ProgressBarProps {
  percent: number
  width?: number
}

export function ProgressBar({ percent, width = 40 }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent))
  const filled = Math.round((clamped / 100) * width)
  const bar = "█".repeat(filled) + "░".repeat(width - filled)

  return (
    <text>
      {bar} {clamped.toFixed(1)}%
    </text>
  )
}
