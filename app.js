'use strict';

// Load print-media font stylesheet without blocking render
(function () {
  var fl = document.getElementById('font-link');
  if (!fl) return;
  if (fl.sheet) { fl.media = 'all'; }
  else { fl.addEventListener('load', function () { fl.media = 'all'; }); }
}());

// =============================================
// SECURITY: HTML escape — prevents XSS when inserting untrusted data into innerHTML
// =============================================
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// =============================================
// TRANSLATIONS
// =============================================
const TRANSLATIONS = {
  tr: {
    heroSub: 'Elindeki malzemeleri gir, yapay zeka senin için tarif önersin.',
    btnBaslayalim: 'Hadi Başlayalım →',
    malzemelerTitle: 'Malzemeler',
    malzemeInputPlaceholder: 'Malzeme ekle (örn: domates)',
    btnEkle: 'Ekle',
    labelSure: 'Süre',
    labelButce: 'Bütçe',
    labelKisi: 'Kişi Sayısı',
    labelZorluk: 'Zorluk',
    filter15dk: '15 dk',
    filter30dk: '30 dk',
    filter1saat: '1 saat+',
    filterEkonomik: 'Ekonomik',
    filterOrta: 'Orta',
    filterKisi1: '1 Kişi',
    filterKisi2: '2 Kişi',
    filterKisi4: '4+ Kişi',
    filterKolay: 'Kolay',
    filterZor: 'Zor',
    btnTarifBul: 'Tarif Bul ✨',
    tarifOnerileri: 'Tarif Önerileri',
    btnYeniArama: '← Yeni Arama',
    gecmisTitle: 'Geçmiş Aramalar',
    gecmisTemizle: 'Temizle',
    favorilerTitle: 'Favorilerim',
    favorilerTemizle: 'Temizle',
    favoriEkle: 'Favorilere Ekle',
    favoriCikar: 'Favorilerden Çıkar',
    modalMalzemeler: 'Malzemeler',
    modalYapilis: 'Yapılış',
    modalTatHaritasi: 'Tat Haritası',
    radarLabels: ['🔴 Acı', '🟡 Ekşi', '🟠 Tuzlu', '🟢 Tatlı', '🟤 Umami', '⚪ Bitter'],
    kisiSuffix: n => `${n} kişi`,
    paylasBtnLabel: 'Paylaş',
    paylasKopyala: 'Linki Kopyala',
    kopyalandi: 'Kopyalandı! ✓',
    paylasMetni: (ad, aciklama, url) => `🍳 *${ad}*\n${aciklama}\n\nTaste-Lab → ${url}`,
    removeAriaLabel: m => `${m} malzemesini sil`,
    recipeAriaLabel: ad => `${ad} tarifini görüntüle`,
    userInfoFallback: 'Bugün ne pişirsem?',
    userInfoIngredients: m => `Elimdeki malzemeler: ${m}`,
    userInfoSure: s => `Süre: ${s}`,
    userInfoButce: b => `Bütçe: ${b}`,
    userInfoKisi: k => `Kişi sayısı: ${k}`,
    userInfoZorluk: z => `Zorluk: ${z}`,
  },
  en: {
    heroSub: 'Enter your ingredients and let AI suggest recipes for you.',
    btnBaslayalim: "Let's Get Started →",
    malzemelerTitle: 'Ingredients',
    malzemeInputPlaceholder: 'Add ingredient (e.g., tomato)',
    btnEkle: 'Add',
    labelSure: 'Time',
    labelButce: 'Budget',
    labelKisi: 'Servings',
    labelZorluk: 'Difficulty',
    filter15dk: '15 min',
    filter30dk: '30 min',
    filter1saat: '1 hour+',
    filterEkonomik: 'Budget-friendly',
    filterOrta: 'Medium',
    filterKisi1: '1 Person',
    filterKisi2: '2 People',
    filterKisi4: '4+ People',
    filterKolay: 'Easy',
    filterZor: 'Hard',
    btnTarifBul: 'Find Recipes ✨',
    tarifOnerileri: 'Recipe Suggestions',
    btnYeniArama: '← New Search',
    gecmisTitle: 'Search History',
    gecmisTemizle: 'Clear',
    favorilerTitle: 'My Favorites',
    favorilerTemizle: 'Clear',
    favoriEkle: 'Add to Favorites',
    favoriCikar: 'Remove from Favorites',
    modalMalzemeler: 'Ingredients',
    modalYapilis: 'Instructions',
    modalTatHaritasi: 'Flavor Profile',
    radarLabels: ['🔴 Spicy', '🟡 Sour', '🟠 Salty', '🟢 Sweet', '🟤 Umami', '⚪ Bitter'],
    kisiSuffix: n => `${n} ${n === 1 ? 'person' : 'people'}`,
    paylasBtnLabel: 'Share',
    paylasKopyala: 'Copy Link',
    kopyalandi: 'Copied! ✓',
    paylasMetni: (ad, aciklama, url) => `🍳 *${ad}*\n${aciklama}\n\nTaste-Lab → ${url}`,
    removeAriaLabel: m => `Remove ${m}`,
    recipeAriaLabel: ad => `View ${ad} recipe`,
    userInfoFallback: 'What should I cook today?',
    userInfoIngredients: m => `My ingredients: ${m}`,
    userInfoSure: s => `Time: ${s}`,
    userInfoButce: b => `Budget: ${b}`,
    userInfoKisi: k => `Servings: ${k}`,
    userInfoZorluk: z => `Difficulty: ${z}`,
  }
};

