import crypto from 'crypto';

export const config = {
  api: {
    bodyParser: false,
  },
};

const LINE_REPLY_URL = 'https://api.line.me/v2/bot/message/reply';

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function verifyLineSignature(rawBody, signature, channelSecret) {
  if (!signature || !channelSecret) return false;

  const expected = crypto
    .createHmac('sha256', channelSecret)
    .update(rawBody)
    .digest('base64');

  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));

  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function translateText(text) {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing');

  // 先沿用目前已可用的模型，LINE Bot 穩定後只要改環境變數即可切換模型，
  // 不必再修改這支程式。
  const model = String(process.env.OPENAI_TRANSLATION_MODEL || 'gpt-5.6-luna').trim();

  const hasChinese = /[\u3400-\u9FFF]/.test(text);

  const instructions = hasChinese
    ? [
        'You are a translation engine only.',
        'Translate the user text from Traditional/Simplified Chinese into natural Indonesian suitable for everyday household communication.',
        'Preserve personal names, numbers, dates, times, punctuation, line breaks, emojis, and the original meaning.',
        'Do not answer questions, do not give advice, do not add explanations, and do not add quotation marks.',
        'Return only the Indonesian translation.'
      ].join(' ')
    : [
        'You are a translation engine only.',
        'Determine whether the user text is Indonesian.',
        'If it is Indonesian, translate it into natural Traditional Chinese as used in Taiwan.',
        'Preserve personal names, numbers, dates, times, punctuation, line breaks, emojis, and the original meaning.',
        'Do not answer questions, do not give advice, do not add explanations, and do not add quotation marks.',
        'If the text is mainly English or another non-Indonesian language, or is only a name/symbols/numbers, return exactly __IGNORE__.',
        'Otherwise return only the Traditional Chinese translation.'
      ].join(' ');

  const startedAt = Date.now();

  let response;
  let data;

  for (let attempt = 1; attempt <= 2; attempt++) {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        instructions,
        input: text,
        reasoning: { effort: 'none' },
        text: { verbosity: 'low' },
        max_output_tokens: 120,
        store: false,
      }),
    });

    data = await response.json().catch(() => ({}));

    if (response.ok) break;

    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === 2) {
      throw new Error(data?.error?.message || `OpenAI request failed (${response.status})`);
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  console.log(`OpenAI translation: ${Date.now() - startedAt}ms`);

  let output = String(data?.output_text || '').trim();

  if (!output && Array.isArray(data?.output)) {
    output = data.output
      .flatMap((item) => item?.content || [])
      .filter((part) => part?.type === 'output_text')
      .map((part) => part?.text || '')
      .join('')
      .trim();
  }

  if (!output) throw new Error('OpenAI returned empty translation');
  if (output === '__IGNORE__') return null;

  return output;
}

async function replyToLine(replyToken, text, quoteToken) {
  const accessToken = String(process.env.LINE_CHANNEL_ACCESS_TOKEN || '').trim();
  if (!accessToken) throw new Error('LINE_CHANNEL_ACCESS_TOKEN is missing');

  const message = {
    type: 'text',
    text,
  };

  // 直接引用使用者的原訊息，群組裡比較不會看不懂翻譯是在回哪一句。
  if (quoteToken) {
    message.quoteToken = quoteToken;
  }

  const response = await fetch(LINE_REPLY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [message],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`LINE reply failed (${response.status}): ${detail}`);
  }
}

async function handleEvent(event) {
  const eventStartedAt = Date.now();
  const eventId = event?.webhookEventId || 'unknown';
  // 目前只服務 LINE 群組，不處理一對一聊天。
  if (event?.type !== 'message') return;
  if (event?.source?.type !== 'group') return;
  if (event?.message?.type !== 'text') return;

  // 之後取得家庭群組 ID 後，可以在 Vercel 設定 LINE_ALLOWED_GROUP_ID，
  // 這樣即使 Bot 被加到其他群組也不會提供翻譯。
  const allowedGroupId = String(process.env.LINE_ALLOWED_GROUP_ID || '').trim();
  if (allowedGroupId && event?.source?.groupId !== allowedGroupId) return;

  const text = String(event?.message?.text || '').trim();
  if (!text) return;

  const translated = await translateText(text);
  if (!translated) return;

  await replyToLine(
    event.replyToken,
    translated,
    event?.message?.quoteToken
  );

  console.log(`LINE event ${eventId}: replied in ${Date.now() - eventStartedAt}ms`);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const channelSecret = String(process.env.LINE_CHANNEL_SECRET || '').trim();
    if (!channelSecret) {
      console.error('LINE_CHANNEL_SECRET is missing');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const rawBody = await readRawBody(req);
    const signature = req.headers['x-line-signature'];

    if (!verifyLineSignature(rawBody, signature, channelSecret)) {
      console.warn('Rejected LINE webhook: invalid signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const payload = JSON.parse(rawBody.toString('utf8'));
    const events = Array.isArray(payload?.events) ? payload.events : [];

    // 同一個 webhook 可能一次帶多個 event。
    const results = await Promise.allSettled(events.map(handleEvent));

    for (const result of results) {
      if (result.status === 'rejected') {
        console.error('LINE event error:', result.reason);
      }
    }

    // LINE 只需要確認 webhook 已收到；個別翻譯失敗不讓 LINE 重送，
    // 避免群組出現重複翻譯。
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('LINE webhook error:', error);
    return res.status(200).json({ ok: false });
  }
}
