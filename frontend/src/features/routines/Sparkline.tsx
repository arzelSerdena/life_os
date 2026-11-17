/**
 * A tile's small line: 104 × 32, a smooth line over a light wash, with a dot at the end.
 * Green when the trend is good, red when it is bad. Each point's value shows on hover.
 */
export function Sparkline({
  points,
  tips,
  good,
}: {
  points: (number | null)[];
  tips: string[];
  good: boolean;
}) {
  const color = good ? "var(--color-positive-600)" : "var(--color-negative-600)";
  const shown = points.flatMap((value, index) => (value === null ? [] : [{ value, index }]));
  if (shown.length < 2) return <svg aria-hidden className="ml-auto h-8 w-[104px]" />;
  const values = shown.map((point) => point.value);
  const low = Math.min(...values);
  const range = Math.max(...values) - low || 1;
  const last = points.length - 1 || 1;
  const xy = shown.map(({ value, index }) => ({
    x: 4 + (96 * index) / last,
    y: 26 - (20 * (value - low)) / range,
    tip: tips[index],
  }));
  let line = `M${xy[0].x.toFixed(1)},${xy[0].y.toFixed(1)}`;
  for (let k = 1; k < xy.length; k++) {
    const from = xy[k - 1];
    const to = xy[k];
    const dx = (to.x - from.x) / 3;
    line += ` C${(from.x + dx).toFixed(1)},${from.y.toFixed(1)} ${(to.x - dx).toFixed(1)},${to.y.toFixed(1)} ${to.x.toFixed(1)},${to.y.toFixed(1)}`;
  }
  const end = xy[xy.length - 1];
  const wash = `${line} L${end.x.toFixed(1)},32 L${xy[0].x.toFixed(1)},32Z`;
  return (
    <svg
      aria-hidden
      viewBox="0 0 104 32"
      className="ml-auto h-8 w-[104px] shrink-0 overflow-visible"
    >
      <path d={wash} fill={color} opacity={0.08} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {xy.map((point) => (
        <circle key={point.x} cx={point.x} cy={point.y} r={7} fill="transparent">
          <title>{point.tip}</title>
        </circle>
      ))}
      <circle cx={end.x} cy={end.y} r={3.5} fill={color} stroke="white" strokeWidth={2} />
    </svg>
  );
}
