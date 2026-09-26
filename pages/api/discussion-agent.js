import { buildFollowUpQuestion } from '../../src/f2/buildFollowUpQuestion';

const recentAskLines = [];

function rememberAskLine(line) {
  const text = String(line || '').trim();
  if (!text) return;
  recentAskLines.push(text);
  if (recentAskLines.length > 8) recentAskLines.shift();
}

function fallbackLine({ beat, speakerLabel, districtName, history }) {
  const place = districtName || '이 거리';
  const lastUser = [...(history || [])].reverse().find((line) => line.role === 'user');

  if (beat === 'open') {
    return `${place}입니다. ${speakerLabel}님, 식물을 심고 싶은 곳을 3초간 바라봐 주세요.`;
  }
  if (beat === 'close') {
    return `${speakerLabel}님의 이야기는 여기까지입니다. 남겨 둔 자리와 답은 그 자리에 둡니다.`;
  }
  if (lastUser?.text) {
    return buildFollowUpQuestion(lastUser.text, place);
  }
  return '그 자리에 어떤 식물이 있으면 좋을지, 조금 더 구체적으로 들려주세요.';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { beat, followUp, speakerLabel, districtName, visionLabel, history } = req.body || {};
  const safeHistory = Array.isArray(history) ? history.slice(-8) : [];
  const local = fallbackLine({
    beat,
    speakerLabel: speakerLabel || '참가자',
    districtName,
    history: safeHistory,
  });

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';

  if (!apiKey) {
    return res.status(200).json({ line: local, source: 'local' });
  }

  const lastUser = [...safeHistory].reverse().find((line) => line.role === 'user');
  const askedBefore = safeHistory
    .filter((line) => line.role === 'assistant')
    .map((line) => line.text)
    .filter(Boolean);
  const laterAsk = Number(followUp) > 1;
  const questionDirection = laterAsk
    ? '이번은 두 번째 이후 추가 질문이다. 둘째 문장은 그 사람이 상상한 식물이 그 거리와 서울을 어떻게 바꾸는지에 대한 질문 하나다. 빛, 그늘, 공기, 향, 소리, 더위, 거리의 풍경, 그 길이 덜 삭막해지는 방식 중에서, 방금 그 말이 가리키는 변화 하나만 짚어 묻는다. 사람을 주어로 두지 않는다. 사람들이 거기서 무엇을 할지, 어떤 활동을 할지, 무슨 이야기를 나눌지, 누가 머물지는 묻지 않는다. 거리를 어떻게 바꿀 것 같나요, 서울이 어떻게 나아질 것 같나요처럼 누구에게나 붙는 문장으로 묻지 않는다. 질감, 색감, 형태는 다시 묻지 않는다. 다른 사람에게 이미 한 질문과 같은 장면이면 다른 변화를 묻는다.'
    : '이번은 첫 추가 질문이다. 둘째 문장은 그 사람이 떠올린 식물의 형태, 질감, 색감처럼 모습에 대한 질문 하나다. 잎의 결, 표면, 빛에 따른 색, 실루엣처럼 아직 안 나온 쪽을 하나 골라 묻는다. 사람이 다르면 고르는 쪽도 달라야 한다. 거리의 변화나 서울의 변화는 아직 묻지 않는다. 사람들이 거기서 무엇을 할지도 묻지 않는다.';
  const task = {
    open: `${speakerLabel || '참가자'}에게 ${districtName || '이 거리'}를 짧게 소개하고, 식물을 심고 싶은 곳을 3초간 바라봐 달라고 안내한다. 질문은 하지 않는다.`,
    ask: [
      '출력은 두 문장만 한다. 전시 안내 문장이 아니라, 옆에서 듣고 받는 말투로 말한다.',
      '첫 문장은 방금 그 말에만 닿는 짧은 호응이다. 들은 장면의 감각이나 분위기에 반응하고, 누구에게나 붙일 수 있는 칭찬으로 시작하지 않는다. 좋은 의견이에요, 좋은 생각이에요, 마음에 들어요, 그 장면이 그려져요처럼 이미 쓴 틀은 다시 쓰지 않는다. 문장 모양도 매번 바꾼다. 사용자가 한 말을 따옴표로 반복하거나 그대로 인용하지 않는다. 조금 더 상상해 볼게요 같은 문장은 쓰지 않는다.',
      questionDirection,
      lastUser?.text ? `이번 사용자의 말: "${lastUser.text}"` : '이번 사용자의 말이 없으면 그 자리에 어떤 식물이 있으면 좋을지 짧게 호응하고 묻는다.',
      askedBefore.length ? `이 사람에게 이미 한 말: ${askedBefore.join(' / ')}` : '이 사람에게 아직 한 말은 없다.',
      recentAskLines.length
        ? `다른 사람에게 이미 한 호응이니 첫 문장이 이와 겹치면 안 된다: ${recentAskLines.join(' / ')}`
        : '아직 다른 사람에게 한 호응은 없다.',
    ].join(' '),
    close: `${speakerLabel || '참가자'}의 대화 턴이 끝났다고 짧게 안내한다. 남겨 둔 자리는 그대로 둔다고 말한다. 새 질문은 하지 않는다.`,
  }[beat] || '한국어로 한 문장만 말한다.';

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: beat === 'ask' ? 1 : 0.8,
        max_tokens: 180,
        messages: [
          {
            role: 'system',
            content:
              '너는 삭막한 서울 거리에 식물을 심어 보는 전시의 진행자다. 항상 한국어로, 따뜻하고 짧게, 사람 말하듯 말한다. 설명 목록은 쓰지 않는다. 의견을 들은 뒤에는 그 말을 인용하지 말고, 그 장면에만 맞는 호응을 한 뒤 질문 하나를 한다. 첫 추가 질문은 그 식물의 형태, 질감, 색감을 다채롭게 묻는다. 두 번째부터는 그 식물이 거리와 서울을 어떻게 바꾸는지만 묻는다. 사람의 활동, 대화, 머무름은 묻지 않는다. 호응은 매번 다르게 말하고, 같은 칭찬을 다음 사람에게 반복하지 않는다.',
          },
          {
            role: 'user',
            content: [
              `할 일: ${task}`,
              `주제: ${visionLabel || '푸른 서울'}`,
              `장소: ${districtName || '서울 거리'}`,
              `지금까지의 대화: ${safeHistory.map((line) => `${line.role}: ${line.text}`).join('\n') || '없음'}`,
            ].join('\n'),
          },
        ],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const line = data?.choices?.[0]?.message?.content?.trim();
      if (line) {
        if (beat === 'ask') rememberAskLine(line);
        return res.status(200).json({ line, source: 'openai', model });
      }
    }
  } catch (error) {
    console.error('[discussion-agent]', error?.message || error);
  }

  return res.status(200).json({ line: local, source: 'local' });
}
