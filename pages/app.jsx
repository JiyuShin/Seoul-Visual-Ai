import { useEffect } from 'react';
import { useRouter } from 'next/router';
import EntryPageShell from '../src/shared/EntryPageShell';
import { useEntryFlow } from '../src/shared/EntryFlowContext';
import styles from '../src/calibration/Calibration.module.css';

export default function CalibrationPage() {
  const router = useRouter();
  const {
    isReady,
    isCalibrating,
    calibrationIndex,
    calibrationTotal,
    calibrationPoint,
    calibrationHint,
    faceDetected,
    cameraActive,
    trackingActive,
    recordedPoints,
    minCalibrationPoints,
    isRecordingCalibration,
    confirmCalibrationPoint,
    finishCalibration,
  } = useEntryFlow();

  useEffect(() => {
    if (isReady && !isCalibrating) {
      router.push('/1');
    }
  }, [isReady, isCalibrating, router]);

  return (
    <EntryPageShell title="시선 보정">
      {isReady && isCalibrating && (
        <div className={styles.calibration}>
          <div className={styles.calibrationPanel}>
            <h2 className={styles.calibrationTitle}>시선 추적 보정</h2>
            <p className={styles.calibrationDesc}>
              초록 점을 <strong>눈동자로 정확히</strong> 맞춘 뒤{' '}
              <strong>스페이스바</strong> 또는 버튼을 누르세요. ({calibrationIndex + 1} /{' '}
              {calibrationTotal})
            </p>
            <p className={styles.calibrationDescSub}>
              화면의 9개 지점을 순서대로 맞춥니다. 고개는 고정하고 <strong>눈만</strong>{' '}
              움직이세요. 정확도를 위해 모든 지점을 완료해야 합니다.
            </p>
            <p className={`${styles.faceStatus} ${faceDetected ? styles.faceOk : styles.faceWarn}`}>
              {faceDetected
                ? '● 얼굴 인식됨'
                : cameraActive
                  ? '○ 얼굴을 찾는 중… 점을 응시해 주세요'
                  : '○ 카메라를 불러오는 중…'}
            </p>
            {trackingActive && (
              <p className={styles.trackingStatus}>시선 추적 활성 — 점선 커서가 시선을 따라갑니다</p>
            )}
            {calibrationHint && <p className={styles.calibrationHint}>{calibrationHint}</p>}
            <button
              type="button"
              className={styles.confirmBtn}
              onClick={confirmCalibrationPoint}
              disabled={isRecordingCalibration}
            >
              {isRecordingCalibration ? '보정 중…' : '이 점 보정하기 (Space)'}
            </button>
            {recordedPoints >= minCalibrationPoints && (
              <button type="button" className={styles.skipBtn} onClick={finishCalibration}>
                보정 완료하고 시작하기
              </button>
            )}
            {calibrationPoint && (
              <div
                className={styles.calibrationDot}
                style={{
                  left: `${calibrationPoint.x * 100}%`,
                  top: `${calibrationPoint.y * 100}%`,
                }}
              />
            )}
          </div>
        </div>
      )}
    </EntryPageShell>
  );
}
