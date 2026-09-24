import { useCallback, useEffect, useRef, useState } from 'react';
import { VIEWER_BY_CAM } from '../../shared/gaze/participants';
import { useEntryFlow } from '../../shared/EntryFlowContext';
import { streetSceneForDistrict } from '../../shared/streetView';
import AgentOrb from '../AgentOrb';
import { useSpeechInput } from '../useSpeechInput';
import { useSpeechOutput } from '../useSpeechOutput';
import StreetCanvas from './StreetCanvas';
import styles from './DiscussionStep.module.css';

const SPEAKERS = [
  { cam: 'A', label: 'A님' },
  { cam: 'B', label: 'B님' },
];

const USER_BEATS = new Set(['speak', 'reply1', 'reply2']);

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
  scent: ['자연의 형태가 도심 곳곳에', '녹아드는 서울'],
  rest: ['어디든 편히 앉거나', '누울 수 있는 서울'],
};

const STAGE_W = 3881;
const STAGE_H = 2183;
const AFTER_LINE_MS = 0;

function spokenHoldMs(text) {
  const chars = Array.from(text.replace(/\s/g, '')).length;
  return Math.max(1600, chars * 240);
}
const AFTER_USER_MS = 1800;
const FOLD_HOLD_MS = 2600;
const LINE_80_B = '삭막한 지금의 거리 위에 식물이 필요한 곳을 차례대로 바라보아 어떻게 바뀌어야 할지 의견을 나눠주세요.';
const LINE_83 = '여러분이 상상한 서울의 모습, 어떻게 완성할 수 있을까요?';
const MIC_LINE = '마이크가 켜졌어요. 음성으로 입력해주세요.';

function gazeLine(cam) {
  return `안녕하세요 ${cam}님. 이 광경에서 당신만의 식물을 어디에 심으면 좋을까요? 선택 후 3초간 응시해주세요.`;
}

