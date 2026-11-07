// Zero-dependency, read-only checks for the storefront and APK Studio catalog.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const catalog = JSON.parse(read('catalog.json'));
const manifest = JSON.parse(read('manifest.webmanifest'));

assert.equal(catalog.schema, 1, 'catalog schema must remain 1');
assert(Array.isArray(catalog.apps), 'apps must be an array');
const ids = new Set();
for (const app of catalog.apps) {
  assert.equal(app.status, 'published', app.name + ': non-published entry in public catalog');
  assert(app.id && !ids.has(app.id), app.name + ': duplicate/empty id');
  ids.add(app.id);
  assert(typeof app.name === 'string' && app.name.trim(), 'invalid name');
  assert(/^https:\/\/github\.com\/[^/]+\/[^/]+\/releases\/download\/[^/]+\/[^/]+\.apk$/i.test(app.apkUrl), app.name + ': invalid APK URL');
  assert(/^[0-9a-f]{64}$/i.test(app.sha256), app.name + ': invalid APK checksum');
  assert(/^[0-9a-f]{64}$/i.test(app.certificateSha256), app.name + ': invalid certificate fingerprint');
}
assert.equal(manifest.display, 'standalone');
for (const icon of manifest.icons) assert(fs.existsSync(path.join(root, icon.src)), icon.src + ': missing');
for (const file of ['index.html', 'assets/store.css', 'assets/store.js', 'assets/catalog-core.js', 'assets/fonts/OFL.txt']) assert(fs.existsSync(path.join(root, file)), file + ': missing');
for (const file of ['assets/store.js', 'assets/catalog-core.js']) execFileSync(process.execPath, ['--check', path.join(root, file)]);
const html = read('index.html');
const idsInHtml = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(idsInHtml).size, idsInHtml.length, 'duplicate HTML id');
for (const match of read('assets/store.js').matchAll(/\$\('([^']+)'\)/g)) assert(idsInHtml.includes(match[1]), 'missing DOM target: ' + match[1]);
console.log('المنهج: نجح فحص ' + ids.size + ' تطبيقًا والملفات الأساسية.');
