import { useCallback, useEffect, useRef, useState } from 'react';

function pickKoreanVoice(synth) {
  const voices = synth.getVoices();
  return (
    voices.find((voice) => voice.lang === 'ko-KR' || voice.lang === 'ko_KR') ||
    voices.find((voice) => voice.lang?.toLowerCase().startsWith('ko'))
  );
}

export function useSpeechOutput() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const sessionRef = useRef(0);

  useEffect(() => {
    setIsSupported(typeof window !== 'undefined' && 'speechSynthesis' in window);

    return () => {
      sessionRef.current += 1;
      if (typeof window !== 'undefined') {
        window.speechSynthesis?.cancel();
      }
    };
  }, []);

  const stopSpeaking = useCallback(() => {
    sessionRef.current += 1;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const speak = useCallback((text, onEnd) => {
    if (typeof window === 'undefined' || !window.speechSynthesis || !text?.trim()) {
      onEnd?.();
      return false;
    }

    const session = sessionRef.current + 1;
    sessionRef.current = session;
    const synth = window.speechSynthesis;
    const spoken = text.trim();
    let finished = false;
    let started = false;
    let keepAlive = 0;
    let watch = 0;

    const finish = () => {
      if (finished || session !== sessionRef.current) return;
      finished = true;
      window.clearInterval(keepAlive);
      window.clearInterval(watch);
      setIsSpeaking(false);
      onEnd?.();
    };

    const utterance = new SpeechSynthesisUtterance(spoken);
    utterance.lang = 'ko-KR';
    utterance.rate = 0.92;
    utterance.pitch = 1;

    utterance.onstart = () => {
      if (session !== sessionRef.current) return;
      started = true;
      setIsSpeaking(true);
      watch = window.setInterval(() => {
        if (finished || session !== sessionRef.current) return;
        if (!synth.speaking && !synth.pending && !synth.paused) finish();
      }, 400);
    };
    utterance.onend = finish;
    utterance.onerror = (event) => {
      if (event.error === 'interrupted' || event.error === 'canceled' || event.error === 'cancelled') {
        return;
      }
      finish();
    };

    const run = () => {
      if (finished || session !== sessionRef.current) return;
      const voice = pickKoreanVoice(synth);
      if (voice) utterance.voice = voice;
      const lead = new SpeechSynthesisUtterance(' ');
      lead.volume = 0;
      lead.lang = 'ko-KR';
      lead.rate = 1;
      if (voice) lead.voice = voice;
      lead.onend = () => {
        if (finished || session !== sessionRef.current) return;
        synth.speak(utterance);
      };
      synth.resume();
      synth.speak(lead);
      keepAlive = window.setInterval(() => {
        if (finished || session !== sessionRef.current || !synth.speaking) return;
        synth.resume();
      }, 8000);
    };

    if (synth.getVoices().length === 0) {
      synth.addEventListener('voiceschanged', run, { once: true });
      window.setTimeout(run, 700);
    } else {
      run();
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
