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
  color = '#1e40af',
  left = 72,
}: {
  data: Point[]
  height?: number
  color?: string
  left?: number
}) {
  const max = Math.max(...data.map((d) => d.value), 1)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = React.useState(600)
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null)
  const [tooltipPos, setTooltipPos] = React.useState({ x: 0, y: 0 })

  React.useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth)
      }
    }
    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  const responsiveLeft = containerWidth < 640 ? 48 : left
  const width = containerWidth
  const availableWidth = Math.max(0, width - responsiveLeft - 24)
  const barSlot = data.length > 0 ? Math.floor(availableWidth / data.length) : 0
  const barWidth = Math.max(12, Math.min(72, Math.floor(barSlot * 0.7)))
  const barSpacing = data.length > 0 ? Math.max(8, Math.floor(availableWidth / data.length) - barWidth) : 16
  const chartWidth = Math.max(width, responsiveLeft + 24 + (data.length * (barWidth + barSpacing)))

  const ticks = computeTicks(max, 6)

  return (
    <div ref={containerRef} className="w-full max-w-full bg-card rounded-lg border p-2 sm:p-4 relative">
      {hoveredIndex !== null && (
        <div
          className="absolute z-10 bg-black text-white rounded px-2 py-1.5 shadow-lg pointer-events-none animate-in fade-in-0 zoom-in-95 duration-200"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            transform: 'translateX(-50%) translateY(-100%)',
            marginTop: '-6px',
          }}
        >
          <div className="font-semibold mb-0.5 text-[10px]">{data[hoveredIndex].label}</div>
          <div className="text-[9px] opacity-90">Statistics: {commas(data[hoveredIndex].value)}</div>
          <div
            className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full w-0 h-0 border-l-[3px] border-r-[3px] border-t-[3px] border-transparent border-t-black"
          />
        </div>
      )}
      <svg 
        width="100%" 
        height={height} 
        viewBox={`0 0 ${chartWidth} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ maxWidth: '100%', height: 'auto' }}
      >
        {/* background grid + y-axis labels */}
        <g>
          {ticks.map((t, i) => {
            const y = height - 24 - (t / ticks[ticks.length - 1]) * (height - 48)
            return (
              <g key={t}>
                <line x1={responsiveLeft} x2={chartWidth - 24} y1={y} y2={y} stroke="#e5e7eb" strokeWidth={1} />
                <text x={responsiveLeft - 8} y={y + 4} fontSize={containerWidth < 640 ? 10 : 12} textAnchor="end" fill="#6b7280">
                  {commas(t)}
                </text>
              </g>
            )
          })}
        </g>

        {/* bars */}
        <g>
          {data.map((d, i) => {
            const x = responsiveLeft + i * (barWidth + barSpacing) + 12
            const h = (d.value / ticks[ticks.length - 1]) * (height - 48)
            const y = height - h - 24
            
            // Abbreviate month names on small screens
            const getLabel = (label: string) => {
              if (containerWidth < 768) {
                const monthAbbr: { [key: string]: string } = {
                  'January': 'Jan', 'February': 'Feb', 'March': 'Mar', 'April': 'Apr',
                  'May': 'May', 'June': 'Jun', 'July': 'Jul', 'August': 'Aug',
                  'September': 'Sep', 'October': 'Oct', 'November': 'Nov', 'December': 'Dec'
                }
                return monthAbbr[label] || label
              }
              return label
            }
            
            // Responsive font size based on container width
            const fontSize = containerWidth < 480 ? 8 : containerWidth < 640 ? 9 : containerWidth < 1024 ? 10 : 11
            const textY = height - 6
            
            const barCenterX = x + barWidth / 2
            const handleMouseEnter = (e: React.MouseEvent<SVGElement>) => {
              setHoveredIndex(i)
              const svg = e.currentTarget.ownerSVGElement
              if (svg && containerRef.current) {
                const svgRect = svg.getBoundingClientRect()
                const containerRect = containerRef.current.getBoundingClientRect()
                const scaleX = svgRect.width / chartWidth
                setTooltipPos({
                  x: (barCenterX * scaleX) + (svgRect.left - containerRect.left),
                  y: (y * (svgRect.height / height)) + (svgRect.top - containerRect.top)
                })
              }
            }
            
            const handleMouseLeave = () => {
              setHoveredIndex(null)
            }
            
            return (
              <g key={d.label}>
                <rect 
                  x={x} 
                  y={y} 
                  width={barWidth} 
                  height={h} 
                  fill={color} 
                  rx={6}
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                  style={{ cursor: 'pointer' }}
                />
                <text 
                  x={x + barWidth / 2} 
                  y={textY} 
                  fontSize={fontSize} 
                  textAnchor="middle" 
                  fill="#374151"
                  style={{ userSelect: 'none' }}
                >
                  {getLabel(d.label)}
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
  color = '#1e40af',
  left = 72,
}: {
  data: Point[]
  height?: number
  color?: string
  left?: number
}) {
  const max = Math.max(...data.map((d) => d.value), 1)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = React.useState(600)

  React.useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth)
      }
    }
    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  const responsiveLeft = containerWidth < 640 ? 48 : left
  const w = containerWidth
  const availableWidth = Math.max(0, w - responsiveLeft - 24)
  const step = data.length > 1 ? availableWidth / (data.length - 1) : 0
  const chartWidth = Math.max(w, responsiveLeft + 24 + (data.length > 1 ? (data.length - 1) * step : 0))

  const ticks = computeTicks(max, 6)

  const points = data
    .map((d, i) => {
      const x = responsiveLeft + i * step
      const y = height - 24 - (d.value / ticks[ticks.length - 1]) * (height - 48)
      return `${x},${y}`
    })
    .join(' ')

  return (
    <div ref={containerRef} className="w-full max-w-full bg-card rounded-lg border p-2 sm:p-4">
      <svg 
        width="100%" 
        height={height} 
        viewBox={`0 0 ${chartWidth} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ maxWidth: '100%', height: 'auto' }}
      >
        {/* grid */}
        <g>
          {ticks.map((t) => {
            const y = height - 24 - (t / ticks[ticks.length - 1]) * (height - 48)
            return (
              <g key={t}>
                <line x1={responsiveLeft} x2={chartWidth - 24} y1={y} y2={y} stroke="#e5e7eb" strokeWidth={1} />
                <text x={responsiveLeft - 8} y={y + 4} fontSize={containerWidth < 640 ? 10 : 12} textAnchor="end" fill="#6b7280">
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
          const x = responsiveLeft + i * step
          const y = height - 24 - (d.value / ticks[ticks.length - 1]) * (height - 48)
          
          // Abbreviate month names on small screens
          const getLabel = (label: string) => {
            if (containerWidth < 640) {
              const monthAbbr: { [key: string]: string } = {
                'January': 'Jan', 'February': 'Feb', 'March': 'Mar', 'April': 'Apr',
                'May': 'May', 'June': 'Jun', 'July': 'Jul', 'August': 'Aug',
                'September': 'Sep', 'October': 'Oct', 'November': 'Nov', 'December': 'Dec'
              }
              return monthAbbr[label] || label
            }
            return label
          }
          
          const fontSize = containerWidth < 640 ? 9 : containerWidth < 768 ? 10 : 12
          
          return (
            <g key={d.label}>
              <circle cx={x} cy={y} r={4} fill={color} />
              <text 
                x={x} 
                y={height - 6} 
                fontSize={fontSize} 
                textAnchor="middle" 
                fill="#374151"
                style={{ userSelect: 'none' }}
              >
                {getLabel(d.label)}
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
