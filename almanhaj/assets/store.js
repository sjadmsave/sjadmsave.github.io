/* المنهج — واجهة المتجر. بيانات التطبيقات تأتي حصراً من catalog.json. */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const favoritesKey = 'almanhaj:favorites:v1';
  const themeKey = 'almanhaj:theme:v1';
  const collator = new Intl.Collator('ar', { sensitivity: 'base', numeric: true });
  const state = {
    apps: [],
    category: 'الكل',
    query: '',
    sort: 'newest',
    favoritesOnly: false,
    favorites: new Set(readSaved(favoritesKey, [])),
    current: null,
    lastFocus: null,
    loadError: false
  };
  const heartSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 8.8c0 5.1-8.5 10.5-8.5 10.5S3.5 13.9 3.5 8.8a4.6 4.6 0 0 1 8.5-2.3 4.6 4.6 0 0 1 8.5 2.3Z"/></svg>';
  const downloadSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/></svg>';

  function readSaved(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      return Array.isArray(parsed) && parsed.every(x => typeof x === 'string') ? parsed : fallback;
    } catch { return fallback; }
  }
  function setSaved(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private browsing */ }
  }
  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = String(text);
    return element;
  }
  function safeHttps(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' ? parsed.href : '';
    } catch { return ''; }
  }
  function validIcon(url) {
    const safe = safeHttps(url);
    return safe && new URL(safe).hostname === 'sjadmsave.github.io' ? safe : 'logo.svg';
  }
  function validDownload(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' &&
        parsed.hostname === 'github.com' &&
        /^\/[^/]+\/[^/]+\/releases\/download\/[^/]+\/[^/]+\.apk$/i.test(parsed.pathname);
    } catch { return false; }
  }
  function normalize(text) {
    return String(text || '')
      .normalize('NFKC')
      .toLocaleLowerCase('ar')
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ؤ/g, 'و')
      .replace(/ئ|ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[٠-٩]/g, n => String(n.charCodeAt(0) - 0x660))
      .replace(/[۰-۹]/g, n => String(n.charCodeAt(0) - 0x6f0))
      .trim();
  }
  function formatDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return 'غير محدد';
    const date = new Date(value + 'T12:00:00Z');
    return Number.isNaN(date.valueOf()) ? 'غير محدد' :
      new Intl.DateTimeFormat('ar-IQ', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
  }
  function isoDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : '0000-00-00'; }
  function icon(element, app) {
    element.src = validIcon(app.icon);
    element.alt = '';
    element.loading = 'lazy';
    element.onerror = () => { element.onerror = null; element.src = 'logo.svg'; };
  }

  function updateTheme() {
    let stored = null;
    try { stored = localStorage.getItem(themeKey); } catch {}
    const dark = stored === 'dark' || (!stored && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    $('theme-toggle').setAttribute('aria-label', dark ? 'تفعيل المظهر الفاتح' : 'تفعيل المظهر الداكن');
    $('theme-toggle').setAttribute('title', dark ? 'المظهر الفاتح' : 'المظهر الداكن');
    $('theme-toggle').innerHTML = dark
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 15.7A8.6 8.6 0 0 1 8.3 3.8 8.6 8.6 0 1 0 20.2 15.7Z"/></svg>';
  }
  $('theme-toggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(themeKey, next); } catch {}
    updateTheme();
  });
  updateTheme();
  $('year').textContent = String(new Date().getFullYear());

  // Bottom navigation with Android-sized touch areas; no page reloads.
  function setMobileTab(id) {
    for (const tab of document.querySelectorAll('.mobile-tab')) {
      const active = tab.id === id;
      tab.classList.toggle('is-current', active);
      if (active) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    }
  }
  function syncMobileTab() {
    if (state.favoritesOnly) return setMobileTab('mobile-saved');
    const atCatalog = $('catalog').getBoundingClientRect().top < 180;
    setMobileTab(atCatalog ? 'mobile-catalog' : 'mobile-home');
  }
  let scrollQueued = false;
  addEventListener('scroll', () => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => { scrollQueued = false; syncMobileTab(); });
  }, { passive: true });
  $('mobile-home').addEventListener('click', () => {
    state.favoritesOnly = false;
    render();
    setMobileTab('mobile-home');
  });
  $('mobile-catalog').addEventListener('click', () => {
    state.favoritesOnly = false;
    render();
    setMobileTab('mobile-catalog');
  });
  $('mobile-saved').addEventListener('click', () => {
    state.favoritesOnly = !state.favoritesOnly;
    render();
    $('catalog').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    setMobileTab(state.favoritesOnly ? 'mobile-saved' : 'mobile-catalog');
  });

  // Material ink ripple: visual feedback only, never intercepts the control click.
  document.addEventListener('pointerdown', event => {
    if (event.button !== 0 || matchMedia('(prefers-reduced-motion: reduce)').matches ||
        !(event.target instanceof Element)) return;
    const element = event.target.closest('button, a.button, a.card-download, a.nav-link, a.identity, a.mobile-tab, summary');
    if (!element || element.disabled) return;
    const bounds = element.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const diameter = Math.max(bounds.width, bounds.height) * 2.1;
    const wave = node('span', 'ripple-wave');
    wave.style.setProperty('--ripple-size', diameter + 'px');
    wave.style.setProperty('--ripple-x', (event.clientX - bounds.left - diameter / 2) + 'px');
    wave.style.setProperty('--ripple-y', (event.clientY - bounds.top - diameter / 2) + 'px');
    wave.setAttribute('aria-hidden', 'true');
    element.append(wave);
    wave.addEventListener('animationend', () => wave.remove(), { once: true });
    setTimeout(() => wave.remove(), 650);
  }, { passive: true });

  function categories() {
    const counts = new Map([['الكل', state.apps.length]]);
    for (const app of state.apps) {
      const category = app.category || 'عام';
      counts.set(category, (counts.get(category) || 0) + 1);
    }
    return counts;
  }
  function filterApps() {
    const words = normalize(state.query).split(/\s+/).filter(Boolean);
    const list = state.apps.filter(app => {
      if (state.category !== 'الكل' && (app.category || 'عام') !== state.category) return false;
      if (state.favoritesOnly && !state.favorites.has(app.id)) return false;
      const haystack = normalize([app.name, app.description, app.category, app.packageName].join(' '));
      return words.every(word => haystack.includes(word) ||
        (word.startsWith('ال') && word.length > 3 && haystack.includes(word.slice(2))));
    });
    const compareLatest = (a, b) => isoDate(b.publishedAt).localeCompare(isoDate(a.publishedAt)) || collator.compare(a.name, b.name);
    list.sort((a, b) => {
      switch (state.sort) {
        case 'oldest': return -compareLatest(a, b);
        case 'name': return collator.compare(a.name, b.name);
        case 'name-desc': return collator.compare(b.name, a.name);
        default: return compareLatest(a, b);
      }
    });
    return list;
  }
  function renderCategories() {
    const fragment = document.createDocumentFragment();
    for (const [category, count] of categories()) {
      const button = node('button', 'filter');
      button.type = 'button';
      button.setAttribute('aria-pressed', String(category === state.category));
      button.append(node('span', '', category), node('small', '', count));
      button.addEventListener('click', () => {
        state.category = category;
        render();
      });
      fragment.append(button);
    }
    $('filters').replaceChildren(fragment);
  }
  function updateFavoritesCount() {
    const count = state.apps.filter(app => state.favorites.has(app.id)).length;
    $('favorites-count').textContent = String(count);
    $('favorites-toggle').setAttribute('aria-pressed', String(state.favoritesOnly));
  }
  function toggleFavorite(app) {
    if (state.favorites.has(app.id)) state.favorites.delete(app.id);
    else state.favorites.add(app.id);
    setSaved(favoritesKey, [...state.favorites]);
    renderCards();
    updateFavoritesCount();
    if (state.current?.id === app.id) updateModalFavorite();
  }
  function favoriteButton(app) {
    const saved = state.favorites.has(app.id);
    const button = node('button', 'card-favorite');
    button.type = 'button';
    button.setAttribute('aria-label', saved ? 'إزالة ' + app.name + ' من المحفوظة' : 'حفظ ' + app.name);
    button.setAttribute('title', saved ? 'إزالة من المحفوظة' : 'حفظ التطبيق');
    button.setAttribute('aria-pressed', String(saved));
    button.innerHTML = heartSvg;
    button.addEventListener('click', () => toggleFavorite(app));
    return button;
  }
  function card(app) {
    const article = node('article', 'app-card');
    const header = node('div', 'card-heading');
    const appIcon = node('img', 'card-icon');
    icon(appIcon, app);
    const titleBlock = node('div');
    titleBlock.append(node('h3', '', app.name), node('span', 'card-category', app.category || 'عام'));
    header.append(appIcon, titleBlock);
    article.append(header, favoriteButton(app));
    article.append(node('p', 'card-description', app.description || 'تعرّف على هذا التطبيق وتفاصيل إصداره.'));
    const footer = node('div', 'card-footer');
    const version = node('div', 'card-version');
    version.append(node('strong', '', 'الإصدار ' + (app.versionName || '—')), node('span', '', formatDate(app.publishedAt)));
    const actions = node('div', 'card-actions');
    const download = node('a', 'card-download');
    download.href = app.apkUrl;
    download.target = '_blank';
    download.rel = 'noopener noreferrer';
    download.append(node('span', '', 'تحميل APK'));
    download.insertAdjacentHTML('beforeend', downloadSvg);
    download.setAttribute('aria-label', 'تحميل ' + app.name + ' APK');
    const details = node('button', 'card-details', 'التفاصيل');
    details.type = 'button';
    details.addEventListener('click', () => openDetails(app, details));
    actions.append(download, details);
    footer.append(version, actions);
    article.append(footer);
    return article;
  }
  function emptyState() {
    const container = node('div', 'empty-state');
    const icon = node('div', 'empty-mark', state.loadError ? '!' : '⌕');
    const title = node('h3', '', state.loadError ? 'تعذّر تحميل التطبيقات' : state.favoritesOnly ? 'لا توجد تطبيقات محفوظة هنا' : 'لا توجد نتائج مطابقة');
    const subtitle = node('p', '', state.loadError ? 'تحقق من اتصالك وحاول إعادة تحميل القائمة.' : state.favoritesOnly ? 'اضغط علامة القلب على التطبيق لحفظه والعودة إليه بسهولة.' : 'جرّب عبارة أخرى أو غيّر التصنيف.');
    const button = node('button', '', state.loadError ? 'إعادة المحاولة' : 'عرض جميع التطبيقات');
    button.type = 'button';
    button.addEventListener('click', () => state.loadError ? loadCatalog() : clearFilters());
    container.append(icon, title, subtitle, button);
    return container;
  }
  function renderCards() {
    const list = filterApps();
    const fragment = document.createDocumentFragment();
    if (!list.length) fragment.append(emptyState());
    else list.forEach(app => fragment.append(card(app)));
    $('cards').replaceChildren(fragment);
    $('result-summary').textContent = state.loadError ? 'حدث خطأ أثناء قراءة القائمة' :
      list.length === state.apps.length ? 'تصفح جميع التطبيقات المتاحة في المتجر' : 'يعرض ' + list.length + ' من ' + state.apps.length + ' تطبيق';
    $('clear-filters').hidden = state.category === 'الكل' && !state.query && !state.favoritesOnly;
  }
  function render() {
    renderCategories();
    updateFavoritesCount();
    renderCards();
    syncMobileTab();
  }
  function clearFilters() {
    state.category = 'الكل';
    state.query = '';
    state.favoritesOnly = false;
    $('search').value = '';
    render();
  }
  $('clear-filters').addEventListener('click', clearFilters);
  $('favorites-toggle').addEventListener('click', () => { state.favoritesOnly = !state.favoritesOnly; render(); });
  $('search').addEventListener('input', event => {
    state.query = event.target.value.trim();
    renderCards();
  });
  $('sort').addEventListener('change', event => {
    state.sort = event.target.value;
    renderCards();
  });

  function fillModal(id, value) { $(id).textContent = value === undefined || value === null || value === '' ? 'غير متوفر' : String(value); }
  function updateModalFavorite() {
    const saved = !!state.current && state.favorites.has(state.current.id);
    $('modal-save').classList.toggle('is-saved', saved);
    $('modal-save').setAttribute('aria-pressed', String(saved));
    $('modal-save').firstChild.textContent = saved ? 'محفوظ' : 'حفظ التطبيق';
  }
  function openDetails(app, origin) {
    const modal = $('details-modal');
    if (!modal || typeof modal.showModal !== 'function') return;
    state.current = app;
    state.lastFocus = origin || document.activeElement;
    fillModal('modal-name', app.name);
    fillModal('modal-description', app.description || 'لا يوجد وصف إضافي لهذا التطبيق.');
    fillModal('modal-category', app.category || 'عام');
    fillModal('modal-version', app.versionName || '—');
    fillModal('modal-date', formatDate(app.publishedAt));
    fillModal('modal-notes', app.notes && !/^\s*\.*\s*$/.test(app.notes) ? app.notes : 'لم تُضف ملاحظات لهذا الإصدار.');
    fillModal('modal-package', app.packageName || '—');
    fillModal('modal-code', Number.isInteger(app.versionCode) ? app.versionCode : '—');
    fillModal('modal-sha', app.sha256 || 'غير متوفرة');
    fillModal('modal-cert', app.certificateSha256 || 'غير متوفرة');
    icon($('modal-icon'), app);
    $('modal-download').href = app.apkUrl;
    $('toast').textContent = '';
    $('modal-save').replaceChildren(node('span', '', 'حفظ التطبيق'));
    $('modal-save').insertAdjacentHTML('beforeend', heartSvg);
    updateModalFavorite();
    $('details-modal').querySelector('.technical-info').open = false;
    if (!modal.open) modal.showModal();
    $('modal-close').focus();
  }
  $('modal-close').addEventListener('click', () => $('details-modal').close());
  $('details-modal').addEventListener('click', event => {
    if (event.target === $('details-modal')) $('details-modal').close();
  });
  $('details-modal').addEventListener('close', () => {
    if (state.lastFocus && state.lastFocus.isConnected) state.lastFocus.focus();
    state.current = null;
    state.lastFocus = null;
  });
  $('modal-save').addEventListener('click', () => {
    if (state.current) {
      toggleFavorite(state.current);
      $('toast').textContent = state.favorites.has(state.current.id) ? 'أُضيف التطبيق إلى محفوظاتك.' : 'أُزيل التطبيق من محفوظاتك.';
    }
  });
  document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', async () => {
    const value = $(button.dataset.copy)?.textContent || '';
    if (!/^[0-9a-f]{64}$/i.test(value)) {
      $('toast').textContent = 'لا توجد بصمة صالحة للنسخ.';
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      $('toast').textContent = 'نُسخت البصمة إلى الحافظة.';
    } catch {
      $('toast').textContent = 'تعذّر النسخ التلقائي. يمكنك تحديد البصمة ونسخها يدويًا.';
    }
  }));

  function spotlight() {
    const latest = [...state.apps].sort((a, b) => isoDate(b.publishedAt).localeCompare(isoDate(a.publishedAt)) || collator.compare(a.name, b.name))[0];
    if (!latest) return;
    icon($('spotlight-icon'), latest);
    $('spotlight-name').textContent = latest.name;
    $('spotlight-description').textContent = latest.description || 'اطّلع على أحدث تفاصيل هذا التطبيق.';
    $('spotlight-version').textContent = 'الإصدار ' + (latest.versionName || '—');
    const trigger = $('spotlight-details');
    trigger.disabled = false;
    trigger.onclick = () => openDetails(latest, trigger);
  }
  function updateTotals() {
    const total = state.apps.length;
    $('total-count').textContent = total + ' تطبيقًا متاحًا';
    $('hero-count').textContent = String(total);
    $('hero-categories').textContent = String(Math.max(0, categories().size - 1));
  }
  async function loadCatalog() {
    state.loadError = false;
    $('result-summary').textContent = 'جارٍ جلب التطبيقات...';
    $('cards').replaceChildren(node('div', 'loading-card'), node('div', 'loading-card'), node('div', 'loading-card'));
    try {
      const response = await fetch('./catalog.json', { cache: 'no-store' });
      if (!response.ok) throw Error('HTTP ' + response.status);
      const catalog = await response.json();
      if (catalog.schema !== 1 || !Array.isArray(catalog.apps)) throw Error('Invalid catalog schema');
      const ids = new Set();
      state.apps = catalog.apps.filter(app => {
        if (!app || app.status !== 'published' || typeof app.id !== 'string' || !app.id ||
          typeof app.name !== 'string' || app.name.length < 1 || app.name.length > 160 ||
          typeof app.apkUrl !== 'string' || !validDownload(app.apkUrl) || ids.has(app.id)) return false;
        ids.add(app.id);
        return true;
      });
      updateTotals();
      spotlight();
    } catch (error) {
      state.apps = [];
      state.loadError = true;
      $('total-count').textContent = 'التطبيقات غير متاحة مؤقتًا';
      $('hero-count').textContent = '—';
      $('hero-categories').textContent = '—';
      console.error('تعذّر تحميل فهرس المنهج:', error);
    }
    render();
  }
  loadCatalog();
})();