function fallbackAsk(history) {
  const last = [...history].reverse().find((item) => item.role === 'user');
  const bit = last?.text ? `“${last.text.slice(0, 18)}”` : '그 자리';
  return `${bit}라면, 그 식물은 어떤 분위기로 거리를 바꿀 수 있을까요?`;
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

export default function DiscussionStep({
  winnerCard,
  registerGazeHandler,
  onGazeClipChange,
}) {
  const { selectedDistrict, setDiscussionCam } = useEntryFlow();
  const scene = streetSceneForDistrict(selectedDistrict);
  const [speakerIndex, setSpeakerIndex] = useState(0);
  const [beat, setBeat] = useState('intro');
  const [agentLine, setAgentLine] = useState('');
  const [marks, setMarks] = useState([]);
  const [gazeOpen, setGazeOpen] = useState(false);
  const [scale, setScale] = useState(1);
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
  const aliveRef = useRef(true);
  const phraseRef = useRef('');
  const speechOutput = useSpeechOutput();
  const speechOutputRef = useRef(speechOutput);
  speechOutputRef.current = speechOutput;

  const speaker = SPEAKERS[speakerIndex];
  beatRef.current = beat;
  speakerRef.current = speaker;
  const cardPhrase = CARD_PHRASE[winnerCard?.id] || winnerCard?.label || CARD_PHRASE.food;
  const cardLineKey = CARD_LINES[winnerCard?.id]
    ? winnerCard.id
    : Object.keys(CARD_PHRASE).find((key) => CARD_PHRASE[key] === cardPhrase);
  const cardLines = CARD_LINES[cardLineKey] || [cardPhrase];
  phraseRef.current = cardPhrase;

  const showChrome = !['intro', 'shrink', 'dock'].includes(beat);
  const showPrompt = !['intro', 'shrink', 'done'].includes(beat);
  const docked = beat !== 'intro' && beat !== 'shrink';
  const showUser = USER_BEATS.has(beat);

  useEffect(() => {
    const fit = () => {
      const next = Math.max(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
      setScale(next > 0 ? next : 1);
      document.documentElement.style.setProperty('--street-scale', String(next > 0 ? next : 1));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setBeat('shrink'), 5200),
      window.setTimeout(() => setBeat('dock'), 7800),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
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
    }, job.onAudioEnd);
  }, []);

  const say = useCallback((key, line, onEnd, onAudioEnd) => {
    if (!line || saidRef.current.has(key)) return;
    saidRef.current.add(key);
    queueRef.current.push({ line, onEnd, onAudioEnd });
    pumpSpeech();
  }, [pumpSpeech]);

  useEffect(() => {
    setDiscussionCam(speaker.cam);
  }, [setDiscussionCam, speaker.cam]);

  useEffect(() => {
    committedRef.current = false;
    if (beat !== 'gaze') setGazeOpen(false);
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
    setBeat('done');
  }, []);

  useEffect(() => {
    if (beat === 'dock') {
      say('dock', LINE_83, () => {
        if (beatRef.current === 'dock') setBeat('gaze');
      });
      return undefined;
    }
    if (beat === 'gaze') {
      const cam = speakerRef.current.cam;
      say(`gaze-${cam}`, gazeLine(cam), () => {
        if (beatRef.current === 'gaze') setGazeOpen(true);
      }, () => {
        if (beatRef.current === 'gaze') setGazeOpen(true);
      });
      return undefined;
    }
    if (beat === 'speak') {
      say(`speak-${speakerRef.current.cam}`, MIC_LINE);
      return undefined;
    }
    if (beat === 'fold') {
      const timer = window.setTimeout(advanceAfterFold, FOLD_HOLD_MS);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [advanceAfterFold, beat, say, speakerIndex]);

  useEffect(() => {
    if (beat !== 'ask1' && beat !== 'ask2') return undefined;
    let cancelled = false;
    const next = beat === 'ask1' ? 'reply1' : 'reply2';
    const key = `${beat}-${speakerRef.current.cam}`;

    const run = async () => {
      const line = await fetchAgentLine({
        beat: 'ask',
        speakerLabel: speakerRef.current.label,
        districtName: scene.name,
        visionLabel: phraseRef.current,
        history: historyRef.current,
      });
      if (cancelled) return;
      const spoken = line || fallbackAsk(historyRef.current);
      historyRef.current = [...historyRef.current, { role: 'assistant', text: spoken }];
      say(key, spoken, () => {
        if (!cancelled && beatRef.current === beat) setBeat(next);
      });
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [beat, say, scene.name, speakerIndex]);

  const commitUserLine = useCallback((text) => {
    const trimmed = text.trim();
    if (!trimmed || committedRef.current || !USER_BEATS.has(beatRef.current)) return;
    committedRef.current = true;
    window.clearTimeout(submitTimerRef.current);
    const markId = activeMarkRef.current;
    const author = speakerRef.current.cam;
    const current = beatRef.current;
    const entry = { text: trimmed, cam: author };
    setMarks((prev) => prev.map((mark) => (
      mark.id === markId
        ? { ...mark, lines: [...mark.lines, entry], folded: current === 'reply2' }
        : mark
    )));
    historyRef.current = [...historyRef.current, { role: 'user', text: trimmed }];
    const nextBeat = current === 'speak' ? 'ask1' : current === 'reply1' ? 'ask2' : 'fold';
    submitTimerRef.current = window.setTimeout(() => {
      if (beatRef.current === current) setBeat(nextBeat);
    }, AFTER_USER_MS);
  }, []);
  const commitRef = useRef(commitUserLine);
  commitRef.current = commitUserLine;

  const speech = useSpeechInput({
    onFinalTranscript: (fullText) => {
      if (!USER_BEATS.has(beatRef.current)) return;
      const trimmed = fullText.trim();
      if (!trimmed) return;
      window.clearTimeout(submitTimerRef.current);
      submitTimerRef.current = window.setTimeout(() => commitRef.current(trimmed), 1800);
    },
  });
  const speechRef = useRef(speech);
  speechRef.current = speech;

  useEffect(() => {
    if (!USER_BEATS.has(beat)) {
      speechRef.current.stopListening();
      return undefined;
    }
    speechRef.current.clearTranscript();
    speechRef.current.startListening();
    return () => speechRef.current.stopListening();
  }, [beat]);

  const handlePlant = useCallback((spot) => {
    const currentBeat = beatRef.current;
    if (currentBeat !== 'gaze') return;
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
    setBeat('speak');
  }, []);

  const handleCanvasRect = useCallback((rect) => {
    if (beatRef.current === 'gaze' && rect) onGazeClipChange?.(rect);
    else onGazeClipChange?.(null);
  }, [onGazeClipChange]);

  const hearing = showUser && (speech.isListening || Boolean(speech.interimTranscript));
  const hearingHot = showUser && Boolean(speech.interimTranscript);
  const orbSize = 400;
  const showVisionCard = beat === 'intro' || beat === 'shrink';
  const cardScale = (beat === 'intro' ? 563 : 306) / 563;
  const orbPose = beat === 'intro'
    ? { left: (STAGE_W - 563) / 2, top: 722, size: 563 }
    : beat === 'shrink'
      ? { left: (STAGE_W - 306) / 2, top: 784, size: 306 }
      : {
          left: (STAGE_W - orbSize) / 2,
          top: showPrompt ? 1744 : 1704,
          size: orbSize,
        };

  return (
    <section className={styles.discussionStep}>
      <div className={styles.canvasArea}>
        <StreetCanvas
          imageUrl={scene.pending ? '' : scene.image}
          pendingLabel={scene.name}
          registerGazeHandler={registerGazeHandler}
          phase={beat === 'gaze' && gazeOpen ? 'gaze' : 'look'}
          activeViewerId={VIEWER_BY_CAM[speaker.cam]}
          marks={marks}
          onPlant={handlePlant}
          onCanvasRect={handleCanvasRect}
          revealed
        />
      </div>

      <div className={`${styles.veil} ${docked ? styles.veilOff : ''}`} />

      <div className={styles.hudViewport}>
        <div className={styles.hudFit} style={{ width: STAGE_W * scale, height: STAGE_H * scale }}>
          <div className={styles.hudStage} style={{ transform: `scale(${scale})` }}>
            <div className={`${styles.turn} ${showChrome ? styles.turnOn : ''}`}>
              <div className={styles.pills}>
                <span className={`${styles.pill} ${styles.pillA} ${speaker.cam === 'A' ? styles.pillOn : ''}`}>
                  <img src="/2/turn-a.svg" alt="" />
                  <img className={styles.pillRim} src="/2/turn-a-rim.svg" alt="" />
                  <span>A</span>
                </span>
                <span className={`${styles.pill} ${styles.pillB} ${speaker.cam === 'B' ? styles.pillOn : ''}`}>
                  <img src="/2/turn-b.svg" alt="" />
                  <span>B</span>
                </span>
              </div>
              <p className={styles.turnLabel}>{speaker.cam}님의 차례예요</p>
            </div>

            <div className={`${styles.placeChip} ${showChrome ? styles.placeOn : ''}`}>
              <span className={styles.placePin} aria-hidden="true">
                <img src="/2/location-on.svg" alt="" />
              </span>
              <span>{scene.name}를 둘러보고 있어요</span>
            </div>

            <div className={`${styles.promptBlock} ${showPrompt ? styles.promptOn : ''}`}>
              <p key={agentLine} className={styles.promptText}>{agentLine}</p>
            </div>

            <div
              className={`${styles.orbSlot} ${showVisionCard ? '' : styles.orbIsAgent} ${hearing ? styles.orbLive : ''} ${hearingHot ? styles.orbHot : ''}`}
              style={{ left: orbPose.left, top: orbPose.top, width: orbPose.size, height: orbPose.size }}
            >
              <div className={styles.visionCard} style={{ transform: `scale(${cardScale})` }}>
                <img className={styles.visionGlow} src="/2/vision-card-lines.svg" alt="" />
                <span className={styles.visionSheen}>
                  <img src="/2/vision-card-sheen.png" alt="" />
                </span>
                <p className={styles.visionPhrase}>
                  {cardLines.map((line, index) => (
                    <span key={line}>
                      {index > 0 && <br />}
                      {line}
                    </span>
                  ))}
                </p>
              </div>
              <div className={styles.agentFace}>
                <div className={styles.orbPulse}>
                  <AgentOrb speaking={speechOutput.isSpeaking || hearingHot} className={styles.orbCanvas} />
                </div>
              </div>
            </div>

            <p className={`${styles.caption} ${beat === 'intro' ? styles.captionOn : ''}`}>
              {LINE_83}
              <br />
              {LINE_80_B}
            </p>
          </div>
        </div>
      </div>

    </section>
  );
}
