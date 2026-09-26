import { useCallback, useEffect, useRef, useState } from 'react';

const NOVELTY_VOICE = /^(Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley)\b/;

function isKoreanVoice(voice) {
  const lang = (voice.lang || '').toLowerCase().replace('_', '-');
  return lang === 'ko-kr' || lang.startsWith('ko');
}

function pickKoreanVoice(synth) {
  const voices = synth.getVoices().filter(isKoreanVoice);
  const natural = voices.filter((voice) => !NOVELTY_VOICE.test(voice.name));
  return (
    natural.find((voice) => voice.name === 'Yuna') ||
    natural.find((voice) => /sora|google/i.test(voice.name)) ||
    natural[0] ||
    voices[0]
  );
}

function spokenHoldMs(text) {
  const chars = Array.from(text.replace(/\s/g, '')).length;
  return Math.max(1600, chars * 240);
}

export function useSpeechOutput() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [voiceLive, setVoiceLive] = useState(false);
  const [voiceMark, setVoiceMark] = useState(0);
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
    setVoiceLive(false);
  }, []);

  const speak = useCallback((text, onEnd, onAudioEnd) => {
    if (typeof window === 'undefined' || !window.speechSynthesis || !text?.trim()) {
      onEnd?.();
      return false;
    }

    const session = sessionRef.current + 1;
    sessionRef.current = session;
    const synth = window.speechSynthesis;
    const spoken = text.trim();
    let finished = false;
    let keepAlive = 0;

    const finish = () => {
      if (finished || session !== sessionRef.current) return;
      finished = true;
      window.clearInterval(keepAlive);
      clearWords();
      setIsSpeaking(false);
      setVoiceLive(false);
      onEnd?.();
    };

    const utterance = new SpeechSynthesisUtterance(spoken);
    utterance.lang = 'ko-KR';
    utterance.rate = 1;
    utterance.pitch = 1;
    const minHold = spokenHoldMs(spoken);
    let startedAt = 0;
    let wordTimers = [];
    const clearWords = () => {
      wordTimers.forEach((id) => window.clearTimeout(id));
      wordTimers = [];
    };
    const nudge = () => {
      if (finished || session !== sessionRef.current) return;
      setVoiceMark((mark) => mark + 1);
    };

    utterance.onstart = () => {
      if (session !== sessionRef.current) return;
      startedAt = Date.now();
      setIsSpeaking(true);
      setVoiceLive(true);
    };
    utterance.onboundary = (event) => {
      if (session !== sessionRef.current) return;
      if (event.name && event.name !== 'word') return;
      setVoiceMark((mark) => mark + 1);
    };
    utterance.onend = () => {
      if (session !== sessionRef.current) return;
      clearWords();
      setVoiceLive(false);
      onAudioEnd?.();
      const elapsed = startedAt ? Date.now() - startedAt : minHold;
      const remain = Math.max(0, minHold - elapsed);
      window.setTimeout(finish, Math.max(0, remain - 300));
    };
    utterance.onerror = (event) => {
      if (event.error === 'interrupted' || event.error === 'canceled' || event.error === 'cancelled') {
        return;
      }
      finish();
    };

    let ran = false;
    const run = (force) => {
      if (ran || finished || session !== sessionRef.current) return;
      const voice = pickKoreanVoice(synth);
      if (!voice && !force) return;
      ran = true;
      if (voice) utterance.voice = voice;
      let queued = false;
      const startMain = () => {
        if (queued || finished || session !== sessionRef.current) return;
        queued = true;
        synth.resume();
        synth.speak(utterance);
        setVoiceLive(true);
        clearWords();
        let at = 90;
        spoken.split(/\s+/).filter(Boolean).forEach((word) => {
          const delay = at;
          at += Math.max(340, Array.from(word).length * 175);
          wordTimers.push(window.setTimeout(nudge, delay));
        });
      };
      const lead = new SpeechSynthesisUtterance(' ');
      lead.volume = 0;
      lead.lang = 'ko-KR';
      lead.rate = 1;
      if (voice) lead.voice = voice;
      lead.onend = startMain;
      const begin = () => {
        if (finished || session !== sessionRef.current) return;
        synth.resume();
        synth.speak(lead);
        window.setTimeout(startMain, 700);
        keepAlive = window.setInterval(() => {
          if (finished || session !== sessionRef.current || !synth.speaking) return;
          synth.resume();
        }, 8000);
      };
      if (synth.speaking || synth.pending) {
        synth.cancel();
        window.setTimeout(begin, 80);
        return;
      }
      begin();
    };

    if (pickKoreanVoice(synth)) run(false);
    else synth.addEventListener('voiceschanged', () => run(false), { once: true });
    window.setTimeout(() => run(true), 700);

    return true;
  }, []);

  return {
    speak,
    stopSpeaking,
    isSpeaking,
    isSupported,
    voiceLive,
    voiceMark,
  };
};
