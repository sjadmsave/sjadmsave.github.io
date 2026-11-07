/* المنهج: واجهة عربية مستقلة. يظل catalog.json مصدر النشر الوحيد. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const Core = window.AlmanhajCatalog;
  const favoritesKey = 'almanhaj:favorites:v1';
  const themeKey = 'almanhaj:theme:v1';
  const sortLabels = { newest: 'الأحدث', oldest: 'الأقدم', name: 'الاسم: أ – ي', 'name-desc': 'الاسم: ي – أ' };
  const views = new Set(['discover', 'categories', 'saved', 'about']);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  const state = {
    apps: [], favorites: Core.savedIds(readLocal(favoritesKey)), route: readRoute(),
    loading: true, loadError: false, loaded: false, current: null,
    focusOrigin: null, focusKey: '', controller: null, lastLoaded: 0
  };
  let toastTimer;

  function readLocal(key) { try { return localStorage.getItem(key); } catch { return null; } }
  function writeLocal(key, value) { try { localStorage.setItem(key, value); return true; } catch { return false; } }
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }
  function svg(name, className) {
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('aria-hidden', 'true');
    if (className) icon.setAttribute('class', className);
    const use = document.createElementNS(icon.namespaceURI, 'use');
    use.setAttribute('href', '#i-' + name);
    icon.append(use);
    return icon;
  }
  function appIcon(app, className, eager = false) {
    const image = el('img', className);
    image.src = app.icon;
    image.alt = '';
    image.width = image.height = eager ? 84 : 64;
    image.loading = eager ? 'eager' : 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => { image.src = 'logo.svg'; }, { once: true });
    return image;
  }
  function formatDate(value) {
    return value ? new Intl.DateTimeFormat('ar-IQ', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(value + 'T12:00:00Z')) : 'غير محدد';
  }
  function notify(message) {
    clearTimeout(toastTimer);
    $('snackbar').textContent = message;
    $('snackbar').hidden = false;
    toastTimer = setTimeout(() => { $('snackbar').hidden = true; }, 3800);
  }
  function setTheme(theme) {
    const dark = theme === 'dark' || (theme !== 'light' && systemTheme.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    $('theme-toggle').replaceChildren(svg(dark ? 'sun' : 'moon'));
    $('theme-toggle').setAttribute('aria-label', dark ? 'تفعيل المظهر الفاتح' : 'تفعيل المظهر الداكن');
    document.querySelector('meta[name="theme-color"]').content = dark ? '#101713' : '#f9fbf8';
  }
  $('theme-toggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    writeLocal(themeKey, next);
  });
  systemTheme.addEventListener('change', () => {
    const saved = readLocal(themeKey);
    if (saved !== 'dark' && saved !== 'light') setTheme(null);
  });
  setTheme(readLocal(themeKey));
  $('year').textContent = String(new Date().getFullYear());
  document.querySelector('.skip-link').addEventListener('click', event => {
    event.preventDefault(); focusHeading(); $('content').scrollIntoView({ block: 'start' });
  });

  function readRoute() {
    const params = new URLSearchParams(location.hash.slice(1));
    return {
      view: views.has(params.get('view')) ? params.get('view') : 'discover',
      category: (params.get('category') || 'الكل').slice(0, 80),
      query: (params.get('q') || '').slice(0, 150),
      sort: Object.hasOwn(sortLabels, params.get('sort')) ? params.get('sort') : 'newest',
      app: (params.get('app') || '').slice(0, 300),
      sheet: params.get('sheet') === 'sort' ? 'sort' : ''
    };
  }
  function routeHash(route) {
    const params = new URLSearchParams({ view: route.view });
    if (route.category !== 'الكل') params.set('category', route.category);
    if (route.query) params.set('q', route.query);
    if (route.sort !== 'newest') params.set('sort', route.sort);
    if (route.app) params.set('app', route.app);
    else if (route.sheet) params.set('sheet', route.sheet);
    return '#' + params.toString();
  }
  function navigate(changes, { replace = false, top = false, focus = false } = {}) {
    const next = { ...state.route, ...changes };
    const hash = routeHash(next);
    const overlay = Boolean(next.app || next.sheet);
    history.replaceState({ ...history.state, scroll: scrollY }, '', location.href);
    if (hash !== location.hash) {
      history[replace ? 'replaceState' : 'pushState']({ store: true, scroll: top ? 0 : scrollY, overlay: !replace && overlay }, '', hash);
    }
    applyRoute({ top, focus });
  }
  function closeSheet() {
    if (history.state?.overlay) history.back();
    else navigate({ app: '', sheet: '' }, { replace: true });
  }
  function focusHeading() {
    const id = state.route.view === 'categories' ? 'categories-title' : state.route.view === 'about' ? 'about-title' : 'page-title';
    $(id).focus({ preventScroll: true });
  }
  function applyRoute({ top = false, focus = false, restore = false } = {}) {
    state.route = readRoute();
    const route = state.route;
    const catalogVisible = route.view === 'discover' || route.view === 'saved';
    $('catalog-view').hidden = !catalogVisible;
    $('categories-view').hidden = route.view !== 'categories';
    $('about-view').hidden = route.view !== 'about';
    document.querySelectorAll('.nav-item').forEach(item => {
      const current = item.dataset.view === route.view;
      item.classList.toggle('is-current', current);
      if (current) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
    if (document.activeElement !== $('search')) $('search').value = route.query;
    $('clear-search').hidden = !route.query;
    $('page-kicker').textContent = route.view === 'saved' ? 'قائمتك، على ذوقك' : 'اختياراتك تبدأ هنا';
    $('page-title').textContent = route.view === 'saved' ? 'تطبيقاتك المحفوظة' : 'تطبيقات تناسب يومك';
    $('list-title').textContent = route.query ? 'نتائج البحث' : route.view === 'saved' ? 'المحفوظة' : route.category !== 'الكل' ? route.category : 'اكتشف التطبيقات';
    $('sort-label').textContent = sortLabels[route.sort];
    updateFilters();
    renderCards();
    $('featured-section').hidden = !state.apps.length || route.view !== 'discover' || !!route.query || route.category !== 'الكل' || state.loadError;
    syncSheets();
    if (top) window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    else if (restore) requestAnimationFrame(() => window.scrollTo({ top: history.state?.scroll || 0, behavior: 'instant' }));
    if (focus) focusHeading();
    document.title = route.app && state.current ? state.current.name + ' | المنهج' :
      route.view === 'saved' ? 'المحفوظة | المنهج' : route.view === 'categories' ? 'التصنيفات | المنهج' : 'المنهج | متجر التطبيقات العربية';
  }
  history.scrollRestoration = 'manual';
  history.replaceState({ store: true, scroll: scrollY, overlay: false }, '', location.href);
  addEventListener('popstate', () => applyRoute({ restore: true }));
  addEventListener('hashchange', () => { if (routeHash(readRoute()) !== routeHash(state.route)) applyRoute(); });

  function categoryCounts() {
    const counts = new Map();
    state.apps.forEach(app => counts.set(app.category, (counts.get(app.category) || 0) + 1));
    return counts;
  }
  function categoryIcon(category) {
    return category === 'ترفيه' ? 'game' : /علم|تعليم/.test(category) ? 'book' : 'tools';
  }
  function buildCategories() {
    const filters = document.createDocumentFragment();
    for (const category of ['الكل', ...categoryCounts().keys()]) {
      const button = el('button', 'filter');
      button.type = 'button';
      button.dataset.category = category;
      button.dataset.key = 'filter:' + category;
      button.append(svg('check'), el('span', '', category));
      filters.append(button);
    }
    $('filters').replaceChildren(filters);
    const grid = document.createDocumentFragment();
    for (const [category, count] of categoryCounts()) {
      const button = el('button', 'category-card');
      button.type = 'button';
      button.dataset.category = category;
      const copy = el('span', 'category-copy');
      copy.append(el('strong', '', category), el('small', '', count + ' تطبيق'));
      button.append(svg(categoryIcon(category)), copy, svg('arrow', 'category-arrow'));
      grid.append(button);
    }
    if (!state.apps.length) grid.append(emptyState());
    $('category-grid').replaceChildren(grid);
    updateFilters();
  }
  function updateFilters() {
    document.querySelectorAll('.filter').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === state.route.category)));
  }
  function favoriteButton(app) {
    const saved = state.favorites.has(app.id);
    const button = el('button', 'card-favorite');
    button.type = 'button';
    button.dataset.save = app.id;
    button.dataset.key = 'save:' + app.id;
    button.setAttribute('aria-pressed', String(saved));
    button.setAttribute('aria-label', (saved ? 'إزالة ' : 'حفظ ') + app.name + (saved ? ' من المحفوظة' : ''));
    button.append(svg('heart'));
    return button;
  }
  function card(app) {
    const article = el('article', 'app-card');
    article.dataset.appId = app.id;
    const main = el('button', 'app-main');
    main.type = 'button';
    main.dataset.details = app.id;
    main.dataset.key = 'details:' + app.id;
    main.setAttribute('aria-label', 'تفاصيل ' + app.name);
    const copy = el('div', 'card-copy');
    copy.append(el('h3', '', app.name), el('span', 'card-category', app.category + ' · ' + (app.versionName || 'APK')),
      el('p', 'card-description', app.description || 'اكتشف تفاصيل هذا التطبيق'));
    main.append(appIcon(app, 'card-icon'), copy);
    const actions = el('div', 'card-actions');
    const download = el('a', 'card-download', 'تحميل');
    download.href = app.apkUrl;
    download.target = '_blank';
    download.rel = 'noopener noreferrer';
    download.setAttribute('aria-label', 'تحميل ' + app.name + ' APK');
    actions.append(download, favoriteButton(app));
    article.append(main, actions);
    return article;
  }
  function emptyState() {
    const error = state.loadError;
    const filtered = !!state.route.query || state.route.category !== 'الكل';
    const saved = state.route.view === 'saved';
    const container = el('div', 'empty-state');
    const mark = el('span', 'empty-icon');
    mark.append(svg(error ? 'refresh' : saved ? 'heart' : 'search'));
    const title = error ? 'تعذّر تحميل التطبيقات' : filtered ? 'لا توجد نتائج مطابقة' : saved ? 'كل ما يعجبك، في مكان واحد' : 'لا توجد تطبيقات منشورة حاليًا';
    const description = error ? 'تحقق من الاتصال بالإنترنت، ثم حاول مرة أخرى.' : filtered ? 'جرّب اسمًا آخر أو تصنيفًا مختلفًا.' : saved ? 'اضغط القلب بجانب أي تطبيق لحفظه والعودة إليه لاحقًا.' : 'ستظهر التطبيقات هنا بعد اعتماد نشرها.';
    const button = el('button', 'button tonal-button', error ? 'إعادة المحاولة' : filtered ? 'مسح التصفية' : 'اكتشف التطبيقات');
    button.type = 'button';
    button.dataset.emptyAction = error ? 'reload' : filtered ? 'clear' : 'discover';
    container.append(mark, el('h3', '', title), el('p', '', description), button);
    return container;
  }
  function renderCards() {
    const activeKey = document.activeElement?.dataset.key;
    const fragment = document.createDocumentFragment();
    const list = Core.filterApps(state.apps, {
      category: state.route.category, query: state.route.query, sort: state.route.sort,
      savedOnly: state.route.view === 'saved', favorites: state.favorites
    });
    if (state.loading && !state.loaded) {
      for (let i = 0; i < 4; i++) fragment.append(el('div', 'skeleton-card'));
    } else if (!list.length) fragment.append(emptyState());
    else list.forEach(app => fragment.append(card(app)));
    $('cards').replaceChildren(fragment);
    $('cards').setAttribute('aria-busy', String(state.loading));
    $('result-summary').textContent = state.loading ? 'جارٍ تحديث التطبيقات…' : state.loadError ? 'القائمة غير متاحة مؤقتًا' :
      list.length + ' تطبيق' + (state.route.query ? ' مطابق للبحث' : state.route.view === 'saved' ? ' في قائمتك' : ' متاح للتحميل');
    const filtered = !!state.route.query || state.route.category !== 'الكل';
    $('active-filter').hidden = !filtered;
    $('filter-description').textContent = [state.route.query ? 'البحث: ' + state.route.query : '', state.route.category !== 'الكل' ? state.route.category : ''].filter(Boolean).join(' · ');
    if (activeKey) document.querySelectorAll('[data-key]').forEach(button => {
      if (button.dataset.key === activeKey) button.focus({ preventScroll: true });
    });
  }
  function buildFeatured() {
    const rail = document.createDocumentFragment();
    Core.filterApps(state.apps).slice(0, 4).forEach((app, index) => {
      const button = el('button', 'featured-card tone-' + index);
      button.type = 'button';
      button.dataset.details = app.id;
      button.dataset.key = 'featured:' + app.id;
      button.setAttribute('aria-label', 'اكتشف ' + app.name);
      const main = el('div', 'featured-main');
      const copy = el('div');
      copy.append(el('span', 'mini-label', 'جديد في المنهج'), el('h3', '', app.name), el('p', '', app.description || 'تعرّف على هذا التطبيق وإصداره.'));
      main.append(copy, appIcon(app, '', index === 0));
      const footer = el('div', 'featured-foot');
      footer.append(el('span', '', app.category + ' · الإصدار ' + (app.versionName || '—')), svg('arrow'));
      button.append(main, footer);
      rail.append(button);
    });
    $('featured-rail').replaceChildren(rail);
  }
  function updateFavorites() {
    const count = state.apps.filter(app => state.favorites.has(app.id)).length;
    $('saved-badge').textContent = String(count);
    $('saved-badge').hidden = !count;
    updateModalFavorite();
  }
  function toggleFavorite(app) {
    const saved = state.favorites.has(app.id);
    if (saved) state.favorites.delete(app.id);
    else state.favorites.add(app.id);
    const persisted = writeLocal(favoritesKey, JSON.stringify([...state.favorites]));
    renderCards();
    updateFavorites();
    notify((saved ? 'أُزيل التطبيق من محفوظاتك' : 'أُضيف التطبيق إلى محفوظاتك') + (persisted ? '' : ' · الحفظ متاح لهذه الجلسة فقط'));
  }
  function clearFilters() { navigate({ query: '', category: 'الكل' }, { replace: true }); }

  // One delegated listener keeps the app list responsive as search and filters change.
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target.closest('[data-view],[data-category],[data-details],[data-save],[data-empty-action]') : null;
    if (!target || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (target.dataset.view) {
      event.preventDefault();
      navigate({ view: target.dataset.view, category: 'الكل', query: '', app: '', sheet: '' }, { top: true, focus: true });
    } else if (target.dataset.category) {
      navigate({ view: state.route.view === 'saved' ? 'saved' : 'discover', category: target.dataset.category, app: '', sheet: '' }, { top: state.route.view === 'categories' });
    } else if (target.dataset.details) {
      state.focusOrigin = target;
      state.focusKey = target.dataset.key || '';
      navigate({ app: target.dataset.details, sheet: '' });
    } else if (target.dataset.save) {
      const app = state.apps.find(item => item.id === target.dataset.save);
      if (app) toggleFavorite(app);
    } else if (target.dataset.emptyAction === 'reload') loadCatalog();
    else if (target.dataset.emptyAction === 'clear') clearFilters();
    else navigate({ view: 'discover', category: 'الكل', query: '' }, { top: true, focus: true });
  });
  $('search').addEventListener('input', event => {
    const view = state.route.view === 'saved' ? 'saved' : 'discover';
    navigate({ view, query: event.target.value, app: '', sheet: '' }, { replace: state.route.view === view });
  });
  $('search-form').addEventListener('submit', event => {
    event.preventDefault();
    $('search').blur();
    $('list-title').scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
  });
  $('clear-search').addEventListener('click', () => { navigate({ query: '' }, { replace: true }); $('search').value = ''; $('search').focus(); });
  $('clear-filters').addEventListener('click', clearFilters);
  $('show-latest').addEventListener('click', () => {
    navigate({ view: 'discover', category: 'الكل', query: '', sort: 'newest' });
    $('list-title').scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
  });

  function fill(id, value) { $(id).textContent = value === null || value === undefined || value === '' ? 'غير متوفر' : String(value); }
  function updateModalFavorite() {
    if (!state.current) return;
    const saved = state.favorites.has(state.current.id);
    $('modal-save').setAttribute('aria-pressed', String(saved));
    $('modal-save').querySelector('span').textContent = saved ? 'محفوظ' : 'حفظ التطبيق';
  }
  function restoreOriginFocus() {
    const origin = state.focusOrigin?.isConnected ? state.focusOrigin : [...document.querySelectorAll('[data-key]')].find(item => item.dataset.key === state.focusKey);
    if (origin) origin.focus({ preventScroll: true });
    else focusHeading();
    state.focusOrigin = null;
    state.focusKey = '';
  }
  function syncSheets() {
    const app = state.apps.find(item => item.id === state.route.app);
    const modal = $('details-modal');
    if (app) {
      if (state.current !== app || !modal.open) {
        state.current = app;
        fill('modal-name', app.name); fill('modal-category', app.category); fill('modal-category-stat', app.category);
        fill('modal-description', app.description || 'لم يُضف وصف لهذا التطبيق.');
        fill('modal-version', app.versionName); fill('modal-date', formatDate(app.publishedAt));
        fill('modal-notes', app.notes && !/^[.\s]*$/.test(app.notes) ? app.notes : 'لم تُضف ملاحظات لهذا الإصدار.');
        fill('modal-package', app.packageName); fill('modal-code', app.versionCode);
        fill('modal-sha', app.sha256); fill('modal-cert', app.certificateSha256);
        const image = $('modal-icon');
        image.onerror = () => { image.onerror = null; image.src = 'logo.svg'; };
        image.src = app.icon;
        $('modal-download').href = app.apkUrl;
        const release = new URL(app.apkUrl);
        release.pathname = release.pathname.split('/releases/download/')[0] + '/releases/tag/' + release.pathname.split('/releases/download/')[1].split('/')[0];
        release.search = ''; release.hash = '';
        $('modal-release').href = release.href;
        document.querySelectorAll('[data-copy]').forEach(button => { button.disabled = !/^[a-f\d]{64}$/i.test($(button.dataset.copy).textContent); });
        modal.querySelector('.technical-info').open = false;
        $('share-fallback').hidden = true;
        if ($('sort-modal').open) $('sort-modal').close();
        if (!modal.open) modal.showModal();
        modal.scrollTop = 0;
        $('modal-close').focus({ preventScroll: true });
      }
      updateModalFavorite();
    } else {
      state.current = null;
      if (modal.open) { modal.close(); restoreOriginFocus(); }
      if (state.route.app && state.loaded && !state.loading) {
        notify(state.loadError ? 'تعذّر قراءة بيانات هذا التطبيق. أعد المحاولة.' : 'هذا التطبيق غير متاح في الكتالوج الحالي');
        state.route.app = '';
        history.replaceState({ ...history.state, overlay: false }, '', routeHash(state.route));
      }
    }
    const sort = $('sort-modal');
    if (!app && state.route.sheet === 'sort') {
      sort.querySelectorAll('input').forEach(radio => { radio.checked = radio.value === state.route.sort; });
      if (!sort.open) { sort.showModal(); sort.querySelector(':checked').focus(); }
    } else if (sort.open) { sort.close(); $('sort-open').focus({ preventScroll: true }); }
  }
  $('modal-close').addEventListener('click', closeSheet);
  $('sort-close').addEventListener('click', closeSheet);
  $('sort-open').addEventListener('click', () => navigate({ sheet: 'sort', app: '' }));
  $('sort-form').addEventListener('change', event => {
    if (Object.hasOwn(sortLabels, event.target.value)) navigate({ sort: event.target.value, sheet: '' }, { replace: true });
  });
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeSheet(); });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeSheet();
    });
    const handle = dialog.querySelector('.sheet-handle');
    let start = null;
    handle.addEventListener('pointerdown', event => { start = event.clientY; handle.setPointerCapture(event.pointerId); });
    handle.addEventListener('pointerup', event => { if (start !== null && event.clientY - start > 65) closeSheet(); start = null; });
    handle.addEventListener('pointercancel', () => { start = null; });
  });
  $('modal-save').addEventListener('click', () => { if (state.current) toggleFavorite(state.current); });
  document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', async () => {
    const value = $(button.dataset.copy).textContent;
    if (!/^[a-f\d]{64}$/i.test(value)) return;
    try { await navigator.clipboard.writeText(value); notify('نُسخت البصمة إلى الحافظة'); }
    catch { notify('تعذّر النسخ التلقائي. يمكنك تحديد البصمة ونسخها يدويًا.'); }
  }));
  $('modal-share').addEventListener('click', async () => {
    const app = state.current;
    if (!app) return;
    const url = new URL(location.href);
    url.hash = new URLSearchParams({ view: 'discover', app: app.id }).toString();
    if (navigator.share) {
      try { await navigator.share({ title: app.name + ' | المنهج', url: url.href }); return; }
      catch (error) { if (error.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(url.href); notify('نُسخ رابط التطبيق'); }
    catch { $('share-url').value = url.href; $('share-fallback').hidden = false; $('share-url').focus(); $('share-url').select(); }
  });

  async function loadCatalog() {
    state.controller?.abort();
    const controller = new AbortController();
    state.controller = controller;
    const timeout = setTimeout(() => controller.abort(), 12000);
    state.loading = true;
    state.loadError = false;
    $('refresh-catalog').disabled = true;
    renderCards();
    try {
      const response = await fetch('./catalog.json', { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw Error('Catalog HTTP ' + response.status);
      const apps = Core.parseCatalog(await response.json());
      if (state.controller !== controller) return;
      state.apps = apps;
      state.lastLoaded = Date.now();
    } catch {
      if (state.controller !== controller) return;
      state.apps = [];
      state.loadError = true;
    } finally {
      clearTimeout(timeout);
      if (state.controller === controller) {
        state.loading = false; state.loaded = true;
        $('refresh-catalog').disabled = false;
        $('total-count').textContent = state.loadError ? 'تعذّر التحميل' : state.apps.length + ' تطبيق';
        buildCategories(); buildFeatured(); updateFavorites(); applyRoute();
      }
    }
  }
  $('refresh-catalog').addEventListener('click', loadCatalog);
  function updateConnection() { $('offline-banner').hidden = navigator.onLine; }
  addEventListener('offline', updateConnection);
  addEventListener('online', () => { updateConnection(); if (state.loadError) loadCatalog(); });
  updateConnection();
  addEventListener('storage', event => {
    if (event.key === favoritesKey || event.key === null) { state.favorites = Core.savedIds(readLocal(favoritesKey)); renderCards(); updateFavorites(); }
    if (event.key === themeKey || event.key === null) setTheme(readLocal(themeKey));
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !state.loading && Date.now() - state.lastLoaded > 60000 && navigator.onLine) loadCatalog();
  });
  let scrollQueued = false;
  addEventListener('scroll', () => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => { scrollQueued = false; document.querySelector('.app-bar').classList.toggle('is-scrolled', scrollY > 8); });
  }, { passive: true });
  document.addEventListener('pointerdown', event => {
    if (event.button !== 0 || reducedMotion.matches || !(event.target instanceof Element)) return;
    const target = event.target.closest('button,a.nav-item,a.card-download,a.button,a.brand,summary');
    if (!target || target.disabled) return;
    const bounds = target.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const size = Math.hypot(bounds.width, bounds.height) * 2;
    const wave = el('span', 'ripple-wave');
    wave.setAttribute('aria-hidden', 'true');
    wave.style.setProperty('--ripple-size', size + 'px');
    wave.style.setProperty('--ripple-x', event.clientX - bounds.left - size / 2 + 'px');
    wave.style.setProperty('--ripple-y', event.clientY - bounds.top - size / 2 + 'px');
    target.append(wave);
    setTimeout(() => wave.remove(), 600);
  }, { passive: true });
  applyRoute();
  loadCatalog();
})();
