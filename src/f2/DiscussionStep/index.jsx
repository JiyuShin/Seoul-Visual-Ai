import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { VIEWER_BY_CAM } from '../../shared/gaze/participants';
import { useEntryFlow } from '../../shared/EntryFlowContext';
import { streetSceneForDistrict } from '../../shared/streetView';
import AgentOrb from '../AgentOrb';
import VisionOrb from '../VisionOrb';
import { useSpeechInput } from '../useSpeechInput';
import { useSpeechOutput } from '../useSpeechOutput';
import StreetCanvas, { FOLD_MS } from './StreetCanvas';
import {
  FLOW1,
  FLOW1_CLOSE_LINE,
  FLOW1_ZONES,
  fetchEchoLine,
  fetchReplyKeyword,
  fetchSummaryLine,
} from '../flow1';
import styles from './DiscussionStep.module.css';

const SPEAKERS = [
  { cam: 'A', label: 'A님' },
  { cam: 'B', label: 'B님' },
];

const USER_BEATS = new Set(['speak', 'reply1', 'reply2', 'f1Speak', 'f1Reply']);

const CARD_PHRASE = {
  shade: '탁한 일상을 비우고 맑은 초록으로 채우는 서울',
  water: '초록 사이로 선명한 햇살이 스며드는 서울',
  food: '지친 걸음을 품어주는 넉넉한 초록 그늘의 서울',
  scent: '자연의 형태가 도심 곳곳에 녹아드는 서울',
  rest: '어디든 편히 앉거나 누울 수 있는 서울',
};

const CARD_LINES = {
  shade: ['탁한 일상을 비우고', '맑은 초록으로 채우는 서울'],
  water: ['초록 사이로 선명한', '햇살이 스며드는 서울'],
  food: ['지친 걸음을 품어주는', '넉넉한 초록 그늘의 서울'],
  scent: ['자연의 형태가 도심', '곳곳에 녹아드는 서울'],
};

const STAGE_W = 3881;
const STAGE_H = 2183;

function readStageScale() {
  if (typeof window === 'undefined') return 1;
  const next = Math.max(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
  return next > 0 ? next : 1;
}
const AFTER_LINE_MS = 0;
const VEIL_FADE_MS = 1150;
const AFTER_VEIL_MS = 1000;

function spokenHoldMs(text) {
  const chars = Array.from(text.replace(/\s/g, '')).length;
  return Math.max(1600, chars * 240);
}
const AFTER_USER_MS = 1800;
const MIC_LIMIT_MS = 10000;
const INTRO_LINE = '함께 선택해주신 이 서울을 실현하기 위해, 삭막한 지금의 거리에서 식물이 필요한 곳을 차례대로 바라보며 토론을 통해 의견을 나눠볼게요.';
const CLOSE_LINE = '토론이 종료 되었어요. 이제 의견을 모아볼게요!';
const WAIT_LINE = '잠시만 기다려 주세요...';
const ANALYZE_LINE = '토론 내용을 기반으로 지역구 추천을 위해 분석 중이에요...';
const CLOSING_BEATS = new Set(['close', 'gather', 'wait', 'analyze']);
const LINE_83 = '여러분이 상상한 서울의 모습, 어떻게 완성할 수 있을까요?';
const MIC_LINE = '마이크가 켜졌어요. 음성으로 입력해주세요.';

const PROMPT_CHARS_PER_LINE = 27;

function nearestBreak(chars, pattern) {
  const mid = Math.round(chars.length / 2);
  let splitAt = -1;
  let best = Infinity;
  chars.forEach((ch, index) => {
    if (index < 4 || index > chars.length - 5) return;
    if (!pattern.test(ch)) return;
    const dist = Math.abs(index + 1 - mid);
    if (dist < best) {
      best = dist;
      splitAt = index + 1;
    }
  });
  return splitAt;
}

function splitPrompt(chars, splitAt) {
  const first = chars.slice(0, splitAt).join('').trim();
  const second = chars.slice(splitAt).join('').trim();
  return second ? [first, second] : [first];
}

function promptLines(text) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (!value) return [];
  const chars = Array.from(value);
  if (chars.length <= PROMPT_CHARS_PER_LINE) return [value];
  const sentenceAt = nearestBreak(chars, /[.?!。？！]/);
  if (sentenceAt > 0) return splitPrompt(chars, sentenceAt);

  const pauseAt = nearestBreak(chars, /,/);
  if (pauseAt > 0) return splitPrompt(chars, pauseAt);

  if (chars.length <= PROMPT_CHARS_PER_LINE * 2) return [value];
  const spaceAt = nearestBreak(chars, /\s/);
  if (spaceAt > 0) return splitPrompt(chars, spaceAt);
  return splitPrompt(chars, Math.round(chars.length / 2));
}

