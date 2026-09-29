// 플1. false로 두면 B 의견 수집 뒤 바로 기존 마무리로 돌아간다.
export const FLOW1 = true;

export const FLOW1_CLOSE_LINE = '토론이 종료 되었어요!';

export const FLOW1_ZONES = [
  {
    id: 'building',
    speaker: 0,
    other: 1,
    look: '그렇다면 A님, 저 앞에 분홍 지붕 위 회색 건물을 바라봐주세요. 상상한 식물이 저 건물에 자란다면 어떤 모습일까요?',
    askOther: 'B님은 A님이 말한 건물의 모습에 대해 어떻게 생각하시나요?',
  },
  {
    id: 'window',
    speaker: 1,
    other: 0,
    look: 'B님! 이번엔 오른쪽의 금색 건물의 창문을 바라봐 주세요. 이곳에 B님의 식물이 자란다면 어떤 풍경이 펼쳐질까요?',
    askOther: 'A님은 B님의 식물이 주변 사람들에게 어떤 영향을 끼칠거라고 생각하세요?',
  },
];

export function opinionPhrase(text) {
  let value = String(text || '').replace(/\s+/g, ' ').trim();
  value = value.replace(/[.!?…]+$/g, '').trim();
  value = value.replace(/(싶어요|싶습니다|같아요|것 같아요|거예요|는데요|해요|예요|이에요|니다|요)$/g, '').trim();
  if (!value) return '';
  const chars = Array.from(value);
  if (chars.length > 16) return `${chars.slice(0, 15).join('')}…`;
  return value;
}

const SUMMARY_FRAME = 'A님과 B님의 의견을 모아봤어요.';

function wantFits(text) {
  const value = String(text || '');
  return ![...value.matchAll(/싶/g)].some((hit) => {
    const before = value.slice(0, hit.index).replace(/\s+$/, '');
    return !/[고아어]/.test(before[before.length - 1] || '');
  });
}

const SUMMARY_STOP = new Set(['식물', '자리', '거리', '서울', '의견', '사람', '우리', '거기', '이곳', '여기', '님은']);

function personWants(lines) {
  return (lines || []).some((line) => /싶/.test(line));
}

function summarySides(line) {
  const body = String(line || '').replace(SUMMARY_FRAME, '').trim();
  const match = body.match(/A님은\s*([\s\S]*?)\s*B님은\s*([\s\S]*)/);
  if (!match) return null;
  return { a: match[1].trim(), b: match[2].trim() };
}

function mentionsSource(clause, lines) {
  const compact = String(clause || '').replace(/\s+/g, '');
  const tokens = String((lines || []).join(' ')).match(/[가-힣]{2,}/g) || [];
  return tokens.some((token) => !SUMMARY_STOP.has(token) && compact.includes(token));
}

function endingFitsPerson(clause, lines) {
  if (!clause || !wantFits(clause)) return false;
  if (/싶/.test(clause) && !personWants(lines)) return false;
  return true;
}

function reportClause(lines) {
  const list = (lines || []).map((line) => String(line || '').trim()).filter(Boolean);
  let value = (list.at(-1) || '').replace(/\s+/g, ' ').replace(/[.!?…]+$/g, '').trim();
  if (!value) return '의견을 남겨 주셨군요';
  value = value.replace(/싶어요$/, '싶으시군요').replace(/싶습니다$/, '싶으시군요');
  if (personWants(list) && /(고|아|어)$/.test(value)) {
    const next = `${value} 싶으시군요`;
    if (wantFits(next)) return next;
  }
  if (/(요|다|군요)$/.test(value) && wantFits(value)) return value;
  return `${value}라고 말씀하셨군요`;
}

export function summaryLine(aLines, bLines) {
  const a = reportClause(Array.isArray(aLines) ? aLines : [aLines]);
  const b = reportClause(Array.isArray(bLines) ? bLines : [bLines]);
  const aSentence = /[.!?…]$/.test(a) ? a : `${a}.`;
  const bSentence = /[.!?…]$/.test(b) ? b : `${b}.`;
  return `${SUMMARY_FRAME} A님은 ${aSentence} B님은 ${bSentence}`;
}

