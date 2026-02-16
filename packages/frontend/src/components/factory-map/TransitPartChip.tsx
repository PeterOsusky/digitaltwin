import { useEffect, useRef, useState } from 'react';
import type { TransitPart } from '../../types.ts';
import { shortPartId } from '../../utils/format.ts';

interface Props {
  transit: TransitPart;
  beltPathId: string;
  isSelected?: boolean;
  onClick?: () => void;
}

export function TransitPartChip({ transit, beltPathId, isSelected, onClick }: Props) {
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

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.();
  };

  const r = 7;

  return (
    <g onClick={handleClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      {/* Invisible hit area for easier clicking */}
      <circle cx={position.x} cy={position.y} r={14} fill="transparent" />

      {/* Selection ring */}
      {isSelected && (
        <circle
          cx={position.x} cy={position.y} r={12}
          fill="none" stroke="#60a5fa" strokeWidth={2} opacity={0.8}
          filter="url(#glow)"
        />
      )}

      {/* Stopped pulsing ring */}
      {stopped && !isSelected && (
        <circle
          cx={position.x} cy={position.y} r={11}
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
        fontSize={7} fill={stopped ? '#fca5a5' : '#93c5fd'}
        textAnchor="middle" fontWeight={600}
      >
        {label}
      </text>
    </g>
  );
}
