interface ProgressRingProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}

export function ProgressRing({
  percent,
  size = 36,
  strokeWidth = 3,
  color = '#7C3AED',
}: ProgressRingProps) {
  const r = (size - strokeWidth * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(percent, 100) / 100) * circ;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="text-foreground">
      {/* Track */}
      <circle cx={cx} cy={cy} r={r} fill="none" className="stroke-muted" strokeWidth={strokeWidth} />
      {/* Progress */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dashoffset 0.35s ease' }}
      />
      <text
        x={cx} y={cy + 4}
        textAnchor="middle"
        style={{ fontSize: size * 0.27, fontWeight: 700 }}
        fill="currentColor"
      >
        {percent}%
      </text>
    </svg>
  );
}
