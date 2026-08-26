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
    (text) => {
      if (typeof window === 'undefined' || !window.speechSynthesis || !text?.trim()) {
        return false;
      }

      stopSpeaking();

      const utterance = new SpeechSynthesisUtterance(text.trim());
      utterance.lang = 'ko-KR';
      utterance.rate = 0.92;
      utterance.pitch = 1;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

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
