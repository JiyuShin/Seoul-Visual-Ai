import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/router';
import EntryPageShell from '../src/shared/EntryPageShell';
import { useEntryFlow } from '../src/shared/EntryFlowContext';
import RevealStep from '../src/f1/RevealStep';
import VoteStep from '../src/f1/VoteStep';

export default function MenuSelectionPage() {
  const router = useRouter();
  const {
    isReady,
    isCalibrating,
    winnerCard,
    setWinnerCard,
    registerGazeHandler,
  } = useEntryFlow();

  useEffect(() => {
    if (isReady && isCalibrating) {
      router.replace('/app');
    }
  }, [isReady, isCalibrating, router]);

  const handleVoteComplete = useCallback(
    (card) => {
      setWinnerCard(card);
    },
    [setWinnerCard]
  );

  const handleRevealComplete = useCallback(() => {
    router.push('/2');
  }, [router]);

  return (
    <EntryPageShell title="메뉴 선택">
      {isReady && !isCalibrating && !winnerCard && (
        <VoteStep onComplete={handleVoteComplete} registerGazeHandler={registerGazeHandler} />
      )}

      {isReady && !isCalibrating && winnerCard && (
        <RevealStep winnerCard={winnerCard} onComplete={handleRevealComplete} />
      )}
    </EntryPageShell>
  );
}
