import { buildFollowUpQuestion } from '../../src/f2/buildFollowUpQuestion';

const recentAskLines = [];

function rememberAskLine(line) {
  const text = String(line || '').trim();
  if (!text) return;
  recentAskLines.push(text);
  if (recentAskLines.length > 8) recentAskLines.shift();
}

const KOREAN_SPEECH =
  '알파벳으로 적힌 영어 단어는 쓰지 않는다. beneath, texture, green 같은 영문은 금지다. 외래어는 콘크리트, 실루엣처럼 한글로만 적는다. 참가자를 가리키는 A, B 한 글자만 예외다.';

function hasEnglishWord(text) {
  const words = String(text || '').match(/[A-Za-z]+/g) || [];
  return words.some((word) => !/^[ABab]$/.test(word));
}

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

function fallbackLine({ beat, speakerLabel, districtName, history }) {
  const place = districtName || '이 거리';
  const lastUser = [...(history || [])].reverse().find((line) => line.role === 'user');

  if (beat === 'open') {
    return `${place}입니다. ${speakerLabel}님, 식물을 심고 싶은 곳을 3초간 바라봐 주세요.`;
  }
  if (beat === 'close') {
    return `${speakerLabel}님의 이야기는 여기까지입니다. 남겨 둔 자리와 답은 그 자리에 둡니다.`;
  }
  if (beat === 'flow1-summary' || beat === 'reply-keyword') return '';
  if (beat === 'flow1-echo') {
    const heard = lastUser?.text ? opinionEcho(lastUser.text) : '';
    return heard || '그 장면이 거리에 피어난다니, 너무 좋아요!';
  }
  if (lastUser?.text) {
    return buildFollowUpQuestion(lastUser.text, place);
  }
  return '그 자리에 어떤 식물이 있으면 좋을지, 조금 더 구체적으로 들려주세요.';
}

