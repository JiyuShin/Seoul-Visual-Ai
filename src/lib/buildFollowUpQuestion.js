const PLANT_KEYWORDS = ['나무', '화분', '식물', '꽃', '덩굴', '잔디', '정원', '숲', '가로수'];
const SENSE_KEYWORDS = ['향', '냄새', '물소리', '그늘', '시원', '색', '푸른'];
const USE_KEYWORDS = ['앉', '쉬', '먹', '산책', '놀이', '모임', '벤치'];

function includesAny(text, keywords) {
  return keywords.some((word) => text.includes(word));
}

const GENERIC_QUESTIONS = [
  '어떤 식물을, 어느 계절에 가장 잘 어울린다고 상상하시나요?',
  '그 식물이 자라면 이곳의 분위기가 어떻게 달라질까요? 구체적으로 들려주세요.',
  '누가 이 공간을 가장 많이 쓰게 될까요? 그 사람들에게 어떤 경험을 주고 싶으신가요?',
  '색, 향, 질감 중 하나를 고른다면 무엇을 가장 강조하고 싶으신가요?',
  '10년 뒤 이곳을 지나는 사람이 어떤 한마디를 하면 좋겠나요?',
];

const PLANT_QUESTIONS = [
  '어떤 종류의 식물을 심고 싶으신가요? 키, 잎 모양, 꽃 유무까지 상상해 주세요.',
  '그 식물이 자라면 그늘은 얼마나 드리워질까요? 하루 중 언제가 가장 시원할까요?',
];

const SENSE_QUESTIONS = [
  '그 향이나 소리는 언제 가장 잘 느껴졌으면 하나요? 아침, 저녁, 비 오는 날처럼요.',
  '그 감각이 주변 사람들에게 어떤 기분을 전해줄 것 같나요?',
];

const USE_QUESTIONS = [
  '사람들이 이곳에서 구체적으로 무엇을 하길 바라시나요?',
  '앉거나 머무는 방식까지 포함해, 공간 사용 장면을 조금 더 그려주실 수 있을까요?',
];

export function buildFollowUpQuestion(opinion, visionLabel = '') {
  const text = `${opinion} ${visionLabel}`.trim();
  let pool = [...GENERIC_QUESTIONS];

  if (includesAny(text, PLANT_KEYWORDS)) {
    pool = [...PLANT_QUESTIONS, ...pool];
  }
  if (includesAny(text, SENSE_KEYWORDS)) {
    pool = [...SENSE_QUESTIONS, ...pool];
  }
  if (includesAny(text, USE_KEYWORDS)) {
    pool = [...USE_QUESTIONS, ...pool];
  }

  const seed = text.length + (text.charCodeAt(0) || 0);
  const question = pool[seed % pool.length];

  return `「${opinion.slice(0, 48)}${opinion.length > 48 ? '…' : ''}」에 대해 조금 더 상상해 볼게요. ${question}`;
}