// =============================================
// STATE
// =============================================
const state = {
  dil: 'tr',
  malzemeler: [],
  filtreler: {
    sure: null,
    butce: null,
    kisi: '1',
    zorluk: null
  },
  tarifler: [],
  seciliTarif: null,
  fotoCache: {}
};

// Translation helper
function t(key, ...args) {
  const val = TRANSLATIONS[state.dil][key];
  return typeof val === 'function' ? val(...args) : (val ?? key);
}

// Apply all data-i18n translations to the DOM
function dilUygula() {
  const lang = TRANSLATIONS[state.dil];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const v = lang[el.dataset.i18n];
    if (v !== undefined && typeof v !== 'function') el.textContent = v;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const v = lang[el.dataset.i18nPlaceholder];
    if (v !== undefined) el.placeholder = v;
  });
  document.documentElement.lang = state.dil;
  document.title = 'Taste-Lab';
  const btnTr = document.getElementById('btn-dil-tr');
  const btnEn = document.getElementById('btn-dil-en');
  btnTr.classList.toggle('active', state.dil === 'tr');
  btnTr.setAttribute('aria-pressed', state.dil === 'tr' ? 'true' : 'false');
  btnEn.classList.toggle('active', state.dil === 'en');
  btnEn.setAttribute('aria-pressed', state.dil === 'en' ? 'true' : 'false');
  Favoriler.render();
  Gecmis.render();
}

