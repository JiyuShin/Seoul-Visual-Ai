import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchFollowUpQuestion } from '../../../lib/fetchFollowUpQuestion';
import {
  DISCUSSION_FOLLOWUP_HINT,
  DISCUSSION_FOLLOWUP_LOADING,
  DISCUSSION_FOLLOWUP_TITLE,
  DISCUSSION_GAZE_HINT,
  DISCUSSION_PHASE_MAX_MS,
  DISCUSSION_PROMPT,
  DISCUSSION_VOICE_PROMPT,
} from '../gazeConfig';
import { useSpeechInput } from '../useSpeechInput';
import { useSpeechOutput } from '../useSpeechOutput';
import StreetCanvas from './StreetCanvas';
import styles from './DiscussionStep.module.css';

const STEP_PHASES = {
  PROMPT: 'prompt',
  GAZE: 'gaze',
  VOICE: 'voice',
  FOLLOWUP: 'followup',
};

export default function DiscussionStep({
  winnerCard,
  pins,
  onPinsChange,
  onComplete,
  registerGazeHandler,
  onGazeClipChange,
}) {
  const manualInputRef = useRef(null);
  const followUpInputRef = useRef(null);
  const streetCanvasRef = useRef(null);
  const pinsRef = useRef(pins);
  const stepPhaseRef = useRef(STEP_PHASES.PROMPT);
  const activeTagRef = useRef(null);
  const canvasRectRef = useRef(null);
  const placedForTagRef = useRef(false);
  const [stepPhase, setStepPhase] = useState(STEP_PHASES.PROMPT);
  const [activeTag, setActiveTag] = useState(null);
  const [submitHint, setSubmitHint] = useState('');
  const [followUp, setFollowUp] = useState(null);

  pinsRef.current = pins;
  stepPhaseRef.current = stepPhase;
  activeTagRef.current = activeTag;

  const speechOutput = useSpeechOutput();

  const speech = useSpeechInput({
    onFinalTranscript: (fullText) => {
      if (stepPhaseRef.current !== STEP_PHASES.VOICE || !activeTagRef.current) return;
      if (!fullText.trim() || placedForTagRef.current) return;

      const placed = streetCanvasRef.current?.placePinWithText(fullText);
      if (placed) {
        placedForTagRef.current = true;
      }
    },
  });

  const finishFollowUp = useCallback(() => {
    speechOutput.stopSpeaking();
    speech.stopListening();
    speech.clearTranscript();
    setFollowUp(null);
    setSubmitHint('');
    if (followUpInputRef.current) followUpInputRef.current.value = '';
    setStepPhase(STEP_PHASES.GAZE);
  }, [speech, speechOutput]);

  const beginFollowUp = useCallback(
    async (pin) => {
      setStepPhase(STEP_PHASES.FOLLOWUP);
      setFollowUp({ pinId: pin.id, question: '', loading: true, error: null });
      speech.stopListening();
      speech.clearTranscript();
      setActiveTag(null);
      onGazeClipChange?.(null);

      const result = await fetchFollowUpQuestion({
        opinion: pin.text,
        visionLabel: winnerCard?.label || winnerCard?.shortLabel || '',
      });

      setFollowUp({
        pinId: pin.id,
        question: result.question,
        loading: false,
        error: null,
      });
    },
    [onGazeClipChange, speech, winnerCard]
  );

  const handleAddPin = useCallback(
    (pin) => {
      onPinsChange?.((prev) => [...prev, pin]);
      placedForTagRef.current = false;
      setSubmitHint('');
      beginFollowUp(pin);
    },
    [beginFollowUp, onPinsChange]
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

  const handleTagLocked = useCallback((coords) => {
    placedForTagRef.current = false;
    setActiveTag(coords);
    setStepPhase(STEP_PHASES.VOICE);
    setSubmitHint('');
  }, []);

  useEffect(() => {
    if (stepPhase === STEP_PHASES.VOICE) {
      speech.startListening();
      speech.clearTranscript();
    } else if (stepPhase === STEP_PHASES.FOLLOWUP && followUp?.question && !followUp.loading) {
      speech.startListening();
    } else if (stepPhase !== STEP_PHASES.FOLLOWUP || followUp?.loading) {
      speech.stopListening();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepPhase, followUp?.question, followUp?.loading]);

  useEffect(() => {
    if (stepPhase !== STEP_PHASES.FOLLOWUP || !followUp?.question || followUp.loading) {
      return undefined;
    }

    speechOutput.speak(followUp.question);
    return () => speechOutput.stopSpeaking();
  }, [stepPhase, followUp?.question, followUp?.loading, speechOutput]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      onComplete?.(pinsRef.current);
    }, DISCUSSION_PHASE_MAX_MS);
    return () => clearTimeout(timeoutId);
  }, [onComplete]);

  const handleManualSubmit = useCallback(() => {
    const text = manualInputRef.current?.value?.trim();
    if (!text) return;

    if (stepPhase !== STEP_PHASES.VOICE || !activeTag) {
      setSubmitHint('먼저 이미지 위 지점을 시선으로 선택해 주세요.');
      return;
    }

    const placed = streetCanvasRef.current?.placePinWithText(text);
    if (!placed) {
      setSubmitHint('의견을 입력해 주세요.');
    } else {
      placedForTagRef.current = true;
      speech.clearTranscript();
      setSubmitHint('');
    }

    manualInputRef.current.value = '';
  }, [stepPhase, activeTag, speech]);

  const handleFollowUpSubmit = useCallback(() => {
    const typed = followUpInputRef.current?.value?.trim();
    const spoken = speech.getCombinedText().trim();
    const answer = typed || spoken;

    if (!followUp?.pinId) return;

    if (!answer) {
      setSubmitHint('답변을 말하거나 입력해 주세요.');
      return;
    }

    onPinsChange?.((prev) =>
      prev.map((pin) => {
        if (pin.id !== followUp.pinId) return pin;
        return {
          ...pin,
          followUpQuestion: followUp.question,
          followUpAnswer: answer,
          text: `${pin.text} — ${answer}`,
        };
      })
    );

    finishFollowUp();
  }, [finishFollowUp, followUp, onPinsChange, speech]);

  const handleFollowUpSkip = useCallback(() => {
    if (followUp?.pinId && followUp.question) {
      onPinsChange?.((prev) =>
        prev.map((pin) => {
          if (pin.id !== followUp.pinId) return pin;
          return { ...pin, followUpQuestion: followUp.question };
        })
      );
    }
    finishFollowUp();
  }, [finishFollowUp, followUp, onPinsChange]);

  const combinedSpeech = speech.getCombinedText();

  const handleStartGaze = useCallback(() => {
    setStepPhase(STEP_PHASES.GAZE);
  }, []);

  const handleCanvasRect = useCallback(
    (rect) => {
      canvasRectRef.current = rect;
      if (stepPhaseRef.current === STEP_PHASES.GAZE && rect) {
        onGazeClipChange?.(rect);
      }
    },
    [onGazeClipChange]
  );

  useEffect(() => {
    if (stepPhase === STEP_PHASES.GAZE && canvasRectRef.current) {
      onGazeClipChange?.(canvasRectRef.current);
      return undefined;
    }

    onGazeClipChange?.(null);
    return undefined;
  }, [stepPhase, onGazeClipChange]);

  const canvasPhase =
    stepPhase === STEP_PHASES.PROMPT
      ? 'idle'
      : stepPhase === STEP_PHASES.GAZE
        ? 'gaze'
        : stepPhase === STEP_PHASES.VOICE
          ? 'voice'
          : 'followup';

  const phaseHint =
    stepPhase === STEP_PHASES.PROMPT
      ? DISCUSSION_PROMPT
      : stepPhase === STEP_PHASES.GAZE
        ? DISCUSSION_GAZE_HINT
        : stepPhase === STEP_PHASES.VOICE
          ? DISCUSSION_VOICE_PROMPT
          : DISCUSSION_FOLLOWUP_HINT;

  const titleText =
    stepPhase === STEP_PHASES.PROMPT
      ? '어디에 식물을 심을까요?'
      : stepPhase === STEP_PHASES.GAZE
        ? '시선으로 위치를 선택하세요'
        : stepPhase === STEP_PHASES.VOICE
          ? '의견을 말해 주세요'
          : DISCUSSION_FOLLOWUP_TITLE;

  return (
    <section className={styles.discussionStep}>
      <div className={styles.header}>
        <p className={styles.subtitle}>선택된 비전 · {winnerCard.shortLabel}</p>
        <h2 className={styles.title}>{titleText}</h2>
        <p className={styles.hint}>{phaseHint}</p>
      </div>

      <div className={styles.canvasArea}>
        {stepPhase === STEP_PHASES.PROMPT && (
          <div className={styles.promptOverlay}>
            <p className={styles.promptText}>{DISCUSSION_PROMPT}</p>
            <button type="button" className={styles.promptBtn} onClick={handleStartGaze}>
              시선으로 선택하기
            </button>
          </div>
        )}

        <StreetCanvas
          ref={streetCanvasRef}
          pins={pins}
          onAddPin={handleAddPin}
          onLikePin={handleLikePin}
          registerGazeHandler={registerGazeHandler}
          phase={canvasPhase}
          activeTag={activeTag}
          onTagLocked={handleTagLocked}
          onCanvasRect={handleCanvasRect}
        />
      </div>

      {stepPhase === STEP_PHASES.VOICE && (
        <div className={styles.inputArea}>
          <div className={styles.speechStatus}>
            {speech.isListening ? (
              <span className={styles.listening}>● 음성 인식 중 — 선택한 태그 위치에 붙습니다</span>
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
              placeholder="의견을 입력하세요 (예: 이곳에 화분 나무를 심고 싶어요)"
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
      )}

      {stepPhase === STEP_PHASES.FOLLOWUP && (
        <div className={styles.followUpArea}>
          <div className={styles.agentBubble}>
            <span className={styles.agentLabel}>AI</span>
            {followUp?.loading ? (
              <p className={styles.agentQuestion}>{DISCUSSION_FOLLOWUP_LOADING}</p>
            ) : (
              <p className={styles.agentQuestion}>{followUp?.question}</p>
            )}
            {speechOutput.isSpeaking && (
              <span className={styles.agentSpeaking}>🔊 질문을 읽고 있어요</span>
            )}
            {!followUp?.loading && speechOutput.isSupported && (
              <button
                type="button"
                className={styles.replayBtn}
                onClick={() => speechOutput.speak(followUp?.question)}
              >
                다시 듣기
              </button>
            )}
          </div>

          {!followUp?.loading && (
            <>
              <div className={styles.speechStatus}>
                {speech.isListening ? (
                  <span className={styles.listening}>● 답변을 말씀해 주세요</span>
                ) : (
                  <span className={styles.paused}>음성 인식 대기 중</span>
                )}
                {(combinedSpeech || speech.interimTranscript) && (
                  <p className={styles.liveTranscript}>{combinedSpeech || speech.interimTranscript}</p>
                )}
                {submitHint && <p className={styles.submitHint}>{submitHint}</p>}
              </div>

              <div className={styles.manualRow}>
                <input
                  ref={followUpInputRef}
                  type="text"
                  className={styles.textInput}
                  placeholder="떠오르는 장면이나 디테일을 입력해 주세요"
                  onKeyDown={(e) => e.key === 'Enter' && handleFollowUpSubmit()}
                />
                <button type="button" className={styles.submitBtn} onClick={handleFollowUpSubmit}>
                  답변 등록
                </button>
                <button type="button" className={styles.skipBtn} onClick={handleFollowUpSkip}>
                  건너뛰기
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {stepPhase === STEP_PHASES.GAZE && pins.length > 0 && (
        <p className={styles.secondaryHint}>다른 위치도 같은 방식으로 선택할 수 있습니다.</p>
      )}

      <button type="button" className={styles.nextBtn} onClick={() => onComplete?.(pins)}>
        다음 단계로
      </button>
    </section>
  );
}
