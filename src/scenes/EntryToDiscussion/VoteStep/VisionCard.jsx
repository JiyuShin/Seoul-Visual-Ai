import styles from './VisionCard.module.css';

export default function VisionCard({
  card,
  intensity = 0,
  isWinner = false,
  isHovered = false,
  hoverProgress = 0,
  compact = false,
}) {
  const greenAlpha = 0.08 + intensity * 0.55;
  const borderGlow = intensity * 0.6;
  const hoverScale = isHovered ? 1.06 + hoverProgress * 0.04 : 1;

  return (
    <div
      className={`${styles.cardWrapper} ${isWinner ? styles.winner : ''} ${isHovered ? styles.hovered : ''} ${compact ? styles.compact : ''}`}
      data-card-id={card.id}
      style={{ transform: `scale(${hoverScale})` }}
    >
      {isHovered && <div className={styles.hoverRing} aria-hidden="true" />}
      <div
        className={styles.card}
        style={{
          boxShadow: isHovered
            ? `0 16px 40px rgba(76,175,109,${0.18 + hoverProgress * 0.2}), 0 0 0 2px rgba(102,187,122,${0.55 + hoverProgress * 0.35}), inset 0 0 0 999px rgba(76,175,109,${0.22 + hoverProgress * 0.35})`
            : `0 8px 24px rgba(0,0,0,0.06), 0 0 0 1px rgba(255,255,255,0.5), inset 0 0 0 999px rgba(76,175,109,${greenAlpha})`,
          borderColor: isHovered
            ? `rgba(102,187,122,${0.75 + hoverProgress * 0.2})`
            : `rgba(102,187,122,${0.15 + borderGlow * 0.5})`,
        }}
      >
        <img src={card.image} alt={card.label} className={styles.image} draggable={false} />
        {isHovered && <div className={styles.hoverBadge}>응시 중</div>}
      </div>
      {!compact && (
        <p className={`${styles.label} ${isHovered ? styles.labelHovered : ''}`}>{card.shortLabel}</p>
      )}
    </div>
  );
}