// =============================================
// UI MODULE
// =============================================
const UI = {
  malzemeEkle(malzeme) {
    const temiz = malzeme.trim().toLowerCase();
    if (!temiz) return;
    if (state.malzemeler.includes(temiz)) return;
    state.malzemeler.push(temiz);
    this._malzemeListesiRender();
  },

  malzemeSil(index) {
    state.malzemeler.splice(index, 1);
    this._malzemeListesiRender();
  },

  _malzemeListesiRender() {
    const liste = document.getElementById('malzeme-listesi');
    liste.innerHTML = '';
    state.malzemeler.forEach((m, i) => {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = m + ' ';
      const removeBtn = document.createElement('span');
      removeBtn.className = 'remove';
      removeBtn.setAttribute('data-index', i);
      removeBtn.setAttribute('aria-label', t('removeAriaLabel', m));
      removeBtn.setAttribute('role', 'button');
      removeBtn.setAttribute('tabindex', '0');
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => this.malzemeSil(i));
      removeBtn.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.malzemeSil(i); }
      });
      tag.appendChild(removeBtn);
      liste.appendChild(tag);
    });
  },

  filtreToggle(kategori, deger) {
    if (state.filtreler[kategori] === deger && kategori !== 'kisi') {
      state.filtreler[kategori] = null;
    } else {
      state.filtreler[kategori] = deger;
    }
    this._filtreButonlariniGuncelle(kategori);
  },

  _filtreButonlariniGuncelle(kategori) {
    const grup = document.querySelector(`.filter-group[data-kategori="${kategori}"]`);
    if (!grup) return;
    grup.querySelectorAll('.filter-btn').forEach(btn => {
      const aktif = btn.dataset.deger === state.filtreler[kategori];
      btn.classList.toggle('active', aktif);
      btn.setAttribute('aria-pressed', aktif ? 'true' : 'false');
    });
  },

  gosterSection(id) {
    ['hero', 'input-panel', 'results'].forEach(s => {
      document.getElementById(s).style.display = s === id ? '' : 'none';
    });
  },

  tarifleriRender(tarifler) {
    state.tarifler = tarifler;
    const grid = document.getElementById('tarif-grid');
    grid.innerHTML = '';
    tarifler.forEach((tarif, i) => {
      const kart = document.createElement('div');
      kart.className = 'card tarif-kart';
      kart.dataset.index = i;
      kart.innerHTML = `
        <div class="tarif-kart-foto-skeleton skeleton"></div>
        <h3>${esc(tarif.ad)}</h3>
        <p>${esc(tarif.aciklama)}</p>
        <div class="tarif-kart-meta">
          <span>⏱ ${esc(tarif.sure)}</span>
          <span>🍴 ${esc(tarif.zorluk)}</span>
          <span>👥 ${t('kisiSuffix', tarif.kisi)}</span>
        </div>
        <button class="favori-kart-btn">${Favoriler.varMi(tarif.ad) ? '❤️' : '🤍'}</button>`;
      kart.setAttribute('tabindex', '0');
      kart.setAttribute('role', 'button');
      kart.setAttribute('aria-label', t('recipeAriaLabel', tarif.ad));
      kart.addEventListener('click', () => UI.detayAc(tarif));
      kart.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); UI.detayAc(tarif); }
      });
      const favBtn = kart.querySelector('.favori-kart-btn');
      favBtn.dataset.tarifad = tarif.ad;
      favBtn.setAttribute('aria-label', t(Favoriler.varMi(tarif.ad) ? 'favoriCikar' : 'favoriEkle'));
      favBtn.addEventListener('click', e => { e.stopPropagation(); Favoriler.toggle(tarif); });
      grid.appendChild(kart);

      // Prime photo cache from server-fetched URL (pexels_arama no longer on client)
      if (tarif.foto) state.fotoCache[tarif.ad] = tarif.foto;
      API.fotografCek(null, tarif.ad).then(url => {
        const skeleton = kart.querySelector('.tarif-kart-foto-skeleton');
        if (!url) { skeleton.remove(); return; }
        const img = document.createElement('img');
        img.className = 'tarif-kart-foto';
        img.src = url;
        img.alt = tarif.ad;
        skeleton.replaceWith(img);
      });
    });
  },

  detayAc(tarif) {
    state.seciliTarif = tarif;
    document.getElementById('modal-ad').textContent = tarif.ad;
    document.getElementById('modal-aciklama').textContent = tarif.aciklama;
    document.getElementById('modal-sure').textContent = '⏱ ' + tarif.sure;
    document.getElementById('modal-zorluk').textContent = '🍴 ' + tarif.zorluk;
    document.getElementById('modal-kisi').textContent = '👥 ' + t('kisiSuffix', tarif.kisi);

    const malzemeUl = document.getElementById('modal-malzeme-listesi');
    malzemeUl.innerHTML = tarif.malzemeler.map(m => `<li>${esc(m)}</li>`).join('');

    const adimOl = document.getElementById('modal-adim-listesi');
    adimOl.innerHTML = tarif.adimlar.map(a => `<li>${esc(a)}</li>`).join('');

    const foto = document.getElementById('modal-foto');
    foto.style.display = 'none';
    const cachedUrl = state.fotoCache[tarif.ad];
    if (cachedUrl) {
      foto.src = cachedUrl;
      foto.style.display = '';
    } else {
      API.fotografCek(null, tarif.ad).then(url => {
        if (url) { foto.src = url; foto.style.display = ''; }
      });
    }

    Favoriler._updateModalBtn(tarif.ad);
    _paylasGuncelle(tarif);

    document.getElementById('detail-modal').style.display = 'flex';
    document.body.style.overflow = 'hidden';

    TatHaritasi.olustur('tatChart', tarif.tat_profili);
  },

  detayKapat() {
    document.getElementById('detail-modal').style.display = 'none';
    document.body.style.overflow = '';
  },

  loadingGoster() {
    const grid = document.getElementById('tarif-grid');
    grid.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const kart = document.createElement('div');
      kart.className = 'card';
      kart.innerHTML = `
        <div class="skeleton" style="height:180px;margin-bottom:16px;border-radius:var(--radius-sm);"></div>
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text short"></div>`;
      grid.appendChild(kart);
    }
    document.getElementById('btn-tarif-ara').disabled = true;
  },

  loadingGizle() {
    document.getElementById('btn-tarif-ara').disabled = false;
  },

};

