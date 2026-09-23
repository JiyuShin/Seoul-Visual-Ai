import { useId } from 'react';
import { VOTE_VIEWER_IDS } from '../../shared/gazeConfig';
import styles from './CardHoverOutline.module.css';

const SVG_W = 800.537;
const SVG_H = 1135.83;
const STROKE = 7;
const RX = 44.151;
const X = STROKE / 2;
const Y = STROKE / 2;
const W = SVG_W - STROKE;
const H = SVG_H - STROKE;

function outlineVariant(viewers = []) {
  const purpleCursor = viewers.includes(VOTE_VIEWER_IDS[0]);
  const orangeCursor = viewers.includes(VOTE_VIEWER_IDS[1]);
  if (purpleCursor && orangeCursor) return 'both';
  if (orangeCursor) return 'green';
  return 'purple';
}

function gradientStops(variant) {
  if (variant === 'green') {
    return [
      { offset: '0', color: '#65FF00' },
      { offset: '1', color: '#65FF00' },
    ];
  }
  if (variant === 'purple') {
    return [
      { offset: '0', color: '#7C20CC' },
      { offset: '1', color: '#7C20CC' },
    ];
  }
  return [
    { offset: '0', color: '#65FF00' },
    { offset: '0.5', color: '#FFFFFF' },
    { offset: '1', color: '#7C20CC' },
  ];
}

function gradientCoords(variant) {
  if (variant === 'both') {
    return { x1: '0', y1: '0', x2: String(SVG_W), y2: '0' };
  }
  return { x1: '0', y1: '0', x2: '0', y2: String(SVG_H) };
}

export function CardHoverOutline({ viewers }) {
  const rawId = useId().replace(/:/g, '');
  const gradId = `cardHoverStroke-${rawId}`;
  const variant = outlineVariant(viewers);
  const coords = gradientCoords(variant);

  return (
    <svg
      className={styles.outline}
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        className={styles.stroke}
        d={`M ${X},${Y + RX} A ${RX} ${RX} 0 0 1 ${X + RX},${Y} L ${X + W - RX},${Y} A ${RX} ${RX} 0 0 1 ${X + W},${Y + RX} L ${X + W},${Y + H - RX} A ${RX} ${RX} 0 0 1 ${X + W - RX},${Y + H} L ${X + RX},${Y + H} A ${RX} ${RX} 0 0 1 ${X},${Y + H - RX} Z`}
        stroke={`url(#${gradId})`}
        strokeWidth={STROKE}
        strokeLinejoin="round"
        pathLength="100"
        strokeDasharray="100"
        strokeDashoffset="100"
      >
        <animate
          attributeName="stroke-dashoffset"
          from="100"
          to="0"
          dur="0.85s"
          fill="freeze"
          calcMode="spline"
          keyTimes="0;1"
          keySplines="0.22 1 0.36 1"
        />
      </path>
      <defs>
        <linearGradient id={gradId} gradientUnits="userSpaceOnUse" {...coords}>
          {gradientStops(variant).map((stop) => (
            <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
          ))}
        </linearGradient>
      </defs>
    </svg>
  );
}
