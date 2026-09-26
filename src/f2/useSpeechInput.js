import { useCallback, useEffect, useRef, useState } from 'react';

export function useSpeechInput({ onFinalTranscript, onTranscriptUpdate } = {}) {
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  const shouldListenRef = useRef(false);
  const onFinalRef = useRef(onFinalTranscript);
  const onUpdateRef = useRef(onTranscriptUpdate);
  const transcriptRef = useRef('');
  const interimRef = useRef('');
  const isListeningRef = useRef(false);
  const levelRef = useRef(0);
  const meterRef = useRef(null);
  const meterGenRef = useRef(0);

  const stopMeter = useCallback(() => {
    meterGenRef.current += 1;
    const meter = meterRef.current;
    meterRef.current = null;
    levelRef.current = 0;
    if (!meter) return;
    window.cancelAnimationFrame(meter.frame);
    meter.stream.getTracks().forEach((track) => track.stop());
    meter.ctx.close();
  }, []);

  const startMeter = useCallback(async () => {
    if (meterRef.current || typeof navigator === 'undefined' || !navigator.mediaDevices) return;
    const gen = meterGenRef.current + 1;
    meterGenRef.current = gen;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      if (meterGenRef.current !== gen || !shouldListenRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      void ctx.resume();
      const data = new Uint8Array(analyser.fftSize);
      const meter = { stream, ctx, frame: 0 };
      meterRef.current = meter;
      const tick = () => {
        if (meterRef.current !== meter) return;
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) {
          const sample = (data[i] - 128) / 128;
          sum += sample * sample;
        }
        const rms = Math.sqrt(sum / data.length);
        const next = Math.min(1, Math.max(0, rms - 0.018) / 0.14);
        const prev = levelRef.current;
        levelRef.current = prev + (next - prev) * (next > prev ? 0.48 : 0.2);
        meter.frame = window.requestAnimationFrame(tick);
      };
      meter.frame = window.requestAnimationFrame(tick);
    } catch {
      levelRef.current = 0;
    }
  }, []);

  useEffect(() => {
    onFinalRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  useEffect(() => {
    onUpdateRef.current = onTranscriptUpdate;
  }, [onTranscriptUpdate]);

  const emitTranscriptUpdate = useCallback(() => {
    const combined = `${transcriptRef.current} ${interimRef.current}`.trim();
    onUpdateRef.current?.(combined, transcriptRef.current, interimRef.current);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return undefined;
    }

    setIsSupported(true);
    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      if (finalText) {
        transcriptRef.current = `${transcriptRef.current}${finalText}`.trim();
        setTranscript(transcriptRef.current);
        onFinalRef.current?.(transcriptRef.current, finalText.trim());
      }

      interimRef.current = interimText;
      setInterimTranscript(interimText);
      emitTranscriptUpdate();
    };

    recognition.onerror = (event) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError(event.error);
      }
    };

    recognition.onend = () => {
      if (shouldListenRef.current && recognitionRef.current) {
        window.setTimeout(() => {
          if (!shouldListenRef.current || !recognitionRef.current) return;
          try {
            recognitionRef.current.start();
            isListeningRef.current = true;
            setIsListening(true);
          } catch {
            isListeningRef.current = false;
            setIsListening(false);
          }
        }, 180);
        return;
      }
      setIsListening(false);
      isListeningRef.current = false;
    };

    recognitionRef.current = recognition;

    return () => {
      shouldListenRef.current = false;
      recognition.stop();
      stopMeter();
    };
  }, [emitTranscriptUpdate, stopMeter]);

  const startListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return false;
    setError(null);
    shouldListenRef.current = true;

    const tryStart = (attempt = 0) => {
      try {
        recognition.start();
        isListeningRef.current = true;
        setIsListening(true);
        return true;
      } catch {
        if (attempt >= 6) {
          isListeningRef.current = false;
          setIsListening(false);
          return false;
        }
        window.setTimeout(() => tryStart(attempt + 1), 200 * (attempt + 1));
        return false;
      }
    };

    startMeter();
    return tryStart();
  }, [startMeter]);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    recognitionRef.current?.stop();
    isListeningRef.current = false;
    setIsListening(false);
    stopMeter();
  }, [stopMeter]);

  const getIsListening = useCallback(() => isListeningRef.current, []);

  const clearTranscript = useCallback(() => {
    transcriptRef.current = '';
    interimRef.current = '';
    setTranscript('');
    setInterimTranscript('');
    emitTranscriptUpdate();
  }, [emitTranscriptUpdate]);

  const setManualText = useCallback(
    (text) => {
      transcriptRef.current = text;
      interimRef.current = '';
      setTranscript(text);
      setInterimTranscript('');
      emitTranscriptUpdate();
    },
    [emitTranscriptUpdate]
  );

  const getCombinedText = useCallback(() => {
    return `${transcriptRef.current} ${interimRef.current}`.trim();
  }, []);

  return {
    transcript,
    interimTranscript,
    isListening,
    isSupported,
    error,
    startListening,
    stopListening,
    clearTranscript,
    setManualText,
    getCombinedText,
    getIsListening,
    levelRef,
  };
}
