import * as React from 'react'

type Point = { label: string; value: number }

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 100) / 10}k`
  return String(n)
}

function commas(n: number) {
  return n.toLocaleString()
}

function computeTicks(max: number, steps = 6) {
  const raw = max / steps
  // round raw to sensible value
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = Math.ceil(raw / pow) * pow
  const ticks = []
  for (let i = 0; i <= steps; i++) ticks.push(i * step)
  return ticks
}

export function BarChart({
  data,
  height = 240,
  color = '#5b21b6',
  left = 72,
}: {
  data: Point[]
  height?: number
  color?: string
  left?: number
}) {
  const max = Math.max(...data.map((d) => d.value), 1)
  const width = Math.max(600, data.length * 80)
  const barSlot = Math.floor((width - left - 24) / data.length)
  const barWidth = Math.max(20, Math.min(72, Math.floor(barSlot * 0.7)))

  const ticks = computeTicks(max, 6)

  return (
    <div style={{ overflowX: data.length * (barWidth + 16) > width ? 'auto' : undefined }}>
      <svg width={Math.max(width, data.length * (barWidth + 16) + left + 24)} height={height}>
        {/* background grid + y-axis labels */}
        <g>
          {ticks.map((t, i) => {
            const y = height - 24 - (t / ticks[ticks.length - 1]) * (height - 48)
            return (
              <g key={t}>
                <line x1={left} x2={Math.max(width, data.length * (barWidth + 16) + left + 24)} y1={y} y2={y} stroke="#e6e7eb" strokeWidth={1} />
                <text x={left - 12} y={y + 4} fontSize={12} textAnchor="end" fill="#6b7280">
                  {commas(t)}
                </text>
              </g>
            )
          })}
        </g>

        {/* bars */}
        <g>
          {data.map((d, i) => {
            const x = left + i * (barWidth + 16) + 12
            const h = (d.value / ticks[ticks.length - 1]) * (height - 48)
            const y = height - h - 24
            return (
              <g key={d.label}>
                <rect x={x} y={y} width={barWidth} height={h} fill={color} rx={6} />
                <text x={x + barWidth / 2} y={height - 6} fontSize={12} textAnchor="middle" fill="#374151">
                  {d.label}
                </text>
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}

export function LineChart({
  data,
  height = 240,
  color = '#2563eb',
  left = 72,
}: {
  data: Point[]
  height?: number
  color?: string
  left?: number
}) {
  const max = Math.max(...data.map((d) => d.value), 1)
  const w = Math.max(600, data.length * 80)
  const step = (w - left - 24) / Math.max(1, data.length - 1)

  const ticks = computeTicks(max, 6)

  const points = data
    .map((d, i) => {
      const x = left + i * step
      const y = height - 24 - (d.value / ticks[ticks.length - 1]) * (height - 48)
      return `${x},${y}`
    })
    .join(' ')

  return (
    <div style={{ overflowX: data.length * 80 > w ? 'auto' : undefined }}>
      <svg width={Math.max(w, data.length * 80 + left + 24)} height={height}>
        {/* grid */}
        <g>
          {ticks.map((t) => {
            const y = height - 24 - (t / ticks[ticks.length - 1]) * (height - 48)
            return (
              <g key={t}>
                <line x1={left} x2={Math.max(w, data.length * 80 + left + 24)} y1={y} y2={y} stroke="#e6e7eb" strokeWidth={1} />
                <text x={left - 12} y={y + 4} fontSize={12} textAnchor="end" fill="#6b7280">
                  {commas(t)}
                </text>
              </g>
            )
          })}
        </g>

        <polyline
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          points={points}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {data.map((d, i) => {
          const x = left + i * step
          const y = height - 24 - (d.value / ticks[ticks.length - 1]) * (height - 48)
          return (
            <g key={d.label}>
              <circle cx={x} cy={y} r={4} fill={color} />
              <text x={x} y={height - 6} fontSize={12} textAnchor="middle" fill="#374151">
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export default function Chart() {
  return null
}