function gazeLine(cam) {
  return `안녕하세요 ${cam}님. 이 광경에서 당신만의 식물을 어디에 심으면 좋을까요? 시선으로 선택 후 3초간 응시해주세요.`;
}

function fallbackAsk(history) {
  const last = [...history].reverse().find((item) => item.role === 'user');
  if (!last?.text) return '좋은 생각이에요. 그 자리에 어떤 식물이 있으면 좋을까요?';
  return '좋은 의견이에요. 그 장면이 거리에서는 어떻게 보일까요?';
}

async function fetchAgentLine(payload) {
  try {
    const response = await fetch('/api/discussion-agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      const data = await response.json();
      if (data?.line) return data.line;
    }
  } catch {
    // 아래 문장으로 이어간다.
  }
  return '';
}

function AgentLine({ text }) {
  const shellRef = useRef(null);
  const seqRef = useRef(0);
  const [layers, setLayers] = useState([]);
  const [liveId, setLiveId] = useState(0);
  const incoming = String(text || '').trim();
  const activeNow = [...layers].reverse().find((layer) => layer.on);
  if ((activeNow?.text || '') !== incoming) {
    seqRef.current += 1;
    const fading = layers.map((layer) => ({ ...layer, on: false }));
    const next = incoming
      ? [...fading, { id: seqRef.current, text: incoming, on: true }]
      : fading;
    setLayers(next.slice(-2));
  }

  useLayoutEffect(() => {
    const shell = shellRef.current;
    const active = layers.find((layer) => layer.on);
    if (!shell || !active) return undefined;
    const node = shell.querySelector('[data-line="1"]');
    if (!node) return undefined;
    const style = window.getComputedStyle(shell);
    const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const borderX = parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
    const borderY = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    const first = shell.dataset.ready !== '1';
    if (first) shell.style.transition = 'none';
    shell.style.width = `${Math.ceil(node.scrollWidth + padX + borderX)}px`;
    shell.style.height = `${Math.ceil(node.scrollHeight + padY + borderY)}px`;
    if (first) {
      shell.dataset.ready = '1';
      shell.getBoundingClientRect();
      shell.style.transition = '';
    }
    const timer = window.setTimeout(() => {
      setLayers((prev) => prev.filter((layer) => layer.on));
    }, 760);
    return () => window.clearTimeout(timer);
  }, [layers]);

  useLayoutEffect(() => {
    const active = layers.find((layer) => layer.on);
    if (!active) {
      setLiveId(0);
      return undefined;
    }
    if (liveId === active.id) return undefined;
    const frame = window.requestAnimationFrame(() => setLiveId(active.id));
    return () => window.cancelAnimationFrame(frame);
  }, [layers, liveId]);

  if (!layers.length) return null;

  return (
    <div ref={shellRef} className={styles.promptShell}>
      {layers.map((layer) => (
        <p
          key={layer.id}
          data-line={layer.on ? '1' : '0'}
          className={`${styles.promptText} ${layer.id === liveId ? styles.promptTextOn : ''}`}
        >
          {promptLines(layer.text).map((line, index) => (
            <span key={`${layer.id}-${index}`}>
              {index > 0 && <br />}
              {line}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}

export default function DiscussionStep({
  winnerCard,
  registerGazeHandler,
  onGazeClipChange,
}) {
  const router = useRouter();
  const { selectedDistrict, setDiscussionCam } = useEntryFlow();
  const scene = streetSceneForDistrict(selectedDistrict);
  const [speakerIndex, setSpeakerIndex] = useState(0);
  const [beat, setBeat] = useState('intro');
  const [agentLine, setAgentLine] = useState('');
  const [marks, setMarks] = useState([]);
  const [gazeOpen, setGazeOpen] = useState(false);
  const [scale, setScale] = useState(readStageScale);
  const historyRef = useRef([]);
  const activeMarkRef = useRef(null);
  const beatRef = useRef(beat);
  const speakerRef = useRef(SPEAKERS[0]);
  const committedRef = useRef(false);
  const submitTimerRef = useRef(null);
  const queueRef = useRef([]);
  const pumpingRef = useRef(false);
  const hangRef = useRef(0);
  const saidRef = useRef(new Set());
  const veilRef = useRef(null);
  const streetRef = useRef(null);
  const aliveRef = useRef(true);
  const phraseRef = useRef('');
  const marksLiveRef = useRef([]);
  const zoneRef = useRef(0);
  const summaryRef = useRef('');
  const speechOutput = useSpeechOutput();
  const speechOutputRef = useRef(speechOutput);
  speechOutputRef.current = speechOutput;

  const speaker = SPEAKERS[speakerIndex];
  beatRef.current = beat;
  speakerRef.current = speaker;
  marksLiveRef.current = marks;
  const cardPhrase = CARD_PHRASE[winnerCard?.id] || winnerCard?.label || CARD_PHRASE.food;
  phraseRef.current = cardPhrase;

  const showChrome = !['intro', 'shrink', 'dock', 'gather', 'wait', 'analyze'].includes(beat);
  const showPlace = showChrome && beat !== 'close';
  const showPrompt = Boolean(agentLine) && !['intro', 'shrink', 'done', 'close', 'gather', 'wait', 'analyze'].includes(beat);
  const docked = beat !== 'intro' && beat !== 'shrink';
  const closingCopy = beat === 'close'
    ? CLOSE_LINE
    : beat === 'wait'
      ? WAIT_LINE
      : beat === 'analyze'
        ? ANALYZE_LINE
        : '';

  useLayoutEffect(() => {
    const fit = () => {
      const next = readStageScale();
      setScale(next);
      document.documentElement.style.setProperty('--street-scale', String(next));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  useEffect(() => {
    let started = false;
    let dockTimer = 0;
    const beginUnveil = () => {
      if (started || !aliveRef.current) return;
      started = true;
      setBeat('shrink');
      dockTimer = window.setTimeout(() => {
        if (aliveRef.current) setBeat('dock');
      }, 2600);
    };
    speechOutputRef.current.speak(INTRO_LINE, beginUnveil, beginUnveil);
    return () => window.clearTimeout(dockTimer);
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      window.clearTimeout(hangRef.current);
    };
  }, []);

  const pumpSpeech = useCallback(() => {
    if (!aliveRef.current || pumpingRef.current) return;
    const job = queueRef.current.shift();
    if (!job) return;
    pumpingRef.current = true;
    setAgentLine(job.line);
    const minHold = spokenHoldMs(job.line);
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(hangRef.current);
      pumpingRef.current = false;
      if (aliveRef.current) job.onEnd?.();
      pumpSpeech();
    };
    hangRef.current = window.setTimeout(finish, minHold + 8000);
    speechOutputRef.current.speak(job.line, () => {
      window.setTimeout(finish, AFTER_LINE_MS);
    }, () => {
      job.onAudioEnd?.();
      if (job.releaseOnAudio) finish();
    });
  }, []);

  const say = useCallback((key, line, onEnd, onAudioEnd, releaseOnAudio) => {
    if (!line || saidRef.current.has(key)) return;
    saidRef.current.add(key);
    queueRef.current.push({ line, onEnd, onAudioEnd, releaseOnAudio: Boolean(releaseOnAudio) });
    pumpSpeech();
  }, [pumpSpeech]);

  useEffect(() => {
    setDiscussionCam(speaker.cam);
  }, [setDiscussionCam, speaker.cam]);

  useEffect(() => {
    if (beat === 'close') {
      say('close', FLOW1 ? FLOW1_CLOSE_LINE : CLOSE_LINE);
      const timer = window.setTimeout(() => {
        if (beatRef.current === 'close') setBeat('gather');
      }, 5200);
      return () => window.clearTimeout(timer);
    }
    if (beat === 'gather') {
      const timer = window.setTimeout(() => {
        if (beatRef.current === 'gather') setBeat(FLOW1 ? 'analyze' : 'wait');
      }, 3400);
      return () => window.clearTimeout(timer);
    }
    if (beat === 'wait') {
      const timer = window.setTimeout(() => {
        if (beatRef.current === 'wait') setBeat('analyze');
      }, 2800);
      return () => window.clearTimeout(timer);
    }
    if (beat === 'analyze') {
      const timer = window.setTimeout(() => router.push('/3'), 2800);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [beat, router, say]);

  useEffect(() => {
    committedRef.current = false;
    if (beat !== 'gaze' && beat !== 'f1Gaze') setGazeOpen(false);
  }, [beat, speakerIndex]);

  useEffect(() => () => window.clearTimeout(submitTimerRef.current), []);

  const advanceAfterFold = useCallback(() => {
    if (speakerRef.current.cam === 'A') {
      historyRef.current = [];
      activeMarkRef.current = null;
      setSpeakerIndex(1);
      setBeat('gaze');
      return;
    }
    if (FLOW1) {
      setBeat('f1Surge');
      return;
    }
    setBeat('close');
  }, []);

  useEffect(() => {
    if (beat === 'dock') {
      let started = false;
      let delayTimer = 0;
      const startLine = () => {
        if (started || beatRef.current !== 'dock') return;
        started = true;
        say('dock', LINE_83, () => {
          if (beatRef.current === 'dock') setBeat('gaze');
        });
      };
      const arm = () => {
        window.clearTimeout(delayTimer);
        delayTimer = window.setTimeout(startLine, AFTER_VEIL_MS);
      };
      const veil = veilRef.current;
      const onFade = (event) => {
        if (event.target !== veil || event.propertyName !== 'opacity') return;
        veil.removeEventListener('transitionend', onFade);
        arm();
      };
      veil?.addEventListener('transitionend', onFade);
      const fallback = window.setTimeout(arm, VEIL_FADE_MS);
      return () => {
        window.clearTimeout(fallback);
        window.clearTimeout(delayTimer);
        veil?.removeEventListener('transitionend', onFade);
      };
    }
    if (beat === 'gaze') {
      const cam = speakerRef.current.cam;
      let armed = false;
      let timer = 0;
      const openGaze = () => {
        if (armed || beatRef.current !== 'gaze') return;
        armed = true;
        timer = window.setTimeout(() => {
          if (beatRef.current === 'gaze') setGazeOpen(true);
        }, 7000);
      };
      say(`gaze-${cam}`, gazeLine(cam), openGaze, openGaze);
      return () => window.clearTimeout(timer);
    }
    if (beat === 'speak') {
      let micArmed = false;
      const openMic = () => {
        if (micArmed || beatRef.current !== 'speak') return;
        micArmed = true;
        speechRef.current.clearTranscript();
        speechRef.current.startListening();
        armMicLimit();
      };
      say(`speak-${speakerRef.current.cam}`, MIC_LINE, openMic, openMic);
      return undefined;
    }
    if (beat === 'fold') {
      const markId = activeMarkRef.current;
      const cam = speakerRef.current.cam;
      const label = speakerRef.current.label;
      const foldTimer = window.setTimeout(() => {
        setMarks((prev) => prev.map((mark) => (
          mark.id === markId ? { ...mark, folded: true } : mark
        )));
      }, AFTER_USER_MS);
      const lineTimer = window.setTimeout(() => {
        if (beatRef.current !== 'fold') return;
        say(`collected-${cam}`, `${label}의 의견을 수집했어요!`, () => {
          if (beatRef.current !== 'fold') return;
          let moved = false;
          let fallback = 0;
          const go = () => {
            if (moved || !aliveRef.current || beatRef.current !== 'fold') return;
            moved = true;
            window.clearTimeout(fallback);
            advanceAfterFold();
          };
          fallback = window.setTimeout(go, 7000);
          if (!streetRef.current?.recenter(go, { release: cam === 'A' })) go();
        });
      }, AFTER_USER_MS + FOLD_MS + 40);
      return () => {
        window.clearTimeout(foldTimer);
        window.clearTimeout(lineTimer);
      };
    }
    return undefined;
  }, [advanceAfterFold, beat, say, speakerIndex]);

  useEffect(() => {
    if (!FLOW1) return undefined;
    if (beat === 'f1Surge') {
      setAgentLine('');
      let line = '';
      let ready = false;
      let timerDone = false;
      let cancelled = false;
      const go = () => {
        if (cancelled || !ready || !timerDone || beatRef.current !== 'f1Surge') return;
        summaryRef.current = line;
        setBeat('f1Summary');
      };
      const timer = window.setTimeout(() => {
        timerDone = true;
        go();
      }, 2600);
      fetchSummaryLine(marksLiveRef.current).then((text) => {
        line = text;
        ready = true;
        go();
      });
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }
    if (beat === 'f1Summary') {
      setMarks((prev) => prev.map((mark) => ({ ...mark, tucked: true })));
      say('f1-summary', summaryRef.current, () => {
        if (beatRef.current !== 'f1Summary') return;
        zoneRef.current = 0;
        setSpeakerIndex(FLOW1_ZONES[0].speaker);
        setBeat('f1Gaze');
      });
      return undefined;
    }
    if (beat === 'f1Gaze') {
      const zone = FLOW1_ZONES[zoneRef.current];
      let armed = false;
      let timer = 0;
      const openGaze = () => {
        if (armed || beatRef.current !== 'f1Gaze') return;
        armed = true;
        streetRef.current?.releaseLook?.();
        timer = window.setTimeout(() => {
          if (beatRef.current === 'f1Gaze') setGazeOpen(true);
        }, 7000);
      };
      say(`f1-gaze-${zone.id}`, zone.look, openGaze, openGaze);
      return () => window.clearTimeout(timer);
    }
    if (beat === 'f1Speak') {
      let micArmed = false;
      const openMic = () => {
        if (micArmed || beatRef.current !== 'f1Speak') return;
        micArmed = true;
        speechRef.current.clearTranscript();
        speechRef.current.startListening();
        armMicLimit();
      };
      say(`f1-mic-${FLOW1_ZONES[zoneRef.current].id}`, MIC_LINE, openMic, openMic);
      return undefined;
    }
    if (beat === 'f1Reply') {
      let micArmed = false;
      const openMic = () => {
        if (micArmed || beatRef.current !== 'f1Reply') return;
        micArmed = true;
        speechRef.current.clearTranscript();
        speechRef.current.startListening();
        armMicLimit();
      };
      say(`f1-mic-reply-${FLOW1_ZONES[zoneRef.current].id}`, MIC_LINE, openMic, openMic);
      return undefined;
    }
    if (beat === 'f1React' || beat === 'f1Echo') {
      let cancelled = false;
      let homeTimer = 0;
      const zone = FLOW1_ZONES[zoneRef.current];
      const kind = beat === 'f1React' ? 'opinion' : 'reply';
      const run = async () => {
        const last = [...historyRef.current].reverse().find((item) => item.role === 'user');
        const line = await fetchEchoLine(last?.text || '', historyRef.current);
        if (cancelled || beatRef.current !== beat) return;
        historyRef.current = [...historyRef.current, { role: 'assistant', text: line }];
        say(`f1-${kind}-${zone.id}`, line, () => {
          if (beatRef.current !== beat) return;
          if (beat === 'f1React') {
            setSpeakerIndex(zone.other);
            setBeat('f1Ask');
            return;
          }
          if (zoneRef.current === 0) {
            zoneRef.current = 1;
            setSpeakerIndex(FLOW1_ZONES[1].speaker);
            setBeat('f1Gaze');
            return;
          }
          setAgentLine('');
          let moved = false;
          const go = () => {
            if (moved || beatRef.current !== 'f1Echo') return;
            moved = true;
            window.clearTimeout(homeTimer);
            setBeat('close');
          };
          homeTimer = window.setTimeout(go, 7000);
          if (!streetRef.current?.recenter(go, { release: false })) go();
        });
      };
      run();
      return () => {
        cancelled = true;
        window.clearTimeout(homeTimer);
      };
    }
    if (beat === 'f1Ask') {
      const zone = FLOW1_ZONES[zoneRef.current];
      say(`f1-ask-${zone.id}`, zone.askOther, () => {
        if (beatRef.current === 'f1Ask') setBeat('f1Reply');
      }, undefined, true);
    }
    return undefined;
  }, [beat, say]);

  useEffect(() => {
    if (beat !== 'ask1' && beat !== 'ask2') return undefined;
    let cancelled = false;
    const next = beat === 'ask1' ? 'reply1' : 'reply2';
    const key = `${beat}-${speakerRef.current.cam}`;

    const run = async () => {
      const line = await fetchAgentLine({
        beat: 'ask',
        followUp: beat === 'ask1' ? 1 : 2,
        speakerLabel: speakerRef.current.label,
        districtName: scene.name,
        visionLabel: phraseRef.current,
        history: historyRef.current,
      });
      if (cancelled) return;
      const spoken = line || fallbackAsk(historyRef.current);
      historyRef.current = [...historyRef.current, { role: 'assistant', text: spoken }];
      let micArmed = false;
      const openReply = () => {
        if (micArmed || cancelled || beatRef.current !== beat) return;
        micArmed = true;
        setBeat(next);
      };
      say(key, spoken, openReply, openReply);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [beat, say, scene.name, speakerIndex]);

  const finishUserTurn = useCallback((text, immediate) => {
    if (committedRef.current || !USER_BEATS.has(beatRef.current)) return;
    const trimmed = (text || '').trim();
    if (!trimmed && !immediate) return;
    committedRef.current = true;
    window.clearTimeout(submitTimerRef.current);
    window.clearTimeout(micLimitRef.current);
    const current = beatRef.current;
    if (trimmed) {
      const markId = activeMarkRef.current;
      const author = speakerRef.current.cam;
      const entry = { text: trimmed, cam: author };
      setMarks((prev) => prev.map((mark) => (
        mark.id === markId
          ? { ...mark, lines: [...mark.lines, entry] }
          : mark
      )));
      historyRef.current = [...historyRef.current, { role: 'user', text: trimmed }];
      if (current === 'reply1' || current === 'reply2') {
        const question = [...historyRef.current].reverse().find((item) => item.role === 'assistant')?.text || '';
        fetchReplyKeyword(trimmed, question, current === 'reply2' ? 2 : 1).then((keyword) => {
          if (!keyword || !aliveRef.current) return;
          setMarks((prev) => prev.map((mark) => (
            mark.id !== markId
              ? mark
              : {
                ...mark,
                lines: mark.lines.map((line) => (
                  line.text === trimmed && line.cam === author && !line.keyword
                    ? { ...line, keyword }
                    : line
                )),
              }
          )));
        });
      }
    }
    const nextBeat = current === 'f1Speak'
      ? 'f1React'
      : current === 'f1Reply'
        ? 'f1Echo'
        : current === 'speak'
          ? 'ask1'
          : current === 'reply1'
            ? 'ask2'
            : 'fold';
    const go = () => {
      if (beatRef.current === current) setBeat(nextBeat);
    };
    if (immediate) go();
    else submitTimerRef.current = window.setTimeout(go, AFTER_USER_MS);
  }, []);
  const finishRef = useRef(finishUserTurn);
  finishRef.current = finishUserTurn;
  const micLimitRef = useRef(0);
  const armMicLimit = useCallback(() => {
    window.clearTimeout(micLimitRef.current);
    micLimitRef.current = window.setTimeout(() => {
      if (!USER_BEATS.has(beatRef.current) || committedRef.current) return;
      const heard = speechRef.current.getCombinedText();
      speechRef.current.stopListening();
      finishRef.current(heard, true);
    }, MIC_LIMIT_MS);
  }, []);

  const speech = useSpeechInput({
    onFinalTranscript: (fullText) => {
      if (!USER_BEATS.has(beatRef.current)) return;
      const trimmed = fullText.trim();
      if (!trimmed) return;
      window.clearTimeout(submitTimerRef.current);
      submitTimerRef.current = window.setTimeout(() => finishRef.current(trimmed, false), 1800);
    },
  });
  const speechRef = useRef(speech);
  speechRef.current = speech;

  useEffect(() => {
    if (!USER_BEATS.has(beat)) {
      window.clearTimeout(micLimitRef.current);
      speechRef.current.stopListening();
      return undefined;
    }
    if (beat === 'speak' || beat === 'f1Speak' || beat === 'f1Reply') {
      return () => {
        window.clearTimeout(micLimitRef.current);
        speechRef.current.stopListening();
      };
    }
    speechRef.current.clearTranscript();
    speechRef.current.startListening();
    armMicLimit();
    return () => {
      window.clearTimeout(micLimitRef.current);
      speechRef.current.stopListening();
    };
  }, [armMicLimit, beat]);

  const handlePlant = useCallback((spot) => {
    const currentBeat = beatRef.current;
    if (currentBeat !== 'gaze' && currentBeat !== 'f1Gaze') return;
    const current = speakerRef.current;
    const mark = {
      id: `${current.cam}-${Date.now()}`,
      cam: current.cam,
      label: current.label,
      direction: spot.direction,
      nx: spot.nx,
      ny: spot.ny,
      lines: [],
      folded: false,
    };
    activeMarkRef.current = mark.id;
    setMarks((prev) => [...prev, mark]);
    setBeat(currentBeat === 'f1Gaze' ? 'f1Speak' : 'speak');
  }, []);

  const handleCanvasRect = useCallback((rect) => {
    if ((beatRef.current === 'gaze' || beatRef.current === 'f1Gaze') && rect) onGazeClipChange?.(rect);
    else onGazeClipChange?.(null);
  }, [onGazeClipChange]);

  const orbSize = 400;
  const finaleSize = 442;
  const showVisionCard = beat === 'intro' || beat === 'shrink';
  const cardScale = (beat === 'intro' ? 563 : 306) / 563;
  const morphing = beat === 'wait' || beat === 'analyze';
  const pillWidth = beat === 'analyze' ? 2082 : 1339;
  const pillHeight = 227;
  const circlePose = (size, top) => ({
    left: (STAGE_W - size) / 2,
    top,
    width: size,
    height: size,
    radius: size / 2,
  });
  const orbPose = beat === 'intro'
    ? circlePose(563, 722)
    : beat === 'shrink'
      ? circlePose(306, 784)
      : morphing
        ? {
            left: (STAGE_W - pillWidth) / 2,
            top: 978,
            width: pillWidth,
            height: pillHeight,
            radius: pillHeight / 2,
          }
        : beat === 'close'
          ? circlePose(finaleSize, 1542)
          : CLOSING_BEATS.has(beat)
            ? circlePose(finaleSize, 871)
            : circlePose(orbSize, showPrompt ? 1744 : 1704);

  return (
    <section className={styles.discussionStep}>
      <div className={styles.canvasArea}>
        <StreetCanvas
          ref={streetRef}
          imageUrl={scene.pending ? '' : scene.image}
          yawSpan={scene.yawSpan || 360}
          zoom={scene.zoom || 1}
          pendingLabel={scene.name}
          registerGazeHandler={registerGazeHandler}
          phase={(beat === 'gaze' || beat === 'f1Gaze') && gazeOpen ? 'gaze' : 'look'}
          activeViewerId={VIEWER_BY_CAM[speaker.cam]}
          marks={marks}
          onPlant={handlePlant}
          onCanvasRect={handleCanvasRect}
          revealed={docked && beat !== 'wait' && beat !== 'analyze'}
          quiet={CLOSING_BEATS.has(beat)}
          gather={beat === 'gather' || beat === 'wait' || beat === 'analyze'}
          finaleFull={beat === 'wait' || beat === 'analyze'}
        />
      </div>

      <div ref={veilRef} className={`${styles.veil} ${docked ? styles.veilOff : ''}`} />

      <div className={styles.hudViewport}>
        <div className={styles.hudFit} style={{ width: STAGE_W * scale, height: STAGE_H * scale }}>
          <div className={styles.hudStage} style={{ transform: `scale(${scale})` }}>
            <div className={`${styles.turn} ${showChrome ? styles.turnOn : ''} ${beat === 'close' ? styles.turnRest : ''}`}>
              <div className={styles.profileSlot}>
                <img
                  className={`${styles.profile} ${speaker.cam === 'A' ? styles.profileShown : ''}`}
                  src="/2/turn-profile.svg"
                  alt=""
                />
                <img
                  className={`${styles.profileB} ${speaker.cam === 'B' ? styles.profileShown : ''}`}
                  src="/2/turn-profile-b.svg"
                  alt=""
                />
              </div>
              <p className={styles.turnLabel}>{speaker.cam}님의 차례예요</p>
            </div>

            <div className={`${styles.placeChip} ${showPlace ? styles.placeOn : ''}`}>
              <span className={styles.placePin} aria-hidden="true">
                <img src="/2/location-on.svg" alt="" />
              </span>
              <span>서울의 한 거리를 보고 있어요</span>
            </div>

            <div className={`${styles.promptBlock} ${showPrompt ? styles.promptOn : ''}`}>
              <AgentLine text={agentLine} />
            </div>

            {(beat === 'close' || beat === 'gather') && (
              <div className={`${styles.closingBubble} ${styles.closingTalk} ${beat === 'gather' ? styles.closingLeave : ''}`}>
                <p>{FLOW1 ? FLOW1_CLOSE_LINE : CLOSE_LINE}</p>
              </div>
            )}

            <div
              className={`${styles.orbSlot} ${CLOSING_BEATS.has(beat) ? styles.orbFinale : ''} ${showVisionCard ? '' : styles.orbIsAgent} ${morphing ? styles.orbPill : ''}`}
              style={{
                top: orbPose.top + orbPose.height / 2,
                width: orbPose.width,
                height: orbPose.height,
                borderRadius: orbPose.radius,
              }}
            >
              <div className={styles.visionCard} style={{ transform: `scale(${cardScale})` }}>
                {showVisionCard && (
                  <VisionOrb
                    className={styles.visionOrb}
                    lines={CARD_LINES[winnerCard?.id] || CARD_LINES.food}
                    voiceLive={speechOutput.voiceLive}
                    voiceMark={speechOutput.voiceMark}
                  />
                )}
              </div>
              <div className={styles.agentFace}>
                <div className={`${styles.orbPulse} ${FLOW1 && (beat === 'f1Surge' || beat === 'f1Summary') ? styles.orbLively : ''}`}>
                  <AgentOrb
                    agentSpeaking={speechOutput.isSpeaking}
                    userListening={speech.isListening}
                    userLevelRef={speech.levelRef}
                    voiceLevelRef={speechOutput.voiceLevelRef}
                    voiceLiveRef={speechOutput.voiceLiveRef}
                    lively={FLOW1 && (beat === 'f1Surge' || beat === 'f1Summary')}
                    className={styles.orbCanvas}
                  />
                </div>
              </div>
              {morphing && <p key={closingCopy} className={styles.orbCopy}>{closingCopy}</p>}
            </div>

            <p className={`${styles.caption} ${beat === 'intro' ? styles.captionOn : ''}`}>
              함께 선택해주신 이 서울을 실현하기 위해,
              <br />
              삭막한 지금의 거리에서 식물이 필요한 곳을 차례대로 바라보며 토론을 통해 의견을 나눠볼게요.
            </p>
          </div>
        </div>
      </div>

    </section>
  );
}