// =============================================
// API MODULE
// =============================================
const API = {
  async tarifAra(userMessage = _kullaniciBilgisiOlustur()) {
    const mesajlar = [{ role: 'user', content: userMessage }];

    const yanit = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ messages: mesajlar, dil: state.dil })
    });

    let veri;
    try { veri = await yanit.json(); } catch { throw new Error('Sunucu yanıtı ayrıştırılamadı'); }
    if (!yanit.ok) throw new Error(veri.error || 'API hatası');
    if (!Array.isArray(veri.tarifler)) throw new Error('Geçersiz tarif formatı');
    return veri;
  },

  async fotografCek(pexelsArama, tarifAd) {
    if (state.fotoCache[tarifAd]) return state.fotoCache[tarifAd];
    try {
      const yanit = await fetch('/api/pexels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ arama: pexelsArama || tarifAd })
      });
      const veri = await yanit.json();
      const url = veri.url || null;
      if (url) state.fotoCache[tarifAd] = url;
      return url;
    } catch {
      return null;
    }
  }
};

// =============================================
// TAT HARİTASI
// =============================================
const TatHaritasi = {
  _chart: null,

  olustur(canvasId, tatProfili) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (this._chart) this._chart.destroy();

    this._chart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: TRANSLATIONS[state.dil].radarLabels,
        datasets: [{
          data: [
            tatProfili.aci, tatProfili.eksi, tatProfili.tuzlu,
            tatProfili.tatli, tatProfili.umami, tatProfili.bitter
          ],
          backgroundColor: 'rgba(224, 122, 58, 0.15)',
          borderColor: '#E07A3A',
          borderWidth: 2,
          pointBackgroundColor: '#E07A3A',
          pointRadius: 4
        }]
      },
      options: {
        scales: {
          r: {
            min: 0, max: 10,
            ticks: { display: false },
            grid: { color: '#EDE5DC' },
            pointLabels: {
              font: { size: 13, family: 'DM Sans' },
              color: '#6B4C35'
            }
          }
        },
        plugins: { legend: { display: false } },
        animation: { duration: 600, easing: 'easeInOutQuart' }
      }
    });
  }
};

// =============================================
// HELPERS
// =============================================
function _kullaniciBilgisiOlustur() {
  const parcalar = [];
  if (state.malzemeler.length > 0)
    parcalar.push(t('userInfoIngredients', state.malzemeler.join(', ')));
  if (state.filtreler.sure)   parcalar.push(t('userInfoSure', state.filtreler.sure));
  if (state.filtreler.butce)  parcalar.push(t('userInfoButce', state.filtreler.butce));
  if (state.filtreler.kisi)   parcalar.push(t('userInfoKisi', state.filtreler.kisi));
  if (state.filtreler.zorluk) parcalar.push(t('userInfoZorluk', state.filtreler.zorluk));
  return parcalar.join('. ') || t('userInfoFallback');
}

function _encodeRecipe(tarif) {
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(tarif));
    let binary = '';
    bytes.forEach(b => { binary += String.fromCharCode(b); });
    return btoa(binary);
  } catch { return ''; }
}

