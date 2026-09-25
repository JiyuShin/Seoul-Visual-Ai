import styles from './MobileViewport.module.css';

/**
 * 모바일 작업용 뷰포트. 데스크톱에서는 390×844 프레임, 실제 폭이 좁으면 전체 화면.
 * 다른 페이지·전역 스타일과 분리된 CSS Module 만 사용한다.
 */
export default function MobileViewport({ children }) {
  return (
    <div className={styles.chrome}>
      <div className={styles.frame}>
        <div className={styles.safe}>{children}</div>
      </div>
    </div>
  );
}
