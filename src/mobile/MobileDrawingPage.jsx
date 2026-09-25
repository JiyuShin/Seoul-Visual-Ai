import { useRef, useState } from 'react';
import { DRAWING_COLORS, DRAWING_TAGS } from './drawingConfig';
import MobileDrawingBoard from './MobileDrawingBoard';
import MobileStatusBar from './MobileStatusBar';
import { usePlantDrawing } from './usePlantDrawing';
import styles from './MobileDrawingPage.module.css';

/** Figma 1672:833 — 드로잉 인풋 */
export default function MobileDrawingPage({
  districtName = '용산구',
  enterFromLoading = false,
  exiting = false,
  onNext,
}) {
  const canvasRef = useRef(null);
  const [color, setColor] = useState(DRAWING_COLORS[3].value);
  const { onPointerDown, onPointerMove, onPointerUp, undo, getExportDataUrl, hasDrawing } =
    usePlantDrawing(canvasRef, color);

  const handleNext = () => {
    if (!hasDrawing) return;
    onNext?.(getExportDataUrl());
  };

  return (
    <div
      className={`${styles.artboard} ${enterFromLoading ? styles.artboardEnter : ''} ${
        exiting ? styles.artboardExiting : ''
      }`}
      data-figma-node="1672:833"
    >
      <div className={styles.gradient} aria-hidden="true" data-figma-node="1672:836" />
      <MobileStatusBar />
      <header className={styles.copy} data-figma-node="1672:1111">
        <h1 className={styles.district}>{districtName}</h1>
        <p className={styles.lead}>
          <span className={styles.leadStrong}>녹지 가득한 {districtName}</span>
          를 만들기 위해
          <br />
          나만의 식물을 자유롭게 그려주세요
        </p>
      </header>
      <div className={styles.tags} data-figma-node="1672:861">
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
        chrome={
          <>
            <button
              type="button"
              className={styles.undoBtn}
              aria-label="되돌리기"
              onClick={(event) => {
                event.stopPropagation();
                undo();
              }}
            >
              <img src="/mobile/icon-undo.svg" alt="" />
            </button>
            <div className={styles.paletteWrap} data-figma-node="1672:1115">
              <img
                className={styles.paletteTray}
                src="/mobile/palette-tray.svg"
                alt=""
                aria-hidden="true"
              />
              <div className={styles.paletteSwatches} data-figma-node="1672:1116">
                {DRAWING_COLORS.map((swatch) => (
                  <button
                    key={swatch.id}
                    type="button"
                    className={`${styles.swatch} ${color === swatch.value ? styles.swatchSelected : ''}`}
                    style={{ background: swatch.gradient }}
                    aria-label={`색 ${swatch.id}`}
                    aria-pressed={color === swatch.value}
                    onClick={() => setColor(swatch.value)}
                  />
                ))}
              </div>
            </div>
          </>
        }
      >
        <canvas
          ref={canvasRef}
          className={`${styles.drawSurfacePreview} ${styles.drawCanvas}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </MobileDrawingBoard>
      <button
        type="button"
        className={`${styles.nextBtn} ${hasDrawing ? styles.nextBtnActive : styles.nextBtnDisabled}`}
        data-figma-node="1692:696"
        disabled={!hasDrawing}
        aria-disabled={!hasDrawing}
        onClick={handleNext}
      >
        <img className={styles.nextBg} src="/mobile/btn-next.svg" alt="" aria-hidden="true" />
        <span className={styles.nextLabel}>다음</span>
      </button>
    </div>
  );
}
