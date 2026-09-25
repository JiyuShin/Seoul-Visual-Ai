import { DRAWING_TAGS } from './drawingConfig';
import MobileDrawingBoard from './MobileDrawingBoard';
import drawingStyles from './MobileDrawingPage.module.css';
import MobileStatusBar from './MobileStatusBar';
import styles from './MobileSavePage.module.css';

/** Figma 1693:965 — 세이브(미리보기) */
export default function MobileSavePage({
  districtName = '용산구',
  drawingUrl = null,
  enterFromDrawing = false,
  exiting = false,
  onComplete,
}) {
  return (
    <div
      className={`${styles.artboard} ${enterFromDrawing ? styles.artboardEnter : ''} ${
        enterFromDrawing ? styles.artboardEnterFromDrawing : ''
      } ${exiting ? styles.artboardExiting : ''}`}
      data-figma-node="1693:965"
    >
      <div
        className={`${drawingStyles.gradient} ${styles.saveGradientSlot}`}
        aria-hidden="true"
        data-figma-node="1693:970"
      />
      <div className={styles.statusBarSlot}>
        <MobileStatusBar />
      </div>
      <header className={styles.copy} data-figma-node="1693:982">
        <h1 className={styles.district}>{districtName}</h1>
        <p className={styles.lead}>
          <span className={styles.leadStrong}>녹지 가득한 {districtName}</span>
          를 만들기 위해
          <br />
          나만의 식물을 자유롭게 그려주세요
        </p>
      </header>
      <div className={styles.tags} data-figma-node="1693:975">
        {DRAWING_TAGS.map((label, index) => (
          <span
            key={label}
            className={`${styles.tag} ${index === DRAWING_TAGS.length - 1 ? styles.tagMuted : ''}`}
          >
            {label}
          </span>
        ))}
      </div>
      <MobileDrawingBoard
        shellClassName={styles.savePanelShell}
        dataFigmaShell="1693:973"
        dataFigmaPanel="1693:973"
      >
        {drawingUrl ? (
          <img
            className={drawingStyles.drawSurfacePreview}
            src={drawingUrl}
            alt=""
            decoding="async"
            draggable={false}
          />
        ) : null}
      </MobileDrawingBoard>
      <button
        type="button"
        className={`${drawingStyles.nextBtn} ${styles.completeBtn}`}
        data-figma-node="1693:985"
        onClick={onComplete}
      >
        <img className={drawingStyles.nextBg} src="/mobile/btn-next.svg" alt="" aria-hidden="true" />
        <span className={drawingStyles.nextLabel}>내 식물 완성하기</span>
      </button>
    </div>
  );
}