function opinionEcho(text) {
  const value = String(text || '').replace(/\s+/g, ' ').replace(/[.!?…]+$/g, '').trim();
  if (!value) return '';
  const chars = Array.from(value);
  const short = chars.length > 18 ? `${chars.slice(0, 16).join('')}` : value;
  return `${short}라니, 너무 좋아요!`;
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
    'flow1-summary': 'A와 B가 실제로 단 의견만 읽고 각각 한 줄로 요약해 이 문장만 말한다. A님과 B님의 의견을 모아봤어요. A님은 (A가 실제로 말한 내용의 요약) B님은 (B가 실제로 말한 내용의 요약) 말하지 않은 식물, 행동, 감정은 만들지 않는다. 원문을 그대로 이어 붙이지 않는다. 각 끝은 그 사람이 한 말의 내용에 맞춘다. 색, 모양, 질감처럼 모습을 말했으면 서술로 끝낸다. 심거나 피우고 싶다고 말한 경우에만 싶다를 쓴다. 모습 예: A님은 보슬보슬한 연두 잎을 떠올리셨고 B님은 동그란 노란 꽃을 떠올리셨군요. 소원 예: A님은 무궁화 같은 꽃들을 유기적인 형태로 심고 싶고 B님은 개나리를 피우고 싶으시군요. 틀린 예: A님은 쾌적한 거리 싶고. 막대 문자, 따옴표, 설명, 줄바꿈은 넣지 않는다.',
    'reply-keyword': Number(followUp) > 1
      ? '사용자가 방금 단 답글에서 대표 단어 하나만 고른다. 방금 질문이 거리와 서울에 미치는 영향, 지나가는 사람의 생각, 앞으로의 성장 중 무엇을 물었는지 보고, 그 질문과 가장 관련된 단어 하나를 답글 안에서만 고른다. 형용사, 부사, 명사를 구분하고 질문의 핵심을 가장 잘 담은 하나를 고른다. 색이나 질감 단어는 그 질문이 모습을 물은 것이 아니면 고르지 않는다. 답글에 없는 단어는 만들지 않는다. 출력은 그 단어 하나뿐이다.'
      : '사용자가 방금 단 답글에서 대표 단어 하나만 고른다. 질문은 식물의 색, 모양, 형태, 질감이다. 그중 답글에 실제로 나온 말에서 가장 핵심인 단어 하나만 고른다. 형용사, 부사, 명사를 구분하고 모습을 가장 잘 담은 하나를 고른다. 답글에 없는 단어는 만들지 않는다. 출력은 그 단어 하나뿐이다.',
    'flow1-echo': '방금 사용자가 한 말에만 닿는 호응을 한두 문장으로 한다. 질문은 하지 않는다. 물음표와 까요는 쓰지 않는다. 말투는 "도시의 딱딱함에서 벗어나 일상 속의 공원처럼 보여진다니, 너무 좋아요!"와 "저도 방금 의견에 동의해요! 서울의 거리가 이렇게 상상만으로도 푸릇푸릇해질 수 있다니 너무 좋은걸요?"와 같다. 예문을 그대로 복사하지 말고, 방금 말의 장면으로 다시 쓴다. 사용자를 인용하지 않는다.',
  }[beat] || '한국어로 한 문장만 말한다.';

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
            content: beat === 'flow1-summary'
              ? `너는 전시 진행자다. 항상 한국어만 쓴다. ${KOREAN_SPEECH} A와 B가 실제로 단 의견만 요약한다. 말하지 않은 내용은 만들지 않는다. 문장 끝은 그 의견의 내용에 맞춘다. 모습을 말한 내용에 싶다를 붙이지 않는다. 요청한 문장만 출력한다.`
              : beat === 'reply-keyword'
                ? `너는 답글에서 대표 단어 하나만 고른다. 항상 한국어 단어 하나만 출력한다. 답글에 없는 말은 만들지 않는다. 형용사, 부사, 명사 중에서 그 질문에 가장 맞는 하나를 고른다.`
              : beat === 'flow1-echo'
                ? `너는 삭막한 서울 거리에 식물을 심어 보는 전시의 진행자다. 항상 한국어로, 따뜻하고 짧게, 사람 말하듯 말한다. ${KOREAN_SPEECH} 질문은 하지 않는다. 방금 의견의 장면을 부드럽게 되짚고, 좋다는 반응으로 끝낸다.`
                : `너는 삭막한 서울 거리에 식물을 심어 보는 전시의 진행자다. 항상 한국어로, 따뜻하고 짧게, 사람 말하듯 말한다. ${KOREAN_SPEECH} 설명 목록은 쓰지 않는다. 의견을 들은 뒤에는 그 말을 인용하지 말고, 그 장면에만 맞는 호응을 한 뒤 질문 하나를 한다. 첫 추가 질문은 그 식물의 형태, 질감, 색감을 다채롭게 묻는다. 두 번째부터는 그 식물이 거리와 서울을 어떻게 바꾸는지만 묻는다. 사람의 활동, 대화, 머무름은 묻지 않는다. 호응은 매번 다르게 말하고, 같은 칭찬을 다음 사람에게 반복하지 않는다.`,
          },
          {
            role: 'user',
            content: [
              `할 일: ${task}`,
              `주제: ${visionLabel || '푸른 서울'}`,
              `장소: ${districtName || '서울 거리'}`,
              `지금까지의 대화: ${safeHistory.map((line) => `${line.role}: ${line.text}`).join('\n') || '없음'}`,
              KOREAN_SPEECH,
            ].join('\n'),
          },
        ], beat === 'ask' ? 1 : beat === 'flow1-echo' ? 0.9 : beat === 'flow1-summary' ? 0.3 : 0.8)),
    });

    if (response.ok) {
      const data = await response.json();
      let line = data?.choices?.[0]?.message?.content?.trim();
      if (line && hasEnglishWord(line)) {
        const retry = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(chatPayload(model, [
              {
                role: 'system',
                content: `너는 전시 진행자다. 방금 문장에 알파벳 영어가 섞였다. 뜻은 유지하고 한국어로만 다시 쓴다. ${KOREAN_SPEECH}`,
              },
              {
                role: 'user',
                content: line,
              },
            ], 0.4)),
        });
        if (retry.ok) {
          const retried = await retry.json();
          const rewritten = retried?.choices?.[0]?.message?.content?.trim();
          if (rewritten && !hasEnglishWord(rewritten)) line = rewritten;
          else line = '';
        } else {
          line = '';
        }
      }
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
