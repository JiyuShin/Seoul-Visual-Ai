import { useCallback, useEffect, useRef, useState } from 'react';

export function useSpeechOutput() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const utteranceRef = useRef(null);

  useEffect(() => {
    setIsSupported(typeof window !== 'undefined' && 'speechSynthesis' in window);

    return () => {
      if (typeof window !== 'undefined') {
        window.speechSynthesis?.cancel();
      }
    };
  }, []);

  const stopSpeaking = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(
    (text, onEnd) => {
      if (typeof window === 'undefined' || !window.speechSynthesis || !text?.trim()) {
        onEnd?.();
        return false;
      }

      stopSpeaking();

      const utterance = new SpeechSynthesisUtterance(text.trim());
      utterance.lang = 'ko-KR';
      utterance.rate = 0.92;
      utterance.pitch = 1;

      let finished = false;

      const finish = () => {
        if (finished) return;
        finished = true;
        setIsSpeaking(false);
        onEnd?.();
      };

      utterance.onstart = () => {
        setIsSpeaking(true);
      };
      utterance.onend = finish;
      utterance.onerror = finish;

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);

      return true;
    },
    [stopSpeaking]
  );

  return {
    speak,
    stopSpeaking,
    isSpeaking,
    isSupported,
  };
};
