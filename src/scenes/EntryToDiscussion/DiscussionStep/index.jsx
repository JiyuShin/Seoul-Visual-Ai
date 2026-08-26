import { useCallback, useEffect, useRef, useState } from 'react';
import { DISCUSSION_PHASE_MAX_MS } from '../gazeConfig';
import { useSpeechInput } from '../useSpeechInput';
import StreetCanvas from './StreetCanvas';
import styles from './DiscussionStep.module.css';

export default function DiscussionStep({
  winnerCard,
  pins,
  onPinsChange,
  onComplete,
  registerGazeHandler,
  gazePosition,
}) {
  const manualInputRef = useRef(null);
  const streetCanvasRef = useRef(null);
  const pinsRef = useRef(pins);
  const gazePositionRef = useRef(gazePosition);
  const [submitHint, setSubmitHint] = useState('');

  pinsRef.current = pins;
  gazePositionRef.current = gazePosition;

  const handleFinalSpeech = useCallback((text) => {
    streetCanvasRef.current?.placePinWithText(
      text,
      gazePositionRef.current?.x,
      gazePositionRef.current?.y
    );
  }, []);

  const speech = useSpeechInput({ onFinalTranscript: handleFinalSpeech });

  useEffect(() => {
    onPinsChange?.((prev) => {
      if (prev.length > 0) return prev;
      return [
        {
          id: 'demo-pin',
          x: 0.62,
          y: 0.58,
          text: '이곳에 그늘 나무가 필요해요',
          authorViewerId: 'viewer-demo',
          likeCount: 0,
          likedBy: new Set(),
        },
      ];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    speech.startListening();
    return () => speech.stopListening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      onComplete?.(pinsRef.current);
    }, DISCUSSION_PHASE_MAX_MS);
    return () => clearTimeout(timeoutId);
  }, [onComplete]);

  const handleAddPin = useCallback(
    (pin) => {
      onPinsChange?.((prev) => [...prev, pin]);
      speech.clearTranscript();
      setSubmitHint('');
    },
    [onPinsChange, speech]
  );

  const handleLikePin = useCallback(
    (pinId, viewerId) => {
      onPinsChange?.((prev) =>
        prev.map((pin) => {
          if (pin.id !== pinId) return pin;
          if (pin.likedBy.has(viewerId)) return pin;
          const likedBy = new Set(pin.likedBy);
          likedBy.add(viewerId);
          return { ...pin, likedBy, likeCount: pin.likeCount + 1 };
        })
      );
    },
    [onPinsChange]
  );

  const handleManualSubmit = useCallback(() => {
    const text = manualInputRef.current?.value?.trim();
    if (!text) return;

    const placed = streetCanvasRef.current?.placePinWithText(
      text,
      gazePosition?.x,
      gazePosition?.y
    );

    if (!placed) {
      setSubmitHint('이미지 위 지점을 1.2초간 응시한 뒤 입력해 주세요.');
    } else {
      setSubmitHint('');
    }

    manualInputRef.current.value = '';
  }, [gazePosition]);

  const combinedSpeech = speech.getCombinedText();

  useEffect(() => {
    if (pins.length === 0) return;
    const sorted = [...pins].sort((a, b) => b.likeCount - a.likeCount);
    const density = pins.reduce(
      (acc, pin) => {
        const key = `${Math.round(pin.x * 10)}-${Math.round(pin.y * 10)}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      {}
    );
    console.log('[AI Agent] Top pins:', sorted.slice(0, 3));
    console.log('[AI Agent] Opinion density map:', density);
  }, [pins]);

  return (
    <section className={styles.discussionStep}>
      <div className={styles.header}>
        <p className={styles.subtitle}>선택된 비전 · {winnerCard.shortLabel}</p>
        <h2 className={styles.title}>거리의 어느 지점을 바꿀까요?</h2>
        <p className={styles.hint}>
          이미지 위 지점을 1.2초간 응시한 뒤 말하세요. 위치가 고정되면 말한 내용이 그 자리에
          붙습니다. 다른 핀을 2초간 응시하면 공감(♥)이 붙습니다.
        </p>
      </div>

      <StreetCanvas
        ref={streetCanvasRef}
        pins={pins}
        onAddPin={handleAddPin}
        onLikePin={handleLikePin}
        registerGazeHandler={registerGazeHandler}
        pendingSpeechText={combinedSpeech}
        onPlacementStateChange={() => setSubmitHint('')}
      />

      <div className={styles.inputArea}>
        <div className={styles.speechStatus}>
          {speech.isListening ? (
            <span className={styles.listening}>● 음성 인식 중</span>
          ) : speech.isSupported ? (
            <span className={styles.paused}>음성 인식 일시 중지</span>
          ) : (
            <span className={styles.fallback}>음성 인식 미지원 — 텍스트 입력을 사용하세요</span>
          )}
          {(combinedSpeech || speech.interimTranscript) && (
            <p className={styles.liveTranscript}>{combinedSpeech || speech.interimTranscript}</p>
          )}
          {submitHint && <p className={styles.submitHint}>{submitHint}</p>}
        </div>

        <div className={styles.manualRow}>
          <input
            ref={manualInputRef}
            type="text"
            className={styles.textInput}
            placeholder="의견을 입력하세요 (예: 이곳에 넓은 잔디가 필요해요)"
            onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
          />
          <button type="button" className={styles.submitBtn} onClick={handleManualSubmit}>
            입력
          </button>
          {!speech.isListening && speech.isSupported && (
            <button type="button" className={styles.micBtn} onClick={speech.startListening}>
              🎤
            </button>
          )}
        </div>
      </div>

      <button type="button" className={styles.nextBtn} onClick={() => onComplete?.(pins)}>
        다음 단계로
      </button>
    </section>
  );
}
