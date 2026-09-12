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
    };
  }, [emitTranscriptUpdate]);

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

    return tryStart();
  }, []);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    recognitionRef.current?.stop();
    isListeningRef.current = false;
    setIsListening(false);
  }, []);

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
  };
}
