import { buildFollowUpQuestion } from '../../src/lib/buildFollowUpQuestion';

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
        body: JSON.stringify({
          model,
          temperature: 0.9,
          max_tokens: 180,
          messages: [
            {
              role: 'system',
              content:
                'You are a warm facilitator for a Seoul urban greening exhibition. The user placed an opinion on a street image. Ask exactly ONE follow-up question in Korean (1-2 sentences) that helps them imagine more diversely and make their idea more concrete. Focus on plants, sensory experience, who uses the space, or seasonal change. Do not repeat their opinion verbatim.',
            },
            {
              role: 'user',
              content: `Selected vision theme: ${visionLabel || '푸른 서울'}\nUser opinion: ${trimmedOpinion}`,
            },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const question = data?.choices?.[0]?.message?.content?.trim();
        if (question) {
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
