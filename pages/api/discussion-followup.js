import { buildFollowUpQuestion } from '../../src/f2/buildFollowUpQuestion';

function chatPayload(model, messages, temperature) {
  if (/^gpt-5(?!-chat)/.test(model)) {
    return {
      model,
      messages,
      max_completion_tokens: 800,
      reasoning_effort: 'low',
    };
  }
  return {
    model,
    messages,
    temperature,
    max_tokens: 180,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { opinion, visionLabel } = req.body || {};
  if (!opinion || typeof opinion !== 'string') {
    return res.status(400).json({ error: 'opinion is required' });
  }

  const trimmedOpinion = opinion.trim();
  if (!trimmedOpinion) {
    return res.status(400).json({ error: 'opinion is required' });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model =
    process.env.OPENAI_MODEL?.trim() ||
    process.env.OPENAI_MODEL_FAST?.trim() ||
    'gpt-4o-mini';

  if (apiKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chatPayload(model, [
            {
              role: 'system',
              content:
                '너는 서울 거리에 식물을 심어 보는 전시의 진행자다. 사용자가 거리 이미지에 남긴 의견에 한국어로 추가 질문 하나만 한다. 한두 문장이고, 식물의 모습이나 감각, 계절의 변화처럼 상상을 더 구체화한다. 의견을 그대로 반복하지 않는다. 알파벳으로 적힌 영어 단어는 쓰지 않는다. beneath, texture, green 같은 영문은 금지다. 외래어는 콘크리트, 실루엣처럼 한글로만 적는다.',
            },
            {
              role: 'user',
              content: `주제: ${visionLabel || '푸른 서울'}\n사용자 의견: ${trimmedOpinion}`,
            },
          ], 0.9)),
      });

      if (response.ok) {
        const data = await response.json();
        const question = data?.choices?.[0]?.message?.content?.trim();
        const latin = String(question || '').match(/[A-Za-z]+/g) || [];
        const hasEnglishWord = latin.some((word) => !/^[ABab]$/.test(word));
        if (question && !hasEnglishWord) {
          return res.status(200).json({ question, source: 'openai', model });
        }
      } else {
        const errBody = await response.text();
        console.error('[discussion-followup] OpenAI error:', response.status, errBody.slice(0, 200));
      }
    } catch (err) {
      console.error('[discussion-followup] OpenAI request failed:', err?.message || err);
    }
  } else {
    console.warn('[discussion-followup] OPENAI_API_KEY not set — using local questions');
  }

  return res.status(200).json({
    question: buildFollowUpQuestion(trimmedOpinion, visionLabel || ''),
    source: 'local',
    ...(process.env.NODE_ENV === 'development' && {
      debug: { openaiConfigured: Boolean(apiKey) },
    }),
  });
}
