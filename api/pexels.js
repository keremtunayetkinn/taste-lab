const ALLOWED_ORIGINS = [
  'https://taste-lab-kerem-tuna-s-projects.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:5500'
];

function isOriginAllowed(req) {
  const origin = req.headers['origin'] || req.headers['referer'] || '';
  return ALLOWED_ORIGINS.some(o => origin.startsWith(o));
}

const { getPexelsLimiter } = require('./lib/ratelimit');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!isOriginAllowed(req) || req.headers['x-requested-with'] !== 'XMLHttpRequest') {
    return res.status(403).json({ url: null });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  const { success } = await getPexelsLimiter().limit(ip);
  if (!success) {
    return res.status(429).json({ url: null });
  }

  // Input validation (S3)
  const { arama } = req.body;
  if (typeof arama !== 'string' || !arama.trim()) {
    return res.status(400).json({ url: null });
  }
  const aramaTemiz = arama.trim().slice(0, 100);

  try {
    const yanit = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(aramaTemiz)}&per_page=1&orientation=landscape`,
      { headers: { Authorization: process.env.PEXELS_API_KEY } }
    );

    const veri = await yanit.json();
    let url = veri.photos?.[0]?.src?.large || veri.photos?.[0]?.src?.medium || null;

    if (!url) {
      // Randomized fallback — different photo each time (K4)
      const randomPage = Math.floor(Math.random() * 15) + 1;
      const fallback = await fetch(
        `https://api.pexels.com/v1/search?query=food&per_page=1&page=${randomPage}&orientation=landscape`,
        { headers: { Authorization: process.env.PEXELS_API_KEY } }
      );
      const fd = await fallback.json();
      url = fd.photos?.[0]?.src?.large || null;
    }

    // Validate URL is actually from Pexels before returning to client
    if (url && !url.startsWith('https://images.pexels.com/')) url = null;

    return res.status(200).json({ url });
  } catch (hata) {
    return res.status(500).json({ error: 'Fotoğraf alınamadı' });
  }
};