function _decodeRecipe(str) {
  try {
    const bytes = Uint8Array.from(atob(str), c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch { return null; }
}

function _deepLinkKontrol() {
  const hash = window.location.hash;
  if (!hash.startsWith('#recipe=')) return;
  const tarif = _decodeRecipe(hash.slice('#recipe='.length));
  if (!tarif) return;
  UI.gosterSection('input-panel');
  UI.detayAc(tarif);
}

function _paylasGuncelle(tarif) {
  const container = document.getElementById('modal-paylas');
  if (!container) return;

  const siteUrl = 'https://taste-lab-kerem-tuna-s-projects.vercel.app';
  const recipeHash = _encodeRecipe(tarif);
  const shareUrl = recipeHash ? `${siteUrl}/#recipe=${recipeHash}` : siteUrl;
  const metin = t('paylasMetni', tarif.ad, tarif.aciklama, shareUrl);
  const encoded = encodeURIComponent(metin);

  container.innerHTML = `
    <h4 class="paylas-baslik">${t('paylasBtnLabel')}</h4>
    <div class="paylas-satirlar">
      <a class="paylas-btn paylas-wa" href="https://wa.me/?text=${encoded}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
      <a class="paylas-btn paylas-x" href="https://twitter.com/intent/tweet?text=${encoded}" target="_blank" rel="noopener noreferrer">𝕏 X</a>
      <button class="paylas-btn paylas-insta" id="btn-paylas-insta">Instagram</button>
      <button class="paylas-btn paylas-kopyala" id="btn-paylas-kopyala">${t('paylasKopyala')}</button>
    </div>
  `;

  async function _kopyala(btn, text) {
    try {
      await navigator.clipboard.writeText(text);
      const prev = btn.textContent;
      btn.textContent = t('kopyalandi');
      setTimeout(() => { btn.textContent = prev; }, 2000);
    } catch { /* ignore */ }
  }

  document.getElementById('btn-paylas-kopyala').addEventListener('click', function() {
    _kopyala(this, shareUrl);
  });

  document.getElementById('btn-paylas-insta').addEventListener('click', async function() {
    if (navigator.share) {
      try { await navigator.share({ title: tarif.ad, text: metin, url: shareUrl }); }
      catch { /* user cancelled */ }
    } else {
      _kopyala(this, shareUrl);
    }
  });
}

function hataGoster(mesaj) {
  const el = document.getElementById('hata-mesaji');
  el.textContent = mesaj;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// =============================================
// FAVORILER (Favorites)
// =============================================
const FAVORILER_KEY = 'nePisirsemFavoriler';

const Favoriler = {
  yukle() {
    try { return JSON.parse(localStorage.getItem(FAVORILER_KEY) || '[]'); }
    catch { return []; }
  },

  ekle(tarif) {
    if (this.varMi(tarif.ad)) return;
    const liste = this.yukle();
    liste.unshift({ id: Date.now(), tarih: new Date().toISOString(), tarif });
    localStorage.setItem(FAVORILER_KEY, JSON.stringify(liste));
    this._updateKartBtnlari(tarif.ad, true);
    this._updateModalBtn(tarif.ad);
    this.render();
  },

  sil(tarifAd) {
    const liste = this.yukle().filter(f => f.tarif.ad !== tarifAd);
    localStorage.setItem(FAVORILER_KEY, JSON.stringify(liste));
    this._updateKartBtnlari(tarifAd, false);
    this._updateModalBtn(tarifAd);
    this.render();
  },

  temizle() {
    localStorage.removeItem(FAVORILER_KEY);
    document.querySelectorAll('.favori-kart-btn').forEach(btn => {
      btn.textContent = '🤍';
      btn.setAttribute('aria-label', t('favoriEkle'));
    });
    this._updateModalBtn(state.seciliTarif?.ad);
    this.render();
  },

  varMi(tarifAd) {
    return this.yukle().some(f => f.tarif.ad === tarifAd);
  },

  toggle(tarif) {
    if (this.varMi(tarif.ad)) this.sil(tarif.ad);
    else this.ekle(tarif);
  },

  _updateKartBtnlari(tarifAd, isFavori) {
    document.querySelectorAll('.favori-kart-btn').forEach(btn => {
      if (btn.dataset.tarifad === tarifAd) {
        btn.textContent = isFavori ? '❤️' : '🤍';
        btn.setAttribute('aria-label', t(isFavori ? 'favoriCikar' : 'favoriEkle'));
      }
    });
  },

  _updateModalBtn(tarifAd) {
    const btn = document.getElementById('btn-modal-favori');
    if (!btn || !tarifAd) return;
    const isFavori = this.varMi(tarifAd);
    btn.textContent = isFavori ? `❤️ ${t('favoriCikar')}` : `🤍 ${t('favoriEkle')}`;
    btn.classList.toggle('aktif', isFavori);
  },

  render() {
    const panel = document.getElementById('favoriler-panel');
    if (!panel) return;
    const liste = this.yukle();

    if (liste.length === 0) { panel.style.display = 'none'; return; }
    panel.style.display = '';

    const header = panel.querySelector('.favoriler-header');
    header.innerHTML = `
      <span class="favoriler-header-title">${t('favorilerTitle')}</span>
      <button class="btn-geri" id="btn-favoriler-temizle">${t('favorilerTemizle')}</button>
    `;
    document.getElementById('btn-favoriler-temizle').addEventListener('click', e => {
      e.stopPropagation();
      this.temizle();
    });

    const grid = panel.querySelector('.favoriler-grid');
    grid.innerHTML = '';
    liste.forEach(item => {
      const div = document.createElement('div');
      div.className = 'card favori-kart';
      div.setAttribute('tabindex', '0');
      div.setAttribute('role', 'button');
      div.innerHTML = `
        <button class="favori-sil-btn">✕</button>
        <h4>${esc(item.tarif.ad)}</h4>
        <p>${esc(item.tarif.aciklama)}</p>
        <div class="favori-kart-meta">
          <span>⏱ ${esc(item.tarif.sure)}</span>
          <span>🍴 ${esc(item.tarif.zorluk)}</span>
          <span>👥 ${t('kisiSuffix', item.tarif.kisi)}</span>
        </div>
      `;
      const silBtn = div.querySelector('.favori-sil-btn');
      silBtn.setAttribute('aria-label', t('favoriCikar'));
      silBtn.addEventListener('click', e => { e.stopPropagation(); this.sil(item.tarif.ad); });

      const open = () => UI.detayAc(item.tarif);
      div.addEventListener('click', open);
      div.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
      grid.appendChild(div);
    });
  }
};

// =============================================
// GECMIS (History)
// =============================================
const GECMIS_KEY = 'nePisirsemGecmis';
const MAX_GECMIS = 20;

const Gecmis = {
  yukle() {
    try { return JSON.parse(localStorage.getItem(GECMIS_KEY) || '[]'); }
    catch { return []; }
  },

  kaydet(malzemeler, filtreler, tarifler) {
    const liste = this.yukle();
    liste.unshift({
      id: Date.now(),
      tarih: new Date().toISOString(),
      malzemeler: [...malzemeler],
      filtreler: { ...filtreler },
      tarifler
    });
    if (liste.length > MAX_GECMIS) liste.splice(MAX_GECMIS);
    localStorage.setItem(GECMIS_KEY, JSON.stringify(liste));
    this.render();
  },

  temizle() {
    localStorage.removeItem(GECMIS_KEY);
    this.render();
  },

  _tarihFormatla(isoStr) {
    const diff = Date.now() - new Date(isoStr).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (state.dil === 'tr') {
      if (mins < 1)   return 'Az önce';
      if (mins < 60)  return `${mins} dakika önce`;
      if (hours < 24) return `${hours} saat önce`;
      if (days < 7)   return `${days} gün önce`;
      return new Date(isoStr).toLocaleDateString('tr-TR');
    } else {
      if (mins < 1)   return 'Just now';
      if (mins < 60)  return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
      if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
      if (days < 7)   return `${days} day${days !== 1 ? 's' : ''} ago`;
      return new Date(isoStr).toLocaleDateString('en-US');
    }
  },

  render() {
    const panel = document.getElementById('gecmis-panel');
    if (!panel) return;
    const liste = this.yukle();

    if (liste.length === 0) { panel.style.display = 'none'; return; }
    panel.style.display = '';

    // Header
    const header = panel.querySelector('.gecmis-header');
    header.innerHTML = `
      <span class="gecmis-header-title">${t('gecmisTitle')}</span>
      <button class="btn-geri" id="btn-gecmis-temizle">${t('gecmisTemizle')}</button>
    `;
    document.getElementById('btn-gecmis-temizle').addEventListener('click', e => {
      e.stopPropagation();
      this.temizle();
    });

    // List
    const listeEl = panel.querySelector('.gecmis-liste');
    listeEl.innerHTML = '';
    liste.forEach(item => {
      const div = document.createElement('div');
      div.className = 'card gecmis-item';
      div.setAttribute('tabindex', '0');
      div.setAttribute('role', 'button');

      const malzemeHTML = item.malzemeler.length
        ? item.malzemeler.map(m => `<span class="tag">${esc(m)}</span>`).join('')
        : '';
      const tarifAdlari = item.tarifler.slice(0, 3).map(r => esc(r.ad)).join(', ');

      div.innerHTML = `
        <div class="gecmis-item-meta">
          <span class="gecmis-tarih">${this._tarihFormatla(item.tarih)}</span>
          <div class="gecmis-malzemeler">${malzemeHTML}</div>
        </div>
        <div class="gecmis-tarifler">${tarifAdlari}</div>
      `;

      const open = () => { UI.gosterSection('results'); UI.tarifleriRender(item.tarifler); };
      div.addEventListener('click', open);
      div.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
      listeEl.appendChild(div);
    });
  }
};

// =============================================
// EVENTS
// =============================================
const Events = {
  baslat() {
    // Hero → input panel
    document.getElementById('btn-baslayalim').addEventListener('click', () => {
      UI.gosterSection('input-panel');
    });

    // Malzeme ekle — buton
    document.getElementById('btn-malzeme-ekle').addEventListener('click', () => {
      const inp = document.getElementById('malzeme-input');
      UI.malzemeEkle(inp.value);
      inp.value = '';
      inp.focus();
    });

    // Malzeme ekle — Enter
    document.getElementById('malzeme-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const inp = e.target;
        UI.malzemeEkle(inp.value);
        inp.value = '';
      }
    });

    // Filtre butonları aria-pressed başlangıç durumu
    ['sure', 'butce', 'kisi', 'zorluk'].forEach(kat => UI._filtreButonlariniGuncelle(kat));

    // Filtre butonları
    document.querySelectorAll('.filter-group').forEach(grup => {
      grup.addEventListener('click', e => {
        const btn = e.target.closest('.filter-btn');
        if (!btn) return;
        UI.filtreToggle(grup.dataset.kategori, btn.dataset.deger);
      });
    });

    // Tarif ara
    document.getElementById('btn-tarif-ara').addEventListener('click', async () => {
      UI.gosterSection('results');
      UI.loadingGoster();
      try {
        const sonuc = await API.tarifAra();
        UI.loadingGizle();
        UI.tarifleriRender(sonuc.tarifler);
        Gecmis.kaydet(state.malzemeler, state.filtreler, sonuc.tarifler);
      } catch (hata) {
        UI.loadingGizle();
        UI.gosterSection('input-panel');
        hataGoster(hata.message || 'Bir şeyler ters gitti.');
      }
    });

    // Geri butonu
    document.getElementById('btn-geri').addEventListener('click', () => {
      UI.gosterSection('input-panel');
    });

    // Modal favori butonu
    document.getElementById('btn-modal-favori').addEventListener('click', () => {
      if (state.seciliTarif) Favoriler.toggle(state.seciliTarif);
    });

    // Modal kapat
    document.getElementById('btn-modal-kapat').addEventListener('click', () => UI.detayKapat());
    document.getElementById('detail-modal').addEventListener('click', e => {
      if (e.target === e.currentTarget) UI.detayKapat();
    });

    // ESC ile modal kapat
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') UI.detayKapat();
    });

    // Dil değiştirme
    document.getElementById('btn-dil-tr').addEventListener('click', () => {
      if (state.dil === 'tr') return;
      state.dil = 'tr';
      dilUygula();
    });
    document.getElementById('btn-dil-en').addEventListener('click', () => {
      if (state.dil === 'en') return;
      state.dil = 'en';
      dilUygula();
    });

    // Başlangıç dil uygulaması
    dilUygula();
  }
};

// =============================================
// INIT
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  Events.baslat();
  _deepLinkKontrol();
});
