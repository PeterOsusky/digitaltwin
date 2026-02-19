import { useEffect, useRef, useState } from 'react';
import type { TransitPart } from '../../types.ts';
import { shortPartId } from '../../utils/format.ts';

interface Props {
  transit: TransitPart;
  beltPathId: string;
}

export function TransitPartChip({ transit, beltPathId }: Props) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number>(0);
  const stoppedProgressRef = useRef<number | null>(null);

  useEffect(() => {
    const pathEl = document.getElementById(beltPathId) as SVGPathElement | null;
    if (!pathEl) return;

    const totalLength = pathEl.getTotalLength();

    function animate() {
      let progress: number;

      if (transit.stopped) {
        if (stoppedProgressRef.current === null) {
          stoppedProgressRef.current = Math.min(
            (Date.now() - transit.startedAt) / transit.transitTimeMs,
            1
          );
        }
        progress = stoppedProgressRef.current;
      } else {
        progress = Math.min(
          (Date.now() - transit.startedAt) / transit.transitTimeMs,
          1
        );
      }

      const point = pathEl!.getPointAtLength(totalLength * progress);
      setPosition({ x: point.x, y: point.y });

      if (progress < 1 && !transit.stopped) {
        rafRef.current = requestAnimationFrame(animate);
      }
    }

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [beltPathId, transit.startedAt, transit.transitTimeMs, transit.stopped]);

  if (!position) return null;

  const label = shortPartId(transit.partId);
  const stopped = transit.stopped;
  const r = 5;

  return (
    <g>
      {/* Stopped pulsing ring */}
      {stopped && (
        <circle
          cx={position.x} cy={position.y} r={8}
          fill="none" stroke="#ef4444" strokeWidth={1.5} opacity={0.7}
          className="animate-pulse"
        />
      )}

      {/* Main dot */}
      <circle
        cx={position.x} cy={position.y} r={r}
        fill={stopped ? '#ef4444' : '#3b82f6'}
        stroke={stopped ? '#991b1b' : '#1e3a8a'}
        strokeWidth={1}
      />

      {/* Part ID label above */}
      <text
        x={position.x} y={position.y - r - 3}
        fontSize={5} fill={stopped ? '#fca5a5' : '#93c5fd'}
        textAnchor="middle" fontWeight={600}
        style={{ pointerEvents: 'none' }}
      >
        {label}
      </text>
    </g>
  );
}
