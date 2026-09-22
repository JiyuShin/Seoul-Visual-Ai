import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import { VOTE_VIEWER_IDS } from '../EntryToDiscussion/gazeConfig';
import { useGazeTracker } from '../EntryToDiscussion/useGazeTracker';
import { useVoteSync } from '../EntryToDiscussion/useVoteSync';
import styles from './TrackerScreen.module.css';

/**
 * 웹캠 한 대로 한 사람의 시선만 측정해서 투표 룸으로 올려보내는 화면.
 *
 * 카드를 그리지 않는다. 화면 표시는 /1 페이지가 맡고 이 탭은 좌표만 만든다.
 * WebGazer는 window에 하나만 존재하므로, 사람이 두 명이면 이 창을 두 개 띄우고
 * 각각 다른 카메라를 골라야 한다.
 */
export default function TrackerScreen() {
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [viewerId, setViewerId] = useState(VOTE_VIEWER_IDS[0]);
  const [started, setStarted] = useState(false);
  const [permissionError, setPermissionError] = useState(null);

  const { send, status: socketStatus, welcome } = useVoteSync({
    role: 'tracker',
    viewerId,
    enabled: started,
  });

  const handleGazeSample = useCallback(
    (_viewerId, x, y) => {
      // 정규화해서 보낸다. 표시 창과 이 창의 해상도가 달라도 같은 지점을 가리키게 된다.
      send({ t: 'gaze', x: x / window.innerWidth, y: y / window.innerHeight });
    },
    [send]
  );

  const {
    isCalibrating,
    calibrationIndex,
    calibrationTotal,
    calibrationPoint,
    calibrationHint,
    isRecordingCalibration,
    confirmCalibrationPoint,
    cameraActive,
    faceDetected,
    trackingActive,
    error,
  } = useGazeTracker(handleGazeSample, {
    viewerId,
    cameraDeviceId: selectedCamera,
    enabled: started,
  });

  const loadCameras = useCallback(async () => {
    setPermissionError(null);

    try {
      // 권한을 먼저 받지 않으면 enumerateDevices가 카메라 이름을 빈 문자열로 준다.
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((device) => device.kind === 'videoinput');

      setCameras(videoInputs);
      setSelectedCamera((current) => current || videoInputs[0]?.deviceId || '');
    } catch (err) {
      setPermissionError(err?.message || '카메라 권한을 받지 못했습니다.');
    }
  }, []);

  useEffect(() => {
    loadCameras();
  }, [loadCameras]);

  return (
    <>
      <Head>
        <title>트래커 · Visual AI Glass</title>
      </Head>

      <main className={styles.root}>
        <h1 className={styles.title}>시선 트래커</h1>
        <p className={styles.desc}>
          웹캠 한 대로 한 사람의 시선을 측정해 투표 화면으로 보냅니다. 참가자가 두 명이면 이 창을 두
          개 띄우고 각각 다른 카메라와 참가자를 고르세요.
        </p>

        {!started ? (
          <section className={styles.panel}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>참가자</span>
              <select
                className={styles.select}
                value={viewerId}
                onChange={(event) => setViewerId(event.target.value)}
              >
                {VOTE_VIEWER_IDS.map((id, index) => (
                  <option key={id} value={id}>
                    {index + 1}번 참가자 ({id})
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>웹캠</span>
              <select
                className={styles.select}
                value={selectedCamera}
                onChange={(event) => setSelectedCamera(event.target.value)}
              >
                {cameras.map((camera, index) => (
                  <option key={camera.deviceId} value={camera.deviceId}>
                    {camera.label || `카메라 ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>

            {permissionError && <p className={styles.error}>{permissionError}</p>}
            {!cameras.length && !permissionError && (
              <p className={styles.hint}>카메라 목록을 불러오는 중…</p>
            )}

            <div className={styles.actions}>
              <button type="button" className={styles.ghostBtn} onClick={loadCameras}>
                목록 새로고침
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => setStarted(true)}
                disabled={!selectedCamera}
              >
                추적 시작
              </button>
            </div>
          </section>
        ) : (
          <section className={styles.panel}>
            <dl className={styles.statusList}>
              <div className={styles.statusRow}>
                <dt>참가자</dt>
                <dd>{welcome?.viewerId || viewerId}</dd>
              </div>
              <div className={styles.statusRow}>
                <dt>서버 연결</dt>
                <dd className={socketStatus === 'open' ? styles.ok : styles.warn}>
                  {socketStatus === 'open' ? '연결됨' : '연결 대기'}
                </dd>
              </div>
              <div className={styles.statusRow}>
                <dt>카메라</dt>
                <dd className={cameraActive ? styles.ok : styles.warn}>
                  {cameraActive ? '활성' : '대기'}
                </dd>
              </div>
              <div className={styles.statusRow}>
                <dt>얼굴 인식</dt>
                <dd className={faceDetected ? styles.ok : styles.warn}>
                  {faceDetected ? '인식됨' : '찾는 중'}
                </dd>
              </div>
            </dl>

            {error && <p className={styles.error}>{error}</p>}

            {isCalibrating ? (
              <div className={styles.calibration}>
                <p className={styles.calibrationText}>
                  초록 점을 눈으로 맞춘 뒤 <strong>스페이스바</strong>를 누르세요. (
                  {calibrationIndex + 1} / {calibrationTotal})
                </p>
                {calibrationHint && <p className={styles.hint}>{calibrationHint}</p>}
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={confirmCalibrationPoint}
                  disabled={isRecordingCalibration}
                >
                  {isRecordingCalibration ? '보정 중…' : '이 점 보정하기 (Space)'}
                </button>
              </div>
            ) : (
              <p className={styles.streaming}>
                보정 완료{trackingActive ? ', 시선 전송 중' : ''}. 이 창은 그대로 열어 두세요.
              </p>
            )}
          </section>
        )}

        {started && isCalibrating && calibrationPoint && (
          <div
            className={styles.calibrationDot}
            style={{
              left: `${calibrationPoint.x * 100}%`,
              top: `${calibrationPoint.y * 100}%`,
            }}
          />
        )}
      </main>
    </>
  );
}
