import styles from './MobilePlantNameChip.module.css';

/** Figma 1926:5230 */
export default function MobilePlantNameChip({ name = '', className = '' }) {
  const display = name.trim() || '—';

  return (
    <div className={`${styles.chip} ${className}`.trim()} data-figma-node="1926:5230">
      <span className={styles.glass} aria-hidden="true" />
      <span className={styles.inset} aria-hidden="true" />
      <p className={styles.label}>{display}</p>
    </div>
  );
}
