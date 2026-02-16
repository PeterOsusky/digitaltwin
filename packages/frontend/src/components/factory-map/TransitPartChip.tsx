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
        // Freeze at whatever progress was when stopped
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

      // Keep animating if not done and not stopped
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
  const pillWidth = 44;
  const pillHeight = 16;

  return (
    <g>
      {/* Pill background */}
      <rect
        x={position.x - pillWidth / 2}
        y={position.y - pillHeight / 2}
        width={pillWidth}
        height={pillHeight}
        rx={pillHeight / 2}
        fill="#3b82f6"
        stroke="#1e3a8a"
        strokeWidth={1}
      />
      {/* Part ID label */}
      <text
        x={position.x}
        y={position.y + 4}
        fontSize={9}
        fill="white"
        textAnchor="middle"
        fontWeight={600}
      >
        {label}
      </text>
      {/* Stopped indicator */}
      {transit.stopped && (
        <circle
          cx={position.x + pillWidth / 2 - 2}
          cy={position.y - pillHeight / 2 + 2}
          r={3}
          fill="#ef4444"
        />
      )}
    </g>
  );
}
