import drawingStyles from './MobileDrawingPage.module.css';
import MobileStatusBar from './MobileStatusBar';
import styles from './MobileEndPage.module.css';

/** Figma 1693:989 — 전송 확인 */
export default function MobileEndPage({
  plantName = '',
  drawingUrl = null,
  enterFromTag = false,
  onSend,
}) {
  return (
    <div
      className={`${styles.artboard} ${enterFromTag ? styles.artboardEnter : ''}`}
      data-figma-node="1693:989"
    >
      <div className={styles.gradient} aria-hidden="true" data-figma-node="1693:994" />
      <div className={styles.statusBarSlot}>
        <MobileStatusBar />
      </div>
      <header className={styles.copy} data-figma-node="1693:997">
        <h1 className={styles.title}>전송할까요?</h1>
        <div className={styles.lead}>
          <p className={styles.leadLine}>심을 준비가 완료되었어요! </p>
          <p className={`${styles.leadLine} ${styles.leadStrong}`}>
            전송 버튼을 누르면 식물이 화면으로 이동해요.
          </p>
        </div>
      </header>
      <div className={styles.namePanelShell} data-figma-node="1693:1000">
        <div className={styles.namePanel}>
          <p className={styles.namePanelLabel}>{plantName || '—'}</p>
          {drawingUrl ? (
            <div className={styles.namePanelDrawing}>
              <img
                className={styles.namePanelDrawingImg}
                src={drawingUrl}
                alt=""
                decoding="async"
                draggable={false}
              />
            </div>
          ) : null}
        </div>
      </div>
      <button type="button" className={styles.sendBtn} data-figma-node="1693:1002" onClick={onSend}>
        <img className={styles.sendBtnBg} src="/mobile/btn-next.svg" alt="" aria-hidden="true" />
        <span className={styles.sendBtnLabel}>전송</span>
      </button>
    </div>
  );
}
