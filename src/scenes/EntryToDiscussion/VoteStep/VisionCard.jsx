import styles from './VisionCard.module.css';

export default function VisionCard({ card, intensity = 0, isWinner = false, compact = false }) {
  const greenAlpha = 0.08 + intensity * 0.55;
  const borderGlow = intensity * 0.6;

  return (
    <div
      className={`${styles.cardWrapper} ${isWinner ? styles.winner : ''} ${compact ? styles.compact : ''}`}
      data-card-id={card.id}
    >
      <div
        className={styles.card}
        style={{
          boxShadow: `0 8px 24px rgba(0,0,0,0.06), 0 0 0 1px rgba(255,255,255,0.5), inset 0 0 0 999px rgba(76,175,109,${greenAlpha})`,
          borderColor: `rgba(102,187,122,${0.15 + borderGlow * 0.5})`,
        }}
      >
        <img src={card.image} alt={card.label} className={styles.image} draggable={false} />
      </div>
      {!compact && <p className={styles.label}>{card.shortLabel}</p>}
    </div>
  );
}
