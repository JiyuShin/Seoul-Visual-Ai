import styles from './VisionCard.module.css';

/**
 * 비전 카드.
 *
 * 응시 단계(stage)에 따라 크기가 두 번 커진다. 한 사람이 보면 조금,
 * 두 사람이 함께 보면 최종 크기까지 커져서 둘이 같이 고른 느낌이 나게 한다.
 */
export default function VisionCard({
  card,
  intensity = 0,
  isWinner = false,
  compact = false,
  stage = 0,
  scale = 1,
  progress = 0,
  viewers = [],
  requiredViewers = 2,
}) {
  const isGazed = stage >= 1;
  const isJoint = stage >= requiredViewers;

  // 단계가 올라가고 점수가 쌓일수록 초록빛이 진해진다.
  const greenAlpha = 0.08 + Math.max(intensity, stage * 0.22 + progress * 0.3) * 0.55;
  const ringAlpha = 0.35 + stage * 0.2 + progress * 0.25;

  return (
    <div
      className={[
        styles.cardWrapper,
        isWinner ? styles.winner : '',
        isGazed ? styles.gazed : '',
        isJoint ? styles.joint : '',
        compact ? styles.compact : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-card-id={card.id}
      data-stage={stage}
      style={{ transform: `scale(${scale})` }}
    >
      {isGazed && (
        <div
          className={styles.hoverRing}
          style={{ borderColor: `rgba(102,187,122,${Math.min(0.95, ringAlpha)})` }}
          aria-hidden="true"
        />
      )}

      <div
        className={styles.card}
        style={{
          boxShadow: isGazed
            ? `0 16px 40px rgba(76,175,109,${0.16 + stage * 0.08}), 0 0 0 ${stage}px rgba(102,187,122,${0.5 + progress * 0.4}), inset 0 0 0 999px rgba(76,175,109,${greenAlpha})`
            : `0 8px 24px rgba(0,0,0,0.06), 0 0 0 1px rgba(255,255,255,0.5), inset 0 0 0 999px rgba(76,175,109,${greenAlpha})`,
          borderColor: isGazed
            ? `rgba(102,187,122,${0.6 + stage * 0.15})`
            : `rgba(102,187,122,${0.15 + intensity * 0.3})`,
        }}
      >
        <img src={card.image} alt={card.label} className={styles.image} draggable={false} />

        {isGazed && (
          <div className={styles.viewerDots} aria-hidden="true">
            {Array.from({ length: requiredViewers }).map((_, index) => (
              <span
                key={index}
                className={`${styles.viewerDot} ${index < stage ? styles.viewerDotOn : ''}`}
              />
            ))}
          </div>
        )}

        {progress > 0 && (
          <div className={styles.progressTrack} aria-hidden="true">
            <div className={styles.progressFill} style={{ width: `${progress * 100}%` }} />
          </div>
        )}
      </div>

      {isGazed && (
        <div className={`${styles.hoverBadge} ${isJoint ? styles.hoverBadgeJoint : ''}`}>
          {isJoint ? '함께 보는 중' : `${viewers.length || stage}명 응시`}
        </div>
      )}

      {!compact && (
        <p className={`${styles.label} ${isGazed ? styles.labelHovered : ''}`}>{card.shortLabel}</p>
      )}
    </div>
  );
}
