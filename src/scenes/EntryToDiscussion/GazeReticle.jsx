import styles from './GazeReticle.module.css';

export default function GazeReticle({ position, dwellProgress = 0, visible = true }) {
  if (!visible || !position) return null;

  const scale = 1 + dwellProgress * 0.25;
  const fillOpacity = dwellProgress * 0.35;
  const locked = position.locked;

  return (
    <div
      className={`${styles.reticle} ${locked ? styles.reticleLocked : ''}`}
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0) translate(-50%, -50%)`,
      }}
      aria-hidden="true"
    >
      <div
        className={`${styles.inner} ${styles.reticleInner}`}
        style={{
          transform: `scale(${scale})`,
          backgroundColor: locked
            ? `rgba(76, 175, 109, ${0.25 + dwellProgress * 0.25})`
            : `rgba(76, 175, 109, ${fillOpacity})`,
        }}
      />
    </div>
  );
}
