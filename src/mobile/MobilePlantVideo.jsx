import { MOBILE_LOADING_POSTER_SRC, MOBILE_LOADING_VIDEO_SRC } from './mobileConfig';
import styles from './MobilePlantVideo.module.css';

/** Figma 1690:706 — 로딩·드로잉 공통 식물 영상 배경 */
export default function MobilePlantVideo({
  videoSrc = MOBILE_LOADING_VIDEO_SRC,
  posterSrc = MOBILE_LOADING_POSTER_SRC,
  onEnded,
}) {
  return (
    <div className={styles.slot} data-figma-node="1690:706" aria-hidden="true">
      <video
        className={styles.video}
        src={videoSrc}
        poster={posterSrc}
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={onEnded}
      />
    </div>
  );
}
