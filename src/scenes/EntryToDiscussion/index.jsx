import { useCallback, useRef, useState } from 'react';
import DreamyBackground from './DreamyBackground';
import GazeReticle from './GazeReticle';
import DiscussionStep from './DiscussionStep';
import RevealStep from './RevealStep';
import VoteStep from './VoteStep';
import { useGazeTracker } from './useGazeTracker';
import styles from './EntryToDiscussion.module.css';

const STEPS = ['vote', 'reveal', 'discussion', 'done'];

export default function EntryToDiscussion({ onDiscussionComplete }) {
  const [step, setStep] = useState('vote');
  const [winnerCard, setWinnerCard] = useState(null);
  const [pins, setPins] = useState([]);
  const [dwellProgress, setDwellProgress] = useState(0);

  const stepRef = useRef('vote');
  const gazeHandlersRef = useRef({});

  stepRef.current = step;

  const registerGazeHandler = useCallback((phase, handler) => {
    if (handler) {
      gazeHandlersRef.current[phase] = handler;
    } else {
      delete gazeHandlersRef.current[phase];
    }
  }, []);

  const registerGazeSample = useCallback((viewerId, x, y) => {
    const currentStep = stepRef.current;
    const handler = gazeHandlersRef.current[currentStep];
    if (!handler) return;

    const result = handler(viewerId, x, y);
    if (result?.dwellProgress != null) {
      setDwellProgress(result.dwellProgress);
    }
  }, []);

  const {
    isReady,
    isCalibrating,
    calibrationIndex,
    calibrationTotal,
    calibrationPoint,
    calibrationHint,
    gazePosition,
    faceDetected,
    cameraActive,
    trackingActive,
    recordedPoints,
    minCalibrationPoints,
    isRecordingCalibration,
    confirmCalibrationPoint,
    finishCalibration,
    error,
  } = useGazeTracker(registerGazeSample);

  const handleVoteComplete = useCallback((card) => {
    setWinnerCard(card);
    setStep('reveal');
  }, []);

  const handleRevealComplete = useCallback(() => {
    setStep('discussion');
  }, []);

  const handleDiscussionComplete = useCallback(
    (finalPins) => {
      const serialized = finalPins.map((pin) => ({
        ...pin,
        likedBy: Array.from(pin.likedBy),
      }));
      console.log('[EntryToDiscussion] Discussion complete:', serialized);
      onDiscussionComplete?.(serialized);
      setStep('done');
    },
    [onDiscussionComplete]
  );

  return (
    <div className={styles.root}>
      <DreamyBackground />

      {isCalibrating && isReady && (
        <div className={styles.calibration}>
          <div className={styles.calibrationPanel}>
            <h2 className={styles.calibrationTitle}>시선 추적 보정</h2>
            <p className={styles.calibrationDesc}>
              초록 점을 <strong>눈동자로 정확히</strong> 맞춘 뒤{' '}
              <strong>스페이스바</strong> 또는 버튼을 누르세요. ({calibrationIndex + 1} /{' '}
              {calibrationTotal})
            </p>
            <p className={styles.calibrationDescSub}>
              화면 네 모서리 점을 순서대로 맞춥니다. 고개는 고정하고 <strong>눈만</strong>{' '}
              움직이세요.
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

      {!isReady && !error && (
        <div className={styles.loading}>
          <p>시선 추적 초기화 중…</p>
          <p className={styles.loadingSub}>카메라 권한을 허용해 주세요</p>
        </div>
      )}

      {error && (
        <div className={styles.error}>
          <p>시선 추적 오류: {error}</p>
        </div>
      )}

      {step === 'vote' && (
        <VoteStep onComplete={handleVoteComplete} registerGazeHandler={registerGazeHandler} />
      )}

      {step === 'reveal' && winnerCard && (
        <RevealStep winnerCard={winnerCard} onComplete={handleRevealComplete} />
      )}

      {step === 'discussion' && winnerCard && (
        <DiscussionStep
          winnerCard={winnerCard}
          pins={pins}
          onPinsChange={setPins}
          onComplete={handleDiscussionComplete}
          registerGazeHandler={registerGazeHandler}
          gazePosition={gazePosition}
        />
      )}

      {step === 'done' && (
        <section className={styles.doneStep}>
          <h2 className={styles.doneTitle}>의견 수집 완료</h2>
          <p className={styles.doneDesc}>
            {pins.length}개의 의견이 수집되었습니다. 다음 온보딩 단계로 이어질 자리입니다.
          </p>
          <pre className={styles.donePreview}>
            {JSON.stringify(
              pins.map((p) => ({ ...p, likedBy: Array.from(p.likedBy) })),
              null,
              2
            )}
          </pre>
        </section>
      )}

      <GazeReticle
        position={gazePosition}
        dwellProgress={dwellProgress}
        visible={isReady && step !== 'done'}
      />

      <footer className={styles.footer}>Visual AI Glass · Scene 2–3 Prototype</footer>
    </div>
  );
}

export { STEPS };
