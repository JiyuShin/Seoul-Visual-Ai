import { useEffect } from 'react';
import { useRouter } from 'next/router';
import EntryPageShell from '../src/shared/EntryPageShell';
import { useEntryFlow } from '../src/shared/EntryFlowContext';
import CalibrationOverlay from '../src/calibration/CalibrationOverlay';
import CameraPane from '../src/calibration/CameraPane';
import { CAM_COLOR, CAM_KEYS, PERSON_LABEL } from '../src/shared/gaze/participants';
import styles from '../src/calibration/Calibration.module.css';

/**
 * 운영자 화면. 참가자마다 웹캠을 지정하고, 사람별로 차례대로 보정한 뒤 참여를 시작한다.
 * 카메라 미리보기는 이 화면에만 있고, 이후 단계에서는 숨은 채로 계속 돌아간다.
 */
export default function CalibrationPage() {
  const router = useRouter();
  const {
    isReady,
    setupComplete,
    completeSetup,
    status,
    error,
    running,
    devices,
    deviceIds,
    setDeviceId,
    refreshDevices,
    startCameras,
    stopAll,
    streams,
    canvasRefs,
    stats,
    calibUi,
    calibrated,
    result,
    gridCount,
    setGridCount,
    smoothing,
    setSmoothing,
    beginCalibration,
    startStage,
    cancelCalibration,
    resetCalibration,
  } = useEntryFlow();

  useEffect(() => {
    if (setupComplete) {
      router.push('/1');
    }
  }, [setupComplete, router]);

  // 보정 중에는 스페이스로 단계를 시작하고 ESC 로 빠져나온다.
  useEffect(() => {
    const onKey = (event) => {
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT') return;

      if (event.key === 'Escape' && calibUi) {
        cancelCalibration();
        return;
      }
      if (event.key === ' ' && calibUi && !calibUi.ready) {
        event.preventDefault();
        startStage();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [calibUi, cancelCalibration, startStage]);

  const readyToStart = calibrated.length > 0;

  return (
    <EntryPageShell title="시선 보정" showReticle={!calibUi}>
      <div className={styles.calibration}>
        <div className={styles.panel}>
          <h2 className={styles.title}>시선 추적 준비</h2>
          <p className={`${styles.status} ${error ? styles.statusError : ''}`}>{error || status}</p>

          <div className={styles.cams}>
            {CAM_KEYS.map((key) => (
              <CameraPane
                key={key}
                label={PERSON_LABEL[key]}
                color={CAM_COLOR[key]}
                deviceId={deviceIds[key]}
                devices={devices}
                onChange={(id) => setDeviceId(key, id)}
                onFocus={refreshDevices}
                stream={streams[key]}
                canvasRef={canvasRefs[key]}
                stats={stats[key]}
                calibrated={calibrated.includes(key)}
                optional={key === 'B'}
              />
            ))}
          </div>

          {!devices.length && (
            <p className={styles.hint}>
              “카메라 시작”으로 권한을 허용하면 장치 목록이 채워집니다. 그다음 2번 참가자 카메라를
              고르면 자동으로 다시 열립니다.
            </p>
          )}

          <div className={styles.row}>
            <button
              type="button"
              className={styles.btn}
              onClick={running ? stopAll : startCameras}
              disabled={!isReady}
            >
              {running ? '카메라 정지' : '카메라 시작'}
            </button>
            <select
              className={styles.select}
              value={gridCount}
              onChange={(event) => setGridCount(Number(event.target.value))}
              disabled={Boolean(calibUi)}
            >
              <option value={9}>9점 보정</option>
              <option value={16}>16점 보정 (정밀)</option>
            </select>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => beginCalibration('calibrate')}
              disabled={!running}
            >
              보정 시작
            </button>
          </div>

          <div className={styles.rowSub}>
            <span className={styles.rowLabel}>한 명만 다시</span>
            {CAM_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                className={styles.btnSmall}
                onClick={() => beginCalibration('calibrate', key)}
                disabled={!running || (key === 'B' && !deviceIds.B)}
              >
                {PERSON_LABEL[key]}
              </button>
            ))}
          </div>

          <div className={styles.row}>
            <button
              type="button"
              className={styles.btn}
              onClick={() => beginCalibration('validate')}
              disabled={!readyToStart}
            >
              정확도 측정
            </button>
            <button
              type="button"
              className={styles.btnSmall}
              onClick={resetCalibration}
              disabled={!readyToStart}
            >
              보정 초기화
            </button>
          </div>

          {result && (
            <div className={styles.result}>
              <b>{result.kind === 'train' ? '학습 오차 (RMSE)' : '검증 오차 (낮을수록 정확)'}</b>
              {result.rows.map((row) => (
                <div key={row.key} className={styles.resultRow}>
                  <span style={{ color: CAM_COLOR[row.cam] }}>{PERSON_LABEL[row.cam]}</span>
                  <em>{row.value.toFixed(0)}px</em>
                  <small>
                    {result.kind === 'train'
                      ? `${row.samples}샘플`
                      : `최대 ${row.max.toFixed(0)}px · ${row.covered}/${row.total}점`}
                  </small>
                </div>
              ))}
              {result.kind === 'train' && result.poor && (
                <small className={styles.resultWarn}>
                  오차가 큽니다. 조명과 자세를 정리하고 점을 정확히 응시하며 다시 시도하세요.
                </small>
              )}
            </div>
          )}

          <div className={styles.sliders}>
            <label>
              <span>
                커서 안정감 <em>{smoothing.minCutoff.toFixed(2)}</em>
              </span>
              <input
                type="range"
                min="0.2"
                max="3"
                step="0.05"
                value={smoothing.minCutoff}
                onChange={(event) =>
                  setSmoothing((current) => ({
                    ...current,
                    minCutoff: Number(event.target.value),
                  }))
                }
              />
              <small>낮추면 가만히 볼 때 덜 흔들립니다</small>
            </label>
            <label>
              <span>
                빠른 이동 반응 <em>{smoothing.beta.toFixed(3)}</em>
              </span>
              <input
                type="range"
                min="0"
                max="0.03"
                step="0.001"
                value={smoothing.beta}
                onChange={(event) =>
                  setSmoothing((current) => ({ ...current, beta: Number(event.target.value) }))
                }
              />
              <small>낮추면 커서가 덜 튀지만 반응이 느려집니다</small>
            </label>
          </div>

          <button
            type="button"
            className={`${styles.btn} ${styles.btnStart}`}
            onClick={completeSetup}
            disabled={!readyToStart}
          >
            {readyToStart
              ? `참여 시작 (${calibrated.length}명 보정 완료)`
              : '보정을 마치면 시작할 수 있습니다'}
          </button>
        </div>
      </div>

      {calibUi && <CalibrationOverlay {...calibUi} onStart={startStage} />}
    </EntryPageShell>
  );
}
