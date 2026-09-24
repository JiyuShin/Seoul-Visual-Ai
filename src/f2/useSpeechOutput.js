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

  const speak = useCallback((text, onEnd) => {
    if (typeof window === 'undefined' || !window.speechSynthesis || !text?.trim()) {
      onEnd?.();
      return false;
    }

    const synth = window.speechSynthesis;
    const chunks = text
      .trim()
      .split(/(?<=[,.!?。！？])\s*/)
      .filter(Boolean);
    let finished = false;
    let completed = 0;
    let hardStop = 0;

    const finish = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(hardStop);
      setIsSpeaking(false);
      onEnd?.();
    };

    const pickVoice = () => {
      const voices = synth.getVoices();
      return (
        voices.find((voice) => voice.lang === 'ko-KR' || voice.lang === 'ko_KR') ||
        voices.find((voice) => voice.lang?.toLowerCase().startsWith('ko'))
      );
    };

    const run = () => {
      if (finished) return;
      const voice = pickVoice();
      const utterances = chunks.map((chunk, index) => {
        const utterance = new SpeechSynthesisUtterance(chunk);
        utterance.lang = 'ko-KR';
        utterance.rate = 0.9;
        utterance.pitch = 1;
        if (voice) utterance.voice = voice;

        utterance.onstart = () => setIsSpeaking(true);
        const completeChunk = () => {
          completed += 1;
          if (completed >= chunks.length || index === chunks.length - 1) finish();
        };
        utterance.onend = completeChunk;
        utterance.onerror = completeChunk;
        return utterance;
      });

      // 모든 조각을 처음부터 큐에 넣고 참조도 유지해야 Safari/Chrome이 뒤 문장을 버리지 않는다.
      utteranceRef.current = utterances;
      synth.cancel();
      window.setTimeout(() => {
        if (finished) return;
        utterances.forEach((utterance) => synth.speak(utterance));
      }, 120);

      const maxDuration = Math.max(9000, text.trim().length * 240);
      hardStop = window.setTimeout(finish, maxDuration);
    };

    let primed = false;
    const prime = () => {
      if (primed || finished) return;
      primed = true;
      run();
    };

    if (synth.getVoices().length === 0) {
      synth.addEventListener('voiceschanged', prime, { once: true });
      window.setTimeout(prime, 700);
    } else {
      prime();
    }

    return true;
  }, []);

  return {
    speak,
    stopSpeaking,
    isSpeaking,
    isSupported,
  };
};
