import { condition } from '../lib/wmo'

interface Props {
  code: number | null | undefined
  isDay?: boolean
  size?: number
}

const CLOUD = 'M9.5 24h13a5 5 0 0 0 .7-9.95 7 7 0 0 0-13.4-1.3A5.7 5.7 0 0 0 9.5 24z'
const SMALL_CLOUD = 'M12 26h11a4.2 4.2 0 0 0 .6-8.36 5.9 5.9 0 0 0-11.3-1.1A4.8 4.8 0 0 0 12 26z'

function Sun({ cx = 16, cy = 16, r = 5.5 }: { cx?: number; cy?: number; r?: number }) {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4
    return (
      <line
        key={i}
        x1={cx + Math.cos(a) * (r + 2.5)}
        y1={cy + Math.sin(a) * (r + 2.5)}
        x2={cx + Math.cos(a) * (r + 5)}
        y2={cy + Math.sin(a) * (r + 5)}
      />
    )
  })
  return (
    <g className="wi-sun">
      <circle cx={cx} cy={cy} r={r} />
      {rays}
    </g>
  )
}

function Moon({ x = 0, y = 0, scale = 1 }: { x?: number; y?: number; scale?: number }) {
  return (
    <path
      className="wi-moon"
      transform={`translate(${x} ${y}) scale(${scale})`}
      d="M21 18.5A8 8 0 0 1 12.5 8a8 8 0 1 0 8.5 10.5z"
    />
  )
}

function Drops({ count, heavy }: { count: number; heavy?: boolean }) {
  const xs = count === 2 ? [13, 19] : [11, 16, 21]
  return (
    <g className="wi-rain">
      {xs.map((x) => (
        <line key={x} x1={x} y1={26.5} x2={x - 1.5} y2={heavy ? 31 : 29.5} />
      ))}
    </g>
  )
}

export default function WeatherIcon({ code, isDay = true, size = 32 }: Props) {
  const { icon, label } = condition(code)
  let body
  switch (icon) {
    case 'clear':
      body = isDay ? <Sun /> : <Moon x={0} y={1} />
      break
    case 'partly':
      body = (
        <>
          {isDay ? <Sun cx={11} cy={11} r={4} /> : <Moon x={-1} y={-2} scale={0.7} />}
          <path className="wi-cloud" d={SMALL_CLOUD} />
        </>
      )
      break
    case 'fog':
      body = (
        <g className="wi-fog">
          <path className="wi-cloud" d={CLOUD} transform="translate(0 -4)" />
          <line x1="8" y1="25" x2="24" y2="25" />
          <line x1="11" y1="29" x2="21" y2="29" />
        </g>
      )
      break
    case 'drizzle':
      body = (
        <>
          <path className="wi-cloud" d={CLOUD} transform="translate(0 -2)" />
          <Drops count={2} />
        </>
      )
      break
    case 'rain':
      body = (
        <>
          <path className="wi-cloud" d={CLOUD} transform="translate(0 -2)" />
          <Drops count={3} />
        </>
      )
      break
    case 'heavy':
      body = (
        <>
          <path className="wi-cloud wi-dark" d={CLOUD} transform="translate(0 -3)" />
          <Drops count={3} heavy />
        </>
      )
      break
    case 'snow':
      body = (
        <>
          <path className="wi-cloud" d={CLOUD} transform="translate(0 -2)" />
          <g className="wi-snow">
            <circle cx="11" cy="27.5" r="1.3" />
            <circle cx="16" cy="29.5" r="1.3" />
            <circle cx="21" cy="27.5" r="1.3" />
          </g>
        </>
      )
      break
    case 'thunder':
      body = (
        <>
          <path className="wi-cloud wi-dark" d={CLOUD} transform="translate(0 -3)" />
          <path className="wi-bolt" d="M17 20l-4.5 6h3.5l-1.5 5 5-7h-3.5z" />
        </>
      )
      break
    default:
      body = <path className="wi-cloud" d={CLOUD} />
  }
  return (
    <svg className="wi" width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={label}>
      {body}
    </svg>
  )
}
