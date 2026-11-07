/* Shared, dependency-free catalog rules. APK Studio owns catalog.json. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AlmanhajCatalog = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const collator = new Intl.Collator('ar', { sensitivity: 'base', numeric: true });
  const text = (value, max = 4000) => typeof value === 'string' ? value.slice(0, max).trim() : '';
  function normalize(value) {
    return text(value).normalize('NFKC').toLocaleLowerCase('ar')
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا')
      .replace(/ؤ/g, 'و').replace(/[ئى]/g, 'ي').replace(/ة/g, 'ه')
      .replace(/[٠-٩]/g, n => String(n.charCodeAt(0) - 0x660))
      .replace(/[۰-۹]/g, n => String(n.charCodeAt(0) - 0x6f0)).trim();
  }
  function validDownload(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && url.hostname === 'github.com' && !url.port &&
        !url.username && !url.password && /^\/[^/]+\/[^/]+\/releases\/download\/[^/]+\/[^/]+\.apk$/i.test(url.pathname);
    } catch { return false; }
  }
  function iconPath(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && url.host === 'sjadmsave.github.io' &&
        !url.username && !url.password && /^\/almanhaj\/icons\/[a-z\d_-]+\.png$/i.test(url.pathname)
        ? url.pathname.slice('/almanhaj/'.length) + url.search : 'logo.svg';
    } catch { return 'logo.svg'; }
  }
  function isoDate(value) {
    const str = text(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return '';
    const date = new Date(str + 'T12:00:00Z');
    return Number.isFinite(+date) && date.toISOString().slice(0, 10) === str ? str : '';
  }
  function parseCatalog(catalog) {
    if (!catalog || catalog.schema !== 1 || !Array.isArray(catalog.apps)) throw Error('Invalid catalog schema');
    const seen = new Set();
    return catalog.apps.filter(app => {
      if (!app || typeof app.id !== 'string' || !app.id.trim() || app.id.length > 300 ||
          typeof app.name !== 'string' || !app.name.trim() || app.name.length > 160 ||
          app.status !== 'published' || !validDownload(app.apkUrl) || seen.has(app.id)) return false;
      seen.add(app.id);
      return true;
    }).map(app => ({
      id: app.id, name: text(app.name, 160), description: text(app.description),
      category: text(app.category, 80) || 'عام', icon: iconPath(app.icon), apkUrl: app.apkUrl,
      packageName: text(app.packageName, 300), versionName: text(app.versionName, 100),
      versionCode: Number.isSafeInteger(app.versionCode) && app.versionCode >= 0 ? app.versionCode : null,
      publishedAt: isoDate(app.publishedAt), notes: text(app.notes, 16000),
      sha256: /^[a-f\d]{64}$/i.test(app.sha256) ? app.sha256 : '',
      certificateSha256: /^[a-f\d]{64}$/i.test(app.certificateSha256) ? app.certificateSha256 : ''
    }));
  }
  function compareLatest(a, b) {
    return b.publishedAt.localeCompare(a.publishedAt) || collator.compare(a.name, b.name);
  }
  function filterApps(apps, { category = 'الكل', query = '', sort = 'newest', savedOnly = false, favorites = new Set() } = {}) {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    return apps.filter(app => {
      if (category !== 'الكل' && app.category !== category) return false;
      if (savedOnly && !favorites.has(app.id)) return false;
      const haystack = normalize([app.name, app.description, app.category, app.packageName].join(' '));
      return words.every(word => haystack.includes(word) ||
        (word.startsWith('ال') && word.length > 3 && haystack.includes(word.slice(2))));
    }).sort((a, b) => sort === 'name' ? collator.compare(a.name, b.name) :
      sort === 'name-desc' ? collator.compare(b.name, a.name) :
      sort === 'oldest' ? -compareLatest(a, b) : compareLatest(a, b));
  }
  function savedIds(raw) {
    try {
      const value = JSON.parse(raw);
      return new Set(Array.isArray(value) ? value.filter(id => typeof id === 'string' && id.length <= 300) : []);
    } catch { return new Set(); }
  }
  return { normalize, validDownload, iconPath, isoDate, parseCatalog, filterApps, savedIds };
});
