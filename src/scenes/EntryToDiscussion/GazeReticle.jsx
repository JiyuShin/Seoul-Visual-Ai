import styles from './GazeReticle.module.css';

export default function GazeReticle({ position, dwellProgress = 0, visible = true }) {
  if (!visible || !position) return null;

  const scale = 1 + dwellProgress * 0.25;
  const fillOpacity = dwellProgress * 0.35;

  return (
    <div
      className={styles.reticle}
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0) translate(-50%, -50%)`,
      }}
      aria-hidden="true"
    >
      <div
        className={`${styles.inner} ${styles.reticleInner}`}
        style={{
          transform: `scale(${scale})`,
          backgroundColor: `rgba(76, 175, 109, ${fillOpacity})`,
        }}
      />
    </div>
  );
}
