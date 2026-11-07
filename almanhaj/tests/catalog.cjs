const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Core = require('../assets/catalog-core.js');
const catalog = JSON.parse(fs.readFileSync(require('node:path').join(__dirname, '../catalog.json')));
const apps = Core.parseCatalog(catalog);
const example = catalog.apps[0];

test('every existing approved app, release URL, checksum and certificate is preserved', () => {
  assert.equal(apps.length, catalog.apps.length);
  for (const source of catalog.apps) {
    const result = apps.find(app => app.id === source.id);
    assert(result, source.id);
    for (const key of ['apkUrl', 'packageName', 'versionCode', 'versionName', 'sha256', 'certificateSha256']) assert.equal(result[key], source[key]);
    assert(fs.existsSync(require('node:path').join(__dirname, '..', result.icon.split('?')[0])));
  }
});
test('draft, withdrawn, malformed, duplicated and unsafe download entries never render', () => {
  const list = [example, example, null, { ...example, id: 'draft', status: 'draft' }, { ...example, id: 'withdrawn', status: 'withdrawn' },
    { ...example, id: 'unsafe', apkUrl: 'javascript:alert(1)' }, { ...example, id: 'empty', name: ' ' }];
  assert.deepEqual(Core.parseCatalog({ schema: 1, apps: list }).map(a => a.id), [example.id]);
  assert.throws(() => Core.parseCatalog({ schema: 2, apps: [] }));
  assert.throws(() => Core.parseCatalog(null));
});
test('download destination requires HTTPS GitHub release APK without URL credentials', () => {
  for (const url of ['http://github.com/a/b/releases/download/v1/app.apk', 'https://github.com.evil.test/a/b/releases/download/v1/app.apk',
    'https://user:password@github.com/a/b/releases/download/v1/app.apk', 'https://github.com:444/a/b/releases/download/v1/app.apk',
    'https://github.com/a/b/blob/main/app.apk', 'https://github.com/a/b/releases/download/v1/app.html', 'data:text/html,test']) assert.equal(Core.validDownload(url), false, url);
  assert.equal(Core.validDownload(example.apkUrl), true);
});
test('icons use local existing assets and reject foreign sources', () => {
  assert.equal(Core.iconPath('https://sjadmsave.github.io/almanhaj/icons/test.png?v=2'), 'icons/test.png?v=2');
  assert.equal(Core.iconPath('https://evil.test/icon.png'), 'logo.svg');
  assert.equal(Core.iconPath('https://sjadmsave.github.io/other/test.png'), 'logo.svg');
  assert.equal(Core.iconPath('javascript:alert(1)'), 'logo.svg');
});
test('Arabic search tolerates tashkeel, tatweel, alef forms, ya and digit variants', () => {
  assert.equal(Core.normalize(' إِيمَـان ١٢۳ '), 'ايمان 123');
  assert.equal(Core.normalize('عَلَى'), 'علي');
  assert.equal(Core.filterApps(apps, { query: 'تبيان' })[0].name, 'تِبيان');
  assert.equal(Core.filterApps(apps, { query: 'الارض الوسطى' })[0].name, 'الأرض الوسطى');
  assert(Core.filterApps(apps, { query: 'الصدر نور' }).some(app => app.name === 'منهج النور'));
  assert.equal(Core.filterApps(apps, { query: 'لايوجدهذاالتطبيق' }).length, 0);
});
test('category, saved list and query combine without leaking other apps', () => {
  const target = apps.find(app => app.category === 'ترفيه');
  const favorites = new Set([target.id, apps.find(app => app.category !== 'ترفيه').id]);
  const result = Core.filterApps(apps, { category: 'ترفيه', savedOnly: true, favorites, query: target.name });
  assert.deepEqual(result.map(app => app.id), [target.id]);
  assert.equal(Core.filterApps(apps, { savedOnly: true }).length, 0);
  assert.equal(Core.filterApps(apps, { category: 'مداخل العلوم' }).length, catalog.apps.filter(app => app.category === 'مداخل العلوم').length);
});
test('sorting uses actual publication dates and does not modify the source order', () => {
  const before = apps.map(app => app.id);
  const newest = Core.filterApps(apps);
  const oldest = Core.filterApps(apps, { sort: 'oldest' });
  assert(newest[0].publishedAt >= newest.at(-1).publishedAt);
  assert.equal(newest[0].id, oldest.at(-1).id);
  assert.deepEqual(Core.filterApps(apps, { sort: 'name' }).map(a => a.id), Core.filterApps(apps, { sort: 'name-desc' }).map(a => a.id).reverse());
  assert.deepEqual(apps.map(app => app.id), before);
});
test('corrupted local storage and malformed optional fields fail gracefully', () => {
  for (const raw of [null, '', 'null', '{}', 'broken', '42']) assert.equal(Core.savedIds(raw).size, 0);
  assert.deepEqual([...Core.savedIds('["one",null,42,"one","two"]')], ['one', 'two']);
  const parsed = Core.parseCatalog({ schema: 1, apps: [{ ...example, notes: {}, description: [], publishedAt: '2026-02-31', versionCode: -1 }] })[0];
  assert.equal(parsed.notes, ''); assert.equal(parsed.description, ''); assert.equal(parsed.publishedAt, ''); assert.equal(parsed.versionCode, null);
  assert.equal(Core.isoDate('2024-02-29'), '2024-02-29');
  assert.equal(Core.isoDate('2025-02-29'), '');
});
