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

const OPEN_VOWELS = new Set([0, 2, 4, 6, 8, 12, 18, 20]);

function syllableAmp(ch) {
  if (/\s/.test(ch)) return 0;
  if (/[.?!。？！,，、…~]/.test(ch)) return 0;
  if (/[가-힣]/.test(ch)) {
    const code = ch.charCodeAt(0) - 0xac00;
    const jung = Math.floor((code % 588) / 28);
    const open = OPEN_VOWELS.has(jung) ? 1 : 0.68;
    return open * (0.78 + ((code * 13) % 17) / 70);
  }
  return 0.42;
}

function prepareSpoken(text) {
  const spoken = text.trim();
  // macOS 유나는 발화 맨 앞의 '안녕하세요'를 '넨넨하세요'로 읽는다.
  // 한 단어로 넘기지 않으면 그 발음을 피한다.
  if (!spoken.startsWith('안녕하세요')) return spoken;
  return `안녕 하세요${spoken.slice('안녕하세요'.length)}`;
}

export function useSpeechOutput() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [voiceLive, setVoiceLive] = useState(false);
  const [voiceMark, setVoiceMark] = useState(0);
  const sessionRef = useRef(0);
  const voiceLevelRef = useRef(0);
  const voiceLiveRef = useRef(false);
  const levelLoopRef = useRef(0);

  useEffect(() => {
    setIsSupported(typeof window !== 'undefined' && 'speechSynthesis' in window);

    return () => {
      sessionRef.current += 1;
      window.cancelAnimationFrame(levelLoopRef.current);
      voiceLiveRef.current = false;
      voiceLevelRef.current = 0;
      if (typeof window !== 'undefined') {
        window.speechSynthesis?.cancel();
      }
    };
  }, []);

  const stopLevel = useCallback(() => {
    window.cancelAnimationFrame(levelLoopRef.current);
    voiceLiveRef.current = false;
    const ease = () => {
      voiceLevelRef.current *= 0.84;
      if (voiceLevelRef.current < 0.012) {
        voiceLevelRef.current = 0;
        return;
      }
      levelLoopRef.current = window.requestAnimationFrame(ease);
    };
    levelLoopRef.current = window.requestAnimationFrame(ease);
  }, []);

  const stopSpeaking = useCallback(() => {
    sessionRef.current += 1;
    stopLevel();
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setVoiceLive(false);
  }, [stopLevel]);

  const speak = useCallback((text, onEnd, onAudioEnd) => {
    if (typeof window === 'undefined' || !window.speechSynthesis || !text?.trim()) {
      onEnd?.();
      return false;
    }

    const session = sessionRef.current + 1;
    sessionRef.current = session;
    const synth = window.speechSynthesis;
    const spoken = prepareSpoken(text);
    let finished = false;
    let keepAlive = 0;

    const finish = () => {
      if (finished || session !== sessionRef.current) return;
      finished = true;
      window.clearInterval(keepAlive);
      clearWords();
      stopLevel();
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

    const weights = Array.from(spoken, syllableAmp);
    let anchorIndex = 0;
    let anchorAt = 0;
    const followVoice = (now) => {
      if (finished || session !== sessionRef.current || !voiceLiveRef.current) return;
      const since = now - anchorAt;
      const pos = anchorIndex + since / 175;
      const index = Math.max(0, Math.floor(pos));
      const within = index < weights.length;
      const unit = within ? pos - index : (since % 175) / 175;
      const amp = within ? weights[index] : 0.62;
      const hump = amp === 0 ? 0 : Math.sin(Math.PI * Math.min(1, Math.max(0, unit))) ** 0.72;
      voiceLevelRef.current = amp * hump;
      levelLoopRef.current = window.requestAnimationFrame(followVoice);
    };
    const armVoice = () => {
      anchorAt = performance.now();
      anchorIndex = 0;
      voiceLiveRef.current = true;
      window.cancelAnimationFrame(levelLoopRef.current);
      levelLoopRef.current = window.requestAnimationFrame(followVoice);
      setVoiceLive(true);
    };
    utterance.onstart = () => {
      if (session !== sessionRef.current) return;
      startedAt = Date.now();
      const elapsed = voiceLiveRef.current ? performance.now() - anchorAt : Infinity;
      if (!voiceLiveRef.current || elapsed < 180) armVoice();
      setIsSpeaking(true);
    };
    utterance.onboundary = (event) => {
      if (session !== sessionRef.current) return;
      if (event.name && event.name !== 'word') return;
      if (typeof event.charIndex === 'number' && event.charIndex > anchorIndex) {
        anchorIndex = event.charIndex;
        anchorAt = performance.now();
      }
      setVoiceMark((mark) => mark + 1);
    };
    utterance.onend = () => {
      if (session !== sessionRef.current) return;
      clearWords();
      stopLevel();
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
        armVoice();
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
  }, [stopLevel]);

  return {
    speak,
    stopSpeaking,
    isSpeaking,
    isSupported,
    voiceLive,
    voiceMark,
    voiceLevelRef,
    voiceLiveRef,
  };
};
