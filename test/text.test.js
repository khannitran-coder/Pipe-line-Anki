// Chạy: node --test test/text.test.js
// Nạp Text.gs (logic thuần) vào sandbox Node để kiểm thử mà không cần Apps Script.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/Text.gs'), 'utf8'), ctx);

test('trích cụm được đánh dấu và gộp trùng không phân biệt hoa/thường', () => {
  const r = ctx.extractPhrasesFromMarkedText('The **exceeded the budget** and **Approve** then **approve**.');
  assert.deepStrictEqual(Array.from(r), ['exceeded the budget', 'Approve']);
});

test('bỏ số thứ tự đầu cụm', () => {
  assert.deepStrictEqual(Array.from(ctx.extractPhrasesFromMarkedText('**5. APPROVE** và **3) deliver**')), ['APPROVE', 'deliver']);
});

test('loại cụm tiếng Việt', () => {
  assert.deepStrictEqual(Array.from(ctx.extractPhrasesFromMarkedText('**ngân sách** **budget**')), ['budget']);
});

test('không nhặt chuỗi bị dính ** rỗng', () => {
  assert.deepStrictEqual(Array.from(ctx.extractPhrasesFromMarkedText('**** ** **')), []);
});

test('chuẩn hóa viết hoa', () => {
  assert.strictEqual(ctx.normalizeWordCasing('  APPROVE '), 'Approve');
  assert.strictEqual(ctx.normalizeWordCasing(''), '');
});

test('loại từ đã có trong Sheet', () => {
  const r = ctx.filterNewPhrases(['Budget', 'risk'], new Set(['budget']));
  assert.deepStrictEqual(Array.from(r), ['risk']);
});

test('đối chiếu số lượng đầu ra', () => {
  assert.strictEqual(ctx.reconcileCounts(['a', 'b'], [{}, {}]).ok, true);
  const bad = ctx.reconcileCounts(['a', 'b', 'c'], [{}]);
  assert.strictEqual(bad.ok, false);
  assert.strictEqual(bad.missing, 2);
  assert.strictEqual(ctx.reconcileCounts(['a'], null).received, 0);
});

test('bóc code fence JSON', () => {
  assert.strictEqual(ctx.stripJsonFences('```json\n[1]\n```'), '[1]');
});
