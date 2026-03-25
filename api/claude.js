const Anthropic = require('@anthropic-ai/sdk');

// Module-level client — reused across warm invocations (P2)
const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

const ALLOWED_ORIGINS = [
  'https://ne-pisirsem.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:5500'
];

function isOriginAllowed(req) {
  const origin = req.headers['origin'] || req.headers['referer'] || '';
  return ALLOWED_ORIGINS.some(o => origin.startsWith(o));
}

// Strip obvious prompt injection patterns from user-supplied text
const INJECTION_RE = /ignore\s+(all\s+)?previous|system\s+prompt|forget\s+(all\s+)?|act\s+as|you\s+are\s+now|new\s+role|instead\s+of|<\s*\/?\s*(system|instruction)/gi;
function sanitizeContent(text) {
  if (typeof text !== 'string') return '';
  return text.replace(INJECTION_RE, '').slice(0, 2000);
}

// Per-IP rate limit — best-effort in serverless (resets on cold start) (S1)
const ipRequests = new Map();
function checkRateLimit(ip) {
  const now = Date.now();
  const WINDOW = 60_000;
  const MAX = 10;
  const entry = ipRequests.get(ip);
  if (!entry || now - entry.start > WINDOW) {
    ipRequests.set(ip, { start: now, count: 1 });
    return true;
  }
  if (entry.count >= MAX) return false;
  entry.count++;
  return true;
}

const SISTEM_PROMPTU = {
  tr: `Yemek asistanısın. Türk ve dünya mutfağından özgün tarifler öner. 2-3 tarif ver.

SADECE bu JSON'u döndür, başka hiçbir şey yazma:
{"tarifler":[{"ad":"","aciklama":"2 cümle.","sure":"","zorluk":"","kisi":0,"malzemeler":["ölçülü"],"adimlar":["adım"],"tat_profili":{"aci":0,"eksi":0,"tuzlu":0,"tatli":0,"umami":0,"bitter":0},"pexels_arama":"english"}]}

Kurallar: puanlar 0-10 tam sayı · pexels_arama İngilizce · malzemeleri ölçülü yaz · markdown ekleme`,

  en: `You are a recipe assistant. Suggest 2-3 original recipes from Turkish and world cuisines. Write ALL content in English.

Return ONLY this JSON, nothing else:
{"tarifler":[{"ad":"","aciklama":"2 sentences.","sure":"e.g. 30 minutes","zorluk":"Easy/Medium/Hard","kisi":0,"malzemeler":["measured"],"adimlar":["step"],"tat_profili":{"aci":0,"eksi":0,"tuzlu":0,"tatli":0,"umami":0,"bitter":0},"pexels_arama":"english"}]}

Rules: scores 0-10 integers · pexels_arama in English · write measured ingredients · no markdown`
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Origin validation
  if (!isOriginAllowed(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Rate limiting (S1)
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
  }

  // Input validation (S2)
  const { messages, dil = 'tr' } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Invalid request format.' });
  }
  if (messages.length > 20) {
    return res.status(400).json({ error: 'Conversation history too long.' });
  }
  const totalLen = messages.reduce((sum, m) => sum + (typeof m.content === 'string' ? m.content.length : 0), 0);
  if (totalLen > 50_000) {
    return res.status(400).json({ error: 'Request content too long.' });
  }

  // Sanitize user message content against prompt injection
  const sanitizedMessages = messages.map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: sanitizeContent(m.content)
  }));

  const sistemPrompt = SISTEM_PROMPTU[dil] || SISTEM_PROMPTU.tr;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1600,
      system: sistemPrompt,
      messages: sanitizedMessages
    });

    return res.status(200).json({ content: response.content[0].text });
  } catch (hata) {
    return res.status(500).json({ error: 'API error: ' + hata.message });
  }
};