export function remarksFromMarks(marks, cam) {
  return (marks || [])
    .filter((mark) => mark.cam === cam)
    .flatMap((mark) => (mark.lines || []).map((line) => (typeof line === 'string' ? line : line?.text || '')))
    .map((text) => text.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

export function echoFallback(text) {
  const phrase = opinionPhrase(text);
  if (!phrase) return '그 장면이 거리에 피어난다니, 너무 좋아요!';
  return `${phrase}라니, 너무 좋아요!`;
}

function withoutQuestion(line) {
  const bits = String(line || '')
    .split(/(?<=[.!?…])/)
    .map((bit) => bit.trim())
    .filter(Boolean)
    .filter((bit) => !/[?？]/.test(bit) && !/까요/.test(bit));
  return bits.join(' ').trim();
}

async function postAgent(payload) {
  try {
    const response = await fetch('/api/discussion-agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return '';
    const data = await response.json();
    return data?.line || '';
  } catch {
    return '';
  }
}

function copiesSource(text, sources) {
  const body = String(text || '').replace(/\s+/g, '');
  return sources.some((source) => {
    const compact = String(source || '').replace(/\s+/g, '');
    return compact.length >= 12 && body.includes(compact);
  });
}

function isSpokenSummary(text, aLines, bLines) {
  const line = String(text || '').replace(/\s+/g, ' ').trim();
  if (!line.startsWith(SUMMARY_FRAME)) return false;
  const parts = summarySides(line);
  if (!parts) return false;
  if (copiesSource(line, [...aLines, ...bLines])) return false;
  if (!endingFitsPerson(parts.a, aLines) || !endingFitsPerson(parts.b, bLines)) return false;
  if (!mentionsSource(parts.a, aLines) || !mentionsSource(parts.b, bLines)) return false;
  const len = Array.from(line).length;
  return len >= 30 && len <= 220;
}

export async function fetchSummaryLine(marks) {
  const aLines = remarksFromMarks(marks, 'A');
  const bLines = remarksFromMarks(marks, 'B');
  const history = [
    { role: 'user', text: `A가 실제로 단 의견:\n${aLines.join('\n') || '없음'}` },
    { role: 'user', text: `B가 실제로 단 의견:\n${bLines.join('\n') || '없음'}` },
  ];
  const first = String(await postAgent({ beat: 'flow1-summary', history }) || '').replace(/\s+/g, ' ').trim();
  if (isSpokenSummary(first, aLines, bLines)) return first;
  const second = String(await postAgent({
    beat: 'flow1-summary',
    history: [
      ...history,
      ...(first ? [{ role: 'assistant', text: first }] : []),
      { role: 'user', text: '방금 문장은 버리세요. 두 사람이 실제로 단 의견만 요약하세요. 말하지 않은 내용은 만들지 마세요. 모습을 말한 내용에 싶다를 붙이지 마세요.' },
    ],
  }) || '').replace(/\s+/g, ' ').trim();
  if (isSpokenSummary(second, aLines, bLines)) return second;
  return summaryLine(aLines, bLines);
}

function acceptKeyword(line, answer) {
  const word = String(line || '').replace(/[.?!,…"'「」\s]/g, '').trim();
  if (!word || Array.from(word).length > 8) return '';
  const blob = String(answer || '').replace(/\s+/g, '');
  return blob.includes(word) ? word : '';
}

export async function fetchReplyKeyword(answer, question, followUp) {
  const history = [
    { role: 'assistant', text: question || '' },
    { role: 'user', text: answer },
  ];
  const first = acceptKeyword(await postAgent({ beat: 'reply-keyword', followUp, history }), answer);
  if (first) return first;
  return acceptKeyword(await postAgent({
    beat: 'reply-keyword',
    followUp,
    history: [
      ...history,
      { role: 'user', text: '방금 단어는 버리세요. 사용자가 답글에 실제로 쓴 단어 하나만 다시 고르세요.' },
    ],
  }), answer);
}

export async function fetchEchoLine(text, history) {
  const line = withoutQuestion(await postAgent({
    beat: 'flow1-echo',
    history: history || [],
  }));
  return line || echoFallback(text);
}
