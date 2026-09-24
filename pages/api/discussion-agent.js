import { buildFollowUpQuestion } from '../../src/f2/buildFollowUpQuestion';

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

  const { beat, speakerLabel, districtName, visionLabel, history } = req.body || {};
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

  const task = {
    open: `${speakerLabel || '참가자'}에게 ${districtName || '이 거리'}를 짧게 소개하고, 식물을 심고 싶은 곳을 3초간 바라봐 달라고 안내한다. 질문은 하지 않는다.`,
    ask: '방금 사용자의 말에 이어 한국어로 추가 질문 하나만 한다. 식물, 감각, 누가 쓰는지, 계절 중 하나로 더 구체적으로 상상하게 한다.',
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
        temperature: 0.8,
        max_tokens: 180,
        messages: [
          {
            role: 'system',
            content:
              '너는 서울 거리 녹화 전시의 진행자다. 항상 한국어로, 따뜻하고 짧게, 한 번에 한 가지만 말한다. 설명 목록은 쓰지 않는다.',
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
      if (line) return res.status(200).json({ line, source: 'openai', model });
    }
  } catch (error) {
    console.error('[discussion-agent]', error?.message || error);
  }

  return res.status(200).json({ line: local, source: 'local' });
}
