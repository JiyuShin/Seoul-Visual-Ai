import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/router';
import DiscussionStep from '../src/scenes/EntryToDiscussion/DiscussionStep';
import EntryPageShell from '../src/scenes/EntryToDiscussion/EntryPageShell';
import { useEntryFlow } from '../src/scenes/EntryToDiscussion/EntryFlowContext';
import styles from '../src/scenes/EntryToDiscussion/EntryToDiscussion.module.css';

export default function StreetDiscussionPage() {
  const router = useRouter();
  const {
    isReady,
    isCalibrating,
    winnerCard,
    pins,
    setPins,
    discussionDone,
    setDiscussionDone,
    gazePosition,
    registerGazeHandler,
    handleGazeClipChange,
  } = useEntryFlow();

  useEffect(() => {
    if (!isReady) return;
    if (isCalibrating) {
      router.replace('/app');
    } else if (!winnerCard) {
      router.replace('/1');
    }
  }, [isReady, isCalibrating, winnerCard, router]);

  const handleDiscussionComplete = useCallback(
    (finalPins) => {
      const serialized = finalPins.map((pin) => ({
        ...pin,
        likedBy: Array.from(pin.likedBy),
      }));
      console.log('[EntryToDiscussion] Discussion complete:', serialized);
      setDiscussionDone(true);
    },
    [setDiscussionDone]
  );

  return (
    <EntryPageShell title="거리뷰 토론" showReticle={!discussionDone}>
      {isReady && !isCalibrating && winnerCard && !discussionDone && (
        <DiscussionStep
          winnerCard={winnerCard}
          pins={pins}
          onPinsChange={setPins}
          onComplete={handleDiscussionComplete}
          registerGazeHandler={registerGazeHandler}
          onGazeClipChange={handleGazeClipChange}
          gazePosition={gazePosition}
        />
      )}

      {discussionDone && (
        <section className={styles.doneStep}>
          <h2 className={styles.doneTitle}>의견 수집 완료</h2>
          <p className={styles.doneDesc}>
            {pins.length}개의 의견이 수집되었습니다. 다음 온보딩 단계로 이어질 자리입니다.
          </p>
          <pre className={styles.donePreview}>
            {JSON.stringify(
              pins.map((pin) => ({ ...pin, likedBy: Array.from(pin.likedBy) })),
              null,
              2
            )}
          </pre>
        </section>
      )}
    </EntryPageShell>
  );
}
