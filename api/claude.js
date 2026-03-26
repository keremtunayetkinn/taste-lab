const Anthropic = require('@anthropic-ai/sdk');
const crypto = require('crypto');
const { Redis } = require('@upstash/redis');

// Module-level client — reused across warm invocations (P2)
const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

// Lazy-initialized Redis client for response caching (reuses same env vars as rate limiter)
let _redis = undefined;
function getRedis() {
  if (_redis === undefined) {
    _redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
      ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
      : null;
  }
  return _redis;
}

// Cache key: SHA-256 of "dil:sanitized_content" — v1 prefix allows invalidation on schema changes
function makeCacheKey(dil, content) {
  const hash = crypto.createHash('sha256').update(`${dil}:${content}`).digest('hex').slice(0, 32);
  return `recipe:v1:${hash}`;
}

const ALLOWED_ORIGINS = [
  'https://taste-lab-kerem-tuna-s-projects.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:5500'
];

function isOriginAllowed(req) {
  const origin = req.headers['origin'] || req.headers['referer'] || '';
  return ALLOWED_ORIGINS.some(o => origin.startsWith(o));
}

// Strip prompt injection patterns and restrict to safe characters
const INJECTION_RE = /ignore|system\s*prompt|previous\s*instructions?|forget|act\s+as|you\s+are|new\s+role|instead\s+of|disregard|override|<\/?(?:system|instruction)/gi;
const ALLOWED_CHARS_RE = /[^a-zA-ZçÇğĞıİöÖşŞüÜ0-9,\s]/g;
function sanitizeContent(text) {
  if (typeof text !== 'string') return '';
  const clean = text.replace(INJECTION_RE, '').replace(ALLOWED_CHARS_RE, '').slice(0, 500);
  if (clean !== text.slice(0, 500)) {
    console.warn('[Security] Input sanitized — injection pattern or disallowed chars removed');
  }
  return clean;
}

const { getClaudeLimiter } = require('./lib/ratelimit');

// Fetch a Pexels photo URL server-side so pexels_arama never leaves the server
async function fetchPexelsPhoto(searchQuery) {
  if (!process.env.PEXELS_API_KEY || !searchQuery) return null;
  try {
    const r = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchQuery)}&per_page=1&orientation=landscape`,
      { headers: { Authorization: process.env.PEXELS_API_KEY } }
    );
    if (!r.ok) return null;
    const data = await r.json();
    const url = data.photos?.[0]?.src?.large || data.photos?.[0]?.src?.medium || null;
    return url && url.startsWith('https://images.pexels.com/') ? url : null;
  } catch {
    return null;
  }
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

  // Origin + CSRF header validation
  if (!isOriginAllowed(req) || req.headers['x-requested-with'] !== 'XMLHttpRequest') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Rate limiting — Upstash sliding window (falls back to in-memory if not configured)
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  const { success } = await getClaudeLimiter().limit(ip);
  if (!success) {
    return res.status(429).json({ error: 'Çok fazla istek gönderdiniz. Lütfen bir dakika bekleyin.' });
  }

  // Input validation (S2)
  const { messages } = req.body;
  const dil = ['tr', 'en'].includes(req.body.dil) ? req.body.dil : 'tr';
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

  // Cache lookup — key is derived from sanitized content so injection-stripped inputs share entries
  const cacheContent = sanitizedMessages.map(m => m.content).join('\n');
  const cacheKey = makeCacheKey(dil, cacheContent);
  const redis = getRedis();
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return res.status(200).json({ tarifler: cached });
    } catch { /* cache miss on error — fall through to Claude */ }
  }

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1600,
      system: sistemPrompt,
      messages: sanitizedMessages
    });

    // Parse Claude's JSON server-side
    const rawText = response.content[0].text;
    const clean = rawText.replace(/```json|```/g, '').trim();
    let parsed;
    try { parsed = JSON.parse(clean); } catch {
      return res.status(502).json({ error: 'AI yanıtı ayrıştırılamadı.' });
    }

    // Fetch photos in parallel and strip pexels_arama before returning to client
    if (Array.isArray(parsed.tarifler)) {
      const fotos = await Promise.all(
        parsed.tarifler.map(t => fetchPexelsPhoto(t.pexels_arama))
      );
      parsed.tarifler.forEach((tarif, i) => {
        tarif.foto = fotos[i] || null;
        delete tarif.pexels_arama;
      });
    }

    // Store complete response in cache (2-hour TTL) — photos included, pexels_arama already stripped
    if (redis) {
      try { await redis.set(cacheKey, parsed.tarifler, { ex: 7200 }); } catch { /* ignore */ }
    }

    return res.status(200).json({ tarifler: parsed.tarifler });
  } catch (hata) {
    console.error('[API] Claude error:', hata);
    return res.status(500).json({ error: 'API hatası. Lütfen tekrar deneyin.' });
  }
};
