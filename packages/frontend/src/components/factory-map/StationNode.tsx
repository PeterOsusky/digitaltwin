import type { StationConfig, StationState } from '../../types.ts';

interface Props {
  config: StationConfig;
  state: StationState | undefined;
}

export function StationNode({ config, state }: Props) {
  const status = state?.status ?? 'offline';
  const isOnline = status === 'online';
  const lastValue = state?.lastValue;
  const resultText = lastValue ? String(lastValue.result ?? '') : '';
  const partId = lastValue ? String(lastValue.partId ?? '') : '';
  const isOk = resultText === 'ok';
  const isNok = resultText === 'nok';
  const hasResult = isOk || isNok;

  const w = 120;
  const h = 50;
  const x = config.position.x - w / 2;
  const y = config.position.y - h / 2;

  // Short part ID for display (last 7 chars)
  const shortPart = partId.length > 7 ? partId.slice(-7) : partId;

  // Indicator above station
  const indicatorW = 90;
  const indicatorH = 18;
  const indicatorX = config.position.x - indicatorW / 2;
  const indicatorY = y - indicatorH - 6;

  // Station border color: green online, red offline
  const borderColor = isOnline ? '#22c55e' : '#ef4444';
  const borderOpacity = isOnline ? 0.8 : 0.6;

  // Indicator color: green OK, red NOK
  const indicatorColor = isOk ? '#22c55e' : '#ef4444';
  const indicatorLabel = isOk ? 'OK' : 'NOK';

  return (
    <g>
      {/* Result indicator above station */}
      {hasResult && (
        <g>
          <rect
            x={indicatorX}
            y={indicatorY}
            width={indicatorW}
            height={indicatorH}
            rx={4}
            fill={indicatorColor}
            opacity={0.9}
          />
          <text
            x={config.position.x}
            y={indicatorY + indicatorH / 2 + 1}
            fontSize={10}
            fill="white"
            fontWeight={800}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {indicatorLabel} {shortPart}
          </text>
          {/* Small triangle pointer down */}
          <polygon
            points={`${config.position.x - 4},${indicatorY + indicatorH} ${config.position.x + 4},${indicatorY + indicatorH} ${config.position.x},${indicatorY + indicatorH + 5}`}
            fill={indicatorColor}
            opacity={0.9}
          />
        </g>
      )}

      {/* Station body */}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={6}
        fill={isOnline ? '#1e293b' : '#1a1a2e'}
        stroke={borderColor}
        strokeWidth={isOnline ? 1.5 : 2}
        opacity={borderOpacity}
      />

      {/* Offline overlay - pulsing red */}
      {!isOnline && (
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={6}
          fill="#ef4444"
          opacity={0.15}
        >
          <animate
            attributeName="opacity"
            values="0.08;0.2;0.08"
            dur="2s"
            repeatCount="indefinite"
          />
        </rect>
      )}

      {/* Station name */}
      <text
        x={config.position.x}
        y={config.position.y - 6}
        fontSize={11}
        fill="white"
        fontWeight={700}
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {config.name}
      </text>

      {/* Status text */}
      <text
        x={config.position.x}
        y={config.position.y + 8}
        fontSize={8}
        fill={isOnline ? '#22c55e' : '#ef4444'}
        fontWeight={600}
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {isOnline ? 'ONLINE' : 'OFFLINE'}
      </text>

      {/* Status dot */}
      <circle
        cx={x + w - 8}
        cy={y + 8}
        r={4}
        fill={isOnline ? '#22c55e' : '#ef4444'}
      >
        {!isOnline && (
          <animate
            attributeName="opacity"
            values="0.4;1;0.4"
            dur="1.5s"
            repeatCount="indefinite"
          />
        )}
      </circle>
    </g>
  );
}
